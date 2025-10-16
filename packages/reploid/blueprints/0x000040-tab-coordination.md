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
The module uses the `BroadcastChannel` API for peer-to-peer messaging.

```javascript
const Tabs = await ModuleLoader.getModule('TabCoordinator');
await Tabs.init();
const { tabId } = Tabs.api.getTabInfo();
```

Key behaviours:
- **Tab Identity**
  - Generates unique `tabId` (`tab_<timestamp>_<random>`).
  - Broadcasts `tab-joined` on init; listens for other tabs.
- **State Synchronization**
  - Subscribes to `EventBus.on('state:updated', ...)` to broadcast state changes (avoiding loops by checking source).
  - Remote updates handled via `handleRemoteStateUpdate`; last-write-wins using `_timestamp`.
  - Emits `state:remote-update` for UI to refresh.
- **Locking (placeholder)**
  - `requestLock(resource)` & `releaseLock(lockId)` broadcast lock intents; currently logs but ready for future enforcement.
- **Lifecycle**
  - `cleanup()` broadcasts `tab-leaving` and closes channel on unload.
  - `getTabInfo()` reports initialization status and BroadcastChannel support.

### 3. Implementation Pathway
1. **Initialization**
   - Call `init()` as part of boot; handle absence of BroadcastChannel (fallback to single-tab mode with warnings).
   - Keep track of active tabs via `tab:joined` events (useful for UI status).
2. **State Handling**
   - StateManager should include `_timestamp` in updates to support last-write-wins (already integrated).
   - Tag remote updates with `_source: 'remote'` to avoid rebroadcast loops.
3. **Locking Strategy (Future)**
   - Extend `handleLockRequest` to deny operations when local persona already holds lock.
   - Provide user feedback via toasts when lock contention occurs.
4. **Security & Scope**
   - Channel name `reploid-tabs` is global; ensure only trusted contexts run in same origin.
   - Restrict broadcast payloads to necessary data; avoid leaking secrets.
5. **Cleanup**
   - Remove event listeners on `cleanup()`.
   - Consider heartbeat mechanism to detect crashed tabs (optional).

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
