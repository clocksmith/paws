/**
 * Reploid Reflection & Insights Widget
 *
 * View insights, lessons learned, and failure analysis
 * Timeline view with filtering and search capabilities
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockReflections: any;
if (USE_MOCK_DATA) {
  mockReflections = {
    reflections: [
      {
        id: 'r1',
        timestamp: '2025-10-30T14:30:00Z',
        type: 'lesson',
        title: 'Token budget optimization',
        content: 'Learned that aggressive context truncation saves tokens but may lose important context. Need balance.',
        tags: ['optimization', 'context', 'tokens'],
        severity: 'info'
      },
      {
        id: 'r2',
        timestamp: '2025-10-30T13:15:00Z',
        type: 'failure',
        title: 'Tool execution timeout',
        content: 'Meta-tool-creator timed out when generating complex schemas. Need to add timeout handling.',
        tags: ['tools', 'timeout', 'error'],
        severity: 'high'
      },
      {
        id: 'r3',
        timestamp: '2025-10-30T12:00:00Z',
        type: 'insight',
        title: 'MCP bridge performance',
        content: 'Parallel tool calls significantly improved dashboard load time. Should batch more operations.',
        tags: ['performance', 'mcp', 'optimization'],
        severity: 'medium'
      }
    ]
  };
}

export default function createReflectionWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class ReflectionWidget extends HTMLElement {
    private reflections: any[] = [];
    private filteredReflections: any[] = [];
    private currentFilter: string = 'all';
    private searchTerm: string = '';
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to reflection events
      const unsubRefresh = EventBus.on('reploid:reflection:refresh', () => {
        this.loadReflections();
      });
      this.unsubscribers.push(unsubRefresh);

      const unsubNew = EventBus.on('reploid:reflection:new', () => {
        this.loadReflections();
      });
      this.unsubscribers.push(unsubNew);

      // Initial load
      this.loadReflections();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadReflections() {
      if (USE_MOCK_DATA) {
        this.reflections = mockReflections.reflections;
        this.applyFilters();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_recent_reflections',
          { limit: 50 }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.reflections = data.reflections || [];
          this.applyFilters();
        }
      } catch (error) {
        console.error('Failed to load reflections:', error);
        this.showError('Failed to load reflections');
      }
    }

    private async queryInsights(query: string) {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Querying insights:', query);
        this.showSuccess('Query executed (mock mode)');
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'query_insights',
          { query }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.reflections = data.results || [];
          this.applyFilters();
        }
      } catch (error) {
        console.error('Failed to query insights:', error);
        this.showError('Failed to query insights');
      }
    }

    private async analyzeFail(failureId: string) {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Analyzing failure:', failureId);
        alert(`Analysis for failure ${failureId}\n\n(Mock mode)`);
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'analyze_failures',
          { failure_ids: [failureId] }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const analysis = JSON.parse(result.content[0].text);
          this.showAnalysisModal(analysis);
        }
      } catch (error) {
        console.error('Failed to analyze failure:', error);
        this.showError('Failed to analyze failure');
      }
    }

    private applyFilters() {
      let filtered = [...this.reflections];

      // Apply type filter
      if (this.currentFilter !== 'all') {
        filtered = filtered.filter(r => r.type === this.currentFilter);
      }

      // Apply search filter
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter(r =>
          r.title.toLowerCase().includes(term) ||
          r.content.toLowerCase().includes(term) ||
          r.tags.some((tag: string) => tag.toLowerCase().includes(term))
        );
      }

      // Sort by timestamp (newest first)
      filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      this.filteredReflections = filtered;
      this.render();
    }

    private setFilter(filter: string) {
      this.currentFilter = filter;
      this.applyFilters();
    }

    private setSearch(searchTerm: string) {
      this.searchTerm = searchTerm;
      this.applyFilters();
    }

    private showAnalysisModal(analysis: any) {
      const modal = document.createElement('div');
      modal.className = 'analysis-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Failure Analysis</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <pre>${this.escapeHtml(JSON.stringify(analysis, null, 2))}</pre>
          </div>
        </div>
      `;

      modal.querySelector('.modal-close')?.addEventListener('click', () => {
        modal.remove();
      });

      this.shadowRoot?.appendChild(modal);
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

      const stats = {
        total: this.reflections.length,
        lessons: this.reflections.filter(r => r.type === 'lesson').length,
        failures: this.reflections.filter(r => r.type === 'failure').length,
        insights: this.reflections.filter(r => r.type === 'insight').length
      };

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="reflection-widget">
          <div class="reflection-header">
            <h3>💡 Reflections & Insights</h3>
            <div class="stats">
              <span class="stat-item">Total: ${stats.total}</span>
              <span class="stat-item">Lessons: ${stats.lessons}</span>
              <span class="stat-item">Failures: ${stats.failures}</span>
              <span class="stat-item">Insights: ${stats.insights}</span>
            </div>
          </div>

          <div class="reflection-toolbar">
            <div class="filter-group">
              <button class="filter-btn ${this.currentFilter === 'all' ? 'active' : ''}" data-filter="all">
                All (${stats.total})
              </button>
              <button class="filter-btn ${this.currentFilter === 'lesson' ? 'active' : ''}" data-filter="lesson">
                📚 Lessons (${stats.lessons})
              </button>
              <button class="filter-btn ${this.currentFilter === 'failure' ? 'active' : ''}" data-filter="failure">
                ❌ Failures (${stats.failures})
              </button>
              <button class="filter-btn ${this.currentFilter === 'insight' ? 'active' : ''}" data-filter="insight">
                💡 Insights (${stats.insights})
              </button>
            </div>
            <input type="text" class="search-input" placeholder="🔍 Search reflections..." value="${this.searchTerm}">
            <button class="btn-refresh">⟳</button>
          </div>

          <div class="reflection-content">
            ${this.filteredReflections.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">📭</div>
                <div class="empty-text">
                  ${this.searchTerm || this.currentFilter !== 'all' ? 'No reflections match your filters' : 'No reflections available'}
                </div>
              </div>
            ` : `
              <div class="reflections-list">
                ${this.filteredReflections.map(r => this.renderReflection(r)).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private renderReflection(reflection: any): string {
      const icon = {
        lesson: '📚',
        failure: '❌',
        insight: '💡'
      }[reflection.type] || '📝';

      const severityClass = `severity-${reflection.severity || 'info'}`;
      const timestamp = new Date(reflection.timestamp).toLocaleString();

      return `
        <div class="reflection-card ${severityClass}" data-id="${reflection.id}">
          <div class="card-header">
            <div class="card-type">
              <span class="type-icon">${icon}</span>
              <span class="type-label">${reflection.type}</span>
            </div>
            <div class="card-timestamp">${timestamp}</div>
          </div>

          <div class="card-title">${this.escapeHtml(reflection.title)}</div>

          <div class="card-content">${this.escapeHtml(reflection.content)}</div>

          <div class="card-footer">
            <div class="card-tags">
              ${reflection.tags.map((tag: string) => `
                <span class="tag">#${this.escapeHtml(tag)}</span>
              `).join('')}
            </div>
            ${reflection.type === 'failure' ? `
              <button class="btn-analyze" data-id="${reflection.id}">🔍 Analyze</button>
            ` : ''}
          </div>
        </div>
      `;
    }

    private attachEventListeners() {
      // Filter buttons
      const filterBtns = this.shadowRoot?.querySelectorAll('.filter-btn');
      filterBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
          const filter = (btn as HTMLElement).dataset.filter;
          if (filter) this.setFilter(filter);
        });
      });

      // Search input
      this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', (e) => {
        const searchTerm = (e.target as HTMLInputElement).value;
        this.setSearch(searchTerm);
      });

      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadReflections();
      });

      // Analyze buttons
      const analyzeBtns = this.shadowRoot?.querySelectorAll('.btn-analyze');
      analyzeBtns?.forEach(btn => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id;
          if (id) this.analyzeFail(id);
        });
      });
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

        .reflection-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .reflection-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
        }

        .reflection-header h3 {
          margin: 0 0 8px 0;
          color: #dcdcaa;
          font-size: 16px;
          font-weight: bold;
        }

        .stats {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: #888;
        }

        .stat-item {
          padding: 4px 8px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #444;
        }

        .reflection-toolbar {
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .filter-group {
          display: flex;
          gap: 4px;
        }

        .filter-btn {
          padding: 6px 12px;
          background: rgba(220, 220, 170, 0.1);
          border: 1px solid rgba(220, 220, 170, 0.3);
          color: #dcdcaa;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          transition: all 0.2s;
        }

        .filter-btn:hover {
          background: rgba(220, 220, 170, 0.2);
        }

        .filter-btn.active {
          background: rgba(220, 220, 170, 0.3);
          border-color: #dcdcaa;
          font-weight: bold;
        }

        .search-input {
          flex: 1;
          padding: 6px 12px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #555;
          color: #e0e0e0;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .search-input:focus {
          outline: none;
          border-color: #dcdcaa;
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(220, 220, 170, 0.2);
          border: 1px solid rgba(220, 220, 170, 0.4);
          color: #dcdcaa;
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }

        .btn-refresh:hover {
          background: rgba(220, 220, 170, 0.3);
        }

        .reflection-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 16px;
          color: #888;
        }

        .reflections-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .reflection-card {
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #444;
          border-left: 4px solid #dcdcaa;
          padding: 16px;
          transition: all 0.2s;
        }

        .reflection-card:hover {
          background: rgba(40, 40, 40, 0.8);
          border-left-width: 6px;
        }

        .reflection-card.severity-high {
          border-left-color: #f48771;
        }

        .reflection-card.severity-medium {
          border-left-color: #ce9178;
        }

        .reflection-card.severity-info {
          border-left-color: #4fc1ff;
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }

        .card-type {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .type-icon {
          font-size: 16px;
        }

        .type-label {
          font-size: 11px;
          color: #888;
          text-transform: uppercase;
        }

        .card-timestamp {
          font-size: 10px;
          color: #666;
        }

        .card-title {
          font-size: 14px;
          font-weight: bold;
          color: #dcdcaa;
          margin-bottom: 8px;
        }

        .card-content {
          font-size: 12px;
          color: #cccccc;
          line-height: 1.5;
          margin-bottom: 12px;
        }

        .card-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .card-tags {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .tag {
          padding: 2px 8px;
          background: rgba(86, 156, 214, 0.2);
          border: 1px solid rgba(86, 156, 214, 0.4);
          color: #569cd6;
          font-size: 10px;
        }

        .btn-analyze {
          padding: 4px 10px;
          background: rgba(244, 135, 113, 0.2);
          border: 1px solid rgba(244, 135, 113, 0.4);
          color: #f48771;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          transition: all 0.2s;
        }

        .btn-analyze:hover {
          background: rgba(244, 135, 113, 0.3);
        }

        .analysis-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .modal-content {
          background: #1e1e1e;
          border: 2px solid #444;
          width: 80%;
          max-width: 800px;
          max-height: 80%;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          padding: 16px;
          background: #252526;
          border-bottom: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          color: #dcdcaa;
        }

        .modal-close {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
        }

        .modal-close:hover {
          color: #fff;
        }

        .modal-body {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
        }

        .modal-body pre {
          margin: 0;
          color: #cccccc;
          font-size: 12px;
          line-height: 1.5;
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
  if (!customElements.get('reploid-reflection')) {
    customElements.define('reploid-reflection', ReflectionWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[ReflectionWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-reflection',
          displayName: 'Reflections & Insights'
        });
      },
      async destroy() {
        console.log('[ReflectionWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-reflection',
          displayName: 'Reflections & Insights'
        });
      },
      async refresh() {
        console.log('[ReflectionWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-reflection',
          displayName: 'Reflections & Insights'
        });
        EventBus.emit('reploid:reflection:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-reflection',
      displayName: 'Reflections & Insights',
      description: 'View insights, lessons learned, and failure analysis',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_recent_reflections', 'query_insights', 'get_lessons_learned', 'analyze_failures']
      },
      category: 'analytics',
      tags: ['reploid', 'reflections', 'insights', 'lessons', 'failures']
    }
  };
}
