# Blueprint 0x000052: HITL Control Panel UI

**Objective:** Provide a visual interface for managing Human-in-the-Loop vs Autonomous modes across modules with real-time approval queue management.

**Target Upgrade:** HITL_PANEL (`hitl-control-panel.js`)

**Prerequisites:** 0x00001C (HITL Controller), 0x000003 (Core Utilities)

**Affected Artifacts:** `/upgrades/hitl-control-panel.js`

---

### 1. The Strategic Imperative

The transition between **Human-in-the-Loop** and **Autonomous** modes is a critical control point for AI agent behavior. Without a visual interface, users must:
- Manually track which modules require approval
- Use code to change modes (no accessible UI)
- Miss pending approvals that block agent progress
- Lack visibility into the system's autonomy state

**The HITL Control Panel** provides:
- **Master Mode Toggle**: Switch entire system between HITL and Autonomous
- **Per-Module Overrides**: Fine-grained control over individual module behavior
- **Approval Queue**: Real-time display of pending approvals with approve/reject actions
- **Visual Feedback**: Clear indication of current system state and pending actions

This panel is the **command center** for autonomy management.

---

### 2. The Architectural Solution

The HITL Control Panel uses a **Web Component architecture** with Shadow DOM for encapsulated rendering and event-driven updates.

**Key Components:**

**1. Master Mode Control**

The panel displays the current master mode and provides toggle controls:

```javascript
// Master mode determines default behavior for all modules
config.masterMode === 'hitl'        // Human-in-Loop (requires approvals)
config.masterMode === 'autonomous'  // Autonomous (no approvals needed)
```

Visual indicators:
- `⚇` icon = Human-in-Loop mode
- `⚙` icon = Autonomous mode

**2. Module List with Per-Module Overrides**

Each registered module appears with:
- Current effective mode (inherited or overridden)
- Capabilities (what actions it can perform)
- Mode selector: Inherit, HITL, or Autonomous

```javascript
{
  id: 'MetaToolCreator',
  currentMode: 'inherit',        // Can be: 'inherit', 'hitl', 'autonomous'
  effectiveMode: 'autonomous',   // Actual mode after inheritance resolution
  capabilities: ['CREATE_TOOL', 'MODIFY_TOOL'],
  description: 'Creates new tools dynamically'
}
```

**3. Approval Queue**

Displays pending approval requests with:
- Action description
- Module requesting approval
- Capability being used
- Data payload (expandable)
- Approve/Reject buttons

```javascript
{
  id: 'approval-123',
  moduleId: 'MetaToolCreator',
  capability: 'CREATE_TOOL',
  action: 'Create new validation tool',
  data: { toolName: 'validate_input', ...},
  timestamp: Date.now()
}
```

**4. Web Component Widget**

The widget uses Shadow DOM for encapsulated rendering:

```javascript
class HITLControlPanelWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();

    // Listen for HITL events to trigger re-render
    this._listeners = [
      () => this.render(),  // master-mode-changed
      () => this.render(),  // module-mode-changed
      () => this.render(),  // module-registered
      () => this.render(),  // approval-pending
      () => this.render(),  // approval-granted
      () => this.render()   // approval-rejected
    ];

    EventBus.on('hitl:master-mode-changed', this._listeners[0]);
    EventBus.on('hitl:module-mode-changed', this._listeners[1]);
    EventBus.on('hitl:module-registered', this._listeners[2]);
    EventBus.on('hitl:approval-pending', this._listeners[3]);
    EventBus.on('hitl:approval-granted', this._listeners[4]);
    EventBus.on('hitl:approval-rejected', this._listeners[5]);
  }

  disconnectedCallback() {
    // Clean up event listeners to prevent memory leaks
    if (this._listeners) {
      EventBus.off('hitl:master-mode-changed', this._listeners[0]);
      EventBus.off('hitl:module-mode-changed', this._listeners[1]);
      EventBus.off('hitl:module-registered', this._listeners[2]);
      EventBus.off('hitl:approval-pending', this._listeners[3]);
      EventBus.off('hitl:approval-granted', this._listeners[4]);
      EventBus.off('hitl:approval-rejected', this._listeners[5]);
    }
  }

  getStatus() {
    const config = HITLController.getConfig();
    const queue = HITLController.getApprovalQueue();

    return {
      state: queue.length > 0 ? 'warning' : 'idle',
      primaryMetric: config.masterMode === 'autonomous' ? '⚙ Autonomous' : '⚇ Manual',
      secondaryMetric: `${config.registeredModules.length} modules`,
      lastActivity: queue.length > 0 ? queue[0].timestamp : null,
      message: queue.length > 0 ? `${queue.length} pending approval${queue.length > 1 ? 's' : ''}` : null
    };
  }

  render() {
    const config = HITLController.getConfig();
    const queue = HITLController.getApprovalQueue();
    const modules = config.registeredModules;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          color: #e0e0e0;
        }
        .widget-panel-content {
          padding: 12px;
          background: #1a1a1a;
          border-radius: 4px;
        }
        button {
          padding: 6px 12px;
          background: #333;
          color: #e0e0e0;
          border: 1px solid #555;
          border-radius: 3px;
          cursor: pointer;
        }
        button:hover {
          background: #444;
        }
      </style>

      <div class="widget-panel-content">
        <div class="controls">
          ${config.masterMode === 'autonomous' ? `
            <button class="switch-to-hitl">⚇ Switch to HITL</button>
          ` : `
            <button class="switch-to-auto">⚙ Switch to Autonomous</button>
          `}
          <button class="reset">↻ Reset to Defaults</button>
        </div>

        <!-- Module list -->
        <div class="modules">
          ${modules.map(m => `<div>${m.id}: ${m.effectiveMode}</div>`).join('')}
        </div>

        <!-- Approval queue -->
        ${queue.length > 0 ? `
          <div class="approvals">
            <h4>Pending Approvals (${queue.length})</h4>
            ${queue.map(item => `
              <div class="approval-item">
                <strong>${item.action}</strong>
                <button class="approve-btn" data-id="${item.id}">✓ Approve</button>
                <button class="reject-btn" data-id="${item.id}">✗ Reject</button>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Attach event listeners for interactive controls
    this.shadowRoot.querySelector('.switch-to-hitl')?.addEventListener('click', () => {
      HITLController.setMasterMode('hitl');
    });

    this.shadowRoot.querySelector('.switch-to-auto')?.addEventListener('click', () => {
      HITLController.setMasterMode('autonomous');
    });

    this.shadowRoot.querySelector('.reset')?.addEventListener('click', () => {
      if (confirm('Reset all modules to HITL mode?')) {
        HITLController.resetToDefaults();
      }
    });

    // Approval buttons
    this.shadowRoot.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const approvalId = e.target.dataset.id;
        HITLController.approve({ approvalId });
      });
    });

    this.shadowRoot.querySelectorAll('.reject-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const approvalId = e.target.dataset.id;
        const reason = prompt('Rejection reason (optional):') || 'User rejected';
        HITLController.reject({ approvalId, reason });
      });
    });
  }
}

// Register custom element with duplicate check
if (!customElements.get('hitl-control-panel-widget')) {
  customElements.define('hitl-control-panel-widget', HITLControlPanelWidget);
}

const widget = {
  element: 'hitl-control-panel-widget',
  displayName: 'HITL Control Panel',
  icon: '⚇',
  category: 'ui'
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Event-driven updates (6 EventBus listeners) ensure real-time UI sync
- Lifecycle methods ensure proper cleanup of event listeners
- Closure access to HITLController eliminates injection complexity
- Interactive controls (buttons) for all user actions

---

### 3. The Implementation Pathway

**Phase 1: Core UI Structure (Complete)**
1. ✅ Define module metadata and dependencies (HITLController, EventBus, Utils)
2. ✅ Create rendering functions for master mode toggle
3. ✅ Create rendering functions for module list
4. ✅ Create rendering functions for approval queue
5. ✅ Implement event handlers for HITL events

**Phase 2: Web Component Widget (Complete)**
1. ✅ **Define Web Component class** `HITLControlPanelWidget` extending HTMLElement inside factory function
2. ✅ **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
3. ✅ **Implement lifecycle methods**:
   - `connectedCallback()`: Initial render and EventBus listener setup
   - `disconnectedCallback()`: Clean up all 6 event listeners to prevent memory leaks
4. ✅ **Implement getStatus()** as class method with closure access to:
   - HITLController (for config and approval queue)
   - Returns state 'warning' if pending approvals, 'idle' otherwise
   - Primary metric shows current master mode (⚙ Autonomous or ⚇ Manual)
   - Secondary metric shows registered module count
5. ✅ **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Use template literals for dynamic content (modules, approvals)
   - Include `<style>` tag with `:host` selector and scoped classes
   - Attach event listeners to interactive controls (mode toggle, approve/reject buttons)
6. ✅ **Register custom element**:
   - Use kebab-case naming: `hitl-control-panel-widget`
   - Add duplicate check: `if (!customElements.get(...))`
   - Call `customElements.define('hitl-control-panel-widget', HITLControlPanelWidget)`
7. ✅ **Return widget object** with new format:
   - `{ element: 'hitl-control-panel-widget', displayName, icon, category }`
   - No `renderPanel`, `getStatus`, `updateInterval` in widget object (handled by class)
8. ✅ **Test** Shadow DOM rendering and event listener cleanup

**Phase 3: Integration (Complete)**
1. ✅ Wire up to HITLController for state queries
2. ✅ Subscribe to all 6 HITL events for real-time updates
3. ✅ Expose public API for onclick handlers (window.HITLPanel)

**Phase 4: Enhancements (Future)**
1. ❌ Add keyboard shortcuts for approve/reject
2. ❌ Add approval history view
3. ❌ Add module capability filtering
4. ❌ Add export/import of HITL configurations

---

## Module Interface

### Public API

**Initialize (legacy non-Web Component API):**
```javascript
HITLControlPanel.init(containerElement, approvalQueueContainer);
```

**Widget (Web Component API):**
```javascript
// The widget automatically renders when added to DOM
const widget = document.createElement('hitl-control-panel-widget');
document.body.appendChild(widget);

// Widget auto-updates via EventBus listeners
```

---

## Event System

**Listened Events (6 total):**

```javascript
EventBus.on('hitl:master-mode-changed', onMasterModeChanged);     // Re-render on master mode change
EventBus.on('hitl:module-mode-changed', onModuleModeChanged);     // Re-render on module mode change
EventBus.on('hitl:module-registered', onModuleRegistered);         // Re-render when new module added
EventBus.on('hitl:approval-pending', onApprovalPending);           // Re-render approval queue
EventBus.on('hitl:approval-granted', onApprovalGranted);           // Re-render approval queue
EventBus.on('hitl:approval-rejected', onApprovalRejected);         // Re-render approval queue
```

---

## Success Criteria

**Immediate (Testing):**
- ✅ Displays current master mode accurately
- ✅ Lists all registered modules with correct modes
- ✅ Shows pending approvals in real-time
- ✅ Approve button grants approval successfully
- ✅ Reject button rejects approval successfully
- ✅ Mode toggles update system state

**Integration:**
- ✅ Web Component renders in widget panel
- ✅ Real-time updates via EventBus
- ✅ Shadow DOM prevents style conflicts
- ✅ Event listeners cleaned up on disconnect

**User Experience:**
- ❌ Keyboard shortcuts for faster approval workflow
- ❌ Persisted HITL configuration across sessions
- ❌ Export/import of module mode configurations

---

## Known Limitations

1. **No persistence** - Mode settings reset on page reload (mitigated by default master mode)
2. **No approval history** - Approved/rejected items disappear from UI
3. **No module search** - Hard to find specific modules when many registered
4. **Approval data not formatted** - JSON dump not user-friendly

---

## Future Enhancements

1. **Persistent Configuration** - Store HITL modes in StateManager/Storage
2. **Approval History** - Keep log of all approval decisions
3. **Module Filtering** - Search/filter modules by name or capability
4. **Formatted Data Display** - Pretty-print approval payloads
5. **Approval Templates** - Save common approval/rejection reasons
6. **Batch Operations** - Approve/reject multiple items at once

---

**Remember:** This is the **UI layer** for HITL control. The actual approval logic lives in `HITLController` (0x00001C).

The control panel makes autonomy management **visual and accessible**.
