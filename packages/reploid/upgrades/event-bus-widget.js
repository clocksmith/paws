// @blueprint 0x000059 - EventBus Monitoring Widget
/**
 * EventBus Widget Implementation
 *
 * This is an EXAMPLE of how to add visibility to EventBus.
 *
 * EventBus is currently completely invisible - you can't see:
 * - How many event listeners are registered
 * - Which events are being fired
 * - Event frequency and volume
 * - Which modules are listening to what
 *
 * This widget makes EventBus observable in real-time.
 */

// This would be added to the existing event-bus.js file
const EventBusWidgetExtension = {
  /**
   * Add this to the return statement of EventBus.factory()
   */

  widget: (() => {
    class EventBusWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Update every 1 second for live stats
        this._updateInterval = setInterval(() => this.render(), 1000);

        // Listen to EventBus activity (if available)
        this._activityHandler = () => this.render();
        const EventBus = window.DIContainer?.resolve('EventBus');
        if (EventBus) {
          EventBus.on?.('eventbus:activity', this._activityHandler);
        }
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
        }
        if (this._activityHandler) {
          const EventBus = window.DIContainer?.resolve('EventBus');
          EventBus?.off?.('eventbus:activity', this._activityHandler);
        }
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      /**
       * Required: Return current status for compact display
       */
      getStatus() {
        // eventListeners is the internal Map in event-bus.js
        const totalListeners = typeof eventListeners !== 'undefined'
          ? Array.from(eventListeners.values()).reduce((sum, listeners) => sum + listeners.length, 0)
          : 0;

        const uniqueEvents = typeof eventListeners !== 'undefined' ? eventListeners.size : 0;

        // Calculate event rate from recent history
        const recentEvents = typeof eventHistory !== 'undefined'
          ? eventHistory.filter(e => Date.now() - e.timestamp < 10000)
          : [];
        const eventsPerSecond = (recentEvents.length / 10).toFixed(1);

        // State based on activity
        let state = 'idle';
        if (eventsPerSecond > 5) state = 'active';
        if (eventsPerSecond > 20) state = 'warning';

        return {
          state: state,
          primaryMetric: `${totalListeners} listeners`,
          secondaryMetric: `${eventsPerSecond}/s`,
          lastActivity: typeof lastEventTime !== 'undefined' ? lastEventTime : null
        };
      }

      render() {
        const stats = getEventBusStats(); // Would need to add this helper

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              color: #e0e0e0;
            }
            .event-bus-detail-panel {
              padding: 12px;
              background: #1a1a1a;
              border-radius: 4px;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #4fc3f7;
            }
            h5 {
              margin: 12px 0 8px 0;
              font-size: 13px;
              color: #aaa;
            }
            .controls {
              margin-bottom: 12px;
              display: flex;
              gap: 8px;
            }
            button {
              padding: 6px 12px;
              background: #333;
              color: #e0e0e0;
              border: 1px solid #555;
              border-radius: 3px;
              cursor: pointer;
              font-family: monospace;
              font-size: 11px;
            }
            button:hover {
              background: #444;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .stat-card {
              padding: 8px;
              background: #252525;
              border-radius: 3px;
              border: 1px solid #333;
            }
            .stat-label {
              font-size: 11px;
              color: #888;
              margin-bottom: 4px;
            }
            .stat-value {
              font-size: 16px;
              font-weight: bold;
              color: #4fc3f7;
            }
            .listener-breakdown {
              background: #252525;
              border: 1px solid #333;
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 12px;
            }
            .listener-table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            .listener-table th {
              background: #2a2a2a;
              padding: 6px;
              text-align: left;
              color: #888;
              font-weight: normal;
              border-bottom: 1px solid #333;
            }
            .listener-table td {
              padding: 6px;
              border-bottom: 1px solid #2a2a2a;
            }
            .event-name {
              color: #4fc3f7;
            }
            .listener-count, .fired-count {
              color: #e0e0e0;
              text-align: center;
            }
            .last-fired {
              color: #888;
              text-align: right;
            }
            .event-stream {
              max-height: 200px;
              overflow-y: auto;
              background: #252525;
              border: 1px solid #333;
              border-radius: 3px;
              padding: 4px;
              margin-bottom: 12px;
              font-size: 11px;
            }
            .event-entry {
              display: grid;
              grid-template-columns: auto 1fr 2fr;
              gap: 8px;
              padding: 4px;
              margin: 2px 0;
              background: #2a2a2a;
              border-radius: 2px;
            }
            .event-entry.event-error {
              background: #3a1a1a;
              border-left: 2px solid #f66;
            }
            .event-time {
              color: #888;
            }
            .event-name {
              color: #4fc3f7;
              font-weight: bold;
            }
            .event-payload {
              color: #aaa;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .dependency-graph {
              background: #252525;
              border: 1px solid #333;
              border-radius: 3px;
              padding: 8px;
            }
            .dependency-list {
              display: flex;
              flex-direction: column;
              gap: 8px;
            }
            .dependency-item {
              background: #2a2a2a;
              padding: 6px;
              border-radius: 2px;
              border-left: 2px solid #4fc3f7;
            }
            .module-name {
              font-weight: bold;
              color: #4fc3f7;
              margin-bottom: 4px;
              font-size: 12px;
            }
            .module-events {
              font-size: 11px;
              color: #888;
            }
          </style>
          <div class="event-bus-detail-panel">
            <h4>⏃ Event Bus Monitor</h4>

            <div class="controls">
              <button class="toggle-logging">${typeof isLoggingEvents !== 'undefined' && isLoggingEvents ? '⏸ Stop Log' : '▶ Start Log'}</button>
              <button class="clear-history">⛶ Clear</button>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Listeners</div>
                <div class="stat-value">${stats.totalListeners}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Event Types</div>
                <div class="stat-value">${stats.uniqueEvents}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Events/sec</div>
                <div class="stat-value">${stats.eventsPerSecond}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Total Fired</div>
                <div class="stat-value">${stats.totalEventsFired}</div>
              </div>
            </div>

            <h5>Active Listeners by Event</h5>
            <div class="listener-breakdown">
              <table class="listener-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Listeners</th>
                    <th>Fired</th>
                    <th>Last</th>
                  </tr>
                </thead>
                <tbody>
                  ${stats.listenersByEvent.map(({ event, count, firedCount, lastFired }) => `
                    <tr>
                      <td class="event-name">${event}</td>
                      <td class="listener-count">${count}</td>
                      <td class="fired-count">${firedCount}</td>
                      <td class="last-fired">${formatTimeAgo(lastFired)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <h5>Recent Events (Live)</h5>
            <div class="event-stream" id="event-stream">
              ${stats.recentEvents.map(event => `
                <div class="event-entry ${event.eventName.includes('error') ? 'event-error' : ''}">
                  <span class="event-time">${formatTimestamp(event.timestamp)}</span>
                  <span class="event-name">${event.eventName}</span>
                  <span class="event-payload">${JSON.stringify(event.payload).substring(0, 100)}</span>
                </div>
              `).join('')}
            </div>

            <h5>Listener Dependencies</h5>
            <div class="dependency-graph">
              ${renderDependencyGraph(stats.dependencies)}
            </div>
          </div>
        `;

        // Attach event listeners
        this.shadowRoot.querySelector('.toggle-logging')?.addEventListener('click', () => {
          if (typeof isLoggingEvents !== 'undefined') {
            isLoggingEvents = !isLoggingEvents;
            window.ToastNotifications?.show(
              isLoggingEvents ? 'Event logging started' : 'Event logging stopped',
              'info'
            );
          }
          this.render();
        });

        this.shadowRoot.querySelector('.clear-history')?.addEventListener('click', () => {
          if (typeof eventHistory !== 'undefined') {
            eventHistory.length = 0;
          }
          window.ToastNotifications?.show('Event history cleared', 'success');
          this.render();
        });

        // Auto-scroll event stream
        const stream = this.shadowRoot.querySelector('#event-stream');
        if (stream) {
          stream.scrollTop = stream.scrollHeight;
        }
      }
    }

    if (!customElements.get('event-bus-widget')) {
      customElements.define('event-bus-widget', EventBusWidget);
    }

    return {
      element: 'event-bus-widget',
      displayName: 'Event Bus Monitor',
      icon: '⏃',
      category: 'debug',
      order: 90
    };
  })()
};

// Helper functions for the EventBus widget

/**
 * Calculate EventBus statistics from internal state
 */
function getEventBusStats() {
  const EventBus = window.DIContainer.resolve('EventBus');

  // Access internal state (would need to expose via getter)
  const listeners = EventBus.getAllListeners(); // { eventName: [callbacks...] }
  const history = EventBus.getEventHistory(); // [{ eventName, payload, timestamp }]

  const totalListeners = Object.values(listeners)
    .reduce((sum, arr) => sum + arr.length, 0);

  const uniqueEvents = Object.keys(listeners).length;

  // Calculate event frequency
  const now = Date.now();
  const recent = history.filter(e => now - e.timestamp < 10000);
  const eventsPerSecond = (recent.length / 10).toFixed(1);

  // Count events fired per type
  const eventCounts = {};
  const lastFiredTimes = {};
  history.forEach(event => {
    eventCounts[event.eventName] = (eventCounts[event.eventName] || 0) + 1;
    lastFiredTimes[event.eventName] = Math.max(
      lastFiredTimes[event.eventName] || 0,
      event.timestamp
    );
  });

  const listenersByEvent = Object.entries(listeners).map(([event, cbs]) => ({
    event,
    count: cbs.length,
    firedCount: eventCounts[event] || 0,
    lastFired: lastFiredTimes[event] || null
  }));

  // Sort by most active
  listenersByEvent.sort((a, b) => b.firedCount - a.firedCount);

  return {
    totalListeners,
    uniqueEvents,
    eventsPerSecond,
    totalEventsFired: history.length,
    listenersByEvent,
    recentEvents: history.slice(-20).reverse(),
    dependencies: analyzeDependencies(listeners)
  };
}

/**
 * Analyze which modules listen to which events
 */
function analyzeDependencies(listeners) {
  const deps = {};

  Object.entries(listeners).forEach(([eventName, callbacks]) => {
    callbacks.forEach(cb => {
      // Try to infer module from callback name or context
      const moduleName = inferModuleName(cb);
      if (!deps[moduleName]) {
        deps[moduleName] = [];
      }
      deps[moduleName].push(eventName);
    });
  });

  return deps;
}

/**
 * Try to infer which module owns a callback
 */
function inferModuleName(callback) {
  // Check if callback has a name that indicates module
  if (callback.name && callback.name.includes('.')) {
    return callback.name.split('.')[0];
  }

  // Check if callback was bound with context
  if (callback._module) {
    return callback._module;
  }

  return 'Unknown';
}

/**
 * Render a simple dependency graph
 */
function renderDependencyGraph(dependencies) {
  return `
    <div class="dependency-list">
      ${Object.entries(dependencies).map(([module, events]) => `
        <div class="dependency-item">
          <div class="module-name">${module}</div>
          <div class="module-events">
            Listens to: ${events.join(', ')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'Just now';
  if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  return `${Math.floor(diff/3600000)}h ago`;
}

function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * BEFORE vs AFTER Comparison:
 *
 * BEFORE (EventBus is invisible):
 * - No way to see what events are firing
 * - No way to debug event flow
 * - No way to see which modules listen to what
 * - Must add console.log manually to debug
 *
 * AFTER (EventBus has widget):
 * - Compact card shows: "47 listeners | 12.3/s"
 * - Status: green when active, yellow when busy
 * - Live event stream shows all events in real-time
 * - Table shows listener count per event type
 * - Dependency graph shows module relationships
 * - Can pause/resume logging, clear history
 *
 * This makes the INVISIBLE event system VISIBLE and debuggable.
 */
