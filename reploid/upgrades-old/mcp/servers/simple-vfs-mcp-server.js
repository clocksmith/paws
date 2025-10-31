// @blueprint 0x000086 - SimpleVFS MCP Server for REPLOID
/**
 * SimpleVFS MCP Server
 *
 * Exposes lightweight VFS operations via MCP
 * Direct IndexedDB file system (no git dependencies)
 *
 * Available Tools:
 * - read_file - Read file content
 * - write_file - Write file content
 * - delete_file - Delete file
 * - list_files - List files in directory
 * - file_exists - Check if file exists
 * - get_file_info - Get file metadata
 * - get_all_files - Get all files
 * - create_snapshot - Create VFS snapshot
 * - restore_snapshot - Restore from snapshot
 * - get_snapshots - List all snapshots
 * - delete_snapshot - Delete snapshot
 */

const SimpleVFSMCPServer = {
  metadata: {
    id: 'SimpleVFSMCPServer',
    version: '1.0.0',
    description: 'Lightweight VFS operations via MCP (IndexedDB-based)',
    dependencies: ['ReploidMCPServerBase', 'SimpleVFS', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, SimpleVFS, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[SimpleVFSMCPServer] Initializing SimpleVFS MCP Server...');

    const server = createMCPServer({
      name: 'simple-vfs',
      version: '1.0.0',
      description: 'REPLOID SimpleVFS - lightweight IndexedDB file system',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'read_file',
          schema: {
            description: 'Read file content from VFS',
            properties: {
              path: {
                type: 'string',
                description: 'File path to read'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            try {
              const content = await SimpleVFS.readFile(path);
              return {
                success: true,
                path,
                content,
                size: content.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to read file: ${path}`
              };
            }
          }
        },

        {
          name: 'write_file',
          schema: {
            description: 'Write content to a file in VFS',
            properties: {
              path: {
                type: 'string',
                description: 'File path to write'
              },
              content: {
                type: 'string',
                description: 'Content to write'
              }
            },
            required: ['path', 'content']
          },
          handler: async (args) => {
            const { path, content } = args;

            try {
              await SimpleVFS.writeFile(path, content);
              return {
                success: true,
                path,
                size: content.length,
                message: 'File written successfully'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to write file: ${path}`
              };
            }
          }
        },

        {
          name: 'delete_file',
          schema: {
            description: 'Delete a file from VFS',
            properties: {
              path: {
                type: 'string',
                description: 'File path to delete'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            try {
              await SimpleVFS.deleteFile(path);
              return {
                success: true,
                path,
                message: 'File deleted successfully'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to delete file: ${path}`
              };
            }
          }
        },

        {
          name: 'list_files',
          schema: {
            description: 'List files in a directory',
            properties: {
              directory: {
                type: 'string',
                description: 'Directory path (default: "/" for root)',
                default: '/'
              }
            }
          },
          handler: async (args) => {
            const { directory = '/' } = args;

            try {
              const files = await SimpleVFS.listFiles(directory);
              return {
                success: true,
                directory,
                files,
                count: files.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to list files in: ${directory}`
              };
            }
          }
        },

        {
          name: 'file_exists',
          schema: {
            description: 'Check if a file exists in VFS',
            properties: {
              path: {
                type: 'string',
                description: 'File path to check'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            try {
              const exists = await SimpleVFS.fileExists(path);
              return {
                success: true,
                path,
                exists
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to check file existence: ${path}`
              };
            }
          }
        },

        {
          name: 'get_file_info',
          schema: {
            description: 'Get file metadata (path, timestamp, size)',
            properties: {
              path: {
                type: 'string',
                description: 'File path'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path } = args;

            try {
              const info = await SimpleVFS.getFileInfo(path);
              return {
                success: true,
                ...info
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to get file info: ${path}`
              };
            }
          }
        },

        {
          name: 'get_all_files',
          schema: {
            description: 'Get all files in VFS with metadata',
            properties: {}
          },
          handler: async () => {
            try {
              const files = await SimpleVFS.getAllFiles();
              return {
                success: true,
                files: files.map(f => ({
                  path: f.path,
                  size: f.size,
                  timestamp: f.timestamp
                })),
                count: files.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get all files'
              };
            }
          }
        },

        {
          name: 'create_snapshot',
          schema: {
            description: 'Create a snapshot of the current VFS state',
            properties: {
              label: {
                type: 'string',
                description: 'Optional label for the snapshot'
              }
            }
          },
          handler: async (args) => {
            const { label } = args;

            try {
              const snapshot = await SimpleVFS.createSnapshot(label);
              return {
                success: true,
                snapshot: {
                  id: snapshot.id,
                  label: snapshot.label,
                  timestamp: snapshot.timestamp,
                  fileCount: snapshot.fileCount
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to create snapshot'
              };
            }
          }
        },

        {
          name: 'restore_snapshot',
          schema: {
            description: 'Restore VFS from a snapshot (destructive!)',
            properties: {
              snapshotId: {
                type: 'number',
                description: 'Snapshot ID to restore'
              }
            },
            required: ['snapshotId']
          },
          handler: async (args) => {
            const { snapshotId } = args;

            try {
              const snapshot = await SimpleVFS.restoreSnapshot(snapshotId);
              return {
                success: true,
                snapshot: {
                  id: snapshotId,
                  label: snapshot.label,
                  timestamp: snapshot.timestamp,
                  fileCount: snapshot.fileCount
                },
                message: 'Snapshot restored successfully'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to restore snapshot: ${snapshotId}`
              };
            }
          }
        },

        {
          name: 'get_snapshots',
          schema: {
            description: 'Get all VFS snapshots',
            properties: {}
          },
          handler: async () => {
            try {
              const snapshots = await SimpleVFS.getSnapshots();
              return {
                success: true,
                snapshots: snapshots.map(s => ({
                  id: s.id,
                  label: s.label,
                  timestamp: s.timestamp,
                  fileCount: s.fileCount
                })),
                count: snapshots.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get snapshots'
              };
            }
          }
        },

        {
          name: 'delete_snapshot',
          schema: {
            description: 'Delete a VFS snapshot',
            properties: {
              snapshotId: {
                type: 'number',
                description: 'Snapshot ID to delete'
              }
            },
            required: ['snapshotId']
          },
          handler: async (args) => {
            const { snapshotId } = args;

            try {
              await SimpleVFS.deleteSnapshot(snapshotId);
              return {
                success: true,
                snapshotId,
                message: 'Snapshot deleted successfully'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || `Failed to delete snapshot: ${snapshotId}`
              };
            }
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[SimpleVFSMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default SimpleVFSMCPServer;
