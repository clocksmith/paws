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
The module exposes an imperative API after instantiation:

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

### 3. Implementation Pathway
1. **Initialisation**
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
6. **Data Access**
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
