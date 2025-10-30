// @blueprint 0x000076 - VFS MCP Server for REPLOID
/**
 * VFS MCP Server
 *
 * Exposes REPLOID Virtual File System (StateManager) operations via MCP
 * Enables external LLMs to read/write files, manage sessions, and track history
 *
 * Available Tools:
 * - read_artifact - Read file content from VFS
 * - write_artifact - Create or update a file
 * - list_artifacts - List all files (with optional filter)
 * - delete_artifact - Remove a file
 * - get_artifact_history - Get version history for a file
 * - diff_artifacts - Compare two versions of a file
 * - create_session - Start a new work session
 * - list_sessions - List all sessions
 * - get_session_info - Get detailed session information
 * - create_checkpoint - Create a VFS checkpoint
 * - restore_checkpoint - Restore from a checkpoint
 */

const VFSMCPServer = {
  metadata: {
    id: 'VFSMCPServer',
    version: '1.0.0',
    description: 'Virtual File System operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'StateManager', 'Utils', 'EventBus?'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, StateManager, Utils, EventBus } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[VFSMCPServer] Initializing VFS MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'vfs',
      version: '1.0.0',
      description: 'REPLOID Virtual File System - file operations, sessions, and version control',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // FILE OPERATIONS
        // =================================================================
        {
          name: 'read_artifact',
          schema: {
            description: 'Read file content from the Virtual File System',
            properties: {
              path: {
                type: 'string',
                description: 'File path (e.g., /sessions/session_123/cats.md)'
              },
              version: {
                type: 'string',
                description: 'Optional: specific version to read (default: latest)'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path, version } = args;

            const content = await StateManager.getArtifactContent(path, version);

            if (content === null) {
              throw new Error(`Artifact not found: ${path}`);
            }

            // Get metadata if available
            const metadata = StateManager.getArtifactMetadata(path);

            return {
              success: true,
              path,
              content,
              metadata: metadata || null,
              version: version || 'latest'
            };
          }
        },

        {
          name: 'write_artifact',
          schema: {
            description: 'Create or update a file in the Virtual File System',
            properties: {
              path: {
                type: 'string',
                description: 'File path'
              },
              content: {
                type: 'string',
                description: 'File content'
              },
              type: {
                type: 'string',
                description: 'Artifact type (e.g., "code", "document", "data")',
                default: 'document'
              },
              description: {
                type: 'string',
                description: 'Optional description of the file'
              }
            },
            required: ['path', 'content']
          },
          handler: async (args) => {
            const { path, content, type, description } = args;

            // Check if artifact exists
            const existingMeta = StateManager.getArtifactMetadata(path);

            if (existingMeta) {
              // Update existing
              await StateManager.updateArtifact(path, content);
              logger.info(`[VFSMCPServer] Updated artifact: ${path}`);
            } else {
              // Create new
              await StateManager.createArtifact(
                path,
                type || 'document',
                content,
                description || `Created via MCP at ${new Date().toISOString()}`
              );
              logger.info(`[VFSMCPServer] Created artifact: ${path}`);
            }

            return {
              success: true,
              path,
              action: existingMeta ? 'updated' : 'created',
              size: new Blob([content]).size
            };
          }
        },

        {
          name: 'list_artifacts',
          schema: {
            description: 'List all files in the Virtual File System',
            properties: {
              path_prefix: {
                type: 'string',
                description: 'Optional: filter by path prefix (e.g., "/sessions/session_123")'
              },
              type_filter: {
                type: 'string',
                description: 'Optional: filter by artifact type'
              }
            }
          },
          handler: async (args) => {
            const { path_prefix, type_filter } = args;

            const allMeta = await StateManager.getAllArtifactMetadata();
            let paths = Object.keys(allMeta);

            // Apply filters
            if (path_prefix) {
              paths = paths.filter(p => p.startsWith(path_prefix));
            }

            if (type_filter) {
              paths = paths.filter(p => allMeta[p]?.type === type_filter);
            }

            // Build result with metadata
            const artifacts = paths.map(path => ({
              path,
              ...allMeta[path]
            }));

            return {
              success: true,
              count: artifacts.length,
              artifacts
            };
          }
        },

        {
          name: 'delete_artifact',
          schema: {
            description: 'Delete a file from the Virtual File System',
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

            // Check if exists
            const metadata = StateManager.getArtifactMetadata(path);
            if (!metadata) {
              throw new Error(`Artifact not found: ${path}`);
            }

            await StateManager.deleteArtifact(path);

            logger.info(`[VFSMCPServer] Deleted artifact: ${path}`);

            return {
              success: true,
              path,
              action: 'deleted'
            };
          }
        },

        // =================================================================
        // VERSION CONTROL
        // =================================================================
        {
          name: 'get_artifact_history',
          schema: {
            description: 'Get version history for a file',
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

            const history = await StateManager.getArtifactHistory(path);

            if (!history || history.length === 0) {
              return {
                success: true,
                path,
                versions: [],
                message: 'No version history available'
              };
            }

            return {
              success: true,
              path,
              versions: history,
              count: history.length
            };
          }
        },

        {
          name: 'diff_artifacts',
          schema: {
            description: 'Compare two versions of a file',
            properties: {
              path: {
                type: 'string',
                description: 'File path'
              },
              version1: {
                type: 'string',
                description: 'First version identifier'
              },
              version2: {
                type: 'string',
                description: 'Second version identifier (or "latest")'
              }
            },
            required: ['path', 'version1', 'version2']
          },
          handler: async (args) => {
            const { path, version1, version2 } = args;

            const diff = await StateManager.getArtifactDiff(path, version1, version2);

            return {
              success: true,
              path,
              version1,
              version2,
              diff
            };
          }
        },

        {
          name: 'create_checkpoint',
          schema: {
            description: 'Create a checkpoint/snapshot of the current VFS state',
            properties: {
              description: {
                type: 'string',
                description: 'Description of the checkpoint'
              }
            }
          },
          handler: async (args) => {
            const { description } = args;

            const checkpoint = await StateManager.createCheckpoint(
              description || `MCP checkpoint at ${new Date().toISOString()}`
            );

            logger.info(`[VFSMCPServer] Created checkpoint: ${checkpoint.id}`);

            return {
              success: true,
              checkpoint
            };
          }
        },

        {
          name: 'restore_checkpoint',
          schema: {
            description: 'Restore VFS to a previous checkpoint',
            properties: {
              checkpoint_id: {
                type: 'string',
                description: 'Checkpoint identifier'
              }
            },
            required: ['checkpoint_id']
          },
          handler: async (args) => {
            const { checkpoint_id } = args;

            await StateManager.restoreCheckpoint(checkpoint_id);

            logger.info(`[VFSMCPServer] Restored checkpoint: ${checkpoint_id}`);

            return {
              success: true,
              checkpoint_id,
              action: 'restored'
            };
          }
        },

        // =================================================================
        // SESSION MANAGEMENT
        // =================================================================
        {
          name: 'create_session',
          schema: {
            description: 'Create a new work session',
            properties: {
              goal: {
                type: 'string',
                description: 'Session goal/objective'
              }
            },
            required: ['goal']
          },
          handler: async (args) => {
            const { goal } = args;

            const sessionId = await StateManager.createSession(goal);

            logger.info(`[VFSMCPServer] Created session: ${sessionId}`);

            return {
              success: true,
              session_id: sessionId,
              goal
            };
          }
        },

        {
          name: 'list_sessions',
          schema: {
            description: 'List all sessions',
            properties: {
              status_filter: {
                type: 'string',
                description: 'Optional: filter by status ("active", "completed", "archived")'
              }
            }
          },
          handler: async (args) => {
            const { status_filter } = args;

            const sessions = await StateManager.listSessions();

            let filtered = sessions;
            if (status_filter) {
              filtered = sessions.filter(s => s.status === status_filter);
            }

            return {
              success: true,
              count: filtered.length,
              sessions: filtered
            };
          }
        },

        {
          name: 'get_session_info',
          schema: {
            description: 'Get detailed information about a session',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier'
              }
            },
            required: ['session_id']
          },
          handler: async (args) => {
            const { session_id } = args;

            const sessionInfo = await StateManager.getSessionInfo(session_id);

            if (!sessionInfo) {
              throw new Error(`Session not found: ${session_id}`);
            }

            return {
              success: true,
              session: sessionInfo
            };
          }
        },

        {
          name: 'archive_session',
          schema: {
            description: 'Archive a session (mark as completed)',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier'
              }
            },
            required: ['session_id']
          },
          handler: async (args) => {
            const { session_id } = args;

            await StateManager.archiveSession(session_id);

            logger.info(`[VFSMCPServer] Archived session: ${session_id}`);

            return {
              success: true,
              session_id,
              action: 'archived'
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[VFSMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default VFSMCPServer;
