// @blueprint 0x00007A - Audit MCP Server for REPLOID
/**
 * Audit MCP Server
 *
 * Exposes REPLOID audit log capabilities via MCP
 * Allows external LLMs to query audit logs and security events
 *
 * Available Tools:
 * - query_audit_log - Search audit entries with filters
 * - get_recent_events - Get the most recent audit events
 * - export_audit_report - Generate an audit report
 * - get_security_summary - Get security-related statistics
 */

const AuditMCPServer = {
  metadata: {
    id: 'AuditMCPServer',
    version: '1.0.0',
    description: 'Audit log access and security monitoring via MCP',
    dependencies: ['ReploidMCPServerBase', 'AuditLogger', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, AuditLogger, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[AuditMCPServer] Initializing Audit MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'audit',
      version: '1.0.0',
      description: 'REPLOID Audit & Security - log querying and security monitoring',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // LOG QUERYING
        // =================================================================
        {
          name: 'query_audit_log',
          schema: {
            description: 'Query audit log entries with various filters',
            properties: {
              event_type: {
                type: 'string',
                description: 'Optional: filter by event type (e.g., "vfs_create", "tool_call", "state_change")'
              },
              start_time: {
                type: 'string',
                description: 'Optional: start time (ISO 8601 format)'
              },
              end_time: {
                type: 'string',
                description: 'Optional: end time (ISO 8601 format)'
              },
              severity: {
                type: 'string',
                description: 'Optional: filter by severity level',
                enum: ['info', 'warning', 'error', 'critical']
              },
              limit: {
                type: 'number',
                description: 'Maximum number of entries to return (default: 50)'
              }
            }
          },
          handler: async (args) => {
            const { event_type, start_time, end_time, severity, limit = 50 } = args;

            // Build query filters
            const filters = {};
            if (event_type) filters.eventType = event_type;
            if (severity) filters.severity = severity;

            // Parse time filters
            if (start_time) filters.startTime = new Date(start_time).getTime();
            if (end_time) filters.endTime = new Date(end_time).getTime();

            // Query audit log
            const entries = await AuditLogger.query(filters, limit);

            return {
              success: true,
              count: entries.length,
              entries
            };
          }
        },

        {
          name: 'get_recent_events',
          schema: {
            description: 'Get the most recent audit events',
            properties: {
              count: {
                type: 'number',
                description: 'Number of events to retrieve (default: 20)'
              },
              event_type: {
                type: 'string',
                description: 'Optional: filter by event type'
              }
            }
          },
          handler: async (args) => {
            const { count = 20, event_type } = args;

            const filters = event_type ? { eventType: event_type } : {};
            const entries = await AuditLogger.getRecent(count, filters);

            return {
              success: true,
              count: entries.length,
              events: entries
            };
          }
        },

        // =================================================================
        // REPORTING
        // =================================================================
        {
          name: 'export_audit_report',
          schema: {
            description: 'Generate a comprehensive audit report',
            properties: {
              start_time: {
                type: 'string',
                description: 'Start time for report (ISO 8601 format)'
              },
              end_time: {
                type: 'string',
                description: 'End time for report (ISO 8601 format)'
              },
              format: {
                type: 'string',
                description: 'Report format',
                enum: ['markdown', 'json', 'text'],
                default: 'markdown'
              }
            }
          },
          handler: async (args) => {
            const { start_time, end_time, format = 'markdown' } = args;

            // Parse time range
            const startTimestamp = start_time ? new Date(start_time).getTime() : Date.now() - (24 * 60 * 60 * 1000);
            const endTimestamp = end_time ? new Date(end_time).getTime() : Date.now();

            // Generate report
            const report = await AuditLogger.generateReport({
              startTime: startTimestamp,
              endTime: endTimestamp,
              format
            });

            logger.info('[AuditMCPServer] Generated audit report');

            return {
              success: true,
              format,
              time_range: {
                start: new Date(startTimestamp).toISOString(),
                end: new Date(endTimestamp).toISOString()
              },
              report
            };
          }
        },

        // =================================================================
        // SECURITY & STATISTICS
        // =================================================================
        {
          name: 'get_security_summary',
          schema: {
            description: 'Get security-related statistics and alerts',
            properties: {
              time_window_hours: {
                type: 'number',
                description: 'Time window in hours (default: 24)'
              }
            }
          },
          handler: async (args) => {
            const { time_window_hours = 24 } = args;

            const startTime = Date.now() - (time_window_hours * 60 * 60 * 1000);

            // Query for security events
            const allEvents = await AuditLogger.query({ startTime }, 1000);

            // Calculate stats
            const errorCount = allEvents.filter(e => e.severity === 'error' || e.severity === 'critical').length;
            const criticalCount = allEvents.filter(e => e.severity === 'critical').length;
            const warningCount = allEvents.filter(e => e.severity === 'warning').length;

            // Get VFS operations
            const vfsOps = allEvents.filter(e => e.eventType?.startsWith('vfs_'));
            const vfsCreates = vfsOps.filter(e => e.eventType === 'vfs_create').length;
            const vfsUpdates = vfsOps.filter(e => e.eventType === 'vfs_update').length;
            const vfsDeletes = vfsOps.filter(e => e.eventType === 'vfs_delete').length;

            // Get tool calls
            const toolCalls = allEvents.filter(e => e.eventType === 'tool_call' || e.eventType === 'mcp_tool_call');

            // Get state changes
            const stateChanges = allEvents.filter(e => e.eventType === 'state_change');

            return {
              success: true,
              time_window_hours,
              summary: {
                total_events: allEvents.length,
                errors: errorCount,
                critical: criticalCount,
                warnings: warningCount,
                vfs_operations: {
                  total: vfsOps.length,
                  creates: vfsCreates,
                  updates: vfsUpdates,
                  deletes: vfsDeletes
                },
                tool_executions: toolCalls.length,
                state_transitions: stateChanges.length
              },
              alerts: criticalCount > 0 ? [
                `${criticalCount} critical event(s) detected in the last ${time_window_hours} hours`
              ] : []
            };
          }
        },

        {
          name: 'get_audit_stats',
          schema: {
            description: 'Get general audit log statistics',
            properties: {}
          },
          handler: async () => {
            // Get stats from AuditLogger
            const stats = await AuditLogger.getStats();

            return {
              success: true,
              stats
            };
          }
        },

        {
          name: 'search_audit_by_session',
          schema: {
            description: 'Search audit logs by session ID',
            properties: {
              session_id: {
                type: 'string',
                description: 'Session identifier'
              },
              limit: {
                type: 'number',
                description: 'Maximum entries (default: 100)'
              }
            },
            required: ['session_id']
          },
          handler: async (args) => {
            const { session_id, limit = 100 } = args;

            // Query by session
            const entries = await AuditLogger.queryBySession(session_id, limit);

            return {
              success: true,
              session_id,
              count: entries.length,
              entries
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[AuditMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default AuditMCPServer;
