# Blueprint 0x00002C: Performance Monitoring Stack

**Objective:** Define the observability contract for tracking tool execution, state transitions, LLM usage, and memory across REPLOID sessions.

**Target Upgrade:** PMON (`performance-monitor.js`)

**Prerequisites:** 0x000006 (Pure State Helpers), 0x000007 (API Client & Communication), 0x000008 (Agent Cognitive Cycle), 0x000031 (Toast Notifications)

**Affected Artifacts:** `/upgrades/performance-monitor.js`, `/upgrades/metrics-dashboard.js`, `/upgrades/tool-analytics.js`

---

### 1. The Strategic Imperative
RSI requires feedback loops. Without quantitative metrics the agent:
- Cannot pinpoint which tools regress latency.
- Lacks evidence for blueprint improvements.
- Fails to surface memory leaks or runaway API usage.

Performance Monitor provides the canonical dataset for dashboards, analytics, and self-tuning heuristics.

### 2. Architectural Overview
The module exposes an imperative API after instantiation along with a Web Component widget:

```javascript
const Perf = await ModuleLoader.getModule('PerformanceMonitor');
Perf.init();
const stats = Perf.getMetrics();
```

Primary responsibilities:
- **Event Wiring**
  - Subscribes to EventBus events: `tool:start/end/error`, `agent:state:change/exit`, `api:request:start/end/error`, artifact lifecycle, and cycle counters.
- **Metrics Store**
  - Keeps structured objects for tools, states, LLM usage, memory samples, and session metadata (cycles, artifact counts).
- **Timer Management**
  - Uses `activeTimers` Map keyed by tool/state/API request to measure duration.
- **Memory Sampling**
  - Periodically reads `performance.memory` (when available) to plot heap usage.
- **API Exposure**
  - `getMetrics()`, `getMemoryStats()`, `getLLMStats()`, `reset()`, `export()` for downstream consumers.

#### Web Component Widget Pattern

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class PerformanceMonitorWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Update every 2 seconds for real-time monitoring
    this._updateInterval = setInterval(() => this.render(), 2000);
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
    const memStats = getMemoryStats();
    const llmStats = getLLMStats();

    const currentMem = memStats.current
      ? (memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(0)
      : 0;

    let state = 'idle';
    if (activeTimers.size > 0) state = 'active';
    if (memStats.current && memStats.current.usedJSHeapSize > memStats.current.jsHeapSizeLimit * 0.9) {
      state = 'warning';
    }

    return {
      state,
      primaryMetric: `${currentMem} MB`,
      secondaryMetric: `${llmStats.calls} LLM calls`,
      lastActivity: llmStats.lastCall,
      message: state === 'warning' ? 'High memory usage' : null
    };
  }

  render() {
    const allMetrics = getMetrics();
    const memStats = getMemoryStats();
    const llmStats = getLLMStats();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .widget-panel { padding: 12px; }
        h3 { margin: 0 0 12px 0; font-size: 1.1em; color: #fff; }
        .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .stat-card { padding: 8px; background: rgba(100,150,255,0.1); border-radius: 4px; }
        button { padding: 6px 12px; background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); }
      </style>

      <div class="widget-panel">
        <h3>▤ Performance Monitor</h3>

        <div class="stats-grid">
          <div class="stat-card">
            <div>Memory Used</div>
            <div>${formatBytes(memStats.current?.usedJSHeapSize)}</div>
          </div>
          <div class="stat-card">
            <div>LLM Calls</div>
            <div>${llmStats.calls}</div>
          </div>
          <!-- Additional stats -->
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.getElementById('reset-btn')?.addEventListener('click', () => {
      reset();
      this.render();
    });
  }
}

// Register custom element
const elementName = 'performance-monitor-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, PerformanceMonitorWidget);
}

const widget = {
  element: elementName,
  displayName: 'Performance Monitor',
  icon: '▤',
  category: 'analytics',
  updateInterval: 2000
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods (`connectedCallback`, `disconnectedCallback`) ensure proper cleanup
- Closure access to module state (metrics, activeTimers, memory samples) eliminates injection complexity
- `getStatus()` provides all 5 required fields for dashboard integration

### 3. Implementation Pathway
1. **Module Initialisation**
   - Call `init()` once the EventBus is ready.
   - Register listeners and start memory sampling intervals (respect browser support checks).
2. **Tool Lifecycle**
   - Emit `tool:start` and `tool:end` from Tool Runner (0x00000A) with consistent payloads (`toolName`, timestamps).
   - Record duration, call counts, error counts.
3. **Cognitive States**
   - Agent cycle should publish `agent:state:change/exit` whenever shifting between OBSERVE/ORIENT/DECIDE/ACT or persona-specific substates.
   - Metrics accumulate entry counts and dwell times.
4. **LLM Instrumentation**
   - API client must tag requests with unique `requestId` so start/end events match.
   - Record token budgets and latency to inform cost tracking (0x00003F).
5. **Session Artifacts**
   - Hook artifact events to count created/modified/deleted files for audit dashboards.
6. **Web Component Widget Implementation**
   - **Define Web Component class** extending HTMLElement inside factory function
   - **Add Shadow DOM** using `attachShadow({ mode: 'open' })` in constructor
   - **Implement lifecycle methods**:
     - `connectedCallback()`: Initial render and set up 2-second auto-refresh interval
     - `disconnectedCallback()`: Clean up interval with `clearInterval(this._updateInterval)` to prevent memory leaks
   - **Implement getStatus()** as class method with ALL 5 required fields:
     - `state`: 'idle', 'active', or 'warning' based on activeTimers and memory usage
     - `primaryMetric`: Current memory usage in MB
     - `secondaryMetric`: Number of LLM calls
     - `lastActivity`: Timestamp of last LLM call
     - `message`: Optional warning message for high memory
   - **Implement render()** method:
     - Set `this.shadowRoot.innerHTML` with encapsulated `<style>` tag using `:host` selector
     - Use template literals for dynamic content from closure-accessed state
     - Display stats grid, memory/LLM metrics, tool stats, session info
     - Wire up event listeners for reset/export buttons
   - **Register custom element**:
     - Use kebab-case naming: `performance-monitor-widget`
     - Add duplicate check: `if (!customElements.get(elementName))`
     - Call `customElements.define(elementName, PerformanceMonitorWidget)`
   - **Return widget object** with new format:
     - `{ element: 'performance-monitor-widget', displayName, icon, category }`
     - No `updateInterval` in widget object (handled internally in connectedCallback)
7. **Data Access**
   - Downstream modules (e.g., Metrics Dashboard) call `PerformanceMonitor.getMetrics()` to render charts. Avoid mutating returned objects.

### 4. Verification Checklist
- [ ] Missing events degrade gracefully (no `undefined` timers).
- [ ] Memory sampler stops when module `destroy()` invoked.
- [ ] Metrics reset when persona/session restarts.
- [ ] Tool duration accuracy within ±5ms for operations <1s.
- [ ] LLM token counts align with provider responses.

### 5. Extension Ideas
- Export metrics to `paxos-analytics.json` for offline analysis.
- Introduce configurable thresholds that trigger toast warnings when latency spikes.
- Feed tool performance into self-tuning heuristics (e.g., auto-disable slow experimental tools).

Treat this blueprint as the guardrail for modifications to monitoring logic. Observability debt is RSI debt.
