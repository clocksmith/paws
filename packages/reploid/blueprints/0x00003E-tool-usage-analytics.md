# Blueprint 0x00003E: Tool Usage Analytics

**Objective:** Establish the telemetry required to understand how tools perform, fail, and evolve over time.

**Target Upgrade:** TOAN (`tool-analytics.js`)

**Prerequisites:** 0x00002C (Performance Monitoring Stack), 0x00000A (Tool Runner Engine), 0x000031 (Toast Notification System)

**Affected Artifacts:** `/upgrades/tool-analytics.js`, `/upgrades/tool-runner.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
Tools are the agent’s actuators. Without analytics:
- We cannot identify slow or error-prone tools.
- Personas cannot auto-tune toolsets.
- RSI loops lack quantitative feedback.

Tool analytics provides the data to optimise tool usage and reliability.

### 2. Architectural Overview
`ToolAnalytics` listens to EventBus tool lifecycle events.

```javascript
const ToolAnalytics = await ModuleLoader.getModule('ToolAnalytics');
await ToolAnalytics.init();
const report = ToolAnalytics.api.generateReport();
```

Data model per tool:
- `totalCalls`, `successfulCalls`, `failedCalls`
- `totalDuration`, `minDuration`, `maxDuration`, `avgDuration`
- `errors[]` (recent failure messages)
- `argPatterns` (frequency of argument signatures)
- `lastUsed` timestamp

Key functionality:
- `handleToolStart` initialises metrics, increments call count, starts timer, tracks argument pattern.
- `handleToolComplete` updates success stats and durations.
- `handleToolError` increments failure counters and stores recent errors.
- `getToolAnalytics(name)` returns structured metrics for a tool (with success/error rates).
- `getAllAnalytics()` aggregates across all tools with session duration.
- `getTopTools`, `getSlowestTools`, `getProblematicTools` provide curated slices.
- `generateReport()` produces markdown summary for dashboards or docs.
- `reset()` clears metrics for a new session.

### 3. Implementation Pathway
1. **Event Wiring**
   - Ensure Tool Runner emits `tool:start`, `tool:complete`, `tool:error` with consistent payloads (`toolName`, `args`, `error`).
   - Avoid leaving `_startTime` on metric object if completion/error not received (cleanup on error paths).
2. **Argument Pattern Tracking**
   - Store sorted argument keys to classify invocation shapes (e.g., `code,sync_workspace` vs `path`).
   - Use highest frequency patterns to suggest template usage.
3. **Reporting**
   - Integrate report output into Advanced panel or CLI.
   - Combine with `PerformanceMonitor` charts for holistic view.
4. **Retention**
   - Keep only last 10 errors per tool to prevent memory bloat.
   - Session start resets on module init; persist to `StateManager` if cross-session analytics desired.
5. **Alerts (Future)**
   - Hook into `ToastNotifications` to warn when error rate rises above threshold.

### 4. Verification Checklist
- [ ] Metrics initialise when tool first used.
- [ ] Success/error counts match actual events.
- [ ] Durations update even if tool invoked multiple times simultaneously.
- [ ] Reports list top/slow/problematic tools sorted correctly.
- [ ] Reset wipes metrics and restarts session timer.

### 5. Extension Opportunities
- Persist metrics to reflections for long-term trend analysis.
- Add percentile latency (P95/P99) in addition to average.
- Correlate tool errors with blueprint/version to detect regressions.
- Visualise analytics alongside metrics dashboard (bar charts).

Update this blueprint when analytics schema changes or new reporting capabilities are added.
