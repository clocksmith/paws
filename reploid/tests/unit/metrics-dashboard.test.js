import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('MetricsDashboard Module', () => {
  let MetricsDashboard;
  let mockDeps;
  let dashboardInstance;
  let mockContainer;
  let mockChart;
  let mockChartInstances;
  let mockCanvas;

  beforeEach(() => {
    // Reset chart instances
    mockChartInstances = [];

    // Mock Chart.js
    mockChart = vi.fn().mockImplementation((ctx, config) => {
      const instance = {
        data: config.data,
        options: config.options,
        type: config.type,
        update: vi.fn(),
        destroy: vi.fn(),
        _ctx: ctx
      };
      mockChartInstances.push(instance);
      return instance;
    });

    global.Chart = mockChart;

    // Mock canvas elements
    mockCanvas = {
      getContext: vi.fn(() => ({
        canvas: mockCanvas,
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        fillText: vi.fn()
      }))
    };

    // Mock document methods
    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'memory-chart' || id === 'tools-chart' || id === 'tokens-chart') {
          return mockCanvas;
        }
        return null;
      })
    };

    // Mock container element
    mockContainer = {
      insertAdjacentHTML: vi.fn()
    };

    // Mock PerformanceMonitor
    const mockPerformanceMonitor = {
      getMemoryStats: vi.fn(() => ({
        current: {
          usedJSHeapSize: 50000000,
          jsHeapSizeLimit: 2172649472
        },
        max: 75000000,
        min: 25000000,
        history: [
          { usedJSHeapSize: 40000000 },
          { usedJSHeapSize: 45000000 },
          { usedJSHeapSize: 50000000 }
        ]
      })),
      getMetrics: vi.fn(() => ({
        tools: {
          'read': { calls: 25, totalTime: 5000 },
          'write': { calls: 15, totalTime: 3000 },
          'edit': { calls: 10, totalTime: 2000 },
          'grep': { calls: 8, totalTime: 1600 },
          'glob': { calls: 5, totalTime: 1000 }
        },
        session: {
          uptime: 123456
        }
      })),
      getLLMStats: vi.fn(() => ({
        calls: 50,
        tokens: {
          input: 10000,
          output: 5000,
          total: 15000
        },
        avgLatency: 1234,
        errorRate: 0.02
      }))
    };

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      },
      PerformanceMonitor: mockPerformanceMonitor
    };

    // Define MetricsDashboard module
    MetricsDashboard = {
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

        let memoryChart = null;
        let toolsChart = null;
        let tokensChart = null;

        const init = (container) => {
          if (!container) {
            logger.warn('[MetricsDashboard] No container provided');
            return;
          }

          if (typeof Chart === 'undefined') {
            logger.error('[MetricsDashboard] Chart.js not loaded');
            return;
          }

          logger.info('[MetricsDashboard] Initializing metrics dashboard');

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

          initMemoryChart();
          initToolsChart();
          initTokensChart();

          setInterval(() => {
            updateCharts();
          }, 5000);
        };

        const initMemoryChart = () => {
          const canvas = document.getElementById('memory-chart');
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          const memStats = PerformanceMonitor.getMemoryStats();

          if (!memStats || !memStats.history) {
            logger.warn('[MetricsDashboard] No memory history available');
            return;
          }

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

        const initToolsChart = () => {
          const canvas = document.getElementById('tools-chart');
          if (!canvas) return;

          const ctx = canvas.getContext('2d');
          const metrics = PerformanceMonitor.getMetrics();

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

        const updateCharts = () => {
          const metrics = PerformanceMonitor.getMetrics();
          const memStats = PerformanceMonitor.getMemoryStats();
          const llmStats = PerformanceMonitor.getLLMStats();

          if (memoryChart && memStats && memStats.history) {
            const labels = memStats.history.map((_, i) => `${i * 30}s`);
            const data = memStats.history.map(s => (s.usedJSHeapSize / 1024 / 1024).toFixed(2));

            memoryChart.data.labels = labels;
            memoryChart.data.datasets[0].data = data;
            memoryChart.update('none');
          }

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

          if (tokensChart) {
            tokensChart.data.datasets[0].data = [llmStats.tokens.input, llmStats.tokens.output];
            tokensChart.update('none');
          }

          logger.debug('[MetricsDashboard] Charts updated');
        };

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

    dashboardInstance = MetricsDashboard.factory(mockDeps);
  });

  afterEach(() => {
    delete global.Chart;
    delete global.document;
    vi.clearAllTimers();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(MetricsDashboard.metadata.id).toBe('MetricsDashboard');
      expect(MetricsDashboard.metadata.version).toBe('1.0.0');
      expect(MetricsDashboard.metadata.type).toBe('ui');
    });

    it('should declare required dependencies', () => {
      expect(MetricsDashboard.metadata.dependencies).toContain('Utils');
      expect(MetricsDashboard.metadata.dependencies).toContain('PerformanceMonitor');
    });

    it('should be synchronous', () => {
      expect(MetricsDashboard.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with valid container and Chart.js', () => {
      dashboardInstance.api.init(mockContainer);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing metrics dashboard')
      );
    });

    it('should warn when container is missing', () => {
      dashboardInstance.api.init(null);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No container provided')
      );
    });

    it('should error when Chart.js is not loaded', () => {
      delete global.Chart;
      dashboardInstance.api.init(mockContainer);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Chart.js not loaded')
      );
    });

    it('should inject HTML for charts', () => {
      dashboardInstance.api.init(mockContainer);

      expect(mockContainer.insertAdjacentHTML).toHaveBeenCalledWith(
        'beforeend',
        expect.stringContaining('charts-grid')
      );
      expect(mockContainer.insertAdjacentHTML).toHaveBeenCalledWith(
        'beforeend',
        expect.stringContaining('memory-chart')
      );
      expect(mockContainer.insertAdjacentHTML).toHaveBeenCalledWith(
        'beforeend',
        expect.stringContaining('tools-chart')
      );
      expect(mockContainer.insertAdjacentHTML).toHaveBeenCalledWith(
        'beforeend',
        expect.stringContaining('tokens-chart')
      );
    });

    it('should create three chart instances', () => {
      dashboardInstance.api.init(mockContainer);

      expect(mockChartInstances).toHaveLength(3);
    });

    it('should set up auto-refresh interval', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      dashboardInstance.api.init(mockContainer);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      vi.useRealTimers();
    });
  });

  describe('Memory Chart', () => {
    it('should create line chart for memory usage', () => {
      dashboardInstance.api.init(mockContainer);

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      expect(memoryChart).toBeDefined();
      expect(memoryChart.data.datasets[0].label).toBe('Memory Usage (MB)');
    });

    it('should use memory history data', () => {
      dashboardInstance.api.init(mockContainer);

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      expect(memoryChart.data.labels).toHaveLength(3);
      expect(memoryChart.data.datasets[0].data).toHaveLength(3);
    });

    it('should convert bytes to MB', () => {
      dashboardInstance.api.init(mockContainer);

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      const firstValue = parseFloat(memoryChart.data.datasets[0].data[0]);
      expect(firstValue).toBeCloseTo(38.15, 1); // 40000000 bytes / 1024 / 1024
    });

    it('should warn when no memory history available', () => {
      mockDeps.PerformanceMonitor.getMemoryStats.mockReturnValue({
        current: { usedJSHeapSize: 50000000 }
      });

      dashboardInstance.api.init(mockContainer);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No memory history available')
      );
    });

    it('should configure chart with responsive options', () => {
      dashboardInstance.api.init(mockContainer);

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      expect(memoryChart.options.responsive).toBe(true);
      expect(memoryChart.options.maintainAspectRatio).toBe(false);
    });

    it('should style with cyan colors', () => {
      dashboardInstance.api.init(mockContainer);

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      expect(memoryChart.data.datasets[0].borderColor).toBe('rgba(0, 255, 255, 0.8)');
      expect(memoryChart.data.datasets[0].backgroundColor).toBe('rgba(0, 255, 255, 0.1)');
    });

    it('should handle missing canvas element', () => {
      global.document.getElementById = vi.fn(() => null);

      expect(() => dashboardInstance.api.init(mockContainer)).not.toThrow();
    });
  });

  describe('Tools Chart', () => {
    it('should create bar chart for tool usage', () => {
      dashboardInstance.api.init(mockContainer);

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      expect(toolsChart).toBeDefined();
      expect(toolsChart.data.datasets[0].label).toBe('Call Count');
    });

    it('should show top 10 tools by call count', () => {
      dashboardInstance.api.init(mockContainer);

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      expect(toolsChart.data.labels.length).toBeLessThanOrEqual(10);
    });

    it('should sort tools by call count descending', () => {
      dashboardInstance.api.init(mockContainer);

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      const callCounts = toolsChart.data.datasets[0].data;

      for (let i = 1; i < callCounts.length; i++) {
        expect(callCounts[i]).toBeLessThanOrEqual(callCounts[i - 1]);
      }
    });

    it('should truncate long tool names', () => {
      mockDeps.PerformanceMonitor.getMetrics.mockReturnValue({
        tools: {
          'very_long_tool_name_that_exceeds_twenty_characters': { calls: 10, totalTime: 1000 }
        },
        session: { uptime: 123456 }
      });

      dashboardInstance.api.init(mockContainer);

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      expect(toolsChart.data.labels[0]).toContain('...');
      expect(toolsChart.data.labels[0].length).toBeLessThanOrEqual(23);
    });

    it('should configure rotated x-axis labels', () => {
      dashboardInstance.api.init(mockContainer);

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      expect(toolsChart.options.scales.x.ticks.maxRotation).toBe(45);
      expect(toolsChart.options.scales.x.ticks.minRotation).toBe(45);
    });
  });

  describe('Tokens Chart', () => {
    it('should create doughnut chart for token usage', () => {
      dashboardInstance.api.init(mockContainer);

      const tokensChart = mockChartInstances.find(c => c.type === 'doughnut');
      expect(tokensChart).toBeDefined();
    });

    it('should show input and output tokens', () => {
      dashboardInstance.api.init(mockContainer);

      const tokensChart = mockChartInstances.find(c => c.type === 'doughnut');
      expect(tokensChart.data.labels).toEqual(['Input Tokens', 'Output Tokens']);
      expect(tokensChart.data.datasets[0].data).toEqual([10000, 5000]);
    });

    it('should use cyan and magenta colors', () => {
      dashboardInstance.api.init(mockContainer);

      const tokensChart = mockChartInstances.find(c => c.type === 'doughnut');
      expect(tokensChart.data.datasets[0].backgroundColor).toContain('rgba(0, 255, 255, 0.6)');
      expect(tokensChart.data.datasets[0].backgroundColor).toContain('rgba(255, 0, 255, 0.6)');
    });

    it('should position legend at bottom', () => {
      dashboardInstance.api.init(mockContainer);

      const tokensChart = mockChartInstances.find(c => c.type === 'doughnut');
      expect(tokensChart.options.plugins.legend.position).toBe('bottom');
    });
  });

  describe('Chart Updates', () => {
    beforeEach(() => {
      dashboardInstance.api.init(mockContainer);
    });

    it('should update all charts with latest data', () => {
      dashboardInstance.api.updateCharts();

      mockChartInstances.forEach(chart => {
        expect(chart.update).toHaveBeenCalledWith('none');
      });
    });

    it('should update memory chart data', () => {
      mockDeps.PerformanceMonitor.getMemoryStats.mockReturnValue({
        current: { usedJSHeapSize: 60000000, jsHeapSizeLimit: 2172649472 },
        max: 75000000,
        history: [
          { usedJSHeapSize: 55000000 },
          { usedJSHeapSize: 60000000 }
        ]
      });

      dashboardInstance.api.updateCharts();

      const memoryChart = mockChartInstances.find(c => c.type === 'line');
      expect(memoryChart.data.datasets[0].data).toHaveLength(2);
      expect(memoryChart.update).toHaveBeenCalled();
    });

    it('should update tools chart data', () => {
      mockDeps.PerformanceMonitor.getMetrics.mockReturnValue({
        tools: {
          'new_tool': { calls: 30, totalTime: 6000 }
        },
        session: { uptime: 200000 }
      });

      dashboardInstance.api.updateCharts();

      const toolsChart = mockChartInstances.find(c => c.type === 'bar');
      expect(toolsChart.data.labels).toContain('new_tool');
      expect(toolsChart.update).toHaveBeenCalled();
    });

    it('should update tokens chart data', () => {
      mockDeps.PerformanceMonitor.getLLMStats.mockReturnValue({
        calls: 100,
        tokens: {
          input: 20000,
          output: 10000,
          total: 30000
        },
        avgLatency: 1500,
        errorRate: 0.03
      });

      dashboardInstance.api.updateCharts();

      const tokensChart = mockChartInstances.find(c => c.type === 'doughnut');
      expect(tokensChart.data.datasets[0].data).toEqual([20000, 10000]);
      expect(tokensChart.update).toHaveBeenCalled();
    });

    it('should use no animation for performance', () => {
      dashboardInstance.api.updateCharts();

      mockChartInstances.forEach(chart => {
        expect(chart.update).toHaveBeenCalledWith('none');
      });
    });

    it('should log debug message on update', () => {
      dashboardInstance.api.updateCharts();

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Charts updated')
      );
    });

    it('should handle missing chart instances gracefully', () => {
      const emptyDashboard = MetricsDashboard.factory(mockDeps);
      expect(() => emptyDashboard.api.updateCharts()).not.toThrow();
    });
  });

  describe('Destroy', () => {
    it('should destroy all chart instances', () => {
      dashboardInstance.api.init(mockContainer);
      dashboardInstance.api.destroy();

      mockChartInstances.forEach(chart => {
        expect(chart.destroy).toHaveBeenCalled();
      });
    });

    it('should log destroy message', () => {
      dashboardInstance.api.init(mockContainer);
      dashboardInstance.api.destroy();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Destroyed')
      );
    });

    it('should handle destroy when not initialized', () => {
      expect(() => dashboardInstance.api.destroy()).not.toThrow();
    });

    it('should null out chart references', () => {
      dashboardInstance.api.init(mockContainer);
      dashboardInstance.api.destroy();

      // Should not throw when destroying again
      expect(() => dashboardInstance.api.destroy()).not.toThrow();
    });
  });

  describe('Summary Generation', () => {
    it('should generate markdown summary', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('# Metrics Dashboard Summary');
      expect(summary).toContain('## LLM Usage');
      expect(summary).toContain('## Memory');
      expect(summary).toContain('## Top Tools');
    });

    it('should format uptime correctly', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('**Session Uptime:** 2m 3s');
    });

    it('should include LLM statistics', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('**Total Calls:** 50');
      expect(summary).toContain('**Total Tokens:** 15,000');
      expect(summary).toContain('**Avg Latency:** 1234ms');
      expect(summary).toContain('**Error Rate:** 2.0%');
    });

    it('should include memory statistics', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('**Current:** 47.68 MB');
      expect(summary).toContain('**Peak:** 71.53 MB');
      expect(summary).toContain('**Limit:** 2072 MB');
    });

    it('should list top 5 tools', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('**read:** 25 calls');
      expect(summary).toContain('**write:** 15 calls');
      expect(summary).toContain('**edit:** 10 calls');
      expect(summary).toContain('**grep:** 8 calls');
      expect(summary).toContain('**glob:** 5 calls');
    });

    it('should calculate average tool time', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('(200.0ms avg)'); // 5000/25 for 'read'
    });

    it('should format token numbers with locale', () => {
      mockDeps.PerformanceMonitor.getLLMStats.mockReturnValue({
        calls: 100,
        tokens: {
          input: 1000000,
          output: 500000,
          total: 1500000
        },
        avgLatency: 1500,
        errorRate: 0.01
      });

      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('1,500,000');
    });

    it('should handle long uptime values', () => {
      mockDeps.PerformanceMonitor.getMetrics.mockReturnValue({
        tools: {},
        session: { uptime: 3723456 } // 62 minutes, 3 seconds
      });

      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toContain('**Session Uptime:** 62m 3s');
    });

    it('should trim whitespace from summary', () => {
      const summary = dashboardInstance.api.generateSummary();

      expect(summary).toBe(summary.trim());
    });
  });

  describe('Auto-Refresh', () => {
    it('should set up 5-second interval', () => {
      vi.useFakeTimers();
      const setIntervalSpy = vi.spyOn(global, 'setInterval');

      dashboardInstance.api.init(mockContainer);

      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);

      vi.useRealTimers();
    });

    it('should call updateCharts on interval', () => {
      vi.useFakeTimers();

      dashboardInstance.api.init(mockContainer);
      const updateSpy = vi.spyOn(dashboardInstance.api, 'updateCharts');

      vi.advanceTimersByTime(5000);

      expect(updateSpy).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should continue updating on subsequent intervals', () => {
      vi.useFakeTimers();

      dashboardInstance.api.init(mockContainer);
      const updateSpy = vi.spyOn(dashboardInstance.api, 'updateCharts');

      vi.advanceTimersByTime(15000); // 3 intervals

      expect(updateSpy).toHaveBeenCalledTimes(3);

      vi.useRealTimers();
    });
  });

  describe('Chart Configuration', () => {
    it('should use dark theme colors', () => {
      dashboardInstance.api.init(mockContainer);

      mockChartInstances.forEach(chart => {
        if (chart.options.plugins?.legend?.labels) {
          expect(chart.options.plugins.legend.labels.color).toBe('#e0e0e0');
        }
        if (chart.options.scales?.y?.ticks) {
          expect(chart.options.scales.y.ticks.color).toBe('#aaa');
        }
        if (chart.options.scales?.x?.ticks) {
          expect(chart.options.scales.x.ticks.color).toBe('#aaa');
        }
      });
    });

    it('should configure grid colors', () => {
      dashboardInstance.api.init(mockContainer);

      const lineChart = mockChartInstances.find(c => c.type === 'line');
      expect(lineChart.options.scales.y.grid.color).toBe('rgba(255, 255, 255, 0.1)');
      expect(lineChart.options.scales.x.grid.color).toBe('rgba(255, 255, 255, 0.1)');
    });

    it('should set y-axis to begin at zero', () => {
      dashboardInstance.api.init(mockContainer);

      const chartsWithYAxis = mockChartInstances.filter(c => c.type !== 'doughnut');
      chartsWithYAxis.forEach(chart => {
        expect(chart.options.scales.y.beginAtZero).toBe(true);
      });
    });
  });
});
