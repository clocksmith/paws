// @blueprint 0x000079 - SelfTester MCP Server for REPLOID
/**
 * SelfTester MCP Server
 *
 * Exposes REPLOID self-testing and validation capabilities via MCP
 * Enables agents to verify system integrity before and after RSI modifications
 *
 * Available Tools:
 * - run_all_tests - Execute complete test suite
 * - test_module_loading - Verify all modules load successfully
 * - test_tool_execution - Verify tool execution works correctly
 * - test_fsm_transitions - Verify state machine transitions
 * - test_storage_systems - Verify VFS and storage integrity
 * - test_performance_monitoring - Verify performance tracking
 * - get_last_results - Get results from last test run
 * - get_test_history - Get historical test results
 * - generate_report - Generate markdown test report
 */

const SelfTesterMCPServer = {
  metadata: {
    id: 'SelfTesterMCPServer',
    version: '1.0.0',
    description: 'Self-testing and validation operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'SelfTester', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, SelfTester, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[SelfTesterMCPServer] Initializing SelfTester MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'self-tester',
      version: '1.0.0',
      description: 'REPLOID Self-Testing - verify system integrity and validate modifications',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // TEST EXECUTION
        // =================================================================
        {
          name: 'run_all_tests',
          schema: {
            description: 'Run the complete test suite (all validation tests)',
            properties: {}
          },
          handler: async () => {
            logger.info('[SelfTesterMCPServer] Running complete test suite...');

            const results = await SelfTester.runAllTests();

            return {
              success: true,
              results,
              summary: {
                totalTests: results.totalTests || 0,
                passed: results.passedTests || 0,
                failed: results.failedTests || 0,
                duration: results.duration || 0
              }
            };
          }
        },

        {
          name: 'test_module_loading',
          schema: {
            description: 'Test that all required modules load successfully',
            properties: {}
          },
          handler: async () => {
            const results = await SelfTester.testModuleLoading();

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'test_tool_execution',
          schema: {
            description: 'Test that core tools execute successfully',
            properties: {}
          },
          handler: async () => {
            const results = await SelfTester.testToolExecution();

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'test_fsm_transitions',
          schema: {
            description: 'Test finite state machine transitions for workflow management',
            properties: {}
          },
          handler: async () => {
            const results = await SelfTester.testFSMTransitions();

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'test_storage_systems',
          schema: {
            description: 'Test VFS and IndexedDB storage integrity',
            properties: {}
          },
          handler: async () => {
            const results = await SelfTester.testStorageSystems();

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'test_performance_monitoring',
          schema: {
            description: 'Test performance tracking and metrics collection',
            properties: {}
          },
          handler: async () => {
            const results = await SelfTester.testPerformanceMonitoring();

            return {
              success: true,
              results
            };
          }
        },

        // =================================================================
        // TEST RESULTS
        // =================================================================
        {
          name: 'get_last_results',
          schema: {
            description: 'Get results from the most recent test run',
            properties: {}
          },
          handler: async () => {
            const results = SelfTester.getLastResults();

            if (!results) {
              return {
                success: false,
                error: 'No test results available. Run tests first.'
              };
            }

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'get_test_history',
          schema: {
            description: 'Get historical test results',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of historical results to return (default: 10)'
              }
            }
          },
          handler: async (args) => {
            const { limit = 10 } = args;

            const history = SelfTester.getTestHistory();

            // Limit the number of results
            const limitedHistory = history.slice(0, limit);

            return {
              success: true,
              history: limitedHistory,
              totalCount: history.length
            };
          }
        },

        // =================================================================
        // REPORTING
        // =================================================================
        {
          name: 'generate_report',
          schema: {
            description: 'Generate a comprehensive markdown test report',
            properties: {}
          },
          handler: async () => {
            const report = await SelfTester.generateReport();

            return {
              success: true,
              report,
              format: 'markdown'
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[SelfTesterMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default SelfTesterMCPServer;
