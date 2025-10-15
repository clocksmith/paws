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
  });
});
