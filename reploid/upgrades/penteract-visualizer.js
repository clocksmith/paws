// @blueprint 0x000058 - Penteract multi-agent analytics visualizer
// PenteractVisualizer - Stub module for multi-agent analytics & visualization

const PenteractVisualizer = {
  metadata: {
    id: 'PenteractVisualizer',
    version: '0.1.0',
    description: 'Visual scaffold for Penteract (H5) deliberation analytics',
    dependencies: ['EventBus', 'Utils', 'PenteractAnalytics'],
    async: false,
    type: 'visualizer'
  },

  factory: (deps) => {
    const { EventBus, Utils, PenteractAnalytics } = deps;
    const { logger } = Utils;

    let container = null;
    let latestSnapshot = null;
    const STYLE_ID = 'penteract-visualizer-styles';

    const ensureStyles = () => {
      if (document.getElementById(STYLE_ID)) {
        return;
      }
      const styles = document.createElement('style');
      styles.id = STYLE_ID;
      styles.textContent = `
        .penteract-panel {
          background: #1b1b1d;
          border: 1px solid #333;
          border-radius: 8px;
          padding: 16px;
          color: #e0e0e0;
          font-family: 'Monaco', 'Menlo', monospace;
        }
        .penteract-panel header {
          margin-bottom: 12px;
        }
        .penteract-panel header h3 {
          margin: 0 0 4px 0;
          font-size: 16px;
        }
        .penteract-panel header .task {
          font-size: 12px;
          opacity: 0.7;
          margin: 4px 0 0 0;
        }
        .penteract-panel .status-success {
          color: #4ec9b0;
        }
        .penteract-panel .status-failure {
          color: #f48771;
        }
        .penteract-panel table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .penteract-panel th,
        .penteract-panel td {
          border-bottom: 1px solid #2a2a2d;
          padding: 6px 8px;
          text-align: left;
        }
        .penteract-panel tbody tr:last-child td {
          border-bottom: none;
        }
        .penteract-panel td.pass { color: #4ec9b0; }
        .penteract-panel td.fail { color: #ffd700; }
        .penteract-panel td.error { color: #f48771; }
      `;
      document.head.appendChild(styles);
    };

    const render = () => {
      if (!container) {
        return;
      }

      if (!latestSnapshot) {
        container.innerHTML = `
          <section class="penteract-panel">
            <header>
              <h3>Penteract Analytics</h3>
              <p>Awaiting Arena runs...</p>
            </header>
          </section>
        `;
        return;
      }

      const { consensus, agents, task, timestamp } = latestSnapshot;
      const statusClass = consensus.status === 'success' ? 'status-success' : 'status-failure';

      const agentRows = agents.map(agent => `
        <tr>
          <td>${agent.name}</td>
          <td>${agent.model}</td>
          <td class="${agent.status.toLowerCase()}">${agent.status}</td>
          <td>${agent.token_count}</td>
          <td>${agent.execution_time}</td>
        </tr>
      `).join('');

      container.innerHTML = `
        <section class="penteract-panel">
          <header>
            <h3>Penteract Analytics</h3>
            <p class="${statusClass}">${consensus.status.toUpperCase()} • ${new Date(timestamp).toLocaleString()}</p>
            <p class="task">${task}</p>
          </header>
          <div class="penteract-body">
            <table class="agent-summary">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Tokens</th>
                  <th>Time (s)</th>
                </tr>
              </thead>
              <tbody>
                ${agentRows}
              </tbody>
            </table>
          </div>
        </section>
      `;
    };

    const handleAnalytics = (snapshot) => {
      latestSnapshot = snapshot;
      render();
    };

    const refreshFromStore = () => {
      if (!PenteractAnalytics || typeof PenteractAnalytics.getLatest !== 'function') {
        return;
      }
      const snapshot = PenteractAnalytics.getLatest();
      if (snapshot) {
        latestSnapshot = snapshot;
        render();
      }
    };

    const init = (containerId = 'penteract-visualizer') => {
      container = document.getElementById(containerId);
      if (!container) {
        logger.warn('[PenteractVisualizer] Container not found:', containerId);
        return;
      }
      ensureStyles();
      refreshFromStore();
      render();
    };

    const unsubscribeProcessed = EventBus.on('arena:analytics:processed', handleAnalytics, 'PenteractVisualizer');
    const unsubscribeRaw = EventBus.on('arena:analytics', () => refreshFromStore(), 'PenteractVisualizer');

    const dispose = () => {
      unsubscribeProcessed?.();
      unsubscribeRaw?.();
    };

    return {
      init,
      dispose,
      getLatestSnapshot: () => latestSnapshot,

      // Widget interface
      widget: (() => {
        class PenteractVisualizerWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            this._updateListener = () => this.render();
            EventBus.on('arena:analytics:processed', this._updateListener, 'PenteractVisualizerWidget');
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
            const hasData = !!latestSnapshot;
            const isSuccess = latestSnapshot?.consensus?.status === 'success';

            return {
              state: hasData ? (isSuccess ? 'active' : 'warning') : 'idle',
              primaryMetric: hasData ? 'Visualizing' : 'No data',
              secondaryMetric: latestSnapshot ? `${latestSnapshot.metrics?.totals?.total || 0} agents` : 'Waiting',
              lastActivity: latestSnapshot?.timestamp ? new Date(latestSnapshot.timestamp).getTime() : null
            };
          }

          render() {
            const formatTime = (timestamp) => {
              if (!timestamp) return 'Never';
              return new Date(timestamp).toLocaleString();
            };

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  font-family: monospace;
                  color: #e0e0e0;
                }
                .penteract-visualizer-panel {
                  padding: 12px;
                  background: #1a1a1a;
                  border-radius: 4px;
                }
                h4 {
                  margin: 0 0 12px 0;
                  font-size: 14px;
                  color: #4fc3f7;
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
                .viz-info {
                  display: grid;
                  gap: 8px;
                  margin-bottom: 12px;
                }
                .viz-stat {
                  display: flex;
                  justify-content: space-between;
                  padding: 6px;
                  background: #252525;
                  border-radius: 3px;
                  border: 1px solid #333;
                  font-size: 12px;
                }
                .stat-label {
                  color: #888;
                }
                .stat-value {
                  color: #e0e0e0;
                  font-weight: bold;
                }
                .viz-info-box {
                  margin-top: 16px;
                  padding: 12px;
                  background: rgba(100,150,255,0.1);
                  border-left: 3px solid #6496ff;
                  border-radius: 4px;
                }
                .viz-info-box strong {
                  color: #6496ff;
                }
                .viz-info-box div {
                  margin-top: 6px;
                  color: #aaa;
                  font-size: 11px;
                }
                p {
                  margin: 8px 0;
                  font-size: 12px;
                }
              </style>
              <div class="penteract-visualizer-panel">
                <h4>◎ Penteract Visualizer</h4>

                <div class="controls">
                  <button class="refresh-viz">↻ Refresh</button>
                </div>

                ${latestSnapshot ? `
                  <div class="viz-info">
                    <div class="viz-stat">
                      <span class="stat-label">Last Updated:</span>
                      <span class="stat-value">${formatTime(latestSnapshot.timestamp)}</span>
                    </div>
                    <div class="viz-stat">
                      <span class="stat-label">Status:</span>
                      <span class="stat-value" style="color: ${latestSnapshot.consensus?.status === 'success' ? '#0c0' : '#f66'};">
                        ${latestSnapshot.consensus?.status || 'unknown'}
                      </span>
                    </div>
                    <div class="viz-stat">
                      <span class="stat-label">Agents Visualized:</span>
                      <span class="stat-value">${latestSnapshot.metrics?.totals?.total || 0}</span>
                    </div>
                    <div class="viz-stat">
                      <span class="stat-label">Pass Rate:</span>
                      <span class="stat-value">
                        ${latestSnapshot.metrics?.totals?.pass || 0}/${latestSnapshot.metrics?.totals?.total || 0}
                        (${latestSnapshot.metrics?.totals?.total > 0 ? Math.round((latestSnapshot.metrics.totals.pass / latestSnapshot.metrics.totals.total) * 100) : 0}%)
                      </span>
                    </div>
                  </div>
                ` : `
                  <p style="color: #888; font-style: italic;">No visualization data available</p>
                  <p style="color: #888; font-size: 11px;">Waiting for Penteract analytics snapshot...</p>
                `}

                <div class="viz-info-box">
                  <strong>ⓘ Visualizer Info</strong>
                  <div>
                    This module provides visual representation of Penteract consensus test results.
                    Visualizations appear in the main UI when test data is available.
                  </div>
                </div>
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.refresh-viz')?.addEventListener('click', () => {
              refreshFromStore();
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Visualizer refreshed', 'success');
            });
          }
        }

        if (!customElements.get('penteract-visualizer-widget')) {
          customElements.define('penteract-visualizer-widget', PenteractVisualizerWidget);
        }

        return {
          element: 'penteract-visualizer-widget',
          displayName: 'Penteract Visualizer',
          icon: '◎',
          category: 'arena',
          order: 90
        };
      })()
    };
  }
};

if (typeof window !== 'undefined') {
  if (window.ModuleRegistry) {
    window.ModuleRegistry.register(PenteractVisualizer);
  }
  window.PenteractVisualizer = PenteractVisualizer;
}

export default PenteractVisualizer;
