// @blueprint 0x00007D - PerformanceMonitor MCP Server for REPLOID
/**
 * PerformanceMonitor MCP Server
 *
 * Exposes performance monitoring and metrics collection via MCP
 * Enables agents to track performance, identify bottlenecks, and optimize
 *
 * Available Tools:
 * - get_metrics - Get all performance metrics
 * - get_tool_stats - Get tool execution statistics
 * - get_state_stats - Get state management statistics
 * - get_llm_stats - Get LLM request/response statistics
 * - get_memory_stats - Get memory usage statistics
 * - generate_report - Generate performance analysis report
 * - reset_metrics - Reset all performance metrics
 */

const PerformanceMonitorMCPServer = {
  metadata: {
    id: 'PerformanceMonitorMCPServer',
    version: '1.0.0',
    description: 'Performance monitoring operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'PerformanceMonitor', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, PerformanceMonitor, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[PerformanceMonitorMCPServer] Initializing PerformanceMonitor MCP Server...');

    const server = createMCPServer({
      name: 'performance-monitor',
      version: '1.0.0',
      description: 'REPLOID Performance Monitor - track metrics and identify bottlenecks',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'get_metrics',
          schema: {
            description: 'Get all performance metrics',
            properties: {}
          },
          handler: async () => {
            const metrics = PerformanceMonitor.getMetrics();

            return {
              success: true,
              metrics
            };
          }
        },

        {
          name: 'get_tool_stats',
          schema: {
            description: 'Get tool execution statistics',
            properties: {}
          },
          handler: async () => {
            const stats = PerformanceMonitor.getToolStats();

            return {
              success: true,
              stats
            };
          }
        },

        {
          name: 'get_state_stats',
          schema: {
            description: 'Get state management statistics',
            properties: {}
          },
          handler: async () => {
            const stats = PerformanceMonitor.getStateStats();

            return {
              success: true,
              stats
            };
          }
        },

        {
          name: 'get_llm_stats',
          schema: {
            description: 'Get LLM request/response statistics',
            properties: {}
          },
          handler: async () => {
            const stats = PerformanceMonitor.getLLMStats();

            return {
              success: true,
              stats
            };
          }
        },

        {
          name: 'get_memory_stats',
          schema: {
            description: 'Get memory usage statistics',
            properties: {}
          },
          handler: async () => {
            const stats = PerformanceMonitor.getMemoryStats();

            return {
              success: true,
              stats
            };
          }
        },

        {
          name: 'generate_report',
          schema: {
            description: 'Generate a comprehensive performance analysis report',
            properties: {}
          },
          handler: async () => {
            const report = PerformanceMonitor.generateReport();

            return {
              success: true,
              report,
              format: 'markdown'
            };
          }
        },

        {
          name: 'reset_metrics',
          schema: {
            description: 'Reset all performance metrics',
            properties: {}
          },
          handler: async () => {
            PerformanceMonitor.reset();

            return {
              success: true,
              message: 'All performance metrics reset'
            };
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[PerformanceMonitorMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default PerformanceMonitorMCPServer;
