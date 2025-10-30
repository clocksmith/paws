// @blueprint 0x00007A - VerificationManager MCP Server for REPLOID
/**
 * VerificationManager MCP Server
 *
 * Exposes REPLOID code verification and validation capabilities via MCP
 * Enables agents to verify code changes before applying them (RSI safety)
 *
 * Available Tools:
 * - run_full_verification - Run complete verification suite (tests, linting, types, safety)
 * - verify_tests - Run test suite and verify results
 * - verify_linting - Check code style and quality
 * - verify_types - Check TypeScript type correctness
 * - verify_safe_eval - Verify code safety (no dangerous patterns)
 * - get_verification_status - Check if verification system is initialized
 */

const VerificationManagerMCPServer = {
  metadata: {
    id: 'VerificationManagerMCPServer',
    version: '1.0.0',
    description: 'Code verification and validation operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'VerificationManager', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, VerificationManager, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[VerificationManagerMCPServer] Initializing VerificationManager MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'verification-manager',
      version: '1.0.0',
      description: 'REPLOID Code Verification - validate code changes before applying',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // FULL VERIFICATION
        // =================================================================
        {
          name: 'run_full_verification',
          schema: {
            description: 'Run complete verification suite (tests, linting, types, safety checks)',
            properties: {
              code: {
                type: 'string',
                description: 'Code to verify'
              },
              file_path: {
                type: 'string',
                description: 'Optional: file path for context'
              }
            },
            required: ['code']
          },
          handler: async (args) => {
            const { code, file_path } = args;

            logger.info('[VerificationManagerMCPServer] Running full verification...');

            const results = await VerificationManager.runFullVerification(code, file_path);

            return {
              success: true,
              results,
              passed: results.passed || false,
              errors: results.errors || [],
              warnings: results.warnings || []
            };
          }
        },

        // =================================================================
        // INDIVIDUAL VERIFICATION STEPS
        // =================================================================
        {
          name: 'verify_tests',
          schema: {
            description: 'Run test suite and verify all tests pass',
            properties: {
              code: {
                type: 'string',
                description: 'Code to test'
              }
            },
            required: ['code']
          },
          handler: async (args) => {
            const { code } = args;

            const results = await VerificationManager.verifyTests(code);

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'verify_linting',
          schema: {
            description: 'Check code style and quality (linting)',
            properties: {
              code: {
                type: 'string',
                description: 'Code to lint'
              },
              file_path: {
                type: 'string',
                description: 'Optional: file path for context'
              }
            },
            required: ['code']
          },
          handler: async (args) => {
            const { code, file_path } = args;

            const results = await VerificationManager.verifyLinting(code, file_path);

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'verify_types',
          schema: {
            description: 'Check TypeScript type correctness',
            properties: {
              code: {
                type: 'string',
                description: 'TypeScript code to verify'
              },
              file_path: {
                type: 'string',
                description: 'Optional: file path for context'
              }
            },
            required: ['code']
          },
          handler: async (args) => {
            const { code, file_path } = args;

            const results = await VerificationManager.verifyTypes(code, file_path);

            return {
              success: true,
              results
            };
          }
        },

        {
          name: 'verify_safe_eval',
          schema: {
            description: 'Verify code safety (detect dangerous patterns like eval, exec, etc.)',
            properties: {
              code: {
                type: 'string',
                description: 'Code to check for safety'
              }
            },
            required: ['code']
          },
          handler: async (args) => {
            const { code } = args;

            const results = await VerificationManager.verifySafeEval(code);

            return {
              success: true,
              results,
              safe: results.safe || false,
              issues: results.issues || []
            };
          }
        },

        // =================================================================
        // STATUS
        // =================================================================
        {
          name: 'get_verification_status',
          schema: {
            description: 'Check if verification system is initialized and ready',
            properties: {}
          },
          handler: async () => {
            const isReady = VerificationManager.isInitialized();

            return {
              success: true,
              initialized: isReady,
              status: isReady ? 'ready' : 'not_initialized'
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[VerificationManagerMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default VerificationManagerMCPServer;
