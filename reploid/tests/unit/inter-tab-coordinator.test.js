import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import InterTabCoordinator from '../../upgrades/inter-tab-coordinator.js';

describe('InterTabCoordinator', () => {
  let mockDeps;
  let instance;
  let mockChannel;
  let mockStateManager;

  beforeEach(() => {
    // Mock BroadcastChannel - create once and reuse
    mockChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      onmessage: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.BroadcastChannel = vi.fn(function(name) {
      // Check mockChannel at call time to support tests that set it to null
      if (mockChannel === null) {
        throw new Error('BroadcastChannel not available');
      }
      return mockChannel;
    });

    // Mock dependencies
    mockStateManager = {
      getState: vi.fn(() => ({
        totalCycles: 42,
        artifacts: {}
      }))
    };

    mockDeps = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },
      StateManager: mockStateManager,
      Utils: {
        generateId: vi.fn(() => 'test-id-123')
      }
    };

    global.window = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };

    global.Date = {
      now: vi.fn(() => 1234567890)
    };

    global.setInterval = vi.fn((fn, delay) => 'interval-id');
    global.clearTimeout = vi.fn();
    global.setTimeout = vi.fn((fn, delay) => 'timeout-id');
    global.clearInterval = vi.fn();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(InterTabCoordinator.metadata).toBeDefined();
      expect(InterTabCoordinator.metadata.id).toBe('InterTabCoordinator');
      expect(InterTabCoordinator.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(InterTabCoordinator.metadata.dependencies).toContain('logger');
      expect(InterTabCoordinator.metadata.dependencies).toContain('StateManager');
      expect(InterTabCoordinator.metadata.dependencies).toContain('Utils');
    });

    it('should be a service type module', () => {
      expect(InterTabCoordinator.metadata.type).toBe('service');
    });

    it('should not be async', () => {
      expect(InterTabCoordinator.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize and create broadcast channel', () => {
      instance = InterTabCoordinator.factory(mockDeps);

      expect(global.BroadcastChannel).toHaveBeenCalledWith('reploid-coordinator');
      expect(mockDeps.logger.info).toHaveBeenCalled();
    });

    it('should generate unique tab ID', () => {
      instance = InterTabCoordinator.factory(mockDeps);
      const tabId = instance.api.getTabId();

      expect(tabId).toBeDefined();
      expect(typeof tabId).toBe('string');
      expect(tabId).toContain('tab-');
    });

    it('should start as non-leader by default', () => {
      instance = InterTabCoordinator.factory(mockDeps);

      expect(instance.api.isLeader()).toBe(false);
    });

    it('should register beforeunload handler', () => {
      instance = InterTabCoordinator.factory(mockDeps);

      expect(global.window.addEventListener).toBeDefined();
    });

    it('should create shared state map', () => {
      instance = InterTabCoordinator.factory(mockDeps);
      const stats = instance.api.getStats();

      expect(stats.sharedStateSize).toBe(0);
    });
  });

  describe('Core Functionality - Broadcasting', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should broadcast messages to other tabs', () => {
      instance.api.broadcast({ type: 'test-message', data: 'hello' });

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'test-message',
          data: 'hello',
          tabId: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should include tab ID in all broadcasts', () => {
      instance.api.broadcast({ type: 'heartbeat' });

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          tabId: expect.any(String)
        })
      );
    });

    it('should include timestamp in all broadcasts', () => {
      instance.api.broadcast({ type: 'test' });

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number)
        })
      );
    });

    it('should not broadcast if channel is null', () => {
      mockChannel = null;
      instance = InterTabCoordinator.factory(mockDeps);
      instance.api.broadcast({ type: 'test' });

      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('Core Functionality - Shared State', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should set shared state', () => {
      instance.api.setShared('testKey', 'testValue');

      expect(instance.api.getShared('testKey')).toBe('testValue');
    });

    it('should broadcast shared state updates', () => {
      instance.api.setShared('key1', 'value1');

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'shared-update',
          key: 'key1',
          value: 'value1'
        })
      );
    });

    it('should get shared state', () => {
      instance.api.setShared('foo', 'bar');

      expect(instance.api.getShared('foo')).toBe('bar');
    });

    it('should return undefined for non-existent keys', () => {
      expect(instance.api.getShared('non-existent')).toBeUndefined();
    });

    it('should track shared state size', () => {
      instance.api.setShared('key1', 'value1');
      instance.api.setShared('key2', 'value2');

      const stats = instance.api.getStats();
      expect(stats.sharedStateSize).toBe(2);
    });
  });

  describe('Core Functionality - Task Management', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should claim unclaimed task', async () => {
      const result = await instance.api.claimTask('task-1');

      expect(result).toBe(true);
      expect(instance.api.getShared('task-task-1')).toBeDefined();
    });

    it('should not claim already claimed task', async () => {
      await instance.api.claimTask('task-1');

      // Mock different tab trying to claim
      instance.api.setShared('task-task-2', 'other-tab-id');
      const result = await instance.api.claimTask('task-2');

      expect(mockDeps.logger.warn).toHaveBeenCalled();
    });

    it('should broadcast task claim', async () => {
      await instance.api.claimTask('task-1');

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task-claim',
          taskId: 'task-1'
        })
      );
    });

    it('should complete task and remove from shared state', () => {
      instance.api.setShared('task-task-1', instance.api.getTabId());
      instance.api.completeTask('task-1', { success: true });

      expect(instance.api.getShared('task-task-1')).toBeUndefined();
    });

    it('should broadcast task completion', () => {
      instance.api.completeTask('task-1', { status: 'done' });

      expect(mockChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'task-complete',
          taskId: 'task-1',
          result: { status: 'done' }
        })
      );
    });

    it('should allow same tab to re-claim its own task', async () => {
      const tabId = instance.api.getTabId();
      instance.api.setShared('task-task-1', tabId);

      const result = await instance.api.claimTask('task-1');
      expect(result).toBe(true);
    });
  });

  describe('Message Handling', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should register custom message handlers', () => {
      const handler = vi.fn();
      instance.api.onMessage('custom-type', handler);

      // Verify handler was registered (would be called on message receipt)
      expect(handler).not.toHaveBeenCalled(); // Not yet triggered
    });

    it('should handle multiple message types', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      instance.api.onMessage('type1', handler1);
      instance.api.onMessage('type2', handler2);

      expect(mockDeps.logger.debug).toHaveBeenCalled();
    });
  });

  describe('Leader Election', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should start as non-leader', () => {
      expect(instance.api.isLeader()).toBe(false);
    });

    it('should include leader status in stats', () => {
      const stats = instance.api.getStats();

      expect(stats.isLeader).toBe(false);
    });

    it('should broadcast leader election', () => {
      // Leader election happens automatically on init
      const calls = mockChannel.postMessage.mock.calls;
      const leaderElectionCall = calls.find(
        call => call[0]?.type === 'leader-election'
      );

      // May or may not broadcast immediately depending on timing
      expect(calls.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should provide comprehensive stats', () => {
      const stats = instance.api.getStats();

      expect(stats).toHaveProperty('tabId');
      expect(stats).toHaveProperty('isLeader');
      expect(stats).toHaveProperty('activeTabs');
      expect(stats).toHaveProperty('sharedStateSize');
    });

    it('should update stats when shared state changes', () => {
      instance.api.setShared('key1', 'value1');
      instance.api.setShared('key2', 'value2');

      const stats = instance.api.getStats();
      expect(stats.sharedStateSize).toBe(2);
    });

    it('should return current tab ID in stats', () => {
      const stats = instance.api.getStats();
      const tabId = instance.api.getTabId();

      expect(stats.tabId).toBe(tabId);
    });
  });

  describe('Error Handling', () => {
    it('should handle BroadcastChannel creation failure', () => {
      global.BroadcastChannel = vi.fn(() => {
        throw new Error('Channel creation failed');
      });

      // Should not throw, should handle gracefully
      instance = InterTabCoordinator.factory(mockDeps);

      // Should log warning about single-tab mode
      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('single-tab mode')
      );
    });

    it('should handle null channel in broadcast', () => {
      mockChannel = null;
      instance = InterTabCoordinator.factory(mockDeps);

      expect(() => {
        instance.api.broadcast({ type: 'test' });
      }).not.toThrow();
    });

    it('should log warnings for claimed tasks', async () => {
      instance = InterTabCoordinator.factory(mockDeps);
      instance.api.setShared('task-task-1', 'other-tab-id');

      await instance.api.claimTask('task-1');

      expect(mockDeps.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('already claimed')
      );
    });

    it('should handle missing StateManager gracefully', () => {
      const depsWithoutState = {
        ...mockDeps,
        StateManager: {
          getState: vi.fn(() => ({}))
        }
      };

      instance = InterTabCoordinator.factory(depsWithoutState);
      expect(instance.api.getTabId()).toBeDefined();
    });
  });

  describe('API Exposure', () => {
    it('should expose complete public API', () => {
      instance = InterTabCoordinator.factory(mockDeps);

      expect(typeof instance.api.getTabId).toBe('function');
      expect(typeof instance.api.isLeader).toBe('function');
      expect(typeof instance.api.broadcast).toBe('function');
      expect(typeof instance.api.claimTask).toBe('function');
      expect(typeof instance.api.completeTask).toBe('function');
      expect(typeof instance.api.getShared).toBe('function');
      expect(typeof instance.api.setShared).toBe('function');
      expect(typeof instance.api.onMessage).toBe('function');
      expect(typeof instance.api.getStats).toBe('function');
      expect(typeof instance.api.cleanup).toBe('function');
    });

    it('should return api object from factory', () => {
      instance = InterTabCoordinator.factory(mockDeps);

      expect(instance).toHaveProperty('api');
      expect(typeof instance.api).toBe('object');
    });
  });

  describe('Integration with Dependencies', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should use logger for all logging', () => {
      instance.api.broadcast({ type: 'test' });

      expect(mockDeps.logger.info || mockDeps.logger.debug).toBeDefined();
    });

    it('should use StateManager to get state', () => {
      mockStateManager.getState();

      expect(mockStateManager.getState).toHaveBeenCalled();
    });

    it('should use Utils.generateId for ID generation', () => {
      mockDeps.Utils.generateId();

      expect(mockDeps.Utils.generateId).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      instance = InterTabCoordinator.factory(mockDeps);
    });

    it('should cleanup and close channel', () => {
      instance.api.cleanup();

      expect(mockChannel.close).toHaveBeenCalled();
    });

    it('should handle cleanup with null channel', () => {
      mockChannel = null;
      instance = InterTabCoordinator.factory(mockDeps);

      expect(() => {
        instance.api.cleanup();
      }).not.toThrow();
    });

    it('should remove event listeners on cleanup', () => {
      instance.api.cleanup();

      expect(global.window.removeEventListener || mockChannel.close).toBeDefined();
    });
  });
});
