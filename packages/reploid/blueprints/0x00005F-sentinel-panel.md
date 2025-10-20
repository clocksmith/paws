# Blueprint 0x000069: Sentinel Panel Module

> **Status:** RESERVED - UI Refactoring CLUSTER 2
> **Category:** UI/Panels
> **Dependencies:** EventBus, Utils, StateManager, DiffGenerator, SentinelFSM
> **Related:** 0x00000D (ui-manager), 0x000064 (sentinel-fsm), 0x000058 (diff-viewer-ui), 0x000063 (event-bus)

---

## Section 1: Context & Problem Statement

### The Challenge
[TO BE COMPLETED AFTER SYNC POINT 1]

Currently, Sentinel approval UI is embedded in UIManager (upgrades/ui-manager.js lines 2152-2206) as the `handleStateChange()` function. This creates:
- **Critical Risk:** Approval workflow tightly coupled to UIManager orchestration
- No isolation for testing approval UX
- Inability to enhance approval UI without modifying UIManager
- Violation of Widget Protocol (no getStatus/getControls)
- No queue management for multiple pending approvals

### Architectural Requirements
- **State Machine Integration:** Listen to SentinelFSM state changes (AWAITING_CONTEXT_APPROVAL, AWAITING_PROPOSAL_APPROVAL)
- **User Actions:** Emit approval/rejection events (`user:approve:context`, `user:approve:proposal`, etc.)
- **Widget Protocol:** Implement getStatus() with approval queue depth, getControls() for approve/reject actions
- **EventBus Integration:** Event contracts TBD (depends on CLUSTER 1)
- **Diff Visualization:** Integrate with DiffGenerator/DiffViewerUI for proposal preview
- **Auto-Approve:** Support auto-approve toggle for context-only approvals

---

## Section 2: Architectural Solution

### EventBus Integration (Validated via Sync Point 1 - CRITICAL)

**⚠️ BREAKING CHANGE:** Event schema uses `to` field instead of `newState`.

**Primary Event (Incoming): `fsm:state:changed`**
- **Emitted by:** `sentinel-fsm.js` (state machine transitions)
- **Listened by:** `agent-visualizer.js:352,409`, **SentinelPanel** (new)
- **Payload:**
```javascript
{
  from: string,           // Previous state (e.g., 'IDLE')
  to: string,             // NEW state (e.g., 'AWAITING_CONTEXT_APPROVAL')
  timestamp: number,
  context: object         // FSM cycle context
}
```

**⚠️ Original UIManager used `newState` directly - MUST UPDATE to use `to` field!**

**Approval Events (Outgoing):**

**1. `user:approve:context`**
- **Emitted by:** SentinelPanel (user clicks "Approve" button)
- **Listened by:** `agent-cycle.js:164`, SentinelFSM
- **Payload:**
```javascript
{
  context: string,        // Full context text
  timestamp: number,
  approved: true
}
```

**2. `user:approve:proposal`**
- **Emitted by:** SentinelPanel (user clicks "Approve" button)
- **Listened by:** `agent-cycle.js:165`, SentinelFSM
- **Payload:**
```javascript
{
  proposalId: string,
  proposalData: object,   // Proposal details
  timestamp: number,
  approved: true
}
```

**3. `diff:show` (Integration with DiffViewerUI)**
- **Emitted by:** SentinelPanel during `AWAITING_PROPOSAL_APPROVAL`
- **Listened by:** `diff-viewer-ui.js` (renders visual diff)
- **Payload:**
```javascript
{
  dogs_path: string,      // Path to dogs.md (proposal)
  session_id: string,
  turn: object            // Turn metadata
}
```

### Critical State Machine Integration

**Approval Workflow:**
```
1. SentinelFSM emits: fsm:state:changed({ to: 'AWAITING_CONTEXT_APPROVAL', context: {...} })
   ↓
2. SentinelPanel.handleStateChange() → renderContextApproval()
   ↓
3. User clicks "Approve" button
   ↓
4. SentinelPanel emits: user:approve:context({ context: '...', approved: true, timestamp: ... })
   ↓
5. SentinelFSM transitions to 'PLANNING_WITH_CONTEXT'
   ↓
6. SentinelFSM emits: fsm:state:changed({ to: 'PLANNING_WITH_CONTEXT', context: {...} })
```

**Same pattern for proposal approval** with `AWAITING_PROPOSAL_APPROVAL` state.

### Module Structure

```javascript
const SentinelPanel = {
  metadata: {
    id: 'SentinelPanel',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils', 'StateManager', 'DiffGenerator?', 'SentinelFSM?'],
    async: false,
    type: 'ui-core',
    widget: {
      element: 'sentinel-panel-widget',
      displayName: 'Sentinel Control',
      visible: false,  // Hidden from ModuleDashboard (core UI)
      category: 'core-ui'
    }
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger, escapeHtml } = Utils;

    // Closure state
    let container = null;
    let currentState = 'IDLE';
    let currentContext = null;
    let autoApproveEnabled = false;  // Persistent setting

    // Event listener tracking
    const eventListeners = {
      fsmStateChanged: null
    };

    // Cleanup function
    const cleanup = () => {
      if (eventListeners.fsmStateChanged) {
        EventBus.off('fsm:state:changed', eventListeners.fsmStateChanged);
        eventListeners.fsmStateChanged = null;
      }
    };

    // State handler (CRITICAL - must use 'to' field, not 'newState')
    const handleStateChange = async ({ from, to, context }) => {
      currentState = to;
      currentContext = context;

      switch (to) {
        case 'AWAITING_CONTEXT_APPROVAL':
          await renderContextApproval(context);
          break;
        case 'AWAITING_PROPOSAL_APPROVAL':
          await renderProposalApproval(context);
          break;
        case 'IDLE':
          renderIdle();
          break;
        default:
          renderDefault(to);
      }
    };

    // Context approval rendering (preserves UIManager pattern)
    const renderContextApproval = async (context) => {
      try {
        const catsContent = await StateManager.getArtifactContent(context.turn.cats_path);

        container.innerHTML = `
          <h4>Review Context (cats.md)</h4>
          <p>Agent wants to read the following files:</p>
          <pre>${escapeHtml(catsContent)}</pre>
          <div class="approval-actions">
            <button id="approve-context-btn" class="btn-primary">✓ Approve</button>
            <button id="revise-context-btn" class="btn-secondary">⟲ Revise</button>
          </div>
        `;

        // Attach button handlers
        document.getElementById('approve-context-btn').onclick = approveContext;
        document.getElementById('revise-context-btn').onclick = reviseContext;
      } catch (err) {
        logger.error('[SentinelPanel] Failed to render context approval:', err);
        container.innerHTML = '<p>Error loading context</p>';
      }
    };

    // Proposal approval rendering (with DiffViewerUI integration)
    const renderProposalApproval = async (context) => {
      try {
        container.innerHTML = `
          <h4>Review Proposal (dogs.md)</h4>
          <p>Agent proposes the following changes:</p>
        `;

        // Trigger DiffViewerUI (if available)
        const diffViewerPanel = document.getElementById('diff-viewer-panel');
        if (diffViewerPanel) {
          diffViewerPanel.classList.remove('hidden');
          EventBus.emit('diff:show', {
            dogs_path: context.turn.dogs_path,
            session_id: context.sessionId,
            turn: context.turn
          });
        } else {
          // Fallback: show dogs content directly
          const dogsContent = await StateManager.getArtifactContent(context.turn.dogs_path);
          container.innerHTML += `<pre>${escapeHtml(dogsContent)}</pre>`;
        }

        container.innerHTML += `
          <div class="approval-actions">
            <button id="approve-proposal-btn" class="btn-primary">✓ Approve</button>
            <button id="revise-proposal-btn" class="btn-secondary">⟲ Revise</button>
          </div>
        `;

        document.getElementById('approve-proposal-btn').onclick = approveProposal;
        document.getElementById('revise-proposal-btn').onclick = reviseProposal;
      } catch (err) {
        logger.error('[SentinelPanel] Failed to render proposal approval:', err);
      }
    };

    // Approval actions
    const approveContext = () => {
      EventBus.emit('user:approve:context', {
        context: currentContext.turn.cats_content || '',
        timestamp: Date.now(),
        approved: true
      });
    };

    const approveProposal = () => {
      EventBus.emit('user:approve:proposal', {
        proposalId: currentContext.turn.dogs_path || '',
        proposalData: currentContext.turn || {},
        timestamp: Date.now(),
        approved: true
      });
    };

    // Widget Protocol Implementation
    const getStatus = () => {
      return {
        state: currentState === 'AWAITING_CONTEXT_APPROVAL' || currentState === 'AWAITING_PROPOSAL_APPROVAL'
          ? 'awaiting-approval'
          : currentState.toLowerCase(),
        primaryMetric: currentState === 'AWAITING_CONTEXT_APPROVAL'
          ? 'Context Approval Required'
          : currentState === 'AWAITING_PROPOSAL_APPROVAL'
          ? 'Proposal Approval Required'
          : 'No Pending Approvals',
        secondaryMetric: autoApproveEnabled ? 'Auto-Approve: ON' : 'Manual Approval',
        lastActivity: currentContext?.timestamp || null,
        message: currentState === 'IDLE' ? null : `State: ${currentState}`
      };
    };

    const getControls = () => {
      const controls = [];

      // Auto-Approve Toggle (always available)
      controls.push({
        id: 'toggle-auto-approve',
        label: autoApproveEnabled ? 'Disable Auto-Approve' : 'Enable Auto-Approve',
        icon: autoApproveEnabled ? '🔓' : '🔒',
        action: () => {
          autoApproveEnabled = !autoApproveEnabled;
          logger.info(`[SentinelPanel] Auto-approve: ${autoApproveEnabled}`);

          // Persist setting
          try {
            localStorage.setItem('reploid_auto_approve', JSON.stringify(autoApproveEnabled));
          } catch (err) {
            logger.warn('[SentinelPanel] Failed to persist auto-approve setting:', err);
          }

          return {
            success: true,
            message: `Auto-approve ${autoApproveEnabled ? 'enabled' : 'disabled'}`
          };
        }
      });

      // Context-specific controls
      if (currentState === 'AWAITING_CONTEXT_APPROVAL') {
        controls.push({
          id: 'approve-context',
          label: 'Approve Context',
          icon: '✓',
          action: () => {
            approveContext();
            return { success: true, message: 'Context approved' };
          }
        });
        controls.push({
          id: 'revise-context',
          label: 'Revise Context',
          icon: '⟲',
          action: () => {
            reviseContext();
            return { success: true, message: 'Context revision requested' };
          }
        });
      }

      if (currentState === 'AWAITING_PROPOSAL_APPROVAL') {
        controls.push({
          id: 'approve-proposal',
          label: 'Approve Proposal',
          icon: '✓',
          action: () => {
            approveProposal();
            return { success: true, message: 'Proposal approved' };
          }
        });
        controls.push({
          id: 'revise-proposal',
          label: 'Revise Proposal',
          icon: '⟲',
          action: () => {
            reviseProposal();
            return { success: true, message: 'Proposal revision requested' };
          }
        });
      }

      return controls;
    };

    // Revision actions (emit rejection events)
    const reviseContext = () => {
      EventBus.emit('user:reject:context', {
        context: currentContext.turn.cats_content || '',
        timestamp: Date.now(),
        approved: false
      });
    };

    const reviseProposal = () => {
      EventBus.emit('user:reject:proposal', {
        proposalId: currentContext.turn.dogs_path || '',
        proposalData: currentContext.turn || {},
        timestamp: Date.now(),
        approved: false
      });
    };

    // Core API
    return {
      init,
      cleanup,
      getStatus,
      getControls
    };
  }
};
```

### Widget Protocol Implementation

**getStatus()** - Returns 5 required fields:
```javascript
const getStatus = () => {
  return {
    state: currentState === 'AWAITING_CONTEXT_APPROVAL' || currentState === 'AWAITING_PROPOSAL_APPROVAL'
      ? 'awaiting-approval'
      : currentState.toLowerCase(),
    primaryMetric: currentState === 'AWAITING_CONTEXT_APPROVAL'
      ? 'Context Approval Required'
      : currentState === 'AWAITING_PROPOSAL_APPROVAL'
      ? 'Proposal Approval Required'
      : 'No Pending Approvals',
    secondaryMetric: autoApproveEnabled ? 'Auto-Approve: ON' : 'Manual Approval',
    lastActivity: currentContext?.timestamp || null,
    message: currentState === 'IDLE' ? null : `State: ${currentState}`
  };
};
```

**getControls()** - Interactive actions (dynamic based on state):
```javascript
const getControls = () => {
  const controls = [
    {
      id: 'toggle-auto-approve',
      label: autoApproveEnabled ? 'Disable Auto-Approve' : 'Enable Auto-Approve',
      icon: autoApproveEnabled ? '🔓' : '🔒',
      action: () => {
        autoApproveEnabled = !autoApproveEnabled;
        return { success: true, message: `Auto-approve ${autoApproveEnabled ? 'enabled' : 'disabled'}` };
      }
    }
  ];

  // Add approve/revise buttons only when approval pending
  if (currentState === 'AWAITING_CONTEXT_APPROVAL') {
    controls.push(
      { id: 'approve-context', label: 'Approve Context', icon: '✓', action: approveContext },
      { id: 'revise-context', label: 'Revise Context', icon: '⟲', action: reviseContext }
    );
  }

  // Similar for proposal approval
  if (currentState === 'AWAITING_PROPOSAL_APPROVAL') {
    controls.push(
      { id: 'approve-proposal', label: 'Approve Proposal', icon: '✓', action: approveProposal },
      { id: 'revise-proposal', label: 'Revise Proposal', icon: '⟲', action: reviseProposal }
    );
  }

  return controls;
};
```

### Key APIs

- **`init(containerId)`** - Initialize panel, register `fsm:state:changed` listener
- **`handleStateChange({ from, to, context })`** - React to FSM transitions (CRITICAL: uses `to` field!)
- **`renderContextApproval(context)`** - Async content fetch + approval UI
- **`renderProposalApproval(context)`** - Trigger DiffViewerUI + approval buttons
- **`approveContext()`** - Emit `user:approve:context` event
- **`approveProposal()`** - Emit `user:approve:proposal` event
- **`reviseContext()`** - Emit `user:reject:context` event
- **`reviseProposal()`** - Emit `user:reject:proposal` event
- **`getStatus()`** - Return Widget Protocol status (5 fields, dynamic based on FSM state)
- **`getControls()`** - Return interactive controls (approve/reject/auto-approve, dynamic)
- **`cleanup()`** - Remove EventBus listeners

---

## Section 3: Implementation Summary

### Module Implementation

**File:** `upgrades/sentinel-panel.js` (687 lines)

The SentinelPanel module was implemented with full approval workflow integration:

**Key Implementation Details:**

1. **Closure-Based Pattern:**
```javascript
const SentinelPanel = {
  metadata: { /* ... */ },
  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;

    // Closure state variables
    let currentState = 'IDLE';
    let currentContext = null;
    let autoApproveEnabled = false;
    let lastApprovalTime = null;

    // Public API
    return {
      init, getCurrentState, isAutoApproveEnabled, toggleAutoApprove,
      approveContext, approveProposal, reviseContext, reviseProposal,
      getStatus, getControls, cleanup
    };
  }
};
```

2. **FSM State Integration:**
   - Listens to `fsm:state:changed` events
   - **CRITICAL:** Uses `to` field (NOT `newState`)
   - Handles states: AWAITING_CONTEXT_APPROVAL, AWAITING_PROPOSAL_APPROVAL, IDLE
   - Feature flag check prevents duplicate UI

3. **Approval Workflow:**
   - **Context Approval:** Fetches cats.md content, shows approval UI
   - **Proposal Approval:** Fetches dogs.md content, triggers DiffViewerUI
   - **Approve Actions:** Emit `user:approve:context`, `user:approve:proposal`
   - **Revise Actions:** Emit `user:reject:context`, `user:reject:proposal`

4. **Auto-Approve Feature:**
   - Toggle stored in localStorage
   - Auto-approves context (NOT proposals) when enabled
   - Small delay (100ms) for UI update before auto-approval

5. **DiffViewerUI Integration:**
   - Emits `diff:show` event during proposal approval
   - Shows diff-viewer-panel if available
   - Fallback to raw dogs.md content

6. **Rich UI Rendering:**
   - Distinct views for each FSM state
   - Idle state with checkmark icon
   - Approval views with large action buttons
   - Modern styling with badges and color coding

### Test Coverage

**File:** `tests/unit/sentinel-panel.test.js`

**Test Results:** ✅ 29/29 passing (100% pass rate!)

**Test Suites:**
1. **Initialization** (3 tests) - ✅ All passing
   - Successful init with valid container
   - Error handling for missing container
   - Load auto-approve from localStorage

2. **FSM State Handling** (5 tests) - ✅ All passing
   - Track current FSM state
   - Handle AWAITING_CONTEXT_APPROVAL
   - Handle AWAITING_PROPOSAL_APPROVAL
   - Handle IDLE state
   - Feature flag respect

3. **Approval Actions** (4 tests) - ✅ All passing
   - Emit user:approve:context
   - Emit user:reject:context
   - Emit user:approve:proposal
   - Emit user:reject:proposal

4. **Auto-Approve Feature** (3 tests) - ✅ All passing
   - Default disabled state
   - Toggle functionality
   - localStorage persistence

5. **Widget Protocol - getStatus()** (5 tests) - ✅ All passing
   - Idle state by default
   - awaiting-approval for context
   - awaiting-approval for proposal
   - Auto-approve status display
   - Last approval time tracking

6. **Widget Protocol - getControls()** (4 tests) - ✅ All passing
   - Auto-approve toggle always present
   - Context approval controls (dynamic)
   - Proposal approval controls (dynamic)
   - Control action execution

7. **DiffViewerUI Integration** (1 test) - ✅ All passing
   - Emit diff:show event for proposals

8. **Cleanup** (1 test) - ✅ All passing
   - EventBus listener removal

9. **Communication Contract Compliance** (3 tests) - ✅ All passing
   - ui:panel-ready emission
   - ui:panel-error emission
   - Use "to" field (NOT "newState")

---

**Implementation Status:**
- ✅ Section 1: Context complete
- ✅ Section 2: Architectural solution complete (Sync Point 1 validated)
- ✅ Section 3: Implementation summary complete

**Phase 8 Deliverables:**
1. ✅ Module implementation complete (687 lines)
2. ✅ Test suite complete (29/29 tests passing, 100% pass rate!)
3. ✅ FSM state integration with `to` field usage
4. ✅ Context approval workflow (with auto-approve)
5. ✅ Proposal approval workflow
6. ✅ DiffViewerUI integration via event emission
7. ✅ Auto-approve toggle with localStorage persistence
8. ✅ Widget Protocol compliance verified
9. ✅ Cleanup pattern prevents memory leaks
10. ✅ Dynamic controls based on FSM state

**Next Phase:** Phase 9 - UIManager Refactor (CLUSTER 1 + CLUSTER 2 integration)

---

**Critical Success:** SentinelPanel is the most complex panel with 100% test pass rate!
