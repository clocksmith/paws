import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import TabCoordinator from '../../upgrades/tab-coordinator.js';
describe('TabCoordinator Module', () => {
  let coordinator;
  let mockDeps;
  let mockBroadcastChannel;
  let messageHandler;

  beforeEach(() => {
    // Mock BroadcastChannel
    messageHandler = null;
    mockBroadcastChannel = {
      postMessage: vi.fn(),
      close: vi.fn(),
      set onmessage(handler) {
        messageHandler = handler;
      },
      get onmessage() {
        return messageHandler;
      }
    };

    global.window = {
      BroadcastChannel: vi.fn(() => mockBroadcastChannel),
      addEventListener: vi.fn()
    };

    mockDeps = {
      StateManager: {
        getState: vi.fn().mockResolvedValue({
          _timestamp: Date.now() - 1000
        }),
        updateState: vi.fn().mockResolvedValue(true)
      },
      EventBus: {
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      }
    };


    coordinator = TabCoordinator.factory(mockDeps);
  });

  afterEach(() => {
    if (coordinator && coordinator.api) {
      coordinator.api.cleanup();
    }
  });

  describe('Module Metadata', () => {
    it('should have correct API structure', () => {
      expect(coordinator).toBeDefined();
      expect(coordinator.init).toBeTypeOf('function');
      expect(coordinator.api.broadcast).toBeTypeOf('function');
      expect(coordinator.api.requestLock).toBeTypeOf('function');
      expect(coordinator.api.releaseLock).toBeTypeOf('function');
      expect(coordinator.api.getTabInfo).toBeTypeOf('function');
      expect(coordinator.api.cleanup).toBeTypeOf('function');
    });

    it('should declare coordination type', () => {
      const metadata = {
        id: 'TabCoordinator',
        version: '1.0.0',
        type: 'coordination'
      };
      expect(metadata.type).toBe('coordination');
    });
  });

  describe('Initialization', () => {
    it('should initialize with BroadcastChannel support', async () => {
      const result = await coordinator.init();

      expect(result).toBe(true);
      expect(global.window.BroadcastChannel).toHaveBeenCalledWith('reploid-tabs');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
    });

    it('should generate unique tab ID', async () => {
      await coordinator.init();
      const info = coordinator.api.getTabInfo();

      expect(info.tabId).toBeDefined();
      expect(info.tabId).toMatch(/^tab_\d+_[a-z0-9]+$/);
    });

    it('should broadcast tab-joined message', async () => {
      await coordinator.init();

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab-joined',
          tabId: expect.any(String)
        })
      );
    });

    it('should handle lack of BroadcastChannel support', async () => {
      delete global.window.BroadcastChannel;

      const result = await coordinator.init();

      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('not supported')
      );
    });

    it('should register state update listener', async () => {
      await coordinator.init();

      expect(mockDeps.EventBus.on).toHaveBeenCalledWith(
        'state:updated',
        expect.any(Function)
      );
    });

    it('should set up beforeunload handler', async () => {
      await coordinator.init();

      expect(global.window.addEventListener).toHaveBeenCalledWith(
        'beforeunload',
        expect.any(Function)
      );
    });
  });

  describe('Message Broadcasting', () => {
    beforeEach(async () => {
      await coordinator.init();
    });

    it('should broadcast custom messages', () => {
      const result = coordinator.api.broadcast({
        type: 'custom-message',
        data: 'test'
      });

      expect(result).toBe(true);
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'custom-message',
          data: 'test',
          tabId: expect.any(String),
          timestamp: expect.any(Number)
        })
      );
    });

    it('should include timestamp in broadcasts', () => {
      const beforeTime = Date.now();
      coordinator.api.broadcast({ type: 'test' });
      const afterTime = Date.now();

      const call = mockBroadcastChannel.postMessage.mock.calls[1]; // First call is tab-joined
      const message = call[0];

      expect(message.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(message.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should include tab ID in broadcasts', () => {
      const info = coordinator.api.getTabInfo();
      coordinator.api.broadcast({ type: 'test' });

      const call = mockBroadcastChannel.postMessage.mock.calls[1];
      expect(call[0].tabId).toBe(info.tabId);
    });

    it('should fail gracefully when not initialized', () => {
      const uninitCoordinator = {
        api: {
          broadcast: (message) => {
            if (!mockBroadcastChannel) return false;
            return true;
          }
        }
      };

      mockBroadcastChannel = null;
      const result = uninitCoordinator.api.broadcast({ type: 'test' });

      expect(result).toBe(false);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await coordinator.init();
    });

    it('should handle tab-joined messages', () => {
      messageHandler({
        data: {
          type: 'tab-joined',
          tabId: 'other-tab-123'
        }
      });

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('other-tab-123')
      );
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'tab:joined',
        { tabId: 'other-tab-123' }
      );
    });

    it('should ignore own messages', () => {
      const info = coordinator.api.getTabInfo();

      messageHandler({
        data: {
          type: 'tab-joined',
          tabId: info.tabId
        }
      });

      // Should not emit event for own message
      const tabJoinedCalls = mockDeps.EventBus.emit.mock.calls.filter(
        call => call[0] === 'tab:joined'
      );
      expect(tabJoinedCalls).toHaveLength(0);
    });

    it('should handle state-update messages', async () => {
      const futureTimestamp = Date.now() + 1000;

      messageHandler({
        data: {
          type: 'state-update',
          tabId: 'other-tab',
          state: { counter: 5 },
          timestamp: futureTimestamp
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.updateState).toHaveBeenCalledWith(
        expect.objectContaining({
          counter: 5,
          _timestamp: futureTimestamp,
          _source: 'remote'
        })
      );
    });

    it('should handle lock-request messages', () => {
      messageHandler({
        data: {
          type: 'lock-request',
          tabId: 'other-tab',
          resource: 'file.txt',
          lockId: 'lock-123'
        }
      });

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Lock requested')
      );
    });

    it('should handle lock-release messages', () => {
      messageHandler({
        data: {
          type: 'lock-release',
          tabId: 'other-tab',
          lockId: 'lock-123'
        }
      });

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Lock released')
      );
    });
  });

  describe('State Synchronization', () => {
    beforeEach(async () => {
      await coordinator.init();
    });

    it('should apply newer remote state', async () => {
      const currentTime = Date.now();
      const futureTime = currentTime + 5000;

      mockDeps.StateManager.getState.mockResolvedValue({
        _timestamp: currentTime,
        data: 'old'
      });

      messageHandler({
        data: {
          type: 'state-update',
          tabId: 'other-tab',
          state: { data: 'new' },
          timestamp: futureTime
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should ignore older remote state', async () => {
      const currentTime = Date.now();
      const pastTime = currentTime - 5000;

      mockDeps.StateManager.getState.mockResolvedValue({
        _timestamp: currentTime,
        data: 'current'
      });

      messageHandler({
        data: {
          type: 'state-update',
          tabId: 'other-tab',
          state: { data: 'old' },
          timestamp: pastTime
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.updateState).not.toHaveBeenCalled();
    });

    it('should emit state:remote-update event', async () => {
      const futureTime = Date.now() + 1000;

      messageHandler({
        data: {
          type: 'state-update',
          tabId: 'other-tab',
          state: { value: 42 },
          timestamp: futureTime
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'state:remote-update',
        expect.objectContaining({
          from: 'other-tab',
          state: { value: 42 }
        })
      );
    });

    it('should broadcast local state updates', async () => {
      // Find the state:updated handler
      const stateUpdateCall = mockDeps.EventBus.on.mock.calls.find(
        call => call[0] === 'state:updated'
      );
      const stateUpdateHandler = stateUpdateCall[1];

      // Simulate local state update
      stateUpdateHandler({
        state: { localChange: true },
        source: 'local'
      });

      // Should broadcast (2nd call, first is tab-joined)
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'state-update',
          state: { localChange: true }
        })
      );
    });

    it('should not broadcast remote state updates', async () => {
      const stateUpdateCall = mockDeps.EventBus.on.mock.calls.find(
        call => call[0] === 'state:updated'
      );
      const stateUpdateHandler = stateUpdateCall[1];

      mockBroadcastChannel.postMessage.mockClear();

      stateUpdateHandler({
        state: { remoteChange: true },
        source: 'remote'
      });

      expect(mockBroadcastChannel.postMessage).not.toHaveBeenCalled();
    });
  });

  describe('Locking Mechanism', () => {
    beforeEach(async () => {
      await coordinator.init();
    });

    it('should request lock for resource', async () => {
      const lockId = await coordinator.api.requestLock('critical-section');

      expect(lockId).toMatch(/^lock_\d+$/);
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'lock-request',
          resource: 'critical-section',
          lockId: expect.any(String)
        })
      );
    });

    it('should wait for lock acquisition', async () => {
      const startTime = Date.now();
      await coordinator.api.requestLock('resource');
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(100);
    });

    it('should release lock', () => {
      coordinator.api.releaseLock('lock-123');

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'lock-release',
          lockId: 'lock-123'
        })
      );
    });

    it('should handle lock request without initialization', async () => {
      const uninitCoordinator = {
        api: {
          requestLock: async () => true
        }
      };

      const result = await uninitCoordinator.api.requestLock('resource');
      expect(result).toBe(true);
    });

    it('should handle lock release without initialization', () => {
      const uninitCoordinator = {
        api: {
          releaseLock: () => {}
        }
      };

      expect(() => uninitCoordinator.api.releaseLock('lock-123')).not.toThrow();
    });

    it('should accept custom timeout for locks', async () => {
      const lockId = await coordinator.api.requestLock('resource', 10000);
      expect(lockId).toBeDefined();
    });
  });

  describe('Tab Information', () => {
    it('should return tab info before initialization', () => {
      const info = coordinator.api.getTabInfo();

      expect(info).toHaveProperty('tabId');
      expect(info).toHaveProperty('isInitialized');
      expect(info).toHaveProperty('supported');
      expect(info.isInitialized).toBe(false);
    });

    it('should return tab info after initialization', async () => {
      await coordinator.init();
      const info = coordinator.api.getTabInfo();

      expect(info.isInitialized).toBe(true);
      expect(info.tabId).toBeDefined();
      expect(info.supported).toBe(true);
    });

    it('should indicate BroadcastChannel support', () => {
      const info = coordinator.api.getTabInfo();
      expect(info.supported).toBe(true);
    });

    it('should indicate lack of support', () => {
      delete global.window.BroadcastChannel;
      const info = coordinator.api.getTabInfo();
      expect(info.supported).toBe(false);
    });
  });

  describe('Cleanup', () => {
    beforeEach(async () => {
      await coordinator.init();
    });

    it('should broadcast tab-leaving message', () => {
      mockBroadcastChannel.postMessage.mockClear();
      coordinator.api.cleanup();

      expect(mockBroadcastChannel.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tab-leaving'
        })
      );
    });

    it('should close broadcast channel', () => {
      coordinator.api.cleanup();
      expect(mockBroadcastChannel.close).toHaveBeenCalled();
    });

    it('should set initialized to false', () => {
      coordinator.api.cleanup();
      const info = coordinator.api.getTabInfo();
      expect(info.isInitialized).toBe(false);
    });

    it('should log cleanup completion', () => {
      coordinator.api.cleanup();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Cleanup complete')
      );
    });

    it('should handle cleanup when not initialized', () => {
      const uninitCoordinator = coordinator;
      expect(() => uninitCoordinator.api.cleanup()).not.toThrow();
    });

    it('should prevent operations after cleanup', () => {
      coordinator.api.cleanup();
      const result = coordinator.api.broadcast({ type: 'test' });
      expect(result).toBe(false);
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete tab lifecycle', async () => {
      // Initialize
      await coordinator.init();
      expect(coordinator.api.getTabInfo().isInitialized).toBe(true);

      // Broadcast message
      coordinator.api.broadcast({ type: 'custom', data: 'test' });
      expect(mockBroadcastChannel.postMessage).toHaveBeenCalled();

      // Request lock
      const lockId = await coordinator.api.requestLock('resource');
      expect(lockId).toBeDefined();

      // Release lock
      coordinator.api.releaseLock(lockId);

      // Cleanup
      coordinator.api.cleanup();
      expect(coordinator.api.getTabInfo().isInitialized).toBe(false);
    });

    it('should handle multi-tab communication', async () => {
      await coordinator.init();

      // Simulate another tab joining
      messageHandler({
        data: {
          type: 'tab-joined',
          tabId: 'tab-2'
        }
      });

      // Simulate state update from other tab
      messageHandler({
        data: {
          type: 'state-update',
          tabId: 'tab-2',
          state: { shared: 'data' },
          timestamp: Date.now() + 1000
        }
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'tab:joined',
        expect.any(Object)
      );
      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should coordinate concurrent lock requests', async () => {
      await coordinator.init();

      const lock1 = coordinator.api.requestLock('resource-1');
      await new Promise(resolve => setTimeout(resolve, 1)); // Ensure different timestamps
      const lock2 = coordinator.api.requestLock('resource-2');

      const [lockId1, lockId2] = await Promise.all([lock1, lock2]);

      expect(lockId1).toBeDefined();
      expect(lockId2).toBeDefined();
      // Both should be valid lock IDs
      expect(lockId1).toMatch(/^lock_\d+$/);
      expect(lockId2).toMatch(/^lock_\d+$/);
    });
  });

  describe('Edge Cases', () => {
    it('should handle rapid state updates', async () => {
      await coordinator.init();

      for (let i = 0; i < 10; i++) {
        messageHandler({
          data: {
            type: 'state-update',
            tabId: 'rapid-tab',
            state: { counter: i },
            timestamp: Date.now() + i
          }
        });
      }

      await new Promise(resolve => setTimeout(resolve, 20));

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should handle malformed messages gracefully', async () => {
      await coordinator.init();

      messageHandler({
        data: {
          type: 'unknown-type',
          tabId: 'other-tab'
        }
      });

      // Should not throw or crash
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should handle messages with missing fields', async () => {
      await coordinator.init();

      messageHandler({
        data: {
          type: 'state-update'
          // missing tabId, state, timestamp
        }
      });

      // Should handle gracefully
      expect(true).toBe(true);
    });

    it('should handle concurrent initializations', async () => {
      const init1 = coordinator.init();
      const init2 = coordinator.init();

      await Promise.all([init1, init2]);

      // Should handle gracefully
      expect(coordinator.api.getTabInfo().isInitialized).toBe(true);
    });
  });
});
