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
`VizDataAdapter` is an async module that exposes high-level data-fetching APIs and a Web Component widget for monitoring:

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

#### Web Component Widget Pattern

The widget uses a Web Component with Shadow DOM for monitoring adapter usage:

```javascript
class VizDataAdapterWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._updateInterval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const cacheHitRate = adapterStats.totalQueries > 0
      ? Math.round((adapterStats.cacheHits / adapterStats.totalQueries) * 100)
      : 0;

    return {
      state: adapterStats.totalQueries > 0 ? 'active' : 'idle',
      primaryMetric: `${adapterStats.totalQueries} queries`,
      secondaryMetric: `${cacheHitRate}% cache hit`,
      lastActivity: adapterStats.lastQuery?.timestamp || null,
      message: adapterStats.lastQuery ? `Last: ${adapterStats.lastQuery.type}` : null
    };
  }

  render() {
    const queryList = Object.entries(adapterStats.queryTypes)
      .filter(([_, count]) => count > 0)
      .sort((a, b) => b[1] - a[1]);

    const cacheHitRate = adapterStats.totalQueries > 0
      ? Math.round((adapterStats.cacheHits / adapterStats.totalQueries) * 100)
      : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          color: #e0e0e0;
        }
        .viz-data-adapter-panel { padding: 12px; background: #1a1a1a; border-radius: 4px; }
        h4 { margin: 0 0 12px 0; font-size: 14px; color: #0ff; }
        button { padding: 6px 12px; background: #333; color: #e0e0e0; border: 1px solid #555; }
      </style>

      <div class="viz-data-adapter-panel">
        <h4>☱ Viz Data Adapter</h4>

        <div class="controls">
          <button class="clear-cache">⛶ Clear Cache</button>
        </div>

        <div class="adapter-stats">
          <div>Total Queries: ${adapterStats.totalQueries}</div>
          <div>Cache Hits: ${adapterStats.cacheHits}</div>
          <div>Hit Rate: ${cacheHitRate}%</div>
        </div>

        ${adapterStats.lastQuery ? `
          <div class="last-query">
            <div>Last Query: ${adapterStats.lastQuery.type}</div>
            <div>${new Date(adapterStats.lastQuery.timestamp).toLocaleString()}</div>
          </div>
        ` : ''}

        <h4>Query Types (${queryList.length})</h4>
        <div class="query-list">
          ${queryList.map(([type, count]) => {
            const percentage = Math.round((count / adapterStats.totalQueries) * 100);
            return `
              <div class="query-item">
                <span>${type}</span>
                <span>${count} (${percentage}%)</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.querySelector('.clear-cache')?.addEventListener('click', () => {
      cache.dependencyGraph = null;
      cache.cognitiveFlow = null;
      cache.memoryHeatmap = null;
      cache.goalTree = null;
      cache.toolUsage = null;
      cache.lastUpdate = 0;
      this.render();
    });
  }
}

if (!customElements.get('viz-data-adapter-widget')) {
  customElements.define('viz-data-adapter-widget', VizDataAdapterWidget);
}

const widget = {
  element: 'viz-data-adapter-widget',
  displayName: 'Viz Data Adapter',
  icon: '☱',
  category: 'ui',
  order: 85
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods ensure proper interval cleanup
- Closure access to `adapterStats`, `cache` for monitoring
- `getStatus()` provides all 5 required fields including cache hit rate
- Tracks query types and frequencies for optimization insights

### 3. Implementation Pathway
1. **Dependency Setup**
   - Validate required deps (`logger`, `Utils`, `StateManager`, `Storage`).
   - Handle missing manifest gracefully (warn and produce skeletal graph).
2. **Graph Construction Patterns**
   - Use deterministic coordinates when possible so visualisations don't jump between frames.
   - Provide normalized node schema: `{ id, label, category, x, y, radius, status }`.
   - Distinguish edge types (`dependency`, `flow`, `feedback`, `usage`) for styling.
3. **Caching Discipline**
   - Update `cache.lastUpdate` after recomputing any dataset.
   - Expose `invalidate()` to clear cache when the VFS changes dramatically.
4. **Usage Tracking**
   - Track all query calls using `trackQuery()` wrapper function
   - Maintain `adapterStats` object with totalQueries, cacheHits, lastQuery, and queryTypes breakdown
   - Increment cache hits when returning cached data within TTL
5. **Extensibility**
   - Provide hooks for additional datasets (`getPersonaMatrix`, `getBlueprintCoverage`).
   - Document each method so future visualizers can rely on consistent output.
6. **Error Handling**
   - Wrap JSON parsing in try/catch and emit `logger.logEvent('warn', ...)`.
   - Return sensible defaults instead of throwing, allowing UI to render fallback states.
7. **Web Component Widget Implementation**
   - **Define Web Component class** extending HTMLElement inside factory function
   - **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
   - **Implement lifecycle methods**:
     - `connectedCallback()`: Initial render and set up 3-second auto-refresh interval
     - `disconnectedCallback()`: Clean up interval with `clearInterval(this._updateInterval)` to prevent memory leaks
   - **Implement getStatus()** as class method with ALL 5 required fields:
     - `state`: 'active' if queries have been made, 'idle' otherwise
     - `primaryMetric`: Total number of queries
     - `secondaryMetric`: Cache hit rate percentage
     - `lastActivity`: Timestamp of last query
     - `message`: Last query type
   - **Implement render()** method:
     - Set `this.shadowRoot.innerHTML` with encapsulated `<style>` tag using `:host` selector
     - Display adapter statistics (total queries, cache hits, hit rate)
     - Show last query details if available
     - Render query type breakdown sorted by frequency with percentages
     - Wire up event listener for clear cache button
   - **Register custom element**:
     - Use kebab-case naming: `viz-data-adapter-widget`
     - Add duplicate check: `if (!customElements.get('viz-data-adapter-widget'))`
     - Call `customElements.define(elementName, VizDataAdapterWidget)`
   - **Return widget object** with new format:
     - `{ element: 'viz-data-adapter-widget', displayName, icon, category, order }`
     - No `updateInterval` in widget object (handled internally in connectedCallback)

### 4. Verification Checklist
- [ ] Cache prevents duplicate fetches within 1 second while still responding to updates.
- [ ] Graph nodes align with manifest-defined dependencies.
- [ ] Cognitive flow highlights the correct stage per cycle.
- [ ] Tool usage metrics match `PerformanceMonitor` counts.
- [ ] Missing data falls back to empty but well-formed structures.

Keep this adapter pure and side-effect free so visual layers remain thin. When adding new metrics, update both the adapter and its consumer blueprints.
