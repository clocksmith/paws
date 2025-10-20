# Blueprint 0x00005A: Human-in-the-Loop Controller

**Objective:** Provide centralized control over HITL vs Autonomous mode, allowing dynamic switching between human approval requirements and autonomous operation.

**Target Upgrade:** HITL (`hitl-controller.js`)

**Prerequisites:** 0x000002 (Application Orchestration), 0x000003 (Core Utilities & Error Handling), 0x000006 (Pure State Helpers)

**Affected Artifacts:** `/upgrades/hitl-controller.js`, `/upgrades/confirmation-modal.js`, `/upgrades/sentinel-fsm.js`

---

### 1. The Strategic Imperative

REPLOID operates across a spectrum from **fully supervised** (human approval for every action) to **fully autonomous** (zero human intervention). Without centralized control:
- **No unified way** to switch between HITL and autonomous modes
- **No visibility** into which modules are waiting for approval
- **No statistics** on approval/rejection rates
- **No module-specific overrides** (all modules forced to same mode)

This blueprint defines a **HITL Controller** that manages:
- **Master mode switch**: Global HITL vs Autonomous setting
- **Per-module overrides**: Fine-grained control for specific modules
- **Approval queue**: Centralized queue for pending approvals
- **Statistics tracking**: Approval/rejection rates, timeout tracking
- **EventBus integration**: Real-time notifications of mode changes and approval flow

### 2. Architectural Overview

`HITLController` acts as the centralized authority for approval requirements across all REPLOID modules.

```javascript
const HITL = await ModuleLoader.getModule('HITLController');

// Register a module as HITL-capable
HITL.registerModule('SentinelFSM', [
  HITL.CAPABILITIES.APPROVE_CODE_CHANGES,
  HITL.CAPABILITIES.APPROVE_FILE_OPERATIONS
], 'Sentinel code change monitoring');

// Check if approval is required
if (HITL.requiresApproval('SentinelFSM', HITL.CAPABILITIES.APPROVE_CODE_CHANGES)) {
  // Request approval
  HITL.requestApproval({
    moduleId: 'SentinelFSM',
    capability: HITL.CAPABILITIES.APPROVE_CODE_CHANGES,
    action: 'Apply 5 code changes',
    data: { changes: [...] },
    onApprove: (data) => applyChanges(data),
    onReject: (reason) => logger.info('Rejected:', reason),
    timeout: 60000 // 1 minute
  });
} else {
  // Auto-approve in autonomous mode
  applyChanges(data);
}
```

#### Key Components

**1. Mode Management**
- **Master Mode**: Global switch (`hitl` or `autonomous`)
  - `hitl`: All modules require approval unless overridden
  - `autonomous`: No modules require approval unless overridden
- **Module Overrides**: Per-module settings (`hitl`, `autonomous`, `inherit`)
  - `inherit`: Use master mode (default)
  - `hitl`: Always require approval (even if master is autonomous)
  - `autonomous`: Never require approval (even if master is HITL)
- **Effective Mode Calculation**: `getModuleMode(moduleId)`
  - If module has explicit override (!= `inherit`), use it
  - Otherwise, use master mode

**2. Module Registry**
- Map: `moduleId → { id, description, capabilities, currentMode, registeredAt }`
- **Registration**: `registerModule(moduleId, capabilities, description)`
  - Capabilities: Array of HITL_CAPABILITIES (e.g., `APPROVE_CODE_CHANGES`, `APPROVE_TOOL_EXECUTION`)
  - Emits `hitl:module-registered` event
- **Capabilities**: Predefined constants for approval types
  - `APPROVE_CODE_CHANGES`: Code modifications
  - `APPROVE_TOOL_EXECUTION`: Tool/command execution
  - `APPROVE_FILE_OPERATIONS`: File read/write/delete
  - `APPROVE_SELF_MODIFICATION`: Agent self-improvement
  - `APPROVE_EXTERNAL_ACTIONS`: External API calls
  - `REVIEW_TEST_RESULTS`: Test execution results
  - `CONFIRM_DESTRUCTIVE_OPS`: Destructive operations
  - `MANUAL_VERIFICATION`: Manual verification checkpoints

**3. Approval Queue**
- Array: `approvalQueue = []`
- Each item: `{ id, moduleId, capability, action, data, onApprove, onReject, timestamp, timeout, status }`
- **Request Flow**:
  1. Module calls `requestApproval(request)`
  2. Controller checks `requiresApproval(moduleId, capability)`
  3. If autonomous mode or no capability match → auto-approve
  4. Otherwise, add to queue and emit `hitl:approval-pending`
  5. Set timeout if specified
- **Approval Flow**:
  1. UI emits `hitl:approve` with `{ approvalId, data }`
  2. Controller finds item in queue, calls `onApprove(data)`
  3. Removes from queue, emits `hitl:approval-granted`
- **Rejection Flow**:
  1. UI emits `hitl:reject` with `{ approvalId, reason }`
  2. Controller finds item in queue, calls `onReject(reason)`
  3. Removes from queue, emits `hitl:approval-rejected`
- **Timeout Handling**:
  - If timeout specified, schedule rejection after N milliseconds
  - Check if still pending before auto-rejecting

**4. Statistics Tracking**
- Tracks:
  - `total`: Total approvals processed
  - `approved`: Number approved
  - `rejected`: Number rejected (manual)
  - `timedOut`: Number timed out (auto-rejected)
  - `history`: Last 50 approval outcomes (outcome, reason, timestamp)
- Exposed via `getApprovalStats()`

**5. Persistence**
- Uses localStorage (`REPLOID_HITL_CONFIG`)
- Saves: `{ masterMode, moduleOverrides }`
- Loads on init, applies saved configuration
- Auto-saves on mode changes

**6. EventBus Integration**
- Listens for:
  - `hitl:set-master-mode` → `setMasterMode(mode)`
  - `hitl:set-module-mode` → `setModuleMode({ moduleId, mode })`
  - `hitl:request-approval` → `handleApprovalRequest(request)`
  - `hitl:approve` → `handleApprove({ approvalId, data })`
  - `hitl:reject` → `handleReject({ approvalId, reason })`
- Emits:
  - `hitl:master-mode-changed` → `{ oldMode, newMode, affectedModules }`
  - `hitl:module-mode-changed` → `{ moduleId, oldMode, newMode, override }`
  - `hitl:module-registered` → `{ moduleId }`
  - `hitl:approval-pending` → `approvalItem`
  - `hitl:approval-granted` → `{ approvalId, item }`
  - `hitl:approval-rejected` → `{ approvalId, item, reason }`
  - `hitl:config-reset` → (no payload)

#### Monitoring Widget (Web Component)

The HITL Controller provides a Web Component widget for real-time monitoring and control:

```javascript
class HITLControllerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventBus = null;
  }

  connectedCallback() {
    // Resolve EventBus from DI container
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._eventBus = window.DIContainer.resolve('EventBus');
    }

    this.render();

    // Set up EventBus listeners for real-time updates
    if (this._eventBus) {
      this._updateHandler = () => this.render();
      this._eventBus.on('hitl:master-mode-changed', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:module-mode-changed', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-pending', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-granted', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-rejected', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:config-reset', this._updateHandler, 'HITLControllerWidget');
    }
  }

  disconnectedCallback() {
    // Clean up EventBus listeners
    if (this._eventBus && this._updateHandler) {
      this._eventBus.off('hitl:master-mode-changed', this._updateHandler);
      this._eventBus.off('hitl:module-mode-changed', this._updateHandler);
      this._eventBus.off('hitl:approval-pending', this._updateHandler);
      this._eventBus.off('hitl:approval-granted', this._updateHandler);
      this._eventBus.off('hitl:approval-rejected', this._updateHandler);
      this._eventBus.off('hitl:config-reset', this._updateHandler);
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    if (!this._api) {
      return {
        state: 'idle',
        primaryMetric: 'Loading...',
        secondaryMetric: '',
        lastActivity: null,
        message: null
      };
    }

    const state = this._api.getState();
    const queue = state.approvalQueue;
    const hasWarning = queue.length > 0;

    return {
      state: hasWarning ? 'warning' : 'idle',
      primaryMetric: `Mode: ${state.config.masterMode === 'autonomous' ? 'Auto' : 'HITL'}`,
      secondaryMetric: queue.length > 0 ? `${queue.length} pending` : 'No pending',
      lastActivity: queue.length > 0 ? queue[0].timestamp : null,
      message: hasWarning ? `${queue.length} approval${queue.length > 1 ? 's' : ''} needed` : null
    };
  }

  render() {
    const state = this._api.getState();
    const { config, approvalStats, registeredModules, approvalQueue } = state;

    const approvalRate = approvalStats.total > 0
      ? Math.round((approvalStats.approved / approvalStats.total) * 100)
      : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .mode-overview { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
        .stat-card { background: rgba(255,255,255,0.05); border-radius: 6px; padding: 12px; }
        .stat-card.warning { background: rgba(255, 165, 0, 0.1); border-left: 3px solid #ffa500; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 12px; }
        .stat-item.success { background: rgba(102, 187, 106, 0.1); border-left: 3px solid #66bb6a; }
        .stat-item.error { background: rgba(244, 135, 113, 0.1); border-left: 3px solid #f48771; }
        .history-item.approved { border-left: 3px solid #66bb6a; background: rgba(102, 187, 106, 0.05); }
        .history-item.rejected { border-left: 3px solid #f48771; background: rgba(244, 135, 113, 0.05); }
        .history-item.timeout { border-left: 3px solid #ffa500; background: rgba(255, 165, 0, 0.05); }
      </style>

      <div class="hitl-controller-panel">
        <h4>⚙ HITL Controller</h4>

        <div class="mode-overview">
          <div class="stat-card">
            <div class="stat-label">Master Mode</div>
            <div class="stat-value">${config.masterMode === 'autonomous' ? '⚙ Autonomous' : '⚇ HITL'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Registered Modules</div>
            <div class="stat-value">${registeredModules.length}</div>
          </div>
          <div class="stat-card ${approvalQueue.length > 0 ? 'warning' : ''}">
            <div class="stat-label">Pending Approvals</div>
            <div class="stat-value ${approvalQueue.length > 0 ? 'warning' : ''}">${approvalQueue.length}</div>
          </div>
        </div>

        <h5>Approval Statistics</h5>
        <div class="stats-grid">
          <div class="stat-item"><div class="stat-number">${approvalStats.total}</div><div class="stat-name">Total</div></div>
          <div class="stat-item success"><div class="stat-number">${approvalStats.approved}</div><div class="stat-name">Approved</div></div>
          <div class="stat-item error"><div class="stat-number">${approvalStats.rejected}</div><div class="stat-name">Rejected</div></div>
          <div class="stat-item"><div class="stat-number">${approvalRate}%</div><div class="stat-name">Approval Rate</div></div>
        </div>

        ${registeredModules.filter(m => m.currentMode !== 'inherit').length > 0 ? `
          <h5>Module Overrides</h5>
          <div class="override-list scrollable">
            ${registeredModules.filter(m => m.currentMode !== 'inherit').map(m => `
              <div class="override-item">
                <span class="module-name">${m.id}</span>
                <span class="module-mode">${m.effectiveMode === 'autonomous' ? '⚙' : '⚇'} ${m.effectiveMode}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        ${approvalStats.history.length > 0 ? `
          <h5>Recent Approvals</h5>
          <div class="history-list scrollable">
            ${approvalStats.history.slice(0, 10).map(h => `
              <div class="history-item ${h.outcome}">
                <span class="history-icon">${h.outcome === 'approved' ? '✓' : h.outcome === 'rejected' ? '✗' : '⏱'}</span>
                <span class="history-time">${formatTimestamp(h.timestamp)}</span>
                ${h.reason ? `<span class="history-reason">${h.reason}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="button-group">
          <button id="toggle-mode">${config.masterMode === 'autonomous' ? '⚇ Enable HITL' : '⚙ Enable Auto'}</button>
          <button id="reset" class="danger">↻ Reset All</button>
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.getElementById('toggle-mode')?.addEventListener('click', () => {
      this._api.setMasterMode(config.masterMode === 'autonomous' ? 'hitl' : 'autonomous');
      this.render();
    });

    this.shadowRoot.getElementById('reset')?.addEventListener('click', () => {
      this._api.resetToDefaults();
      this.render();
    });
  }
}

// Register custom element
if (!customElements.get('hitl-controller-widget')) {
  customElements.define('hitl-controller-widget', HITLControllerWidget);
}

const widget = {
  element: 'hitl-controller-widget',
  displayName: 'HITL Controller',
  icon: '⚙',
  category: 'core',
  order: 15,
  updateInterval: null // Event-driven, no polling needed
};
```

**Widget Features:**
- **Module API Access**: Widget uses `moduleApi` setter to receive API reference, accesses state via `getState()`.
- **Status Reporting**: `getStatus()` provides master mode, pending approval count, warning state.
- **Mode Overview**: Shows master mode, registered module count, pending approvals (highlighted if > 0).
- **Approval Statistics**: Shows total, approved, rejected, approval rate (color-coded).
- **Module Overrides**: Lists modules with explicit mode overrides (not `inherit`).
- **Approval History**: Shows last 10 approvals with outcome (approved/rejected/timeout), timestamp, reason.
- **Interactive Controls**: Toggle master mode (HITL ↔ Autonomous), Reset to defaults button.
- **EventBus Integration**: Real-time updates on mode changes, approvals, rejections.
- **Color Coding**: Green (approved), red (rejected), orange (timeout/warning).
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core HITL Controller Implementation

1. **Initialization**
   - Define `STORAGE_KEY = 'REPLOID_HITL_CONFIG'`
   - Initialize `moduleRegistry = new Map()`
   - Initialize `config = { masterMode: 'hitl', moduleOverrides: {}, approvalQueue: [] }`
   - Load saved configuration from localStorage
   - Register EventBus listeners for mode changes and approval flow
   - Log master mode on startup

2. **Module Registration**
   - Implement `registerModule(moduleId, capabilities, description)`:
     - Validate `moduleId` is provided
     - Store in `moduleRegistry` with: `{ id, description, capabilities, currentMode, registeredAt }`
     - Set `currentMode` from `config.moduleOverrides[moduleId]` or `'inherit'`
     - Emit `hitl:module-registered` event
   - Define `HITL_CAPABILITIES` constants for approval types

3. **Mode Management**
   - Implement `getModuleMode(moduleId)`:
     - Check `config.moduleOverrides[moduleId]`
     - If override exists and != `'inherit'`, return it
     - Otherwise, return `config.masterMode`
   - Implement `setMasterMode(mode)`:
     - Validate mode (`'hitl'` or `'autonomous'`)
     - Update `config.masterMode`
     - Save configuration
     - Emit `hitl:master-mode-changed` with affected modules
   - Implement `setModuleMode({ moduleId, mode })`:
     - Validate module is registered
     - Validate mode (`'hitl'`, `'autonomous'`, `'inherit'`)
     - Update `config.moduleOverrides[moduleId]`
     - Update `moduleRegistry` entry
     - Save configuration
     - Emit `hitl:module-mode-changed`

4. **Approval Flow**
   - Implement `requiresApproval(moduleId, capability)`:
     - Get effective mode via `getModuleMode(moduleId)`
     - If `autonomous`, return `false`
     - Check if module has this capability in registry
     - Return `true` if capability matches
   - Implement `handleApprovalRequest(request)`:
     - Extract: `moduleId`, `capability`, `action`, `data`, `onApprove`, `onReject`, `timeout`
     - Check `requiresApproval(moduleId, capability)`
     - If not required, auto-approve and call `onApprove(data)`
     - Otherwise:
       - Generate `approvalId = ${moduleId}-${Date.now()}`
       - Create `approvalItem` with all details, `status: 'pending'`
       - Add to `config.approvalQueue`
       - Emit `hitl:approval-pending`
       - Set timeout if specified (auto-reject on timeout)
   - Implement `handleApprove({ approvalId, data })`:
     - Find item in queue by `approvalId`
     - Update `status = 'approved'`
     - Call `onApprove(data || item.data)`
     - Remove from queue
     - Emit `hitl:approval-granted`
   - Implement `handleReject({ approvalId, reason })`:
     - Find item in queue by `approvalId`
     - Update `status = 'rejected'`, store `rejectionReason`
     - Call `onReject(reason)`
     - Remove from queue
     - Emit `hitl:approval-rejected`

5. **Statistics Tracking**
   - Initialize `approvalStats = { total: 0, approved: 0, rejected: 0, timedOut: 0, history: [] }`
   - Wrap `handleApprove` and `handleReject` to track stats:
     - Increment counters
     - Add to `history` array (outcome, reason, timestamp)
     - Keep only last 50 entries
   - Expose via `getApprovalStats()`

6. **Persistence**
   - Implement `saveConfig()`:
     - Extract `{ masterMode, moduleOverrides }` from `config`
     - Store in localStorage with `STORAGE_KEY`
   - Implement `loadConfig()`:
     - Retrieve from localStorage
     - Parse JSON, apply to `config`
     - Use defaults if not found or error

7. **Query APIs**
   - Implement `getConfig()`: Return `{ masterMode, moduleOverrides, registeredModules, pendingApprovals }`
   - Implement `getRegisteredModules()`: Return array of modules with `effectiveMode`
   - Implement `getApprovalQueue()`: Return copy of `approvalQueue`
   - Implement `getAffectedModules()`: Return modules using master mode (`inherit` override)
   - Implement `getState()`: Return `{ config, approvalStats, registeredModules, approvalQueue }`

8. **Utilities**
   - Implement `resetToDefaults()`:
     - Set `masterMode = 'hitl'`
     - Clear `moduleOverrides = {}`
     - Clear `approvalQueue = []`
     - Save configuration
     - Emit `hitl:config-reset`

#### Widget Implementation (Web Component)

9. **Define Web Component Class** in hitl-controller.js:
   ```javascript
   class HITLControllerWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
       this._eventBus = null;
     }
   }
   ```

10. **Implement Lifecycle Methods**:
    - `connectedCallback()`:
      - Resolve EventBus from DIContainer
      - Initial render
      - Subscribe to 6 EventBus events (mode changes, approvals, rejections, config reset)
      - Store handler reference for cleanup
    - `disconnectedCallback()`: Unsubscribe from all 6 EventBus events to prevent memory leaks

11. **Implement getStatus()** as class method:
    - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
    - Access module state via `this._api.getState()`
    - State logic:
      - `warning` if `approvalQueue.length > 0`
      - `idle` otherwise
    - Primary metric: Show master mode (HITL or Auto)
    - Secondary metric: Show pending approval count or "No pending"
    - Last activity: Timestamp of first pending approval (if any)
    - Message: Number of approvals needed (if > 0)

12. **Implement render()** method:
    - Set `this.shadowRoot.innerHTML` with encapsulated styles
    - Call `this._api.getState()` to get current state
    - Render mode overview grid (master mode, registered modules, pending approvals)
    - Render approval statistics grid (total, approved, rejected, approval rate)
    - Render module overrides list (only modules with explicit overrides)
    - Render approval history (last 10 items, color-coded by outcome)
    - Render action buttons (toggle master mode, reset to defaults)
    - Attach event listeners to buttons:
      - Toggle mode: Call `setMasterMode()`, re-render
      - Reset: Call `resetToDefaults()`, re-render

13. **Register Custom Element**:
    - Use kebab-case naming: `hitl-controller-widget`
    - Add duplicate check: `if (!customElements.get('hitl-controller-widget'))`
    - Call `customElements.define('hitl-controller-widget', HITLControllerWidget)`

14. **Return Widget Object** with new format:
    - `{ element: 'hitl-controller-widget', displayName: 'HITL Controller', icon: '⚙', category: 'core', order: 15, updateInterval: null }`
    - Note: `updateInterval: null` because widget uses event-driven updates (no polling needed)

15. **Test** Shadow DOM rendering, EventBus subscription/cleanup, mode changes, approval flow, statistics tracking, persistence

### 4. Verification Checklist

- [ ] `registerModule()` adds modules to registry correctly
- [ ] `getModuleMode()` respects overrides and falls back to master mode
- [ ] `requiresApproval()` returns false in autonomous mode
- [ ] `requiresApproval()` checks capability matching correctly
- [ ] `setMasterMode()` updates config, saves, emits event
- [ ] `setModuleMode()` validates mode, updates config, saves, emits event
- [ ] `handleApprovalRequest()` auto-approves when not required
- [ ] `handleApprovalRequest()` adds to queue when required
- [ ] Timeout mechanism auto-rejects pending approvals
- [ ] `handleApprove()` calls callback, removes from queue, emits event
- [ ] `handleReject()` calls callback, removes from queue, emits event
- [ ] Statistics tracking increments counters correctly
- [ ] History tracking keeps last 50 entries
- [ ] `saveConfig()` / `loadConfig()` round-trip works
- [ ] `resetToDefaults()` clears overrides and queue
- [ ] Widget displays master mode, pending count, statistics
- [ ] Widget toggle button switches between HITL and Autonomous
- [ ] Widget reset button clears all overrides
- [ ] Widget re-renders on EventBus events
- [ ] Widget cleanup prevents memory leaks

### 5. Extension Opportunities

- Add approval priority levels (high, medium, low)
- Add approval delegation (assign approvals to specific users)
- Add approval templates (pre-defined approval workflows)
- Add approval audit trail (who approved/rejected, when, why)
- Add approval notifications (desktop notifications, email, Slack)
- Add approval analytics dashboard (approval time, bottlenecks, trends)
- Add conditional auto-approval rules (e.g., auto-approve tool execution on weekends)
- Add module capability introspection (query which capabilities a module has)
- Add approval batching (approve multiple similar actions at once)
- Add approval history export (download CSV/JSON)

Maintain this blueprint as the HITL controller capabilities evolve or new approval mechanisms are introduced.
