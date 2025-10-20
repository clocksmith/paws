/**
 * Progress Tracker Panel - Modular UI Component
 *
 * @blueprint 0x000060
 * Category: UI/Panels
 *
 * Tracks FSM state changes and general progress events,
 * displaying them in a real-time panel with history and export capabilities.
 */

const ProgressTracker = {
  metadata: {
    id: 'ProgressTracker',
    version: '1.0.0',
    dependencies: ['EventBus'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { EventBus } = deps;
  // Module state (in closure)
  let currentState = 'idle';
  let eventHistory = [];
  let eventCount = 0;
  let lastEventTime = null;
  let eventHandlers = [];

  // Helper function to check feature flag
  const isEnabled = () => {
    try {
      // Access global config or use helper function
      if (typeof isModularPanelEnabled === 'function') {
        return isModularPanelEnabled('ProgressTracker');
      }
      // Fallback: check config directly
      return globalThis.config?.featureFlags?.useModularPanels?.ProgressTracker ?? false;
    } catch (err) {
      return false;
    }
  };

  /**
   * Event Handlers
   */

  const onStateChange = (payload) => {
    if (!isEnabled()) return;

    try {
      const { from, to, timestamp } = payload;
      currentState = to || 'unknown';
      eventCount++;
      lastEventTime = timestamp || Date.now();

      eventHistory.push({
        type: 'state-change',
        timestamp: lastEventTime,
        detail: `${from || 'unknown'} → ${to || 'unknown'}`,
        payload
      });

      // Auto-trim history (keep last 50)
      if (eventHistory.length > 50) {
        eventHistory = eventHistory.slice(-50);
      }
    } catch (error) {
      console.error('[ProgressTracker] Error handling state change:', error);
    }
  };

  const onProgressEvent = (payload) => {
    if (!isEnabled()) return;

    try {
      eventCount++;
      lastEventTime = Date.now();

      let detail = 'Progress event';
      if (payload) {
        if (typeof payload === 'string') {
          detail = payload;
        } else if (payload.event) {
          detail = payload.event;
        } else if (payload.message) {
          detail = payload.message;
        } else {
          detail = JSON.stringify(payload).slice(0, 100);
        }
      }

      eventHistory.push({
        type: 'progress',
        timestamp: lastEventTime,
        detail,
        payload
      });

      // Auto-trim history
      if (eventHistory.length > 50) {
        eventHistory = eventHistory.slice(-50);
      }
    } catch (error) {
      console.error('[ProgressTracker] Error handling progress event:', error);
    }
  };

  /**
   * Lifecycle Methods
   */

  const init = () => {
    try {
      // Subscribe to events
      EventBus.on('fsm:state:changed', onStateChange);
      EventBus.on('progress:event', onProgressEvent);

      // Track handlers for cleanup
      eventHandlers.push({ event: 'fsm:state:changed', handler: onStateChange });
      eventHandlers.push({ event: 'progress:event', handler: onProgressEvent });

      // Emit ready event
      EventBus.emit('ui:panel-ready', {
        panel: 'ProgressTracker',
        mode: 'modular',
        timestamp: Date.now()
      });

      console.log('[ProgressTracker] Initialized successfully');
    } catch (error) {
      console.error('[ProgressTracker] Init failed:', error);

      EventBus.emit('ui:panel-error', {
        panel: 'ProgressTracker',
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

      console.log('[ProgressTracker] Cleaned up successfully');
    } catch (error) {
      console.error('[ProgressTracker] Cleanup error:', error);
    }
  };

  /**
   * Web Component Definition
   */

  class ProgressTrackerWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 1000);  // Fast updates
    }

    disconnectedCallback() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }

    getStatus() {
      return {
        state: currentState === 'idle' ? 'idle' : 'active',
        primaryMetric: currentState.toUpperCase(),
        secondaryMetric: `${eventCount} events`,
        lastActivity: lastEventTime,
        message: null
      };
    }

    render() {
      // Check feature flag
      if (!isEnabled()) {
        this.shadowRoot.innerHTML = '';
        return;
      }

      try {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
              font-size: 12px;
            }
            .progress-panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 4px;
              border: 1px solid rgba(255, 255, 255, 0.1);
            }
            h4 {
              margin: 0 0 12px 0;
              color: #0f0;
              font-size: 14px;
            }
            .current-state {
              font-size: 16px;
              font-weight: bold;
              margin: 8px 0;
              color: #0f0;
              text-shadow: 0 0 5px rgba(0, 255, 0, 0.5);
            }
            .metric {
              margin: 4px 0;
              color: #ccc;
            }
            .metric strong {
              color: #fff;
            }
            button {
              padding: 4px 8px;
              margin: 4px 4px 4px 0;
              background: #0a0;
              color: #000;
              border: none;
              border-radius: 3px;
              cursor: pointer;
              font-family: inherit;
              font-size: 11px;
              font-weight: bold;
            }
            button:hover {
              background: #0f0;
            }
            button:active {
              background: #080;
            }
            .controls {
              margin: 12px 0 8px 0;
            }
            .event-list {
              max-height: 300px;
              overflow-y: auto;
              margin-top: 8px;
              background: rgba(0, 0, 0, 0.3);
              padding: 8px;
              border-radius: 3px;
            }
            .event-item {
              padding: 4px 6px;
              margin: 2px 0;
              background: rgba(0, 255, 0, 0.1);
              font-size: 10px;
              border-left: 2px solid rgba(0, 255, 0, 0.5);
              font-family: 'Monaco', 'Menlo', monospace;
            }
            .event-item.state-change {
              background: rgba(0, 150, 255, 0.2);
              border-left-color: rgba(0, 150, 255, 0.8);
            }
            .event-timestamp {
              color: #888;
              margin-right: 8px;
            }
            .event-type {
              color: #0ff;
              margin-right: 8px;
              text-transform: uppercase;
            }
            .event-detail {
              color: #fff;
            }
            .empty-state {
              color: #666;
              font-style: italic;
              padding: 16px;
              text-align: center;
            }
          </style>
          <div class="progress-panel">
            <h4>📊 Progress Tracker</h4>
            <div class="current-state">State: ${currentState}</div>
            <div class="metric"><strong>Total Events:</strong> ${eventCount}</div>
            <div class="metric"><strong>Last Event:</strong> ${lastEventTime ? new Date(lastEventTime).toLocaleTimeString() : 'Never'}</div>

            <div class="controls">
              <button id="clear-btn">🗑️ Clear History</button>
              <button id="export-btn">📤 Export Events</button>
            </div>

            <div class="event-list">
              ${eventHistory.length === 0 ? `
                <div class="empty-state">No events yet</div>
              ` : eventHistory.slice(-20).reverse().map(evt => `
                <div class="event-item ${evt.type === 'state-change' ? 'state-change' : ''}">
                  <span class="event-timestamp">[${new Date(evt.timestamp).toLocaleTimeString()}]</span>
                  <span class="event-type">${evt.type}</span>
                  <span class="event-detail">${evt.detail}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;

        // Wire up interactive buttons
        const clearBtn = this.shadowRoot.getElementById('clear-btn');
        const exportBtn = this.shadowRoot.getElementById('export-btn');

        if (clearBtn) {
          clearBtn.addEventListener('click', () => {
            eventHistory = [];
            eventCount = 0;
            lastEventTime = null;
            this.render();
          });
        }

        if (exportBtn) {
          exportBtn.addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(eventHistory, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `progress-events-${Date.now()}.json`;
            a.click();
            URL.revokeObjectURL(url);
          });
        }
      } catch (error) {
        console.error('[ProgressTracker] Render error:', error);
        this.shadowRoot.innerHTML = `
          <div style="color: red; padding: 16px; background: rgba(255,0,0,0.1);">
            <h4>❌ ProgressTracker Error</h4>
            <p>${error.message}</p>
          </div>
        `;
      }
    }
  }

  // Register custom element (with duplicate check)
  const elementName = 'progress-tracker-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, ProgressTrackerWidget);
  }

  /**
   * Module API
   */

  return {
    api: {
      init,
      cleanup,
      getCurrentState: () => currentState,
      getEventHistory: () => [...eventHistory],  // Return copy
      getEventCount: () => eventCount,
      getLastEventTime: () => lastEventTime,
      clearHistory: () => {
        eventHistory = [];
        eventCount = 0;
        lastEventTime = null;
      }
    },
    widget: {
      element: 'progress-tracker-widget',
      displayName: 'Progress Tracker',
      icon: '📊',
      category: 'UI/Panels',
      visible: isEnabled(),
      priority: 5,          // High priority (render near top)
      collapsible: true,
      defaultCollapsed: false
    }
  };
  }
};
