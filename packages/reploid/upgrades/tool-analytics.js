/**
 * @fileoverview Tool Usage Analytics for REPLOID
 * Tracks tool execution patterns, performance, and errors for optimization.
 *
 * @blueprint 0x000038 - Summarizes tool usage analytics.
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

    // Web Component Widget
    class ToolAnalyticsWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        // Update every 5 seconds for analytics
        this._updateInterval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const totalTools = toolMetrics.size;
        const totalCalls = Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.totalCalls, 0);
        const totalErrors = Array.from(toolMetrics.values()).reduce((sum, m) => sum + m.failedCalls, 0);

        return {
          state: totalCalls > 0 ? 'active' : 'idle',
          primaryMetric: `${totalTools} tools`,
          secondaryMetric: `${totalCalls} calls`,
          lastActivity: toolMetrics.size > 0 ? Math.max(...Array.from(toolMetrics.values()).map(m => m.lastUsed || 0)) : null,
          message: totalErrors > 0 ? `${totalErrors} errors` : 'All OK'
        };
      }

      render() {
        const analytics = getAllAnalytics();
        const sessionMins = (analytics.sessionDuration / 1000 / 60).toFixed(1);
        const topTools = getTopTools(5);
        const slowestTools = getSlowestTools(5);
        const problematicTools = getProblematicTools(5);

        const totalCalls = analytics.tools.reduce((sum, t) => sum + t.totalCalls, 0);
        const totalSuccess = analytics.tools.reduce((sum, t) => sum + t.successfulCalls, 0);
        const totalErrors = analytics.tools.reduce((sum, t) => sum + t.failedCalls, 0);
        const overallSuccessRate = totalCalls > 0 ? ((totalSuccess / totalCalls) * 100).toFixed(1) : '0.0';

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; }
            .widget-panel { padding: 12px; }
            h3 { margin: 0 0 12px 0; font-size: 1.1em; color: #fff; }
            .controls { display: flex; gap: 8px; margin-bottom: 12px; }
            button { padding: 6px 12px; background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.9em; }
            button:hover { background: rgba(100,150,255,0.3); }
          </style>

          <div class="widget-panel">
            <h3>☱ Tool Analytics</h3>

            <div class="controls">
              <button id="reset-btn">↻ Reset</button>
              <button id="report-btn">⛿ Report</button>
            </div>

            <h3>Session Overview</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Total Calls</div>
                <div style="font-size: 1.3em; font-weight: bold;">${totalCalls}</div>
              </div>
              <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Success Rate</div>
                <div style="font-size: 1.3em; font-weight: bold;">${overallSuccessRate}%</div>
              </div>
              <div style="padding: 12px; background: ${totalErrors > 0 ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.05)'}; border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Errors</div>
                <div style="font-size: 1.3em; font-weight: bold; color: ${totalErrors > 0 ? '#ff6b6b' : 'inherit'};">${totalErrors}</div>
              </div>
            </div>

            <h3 style="margin-top: 20px;">☄ Top 5 Most Used Tools</h3>
            <div style="margin-top: 12px;">
              ${topTools.length > 0 ? topTools.map((tool, idx) => {
                const successRate = parseFloat(tool.successRate);
                const successColor = successRate >= 90 ? '#0c0' : successRate >= 70 ? '#ffa500' : '#ff6b6b';
                return `
                  <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666; font-size: 0.85em;">#${idx + 1}</span>
                        <strong>${tool.name}</strong>
                      </div>
                      <span style="font-size: 0.85em; color: #888;">${tool.totalCalls} calls</span>
                    </div>
                    <div style="display: flex; gap: 12px; font-size: 0.85em;">
                      <span style="color: ${successColor};">Success: ${tool.successRate}%</span>
                      <span style="color: #aaa;">Avg: ${tool.avgDurationMs}ms</span>
                    </div>
                  </div>
                `;
              }).join('') : '<div style="color: #888; font-style: italic;">No tools used yet</div>'}
            </div>

            <h3 style="margin-top: 20px;">⌇ Top 5 Slowest Tools</h3>
            <div style="margin-top: 12px;">
              ${slowestTools.length > 0 ? slowestTools.map((tool, idx) => {
                const avgDuration = parseFloat(tool.avgDurationMs);
                const durationColor = avgDuration > 1000 ? '#ff6b6b' : avgDuration > 500 ? '#ffa500' : '#0c0';
                return `
                  <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span style="color: #666; font-size: 0.85em;">#${idx + 1}</span>
                          <strong>${tool.name}</strong>
                        </div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-weight: bold; color: ${durationColor};">${tool.avgDurationMs}ms</div>
                        <div style="font-size: 0.8em; color: #666;">max: ${tool.maxDuration}ms</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('') : '<div style="color: #888; font-style: italic;">No data available</div>'}
            </div>

            ${problematicTools.length > 0 ? `
              <h3 style="margin-top: 20px;">⚠️ Tools with Errors</h3>
              <div style="margin-top: 12px;">
                ${problematicTools.map(tool => {
                  const recentError = tool.errors[tool.errors.length - 1];
                  const errorMsg = recentError ? recentError.message : 'No error details';
                  return `
                    <div style="padding: 8px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff6b6b; border-radius: 4px; margin-bottom: 6px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <strong style="color: #ff6b6b;">${tool.name}</strong>
                        <span style="font-size: 0.85em; color: #ff6b6b;">${tool.errorRate}% error rate</span>
                      </div>
                      <div style="font-size: 0.85em; color: #888;">
                        ${tool.failedCalls} failures • Last: ${errorMsg.substring(0, 60)}${errorMsg.length > 60 ? '...' : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
              <strong>☱ Session Info</strong>
              <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                Duration: ${sessionMins} minutes<br>
                Tools tracked: ${analytics.totalTools}<br>
                Total executions: ${totalCalls}
              </div>
            </div>
          </div>
        `;

        // Attach event listeners
        this.shadowRoot.getElementById('reset-btn')?.addEventListener('click', () => {
          reset();
          logger.info('[ToolAnalytics] Widget: Analytics reset');
          this.render();
        });

        this.shadowRoot.getElementById('report-btn')?.addEventListener('click', () => {
          const report = generateReport();
          console.log(report);
          logger.info('[ToolAnalytics] Widget: Report generated (see console)');
        });
      }
    }

    // Register custom element
    const elementName = 'tool-analytics-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ToolAnalyticsWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Tool Analytics',
      icon: '☱',
      category: 'analytics',
      updateInterval: 5000
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
      },
      widget
    };
  }
};

// Export
export default ToolAnalytics;
