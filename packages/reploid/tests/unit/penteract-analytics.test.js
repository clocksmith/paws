import { describe, it, expect, beforeEach, vi } from 'vitest';
import PenteractAnalytics from '../../upgrades/penteract-analytics.js';

describe('Penteract Analytics Module', () => {
  let mockDeps;
  let analytics;
  let mockEventBus;
  let mockStateManager;

  const sampleHistory = {
    history: [
      {
        task: 'Initial task',
        timestamp: '2025-01-01T00:00:00.000Z',
        consensus: { status: 'success', passing: ['agent-a'] },
        agents: [
          { name: 'agent-a', model: 'model-a', status: 'PASS', execution_time: 10, token_count: 100 }
        ]
      }
    ],
    latest: {
      task: 'Initial task',
      timestamp: '2025-01-01T00:00:00.000Z',
      consensus: { status: 'success', passing: ['agent-a'] },
      agents: [
        { name: 'agent-a', model: 'model-a', status: 'PASS', execution_time: 10, token_count: 100 }
      ]
    }
  };

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn(),
      on: vi.fn().mockImplementation((event, handler) => {
        // Immediately invoke handler with cached data when subscribing to processed events
        if (event === 'paxos:analytics' && analytics) {
          mockEventBus._listener = handler;
        }
        return vi.fn();
      })
    };

    mockStateManager = {
      getArtifactContent: vi.fn().mockResolvedValue(JSON.stringify(sampleHistory)),
      getArtifactMetadata: vi.fn().mockReturnValue(null),
      createArtifact: vi.fn().mockResolvedValue(undefined),
      updateArtifact: vi.fn().mockResolvedValue(undefined)
    };

    mockDeps = {
      EventBus: mockEventBus,
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      StateManager: mockStateManager
    };

    analytics = PenteractAnalytics.factory(mockDeps);
  });

  describe('metadata', () => {
    it('exposes expected metadata', () => {
      expect(PenteractAnalytics.metadata.id).toBe('PAXA');
      expect(PenteractAnalytics.metadata.dependencies).toEqual(['EventBus', 'Utils', 'StateManager']);
      expect(PenteractAnalytics.metadata.type).toBe('analytics');
      expect(PenteractAnalytics.metadata.async).toBe(true);
    });
  });

  describe('initialisation', () => {
    it('loads cached history and emits latest snapshot', async () => {
      await analytics.init();

      expect(mockStateManager.getArtifactContent).toHaveBeenCalledWith('/analytics/penteract-analytics.json');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'paxos:analytics:processed',
        expect.objectContaining({ task: 'Initial task' })
      );
    });

    it('registers listeners for Paxos analytics', async () => {
      await analytics.init();

      expect(mockEventBus.on).toHaveBeenCalledWith(
        'paxos:analytics',
        expect.any(Function),
        'PenteractAnalytics'
      );
    });
  });

  describe('ingest snapshots', () => {
    const incomingSnapshot = {
      task: 'New Task',
      timestamp: '2025-01-02T00:00:00.000Z',
      agents: [
        { name: 'agent-a', model: 'model-a', status: 'PASS', execution_time: 12, token_count: 120 },
        { name: 'agent-b', model: 'model-b', status: 'FAIL', execution_time: 18, token_count: 80 }
      ],
      consensus: {
        status: 'failure',
        passing: []
      }
    };

    it('persists new history and emits processed event', async () => {
      await analytics.init();
      analytics.api.ingestSnapshot(incomingSnapshot);
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStateManager.createArtifact).toHaveBeenCalledWith(
        '/analytics/penteract-analytics.json',
        'json',
        expect.stringContaining('New Task'),
        'Penteract analytics history'
      );
      expect(mockEventBus.emit).toHaveBeenLastCalledWith(
        'paxos:analytics:processed',
        expect.objectContaining({ task: 'New Task', consensus: expect.any(Object) })
      );

      const latest = analytics.api.getLatest();
      expect(latest.metrics.totals.total).toBe(2);
      expect(analytics.api.getHistory().length).toBeGreaterThan(0);
    });

    it('updates existing artifact when history already saved', async () => {
      mockStateManager.getArtifactMetadata.mockReturnValueOnce(null).mockReturnValue({ id: 'exists' });
      await analytics.init();

      analytics.api.ingestSnapshot(incomingSnapshot);
      await Promise.resolve();
      await Promise.resolve();
      analytics.api.ingestSnapshot({ ...incomingSnapshot, task: 'Follow-up', timestamp: '2025-01-03T00:00:00.000Z' });
      await Promise.resolve();
      await Promise.resolve();

      expect(mockStateManager.updateArtifact).toHaveBeenCalledWith(
        '/analytics/penteract-analytics.json',
        expect.stringContaining('Follow-up')
      );
    });
  });

  describe('summary helpers', () => {
    it('returns summary statistics', async () => {
      await analytics.init();
      const summary = analytics.api.getSummary();

      expect(summary.totalRuns).toBeGreaterThanOrEqual(1);
      expect(summary).toHaveProperty('successRate');
      expect(Array.isArray(summary.consensusTrail)).toBe(true);
    });
  });
});
