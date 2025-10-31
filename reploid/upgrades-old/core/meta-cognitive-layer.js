/**
 * @fileoverview Meta-Cognitive Layer - Autonomous Self-Improvement Coordinator
 * The "executive function" that decides when and how the agent should improve itself
 *
 * This module:
 * - Monitors efficiency via DejaVuDetector
 * - Decides when improvements are needed
 * - Coordinates improvement execution
 * - Tracks improvement outcomes
 * - Learns which improvements work best
 *
 * @blueprint 0x000045 - Meta-cognitive coordination layer for autonomous self-improvement decision-making.
 * @module MetaCognitiveLayer
 * @version 1.0.0
 * @category meta-cognitive
 */

const MetaCognitiveLayer = {
  metadata: {
    id: 'MetaCognitiveLayer',
    version: '1.0.0',
    dependencies: [
      'DejaVuDetector',
      'ReflectionStore',
      'MetaToolCreator',
      'Utils',
      'EventBus',
      'StateManager',
      'HybridLLMProvider',
      'ToolRunner'
    ],
    async: true,
    type: 'meta-cognitive'
  },

  factory: (deps) => {
    const {
      DejaVuDetector,
      ReflectionStore,
      MetaToolCreator,
      Utils,
      EventBus,
      StateManager,
      HybridLLMProvider,
      ToolRunner
    } = deps;
    const { logger } = Utils;

    // Meta-cognitive configuration
    const CONFIG = {
      enabled: true,
      checkIntervalMs: 10 * 60 * 1000,  // Check every 10 minutes
      minInefficiencyThreshold: 0.4,     // Trigger improvement if inefficiency > 40%
      maxImprovementsPerSession: 3,      // Limit improvements per session
      requireApproval: false,             // Auto-apply meta-improvements (risky!)
      confidenceThreshold: 0.7            // Only apply if confidence > 70%
    };

    let checkTimer = null;
    let improvementHistory = [];
    let currentSession = {
      startTime: Date.now(),
      improvementsApplied: 0,
      improvementsProposed: 0
    };

    /**
     * Initialize meta-cognitive layer
     */
    const init = async () => {
      logger.info('[MetaCognitive] Initializing executive function');

      // Initialize DejaVuDetector
      await DejaVuDetector.init();

      // Start periodic efficiency checks
      if (CONFIG.enabled) {
        startMonitoring();
      }

      // Listen for manual improvement requests
      EventBus.on('meta:improve', handleManualImprovement);

      // Listen for high-confidence déjà vu events
      EventBus.on('deja-vu:detected', handleDejaVuEvent);

      // Listen for ReflectionAnalyzer improvement opportunities
      EventBus.on('meta:improvement:opportunity', handleImprovementOpportunity);

      // Listen for ReflectionAnalyzer inefficiency detection
      EventBus.on('meta:inefficiency:detected', handleInefficiencyDetected);

      logger.info('[MetaCognitive] Meta-cognitive layer active');
    };

    /**
     * Start periodic monitoring
     */
    const startMonitoring = () => {
      if (checkTimer) {
        clearInterval(checkTimer);
      }

      checkTimer = setInterval(async () => {
        await performEfficiencyCheck();
      }, CONFIG.checkIntervalMs);

      logger.info(`[MetaCognitive] Monitoring started (interval: ${CONFIG.checkIntervalMs / 60000}min)`);
    };

    /**
     * Stop periodic monitoring
     */
    const stopMonitoring = () => {
      if (checkTimer) {
        clearInterval(checkTimer);
        checkTimer = null;
      }

      logger.info('[MetaCognitive] Monitoring stopped');
    };

    /**
     * Perform efficiency check and decide on improvements
     */
    const performEfficiencyCheck = async () => {
      logger.info('[MetaCognitive] Performing efficiency check');

      try {
        // Get inefficiency score from DejaVuDetector
        const inefficiency = await DejaVuDetector.calculateInefficiencyScore();

        logger.info(`[MetaCognitive] Inefficiency score: ${inefficiency.score} (${inefficiency.level})`);

        // Decide if improvement is needed
        if (inefficiency.score >= CONFIG.minInefficiencyThreshold) {
          logger.warn(`[MetaCognitive] ⚠️  High inefficiency detected! Initiating meta-improvement...`);

          // Get improvement suggestions
          const suggestions = await DejaVuDetector.suggestImprovements();

          if (suggestions.length > 0) {
            await planAndExecuteImprovements(suggestions, inefficiency);
          }
        } else {
          logger.info('[MetaCognitive] Efficiency acceptable, no meta-improvement needed');
        }

        // Store check result as reflection
        await ReflectionStore.storeReflection({
          type: 'meta_cognitive_check',
          category: 'efficiency',
          outcome: inefficiency.score >= CONFIG.minInefficiencyThreshold ? 'improvement_needed' : 'acceptable',
          data: {
            inefficiencyScore: inefficiency.score,
            level: inefficiency.level,
            reasons: inefficiency.reasons,
            suggestionsCount: (await DejaVuDetector.suggestImprovements()).length
          }
        });

      } catch (error) {
        logger.error('[MetaCognitive] Efficiency check failed:', error);
      }
    };

    /**
     * Plan and execute meta-improvements
     */
    const planAndExecuteImprovements = async (suggestions, inefficiency) => {
      logger.info(`[MetaCognitive] Planning improvements from ${suggestions.length} suggestions`);

      // Limit improvements per session
      const remainingSlots = CONFIG.maxImprovementsPerSession - currentSession.improvementsApplied;
      if (remainingSlots <= 0) {
        logger.warn('[MetaCognitive] Max improvements reached for this session');
        return;
      }

      const toApply = suggestions.slice(0, remainingSlots);

      for (const suggestion of toApply) {
        currentSession.improvementsProposed++;

        logger.info(`[MetaCognitive] Evaluating improvement: ${suggestion.action}`);

        // Decide if we should apply this improvement
        const decision = await decideImprovement(suggestion);

        if (decision.approved) {
          logger.info(`[MetaCognitive] ✓ Applying improvement: ${suggestion.rationale}`);

          const result = await executeImprovement(suggestion);

          if (result.success) {
            currentSession.improvementsApplied++;

            // Record success
            improvementHistory.push({
              timestamp: Date.now(),
              suggestion: suggestion,
              result: result,
              inefficiencyBefore: inefficiency.score,
              outcome: 'success'
            });

            // Emit event
            EventBus.emit('meta:improvement:applied', {
              improvement: suggestion,
              result: result
            });
          } else {
            logger.error(`[MetaCognitive] ✗ Improvement failed: ${result.error}`);

            // Record failure
            improvementHistory.push({
              timestamp: Date.now(),
              suggestion: suggestion,
              result: result,
              inefficiencyBefore: inefficiency.score,
              outcome: 'failure'
            });
          }
        } else {
          logger.info(`[MetaCognitive] ⏭️  Skipped improvement: ${decision.reason}`);
        }
      }

      logger.info(`[MetaCognitive] Applied ${currentSession.improvementsApplied} improvements this session`);
    };

    /**
     * Decide whether to apply an improvement
     */
    const decideImprovement = async (suggestion) => {
      // If manual approval required, emit event and wait
      if (CONFIG.requireApproval) {
        logger.info('[MetaCognitive] Manual approval required');

        // For now, auto-reject if approval required
        // TODO: Implement approval UI
        return {
          approved: false,
          reason: 'Manual approval required (not yet implemented)'
        };
      }

      // Auto-decision logic
      const decision = {
        approved: false,
        reason: '',
        confidence: 0
      };

      // Check pattern confidence
      if (suggestion.pattern && suggestion.pattern.confidence < CONFIG.confidenceThreshold) {
        decision.reason = `Pattern confidence too low (${suggestion.pattern.confidence})`;
        return decision;
      }

      // Priority-based auto-approval
      if (suggestion.priority === 'critical') {
        decision.approved = true;
        decision.reason = 'Critical priority - auto-approved';
        decision.confidence = 0.9;
        return decision;
      }

      if (suggestion.priority === 'high') {
        decision.approved = true;
        decision.reason = 'High priority - auto-approved';
        decision.confidence = 0.8;
        return decision;
      }

      if (suggestion.priority === 'medium') {
        decision.approved = true;
        decision.reason = 'Medium priority - auto-approved';
        decision.confidence = 0.7;
        return decision;
      }

      decision.reason = 'Low priority - skipped';
      return decision;
    };

    /**
     * Execute a specific improvement
     */
    const executeImprovement = async (suggestion) => {
      logger.info(`[MetaCognitive] Executing improvement: ${suggestion.action}`);

      try {
        switch (suggestion.action) {
          case 'create_tool_factory':
            return await createToolFactory(suggestion);

          case 'create_composite_tool':
            return await createCompositeTool(suggestion);

          case 'avoid_pattern':
            return await recordAvoidancePattern(suggestion);

          case 'refactor_file':
            return await suggestRefactoring(suggestion);

          default:
            return {
              success: false,
              error: `Unknown improvement action: ${suggestion.action}`
            };
        }
      } catch (error) {
        logger.error('[MetaCognitive] Improvement execution failed:', error);
        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    };

    /**
     * Create a factory tool for repeated pattern
     */
    const createToolFactory = async (suggestion) => {
      const { category, examples } = suggestion.params;

      logger.info(`[MetaCognitive] Creating factory tool for category: ${category}`);

      // Use LLM to generate factory implementation
      const prompt = `You are improving the agent's tool-creation efficiency.

PATTERN DETECTED: The agent created ${examples.length} similar tools:
${examples.join('\n')}

Create a factory tool that can automatically generate "${category}_" tools.

The factory should:
1. Take a domain name as input
2. Take optional customizations
3. Generate a complete tool definition
4. Register it dynamically

Return JSON with:
{
  "name": "create_${category}_tool",
  "description": "...",
  "inputSchema": { ... },
  "implementation": {
    "type": "javascript",
    "code": "// Factory implementation"
  }
}`;

      const response = await HybridLLMProvider.complete([
        {
          role: 'system',
          content: 'You are the MetaCognitiveLayer improving tool creation efficiency.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.4,
        maxOutputTokens: 2000,
        responseFormat: 'json'
      });

      const toolDef = JSON.parse(response.text);

      // Create the factory tool
      await MetaToolCreator.createDynamicTool(
        toolDef.name,
        toolDef.description,
        toolDef.inputSchema,
        toolDef.implementation,
        {
          reason: `Auto-generated factory for ${category} tools`,
          metaCognitive: true
        }
      );

      return {
        success: true,
        toolName: toolDef.name,
        message: `Created factory tool: ${toolDef.name}`
      };
    };

    /**
     * Create composite tool for repeated sequence
     */
    const createCompositeTool = async (suggestion) => {
      const { sequence, name } = suggestion.params;

      logger.info(`[MetaCognitive] Creating composite tool for sequence: ${sequence.join(' → ')}`);

      const prompt = `You are improving the agent's workflow efficiency.

PATTERN DETECTED: The agent repeatedly executes this tool sequence:
${sequence.join(' → ')}

Create a composite tool that automates this workflow.

Return JSON with:
{
  "name": "${name}",
  "description": "...",
  "inputSchema": { ... },
  "implementation": {
    "type": "composite",
    "steps": [
      { "tool": "...", "args_template": "..." },
      ...
    ]
  }
}`;

      const response = await HybridLLMProvider.complete([
        {
          role: 'system',
          content: 'You are the MetaCognitiveLayer automating repeated workflows.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.4,
        maxOutputTokens: 2000,
        responseFormat: 'json'
      });

      const toolDef = JSON.parse(response.text);

      await MetaToolCreator.createDynamicTool(
        toolDef.name,
        toolDef.description,
        toolDef.inputSchema,
        toolDef.implementation,
        {
          reason: `Auto-generated composite for workflow: ${sequence.join(' → ')}`,
          metaCognitive: true
        }
      );

      return {
        success: true,
        toolName: toolDef.name,
        message: `Created composite tool: ${toolDef.name}`
      };
    };

    /**
     * Record pattern to avoid
     */
    const recordAvoidancePattern = async (suggestion) => {
      const { pattern, alternative_needed } = suggestion.params;

      logger.warn(`[MetaCognitive] Recording avoidance pattern: ${pattern}`);

      // Store as reflection for future reference
      await ReflectionStore.storeReflection({
        type: 'avoidance_pattern',
        category: 'meta_learning',
        outcome: 'pattern_to_avoid',
        data: {
          pattern: pattern,
          reason: suggestion.rationale,
          alternative_needed: alternative_needed
        },
        tags: ['avoid', 'failure_pattern', 'meta_learning']
      });

      // TODO: Add to system prompt or context for future cycles
      // For now, just store in reflections

      return {
        success: true,
        message: `Recorded avoidance pattern: ${pattern}`
      };
    };

    /**
     * Suggest refactoring for frequently modified file
     */
    const suggestRefactoring = async (suggestion) => {
      const { path, reason } = suggestion.params;

      logger.info(`[MetaCognitive] Analyzing ${path} for refactoring opportunities`);

      // Read current file
      const content = await StateManager.getArtifactContent(path);

      if (!content) {
        return {
          success: false,
          error: `File not found: ${path}`
        };
      }

      // Use LLM to analyze and suggest refactoring
      const prompt = `You are analyzing code for refactoring opportunities.

FILE: ${path}
REASON: ${reason}

This file has been modified frequently, suggesting it may need better abstraction.

Analyze the code and suggest specific refactorings:

\`\`\`javascript
${content}
\`\`\`

Return JSON with:
{
  "suggestions": [
    {
      "type": "extract_function|create_module|add_abstraction|...",
      "description": "...",
      "benefit": "..."
    }
  ],
  "priority": "high|medium|low"
}`;

      const response = await HybridLLMProvider.complete([
        {
          role: 'system',
          content: 'You are the MetaCognitiveLayer analyzing code quality.'
        },
        {
          role: 'user',
          content: prompt
        }
      ], {
        temperature: 0.5,
        maxOutputTokens: 1500,
        responseFormat: 'json'
      });

      const analysis = JSON.parse(response.text);

      // Store suggestions as reflection
      await ReflectionStore.storeReflection({
        type: 'refactoring_suggestion',
        category: 'code_quality',
        outcome: 'analysis_complete',
        data: {
          path: path,
          reason: reason,
          suggestions: analysis.suggestions,
          priority: analysis.priority
        },
        tags: ['refactoring', 'code_quality', 'meta_cognitive']
      });

      return {
        success: true,
        message: `Generated ${analysis.suggestions.length} refactoring suggestions for ${path}`,
        suggestions: analysis.suggestions
      };
    };

    /**
     * Handle manual improvement request
     */
    const handleManualImprovement = async (event) => {
      logger.info('[MetaCognitive] Manual improvement requested:', event);

      // Trigger immediate efficiency check
      await performEfficiencyCheck();
    };

    /**
     * Handle déjà vu event
     */
    const handleDejaVuEvent = async (event) => {
      const { pattern, severity, actionable } = event;

      if (severity === 'high' && actionable) {
        logger.warn(`[MetaCognitive] High-severity déjà vu detected: ${pattern.type}`);

        // Trigger immediate improvement planning
        const suggestions = await DejaVuDetector.suggestImprovements();
        const relevant = suggestions.filter(s => s.pattern.type === pattern.type);

        if (relevant.length > 0 && !CONFIG.requireApproval) {
          logger.info('[MetaCognitive] Auto-triggering improvement for high-severity pattern');
          await planAndExecuteImprovements(relevant, { score: 0.8 });
        }
      }
    };

    /**
     * Handle improvement opportunity from ReflectionAnalyzer
     */
    const handleImprovementOpportunity = async (event) => {
      const { opportunity, source } = event;

      logger.info(`[MetaCognitive] Improvement opportunity from ${source}: ${opportunity.suggestion}`);

      // Convert opportunity to suggestion format
      const suggestion = {
        priority: opportunity.priority,
        action: opportunity.action,
        params: opportunity.params,
        rationale: opportunity.suggestion,
        pattern: {
          type: opportunity.type,
          confidence: opportunity.confidence
        }
      };

      // Decide if we should apply this improvement
      const decision = await decideImprovement(suggestion);

      if (decision.approved && !CONFIG.requireApproval) {
        logger.info('[MetaCognitive] Auto-applying improvement from reflection history');
        await planAndExecuteImprovements([suggestion], { score: opportunity.confidence });
      } else {
        logger.info(`[MetaCognitive] Improvement deferred: ${decision.reason}`);
      }
    };

    /**
     * Handle inefficiency detection from ReflectionAnalyzer
     */
    const handleInefficiencyDetected = async (event) => {
      const { score, opportunities, source } = event;

      logger.warn(`[MetaCognitive] Inefficiency detected by ${source}: score=${score}`);

      // If we have high-confidence opportunities, process them
      if (opportunities.length > 0 && !CONFIG.requireApproval) {
        logger.info(`[MetaCognitive] Processing ${opportunities.length} high-confidence opportunities`);

        // Convert opportunities to suggestions
        const suggestions = opportunities.map(opp => ({
          priority: opp.priority,
          action: opp.action,
          params: opp.params,
          rationale: opp.suggestion,
          pattern: {
            type: opp.type,
            confidence: opp.confidence
          }
        }));

        await planAndExecuteImprovements(suggestions, { score });
      }
    };

    /**
     * Get meta-cognitive status
     */
    const getStatus = () => {
      return {
        enabled: CONFIG.enabled,
        monitoring: checkTimer !== null,
        sessionStats: {
          uptime: Date.now() - currentSession.startTime,
          improvementsProposed: currentSession.improvementsProposed,
          improvementsApplied: currentSession.improvementsApplied
        },
        historySize: improvementHistory.length,
        config: CONFIG
      };
    };

    /**
     * Get improvement history
     */
    const getHistory = (limit = 10) => {
      return improvementHistory
        .slice(-limit)
        .reverse();
    };

    /**
     * Get efficiency trends over time
     */
    const getEfficiencyTrends = async () => {
      const checks = await ReflectionStore.query({
        type: 'meta_cognitive_check',
        limit: 20
      });

      return checks.map(check => ({
        timestamp: check.timestamp,
        score: check.data.inefficiencyScore,
        level: check.data.level,
        outcome: check.outcome
      }));
    };

    // Web Component Widget
    const widget = (() => {
      class MetaCognitiveLayerWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          this._interval = setInterval(() => this.render(), 5000);
        }

        disconnectedCallback() {
          if (this._interval) clearInterval(this._interval);
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        getStatus() {
          const status = getStatus();
          const history = getHistory();

          return {
            state: status.enabled ? (status.improvementsApplied > 0 ? 'active' : 'idle') : 'disabled',
            primaryMetric: `${status.improvementsApplied} improvements`,
            secondaryMetric: `${status.improvementsProposed} proposed`,
            lastActivity: history.length > 0 ? history[history.length - 1].timestamp : null,
            message: status.enabled ? null : 'Monitoring disabled'
          };
        }

        render() {
          const status = getStatus();
          const history = getHistory();
          const recentChecks = history.slice(-10).reverse();

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
              }
              h3 {
                margin: 0 0 16px 0;
                font-size: 1.4em;
                color: #fff;
              }
              h4 {
                margin: 16px 0 8px 0;
                font-size: 1.1em;
                color: #0ff;
              }
              .controls {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
              }
              button {
                padding: 6px 12px;
                background: rgba(100,150,255,0.2);
                border: 1px solid rgba(100,150,255,0.4);
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 0.9em;
              }
              button:hover {
                background: rgba(100,150,255,0.3);
              }
              .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card.applied { background: rgba(0,255,255,0.1); }
              .stat-card.proposed { background: rgba(255,193,7,0.1); }
              .stat-card.checks { background: rgba(156,39,176,0.1); }
              .stat-label {
                color: #888;
                font-size: 12px;
              }
              .stat-value {
                font-size: 24px;
                font-weight: bold;
              }
              .stat-value.applied-val { color: #0ff; }
              .stat-value.proposed-val { color: #ffc107; }
              .stat-value.checks-val { color: #9c27b0; }
              .config-info {
                background: rgba(255,255,255,0.05);
                padding: 12px;
                border-radius: 5px;
                margin-bottom: 20px;
              }
              .config-line {
                font-size: 13px;
                line-height: 1.8;
                color: #ccc;
              }
              .recent-checks {
                max-height: 250px;
                overflow-y: auto;
              }
              .check-item {
                padding: 10px;
                background: rgba(255,255,255,0.03);
                margin-bottom: 8px;
                border-radius: 3px;
              }
              .check-item.high-score {
                border-left: 3px solid #f44336;
              }
              .check-item.low-score {
                border-left: 3px solid #4caf50;
              }
              .check-header {
                display: flex;
                justify-content: space-between;
                margin-bottom: 4px;
              }
              .check-level {
                font-weight: bold;
                color: #ccc;
              }
              .check-time {
                font-size: 12px;
                color: #888;
              }
              .check-score {
                font-size: 12px;
              }
              .check-score.high { color: #f44336; }
              .check-score.low { color: #4caf50; }
              .check-outcome {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
              }
              .empty-state {
                color: #888;
                padding: 20px;
                text-align: center;
              }
            </style>

            <div class="meta-cognitive-panel">
              <h3>⚛ Meta-Cognitive Layer</h3>

              <div class="controls">
                <button class="toggle-monitoring">${status.enabled ? '⏸ Stop' : '▶ Start'}</button>
                <button class="check-now">⌕ Check Now</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card applied">
                  <div class="stat-label">Applied</div>
                  <div class="stat-value applied-val">${status.improvementsApplied}</div>
                </div>
                <div class="stat-card proposed">
                  <div class="stat-label">Proposed</div>
                  <div class="stat-value proposed-val">${status.improvementsProposed}</div>
                </div>
                <div class="stat-card checks">
                  <div class="stat-label">Total Checks</div>
                  <div class="stat-value checks-val">${history.length}</div>
                </div>
              </div>

              <div class="config-info">
                <h4>Configuration</h4>
                <div class="config-line">Monitoring: ${CONFIG.enabled ? '✓ Enabled' : '○ Disabled'}</div>
                <div class="config-line">Check Interval: ${CONFIG.checkIntervalMs / 60000}min</div>
                <div class="config-line">Inefficiency Threshold: ${(CONFIG.minInefficiencyThreshold * 100).toFixed(0)}%</div>
                <div class="config-line">Auto-apply: ${CONFIG.requireApproval ? '○ No' : '✓ Yes'}</div>
              </div>

              <h4>Recent Efficiency Checks (${recentChecks.length})</h4>
              <div class="recent-checks">
                ${recentChecks.length > 0 ? recentChecks.map(check => {
                  const time = new Date(check.timestamp).toLocaleTimeString();
                  const isHigh = check.data.inefficiencyScore >= 0.4;

                  return `
                    <div class="check-item ${isHigh ? 'high-score' : 'low-score'}">
                      <div class="check-header">
                        <span class="check-level">${check.data.level}</span>
                        <span class="check-time">${time}</span>
                      </div>
                      <div class="check-score ${isHigh ? 'high' : 'low'}">
                        Inefficiency: ${(check.data.inefficiencyScore * 100).toFixed(0)}%
                      </div>
                      <div class="check-outcome">
                        Outcome: ${check.outcome}
                      </div>
                    </div>
                  `;
                }).join('') : '<div class="empty-state">No checks performed yet</div>'}
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.toggle-monitoring')?.addEventListener('click', () => {
            if (status.enabled) {
              stopMonitoring();
              EventBus.emit('toast:info', { message: 'Monitoring stopped' });
            } else {
              startMonitoring();
              EventBus.emit('toast:success', { message: 'Monitoring started' });
            }
            this.render();
          });

          this.shadowRoot.querySelector('.check-now')?.addEventListener('click', async () => {
            await performEfficiencyCheck();
            EventBus.emit('toast:info', { message: 'Efficiency check complete' });
            this.render();
          });
        }
      }

      if (!customElements.get('meta-cognitive-layer-widget')) {
        customElements.define('meta-cognitive-layer-widget', MetaCognitiveLayerWidget);
      }

      return {
        element: 'meta-cognitive-layer-widget',
        displayName: 'Meta-Cognitive Layer',
        icon: '⚛',
        category: 'meta-cognitive',
        updateInterval: 5000
      };
    })();

    return {
      init,
      startMonitoring,
      stopMonitoring,
      performEfficiencyCheck,
      getStatus,
      getHistory,
      getEfficiencyTrends,
      CONFIG,  // Expose for runtime configuration
      widget
    };
  }
};

// Export for both REPLOID (global) and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MetaCognitiveLayer };
}

export default MetaCognitiveLayer;
