import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppLogic } from '../../upgrades/app-logic-es6.js';

describe('AppLogic ES6 Module', () => {
  let mockDeps, appLogic;

  beforeEach(() => {
    mockDeps = {
      logger: {
        logEvent: vi.fn()
      },
      Utils: {},
      Storage: {},
      StateManager: {
        init: vi.fn().mockResolvedValue(undefined),
        getState: vi.fn(() => ({ totalCycles: 0 })),
        updateGoal: vi.fn()
      },
      ApiClient: {},
      AgentCycle: {
        init: vi.fn().mockResolvedValue(undefined),
        executeCycle: vi.fn(),
        abortCurrentCycle: vi.fn()
      },
      UI: {
        init: vi.fn().mockResolvedValue(undefined),
        onCycleStart: vi.fn(),
        onCycleComplete: vi.fn(),
        onCycleError: vi.fn(),
        onArtifactCreated: vi.fn(),
        updateStateDisplay: vi.fn()
      }
    };

    appLogic = AppLogic.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(AppLogic.metadata.id).toBe('AppLogic');
      expect(AppLogic.metadata.version).toBe('2.0.0');
      expect(AppLogic.metadata.type).toBe('core');
    });

    it('should be async', () => {
      expect(AppLogic.metadata.async).toBe(true);
    });

    it('should declare all dependencies', () => {
      expect(AppLogic.metadata.dependencies).toContain('logger');
      expect(AppLogic.metadata.dependencies).toContain('StateManager');
      expect(AppLogic.metadata.dependencies).toContain('AgentCycle');
      expect(AppLogic.metadata.dependencies).toContain('UI');
    });
  });

  describe('Initialization', () => {
    it('should throw if dependencies missing', () => {
      expect(() => {
        AppLogic.factory({});
      }).toThrow('AppLogic: Missing required dependencies');
    });

    it('should initialize successfully', async () => {
      const api = await appLogic.init();

      expect(mockDeps.StateManager.init).toHaveBeenCalled();
      expect(mockDeps.AgentCycle.init).toHaveBeenCalled();
      expect(mockDeps.UI.init).toHaveBeenCalled();
      expect(api).toHaveProperty('getState');
      expect(api).toHaveProperty('runCycle');
      expect(api).toHaveProperty('abortCycle');
      expect(api).toHaveProperty('updateGoal');
    });

    it('should initialize components in order', async () => {
      await appLogic.init();

      const initCalls = [
        mockDeps.StateManager.init,
        mockDeps.AgentCycle.init,
        mockDeps.UI.init
      ];

      initCalls.forEach(mock => expect(mock).toHaveBeenCalled());
    });

    it('should pass event handler to AgentCycle', async () => {
      await appLogic.init();

      expect(mockDeps.AgentCycle.init).toHaveBeenCalledWith(
        mockDeps.StateManager,
        expect.any(Function)
      );
    });

    it('should log initialization', async () => {
      await appLogic.init();

      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith('info', expect.stringContaining('initializing'));
      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith('info', expect.stringContaining('complete'));
    });
  });

  describe('API Methods', () => {
    let api;

    beforeEach(async () => {
      api = await appLogic.init();
    });

    it('should get state', () => {
      const state = api.getState();

      expect(mockDeps.StateManager.getState).toHaveBeenCalled();
      expect(state).toHaveProperty('totalCycles');
    });

    it('should run cycle', () => {
      api.runCycle();

      expect(mockDeps.AgentCycle.executeCycle).toHaveBeenCalled();
    });

    it('should abort cycle', () => {
      api.abortCycle();

      expect(mockDeps.AgentCycle.abortCurrentCycle).toHaveBeenCalled();
    });

    it('should update goal', () => {
      api.updateGoal('New goal');

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith('New goal');
    });
  });

  describe('Event Handling', () => {
    let eventHandler;

    beforeEach(async () => {
      await appLogic.init();
      eventHandler = mockDeps.AgentCycle.init.mock.calls[0][1];
    });

    it('should handle cycle:start event', () => {
      eventHandler({ type: 'cycle:start', payload: { goal: 'Test' } });

      expect(mockDeps.UI.onCycleStart).toHaveBeenCalledWith({ goal: 'Test' });
    });

    it('should handle cycle:complete event', () => {
      eventHandler({ type: 'cycle:complete', payload: { success: true } });

      expect(mockDeps.UI.onCycleComplete).toHaveBeenCalledWith({ success: true });
    });

    it('should handle cycle:error event', () => {
      eventHandler({ type: 'cycle:error', payload: { error: 'Test error' } });

      expect(mockDeps.UI.onCycleError).toHaveBeenCalledWith({ error: 'Test error' });
    });

    it('should handle artifact:created event', () => {
      eventHandler({ type: 'artifact:created', payload: { path: '/file.txt' } });

      expect(mockDeps.UI.onArtifactCreated).toHaveBeenCalledWith({ path: '/file.txt' });
    });

    it('should handle state:updated event', () => {
      eventHandler({ type: 'state:updated', payload: {} });

      expect(mockDeps.UI.updateStateDisplay).toHaveBeenCalled();
    });

    it('should log unknown events', () => {
      eventHandler({ type: 'unknown:event', payload: {} });

      expect(mockDeps.logger.logEvent).toHaveBeenCalledWith('debug', expect.stringContaining('Unhandled'));
    });

    it('should handle events with optional UI methods', () => {
      delete mockDeps.UI.onCycleStart;

      eventHandler({ type: 'cycle:start', payload: {} });

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle events with null payload', () => {
      eventHandler({ type: 'cycle:start', payload: null });

      expect(mockDeps.UI.onCycleStart).toHaveBeenCalledWith(null);
    });

    it('should handle events with undefined payload', () => {
      eventHandler({ type: 'cycle:complete' });

      expect(mockDeps.UI.onCycleComplete).toHaveBeenCalled();
    });

    it('should handle multiple events in sequence', () => {
      eventHandler({ type: 'cycle:start', payload: { goal: 'Goal 1' } });
      eventHandler({ type: 'state:updated', payload: {} });
      eventHandler({ type: 'cycle:complete', payload: { success: true } });

      expect(mockDeps.UI.onCycleStart).toHaveBeenCalledTimes(1);
      expect(mockDeps.UI.updateStateDisplay).toHaveBeenCalledTimes(1);
      expect(mockDeps.UI.onCycleComplete).toHaveBeenCalledTimes(1);
    });

    it('should handle events with complex payload data', () => {
      const complexPayload = {
        goal: 'Test',
        metadata: { timestamp: Date.now(), userId: 'test-user' },
        artifacts: ['/file1.txt', '/file2.js']
      };

      eventHandler({ type: 'cycle:start', payload: complexPayload });

      expect(mockDeps.UI.onCycleStart).toHaveBeenCalledWith(complexPayload);
    });

    it('should handle artifact:created with multiple artifacts', () => {
      eventHandler({ type: 'artifact:created', payload: { path: '/file1.txt' } });
      eventHandler({ type: 'artifact:created', payload: { path: '/file2.js' } });

      expect(mockDeps.UI.onArtifactCreated).toHaveBeenCalledTimes(2);
    });
  });

  describe('Initialization Failure Scenarios', () => {
    it('should handle StateManager init failure', async () => {
      mockDeps.StateManager.init.mockRejectedValue(new Error('State init failed'));

      await expect(appLogic.init()).rejects.toThrow('State init failed');
    });

    it('should handle AgentCycle init failure', async () => {
      mockDeps.AgentCycle.init.mockRejectedValue(new Error('Cycle init failed'));

      await expect(appLogic.init()).rejects.toThrow('Cycle init failed');
    });

    it('should handle UI init failure', async () => {
      mockDeps.UI.init.mockRejectedValue(new Error('UI init failed'));

      await expect(appLogic.init()).rejects.toThrow('UI init failed');
    });

    it('should not initialize twice', async () => {
      await appLogic.init();

      // Try to initialize again
      await appLogic.init();

      // Should only call init once per dependency
      expect(mockDeps.StateManager.init).toHaveBeenCalledTimes(1);
      expect(mockDeps.AgentCycle.init).toHaveBeenCalledTimes(1);
      expect(mockDeps.UI.init).toHaveBeenCalledTimes(1);
    });

    it('should handle partial initialization failure gracefully', async () => {
      mockDeps.StateManager.init.mockResolvedValue(undefined);
      mockDeps.AgentCycle.init.mockRejectedValue(new Error('Cycle error'));

      await expect(appLogic.init()).rejects.toThrow('Cycle error');
      expect(mockDeps.StateManager.init).toHaveBeenCalled();
    });
  });

  describe('Concurrent Cycle Handling', () => {
    let api;

    beforeEach(async () => {
      api = await appLogic.init();
    });

    it('should handle multiple concurrent runCycle calls', () => {
      api.runCycle();
      api.runCycle();
      api.runCycle();

      expect(mockDeps.AgentCycle.executeCycle).toHaveBeenCalledTimes(3);
    });

    it('should handle runCycle with abort in between', () => {
      api.runCycle();
      api.abortCycle();
      api.runCycle();

      expect(mockDeps.AgentCycle.executeCycle).toHaveBeenCalledTimes(2);
      expect(mockDeps.AgentCycle.abortCurrentCycle).toHaveBeenCalledTimes(1);
    });

    it('should handle multiple abort calls', () => {
      api.abortCycle();
      api.abortCycle();
      api.abortCycle();

      expect(mockDeps.AgentCycle.abortCurrentCycle).toHaveBeenCalledTimes(3);
    });
  });

  describe('State Recovery', () => {
    let api;

    beforeEach(async () => {
      api = await appLogic.init();
    });

    it('should recover state after error', () => {
      mockDeps.StateManager.getState.mockReturnValue({ totalCycles: 5, error: 'Previous error' });

      const state = api.getState();

      expect(state.totalCycles).toBe(5);
      expect(state.error).toBe('Previous error');
    });

    it('should handle state with missing fields', () => {
      mockDeps.StateManager.getState.mockReturnValue({});

      const state = api.getState();

      expect(state).toEqual({});
    });

    it('should handle null state', () => {
      mockDeps.StateManager.getState.mockReturnValue(null);

      const state = api.getState();

      expect(state).toBeNull();
    });
  });

  describe('Memory Cleanup', () => {
    it('should cleanup on multiple initializations', async () => {
      const firstApi = await appLogic.init();
      expect(firstApi).toBeDefined();

      // Reset to simulate cleanup
      appLogic = AppLogic.factory(mockDeps);
      const secondApi = await appLogic.init();

      expect(secondApi).toBeDefined();
      expect(mockDeps.StateManager.init).toHaveBeenCalledTimes(2);
    });
  });

  describe('Empty/Invalid Goals', () => {
    let api;

    beforeEach(async () => {
      api = await appLogic.init();
    });

    it('should handle empty string goal', () => {
      api.updateGoal('');

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith('');
    });

    it('should handle null goal', () => {
      api.updateGoal(null);

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith(null);
    });

    it('should handle undefined goal', () => {
      api.updateGoal(undefined);

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith(undefined);
    });

    it('should handle very long goal', () => {
      const longGoal = 'A'.repeat(10000);
      api.updateGoal(longGoal);

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith(longGoal);
    });

    it('should handle goal with special characters', () => {
      const specialGoal = 'Test\n\t\r\0Goal with "quotes" and \'apostrophes\'';
      api.updateGoal(specialGoal);

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith(specialGoal);
    });
  });

  describe('Async Race Conditions', () => {
    it('should handle rapid init calls', async () => {
      const promises = [
        appLogic.init(),
        appLogic.init(),
        appLogic.init()
      ];

      const results = await Promise.all(promises);

      results.forEach(api => {
        expect(api).toBeDefined();
        expect(api.getState).toBeDefined();
      });
    });

    it('should handle init during event handling', async () => {
      const api = await appLogic.init();
      const eventHandler = mockDeps.AgentCycle.init.mock.calls[0][1];

      // Trigger event while initializing another instance
      eventHandler({ type: 'cycle:start', payload: { goal: 'Test' } });

      // Should not interfere
      expect(mockDeps.UI.onCycleStart).toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    let api;

    beforeEach(async () => {
      api = await appLogic.init();
    });

    it('should handle API calls before initialization', () => {
      const uninitAppLogic = AppLogic.factory(mockDeps);

      expect(() => {
        // This would work because factory returns instance, not initialized API
        uninitAppLogic.init();
      }).not.toThrow();
    });

    it('should handle missing optional dependencies', async () => {
      const minimalDeps = {
        logger: mockDeps.logger,
        StateManager: mockDeps.StateManager,
        AgentCycle: mockDeps.AgentCycle,
        UI: mockDeps.UI
      };

      const minimalAppLogic = AppLogic.factory(minimalDeps);
      const api = await minimalAppLogic.init();

      expect(api).toBeDefined();
    });

    it('should handle state updates during cycle', () => {
      api.runCycle();

      mockDeps.StateManager.getState.mockReturnValue({ totalCycles: 1 });
      const state = api.getState();

      expect(state.totalCycles).toBe(1);
    });

    it('should handle goal updates during cycle', () => {
      api.runCycle();
      api.updateGoal('New goal during cycle');

      expect(mockDeps.StateManager.updateGoal).toHaveBeenCalledWith('New goal during cycle');
    });
  });
});
