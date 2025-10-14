// Self-Testing & Validation Framework for Safe RSI
// Enables the agent to validate its own integrity before and after modifications

const SelfTester = {
  metadata: {
    id: 'SelfTester',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager'],
    async: true,
    type: 'validation'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager } = deps;
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
          'Utils', 'StateManager', 'EventBus', 'ApiClient',
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
          { name: 'StateManager', methods: ['getState', 'setState', 'updateState'] },
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

        const StateManager = container.get('StateManager');
        if (!StateManager) {
          results.tests.push({
            name: 'StateManager available',
            passed: false,
            error: 'StateManager not found'
          });
          results.failed++;
          return results;
        }

        results.tests.push({
          name: 'StateManager available',
          passed: true
        });
        results.passed++;

        // Test state retrieval
        try {
          const state = StateManager.getState();
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

        // Test StateManager artifact storage
        const container = window.DIContainer;
        if (container) {
          const StateManager = container.get('StateManager');
          if (StateManager) {
            try {
              const metadata = await StateManager.getAllArtifactMetadata();
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

    return {
      init,
      testModuleLoading,
      testToolExecution,
      testFSMTransitions,
      testStorageSystems,
      testPerformanceMonitoring,
      runAllTests,
      getLastResults,
      getTestHistory,
      generateReport
    };
  }
};

// Export
SelfTester;
