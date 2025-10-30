/**
 * Reploid Sentinel Panel Widget
 *
 * CRITICAL approval workflow interface for RSI self-modification oversight
 * Provides human-in-the-loop approval for context and proposal reviews
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

let mockApprovalData: any;
if (USE_MOCK_DATA) {
  mockApprovalData = {
    "state": "AWAITING_CONTEXT_APPROVAL",
    "context": {
      "cats_path": "session_123/turn_001/cats.md",
      "cats_content": "# Context Files\n\n- src/auth/login.js\n- src/auth/middleware.js\n- package.json",
      "goal": "Implement JWT authentication"
    }
  };
}

export default function createSentinelPanelWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class SentinelPanelWidget extends HTMLElement {
    private pollInterval: any;
    private currentState: string = 'IDLE';
    private currentApproval: any = null;
    private autoApproveEnabled: boolean = false;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Load auto-approve setting from localStorage
      try {
        const saved = localStorage.getItem('reploid_auto_approve');
        if (saved !== null) {
          this.autoApproveEnabled = JSON.parse(saved);
        }
      } catch (err) {
        console.warn('[SentinelPanel] Failed to load auto-approve setting:', err);
      }

      this.render();

      if (USE_MOCK_DATA) {
        this.currentState = mockApprovalData.state;
        this.currentApproval = mockApprovalData;
        this.render();
      } else {
        // Subscribe to FSM state changes
        const unsubStateChange = EventBus.on('fsm:state:changed', (data: any) => {
          this.handleStateChange(data);
        });
        this.unsubscribers.push(unsubStateChange);

        // Poll for pending approvals
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

    private async handleStateChange(data: any) {
      const { to, context } = data;
      this.currentState = to;

      if (to === 'AWAITING_CONTEXT_APPROVAL' || to === 'AWAITING_PROPOSAL_APPROVAL') {
        await this.pollApproval();

        // Auto-approve context if enabled
        if (to === 'AWAITING_CONTEXT_APPROVAL' && this.autoApproveEnabled) {
          console.info('[SentinelPanel] Auto-approving context');
          setTimeout(() => this.approveContext(), 100);
        }
      } else {
        this.currentApproval = null;
        this.render();
      }
    }

    private async pollApproval() {
      try {
        const result = await MCPBridge.callTool(
          'workflow',
          'get_pending_approval',
          {}
        );

        if (result.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          this.currentApproval = data;
          this.render();
        }
      } catch (error) {
        console.error('[SentinelPanel] Failed to fetch pending approval:', error);
      }
    }

    private async startPolling() {
      await this.pollApproval();
      this.pollInterval = setInterval(() => this.pollApproval(), 3000);
    }

    private async approveContext() {
      try {
        await MCPBridge.callTool(
          'workflow',
          'approve_context',
          {
            context_path: this.currentApproval?.context?.cats_path || '',
            approved: true
          }
        );

        EventBus.emit('user:approve:context', {
          context: this.currentApproval?.context,
          timestamp: Date.now(),
          approved: true
        });

        EventBus.emit('toast:success', {
          message: 'Context approved',
          duration: 3000
        });

        this.currentApproval = null;
        this.render();
      } catch (error) {
        console.error('[SentinelPanel] Failed to approve context:', error);
        EventBus.emit('toast:error', {
          message: `Approval failed: ${error.message}`,
          duration: 5000
        });
      }
    }

    private async reviseContext() {
      try {
        await MCPBridge.callTool(
          'workflow',
          'reject_context',
          {
            context_path: this.currentApproval?.context?.cats_path || '',
            reason: 'User requested revision'
          }
        );

        EventBus.emit('user:reject:context', {
          context: this.currentApproval?.context,
          timestamp: Date.now(),
          approved: false
        });

        EventBus.emit('toast:info', {
          message: 'Context revision requested',
          duration: 3000
        });

        this.currentApproval = null;
        this.render();
      } catch (error) {
        console.error('[SentinelPanel] Failed to revise context:', error);
        EventBus.emit('toast:error', {
          message: `Revision failed: ${error.message}`,
          duration: 5000
        });
      }
    }

    private async approveProposal() {
      try {
        await MCPBridge.callTool(
          'workflow',
          'approve_proposal',
          {
            dogs_path: this.currentApproval?.context?.dogs_path || '',
            approved: true
          }
        );

        EventBus.emit('user:approve:proposal', {
          proposalId: this.currentApproval?.context?.dogs_path,
          proposalData: this.currentApproval?.context,
          timestamp: Date.now(),
          approved: true
        });

        EventBus.emit('toast:success', {
          message: 'Proposal approved',
          duration: 3000
        });

        this.currentApproval = null;
        this.render();
      } catch (error) {
        console.error('[SentinelPanel] Failed to approve proposal:', error);
        EventBus.emit('toast:error', {
          message: `Approval failed: ${error.message}`,
          duration: 5000
        });
      }
    }

    private async reviseProposal() {
      try {
        await MCPBridge.callTool(
          'workflow',
          'reject_proposal',
          {
            dogs_path: this.currentApproval?.context?.dogs_path || '',
            reason: 'User requested revision'
          }
        );

        EventBus.emit('user:reject:proposal', {
          proposalId: this.currentApproval?.context?.dogs_path,
          proposalData: this.currentApproval?.context,
          timestamp: Date.now(),
          approved: false
        });

        EventBus.emit('toast:info', {
          message: 'Proposal revision requested',
          duration: 3000
        });

        this.currentApproval = null;
        this.render();
      } catch (error) {
        console.error('[SentinelPanel] Failed to revise proposal:', error);
        EventBus.emit('toast:error', {
          message: `Revision failed: ${error.message}`,
          duration: 5000
        });
      }
    }

    private toggleAutoApprove() {
      this.autoApproveEnabled = !this.autoApproveEnabled;

      // Persist setting
      try {
        localStorage.setItem('reploid_auto_approve', JSON.stringify(this.autoApproveEnabled));
      } catch (err) {
        console.warn('[SentinelPanel] Failed to persist auto-approve setting:', err);
      }

      EventBus.emit('toast:info', {
        message: `Auto-approve ${this.autoApproveEnabled ? 'enabled' : 'disabled'}`,
        duration: 3000
      });

      this.render();
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private renderContextApproval(): string {
      const context = this.currentApproval?.context;
      const contextContent = context?.cats_content || 'No context content available';
      const contextFileName = context?.cats_path?.split('/').pop() || 'unknown';

      return `
        <div class="sentinel-approval-header">
          <h4>Review Context (${this.escapeHtml(contextFileName)})</h4>
          <span class="sentinel-badge">Awaiting Approval</span>
        </div>
        <div class="sentinel-approval-content">
          <p class="sentinel-info">Agent wants to read the following files:</p>
          <pre class="sentinel-content">${this.escapeHtml(contextContent)}</pre>
          <div class="approval-actions">
            <button id="approve-context-btn" class="btn-approve">✓ Approve</button>
            <button id="revise-context-btn" class="btn-revise">⟲ Revise</button>
          </div>
        </div>
      `;
    }

    private renderProposalApproval(): string {
      const context = this.currentApproval?.context;
      const dogsContent = context?.dogs_content || 'No proposal content available';

      return `
        <div class="sentinel-approval-header">
          <h4>Review Proposal (dogs.md)</h4>
          <span class="sentinel-badge">Awaiting Approval</span>
        </div>
        <div class="sentinel-approval-content">
          <p class="sentinel-info">Agent proposes the following changes:</p>
          <pre class="sentinel-content">${this.escapeHtml(dogsContent)}</pre>
          <div class="approval-actions">
            <button id="approve-proposal-btn" class="btn-approve">✓ Approve</button>
            <button id="revise-proposal-btn" class="btn-revise">⟲ Revise</button>
          </div>
        </div>
      `;
    }

    private renderIdle(): string {
      return `
        <div class="sentinel-idle">
          <div class="sentinel-idle-icon">✓</div>
          <p>No pending approvals</p>
          <p class="sentinel-idle-subtext">Sentinel is monitoring agent actions</p>
        </div>
      `;
    }

    private renderDefault(): string {
      return `
        <div class="sentinel-status">
          <div class="sentinel-status-header">
            <h4>Sentinel Status</h4>
            <span class="sentinel-badge">${this.currentState}</span>
          </div>
          <p>Agent is currently: ${this.currentState.replace(/_/g, ' ').toLowerCase()}</p>
        </div>
      `;
    }

    private render() {
      if (!this.shadowRoot) return;

      let contentHtml = '';

      if (this.currentApproval) {
        if (this.currentState === 'AWAITING_CONTEXT_APPROVAL') {
          contentHtml = this.renderContextApproval();
        } else if (this.currentState === 'AWAITING_PROPOSAL_APPROVAL') {
          contentHtml = this.renderProposalApproval();
        }
      } else if (this.currentState === 'IDLE') {
        contentHtml = this.renderIdle();
      } else {
        contentHtml = this.renderDefault();
      }

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            height: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
          }

          .sentinel-panel-container {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .sentinel-panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.75rem 1rem;
            background: #222;
            border-bottom: 1px solid #333;
          }

          .sentinel-panel-header h4 {
            margin: 0;
            font-size: 0.875rem;
            font-weight: 600;
            color: #e0e0e0;
          }

          .sentinel-controls {
            display: flex;
            gap: 0.5rem;
          }

          .btn-secondary {
            padding: 0.375rem 0.75rem;
            background: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 4px;
            color: rgba(255, 255, 255, 0.9);
            cursor: pointer;
            font-size: 0.75rem;
            transition: all 0.2s;
          }

          .btn-secondary:hover {
            background: rgba(255, 255, 255, 0.2);
            border-color: rgba(255, 255, 255, 0.3);
          }

          .btn-secondary.active {
            background: rgba(76, 175, 80, 0.2);
            border-color: rgba(76, 175, 80, 0.4);
            color: rgba(76, 175, 80, 0.9);
          }

          .sentinel-panel-content {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
          }

          .sentinel-approval-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1rem;
          }

          .sentinel-approval-header h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: #e0e0e0;
          }

          .sentinel-badge {
            padding: 0.25rem 0.75rem;
            background: rgba(255, 165, 0, 0.2);
            border: 1px solid rgba(255, 165, 0, 0.4);
            border-radius: 12px;
            font-size: 0.688rem;
            font-weight: 600;
            color: rgba(255, 165, 0, 0.9);
            text-transform: uppercase;
          }

          .sentinel-approval-content {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .sentinel-info {
            margin: 0;
            color: #999;
            font-size: 0.813rem;
          }

          .sentinel-content {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
            border-left: 3px solid #4dabf7;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            line-height: 1.6;
            color: #e0e0e0;
            max-height: 400px;
            overflow-y: auto;
            white-space: pre-wrap;
            word-break: break-word;
            margin: 0;
          }

          .approval-actions {
            display: flex;
            gap: 0.75rem;
            margin-top: 0.5rem;
          }

          .btn-approve {
            padding: 0.5rem 1rem;
            background: #4CAF50;
            border: none;
            border-radius: 4px;
            color: white;
            cursor: pointer;
            font-size: 0.813rem;
            font-weight: 600;
            transition: all 0.2s;
          }

          .btn-approve:hover {
            background: #45a049;
            box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
          }

          .btn-revise {
            padding: 0.5rem 1rem;
            background: rgba(255, 152, 0, 0.2);
            border: 1px solid rgba(255, 152, 0, 0.4);
            border-radius: 4px;
            color: rgba(255, 152, 0, 0.9);
            cursor: pointer;
            font-size: 0.813rem;
            font-weight: 600;
            transition: all 0.2s;
          }

          .btn-revise:hover {
            background: rgba(255, 152, 0, 0.3);
            border-color: rgba(255, 152, 0, 0.6);
          }

          .sentinel-idle {
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 3rem 1.5rem;
            text-align: center;
          }

          .sentinel-idle-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
            opacity: 0.7;
          }

          .sentinel-idle p {
            margin: 0.25rem 0;
            color: #e0e0e0;
            font-size: 0.875rem;
          }

          .sentinel-idle-subtext {
            color: #666;
            font-size: 0.75rem;
          }

          .sentinel-status {
            padding: 1rem;
          }

          .sentinel-status-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.75rem;
          }

          .sentinel-status-header h4 {
            margin: 0;
            font-size: 0.875rem;
            font-weight: 600;
            color: #e0e0e0;
          }

          .sentinel-status p {
            margin: 0;
            color: #999;
            font-size: 0.813rem;
          }
        </style>

        <div class="sentinel-panel-container">
          <div class="sentinel-panel-header">
            <h4>Sentinel Control</h4>
            <div class="sentinel-controls">
              <button
                id="toggle-auto-approve-btn"
                class="btn-secondary ${this.autoApproveEnabled ? 'active' : ''}"
                title="${this.autoApproveEnabled ? 'Disable' : 'Enable'} Auto-Approve"
              >
                ${this.autoApproveEnabled ? '🔓' : '🔒'} Auto-Approve
              </button>
            </div>
          </div>

          <div class="sentinel-panel-content">
            ${contentHtml}
          </div>
        </div>
      `;

      // Attach event handlers
      const toggleBtn = this.shadowRoot.querySelector('#toggle-auto-approve-btn');
      toggleBtn?.addEventListener('click', () => this.toggleAutoApprove());

      const approveContextBtn = this.shadowRoot.querySelector('#approve-context-btn');
      approveContextBtn?.addEventListener('click', () => this.approveContext());

      const reviseContextBtn = this.shadowRoot.querySelector('#revise-context-btn');
      reviseContextBtn?.addEventListener('click', () => this.reviseContext());

      const approveProposalBtn = this.shadowRoot.querySelector('#approve-proposal-btn');
      approveProposalBtn?.addEventListener('click', () => this.approveProposal());

      const reviseProposalBtn = this.shadowRoot.querySelector('#revise-proposal-btn');
      reviseProposalBtn?.addEventListener('click', () => this.reviseProposal());
    }
  }

  customElements.define('reploid-sentinel-panel', SentinelPanelWidget);

  return {
    factory: () => {
      return new SentinelPanelWidget();
    }
  };
}
