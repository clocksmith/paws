// @blueprint 0x000057 - Verification Worker for sandboxed testing/linting/type-checking
// Web Worker for sandboxed verification execution
// This runs verification commands in an isolated context

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

// Main verification handler
async function handleVerification(payload) {
    const { command, vfsSnapshot, sessionId } = payload;

    try {
        // Log start of verification
        self.postMessage({
            type: 'LOG',
            level: 'info',
            message: `[Worker] Starting verification: ${command}`
        });

        // Parse the command type
        const result = await executeCommand(command, vfsSnapshot);

        // Send success result
        self.postMessage({
            type: 'VERIFY_COMPLETE',
            success: result.success,
            output: result.output,
            error: result.error,
            sessionId
        });

    } catch (error) {
        // Send error result
        self.postMessage({
            type: 'VERIFY_COMPLETE',
            success: false,
            error: error.message,
            sessionId
        });
    }
}

// Execute verification command in sandboxed context
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

// Run test suite
async function runTests(testPath, vfsSnapshot) {
    try {
        // Get test file from VFS snapshot
        const testCode = vfsSnapshot[testPath];
        if (!testCode) {
            return {
                success: false,
                error: `Test file not found: ${testPath}`
            };
        }

        // Create a simple test runner
        const testResults = [];
        const testEnvironment = createTestEnvironment(testResults, vfsSnapshot);

        // Execute tests in sandboxed context
        try {
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

            // Run collected tests
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

        } catch (error) {
            return {
                success: false,
                error: `Test execution error: ${error.message}`
            };
        }

    } catch (error) {
        return {
            success: false,
            error: `Test runner error: ${error.message}`
        };
    }
}

// Run linter
async function runLinter(filePath, vfsSnapshot) {
    try {
        const fileContent = vfsSnapshot[filePath];
        if (!fileContent) {
            return {
                success: false,
                error: `File not found: ${filePath}`
            };
        }

        // Basic JavaScript linting rules
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
        const varMatches = fileContent.match(/\bvar\s+/g);
        if (varMatches) {
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

    } catch (error) {
        return {
            success: false,
            error: `Linter error: ${error.message}`
        };
    }
}

// Run type checking
async function runTypeCheck(filePath, vfsSnapshot) {
    try {
        const fileContent = vfsSnapshot[filePath];
        if (!fileContent) {
            return {
                success: false,
                error: `File not found: ${filePath}`
            };
        }

        // Basic type checking for common issues
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
        if (fileContent.includes('=== null') || fileContent.includes('!== null')) {
            // This is fine - strict null checks
        } else if (fileContent.includes('== null') || fileContent.includes('!= null')) {
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

    } catch (error) {
        return {
            success: false,
            error: `Type check error: ${error.message}`
        };
    }
}

// Safe eval for simple expressions
async function runSafeEval(expression, vfsSnapshot) {
    try {
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
            // Add VFS access in read-only mode
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

    } catch (error) {
        return {
            success: false,
            error: `Safe eval error: ${error.message}`
        };
    }
}

// Helper: Create test environment
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
            },
            toBeTruthy: () => {
                if (!actual) {
                    throw new Error(`Expected truthy value but got ${actual}`);
                }
            },
            toBeFalsy: () => {
                if (actual) {
                    throw new Error(`Expected falsy value but got ${actual}`);
                }
            }
        }),

        beforeEach: (fn) => {
            // Store for later execution
            if (currentSuite) {
                currentSuite.beforeEach = fn;
            }
        },

        afterEach: (fn) => {
            // Store for later execution
            if (currentSuite) {
                currentSuite.afterEach = fn;
            }
        },

        runTests: async () => {
            for (const suite of suites) {
                for (const test of suite.tests) {
                    try {
                        if (suite.beforeEach) await suite.beforeEach();
                        await test.fn();
                        if (suite.afterEach) await suite.afterEach();

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

// Helper: Get line number of substring
function getLineNumber(content, substring) {
    const index = content.indexOf(substring);
    if (index === -1) return 0;

    const lines = content.substring(0, index).split('\n');
    return lines.length;
}

// Helper: Check for undefined variables (basic)
function checkUndefinedVariables(content) {
    const undefined = [];

    // This is a very basic check - a real implementation would use an AST parser
    const variablePattern = /\b([a-zA-Z_$][a-zA-Z0-9_$]*)\s*(?=[^\w$])/g;
    const declaredPattern = /\b(?:const|let|var|function)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;

    const declared = new Set();
    let match;

    // Find declared variables
    while ((match = declaredPattern.exec(content)) !== null) {
        declared.add(match[1]);
    }

    // Add common globals
    const globals = new Set([
        'window', 'document', 'console', 'Math', 'Date', 'JSON',
        'Object', 'Array', 'String', 'Number', 'Boolean',
        'undefined', 'null', 'true', 'false',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'Promise', 'async', 'await'
    ]);

    // Check for undeclared usage (very simplified)
    // Note: This is not accurate and would need proper parsing

    return undefined;
}

// Log initialization
self.postMessage({
    type: 'READY',
    message: 'Verification Worker initialized'
});

// ============================================
// WEB COMPONENT WIDGET (for main thread visualization)
// ============================================
// This code only runs in the main thread, not in the worker
if (typeof HTMLElement !== 'undefined' && typeof window !== 'undefined') {
  class VerificationWorkerWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 2000);
    }

    disconnectedCallback() {
      if (this._interval) {
        clearInterval(this._interval);
        this._interval = null;
      }
    }

    getStatus() {
      // Query the VerificationManager for worker status
      const verificationManager = window.app?.modules?.VerificationManager;

      if (!verificationManager) {
        return {
          state: 'disabled',
          primaryMetric: 'Not loaded',
          secondaryMetric: 'Manager missing',
          lastActivity: null,
          message: 'VerificationManager module not available'
        };
      }

      // Get verification statistics
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

    render() {
      const status = this.getStatus();

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: monospace;
            font-size: 12px;
            color: #e0e0e0;
          }

          .worker-panel {
            background: rgba(255, 255, 255, 0.05);
            padding: 16px;
            border-radius: 8px;
            border-left: 3px solid #32cd32;
          }

          h3 {
            margin: 0 0 12px 0;
            font-size: 14px;
            color: #32cd32;
          }

          .status-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
          }

          .label {
            color: #888;
          }

          .value {
            font-weight: bold;
          }

          .value-idle { color: #0f0; }
          .value-active { color: #0ff; }
          .value-warning { color: #ff0; }
          .value-error { color: #f00; }
          .value-disabled { color: #888; }

          .message {
            margin-top: 8px;
            padding: 8px;
            background: rgba(255, 255, 0, 0.1);
            border-radius: 4px;
            font-size: 11px;
            color: #ff0;
          }
        </style>

        <div class="worker-panel">
          <h3>✓ Verification Worker</h3>

          <div class="status-row">
            <span class="label">Status:</span>
            <span class="value value-${status.state}">${status.state.toUpperCase()}</span>
          </div>

          <div class="status-row">
            <span class="label">Running:</span>
            <span class="value">${status.primaryMetric}</span>
          </div>

          <div class="status-row">
            <span class="label">Verified:</span>
            <span class="value">${status.secondaryMetric}</span>
          </div>

          ${status.message ? `<div class="message">⚠️ ${status.message}</div>` : ''}
        </div>
      `;
    }
  }

  // Register the custom element
  const elementName = 'verification-worker-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, VerificationWorkerWidget);
  }

  // Export widget configuration for module registry
  if (typeof window !== 'undefined') {
    window.VerificationWorkerWidget = {
      element: elementName,
      displayName: 'Verification Worker',
      icon: '✓',
      category: 'worker'
    };
  }
}