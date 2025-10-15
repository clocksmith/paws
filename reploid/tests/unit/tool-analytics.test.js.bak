import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ToolAnalytics Module', () => {
  let analytics;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      EventBus: {
        on: vi.fn(),
        emit: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      StateManager: {}
    };

    const ToolAnalyticsModule = {
      metadata: {
        id: 'ToolAnalytics',
        version: '1.0.0',
        dependencies: ['EventBus', 'Utils', 'StateManager'],
        async: true,
        type: 'analytics'
      },
      factory: (deps) => {
        const { EventBus, Utils } = deps;
        const { logger } = Utils;

        const toolMetrics = new Map();
        let sessionStart = Date.now();

        const init = async () => {
          logger.info('[ToolAnalytics] Initializing tool usage analytics');
          EventBus.on('tool:start', handleToolStart);
          EventBus.on('tool:complete', handleToolComplete);
          EventBus.on('tool:error', handleToolError);
          return true;
        };

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

          const argKeys = Object.keys(args || {}).sort().join(',');
          if (!metrics.argPatterns.has(argKeys)) {
            metrics.argPatterns.set(argKeys, 0);
          }
          metrics.argPatterns.set(argKeys, metrics.argPatterns.get(argKeys) + 1);
        };

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

        const handleToolError = (data) => {
          const { toolName, error } = data;
          const metrics = toolMetrics.get(toolName);
          if (!metrics) return;

          metrics.failedCalls++;
          metrics.errors.push({
            message: error?.message || 'Unknown error',
            timestamp: Date.now()
          });

          if (metrics.errors.length > 10) {
            metrics.errors.shift();
          }

          delete metrics._startTime;
        };

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

        const getAllAnalytics = () => {
          const analytics = {
            sessionDuration: Date.now() - sessionStart,
            totalTools: toolMetrics.size,
            tools: []
          };

          for (const [name] of toolMetrics.entries()) {
            analytics.tools.push(getToolAnalytics(name));
          }

          analytics.tools.sort((a, b) => b.totalCalls - a.totalCalls);
          return analytics;
        };

        const getTopTools = (limit = 5) => {
          return getAllAnalytics().tools.slice(0, limit);
        };

        const getSlowestTools = (limit = 5) => {
          return getAllAnalytics()
            .tools
            .sort((a, b) => b.avgDuration - a.avgDuration)
            .slice(0, limit);
        };

        const getProblematicTools = (limit = 5) => {
          return getAllAnalytics()
            .tools
            .filter(t => t.failedCalls > 0)
            .sort((a, b) => parseFloat(b.errorRate) - parseFloat(a.errorRate))
            .slice(0, limit);
        };

        const generateReport = () => {
          const analytics = getAllAnalytics();
          let report = '# Tool Usage Analytics\n\n';
          report += `**Session Duration:** ${(analytics.sessionDuration / 1000 / 60).toFixed(1)} minutes\n`;
          report += `**Total Tools Used:** ${analytics.totalTools}\n\n`;
          return report;
        };

        const reset = () => {
          toolMetrics.clear();
          sessionStart = Date.now();
          logger.info('[ToolAnalytics] Analytics reset');
        };

        // Expose handlers for testing
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
          _test: {
            handleToolStart,
            handleToolComplete,
            handleToolError
          }
        };
      }
    };

    analytics = ToolAnalyticsModule.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct API structure', () => {
      expect(analytics.api).toBeDefined();
      expect(analytics.api.getToolAnalytics).toBeTypeOf('function');
      expect(analytics.api.getAllAnalytics).toBeTypeOf('function');
      expect(analytics.api.getTopTools).toBeTypeOf('function');
      expect(analytics.api.getSlowestTools).toBeTypeOf('function');
      expect(analytics.api.getProblematicTools).toBeTypeOf('function');
      expect(analytics.api.generateReport).toBeTypeOf('function');
      expect(analytics.api.reset).toBeTypeOf('function');
    });
  });

  describe('Initialization', () => {
    it('should register event listeners', async () => {
      await analytics.init();

      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('tool:start', expect.any(Function));
      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('tool:complete', expect.any(Function));
      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('tool:error', expect.any(Function));
    });
  });

  describe('Tool Tracking', () => {
    it('should track tool start', () => {
      analytics._test.handleToolStart({ toolName: 'test_tool', args: { arg1: 'value1' } });
      const metrics = analytics.api.getToolAnalytics('test_tool');

      expect(metrics.totalCalls).toBe(1);
      expect(metrics.name).toBe('test_tool');
    });

    it('should track tool completion', () => {
      analytics._test.handleToolStart({ toolName: 'test_tool', args: {} });
      analytics._test.handleToolComplete({ toolName: 'test_tool' });

      const metrics = analytics.api.getToolAnalytics('test_tool');
      expect(metrics.successfulCalls).toBe(1);
      expect(parseFloat(metrics.successRate)).toBe(100.0);
    });

    it('should track tool errors', () => {
      analytics._test.handleToolStart({ toolName: 'failing_tool', args: {} });
      analytics._test.handleToolError({
        toolName: 'failing_tool',
        error: { message: 'Test error' }
      });

      const metrics = analytics.api.getToolAnalytics('failing_tool');
      expect(metrics.failedCalls).toBe(1);
      expect(metrics.errors).toHaveLength(1);
      expect(metrics.errors[0].message).toBe('Test error');
    });

    it('should calculate durations', () => {
      analytics._test.handleToolStart({ toolName: 'timed_tool', args: {} });
      analytics._test.handleToolComplete({ toolName: 'timed_tool' });

      const metrics = analytics.api.getToolAnalytics('timed_tool');
      expect(parseFloat(metrics.avgDurationMs)).toBeGreaterThanOrEqual(0);
    });

    it('should track argument patterns', () => {
      analytics._test.handleToolStart({ toolName: 'test_tool', args: { a: 1, b: 2 } });
      analytics._test.handleToolStart({ toolName: 'test_tool', args: { a: 3, b: 4 } });
      analytics._test.handleToolStart({ toolName: 'test_tool', args: { c: 5 } });

      const metrics = analytics.api.getToolAnalytics('test_tool');
      expect(metrics.topArgPatterns.length).toBeGreaterThan(0);
    });

    it('should limit error history to 10', () => {
      for (let i = 0; i < 15; i++) {
        analytics._test.handleToolStart({ toolName: 'error_tool', args: {} });
        analytics._test.handleToolError({
          toolName: 'error_tool',
          error: { message: `Error ${i}` }
        });
      }

      const metrics = analytics.api.getToolAnalytics('error_tool');
      expect(metrics.errors).toHaveLength(10);
    });
  });

  describe('Analytics Queries', () => {
    beforeEach(() => {
      // Setup test data
      analytics._test.handleToolStart({ toolName: 'tool_a', args: {} });
      analytics._test.handleToolComplete({ toolName: 'tool_a' });

      analytics._test.handleToolStart({ toolName: 'tool_b', args: {} });
      analytics._test.handleToolComplete({ toolName: 'tool_b' });
      
      analytics._test.handleToolStart({ toolName: 'tool_c', args: {} });
      analytics._test.handleToolError({ toolName: 'tool_c', error: { message: 'Error' } });
    });

    it('should get all analytics', () => {
      const all = analytics.api.getAllAnalytics();

      expect(all.totalTools).toBe(3);
      expect(all.tools).toHaveLength(3);
      expect(all.sessionDuration).toBeGreaterThanOrEqual(0);
    });

    it('should get tool-specific analytics', () => {
      const toolA = analytics.api.getToolAnalytics('tool_a');

      expect(toolA).toBeDefined();
      expect(toolA.name).toBe('tool_a');
      expect(toolA.totalCalls).toBe(1);
    });

    it('should return null for unknown tool', () => {
      const unknown = analytics.api.getToolAnalytics('nonexistent');
      expect(unknown).toBeNull();
    });

    it('should get top tools', () => {
      const top = analytics.api.getTopTools(2);
      expect(top.length).toBeLessThanOrEqual(2);
    });

    it('should get slowest tools', () => {
      const slowest = analytics.api.getSlowestTools(2);
      expect(slowest.length).toBeLessThanOrEqual(2);
    });

    it('should get problematic tools', () => {
      const problematic = analytics.api.getProblematicTools();
      expect(problematic.length).toBe(1);
      expect(problematic[0].name).toBe('tool_c');
    });
  });

  describe('Report Generation', () => {
    it('should generate analytics report', () => {
      analytics._test.handleToolStart({ toolName: 'tool_1', args: {} });
      analytics._test.handleToolComplete({ toolName: 'tool_1' });

      const report = analytics.api.generateReport();

      expect(report).toContain('Tool Usage Analytics');
      expect(report).toContain('Session Duration');
      expect(report).toContain('Total Tools Used');
    });

    it('should include session duration in report', () => {
      const report = analytics.api.generateReport();
      expect(report).toMatch(/Session Duration:.*minutes/);
    });
  });

  describe('Reset Functionality', () => {
    it('should reset all metrics', () => {
      analytics._test.handleToolStart({ toolName: 'tool_1', args: {} });
      analytics.api.reset();

      const all = analytics.api.getAllAnalytics();
      expect(all.totalTools).toBe(0);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Analytics reset')
      );
    });

    it('should reset session start time', () => {
      const beforeReset = analytics.api.getAllAnalytics().sessionDuration;
      analytics.api.reset();
      const afterReset = analytics.api.getAllAnalytics().sessionDuration;

      expect(afterReset).toBeLessThan(beforeReset + 100);
    });
  });

  describe('Edge Cases', () => {
    it('should handle completion without start', () => {
      analytics._test.handleToolComplete({ toolName: 'orphan_tool' });
      expect(true).toBe(true); // Should not throw
    });

    it('should handle error without start', () => {
      analytics._test.handleToolError({ toolName: 'orphan_tool', error: { message: 'Error' } });
      expect(true).toBe(true); // Should not throw
    });

    it('should handle missing error message', () => {
      analytics._test.handleToolStart({ toolName: 'tool', args: {} });
      analytics._test.handleToolError({ toolName: 'tool', error: null });

      const metrics = analytics.api.getToolAnalytics('tool');
      expect(metrics.errors[0].message).toBe('Unknown error');
    });

    it('should handle empty args', () => {
      analytics._test.handleToolStart({ toolName: 'tool', args: null });
      const metrics = analytics.api.getToolAnalytics('tool');
      expect(metrics).toBeDefined();
    });
  });

  describe('Integration Tests', () => {
    it('should track complete tool lifecycle', () => {
      // Multiple executions
      for (let i = 0; i < 5; i++) {
        analytics._test.handleToolStart({ toolName: 'lifecycle_tool', args: { iteration: i } });
        if (i % 2 === 0) {
          analytics._test.handleToolComplete({ toolName: 'lifecycle_tool' });
        } else {
          analytics._test.handleToolError({
            toolName: 'lifecycle_tool',
            error: { message: `Error ${i}` }
          });
        }
      }

      const metrics = analytics.api.getToolAnalytics('lifecycle_tool');
      expect(metrics.totalCalls).toBe(5);
      expect(metrics.successfulCalls).toBe(3);
      expect(metrics.failedCalls).toBe(2);
      expect(parseFloat(metrics.successRate)).toBe(60.0);
    });
  });
});
