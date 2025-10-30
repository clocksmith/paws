/**
 * Reploid LLM Router Widget
 *
 * LLM routing strategy management UI
 * Configure and monitor hybrid LLM provider routing
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockRouterData: any;
if (USE_MOCK_DATA) {
  mockRouterData = {
    strategy: 'cheapest',
    providers: [
      { id: 'openai', name: 'OpenAI', status: 'healthy', latency: 120, cost: 0.03, requests: 145 },
      { id: 'anthropic', name: 'Anthropic', status: 'healthy', latency: 95, cost: 0.015, requests: 89 },
      { id: 'local', name: 'Local LLM', status: 'healthy', latency: 50, cost: 0.0, requests: 23 }
    ],
    routingHistory: [
      { timestamp: '14:30', provider: 'anthropic', reason: 'cheapest' },
      { timestamp: '14:28', provider: 'local', reason: 'fastest' },
      { timestamp: '14:25', provider: 'openai', reason: 'forced' }
    ]
  };
}

export default function createLLMRouterWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class LLMRouterWidget extends HTMLElement {
    private routerState: any = null;
    private autoRefresh: boolean = true;
    private refreshInterval: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsubRefresh = EventBus.on('reploid:router:refresh', () => {
        this.loadRouterState();
      });
      this.unsubscribers.push(unsubRefresh);

      this.loadRouterState();
      this.startAutoRefresh();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
      this.stopAutoRefresh();
    }

    private startAutoRefresh() {
      if (this.autoRefresh && !this.refreshInterval) {
        this.refreshInterval = setInterval(() => this.loadRouterState(), 5000);
      }
    }

    private stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    private async loadRouterState() {
      if (USE_MOCK_DATA) {
        this.routerState = mockRouterData;
        this.render();
        return;
      }

      try {
        const [strategyResult, statusResult] = await Promise.all([
          MCPBridge.callTool(serverInfo.serverName, 'get_routing_strategy', {}),
          MCPBridge.callTool(serverInfo.serverName, 'get_provider_status', {})
        ]);

        this.routerState = {
          strategy: JSON.parse(strategyResult.content[0].text).strategy,
          providers: JSON.parse(statusResult.content[0].text).providers
        };
        this.render();
      } catch (error) {
        console.error('Failed to load router state:', error);
        this.showError('Failed to load router state');
      }
    }

    private async setStrategy(strategy: string) {
      if (USE_MOCK_DATA) {
        this.routerState.strategy = strategy;
        this.showSuccess(`Strategy set to ${strategy} (mock)`);
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'set_strategy', { strategy });
        this.showSuccess(`Routing strategy set to ${strategy}`);
        await this.loadRouterState();
      } catch (error) {
        console.error('Failed to set strategy:', error);
        this.showError('Failed to set routing strategy');
      }
    }

    private async forceProvider(providerId: string) {
      if (USE_MOCK_DATA) {
        this.showSuccess(`Forced provider: ${providerId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'force_provider', { provider_id: providerId });
        this.showSuccess(`Forced provider to ${providerId}`);
      } catch (error) {
        console.error('Failed to force provider:', error);
        this.showError('Failed to force provider');
      }
    }

    private showError(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-error';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private showSuccess(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-success';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      if (!this.routerState) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="router-empty">Loading router state...</div>
        `;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="router-widget">
          <div class="widget-header">
            <h3>🔀 LLM Router</h3>
            <div class="header-actions">
              <label class="auto-refresh">
                <input type="checkbox" ${this.autoRefresh ? 'checked' : ''}>
                <span>Auto</span>
              </label>
              <button class="btn-refresh">⟳</button>
            </div>
          </div>

          <div class="strategy-selector">
            <div class="strategy-label">Routing Strategy:</div>
            <div class="strategy-buttons">
              <button class="strategy-btn ${this.routerState.strategy === 'cheapest' ? 'active' : ''}" data-strategy="cheapest">
                💰 Cheapest
              </button>
              <button class="strategy-btn ${this.routerState.strategy === 'fastest' ? 'active' : ''}" data-strategy="fastest">
                ⚡ Fastest
              </button>
              <button class="strategy-btn ${this.routerState.strategy === 'smartest' ? 'active' : ''}" data-strategy="smartest">
                🧠 Smartest
              </button>
            </div>
          </div>

          <div class="providers-section">
            <div class="section-title">Provider Status</div>
            <div class="providers-list">
              ${this.routerState.providers.map((p: any) => `
                <div class="provider-card status-${p.status}">
                  <div class="provider-header">
                    <span class="provider-name">${p.name}</span>
                    <span class="provider-status">${p.status}</span>
                  </div>
                  <div class="provider-stats">
                    <div class="stat">
                      <span class="stat-label">Latency:</span>
                      <span class="stat-value">${p.latency}ms</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">Cost:</span>
                      <span class="stat-value">$${p.cost}/1K</span>
                    </div>
                    <div class="stat">
                      <span class="stat-label">Requests:</span>
                      <span class="stat-value">${p.requests}</span>
                    </div>
                  </div>
                  <button class="btn-force" data-provider="${p.id}">Force This Provider</button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelector('.auto-refresh input')?.addEventListener('change', (e) => {
        this.autoRefresh = (e.target as HTMLInputElement).checked;
        if (this.autoRefresh) this.startAutoRefresh();
        else this.stopAutoRefresh();
      });

      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadRouterState();
      });

      this.shadowRoot?.querySelectorAll('.strategy-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const strategy = (btn as HTMLElement).dataset.strategy;
          if (strategy) this.setStrategy(strategy);
        });
      });

      this.shadowRoot?.querySelectorAll('.btn-force').forEach(btn => {
        btn.addEventListener('click', () => {
          const provider = (btn as HTMLElement).dataset.provider;
          if (provider) this.forceProvider(provider);
        });
      });
    }

    private getStyles() {
      return `
        :host {
          display: block;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .router-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          height: 600px;
          display: flex;
          flex-direction: column;
        }

        .widget-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .widget-header h3 {
          margin: 0;
          color: #d7ba7d;
          font-size: 16px;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .auto-refresh {
          font-size: 10px;
          color: #888;
          cursor: pointer;
          display: flex;
          gap: 4px;
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(215, 186, 125, 0.2);
          border: 1px solid rgba(215, 186, 125, 0.4);
          color: #d7ba7d;
          cursor: pointer;
        }

        .strategy-selector {
          padding: 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
        }

        .strategy-label {
          font-size: 11px;
          color: #888;
          margin-bottom: 8px;
        }

        .strategy-buttons {
          display: flex;
          gap: 8px;
        }

        .strategy-btn {
          flex: 1;
          padding: 10px;
          background: rgba(215, 186, 125, 0.1);
          border: 1px solid rgba(215, 186, 125, 0.3);
          color: #d7ba7d;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          transition: all 0.2s;
        }

        .strategy-btn:hover {
          background: rgba(215, 186, 125, 0.2);
        }

        .strategy-btn.active {
          background: rgba(215, 186, 125, 0.3);
          border-color: #d7ba7d;
          font-weight: bold;
        }

        .providers-section {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #d7ba7d;
          margin-bottom: 12px;
        }

        .providers-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .provider-card {
          background: rgba(30, 30, 30, 0.8);
          border: 2px solid #444;
          padding: 12px;
        }

        .provider-card.status-healthy {
          border-left: 4px solid #4ec9b0;
        }

        .provider-card.status-degraded {
          border-left: 4px solid #ffaa00;
        }

        .provider-card.status-down {
          border-left: 4px solid #f44747;
        }

        .provider-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }

        .provider-name {
          font-size: 14px;
          font-weight: bold;
          color: #9cdcfe;
        }

        .provider-status {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 10px;
          background: rgba(78, 201, 176, 0.3);
          color: #4ec9b0;
        }

        .provider-stats {
          display: flex;
          gap: 16px;
          margin-bottom: 10px;
          font-size: 11px;
        }

        .stat-label {
          color: #888;
        }

        .stat-value {
          color: #d7ba7d;
          font-weight: bold;
        }

        .btn-force {
          width: 100%;
          padding: 6px;
          background: rgba(215, 186, 125, 0.2);
          border: 1px solid rgba(215, 186, 125, 0.4);
          color: #d7ba7d;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 10px;
        }

        .btn-force:hover {
          background: rgba(215, 186, 125, 0.3);
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 4px;
          z-index: 10000;
        }

        .toast-error {
          background: #f44747;
          color: white;
        }

        .toast-success {
          background: #4ec9b0;
          color: #000;
        }
      `;
    }
  }

  if (!customElements.get('reploid-llm-router')) {
    customElements.define('reploid-llm-router', LLMRouterWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[LLMRouterWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-llm-router',
          displayName: 'LLM Router'
        });
      },
      async destroy() {
        console.log('[LLMRouterWidget] Destroyed');
      },
      async refresh() {
        EventBus.emit('reploid:router:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-llm-router',
      displayName: 'LLM Router',
      description: 'Configure and monitor hybrid LLM provider routing strategies',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: {
        tools: ['route_request', 'get_routing_strategy', 'set_strategy', 'get_provider_status', 'force_provider']
      },
      category: 'routing',
      tags: ['reploid', 'llm', 'router', 'hybrid', 'providers']
    }
  };
}
