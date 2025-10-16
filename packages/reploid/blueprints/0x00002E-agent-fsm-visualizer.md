# Blueprint 0x00002E: Agent FSM Visualizer

**Objective:** Capture the design of the D3.js visualization that renders Sentinel’s finite-state machine in real time.

**Target Upgrade:** AVIS (`agent-visualizer.js`)

**Prerequisites:** 0x00000D (UI Manager), 0x000002 (Application Orchestration), 0x00002C (Performance Monitoring Stack), Sentinel FSM schema (`/upgrades/sentinel-fsm.js`)

**Affected Artifacts:** `/upgrades/agent-visualizer.js`, `/styles/dashboard.css`, `/upgrades/sentinel-fsm.js`

---

### 1. The Strategic Imperative
Sentinel’s approval workflow spans multiple states (context curation, proposal drafting, application, reflection). Operators need a living diagram to:
- Verify the agent obeys allowed transitions.
- Spot loops (e.g., repeated context gathering) in real time.
- Provide visual cues during incident response (highlighting `ERROR` state).

An accurate visualization keeps human overseers in the loop.

### 2. Architectural Overview
The visualizer instantiates once and renders a D3 force-directed graph.

```javascript
const fsmViz = await ModuleLoader.getModule('AgentVisualizer');
fsmViz.init(document.getElementById('fsm-container'));
```

Key components:
- **State Catalog**
  - `FSM_STATES` maps state → icon, colour, label.
  - `VALID_TRANSITIONS` defines directed links.
- **Graph Builder**
  - `buildGraphData()` constructs nodes with visit counts and links with transition counts.
  - Historical transitions (from `stateHistory`) increment counters for thickness/opacity.
- **D3 Simulation**
  - `forceSimulation` manages layout with link distance, charge repulsion, and collision.
  - Zoom behaviour enables pan/zoom without losing context.
- **State Updates**
  - Listens to `SentinelFSM` events (`state:change`, `state:error`) via EventBus.
  - Updates node `isActive` and link classes, re-rendering with transitions.
- **History Trail**
  - Maintains a `stateHistory` array to track the last N transitions for analytics.

### 3. Implementation Pathway
1. **Initialization**
   - Validate D3 presence; warn and bail if missing.
   - Create SVG root with responsive `viewBox`.
   - Append `defs` for arrow markers (default and active).
2. **Rendering**
   - Bind nodes to groups containing circle, icon text, and label.
   - Bind links to lines with stroke width proportional to `transitionCount`.
   - On simulation tick, update positions.
3. **Event Integration**
   - Subscribe to `SentinelFSM.onStateChange` to update `currentState` and push to history.
   - Emit UI events or toast notifications when hitting `ERROR`.
4. **User Interaction**
   - Provide node tooltips summarising visit/transition counts.
   - Allow clicking a state to focus or show additional context (e.g., queued proposals).
5. **Cleanup**
   - Expose `destroy()` to remove SVG and listeners when the persona disables the dashboard.

### 4. Verification Checklist
- [ ] All valid transitions appear; invalid ones never render.
- [ ] Active state glows or pulses, updating within one frame.
- [ ] Zoom/pan resets gracefully; double-click resets transform.
- [ ] Works with partial history (e.g., just booted).
- [ ] Handles FSM schema changes (new states) by regenerating nodes dynamically.

### 5. Extension Opportunities
- **Timeline View**: stack state changes on a horizontal axis for historical replay.
- **Alert Rules**: auto-raise toast if stuck in `AWAITING_*` for too long.
- **Integration with Penteract analytics**: overlay persona-specific state usage.

This blueprint ensures the visualization stays explainable and trustworthy as the FSM evolves.
