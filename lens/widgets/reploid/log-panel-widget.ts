/**
 * Reploid Log Panel Widget
 *
 * Advanced logging panel with multi-level support, filtering,
 * and real-time audit log display
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

let mockLogData: any;
if (USE_MOCK_DATA) {
  mockLogData = {
    "logs": [
      { "level": "INFO", "message": "Agent started successfully", "source": "SentinelFSM", "timestamp": Date.now() - 5000 },
      { "level": "INFO", "message": "Context curation initiated", "source": "ContextManager", "timestamp": Date.now() - 4000 },
      { "level": "WARN", "message": "Rate limit approaching threshold", "source": "RateLimiter", "timestamp": Date.now() - 3000 },
      { "level": "INFO", "message": "Files selected for context", "source": "ContextManager", "timestamp": Date.now() - 2000 },
      { "level": "ERROR", "message": "Tool execution failed: timeout", "source": "ToolRunner", "timestamp": Date.now() - 1000 }
    ]
  };
}

export default function createLogPanelWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class LogPanelWidget extends HTMLElement {
    private pollInterval: any;
    private logs: any[] = [];
    private levelFilter: string = 'ALL';
    private sourceFilter: string = '';
    private autoScroll: boolean = true;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      if (USE_MOCK_DATA) {
        this.logs = mockLogData.logs;
        this.render();
      } else {
        // Subscribe to log events for real-time updates
        const unsubLog = EventBus.on('audit:log', (data: any) => {
          this.logs.push(data);
          if (this.logs.length > 1000) {
            this.logs = this.logs.slice(-1000); // Circular buffer
          }
          this.render();
        });
        this.unsubscribers.push(unsubLog);

        // Poll for recent logs
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

    private async pollLogs() {
      try {
        const result = await MCPBridge.callTool(
          'audit',
          'get_recent_events',
          { limit: 100 }
        );

        if (result.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          this.logs = data.logs || [];
          this.render();
        }
      } catch (error) {
        console.error('[LogPanel] Failed to fetch logs:', error);
      }
    }

    private async startPolling() {
      await this.pollLogs();
      this.pollInterval = setInterval(() => this.pollLogs(), 5000);
    }

    private getFilteredLogs(): any[] {
      return this.logs.filter(log => {
        // Level filter
        if (this.levelFilter !== 'ALL' && log.level !== this.levelFilter) {
          return false;
        }

        // Source filter
        if (this.sourceFilter && !log.source.toLowerCase().includes(this.sourceFilter.toLowerCase())) {
          return false;
        }

        return true;
      });
    }

    private formatTimestamp(timestamp: number): string {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    }

    private getLevelColor(level: string): string {
      const colors: Record<string, string> = {
        'INFO': '#4dabf7',
        'WARN': '#ffd43b',
        'ERROR': '#ff6b6b',
        'DEBUG': '#868e96'
      };
      return colors[level] || '#868e96';
    }

    private async clearLogs() {
      this.logs = [];
      this.render();
    }

    private async exportLogs() {
      try {
        const result = await MCPBridge.callTool(
          'audit',
          'export_audit_report',
          { format: 'json' }
        );

        if (result.content?.[0]?.text) {
          const blob = new Blob([result.content[0].text], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `reploid-logs-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('[LogPanel] Failed to export logs:', error);
      }
    }

    private render() {
      if (!this.shadowRoot) return;

      const filteredLogs = this.getFilteredLogs();

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            height: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
          }

          .log-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .toolbar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: #222;
            border-bottom: 1px solid #333;
          }

          .toolbar label {
            color: #888;
            font-size: 0.875rem;
          }

          .toolbar select,
          .toolbar input {
            background: #1a1a1a;
            border: 1px solid #444;
            color: #e0e0e0;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.875rem;
          }

          .toolbar button {
            background: #333;
            border: 1px solid #444;
            color: #e0e0e0;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .toolbar button:hover {
            background: #444;
          }

          .log-content {
            flex: 1;
            overflow-y: auto;
            padding: 0.5rem;
            font-family: 'Courier New', monospace;
            font-size: 0.875rem;
          }

          .log-entry {
            display: flex;
            gap: 0.5rem;
            padding: 0.25rem;
            margin-bottom: 0.125rem;
            border-radius: 2px;
          }

          .log-entry:hover {
            background: #252525;
          }

          .log-timestamp {
            color: #666;
            white-space: nowrap;
          }

          .log-level {
            font-weight: 600;
            white-space: nowrap;
            min-width: 50px;
          }

          .log-source {
            color: #999;
            white-space: nowrap;
            min-width: 120px;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .log-message {
            color: #e0e0e0;
            flex: 1;
            word-break: break-word;
          }

          .empty {
            text-align: center;
            padding: 2rem;
            color: #666;
          }
        </style>

        <div class="log-panel">
          <div class="toolbar">
            <label for="level-filter">Level:</label>
            <select id="level-filter">
              <option value="ALL" ${this.levelFilter === 'ALL' ? 'selected' : ''}>All</option>
              <option value="INFO" ${this.levelFilter === 'INFO' ? 'selected' : ''}>Info</option>
              <option value="WARN" ${this.levelFilter === 'WARN' ? 'selected' : ''}>Warn</option>
              <option value="ERROR" ${this.levelFilter === 'ERROR' ? 'selected' : ''}>Error</option>
              <option value="DEBUG" ${this.levelFilter === 'DEBUG' ? 'selected' : ''}>Debug</option>
            </select>

            <label for="source-filter">Source:</label>
            <input type="text" id="source-filter" placeholder="Filter by source..." value="${this.sourceFilter}">

            <button id="clear-btn">Clear</button>
            <button id="export-btn">Export</button>

            <label style="margin-left: auto">
              <input type="checkbox" id="auto-scroll" ${this.autoScroll ? 'checked' : ''}>
              Auto-scroll
            </label>
          </div>

          <div class="log-content" id="log-content">
            ${filteredLogs.length > 0 ? filteredLogs.map(log => `
              <div class="log-entry">
                <span class="log-timestamp">${this.formatTimestamp(log.timestamp)}</span>
                <span class="log-level" style="color: ${this.getLevelColor(log.level)}">${log.level}</span>
                <span class="log-source" title="${log.source}">${log.source}</span>
                <span class="log-message">${log.message}</span>
              </div>
            `).join('') : `
              <div class="empty">No logs to display</div>
            `}
          </div>
        </div>
      `;

      // Event handlers
      const levelFilter = this.shadowRoot.querySelector('#level-filter') as HTMLSelectElement;
      levelFilter?.addEventListener('change', (e) => {
        this.levelFilter = (e.target as HTMLSelectElement).value;
        this.render();
      });

      const sourceFilter = this.shadowRoot.querySelector('#source-filter') as HTMLInputElement;
      sourceFilter?.addEventListener('input', (e) => {
        this.sourceFilter = (e.target as HTMLInputElement).value;
        this.render();
      });

      const clearBtn = this.shadowRoot.querySelector('#clear-btn');
      clearBtn?.addEventListener('click', () => this.clearLogs());

      const exportBtn = this.shadowRoot.querySelector('#export-btn');
      exportBtn?.addEventListener('click', () => this.exportLogs());

      const autoScrollCheck = this.shadowRoot.querySelector('#auto-scroll') as HTMLInputElement;
      autoScrollCheck?.addEventListener('change', (e) => {
        this.autoScroll = (e.target as HTMLInputElement).checked;
      });

      // Auto-scroll to bottom
      if (this.autoScroll && filteredLogs.length > 0) {
        const logContent = this.shadowRoot.querySelector('#log-content');
        if (logContent) {
          logContent.scrollTop = logContent.scrollHeight;
        }
      }
    }
  }

  customElements.define('reploid-log-panel', LogPanelWidget);

  return {
    factory: () => {
      return new LogPanelWidget();
    }
  };
}
