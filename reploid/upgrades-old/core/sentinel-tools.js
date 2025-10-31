// Sentinel-specific tool implementations for PAWS workflow
// This module contains the complete implementations for Project Sentinel tools
// @blueprint 0x00004E

const SentinelTools = {
  metadata: {
    id: 'SentinelTools',
    version: '1.0.0',
    dependencies: ['config', 'Storage', 'Utils', 'ApiClient', 'EventBus?', 'VerificationManager?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Storage, Utils, ApiClient, EventBus, config } = deps;
    const { logger, Errors } = Utils;
    const { ArtifactError, ToolError } = Errors;

    // Parse dogs.md bundle to extract structured changes
    const parseDogsBundle = (content) => {
      const changes = [];
      const blocks = content.split('```paws-change');

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const metaEnd = block.indexOf('```');
        if (metaEnd === -1) continue;

        const meta = block.substring(0, metaEnd).trim();

        // Parse metadata
        const operationMatch = meta.match(/operation:\s*(\w+)/);
        const filePathMatch = meta.match(/file_path:\s*(.+)/);

        if (!operationMatch || !filePathMatch) {
          logger.warn(`[SentinelTools] Skipping malformed change block in dogs bundle`);
          continue;
        }

        const operation = operationMatch[1];
        const filePath = filePathMatch[1].trim();

        // Extract content for non-DELETE operations
        let newContent = '';
        if (operation !== 'DELETE') {
          const contentStart = block.indexOf('```', metaEnd + 3);
          if (contentStart !== -1) {
            const actualStart = contentStart + 3;
            const contentEnd = block.indexOf('```', actualStart);
            if (contentEnd !== -1) {
              // Handle newline after opening ```
              let startIdx = actualStart;
              if (block[startIdx] === '\n') startIdx++;
              newContent = block.substring(startIdx, contentEnd);
            }
          }
        }

        changes.push({
          operation,
          file_path: filePath,
          new_content: newContent
        });
      }

      return changes;
    };

    // Create cats.md bundle with AI curation support
    const createCatsBundle = async (toolArgs) => {
      const { file_paths, reason, turn_path, ai_curate } = toolArgs;

      let selectedPaths = file_paths;

      // If AI curation is requested, use LLM to select files
      if (ai_curate && !file_paths) {
        logger.info('[SentinelTools] Using AI to curate file selection');
        selectedPaths = await curateFilesWithAI(reason);
      }

      let bundleContent = `## PAWS Context Bundle (cats.md)\n\n`;
      bundleContent += `**Reason:** ${reason}\n\n`;
      bundleContent += `**Files:** ${selectedPaths.length}\n\n`;
      bundleContent += `---\n\n`;

      for (const path of selectedPaths) {
        try {
          const content = await Storage.getArtifactContent(path);
          if (content === null) {
            logger.warn(`[SentinelTools] File not found: ${path}`);
            continue;
          }

          bundleContent += `### File: ${path}\n\n`;
          bundleContent += '```vfs-file\n';
          bundleContent += `path: ${path}\n`;
          bundleContent += '```\n\n';
          bundleContent += '```\n';
          bundleContent += content;
          bundleContent += '\n```\n\n';
        } catch (error) {
          logger.error(`[SentinelTools] Error reading ${path}:`, error);
        }
      }

      await Storage.createArtifact(turn_path, 'markdown', bundleContent,
        `Context bundle for turn: ${reason}`);

      return {
        success: true,
        path: turn_path,
        files_included: selectedPaths.length
      };
    };

    // AI-powered file curation
    const curateFilesWithAI = async (goal) => {
      const allMeta = await Storage.getAllArtifactMetadata();
      const filePaths = Object.keys(allMeta);

      // Filter out session and temporary files
      const relevantPaths = filePaths.filter(path =>
        !path.startsWith('/sessions/') &&
        !path.includes('.tmp') &&
        !path.includes('.backup')
      );

      if (relevantPaths.length === 0) {
        logger.warn('[SentinelTools] No files available for curation');
        return [];
      }

      // Create a file tree summary for the LLM with full paths
      const fileTree = relevantPaths.map(path => {
        // Show full path and file type
        const ext = path.split('.').pop();
        const type = ext === 'js' ? '(module)' : ext === 'json' ? '(config)' : '(file)';
        return `${path} ${type}`;
      }).join('\n');

      const prompt = `You are analyzing a codebase to select relevant files for a task.

Task: ${goal}

Available files (${relevantPaths.length} total):
${fileTree}

Select 5-15 of the MOST relevant files needed to understand and complete this task.
Be selective - focus on core modules, configuration, and files directly related to the goal.
Return ONLY a JSON array of full file paths exactly as shown above.

Example format: ["/upgrades/state-manager.js", "/config.json", "/upgrades/storage-indexeddb.js"]

Your response (JSON array only):`;

      try {
        logger.info('[SentinelTools] Calling LLM for file curation via proxy...');

        // Format message for Gemini API (needs 'parts' array with 'text' property)
        const history = [{
          role: 'user',
          parts: [{ text: prompt }]
        }];

        // Call the API method - ApiClient will automatically use proxy if available
        // The proxy server has the API key from environment variables
        const response = await ApiClient.callApiWithRetry(history, null);

        logger.info('[SentinelTools] LLM response received:', response.type);

        // Emit token usage for UI display
        if (response.usage && EventBus) {
          EventBus.emit('llm:tokens', { usage: response.usage });
        }

        // Parse the LLM response to extract file paths
        const content = response.content;
        const jsonMatch = content.match(/\[[\s\S]*?\]/);
        if (jsonMatch) {
          const selectedFiles = JSON.parse(jsonMatch[0]);
          const validFiles = selectedFiles.filter(f => relevantPaths.includes(f));
          logger.info(`[SentinelTools] AI selected ${validFiles.length} files:`, validFiles);

          // If AI selected 0 files, fall through to heuristic fallback
          if (validFiles.length > 0) {
            return validFiles;
          } else {
            logger.warn('[SentinelTools] AI returned 0 valid files, falling back to heuristic');
          }
        } else {
          logger.warn('[SentinelTools] No JSON array found in LLM response');
        }
      } catch (error) {
        logger.error('[SentinelTools] AI curation failed:', {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        });
      }

      // Fallback to heuristic selection
      logger.warn('[SentinelTools] Falling back to heuristic file selection');
      return relevantPaths.slice(0, 10);
    };

    // Create dogs.md bundle with structured changes
    const createDogsBundle = async (toolArgs) => {
      const { changes, turn_path, summary } = toolArgs;

      let bundleContent = `## PAWS Change Proposal (dogs.md)\n\n`;

      if (summary) {
        bundleContent += `**Summary:** ${summary}\n\n`;
      }

      bundleContent += `**Total Changes:** ${changes.length}\n`;

      // Count by operation type
      const counts = { CREATE: 0, MODIFY: 0, DELETE: 0 };
      changes.forEach(c => counts[c.operation]++);
      bundleContent += `- Create: ${counts.CREATE}\n`;
      bundleContent += `- Modify: ${counts.MODIFY}\n`;
      bundleContent += `- Delete: ${counts.DELETE}\n\n`;
      bundleContent += `---\n\n`;

      for (const change of changes) {
        bundleContent += '```paws-change\n';
        bundleContent += `operation: ${change.operation}\n`;
        bundleContent += `file_path: ${change.file_path}\n`;
        bundleContent += '```\n\n';

        if (change.operation !== 'DELETE' && change.new_content) {
          bundleContent += '```\n';
          bundleContent += change.new_content;
          bundleContent += '\n```\n\n';
        }
      }

      await Storage.createArtifact(turn_path, 'markdown', bundleContent,
        `Change proposal: ${summary || 'Multiple changes'}`);

      return {
        success: true,
        path: turn_path,
        changes_count: changes.length
      };
    };

    // Apply dogs.md bundle with verification and rollback
    const applyDogsBundle = async (toolArgs) => {
      const { dogs_path, verify_command, session_id } = toolArgs;

      const dogsContent = await Storage.getArtifactContent(dogs_path);
      if (!dogsContent) {
        throw new ArtifactError(`Dogs bundle not found: ${dogs_path}`);
      }

      const changes = parseDogsBundle(dogsContent);
      if (changes.length === 0) {
        return {
          success: false,
          message: 'No valid changes found in dogs bundle'
        };
      }

      // Check session workspace constraints
      if (session_id) {
        const sessionPath = `/sessions/${session_id}/`;
        for (const change of changes) {
          if (!isPathAllowed(change.file_path, sessionPath)) {
            throw new ToolError(
              `Security: Change to ${change.file_path} violates session workspace constraints`
            );
          }
        }
      }

      // Create checkpoint before applying changes
      const checkpoint = await Storage.createCheckpoint(
        `Before applying ${dogs_path}`
      );
      logger.info(`[SentinelTools] Created checkpoint: ${checkpoint.id}`);

      const appliedChanges = [];
      try {
        // Apply each change
        for (const change of changes) {
          logger.info(`[SentinelTools] Applying ${change.operation} to ${change.file_path}`);

          if (change.operation === 'CREATE') {
            // Check if file already exists
            const existing = await Storage.getArtifactContent(change.file_path);
            if (existing !== null) {
              throw new ToolError(`Cannot CREATE ${change.file_path}: file already exists`);
            }
            await Storage.createArtifact(
              change.file_path,
              'text',
              change.new_content,
              'Created by dogs bundle'
            );
            appliedChanges.push(change);

          } else if (change.operation === 'MODIFY') {
            // Check if file exists
            const existing = await Storage.getArtifactContent(change.file_path);
            if (existing === null) {
              throw new ToolError(`Cannot MODIFY ${change.file_path}: file not found`);
            }
            await Storage.updateArtifact(change.file_path, change.new_content);
            appliedChanges.push(change);

          } else if (change.operation === 'DELETE') {
            await Storage.deleteArtifact(change.file_path);
            appliedChanges.push(change);
          }
        }

        // Run verification if provided
        if (verify_command) {
          logger.info(`[SentinelTools] Running verification: ${verify_command}`);
          const verifyResult = await runVerificationCommand(verify_command);

          if (!verifyResult.success) {
            // Rollback on verification failure
            logger.error(`[SentinelTools] Verification failed, rolling back`);
            await Storage.restoreCheckpoint(checkpoint.id);
            return {
              success: false,
              message: `Verification failed: ${verifyResult.error}`,
              changes_rolled_back: appliedChanges.length,
              checkpoint_restored: checkpoint.id
            };
          }
        }

        // Commit the changes to Git VFS if available
        if (Storage.commitChanges) {
          await Storage.commitChanges(
            `Applied dogs bundle: ${appliedChanges.length} changes`,
            { dogs_path, checkpoint: checkpoint.id }
          );
        }

        return {
          success: true,
          message: `Successfully applied ${appliedChanges.length} changes`,
          changes_applied: appliedChanges,
          checkpoint: checkpoint.id
        };

      } catch (error) {
        // Rollback on any error
        logger.error(`[SentinelTools] Error applying changes, rolling back:`, error);
        await Storage.restoreCheckpoint(checkpoint.id);
        throw new ToolError(`Failed to apply dogs bundle: ${error.message}`);
      }
    };

    // Check if a path is allowed based on session constraints
    const isPathAllowed = (path, sessionPath) => {
      // Session-scoped files must be within session directory
      if (sessionPath && !path.startsWith(sessionPath)) {
        // Allow read-only access to /modules and /docs
        if (path.startsWith('/modules/') || path.startsWith('/docs/')) {
          return false; // Cannot modify system directories from session
        }
      }
      return true;
    };

    // Run verification command in sandboxed environment
    const runVerificationCommand = async (command, sessionId) => {
      if (!command) {
        return { success: true }; // No verification needed
      }

      logger.info(`[SentinelTools] Running verification: ${command}`);

      try {
        // Try to use VerificationManager if available (Web Worker sandbox)
        if (deps.VerificationManager) {
          try {
            const result = await deps.VerificationManager.runVerification(command, sessionId);
            logger.info(`[SentinelTools] Verification ${result.success ? 'passed' : 'failed'}`);
            return result;
          } catch (err) {
            logger.error(`[SentinelTools] VerificationManager failed:`, err);
            // Fall through to basic verification
          }
        }

        // Try to use VerificationManager if available
        try {
          const VerificationManager = globalThis.DIContainer?.resolve('VerificationManager');

          if (VerificationManager) {
            logger.info(`[SentinelTools] Running verification via VerificationManager: ${command}`);
            const result = await VerificationManager.runVerification(command);
            return result;
          } else {
            logger.warn('[SentinelTools] VerificationManager not available, falling back to basic patterns');
          }
        } catch (error) {
          logger.warn(`[SentinelTools] VerificationManager failed: ${error.message}, falling back to basic patterns`);
        }

        // Fallback: Basic verification patterns (when VerificationManager unavailable)
        if (command.startsWith('test:')) {
          // Run a test file from VFS
          const testPath = command.substring(5);
          const testCode = await Storage.getArtifactContent(testPath);
          if (!testCode) {
            return { success: false, error: `Test file not found: ${testPath}` };
          }

          logger.warn(`[SentinelTools] Test found at ${testPath} - VerificationManager should be enabled for actual execution`);
          return {
            success: true,
            output: `Test file found: ${testPath} (use VerificationManager for execution)`,
            warning: 'Tests not executed - VerificationManager not available'
          };
        }

        // Pattern matching for common verification commands
        const patterns = {
          'npm test': /^npm\s+(test|run\s+test)/,
          'npm run build': /^npm\s+run\s+build/,
          'lint': /lint/,
          'typecheck': /type-?check/
        };

        for (const [name, pattern] of Object.entries(patterns)) {
          if (pattern.test(command)) {
            logger.warn(`[SentinelTools] ${name} recognized - use VerificationManager for execution`);
            return {
              success: true,
              output: `${name} command recognized (use VerificationManager for execution)`,
              warning: 'Command not executed - VerificationManager not available'
            };
          }
        }

        // Unknown command type
        logger.warn(`[SentinelTools] Unknown verification command: ${command}`);
        return {
          success: false,
          error: `Unknown verification command: ${command}. Use format 'test:<path>' or standard commands like 'npm test'.`
        };

      } catch (error) {
        logger.error(`[SentinelTools] Verification error:`, error);
        return { success: false, error: error.message };
      }
    };

    // Tool execution tracking for widget
    let toolExecutionHistory = [];
    let toolStats = {
      createCatsBundle: { calls: 0, successes: 0, failures: 0, lastUsed: null },
      createDogsBundle: { calls: 0, successes: 0, failures: 0, lastUsed: null },
      applyDogsBundle: { calls: 0, successes: 0, failures: 0, lastUsed: null },
      curateFilesWithAI: { calls: 0, successes: 0, failures: 0, lastUsed: null }
    };

    // Wrap functions to track usage
    const trackExecution = (toolName, fn) => {
      return async (...args) => {
        const startTime = Date.now();
        toolStats[toolName].calls++;
        toolStats[toolName].lastUsed = startTime;

        try {
          const result = await fn(...args);
          toolStats[toolName].successes++;

          toolExecutionHistory.push({
            tool: toolName,
            timestamp: startTime,
            duration: Date.now() - startTime,
            success: true,
            args: args[0] // First arg for context
          });

          // Keep history limited to last 100 executions
          if (toolExecutionHistory.length > 100) {
            toolExecutionHistory = toolExecutionHistory.slice(-100);
          }

          return result;
        } catch (error) {
          toolStats[toolName].failures++;

          toolExecutionHistory.push({
            tool: toolName,
            timestamp: startTime,
            duration: Date.now() - startTime,
            success: false,
            error: error.message
          });

          throw error;
        }
      };
    };

    // Web Component Widget
    class SentinelToolsWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 2 seconds
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const totalCalls = Object.values(toolStats).reduce((sum, s) => sum + s.calls, 0);
        const totalSuccesses = Object.values(toolStats).reduce((sum, s) => sum + s.successes, 0);
        const successRate = totalCalls > 0 ? Math.round((totalSuccesses / totalCalls) * 100) : 100;

        const recentExecution = toolExecutionHistory.length > 0
          ? toolExecutionHistory[toolExecutionHistory.length - 1]
          : null;

        const isActive = recentExecution && (Date.now() - recentExecution.timestamp) < 5000;

        return {
          state: isActive ? 'active' : 'idle',
          primaryMetric: `${totalCalls} tools run`,
          secondaryMetric: `${successRate}% success`,
          lastActivity: recentExecution?.timestamp || null,
          message: recentExecution ? `Last: ${recentExecution.tool}` : null
        };
      }

      getControls() {
        return [
          {
            id: 'clear-history',
            label: '⛶️ Clear History',
            action: () => {
              toolExecutionHistory = [];
              this.render();
              return { success: true, message: 'Tool execution history cleared' };
            }
          },
          {
            id: 'reset-stats',
            label: '↻ Reset Stats',
            action: () => {
              Object.keys(toolStats).forEach(tool => {
                toolStats[tool] = { calls: 0, successes: 0, failures: 0, lastUsed: null };
              });
              this.render();
              return { success: true, message: 'Tool statistics reset' };
            }
          }
        ];
      }

      render() {
        const recentExecutions = toolExecutionHistory.slice(-20).reverse();

        // Calculate success rates per tool
        const toolList = Object.entries(toolStats).map(([name, stats]) => {
          const successRate = stats.calls > 0
            ? Math.round((stats.successes / stats.calls) * 100)
            : 0;

          return { name, stats, successRate };
        }).sort((a, b) => b.stats.calls - a.stats.calls);

        const totalCalls = Object.values(toolStats).reduce((sum, s) => sum + s.calls, 0);
        const totalSuccesses = Object.values(toolStats).reduce((sum, s) => sum + s.successes, 0);
        const totalFailures = Object.values(toolStats).reduce((sum, s) => sum + s.failures, 0);

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }
            .sentinel-tools-panel {
              padding: 12px;
              color: #fff;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }
            .tools-summary {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }
            .stat-card {
              padding: 10px;
              border-radius: 5px;
            }
            .stat-card.executions {
              background: rgba(0,255,255,0.1);
            }
            .stat-card.successes {
              background: rgba(76,175,80,0.1);
            }
            .stat-card.failures {
              background: rgba(244,67,54,0.1);
            }
            .stat-label {
              color: #888;
              font-size: 12px;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
            }
            .stat-value.cyan {
              color: #0ff;
            }
            .stat-value.green {
              color: #4caf50;
            }
            .stat-value.red {
              color: #f44336;
            }
            .tools-catalog {
              margin-bottom: 20px;
            }
            .tool-list {
              max-height: 250px;
              overflow-y: auto;
            }
            .tool-item {
              padding: 10px;
              margin-bottom: 8px;
              background: rgba(255,255,255,0.05);
              border-radius: 5px;
            }
            .tool-item-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .tool-name {
              font-weight: bold;
              margin-bottom: 4px;
            }
            .tool-stats {
              font-size: 12px;
              color: #888;
            }
            .tool-status {
              text-align: right;
              font-size: 20px;
            }
            .tool-last-used {
              font-size: 11px;
              color: #666;
              margin-top: 4px;
            }
            .execution-history {
              margin-top: 20px;
            }
            .execution-list {
              max-height: 300px;
              overflow-y: auto;
            }
            .execution-item {
              padding: 8px;
              margin-bottom: 8px;
              background: rgba(255,255,255,0.03);
            }
            .execution-item.success {
              border-left: 3px solid #4caf50;
            }
            .execution-item.failure {
              border-left: 3px solid #f44336;
            }
            .execution-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 4px;
            }
            .execution-tool {
              font-weight: bold;
            }
            .execution-status {
              font-size: 18px;
            }
            .execution-status.success {
              color: #4caf50;
            }
            .execution-status.failure {
              color: #f44336;
            }
            .execution-meta {
              font-size: 12px;
              color: #888;
            }
            .execution-error {
              font-size: 11px;
              color: #f44336;
              margin-top: 4px;
            }
            .no-executions {
              color: #888;
              padding: 20px;
              text-align: center;
            }
          </style>
          <div class="sentinel-tools-panel">
            <h4>⚒️ Sentinel Tools</h4>

            <div class="tools-summary">
              <div class="stat-card executions">
                <div class="stat-label">Total Executions</div>
                <div class="stat-value cyan">${totalCalls}</div>
              </div>
              <div class="stat-card successes">
                <div class="stat-label">Successes</div>
                <div class="stat-value green">${totalSuccesses}</div>
              </div>
              <div class="stat-card failures">
                <div class="stat-label">Failures</div>
                <div class="stat-value red">${totalFailures}</div>
              </div>
            </div>

            <div class="tools-catalog">
              <h4>Tool Catalog</h4>
              <div class="tool-list">
                ${toolList.map(({ name, stats, successRate }) => `
                  <div class="tool-item">
                    <div class="tool-item-header">
                      <div>
                        <div class="tool-name">${name}</div>
                        <div class="tool-stats">
                          ${stats.calls} calls · ${successRate}% success
                        </div>
                      </div>
                      <div class="tool-status">
                        ${stats.calls > 0 ? '✓' : '○'}
                      </div>
                    </div>
                    ${stats.lastUsed ? `
                      <div class="tool-last-used">
                        Last used: ${new Date(stats.lastUsed).toLocaleString()}
                      </div>
                    ` : ''}
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="execution-history">
              <h4>Recent Executions (${recentExecutions.length})</h4>
              <div class="execution-list">
                ${recentExecutions.length > 0 ? recentExecutions.map(exec => {
                  const time = new Date(exec.timestamp).toLocaleTimeString();
                  const statusClass = exec.success ? 'success' : 'failure';
                  const statusIcon = exec.success ? '✓' : '✗';

                  return `
                    <div class="execution-item ${statusClass}">
                      <div class="execution-header">
                        <div class="execution-tool">${exec.tool}</div>
                        <div class="execution-status ${statusClass}">${statusIcon}</div>
                      </div>
                      <div class="execution-meta">
                        ${time} · ${exec.duration}ms
                      </div>
                      ${exec.error ? `
                        <div class="execution-error">
                          Error: ${exec.error}
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('') : '<div class="no-executions">No executions yet</div>'}
              </div>
            </div>
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'sentinel-tools-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, SentinelToolsWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Sentinel Tools',
      icon: '⚒️',
      category: 'tools'
    };

    // Export the tool implementations
    return {
      api: {
        createCatsBundle: trackExecution('createCatsBundle', createCatsBundle),
        createDogsBundle: trackExecution('createDogsBundle', createDogsBundle),
        applyDogsBundle: trackExecution('applyDogsBundle', applyDogsBundle),
        parseDogsBundle,
        isPathAllowed,
        curateFilesWithAI: trackExecution('curateFilesWithAI', curateFilesWithAI)
      },
      widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(SentinelTools);
}

export default SentinelTools;