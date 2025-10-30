// @blueprint 0x000085 - ModelRegistry MCP Server for REPLOID
/**
 * ModelRegistry MCP Server
 *
 * Exposes REPLOID Model Registry operations via MCP
 * Enables agents to discover and query available LLM models across providers
 *
 * Available Tools:
 * - list_models - List all available models with optional filters
 * - get_model_info - Get detailed information about a specific model
 * - get_model_ids - Get just the model IDs
 * - discover_models - Force refresh model discovery
 * - clear_cache - Clear the model registry cache
 * - get_recommended_judge - Get recommended judge model
 */

const ModelRegistryMCPServer = {
  metadata: {
    id: 'ModelRegistryMCPServer',
    version: '1.0.0',
    description: 'Model discovery and registry operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'ModelRegistry', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ModelRegistry, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ModelRegistryMCPServer] Initializing Model Registry MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'model-registry',
      version: '1.0.0',
      description: 'REPLOID Model Registry - discover and query available LLM models',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // MODEL DISCOVERY
        // =================================================================
        {
          name: 'list_models',
          schema: {
            description: 'List all available models across all providers (gemini, openai, anthropic, ollama, webllm)',
            properties: {
              provider: {
                type: 'string',
                description: 'Filter by provider (e.g., "gemini", "openai", "anthropic", "ollama", "webllm")'
              },
              tier: {
                type: 'string',
                description: 'Filter by tier (e.g., "fast", "balanced", "advanced")'
              },
              force_refresh: {
                type: 'boolean',
                description: 'Force refresh cache (default: false)'
              }
            }
          },
          handler: async (args) => {
            const { provider, tier, force_refresh } = args;

            try {
              const models = await ModelRegistry.getAllModels({
                provider,
                tier,
                forceRefresh: force_refresh || false
              });

              return {
                success: true,
                models,
                count: models.length
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error listing models:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_model_info',
          schema: {
            description: 'Get detailed information about a specific model',
            properties: {
              model_id: {
                type: 'string',
                description: 'Model identifier (e.g., "gemini-2.5-flash", "gpt-5-mini", "claude-4-5-sonnet")'
              }
            },
            required: ['model_id']
          },
          handler: async (args) => {
            const { model_id } = args;

            try {
              const model = await ModelRegistry.getModel(model_id);

              if (!model) {
                return {
                  success: false,
                  error: `Model not found: ${model_id}`
                };
              }

              return {
                success: true,
                model
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error getting model info:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_model_ids',
          schema: {
            description: 'Get just the model IDs (lightweight list)',
            properties: {
              provider: {
                type: 'string',
                description: 'Filter by provider'
              },
              tier: {
                type: 'string',
                description: 'Filter by tier'
              }
            }
          },
          handler: async (args) => {
            const { provider, tier } = args;

            try {
              const modelIds = await ModelRegistry.getModelIds({ provider, tier });

              return {
                success: true,
                model_ids: modelIds,
                count: modelIds.length
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error getting model IDs:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // CACHE & REFRESH
        // =================================================================
        {
          name: 'discover_models',
          schema: {
            description: 'Force refresh model discovery (re-scan all providers)',
            properties: {
              force_refresh: {
                type: 'boolean',
                description: 'Force refresh even if cache is valid (default: true)'
              }
            }
          },
          handler: async (args) => {
            const { force_refresh = true } = args;

            try {
              const registry = await ModelRegistry.discoverModels(force_refresh);

              return {
                success: true,
                providers: registry.metadata.providers,
                timestamp: registry.metadata.timestamp,
                models_discovered: Object.keys(registry).reduce((sum, key) => {
                  return sum + (Array.isArray(registry[key]) ? registry[key].length : 0);
                }, 0)
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error discovering models:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'clear_cache',
          schema: {
            description: 'Clear the model registry cache',
            properties: {}
          },
          handler: async () => {
            try {
              ModelRegistry.clearCache();

              return {
                success: true,
                message: 'Model registry cache cleared'
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error clearing cache:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // RECOMMENDATIONS
        // =================================================================
        {
          name: 'get_recommended_judge',
          schema: {
            description: 'Get recommended judge model for Arena/consensus',
            properties: {}
          },
          handler: async () => {
            try {
              const judgeModel = await ModelRegistry.getRecommendedJudge();

              return {
                success: true,
                judge_model: judgeModel
              };
            } catch (error) {
              logger.error('[ModelRegistryMCPServer] Error getting recommended judge:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[ModelRegistryMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default ModelRegistryMCPServer;
