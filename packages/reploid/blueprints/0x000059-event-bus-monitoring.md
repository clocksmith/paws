# Blueprint 0x000059: Event Bus Monitoring & Visibility

**Objective:** Make the invisible EventBus observable by exposing listener counts, event frequencies, dependencies, and real-time event streams.

**Target Upgrade:** EVBUS (`event-bus-widget.js` + `event-bus.js`)

**Prerequisites:** 0x000002 (Application Orchestration), 0x000003 (Core Utilities & Error Handling), 0x00000D (UI Manager)

**Affected Artifacts:** `/upgrades/event-bus.js`, `/upgrades/event-bus-widget.js`

---

### 1. The Strategic Imperative

EventBus is the nervous system of REPLOID, connecting all modules through publish-subscribe messaging. However, it operates invisibly:
- **No visibility** into which events are firing or how frequently
- **No debugging tools** to trace event flow between modules
- **No dependency mapping** showing which modules listen to which events
- **No performance insights** when event spam causes slowdowns

Without observability, developers resort to manual console.log instrumentation. This blueprint adds **real-time monitoring** to make the event system visible and debuggable.

### 2. Architectural Overview

The EventBus monitoring extension adds introspection capabilities to the existing event-bus.js module.

```javascript
// EventBus now exposes internal state for monitoring
const EventBus = await ModuleLoader.getModule('EventBus');

// Access monitoring stats
const stats = EventBus.getAllListeners(); // { eventName: [callbacks...] }
const history = EventBus.getEventHistory(); // [{ eventName, payload, timestamp }]
```

#### Key Components

**1. Event History Tracking**
- Maintains circular buffer of recent events (configurable limit, default 1000)
- Each entry: `{ eventName, payload, timestamp }`
- Automatically prunes old entries to prevent memory bloat
- Optional logging flag (`isLoggingEvents`) to pause/resume tracking

**2. Listener Introspection**
- Expose `getAllListeners()` to return current listener map
- Maps event names to arrays of callback functions
- Tracks listener registration/deregistration counts
- Supports module name inference from callback context

**3. Statistics Calculation**
- **Total Listeners**: Sum of all callbacks across all events
- **Unique Events**: Number of distinct event types being listened to
- **Events/Second**: Rolling 10-second window event frequency
- **Total Fired**: Cumulative count of all events emitted
- **Per-Event Stats**: Listener count, fire count, last fired time

**4. Dependency Analysis**
- Infers which modules listen to which events
- Groups listeners by module name (from callback name or `_module` property)
- Renders dependency graph showing module → event subscriptions
- Helps identify tight coupling and event fan-out patterns

**5. Real-Time Event Stream**
- Shows most recent N events (default 20) in reverse chronological order
- Color codes error events (event names containing "error")
- Displays timestamp, event name, payload (truncated)
- Auto-scrolls to latest event

#### Monitoring Widget (Web Component)

The EventBus extension provides a Web Component widget for real-time monitoring:

```javascript
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

  getStatus() {
    // Access EventBus internal state via closure
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
      lastActivity: typeof lastEventTime !== 'undefined' ? lastEventTime : null,
      message: null
    };
  }

  render() {
    const stats = getEventBusStats(); // Calculate stats from EventBus state

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .controls { display: flex; gap: 8px; margin-bottom: 12px; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .stat-card { padding: 8px; background: #252525; }
        .listener-table { width: 100%; font-size: 11px; }
        .event-stream { max-height: 200px; overflow-y: auto; }
        .event-entry { display: grid; grid-template-columns: auto 1fr 2fr; gap: 8px; }
        .event-entry.event-error { background: #3a1a1a; border-left: 2px solid #f66; }
      </style>

      <div class="event-bus-detail-panel">
        <h4>⏃ Event Bus Monitor</h4>

        <div class="controls">
          <button class="toggle-logging">${isLoggingEvents ? '⏸ Stop Log' : '▶ Start Log'}</button>
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
              <tr><th>Event</th><th>Listeners</th><th>Fired</th><th>Last</th></tr>
            </thead>
            <tbody>
              ${stats.listenersByEvent.map(({ event, count, firedCount, lastFired }) => `
                <tr>
                  <td>${event}</td>
                  <td>${count}</td>
                  <td>${firedCount}</td>
                  <td>${formatTimeAgo(lastFired)}</td>
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

    // Attach event listeners for controls
    this.shadowRoot.querySelector('.toggle-logging')?.addEventListener('click', () => {
      isLoggingEvents = !isLoggingEvents;
      this.render();
    });

    this.shadowRoot.querySelector('.clear-history')?.addEventListener('click', () => {
      eventHistory.length = 0;
      this.render();
    });

    // Auto-scroll event stream to bottom
    const stream = this.shadowRoot.querySelector('#event-stream');
    if (stream) {
      stream.scrollTop = stream.scrollHeight;
    }
  }
}

// Register custom element
if (!customElements.get('event-bus-widget')) {
  customElements.define('event-bus-widget', EventBusWidget);
}

const widget = {
  element: 'event-bus-widget',
  displayName: 'Event Bus Monitor',
  icon: '⏃',
  category: 'debug',
  order: 90
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses EventBus state (`eventListeners`, `eventHistory`, `isLoggingEvents`) directly via closure.
- **Status Reporting**: `getStatus()` provides listener count, event rate, activity state.
- **Stats Grid**: Shows total listeners, unique events, events/sec, total fired.
- **Listener Breakdown Table**: Lists all events with listener count, fire count, last fired time (sorted by most active).
- **Live Event Stream**: Shows last 20 events with timestamp, name, payload (auto-scrolling).
- **Dependency Graph**: Maps modules to events they listen to.
- **Interactive Controls**: Start/stop logging, clear history.
- **Auto-Refresh**: Updates every 1 second for live monitoring.
- **Activity Detection**: State changes from idle → active → warning based on event rate.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core EventBus Extension Implementation

1. **Add Event History Tracking**
   - Add `eventHistory = []` array to event-bus.js state
   - Add `isLoggingEvents = true` flag
   - Add `lastEventTime = null` for last activity tracking
   - In `emit()` function, append to history when logging enabled:
     ```javascript
     if (isLoggingEvents) {
       eventHistory.push({ eventName, payload, timestamp: Date.now() });
       lastEventTime = Date.now();
       if (eventHistory.length > MAX_HISTORY_SIZE) {
         eventHistory.shift(); // Remove oldest
       }
     }
     ```

2. **Add Introspection APIs**
   - Expose `getAllListeners()`:
     ```javascript
     const getAllListeners = () => {
       const result = {};
       eventListeners.forEach((listeners, eventName) => {
         result[eventName] = listeners.map(l => l.callback);
       });
       return result;
     };
     ```
   - Expose `getEventHistory()`:
     ```javascript
     const getEventHistory = () => [...eventHistory]; // Return copy
     ```
   - Add to public API: `{ on, off, emit, getAllListeners, getEventHistory }`

3. **Add Module Name Tracking**
   - Modify `on()` to accept optional module name:
     ```javascript
     const on = (eventName, callback, moduleName) => {
       if (moduleName) {
         callback._module = moduleName; // Store for introspection
       }
       // ... rest of registration logic
     };
     ```
   - Update all module registrations to pass module name as third argument

4. **Add Statistics Helpers**
   - Implement `getEventBusStats()` helper:
     - Calculate total listeners (sum across all events)
     - Count unique events (eventListeners.size)
     - Calculate events/sec (recent history / 10 seconds)
     - Count events fired per type
     - Track last fired time per event type
     - Sort events by fire count (descending)

5. **Add Dependency Analysis**
   - Implement `analyzeDependencies()`:
     - Group callbacks by inferred module name
     - Map module → events it listens to
     - Return `{ moduleName: [event1, event2, ...] }`
   - Implement `inferModuleName()`:
     - Check callback.name for module prefix (e.g., "AgentCycle.handleUpdate")
     - Check callback._module property
     - Return "Unknown" as fallback

#### Widget Implementation (Web Component)

6. **Define Web Component Class** inside event-bus-widget.js:
   ```javascript
   class EventBusWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```

7. **Implement Lifecycle Methods**:
   - `connectedCallback()`: Initial render, start 1-second auto-refresh interval, optionally subscribe to `eventbus:activity` event
   - `disconnectedCallback()`: Clear interval and unsubscribe from EventBus events to prevent memory leaks

8. **Implement getStatus()** as class method with closure access:
   - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
   - Access EventBus state (`eventListeners`, `eventHistory`, `lastEventTime`) via closure
   - State logic:
     - `idle` if events/sec ≤ 5
     - `active` if events/sec > 5
     - `warning` if events/sec > 20 (potential event spam)
   - Primary metric: Total listener count
   - Secondary metric: Events per second (rolling 10-second window)

9. **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Calculate stats via `getEventBusStats()`
   - Render stats grid (total listeners, unique events, events/sec, total fired)
   - Render listener breakdown table (event, listener count, fired count, last fired)
   - Render live event stream (last 20 events, reverse chronological)
   - Render dependency graph (module → events)
   - Attach event listeners to control buttons:
     - Toggle logging: Flip `isLoggingEvents` flag
     - Clear history: Empty `eventHistory` array
   - Auto-scroll event stream to bottom

10. **Register Custom Element**:
    - Use kebab-case naming: `event-bus-widget`
    - Add duplicate check: `if (!customElements.get('event-bus-widget'))`
    - Call `customElements.define('event-bus-widget', EventBusWidget)`

11. **Return Widget Object** with new format:
    - `{ element: 'event-bus-widget', displayName: 'Event Bus Monitor', icon: '⏃', category: 'debug', order: 90 }`

12. **Integrate into event-bus.js**:
    - Import widget code from event-bus-widget.js
    - Add `widget` property to EventBus API return object
    - Ensure widget has closure access to `eventListeners`, `eventHistory`, `isLoggingEvents`, `lastEventTime`

13. **Add Helper Functions**:
    - `formatTimeAgo(timestamp)`: "Just now", "5s ago", "3m ago", "2h ago"
    - `formatTimestamp(timestamp)`: "HH:MM:SS" format
    - `renderDependencyGraph(dependencies)`: HTML for module → events list

14. **Test** Shadow DOM rendering, auto-refresh interval, event history tracking, listener introspection, dependency analysis, control buttons (toggle logging, clear history)

### 4. Verification Checklist

- [ ] `getAllListeners()` returns current listener map correctly
- [ ] `getEventHistory()` returns recent events with correct timestamps
- [ ] Event history respects max size limit (prunes oldest entries)
- [ ] `isLoggingEvents` flag pauses/resumes history tracking
- [ ] Module name inference works for named callbacks
- [ ] Stats calculation (total listeners, events/sec) is accurate
- [ ] Listener breakdown table shows correct counts and last fired times
- [ ] Live event stream updates in real-time (1-second interval)
- [ ] Error events (names containing "error") are color-coded red
- [ ] Auto-scroll keeps event stream showing latest events
- [ ] Dependency graph groups listeners by module correctly
- [ ] Toggle logging button updates UI state immediately
- [ ] Clear history button empties event stream
- [ ] Widget state changes from idle → active → warning based on event rate
- [ ] Widget cleanup (disconnectedCallback) prevents memory leaks

### 5. Extension Opportunities

- Add event filtering by name pattern (regex or wildcard)
- Add event replay capability (re-emit historical events for debugging)
- Add event rate alerts (notify when events/sec exceeds threshold)
- Add event latency tracking (time from emit to all listeners complete)
- Add listener execution time profiling (identify slow handlers)
- Export event history as JSON for offline analysis
- Add event search/grep functionality
- Visualize event flow as graph (event → listeners → emitted events)
- Add "pause on error event" debugging mode
- Track memory usage of event payloads (warn on large payloads)

Maintain this blueprint as the EventBus monitoring capabilities evolve or new introspection features are introduced.
