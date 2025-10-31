// @blueprint 0x00007C - ReflectionStore MCP Server for REPLOID
/**
 * ReflectionStore MCP Server
 *
 * Exposes reflection and learning storage via MCP
 * Enables agents to store insights, analyze patterns, and learn from experience
 *
 * Available Tools:
 * - add_reflection - Store a new reflection/insight
 * - get_reflections - Retrieve reflections (with optional filtering)
 * - get_reflection - Get a specific reflection by ID
 * - get_success_patterns - Analyze successful patterns
 * - get_failure_patterns - Analyze failure patterns
 * - get_learning_summary - Get summary of lessons learned
 * - generate_report - Generate reflection report
 * - export_reflections - Export reflections to JSON
 * - import_reflections - Import reflections from JSON
 */

const ReflectionStoreMCPServer = {
  metadata: {
    id: 'ReflectionStoreMCPServer',
    version: '1.0.0',
    description: 'Reflection and learning storage operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'ReflectionStore', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ReflectionStore, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ReflectionStoreMCPServer] Initializing ReflectionStore MCP Server...');

    const server = createMCPServer({
      name: 'reflection-store',
      version: '1.0.0',
      description: 'REPLOID Reflection Store - learn from experience and store insights',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'add_reflection',
          schema: {
            description: 'Store a new reflection or insight',
            properties: {
              content: {
                type: 'string',
                description: 'Reflection content'
              },
              type: {
                type: 'string',
                description: 'Reflection type (success, failure, insight, question)',
                enum: ['success', 'failure', 'insight', 'question']
              },
              context: {
                type: 'object',
                description: 'Optional context data'
              },
              tags: {
                type: 'array',
                description: 'Optional tags for categorization'
              }
            },
            required: ['content', 'type']
          },
          handler: async (args) => {
            const { content, type, context, tags } = args;

            const reflection = await ReflectionStore.addReflection({
              content,
              type,
              context,
              tags
            });

            return {
              success: true,
              reflection
            };
          }
        },

        {
          name: 'get_reflections',
          schema: {
            description: 'Retrieve reflections with optional filtering',
            properties: {
              type: {
                type: 'string',
                description: 'Filter by type',
                enum: ['success', 'failure', 'insight', 'question']
              },
              limit: {
                type: 'number',
                description: 'Maximum number of reflections to return'
              },
              tags: {
                type: 'array',
                description: 'Filter by tags'
              }
            }
          },
          handler: async (args) => {
            const { type, limit, tags } = args;

            const reflections = await ReflectionStore.getReflections({
              type,
              limit,
              tags
            });

            return {
              success: true,
              reflections,
              count: reflections.length
            };
          }
        },

        {
          name: 'get_reflection',
          schema: {
            description: 'Get a specific reflection by ID',
            properties: {
              id: {
                type: 'string',
                description: 'Reflection ID'
              }
            },
            required: ['id']
          },
          handler: async (args) => {
            const { id } = args;

            const reflection = await ReflectionStore.getReflection(id);

            if (!reflection) {
              return {
                success: false,
                error: `Reflection not found: ${id}`
              };
            }

            return {
              success: true,
              reflection
            };
          }
        },

        {
          name: 'get_success_patterns',
          schema: {
            description: 'Analyze successful patterns and strategies',
            properties: {}
          },
          handler: async () => {
            const patterns = await ReflectionStore.getSuccessPatterns();

            return {
              success: true,
              patterns
            };
          }
        },

        {
          name: 'get_failure_patterns',
          schema: {
            description: 'Analyze failure patterns to avoid repeating mistakes',
            properties: {}
          },
          handler: async () => {
            const patterns = await ReflectionStore.getFailurePatterns();

            return {
              success: true,
              patterns
            };
          }
        },

        {
          name: 'get_learning_summary',
          schema: {
            description: 'Get summary of lessons learned',
            properties: {}
          },
          handler: async () => {
            const summary = await ReflectionStore.getLearningSummary();

            return {
              success: true,
              summary
            };
          }
        },

        {
          name: 'generate_report',
          schema: {
            description: 'Generate a comprehensive reflection report',
            properties: {}
          },
          handler: async () => {
            const report = await ReflectionStore.generateReport();

            return {
              success: true,
              report,
              format: 'markdown'
            };
          }
        },

        {
          name: 'export_reflections',
          schema: {
            description: 'Export reflections to JSON',
            properties: {}
          },
          handler: async () => {
            const exported = await ReflectionStore.exportReflections();

            return {
              success: true,
              data: exported
            };
          }
        },

        {
          name: 'import_reflections',
          schema: {
            description: 'Import reflections from JSON',
            properties: {
              data: {
                type: 'object',
                description: 'Reflection data to import'
              }
            },
            required: ['data']
          },
          handler: async (args) => {
            const { data } = args;

            const result = await ReflectionStore.importReflections(data);

            return {
              success: true,
              result
            };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[ReflectionStoreMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default ReflectionStoreMCPServer;
