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

### 2. Architectural Solution
The visualizer is implemented as a **Web Component widget** that renders a D3 force-directed graph with Shadow DOM encapsulation.

```javascript
// Web Component class pattern
class AgentVisualizerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._updateInterval = setInterval(() => this.render(), 1000);
    if (SentinelFSM) {
      currentState = SentinelFSM.getCurrentState();
      stateHistory = SentinelFSM.getStateHistory().slice();
    }
    EventBus.on('fsm:state:changed', onStateChange, 'AgentVisualizer');
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
  }

  getStatus() {
    return {
      state: currentState === 'IDLE' ? 'idle' : (isActive ? 'active' : 'idle'),
      primaryMetric: `State: ${currentState}`,
      secondaryMetric: `${transitionCount} transitions`,
      lastActivity: recentTransition?.timestamp || null,
      message: currentState !== 'IDLE' ? `FSM: ${currentState}` : null
    };
  }

  render() {
    // Shadow DOM rendering with inline styles
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
    // Initialize D3 visualization in Shadow DOM container
    initVisualization(this.shadowRoot.getElementById('viz-container'));
  }
}
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
  - Listens to `SentinelFSM` events (`fsm:state:changed`) via EventBus.
  - Updates node `isActive` and link classes, re-rendering with transitions.
- **History Trail**
  - Maintains a `stateHistory` array to track the last N transitions for analytics.
- **Widget Protocol**
  - Exports `widget` metadata: `{ element, displayName, icon, category, updateInterval }`
  - Provides `getStatus()` with 5 required fields for dashboard integration.

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `AgentVisualizerWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('agent-visualizer-widget', AgentVisualizerWidget)`.
   - Export widget metadata with element name, displayName, icon, category, updateInterval.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - Initialize auto-refresh interval (1000ms) for real-time FSM updates.
   - Subscribe to `EventBus.on('fsm:state:changed', onStateChange)`.
   - Get current FSM state and history from `SentinelFSM`.
3. **Lifecycle: disconnectedCallback**
   - Clear update interval to prevent memory leaks.
   - Optionally unsubscribe from EventBus listeners.
4. **Shadow DOM Rendering**
   - Render inline `<style>` with cyberpunk theme and widget-specific CSS.
   - Create controls (Reset, Export SVG, Refresh buttons) with event handlers.
   - Display current FSM state, transition count, and recent transitions list.
   - Embed D3 visualization container (`#viz-container`).
5. **D3 Visualization**
   - Validate D3 presence in `render()`; show fallback message if missing.
   - Create SVG with responsive `viewBox`, zoom behavior, and arrow markers.
   - Build force-directed graph with nodes (FSM states) and links (valid transitions).
   - Update node styling based on `currentState` (active pulse animation).
6. **getStatus() Method**
   - Return object with `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`.
   - Determine state based on recent FSM activity (active if transition within 10s).
7. **User Interaction**
   - Attach button event listeners (reset history, export SVG, refresh visualization).
   - Provide node tooltips with visit counts and current status.
   - Emit toast notifications via EventBus for user feedback.

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
