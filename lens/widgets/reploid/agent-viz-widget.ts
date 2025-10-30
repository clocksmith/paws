/**
 * Reploid Agent Visualizer Widget
 *
 * FSM state machine visualization with state history
 * Shows current state, transitions, and metrics
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockFSMData: any;
if (USE_MOCK_DATA) {
  mockFSMData = {
    "current_state": "AWAITING_CONTEXT_APPROVAL",
    "previous_state": "CURATING_CONTEXT",
    "states": [
      {"name": "IDLE", "description": "Agent is idle", "color": "#888888", "transitions": ["CURATING_CONTEXT"]},
      {"name": "CURATING_CONTEXT", "description": "Selecting files", "color": "#4ec9b0", "transitions": ["AWAITING_CONTEXT_APPROVAL", "ERROR"]},
      {"name": "AWAITING_CONTEXT_APPROVAL", "description": "Waiting for approval", "color": "#ffc107", "transitions": ["PLANNING_WITH_CONTEXT", "CURATING_CONTEXT", "ERROR"]},
      {"name": "PLANNING_WITH_CONTEXT", "description": "Planning approach", "color": "#4ec9b0", "transitions": ["GENERATING_PROPOSAL", "ERROR"]},
      {"name": "GENERATING_PROPOSAL", "description": "Generating changes", "color": "#4ec9b0", "transitions": ["AWAITING_PROPOSAL_APPROVAL", "ERROR"]},
      {"name": "AWAITING_PROPOSAL_APPROVAL", "description": "Waiting for approval", "color": "#ffc107", "transitions": ["APPLYING_CHANGESET", "GENERATING_PROPOSAL", "ERROR"]},
      {"name": "APPLYING_CHANGESET", "description": "Applying changes", "color": "#4ec9b0", "transitions": ["REFLECTING", "ERROR"]},
      {"name": "REFLECTING", "description": "Reflecting on results", "color": "#4ec9b0", "transitions": ["IDLE", "CURATING_CONTEXT", "ERROR"]},
      {"name": "ERROR", "description": "Error state", "color": "#ff4444", "transitions": ["IDLE", "CURATING_CONTEXT"]}
    ],
    "history": [
      {"state": "IDLE", "timestamp": "2025-10-30T15:00:00Z", "duration": 120},
      {"state": "CURATING_CONTEXT", "timestamp": "2025-10-30T15:02:00Z", "duration": 45},
      {"state": "AWAITING_CONTEXT_APPROVAL", "timestamp": "2025-10-30T15:02:45Z", "duration": 0}
    ],
    "metrics": {
      "total_transitions": 23,
      "successful_runs": 5,
      "failed_runs": 1,
      "average_cycle_time_seconds": 180
    }
  };
}

export default function createAgentVisualizerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class AgentVisualizerWidget extends HTMLElement {
    private fsmData: any = null;
    private pollInterval: any;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.loadFSMData();

      // Subscribe to SentinelFSM state change events
      const unsubStateChange = EventBus.on('fsm:state:changed', (data: any) => {
        this.handleStateChange(data);
      });
      this.unsubscribers.push(unsubStateChange);
    }

    disconnectedCallback() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadFSMData() {
      if (USE_MOCK_DATA) {
        this.fsmData = mockFSMData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_fsm_state',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.fsmData = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load FSM data:', error);
        this.showError('Failed to load FSM state');
      }
    }

    private handleStateChange(data: any) {
      if (this.fsmData) {
        this.fsmData.previous_state = this.fsmData.current_state;
        this.fsmData.current_state = data.state;
        this.fsmData.history.push({
          state: data.state,
          timestamp: new Date().toISOString(),
          duration: 0
        });
        if (this.fsmData.history.length > 10) {
          this.fsmData.history = this.fsmData.history.slice(-10);
        }
        this.render();
      }
    }

    private showError(message: string) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-toast';
      errorDiv.textContent = message;
      this.shadowRoot?.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      if (!this.fsmData) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="viz-empty">
            <div class="empty-icon">🔄</div>
            <div class="empty-text">Loading FSM state...</div>
          </div>
        `;
        return;
      }

      const currentStateObj = this.fsmData.states.find(
        (s: any) => s.name === this.fsmData.current_state
      );

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="viz-container">
          <!-- Current State Display -->
          <div class="current-state">
            <div class="state-label">CURRENT STATE</div>
            <div class="state-name" style="color: ${currentStateObj?.color || '#4ec9b0'}">
              ${this.escapeHtml(this.fsmData.current_state)}
            </div>
            <div class="state-description">
              ${this.escapeHtml(currentStateObj?.description || 'No description')}
            </div>
          </div>

          <!-- State Diagram -->
          <div class="state-diagram">
            <div class="diagram-title">STATE MACHINE</div>
            <div class="states-grid">
              ${this.fsmData.states.map((state: any) => this.renderStateNode(state)).join('')}
            </div>
          </div>

          <!-- State History -->
          <div class="state-history">
            <div class="history-title">HISTORY (Last 10 transitions)</div>
            <div class="history-list">
              ${this.fsmData.history.slice().reverse().map((item: any, index: number) =>
                this.renderHistoryItem(item, index === 0)
              ).join('')}
            </div>
          </div>

          <!-- Metrics -->
          <div class="metrics-panel">
            <div class="metric-item">
              <div class="metric-label">Total Transitions</div>
              <div class="metric-value">${this.fsmData.metrics.total_transitions}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Successful Runs</div>
              <div class="metric-value success">${this.fsmData.metrics.successful_runs}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Failed Runs</div>
              <div class="metric-value error">${this.fsmData.metrics.failed_runs}</div>
            </div>
            <div class="metric-item">
              <div class="metric-label">Avg Cycle Time</div>
              <div class="metric-value">${this.formatDuration(this.fsmData.metrics.average_cycle_time_seconds)}</div>
            </div>
          </div>
        </div>
      `;
    }

    private renderStateNode(state: any) {
      const isCurrent = state.name === this.fsmData.current_state;
      const isPrevious = state.name === this.fsmData.previous_state;

      return `
        <div class="state-node ${isCurrent ? 'current' : ''} ${isPrevious ? 'previous' : ''}"
             style="border-color: ${state.color}">
          <div class="state-node-name" style="color: ${state.color}">
            ${this.escapeHtml(state.name.replace(/_/g, ' '))}
          </div>
          ${isCurrent ? '<div class="state-indicator">●</div>' : ''}
        </div>
      `;
    }

    private renderHistoryItem(item: any, isCurrent: boolean) {
      const time = new Date(item.timestamp).toLocaleTimeString();
      const duration = item.duration > 0 ? ` (${this.formatDuration(item.duration)})` : '';

      return `
        <div class="history-item ${isCurrent ? 'current' : ''}">
          <div class="history-time">${time}</div>
          <div class="history-state">${this.escapeHtml(item.state)}</div>
          <div class="history-duration">${duration}</div>
        </div>
      `;
    }

    private formatDuration(seconds: number): string {
      if (seconds < 60) return `${seconds}s`;
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}m ${secs}s`;
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host {
          display: block;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .viz-empty {
          padding: 60px 20px;
          text-align: center;
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 18px;
          color: #888;
        }

        .viz-container {
          background: rgba(20, 20, 20, 0.8);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .current-state {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #4ec9b0;
          padding: 20px;
          text-align: center;
        }

        .state-label {
          font-size: 11px;
          color: #888;
          letter-spacing: 2px;
          margin-bottom: 8px;
        }

        .state-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 8px;
          letter-spacing: 1px;
        }

        .state-description {
          font-size: 13px;
          color: #888;
        }

        .state-diagram {
          background: rgba(40, 40, 40, 0.6);
          border: 1px solid #333;
          padding: 16px;
        }

        .diagram-title {
          font-size: 12px;
          color: #4ec9b0;
          font-weight: bold;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .states-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
          gap: 12px;
        }

        .state-node {
          background: rgba(20, 20, 20, 0.8);
          border: 2px solid #333;
          padding: 12px;
          text-align: center;
          position: relative;
          transition: all 0.3s;
        }

        .state-node:hover {
          background: rgba(30, 30, 30, 0.9);
        }

        .state-node.current {
          border-width: 3px;
          box-shadow: 0 0 20px rgba(78, 201, 176, 0.3);
        }

        .state-node.previous {
          opacity: 0.6;
        }

        .state-node-name {
          font-size: 11px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .state-indicator {
          position: absolute;
          top: 8px;
          right: 8px;
          color: #4ec9b0;
          font-size: 20px;
          animation: pulse 2s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }

        .state-history {
          background: rgba(40, 40, 40, 0.6);
          border: 1px solid #333;
          padding: 16px;
        }

        .history-title {
          font-size: 12px;
          color: #4ec9b0;
          font-weight: bold;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .history-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 200px;
          overflow-y: auto;
        }

        .history-item {
          display: grid;
          grid-template-columns: 80px 1fr 80px;
          gap: 12px;
          padding: 8px;
          background: rgba(20, 20, 20, 0.6);
          border-left: 2px solid #333;
          font-size: 12px;
        }

        .history-item.current {
          border-left-color: #4ec9b0;
          background: rgba(78, 201, 176, 0.1);
        }

        .history-time {
          color: #888;
        }

        .history-state {
          color: #e0e0e0;
        }

        .history-duration {
          color: #888;
          text-align: right;
        }

        .metrics-panel {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 12px;
        }

        .metric-item {
          background: rgba(40, 40, 40, 0.6);
          border: 1px solid #333;
          padding: 16px;
          text-align: center;
        }

        .metric-label {
          font-size: 11px;
          color: #888;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .metric-value {
          font-size: 24px;
          font-weight: bold;
          color: #4ec9b0;
        }

        .metric-value.success {
          color: #4ec9b0;
        }

        .metric-value.error {
          color: #ff4444;
        }

        .error-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #ff4444;
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10000;
        }
      `;
    }
  }

  // Register custom element
  if (!customElements.get('reploid-agent-visualizer')) {
    customElements.define('reploid-agent-visualizer', AgentVisualizerWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[AgentVisualizerWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-agent-visualizer',
          displayName: 'Reploid Agent Visualizer'
        });
      },
      async destroy() {
        console.log('[AgentVisualizerWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-agent-visualizer',
          displayName: 'Reploid Agent Visualizer'
        });
      },
      async refresh() {
        console.log('[AgentVisualizerWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-agent-visualizer',
          displayName: 'Reploid Agent Visualizer'
        });
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-agent-visualizer',
      displayName: 'Reploid Agent Visualizer',
      description: 'FSM state machine visualization with history and metrics',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_fsm_state']
      },
      category: 'data-visualization',
      tags: ['reploid', 'fsm', 'visualization', 'state-machine']
    }
  };
}
