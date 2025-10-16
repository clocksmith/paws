# Blueprint 0x000042: Self-Testing & Validation Framework

**Objective:** Ensure REPLOID runs safety-critical validation suites before/after self-modification.

**Target Upgrade:** TEST (`self-tester.js`)

**Prerequisites:** 0x000025 (Universal Module Loader), 0x00002C (Performance Monitoring Stack), 0x000034 (Audit Logging Policy)

**Affected Artifacts:** `/upgrades/self-tester.js`, `/styles/dashboard.css`, `/upgrades/tool-runner.js`, `/upgrades/state-manager.js`

---

### 1. The Strategic Imperative
Self-modifying systems must prove they remain healthy. SelfTester provides:
- Immediate feedback after upgrades (did core modules load?).
- Confidence before applying user-approved changes.
- Historical record of regressions.

### 2. Architectural Overview
`SelfTester` exposes modular test suites and orchestration helpers.

```javascript
const Tester = await ModuleLoader.getModule('SelfTester');
const results = await Tester.api.runAllTests();
if (results.summary.failed > 0) abortApply();
```

Core suites:
- **Module Loading**: ensures DI container exists, core modules resolve, required methods exposed.
- **Tool Execution**: executes safe read tools (e.g., `get_current_state`), verifies tool catalogs load.
- **FSM Transitions**: validates `StateManager` state shape and Sentinel FSM asset availability.
- **Storage Systems**: checks IndexedDB presence, StateManager metadata, ReflectionStore functionality.
- **Performance Monitoring**: verifies `PerformanceMonitor.getMetrics()` returns expected structure.

Operational features:
- `runAllTests()` executes suites, aggregates results, stores cache/history, emits `self-test:complete`.
- `getLastResults()`, `getTestHistory()` provide access for UI and reports.
- `generateReport(results)` renders markdown summary (pass/fail counts, suite details).
- `testModuleLoading` etc. available individually for targeted diagnostics.

### 3. Implementation Pathway
1. **Integration Points**
   - Trigger `runAllTests()` before applying a changeset and after deployment.
   - Display results in Advanced dashboard with clear pass/fail icons.
   - Gate risky operations (auto-apply) on success threshold.
2. **DI Container Requirements**
   - Ensure global `window.DIContainer` registered during boot so tests can resolve modules.
3. **Extending Test Coverage**
   - Add suites for network checks, blueprint integrity, tool schema validation.
   - Provide persona-specific suites (e.g., Pyodide runtime).
4. **Failure Handling**
   - On failure, log via `AuditLogger` and surface toast notifications.
   - Optionally auto-create reflections summarising issues.
5. **Performance**
   - Suites should execute quickly (<3s). For heavier tests, run asynchronously and stream progress to UI.

### 4. Verification Checklist
- [ ] Failing suites increment `summary.failed` and mark test as failed with error message.
- [ ] History retains last 10 runs with timestamps/durations.
- [ ] Events `self-test:complete` include full result payload.
- [ ] Markdown report includes per-suite tables and success rate.
- [ ] Tool execution tests use safe read-only tools to avoid side effects.

### 5. Extension Opportunities
- Integrate with Paxos to require self-test pass before agent competes.
- Provide CLI command `paws self-test` leveraging same module.
- Generate badges for docs (`✅ Last run: 2025-05-12, 98% success`).
- Feed metrics into Reflection Analyzer to correlate failures with strategies.

Maintain this blueprint as new suites are added or the testing cadence changes.
