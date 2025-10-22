# Blueprint 0x00002A: Canvas Visualization Engine

**Objective:** Codify the behaviour of the 2D canvas overlay that visualises module dependencies, cognition pathways, and performance signals in real time.

**Target Upgrade:** CNVS (`canvas-visualizer.js`)

**Prerequisites:** 0x000019 (Visual Self-Improvement), 0x000025 (Universal Module Loader), 0x00002B (Visualization Data Adapter)

**Affected Artifacts:** `/upgrades/canvas-visualizer.js`, `/upgrades/viz-data-adapter.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
Visual feedback accelerates operator comprehension and agent self-reflection. The canvas visualizer:
- Surfaces hidden dependencies and execution hotspots.
- Mirrors cognitive state (active goal, current tool, memory usage) in a digestible medium.
- Provides a foundation for future RSI heuristics that rely on spatial reasoning.

Without a maintained blueprint, the overlay drifts into novelty territory instead of an actionable diagnostic.

### 2. Architectural Solution
The module is implemented as a **Web Component widget** that creates and manages a fixed-position canvas with Shadow DOM controls.

```javascript
// Web Component class pattern
class CanvasVisualizerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._updateInterval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
  }

  getStatus() {
    const isRunning = animationId !== null;
    const hasRecentActivity = vizStats.lastActivity &&
      (Date.now() - vizStats.lastActivity < 5000);
    return {
      state: isRunning ? (hasRecentActivity ? 'active' : 'idle') : 'disabled',
      primaryMetric: isRunning ? `${vizState.nodes.size} nodes` : 'Not running',
      secondaryMetric: isRunning ? `${vizState.mode} mode` : 'Idle',
      lastActivity: vizStats.lastActivity,
      message: isRunning ? `${vizState.edges.length} edges` : null
    };
  }

  render() {
    // Shadow DOM with inline styles and visualization controls
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
  }
}
```

Responsibilities:
- **Canvas Lifecycle**
  - Creates a fixed-position canvas (`id="reploid-visualizer"`) sized 400×300.
  - Manages animation loop via `requestAnimationFrame` (stored as `animationId`).
- **Interaction Model**
  - Pan/zoom via mouse drag + wheel (clamped zoom 0.5–3×).
  - Node selection and hover detection update `vizState.selectedNode`/`hoveredNode`.
- **Visualization State**
  - Maintains nodes, edges, particles, and heatmaps within `vizState`.
  - Delegates data shaping to `VizDataAdapter` (0x00002B).
- **Rendering Pipeline**
  - Draws background grid, nodes (colour-coded by category), and animated edges.
  - Overlays tooltips / selection panels for the chosen node.
- **Telemetry & Statistics**
  - Tracks `vizStats`: framesRendered, particlesSpawned, nodesRendered, edgesRendered, modeChanges.
  - Logs interaction events via `logger.logEvent` for analytics.
- **Widget Protocol**
  - Exports `widget` metadata: `{ element, displayName, icon, category, updateInterval: 2000 }`.
  - Provides `getStatus()` with 5 required fields for dashboard integration.

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `CanvasVisualizerWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('canvas-visualizer-widget', CanvasVisualizerWidget)`.
   - Export widget metadata: `{ element, displayName: 'Canvas Visualizer', icon: '⛉', category: 'ui', updateInterval: 2000 }`.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - Initialize auto-refresh interval (2000ms) for FPS and stats updates.
   - Render Shadow DOM with visualization controls.
3. **Lifecycle: disconnectedCallback**
   - Clear update interval to prevent memory leaks.
4. **Canvas Initialization**
   - Call `init()` to create fixed-position canvas element.
   - Verify dependencies (`logger`, `Utils`, `StateManager`, `VizDataAdapter`).
   - Setup mouse interactions: drag (pan), wheel (zoom), click (node selection), hover.
   - Create mode switcher buttons (dependency, cognitive, memory, goals, tools).
5. **Shadow DOM Rendering**
   - Render inline `<style>` with monospace font and cyberpunk theme.
   - Display mode selector buttons (5 modes) with active state highlighting.
   - Show visualization status: running/stopped, current mode, zoom level.
   - Display rendering stats: nodes, edges, particles, animations, FPS.
   - Show session statistics: uptime, frames rendered, particles spawned, mode changes.
   - Display canvas info: size, pan offset, selected node.
6. **Data Refresh & Layout**
   - `updateVisualizationData()` pulls data from `VizDataAdapter` based on mode.
   - Apply layout algorithm: circular, hierarchical, grid, tree, or force-directed.
   - Update `vizState` with nodes, edges, heatmap data.
7. **Animation Loop**
   - `animate()` clears canvas, applies transforms, draws grid/nodes/edges/particles.
   - Track `vizStats` for telemetry (frames, particles, activity timestamp).
   - Use `requestAnimationFrame` for smooth 60 FPS rendering.
8. **getStatus() Method**
   - Return object with `state` (active/idle/disabled based on animation running & recent activity).
   - Include `primaryMetric` (node count), `secondaryMetric` (mode).
   - Track `lastActivity` (timestamp of last interaction or mode change).
9. **User Interaction**
   - Mode buttons call `setMode()` and re-render widget.
   - Toggle animation button starts/stops animation loop.
   - Track interactions in `vizStats` for analytics.
10. **Cleanup**
    - Provide `destroy()` to cancel animation, remove canvas, detach listeners.

### 4. Extension Ideas
- **Mini-map** preview enabling quick navigation in dense graphs.
- **Event Replay** mode that scrubs through recorded cycles for postmortems.
- **Anomaly Highlighting** by integrating performance thresholds from `PerformanceMonitor`.

### 5. Verification Checklist
- [ ] Canvas attaches/detaches without leaving orphaned listeners.
- [ ] Interaction latency stays under 16ms/frame at 60 FPS.
- [ ] Hover/selection tooltips update as nodes move.
- [ ] Works alongside dark/light UI themes (respect CSS variables).
- [ ] Gracefully handles missing `VizDataAdapter` output (fallback skeleton view).

Reference this blueprint when tuning visuals, wiring new data sources, or debugging interaction regressions.
