# Blueprint 0x00002D: Metrics Dashboard & Charting

**Objective:** Govern the Chart.js-powered dashboard that visualises REPLOID performance metrics in real time.

**Target Upgrade:** MDSH (`metrics-dashboard.js`)

**Prerequisites:** 0x00002C (Performance Monitoring Stack), 0x000019 (Visual Self-Improvement), 0x000025 (Universal Module Loader)

**Affected Artifacts:** `/upgrades/metrics-dashboard.js`, `/styles/dashboard.css`, `/index.html` (Chart.js CDN include)

---

### 1. The Strategic Imperative
Numbers alone do not reveal patterns. The dashboard provides:
- Quick assessment of memory pressure, avoiding browser crashes.
- Tool usage ranking to highlight optimization targets.
- LLM token consumption trends to manage billing and latency.

Chart artifacts must remain accurate, performant, and accessible.

### 2. Architectural Overview
`MetricsDashboard` consumes `PerformanceMonitor` metrics and renders a trio of charts using a **Web Component** with Shadow DOM encapsulation.

```javascript
// Widget interface (ModuleWidgetProtocol compatible)
const widget = {
  element: 'metrics-dashboard-widget',
  displayName: 'Metrics Dashboard',
  icon: '☱',
  category: 'analytics',
  updateInterval: 5000
};

// Web Component class (defined inside factory closure)
class MetricsDashboardWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._charts = []; // Track Chart.js instances for cleanup
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
    this._charts.forEach(chart => chart.destroy()); // Clean up Chart.js
  }
}
```

Core behaviour:
- **Shadow DOM Encapsulation**: All styles and markup isolated in shadowRoot, preventing CSS leaks.
- **Container Setup**: injects a `.charts-grid` with canvases for memory, tool usage, and token usage.
- **Chart Initialization**: `initializeCharts()` creates Chart.js instances with cyberpunk styling after DOM render.
- **Auto Refresh**: Component-managed `setInterval` re-renders every 5 seconds, destroying and recreating charts.
- **Data Binding**: Pulls history arrays from `PerformanceMonitor.getMemoryStats()` and `getMetrics()`.
- **Chart Lifecycle**: Destroys all Chart.js instances in `disconnectedCallback()` to prevent memory leaks.
- **Interactive Controls**: Three buttons (Pause, Export, Refresh) with event listeners wired in `render()`.
- **Responsive UI**: Maintains aspect ratio and dark theme legibility within Shadow DOM.

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `MetricsDashboardWidget` class INSIDE factory closure to access `PerformanceMonitor`, `EventBus`, etc.
   - Register with `customElements.define('metrics-dashboard-widget', MetricsDashboardWidget)`.
   - Check `!customElements.get()` to prevent re-registration errors.

2. **Shadow DOM Structure**
   - `attachShadow({ mode: 'open' })` in constructor.
   - Render encapsulated styles and markup in `render()` method.
   - Use class-based selectors (`.memory-chart`, `.tools-chart`, `.tokens-chart`) for canvas elements.

3. **Chart Lifecycle Management**
   - Track all Chart.js instances in `this._charts` array.
   - Destroy all charts before re-rendering: `this._charts.forEach(chart => chart.destroy())`.
   - Call `initializeCharts()` after DOM update (100ms setTimeout for safety).
   - Clean up in `disconnectedCallback()` to prevent memory leaks.

4. **Memory Chart**
   - Line chart plotting MB usage over time (`usedJSHeapSize`).
   - Labels use sample index (30s increments by default).

5. **Tool Usage Chart**
   - Bar chart of top 10 tools by call count.
   - Shorten long tool names for readability (truncate to 15 chars).

6. **Token Usage Chart**
   - Doughnut chart showing input vs output token distribution.
   - Derive data from `PerformanceMonitor.getLLMStats()`.

7. **Interactive Controls**
   - **Pause Button**: Emits toast notification (⏸ icon, orange background).
   - **Export Button**: Copies summary to clipboard via `navigator.clipboard` (⇓ icon, blue background).
   - **Refresh Button**: Calls `updateCharts()` and re-renders (↻ icon, green background).
   - Wire up event listeners in `render()` using `shadowRoot.querySelector()`.

8. **Dependency Validation**
   - Check `typeof Chart !== 'undefined'` before calling `initializeCharts()`.
   - If Chart.js unavailable, silently skip chart rendering (canvases remain empty).

### 4. Accessibility & UX Considerations
- Provide chart headings and ARIA labels.
- Colour schemes must meet contrast ratios; allow future theme toggles.
- Add tooltips summarising values on hover, using Chart.js defaults.
- Keep DOM modifications minimal to avoid layout thrash.

### 5. Verification Checklist
- [x] **Web Component Implementation**: Widget uses Shadow DOM with `MetricsDashboardWidget` class.
- [x] **Chart Lifecycle**: All Chart.js instances destroyed in `disconnectedCallback()`.
- [x] **Chart Cleanup on Re-render**: Charts destroyed before each `render()` call to prevent duplicates.
- [x] **Interactive Controls**: Pause, Export, and Refresh buttons with event listeners.
- [x] **Shadow DOM Isolation**: Styles fully encapsulated, no CSS leaks.
- [ ] Charts render even when metric arrays are empty (fallback to placeholder).
- [ ] No console errors when Chart.js missing—widget gracefully skips chart init.
- [ ] Auto refresh does not spawn multiple intervals (cleared in `disconnectedCallback`).
- [x] Tool usage chart reflects new tool events within 5 seconds (5s update interval).
- [x] Memory units (MB) remain consistent across charts and logs.
- [x] **ModuleWidgetProtocol Compatibility**: Widget returns `{ element, displayName, icon, category, updateInterval }`.
- [x] **Closure Access**: Web Component class defined inside factory to access `PerformanceMonitor`, `EventBus`, etc.

Extend this blueprint when adding KPI cards, comparative run views, or integrating Paxos analytics. Visual truth must match numeric truth.
