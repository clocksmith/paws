# Panel Communication Contract

**Purpose:** Define the communication protocol between UIManager and modular UI panels during the refactoring transition.

**Status:** Phase 0.6 - Pre-Migration Foundation Document (Final Phase 0 deliverable)

**Related Documents:**
- `EVENTBUS_EVENT_CATALOG.md` - All events panels can listen to or emit
- `FEATURE_FLAGS.md` - Feature flags controlling panel visibility
- `MODULE_WIDGET_PROTOCOL.md` - Widget protocol for panel Web Components
- `UIMANAGER_API_MIGRATION.md` - External API migration strategy

---

## 1. Strategic Overview

During the UIManager refactoring, we have **two implementations** running in parallel:
- **Monolithic UIManager** (legacy, lines 1-2585)
- **Modular Panels** (new, 6 separate modules)

The communication contract ensures:
- **No duplicate UI** - Only one implementation renders at a time
- **Clean event handling** - Panels subscribe/unsubscribe properly
- **Multi-tab coordination** - Approvals sync across tabs
- **Memory safety** - Event listeners cleaned up on panel disable

---

## 2. Panel Lifecycle Management

### Initialization Pattern

```javascript
// In ui-manager.js (during startup)
async function initializePanels() {
  // Check feature flags for each panel
  const panels = [
    { name: 'ProgressTracker', id: 0x00006A },
    { name: 'LogPanel', id: 0x00006B },
    { name: 'StatusBar', id: 0x00006C },
    { name: 'ThoughtPanel', id: 0x000065 },
    { name: 'GoalPanel', id: 0x000066 },
    { name: 'SentinelPanel', id: 0x000069 }
  ];

  for (const panel of panels) {
    if (isModularPanelEnabled(panel.name)) {
      await initModularPanel(panel.name);
    } else {
      initLegacyPanel(panel.name);
    }
  }

  EventBus.emit('ui:all-panels-init-complete');
}

async function initModularPanel(panelName) {
  const PanelModule = await ModuleLoader.getModule(panelName);
  await PanelModule.init(/* dependencies */);

  // Subscribe to events (module handles internally)
  // Module returns cleanup function for later

  // Mount widget to DOM
  const container = document.getElementById(`${panelName.toLowerCase()}-container`);
  const widgetElement = document.createElement(PanelModule.widget.element);
  container.innerHTML = '';
  container.appendChild(widgetElement);

  console.log(`[UIManager] ${panelName}: MODULAR mode active`);
  EventBus.emit('ui:panel-ready', { panel: panelName, mode: 'modular' });
}

function initLegacyPanel(panelName) {
  // Use existing UIManager monolithic code
  console.log(`[UIManager] ${panelName}: MONOLITHIC mode active`);
  EventBus.emit('ui:panel-ready', { panel: panelName, mode: 'monolithic' });
}
```

### Cleanup Pattern

```javascript
async function cleanupPanel(panelName) {
  if (isModularPanelEnabled(panelName)) {
    const PanelModule = await ModuleLoader.getModule(panelName);

    // Call module's cleanup function (unsubscribes EventBus listeners)
    if (PanelModule.api.cleanup) {
      await PanelModule.api.cleanup();
    }

    // Remove widget from DOM
    const container = document.getElementById(`${panelName.toLowerCase()}-container`);
    container.innerHTML = '';

    console.log(`[UIManager] ${panelName}: CLEANED UP`);
  }
}
```

---

## 3. Event Communication Protocol

### Panel → UIManager Events

Panels emit these events to coordinate with UIManager:

```javascript
// Panel initialization complete
EventBus.emit('ui:panel-ready', {
  panel: 'ThoughtPanel',
  mode: 'modular',
  timestamp: Date.now()
});

// Panel encountered error
EventBus.emit('ui:panel-error', {
  panel: 'ThoughtPanel',
  error: 'Failed to initialize DiffGenerator',
  timestamp: Date.now()
});

// Panel requests visibility change
EventBus.emit('ui:request-panel-switch', {
  from: 'ThoughtPanel',
  to: 'GoalPanel',
  timestamp: Date.now()
});
```

### UIManager → Panel Events

UIManager uses existing events; panels listen:

```javascript
// Example: ThoughtPanel listens to agent:thought
EventBus.on('agent:thought', (thoughtText) => {
  // Panel handles appending thought
  appendThought(thoughtText);
});

// Example: GoalPanel listens to goal:set
EventBus.on('goal:set', (goalText) => {
  // Panel handles displaying new goal
  setGoal(goalText);
});

// Example: SentinelPanel listens to user:approve:context
EventBus.on('user:approve:context', async (payload) => {
  // Panel handles showing approval UI
  await showContextApproval(payload.context);
});
```

**CRITICAL:** Panels MUST store event listener references for cleanup:

```javascript
// In panel module (closure pattern)
let eventHandlers = [];

export default function createModule(ModuleLoader, EventBus) {
  const onThought = (thoughtText) => { /* ... */ };
  const onStateChange = (payload) => { /* ... */ };

  const init = () => {
    EventBus.on('agent:thought', onThought);
    EventBus.on('fsm:state:changed', onStateChange);

    // Track for cleanup
    eventHandlers.push({ event: 'agent:thought', handler: onThought });
    eventHandlers.push({ event: 'fsm:state:changed', handler: onStateChange });
  };

  const cleanup = () => {
    // Unsubscribe all listeners
    eventHandlers.forEach(({ event, handler }) => {
      EventBus.off(event, handler);
    });
    eventHandlers = [];
  };

  return {
    api: { init, cleanup },
    widget: { /* ... */ }
  };
}
```

---

## 4. Visibility Coordination

### Decision: Panels Check Visibility (Recommended)

**Pattern:** Panels check their own feature flag before rendering.

**Rationale:**
- Simpler architecture (no UIManager pause logic)
- Panels are self-contained
- Feature flags already control visibility via `widget.visible`

**Implementation:**

```javascript
// In panel's render() method
render() {
  if (!isModularPanelEnabled('ThoughtPanel')) {
    // Panel disabled, skip rendering
    return;
  }

  this.shadowRoot.innerHTML = `
    <!-- Panel UI -->
  `;
}

// Event handlers also check visibility
EventBus.on('agent:thought', (thoughtText) => {
  if (!isModularPanelEnabled('ThoughtPanel')) {
    // Panel disabled, ignore event
    return;
  }

  appendThought(thoughtText);
});
```

**Benefits:**
- ✅ No risk of duplicate UI (only one implementation active)
- ✅ Instant rollback (flip flag → panel stops rendering)
- ✅ No UIManager modification needed

**Alternative (NOT RECOMMENDED):** UIManager pauses EventBus emissions
- ❌ More complex (UIManager needs to track panel states)
- ❌ Risk of missed events during transition
- ❌ Tight coupling between UIManager and panels

---

## 5. Multi-Tab Coordination

### Decision: Use TabCoordinator for Approvals

**Scenario:** User has 3 tabs open, approves context in Tab 1. Tabs 2 & 3 must also update SentinelPanel state.

**Pattern:** SentinelPanel emits approval → TabCoordinator broadcasts → All tabs sync.

**Implementation:**

```javascript
// In sentinel-panel.js
const approveContext = async () => {
  // 1. Update local state
  isApproved = true;
  lastApprovalTime = Date.now();

  // 2. Emit local event
  EventBus.emit('user:approve:context', {
    context: currentContext,
    approved: true,
    timestamp: Date.now()
  });

  // 3. Broadcast to other tabs (if TabCoordinator available)
  const TabCoordinator = await ModuleLoader.getModule('TabCoordinator');
  if (TabCoordinator) {
    TabCoordinator.api.broadcast('sentinel:approval', {
      context: currentContext,
      approved: true,
      tab: TabCoordinator.api.getTabId()
    });
  }

  // 4. Update UI
  render();
};

// Listen for approvals from other tabs
const init = async () => {
  const TabCoordinator = await ModuleLoader.getModule('TabCoordinator');
  if (TabCoordinator) {
    TabCoordinator.api.on('sentinel:approval', (payload) => {
      // Sync state from another tab
      isApproved = payload.approved;
      lastApprovalTime = Date.now();
      render();
    });
  }
};
```

**Events to Synchronize:**
- `sentinel:approval` - Context/proposal approved
- `goal:updated` - Goal edited in one tab
- `ui:panel-switch` - User switched active panel

**Fallback:** If TabCoordinator unavailable, panels work in single-tab mode (no sync).

---

## 6. EventBus Event Ordering Guarantees

### Guarantees Provided

**Ordering within a single emitter:**
```javascript
EventBus.emit('fsm:state:changed', { from: 'idle', to: 'planning' });
EventBus.emit('agent:thought', 'I need to plan...');
```
→ Listeners receive events in emission order: `fsm:state:changed` THEN `agent:thought`.

**No guarantee across emitters:**
```javascript
// Thread 1
EventBus.emit('event-a', payload1);

// Thread 2 (parallel)
EventBus.emit('event-b', payload2);
```
→ Listeners may receive `event-a` or `event-b` first (non-deterministic).

### Panel Design Recommendations

**1. Don't assume event order across different event types:**

```javascript
// ❌ BAD - Assumes fsm:state:changed arrives before agent:thought
EventBus.on('agent:thought', (thought) => {
  if (currentState !== 'planning') {
    throw new Error('Invalid state!');  // May throw incorrectly
  }
});

// ✅ GOOD - Defensive check
EventBus.on('agent:thought', (thought) => {
  if (currentState === 'planning') {
    appendThought(thought);
  } else {
    // Queue for later or log warning
    console.warn('[ThoughtPanel] Thought received in non-planning state');
  }
});
```

**2. Use idempotent event handlers:**

```javascript
// ✅ GOOD - Can receive same goal:set event multiple times safely
EventBus.on('goal:set', (goalText) => {
  if (currentGoal === goalText) {
    return;  // Already set, skip
  }
  currentGoal = goalText;
  render();
});
```

**3. Debounce high-frequency events:**

```javascript
// ✅ GOOD - Debounce rapid agent:thought emissions
let thoughtBuffer = [];
let debounceTimer = null;

EventBus.on('agent:thought', (thought) => {
  thoughtBuffer.push(thought);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    appendThoughts(thoughtBuffer);
    thoughtBuffer = [];
  }, 100);  // Batch every 100ms
});
```

---

## 7. Error Handling and Resilience

### Panel Error Recovery

```javascript
// In panel module
const init = () => {
  try {
    // Panel initialization
    subscribeToEvents();
    renderInitialState();
  } catch (error) {
    console.error(`[ThoughtPanel] Init failed:`, error);

    EventBus.emit('ui:panel-error', {
      panel: 'ThoughtPanel',
      error: error.message,
      timestamp: Date.now()
    });

    // Don't crash - render error state
    renderErrorState(error.message);
  }
};

const renderErrorState = (errorMsg) => {
  shadowRoot.innerHTML = `
    <style>
      .error-panel {
        background: rgba(255, 0, 0, 0.1);
        padding: 16px;
        border: 1px solid red;
      }
    </style>
    <div class="error-panel">
      <h4>❌ ThoughtPanel Error</h4>
      <p>${errorMsg}</p>
      <button onclick="location.reload()">Reload</button>
    </div>
  `;
};
```

### UIManager Fallback

```javascript
// In ui-manager.js
EventBus.on('ui:panel-error', async ({ panel, error }) => {
  console.error(`[UIManager] ${panel} failed: ${error}`);

  // Auto-rollback to monolithic implementation
  config.featureFlags.useModularPanels[panel] = false;
  await cleanupPanel(panel);
  initLegacyPanel(panel);

  // Notify user
  ToastNotifications.show(`${panel} rolled back to legacy mode`, 'warning');
});
```

---

## 8. Testing Contract Compliance

### Unit Test: Panel Initialization

```javascript
describe('ThoughtPanel Communication Contract', () => {
  it('should emit ui:panel-ready on successful init', async () => {
    const eventSpy = jest.spyOn(EventBus, 'emit');

    const ThoughtPanel = await ModuleLoader.getModule('ThoughtPanel');
    await ThoughtPanel.init();

    expect(eventSpy).toHaveBeenCalledWith('ui:panel-ready', {
      panel: 'ThoughtPanel',
      mode: 'modular',
      timestamp: expect.any(Number)
    });
  });

  it('should emit ui:panel-error on init failure', async () => {
    const eventSpy = jest.spyOn(EventBus, 'emit');

    // Force init to fail (e.g., missing dependency)
    jest.spyOn(ModuleLoader, 'getModule').mockRejectedValue(new Error('Dependency missing'));

    const ThoughtPanel = await ModuleLoader.getModule('ThoughtPanel');
    await ThoughtPanel.init();

    expect(eventSpy).toHaveBeenCalledWith('ui:panel-error', {
      panel: 'ThoughtPanel',
      error: 'Dependency missing',
      timestamp: expect.any(Number)
    });
  });
});
```

### Unit Test: Event Listener Cleanup

```javascript
describe('ThoughtPanel Cleanup', () => {
  it('should unsubscribe all event listeners on cleanup', async () => {
    const ThoughtPanel = await ModuleLoader.getModule('ThoughtPanel');
    await ThoughtPanel.init();

    // Verify listeners registered
    const listenersBefore = EventBus.listenerCount('agent:thought');
    expect(listenersBefore).toBeGreaterThan(0);

    // Cleanup
    await ThoughtPanel.api.cleanup();

    // Verify listeners removed
    const listenersAfter = EventBus.listenerCount('agent:thought');
    expect(listenersAfter).toBe(0);
  });
});
```

### Integration Test: Multi-Tab Sync

```javascript
describe('SentinelPanel Multi-Tab Sync', () => {
  it('should sync approvals across tabs', async () => {
    // Simulate Tab 1
    const tab1 = await createTab();
    const SentinelPanel1 = await tab1.ModuleLoader.getModule('SentinelPanel');
    await SentinelPanel1.init();

    // Simulate Tab 2
    const tab2 = await createTab();
    const SentinelPanel2 = await tab2.ModuleLoader.getModule('SentinelPanel');
    await SentinelPanel2.init();

    // Approve in Tab 1
    await SentinelPanel1.api.approveContext();

    // Wait for TabCoordinator broadcast
    await sleep(100);

    // Verify Tab 2 received update
    const status2 = SentinelPanel2.api.getStatus();
    expect(status2.isApproved).toBe(true);
  });
});
```

---

## 9. Verification Checklist

Before marking Phase 0.6 complete:

- [ ] Panel lifecycle management pattern documented (init, cleanup)
- [ ] Event communication protocol specified (Panel → UIManager, UIManager → Panel)
- [ ] Visibility coordination decision made (panels check feature flags)
- [ ] Multi-tab coordination pattern documented (TabCoordinator broadcasts)
- [ ] EventBus ordering guarantees clarified (single emitter only)
- [ ] Error handling and fallback patterns specified
- [ ] Testing patterns provided (unit + integration)

---

## 10. Cross-References

**Depends On:**
- `EVENTBUS_EVENT_CATALOG.md` - All events panels listen to
- `FEATURE_FLAGS.md` - `isModularPanelEnabled()` helper
- `MODULE_WIDGET_PROTOCOL.md` - Widget cleanup requirements

**Referenced By:**
- Blueprint 0x00006A (ProgressTracker) - Follow cleanup pattern
- Blueprint 0x00006B (StatusBar) - Follow cleanup pattern
- Blueprint 0x00006C (LogPanel) - Follow cleanup pattern
- Blueprint 0x000065 (ThoughtPanel) - Follow EventBus listener tracking (CLUSTER 2)
- Blueprint 0x000066 (GoalPanel) - Follow TabCoordinator sync pattern (CLUSTER 2)
- Blueprint 0x000069 (SentinelPanel) - Follow multi-tab approval sync (CLUSTER 2)

**Sync Points:**
- CLUSTER 1 Phase 1-3: Implement cleanup() in all panels
- CLUSTER 2 Phase 6-8: Implement TabCoordinator sync in GoalPanel, SentinelPanel
- Phase 4: Add integration tests for multi-panel coordination
- Phase 9: Verify all panels follow communication contract

---

## 11. Answers to CLUSTER 2 Questions

### Q1: Should panels check visibility or should UIManager pause EventBus emissions?

**Answer:** Panels check visibility (recommended).

**Pattern:**
```javascript
EventBus.on('agent:thought', (thought) => {
  if (!isModularPanelEnabled('ThoughtPanel')) return;
  appendThought(thought);
});
```

**Reason:** Simpler, self-contained, instant rollback.

### Q2: Do approval clicks need to sync across tabs via TabCoordinator?

**Answer:** Yes, for critical approvals (SentinelPanel, GoalPanel edits).

**Pattern:**
```javascript
TabCoordinator.api.broadcast('sentinel:approval', {
  approved: true,
  context: currentContext
});
```

**Fallback:** Single-tab mode if TabCoordinator unavailable.

### Q3: What are EventBus ordering guarantees?

**Answer:** Order guaranteed within single emitter only.

**Recommendation:** Use defensive checks, idempotent handlers, debouncing.

---

*This document defines the communication contract between UIManager and modular panels.*
