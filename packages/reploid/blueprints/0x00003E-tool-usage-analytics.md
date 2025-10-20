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
`ToolAnalytics` listens to EventBus tool lifecycle events and provides a Web Component widget for visualization.

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

#### Web Component Widget Pattern

The widget uses a Web Component with Shadow DOM for real-time analytics visualization:

```javascript
class ToolAnalyticsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Update every 5 seconds for analytics
    this._updateInterval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const totalTools = toolMetrics.size;
    const totalCalls = Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.totalCalls, 0);
    const totalErrors = Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.failedCalls, 0);

    return {
      state: totalCalls > 0 ? 'active' : 'idle',
      primaryMetric: `${totalTools} tools`,
      secondaryMetric: `${totalCalls} calls`,
      lastActivity: toolMetrics.size > 0 ? Math.max(...Array.from(toolMetrics.values()).map(m => m.lastUsed || 0)) : null,
      message: totalErrors > 0 ? `${totalErrors} errors` : 'All OK'
    };
  }

  render() {
    const analytics = getAllAnalytics();
    const topTools = getTopTools(5);
    const slowestTools = getSlowestTools(5);
    const problematicTools = getProblematicTools(5);

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; }
        .widget-panel { padding: 12px; }
        h3 { margin: 0 0 12px 0; font-size: 1.1em; color: #fff; }
        button { padding: 6px 12px; background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); }
      </style>

      <div class="widget-panel">
        <h3>☱ Tool Analytics</h3>

        <div class="controls">
          <button id="reset-btn">↻ Reset</button>
          <button id="report-btn">⛿ Report</button>
        </div>

        <h3>Top 5 Most Used Tools</h3>
        <div>
          ${topTools.map((tool, idx) => `
            <div>
              #${idx + 1} ${tool.name} - ${tool.totalCalls} calls - ${tool.successRate}% success
            </div>
          `).join('')}
        </div>

        <h3>Top 5 Slowest Tools</h3>
        <div>
          ${slowestTools.map((tool, idx) => `
            <div>
              #${idx + 1} ${tool.name} - ${tool.avgDurationMs}ms avg
            </div>
          `).join('')}
        </div>

        ${problematicTools.length > 0 ? `
          <h3>Tools with Errors</h3>
          <div>
            ${problematicTools.map(tool => `
              <div>${tool.name} - ${tool.errorRate}% error rate</div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.getElementById('reset-btn')?.addEventListener('click', () => {
      reset();
      this.render();
    });

    this.shadowRoot.getElementById('report-btn')?.addEventListener('click', () => {
      const report = generateReport();
      console.log(report);
    });
  }
}

// Register custom element
const elementName = 'tool-analytics-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, ToolAnalyticsWidget);
}

const widget = {
  element: elementName,
  displayName: 'Tool Analytics',
  icon: '☱',
  category: 'analytics',
  updateInterval: 5000
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods ensure proper cleanup
- Closure access to `toolMetrics` Map and analytics functions
- `getStatus()` provides all 5 required fields including error counts
- Real-time rendering of top/slow/problematic tools

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
5. **Web Component Widget Implementation**
   - **Define Web Component class** extending HTMLElement inside factory function
   - **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
   - **Implement lifecycle methods**:
     - `connectedCallback()`: Initial render and set up 5-second auto-refresh interval
     - `disconnectedCallback()`: Clean up interval with `clearInterval(this._updateInterval)` to prevent memory leaks
   - **Implement getStatus()** as class method with ALL 5 required fields:
     - `state`: 'active' if tools have been called, 'idle' otherwise
     - `primaryMetric`: Number of tools tracked
     - `secondaryMetric`: Total tool calls
     - `lastActivity`: Most recent tool usage timestamp
     - `message`: Error count summary or 'All OK'
   - **Implement render()** method:
     - Set `this.shadowRoot.innerHTML` with encapsulated `<style>` tag using `:host` selector
     - Display session overview with total calls, success rate, errors
     - Show top 5 most used tools with call counts and success rates
     - Show top 5 slowest tools with average durations
     - Show problematic tools (high error rate) if any exist
     - Wire up event listeners for reset/report buttons
   - **Register custom element**:
     - Use kebab-case naming: `tool-analytics-widget`
     - Add duplicate check: `if (!customElements.get(elementName))`
     - Call `customElements.define(elementName, ToolAnalyticsWidget)`
   - **Return widget object** with new format:
     - `{ element: 'tool-analytics-widget', displayName, icon, category }`
     - No `updateInterval` in widget object (handled internally in connectedCallback)
6. **Alerts (Future)**
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
