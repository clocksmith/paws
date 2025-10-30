/**
 * Reploid Diff Viewer Widget
 *
 * Shows code changes with syntax highlighting and approval controls
 * Side-by-side diff viewer with per-file approval
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockDiffData: any;
if (USE_MOCK_DATA) {
  mockDiffData = {
    "task_id": "task_123",
    "proposal": {
      "changes": [
        {
          "file": "src/auth/login.js",
          "type": "modify",
          "old_content": "function login(user, pass) {\n  return authenticateUser(user, pass);\n}",
          "new_content": "function login(user, pass) {\n  // Add validation\n  if (!user || !pass) throw new Error('Missing credentials');\n  return authenticateUser(user, pass);\n}",
          "approved": false
        },
        {
          "file": "src/auth/session.js",
          "type": "create",
          "old_content": "",
          "new_content": "function createSession(userId) {\n  return { id: generateId(), userId, created: Date.now() };\n}",
          "approved": false
        },
        {
          "file": "tests/auth.test.js",
          "type": "modify",
          "old_content": "test('login validates input', () => {\n  expect(() => login()).toThrow('Missing credentials');\n});",
          "new_content": "test('login validates input', () => {\n  expect(() => login()).toThrow('Missing credentials');\n});\n\ntest('creates session', () => {\n  const session = createSession('user123');\n  expect(session.userId).toBe('user123');\n});",
          "approved": false
        }
      ]
    }
  };
}

export default function createDiffViewerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class DiffViewerWidget extends HTMLElement {
    private currentDiff: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to SentinelFSM diff events
      const unsubShowDiff = EventBus.on('diff:show', (data: any) => {
        this.showDiff(data);
      });
      this.unsubscribers.push(unsubShowDiff);

      // Initial render with mock data in dev mode
      if (USE_MOCK_DATA) {
        this.currentDiff = mockDiffData;
        this.render();
      } else {
        this.render();
      }
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async showDiff(data: any) {
      if (USE_MOCK_DATA) {
        this.currentDiff = mockDiffData;
        this.render();
        return;
      }

      try {
        // Load diff from MCP server
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_proposal_diff',
          { task_id: data.task_id }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.currentDiff = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load diff:', error);
        this.showError('Failed to load diff');
      }
    }

    private toggleFileApproval(index: number) {
      if (this.currentDiff && this.currentDiff.proposal.changes[index]) {
        this.currentDiff.proposal.changes[index].approved =
          !this.currentDiff.proposal.changes[index].approved;
        this.updateApprovalStats();
      }
    }

    private approveAll() {
      if (this.currentDiff) {
        this.currentDiff.proposal.changes.forEach((change: any) => {
          change.approved = true;
        });
        this.render();
      }
    }

    private rejectAll() {
      if (this.currentDiff) {
        this.currentDiff.proposal.changes.forEach((change: any) => {
          change.approved = false;
        });
        this.render();
      }
    }

    private toggleExpand(index: number) {
      const content = this.shadowRoot?.getElementById(`diff-content-${index}`);
      if (content) {
        content.style.display = content.style.display === 'none' ? 'block' : 'none';
      }
    }

    private async applyApproved() {
      if (!this.currentDiff) return;

      const approved = this.currentDiff.proposal.changes.filter((c: any) => c.approved);
      if (approved.length === 0) {
        alert('No changes approved');
        return;
      }

      if (USE_MOCK_DATA) {
        console.log('MOCK: Applying approved changes:', approved);
        alert(`Applied ${approved.length} changes! (Mock mode)`);
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'apply_changes',
          {
            task_id: this.currentDiff.task_id,
            changes: approved
          }
        );

        EventBus.emit('reploid:changes:applied', {
          task_id: this.currentDiff.task_id,
          count: approved.length
        });
      } catch (error) {
        console.error('Failed to apply changes:', error);
        this.showError('Failed to apply changes');
      }
    }

    private updateApprovalStats() {
      if (!this.currentDiff) return;

      const approved = this.currentDiff.proposal.changes.filter((c: any) => c.approved).length;
      const total = this.currentDiff.proposal.changes.length;

      const applyBtn = this.shadowRoot?.querySelector('.btn-apply') as HTMLButtonElement;
      if (applyBtn) {
        applyBtn.textContent = `Apply ${approved}/${total} Changes`;
        applyBtn.disabled = approved === 0;
      }

      // Re-render checkboxes
      this.currentDiff.proposal.changes.forEach((change: any, index: number) => {
        const checkbox = this.shadowRoot?.querySelector(`#approve-${index}`) as HTMLInputElement;
        if (checkbox) {
          checkbox.checked = change.approved;
        }
      });
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

      if (!this.currentDiff) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="diff-viewer-empty">
            <div class="empty-icon">📄</div>
            <div class="empty-text">No diff to display</div>
            <div class="empty-subtext">Waiting for proposal...</div>
          </div>
        `;
        return;
      }

      const changes = this.currentDiff.proposal.changes;
      const stats = this.calculateStats(changes);

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="diff-viewer">
          <div class="diff-header">
            <h3>Review Code Changes</h3>
            <div class="diff-stats">
              <span class="stat-create">+${stats.create} new</span>
              <span class="stat-modify">~${stats.modify} modified</span>
              <span class="stat-delete">-${stats.delete} deleted</span>
            </div>
          </div>

          <div class="diff-actions">
            <button class="btn-approve-all">✓ Approve All</button>
            <button class="btn-reject-all">✗ Reject All</button>
          </div>

          <div class="diff-files">
            ${changes.map((change: any, index: number) => this.renderFileChange(change, index)).join('')}
          </div>

          <div class="diff-footer">
            <button class="btn-apply">Apply 0/${changes.length} Changes</button>
            <button class="btn-cancel">Cancel</button>
          </div>
        </div>
      `;

      // Attach event listeners
      this.shadowRoot.querySelector('.btn-approve-all')?.addEventListener('click', () => {
        this.approveAll();
      });

      this.shadowRoot.querySelector('.btn-reject-all')?.addEventListener('click', () => {
        this.rejectAll();
      });

      this.shadowRoot.querySelector('.btn-apply')?.addEventListener('click', () => {
        this.applyApproved();
      });

      this.shadowRoot.querySelector('.btn-cancel')?.addEventListener('click', () => {
        this.currentDiff = null;
        this.render();
      });

      // Attach file-specific listeners
      changes.forEach((_: any, index: number) => {
        this.shadowRoot?.querySelector(`#approve-${index}`)?.addEventListener('change', () => {
          this.toggleFileApproval(index);
        });

        this.shadowRoot?.querySelector(`#expand-${index}`)?.addEventListener('click', () => {
          this.toggleExpand(index);
        });
      });

      this.updateApprovalStats();
    }

    private calculateStats(changes: any[]) {
      const stats = { create: 0, modify: 0, delete: 0 };
      changes.forEach(change => {
        if (change.type === 'create') stats.create++;
        else if (change.type === 'modify') stats.modify++;
        else if (change.type === 'delete') stats.delete++;
      });
      return stats;
    }

    private renderFileChange(change: any, index: number) {
      const icon = {
        create: '⊕',
        modify: '✏️',
        delete: '⛶️'
      }[change.type] || '📄';

      const operationClass = change.type;
      const lines = this.calculateLineChanges(change);

      return `
        <div class="diff-file diff-file-${operationClass}">
          <div class="diff-file-header">
            <div class="diff-file-info">
              <span class="diff-icon">${icon}</span>
              <span class="diff-path">${this.escapeHtml(change.file)}</span>
              <span class="diff-operation ${operationClass}">${change.type.toUpperCase()}</span>
              ${lines.html}
            </div>
            <div class="diff-file-actions">
              <label class="checkbox-wrapper">
                <input type="checkbox" id="approve-${index}" ${change.approved ? 'checked' : ''}>
                <span>Approve</span>
              </label>
              <button id="expand-${index}" class="btn-expand">Expand</button>
            </div>
          </div>
          <div class="diff-file-content" id="diff-content-${index}" style="display: none;">
            ${this.renderDiffContent(change)}
          </div>
        </div>
      `;
    }

    private calculateLineChanges(change: any) {
      if (change.type === 'create') {
        const lines = (change.new_content || '').split('\n').length;
        return { added: lines, removed: 0, html: `<span class="line-stats add">+${lines}</span>` };
      } else if (change.type === 'delete') {
        const lines = (change.old_content || '').split('\n').length;
        return { added: 0, removed: lines, html: `<span class="line-stats remove">-${lines}</span>` };
      } else {
        const oldLines = (change.old_content || '').split('\n');
        const newLines = (change.new_content || '').split('\n');
        const added = newLines.length - oldLines.length;
        if (added > 0) {
          return { added, removed: 0, html: `<span class="line-stats add">+${added}</span>` };
        } else if (added < 0) {
          return { added: 0, removed: -added, html: `<span class="line-stats remove">${added}</span>` };
        }
        return { added: 0, removed: 0, html: `<span class="line-stats">~modified</span>` };
      }
    }

    private renderDiffContent(change: any) {
      if (change.type === 'create') {
        return `
          <div class="diff-create">
            <pre class="code-block">${this.escapeHtml(change.new_content)}</pre>
          </div>
        `;
      } else if (change.type === 'delete') {
        return `
          <div class="diff-delete">
            <pre class="code-block">${this.escapeHtml(change.old_content)}</pre>
          </div>
        `;
      } else {
        return this.renderSideBySideDiff(change.old_content, change.new_content);
      }
    }

    private renderSideBySideDiff(oldContent: string, newContent: string) {
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      const maxLines = Math.max(oldLines.length, newLines.length);

      let html = '<div class="side-by-side-diff">';
      html += '<div class="diff-pane diff-old"><div class="diff-pane-header">Original</div>';

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];
        let lineClass = '';

        if (oldLine === undefined) {
          lineClass = 'empty';
        } else if (newLine === undefined) {
          lineClass = 'removed';
        } else if (oldLine !== newLine) {
          lineClass = 'changed';
        }

        if (oldLine !== undefined) {
          html += `<div class="diff-line ${lineClass}">`;
          html += `<span class="line-number">${i + 1}</span>`;
          html += `<span class="line-content">${this.escapeHtml(oldLine)}</span>`;
          html += '</div>';
        } else {
          html += '<div class="diff-line empty"><span class="line-number"></span><span class="line-content">&nbsp;</span></div>';
        }
      }

      html += '</div>';
      html += '<div class="diff-pane diff-new"><div class="diff-pane-header">Modified</div>';

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];
        let lineClass = '';

        if (newLine === undefined) {
          lineClass = 'empty';
        } else if (oldLine === undefined) {
          lineClass = 'added';
        } else if (oldLine !== newLine) {
          lineClass = 'changed';
        }

        if (newLine !== undefined) {
          html += `<div class="diff-line ${lineClass}">`;
          html += `<span class="line-number">${i + 1}</span>`;
          html += `<span class="line-content">${this.escapeHtml(newLine)}</span>`;
          html += '</div>';
        } else {
          html += '<div class="diff-line empty"><span class="line-number"></span><span class="line-content">&nbsp;</span></div>';
        }
      }

      html += '</div></div>';
      return html;
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

        .diff-viewer-empty {
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
          margin-bottom: 8px;
        }

        .empty-subtext {
          font-size: 14px;
          color: #666;
        }

        .diff-viewer {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
        }

        .diff-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
        }

        .diff-header h3 {
          margin: 0 0 8px 0;
          color: #4ec9b0;
          font-size: 16px;
          font-weight: bold;
        }

        .diff-stats {
          display: flex;
          gap: 16px;
          font-size: 13px;
        }

        .stat-create { color: #4ec9b0; }
        .stat-modify { color: #ffd700; }
        .stat-delete { color: #f48771; }

        .diff-actions {
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
          display: flex;
          gap: 8px;
        }

        .diff-actions button {
          padding: 6px 16px;
          background: rgba(78, 201, 176, 0.2);
          border: 1px solid rgba(78, 201, 176, 0.4);
          color: #4ec9b0;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          transition: all 0.2s;
        }

        .diff-actions button:hover {
          background: rgba(78, 201, 176, 0.3);
        }

        .btn-reject-all {
          background: rgba(244, 135, 113, 0.2) !important;
          border-color: rgba(244, 135, 113, 0.4) !important;
          color: #f48771 !important;
        }

        .diff-files {
          max-height: 600px;
          overflow-y: auto;
        }

        .diff-file {
          border-bottom: 1px solid #333;
        }

        .diff-file.create { border-left: 3px solid #4ec9b0; }
        .diff-file.modify { border-left: 3px solid #ffd700; }
        .diff-file.delete { border-left: 3px solid #f48771; }

        .diff-file-header {
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.8);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .diff-file-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .diff-icon {
          font-size: 18px;
        }

        .diff-path {
          color: #4ec9b0;
          font-weight: 500;
        }

        .diff-operation {
          padding: 2px 8px;
          border-radius: 0;
          font-size: 11px;
          font-weight: bold;
        }

        .diff-operation.create { background: #4ec9b0; color: #000; }
        .diff-operation.modify { background: #ffd700; color: #000; }
        .diff-operation.delete { background: #f48771; color: #000; }

        .line-stats {
          font-size: 12px;
          color: #888;
        }

        .line-stats.add { color: #4ec9b0; }
        .line-stats.remove { color: #f48771; }

        .diff-file-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
        }

        .btn-expand {
          padding: 4px 12px;
          background: transparent;
          border: 1px solid #555;
          color: #d4d4d4;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }

        .diff-file-content {
          padding: 16px;
          background: #1e1e1e;
          border-top: 1px solid #333;
        }

        .code-block {
          margin: 0;
          padding: 16px;
          background: #1e1e1e;
          color: #d4d4d4;
          overflow-x: auto;
          font-size: 13px;
          line-height: 1.5;
          border: 1px solid #333;
        }

        .side-by-side-diff {
          display: flex;
          gap: 2px;
        }

        .diff-pane {
          flex: 1;
          overflow-x: auto;
        }

        .diff-pane-header {
          background: #333;
          padding: 8px;
          text-align: center;
          font-weight: bold;
          font-size: 12px;
        }

        .diff-line {
          display: flex;
          font-size: 13px;
          line-height: 1.5;
        }

        .diff-line.changed {
          background: rgba(255, 215, 0, 0.1);
        }

        .diff-line.added {
          background: rgba(78, 201, 176, 0.1);
        }

        .diff-line.removed {
          background: rgba(244, 135, 113, 0.1);
        }

        .diff-line.empty {
          background: #252526;
        }

        .line-number {
          background: #252526;
          color: #858585;
          padding: 0 8px;
          text-align: right;
          width: 50px;
          user-select: none;
        }

        .line-content {
          flex: 1;
          padding: 0 8px;
          white-space: pre;
        }

        .diff-footer {
          padding: 16px;
          background: rgba(20, 20, 20, 0.8);
          border-top: 2px solid #333;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        .diff-footer button {
          padding: 10px 20px;
          font-family: 'Courier New', monospace;
          font-size: 14px;
          font-weight: bold;
          border: none;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-apply {
          background: #4ec9b0;
          color: #000;
        }

        .btn-apply:hover {
          background: #6ee7ce;
        }

        .btn-apply:disabled {
          background: #555;
          color: #888;
          cursor: not-allowed;
        }

        .btn-cancel {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: #e0e0e0;
        }

        .btn-cancel:hover {
          background: rgba(255, 255, 255, 0.2);
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
  if (!customElements.get('reploid-diff-viewer')) {
    customElements.define('reploid-diff-viewer', DiffViewerWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[DiffViewerWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-diff-viewer',
          displayName: 'Reploid Diff Viewer'
        });
      },
      async destroy() {
        console.log('[DiffViewerWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-diff-viewer',
          displayName: 'Reploid Diff Viewer'
        });
      },
      async refresh() {
        console.log('[DiffViewerWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-diff-viewer',
          displayName: 'Reploid Diff Viewer'
        });
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-diff-viewer',
      displayName: 'Reploid Diff Viewer',
      description: 'View and approve code changes with syntax highlighting',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_proposal_diff', 'apply_changes']
      },
      category: 'data-visualization',
      tags: ['reploid', 'diff', 'code-review']
    }
  };
}
