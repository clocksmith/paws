import { describe, it, expect, beforeEach, vi } from 'vitest';
import VisualSelfImprovement from '../../upgrades/visual-self-improvement.js';

describe('Visual Self-Improvement Module', () => {
  let mockDeps;
  let moduleApi;

  beforeEach(async () => {
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      VDAT: {
        getDependencyGraph: vi.fn().mockResolvedValue({
          nodes: [
            { id: 'A', category: 'core' },
            { id: 'B', category: 'core' },
            { id: 'C', category: 'agent' }
          ],
          edges: [
            { source: 'A', target: 'B' },
            { source: 'B', target: 'A' } // circular
          ]
        }),
        getCognitiveFlow: vi.fn().mockResolvedValue({
          nodes: [
            { id: 'OBSERVE', status: 'active', label: 'Observe' },
            { id: 'DECIDE', status: 'active', label: 'Decide' }
          ]
        }),
        getMemoryHeatmap: vi.fn().mockResolvedValue({
          nodes: [
            { id: 'file-1', label: 'file-1', heat: 30 },
            { id: 'file-2', label: 'file-2', heat: 5 }
          ]
        }),
        getGoalTree: vi.fn().mockResolvedValue({
          nodes: [
            { id: 'ROOT_GOAL' },
            { id: 'ANALYZE' },
            { id: 'PLAN' },
            { id: 'EXECUTE' }
          ],
          edges: [
            { source: 'ROOT_GOAL', target: 'ANALYZE' },
            { source: 'ROOT_GOAL', target: 'PLAN' },
            { source: 'ROOT_GOAL', target: 'EXECUTE' }
          ]
        })
      },
      PerformanceMonitor: {
        getMetrics: vi.fn().mockReturnValue({
          states: {
            OBSERVE: { entries: 2, totalTime: 80 },
            DECIDE: { entries: 1, totalTime: 200 }
          },
          tools: { averageDuration: 42 },
          llm: { calls: 4 },
          session: { cycles: 3 }
        })
      },
      ToolAnalytics: {
        getAllAnalytics: vi.fn().mockReturnValue({
          sessionDuration: 120000,
          tools: [
            {
              name: 'analyze_code',
              totalCalls: 10,
              successfulCalls: 9,
              failedCalls: 1,
              errorRate: '10',
              avgDurationMs: '25',
              errors: [{ message: 'Timeout' }]
            },
            {
              name: 'format_code',
              totalCalls: 3,
              successfulCalls: 3,
              failedCalls: 0,
              errorRate: '0',
              avgDurationMs: '12',
              errors: []
            }
          ]
        })
      }
    };

    const visualRSI = VisualSelfImprovement.factory(mockDeps);
    await visualRSI.init();
    moduleApi = visualRSI.api;
  });

  describe('metadata', () => {
    it('exposes expected metadata', () => {
      expect(VisualSelfImprovement.metadata.id).toBe('VRSI');
      expect(VisualSelfImprovement.metadata.dependencies).toEqual([
        'Utils',
        'VDAT',
        'PerformanceMonitor',
        'ToolAnalytics'
      ]);
      expect(VisualSelfImprovement.metadata.type).toBe('analysis');
    });
  });

  describe('generateInsights', () => {
    it('produces aggregate insights and recommendations', async () => {
      const insights = await moduleApi.generateInsights();

      expect(insights.score).toBeLessThanOrEqual(100);
      expect(insights.sections.dependency.circularDependencies).toEqual(['A', 'B']);
      expect(insights.sections.flow.dwellTimes[0].state).toBe('DECIDE');
      expect(insights.sections.memory.hotspots[0].id).toBe('file-1');
      expect(insights.sections.tools.highErrorTools).toContain('analyze_code');
      expect(insights.recommendations.length).toBeGreaterThan(0);
      expect(mockDeps.ToolAnalytics.getAllAnalytics).toHaveBeenCalled();
    });
  });

  describe('captureSnapshot', () => {
    it('wraps insights with snapshot metadata', async () => {
      const snapshot = await moduleApi.captureSnapshot();

      expect(snapshot.snapshotId).toMatch(/^vsnap_/);
      expect(snapshot.metadata.capturedAt).toBeDefined();
      expect(snapshot.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('compareSnapshots', () => {
    it('computes score delta between snapshots', async () => {
      const previous = await moduleApi.captureSnapshot();
      const current = await moduleApi.captureSnapshot();

      const comparison = moduleApi.compareSnapshots(previous, current);

      expect(comparison).toHaveProperty('scoreDelta');
      expect(comparison.summary).toMatch(/improvement|regressed|missing/);
    });
  });
});
