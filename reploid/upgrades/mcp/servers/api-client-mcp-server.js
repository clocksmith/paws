// @blueprint 0x000087 - API Client MCP Server for REPLOID
/**
 * API Client MCP Server
 *
 * Exposes REPLOID API Client operations via MCP
 * Enables agents to make API requests, track history, and manage request lifecycle
 *
 * Available Tools:
 * - make_request - Make an API request with retry logic
 * - get_request_history - Get API request history
 * - cancel_request - Cancel current API request
 * - retry_request - Retry a failed request
 * - get_stats - Get API client statistics
 */

const ApiClientMCPServer = {
  metadata: {
    id: 'ApiClientMCPServer',
    version: '1.0.0',
    description: 'API Client operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'ApiClient', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ApiClient, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ApiClientMCPServer] Initializing API Client MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'api-client',
      version: '1.0.0',
      description: 'REPLOID API Client - make requests, track history, and manage request lifecycle',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // API REQUEST OPERATIONS
        // =================================================================
        {
          name: 'make_request',
          schema: {
            description: 'Make an API request with automatic retry logic and abort handling',
            properties: {
              history: {
                type: 'array',
                description: 'Array of message objects with role and parts',
                items: {
                  type: 'object',
                  properties: {
                    role: { type: 'string', enum: ['user', 'model'] },
                    parts: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          text: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              },
              api_key: {
                type: 'string',
                description: 'API key for authentication (optional if using proxy)'
              },
              function_declarations: {
                type: 'array',
                description: 'Optional function declarations for function calling',
                items: { type: 'object' }
              },
              streaming: {
                type: 'boolean',
                description: 'Whether to use streaming response (default: false)'
              }
            },
            required: ['history']
          },
          handler: async (args) => {
            const { history, api_key, function_declarations, streaming } = args;

            try {
              let response;

              if (streaming) {
                response = await ApiClient.callApiWithStreaming(history, api_key, function_declarations);
                return {
                  success: true,
                  streaming: true,
                  message: 'Streaming response initiated (use appropriate streaming handler)'
                };
              } else {
                response = await ApiClient.callApiWithRetry(history, api_key, function_declarations);
              }

              return {
                success: true,
                response: {
                  type: response.type,
                  content: response.content,
                  metadata: {
                    has_raw_response: !!response.rawResp
                  }
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                error_type: error.code || error.name
              };
            }
          }
        },

        {
          name: 'get_request_history',
          schema: {
            description: 'Get API request history with statistics',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of recent requests to return (default: 10)'
              }
            }
          },
          handler: async (args) => {
            const { limit = 10 } = args;

            try {
              // Access internal state through ApiClient widget API
              const history = ApiClient._callHistory || [];
              const stats = ApiClient._callStats || { total: 0, success: 0, error: 0, aborted: 0 };

              return {
                success: true,
                history: history.slice(-limit).reverse(),
                stats,
                total_tokens_used: ApiClient._totalTokensUsed || 0,
                last_call_time: ApiClient._lastCallTime
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
          name: 'cancel_request',
          schema: {
            description: 'Cancel the current API request',
            properties: {
              reason: {
                type: 'string',
                description: 'Reason for cancellation (optional)'
              }
            }
          },
          handler: async (args) => {
            const { reason = 'User requested abort' } = args;

            try {
              ApiClient.abortCurrentCall(reason);

              return {
                success: true,
                message: 'API request cancelled',
                reason
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
          name: 'retry_request',
          schema: {
            description: 'Retry a failed API request',
            properties: {
              history: {
                type: 'array',
                description: 'Original request history',
                items: { type: 'object' }
              },
              api_key: {
                type: 'string',
                description: 'API key for authentication'
              }
            },
            required: ['history']
          },
          handler: async (args) => {
            const { history, api_key } = args;

            try {
              const response = await ApiClient.callApiWithRetry(history, api_key);

              return {
                success: true,
                response: {
                  type: response.type,
                  content: response.content
                },
                retried: true
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                error_type: error.code || error.name
              };
            }
          }
        },

        {
          name: 'get_stats',
          schema: {
            description: 'Get API client statistics and status',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = {
                total_calls: ApiClient._callStats?.total || 0,
                successful_calls: ApiClient._callStats?.success || 0,
                failed_calls: ApiClient._callStats?.error || 0,
                aborted_calls: ApiClient._callStats?.aborted || 0,
                total_tokens_used: ApiClient._totalTokensUsed || 0,
                last_call_time: ApiClient._lastCallTime,
                success_rate: ApiClient._callStats?.total > 0
                  ? (ApiClient._callStats.success / ApiClient._callStats.total * 100).toFixed(2)
                  : 0,
                connection_type: ApiClient.useProxy ? 'proxy' : 'direct',
                active_request: ApiClient.currentAbortController !== null
              };

              return {
                success: true,
                stats
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
        // UTILITY OPERATIONS
        // =================================================================
        {
          name: 'sanitize_json',
          schema: {
            description: 'Sanitize LLM JSON response (remove markdown, fix formatting)',
            properties: {
              raw_text: {
                type: 'string',
                description: 'Raw text response from LLM'
              }
            },
            required: ['raw_text']
          },
          handler: async (args) => {
            const { raw_text } = args;

            try {
              const sanitized = ApiClient.sanitizeLlmJsonResp(raw_text);

              return {
                success: true,
                sanitized_json: sanitized
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                original_text: raw_text
              };
            }
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[ApiClientMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default ApiClientMCPServer;
