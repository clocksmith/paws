// @blueprint 0x000026 - Outlines the performance monitoring metrics stack.
// Performance Monitor Module for REPLOID - RSI-5
// Tracks tool runtime, state changes, memory, and LLM API usage for data-driven self-optimization

const PerformanceMonitor = {
  metadata: {
    id: 'PerformanceMonitor',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'monitoring'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    // Storage for metrics
    const metrics = {
      tools: {},           // { toolName: { calls: N, totalTime: ms, errors: N, lastCall: timestamp } }
      states: {},          // { stateName: { entries: N, totalTime: ms, lastEntry: timestamp } }
      llm: {               // LLM API usage
        calls: 0,
        tokens: { input: 0, output: 0, total: 0 },
        latency: [],       // Array of latency values for statistical analysis
        errors: 0,
        lastCall: null
      },
      memory: [],          // Array of { timestamp, usedJSHeapSize, totalJSHeapSize }
      session: {
        startTime: Date.now(),
        cycles: 0,
        artifacts: { created: 0, modified: 0, deleted: 0 }
      }
    };

    // Active timers
    const activeTimers = new Map();

    // Initialize
    const init = () => {
      logger.info('[PerformanceMonitor] Initializing performance tracking');

      // Listen to tool execution events
      EventBus.on('tool:start', handleToolStart);
      EventBus.on('tool:end', handleToolEnd);
      EventBus.on('tool:error', handleToolError);

      // Listen to state transition events
      EventBus.on('agent:state:change', handleStateChange);
      EventBus.on('agent:state:exit', handleStateExit);

      // Listen to LLM API events
      EventBus.on('api:request:start', handleApiRequestStart);
      EventBus.on('api:request:end', handleApiRequestEnd);
      EventBus.on('api:request:error', handleApiError);

      // Listen to artifact events
      EventBus.on('artifact:created', () => metrics.session.artifacts.created++);
      EventBus.on('artifact:updated', () => metrics.session.artifacts.modified++);
      EventBus.on('artifact:deleted', () => metrics.session.artifacts.deleted++);

      // Listen to cycle events
      EventBus.on('agent:cycle:start', () => metrics.session.cycles++);

      // Start memory sampling
      startMemorySampling();

      logger.info('[PerformanceMonitor] Initialized successfully');
    };

    // Tool tracking
    const handleToolStart = ({ toolName, timestamp }) => {
      const startTime = timestamp || Date.now();
      activeTimers.set(`tool:${toolName}`, startTime);

      if (!metrics.tools[toolName]) {
        metrics.tools[toolName] = {
          calls: 0,
          totalTime: 0,
          errors: 0,
          lastCall: null
        };
      }
    };

    const handleToolEnd = ({ toolName, timestamp }) => {
      const endTime = timestamp || Date.now();
      const timerKey = `tool:${toolName}`;
      const startTime = activeTimers.get(timerKey);

      if (startTime && metrics.tools[toolName]) {
        const duration = endTime - startTime;
        metrics.tools[toolName].calls++;
        metrics.tools[toolName].totalTime += duration;
        metrics.tools[toolName].lastCall = endTime;
        activeTimers.delete(timerKey);
      }
    };

    const handleToolError = ({ toolName, error }) => {
      if (metrics.tools[toolName]) {
        metrics.tools[toolName].errors++;
      }
      logger.warn(`[PerformanceMonitor] Tool error: ${toolName}`, { error });
    };

    // State tracking
    const handleStateChange = ({ newState, timestamp }) => {
      const startTime = timestamp || Date.now();
      activeTimers.set(`state:${newState}`, startTime);

      if (!metrics.states[newState]) {
        metrics.states[newState] = {
          entries: 0,
          totalTime: 0,
          lastEntry: null
        };
      }

      metrics.states[newState].entries++;
      metrics.states[newState].lastEntry = startTime;
    };

    const handleStateExit = ({ state, timestamp }) => {
      const exitTime = timestamp || Date.now();
      const timerKey = `state:${state}`;
      const startTime = activeTimers.get(timerKey);

      if (startTime && metrics.states[state]) {
        const duration = exitTime - startTime;
        metrics.states[state].totalTime += duration;
        activeTimers.delete(timerKey);
      }
    };

    // LLM API tracking
    const handleApiRequestStart = ({ requestId, timestamp }) => {
      const startTime = timestamp || Date.now();
      activeTimers.set(`api:${requestId}`, startTime);
    };

    const handleApiRequestEnd = ({ requestId, tokens, timestamp }) => {
      const endTime = timestamp || Date.now();
      const timerKey = `api:${requestId}`;
      const startTime = activeTimers.get(timerKey);

      if (startTime) {
        const latency = endTime - startTime;
        metrics.llm.latency.push(latency);
        activeTimers.delete(timerKey);
      }

      metrics.llm.calls++;
      if (tokens) {
        metrics.llm.tokens.input += tokens.input || 0;
        metrics.llm.tokens.output += tokens.output || 0;
        metrics.llm.tokens.total += (tokens.input || 0) + (tokens.output || 0);
      }
      metrics.llm.lastCall = endTime;
    };

    const handleApiError = ({ requestId, error }) => {
      metrics.llm.errors++;
      const timerKey = `api:${requestId}`;
      activeTimers.delete(timerKey);
      logger.warn(`[PerformanceMonitor] API error`, { error });
    };

    // Memory sampling
    const startMemorySampling = () => {
      // Sample memory every 30 seconds
      const sampleInterval = 30000;

      const sampleMemory = () => {
        if (performance.memory) {
          metrics.memory.push({
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          });

          // Keep only last 100 samples (~50 minutes)
          if (metrics.memory.length > 100) {
            metrics.memory.shift();
          }
        }
      };

      // Initial sample
      sampleMemory();

      // Periodic sampling
      setInterval(sampleMemory, sampleInterval);
    };

    // Get current metrics
    const getMetrics = () => {
      return {
        ...metrics,
        session: {
          ...metrics.session,
          uptime: Date.now() - metrics.session.startTime
        }
      };
    };

    // Get statistics for a specific tool
    const getToolStats = (toolName) => {
      const tool = metrics.tools[toolName];
      if (!tool) return null;

      return {
        ...tool,
        avgTime: tool.calls > 0 ? tool.totalTime / tool.calls : 0,
        errorRate: tool.calls > 0 ? tool.errors / tool.calls : 0
      };
    };

    // Get statistics for a specific state
    const getStateStats = (stateName) => {
      const state = metrics.states[stateName];
      if (!state) return null;

      return {
        ...state,
        avgTime: state.entries > 0 ? state.totalTime / state.entries : 0
      };
    };

    // Get LLM statistics
    const getLLMStats = () => {
      const latencies = metrics.llm.latency;
      let avgLatency = 0;
      let medianLatency = 0;
      let p95Latency = 0;

      if (latencies.length > 0) {
        avgLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;

        const sorted = [...latencies].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        medianLatency = sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];

        const p95Index = Math.floor(sorted.length * 0.95);
        p95Latency = sorted[p95Index] || sorted[sorted.length - 1];
      }

      return {
        ...metrics.llm,
        avgLatency,
        medianLatency,
        p95Latency,
        errorRate: metrics.llm.calls > 0 ? metrics.llm.errors / metrics.llm.calls : 0,
        avgTokensPerCall: metrics.llm.calls > 0 ? metrics.llm.tokens.total / metrics.llm.calls : 0
      };
    };

    // Get memory statistics
    const getMemoryStats = () => {
      if (metrics.memory.length === 0) return null;

      const latest = metrics.memory[metrics.memory.length - 1];
      const usedSizes = metrics.memory.map(m => m.usedJSHeapSize);
      const avgUsed = usedSizes.reduce((sum, val) => sum + val, 0) / usedSizes.length;
      const maxUsed = Math.max(...usedSizes);
      const minUsed = Math.min(...usedSizes);

      return {
        current: latest,
        avg: avgUsed,
        max: maxUsed,
        min: minUsed,
        samples: metrics.memory.length
      };
    };

    // Generate human-readable report
    const generateReport = () => {
      const uptime = Date.now() - metrics.session.startTime;
      const uptimeMinutes = Math.floor(uptime / 60000);
      const uptimeSeconds = Math.floor((uptime % 60000) / 1000);

      let report = `# REPLOID Performance Report\n\n`;
      report += `**Generated:** ${new Date().toISOString()}\n`;
      report += `**Uptime:** ${uptimeMinutes}m ${uptimeSeconds}s\n\n`;

      // Session stats
      report += `## Session Statistics\n\n`;
      report += `- **Cycles:** ${metrics.session.cycles}\n`;
      report += `- **Artifacts Created:** ${metrics.session.artifacts.created}\n`;
      report += `- **Artifacts Modified:** ${metrics.session.artifacts.modified}\n`;
      report += `- **Artifacts Deleted:** ${metrics.session.artifacts.deleted}\n\n`;

      // Tool stats
      if (Object.keys(metrics.tools).length > 0) {
        report += `## Tool Performance\n\n`;
        const toolStats = Object.entries(metrics.tools)
          .map(([name, data]) => ({
            name,
            ...getToolStats(name)
          }))
          .sort((a, b) => b.totalTime - a.totalTime);

        report += `| Tool | Calls | Avg Time | Total Time | Errors |\n`;
        report += `|------|-------|----------|------------|--------|\n`;
        toolStats.forEach(tool => {
          report += `| ${tool.name} | ${tool.calls} | ${tool.avgTime.toFixed(2)}ms | ${tool.totalTime.toFixed(2)}ms | ${tool.errors} |\n`;
        });
        report += `\n`;
      }

      // State stats
      if (Object.keys(metrics.states).length > 0) {
        report += `## State Performance\n\n`;
        const stateStats = Object.entries(metrics.states)
          .map(([name, data]) => ({
            name,
            ...getStateStats(name)
          }))
          .sort((a, b) => b.totalTime - a.totalTime);

        report += `| State | Entries | Avg Time | Total Time |\n`;
        report += `|-------|---------|----------|------------|\n`;
        stateStats.forEach(state => {
          report += `| ${state.name} | ${state.entries} | ${state.avgTime.toFixed(2)}ms | ${state.totalTime.toFixed(2)}ms |\n`;
        });
        report += `\n`;
      }

      // LLM stats
      const llmStats = getLLMStats();
      report += `## LLM API Performance\n\n`;
      report += `- **Total Calls:** ${llmStats.calls}\n`;
      report += `- **Total Tokens:** ${llmStats.tokens.total} (${llmStats.tokens.input} input, ${llmStats.tokens.output} output)\n`;
      report += `- **Avg Tokens/Call:** ${llmStats.avgTokensPerCall.toFixed(2)}\n`;
      report += `- **Avg Latency:** ${llmStats.avgLatency.toFixed(2)}ms\n`;
      report += `- **Median Latency:** ${llmStats.medianLatency.toFixed(2)}ms\n`;
      report += `- **P95 Latency:** ${llmStats.p95Latency.toFixed(2)}ms\n`;
      report += `- **Errors:** ${llmStats.errors} (${(llmStats.errorRate * 100).toFixed(2)}%)\n\n`;

      // Memory stats
      const memStats = getMemoryStats();
      if (memStats) {
        report += `## Memory Usage\n\n`;
        report += `- **Current:** ${(memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Average:** ${(memStats.avg / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Peak:** ${(memStats.max / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Min:** ${(memStats.min / 1024 / 1024).toFixed(2)} MB\n`;
        report += `- **Heap Limit:** ${(memStats.current.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB\n\n`;
      }

      report += `---\n\n*Generated by REPLOID Performance Monitor*\n`;

      return report;
    };

    // Reset metrics (for testing or new sessions)
    const reset = () => {
      metrics.tools = {};
      metrics.states = {};
      metrics.llm = {
        calls: 0,
        tokens: { input: 0, output: 0, total: 0 },
        latency: [],
        errors: 0,
        lastCall: null
      };
      metrics.memory = [];
      metrics.session = {
        startTime: Date.now(),
        cycles: 0,
        artifacts: { created: 0, modified: 0, deleted: 0 }
      };
      activeTimers.clear();
      logger.info('[PerformanceMonitor] Metrics reset');
    };

    // Web Component Widget
    class PerformanceMonitorWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          // Update every 2 seconds for real-time monitoring
          this._updateInterval = setInterval(() => this.render(), 2000);
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
          const memStats = getMemoryStats();
          const llmStats = getLLMStats();

          const currentMem = memStats.current
            ? (memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(0)
            : 0;

          let state = 'idle';
          if (activeTimers.size > 0) state = 'active';
          if (memStats.current && memStats.current.usedJSHeapSize > memStats.current.jsHeapSizeLimit * 0.9) {
            state = 'warning';
          }

          return {
            state,
            primaryMetric: `${currentMem} MB`,
            secondaryMetric: `${llmStats.calls} LLM calls`,
            lastActivity: llmStats.lastCall
          };
        }

        render() {
          const allMetrics = getMetrics();
          const memStats = getMemoryStats();
          const llmStats = getLLMStats();
          const toolStats = getToolStats();

          const formatBytes = (bytes) => {
            if (!bytes) return '0 B';
            const mb = bytes / 1024 / 1024;
            return `${mb.toFixed(2)} MB`;
          };

          const formatMs = (ms) => {
            if (!ms) return '0ms';
            return `${ms.toFixed(0)}ms`;
          };

          const sessionDuration = ((Date.now() - allMetrics.session.startTime) / 1000 / 60).toFixed(1);

          // Top tools by execution count
          const topTools = Object.entries(toolStats)
            .sort((a, b) => b[1].count - a[1].count)
            .slice(0, 5);

          this.shadowRoot.innerHTML = `
            <style>
              :host { display: block; font-family: monospace; font-size: 12px; }
              .widget-panel { padding: 12px; }
              h3 { margin: 0 0 12px 0; font-size: 1.1em; color: #fff; }
              h5 { margin: 16px 0 8px 0; font-size: 1em; color: #aaa; }
              .controls { display: flex; gap: 8px; margin-bottom: 12px; }
              button { padding: 6px 12px; background: rgba(100,150,255,0.2); border: 1px solid rgba(100,150,255,0.4); border-radius: 4px; color: #fff; cursor: pointer; font-size: 0.9em; }
              button:hover { background: rgba(100,150,255,0.3); }
              .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
              .stat-card { padding: 8px; background: rgba(100,150,255,0.1); border-radius: 4px; }
              .stat-label { font-size: 0.85em; color: #888; }
              .stat-value { font-size: 1.2em; font-weight: bold; margin-top: 4px; }
              .stat-row { display: flex; justify-content: space-between; padding: 4px 0; }
              table { width: 100%; border-collapse: collapse; }
              th, td { text-align: left; padding: 4px; }
              th { color: #888; font-size: 0.85em; }
              .memory-chart { display: flex; gap: 2px; height: 60px; align-items: flex-end; }
              .memory-bar { flex: 1; background: #6496ff; }
            </style>

            <div class="widget-panel">
              <h3>▤ Performance Monitor</h3>

              <div class="controls">
                <button id="reset-btn">↻ Reset</button>
                <button id="export-btn">▤ Export</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Memory Used</div>
                  <div class="stat-value">${formatBytes(memStats.current?.usedJSHeapSize)}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Memory Peak</div>
                  <div class="stat-value">${formatBytes(memStats.max)}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">LLM Calls</div>
                  <div class="stat-value">${llmStats.calls}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Session Time</div>
                  <div class="stat-value">${sessionDuration}m</div>
                </div>
              </div>

              <h5>LLM Statistics</h5>
              <div class="llm-stats">
                <div class="stat-row"><span class="stat-label">Total Tokens:</span> <span class="stat-value">${llmStats.tokens.total.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Input Tokens:</span> <span class="stat-value">${llmStats.tokens.input.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Output Tokens:</span> <span class="stat-value">${llmStats.tokens.output.toLocaleString()}</span></div>
                <div class="stat-row"><span class="stat-label">Avg Latency:</span> <span class="stat-value">${formatMs(llmStats.avgLatency)}</span></div>
                <div class="stat-row"><span class="stat-label">Errors:</span> <span class="stat-value">${llmStats.errors}</span></div>
              </div>

              <h5>Memory Trend</h5>
              <div class="memory-trend">
                ${memStats.history && memStats.history.length > 0 ? `
                  <div class="memory-chart">
                    ${memStats.history.slice(-20).map((snapshot, i) => {
                      const height = (snapshot.usedJSHeapSize / memStats.max) * 100;
                      return `<div class="memory-bar" style="height: ${height}%" title="${formatBytes(snapshot.usedJSHeapSize)}"></div>`;
                    }).join('')}
                  </div>
                  <div class="memory-stats">
                    <span>Min: ${formatBytes(memStats.min)}</span>
                    <span>Avg: ${formatBytes(memStats.avg)}</span>
                    <span>Max: ${formatBytes(memStats.max)}</span>
                  </div>
                ` : '<p>No memory data yet</p>'}
              </div>

              <h5>Most Used Tools</h5>
              <div class="tool-stats-table">
                <table>
                  <thead><tr><th>Tool</th><th>Count</th><th>Avg Time</th></tr></thead>
                  <tbody>
                    ${topTools.map(([tool, stats]) => `
                      <tr>
                        <td>${tool}</td>
                        <td>${stats.count}</td>
                        <td>${formatMs(stats.avgTime)}</td>
                      </tr>
                    `).join('') || '<tr><td colspan="3">No tool data yet</td></tr>'}
                  </tbody>
                </table>
              </div>

              <h5>Session Stats</h5>
              <div class="session-stats">
                <div class="stat-row"><span class="stat-label">Cycles:</span> <span class="stat-value">${allMetrics.session.cycles}</span></div>
                <div class="stat-row"><span class="stat-label">Artifacts Created:</span> <span class="stat-value">${allMetrics.session.artifacts.created}</span></div>
                <div class="stat-row"><span class="stat-label">Artifacts Modified:</span> <span class="stat-value">${allMetrics.session.artifacts.modified}</span></div>
                <div class="stat-row"><span class="stat-label">Active Timers:</span> <span class="stat-value">${activeTimers.size}</span></div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.getElementById('reset-btn')?.addEventListener('click', () => {
            reset();
            const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
            ToastNotifications?.show('Performance metrics reset', 'success');
            this.render();
          });

          this.shadowRoot.getElementById('export-btn')?.addEventListener('click', () => {
            const report = generateReport();
            const blob = new Blob([report], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `performance-report-${Date.now()}.md`;
            a.click();
            URL.revokeObjectURL(url);
            const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
            ToastNotifications?.show('Performance report exported', 'success');
          });
        }
      }

      // Register custom element
      const elementName = 'performance-monitor-widget';
      if (!customElements.get(elementName)) {
        customElements.define(elementName, PerformanceMonitorWidget);
      }

      const widget = {
        element: elementName,
        displayName: 'Performance Monitor',
        icon: '▤',
        category: 'analytics',
        updateInterval: 2000
      };

    return {
      init,
      api: {
        getMetrics,
        getToolStats,
        getStateStats,
        getLLMStats,
        getMemoryStats,
        generateReport,
        reset
      },
      widget
    };
  }
};

// Export standardized module
export default PerformanceMonitor;
