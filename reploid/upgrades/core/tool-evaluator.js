/**
 * @fileoverview Self-Evaluation Tool Module for REPLOID
 * Implements Project Phoenix Feature 1.1: Standardized Module System
 *
 * This module provides a structured, LLM-driven self-evaluation framework
 * that allows the agent to objectively assess its own work against criteria.
 *
 * @module ToolEvaluator
 * @version 1.0.0
 * @category core
 * @blueprint 0x000012 (Self-Evaluation Framework)
 */

const ToolEvaluator = {
  metadata: {
    id: 'ToolEvaluator',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    // State tracking
    let _evaluationCount = 0;
    let _evaluationHistory = [];
    let _averageScore = 0;
    let _lastEvaluation = null;

    /**
     * Tool declaration for run_self_evaluation
     * Follows blueprint 0x000012 specification
     */
    const toolDeclaration = {
      declaration: {
        name: 'run_self_evaluation',
        description: 'Executes a self-evaluation task using an LLM based on defined criteria and a target artifact or text.',
        inputSchema: {
          type: 'object',
          properties: {
            contentToEvaluate: {
              type: 'string',
              description: 'The explicit content (e.g., a proposed change description) to be evaluated.'
            },
            criteria: {
              type: 'string',
              description: 'The evaluation criteria, as a string. E.g., \'Does this proposal align with the primary goal? Is it specific and actionable?\''
            },
            goalContext: {
              type: 'string',
              description: 'The relevant goal context against which the content should be evaluated.'
            }
          },
          required: ['contentToEvaluate', 'criteria', 'goalContext']
        }
      },
      prompt: `You are Evaluator-X0. Your sole task is to objectively evaluate the provided 'Target Content' against the 'Evaluation Criteria' within the 'Original Goal Context'. Provide a numerical score from 0.0 (total failure) to 1.0 (perfect alignment) and a concise, factual report explaining your reasoning. Focus only on the provided information.

**Original Goal Context:**
[[GOAL_CONTEXT]]

**Evaluation Criteria:**
[[EVALUATION_CRITERIA]]

**Target Content to Evaluate:**
[[TARGET_CONTENT]]

**Your Response (JSON ONLY):**
\`\`\`json
{
  "evaluation_score": float,
  "evaluation_report": "string"
}
\`\`\``
    };

    /**
     * Execute a self-evaluation
     * @param {Object} params - Evaluation parameters
     * @param {string} params.contentToEvaluate - Content to evaluate
     * @param {string} params.criteria - Evaluation criteria
     * @param {string} params.goalContext - Goal context
     * @returns {Promise<Object>} Evaluation result with score and report
     */
    const evaluate = async ({ contentToEvaluate, criteria, goalContext }) => {
      try {
        logger.info('[ToolEvaluator] Starting evaluation...', {
          criteriaLength: criteria.length,
          contentLength: contentToEvaluate.length
        });

        // Build prompt from template
        const prompt = toolDeclaration.prompt
          .replace('[[GOAL_CONTEXT]]', goalContext)
          .replace('[[EVALUATION_CRITERIA]]', criteria)
          .replace('[[TARGET_CONTENT]]', contentToEvaluate);

        // This would be called by the tool system with actual LLM invocation
        // For now, we define the interface and track calls
        const result = {
          contentToEvaluate,
          criteria,
          goalContext,
          prompt,
          timestamp: Date.now()
        };

        // Track evaluation
        _evaluationCount++;
        _lastEvaluation = result;
        _evaluationHistory.push(result);

        // Keep history limited to last 50 evaluations
        if (_evaluationHistory.length > 50) {
          _evaluationHistory.shift();
        }

        EventBus.emit('tool-evaluator:evaluation-executed', {
          count: _evaluationCount,
          timestamp: result.timestamp
        });

        logger.info('[ToolEvaluator] Evaluation executed', {
          count: _evaluationCount
        });

        return result;
      } catch (error) {
        logger.error('[ToolEvaluator] Evaluation failed:', error);
        throw error;
      }
    };

    /**
     * Record an evaluation result (called when LLM response received)
     * @param {Object} result - Evaluation result
     * @param {number} result.evaluation_score - Score from 0.0 to 1.0
     * @param {string} result.evaluation_report - Evaluation report
     */
    const recordResult = (result) => {
      if (_lastEvaluation) {
        _lastEvaluation.score = result.evaluation_score;
        _lastEvaluation.report = result.evaluation_report;

        // Update average score
        const scoredEvaluations = _evaluationHistory.filter(e => e.score !== undefined);
        if (scoredEvaluations.length > 0) {
          _averageScore = scoredEvaluations.reduce((sum, e) => sum + e.score, 0) / scoredEvaluations.length;
        }

        EventBus.emit('tool-evaluator:result-recorded', {
          score: result.evaluation_score,
          averageScore: _averageScore
        });
      }
    };

    /**
     * Get evaluation statistics
     * @returns {Object} Statistics about evaluations
     */
    const getStats = () => {
      return {
        totalEvaluations: _evaluationCount,
        averageScore: _averageScore,
        historyLength: _evaluationHistory.length,
        lastEvaluation: _lastEvaluation
      };
    };

    /**
     * Get evaluation history
     * @param {number} limit - Maximum number of entries to return
     * @returns {Array} Recent evaluations
     */
    const getHistory = (limit = 10) => {
      return _evaluationHistory.slice(-limit).reverse();
    };

    /**
     * Get the tool declaration for registration with tool system
     * @returns {Object} Tool declaration object
     */
    const getToolDeclaration = () => {
      return toolDeclaration;
    };

    // Expose clear method for widget
    const clearHistory = () => {
      _evaluationHistory = [];
      _evaluationCount = 0;
      _averageScore = 0;
      _lastEvaluation = null;
    };

    return {
      init: async () => {
        logger.info('[ToolEvaluator] Initialized');
        EventBus.emit('tool-evaluator:initialized');
      },

      api: {
        evaluate,
        recordResult,
        getStats,
        getHistory,
        getToolDeclaration,
        clearHistory
      },

      widget: {
        element: 'tool-evaluator-widget',
        displayName: 'Self-Evaluation Tool',
        icon: '⚖',
        category: 'tools',
        updateInterval: 3000
      }
    };
  }
};

// Web Component for Tool Evaluator Widget
class ToolEvaluatorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventBus = null;
  }

  connectedCallback() {
    // Get EventBus reference
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._eventBus = window.DIContainer.resolve('EventBus');
    }

    this.render();

    // Set up EventBus listeners
    if (this._eventBus) {
      this._updateHandler = () => this.render();
      this._eventBus.on('tool-evaluator:evaluation-executed', this._updateHandler, 'ToolEvaluatorWidget');
      this._eventBus.on('tool-evaluator:result-recorded', this._updateHandler, 'ToolEvaluatorWidget');
    }

    // Auto-refresh
    if (this.updateInterval) {
      this._interval = setInterval(() => this.render(), this.updateInterval);
    }
  }

  disconnectedCallback() {
    // Clean up EventBus listeners
    if (this._eventBus && this._updateHandler) {
      this._eventBus.off('tool-evaluator:evaluation-executed', this._updateHandler);
      this._eventBus.off('tool-evaluator:result-recorded', this._updateHandler);
    }

    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  set updateInterval(interval) {
    this._updateInterval = interval;
  }

  get updateInterval() {
    return this._updateInterval || 3000;
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const stats = this._api.getStats();
    return {
      state: stats.totalEvaluations > 0 ? 'active' : 'idle',
      primaryMetric: `${stats.totalEvaluations} evaluations`,
      secondaryMetric: stats.averageScore > 0 ? `Avg: ${stats.averageScore.toFixed(2)}` : 'No scores yet',
      lastActivity: stats.lastEvaluation?.timestamp
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const stats = this._api.getStats();
    const recentHistory = this._api.getHistory(5);

    const formatTime = (timestamp) => {
      if (!timestamp) return 'Never';
      return new Date(timestamp).toLocaleString();
    };

    const scoreColor = (score) => {
      if (score === undefined) return '#888';
      if (score >= 0.8) return '#0c0';
      if (score >= 0.6) return '#fc0';
      return '#f66';
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #4fc3f7;
        }

        .latest-eval {
          margin-bottom: 16px;
        }

        .eval-history {
          max-height: 300px;
          overflow-y: auto;
          margin-bottom: 16px;
        }

        .eval-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
        }

        .tool-declaration {
          margin-bottom: 16px;
        }

        .tool-info {
          margin-bottom: 8px;
        }

        code {
          color: #4fc3f7;
          background: rgba(255,255,255,0.05);
          padding: 2px 6px;
          border-radius: 3px;
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        button {
          background: rgba(100,150,255,0.3);
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 6px 12px;
          font-size: 0.9em;
          margin-top: 12px;
        }

        button:hover {
          background: rgba(100,150,255,0.5);
        }
      </style>

      <div class="tool-evaluator-panel">
        <h4>⚖ Self-Evaluation Tool</h4>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Evaluations</div>
            <div class="stat-value">${stats.totalEvaluations}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Average Score</div>
            <div class="stat-value" style="color: ${scoreColor(stats.averageScore)};">
              ${stats.averageScore > 0 ? stats.averageScore.toFixed(3) : 'N/A'}
            </div>
          </div>
          <div class="stat-card">
            <div class="stat-label">History Size</div>
            <div class="stat-value">${stats.historyLength}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Last Evaluation</div>
            <div class="stat-value" style="font-size: 0.85em;">
              ${formatTime(stats.lastEvaluation?.timestamp)}
            </div>
          </div>
        </div>

        ${stats.lastEvaluation ? `
          <h5>Latest Evaluation</h5>
          <div class="latest-eval">
            <div style="margin-bottom: 8px;">
              <strong>Score:</strong>
              <span style="color: ${scoreColor(stats.lastEvaluation.score)}; font-size: 1.2em; font-weight: bold;">
                ${stats.lastEvaluation.score !== undefined ? stats.lastEvaluation.score.toFixed(3) : 'Pending'}
              </span>
            </div>
            ${stats.lastEvaluation.report ? `
              <div style="margin-bottom: 8px;">
                <strong>Report:</strong>
                <div style="margin-top: 4px; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.9em; color: #aaa; max-height: 80px; overflow-y: auto;">
                  ${stats.lastEvaluation.report}
                </div>
              </div>
            ` : ''}
            <div style="margin-bottom: 8px;">
              <strong>Criteria:</strong>
              <div style="margin-top: 4px; padding: 6px; background: rgba(255,255,255,0.03); border-radius: 3px; font-size: 0.85em; color: #999; max-height: 60px; overflow-y: auto;">
                ${stats.lastEvaluation.criteria}
              </div>
            </div>
          </div>
        ` : '<p style="color: #888; font-style: italic;">No evaluations yet</p>'}

        <h5>Recent Evaluations (${recentHistory.length})</h5>
        <div class="eval-history">
          ${recentHistory.length > 0 ? recentHistory.map(eval => `
            <div class="eval-item" style="border-left: 3px solid ${scoreColor(eval.score)};">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                <span style="font-size: 0.85em; color: #888;">${formatTime(eval.timestamp)}</span>
                <span style="font-weight: bold; color: ${scoreColor(eval.score)};">
                  ${eval.score !== undefined ? eval.score.toFixed(3) : 'Pending'}
                </span>
              </div>
              <div style="font-size: 0.8em; color: #999; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${eval.criteria.substring(0, 80)}${eval.criteria.length > 80 ? '...' : ''}
              </div>
            </div>
          `).join('') : '<p style="color: #888; font-style: italic;">No history available</p>'}
        </div>

        <h5>Tool Declaration</h5>
        <div class="tool-declaration">
          <div class="tool-info">
            <strong>Name:</strong> <code>run_self_evaluation</code>
          </div>
          <div class="tool-info">
            <strong>Blueprint:</strong> 0x000012
          </div>
          <div class="tool-info">
            <strong>Required Inputs:</strong>
            <div style="margin-top: 4px; margin-left: 12px; font-size: 0.9em;">
              • contentToEvaluate<br>
              • criteria<br>
              • goalContext
            </div>
          </div>
        </div>

        <div class="info-panel">
          <strong>ⓘ Self-Evaluation Framework</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            This module provides structured LLM-driven self-evaluation,
            allowing the agent to objectively assess its work against defined criteria.
            Evaluator-X0 focuses purely on provided information for unbiased assessment.
          </div>
        </div>

        <button id="clear-history">⌦ Clear History</button>
      </div>
    `;

    // Attach event listeners
    const clearBtn = this.shadowRoot.getElementById('clear-history');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._api.clearHistory();
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        ToastNotifications?.show?.('Evaluation history cleared', 'success');
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('tool-evaluator-widget')) {
  customElements.define('tool-evaluator-widget', ToolEvaluatorWidget);
}

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ToolEvaluator);
}

export default ToolEvaluator;
