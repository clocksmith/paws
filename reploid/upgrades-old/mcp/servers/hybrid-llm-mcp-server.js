// @blueprint 0x000088 - Hybrid LLM MCP Server for REPLOID
/**
 * Hybrid LLM MCP Server
 *
 * Exposes REPLOID Hybrid LLM Provider operations via MCP
 * Enables agents to route requests between local and cloud LLMs
 *
 * Available Tools:
 * - route_request - Route a completion request to appropriate provider
 * - get_routing_strategy - Get current routing strategy
 * - set_strategy - Set routing strategy (local/cloud/auto)
 * - get_provider_status - Get status of all providers
 * - force_provider - Force use of specific provider
 */

const HybridLLMMCPServer = {
  metadata: {
    id: 'HybridLLMMCPServer',
    version: '1.0.0',
    description: 'Hybrid LLM routing and provider management via MCP',
    dependencies: ['ReploidMCPServerBase', 'HybridLLMProvider', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, HybridLLMProvider, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[HybridLLMMCPServer] Initializing Hybrid LLM MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'hybrid-llm',
      version: '1.0.0',
      description: 'REPLOID Hybrid LLM Provider - route between local and cloud LLMs',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // ROUTING OPERATIONS
        // =================================================================
        {
          name: 'route_request',
          schema: {
            description: 'Route a completion request to the appropriate provider (local or cloud)',
            properties: {
              messages: {
                type: 'array',
                description: 'Array of message objects with role and content',
                items: {
                  type: 'object',
                  properties: {
                    role: { type: 'string', enum: ['system', 'user', 'assistant'] },
                    content: { type: 'string' }
                  }
                }
              },
              options: {
                type: 'object',
                description: 'Generation options',
                properties: {
                  temperature: { type: 'number' },
                  maxOutputTokens: { type: 'number' },
                  model: { type: 'string' }
                }
              }
            },
            required: ['messages']
          },
          handler: async (args) => {
            const { messages, options = {} } = args;

            try {
              const result = await HybridLLMProvider.complete(messages, options);

              return {
                success: true,
                result: {
                  text: result.text,
                  provider: result.provider,
                  model: result.model,
                  usage: result.usage,
                  elapsed: result.elapsed,
                  tokens_per_second: result.tokensPerSecond
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                stack: error.stack
              };
            }
          }
        },

        {
          name: 'get_routing_strategy',
          schema: {
            description: 'Get current routing strategy and auto-switch configuration',
            properties: {}
          },
          handler: async () => {
            try {
              const mode = HybridLLMProvider.getMode();
              const config = HybridLLMProvider.getAutoSwitchConfig();

              return {
                success: true,
                current_mode: mode,
                auto_switch_config: config
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'set_strategy',
          schema: {
            description: 'Set routing strategy (local or cloud)',
            properties: {
              mode: {
                type: 'string',
                enum: ['local', 'cloud'],
                description: 'Routing mode to set'
              }
            },
            required: ['mode']
          },
          handler: async (args) => {
            const { mode } = args;

            try {
              const success = HybridLLMProvider.setMode(mode);

              if (!success) {
                return {
                  success: false,
                  error: `Failed to switch to ${mode} mode (provider may not be ready)`
                };
              }

              return {
                success: true,
                mode: mode,
                message: `Successfully switched to ${mode} mode`
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_provider_status',
          schema: {
            description: 'Get status of all providers (local and cloud availability)',
            properties: {}
          },
          handler: async () => {
            try {
              const status = HybridLLMProvider.getStatus();

              return {
                success: true,
                status: {
                  current_mode: status.mode,
                  local_available: status.localAvailable,
                  cloud_available: status.cloudAvailable,
                  local_model: status.localModel,
                  local_ready: status.localReady
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'force_provider',
          schema: {
            description: 'Force use of specific provider for next request',
            properties: {
              provider: {
                type: 'string',
                enum: ['local', 'cloud'],
                description: 'Provider to force'
              }
            },
            required: ['provider']
          },
          handler: async (args) => {
            const { provider } = args;

            try {
              const success = HybridLLMProvider.setMode(provider);

              if (!success) {
                return {
                  success: false,
                  error: `Failed to force ${provider} provider (may not be available)`
                };
              }

              return {
                success: true,
                provider: provider,
                message: `Forced ${provider} provider for next request`
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // STATISTICS & MONITORING
        // =================================================================
        {
          name: 'get_usage_stats',
          schema: {
            description: 'Get usage statistics for local and cloud providers',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = HybridLLMProvider.getUsageStats();

              return {
                success: true,
                stats: {
                  local: {
                    requests: stats.local.requests,
                    tokens: stats.local.tokens,
                    errors: stats.local.errors,
                    total_time: stats.local.totalTime,
                    avg_time: stats.local.requests > 0
                      ? Math.round(stats.local.totalTime / stats.local.requests)
                      : 0
                  },
                  cloud: {
                    requests: stats.cloud.requests,
                    tokens: stats.cloud.tokens,
                    errors: stats.cloud.errors,
                    total_time: stats.cloud.totalTime,
                    avg_time: stats.cloud.requests > 0
                      ? Math.round(stats.cloud.totalTime / stats.cloud.requests)
                      : 0
                  },
                  fallbacks: stats.fallbacks.slice(0, 10),
                  switch_history: stats.switchHistory.slice(0, 10)
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'check_availability',
          schema: {
            description: 'Check if local LLM is available and ready',
            properties: {}
          },
          handler: async () => {
            try {
              const isAvailable = HybridLLMProvider.isLocalAvailable();

              return {
                success: true,
                local_available: isAvailable,
                message: isAvailable
                  ? 'Local LLM is available and ready'
                  : 'Local LLM is not available'
              };
            } catch (error) {
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

    logger.info(`[HybridLLMMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default HybridLLMMCPServer;
