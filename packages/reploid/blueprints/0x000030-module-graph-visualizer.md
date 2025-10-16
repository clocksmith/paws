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

### 2. Architectural Overview
The visualizer relies on `Introspector.getModuleGraph()` to generate nodes and edges.

```javascript
const graphViz = await ModuleLoader.getModule('ModuleGraphVisualizer');
graphViz.init(document.getElementById('module-graph'));
await graphViz.visualize();
```

Key features:
- **Initialization**
  - Validates D3 presence.
  - Creates SVG canvas with zoom/pan support.
  - Configures `forceSimulation` (link distance 100, charge -300, collision 40).
- **Data Pipeline**
  - Nodes: `{ id, label, category, dependencies, description }`.
  - Links: `[{ source, target }]` mapping module edges.
  - Category colours defined in `CATEGORY_COLORS`.
- **Rendering**
  - Draws arrows for dependencies with markers.
  - Node groups include concentric circles + labels.
  - Tooltips/overlays show description and dependency count.
- **Interaction**
  - Drag nodes to reorganise layout; simulation resumes with alpha target.
  - Clicking a node triggers `Introspector.getModuleDetails(id)` (planned extension) displayed in sidebar.
- **Metrics**
  - Logs number of modules/edges visualized for telemetry.

### 3. Implementation Pathway
1. **Init & Container Setup**
   - Provide `init(container)` that clears previous SVG and sets `initialized`.
   - Append `defs` only once to avoid duplicate markers.
2. **Visualization Cycle**
   - Call `visualize()` after init or when data changes.
   - Handle missing graph data with logger warnings (no crash).
   - Bind nodes/links to D3 selections and update on simulation ticks.
3. **Styling & Legend**
   - Colour nodes according to category (core, ui, storage, monitoring, visualization…).
   - Add optional legend overlay for readability.
4. **Event Hooks**
   - Emit `EventBus.emit('graph:module_selected', { id })` on click to integrate with inspector panes.
   - Provide `refresh()` to re-fetch graph after manifest changes.
5. **Cleanup**
   - Expose `destroy()` to stop simulation and remove SVG when not needed.

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
