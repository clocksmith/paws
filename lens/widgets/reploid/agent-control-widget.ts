/**
 * Reploid Agent Control Widget
 *
 * Main approval interface for Reploid workflow agent
 * Handles context approval and proposal approval states
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Dynamic import will be handled by bundler
let mockStatus: any;
if (USE_MOCK_DATA) {
  // In production, this would be: import mockStatus from './mocks/agent-status.json';
  mockStatus = {
    "state": "AWAITING_CONTEXT_APPROVAL",
    "goal": "Add user authentication feature",
    "pending_approval": {
      "type": "context",
      "task_id": "task_123",
      "context_preview": "Files selected:\n- src/auth/login.js\n- src/auth/session.js\n- tests/auth.test.js\n\nTotal: 3 files, 450 lines",
      "timestamp": "2025-10-30T15:00:00Z"
    }
  };
}

export default function createAgentControlWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class AgentControlWidget extends HTMLElement {
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
        // Use mock data for development
        this.currentStatus = mockStatus;
        this.render();
      } else {
        // Subscribe to SentinelFSM state change events for real-time updates
        const unsubStateChange = EventBus.on('fsm:state:changed', (data: any) => {
          console.log('[AgentControl] FSM state changed:', data);
          // Refresh status when state changes
          this.pollStatus();
        });
        this.unsubscribers.push(unsubStateChange);

        // Also poll periodically as backup
        this.startPolling();
      }
    }

    disconnectedCallback() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      // Unsubscribe from events
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async pollStatus() {
      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_agent_status',
          {}
        );

        // Extract status from tool result
        if (result.content && result.content[0] && result.content[0].text) {
          this.currentStatus = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to fetch agent status:', error);
        EventBus.emit('mcp:widget:error', {
          element: 'reploid-agent-control',
          error: {
            code: 'STATUS_FETCH_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    private async startPolling() {
      // Initial poll
      await this.pollStatus();

      // Poll every 2 seconds
      this.pollInterval = setInterval(() => this.pollStatus(), 2000);
    }

    private async approveContext() {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Approved context');
        alert('Context approved! (Mock mode)');
        // Simulate state transition
        this.currentStatus = {
          state: 'PLANNING_WITH_CONTEXT',
          goal: this.currentStatus.goal
        };
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'approve_context',
          { task_id: this.currentStatus.pending_approval.task_id }
        );
      } catch (error) {
        console.error('Failed to approve context:', error);
        this.showError('Failed to approve context');
      }
    }

    private async rejectContext() {
      if (USE_MOCK_DATA) {
        const reason = prompt('Why reject?');
        console.log('MOCK: Rejected context:', reason);
        // Simulate state transition
        this.currentStatus = {
          state: 'CURATING_CONTEXT',
          goal: this.currentStatus.goal
        };
        this.render();
        return;
      }

      const reason = prompt('Why reject?');
      if (!reason) return;

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'reject_context',
          {
            task_id: this.currentStatus.pending_approval.task_id,
            reason
          }
        );
      } catch (error) {
        console.error('Failed to reject context:', error);
        this.showError('Failed to reject context');
      }
    }

    private async approveProposal() {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Approved proposal');
        alert('Proposal approved! (Mock mode)');
        // Simulate state transition
        this.currentStatus = {
          state: 'APPLYING_CHANGESET',
          goal: this.currentStatus.goal
        };
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'approve_proposal',
          { task_id: this.currentStatus.pending_approval.task_id }
        );
      } catch (error) {
        console.error('Failed to approve proposal:', error);
        this.showError('Failed to approve proposal');
      }
    }

    private async rejectProposal() {
      if (USE_MOCK_DATA) {
        const reason = prompt('Why reject?');
        console.log('MOCK: Rejected proposal:', reason);
        // Simulate state transition
        this.currentStatus = {
          state: 'GENERATING_PROPOSAL',
          goal: this.currentStatus.goal
        };
        this.render();
        return;
      }

      const reason = prompt('Why reject?');
      if (!reason) return;

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'reject_proposal',
          {
            task_id: this.currentStatus.pending_approval.task_id,
            reason
          }
        );
      } catch (error) {
        console.error('Failed to reject proposal:', error);
        this.showError('Failed to reject proposal');
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

      const state = this.currentStatus?.state || 'IDLE';

      // Context approval view
      if (state === 'AWAITING_CONTEXT_APPROVAL') {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="widget-container">
            <div class="widget-header">
              <h3>⏸ Context Approval Required</h3>
              <div class="goal">Goal: ${this.escapeHtml(this.currentStatus.goal)}</div>
            </div>

            <div class="approval-content">
              <div class="section-title">Context Preview</div>
              <pre class="context-preview">${this.escapeHtml(this.currentStatus.pending_approval.context_preview)}</pre>

              <div class="approval-actions">
                <button id="approve-btn" class="btn btn-approve">
                  ✓ Approve Context
                </button>
                <button id="reject-btn" class="btn btn-reject">
                  ✗ Reject & Revise
                </button>
              </div>
            </div>
          </div>
        `;

        this.shadowRoot.querySelector('#approve-btn')?.addEventListener('click', () => {
          this.approveContext();
        });
        this.shadowRoot.querySelector('#reject-btn')?.addEventListener('click', () => {
          this.rejectContext();
        });
      }
      // Proposal approval view
      else if (state === 'AWAITING_PROPOSAL_APPROVAL') {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="widget-container">
            <div class="widget-header">
              <h3>⏸ Proposal Approval Required</h3>
              <div class="goal">Goal: ${this.escapeHtml(this.currentStatus.goal)}</div>
            </div>

            <div class="approval-content">
              <div class="section-title">Code Changes</div>
              <div class="note">See Diff Viewer widget for full changes</div>

              <div class="approval-actions">
                <button id="approve-proposal-btn" class="btn btn-approve">
                  ✓ Approve Changes
                </button>
                <button id="reject-proposal-btn" class="btn btn-reject">
                  ✗ Reject
                </button>
              </div>
            </div>
          </div>
        `;

        this.shadowRoot.querySelector('#approve-proposal-btn')?.addEventListener('click', () => {
          this.approveProposal();
        });
        this.shadowRoot.querySelector('#reject-proposal-btn')?.addEventListener('click', () => {
          this.rejectProposal();
        });
      }
      // Idle/working state
      else {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="widget-container">
            <div class="widget-header">
              <h3>Reploid Agent Status</h3>
            </div>

            <div class="status-content">
              <div class="status-row">
                <span class="label">State:</span>
                <span class="value state-${state.toLowerCase()}">${this.escapeHtml(state)}</span>
              </div>
              <div class="status-row">
                <span class="label">Goal:</span>
                <span class="value">${this.escapeHtml(this.currentStatus?.goal || 'None')}</span>
              </div>
            </div>
          </div>
        `;
      }
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

        .widget-container {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          border-radius: 0;
        }

        .widget-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
        }

        .widget-header h3 {
          margin: 0 0 8px 0;
          color: #4ec9b0;
          font-size: 16px;
          font-weight: bold;
        }

        .goal {
          color: #888;
          font-size: 13px;
        }

        .approval-content, .status-content {
          padding: 20px;
        }

        .section-title {
          color: #4ec9b0;
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 12px;
        }

        .context-preview {
          background: #1e1e1e;
          padding: 16px;
          color: #d4d4d4;
          overflow-x: auto;
          border: 1px solid #333;
          margin-bottom: 20px;
          font-size: 13px;
          line-height: 1.5;
        }

        .approval-actions {
          display: flex;
          gap: 12px;
        }

        .btn {
          padding: 10px 20px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: bold;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-approve {
          background: #4ec9b0;
          color: #000;
        }

        .btn-approve:hover {
          background: #6ee7ce;
        }

        .btn-reject {
          background: #ffc107;
          color: #000;
        }

        .btn-reject:hover {
          background: #ffd43b;
        }

        .status-row {
          display: flex;
          padding: 8px 0;
          border-bottom: 1px solid #333;
        }

        .label {
          width: 100px;
          color: #888;
        }

        .value {
          color: #e0e0e0;
        }

        .state-idle { color: #888; }
        .state-curating_context { color: #4ec9b0; }
        .state-awaiting_context_approval { color: #ffc107; }
        .state-planning_with_context { color: #4ec9b0; }
        .state-generating_proposal { color: #4ec9b0; }
        .state-awaiting_proposal_approval { color: #ffc107; }
        .state-applying_changeset { color: #4ec9b0; }
        .state-reflecting { color: #4ec9b0; }
        .state-error { color: #ff4444; }

        .note {
          background: rgba(78, 201, 176, 0.1);
          border-left: 3px solid #4ec9b0;
          padding: 12px;
          margin-bottom: 20px;
          color: #4ec9b0;
          font-size: 13px;
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
  if (!customElements.get('reploid-agent-control')) {
    customElements.define('reploid-agent-control', AgentControlWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[AgentControlWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-agent-control',
          displayName: 'Reploid Agent Control'
        });
      },
      async destroy() {
        console.log('[AgentControlWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-agent-control',
          displayName: 'Reploid Agent Control'
        });
      },
      async refresh() {
        console.log('[AgentControlWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-agent-control',
          displayName: 'Reploid Agent Control'
        });
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-agent-control',
      displayName: 'Reploid Agent Control',
      description: 'Control and approve Reploid agent operations',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_agent_status', 'approve_*', 'reject_*']
      },
      category: 'activity-monitor',
      tags: ['reploid', 'approval', 'workflow']
    }
  };
}
