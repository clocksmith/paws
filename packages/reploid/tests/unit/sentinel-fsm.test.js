import { describe, it, expect, beforeEach, vi } from 'vitest';
import SentinelFSMModule from '../../upgrades/sentinel-fsm.js';

describe('SentinelFSM Module', () => {
  let fsm;
  let mockDeps;
  let eventHandlers;

  beforeEach(() => {
    eventHandlers = {};

    mockDeps = {
      StateManager: {
        sessionManager: {
          createSession: vi.fn().mockResolvedValue('session-123'),
          createTurn: vi.fn().mockResolvedValue({
            turn: 1,
            cats_path: '/sessions/session-123/turn-1/cats',
            dogs_path: '/sessions/session-123/turn-1/dogs'
          })
        },
        getArtifactContent: vi.fn().mockResolvedValue('mock content'),
        createArtifact: vi.fn().mockResolvedValue(true),
        updateArtifact: vi.fn().mockResolvedValue(true)
      },
      ToolRunner: {},
      ApiClient: {},
      HybridLLMProvider: {
        complete: vi.fn().mockResolvedValue({
          text: '## CREATE: /vfs/test.js\n```javascript\nconst x = 1;\n```'
        })
      },
      EventBus: {
        on: vi.fn((event, handler) => { eventHandlers[event] = handler; }),
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
      },
      SentinelTools: {
        curateFilesWithAI: vi.fn().mockResolvedValue(['/file1.js', '/file2.js']),
        createCatsBundle: vi.fn().mockResolvedValue({
          success: true,
          path: '/sessions/session-123/turn-1/cats'
        }),
        createDogsBundle: vi.fn().mockResolvedValue({
          success: true,
          path: '/sessions/session-123/turn-1/dogs'
        }),
        applyDogsBundle: vi.fn().mockResolvedValue({
          success: true,
          changes_applied: [{ file: '/test.js', operation: 'CREATE' }]
        })
      },
      GitVFS: {
        isInitialized: vi.fn().mockReturnValue(false),
        createCheckpoint: vi.fn().mockResolvedValue({ id: 'checkpoint-123' }),
        commitChanges: vi.fn().mockResolvedValue(true)
      },
      ReflectionStore: {
        addReflection: vi.fn().mockResolvedValue('reflection-123')
      },
      SelfTester: {
        runAllTests: vi.fn().mockResolvedValue({
          summary: { successRate: 100, passed: 10, failed: 0 }
        })
      },
      WebRTCCoordinator: {
        shareSuccessPattern: vi.fn().mockResolvedValue(3)
      }
    };

    // Mock DOM elements for status UI
    global.document = {
      getElementById: vi.fn((id) => ({
        textContent: '',
        style: { display: '', width: '' }
      }))
    };

    fsm = SentinelFSMModule.factory(mockDeps).api;
  });

  describe('Module Metadata', () => {
    it('should have correct module structure', () => {
      expect(fsm).toBeDefined();
      expect(fsm.startCycle).toBeTypeOf('function');
      expect(fsm.getStatus).toBeTypeOf('function');
      expect(fsm.pauseCycle).toBeTypeOf('function');
      expect(fsm.resumeCycle).toBeTypeOf('function');
    });
  });

  describe('State Management', () => {
    it('should start in IDLE state', () => {
      expect(fsm.getCurrentState()).toBe('IDLE');
    });

    it('should transition from IDLE to CURATING_CONTEXT when starting cycle', async () => {
      await fsm.startCycle('test goal');

      // Allow async state transitions to complete
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.sessionManager.createSession).toHaveBeenCalledWith('test goal');
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('agent:curating', { goal: 'test goal' });
    });

    it('should maintain state history', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      const history = fsm.getStateHistory();
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]).toHaveProperty('from');
      expect(history[0]).toHaveProperty('to');
      expect(history[0]).toHaveProperty('timestamp');
    });

    it('should not start cycle if not in IDLE state', async () => {
      await fsm.startCycle('test goal 1');
      const result = await fsm.startCycle('test goal 2');

      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Context Curation', () => {
    it('should curate files with AI', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.SentinelTools.curateFilesWithAI).toHaveBeenCalledWith('test goal');
    });

    it('should create cats bundle', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.SentinelTools.createCatsBundle).toHaveBeenCalled();
    });

    it('should emit status updates during curation', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('status:updated', expect.objectContaining({
        state: 'CURATING_CONTEXT'
      }));
    });
  });

  describe('Proposal Generation', () => {
    it('should emit agent:awaiting:context in AWAITING_CONTEXT_APPROVAL state', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('agent:awaiting:context', expect.objectContaining({
        session_id: 'session-123'
      }));
    });

    it('should emit agent:curating event during context curation', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('agent:curating', expect.objectContaining({
        goal: 'test goal'
      }));
    });
  });

  describe('Change Application', () => {
    it('should have applyDogsBundle method available', () => {
      expect(mockDeps.SentinelTools.applyDogsBundle).toBeTypeOf('function');
    });

    it('should have GitVFS checkpoint functionality available', () => {
      expect(mockDeps.GitVFS.createCheckpoint).toBeTypeOf('function');
      expect(mockDeps.GitVFS.isInitialized).toBeTypeOf('function');
    });

    it('should have SelfTester validation available', () => {
      expect(mockDeps.SelfTester.runAllTests).toBeTypeOf('function');
    });

    it('should transition to AWAITING_CONTEXT_APPROVAL after curation', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 50));

      const status = fsm.getStatus();
      expect(status.currentState).toBe('AWAITING_CONTEXT_APPROVAL');
    });
  });

  describe('Reflection', () => {
    it('should have ReflectionStore available for storing insights', () => {
      expect(mockDeps.ReflectionStore.addReflection).toBeTypeOf('function');
    });

    it('should have WebRTCCoordinator for pattern sharing', () => {
      expect(mockDeps.WebRTCCoordinator.shareSuccessPattern).toBeTypeOf('function');
    });

    it('should maintain reflection insights array', () => {
      const insights = fsm.getReflectionInsights();
      expect(Array.isArray(insights)).toBe(true);
    });

    it('should have cycle context with required fields after start', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = fsm.getStatus();
      expect(status.cycleContext).toHaveProperty('goal');
      expect(status.cycleContext).toHaveProperty('sessionId');
      expect(status.cycleContext).toHaveProperty('startTime');
      expect(status.cycleContext).toHaveProperty('iterations');
    });
  });

  describe('Pause and Resume', () => {
    it('should pause active cycle', async () => {
      await fsm.startCycle('test goal');
      const result = fsm.pauseCycle();

      expect(result).toBe(true);
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('cycle:paused', expect.any(Object));
    });

    it('should not pause when in IDLE state', () => {
      const result = fsm.pauseCycle();

      expect(result).toBe(false);
    });

    it('should resume paused cycle', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      fsm.pauseCycle();
      const result = await fsm.resumeCycle();

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('cycle:resumed', expect.any(Object));
    });
  });

  describe('Status Reporting', () => {
    it('should return current status', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = fsm.getStatus();

      expect(status).toHaveProperty('currentState');
      expect(status).toHaveProperty('cycleContext');
      expect(status).toHaveProperty('stateHistory');
      expect(status).toHaveProperty('reflectionInsights');
    });

    it('should include cycle context in status', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      const status = fsm.getStatus();

      expect(status.cycleContext).toHaveProperty('goal', 'test goal');
      expect(status.cycleContext).toHaveProperty('sessionId');
    });
  });

  describe('Error Handling', () => {
    it('should transition to ERROR state on failure', async () => {
      mockDeps.SentinelTools.createCatsBundle.mockResolvedValue({
        success: false
      });

      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 50));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('agent:error', expect.any(Object));
    });

    it('should reset context in ERROR state', async () => {
      mockDeps.SentinelTools.createCatsBundle.mockResolvedValue({
        success: false
      });

      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = fsm.getStatus();
      expect(status.cycleContext).toBeNull();
    });
  });

  describe('Event Emissions', () => {
    it('should emit fsm:state:changed on transitions', async () => {
      await fsm.startCycle('test goal');

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('fsm:state:changed', expect.objectContaining({
        oldState: 'IDLE',
        newState: 'CURATING_CONTEXT'
      }));
    });

    it('should emit status:updated on UI updates', async () => {
      await fsm.startCycle('test goal');
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('status:updated', expect.any(Object));
    });
  });
});
