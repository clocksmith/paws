// @blueprint 0x000082 - ContextManager MCP Server for REPLOID
/**
 * ContextManager MCP Server
 *
 * Exposes context pruning and summarization via MCP
 * Enables agents to manage LLM context window and optimize token usage
 *
 * Available Tools:
 * - prune_context - Prune context to fit within limits
 * - summarize_context - Summarize context to reduce tokens
 * - get_context_stats - Get context statistics
 * - auto_manage_context - Automatically manage context
 * - estimate_tokens - Estimate token count for text
 * - get_model_limits - Get token limits for different models
 * - clear_stats - Clear context statistics
 * - get_state - Get context manager state
 */

const ContextManagerMCPServer = {
  metadata: {
    id: 'ContextManagerMCPServer',
    version: '1.0.0',
    description: 'Context management and optimization',
    dependencies: ['ReploidMCPServerBase', 'ContextManager', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ContextManager, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ContextManagerMCPServer] Initializing...');

    const server = createMCPServer({
      name: 'context-manager',
      version: '1.0.0',
      description: 'REPLOID Context Manager - optimize LLM context window usage',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'prune_context',
          schema: {
            description: 'Prune context to fit within token limits',
            properties: {
              context: { type: 'string', description: 'Context to prune' },
              max_tokens: { type: 'number', description: 'Maximum tokens' }
            },
            required: ['context', 'max_tokens']
          },
          handler: async (args) => {
            const { context, max_tokens } = args;
            const pruned = await ContextManager.pruneContext(context, max_tokens);
            return { success: true, pruned };
          }
        },
        {
          name: 'summarize_context',
          schema: {
            description: 'Summarize context to reduce tokens',
            properties: {
              context: { type: 'string', description: 'Context to summarize' },
              target_tokens: { type: 'number', description: 'Target token count' }
            },
            required: ['context']
          },
          handler: async (args) => {
            const { context, target_tokens } = args;
            const summary = await ContextManager.summarizeContext(context, target_tokens);
            return { success: true, summary };
          }
        },
        {
          name: 'get_context_stats',
          schema: {
            description: 'Get context statistics',
            properties: {}
          },
          handler: async () => {
            const stats = ContextManager.getContextStats();
            return { success: true, stats };
          }
        },
        {
          name: 'auto_manage_context',
          schema: {
            description: 'Automatically manage context (prune/summarize as needed)',
            properties: {
              context: { type: 'string', description: 'Context to manage' },
              model: { type: 'string', description: 'Model name for limits' }
            },
            required: ['context', 'model']
          },
          handler: async (args) => {
            const { context, model } = args;
            const managed = await ContextManager.autoManageContext(context, model);
            return { success: true, managed };
          }
        },
        {
          name: 'estimate_tokens',
          schema: {
            description: 'Estimate token count for text',
            properties: {
              text: { type: 'string', description: 'Text to estimate' }
            },
            required: ['text']
          },
          handler: async (args) => {
            const { text } = args;
            const tokens = ContextManager.estimateTokens(text);
            return { success: true, tokens };
          }
        },
        {
          name: 'get_model_limits',
          schema: {
            description: 'Get token limits for different models',
            properties: {}
          },
          handler: async () => {
            const limits = ContextManager.MODEL_LIMITS;
            return { success: true, limits };
          }
        },
        {
          name: 'clear_stats',
          schema: {
            description: 'Clear context statistics',
            properties: {}
          },
          handler: async () => {
            ContextManager.clearStats();
            return { success: true, message: 'Context stats cleared' };
          }
        },
        {
          name: 'get_state',
          schema: {
            description: 'Get context manager state',
            properties: {}
          },
          handler: async () => {
            const state = ContextManager.getState();
            return { success: true, state };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[ContextManagerMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default ContextManagerMCPServer;
