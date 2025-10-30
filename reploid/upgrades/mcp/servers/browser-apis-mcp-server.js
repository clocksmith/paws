// @blueprint 0x000080 - BrowserAPIs MCP Server for REPLOID
/**
 * BrowserAPIs MCP Server
 *
 * Exposes browser APIs (File System Access, Notifications, Clipboard, etc.)
 * Enables agents to interact with the browser environment
 *
 * Available Tools:
 * - get_browser_capabilities - Get available browser APIs
 * - request_directory_access - Request access to a directory
 * - write_file_to_filesystem - Write file to local filesystem
 * - read_file_from_filesystem - Read file from local filesystem
 * - sync_artifact_to_filesystem - Sync VFS artifact to filesystem
 * - request_notification_permission - Request notification permission
 * - get_browser_state - Get current browser API state
 */

const BrowserAPIsMCPServer = {
  metadata: {
    id: 'BrowserAPIsMCPServer',
    version: '1.0.0',
    description: 'Browser API access operations',
    dependencies: ['ReploidMCPServerBase', 'BrowserAPIs', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, BrowserAPIs, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[BrowserAPIsMCPServer] Initializing...');

    const server = createMCPServer({
      name: 'browser-apis',
      version: '1.0.0',
      description: 'REPLOID Browser APIs - interact with browser environment',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'get_browser_capabilities',
          schema: {
            description: 'Get available browser APIs and capabilities',
            properties: {}
          },
          handler: async () => {
            const capabilities = BrowserAPIs.getCapabilities();
            return { success: true, capabilities };
          }
        },
        {
          name: 'request_directory_access',
          schema: {
            description: 'Request access to a directory via File System Access API',
            properties: {}
          },
          handler: async () => {
            const handle = await BrowserAPIs.requestDirectoryAccess();
            return { success: true, granted: !!handle };
          }
        },
        {
          name: 'write_file_to_filesystem',
          schema: {
            description: 'Write file to local filesystem',
            properties: {
              file_name: { type: 'string', description: 'File name' },
              content: { type: 'string', description: 'File content' }
            },
            required: ['file_name', 'content']
          },
          handler: async (args) => {
            const { file_name, content } = args;
            await BrowserAPIs.writeFile(file_name, content);
            return { success: true, file: file_name };
          }
        },
        {
          name: 'read_file_from_filesystem',
          schema: {
            description: 'Read file from local filesystem',
            properties: {
              file_name: { type: 'string', description: 'File name' }
            },
            required: ['file_name']
          },
          handler: async (args) => {
            const { file_name } = args;
            const content = await BrowserAPIs.readFile(file_name);
            return { success: true, file: file_name, content };
          }
        },
        {
          name: 'sync_artifact_to_filesystem',
          schema: {
            description: 'Sync VFS artifact to local filesystem',
            properties: {
              artifact_path: { type: 'string', description: 'VFS artifact path' }
            },
            required: ['artifact_path']
          },
          handler: async (args) => {
            const { artifact_path } = args;
            await BrowserAPIs.syncArtifactToFilesystem(artifact_path);
            return { success: true, synced: artifact_path };
          }
        },
        {
          name: 'request_notification_permission',
          schema: {
            description: 'Request notification permission',
            properties: {}
          },
          handler: async () => {
            const granted = await BrowserAPIs.requestNotificationPermission();
            return { success: true, granted };
          }
        },
        {
          name: 'get_browser_state',
          schema: {
            description: 'Get current browser API state',
            properties: {}
          },
          handler: async () => {
            const state = BrowserAPIs.getState();
            return { success: true, state };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[BrowserAPIsMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default BrowserAPIsMCPServer;
