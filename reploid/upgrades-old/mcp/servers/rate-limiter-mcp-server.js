// @blueprint 0x000086 - RateLimiter MCP Server for REPLOID
/**
 * RateLimiter MCP Server
 *
 * Exposes REPLOID Rate Limiter operations via MCP
 * Enables agents to check and manage API rate limiting
 *
 * Available Tools:
 * - check_limit - Check if a limiter allows a request
 * - wait_for_token - Wait for a token to become available
 * - get_limiter_status - Get current limiter status
 * - reset_limiter - Reset a specific limiter
 * - create_limiter - Create a new rate limiter
 */

const RateLimiterMCPServer = {
  metadata: {
    id: 'RateLimiterMCPServer',
    version: '1.0.0',
    description: 'Rate limiting operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'RateLimiter', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, RateLimiter, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[RateLimiterMCPServer] Initializing Rate Limiter MCP Server...');

    const server = createMCPServer({
      name: 'rate-limiter',
      version: '1.0.0',
      description: 'REPLOID Rate Limiter - API rate limiting and throttling',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'check_limit',
          schema: {
            description: 'Check if a rate limiter allows a request',
            properties: {
              limiter_name: {
                type: 'string',
                description: 'Limiter name ("api" or "strict", default: "api")'
              }
            }
          },
          handler: async (args) => {
            const { limiter_name = 'api' } = args;

            try {
              const limiter = RateLimiter.getLimiter(limiter_name);

              if (!limiter) {
                return {
                  success: false,
                  error: `Limiter not found: ${limiter_name}`
                };
              }

              const allowed = limiter.tryAcquire ? limiter.tryAcquire() : limiter.checkLimit();

              return {
                success: true,
                allowed,
                limiter: limiter_name
              };
            } catch (error) {
              logger.error('[RateLimiterMCPServer] Error checking limit:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'wait_for_token',
          schema: {
            description: 'Wait for a token to become available',
            properties: {
              limiter_name: {
                type: 'string',
                description: 'Limiter name (default: "api")'
              },
              timeout_ms: {
                type: 'number',
                description: 'Timeout in milliseconds (default: 5000)'
              }
            }
          },
          handler: async (args) => {
            const { limiter_name = 'api', timeout_ms = 5000 } = args;

            try {
              await RateLimiter.waitForToken(limiter_name, timeout_ms);

              return {
                success: true,
                message: 'Token acquired'
              };
            } catch (error) {
              logger.error('[RateLimiterMCPServer] Error waiting for token:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_limiter_status',
          schema: {
            description: 'Get current status of a rate limiter',
            properties: {
              limiter_name: {
                type: 'string',
                description: 'Limiter name (default: "api")'
              }
            }
          },
          handler: async (args) => {
            const { limiter_name = 'api' } = args;

            try {
              const limiter = RateLimiter.getLimiter(limiter_name);

              if (!limiter) {
                return {
                  success: false,
                  error: `Limiter not found: ${limiter_name}`
                };
              }

              // Get status based on limiter type
              const status = {
                name: limiter_name,
                type: limiter.constructor.name
              };

              if (limiter.tokens !== undefined) {
                // Token bucket
                status.tokens = limiter.tokens;
                status.maxTokens = limiter.maxTokens;
                status.refillRate = limiter.refillRate;
              } else if (limiter.requests !== undefined) {
                // Sliding window
                status.currentRequests = limiter.requests.length;
                status.maxRequests = limiter.maxRequests;
                status.windowMs = limiter.windowMs;
              }

              return {
                success: true,
                ...status
              };
            } catch (error) {
              logger.error('[RateLimiterMCPServer] Error getting limiter status:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'reset_limiter',
          schema: {
            description: 'Reset a rate limiter',
            properties: {
              limiter_name: {
                type: 'string',
                description: 'Limiter name (default: "api")'
              }
            }
          },
          handler: async (args) => {
            const { limiter_name = 'api' } = args;

            try {
              const limiter = RateLimiter.getLimiter(limiter_name);

              if (!limiter) {
                return {
                  success: false,
                  error: `Limiter not found: ${limiter_name}`
                };
              }

              if (limiter.reset) {
                limiter.reset();
              }

              return {
                success: true,
                message: `Limiter ${limiter_name} reset`
              };
            } catch (error) {
              logger.error('[RateLimiterMCPServer] Error resetting limiter:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'create_limiter',
          schema: {
            description: 'Create a new rate limiter',
            properties: {
              type: {
                type: 'string',
                description: 'Limiter type ("token-bucket" or "sliding-window")'
              },
              options: {
                type: 'object',
                description: 'Limiter configuration (maxTokens, refillRate for token-bucket; maxRequests, windowMs for sliding-window)'
              }
            },
            required: ['type']
          },
          handler: async (args) => {
            const { type, options = {} } = args;

            try {
              const limiter = RateLimiter.createLimiter(type, options);

              return {
                success: true,
                type,
                message: 'Limiter created'
              };
            } catch (error) {
              logger.error('[RateLimiterMCPServer] Error creating limiter:', error);
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });

    server.initialize();

    logger.info(`[RateLimiterMCPServer] Initialized with ${server.listTools().length} tools`);

    return server;
  }
};

export default RateLimiterMCPServer;
