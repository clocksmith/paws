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

### 2. Architectural Overview
The module renders a fullscreen-adjacent `<canvas>` with custom drawing routines.

```javascript
const canvasViz = await ModuleLoader.getModule('CNVS');
await canvasViz.init(); // implicitly appends canvas to DOM and starts animation loop
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
- **Telemetry Hooks**
  - Logs interaction events via `logger.logEvent` for analytics.

### 3. Implementation Pathway
1. **Initialisation**
   - Verify dependencies (`logger`, `Utils`, `StateManager`, `VizDataAdapter`).
   - Append canvas to DOM; inject cyberpunk-themed styles if absent.
   - Call `setupInteractions()` to register mouse listeners.
2. **Data Refresh**
   - `updateVisualizationData()` pulls module graph, tool metrics, and goal state from `VizDataAdapter`.
   - Schedule periodic refresh (e.g., every 10 seconds) or on EventBus triggers (`metrics:update`).
3. **Rendering**
   - Clear canvas each frame.
   - Apply pan/zoom transforms before drawing.
   - Render edges first, then nodes, then overlays to ensure clarity.
   - Animate particle trails along active edges to illustrate execution flow.
4. **Mode Switching**
   - Support multiple `mode` values (`dependency`, `cognitive`, `memory`, `goals`, `tools`).
   - Each mode tweaks node colour, size, and supplementary overlays.
5. **Cleanup**
   - Provide `destroy()` to cancel animation, remove canvas, and detach listeners when persona deactivates the visual layer.

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
