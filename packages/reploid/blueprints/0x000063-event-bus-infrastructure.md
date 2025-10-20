# Blueprint 0x000063: Event Bus Infrastructure

**Objective:** Provide a foundational pub/sub event system for decoupling REPLOID modules through asynchronous communication.

**Target Upgrade:** EventBus (`event-bus.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling)

**Affected Artifacts:** `/upgrades/event-bus.js`

---

### 1. The Strategic Imperative

A modular agent architecture requires loose coupling between components to enable:

- **Independent Evolution**: Modules can evolve without breaking dependent modules
- **Dynamic Composition**: Modules can subscribe to events without compile-time dependencies
- **Debugging & Observability**: Centralized event tracking for system-wide monitoring
- **Lifecycle Management**: Automatic cleanup of subscriptions when modules unload

The EventBus provides a central pub/sub mechanism that all modules can use for inter-module communication without direct references.

### 2. The Architectural Solution

The `/upgrades/event-bus.js` implements a **lightweight pub/sub pattern** with subscription tracking, event history, and module-scoped auto-cleanup.

#### Module Structure

```javascript
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

    // Private state
    const _listeners = new Map();           // eventName -> listener[]
    const _tracker = createSubscriptionTracker();
    const _eventHistory = [];
    const MAX_HISTORY = 100;
    let _lastEventTime = null;

    /**
     * Subscribe to an event
     */
    const on = (eventName, listener, moduleId = null) => {
      if (!_listeners.has(eventName)) {
        _listeners.set(eventName, []);
      }
      _listeners.get(eventName).push(listener);

      // Create unsubscribe function
      const unsubscribe = () => off(eventName, listener);

      // Track subscription for auto-cleanup if moduleId provided
      if (moduleId) {
        _tracker.track(moduleId, unsubscribe);
      }

      return unsubscribe;
    };

    /**
     * Unsubscribe from an event
     */
    const off = (eventName, listenerToRemove) => {
      if (!_listeners.has(eventName)) return;

      const listeners = _listeners.get(eventName)
        .filter(l => l !== listenerToRemove);
      _listeners.set(eventName, listeners);
    };

    /**
     * Emit an event to all subscribers
     */
    const emit = (eventName, data) => {
      logger.info(`[EventBus] Emitting event: ${eventName}`, data);

      // Record in history
      const event = {
        name: eventName,
        data,
        timestamp: Date.now(),
        listenerCount: _listeners.get(eventName)?.length || 0
      };
      _eventHistory.push(event);
      if (_eventHistory.length > MAX_HISTORY) {
        _eventHistory.shift();
      }
      _lastEventTime = event.timestamp;

      // Notify all listeners
      const listeners = _listeners.get(eventName) || [];
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          logger.error(`[EventBus] Listener error for ${eventName}:`, error);
        }
      });
    };

    /**
     * Remove all listeners for a module
     */
    const cleanup = (moduleId) => {
      _tracker.cleanup(moduleId);
      logger.info(`[EventBus] Cleaned up subscriptions for module: ${moduleId}`);
    };

    /**
     * Get event statistics
     */
    const getStats = () => ({
      totalListeners: Array.from(_listeners.values())
        .reduce((sum, arr) => sum + arr.length, 0),
      eventTypes: _listeners.size,
      historySize: _eventHistory.length,
      lastEventTime: _lastEventTime,
      recentEvents: _eventHistory.slice(-10)
    });

    return {
      on,
      off,
      emit,
      cleanup,
      getStats
    };
  }
};
```

#### Core Responsibilities

1. **Event Registration**: Allow modules to subscribe to named events
2. **Event Emission**: Broadcast events to all subscribers with error isolation
3. **Subscription Tracking**: Track subscriptions per module for lifecycle management
4. **Auto-Cleanup**: Remove all subscriptions when a module unloads
5. **Event History**: Maintain recent event log for debugging and replay
6. **Statistics**: Provide observability into event flow

### 3. The Implementation Pathway

#### Step 1: Initialize Data Structures

```javascript
const _listeners = new Map();  // eventName -> listener[]
const _tracker = createSubscriptionTracker();
const _eventHistory = [];
const MAX_HISTORY = 100;
```

#### Step 2: Implement Subscription

```javascript
const on = (eventName, listener, moduleId = null) => {
  // 1. Create listener array if needed
  if (!_listeners.has(eventName)) {
    _listeners.set(eventName, []);
  }

  // 2. Add listener
  _listeners.get(eventName).push(listener);

  // 3. Create unsubscribe function
  const unsubscribe = () => off(eventName, listener);

  // 4. Track for auto-cleanup if moduleId provided
  if (moduleId) {
    _tracker.track(moduleId, unsubscribe);
  }

  return unsubscribe;
};
```

#### Step 3: Implement Event Emission

```javascript
const emit = (eventName, data) => {
  // 1. Log event
  logger.info(`[EventBus] Emitting event: ${eventName}`, data);

  // 2. Record in history
  const event = {
    name: eventName,
    data,
    timestamp: Date.now(),
    listenerCount: _listeners.get(eventName)?.length || 0
  };
  _eventHistory.push(event);
  if (_eventHistory.length > MAX_HISTORY) {
    _eventHistory.shift(); // Keep history bounded
  }

  // 3. Notify all listeners with error isolation
  const listeners = _listeners.get(eventName) || [];
  listeners.forEach(listener => {
    try {
      listener(data);
    } catch (error) {
      logger.error(`[EventBus] Listener error:`, error);
      // Continue notifying other listeners
    }
  });
};
```

#### Step 4: Implement Auto-Cleanup

```javascript
const cleanup = (moduleId) => {
  _tracker.cleanup(moduleId);  // Calls all unsubscribe functions
  logger.info(`[EventBus] Cleaned up subscriptions for: ${moduleId}`);
};
```

#### Step 5: Add Observability

```javascript
const getStats = () => ({
  totalListeners: Array.from(_listeners.values())
    .reduce((sum, arr) => sum + arr.length, 0),
  eventTypes: _listeners.size,
  historySize: _eventHistory.length,
  lastEventTime: _lastEventTime,
  recentEvents: _eventHistory.slice(-10)
});
```

### 4. Operational Safeguards & Quality Gates

- **Error Isolation**: Listener errors don't prevent other listeners from executing
- **Bounded History**: Limit event history to MAX_HISTORY to prevent memory leaks
- **Module-Scoped Cleanup**: Automatically remove subscriptions when modules unload
- **Null-Safe Access**: Use optional chaining and || [] for safe listener access
- **Logging**: Log all event emissions and errors for debugging

### 5. Common Event Patterns

```javascript
// State change notifications
EventBus.emit('state:updated', { key: 'goal', value: newGoal });

// VFS events
EventBus.emit('vfs:artifact-created', { path: '/code/module.js' });
EventBus.emit('vfs:checkpoint-created', { id: 'cp-001' });

// Agent lifecycle
EventBus.emit('agent:cycle-start', { iteration: 42 });
EventBus.emit('agent:tool-executed', { tool: 'read_file', result });

// UI events
EventBus.emit('ui:module-expanded', { moduleId: 'StateManager' });
EventBus.emit('ui:toast-shown', { message: 'Success', type: 'success' });

// Error notifications
EventBus.emit('error:tool-failed', { tool: 'write_file', error });
```

### 6. Integration Examples

#### Module subscribing to events:

```javascript
const MyModule = {
  factory: (deps) => {
    const { EventBus } = deps;

    // Subscribe with auto-cleanup
    EventBus.on('vfs:updated', (data) => {
      console.log('VFS updated:', data);
    }, 'MyModule');

    return {};
  }
};
```

#### Web Component subscribing to events:

```javascript
connectedCallback() {
  const EventBus = window.DIContainer?.resolve('EventBus');

  this._eventHandlers = {
    stateUpdated: (data) => this.render()
  };

  EventBus?.on('state:updated', this._eventHandlers.stateUpdated);
}

disconnectedCallback() {
  const EventBus = window.DIContainer?.resolve('EventBus');
  EventBus?.off('state:updated', this._eventHandlers.stateUpdated);
}
```

### 7. Extension Points

- **Event Filtering**: Add event namespacing and wildcard subscriptions
- **Event Replay**: Replay event history for late-joining subscribers
- **Event Persistence**: Store critical events to VFS for crash recovery
- **Event Metrics**: Track event frequency, listener performance
- **Event Middleware**: Add interception points for logging, validation, transformation

Use this blueprint when implementing cross-module communication, event-driven UI updates, or system-wide notifications.
