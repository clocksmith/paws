/**
 * Reploid Context Manager Widget
 *
 * Token usage visualization and budget controls
 * Real-time context window monitoring with optimization tools
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockContextData: any;
if (USE_MOCK_DATA) {
  mockContextData = {
    current_tokens: 45230,
    budget: 100000,
    percentage: 45.23,
    history: [
      { timestamp: '14:00', tokens: 32000 },
      { timestamp: '14:15', tokens: 38500 },
      { timestamp: '14:30', tokens: 42000 },
      { timestamp: '14:45', tokens: 45230 }
    ],
    breakdown: {
      system_prompt: 8500,
      conversation: 28000,
      tool_results: 6230,
      code_context: 2500
    },
    optimization_suggestions: [
      'Truncate old conversation turns',
      'Remove stale tool results',
      'Compress code context'
    ]
  };
}

export default function createContextWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class ContextWidget extends HTMLElement {
    private contextData: any = null;
    private autoRefresh: boolean = true;
    private refreshInterval: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to context events
      const unsubRefresh = EventBus.on('reploid:context:refresh', () => {
        this.loadContext();
      });
      this.unsubscribers.push(unsubRefresh);

      const unsubUpdate = EventBus.on('reploid:context:updated', () => {
        this.loadContext();
      });
      this.unsubscribers.push(unsubUpdate);

      // Initial load
      this.loadContext();

      // Auto-refresh every 10 seconds
      this.startAutoRefresh();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
      this.stopAutoRefresh();
    }

    private startAutoRefresh() {
      if (this.autoRefresh && !this.refreshInterval) {
        this.refreshInterval = setInterval(() => {
          this.loadContext();
        }, 10000);
      }
    }

    private stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    private toggleAutoRefresh() {
      this.autoRefresh = !this.autoRefresh;
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
      this.render();
    }

    private async loadContext() {
      if (USE_MOCK_DATA) {
        this.contextData = mockContextData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_token_count',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.contextData = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load context:', error);
        this.showError('Failed to load context data');
      }
    }

    private async setBudget() {
      const newBudget = prompt('Enter new token budget:', String(this.contextData?.budget || 100000));
      if (!newBudget) return;

      const budget = parseInt(newBudget, 10);
      if (isNaN(budget) || budget < 1000) {
        this.showError('Invalid budget (minimum 1000)');
        return;
      }

      if (USE_MOCK_DATA) {
        this.contextData.budget = budget;
        this.contextData.percentage = (this.contextData.current_tokens / budget) * 100;
        this.showSuccess('Budget updated (mock mode)');
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'set_budget',
          { budget }
        );

        this.showSuccess('Token budget updated');
        EventBus.emit('reploid:context:updated', { budget });
        await this.loadContext();
      } catch (error) {
        console.error('Failed to set budget:', error);
        this.showError('Failed to update budget');
      }
    }

    private async optimizeContext() {
      if (!confirm('Optimize context by removing old data? This action cannot be undone.')) {
        return;
      }

      if (USE_MOCK_DATA) {
        this.contextData.current_tokens = Math.floor(this.contextData.current_tokens * 0.7);
        this.contextData.percentage = (this.contextData.current_tokens / this.contextData.budget) * 100;
        this.showSuccess('Context optimized (mock mode)');
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'optimize_context',
          { aggressive: false }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.showSuccess(`Context optimized: saved ${data.tokens_freed} tokens`);
          EventBus.emit('reploid:context:optimized', data);
          await this.loadContext();
        }
      } catch (error) {
        console.error('Failed to optimize context:', error);
        this.showError('Failed to optimize context');
      }
    }

    private async clearContext() {
      if (!confirm('Clear all context? This will reset the conversation.')) {
        return;
      }

      if (USE_MOCK_DATA) {
        this.contextData.current_tokens = 8500; // Just system prompt
        this.contextData.percentage = (this.contextData.current_tokens / this.contextData.budget) * 100;
        this.showSuccess('Context cleared (mock mode)');
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'clear_context',
          {}
        );

        this.showSuccess('Context cleared');
        EventBus.emit('reploid:context:cleared', {});
        await this.loadContext();
      } catch (error) {
        console.error('Failed to clear context:', error);
        this.showError('Failed to clear context');
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

      if (!this.contextData) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="context-empty">
            <div class="empty-icon">📊</div>
            <div class="empty-text">Loading context data...</div>
          </div>
        `;
        return;
      }

      const percentage = this.contextData.percentage || 0;
      const statusClass = percentage > 90 ? 'critical' : percentage > 75 ? 'warning' : 'normal';

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="context-widget">
          <div class="context-header">
            <h3>📊 Context Manager</h3>
            <div class="header-actions">
              <label class="auto-refresh-toggle">
                <input type="checkbox" ${this.autoRefresh ? 'checked' : ''}>
                <span>Auto-refresh</span>
              </label>
              <button class="btn-refresh">⟳</button>
            </div>
          </div>

          <div class="context-summary ${statusClass}">
            <div class="summary-main">
              <div class="current-tokens">${this.formatNumber(this.contextData.current_tokens)}</div>
              <div class="budget-tokens">/ ${this.formatNumber(this.contextData.budget)} tokens</div>
            </div>
            <div class="summary-percentage">
              ${percentage.toFixed(1)}% of budget
            </div>
          </div>

          <div class="progress-bar">
            <div class="progress-fill ${statusClass}" style="width: ${Math.min(percentage, 100)}%"></div>
          </div>

          <div class="context-content">
            <div class="section">
              <div class="section-title">Token Breakdown</div>
              <div class="breakdown-list">
                ${Object.entries(this.contextData.breakdown || {}).map(([key, value]) => `
                  <div class="breakdown-item">
                    <span class="breakdown-label">${this.formatLabel(key)}</span>
                    <span class="breakdown-bar">
                      <span class="breakdown-fill" style="width: ${((value as number) / this.contextData.current_tokens * 100)}%"></span>
                    </span>
                    <span class="breakdown-value">${this.formatNumber(value as number)}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            ${this.contextData.history && this.contextData.history.length > 0 ? `
              <div class="section">
                <div class="section-title">Usage History</div>
                <div class="history-chart">
                  ${this.renderHistoryChart()}
                </div>
              </div>
            ` : ''}

            ${this.contextData.optimization_suggestions && this.contextData.optimization_suggestions.length > 0 ? `
              <div class="section">
                <div class="section-title">💡 Optimization Suggestions</div>
                <div class="suggestions-list">
                  ${this.contextData.optimization_suggestions.map((suggestion: string) => `
                    <div class="suggestion-item">• ${this.escapeHtml(suggestion)}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>

          <div class="context-actions">
            <button class="btn-secondary btn-set-budget">💰 Set Budget</button>
            <button class="btn-secondary btn-optimize">⚡ Optimize</button>
            <button class="btn-danger btn-clear">🗑️ Clear Context</button>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private renderHistoryChart(): string {
      if (!this.contextData?.history) return '';

      const maxTokens = Math.max(...this.contextData.history.map((h: any) => h.tokens));
      const chartHeight = 100;

      return `
        <div class="chart-container">
          ${this.contextData.history.map((point: any, idx: number) => {
            const height = (point.tokens / maxTokens) * chartHeight;
            return `
              <div class="chart-point" title="${point.timestamp}: ${this.formatNumber(point.tokens)} tokens">
                <div class="chart-bar" style="height: ${height}px"></div>
                <div class="chart-label">${point.timestamp}</div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    private attachEventListeners() {
      // Auto-refresh toggle
      this.shadowRoot?.querySelector('.auto-refresh-toggle input')?.addEventListener('change', () => {
        this.toggleAutoRefresh();
      });

      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadContext();
      });

      // Set budget button
      this.shadowRoot?.querySelector('.btn-set-budget')?.addEventListener('click', () => {
        this.setBudget();
      });

      // Optimize button
      this.shadowRoot?.querySelector('.btn-optimize')?.addEventListener('click', () => {
        this.optimizeContext();
      });

      // Clear button
      this.shadowRoot?.querySelector('.btn-clear')?.addEventListener('click', () => {
        this.clearContext();
      });
    }

    private formatNumber(num: number): string {
      return num.toLocaleString();
    }

    private formatLabel(key: string): string {
      return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
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

        .context-empty {
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

        .context-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .context-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .context-header h3 {
          margin: 0;
          color: #4fc1ff;
          font-size: 16px;
          font-weight: bold;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: #888;
          cursor: pointer;
        }

        .auto-refresh-toggle input {
          cursor: pointer;
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(79, 193, 255, 0.2);
          border: 1px solid rgba(79, 193, 255, 0.4);
          color: #4fc1ff;
          cursor: pointer;
          font-size: 14px;
        }

        .context-summary {
          padding: 24px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 2px solid #333;
          text-align: center;
        }

        .context-summary.critical {
          background: rgba(244, 71, 71, 0.2);
          border-color: #f44747;
        }

        .context-summary.warning {
          background: rgba(255, 170, 0, 0.2);
          border-color: #ffaa00;
        }

        .summary-main {
          display: flex;
          justify-content: center;
          align-items: baseline;
          gap: 8px;
          margin-bottom: 8px;
        }

        .current-tokens {
          font-size: 32px;
          font-weight: bold;
          color: #4fc1ff;
        }

        .context-summary.warning .current-tokens {
          color: #ffaa00;
        }

        .context-summary.critical .current-tokens {
          color: #f44747;
        }

        .budget-tokens {
          font-size: 18px;
          color: #888;
        }

        .summary-percentage {
          font-size: 14px;
          color: #aaa;
        }

        .progress-bar {
          height: 8px;
          background: rgba(30, 30, 30, 0.8);
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: #4fc1ff;
          transition: width 0.3s ease;
        }

        .progress-fill.warning {
          background: #ffaa00;
        }

        .progress-fill.critical {
          background: #f44747;
        }

        .context-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .section {
          margin-bottom: 20px;
          background: rgba(30, 30, 30, 0.5);
          padding: 16px;
          border: 1px solid #444;
        }

        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #4fc1ff;
          margin-bottom: 12px;
          text-transform: uppercase;
        }

        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .breakdown-item {
          display: grid;
          grid-template-columns: 150px 1fr 80px;
          gap: 12px;
          align-items: center;
          font-size: 12px;
        }

        .breakdown-label {
          color: #9cdcfe;
        }

        .breakdown-bar {
          height: 20px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #555;
          position: relative;
          overflow: hidden;
        }

        .breakdown-fill {
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          background: #4fc1ff;
          transition: width 0.3s ease;
        }

        .breakdown-value {
          text-align: right;
          color: #aaa;
        }

        .history-chart {
          padding: 12px 0;
        }

        .chart-container {
          display: flex;
          gap: 8px;
          align-items: flex-end;
          height: 120px;
          padding: 0 8px;
        }

        .chart-point {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }

        .chart-bar {
          width: 100%;
          background: #4fc1ff;
          transition: height 0.3s ease;
          min-height: 4px;
        }

        .chart-label {
          font-size: 9px;
          color: #666;
          text-align: center;
        }

        .suggestions-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .suggestion-item {
          padding: 8px 12px;
          background: rgba(79, 193, 255, 0.1);
          border-left: 3px solid #4fc1ff;
          font-size: 12px;
          color: #cccccc;
        }

        .context-actions {
          padding: 16px;
          background: rgba(20, 20, 20, 0.8);
          border-top: 2px solid #333;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        button {
          padding: 8px 16px;
          border: none;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: rgba(79, 193, 255, 0.2);
          border: 1px solid rgba(79, 193, 255, 0.4);
          color: #4fc1ff;
        }

        .btn-secondary:hover {
          background: rgba(79, 193, 255, 0.3);
        }

        .btn-danger {
          background: rgba(244, 71, 71, 0.2);
          border: 1px solid rgba(244, 71, 71, 0.4);
          color: #f44747;
        }

        .btn-danger:hover {
          background: rgba(244, 71, 71, 0.3);
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
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

  // Register custom element
  if (!customElements.get('reploid-context')) {
    customElements.define('reploid-context', ContextWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[ContextWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-context',
          displayName: 'Context Manager'
        });
      },
      async destroy() {
        console.log('[ContextWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-context',
          displayName: 'Context Manager'
        });
      },
      async refresh() {
        console.log('[ContextWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-context',
          displayName: 'Context Manager'
        });
        EventBus.emit('reploid:context:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-context',
      displayName: 'Context Manager',
      description: 'Monitor token usage and manage context budget with optimization tools',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_token_count', 'get_budget', 'set_budget', 'optimize_context', 'clear_context']
      },
      category: 'monitoring',
      tags: ['reploid', 'context', 'tokens', 'budget', 'optimization']
    }
  };
}
