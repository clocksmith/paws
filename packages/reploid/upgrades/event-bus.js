// Event Bus Module for REPLOID - Project Phoenix
// A simple pub/sub system for decoupling modules.
// @blueprint 0x000059

const EventBus = {
  metadata: {
    id: 'EventBus',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    const { Utils } = deps;
    const { logger, createSubscriptionTracker } = Utils;

    const _listeners = new Map();
    const _tracker = createSubscriptionTracker();
    const _eventHistory = [];
    const MAX_HISTORY = 100;
    let _lastEventTime = null;

    const on = (eventName, listener, moduleId = null) => {
      if (!_listeners.has(eventName)) {
        _listeners.set(eventName, []);
      }
      _listeners.get(eventName).push(listener);
      logger.debug(`[EventBus] Listener registered for event: ${eventName}`);

      // Create unsubscribe function
      const unsubscribe = () => off(eventName, listener);

      // Track subscription for auto-cleanup if moduleId provided
      if (moduleId) {
        _tracker.track(moduleId, unsubscribe);
      }

      return unsubscribe;
    };

    const off = (eventName, listenerToRemove) => {
      if (!_listeners.has(eventName)) {
        return;
      }
      const listeners = _listeners.get(eventName).filter(l => l !== listenerToRemove);
      _listeners.set(eventName, listeners);
      logger.debug(`[EventBus] Listener removed for event: ${eventName}`);
    };

    const emit = (eventName, data) => {
      logger.info(`[EventBus] Emitting event: ${eventName}`, data);

      // Track event history
      _lastEventTime = Date.now();
      _eventHistory.push({
        eventName,
        timestamp: _lastEventTime,
        listenerCount: _listeners.get(eventName)?.length || 0
      });
      if (_eventHistory.length > MAX_HISTORY) {
        _eventHistory.shift();
      }

      if (!_listeners.has(eventName)) {
        return;
      }
      _listeners.get(eventName).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`[EventBus] Error in listener for event ${eventName}:`, error);
        }
      });
    };

    const unsubscribeAll = (moduleId) => {
      _tracker.unsubscribeAll(moduleId);
    };

    const getSubscriptionReport = () => {
      return _tracker.getAllActive();
    };

    // Web Component widget
    class EventBusWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every second
        this._updateInterval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const totalListeners = Array.from(_listeners.values())
          .reduce((sum, arr) => sum + arr.length, 0);

        const uniqueEvents = _listeners.size;

        // Calculate event rate (events per second over last 10 seconds)
        const now = Date.now();
        const recentEvents = _eventHistory.filter(e => now - e.timestamp < 10000);
        const eventsPerSecond = (recentEvents.length / 10).toFixed(1);

        let state = 'idle';
        if (parseFloat(eventsPerSecond) > 5) state = 'active';
        if (parseFloat(eventsPerSecond) > 20) state = 'warning';

        return {
          state,
          primaryMetric: `${totalListeners} listeners`,
          secondaryMetric: `${eventsPerSecond}/s`,
          lastActivity: _lastEventTime
        };
      }

      getControls() {
        return [
          {
            id: 'clear-history',
            label: 'Clear History',
            icon: '⌦',
            action: () => {
              _eventHistory.length = 0;
              this.render();
              logger.info('[EventBus] Widget: Event history cleared');
            }
          }
        ];
      }

      render() {
        const totalListeners = Array.from(_listeners.values())
          .reduce((sum, arr) => sum + arr.length, 0);
        const uniqueEvents = _listeners.size;

        // Event counts by type
        const eventCounts = {};
        _eventHistory.forEach(event => {
          eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
        });

        // Calculate events/sec
        const now = Date.now();
        const recentEvents = _eventHistory.filter(e => now - e.timestamp < 10000);
        const eventsPerSecond = (recentEvents.length / 10).toFixed(1);

        // Top events by frequency
        const topEvents = Object.entries(eventCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10);

        const formatTimeAgo = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 1000) return 'Just now';
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }

            .event-bus-panel {
              padding: 12px;
            }

            h4 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h5 {
              margin: 16px 0 8px 0;
              font-size: 0.95em;
              color: #aaa;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-bottom: 16px;
            }

            .stat-card {
              padding: 12px;
              background: rgba(255,255,255,0.05);
              border-radius: 4px;
            }

            .stat-label {
              font-size: 0.85em;
              color: #888;
              margin-bottom: 4px;
            }

            .stat-value {
              font-size: 1.3em;
              font-weight: bold;
              color: #fff;
            }

            .listener-table {
              overflow-x: auto;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.9em;
            }

            th {
              text-align: left;
              padding: 8px;
              background: rgba(255,255,255,0.1);
              color: #aaa;
              font-weight: normal;
            }

            td {
              padding: 8px;
              border-top: 1px solid rgba(255,255,255,0.1);
            }

            .event-name {
              color: #fff;
            }

            .listener-count, .fired-count {
              color: #0ff;
            }

            .event-stream {
              max-height: 300px;
              overflow-y: auto;
            }

            .event-entry {
              display: flex;
              justify-content: space-between;
              padding: 6px 8px;
              background: rgba(255,255,255,0.03);
              border-radius: 4px;
              margin-bottom: 4px;
              font-size: 0.85em;
            }

            .event-time {
              color: #666;
              min-width: 80px;
            }

            .event-name {
              flex: 1;
              color: #fff;
              margin: 0 12px;
            }

            .listener-count-badge {
              color: #888;
              font-size: 0.85em;
            }

            p {
              color: #888;
              font-style: italic;
              text-align: center;
              padding: 20px;
            }
          </style>

          <div class="event-bus-panel">
            <h4>⏃ Event Bus Monitor</h4>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Listeners</div>
                <div class="stat-value">${totalListeners}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Event Types</div>
                <div class="stat-value">${uniqueEvents}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Events/sec</div>
                <div class="stat-value">${eventsPerSecond}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Total Events</div>
                <div class="stat-value">${_eventHistory.length}</div>
              </div>
            </div>

            <h5>Listeners by Event Type</h5>
            <div class="listener-table">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Listeners</th>
                    <th>Fired</th>
                  </tr>
                </thead>
                <tbody>
                  ${topEvents.map(([eventName, count]) => `
                    <tr>
                      <td class="event-name">${eventName}</td>
                      <td class="listener-count">${_listeners.get(eventName)?.length || 0}</td>
                      <td class="fired-count">${count}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <h5>Recent Events</h5>
            <div class="event-stream">
              ${_eventHistory.slice(-20).reverse().map(event => `
                <div class="event-entry">
                  <span class="event-time">${formatTimeAgo(event.timestamp)}</span>
                  <span class="event-name">${event.eventName}</span>
                  <span class="listener-count-badge">${event.listenerCount} listeners</span>
                </div>
              `).join('') || '<p>No events yet</p>'}
            </div>
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('event-bus-widget')) {
      customElements.define('event-bus-widget', EventBusWidget);
    }

    return {
      api: {
        on,
        off,
        emit,
        unsubscribeAll,
        getSubscriptionReport
      },

      // Widget interface for module dashboard
      widget: {
        element: 'event-bus-widget',
        displayName: 'Event Bus',
        icon: '⏃',
        category: 'core',
        updateInterval: 1000
      }
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = EventBus;
}

export default EventBus;
