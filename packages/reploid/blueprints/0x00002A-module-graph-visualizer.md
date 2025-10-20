# Blueprint 0x000030: Module Dependency Graph Visualizer

**Objective:** Standardize the D3.js visual representation of REPLOID’s module dependency graph, powered by Introspector data.

**Target Upgrade:** MGRV (`module-graph-visualizer.js`)

**Prerequisites:** 0x00001B (Code Introspection & Self-Analysis), 0x000025 (Universal Module Loader), 0x000026 (Module Manifest Governance)

**Affected Artifacts:** `/upgrades/module-graph-visualizer.js`, `/styles/dashboard.css`, `/upgrades/introspector.js`

---

### 1. The Strategic Imperative
As modules proliferate, dependency chains become non-trivial. A dedicated visualizer:
- Reveals circular dependencies in seconds.
- Highlights orphaned modules that need wiring into workflows.
- Provides onboarding visibility for new contributors.

### 2. Architectural Solution
The visualizer is implemented as a **Web Component widget** that uses D3 force-directed layout to render module dependencies from `Introspector`.

```javascript
// Web Component class pattern
class ModuleGraphVisualizerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Manual update - no auto-refresh
  }

  disconnectedCallback() {
    // No cleanup needed
  }

  getStatus() {
    const stats = getStats();
    return {
      state: initialized ? (stats ? 'idle' : 'loading') : 'disabled',
      primaryMetric: stats ? `${stats.totalModules} modules` : 'Not loaded',
      secondaryMetric: stats ? `${stats.totalDependencies} deps` : '',
      lastActivity: null,
      message: initialized ? null : 'D3.js not available'
    };
  }

  render() {
    // Shadow DOM with inline styles and graph controls
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
    // Initialize and render D3 graph in Shadow DOM container
    const container = this.shadowRoot.getElementById('module-graph-container');
    if (container && typeof d3 !== 'undefined') {
      if (!initialized) init(container);
      if (initialized) visualize();
    }
  }
}
```

Key features:
- **Initialization**
  - Validates D3 presence; shows fallback message if missing.
  - Creates SVG canvas with zoom/pan support (scaleExtent 0.1–4).
  - Configures `forceSimulation` (link distance 100, charge -300, collision 40).
- **Data Pipeline**
  - Calls `Introspector.getModuleGraph()` to get nodes and edges.
  - Nodes: `{ id, label, category, dependencies, description }`.
  - Links: `[{ source, target }]` mapping module edges.
  - Category colours defined in `CATEGORY_COLORS` (core, rsi, tool, ui, storage, agent, monitoring, visualization).
- **Rendering**
  - Draws directed links with arrowhead markers.
  - Node groups include circles (color-coded by category) + labels.
  - Dependency count badges displayed on nodes.
  - Tooltips show description and dependency count.
- **Interaction**
  - Drag nodes to reorganize layout; simulation resumes with alpha target.
  - Clicking a node can trigger `Introspector.getModuleDetails(id)` (planned extension).
- **Widget Protocol**
  - Exports `widget` metadata: `{ element, displayName, icon, category, updateInterval: null }`.
  - Provides `getStatus()` with 5 required fields for dashboard integration.
  - Manual refresh only (no auto-update interval).

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `ModuleGraphVisualizerWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('module-graph-visualizer-widget', ModuleGraphVisualizerWidget)`.
   - Export widget metadata: `{ element, displayName: 'Module Graph', icon: '⚌️', category: 'ui', updateInterval: null }`.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - No auto-refresh interval (manual refresh only).
   - Render Shadow DOM with graph controls and container.
3. **Lifecycle: disconnectedCallback**
   - No cleanup needed (no intervals or persistent listeners).
4. **Shadow DOM Rendering**
   - Render inline `<style>` with monospace font and widget-specific CSS.
   - Display controls: "Refresh", "Reset View" buttons.
   - Show graph statistics grid: total modules, dependencies, categories, average dependencies.
   - Embed D3 visualization container (`#module-graph-container`, 500px height).
   - Show fallback message if D3.js not loaded.
5. **D3 Initialization**
   - Call `init(container)` to set up SVG canvas.
   - Clear any existing SVG from container.
   - Create SVG with responsive viewBox and zoom behavior.
   - Configure force simulation with link, charge, center, collision forces.
   - Set `initialized` flag.
6. **Visualization Cycle**
   - Call `visualize()` to fetch graph data from `Introspector.getModuleGraph()`.
   - Transform data: nodes with `{ id, label, category, dependencies, description }`.
   - Create links array: `[{ source, target }]`.
   - Call `renderGraph(nodes, links)` to draw D3 visualization.
7. **Graph Rendering**
   - Clear previous visualization from SVG group.
   - Update simulation with new nodes and links.
   - Create link elements with stroke styling and arrowhead markers.
   - Append arrowhead marker definition to SVG defs (only once).
   - Create node groups with drag behavior.
   - Add circles to nodes (color-coded by category).
   - Add labels above nodes.
   - Add dependency count badges (small circles with count text).
   - Add tooltips with module details.
   - Update positions on simulation tick events.
8. **getStatus() Method**
   - Call `getStats()` to get graph statistics.
   - Return object with `state` (idle/loading/disabled based on initialization and data).
   - Include `primaryMetric` (module count), `secondaryMetric` (dependency count).
   - No `lastActivity` (always null for manual refresh).
9. **Interaction**
   - Attach drag handlers: dragstarted, dragged, dragended.
   - Drag nodes to reorganize layout; simulation alpha target adjusted.
   - "Refresh" button calls `visualize()` and emits toast success.
   - "Reset View" button resets zoom transform and restarts simulation.
10. **Statistics**
    - `getStats()` returns: totalModules, totalDependencies, categories count, avgDependencies.
    - Statistics computed from `graphData.statistics`.

### 4. Verification Checklist
- [ ] Graph renders within 2 seconds for 60+ modules.
- [ ] Zoom/pan works with scroll wheel and touchpad.
- [ ] Dragging nodes maintains link connectivity.
- [ ] Colour coding matches categories returned by Introspector.
- [ ] Duplicate markers are not appended on successive renders.

### 5. Extension Opportunities
- Overlay heatmap (edge thickness) from `PerformanceMonitor` usage data.
- Display blueprint coverage (hovering shows blueprint ID).
- Export graph to PNG/SVG for documentation snapshots.

Maintain this blueprint to ensure dependency visualization remains truthful and performant as the module ecosystem grows.
