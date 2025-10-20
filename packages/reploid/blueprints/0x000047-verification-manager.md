# Blueprint 0x00004D: Verification Manager

**Target Upgrade:** VRFY (`verification-manager.js`)

**Objective:** Provide safe, sandboxed execution of verification commands (tests, linting, type-checking) in a Web Worker to validate self-modifications without risking the main application.

**Prerequisites:** 0x00000A (Tool Runner Engine), Web Workers API

**Affected Artifacts:** `/upgrades/verification-manager.js`, `/upgrades/verification-worker.js`, `/upgrades/tool-runner.js`, `/upgrades/sentinel-tools.js`

---

### 1. The Strategic Imperative

When an agent modifies its own code, it must be able to:
- **Verify changes are correct** by running tests
- **Ensure code quality** through linting
- **Validate types** before committing changes
- **Safely execute** verification without crashing the main app

**The Problem:**
Running user-provided test code directly in the main thread poses severe risks:
- Infinite loops can freeze the UI
- Syntax errors can crash the application
- Malicious code can access sensitive data
- Failed tests can corrupt the agent's state

**The Solution:**
Execute all verification commands in an isolated Web Worker with:
- Separate thread (can be terminated)
- Sandboxed environment (no DOM access)
- Message-based communication (serialized data only)
- Timeout protection (kill long-running tests)

---

### 2. The Architectural Solution

The Verification Manager consists of two components:

#### 2.1 VerificationManager (Main Thread)
Orchestrates worker lifecycle and communication:

```javascript
const VerificationManager = {
  worker: null,
  pendingRequests: new Map(),

  init() {
    this.worker = new Worker('/upgrades/verification-worker.js');
    this.worker.onmessage = (e) => {
      const { requestId, result } = e.data;
      const resolver = this.pendingRequests.get(requestId);
      if (resolver) {
        resolver(result);
        this.pendingRequests.delete(requestId);
      }
    };
  },

  async runVerification(command, timeout = 30000) {
    const requestId = crypto.randomUUID();

    return new Promise((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.worker.terminate();
        this.init(); // Restart worker
        reject(new Error('Verification timeout'));
      }, timeout);

      // Store resolver
      this.pendingRequests.set(requestId, (result) => {
        clearTimeout(timeoutId);
        resolve(result);
      });

      // Send command to worker
      this.worker.postMessage({ requestId, command });
    });
  }
};
```

#### 2.2 VerificationWorker (Worker Thread)
Executes verification commands in isolation:

```javascript
// In verification-worker.js
self.onmessage = async (e) => {
  const { requestId, command } = e.data;

  try {
    const result = await executeVerification(command);
    self.postMessage({ requestId, result });
  } catch (error) {
    self.postMessage({
      requestId,
      result: { success: false, error: error.message }
    });
  }
};

const executeVerification = async (command) => {
  if (command.startsWith('test:')) {
    return await runTests(command.substring(5));
  } else if (command.startsWith('lint:')) {
    return await runLint(command.substring(5));
  } else if (command.startsWith('typecheck:')) {
    return await runTypeCheck(command.substring(10));
  }

  throw new Error(`Unknown verification command: ${command}`);
};
```

---

### 3. Verification Command Types

#### 3.1 Test Execution
```javascript
// Command format: "test:/tests/unit/module.test.js"

const runTests = async (testPath) => {
  // Load test file from VFS snapshot
  const testCode = vfsSnapshot[testPath];

  // Create test environment
  const context = {
    describe: (name, fn) => { /* test suite */ },
    it: (name, fn) => { /* test case */ },
    expect: (value) => ({ /* assertions */ })
  };

  // Execute test code
  const testFn = new Function(...Object.keys(context), testCode);
  testFn(...Object.values(context));

  return {
    success: allTestsPassed,
    output: testResults
  };
};
```

#### 3.2 Linting
```javascript
// Command format: "lint:/upgrades/module.js"

const runLint = async (filePath) => {
  const code = vfsSnapshot[filePath];

  const issues = [];

  // Basic linting rules
  if (code.includes('eval(')) {
    issues.push('Avoid eval() - security risk');
  }
  if (!code.includes('use strict')) {
    issues.push('Missing "use strict"');
  }
  // ... more rules

  return {
    success: issues.length === 0,
    output: issues
  };
};
```

#### 3.3 Type Checking
```javascript
// Command format: "typecheck:/upgrades/module.js"

const runTypeCheck = async (filePath) => {
  const code = vfsSnapshot[filePath];

  // Parse JSDoc comments
  const typeErrors = [];

  // Simple type checking
  const paramMatches = code.matchAll(/@param {(\w+)} (\w+)/g);
  for (const match of paramMatches) {
    // Verify parameter usage matches type
  }

  return {
    success: typeErrors.length === 0,
    output: typeErrors
  };
};
```

---

### 4. The Implementation Pathway

**Phase 1: Worker Infrastructure** ✅ Complete
1. Create VerificationManager main thread orchestrator
2. Create verification-worker.js Web Worker
3. Implement message-based communication
4. Add timeout protection

**Phase 2: Verification Commands** ✅ Complete
1. Implement test execution with simple test framework
2. Add basic linting rules
3. Add type checking placeholders
4. Support VFS snapshot passing

**Phase 3: Integration** ✅ Complete
1. Register VRFY in DI container
2. Use in ToolRunner for `apply_dogs_bundle` verification
3. Use in SentinelTools for verification commands
4. Provide graceful fallback when unavailable

**Phase 4: Enhancement** ⚠️ Future
1. Add more sophisticated test framework
2. Integrate real linting library (ESLint-compatible)
3. Add TypeScript type checking
4. Support parallel test execution

---

## Module Interface

### Initialization

```javascript
const VerificationManager = window.DIContainer.resolve('VerificationManager');

// Initialize worker
await VerificationManager.init();
```

### Running Verification

```javascript
// Run tests
const testResult = await VerificationManager.runVerification(
  'test:/tests/unit/state-manager.test.js'
);

if (testResult.success) {
  console.log('✅ Tests passed');
} else {
  console.error('❌ Tests failed:', testResult.error);
}

// Run linting
const lintResult = await VerificationManager.runVerification(
  'lint:/upgrades/tool-runner.js'
);

// Run type checking
const typeResult = await VerificationManager.runVerification(
  'typecheck:/upgrades/api-client.js'
);
```

### Integration with Tool Runner

```javascript
// In apply_dogs_bundle tool
if (verify_command) {
  const VerificationManager = globalThis.DIContainer?.resolve('VerificationManager');

  if (VerificationManager) {
    const result = await VerificationManager.runVerification(verify_command);

    if (!result.success) {
      // Rollback changes
      await StateManager.restoreCheckpoint(checkpoint.id);
      throw new ToolError(`Verification failed: ${result.error}`);
    }
  }
}
```

---

## Safety Mechanisms

### 1. Thread Isolation
**Problem:** Test code could crash the main application
**Solution:** Web Worker runs in separate thread - crashes only kill worker, not app

### 2. Timeout Protection
**Problem:** Infinite loops in tests freeze the application
**Solution:** 30-second timeout terminates worker and restarts it

```javascript
setTimeout(() => {
  this.worker.terminate();
  this.init(); // Fresh worker
  reject(new Error('Verification timeout'));
}, 30000);
```

### 3. Sandboxed Execution
**Problem:** Test code could access sensitive data
**Solution:** Worker has no access to:
- DOM/window object
- LocalStorage
- Cookies
- Other tabs
- Main VFS (only receives snapshot)

### 4. VFS Snapshot
**Problem:** Tests could corrupt the live VFS
**Solution:** Pass read-only snapshot to worker

```javascript
const vfsSnapshot = await StateManager.createVFSSnapshot();
this.worker.postMessage({ command, vfsSnapshot });
```

---

## Use Cases

### 1. Safe Self-Modification
```javascript
// Apply changes
await ToolRunner.runTool('apply_dogs_bundle', {
  dogs_path: '/changes.dogs.md',
  verify_command: 'test:/tests/unit/new-feature.test.js'
});

// If tests fail, changes are automatically rolled back
```

### 2. Pre-Commit Validation
```javascript
// Before committing self-modification
const lintOk = await VerificationManager.runVerification('lint:/upgrades/new-module.js');
const testsOk = await VerificationManager.runVerification('test:/tests/unit/new-module.test.js');

if (lintOk.success && testsOk.success) {
  await commitChanges();
} else {
  await discardChanges();
}
```

### 3. Continuous Validation
```javascript
// After each cycle
EventBus.on('cycle:completed', async () => {
  const result = await VerificationManager.runVerification('test:/tests/integration/smoke.test.js');
  if (!result.success) {
    EventBus.emit('agent:regression-detected', result);
  }
});
```

---

## Performance Characteristics

**Worker Startup:** ~10-50ms (one-time cost)
**Message Overhead:** ~1-5ms per verification
**Test Execution:** Depends on test complexity
**Timeout:** 30 seconds default (configurable)

**Memory:**
- Worker thread: ~1-5MB overhead
- VFS snapshot: Copy of modified files only
- Total: <10MB for typical usage

---

## Success Criteria

**Safety:**
- ✅ Crashes in worker don't affect main app
- ✅ Infinite loops get killed after timeout
- ✅ Test code cannot access sensitive data
- ✅ VFS corruption impossible from worker

**Functionality:**
- ✅ Can execute test files with assertions
- ✅ Can lint code with basic rules
- ✅ Can check types from JSDoc
- ✅ Returns clear success/failure status

**Integration:**
- ✅ Used by ToolRunner for verification
- ✅ Used by SentinelTools for test commands
- ✅ Graceful degradation when unavailable
- ✅ Easy to extend with new verification types

---

## Known Limitations

1. **Simple test framework** - Not feature-complete like Jest/Mocha
2. **Basic linting** - Missing many advanced lint rules
3. **No TypeScript** - Only supports JSDoc type hints
4. **No coverage** - Doesn't track code coverage metrics
5. **No mocking** - Tests run against real dependencies

---

## Future Enhancements

1. **Full test framework** - Jest/Vitest-compatible API
2. **Real linting** - ESLint integration
3. **TypeScript support** - Full type checking with tsc
4. **Code coverage** - Istanbul-style coverage reports
5. **Test isolation** - Mock dependencies, clean state between tests
6. **Parallel execution** - Run multiple test files concurrently
7. **Watch mode** - Re-run tests on file changes
8. **Visual test runner** - UI for test results and debugging

---

### 10. Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class VerificationManagerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 2 seconds to track active verifications
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const passRate = verificationStats.totalRuns > 0
      ? Math.round((verificationStats.passed / verificationStats.totalRuns) * 100)
      : 100;
    const isActive = verificationStats.activeVerifications > 0;

    return {
      state: isActive ? 'active' : 'idle',
      primaryMetric: `${verificationStats.totalRuns} tests run`,
      secondaryMetric: `${passRate}% pass rate`,
      lastActivity: verificationStats.lastRun,
      message: isActive ? `Running ${verificationStats.activeVerifications} verification(s)` : null
    };
  }

  getControls() {
    return [
      {
        id: 'clear-history',
        label: 'Clear History',
        action: () => {
          verificationStats.history = [];
          this.render();
          return { success: true, message: 'Verification history cleared' };
        }
      }
    ];
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .verification-panel { padding: 12px; color: #fff; }
        .stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 10px;
        }
        .stat-card { padding: 10px; background: rgba(255,255,255,0.05); border-radius: 5px; }
      </style>
      <div class="verification-panel">
        <h4>✓ Verification Manager</h4>
        <div class="stats-grid">
          <div class="stat-card">
            <div>Total Runs</div>
            <div>${verificationStats.totalRuns}</div>
          </div>
          <div class="stat-card">
            <div>Passed</div>
            <div>${verificationStats.passed}</div>
          </div>
          <div class="stat-card">
            <div>Failed</div>
            <div>${verificationStats.failed}</div>
          </div>
        </div>
      </div>
    `;
  }
}

// Register custom element
const elementName = 'verification-manager-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, VerificationManagerWidget);
}

const widget = {
  element: elementName,
  displayName: 'Verification Manager',
  icon: '✓',
  category: 'rsi'
};
```

**Key features:**
- Displays verification statistics (total runs, pass rate, failures)
- Shows active verification count when running
- Tracks verification history
- Provides control to clear history
- Auto-refresh to track active verifications
- Uses closure access to module state (verificationStats)
- Shadow DOM encapsulation for styling

---

**Remember:** This module enables the agent to **safely validate its self-modifications**. Without verification, the agent risks breaking itself with every change. With verification, it can confidently evolve knowing tests will catch regressions.
