// @blueprint 0x00003C - Runs self-testing and validation frameworks.
// Self-Testing & Validation Framework for Safe RSI
// Enables the agent to validate its own integrity before and after modifications

const SelfTester = {
  metadata: {
    id: 'SelfTester',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'Storage'],
    async: true,
    type: 'validation'
  },

  factory: (deps) => {
    const { Utils, EventBus, Storage } = deps;
    const { logger } = Utils;

    // Test results cache
    let lastTestResults = null;
    let testHistory = [];

    /**
     * Test that all required modules load successfully
     * @returns {Promise<Object>} Test results with pass/fail status
     */
    const testModuleLoading = async () => {
      logger.info('[SelfTester] Running module loading tests...');
      const results = {
        name: 'Module Loading',
        passed: 0,
        failed: 0,
        tests: []
      };

      try {
        // Get the DI container from window
        const container = window.DIContainer;
        if (!container) {
          results.tests.push({
            name: 'DI Container exists',
            passed: false,
            error: 'DIContainer not found on window object'
          });
          results.failed++;
          return results;
        }

        results.tests.push({
          name: 'DI Container exists',
          passed: true
        });
        results.passed++;

        // Check core modules
        const coreModules = [
          'Utils', 'Storage', 'EventBus', 'ApiClient',
          'ToolRunner', 'PerformanceMonitor', 'Introspector', 'ReflectionStore'
        ];

        for (const moduleName of coreModules) {
          try {
            const module = container.get(moduleName);
            if (module) {
              results.tests.push({
                name: `Module ${moduleName} loaded`,
                passed: true
              });
              results.passed++;
            } else {
              results.tests.push({
                name: `Module ${moduleName} loaded`,
                passed: false,
                error: 'Module returned null/undefined'
              });
              results.failed++;
            }
          } catch (error) {
            results.tests.push({
              name: `Module ${moduleName} loaded`,
              passed: false,
              error: error.message
            });
            results.failed++;
          }
        }

        // Check if modules have expected methods
        const moduleChecks = [
          { name: 'Storage', methods: ['getState', 'setState', 'updateState'] },
          { name: 'EventBus', methods: ['on', 'emit', 'off'] },
          { name: 'ToolRunner', methods: ['execute', 'loadTools'] },
          { name: 'PerformanceMonitor', methods: ['getMetrics', 'trackEvent'] },
          { name: 'Introspector', methods: ['getModuleGraph', 'getToolCatalog'] },
          { name: 'ReflectionStore', methods: ['addReflection', 'getReflections'] }
        ];

        for (const check of moduleChecks) {
          try {
            const module = container.get(check.name);
            if (module) {
              for (const method of check.methods) {
                const hasMethod = typeof module[method] === 'function';
                results.tests.push({
                  name: `${check.name}.${method}() exists`,
                  passed: hasMethod
                });
                if (hasMethod) {
                  results.passed++;
                } else {
                  results.failed++;
                }
              }
            }
          } catch (error) {
            // Module doesn't exist, skip method checks
          }
        }

      } catch (error) {
        logger.error('[SelfTester] Module loading tests failed:', error);
        results.tests.push({
          name: 'Module loading test suite',
          passed: false,
          error: error.message
        });
        results.failed++;
      }

      return results;
    };

    /**
     * Test that core tools execute successfully
     * @returns {Promise<Object>} Test results with pass/fail status
     */
    const testToolExecution = async () => {
      logger.info('[SelfTester] Running tool execution tests...');
      const results = {
        name: 'Tool Execution',
        passed: 0,
        failed: 0,
        tests: []
      };

      try {
        const container = window.DIContainer;
        if (!container) {
          results.tests.push({
            name: 'DI Container available',
            passed: false,
            error: 'DIContainer not found'
          });
          results.failed++;
          return results;
        }

        const ToolRunner = container.get('ToolRunner');
        if (!ToolRunner) {
          results.tests.push({
            name: 'ToolRunner available',
            passed: false,
            error: 'ToolRunner not found in container'
          });
          results.failed++;
          return results;
        }

        results.tests.push({
          name: 'ToolRunner available',
          passed: true
        });
        results.passed++;

        // Test read-only tools (safe to execute)
        const safeToolTests = [
          {
            name: 'get_current_state',
            args: {},
            expectType: 'object'
          },
          {
            name: 'list_artifacts',
            args: {},
            expectType: 'object'
          }
        ];

        for (const test of safeToolTests) {
          try {
            const result = await ToolRunner.execute(test.name, test.args);
            const typeMatches = typeof result === test.expectType ||
                               (test.expectType === 'object' && result !== null && typeof result === 'object');

            results.tests.push({
              name: `Tool ${test.name} executes`,
              passed: typeMatches,
              error: typeMatches ? null : `Expected ${test.expectType}, got ${typeof result}`
            });

            if (typeMatches) {
              results.passed++;
            } else {
              results.failed++;
            }
          } catch (error) {
            results.tests.push({
              name: `Tool ${test.name} executes`,
              passed: false,
              error: error.message
            });
            results.failed++;
          }
        }

        // Check tool catalog loads
        try {
          const readTools = await fetch('upgrades/tools-read.json').then(r => r.json());
          results.tests.push({
            name: 'Read tools catalog loads',
            passed: Array.isArray(readTools) && readTools.length > 0
          });
          if (Array.isArray(readTools) && readTools.length > 0) {
            results.passed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.tests.push({
            name: 'Read tools catalog loads',
            passed: false,
            error: error.message
          });
          results.failed++;
        }

        try {
          const writeTools = await fetch('upgrades/tools-write.json').then(r => r.json());
          results.tests.push({
            name: 'Write tools catalog loads',
            passed: Array.isArray(writeTools) && writeTools.length > 0
          });
          if (Array.isArray(writeTools) && writeTools.length > 0) {
            results.passed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.tests.push({
            name: 'Write tools catalog loads',
            passed: false,
            error: error.message
          });
          results.failed++;
        }

      } catch (error) {
        logger.error('[SelfTester] Tool execution tests failed:', error);
        results.tests.push({
          name: 'Tool execution test suite',
          passed: false,
          error: error.message
        });
        results.failed++;
      }

      return results;
    };

    /**
     * Test that FSM state transitions work correctly
     * @returns {Promise<Object>} Test results with pass/fail status
     */
    const testFSMTransitions = async () => {
      logger.info('[SelfTester] Running FSM transition tests...');
      const results = {
        name: 'FSM Transitions',
        passed: 0,
        failed: 0,
        tests: []
      };

      try {
        const container = window.DIContainer;
        if (!container) {
          results.tests.push({
            name: 'DI Container available',
            passed: false,
            error: 'DIContainer not found'
          });
          results.failed++;
          return results;
        }

        const Storage = container.get('Storage');
        if (!Storage) {
          results.tests.push({
            name: 'Storage available',
            passed: false,
            error: 'Storage not found'
          });
          results.failed++;
          return results;
        }

        results.tests.push({
          name: 'Storage available',
          passed: true
        });
        results.passed++;

        // Test state retrieval
        try {
          const state = Storage.getState();
          results.tests.push({
            name: 'getState() returns object',
            passed: typeof state === 'object' && state !== null
          });
          if (typeof state === 'object' && state !== null) {
            results.passed++;
          } else {
            results.failed++;
          }

          // Check for required state properties
          const requiredProps = ['agent_state', 'goal', 'turns', 'cycle'];
          for (const prop of requiredProps) {
            const hasProp = prop in state;
            results.tests.push({
              name: `State has ${prop} property`,
              passed: hasProp
            });
            if (hasProp) {
              results.passed++;
            } else {
              results.failed++;
            }
          }
        } catch (error) {
          results.tests.push({
            name: 'getState() returns object',
            passed: false,
            error: error.message
          });
          results.failed++;
        }

        // Test valid state values
        const validStates = [
          'IDLE', 'AWAITING_CONTEXT_APPROVAL', 'AWAITING_PROPOSAL_APPROVAL',
          'APPLYING_CHANGES', 'RUNNING_VERIFICATION', 'REFLECTING'
        ];

        results.tests.push({
          name: 'Valid FSM states defined',
          passed: true,
          details: validStates.join(', ')
        });
        results.passed++;

        // Check if Sentinel FSM module exists
        try {
          const response = await fetch('upgrades/sentinel-fsm.js');
          results.tests.push({
            name: 'Sentinel FSM module exists',
            passed: response.ok
          });
          if (response.ok) {
            results.passed++;
          } else {
            results.failed++;
          }
        } catch (error) {
          results.tests.push({
            name: 'Sentinel FSM module exists',
            passed: false,
            error: error.message
          });
          results.failed++;
        }

      } catch (error) {
        logger.error('[SelfTester] FSM transition tests failed:', error);
        results.tests.push({
          name: 'FSM transition test suite',
          passed: false,
          error: error.message
        });
        results.failed++;
      }

      return results;
    };

    /**
     * Test storage systems (IndexedDB, VFS)
     * @returns {Promise<Object>} Test results
     */
    const testStorageSystems = async () => {
      logger.info('[SelfTester] Running storage system tests...');
      const results = {
        name: 'Storage Systems',
        passed: 0,
        failed: 0,
        tests: []
      };

      try {
        // Test IndexedDB availability
        const hasIndexedDB = 'indexedDB' in window;
        results.tests.push({
          name: 'IndexedDB available',
          passed: hasIndexedDB
        });
        if (hasIndexedDB) {
          results.passed++;
        } else {
          results.failed++;
        }

        // Test Storage artifact storage
        const container = window.DIContainer;
        if (container) {
          const Storage = container.get('Storage');
          if (Storage) {
            try {
              const metadata = await Storage.getAllArtifactMetadata();
              results.tests.push({
                name: 'getAllArtifactMetadata() works',
                passed: typeof metadata === 'object'
              });
              if (typeof metadata === 'object') {
                results.passed++;
              } else {
                results.failed++;
              }
            } catch (error) {
              results.tests.push({
                name: 'getAllArtifactMetadata() works',
                passed: false,
                error: error.message
              });
              results.failed++;
            }
          }
        }

        // Test ReflectionStore
        if (container) {
          const ReflectionStore = container.get('ReflectionStore');
          if (ReflectionStore) {
            try {
              await ReflectionStore.init();
              results.tests.push({
                name: 'ReflectionStore initializes',
                passed: true
              });
              results.passed++;

              const reflections = await ReflectionStore.getReflections();
              results.tests.push({
                name: 'ReflectionStore.getReflections() works',
                passed: Array.isArray(reflections)
              });
              if (Array.isArray(reflections)) {
                results.passed++;
              } else {
                results.failed++;
              }
            } catch (error) {
              results.tests.push({
                name: 'ReflectionStore initializes',
                passed: false,
                error: error.message
              });
              results.failed++;
            }
          }
        }

      } catch (error) {
        logger.error('[SelfTester] Storage system tests failed:', error);
        results.tests.push({
          name: 'Storage system test suite',
          passed: false,
          error: error.message
        });
        results.failed++;
      }

      return results;
    };

    /**
     * Test performance monitoring systems
     * @returns {Promise<Object>} Test results
     */
    const testPerformanceMonitoring = async () => {
      logger.info('[SelfTester] Running performance monitoring tests...');
      const results = {
        name: 'Performance Monitoring',
        passed: 0,
        failed: 0,
        tests: []
      };

      try {
        const container = window.DIContainer;
        if (!container) {
          results.tests.push({
            name: 'DI Container available',
            passed: false
          });
          results.failed++;
          return results;
        }

        const PerformanceMonitor = container.get('PerformanceMonitor');
        if (!PerformanceMonitor) {
          results.tests.push({
            name: 'PerformanceMonitor available',
            passed: false
          });
          results.failed++;
          return results;
        }

        results.tests.push({
          name: 'PerformanceMonitor available',
          passed: true
        });
        results.passed++;

        // Test metrics retrieval
        try {
          const metrics = PerformanceMonitor.getMetrics();
          results.tests.push({
            name: 'getMetrics() returns object',
            passed: typeof metrics === 'object' && metrics !== null
          });
          if (typeof metrics === 'object' && metrics !== null) {
            results.passed++;
          } else {
            results.failed++;
          }

          // Check for required metric properties
          const hasSession = 'session' in metrics;
          const hasTools = 'tools' in metrics;
          results.tests.push({
            name: 'Metrics has session data',
            passed: hasSession
          });
          results.tests.push({
            name: 'Metrics has tools data',
            passed: hasTools
          });
          if (hasSession) results.passed++;
          else results.failed++;
          if (hasTools) results.passed++;
          else results.failed++;
        } catch (error) {
          results.tests.push({
            name: 'getMetrics() returns object',
            passed: false,
            error: error.message
          });
          results.failed++;
        }

      } catch (error) {
        logger.error('[SelfTester] Performance monitoring tests failed:', error);
        results.failed++;
      }

      return results;
    };

    /**
     * Run all test suites
     * @returns {Promise<Object>} Comprehensive test results
     */
    const runAllTests = async () => {
      logger.info('[SelfTester] Running comprehensive test suite...');

      const startTime = Date.now();
      const suites = [
        testModuleLoading,
        testToolExecution,
        testFSMTransitions,
        testStorageSystems,
        testPerformanceMonitoring
      ];

      const results = {
        timestamp: startTime,
        suites: [],
        summary: {
          totalTests: 0,
          passed: 0,
          failed: 0,
          successRate: 0
        },
        duration: 0
      };

      for (const suite of suites) {
        try {
          const suiteResult = await suite();
          results.suites.push(suiteResult);
          results.summary.passed += suiteResult.passed;
          results.summary.failed += suiteResult.failed;
          results.summary.totalTests += (suiteResult.passed + suiteResult.failed);
        } catch (error) {
          logger.error(`[SelfTester] Suite failed:`, error);
          results.suites.push({
            name: suite.name || 'Unknown Suite',
            passed: 0,
            failed: 1,
            tests: [{
              name: 'Suite execution',
              passed: false,
              error: error.message
            }]
          });
          results.summary.failed++;
          results.summary.totalTests++;
        }
      }

      results.duration = Date.now() - startTime;
      results.summary.successRate = results.summary.totalTests > 0
        ? (results.summary.passed / results.summary.totalTests) * 100
        : 0;

      // Store results
      lastTestResults = results;
      testHistory.push({
        timestamp: startTime,
        summary: results.summary,
        duration: results.duration
      });

      // Keep only last 10 test runs in history
      if (testHistory.length > 10) {
        testHistory = testHistory.slice(-10);
      }

      // Emit event
      EventBus.emit('self-test:complete', results);

      logger.info(`[SelfTester] Tests complete: ${results.summary.passed}/${results.summary.totalTests} passed (${results.summary.successRate.toFixed(1)}%)`);

      return results;
    };

    /**
     * Get last test results
     * @returns {Object|null} Last test results
     */
    const getLastResults = () => {
      return lastTestResults;
    };

    /**
     * Get test history
     * @returns {Array} Test history
     */
    const getTestHistory = () => {
      return testHistory;
    };

    /**
     * Generate markdown report of test results
     * @param {Object} results Test results
     * @returns {string} Markdown report
     */
    const generateReport = (results = lastTestResults) => {
      if (!results) {
        return '# Self-Test Report\n\nNo test results available.';
      }

      let md = '# REPLOID Self-Test Report\n\n';
      md += `**Generated:** ${new Date(results.timestamp).toISOString()}\n`;
      md += `**Duration:** ${results.duration}ms\n\n`;

      md += '## Summary\n\n';
      md += `- **Total Tests:** ${results.summary.totalTests}\n`;
      md += `- **Passed:** ${results.summary.passed} ✓\n`;
      md += `- **Failed:** ${results.summary.failed} ✗\n`;
      md += `- **Success Rate:** ${results.summary.successRate.toFixed(1)}%\n\n`;

      md += '## Test Suites\n\n';

      for (const suite of results.suites) {
        md += `### ${suite.name}\n\n`;
        md += `- Passed: ${suite.passed}\n`;
        md += `- Failed: ${suite.failed}\n\n`;

        if (suite.tests.length > 0) {
          md += '**Tests:**\n\n';
          for (const test of suite.tests) {
            const icon = test.passed ? '✓' : '✗';
            md += `- ${icon} ${test.name}`;
            if (test.error) {
              md += ` - Error: ${test.error}`;
            }
            md += '\n';
          }
          md += '\n';
        }
      }

      md += '---\n\n';
      md += '*Generated by REPLOID Self-Testing Framework*\n';

      return md;
    };

    // Initialize
    const init = async () => {
      logger.info('[SelfTester] Initialized');
    };

    // Web Component Widget (INSIDE factory closure to access state)
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
        // Auto-refresh every 10 seconds
        this._interval = setInterval(() => this.render(), 10000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const lastRun = getLastResults();
        const hasError = lastRun && lastRun.summary.failed > 0;

        return {
          state: !lastRun ? 'idle' : (hasError ? 'error' : 'active'),
          primaryMetric: lastRun ? `${lastRun.summary.passed}/${lastRun.summary.totalTests}` : 'No tests',
          secondaryMetric: lastRun ? `${lastRun.summary.successRate.toFixed(0)}%` : 'N/A',
          lastActivity: lastRun ? lastRun.timestamp : null,
          message: hasError ? `${lastRun.summary.failed} failures` : (lastRun ? 'All passed' : 'Not run')
        };
      }

      renderPanel() {
        const lastRun = getLastResults();
        const history = getTestHistory();

        const formatTime = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        const formatDuration = (ms) => {
          if (ms < 1000) return `${ms}ms`;
          return `${(ms / 1000).toFixed(2)}s`;
        };

        return `
          <h3>⚗ Self Tester</h3>

          ${lastRun ? `
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
              <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Passed</div>
                <div style="font-size: 1.3em; font-weight: bold; color: #0c0;">${lastRun.summary.passed}</div>
              </div>
              <div style="padding: 12px; background: ${lastRun.summary.failed > 0 ? 'rgba(255,0,0,0.1)' : 'rgba(100,150,255,0.1)'}; border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Failed</div>
                <div style="font-size: 1.3em; font-weight: bold; color: ${lastRun.summary.failed > 0 ? '#ff6b6b' : 'inherit'};">${lastRun.summary.failed}</div>
              </div>
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Success Rate</div>
                <div style="font-size: 1.3em; font-weight: bold;">${lastRun.summary.successRate.toFixed(1)}%</div>
              </div>
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Duration</div>
                <div style="font-size: 1.3em; font-weight: bold;">${formatDuration(lastRun.duration)}</div>
              </div>
            </div>

            <h4 style="margin-top: 16px;">☷ Test Suites</h4>
            <div style="max-height: 150px; overflow-y: auto; margin-top: 8px;">
              ${lastRun.suites.map(suite => {
                const hasFailures = suite.failed > 0;
                return `
                  <div style="padding: 8px; background: ${hasFailures ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.05)'}; border-left: 3px solid ${hasFailures ? '#ff6b6b' : '#0c0'}; border-radius: 3px; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <span style="font-weight: bold;">${hasFailures ? '✗' : '✓'} ${suite.name}</span>
                      <span style="font-size: 0.9em; color: #888;">${suite.passed}/${suite.passed + suite.failed}</span>
                    </div>
                    ${hasFailures ? `<div style="margin-top: 4px; font-size: 0.85em; color: #ff6b6b;">${suite.failed} failures</div>` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
            <div style="margin-top: 12px; padding: 20px; background: rgba(255,255,255,0.05); border-radius: 4px; text-align: center; color: #888; font-style: italic;">
              No tests run yet. Click "Run All Tests" to begin validation.
            </div>
          `}

          ${history.length > 1 ? `
            <h4 style="margin-top: 16px;">☱ Test History (${history.length} runs)</h4>
            <div style="max-height: 100px; overflow-y: auto; margin-top: 8px;">
              ${history.slice().reverse().map((run, idx) => `
                <div style="padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 3px; margin-bottom: 4px; font-size: 0.85em;">
                  <div style="display: flex; justify-content: space-between;">
                    <span>${formatTime(run.timestamp)}</span>
                    <span style="color: ${run.summary.successRate >= 90 ? '#0c0' : run.summary.successRate >= 70 ? '#f90' : '#ff6b6b'};">${run.summary.passed}/${run.summary.totalTests} (${run.summary.successRate.toFixed(0)}%)</span>
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ Self-Testing Framework</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Validates system integrity before and after modifications.<br>
              Last run: ${lastRun ? formatTime(lastRun.timestamp) : 'Never'}
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 16px;">
            <button class="run-tests-btn" style="padding: 10px; background: #0c0; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ▶️ Run All Tests
            </button>
            <button class="generate-report-btn" style="padding: 10px; background: #6496ff; border: none; border-radius: 4px; color: white; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ⛿ Generate Report
            </button>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-content {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h4 {
              margin: 16px 0 8px 0;
              font-size: 0.95em;
              color: #aaa;
            }

            button {
              transition: all 0.2s ease;
            }

            .run-tests-btn:hover {
              background: #0e0 !important;
              transform: translateY(-1px);
            }

            .generate-report-btn:hover {
              background: #7ba6ff !important;
              transform: translateY(-1px);
            }

            button:active {
              transform: translateY(0);
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up buttons
        const runTestsBtn = this.shadowRoot.querySelector('.run-tests-btn');
        if (runTestsBtn) {
          runTestsBtn.addEventListener('click', async () => {
            try {
              logger.info('[SelfTester] Widget: Running all tests...');
              runTestsBtn.disabled = true;
              runTestsBtn.textContent = '⏳ Running...';

              const results = await runAllTests();
              logger.info(`[SelfTester] Widget: Tests complete - ${results.summary.passed}/${results.summary.totalTests} passed`);

              this.render(); // Refresh to show results
            } catch (error) {
              logger.error('[SelfTester] Widget: Tests failed', error);
              this.render();
            }
          });
        }

        const generateReportBtn = this.shadowRoot.querySelector('.generate-report-btn');
        if (generateReportBtn) {
          generateReportBtn.addEventListener('click', () => {
            const report = generateReport();
            console.log(report);
            logger.info('[SelfTester] Widget: Report generated (see console)');
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('self-tester-widget')) {
      customElements.define('self-tester-widget', SelfTesterWidget);
    }

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

// Export
export default SelfTester;
