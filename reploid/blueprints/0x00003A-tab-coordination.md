# Blueprint 0x000040: Inter-Tab Coordination

**Objective:** Define the messaging protocol that keeps multiple REPLOID tabs synchronized and conflict-free.

**Target Upgrade:** TABC (`tab-coordinator.js`)

**Prerequisites:** 0x000005 (State Management Architecture), 0x000006 (Pure State Helpers), 0x000034 (Audit Logging Policy)

**Affected Artifacts:** `/upgrades/tab-coordinator.js`, `/styles/dashboard.css`, `/upgrades/state-manager.js`

---

### 1. The Strategic Imperative
Users often open multiple tabs (documentation vs. console). Without coordination:
- Conflicting state updates can overwrite each other.
- Persona operations (applying changes, running tools) may step on each other.
- Network-heavy operations can duplicate unexpectedly.

Inter-tab coordination ensures a single “source of truth” experience.

### 2. Architectural Overview

The TabCoordinator module provides inter-tab synchronization using the BroadcastChannel API with real-time monitoring through a Web Component widget. It implements a factory pattern with encapsulated messaging logic and Shadow DOM-based UI.

**Module Architecture:**
```javascript
const TabCoordinator = {
  metadata: {
    id: 'TabCoordinator',
    version: '1.0.0',
    dependencies: ['StateManager', 'EventBus', 'Utils'],
    async: true,
    type: 'coordination'
  },
  factory: (deps) => {
    const { StateManager, EventBus, Utils } = deps;
    const { logger } = Utils;

    // Internal state (accessible to widget via closure)
    let broadcastChannel = null;
    let tabId = null;
    let isInitialized = false;
    let _messagesSent = 0;
    let _messagesReceived = 0;
    let _connectedTabs = new Set();
    let _lastMessageTime = null;
    let _stateSyncCount = 0;

    // Core API functions
    const init = async () => {
      tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      broadcastChannel = new BroadcastChannel('reploid-tabs');
      broadcastChannel.onmessage = (event) => handleMessage(event.data);
      broadcast({ type: 'tab-joined', tabId });
      return true;
    };

    const broadcast = (message) => {
      broadcastChannel.postMessage({ ...message, tabId, timestamp: Date.now() });
      _messagesSent++;
      return true;
    };

    // Message handling
    const handleMessage = (message) => {
      if (message.tabId === tabId) return;
      _messagesReceived++;
      _connectedTabs.add(message.tabId);
      // Handle tab-joined, state-update, lock-request, lock-release
    };

    // Web Component Widget (defined inside factory to access closure state)
    class TabCoordinatorWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 3000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      render() {
        this.shadowRoot.innerHTML = `<style>...</style>${this.renderPanel()}`;
      }
    }

    customElements.define('tab-coordinator-widget', TabCoordinatorWidget);

    return {
      init,
      api: {
        broadcast,
        requestLock,
        releaseLock,
        getTabInfo,
        cleanup
      },
      widget: {
        element: 'tab-coordinator-widget',
        displayName: 'Tab Coordinator',
        icon: '⚯',
        category: 'coordination',
        updateInterval: 3000
      }
    };
  }
};
```

**Key Coordination Behaviors:**

- **Tab Identity**
  - Generates unique `tabId` (`tab_<timestamp>_<random>`)
  - Broadcasts `tab-joined` on init; listens for other tabs
  - Tracks connected tabs in `_connectedTabs` Set

- **State Synchronization**
  - Subscribes to `EventBus.on('state:updated')` to broadcast state changes
  - Avoids loops by checking `source !== 'remote'`
  - Remote updates handled via `handleRemoteStateUpdate` using last-write-wins strategy with `_timestamp`
  - Emits `state:remote-update` for UI refresh

- **Locking Protocol (Placeholder)**
  - `requestLock(resource)` broadcasts lock intents
  - `releaseLock(lockId)` notifies other tabs
  - Currently logs activity; ready for future enforcement

- **Lifecycle Management**
  - `cleanup()` broadcasts `tab-leaving` and closes channel on unload
  - `getTabInfo()` reports initialization status and BroadcastChannel support
  - `beforeunload` event listener ensures cleanup

**Web Component Widget Features:**

The `TabCoordinatorWidget` provides real-time tab coordination monitoring:
- **Statistics Grid**: 2×2 display showing connected tabs count, state syncs, messages sent/received
- **Current Tab Info**: Shows unique tab ID, initialization status, BroadcastChannel support
- **Connected Tabs List**: Scrollable list of all connected tab IDs with real-time updates
- **Interactive Actions**: "Announce Tab" button to broadcast presence, "Show Connected Tabs" to log to console
- **Auto-refresh**: Updates every 3 seconds to reflect tab join/leave events
- **Visual Feedback**: Color-coded status (green for active connections, blue for idle, red for warnings)

### 3. Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure TabCoordinator is registered with dependencies
{
  "modules": {
    "TabCoordinator": {
      "dependencies": ["StateManager", "EventBus", "Utils"],
      "enabled": true,
      "async": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates coordination logic:
```javascript
factory: (deps) => {
  const { StateManager, EventBus, Utils } = deps;
  const { logger } = Utils;

  // Internal state (accessible to widget via closure)
  let broadcastChannel = null;
  let tabId = null;
  let isInitialized = false;
  let _messagesSent = 0;
  let _messagesReceived = 0;
  let _connectedTabs = new Set();
  let _lastMessageTime = null;
  let _stateSyncCount = 0;

  // Initialization
  const init = async () => {
    // Generate unique tab ID
    tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Check BroadcastChannel support
    if (!('BroadcastChannel' in window)) {
      logger.warn('[TabCoordinator] BroadcastChannel not supported');
      return false;
    }

    // Create channel
    broadcastChannel = new BroadcastChannel('reploid-tabs');
    broadcastChannel.onmessage = (event) => handleMessage(event.data);

    // Announce presence
    broadcast({ type: 'tab-joined', tabId });

    // Listen for state changes
    EventBus.on('state:updated', (data) => {
      if (data.source !== 'remote') {
        broadcast({ type: 'state-update', state: data.state });
      }
    });

    isInitialized = true;
    return true;
  };

  // Web Component defined here to access closure variables
  class TabCoordinatorWidget extends HTMLElement { /*...*/ }
  customElements.define('tab-coordinator-widget', TabCoordinatorWidget);

  return { init, api, widget };
}
```

**Step 3: Message Handling Implementation**

Implement message routing and processing:
```javascript
const handleMessage = (message) => {
  // Ignore own messages
  if (message.tabId === tabId) return;

  // Track activity
  _messagesReceived++;
  _lastMessageTime = Date.now();
  _connectedTabs.add(message.tabId);

  // Route by message type
  switch (message.type) {
    case 'tab-joined':
      logger.info(`[TabCoordinator] Tab ${message.tabId} joined`);
      EventBus.emit('tab:joined', { tabId: message.tabId });
      break;

    case 'state-update':
      handleRemoteStateUpdate(message);
      break;

    case 'lock-request':
      handleLockRequest(message);
      break;

    case 'lock-release':
      handleLockRelease(message);
      break;

    case 'tab-leaving':
      _connectedTabs.delete(message.tabId);
      EventBus.emit('tab:left', { tabId: message.tabId });
      break;
  }
};

const handleRemoteStateUpdate = async (message) => {
  // Use last-write-wins strategy
  const currentState = await StateManager.getState();

  if (!currentState._timestamp || message.timestamp > currentState._timestamp) {
    // Remote state is newer, apply it
    await StateManager.updateState({
      ...message.state,
      _timestamp: message.timestamp,
      _source: 'remote'  // Prevent rebroadcast loop
    });

    _stateSyncCount++;
    EventBus.emit('state:remote-update', {
      from: message.tabId,
      state: message.state
    });
  }
};
```

**Step 4: Broadcast and Locking**

Implement message broadcasting and locking protocol:
```javascript
const broadcast = (message) => {
  if (!broadcastChannel) return false;

  broadcastChannel.postMessage({
    ...message,
    tabId,
    timestamp: Date.now()
  });

  _messagesSent++;
  _lastMessageTime = Date.now();
  return true;
};

const requestLock = async (resource, timeout = 5000) => {
  if (!isInitialized) return true; // No coordination needed in single-tab mode

  const lockId = `lock_${Date.now()}`;
  broadcast({ type: 'lock-request', resource, lockId });

  // Wait for objections (simple timeout-based approach)
  return new Promise((resolve) => {
    setTimeout(() => resolve(lockId), 100);
  });
};

const releaseLock = (lockId) => {
  if (!isInitialized) return;
  broadcast({ type: 'lock-release', lockId });
};
```

**Step 5: Web Component Widget**

The widget provides real-time tab coordination monitoring:
```javascript
class TabCoordinatorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  render() {
    // Access closure variables: isInitialized, tabId, _connectedTabs, etc.
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      ${this.renderPanel()}
    `;

    // Wire up interactive buttons
    this.shadowRoot.querySelector('.announce-btn')
      .addEventListener('click', () => {
        broadcast({ type: 'tab-joined', tabId });
        this.render();
      });
  }
}
```

**Step 6: Lifecycle Management**

Implement cleanup and graceful shutdown:
```javascript
const cleanup = () => {
  if (broadcastChannel) {
    // Announce departure
    broadcast({ type: 'tab-leaving', tabId });

    // Close channel
    broadcastChannel.close();
    broadcastChannel = null;
  }

  isInitialized = false;
  logger.info('[TabCoordinator] Cleanup complete');
};

// Auto-cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', cleanup);
}
```

**Step 7: Integration Points**

1. **Boot Sequence Integration**:
   - Call `await TabCoordinator.init()` during application boot
   - Handle initialization failure gracefully (single-tab mode)
   - Display warning if BroadcastChannel is unsupported

2. **State Synchronization**:
   - StateManager must include `_timestamp` in state updates
   - Tag remote updates with `_source: 'remote'` to prevent loops
   - Listen for `'state:remote-update'` events to refresh UI

3. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard system
   - Provides `getStatus()` method for dashboard summary view
   - Updates every 3 seconds via `updateInterval: 3000`

4. **Event-Driven Communication**:
   - Emit `'tab:joined'` events when new tabs connect
   - Emit `'tab:left'` events when tabs disconnect
   - Use for UI feedback or analytics

**Step 8: Security & Scope Considerations**

- **Channel Scope**: `reploid-tabs` channel is origin-scoped; ensure trusted contexts only
- **Payload Sanitization**: Restrict broadcast messages to necessary data; avoid secrets
- **Origin Validation**: BroadcastChannel provides same-origin isolation automatically
- **Message Validation**: Validate message structure before processing to prevent errors

### 4. Verification Checklist
- [ ] Multiple tabs share state without infinite loops.
- [ ] Opening new tab triggers `tab:joined` event in existing tabs.
- [ ] Closing tab emits `tab-leaving` (requires beforeunload support).
- [ ] BroadcastChannel absence logged and module returns false (no errors).
- [ ] `requestLock` resolves promise even when not initialised (single-tab).

### 5. Extension Opportunities
- Implement leader election to designate one tab as “primary executor”.
- Synchronise toast notifications and persona selections.
- Provide UI to view active tabs and hand off control.
- Enforce locking for high-risk operations (e.g., applying changesets).

Maintain this blueprint when lock semantics evolve or alternate messaging transports (Service Worker, SharedWorker) are introduced.
