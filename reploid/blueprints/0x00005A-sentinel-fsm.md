# Blueprint 0x000051: Sentinel Finite State Machine

**Target Upgrade:** SFSM (`sentinel-fsm.js`)

**Objective:** Implement a robust finite state machine that manages the Sentinel Agent's cognitive cycle through well-defined states and transitions, ensuring safe and predictable self-modification behavior.

**Prerequisites:** 0x000008 (Agent Cognitive Cycle), 0x000005 (State Management), 0x00000A (Tool Runner Engine)

**Affected Artifacts:** `/upgrades/sentinel-fsm.js`, `/upgrades/sentinel-tools.js`, `/upgrades/agent-cycle.js`

---

## Section 1: The Strategic Imperative

The Sentinel Agent requires a structured cognitive cycle to safely modify itself. Without a formal state machine, the agent could:
- Enter invalid states (e.g., applying changes before approval)
- Skip critical safety checkpoints (e.g., verification before commit)
- Lose track of multi-step operations during errors
- Create race conditions between concurrent modifications

A Finite State Machine (FSM) provides:
- **Deterministic Behavior**: Clear transitions between states
- **Safety Guarantees**: Invalid transitions are rejected
- **Recovery Paths**: Error states with rollback capabilities
- **Auditability**: Complete state history for debugging and learning

---

## Section 2: The Architectural Solution

### 2.1 State Definition

The Sentinel FSM defines 9 distinct states in the cognitive cycle:

```javascript
const validTransitions = {
  'IDLE': ['CURATING_CONTEXT'],
  'CURATING_CONTEXT': ['AWAITING_CONTEXT_APPROVAL', 'ERROR'],
  'AWAITING_CONTEXT_APPROVAL': ['PLANNING_WITH_CONTEXT', 'CURATING_CONTEXT', 'IDLE'],
  'PLANNING_WITH_CONTEXT': ['GENERATING_PROPOSAL', 'ERROR'],
  'GENERATING_PROPOSAL': ['AWAITING_PROPOSAL_APPROVAL', 'ERROR'],
  'AWAITING_PROPOSAL_APPROVAL': ['APPLYING_CHANGESET', 'PLANNING_WITH_CONTEXT', 'IDLE'],
  'APPLYING_CHANGESET': ['REFLECTING', 'ERROR'],
  'REFLECTING': ['IDLE', 'CURATING_CONTEXT'],
  'ERROR': ['IDLE']
};
```

**State Descriptions:**

1. **IDLE**: Waiting for user goal or autonomous trigger
2. **CURATING_CONTEXT**: Selecting relevant files and blueprints for the task
3. **AWAITING_CONTEXT_APPROVAL**: Paused, waiting for user to approve selected context
4. **PLANNING_WITH_CONTEXT**: Using LLM to analyze context and plan changes
5. **GENERATING_PROPOSAL**: Creating DOGS changesets based on plan
6. **AWAITING_PROPOSAL_APPROVAL**: Paused, waiting for user to approve proposed changes
7. **APPLYING_CHANGESET**: Executing approved DOGS operations
8. **REFLECTING**: Learning from the outcome and storing insights
9. **ERROR**: Handling failures with rollback capability

### 2.2 State Transition Logic

```javascript
const transitionTo = (newState) => {
  const oldState = currentState;

  // Validate transition
  if (!validTransitions[currentState]?.includes(newState)) {
    logger.error(`[SentinelFSM] Invalid transition: ${currentState} -> ${newState}`);
    return false;
  }

  // Update state
  currentState = newState;

  // Record history
  stateHistory.push({
    from: oldState,
    to: newState,
    timestamp: Date.now(),
    context: cycleContext?.goal || null
  });

  // Update UI
  updateStatusUI(newState);

  // Emit event
  EventBus.emit('fsm:transition', { from: oldState, to: newState });

  logger.info(`[SentinelFSM] ${oldState} -> ${newState}`);
  return true;
};
```

### 2.3 Cycle Context

Each cognitive cycle maintains context throughout its lifetime:

```javascript
cycleContext = {
  goal: "User-provided goal",
  selectedFiles: [],
  blueprint: null,
  plan: null,
  changeset: null,
  checkpoint: null,
  reflections: [],
  startTime: Date.now(),
  metadata: {}
};
```

### 2.4 Safety Mechanisms

**Checkpoint Management:**
```javascript
// Create checkpoint before applying changes
const checkpoint = await StateManager.createCheckpoint();
cycleContext.checkpoint = checkpoint;

// Rollback on error
if (error) {
  await StateManager.restoreCheckpoint(checkpoint.id);
}
```

**State Validation:**
```javascript
// Prevent invalid operations based on current state
const canApplyChanges = () => {
  return currentState === 'AWAITING_PROPOSAL_APPROVAL';
};
```

### 2.5 Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class SentinelFSMWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every second when active
    this._interval = setInterval(() => this.render(), 1000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const isActive = currentState !== 'IDLE' && currentState !== 'ERROR';
    const cycleNum = stateHistory.length > 0 ? Math.floor(stateHistory.length / 9) + 1 : 0;

    return {
      state: isActive ? 'active' : (currentState === 'ERROR' ? 'error' : 'idle'),
      primaryMetric: `State: ${currentState}`,
      secondaryMetric: cycleContext ? `Cycle: ${cycleNum}` : 'No active cycle',
      lastActivity: stateHistory.length > 0 ? stateHistory[stateHistory.length - 1].timestamp : null,
      message: currentState === 'ERROR' ? 'FSM encountered an error' : null
    };
  }

  getControls() {
    const controls = [];
    if (currentState === 'IDLE') {
      controls.push({
        id: 'test-cycle',
        label: '▶ Test Cycle',
        action: () => {
          startCycle('Test goal: Verify FSM functionality');
          return { success: true, message: 'Test cycle started' };
        }
      });
    } else if (currentState !== 'ERROR') {
      controls.push({
        id: 'pause',
        label: '⏸ Pause',
        action: () => {
          pauseCycle();
          return { success: true, message: 'Cycle paused' };
        }
      });
    }
    return controls;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .fsm-panel { padding: 12px; color: #fff; }
        .state-display {
          background: rgba(0,255,255,0.1);
          padding: 15px;
          border-radius: 5px;
          margin-bottom: 15px;
        }
        .state-name {
          font-size: 18px;
          font-weight: bold;
          color: #0ff;
        }
        .state-history {
          max-height: 300px;
          overflow-y: auto;
        }
        .history-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          margin-bottom: 5px;
          border-left: 3px solid #0ff;
        }
      </style>
      <div class="fsm-panel">
        <h4>🔄 Sentinel FSM</h4>
        <div class="state-display">
          <div class="state-name">${currentState}</div>
          <div>${cycleContext ? cycleContext.goal : 'No active cycle'}</div>
        </div>
        <div class="state-history">
          <!-- Recent state transitions -->
        </div>
      </div>
    `;
  }
}

// Register custom element
const elementName = 'sentinel-fsm-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, SentinelFSMWidget);
}

const widget = {
  element: elementName,
  displayName: 'Sentinel FSM',
  icon: '🔄',
  category: 'agent'
};
```

**Key features:**
- Real-time display of current FSM state
- Visual state history tracking
- Controls to start test cycles or pause active cycles
- Color-coded state indicators (idle/active/error)
- Auto-refresh to track state changes
- Uses closure access to module state (currentState, cycleContext, stateHistory)
- Shadow DOM encapsulation for styling

---

## Section 3: The Implementation Pathway

### Step 1: Define State Machine Structure
1. Create state transition map with valid transitions
2. Initialize state variables (currentState, cycleContext, stateHistory)
3. Define state-specific handlers for each transition

### Step 2: Implement Transition Logic
1. Create `transitionTo(newState)` function with validation
2. Add state history tracking for audit trail
3. Implement event emission for UI updates
4. Add logging for debugging state changes

### Step 3: Implement Cycle Management
1. Create `startCycle(goal)` to begin IDLE -> CURATING_CONTEXT
2. Implement checkpoint creation before dangerous transitions
3. Add `pauseCycle()` and `resumeCycle()` for manual control
4. Create `resetFSM()` for error recovery

### Step 4: Integrate with Sentinel Tools
1. Connect state transitions to SentinelTools commands
2. Implement approval gates (AWAITING_*_APPROVAL states)
3. Add automatic transitions for successful operations
4. Handle errors with rollback to ERROR state

### Step 5: Add Safety Mechanisms
1. Implement checkpoint creation/restoration
2. Add state validation before critical operations
3. Create timeout handlers for stuck states
4. Implement deadlock detection

### Step 6: Implement Reflection State
1. Create REFLECTING state handler
2. Store insights from successful/failed cycles
3. Feed learnings into ReflectionStore
4. Transition back to IDLE or restart with insights

### Step 7: Create Web Component Widget
1. Define widget class extending HTMLElement
2. Add Shadow DOM in constructor
3. Implement lifecycle methods (connectedCallback, disconnectedCallback)
4. Implement getStatus() with 5 required fields
5. Implement getControls() for state transitions
6. Implement render() method with state visualization
7. Register custom element
8. Return widget object with metadata

### Step 8: Testing & Verification
1. Test all valid transitions
2. Verify invalid transitions are rejected
3. Test checkpoint/rollback functionality
4. Verify state history tracking accuracy
5. Test error recovery paths

---

## Success Criteria

- ✅ All state transitions follow the defined FSM graph
- ✅ Invalid transitions are rejected with error logging
- ✅ State history is accurately recorded
- ✅ Checkpoints prevent data loss during errors
- ✅ UI updates reflect current state in real-time
- ✅ Approval gates prevent unauthorized modifications
- ✅ Error states trigger appropriate rollback
- ✅ Reflection state stores learnings for future cycles

---

**Last Updated**: 2025-10-19
**Status**: COMPLETE - Production ready
