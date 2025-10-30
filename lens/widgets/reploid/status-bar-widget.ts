/**
 * Reploid Status Bar Widget
 *
 * System-wide status aggregation bar displaying agent state,
 * module health, and real-time system metrics
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

let mockStatusData: any;
if (USE_MOCK_DATA) {
  mockStatusData = {
    "agent_state": "PLANNING",
    "goal": "Add authentication feature",
    "system_health": {
      "total_modules": 45,
      "active_count": 12,
      "idle_count": 30,
      "error_count": 3
    },
    "performance": {
      "cpu_usage": 35.2,
      "memory_mb": 245,
      "uptime_hours": 4.5
    }
  };
}

export default function createStatusBarWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class StatusBarWidget extends HTMLElement {
    private pollInterval: any;
    private currentStatus: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      if (USE_MOCK_DATA) {
        this.currentStatus = mockStatusData;
        this.render();
      } else {
        // Subscribe to state change events
        const unsubStateChange = EventBus.on('fsm:state:changed', (data: any) => {
          this.pollStatus();
        });
        this.unsubscribers.push(unsubStateChange);

        // Poll for status updates
        this.startPolling();
      }
    }

    disconnectedCallback() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async pollStatus() {
      try {
        // Get agent status
        const agentResult = await MCPBridge.callTool(
          'agent-control',
          'get_cycle_state',
          {}
        );

        // Get performance metrics
        const perfResult = await MCPBridge.callTool(
          'performance-monitor',
          'get_metrics',
          {}
        );

        // Parse results
        let agentStatus = null;
        let perfMetrics = null;

        if (agentResult.content?.[0]?.text) {
          agentStatus = JSON.parse(agentResult.content[0].text);
        }

        if (perfResult.content?.[0]?.text) {
          perfMetrics = JSON.parse(perfResult.content[0].text);
        }

        this.currentStatus = {
          agent_state: agentStatus?.state || 'IDLE',
          goal: agentStatus?.goal || null,
          system_health: {
            total_modules: perfMetrics?.module_count || 0,
            active_count: perfMetrics?.active_modules || 0,
            error_count: perfMetrics?.error_count || 0
          },
          performance: perfMetrics || {}
        };

        this.render();
      } catch (error) {
        console.error('[StatusBar] Failed to fetch status:', error);
      }
    }

    private async startPolling() {
      await this.pollStatus();
      this.pollInterval = setInterval(() => this.pollStatus(), 3000);
    }

    private getStateColor(state: string): string {
      const colors: Record<string, string> = {
        'IDLE': '#6c757d',
        'PLANNING': '#0d6efd',
        'EXECUTING': '#198754',
        'AWAITING_CONTEXT_APPROVAL': '#ffc107',
        'AWAITING_PROPOSAL_APPROVAL': '#fd7e14',
        'ERROR': '#dc3545'
      };
      return colors[state] || '#6c757d';
    }

    private render() {
      if (!this.shadowRoot) return;

      const status = this.currentStatus;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
            background: #1a1a1a;
            border-bottom: 1px solid #333;
          }

          .status-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0.5rem 1rem;
            font-size: 0.875rem;
            color: #e0e0e0;
          }

          .status-section {
            display: flex;
            align-items: center;
            gap: 1rem;
          }

          .agent-state {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 500;
          }

          .state-indicator {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            animation: pulse 2s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }

          .goal-text {
            color: #999;
            max-width: 300px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .metric {
            display: flex;
            align-items: center;
            gap: 0.25rem;
          }

          .metric-label {
            color: #888;
          }

          .metric-value {
            color: #fff;
            font-weight: 500;
          }

          .error {
            color: #ff6b6b;
            padding: 0.5rem 1rem;
            text-align: center;
          }
        </style>

        <div class="status-bar">
          ${status ? `
            <div class="status-section">
              <div class="agent-state">
                <span class="state-indicator" style="background-color: ${this.getStateColor(status.agent_state)}"></span>
                <span>${status.agent_state}</span>
              </div>
              ${status.goal ? `
                <div class="goal-text" title="${status.goal}">${status.goal}</div>
              ` : ''}
            </div>

            <div class="status-section">
              <div class="metric">
                <span class="metric-label">Modules:</span>
                <span class="metric-value">${status.system_health.active_count}/${status.system_health.total_modules}</span>
              </div>
              ${status.system_health.error_count > 0 ? `
                <div class="metric">
                  <span class="metric-label">Errors:</span>
                  <span class="metric-value" style="color: #ff6b6b">${status.system_health.error_count}</span>
                </div>
              ` : ''}
              ${status.performance.cpu_usage ? `
                <div class="metric">
                  <span class="metric-label">CPU:</span>
                  <span class="metric-value">${status.performance.cpu_usage.toFixed(1)}%</span>
                </div>
              ` : ''}
              ${status.performance.memory_mb ? `
                <div class="metric">
                  <span class="metric-label">Memory:</span>
                  <span class="metric-value">${status.performance.memory_mb} MB</span>
                </div>
              ` : ''}
            </div>
          ` : `
            <div class="error">Loading status...</div>
          `}
        </div>
      `;
    }
  }

  customElements.define('reploid-status-bar', StatusBarWidget);

  return {
    factory: () => {
      return new StatusBarWidget();
    }
  };
}
