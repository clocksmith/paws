// PenteractVisualizer - Stub module for multi-agent analytics & visualization

const PenteractVisualizer = {
  metadata: {
    id: 'PenteractVisualizer',
    version: '0.1.0',
    description: 'Visual scaffold for Penteract (H5) deliberation analytics',
    dependencies: ['EventBus', 'Utils'],
    async: false,
    type: 'visualizer'
  },

  factory: (deps) => {
    const { EventBus, Utils } = deps;
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
              <p>Awaiting Paxos runs...</p>
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

    const init = (containerId = 'penteract-visualizer') => {
      container = document.getElementById(containerId);
      if (!container) {
        logger.warn('[PenteractVisualizer] Container not found:', containerId);
        return;
      }
      ensureStyles();
      render();
    };

    EventBus.on('paxos:analytics', handleAnalytics);

    const dispose = () => {
      EventBus.off('paxos:analytics', handleAnalytics);
    };

    return {
      init,
      dispose,
      getLatestSnapshot: () => latestSnapshot
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
