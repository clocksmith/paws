// @blueprint 0x00001E - Outlines Penteract analytics and visualization pipeline.
// Penteract Analytics Aggregator
// Consolidates Arena telemetry into actionable analytics for visualization

const PenteractAnalytics = {
  metadata: {
    id: 'PenteractAnalytics',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils', 'StateManager'],
    async: true,
    type: 'analytics'
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger } = Utils;

    const HISTORY_PATH = '/analytics/penteract-analytics.json';
    const HISTORY_LIMIT = 20;

    let history = [];
    let latest = null;

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const loadHistory = async () => {
      try {
        const existing = await StateManager.getArtifactContent(HISTORY_PATH);
        if (!existing) return;

        const payload = JSON.parse(existing);
        history = Array.isArray(payload.history) ? payload.history : [];
        latest = payload.latest || null;
        logger.info('[PenteractAnalytics] Loaded analytics history', {
          runs: history.length
        });
      } catch (error) {
        logger.warn('[PenteractAnalytics] Failed to load analytics history:', error);
        history = [];
        latest = null;
      }
    };

    const persistHistory = async () => {
      try {
        const payload = JSON.stringify(
          { history, latest },
          null,
          2
        );
        const exists = !!StateManager.getArtifactMetadata(HISTORY_PATH);
        if (exists) {
          await StateManager.updateArtifact(HISTORY_PATH, payload);
        } else {
          await StateManager.createArtifact(
            HISTORY_PATH,
            'json',
            payload,
            'Penteract analytics history'
          );
        }
      } catch (error) {
        logger.warn('[PenteractAnalytics] Failed to persist analytics history:', error);
      }
    };

    const normaliseAgent = (agent = {}) => {
      const status = String(agent.status || agent.result || 'UNKNOWN').toUpperCase();
      return {
        name: agent.name || agent.id || 'Unknown',
        model: agent.model || agent.model_id || 'Unknown',
        status,
        execution_time: Number(agent.execution_time || agent.duration || 0),
        token_count: Number(agent.token_count || agent.tokens || 0),
        solution_path: agent.solution_path || agent.bundle_path || null,
        error: agent.error || agent.error_message || null
      };
    };

    const analyseAgents = (agents) => {
      const totals = {
        total: agents.length,
        pass: 0,
        fail: 0,
        error: 0
      };

      let totalTokens = 0;
      let totalTime = 0;

      const passes = [];
      const failures = [];
      const errors = [];

      agents.forEach((agent) => {
        totalTokens += agent.token_count || 0;
        totalTime += agent.execution_time || 0;

        switch (agent.status) {
          case 'PASS':
            totals.pass += 1;
            passes.push(agent);
            break;
          case 'FAIL':
            totals.fail += 1;
            failures.push(agent);
            break;
          case 'ERROR':
            totals.error += 1;
            errors.push(agent);
            break;
          default:
            totals.fail += 1;
            failures.push(agent);
        }
      });

      const averageTokens = totals.total ? Math.round(totalTokens / totals.total) : 0;
      const averageTime = totals.total ? Number((totalTime / totals.total).toFixed(3)) : 0;

      const sortedByTime = [...agents].sort(
        (a, b) => (a.execution_time || Infinity) - (b.execution_time || Infinity)
      );
      const fastest = sortedByTime.find((agent) => agent.status === 'PASS') || sortedByTime[0] || null;

      const sortedByTokens = [...agents].sort(
        (a, b) => (b.token_count || 0) - (a.token_count || 0)
      );
      const mostExpensive = sortedByTokens[0] || null;

      return {
        totals,
        averageTokens,
        averageTime,
        fastest,
        mostExpensive,
        passes,
        failures,
        errors
      };
    };

    const buildRecommendations = (summary, consensus) => {
      const recommendations = [];

      if (summary.totals.pass === 0) {
        recommendations.push('Consensus failed — schedule follow-up review or rerun with revised prompts.');
      }

      if (summary.failures.length) {
        recommendations.push(
          `Investigate failing agents: ${summary.failures
            .slice(0, 3)
            .map((agent) => agent.name)
            .join(', ')}`
        );
      }

      if (summary.errors.length) {
        recommendations.push(
          `Errors encountered for: ${summary.errors
            .slice(0, 3)
            .map((agent) => agent.name)
            .join(', ')}`
        );
      }

      if (summary.totals.total > 0 && summary.averageTime > 30) {
        recommendations.push('Average execution time exceeded 30s — consider running agents in parallel or optimising prompts.');
      }

      if (consensus?.status === 'success' && summary.fastest) {
        recommendations.push(`Consider promoting ${summary.fastest.name} (${summary.fastest.model}) as primary implementation candidate.`);
      }

      return recommendations;
    };

    const enrichSnapshot = (snapshot) => {
      const agents = Array.isArray(snapshot.agents)
        ? snapshot.agents.map(normaliseAgent)
        : [];

      const consensus = snapshot.consensus || {};
      const summary = analyseAgents(agents);
      const recommendations = buildRecommendations(summary, consensus);

      return {
        ...snapshot,
        agents,
        consensus: {
          status: (consensus.status || 'unknown').toLowerCase(),
          passing: consensus.passing || [],
          verify: Boolean(snapshot.verify)
        },
        metrics: {
          totals: summary.totals,
          averages: {
            tokens: summary.averageTokens,
            executionTime: summary.averageTime
          },
          fastestAgent: summary.fastest,
          highestTokenAgent: summary.mostExpensive
        },
        recommendations
      };
    };

    const processSnapshot = async (snapshot) => {
      if (!snapshot || typeof snapshot !== 'object') {
        return;
      }

      const processed = enrichSnapshot(snapshot);
      latest = processed;
      history.push(processed);
      history = history.slice(-HISTORY_LIMIT);

      await persistHistory();

      EventBus.emit('arena:analytics:processed', processed);
    };

    const handleSnapshot = (snapshot) => {
      Promise.resolve(processSnapshot(snapshot)).catch((error) => {
        logger.error('[PenteractAnalytics] Failed to process analytics snapshot:', error);
      });
    };

    const init = async () => {
      await loadHistory();
      EventBus.on('arena:analytics', handleSnapshot, 'PenteractAnalytics');

      if (latest) {
        EventBus.emit('arena:analytics:processed', latest);
      }

      logger.info('[PenteractAnalytics] Analytics pipeline initialised');
      return true;
    };

    return {
      init,
      api: {
        getLatest: () => (latest ? clone(latest) : null),
        getHistory: () => history.map(clone),
        getSummary: () => ({
          totalRuns: history.length,
          lastRunAt: latest?.timestamp || null,
          successRate:
            history.length === 0
              ? 0
              : Math.round(
                  (history.filter((entry) => entry.consensus?.status === 'success').length /
                    history.length) *
                    100
                ),
          consensusTrail: history.map((entry) => ({
            timestamp: entry.timestamp,
            status: entry.consensus?.status || 'unknown',
            passing: entry.consensus?.passing || []
          }))
        }),
        ingestSnapshot: (snapshot) => {
          handleSnapshot(snapshot);
        }
      },

      // Widget interface
      widget: (() => {
        class PenteractAnalyticsWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            this._updateListener = () => this.render();
            EventBus.on('arena:analytics:processed', this._updateListener, 'PenteractAnalyticsWidget');
          }

          disconnectedCallback() {
            if (this._updateListener) {
              EventBus.off('arena:analytics:processed', this._updateListener);
            }
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const totalRuns = history.length;
            const successCount = history.filter(entry => entry.consensus?.status === 'success').length;
            const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;

            let state = 'idle';
            if (latest) {
              if (latest.consensus?.status === 'success') state = 'active';
              else if (latest.consensus?.status === 'failed') state = 'error';
              else state = 'warning';
            }

            return {
              state,
              primaryMetric: `${totalRuns} runs`,
              secondaryMetric: `${successRate}% success`,
              lastActivity: latest?.timestamp ? new Date(latest.timestamp).getTime() : null
            };
          }

          render() {
            const totalRuns = history.length;
            const successCount = history.filter(entry => entry.consensus?.status === 'success').length;
            const failCount = history.filter(entry => entry.consensus?.status === 'failed').length;
            const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;

            const formatTime = (timestamp) => {
              if (!timestamp) return 'Never';
              return new Date(timestamp).toLocaleString();
            };

            const recentRuns = history.slice(-10).reverse();

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  font-family: monospace;
                  color: #e0e0e0;
                }
                .penteract-analytics-panel {
                  padding: 12px;
                  background: #1a1a1a;
                  border-radius: 4px;
                }
                h4 {
                  margin: 0 0 12px 0;
                  font-size: 14px;
                  color: #4fc3f7;
                }
                h5 {
                  margin: 12px 0 8px 0;
                  font-size: 13px;
                  color: #aaa;
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 8px;
                  margin-bottom: 12px;
                }
                .stat-card {
                  padding: 8px;
                  background: #252525;
                  border-radius: 3px;
                  border: 1px solid #333;
                }
                .stat-label {
                  font-size: 11px;
                  color: #888;
                  margin-bottom: 4px;
                }
                .stat-value {
                  font-size: 16px;
                  font-weight: bold;
                  color: #4fc3f7;
                }
                .latest-run {
                  background: #252525;
                  border: 1px solid #333;
                  border-radius: 3px;
                  padding: 8px;
                  margin-bottom: 12px;
                }
                .run-info {
                  display: grid;
                  gap: 6px;
                }
                .run-stat {
                  display: flex;
                  justify-content: space-between;
                  font-size: 12px;
                }
                .run-stat .stat-label {
                  color: #888;
                }
                .run-stat .stat-value {
                  color: #e0e0e0;
                  font-size: 12px;
                }
                .recommendations {
                  margin-top: 8px;
                  padding-top: 8px;
                  border-top: 1px solid #333;
                  font-size: 11px;
                }
                .recommendations strong {
                  color: #ff0;
                }
                .recommendations ul {
                  margin: 4px 0 0 0;
                  padding-left: 20px;
                }
                .recommendations li {
                  margin: 2px 0;
                  color: #ccc;
                }
                .run-history-list {
                  max-height: 200px;
                  overflow-y: auto;
                  background: #252525;
                  border: 1px solid #333;
                  border-radius: 3px;
                  padding: 4px;
                }
                .run-history-item {
                  display: grid;
                  grid-template-columns: 2fr 1fr 1fr 1fr;
                  gap: 8px;
                  padding: 6px;
                  margin: 2px 0;
                  background: #2a2a2a;
                  border-radius: 2px;
                  font-size: 11px;
                }
                .run-time {
                  color: #aaa;
                }
                .run-status {
                  font-weight: bold;
                }
                .run-agents, .run-rate {
                  color: #888;
                }
                .controls {
                  margin-bottom: 12px;
                  display: flex;
                  gap: 8px;
                }
                button {
                  padding: 6px 12px;
                  background: #333;
                  color: #e0e0e0;
                  border: 1px solid #555;
                  border-radius: 3px;
                  cursor: pointer;
                  font-family: monospace;
                  font-size: 11px;
                }
                button:hover {
                  background: #444;
                }
                p {
                  margin: 8px 0;
                  font-size: 12px;
                }
              </style>
              <div class="penteract-analytics-panel">
                <h4>▤ Penteract Analytics</h4>

                <div class="controls">
                  <button class="clear-history">⌦ Clear History</button>
                </div>

                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Total Runs</div>
                    <div class="stat-value">${totalRuns}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Success</div>
                    <div class="stat-value">${successCount}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Failed</div>
                    <div class="stat-value">${failCount}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Success Rate</div>
                    <div class="stat-value">${successRate}%</div>
                  </div>
                </div>

                ${latest ? `
                  <h5>Latest Run</h5>
                  <div class="latest-run">
                    <div class="run-info">
                      <div class="run-stat">
                        <span class="stat-label">Timestamp:</span>
                        <span class="stat-value">${formatTime(latest.timestamp)}</span>
                      </div>
                      <div class="run-stat">
                        <span class="stat-label">Status:</span>
                        <span class="stat-value" style="color: ${latest.consensus?.status === 'success' ? '#0c0' : '#f66'};">
                          ${latest.consensus?.status || 'unknown'}
                        </span>
                      </div>
                      <div class="run-stat">
                        <span class="stat-label">Agents:</span>
                        <span class="stat-value">${latest.metrics?.totals?.total || 0}</span>
                      </div>
                      <div class="run-stat">
                        <span class="stat-label">Avg Tokens:</span>
                        <span class="stat-value">${latest.metrics?.averages?.tokens || 0}</span>
                      </div>
                      <div class="run-stat">
                        <span class="stat-label">Avg Time:</span>
                        <span class="stat-value">${latest.metrics?.averages?.executionTime || 0}s</span>
                      </div>
                    </div>
                    ${latest.recommendations?.length > 0 ? `
                      <div class="recommendations">
                        <strong>Recommendations:</strong>
                        <ul>
                          ${latest.recommendations.map(rec => `<li>${rec}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                  </div>
                ` : '<p style="color: #888; font-style: italic;">No runs yet</p>'}

                <h5>Recent Runs (Last ${Math.min(10, recentRuns.length)})</h5>
                <div class="run-history-list">
                  ${recentRuns.length > 0 ? recentRuns.map(run => `
                    <div class="run-history-item">
                      <span class="run-time">${formatTime(run.timestamp)}</span>
                      <span class="run-status" style="color: ${run.consensus?.status === 'success' ? '#0c0' : '#f66'};">
                        ${run.consensus?.status || 'unknown'}
                      </span>
                      <span class="run-agents">${run.metrics?.totals?.total || 0} agents</span>
                      <span class="run-rate">${run.metrics?.totals?.pass || 0}/${run.metrics?.totals?.total || 0} passed</span>
                    </div>
                  `).join('') : '<p style="color: #888; font-style: italic;">No history</p>'}
                </div>
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.clear-history')?.addEventListener('click', async () => {
              history.length = 0;
              latest = null;
              await persistHistory();
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Analytics history cleared', 'success');
              this.render();
            });
          }
        }

        if (!customElements.get('penteract-analytics-widget')) {
          customElements.define('penteract-analytics-widget', PenteractAnalyticsWidget);
        }

        return {
          element: 'penteract-analytics-widget',
          displayName: 'Penteract Analytics',
          icon: '▤',
          category: 'arena',
          order: 85
        };
      })()
    };
  }
};

export default PenteractAnalytics;
