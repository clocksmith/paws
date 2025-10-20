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

The SelfTester module provides comprehensive validation suites with real-time monitoring through a Web Component widget. It implements a factory pattern with encapsulated business logic and Shadow DOM-based UI.

**Module Architecture:**
```javascript
const SelfTester = {
  metadata: {
    id: 'SelfTester',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager'],
    async: true,
    type: 'validation'
  },
  factory: (deps) => {
    // Internal state (accessible to widget via closure)
    let lastTestResults = null;
    let testHistory = [];

    // Test suite functions
    const testModuleLoading = async () => { /*...*/ };
    const testToolExecution = async () => { /*...*/ };
    const testFSMTransitions = async () => { /*...*/ };
    const testStorageSystems = async () => { /*...*/ };
    const testPerformanceMonitoring = async () => { /*...*/ };
    const runAllTests = async () => { /*...*/ };

    // Web Component Widget (defined inside factory to access closure state)
    class SelfTesterWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 10000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      render() {
        this.shadowRoot.innerHTML = `<style>...</style>${this.renderPanel()}`;
      }
    }

    customElements.define('self-tester-widget', SelfTesterWidget);

    return {
      init,
      api: {
        testModuleLoading,
        testToolExecution,
        testFSMTransitions,
        testStorageSystems,
        testPerformanceMonitoring,
        runAllTests,
        getLastResults,
        getTestHistory,
        generateReport
      },
      widget: {
        element: 'self-tester-widget',
        displayName: 'Self Tester',
        icon: '⚗',
        category: 'validation',
        updateInterval: 10000
      }
    };
  }
};
```

**Test Suite Coverage:**
- **Module Loading**: ensures DI container exists, core modules resolve, required methods exposed.
- **Tool Execution**: executes safe read tools (e.g., `get_current_state`), verifies tool catalogs load.
- **FSM Transitions**: validates `StateManager` state shape and Sentinel FSM asset availability.
- **Storage Systems**: checks IndexedDB presence, StateManager metadata, ReflectionStore functionality.
- **Performance Monitoring**: verifies `PerformanceMonitor.getMetrics()` returns expected structure.

**Web Component Widget Features:**

The `SelfTesterWidget` provides real-time test monitoring and execution:
- **Statistics Dashboard**: 2×2 grid showing passed/failed counts, success rate, and test duration
- **Test Suites Display**: Lists all 5 test suites with pass/fail status and failure counts
- **Test History**: Scrollable list of last 10 test runs with timestamps and success rates
- **Interactive Actions**: "Run All Tests" button for executing full suite, "Generate Report" for markdown output
- **Auto-refresh**: Updates every 10 seconds to reflect new test results
- **Visual Feedback**: Color-coded results (green for pass, red for fail, amber for warnings)

**Operational Features:**
- `runAllTests()` executes suites, aggregates results, stores cache/history, emits `self-test:complete`.
- `getLastResults()`, `getTestHistory()` provide access for UI and reports.
- `generateReport(results)` renders markdown summary (pass/fail counts, suite details).
- Individual test functions available for targeted diagnostics.

### 3. Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure SelfTester is registered with dependencies
{
  "modules": {
    "SelfTester": {
      "dependencies": ["Utils", "EventBus", "StateManager"],
      "enabled": true,
      "async": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates test suite logic:
```javascript
factory: (deps) => {
  const { Utils, EventBus, StateManager } = deps;
  const { logger } = Utils;

  // Internal state (accessible to widget via closure)
  let lastTestResults = null;
  let testHistory = [];

  // Each test suite follows the pattern:
  const testSuiteName = async () => {
    const results = { name: 'Suite Name', passed: 0, failed: 0, tests: [] };
    // Run individual tests, push to results.tests array
    // Increment passed/failed counts
    return results;
  };

  // Orchestration function
  const runAllTests = async () => {
    const results = { timestamp, suites: [], summary: {} };
    for (const suite of [testModuleLoading, testToolExecution, /*...*/]) {
      const suiteResult = await suite();
      results.suites.push(suiteResult);
      results.summary.passed += suiteResult.passed;
      results.summary.failed += suiteResult.failed;
    }

    // Store in closure variables
    lastTestResults = results;
    testHistory.push({ timestamp, summary, duration });

    // Emit event
    EventBus.emit('self-test:complete', results);

    return results;
  };

  // Web Component defined here to access closure variables
  class SelfTesterWidget extends HTMLElement { /*...*/ }
  customElements.define('self-tester-widget', SelfTesterWidget);

  return { init, api, widget };
}
```

**Step 3: Test Suite Implementation**

Each test suite follows a standard pattern:
1. **Initialize Results**: Create results object with name, passed/failed counters, tests array
2. **Check Prerequisites**: Verify dependencies (DIContainer, modules) are available
3. **Execute Tests**: Run individual checks, push to tests array with pass/fail status
4. **Handle Errors**: Wrap in try/catch, record error messages in test results
5. **Return Results**: Return complete results object with all test outcomes

Example test pattern:
```javascript
const testModuleLoading = async () => {
  const results = { name: 'Module Loading', passed: 0, failed: 0, tests: [] };

  try {
    const container = window.DIContainer;
    if (!container) {
      results.tests.push({ name: 'DI Container exists', passed: false, error: 'Not found' });
      results.failed++;
      return results;
    }

    results.tests.push({ name: 'DI Container exists', passed: true });
    results.passed++;

    // Test each core module...
    for (const moduleName of ['Utils', 'StateManager', /*...*/]) {
      try {
        const module = container.get(moduleName);
        results.tests.push({ name: `Module ${moduleName} loaded`, passed: !!module });
        module ? results.passed++ : results.failed++;
      } catch (error) {
        results.tests.push({ name: `Module ${moduleName} loaded`, passed: false, error: error.message });
        results.failed++;
      }
    }
  } catch (error) {
    results.tests.push({ name: 'Suite execution', passed: false, error: error.message });
    results.failed++;
  }

  return results;
};
```

**Step 4: Web Component Widget**

The widget provides interactive test execution and results display:
```javascript
class SelfTesterWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  set moduleApi(api) {
    this._api = api;  // Receives full API object
    this.render();
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 10000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  render() {
    // Access closure variables: lastTestResults, testHistory
    const lastRun = getLastResults();
    const history = getTestHistory();

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      ${this.renderPanel()}
    `;

    // Wire up interactive buttons
    this.shadowRoot.querySelector('.run-tests-btn')
      .addEventListener('click', async () => {
        await runAllTests();
        this.render();
      });
  }
}
```

**Step 5: Integration Points**

1. **Programmatic Execution**:
   - Trigger `runAllTests()` before applying changesets
   - Check `results.summary.failed > 0` to gate risky operations
   - Use `getLastResults()` to display results in other UI components

2. **Event-Driven Integration**:
   - Listen for `'self-test:complete'` events via EventBus
   - Create reflections or audit logs based on test outcomes
   - Surface toast notifications for failures

3. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard system
   - Provides `getStatus()` method for dashboard summary view
   - Updates every 10 seconds via `updateInterval: 10000`

**Step 6: Extending Test Coverage**

Add new test suites by following the pattern:
```javascript
const testNewFeature = async () => {
  const results = { name: 'New Feature', passed: 0, failed: 0, tests: [] };
  // Implement tests...
  return results;
};

// Add to runAllTests suites array
const suites = [
  testModuleLoading,
  testToolExecution,
  testFSMTransitions,
  testStorageSystems,
  testPerformanceMonitoring,
  testNewFeature  // ← New suite
];
```

**Step 7: Performance Considerations**

- Suites should execute quickly (<3s total) for responsive UI
- Use safe, read-only operations to avoid side effects
- For heavy tests, run asynchronously and stream progress
- Widget auto-refresh interval balances responsiveness with performance

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
