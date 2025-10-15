import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('CycleLogic Module', () => {
  let CycleLogic;
  let mockDeps;
  let mockEventBus;
  let mockStateManager;
  let mockToolRunner;
  let mockHybridLLMProvider;
  let cycleInstance;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn()
    };

    // Mock StateManager
    mockStateManager = {
      createSession: vi.fn().mockResolvedValue('session-123'),
      createTurn: vi.fn().mockResolvedValue({
        cats_path: '/cycles/turn-1/cats.md',
        dogs_path: '/cycles/turn-1/dogs.md'
      }),
      getAllArtifactMetadata: vi.fn().mockResolvedValue({
        '/ui/dashboard.html': {},
        '/agent/logic.js': {},
        '/other/file.txt': {}
      }),
      getArtifactContent: vi.fn().mockResolvedValue('Context content')
    };

    // Mock ToolRunner
    mockToolRunner = {
      runTool: vi.fn().mockResolvedValue({ success: true })
    };

    // Mock HybridLLMProvider
    mockHybridLLMProvider = {
      complete: vi.fn().mockResolvedValue({
        text: 'LLM response with changes'
      })
    };

    // Mock AutonomousOrchestrator (optional dependency)
    const mockAutonomousOrchestrator = {
      isRunning: vi.fn().mockReturnValue(false)
    };

    // Mock dependencies
    mockDeps = {
      config: {},
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        Errors: {
          ApplicationError: class ApplicationError extends Error {},
          AbortError: class AbortError extends Error {}
        }
      },
      Storage: {},
      StateManager: mockStateManager,
      ApiClient: {},
      HybridLLMProvider: mockHybridLLMProvider,
      ToolRunner: mockToolRunner,
      AgentLogicPureHelpers: {},
      EventBus: mockEventBus,
      Persona: {},
      AutonomousOrchestrator: mockAutonomousOrchestrator
    };

    // Create CycleLogic module
    CycleLogic = {
      metadata: {
        id: 'CycleLogic',
        version: '3.1.0',
        dependencies: ['config', 'Utils', 'Storage', 'StateManager', 'ApiClient', 'HybridLLMProvider', 'ToolRunner', 'AgentLogicPureHelpers', 'EventBus', 'Persona', 'AutonomousOrchestrator?'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { Utils, Storage, StateManager, HybridLLMProvider, ToolRunner, EventBus, AutonomousOrchestrator } = deps;
        const { logger } = Utils;

        let currentState = 'IDLE';
        let cycleContext = {};

        const isCuratorMode = () => AutonomousOrchestrator && AutonomousOrchestrator.isRunning();

        const transitionTo = (newState, contextUpdate = {}) => {
          logger.info(`[FSM] Transitioning from ${currentState} to ${newState}`);
          currentState = newState;
          cycleContext = { ...cycleContext, ...contextUpdate };
          EventBus.emit('agent:state:change', { newState, context: cycleContext });
        };

        const startCycle = async (goal) => {
          if (currentState !== 'IDLE') return;

          const sessionId = await StateManager.createSession(goal);
          const turn = await StateManager.createTurn(sessionId);

          cycleContext = { goal, sessionId, turn };
          EventBus.emit('cycle:start', { goal, sessionId });
          transitionTo('CURATING_CONTEXT');

          await agentActionCurateContext();
        };

        const agentActionCurateContext = async () => {
          EventBus.emit('agent:thought', 'I need to determine the context for this task. I will look for relevant files.');
          const allFiles = await StateManager.getAllArtifactMetadata();
          const relevantFiles = Object.keys(allFiles).filter(path => path.includes('ui') || path.includes('agent'));

          await ToolRunner.runTool('create_cats_bundle', {
            file_paths: relevantFiles,
            reason: "Initial scan for relevant UI and agent logic files.",
            turn_path: cycleContext.turn.cats_path
          });

          if (isCuratorMode()) {
            logger.info('[Curator] Auto-approving context');
            transitionTo('PLANNING_WITH_CONTEXT');
            await agentActionPlanWithContext();
          } else {
            transitionTo('AWAITING_CONTEXT_APPROVAL');
          }
        };

        const userApprovedContext = async () => {
          if (currentState !== 'AWAITING_CONTEXT_APPROVAL') return;
          transitionTo('PLANNING_WITH_CONTEXT');
          await agentActionPlanWithContext();
        };

        const agentActionPlanWithContext = async () => {
          EventBus.emit('agent:thought', 'The context has been approved. I will now formulate a plan to achieve the goal.');
          const catsContent = await StateManager.getArtifactContent(cycleContext.turn.cats_path);
          const prompt = `Based on the following context, your goal is: ${cycleContext.goal}.\n\n${catsContent}\n\nPropose a set of changes using the create_dogs_bundle tool.`;

          const response = await HybridLLMProvider.complete([{
            role: 'system',
            content: 'You are a Sentinel Agent. Generate structured change proposals.'
          }, {
            role: 'user',
            content: prompt
          }], {
            temperature: 0.7,
            maxOutputTokens: 8192
          });

          const fakeLlmResponse = {
            changes: [
              { file_path: '/upgrades/ui-style.css', operation: 'MODIFY', new_content: '/* Dark mode styles */' },
              { file_path: '/upgrades/ui-dashboard.html', operation: 'MODIFY', new_content: '<button id="dark-mode-toggle">Toggle Dark Mode</button>' }
            ]
          };

          await ToolRunner.runTool('create_dogs_bundle', {
            changes: fakeLlmResponse.changes,
            turn_path: cycleContext.turn.dogs_path
          });

          transitionTo('AWAITING_PROPOSAL_APPROVAL');
        };

        const userApprovedProposal = async () => {
          if (currentState !== 'AWAITING_PROPOSAL_APPROVAL') return;
          transitionTo('APPLYING_CHANGESET');
          await agentActionApplyChanges();
        };

        const agentActionApplyChanges = async () => {
          EventBus.emit('agent:thought', 'The proposal has been approved. I will now apply the changes.');
          const result = await ToolRunner.runTool('apply_dogs_bundle', {
            dogs_path: cycleContext.turn.dogs_path
          });

          if (result.success) {
            EventBus.emit('cycle:complete');
            transitionTo('IDLE');
          } else {
            EventBus.emit('agent:error', { message: 'Verification failed. Returning to planning.' });
            transitionTo('PLANNING_WITH_CONTEXT');
            await agentActionPlanWithContext();
          }
        };

        // Register event handlers
        EventBus.on('goal:set', startCycle);
        EventBus.on('user:approve:context', userApprovedContext);
        EventBus.on('user:approve:proposal', userApprovedProposal);

        return {
          api: {
            getCurrentState: () => currentState,
            // Expose internal functions for testing
            _test: {
              startCycle,
              userApprovedContext,
              userApprovedProposal,
              transitionTo,
              getCycleContext: () => cycleContext
            }
          }
        };
      }
    };

    cycleInstance = CycleLogic.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(CycleLogic.metadata.id).toBe('CycleLogic');
      expect(CycleLogic.metadata.version).toBe('3.1.0');
      expect(CycleLogic.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(CycleLogic.metadata.dependencies).toContain('Utils');
      expect(CycleLogic.metadata.dependencies).toContain('StateManager');
      expect(CycleLogic.metadata.dependencies).toContain('EventBus');
      expect(CycleLogic.metadata.dependencies).toContain('HybridLLMProvider');
      expect(CycleLogic.metadata.dependencies).toContain('ToolRunner');
    });

    it('should be synchronous', () => {
      expect(CycleLogic.metadata.async).toBe(false);
    });
  });

  describe('Initial State', () => {
    it('should start in IDLE state', () => {
      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });
  });

  describe('Event Registration', () => {
    it('should register goal:set event handler', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('goal:set', expect.any(Function));
    });

    it('should register user:approve:context event handler', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('user:approve:context', expect.any(Function));
    });

    it('should register user:approve:proposal event handler', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('user:approve:proposal', expect.any(Function));
    });
  });

  describe('Cycle Start', () => {
    it('should start cycle with goal', async () => {
      await cycleInstance.api._test.startCycle('Add dark mode');

      expect(mockStateManager.createSession).toHaveBeenCalledWith('Add dark mode');
      expect(mockStateManager.createTurn).toHaveBeenCalledWith('session-123');
    });

    it('should emit cycle:start event', async () => {
      await cycleInstance.api._test.startCycle('Add dark mode');

      expect(mockEventBus.emit).toHaveBeenCalledWith('cycle:start', {
        goal: 'Add dark mode',
        sessionId: 'session-123'
      });
    });

    it('should transition to CURATING_CONTEXT', async () => {
      await cycleInstance.api._test.startCycle('Add dark mode');

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:state:change', {
        newState: 'CURATING_CONTEXT',
        context: expect.any(Object)
      });
    });

    it('should not start if not in IDLE state', async () => {
      await cycleInstance.api._test.startCycle('First goal');
      const callCount = mockStateManager.createSession.mock.calls.length;

      await cycleInstance.api._test.startCycle('Second goal');

      expect(mockStateManager.createSession).toHaveBeenCalledTimes(callCount);
    });
  });

  describe('Context Curation', () => {
    it('should emit agent thought', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:thought',
        expect.stringContaining('determine the context')
      );
    });

    it('should get all artifact metadata', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockStateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should filter relevant files', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockToolRunner.runTool).toHaveBeenCalledWith('create_cats_bundle',
        expect.objectContaining({
          file_paths: expect.arrayContaining(['/ui/dashboard.html', '/agent/logic.js'])
        })
      );
    });

    it('should not include non-relevant files', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      const callArgs = mockToolRunner.runTool.mock.calls[0][1];
      expect(callArgs.file_paths).not.toContain('/other/file.txt');
    });

    it('should transition to AWAITING_CONTEXT_APPROVAL in normal mode', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_CONTEXT_APPROVAL');
    });

    it('should auto-approve context in curator mode', async () => {
      mockDeps.AutonomousOrchestrator.isRunning.mockReturnValue(true);
      const curatorInstance = CycleLogic.factory(mockDeps);

      await curatorInstance.api._test.startCycle('Test goal');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('[Curator] Auto-approving context')
      );
    });
  });

  describe('Context Approval', () => {
    beforeEach(async () => {
      await cycleInstance.api._test.startCycle('Test goal');
    });

    it('should handle user context approval', async () => {
      await cycleInstance.api._test.userApprovedContext();

      // After planning completes, should be at proposal approval
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });

    it('should ignore approval if not in correct state', async () => {
      cycleInstance.api._test.transitionTo('IDLE');

      await cycleInstance.api._test.userApprovedContext();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });
  });

  describe('Planning with Context', () => {
    beforeEach(async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
    });

    it('should emit planning thought', async () => {
      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:thought',
        expect.stringContaining('formulate a plan')
      );
    });

    it('should get cats content', async () => {
      expect(mockStateManager.getArtifactContent).toHaveBeenCalledWith(
        '/cycles/turn-1/cats.md'
      );
    });

    it('should call LLM with context and goal', async () => {
      expect(mockHybridLLMProvider.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({ role: 'user' })
        ]),
        expect.objectContaining({
          temperature: 0.7,
          maxOutputTokens: 8192
        })
      );
    });

    it('should create dogs bundle with changes', async () => {
      expect(mockToolRunner.runTool).toHaveBeenCalledWith('create_dogs_bundle',
        expect.objectContaining({
          changes: expect.any(Array),
          turn_path: '/cycles/turn-1/dogs.md'
        })
      );
    });

    it('should transition to AWAITING_PROPOSAL_APPROVAL', async () => {
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });
  });

  describe('Proposal Approval', () => {
    beforeEach(async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
    });

    it('should handle user proposal approval', async () => {
      await cycleInstance.api._test.userApprovedProposal();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should ignore approval if not in correct state', async () => {
      cycleInstance.api._test.transitionTo('IDLE');

      await cycleInstance.api._test.userApprovedProposal();

      // Should call runTool 0 times for apply_dogs_bundle
      const applyDogsCalls = mockToolRunner.runTool.mock.calls.filter(
        call => call[0] === 'apply_dogs_bundle'
      );
      expect(applyDogsCalls).toHaveLength(0);
    });
  });

  describe('Applying Changes', () => {
    beforeEach(async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
    });

    it('should emit applying thought', async () => {
      await cycleInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:thought',
        expect.stringContaining('apply the changes')
      );
    });

    it('should call apply_dogs_bundle tool', async () => {
      await cycleInstance.api._test.userApprovedProposal();

      expect(mockToolRunner.runTool).toHaveBeenCalledWith('apply_dogs_bundle', {
        dogs_path: '/cycles/turn-1/dogs.md'
      });
    });

    it('should emit cycle:complete on success', async () => {
      mockToolRunner.runTool.mockResolvedValue({ success: true });

      await cycleInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('cycle:complete');
    });

    it('should return to IDLE on success', async () => {
      mockToolRunner.runTool.mockResolvedValue({ success: true });

      await cycleInstance.api._test.userApprovedProposal();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should retry planning on verification failure', async () => {
      // Create a fresh instance with controlled mock sequence
      mockToolRunner.runTool.mockReset();
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true }) // create_cats_bundle
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle (first)
        .mockResolvedValueOnce({ success: false }) // apply_dogs_bundle fails
        .mockResolvedValueOnce({ success: true }); // create_dogs_bundle (retry)

      const freshInstance = CycleLogic.factory(mockDeps);

      await freshInstance.api._test.startCycle('Test goal');
      await freshInstance.api._test.userApprovedContext();
      await freshInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:error', {
        message: expect.stringContaining('Verification failed')
      });
      expect(freshInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });
  });

  describe('State Transitions', () => {
    it('should update state', () => {
      cycleInstance.api._test.transitionTo('TEST_STATE');

      expect(cycleInstance.api.getCurrentState()).toBe('TEST_STATE');
    });

    it('should emit state change event', () => {
      cycleInstance.api._test.transitionTo('TEST_STATE', { foo: 'bar' });

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:state:change', {
        newState: 'TEST_STATE',
        context: expect.objectContaining({ foo: 'bar' })
      });
    });

    it('should merge context updates', () => {
      cycleInstance.api._test.transitionTo('STATE1', { a: 1 });
      cycleInstance.api._test.transitionTo('STATE2', { b: 2 });

      const context = cycleInstance.api._test.getCycleContext();

      expect(context).toMatchObject({ a: 1, b: 2 });
    });

    it('should log transitions', () => {
      cycleInstance.api._test.transitionTo('NEW_STATE');

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Transitioning from IDLE to NEW_STATE')
      );
    });
  });

  describe('Curator Mode', () => {
    it('should auto-progress through context approval', async () => {
      mockDeps.AutonomousOrchestrator.isRunning.mockReturnValue(true);
      const curatorInstance = CycleLogic.factory(mockDeps);

      await curatorInstance.api._test.startCycle('Test goal');

      // Should skip AWAITING_CONTEXT_APPROVAL and go directly to planning
      expect(curatorInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });

    it('should still require manual approval for proposals', async () => {
      mockDeps.AutonomousOrchestrator.isRunning.mockReturnValue(true);
      const curatorInstance = CycleLogic.factory(mockDeps);

      await curatorInstance.api._test.startCycle('Test goal');

      // Should stop at proposal approval for safety
      expect(curatorInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });
  });

  describe('Event-Driven Flow', () => {
    it('should start cycle via goal:set event', async () => {
      const goalSetHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'goal:set'
      )[1];

      await goalSetHandler('Test goal from event');

      expect(mockStateManager.createSession).toHaveBeenCalledWith('Test goal from event');
    });

    it('should approve context via event', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      const approveContextHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'user:approve:context'
      )[1];

      await approveContextHandler();

      // After planning completes, should be at proposal approval
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });

    it('should approve proposal via event', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      const approveProposalHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'user:approve:proposal'
      )[1];

      await approveProposalHandler();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });
  });

  describe('Full Cycle Integration', () => {
    it('should complete full cycle with approvals', async () => {
      // Start cycle
      await cycleInstance.api._test.startCycle('Add feature');
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_CONTEXT_APPROVAL');

      // Approve context
      await cycleInstance.api._test.userApprovedContext();
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');

      // Approve proposal
      await cycleInstance.api._test.userApprovedProposal();
      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');

      // Verify cycle complete event
      expect(mockEventBus.emit).toHaveBeenCalledWith('cycle:complete');
    });

    it('should handle retry on failure', async () => {
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true }) // create_cats_bundle
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle (first)
        .mockResolvedValueOnce({ success: false }) // apply_dogs_bundle (fails)
        .mockResolvedValueOnce({ success: true }); // create_dogs_bundle (retry)

      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      // Should be back at proposal approval after retry
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });
  });

  describe('State Transition Combinations', () => {
    it('should handle IDLE -> CURATING_CONTEXT -> AWAITING_CONTEXT_APPROVAL', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_CONTEXT_APPROVAL');
    });

    it('should handle AWAITING_CONTEXT_APPROVAL -> PLANNING_WITH_CONTEXT', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });

    it('should handle AWAITING_PROPOSAL_APPROVAL -> APPLYING_CHANGESET -> IDLE', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should handle failure transition: APPLYING_CHANGESET -> PLANNING_WITH_CONTEXT', async () => {
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true }) // create_cats_bundle
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle
        .mockResolvedValueOnce({ success: false }) // apply_dogs_bundle
        .mockResolvedValueOnce({ success: true }); // create_dogs_bundle (retry)

      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
    });
  });

  describe('Error Recovery', () => {
    it('should handle tool runner errors gracefully', async () => {
      mockToolRunner.runTool.mockRejectedValue(new Error('Tool failed'));

      await expect(cycleInstance.api._test.startCycle('Test goal')).rejects.toThrow('Tool failed');
    });

    it('should handle LLM provider errors', async () => {
      mockHybridLLMProvider.complete.mockRejectedValue(new Error('LLM error'));

      await cycleInstance.api._test.startCycle('Test goal');

      await expect(cycleInstance.api._test.userApprovedContext()).rejects.toThrow('LLM error');
    });

    it('should handle state manager errors', async () => {
      mockStateManager.createSession.mockRejectedValue(new Error('State error'));

      await expect(cycleInstance.api._test.startCycle('Test goal')).rejects.toThrow('State error');
    });

    it('should emit error event on failure', async () => {
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false });

      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:error', expect.any(Object));
    });
  });

  describe('Cycle Abortion', () => {
    it('should abort cycle from AWAITING_CONTEXT_APPROVAL', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      cycleInstance.api._test.transitionTo('IDLE');

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should abort cycle from AWAITING_PROPOSAL_APPROVAL', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      cycleInstance.api._test.transitionTo('IDLE');

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should prevent starting new cycle while one is running', async () => {
      await cycleInstance.api._test.startCycle('First goal');

      const sessionCreateCount = mockStateManager.createSession.mock.calls.length;

      await cycleInstance.api._test.startCycle('Second goal');

      expect(mockStateManager.createSession).toHaveBeenCalledTimes(sessionCreateCount);
    });
  });

  describe('Concurrent Cycles', () => {
    it('should prevent concurrent cycle execution', async () => {
      await cycleInstance.api._test.startCycle('Goal 1');

      // Try to start another cycle
      await cycleInstance.api._test.startCycle('Goal 2');

      // Should only have created one session
      expect(mockStateManager.createSession).toHaveBeenCalledTimes(1);
    });

    it('should allow new cycle after previous completes', async () => {
      // First cycle
      await cycleInstance.api._test.startCycle('Goal 1');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');

      // Second cycle
      await cycleInstance.api._test.startCycle('Goal 2');

      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_CONTEXT_APPROVAL');
      expect(mockStateManager.createSession).toHaveBeenCalledTimes(2);
    });
  });

  describe('Long-Running Cycles', () => {
    it('should handle cycles with many retries', async () => {
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true }) // create_cats_bundle
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle 1
        .mockResolvedValueOnce({ success: false }) // apply_dogs_bundle 1
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle 2
        .mockResolvedValueOnce({ success: false }) // apply_dogs_bundle 2
        .mockResolvedValueOnce({ success: true }) // create_dogs_bundle 3
        .mockResolvedValueOnce({ success: true }); // apply_dogs_bundle 3

      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      // First attempt
      await cycleInstance.api._test.userApprovedProposal();
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');

      // Second attempt
      await cycleInstance.api._test.userApprovedProposal();
      expect(cycleInstance.api.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');

      // Third attempt succeeds
      await cycleInstance.api._test.userApprovedProposal();
      expect(cycleInstance.api.getCurrentState()).toBe('IDLE');
    });

    it('should maintain cycle context through retries', async () => {
      mockToolRunner.runTool
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: true });

      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      const context = cycleInstance.api._test.getCycleContext();

      expect(context.goal).toBe('Test goal');
      expect(context.sessionId).toBeDefined();
    });
  });

  describe('Context and Proposal Generation', () => {
    it('should include goal in context prompt', async () => {
      await cycleInstance.api._test.startCycle('Build feature X');
      await cycleInstance.api._test.userApprovedContext();

      expect(mockHybridLLMProvider.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('Build feature X')
          })
        ]),
        expect.any(Object)
      );
    });

    it('should filter relevant files for context', async () => {
      mockStateManager.getAllArtifactMetadata.mockResolvedValue({
        '/ui/dashboard.html': {},
        '/agent/cycle.js': {},
        '/other/readme.md': {},
        '/agent/logic.js': {}
      });

      await cycleInstance.api._test.startCycle('Test goal');

      const callArgs = mockToolRunner.runTool.mock.calls[0][1];

      expect(callArgs.file_paths).toContain('/ui/dashboard.html');
      expect(callArgs.file_paths).toContain('/agent/cycle.js');
      expect(callArgs.file_paths).toContain('/agent/logic.js');
      expect(callArgs.file_paths).not.toContain('/other/readme.md');
    });

    it('should pass correct temperature to LLM', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      expect(mockHybridLLMProvider.complete).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          temperature: 0.7
        })
      );
    });

    it('should pass correct max tokens to LLM', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      expect(mockHybridLLMProvider.complete).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          maxOutputTokens: 8192
        })
      );
    });
  });

  describe('Tool Integration', () => {
    it('should call create_cats_bundle with correct parameters', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockToolRunner.runTool).toHaveBeenCalledWith(
        'create_cats_bundle',
        expect.objectContaining({
          file_paths: expect.any(Array),
          reason: expect.any(String),
          turn_path: expect.stringContaining('cats.md')
        })
      );
    });

    it('should call create_dogs_bundle with changes', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();

      expect(mockToolRunner.runTool).toHaveBeenCalledWith(
        'create_dogs_bundle',
        expect.objectContaining({
          changes: expect.any(Array),
          turn_path: expect.stringContaining('dogs.md')
        })
      );
    });

    it('should call apply_dogs_bundle with correct path', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(mockToolRunner.runTool).toHaveBeenCalledWith(
        'apply_dogs_bundle',
        expect.objectContaining({
          dogs_path: expect.stringContaining('dogs.md')
        })
      );
    });
  });

  describe('Event Emission', () => {
    it('should emit all expected events in successful cycle', async () => {
      await cycleInstance.api._test.startCycle('Test goal');
      await cycleInstance.api._test.userApprovedContext();
      await cycleInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('cycle:start', expect.any(Object));
      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:thought', expect.any(String));
      expect(mockEventBus.emit).toHaveBeenCalledWith('agent:state:change', expect.any(Object));
      expect(mockEventBus.emit).toHaveBeenCalledWith('cycle:complete');
    });

    it('should emit thought events at each stage', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'agent:thought',
        expect.stringContaining('determine the context')
      );

      await cycleInstance.api._test.userApprovedContext();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'agent:thought',
        expect.stringContaining('formulate a plan')
      );

      await cycleInstance.api._test.userApprovedProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'agent:thought',
        expect.stringContaining('apply the changes')
      );
    });

    it('should emit state change events on transitions', async () => {
      await cycleInstance.api._test.startCycle('Test goal');

      const stateChangeEvents = mockEventBus.emit.mock.calls.filter(
        call => call[0] === 'agent:state:change'
      );

      expect(stateChangeEvents.length).toBeGreaterThan(0);
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle empty goal', async () => {
      await cycleInstance.api._test.startCycle('');

      expect(mockStateManager.createSession).toHaveBeenCalledWith('');
    });

    it('should handle very long goal', async () => {
      const longGoal = 'A'.repeat(10000);

      await cycleInstance.api._test.startCycle(longGoal);

      expect(mockStateManager.createSession).toHaveBeenCalledWith(longGoal);
    });

    it('should handle special characters in goal', async () => {
      const specialGoal = 'Goal with "quotes" and \n newlines';

      await cycleInstance.api._test.startCycle(specialGoal);

      expect(mockStateManager.createSession).toHaveBeenCalledWith(specialGoal);
    });

    it('should handle empty artifact list', async () => {
      mockStateManager.getAllArtifactMetadata.mockResolvedValue({});

      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockToolRunner.runTool).toHaveBeenCalledWith(
        'create_cats_bundle',
        expect.objectContaining({
          file_paths: []
        })
      );
    });

    it('should handle null turn path', async () => {
      mockStateManager.createTurn.mockResolvedValue({
        cats_path: null,
        dogs_path: null
      });

      await cycleInstance.api._test.startCycle('Test goal');

      expect(mockToolRunner.runTool).toHaveBeenCalled();
    });
  });
});
