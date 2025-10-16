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
`MetricsDashboard` consumes `PerformanceMonitor` metrics and renders a trio of charts.

```javascript
const dashboard = await ModuleLoader.getModule('MetricsDashboard');
dashboard.init(document.getElementById('metrics-container'));
```

Core behaviour:
- **Container Setup**: injects a `.charts-grid` with canvases for memory, tool usage, and token usage.
- **Chart Initialization**: `initMemoryChart`, `initToolsChart`, `initTokensChart` create Chart.js instances with cyberpunk styling.
- **Auto Refresh**: `setInterval(api.updateCharts, 5000)` ensures data stays fresh.
- **Data Binding**: Pulls history arrays from `PerformanceMonitor.getMemoryStats()` and `getMetrics()`.
- **Responsive UI**: Maintains aspect ratio and dark theme legibility.

### 3. Implementation Pathway
1. **Dependency Check**
   - Validate presence of `Chart` global. Fail gracefully with logger error.
   - Ensure container element exists, otherwise show warning.
2. **Memory Chart**
   - Line chart plotting MB usage over time (`usedJSHeapSize`).
   - Labels use sample index (30s increments by default).
3. **Tool Usage Chart**
   - Bar chart of top 10 tools by call count.
   - Shorten long tool names for readability (truncate >20 chars).
4. **Token Usage Chart**
   - Line chart with two datasets: input vs output tokens per window.
   - Derive data from aggregated metrics.
5. **Update Loop**
   - `api.updateCharts()` fetches fresh metrics and updates dataset values.
   - Guard for missing metrics (display toast or log).
6. **Cleanup**
   - Provide `destroy()` to clear interval and `chart.destroy()` when switching personas.

### 4. Accessibility & UX Considerations
- Provide chart headings and ARIA labels.
- Colour schemes must meet contrast ratios; allow future theme toggles.
- Add tooltips summarising values on hover, using Chart.js defaults.
- Keep DOM modifications minimal to avoid layout thrash.

### 5. Verification Checklist
- [ ] Charts render even when metric arrays are empty (fallback to placeholder).
- [ ] No console errors when Chart.js missing—UI shows helpful message.
- [ ] Auto refresh does not spawn multiple intervals on repeated `init`.
- [ ] Tool usage chart reflects new tool events within 5 seconds.
- [ ] Memory units (MB) remain consistent across charts and logs.

Extend this blueprint when adding KPI cards, comparative run views, or integrating Paxos analytics. Visual truth must match numeric truth.
