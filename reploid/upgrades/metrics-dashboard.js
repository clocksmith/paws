/**
 * @fileoverview Metrics Dashboard - Visual performance metrics with Chart.js
 * Extends PerformanceMonitor with interactive charts and visualizations
 *
 * @module MetricsDashboard
 * @version 1.0.0
 * @category ui
 * @requires Chart.js (loaded via CDN in HTML)
 */

const MetricsDashboard = {
  metadata: {
    id: 'MetricsDashboard',
    version: '1.0.0',
    dependencies: ['Utils', 'PerformanceMonitor'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, PerformanceMonitor } = deps;
    const { logger } = Utils;

    // Chart instances
    let memoryChart = null;
    let toolsChart = null;
    let tokensChart = null;

    /**
     * Initialize metrics dashboard with Chart.js
     * @param {HTMLElement} container - Container element for charts
     */
    const init = (container) => {
      if (!container) {
        logger.warn('[MetricsDashboard] No container provided');
        return;
      }

      // Check if Chart.js is loaded
      if (typeof Chart === 'undefined') {
        logger.error('[MetricsDashboard] Chart.js not loaded');
        return;
      }

      logger.info('[MetricsDashboard] Initializing metrics dashboard');

      // Create chart canvases
      const chartsHTML = `
        <div class="charts-grid">
          <div class="chart-container">
            <h4>Memory Usage Over Time</h4>
            <canvas id="memory-chart"></canvas>
          </div>
          <div class="chart-container">
            <h4>Tool Usage</h4>
            <canvas id="tools-chart"></canvas>
          </div>
          <div class="chart-container">
            <h4>LLM Token Usage</h4>
            <canvas id="tokens-chart"></canvas>
          </div>
        </div>
      `;

      container.insertAdjacentHTML('beforeend', chartsHTML);

      // Initialize charts
      initMemoryChart();
      initToolsChart();
      initTokensChart();

      // Auto-refresh every 5 seconds
      setInterval(() => {
        updateCharts();
      }, 5000);
    };

    /**
     * Initialize memory usage line chart
     */
    const initMemoryChart = () => {
      const canvas = document.getElementById('memory-chart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const memStats = PerformanceMonitor.getMemoryStats();

      if (!memStats || !memStats.history) {
        logger.warn('[MetricsDashboard] No memory history available');
        return;
      }

      // Prepare data from history
      const labels = memStats.history.map((_, i) => `${i * 30}s`);
      const data = memStats.history.map(s => (s.usedJSHeapSize / 1024 / 1024).toFixed(2));

      memoryChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Memory Usage (MB)',
            data,
            borderColor: 'rgba(0, 255, 255, 0.8)',
            backgroundColor: 'rgba(0, 255, 255, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#e0e0e0' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#aaa' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
              ticks: { color: '#aaa' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    };

    /**
     * Initialize tool usage bar chart
     */
    const initToolsChart = () => {
      const canvas = document.getElementById('tools-chart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const metrics = PerformanceMonitor.getMetrics();

      // Get top 10 tools by call count
      const toolData = Object.entries(metrics.tools)
        .map(([name, data]) => ({
          name: name.length > 20 ? name.substring(0, 20) + '...' : name,
          calls: data.calls
        }))
        .sort((a, b) => b.calls - a.calls)
        .slice(0, 10);

      toolsChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: toolData.map(t => t.name),
          datasets: [{
            label: 'Call Count',
            data: toolData.map(t => t.calls),
            backgroundColor: 'rgba(0, 255, 255, 0.6)',
            borderColor: 'rgba(0, 255, 255, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              labels: { color: '#e0e0e0' }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { color: '#aaa' },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            },
            x: {
              ticks: { color: '#aaa', maxRotation: 45, minRotation: 45 },
              grid: { color: 'rgba(255, 255, 255, 0.1)' }
            }
          }
        }
      });
    };

    /**
     * Initialize LLM token usage doughnut chart
     */
    const initTokensChart = () => {
      const canvas = document.getElementById('tokens-chart');
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      const llmStats = PerformanceMonitor.getLLMStats();

      tokensChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Input Tokens', 'Output Tokens'],
          datasets: [{
            data: [llmStats.tokens.input, llmStats.tokens.output],
            backgroundColor: [
              'rgba(0, 255, 255, 0.6)',
              'rgba(255, 0, 255, 0.6)'
            ],
            borderColor: [
              'rgba(0, 255, 255, 1)',
              'rgba(255, 0, 255, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: '#e0e0e0' }
            }
          }
        }
      });
    };

    /**
     * Update all charts with latest data
     */
    const updateCharts = () => {
      const metrics = PerformanceMonitor.getMetrics();
      const memStats = PerformanceMonitor.getMemoryStats();
      const llmStats = PerformanceMonitor.getLLMStats();

      // Update memory chart
      if (memoryChart && memStats && memStats.history) {
        const labels = memStats.history.map((_, i) => `${i * 30}s`);
        const data = memStats.history.map(s => (s.usedJSHeapSize / 1024 / 1024).toFixed(2));

        memoryChart.data.labels = labels;
        memoryChart.data.datasets[0].data = data;
        memoryChart.update('none'); // No animation for performance
      }

      // Update tools chart
      if (toolsChart) {
        const toolData = Object.entries(metrics.tools)
          .map(([name, data]) => ({
            name: name.length > 20 ? name.substring(0, 20) + '...' : name,
            calls: data.calls
          }))
          .sort((a, b) => b.calls - a.calls)
          .slice(0, 10);

        toolsChart.data.labels = toolData.map(t => t.name);
        toolsChart.data.datasets[0].data = toolData.map(t => t.calls);
        toolsChart.update('none');
      }

      // Update tokens chart
      if (tokensChart) {
        tokensChart.data.datasets[0].data = [llmStats.tokens.input, llmStats.tokens.output];
        tokensChart.update('none');
      }

      logger.debug('[MetricsDashboard] Charts updated');
    };

    /**
     * Destroy all charts and clean up
     */
    const destroy = () => {
      if (memoryChart) {
        memoryChart.destroy();
        memoryChart = null;
      }
      if (toolsChart) {
        toolsChart.destroy();
        toolsChart = null;
      }
      if (tokensChart) {
        tokensChart.destroy();
        tokensChart = null;
      }
      logger.info('[MetricsDashboard] Destroyed');
    };

    /**
     * Generate metrics dashboard summary
     * @returns {string} Markdown summary
     */
    const generateSummary = () => {
      const metrics = PerformanceMonitor.getMetrics();
      const llmStats = PerformanceMonitor.getLLMStats();
      const memStats = PerformanceMonitor.getMemoryStats();

      const uptime = metrics.session.uptime;
      const uptimeMin = Math.floor(uptime / 60000);
      const uptimeSec = Math.floor((uptime % 60000) / 1000);

      return `
# Metrics Dashboard Summary

**Session Uptime:** ${uptimeMin}m ${uptimeSec}s

## LLM Usage
- **Total Calls:** ${llmStats.calls}
- **Total Tokens:** ${llmStats.tokens.total.toLocaleString()}
- **Avg Latency:** ${llmStats.avgLatency.toFixed(0)}ms
- **Error Rate:** ${(llmStats.errorRate * 100).toFixed(1)}%

## Memory
- **Current:** ${(memStats.current.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB
- **Peak:** ${(memStats.max / 1024 / 1024).toFixed(2)} MB
- **Limit:** ${(memStats.current.jsHeapSizeLimit / 1024 / 1024).toFixed(0)} MB

## Top Tools
${Object.entries(metrics.tools)
  .sort((a, b) => b[1].calls - a[1].calls)
  .slice(0, 5)
  .map(([name, data]) => `- **${name}:** ${data.calls} calls (${(data.totalTime / data.calls).toFixed(1)}ms avg)`)
  .join('\n')}
      `.trim();
    };

    return {
      api: {
        init,
        updateCharts,
        destroy,
        generateSummary
      }
    };
  }
};

// Export for module loader
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MetricsDashboard;
}
MetricsDashboard;
