import { describe, it, expect, beforeEach, vi } from 'vitest';

import ToolAnalytics from '../../upgrades/tool-analytics.js';
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


    analytics = ToolAnalytics.factory(mockDeps);
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
