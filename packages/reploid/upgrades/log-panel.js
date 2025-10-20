/**
 * Log Panel - Modular UI Component
 *
 * @blueprint 0x000062
 * Category: UI/Panels
 *
 * Advanced logging panel with multi-level support, filtering,
 * circular buffer, and export capabilities.
 */

export default function createModule(ModuleLoader, EventBus) {
  // Module state (in closure)
  const MAX_LOGS = 1000;
  let logs = [];
  let eventHandlers = [];

  // Helper function to check feature flag
  const isEnabled = () => {
    try {
      if (typeof isModularPanelEnabled === 'function') {
        return isModularPanelEnabled('LogPanel');
      }
      return globalThis.config?.featureFlags?.useModularPanels?.LogPanel ?? false;
    } catch (err) {
      return false;
    }
  };

  // Helper function to escape HTML (prevent XSS)
  const escapeHtml = (str) => {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  };

  /**
   * Log Management
   */

  const addLog = (level, message, source = 'unknown') => {
    if (!isEnabled()) return;

    try {
      logs.push({
        level: level.toUpperCase(),
        message: String(message),
        source: String(source),
        timestamp: Date.now()
      });

      // Circular buffer: remove oldest if exceeds max
      if (logs.length > MAX_LOGS) {
        logs = logs.slice(-MAX_LOGS);
      }
    } catch (error) {
      console.error('[LogPanel] Error adding log:', error);
    }
  };

  const clearLogs = () => {
    logs = [];
  };

  const getFilteredLogs = (filters) => {
    if (!filters) return logs;

    try {
      return logs.filter(log => {
        // Level filter
        if (filters.levels && !filters.levels[log.level]) {
          return false;
        }

        // Source filter
        if (filters.source && log.source !== filters.source) {
          return false;
        }

        // Text filter
        if (filters.text) {
          const searchText = filters.text.toLowerCase();
          const messageMatch = log.message.toLowerCase().includes(searchText);
          const sourceMatch = log.source.toLowerCase().includes(searchText);
          if (!messageMatch && !sourceMatch) {
            return false;
          }
        }

        return true;
      });
    } catch (error) {
      console.error('[LogPanel] Filter error:', error);
      return logs;
    }
  };

  const exportLogs = (format = 'json') => {
    try {
      let content, mimeType, extension;

      if (format === 'json') {
        content = JSON.stringify(logs, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      } else if (format === 'txt') {
        content = logs.map(log =>
          `[${new Date(log.timestamp).toISOString()}] ${log.level.padEnd(5)} [${log.source}] ${log.message}`
        ).join('\n');
        mimeType = 'text/plain';
        extension = 'txt';
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${Date.now()}.${extension}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[LogPanel] Export error:', error);
    }
  };

  /**
   * Event Handlers
   */

  const onLogMessage = (payload) => {
    if (!isEnabled()) return;

    try {
      const { level = 'INFO', message = '', source = 'unknown' } = payload;
      addLog(level, message, source);
    } catch (error) {
      console.error('[LogPanel] Error handling log message:', error);
    }
  };

  const onLogClear = () => {
    if (!isEnabled()) return;
    clearLogs();
  };

  /**
   * Lifecycle Methods
   */

  const init = () => {
    try {
      // Subscribe to events
      EventBus.on('log:message', onLogMessage);
      EventBus.on('log:clear', onLogClear);

      // Track handlers for cleanup
      eventHandlers.push({ event: 'log:message', handler: onLogMessage });
      eventHandlers.push({ event: 'log:clear', handler: onLogClear });

      // Emit ready event
      EventBus.emit('ui:panel-ready', {
        panel: 'LogPanel',
        mode: 'modular',
        timestamp: Date.now()
      });

      console.log('[LogPanel] Initialized successfully');
    } catch (error) {
      console.error('[LogPanel] Init failed:', error);

      EventBus.emit('ui:panel-error', {
        panel: 'LogPanel',
        error: error.message,
        timestamp: Date.now()
      });
    }
  };

  const cleanup = () => {
    try {
      // Unsubscribe all event listeners
      eventHandlers.forEach(({ event, handler }) => {
        EventBus.off(event, handler);
      });
      eventHandlers = [];

      console.log('[LogPanel] Cleaned up successfully');
    } catch (error) {
      console.error('[LogPanel] Cleanup error:', error);
    }
  };

  /**
   * Web Component Definition
   */

  class LogPanelWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._filters = {
        levels: { DEBUG: true, INFO: true, WARN: true, ERROR: true },
        source: null,
        text: '',
        autoScroll: true
      };
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 500);  // Fast updates for streaming logs
    }

    disconnectedCallback() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }

    getStatus() {
      const filteredLogs = getFilteredLogs(this._filters);
      const errorCount = logs.filter(log => log.level === 'ERROR').length;
      const warnCount = logs.filter(log => log.level === 'WARN').length;

      return {
        state: errorCount > 0 ? 'error' : (logs.length > 0 ? 'active' : 'idle'),
        primaryMetric: `${logs.length} logs`,
        secondaryMetric: errorCount > 0
          ? `${errorCount} errors`
          : warnCount > 0
            ? `${warnCount} warnings`
            : `${filteredLogs.length} visible`,
        lastActivity: logs.length > 0 ? logs[logs.length - 1].timestamp : null,
        message: errorCount > 0 ? `${errorCount} errors logged` : null
      };
    }

    render() {
      if (!isEnabled()) {
        this.shadowRoot.innerHTML = '';
        return;
      }

      try {
        const filteredLogs = getFilteredLogs(this._filters);
        const sources = [...new Set(logs.map(log => log.source))];

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 11px;
            }
            .log-panel {
              background: rgba(0, 0, 0, 0.8);
              padding: 16px;
              height: 500px;
              display: flex;
              flex-direction: column;
              border-radius: 4px;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            h4 {
              margin: 0 0 12px 0;
              color: #0f0;
              font-size: 14px;
            }
            .controls {
              display: flex;
              gap: 8px;
              margin-bottom: 8px;
              flex-wrap: wrap;
              align-items: center;
            }
            .filter-btn {
              padding: 4px 8px;
              border: none;
              cursor: pointer;
              font-size: 10px;
              border-radius: 3px;
              font-weight: normal;
              transition: all 0.2s;
            }
            .filter-btn.active {
              font-weight: bold;
              transform: scale(1.05);
            }
            .filter-btn.debug { background: #888; color: #fff; }
            .filter-btn.debug.active { background: #aaa; }
            .filter-btn.info { background: #08f; color: #fff; }
            .filter-btn.info.active { background: #0af; }
            .filter-btn.warn { background: #fa0; color: #000; }
            .filter-btn.warn.active { background: #fc0; }
            .filter-btn.error { background: #f00; color: #fff; }
            .filter-btn.error.active { background: #f44; }
            input[type="text"] {
              padding: 4px 8px;
              border: 1px solid #444;
              background: #111;
              color: #fff;
              font-family: inherit;
              font-size: 11px;
              border-radius: 3px;
              min-width: 150px;
            }
            select {
              padding: 4px;
              background: #111;
              color: #fff;
              border: 1px solid #444;
              font-family: inherit;
              font-size: 11px;
              border-radius: 3px;
            }
            button {
              padding: 4px 8px;
              background: #0a0;
              color: #000;
              border: none;
              cursor: pointer;
              font-size: 10px;
              border-radius: 3px;
              font-weight: bold;
            }
            button:hover {
              background: #0f0;
            }
            label {
              margin-left: auto;
              color: #ccc;
              display: flex;
              align-items: center;
              gap: 4px;
            }
            .log-list {
              flex: 1;
              overflow-y: auto;
              background: #000;
              padding: 8px;
              border: 1px solid #333;
              border-radius: 3px;
            }
            .log-entry {
              padding: 4px 6px;
              margin: 2px 0;
              border-left: 3px solid;
              font-family: 'Monaco', 'Menlo', monospace;
              font-size: 10px;
              word-wrap: break-word;
            }
            .log-entry.DEBUG { border-left-color: #888; color: #aaa; }
            .log-entry.INFO { border-left-color: #08f; color: #0cf; }
            .log-entry.WARN { border-left-color: #fa0; color: #fc0; background: rgba(255, 170, 0, 0.05); }
            .log-entry.ERROR { border-left-color: #f00; color: #f88; background: rgba(255, 0, 0, 0.1); }
            .log-timestamp { color: #666; margin-right: 8px; }
            .log-level { margin-right: 8px; font-weight: bold; }
            .log-source { color: #08f; margin-right: 8px; }
            .log-message { color: #fff; }
            .empty-state { color: #666; padding: 16px; text-align: center; font-style: italic; }
          </style>
          <div class="log-panel">
            <h4>📋 Log Panel</h4>

            <div class="controls">
              <button class="filter-btn debug ${this._filters.levels.DEBUG ? 'active' : ''}" data-level="DEBUG">DEBUG</button>
              <button class="filter-btn info ${this._filters.levels.INFO ? 'active' : ''}" data-level="INFO">INFO</button>
              <button class="filter-btn warn ${this._filters.levels.WARN ? 'active' : ''}" data-level="WARN">WARN</button>
              <button class="filter-btn error ${this._filters.levels.ERROR ? 'active' : ''}" data-level="ERROR">ERROR</button>

              <select id="source-filter">
                <option value="">All Sources</option>
                ${sources.map(src => `<option value="${escapeHtml(src)}" ${this._filters.source === src ? 'selected' : ''}>${escapeHtml(src)}</option>`).join('')}
              </select>

              <input type="text" id="text-filter" placeholder="Search logs..." value="${escapeHtml(this._filters.text)}">

              <button id="clear-btn">🗑️ Clear</button>
              <button id="export-btn">📤 Export</button>

              <label>
                <input type="checkbox" id="autoscroll-toggle" ${this._filters.autoScroll ? 'checked' : ''}> Auto-scroll
              </label>
            </div>

            <div class="log-list" id="log-list">
              ${filteredLogs.length === 0 ? `<div class="empty-state">${logs.length === 0 ? 'No logs yet' : 'No logs match filter'}</div>` : filteredLogs.map(log => `
                <div class="log-entry ${log.level}">
                  <span class="log-timestamp">[${new Date(log.timestamp).toLocaleTimeString()}]</span>
                  <span class="log-level">${log.level}</span>
                  <span class="log-source">[${escapeHtml(log.source)}]</span>
                  <span class="log-message">${escapeHtml(log.message)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // Wire up controls
        this.shadowRoot.querySelectorAll('.filter-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const level = btn.dataset.level;
            this._filters.levels[level] = !this._filters.levels[level];
            this.render();
          });
        });

        const sourceFilter = this.shadowRoot.getElementById('source-filter');
        if (sourceFilter) {
          sourceFilter.addEventListener('change', () => {
            this._filters.source = sourceFilter.value || null;
            this.render();
          });
        }

        const textFilter = this.shadowRoot.getElementById('text-filter');
        if (textFilter) {
          textFilter.addEventListener('input', () => {
            this._filters.text = textFilter.value;
            this.render();
          });
        }

        const clearBtn = this.shadowRoot.getElementById('clear-btn');
        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            clearLogs();
            this.render();
          });
        }

        const exportBtn = this.shadowRoot.getElementById('export-btn');
        if (exportBtn) {
          exportBtn.addEventListener('click', () => {
            exportLogs('json');
          });
        }

        const autoscrollToggle = this.shadowRoot.getElementById('autoscroll-toggle');
        if (autoscrollToggle) {
          autoscrollToggle.addEventListener('change', () => {
            this._filters.autoScroll = autoscrollToggle.checked;
          });
        }

        // Auto-scroll to bottom if enabled
        if (this._filters.autoScroll) {
          const logList = this.shadowRoot.getElementById('log-list');
          if (logList) {
            logList.scrollTop = logList.scrollHeight;
          }
        }
      } catch (error) {
        console.error('[LogPanel] Render error:', error);
        this.shadowRoot.innerHTML = `
          <div style="color: red; padding: 16px; background: rgba(255,0,0,0.1);">
            <h4>❌ LogPanel Error</h4>
            <p>${escapeHtml(error.message)}</p>
          </div>
        `;
      }
    }
  }

  // Register custom element (with duplicate check)
  const elementName = 'log-panel-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, LogPanelWidget);
  }

  /**
   * Module API
   */

  return {
    api: {
      init,
      cleanup,
      log: (level, message, source) => addLog(level, message, source),
      debug: (message, source = 'unknown') => addLog('DEBUG', message, source),
      info: (message, source = 'unknown') => addLog('INFO', message, source),
      warn: (message, source = 'unknown') => addLog('WARN', message, source),
      error: (message, source = 'unknown') => addLog('ERROR', message, source),
      clear: clearLogs,
      export: exportLogs,
      getLogs: () => [...logs],  // Return copy
      getFilteredLogs: (filters) => getFilteredLogs(filters)
    },
    widget: {
      element: 'log-panel-widget',
      displayName: 'Log Panel',
      icon: '📋',
      category: 'UI/Panels',
      visible: isEnabled(),
      priority: 4,          // High priority (below ProgressTracker)
      collapsible: true,
      defaultCollapsed: false
    }
  };
}
