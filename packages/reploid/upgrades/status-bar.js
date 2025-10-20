/**
 * Status Bar - Modular UI Component
 *
 * @blueprint 0x000061
 * Category: UI/Panels
 *
 * System-wide status aggregation bar displaying FSM state,
 * module health, and real-time system metrics.
 */

export default function createModule(ModuleLoader, EventBus) {
  // Module state (in closure)
  let currentFSMState = 'idle';
  let lastStatusUpdate = null;
  let eventHandlers = [];

  // Helper function to check feature flag
  const isEnabled = () => {
    try {
      if (typeof isModularPanelEnabled === 'function') {
        return isModularPanelEnabled('StatusBar');
      }
      return globalThis.config?.featureFlags?.useModularPanels?.StatusBar ?? false;
    } catch (err) {
      return false;
    }
  };

  /**
   * System Health Aggregation
   */

  const getSystemHealth = async () => {
    if (!isEnabled()) {
      return {
        totalModules: 0,
        activeCount: 0,
        idleCount: 0,
        errorCount: 0,
        loadingCount: 0,
        modules: []
      };
    }

    try {
      const modules = await ModuleLoader.getAllModules();
      const summary = {
        totalModules: 0,
        activeCount: 0,
        idleCount: 0,
        errorCount: 0,
        loadingCount: 0,
        modules: []
      };

      for (const [moduleName, moduleInstance] of Object.entries(modules)) {
        if (moduleInstance.widget) {
          summary.totalModules++;

          // Get status from widget element (if mounted in DOM)
          let status = {
            state: 'idle',
            primaryMetric: 'Unknown',
            secondaryMetric: '',
            lastActivity: null,
            message: null
          };

          const widgetEl = document.querySelector(moduleInstance.widget.element);
          if (widgetEl && typeof widgetEl.getStatus === 'function') {
            try {
              status = widgetEl.getStatus();
            } catch (error) {
              console.error(`[StatusBar] Error getting status from ${moduleName}:`, error);
            }
          }

          // Aggregate counts
          if (status.state === 'active') {
            summary.activeCount++;
          } else if (status.state === 'idle') {
            summary.idleCount++;
          } else if (status.state === 'error') {
            summary.errorCount++;
          } else if (status.state === 'loading') {
            summary.loadingCount++;
          }

          summary.modules.push({
            name: moduleInstance.widget.displayName || moduleName,
            element: moduleInstance.widget.element,
            state: status.state,
            primaryMetric: status.primaryMetric,
            secondaryMetric: status.secondaryMetric,
            lastActivity: status.lastActivity,
            message: status.message
          });
        }
      }

      // Sort modules: errors first, then active, then idle
      summary.modules.sort((a, b) => {
        const order = { error: 0, active: 1, loading: 2, idle: 3 };
        return (order[a.state] || 999) - (order[b.state] || 999);
      });

      return summary;
    } catch (error) {
      console.error('[StatusBar] Error aggregating system health:', error);
      return {
        totalModules: 0,
        activeCount: 0,
        idleCount: 0,
        errorCount: 0,
        loadingCount: 0,
        modules: []
      };
    }
  };

  /**
   * Event Handlers
   */

  const onStateChange = (payload) => {
    if (!isEnabled()) return;

    try {
      currentFSMState = payload.to || 'unknown';
      lastStatusUpdate = Date.now();
    } catch (error) {
      console.error('[StatusBar] Error handling state change:', error);
    }
  };

  const onPanelReady = (payload) => {
    if (!isEnabled()) return;

    lastStatusUpdate = Date.now();
  };

  const onPanelError = (payload) => {
    if (!isEnabled()) return;

    lastStatusUpdate = Date.now();
  };

  const onStatusUpdated = () => {
    if (!isEnabled()) return;

    lastStatusUpdate = Date.now();
  };

  /**
   * Lifecycle Methods
   */

  const init = () => {
    try {
      // Subscribe to events
      EventBus.on('fsm:state:changed', onStateChange);
      EventBus.on('ui:panel-ready', onPanelReady);
      EventBus.on('ui:panel-error', onPanelError);
      EventBus.on('status:updated', onStatusUpdated);

      // Track handlers for cleanup
      eventHandlers.push({ event: 'fsm:state:changed', handler: onStateChange });
      eventHandlers.push({ event: 'ui:panel-ready', handler: onPanelReady });
      eventHandlers.push({ event: 'ui:panel-error', handler: onPanelError });
      eventHandlers.push({ event: 'status:updated', handler: onStatusUpdated });

      // Emit ready event
      EventBus.emit('ui:panel-ready', {
        panel: 'StatusBar',
        mode: 'modular',
        timestamp: Date.now()
      });

      console.log('[StatusBar] Initialized successfully');
    } catch (error) {
      console.error('[StatusBar] Init failed:', error);

      EventBus.emit('ui:panel-error', {
        panel: 'StatusBar',
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

      console.log('[StatusBar] Cleaned up successfully');
    } catch (error) {
      console.error('[StatusBar] Cleanup error:', error);
    }
  };

  /**
   * Web Component Definition
   */

  class StatusBarWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._expanded = false;
      this._healthSummary = null;
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 1000);  // Real-time updates
    }

    disconnectedCallback() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }

    getStatus() {
      const healthSummary = this._healthSummary || {
        errorCount: 0,
        activeCount: 0,
        totalModules: 0
      };

      return {
        state: healthSummary.errorCount > 0
          ? 'error'
          : (healthSummary.activeCount > 0 ? 'active' : 'idle'),
        primaryMetric: currentFSMState.toUpperCase(),
        secondaryMetric: `${healthSummary.totalModules} modules`,
        lastActivity: lastStatusUpdate,
        message: healthSummary.errorCount > 0
          ? `${healthSummary.errorCount} module${healthSummary.errorCount > 1 ? 's have' : ' has'} errors`
          : null
      };
    }

    async render() {
      if (!isEnabled()) {
        this.shadowRoot.innerHTML = '';
        return;
      }

      try {
        // Aggregate system health (async)
        const healthSummary = await getSystemHealth();
        this._healthSummary = healthSummary;

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 11px;
            }
            .status-bar {
              background: rgba(0, 0, 0, 0.9);
              padding: 8px 16px;
              border-bottom: 1px solid #333;
              display: flex;
              align-items: center;
              gap: 16px;
              cursor: pointer;
              user-select: none;
            }
            .status-bar:hover {
              background: rgba(20, 20, 20, 0.9);
            }
            .status-item {
              display: flex;
              align-items: center;
              gap: 6px;
            }
            .status-indicator {
              width: 8px;
              height: 8px;
              border-radius: 50%;
            }
            .status-indicator.idle {
              background: #888;
            }
            .status-indicator.active {
              background: #0f0;
              animation: pulse 2s infinite;
            }
            .status-indicator.error {
              background: #f00;
              animation: blink 1s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
            @keyframes blink {
              0%, 50% { opacity: 1; }
              51%, 100% { opacity: 0.3; }
            }
            .status-label {
              color: #888;
            }
            .status-value {
              color: #fff;
              font-weight: bold;
            }
            .status-value.error {
              color: #f00;
            }
            .status-value.active {
              color: #0f0;
            }
            .expand-icon {
              margin-left: auto;
              color: #888;
              font-size: 10px;
            }
            .detailed-view {
              background: rgba(0, 0, 0, 0.95);
              padding: 16px;
              border-bottom: 1px solid #333;
              max-height: 300px;
              overflow-y: auto;
            }
            h4 {
              margin: 0 0 8px 0;
              color: #0f0;
              font-size: 12px;
            }
            .module-status {
              padding: 4px 8px;
              margin: 2px 0;
              border-left: 3px solid;
              font-size: 10px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .module-status.idle {
              border-left-color: #888;
              color: #aaa;
            }
            .module-status.active {
              border-left-color: #0f0;
              color: #0cf;
            }
            .module-status.error {
              border-left-color: #f00;
              color: #f88;
              background: rgba(255, 0, 0, 0.1);
            }
            .module-status.loading {
              border-left-color: #fa0;
              color: #fc0;
            }
            .module-name {
              font-weight: bold;
            }
            .module-metrics {
              color: #888;
              font-size: 9px;
            }
            .empty-state {
              color: #666;
              text-align: center;
              padding: 16px;
              font-style: italic;
            }
          </style>

          <div class="status-bar" id="status-bar-toggle">
            <div class="status-item">
              <div class="status-indicator ${healthSummary.errorCount > 0 ? 'error' : (healthSummary.activeCount > 0 ? 'active' : 'idle')}"></div>
              <span class="status-label">FSM:</span>
              <span class="status-value">${currentFSMState}</span>
            </div>

            <div class="status-item">
              <span class="status-label">Modules:</span>
              <span class="status-value">${healthSummary.totalModules}</span>
            </div>

            <div class="status-item">
              <span class="status-label">Active:</span>
              <span class="status-value active">${healthSummary.activeCount}</span>
            </div>

            ${healthSummary.errorCount > 0 ? `
              <div class="status-item">
                <span class="status-label">Errors:</span>
                <span class="status-value error">${healthSummary.errorCount}</span>
              </div>
            ` : ''}

            <div class="expand-icon">${this._expanded ? '▲' : '▼'}</div>
          </div>

          ${this._expanded ? `
            <div class="detailed-view">
              <h4>📍 Module Health Details</h4>
              ${healthSummary.modules.length === 0 ? `
                <div class="empty-state">No modules loaded</div>
              ` : healthSummary.modules.map(mod => `
                <div class="module-status ${mod.state}">
                  <div>
                    <span class="module-name">${mod.name}</span>
                    <div class="module-metrics">${mod.primaryMetric} · ${mod.secondaryMetric || 'N/A'}</div>
                    ${mod.message ? `<div class="module-metrics" style="color: #f88;">${mod.message}</div>` : ''}
                  </div>
                  <span>${mod.state.toUpperCase()}</span>
                </div>
              `).join('')}
            </div>
          ` : ''}
        `;

        // Wire up toggle
        const toggle = this.shadowRoot.getElementById('status-bar-toggle');
        if (toggle) {
          toggle.addEventListener('click', () => {
            this._expanded = !this._expanded;
            this.render();
          });
        }
      } catch (error) {
        console.error('[StatusBar] Render error:', error);
        this.shadowRoot.innerHTML = `
          <div style="background: rgba(255,0,0,0.1); padding: 8px; color: red;">
            ❌ StatusBar Error: ${error.message}
          </div>
        `;
      }
    }
  }

  // Register custom element (with duplicate check)
  const elementName = 'status-bar-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, StatusBarWidget);
  }

  /**
   * Module API
   */

  return {
    api: {
      init,
      cleanup,
      getCurrentFSMState: () => currentFSMState,
      getSystemHealth,
      refreshStatus: () => {
        lastStatusUpdate = Date.now();
        EventBus.emit('status:updated');
      }
    },
    widget: {
      element: 'status-bar-widget',
      displayName: 'Status Bar',
      icon: '📍',
      category: 'UI/Panels',
      visible: isEnabled(),
      priority: 10,         // Highest priority (render first, at top)
      collapsible: false,   // Status bar should always be visible
      defaultCollapsed: false
    }
  };
}
