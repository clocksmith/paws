// @blueprint 0x000085 - Storage MCP Server for REPLOID
/**
 * Storage MCP Server
 *
 * Exposes IndexedDB storage operations via MCP
 * Enables agents to store and retrieve data persistently
 *
 * Available Tools:
 * - get_item - Get item from storage
 * - set_item - Set item in storage
 * - delete_item - Delete item from storage
 * - clear - Clear all items (with confirmation)
 * - get_quota - Get storage quota information
 * - list_keys - List all storage keys
 * - get_state - Get stored state
 * - save_state - Save state to storage
 */

const StorageMCPServer = {
  metadata: {
    id: 'StorageMCPServer',
    version: '1.0.0',
    description: 'IndexedDB storage operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'Storage', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, Storage, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[StorageMCPServer] Initializing Storage MCP Server...');

    const server = createMCPServer({
      name: 'storage',
      version: '1.0.0',
      description: 'REPLOID Storage - persistent IndexedDB key-value storage',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'get_item',
          schema: {
            description: 'Get an item from storage by path/key',
            properties: {
              path: {
                type: 'string',
                description: 'Storage path/key (e.g., "/data/config.json")'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            const content = await Storage.getArtifactContent(path);

            if (content === null) {
              return {
                success: false,
                error: `Item not found: ${path}`
              };
            }

            return {
              success: true,
              path,
              content
            };
          }
        },

        {
          name: 'set_item',
          schema: {
            description: 'Set an item in storage',
            properties: {
              path: {
                type: 'string',
                description: 'Storage path/key'
              },
              content: {
                type: 'string',
                description: 'Content to store'
              }
            },
            required: ['path', 'content']
          },
          handler: async (args) => {
            const { path, content } = args;

            await Storage.setArtifactContent(path, content);

            return {
              success: true,
              path,
              size: new Blob([content]).size
            };
          }
        },

        {
          name: 'delete_item',
          schema: {
            description: 'Delete an item from storage',
            properties: {
              path: {
                type: 'string',
                description: 'Storage path/key to delete'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            await Storage.deleteArtifact(path);

            return {
              success: true,
              path,
              message: 'Item deleted'
            };
          }
        },

        {
          name: 'clear',
          schema: {
            description: 'Clear all items from storage (use with caution!)',
            properties: {
              confirm: {
                type: 'boolean',
                description: 'Must be true to confirm clearing all storage'
              }
            },
            required: ['confirm']
          },
          handler: async (args) => {
            const { confirm } = args;

            if (!confirm) {
              return {
                success: false,
                error: 'Confirmation required to clear all storage'
              };
            }

            // Note: Storage module doesn't have a clear() method,
            // so this would need to be implemented or we return a warning
            logger.warn('[StorageMCPServer] Clear operation requested but not implemented in Storage module');

            return {
              success: false,
              error: 'Clear operation not implemented in underlying Storage module',
              suggestion: 'Delete items individually using delete_item'
            };
          }
        },

        {
          name: 'get_quota',
          schema: {
            description: 'Get storage quota information',
            properties: {}
          },
          handler: async () => {
            // Get IndexedDB quota if available
            let quota = null;

            if (navigator.storage && navigator.storage.estimate) {
              try {
                const estimate = await navigator.storage.estimate();
                quota = {
                  usage: estimate.usage,
                  quota: estimate.quota,
                  usagePercent: (estimate.usage / estimate.quota * 100).toFixed(2),
                  available: estimate.quota - estimate.usage
                };
              } catch (error) {
                logger.warn('[StorageMCPServer] Failed to get quota:', error);
              }
            }

            return {
              success: true,
              quota: quota || { available: false, message: 'Quota API not available' }
            };
          }
        },

        {
          name: 'list_keys',
          schema: {
            description: 'List all storage keys/paths',
            properties: {
              prefix: {
                type: 'string',
                description: 'Optional: filter by path prefix'
              }
            }
          },
          handler: async (args) => {
            const { prefix } = args;

            // Note: Storage module doesn't have a listKeys() method directly
            // This would need to traverse the VFS or use git ls-files

            // For now, return a message about limitation
            return {
              success: false,
              error: 'list_keys not implemented in underlying Storage module',
              suggestion: 'Use VFS MCP server list_artifacts instead'
            };
          }
        },

        {
          name: 'get_state',
          schema: {
            description: 'Get stored state object',
            properties: {}
          },
          handler: async () => {
            const state = await Storage.getState();

            return {
              success: true,
              state
            };
          }
        },

        {
          name: 'save_state',
          schema: {
            description: 'Save state object to storage',
            properties: {
              state: {
                type: 'object',
                description: 'State object to save'
              }
            },
            required: ['state']
          },
          handler: async (args) => {
            const { state } = args;

            await Storage.saveState(state);

            return {
              success: true,
              message: 'State saved successfully'
            };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[StorageMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default StorageMCPServer;
