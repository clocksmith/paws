// @blueprint 0x000079 - Tool Execution MCP Server for REPLOID
/**
 * Tool Execution MCP Server
 *
 * Exposes REPLOID tool execution capabilities via MCP
 * Allows external LLMs to discover and execute agent tools
 *
 * Available Tools:
 * - list_tools - List all available agent tools
 * - get_tool_schema - Get detailed schema for a specific tool
 * - execute_tool - Execute a tool with given arguments
 * - get_tool_history - Get execution history for tools
 */

const ToolExecutionMCPServer = {
  metadata: {
    id: 'ToolExecutionMCPServer',
    version: '1.0.0',
    description: 'Tool discovery and execution via MCP',
    dependencies: ['ReploidMCPServerBase', 'ToolRunner', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ToolRunner, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ToolExecutionMCPServer] Initializing Tool Execution MCP Server...');

    // Track execution history
    const executionHistory = [];
    const MAX_HISTORY = 100;

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'tools',
      version: '1.0.0',
      description: 'REPLOID Tool Execution - discover and run agent tools',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // TOOL DISCOVERY
        // =================================================================
        {
          name: 'list_tools',
          schema: {
            description: 'List all available agent tools',
            properties: {
              category: {
                type: 'string',
                description: 'Optional: filter by tool category'
              }
            }
          },
          handler: async (args) => {
            const { category } = args;

            // Get tools from ToolRunner
            const allTools = ToolRunner.listTools ? ToolRunner.listTools() : [];

            let filtered = allTools;
            if (category) {
              filtered = allTools.filter(t => t.category === category);
            }

            return {
              success: true,
              count: filtered.length,
              tools: filtered.map(tool => ({
                name: tool.name,
                description: tool.description || '',
                category: tool.category || 'general',
                inputSchema: tool.inputSchema || {}
              }))
            };
          }
        },

        {
          name: 'get_tool_schema',
          schema: {
            description: 'Get detailed schema and documentation for a specific tool',
            properties: {
              tool_name: {
                type: 'string',
                description: 'Name of the tool'
              }
            },
            required: ['tool_name']
          },
          handler: async (args) => {
            const { tool_name } = args;

            // Get tool definition from ToolRunner
            const toolDef = ToolRunner.getTool ? ToolRunner.getTool(tool_name) : null;

            if (!toolDef) {
              throw new Error(`Tool not found: ${tool_name}`);
            }

            return {
              success: true,
              tool: {
                name: toolDef.name,
                description: toolDef.description || '',
                category: toolDef.category || 'general',
                inputSchema: toolDef.inputSchema || {},
                examples: toolDef.examples || [],
                notes: toolDef.notes || ''
              }
            };
          }
        },

        // =================================================================
        // TOOL EXECUTION
        // =================================================================
        {
          name: 'execute_tool',
          schema: {
            description: 'Execute a tool with the specified arguments',
            properties: {
              tool_name: {
                type: 'string',
                description: 'Name of the tool to execute'
              },
              arguments: {
                type: 'object',
                description: 'Tool arguments (must match tool schema)'
              },
              track_history: {
                type: 'boolean',
                description: 'Whether to track this execution in history (default: true)'
              }
            },
            required: ['tool_name', 'arguments']
          },
          handler: async (args) => {
            const { tool_name, arguments: toolArgs, track_history = true } = args;

            const startTime = Date.now();

            try {
              // Execute tool via ToolRunner
              const result = await ToolRunner.runTool(tool_name, toolArgs);

              const duration = Date.now() - startTime;

              // Track in history
              if (track_history) {
                executionHistory.push({
                  tool_name,
                  arguments: toolArgs,
                  result,
                  success: true,
                  duration,
                  timestamp: Date.now()
                });

                // Keep history bounded
                if (executionHistory.length > MAX_HISTORY) {
                  executionHistory.shift();
                }
              }

              logger.info(`[ToolExecutionMCPServer] Executed tool '${tool_name}' in ${duration}ms`);

              return {
                success: true,
                tool_name,
                result,
                duration_ms: duration
              };
            } catch (error) {
              const duration = Date.now() - startTime;

              // Track failure in history
              if (track_history) {
                executionHistory.push({
                  tool_name,
                  arguments: toolArgs,
                  error: error.message,
                  success: false,
                  duration,
                  timestamp: Date.now()
                });

                if (executionHistory.length > MAX_HISTORY) {
                  executionHistory.shift();
                }
              }

              logger.error(`[ToolExecutionMCPServer] Tool '${tool_name}' failed:`, error);

              throw error;
            }
          }
        },

        // =================================================================
        // EXECUTION HISTORY
        // =================================================================
        {
          name: 'get_tool_history',
          schema: {
            description: 'Get execution history for tools',
            properties: {
              tool_name: {
                type: 'string',
                description: 'Optional: filter by tool name'
              },
              limit: {
                type: 'number',
                description: 'Optional: limit number of entries (default: 20)'
              },
              success_only: {
                type: 'boolean',
                description: 'Optional: only show successful executions'
              }
            }
          },
          handler: async (args) => {
            const { tool_name, limit = 20, success_only } = args;

            let filtered = executionHistory;

            if (tool_name) {
              filtered = filtered.filter(entry => entry.tool_name === tool_name);
            }

            if (success_only) {
              filtered = filtered.filter(entry => entry.success);
            }

            const limited = filtered.slice(-limit);

            return {
              success: true,
              count: limited.length,
              total: executionHistory.length,
              history: limited
            };
          }
        },

        {
          name: 'get_tool_stats',
          schema: {
            description: 'Get aggregate statistics for tool usage',
            properties: {}
          },
          handler: async () => {
            // Calculate stats
            const totalExecutions = executionHistory.length;
            const successCount = executionHistory.filter(e => e.success).length;
            const failureCount = totalExecutions - successCount;

            // Tools by usage
            const toolUsage = {};
            executionHistory.forEach(entry => {
              toolUsage[entry.tool_name] = (toolUsage[entry.tool_name] || 0) + 1;
            });

            const mostUsedTool = Object.entries(toolUsage)
              .sort((a, b) => b[1] - a[1])[0];

            // Average duration
            const avgDuration = totalExecutions > 0
              ? executionHistory.reduce((sum, e) => sum + e.duration, 0) / totalExecutions
              : 0;

            return {
              success: true,
              stats: {
                total_executions: totalExecutions,
                successful: successCount,
                failed: failureCount,
                success_rate: totalExecutions > 0 ? (successCount / totalExecutions * 100).toFixed(1) : 0,
                avg_duration_ms: Math.round(avgDuration),
                most_used_tool: mostUsedTool ? { name: mostUsedTool[0], count: mostUsedTool[1] } : null,
                tool_usage: toolUsage
              }
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[ToolExecutionMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default ToolExecutionMCPServer;
