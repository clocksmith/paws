# Blueprint 0x00002B: Visualization Data Adapter

**Objective:** Document the transformation layer that converts REPLOID’s state, metrics, and manifests into geometry consumable by visualization upgrades.

**Target Upgrade:** VDAT (`viz-data-adapter.js`)

**Prerequisites:** 0x000005 (State Management Architecture), 0x000006 (Pure State Helpers), 0x000013 (System Configuration Structure), 0x00002A (Canvas Visualization Engine)

**Affected Artifacts:** `/upgrades/viz-data-adapter.js`, `/upgrades/canvas-visualizer.js`, `/upgrades/metrics-dashboard.js`

---

### 1. The Strategic Imperative
Visualization modules should not scrape raw state or invent their own data munging logic. A dedicated adapter:
- Ensures graphs share the same semantic meaning (dependency categories, cognitive stages).
- Centralises caching to protect the runtime from repeated heavy computations.
- Provides fallbacks when certain data (e.g., manifest) is absent.

Without this blueprint, each visualization would diverge, leading to contradictory charts.

### 2. Architectural Overview
`VizDataAdapter` is an async module that exposes high-level data-fetching APIs:

```javascript
const viz = await ModuleLoader.getModule('VizDataAdapter');
const dependencyGraph = await viz.getDependencyGraph();
const cognitiveFlow = await viz.getCognitiveFlow();
```

Core responsibilities:
- **Caching**: results stored in `cache` with `CACHE_TTL` (1s) to debounce requests from multiple renders.
- **Dependency Graph**
  - Reads `/modules/module-manifest.json` via `Storage`.
  - Builds nodes/edges with inferred categories (core, tool, ui, storage, experimental).
  - Marks active modules using metadata.
- **Cognitive Flow**
  - Pulls `StateManager.getState()` to mark OODA stages (`OBSERVE`, `ORIENT`, `DECIDE`, `ACT`).
  - Adds recent tool executions as satellite nodes.
- **Memory Heatmap**
  - Aggregates storage usage, scratchpad activity, and reflection counts.
- **Goal Tree & Tool Usage**
  - Transforms active goals, subtasks, and tool invocation statistics into hierarchical structures.

### 3. Implementation Pathway
1. **Dependency Setup**
   - Validate required deps (`logger`, `Utils`, `StateManager`, `Storage`).
   - Handle missing manifest gracefully (warn and produce skeletal graph).
2. **Graph Construction Patterns**
   - Use deterministic coordinates when possible so visualisations don’t jump between frames.
   - Provide normalized node schema: `{ id, label, category, x, y, radius, status }`.
   - Distinguish edge types (`dependency`, `flow`, `feedback`, `usage`) for styling.
3. **Caching Discipline**
   - Update `cache.lastUpdate` after recomputing any dataset.
   - Expose `invalidate()` to clear cache when the VFS changes dramatically.
4. **Extensibility**
   - Provide hooks for additional datasets (`getPersonaMatrix`, `getBlueprintCoverage`).
   - Document each method so future visualizers can rely on consistent output.
5. **Error Handling**
   - Wrap JSON parsing in try/catch and emit `logger.logEvent('warn', ...)`.
   - Return sensible defaults instead of throwing, allowing UI to render fallback states.

### 4. Verification Checklist
- [ ] Cache prevents duplicate fetches within 1 second while still responding to updates.
- [ ] Graph nodes align with manifest-defined dependencies.
- [ ] Cognitive flow highlights the correct stage per cycle.
- [ ] Tool usage metrics match `PerformanceMonitor` counts.
- [ ] Missing data falls back to empty but well-formed structures.

Keep this adapter pure and side-effect free so visual layers remain thin. When adding new metrics, update both the adapter and its consumer blueprints.
