// @blueprint 0x00007E - GitVFS MCP Server for REPLOID
/**
 * GitVFS MCP Server
 *
 * Exposes Git-like version control operations on the Virtual File System via MCP
 * Enables agents to commit changes, view history, create checkpoints, and restore
 *
 * Available Tools:
 * - write_file - Write a file to VFS
 * - read_file - Read a file from VFS
 * - delete_file - Delete a file from VFS
 * - commit_changes - Commit staged changes with message
 * - get_history - Get commit history
 * - get_diff - Get diff between two commits
 * - create_checkpoint - Create a checkpoint/snapshot
 * - restore_checkpoint - Restore from a checkpoint
 * - list_checkpoints - List all checkpoints
 * - get_status - Get current VFS status
 */

const GitVFSMCPServer = {
  metadata: {
    id: 'GitVFSMCPServer',
    version: '1.0.0',
    description: 'Git-like version control operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'GitVFS', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, GitVFS, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[GitVFSMCPServer] Initializing GitVFS MCP Server...');

    const server = createMCPServer({
      name: 'git-vfs',
      version: '1.0.0',
      description: 'REPLOID Git-VFS - version control for the Virtual File System',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'write_file',
          schema: {
            description: 'Write a file to the VFS',
            properties: {
              path: {
                type: 'string',
                description: 'File path'
              },
              content: {
                type: 'string',
                description: 'File content'
              }
            },
            required: ['path', 'content']
          },
          handler: async (args) => {
            const { path, content } = args;

            await GitVFS.writeFile(path, content);

            return {
              success: true,
              path
            };
          }
        },

        {
          name: 'read_file',
          schema: {
            description: 'Read a file from the VFS',
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

            const content = await GitVFS.readFile(path);

            if (content === null) {
              return {
                success: false,
                error: `File not found: ${path}`
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
          name: 'delete_file',
          schema: {
            description: 'Delete a file from the VFS',
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

            await GitVFS.deleteFile(path);

            return {
              success: true,
              path,
              message: 'File deleted'
            };
          }
        },

        {
          name: 'commit_changes',
          schema: {
            description: 'Commit staged changes with a message',
            properties: {
              message: {
                type: 'string',
                description: 'Commit message'
              },
              author: {
                type: 'string',
                description: 'Optional: commit author'
              }
            },
            required: ['message']
          },
          handler: async (args) => {
            const { message, author } = args;

            const commit = await GitVFS.commitChanges(message, author);

            return {
              success: true,
              commit
            };
          }
        },

        {
          name: 'get_history',
          schema: {
            description: 'Get commit history',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of commits to return'
              }
            }
          },
          handler: async (args) => {
            const { limit } = args;

            const history = await GitVFS.getHistory(limit);

            return {
              success: true,
              history,
              count: history.length
            };
          }
        },

        {
          name: 'get_diff',
          schema: {
            description: 'Get diff between two commits',
            properties: {
              from_commit: {
                type: 'string',
                description: 'Source commit ID'
              },
              to_commit: {
                type: 'string',
                description: 'Target commit ID (or "HEAD" for latest)'
              }
            },
            required: ['from_commit', 'to_commit']
          },
          handler: async (args) => {
            const { from_commit, to_commit } = args;

            const diff = await GitVFS.getDiff(from_commit, to_commit);

            return {
              success: true,
              diff
            };
          }
        },

        {
          name: 'create_checkpoint',
          schema: {
            description: 'Create a checkpoint/snapshot',
            properties: {
              name: {
                type: 'string',
                description: 'Checkpoint name'
              },
              description: {
                type: 'string',
                description: 'Optional: checkpoint description'
              }
            },
            required: ['name']
          },
          handler: async (args) => {
            const { name, description } = args;

            const checkpoint = await GitVFS.createCheckpoint(name, description);

            return {
              success: true,
              checkpoint
            };
          }
        },

        {
          name: 'restore_checkpoint',
          schema: {
            description: 'Restore from a checkpoint',
            properties: {
              checkpoint_id: {
                type: 'string',
                description: 'Checkpoint ID to restore'
              }
            },
            required: ['checkpoint_id']
          },
          handler: async (args) => {
            const { checkpoint_id } = args;

            await GitVFS.restoreCheckpoint(checkpoint_id);

            return {
              success: true,
              message: `Restored from checkpoint: ${checkpoint_id}`
            };
          }
        },

        {
          name: 'list_checkpoints',
          schema: {
            description: 'List all checkpoints',
            properties: {}
          },
          handler: async () => {
            const checkpoints = await GitVFS.listCheckpoints();

            return {
              success: true,
              checkpoints,
              count: checkpoints.length
            };
          }
        },

        {
          name: 'get_status',
          schema: {
            description: 'Get current VFS status (staged files, changes, etc.)',
            properties: {}
          },
          handler: async () => {
            const status = await GitVFS.getStatus();

            return {
              success: true,
              status
            };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[GitVFSMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default GitVFSMCPServer;
