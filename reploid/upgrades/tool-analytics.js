/**
 * @fileoverview Tool Usage Analytics for REPLOID
 * Tracks tool execution patterns, performance, and errors for optimization.
 *
 * @module ToolAnalytics
 * @version 1.0.0
 * @category analytics
 */

const ToolAnalytics = {
  metadata: {
    id: 'ToolAnalytics',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils', 'StateManager'],
    async: true,
    type: 'analytics'
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger } = Utils;

    // Tool usage metrics
    const toolMetrics = new Map();
    let sessionStart = Date.now();

    /**
     * Initialize analytics
     */
    const init = async () => {
      logger.info('[ToolAnalytics] Initializing tool usage analytics');

      // Listen for tool execution events
      EventBus.on('tool:start', handleToolStart);
      EventBus.on('tool:complete', handleToolComplete);
      EventBus.on('tool:error', handleToolError);

      return true;
    };

    /**
     * Handle tool start event
     */
    const handleToolStart = (data) => {
      const { toolName, args } = data;

      if (!toolMetrics.has(toolName)) {
        toolMetrics.set(toolName, {
          name: toolName,
          totalCalls: 0,
          successfulCalls: 0,
          failedCalls: 0,
          totalDuration: 0,
          minDuration: Infinity,
          maxDuration: 0,
          avgDuration: 0,
          errors: [],
          lastUsed: null,
          argPatterns: new Map()
        });
      }

      const metrics = toolMetrics.get(toolName);
      metrics.totalCalls++;
      metrics.lastUsed = Date.now();
      metrics._startTime = Date.now();

      // Track argument patterns
      const argKeys = Object.keys(args || {}).sort().join(',');
      if (!metrics.argPatterns.has(argKeys)) {
        metrics.argPatterns.set(argKeys, 0);
      }
      metrics.argPatterns.set(argKeys, metrics.argPatterns.get(argKeys) + 1);
    };

    /**
     * Handle tool completion
     */
    const handleToolComplete = (data) => {
      const { toolName } = data;
      const metrics = toolMetrics.get(toolName);
      if (!metrics || !metrics._startTime) return;

      const duration = Date.now() - metrics._startTime;
      metrics.successfulCalls++;
      metrics.totalDuration += duration;
      metrics.minDuration = Math.min(metrics.minDuration, duration);
      metrics.maxDuration = Math.max(metrics.maxDuration, duration);
      metrics.avgDuration = metrics.totalDuration / metrics.successfulCalls;

      delete metrics._startTime;
    };

    /**
     * Handle tool error
     */
    const handleToolError = (data) => {
      const { toolName, error } = data;
      const metrics = toolMetrics.get(toolName);
      if (!metrics) return;

      metrics.failedCalls++;
      metrics.errors.push({
        message: error?.message || 'Unknown error',
        timestamp: Date.now()
      });

      // Keep only last 10 errors
      if (metrics.errors.length > 10) {
        metrics.errors.shift();
      }

      delete metrics._startTime;
    };

    /**
     * Get analytics for a specific tool
     */
    const getToolAnalytics = (toolName) => {
      const metrics = toolMetrics.get(toolName);
      if (!metrics) return null;

      return {
        ...metrics,
        successRate: metrics.totalCalls > 0
          ? (metrics.successfulCalls / metrics.totalCalls * 100).toFixed(1)
          : 0,
        errorRate: metrics.totalCalls > 0
          ? (metrics.failedCalls / metrics.totalCalls * 100).toFixed(1)
          : 0,
        avgDurationMs: metrics.avgDuration.toFixed(2),
        topArgPatterns: Array.from(metrics.argPatterns.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([pattern, count]) => ({ pattern, count }))
      };
    };

    /**
     * Get all tool analytics
     */
    const getAllAnalytics = () => {
      const analytics = {
        sessionDuration: Date.now() - sessionStart,
        totalTools: toolMetrics.size,
        tools: []
      };

      for (const [name, metrics] of toolMetrics.entries()) {
        analytics.tools.push(getToolAnalytics(name));
      }

      // Sort by total calls descending
      analytics.tools.sort((a, b) => b.totalCalls - a.totalCalls);

      return analytics;
    };

    /**
     * Get top N most used tools
     */
    const getTopTools = (limit = 5) => {
      return getAllAnalytics()
        .tools
        .slice(0, limit);
    };

    /**
     * Get slowest tools
     */
    const getSlowestTools = (limit = 5) => {
      return getAllAnalytics()
        .tools
        .sort((a, b) => b.avgDuration - a.avgDuration)
        .slice(0, limit);
    };

    /**
     * Get tools with highest error rates
     */
    const getProblematicTools = (limit = 5) => {
      return getAllAnalytics()
        .tools
        .filter(t => t.failedCalls > 0)
        .sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate))
        .slice(0, limit);
    };

    /**
     * Generate analytics report
     */
    const generateReport = () => {
      const analytics = getAllAnalytics();

      let report = '# Tool Usage Analytics\n\n';
      report += `**Session Duration:** ${(analytics.sessionDuration / 1000 / 60).toFixed(1)} minutes\n`;
      report += `**Total Tools Used:** ${analytics.totalTools}\n\n`;

      report += '## Top 5 Most Used Tools\n\n';
      report += '| Tool | Calls | Success Rate | Avg Duration |\n';
      report += '|------|-------|--------------|-------------|\n';
      getTopTools(5).forEach(tool => {
        report += `| ${tool.name} | ${tool.totalCalls} | ${tool.successRate}% | ${tool.avgDurationMs}ms |\n`;
      });
      report += '\n';

      report += '## Top 5 Slowest Tools\n\n';
      report += '| Tool | Avg Duration | Max Duration | Calls |\n';
      report += '|------|--------------|--------------|-------|\n';
      getSlowestTools(5).forEach(tool => {
        report += `| ${tool.name} | ${tool.avgDurationMs}ms | ${tool.maxDuration}ms | ${tool.totalCalls} |\n`;
      });
      report += '\n';

      const problematic = getProblematicTools(5);
      if (problematic.length > 0) {
        report += '## Tools with Errors\n\n';
        report += '| Tool | Error Rate | Failed Calls | Recent Errors |\n';
        report += '|------|------------|--------------|---------------|\n';
        problematic.forEach(tool => {
          const recentError = tool.errors[tool.errors.length - 1];
          const errorMsg = recentError ? recentError.message.slice(0, 50) : 'N/A';
          report += `| ${tool.name} | ${tool.errorRate}% | ${tool.failedCalls} | ${errorMsg} |\n`;
        });
        report += '\n';
      }

      return report;
    };

    /**
     * Reset analytics
     */
    const reset = () => {
      toolMetrics.clear();
      sessionStart = Date.now();
      logger.info('[ToolAnalytics] Analytics reset');
    };

    return {
      init,
      api: {
        getToolAnalytics,
        getAllAnalytics,
        getTopTools,
        getSlowestTools,
        getProblematicTools,
        generateReport,
        reset
      }
    };
  }
};

// Export
ToolAnalytics;
