/**
 * @fileoverview Browser-Native Multi-Model Paxos for REPLOID
 *
 * Enables 100% browser-native multi-model competitive testing without requiring
 * Node.js proxy or Python CLI. Uses VFS snapshots, Web Workers, and HybridLLMProvider
 * to run competitive evaluations entirely in the browser.
 *
 * @module MultiModelPaxos
 * @version 1.0.0
 * @category rsi
 * @blueprint 0x000064
 */

const MultiModelPaxos = {
  metadata: {
    id: 'MultiModelPaxos',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager', 'HybridLLMProvider', 'VerificationManager', 'DIContainer', 'Config'],
    async: true,
    type: 'rsi'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager, HybridLLMProvider, VerificationManager, DIContainer, Config } = deps;
    const { logger } = Utils;

    // Get all 6 verified cloud models from config (2 per provider)
    const CLOUD_MODELS = [
      Config.api.get('api.geminiModelFast') || 'gemini-2.5-flash-lite',
      Config.api.get('api.geminiModelBalanced') || 'gemini-2.5-flash',
      Config.api.get('api.openaiModelFast') || 'gpt-5-2025-08-07-mini',
      Config.api.get('api.openaiModelAdvanced') || 'gpt-5-2025-08-07',
      Config.api.get('api.anthropicModelFast') || 'claude-4-5-haiku',
      Config.api.get('api.anthropicModelBalanced') || 'claude-4-5-sonnet'
    ];

    // Competition state
    let _activeCompetition = null;
    let _competitionHistory = [];
    let _stats = {
      totalCompetitions: 0,
      totalSolutions: 0,
      totalSuccessful: 0,
      totalFailed: 0,
      averageDuration: 0,
      winnersByModel: {}
    };

    /**
     * Build prompt for solution generation
     * @param {string} objective - Competition objective
     * @param {Object} workspace - VFS snapshot workspace
     * @returns {string} Formatted prompt
     */
    const buildPrompt = (objective, workspace) => {
      return `You are participating in a multi-model competitive coding challenge.

Objective: ${objective}

Requirements:
1. Provide a complete, working implementation
2. Include comprehensive tests
3. Follow best practices and coding standards
4. Optimize for both correctness and performance

Format your response as:
## Implementation
\`\`\`javascript
// Your code here
\`\`\`

## Tests
\`\`\`javascript
// Your test code here
\`\`\`

Provide a production-ready solution that will pass all tests.`;
    };

    /**
     * Extract code from LLM response
     * @param {string} content - LLM response content
     * @returns {string} Extracted code
     */
    const extractCode = (content) => {
      if (!content) return '';

      // Try to extract from ## Implementation section
      const implMatch = content.match(/##\s*Implementation\s*```(?:javascript|js)?\s*([\s\S]*?)```/i);
      if (implMatch) return implMatch[1].trim();

      // Fallback: extract first code block
      const codeMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
      if (codeMatch) return codeMatch[1].trim();

      return content;
    };

    /**
     * Extract tests from LLM response
     * @param {string} content - LLM response content
     * @returns {string} Extracted tests
     */
    const extractTests = (content) => {
      if (!content) return '';

      // Try to extract from ## Tests section
      const testMatch = content.match(/##\s*Tests?\s*```(?:javascript|js)?\s*([\s\S]*?)```/i);
      if (testMatch) return testMatch[1].trim();

      // No explicit test section found
      return '';
    };

    /**
     * Assess code quality heuristics
     * @param {string} code - Code to assess
     * @returns {number} Quality score 0-1
     */
    const assessCodeQuality = (code) => {
      if (!code) return 0;

      let score = 0.5; // Base score

      // Positive indicators
      if (code.includes('/**')) score += 0.1; // JSDoc comments
      if (code.includes('try') && code.includes('catch')) score += 0.1; // Error handling
      if (code.match(/const |let /g)?.length > 0) score += 0.1; // Modern JS
      if (code.includes('async') || code.includes('await')) score += 0.05; // Async handling
      if (code.match(/\n/g)?.length > 20) score += 0.05; // Substantial implementation

      // Negative indicators
      if (code.includes('eval(')) score -= 0.2; // Dangerous patterns
      if (code.includes('TODO') || code.includes('FIXME')) score -= 0.1; // Incomplete
      if (code.length < 100) score -= 0.2; // Too short

      return Math.max(0, Math.min(1, score));
    };

    /**
     * Generate solution using specific model
     * @param {string} objective - Competition objective
     * @param {string} model - Model identifier
     * @param {Object} workspace - VFS workspace
     * @returns {Promise<Object>} Generated solution
     */
    const generateSolution = async (objective, model, workspace) => {
      const startTime = Date.now();

      try {
        logger.info(`[Paxos] Generating solution with ${model}`);

        const prompt = buildPrompt(objective, workspace);

        const response = await HybridLLMProvider.api.generateWithModel(prompt, {
          model,
          temperature: 0.7,
          maxTokens: 4000
        });

        const code = extractCode(response.content);
        const tests = extractTests(response.content);

        return {
          model,
          code,
          tests,
          raw: response.content,
          metadata: {
            duration: Date.now() - startTime,
            tokens: response.usage,
            timestamp: Date.now()
          },
          failed: false
        };
      } catch (error) {
        logger.error(`[Paxos] Generation failed for ${model}:`, error);

        return {
          model,
          error: error.message,
          failed: true,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }
    };

    /**
     * Verify solution using Web Worker
     * @param {Object} solution - Solution to verify
     * @param {Function|string} verifyFn - Verification function or test code
     * @param {Object} workspace - VFS workspace
     * @returns {Promise<Object>} Verification result
     */
    const verifySolution = async (solution, verifyFn, workspace) => {
      try {
        logger.info(`[Paxos] Verifying solution from ${solution.model}`);

        // Create isolated test workspace
        const testWorkspace = workspace.clone ? workspace.clone() : workspace;

        // Apply solution code to workspace if provided
        if (solution.code) {
          // Store solution for testing
          testWorkspace.solutionCode = solution.code;
        }

        // Use VerificationManager to run tests in Web Worker
        const testCode = solution.tests || (typeof verifyFn === 'function' ? verifyFn.toString() : verifyFn);

        const result = await VerificationManager.api.verify({
          code: solution.code,
          tests: testCode,
          timeout: 30000,
          context: {
            workspace: testWorkspace
          }
        });

        return {
          passed: result.success,
          testResults: result.results || [],
          errors: result.errors || [],
          duration: result.duration || 0,
          stdout: result.stdout || '',
          stderr: result.stderr || ''
        };
      } catch (error) {
        logger.error(`[Paxos] Verification failed for ${solution.model}:`, error);

        return {
          passed: false,
          errors: [error.message],
          testResults: [],
          duration: 0,
          stdout: '',
          stderr: error.message
        };
      }
    };

    /**
     * Score a solution based on multiple criteria
     * @param {Object} solution - Solution with verification results
     * @returns {number} Score 0-1
     */
    const scoreSolution = (solution) => {
      if (solution.failed) return 0;

      let score = 0;

      // Test passing (60% weight)
      if (solution.verification?.passed) {
        score += 0.6;
      }

      // Performance (20% weight)
      // Compare to average duration
      const avgDuration = _stats.averageDuration || 5000;
      if (solution.metadata?.duration) {
        const durationScore = Math.max(0, 1 - (solution.metadata.duration / (avgDuration * 2)));
        score += durationScore * 0.2;
      }

      // Code quality (20% weight)
      if (solution.code) {
        const qualityScore = assessCodeQuality(solution.code);
        score += qualityScore * 0.2;
      }

      return Math.min(1, Math.max(0, score));
    };

    /**
     * Select winner from solutions
     * @param {Array<Object>} solutions - Scored solutions
     * @returns {Object|null} Winning solution
     */
    const selectWinner = (solutions) => {
      const validSolutions = solutions.filter(sol => !sol.failed && sol.score > 0);

      if (validSolutions.length === 0) {
        logger.warn('[Paxos] No valid solutions found');
        return null;
      }

      // Sort by score descending
      const sorted = validSolutions.sort((a, b) => b.score - a.score);

      return sorted[0];
    };

    /**
     * Update statistics after competition
     * @param {Object} telemetry - Competition telemetry
     */
    const updateStats = (telemetry) => {
      _stats.totalCompetitions++;
      _stats.totalSolutions += telemetry.solutions.length;
      _stats.totalSuccessful += telemetry.solutions.filter(s => !s.failed && s.verification?.passed).length;
      _stats.totalFailed += telemetry.solutions.filter(s => s.failed || !s.verification?.passed).length;

      // Update average duration
      const totalDuration = telemetry.solutions.reduce((sum, sol) => {
        return sum + (sol.metadata?.duration || 0);
      }, 0);
      const newAvgDuration = totalDuration / telemetry.solutions.length;

      _stats.averageDuration = (
        (_stats.averageDuration * (_stats.totalCompetitions - 1) + newAvgDuration) /
        _stats.totalCompetitions
      );

      // Update winner counts
      if (telemetry.winner) {
        const winnerModel = telemetry.winner;
        _stats.winnersByModel[winnerModel] = (_stats.winnersByModel[winnerModel] || 0) + 1;
      }
    };

    /**
     * Emit telemetry event
     * @param {string} event - Event name
     * @param {Object} data - Event data
     */
    const emitTelemetry = (event, data) => {
      // Emit to EventBus
      EventBus.emit(`paxos:${event}`, data);

      // Emit to PAXA if available
      try {
        const PAXA = DIContainer.resolve('PenteractAnalytics');
        if (PAXA && PAXA.api && PAXA.api.trackEvent) {
          PAXA.api.trackEvent({
            category: 'paxos',
            action: event,
            ...data,
            timestamp: Date.now()
          });
        }
      } catch (error) {
        // PAXA not available, skip
      }
    };

    /**
     * Run multi-model competition
     * @param {string} objective - Competition objective
     * @param {Object} config - Competition configuration
     * @returns {Promise<Object>} Competition results
     */
    const runCompetition = async (objective, config = {}) => {
      const startTime = Date.now();

      try {
        logger.info('[Paxos] Starting competition:', objective);

        // Validate configuration
        const models = config.models || CLOUD_MODELS;
        const verifyFn = config.verificationFn || config.verifyFn || ((solution) => {
          // Default verification: check if code exists and has no syntax errors
          try {
            new Function(solution.code);
            return { success: true };
          } catch (error) {
            return { success: false, error: error.message };
          }
        });
        const timeout = config.timeout || 60000;

        // Create competition instance
        const competitionId = `paxos-${Date.now()}`;
        _activeCompetition = {
          id: competitionId,
          objective,
          models,
          modelsCount: models.length,
          progress: 0,
          startTime,
          phase: 'initializing'
        };

        emitTelemetry('competition_start', {
          competitionId,
          objective,
          models,
          config
        });

        // Create VFS workspace snapshot
        logger.info('[Paxos] Creating VFS workspace snapshot');
        _activeCompetition.phase = 'workspace_creation';
        const workspace = await StateManager.api.createSnapshot?.() || {};

        // Phase 1: Generate solutions in parallel
        logger.info('[Paxos] Generating solutions from', models.length, 'models');
        _activeCompetition.phase = 'generation';
        EventBus.emit('paxos:phase', { phase: 'generation', progress: 0 });

        const solutions = await Promise.all(
          models.map(async (model, idx) => {
            const solution = await generateSolution(objective, model, workspace);

            _activeCompetition.progress = Math.floor(((idx + 1) / models.length) * 40);
            EventBus.emit('paxos:progress', {
              competitionId,
              progress: _activeCompetition.progress,
              phase: 'generation',
              completedModels: idx + 1,
              totalModels: models.length
            });

            return solution;
          })
        );

        // Phase 2: Verify solutions in parallel
        logger.info('[Paxos] Verifying', solutions.length, 'solutions');
        _activeCompetition.phase = 'verification';
        EventBus.emit('paxos:phase', { phase: 'verification', progress: 40 });

        const verifiedSolutions = await Promise.all(
          solutions.map(async (solution, idx) => {
            if (solution.failed) return solution;

            const result = await verifySolution(solution, verifyFn, workspace);

            _activeCompetition.progress = 40 + Math.floor(((idx + 1) / solutions.length) * 40);
            EventBus.emit('paxos:progress', {
              competitionId,
              progress: _activeCompetition.progress,
              phase: 'verification',
              completedVerifications: idx + 1,
              totalVerifications: solutions.length
            });

            return { ...solution, verification: result };
          })
        );

        // Phase 3: Score and select winner
        logger.info('[Paxos] Scoring solutions and selecting winner');
        _activeCompetition.phase = 'scoring';
        EventBus.emit('paxos:phase', { phase: 'scoring', progress: 80 });

        const scoredSolutions = verifiedSolutions.map(sol => ({
          ...sol,
          score: scoreSolution(sol)
        }));

        const winner = selectWinner(scoredSolutions);

        _activeCompetition.progress = 100;

        // Compile telemetry
        const duration = Date.now() - startTime;
        const telemetry = {
          competitionId,
          objective,
          models,
          solutions: scoredSolutions,
          winner: winner?.model || null,
          winnerScore: winner?.score || 0,
          duration,
          successfulSolutions: scoredSolutions.filter(s => !s.failed && s.verification?.passed).length,
          failedSolutions: scoredSolutions.filter(s => s.failed || !s.verification?.passed).length,
          timestamp: Date.now()
        };

        // Update history
        _competitionHistory.unshift(telemetry);
        if (_competitionHistory.length > 50) {
          _competitionHistory = _competitionHistory.slice(0, 50);
        }

        // Update stats
        updateStats(telemetry);

        // Emit completion
        emitTelemetry('competition_complete', telemetry);
        _activeCompetition = null;

        logger.info('[Paxos] Competition complete. Winner:', winner?.model || 'none');

        return {
          solutions: scoredSolutions,
          winner,
          telemetry
        };

      } catch (error) {
        logger.error('[Paxos] Competition failed:', error);

        _activeCompetition = null;

        emitTelemetry('competition_error', {
          error: error.message,
          objective,
          stack: error.stack
        });

        throw Utils.createError('PaxosCompetitionError', error.message);
      }
    };

    /**
     * Get active competition status
     * @returns {Object|null} Active competition or null
     */
    const getActiveCompetition = () => {
      return _activeCompetition ? { ..._activeCompetition } : null;
    };

    /**
     * Get competition history
     * @returns {Array<Object>} Competition history
     */
    const getCompetitionHistory = () => {
      return [..._competitionHistory];
    };

    /**
     * Get statistics
     * @returns {Object} Statistics
     */
    const getStats = () => {
      return { ..._stats };
    };

    /**
     * Clear competition history
     */
    const clearHistory = () => {
      _competitionHistory = [];
      logger.info('[Paxos] Competition history cleared');
    };

    /**
     * Web Component Widget
     */
    class MultiModelPaxosWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const active = _activeCompetition;
        const history = _competitionHistory;

        return {
          state: active ? 'active' : (history.length > 0 ? 'idle' : 'disabled'),
          primaryMetric: active
            ? `Running: ${active.modelsCount} models`
            : `${_stats.totalCompetitions} competitions`,
          secondaryMetric: active
            ? `${active.progress}% complete`
            : history.length > 0
              ? `Last winner: ${history[0].winner || 'none'}`
              : 'Ready',
          lastActivity: history.length > 0 ? history[0].timestamp : null,
          message: active ? `${active.phase}: ${active.objective.slice(0, 50)}...` : null
        };
      }

      render() {
        const active = _activeCompetition;
        const history = _competitionHistory.slice(0, 5);
        const stats = _stats;

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 12px;
            }
            .paxos-panel {
              background: rgba(0, 0, 0, 0.8);
              padding: 16px;
              border-radius: 4px;
              border: 1px solid rgba(0, 170, 255, 0.3);
            }
            h4 {
              margin: 0 0 12px 0;
              color: #0af;
              font-size: 14px;
            }
            h5 {
              margin: 16px 0 8px 0;
              color: #0af;
              font-size: 12px;
            }
            .active-competition {
              background: rgba(0, 170, 255, 0.1);
              padding: 12px;
              border-radius: 4px;
              margin-bottom: 12px;
              border-left: 3px solid #0af;
            }
            .objective {
              color: #fff;
              margin-bottom: 8px;
              font-weight: bold;
            }
            .phase {
              color: #0af;
              font-size: 11px;
              text-transform: uppercase;
              margin-bottom: 8px;
            }
            .progress-bar {
              width: 100%;
              height: 8px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 4px;
              overflow: hidden;
              margin: 8px 0;
            }
            .progress-fill {
              height: 100%;
              background: linear-gradient(90deg, #0af, #0fa);
              transition: width 0.3s ease;
            }
            .progress-text {
              color: #0af;
              font-size: 10px;
              margin-top: 4px;
            }
            .stat-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin: 12px 0;
            }
            .stat-item {
              padding: 8px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 3px;
            }
            .stat-label {
              color: #888;
              font-size: 10px;
              margin-bottom: 4px;
            }
            .stat-value {
              color: #0af;
              font-size: 16px;
              font-weight: bold;
            }
            .history-item {
              padding: 8px;
              margin: 4px 0;
              background: rgba(0, 170, 255, 0.05);
              border-left: 3px solid #0af;
              font-size: 10px;
            }
            .winner {
              color: #0f0;
              font-weight: bold;
            }
            .failed {
              color: #f66;
            }
            .timestamp {
              color: #888;
              font-size: 9px;
            }
            button {
              padding: 6px 12px;
              margin-top: 12px;
              background: #0af;
              color: #000;
              border: none;
              cursor: pointer;
              font-size: 11px;
              font-family: monospace;
              border-radius: 3px;
              font-weight: bold;
            }
            button:hover {
              background: #0cf;
            }
            button:disabled {
              background: #555;
              cursor: not-allowed;
              color: #888;
            }
            .empty-state {
              color: #666;
              padding: 16px;
              text-align: center;
              font-style: italic;
            }
          </style>

          <div class="paxos-panel">
            <h4>⚔ Multi-Model Paxos</h4>

            ${active ? `
              <div class="active-competition">
                <div class="objective">🎯 ${active.objective.slice(0, 60)}${active.objective.length > 60 ? '...' : ''}</div>
                <div class="phase">Phase: ${active.phase}</div>
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${active.progress}%"></div>
                </div>
                <div class="progress-text">
                  ${active.progress}% complete - Testing ${active.modelsCount} models
                </div>
              </div>
            ` : ''}

            <div class="stat-grid">
              <div class="stat-item">
                <div class="stat-label">Total Competitions</div>
                <div class="stat-value">${stats.totalCompetitions}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Total Solutions</div>
                <div class="stat-value">${stats.totalSolutions}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Successful</div>
                <div class="stat-value" style="color: #0f0;">${stats.totalSuccessful}</div>
              </div>
              <div class="stat-item">
                <div class="stat-label">Failed</div>
                <div class="stat-value" style="color: #f66;">${stats.totalFailed}</div>
              </div>
            </div>

            ${history.length > 0 ? `
              <h5>📜 Recent Competitions</h5>
              ${history.map(comp => `
                <div class="history-item">
                  <div><span class="winner">🏆 ${comp.winner || 'No winner'}</span> (Score: ${(comp.winnerScore * 100).toFixed(1)}%)</div>
                  <div style="color: #ccc; margin-top: 4px;">${comp.objective.slice(0, 60)}${comp.objective.length > 60 ? '...' : ''}</div>
                  <div class="timestamp">${new Date(comp.timestamp).toLocaleString()} · ${comp.solutions.length} models · ${comp.duration}ms</div>
                </div>
              `).join('')}
            ` : !active ? `
              <div class="empty-state">No competitions yet. Click "Run Demo" to start.</div>
            ` : ''}

            <button id="run-demo" ${active ? 'disabled' : ''}>
              🎯 Run Demo Competition
            </button>
            ${history.length > 0 && !active ? `
              <button id="clear-history">🗑️ Clear History</button>
            ` : ''}
          </div>
        `;

        // Wire up buttons
        const demoBtn = this.shadowRoot.getElementById('run-demo');
        if (demoBtn && !active) {
          demoBtn.addEventListener('click', async () => {
            try {
              await runCompetition('Create a function that calculates fibonacci numbers efficiently', {
                models: CLOUD_MODELS.slice(0, 2), // Use first 2 verified models
                timeout: 30000
              });
            } catch (error) {
              logger.error('[Paxos] Demo competition failed:', error);
            }
          });
        }

        const clearBtn = this.shadowRoot.getElementById('clear-history');
        if (clearBtn && !active) {
          clearBtn.addEventListener('click', () => {
            clearHistory();
            this.render();
          });
        }
      }
    }

    // Register custom element
    const elementName = 'multi-model-paxos-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, MultiModelPaxosWidget);
    }

    /**
     * Module initialization
     */
    const init = () => {
      logger.info('[MultiModelPaxos] Initialized successfully');

      EventBus.emit('paxos:ready', {
        timestamp: Date.now()
      });
    };

    /**
     * Module cleanup
     */
    const cleanup = () => {
      if (_activeCompetition) {
        logger.warn('[MultiModelPaxos] Cleaning up with active competition');
        _activeCompetition = null;
      }

      logger.info('[MultiModelPaxos] Cleaned up successfully');
    };

    // Return public API
    return {
      init,
      api: {
        // Core competition
        runCompetition,
        generateSolution,
        verifySolution,
        scoreSolution,
        selectWinner,

        // State access
        getActiveCompetition,
        getCompetitionHistory,
        getStats,
        clearHistory,

        // Telemetry
        emitTelemetry
      },

      widget: {
        element: elementName,
        displayName: 'Multi-Model Paxos',
        icon: '⚔',
        category: 'rsi',
        visible: true,
        priority: 9,
        collapsible: true,
        defaultCollapsed: false,
        updateInterval: 1000
      }
    };
  }
};

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(MultiModelPaxos);
}

export default MultiModelPaxos;
