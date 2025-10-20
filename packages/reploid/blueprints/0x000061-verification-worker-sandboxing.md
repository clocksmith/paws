# Blueprint 0x000061: Verification Worker Sandboxing & Monitoring

**Objective:** Provide sandboxed execution environment for verification tasks (tests, linting, type-checking) with real-time status monitoring.

**Target Upgrade:** VerificationWorker (`verification-worker.js`)

**Prerequisites:** 0x00004D (Verification Manager), 0x000057 (Worker Pool)

**Affected Artifacts:** `/upgrades/verification-worker.js`

---

### 1. The Strategic Imperative

A self-modifying agent system requires safe verification of code changes before applying them:

- **Sandbox Isolation**: Verification code must run in an isolated Web Worker context
- **Test Execution**: Run unit tests without access to production state
- **Static Analysis**: Perform linting and type checking in a controlled environment
- **Safe Evaluation**: Execute limited expressions for verification purposes
- **Error Containment**: Prevent verification failures from crashing the agent
- **Status Visibility**: Real-time monitoring of active verifications and results

The Verification Worker provides a sandboxed execution environment where the agent can safely test code modifications before applying them to the running system.

### 2. The Architectural Solution

The `/upgrades/verification-worker.js` implements both **Worker verification logic** (runs in worker context) and **Widget monitoring** (runs in main thread).

#### Worker Message Protocol

```javascript
// Worker message handler
self.addEventListener('message', async (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'VERIFY':
      await handleVerification(payload);
      break;

    case 'PING':
      self.postMessage({ type: 'PONG', success: true });
      break;

    default:
      self.postMessage({
        type: 'ERROR',
        error: `Unknown message type: ${type}`
      });
  }
});

async function handleVerification(payload) {
  const { command, vfsSnapshot, sessionId } = payload;

  try {
    const result = await executeCommand(command, vfsSnapshot);

    self.postMessage({
      type: 'VERIFY_COMPLETE',
      success: result.success,
      output: result.output,
      error: result.error,
      sessionId
    });
  } catch (error) {
    self.postMessage({
      type: 'VERIFY_COMPLETE',
      success: false,
      error: error.message,
      sessionId
    });
  }
}
```

#### Command Execution Architecture

```javascript
async function executeCommand(command, vfsSnapshot) {
  // Parse command type
  if (command.startsWith('test:')) {
    return await runTests(command.substring(5), vfsSnapshot);
  } else if (command.startsWith('lint:')) {
    return await runLinter(command.substring(5), vfsSnapshot);
  } else if (command.startsWith('type-check:')) {
    return await runTypeCheck(command.substring(11), vfsSnapshot);
  } else if (command.startsWith('eval:')) {
    return await runSafeEval(command.substring(5), vfsSnapshot);
  } else {
    return {
      success: false,
      error: `Unknown command type: ${command}`
    };
  }
}
```

#### Test Runner Implementation

```javascript
async function runTests(testPath, vfsSnapshot) {
  // Get test file from VFS snapshot
  const testCode = vfsSnapshot[testPath];
  if (!testCode) {
    return {
      success: false,
      error: `Test file not found: ${testPath}`
    };
  }

  // Create test environment
  const testResults = [];
  const testEnvironment = createTestEnvironment(testResults, vfsSnapshot);

  // Execute tests in sandboxed context
  const testFunction = new Function(
    'describe', 'it', 'expect', 'beforeEach', 'afterEach',
    testCode
  );

  testFunction(
    testEnvironment.describe,
    testEnvironment.it,
    testEnvironment.expect,
    testEnvironment.beforeEach,
    testEnvironment.afterEach
  );

  await testEnvironment.runTests();

  // Check results
  const failures = testResults.filter(r => !r.passed);
  if (failures.length > 0) {
    return {
      success: false,
      output: testResults,
      error: `${failures.length} test(s) failed`
    };
  }

  return {
    success: true,
    output: testResults,
    error: null
  };
}
```

#### Widget Monitoring (Main Thread)

```javascript
class VerificationWorkerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getStatus() {
    const verificationManager = window.app?.modules?.VerificationManager;

    if (!verificationManager) {
      return {
        state: 'disabled',
        primaryMetric: 'Not loaded',
        secondaryMetric: 'Manager missing',
        message: 'VerificationManager module not available'
      };
    }

    const stats = verificationManager.getStats?.() || {};
    const activeVerifications = stats.active || 0;
    const totalCompleted = stats.completed || 0;
    const totalFailed = stats.failed || 0;
    const lastVerificationTime = stats.lastVerificationTime || null;

    const hasFailed = totalFailed > 0;
    const isActive = activeVerifications > 0;

    return {
      state: hasFailed ? 'warning' : (isActive ? 'active' : 'idle'),
      primaryMetric: `${activeVerifications} running`,
      secondaryMetric: `${totalCompleted} verified`,
      lastActivity: lastVerificationTime,
      message: hasFailed ? `${totalFailed} failed` : null
    };
  }
}
```

### 3. Core Responsibilities

1. **Test Execution**: Run unit tests in isolated environment with describe/it/expect API
2. **Linting**: Perform static analysis for code quality issues
3. **Type Checking**: Validate type safety and undefined variable usage
4. **Safe Evaluation**: Execute limited expressions in restricted sandbox
5. **VFS Integration**: Accept VFS snapshots for file-based verification
6. **Error Reporting**: Capture and report verification failures with details
7. **Status Monitoring**: Widget displays active, completed, and failed verifications

### 4. The Implementation Pathway

#### Step 1: Test Environment Creation

```javascript
function createTestEnvironment(results, vfsSnapshot) {
  const suites = [];
  let currentSuite = null;

  return {
    describe: (name, fn) => {
      currentSuite = { name, tests: [] };
      suites.push(currentSuite);
      fn();
      currentSuite = null;
    },

    it: (name, fn) => {
      const test = { name, fn };
      if (currentSuite) {
        currentSuite.tests.push(test);
      } else {
        suites.push({ name: 'Default', tests: [test] });
      }
    },

    expect: (actual) => ({
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected} but got ${actual}`);
        }
      },
      toEqual: (expected) => {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
          throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
        }
      },
      toContain: (value) => {
        if (!actual.includes(value)) {
          throw new Error(`Expected to contain ${value}`);
        }
      }
    }),

    runTests: async () => {
      for (const suite of suites) {
        for (const test of suite.tests) {
          try {
            await test.fn();
            results.push({
              suite: suite.name,
              test: test.name,
              passed: true
            });
          } catch (error) {
            results.push({
              suite: suite.name,
              test: test.name,
              passed: false,
              error: error.message
            });
          }
        }
      }
    }
  };
}
```

#### Step 2: Linting Implementation

```javascript
async function runLinter(filePath, vfsSnapshot) {
  const fileContent = vfsSnapshot[filePath];
  if (!fileContent) {
    return {
      success: false,
      error: `File not found: ${filePath}`
    };
  }

  const lintIssues = [];

  // Check for console.log statements
  if (fileContent.includes('console.log') && !filePath.includes('debug')) {
    lintIssues.push({
      line: getLineNumber(fileContent, 'console.log'),
      message: 'Avoid console.log in production code'
    });
  }

  // Check for debugger statements
  if (fileContent.includes('debugger')) {
    lintIssues.push({
      line: getLineNumber(fileContent, 'debugger'),
      message: 'Remove debugger statements'
    });
  }

  // Check for eval usage
  if (fileContent.includes('eval(')) {
    lintIssues.push({
      line: getLineNumber(fileContent, 'eval('),
      message: 'Avoid using eval() for security reasons'
    });
  }

  // Check for var usage (prefer const/let)
  if (fileContent.match(/\bvar\s+/g)) {
    lintIssues.push({
      line: getLineNumber(fileContent, 'var '),
      message: 'Use const or let instead of var'
    });
  }

  if (lintIssues.length > 0) {
    return {
      success: false,
      output: lintIssues,
      error: `Found ${lintIssues.length} linting issue(s)`
    };
  }

  return {
    success: true,
    output: [],
    error: null
  };
}
```

#### Step 3: Type Checking

```javascript
async function runTypeCheck(filePath, vfsSnapshot) {
  const fileContent = vfsSnapshot[filePath];
  if (!fileContent) {
    return {
      success: false,
      error: `File not found: ${filePath}`
    };
  }

  const typeIssues = [];

  // Check for undefined variable usage
  const undefinedVars = checkUndefinedVariables(fileContent);
  if (undefinedVars.length > 0) {
    typeIssues.push(...undefinedVars.map(v => ({
      variable: v,
      message: `Potentially undefined variable: ${v}`
    })));
  }

  // Check for type mismatches in comparisons
  if (fileContent.includes('== null') || fileContent.includes('!= null')) {
    typeIssues.push({
      message: 'Use strict equality (===) for null checks'
    });
  }

  if (typeIssues.length > 0) {
    return {
      success: false,
      output: typeIssues,
      error: `Found ${typeIssues.length} type issue(s)`
    };
  }

  return {
    success: true,
    output: [],
    error: null
  };
}
```

#### Step 4: Safe Evaluation Sandbox

```javascript
async function runSafeEval(expression, vfsSnapshot) {
  // Create a very limited sandbox
  const sandbox = {
    Math: Math,
    Date: Date,
    JSON: JSON,
    Object: Object.freeze(Object.create(null)),
    Array: Array,
    String: String,
    Number: Number,
    Boolean: Boolean,
    vfs: Object.freeze(vfsSnapshot)
  };

  // Restrict dangerous operations
  const restrictedKeywords = [
    'eval', 'Function', 'setTimeout', 'setInterval',
    'require', 'import', 'fetch', 'XMLHttpRequest',
    'localStorage', 'sessionStorage', 'document', 'window'
  ];

  for (const keyword of restrictedKeywords) {
    if (expression.includes(keyword)) {
      return {
        success: false,
        error: `Restricted keyword '${keyword}' not allowed in safe eval`
      };
    }
  }

  // Execute in sandbox
  try {
    const sandboxKeys = Object.keys(sandbox);
    const sandboxValues = sandboxKeys.map(k => sandbox[k]);
    const evalFunction = new Function(...sandboxKeys, `return ${expression}`);
    const result = evalFunction(...sandboxValues);

    return {
      success: true,
      output: result,
      error: null
    };
  } catch (error) {
    return {
      success: false,
      error: `Evaluation error: ${error.message}`
    };
  }
}
```

#### Step 5: Widget Status Display

```javascript
class VerificationWorkerWidget extends HTMLElement {
  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
    }
  }

  getStatus() {
    const verificationManager = window.app?.modules?.VerificationManager;

    if (!verificationManager) {
      return {
        state: 'disabled',
        primaryMetric: 'Not loaded',
        secondaryMetric: 'Manager missing',
        message: 'VerificationManager module not available'
      };
    }

    const stats = verificationManager.getStats?.() || {};
    const activeVerifications = stats.active || 0;
    const totalCompleted = stats.completed || 0;
    const totalFailed = stats.failed || 0;

    return {
      state: totalFailed > 0 ? 'warning' : (activeVerifications > 0 ? 'active' : 'idle'),
      primaryMetric: `${activeVerifications} running`,
      secondaryMetric: `${totalCompleted} verified`,
      lastActivity: stats.lastVerificationTime || null,
      message: totalFailed > 0 ? `${totalFailed} failed` : null
    };
  }
}
```

### 5. Operational Safeguards & Quality Gates

- **VFS Snapshots**: Never modify original VFS, only work with immutable snapshots
- **Keyword Filtering**: Block dangerous keywords in safe eval
- **Function Constructor**: Use `new Function()` for controlled code execution
- **Error Boundaries**: Wrap all verification operations in try/catch
- **Timeout Protection**: Prevent infinite loops in test execution
- **Worker Isolation**: Run in separate thread to prevent main thread blocking

### 6. Widget Protocol Compliance

**Required `getStatus()` Method:**

```javascript
getStatus() {
  return {
    state: 'idle' | 'active' | 'warning' | 'disabled',
    primaryMetric: `${activeCount} running`,
    secondaryMetric: `${completedCount} verified`,
    lastActivity: timestamp | null,
    message: `${failedCount} failed` | null
  };
}
```

**Widget Registration:**

```javascript
window.VerificationWorkerWidget = {
  element: 'verification-worker-widget',
  displayName: 'Verification Worker',
  icon: '✓',
  category: 'worker'
};
```

### 7. Extension Points

- **Custom Matchers**: Add more expect() matchers (toThrow, toHaveProperty, etc.)
- **Coverage Tracking**: Instrument code to measure test coverage
- **Performance Profiling**: Track execution time of individual tests
- **Parallel Execution**: Run multiple test suites concurrently
- **AST-Based Analysis**: Use proper AST parser for more accurate linting/type checking
- **TypeScript Support**: Add TypeScript type checking capabilities

Use this blueprint when implementing self-testing, validating code modifications, or debugging verification workflows.
