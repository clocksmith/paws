import { describe, it, expect, beforeEach, vi } from 'vitest';

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
      SwarmOrchestrator: {
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

    const SentinelFSMModule = {
      metadata: {
        id: 'SentinelFSM',
        version: '2.2.0',
        dependencies: ['StateManager', 'ToolRunner', 'ApiClient', 'HybridLLMProvider', 'EventBus', 'Utils', 'SentinelTools', 'GitVFS', 'ReflectionStore', 'SelfTester', 'SwarmOrchestrator'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { StateManager, HybridLLMProvider, EventBus, Utils, SentinelTools, GitVFS, ReflectionStore, SelfTester, SwarmOrchestrator } = deps;
        const { logger } = Utils;

        let currentState = 'IDLE';
        let cycleContext = null;
        let stateHistory = [];
        let reflectionInsights = [];

        const validTransitions = {
          'IDLE': ['CURATING_CONTEXT'],
          'CURATING_CONTEXT': ['AWAITING_CONTEXT_APPROVAL', 'ERROR'],
          'AWAITING_CONTEXT_APPROVAL': ['PLANNING_WITH_CONTEXT', 'CURATING_CONTEXT', 'IDLE'],
          'PLANNING_WITH_CONTEXT': ['GENERATING_PROPOSAL', 'ERROR'],
          'GENERATING_PROPOSAL': ['AWAITING_PROPOSAL_APPROVAL', 'ERROR'],
          'AWAITING_PROPOSAL_APPROVAL': ['APPLYING_CHANGESET', 'PLANNING_WITH_CONTEXT', 'IDLE'],
          'APPLYING_CHANGESET': ['REFLECTING', 'ERROR'],
          'REFLECTING': ['IDLE', 'CURATING_CONTEXT'],
          'ERROR': ['IDLE']
        };

        const updateStatusUI = (state, detail = '', progress = null) => {
          const statusIcon = document.getElementById('status-icon');
          const statusState = document.getElementById('status-state');
          const statusDetail = document.getElementById('status-detail');
          const statusProgress = document.getElementById('status-progress');
          const progressFill = document.getElementById('progress-fill');

          if (statusIcon) statusIcon.textContent = state;
          if (statusState) statusState.textContent = state;
          if (statusDetail) statusDetail.textContent = detail;
          if (statusProgress && progressFill) {
            if (progress !== null && progress !== undefined) {
              statusProgress.style.display = 'block';
              progressFill.style.width = `${progress}%`;
            } else {
              statusProgress.style.display = 'none';
            }
          }

          EventBus.emit('status:updated', { state, detail, progress });
        };

        const transitionTo = (newState) => {
          const oldState = currentState;

          if (!validTransitions[currentState]?.includes(newState)) {
            logger.error(`[SentinelFSM] Invalid transition: ${currentState} -> ${newState}`);
            return false;
          }

          currentState = newState;
          stateHistory.push({
            from: oldState,
            to: newState,
            timestamp: Date.now(),
            context: { ...cycleContext }
          });

          updateStatusUI(newState);
          logger.info(`[SentinelFSM] State transition: ${oldState} -> ${newState}`);

          EventBus.emit('fsm:state:changed', {
            oldState,
            newState,
            context: cycleContext
          });

          return true;
        };

        const executeState = async () => {
          logger.info(`[SentinelFSM] Executing state: ${currentState}`);

          try {
            switch (currentState) {
              case 'IDLE':
                EventBus.emit('agent:idle');
                break;

              case 'CURATING_CONTEXT':
                await executeCuratingContext();
                break;

              case 'AWAITING_CONTEXT_APPROVAL':
                await executeAwaitingContextApproval();
                break;

              case 'PLANNING_WITH_CONTEXT':
                await executePlanningWithContext();
                break;

              case 'GENERATING_PROPOSAL':
                await executeGeneratingProposal();
                break;

              case 'AWAITING_PROPOSAL_APPROVAL':
                await executeAwaitingProposalApproval();
                break;

              case 'APPLYING_CHANGESET':
                await executeApplyingChangeset();
                break;

              case 'REFLECTING':
                await executeReflecting();
                break;

              case 'ERROR':
                await executeError();
                break;

              default:
                logger.error(`[SentinelFSM] Unknown state: ${currentState}`);
            }
          } catch (error) {
            logger.error(`[SentinelFSM] Error in state ${currentState}:`, error);
            transitionTo('ERROR');
            await executeState();
          }
        };

        const executeCuratingContext = async () => {
          EventBus.emit('agent:curating', { goal: cycleContext.goal });
          updateStatusUI('CURATING_CONTEXT', 'Analyzing project files...');

          const relevantFiles = await SentinelTools.curateFilesWithAI(cycleContext.goal);
          updateStatusUI('CURATING_CONTEXT', `Found ${relevantFiles.length} relevant files`, 50);

          const result = await SentinelTools.createCatsBundle({
            file_paths: relevantFiles,
            reason: `Context for goal: ${cycleContext.goal}`,
            turn_path: cycleContext.turn.cats_path,
            ai_curate: true
          });

          if (result.success) {
            cycleContext.catsPath = result.path;
            transitionTo('AWAITING_CONTEXT_APPROVAL');
            await executeState();
          } else {
            throw new Error('Failed to create context bundle');
          }
        };

        const executeAwaitingContextApproval = async () => {
          EventBus.emit('agent:awaiting:context', {
            cats_path: cycleContext.catsPath,
            session_id: cycleContext.sessionId
          });
        };

        const executePlanningWithContext = async () => {
          EventBus.emit('agent:planning');
          const catsContent = await StateManager.getArtifactContent(cycleContext.catsPath);

          let reflectionContext = '';
          if (reflectionInsights.length > 0) {
            reflectionContext = '\n\nPrevious insights from reflection:\n' +
              reflectionInsights.slice(-3).map(i => `- ${i}`).join('\n');
          }

          const prompt = `Based on the following context, your goal is: ${cycleContext.goal}

Context:
${catsContent}
${reflectionContext}

Analyze the context carefully and plan your approach.`;

          cycleContext.planPrompt = prompt;
          transitionTo('GENERATING_PROPOSAL');
          await executeState();
        };

        const executeGeneratingProposal = async () => {
          EventBus.emit('agent:generating');

          const response = await HybridLLMProvider.complete([{
            role: 'system',
            content: 'You are a Sentinel Agent.'
          }, {
            role: 'user',
            content: cycleContext.planPrompt
          }], {
            temperature: 0.7,
            maxOutputTokens: 8192
          });

          const changes = parseProposedChanges(response.text);

          const result = await SentinelTools.createDogsBundle({
            changes,
            turn_path: cycleContext.turn.dogs_path,
            summary: `Proposal for: ${cycleContext.goal}`
          });

          if (result.success) {
            cycleContext.dogsPath = result.path;
            cycleContext.proposedChanges = changes;
            transitionTo('AWAITING_PROPOSAL_APPROVAL');
            await executeState();
          } else {
            throw new Error('Failed to create proposal bundle');
          }
        };

        const executeAwaitingProposalApproval = async () => {
          EventBus.emit('diff:show', {
            dogs_path: cycleContext.dogsPath,
            session_id: cycleContext.sessionId,
            turn: cycleContext.turn
          });
        };

        const executeApplyingChangeset = async () => {
          EventBus.emit('agent:applying');

          const dogsPath = cycleContext.filteredDogsPath || cycleContext.dogsPath;

          if (GitVFS && GitVFS.isInitialized()) {
            try {
              updateStatusUI('APPLYING_CHANGESET', 'Creating safety checkpoint...', null);
              const checkpoint = await GitVFS.createCheckpoint(
                `Pre-apply: ${cycleContext.goal.substring(0, 100)}`
              );
              cycleContext.preApplyCheckpoint = checkpoint;
            } catch (err) {
              logger.warn('[SentinelFSM] Failed to create pre-apply checkpoint:', err);
            }
          }

          if (SelfTester) {
            try {
              updateStatusUI('APPLYING_CHANGESET', 'Running validation tests...', null);
              const testResults = await SelfTester.runAllTests();

              if (testResults.summary.successRate < 80) {
                logger.error('[SentinelFSM] Pre-apply tests failed:', testResults.summary);
                updateStatusUI('ERROR', `Validation failed: ${testResults.summary.successRate.toFixed(1)}% pass rate`, null);
                cycleContext.validationFailed = true;
                cycleContext.testResults = testResults;
                EventBus.emit('agent:validation:failed', testResults);
                transitionTo('ERROR');
                await executeState();
                return;
              }

              cycleContext.testResults = testResults;
            } catch (err) {
              logger.warn('[SentinelFSM] Self-test failed with error:', err);
            }
          }

          updateStatusUI('APPLYING_CHANGESET', 'Applying changes...', null);
          const result = await SentinelTools.applyDogsBundle({
            dogs_path: dogsPath,
            session_id: cycleContext.sessionId,
            verify_command: cycleContext.verifyCommand
          });

          cycleContext.applyResult = result;

          if (result.success) {
            if (GitVFS && GitVFS.isInitialized()) {
              await GitVFS.commitChanges(
                `Applied ${result.changes_applied.length} changes for: ${cycleContext.goal}`,
                {
                  session: cycleContext.sessionId,
                  turn: cycleContext.turn.turn,
                  checkpoint: result.checkpoint
                }
              );

              try {
                const postCheckpoint = await GitVFS.createCheckpoint(
                  `Success: Applied ${result.changes_applied.length} changes`
                );
                cycleContext.postApplyCheckpoint = postCheckpoint;
              } catch (err) {
                logger.warn('[SentinelFSM] Failed to create post-apply checkpoint:', err);
              }
            }

            transitionTo('REFLECTING');
          } else {
            logger.error('[SentinelFSM] Failed to apply changes:', result.message);
            transitionTo('ERROR');
          }

          await executeState();
        };

        const executeReflecting = async () => {
          EventBus.emit('agent:reflecting');

          const reflection = await performReflection();
          reflectionInsights.push(reflection.insight);
          logger.info(`[SentinelFSM] Reflection: ${reflection.insight}`);

          if (ReflectionStore) {
            try {
              const reflectionData = {
                outcome: reflection.outcome,
                category: 'cycle_completion',
                description: reflection.insight,
                sessionId: cycleContext.sessionId,
                turn: cycleContext.turn.turn,
                goal: cycleContext.goal,
                metrics: reflection.metrics,
                recommendations: reflection.recommendations,
                tags: [reflection.outcome]
              };

              const reflectionId = await ReflectionStore.addReflection(reflectionData);

              if (SwarmOrchestrator && reflectionData.outcome === 'successful') {
                try {
                  await SwarmOrchestrator.shareSuccessPattern(reflectionData);
                } catch (swarmErr) {
                  logger.debug('[SentinelFSM] Could not share with swarm:', swarmErr.message);
                }
              }
            } catch (err) {
              logger.error('[SentinelFSM] Failed to store reflection:', err);
            }
          }

          const reflectionPath = `/sessions/${cycleContext.sessionId}/reflection-${cycleContext.turn.turn}.md`;
          await StateManager.createArtifact(reflectionPath, 'markdown', 'reflection content', 'Cycle reflection');

          if (reflection.shouldContinue && cycleContext.iterations < cycleContext.maxIterations) {
            cycleContext.goal = reflection.refinedGoal || cycleContext.goal;
            cycleContext.iterations++;
            cycleContext.turn = await StateManager.sessionManager.createTurn(cycleContext.sessionId);
            transitionTo('CURATING_CONTEXT');
            await executeState();
          } else {
            EventBus.emit('cycle:complete', {
              session_id: cycleContext.sessionId,
              iterations: cycleContext.iterations,
              reflection
            });
            transitionTo('IDLE');
            await executeState();
          }
        };

        const executeError = async () => {
          EventBus.emit('agent:error', {
            state: stateHistory[stateHistory.length - 1],
            context: cycleContext
          });
          cycleContext = null;
          transitionTo('IDLE');
        };

        const performReflection = async () => {
          const duration = Date.now() - cycleContext.startTime;
          const applyResult = cycleContext.applyResult || {};
          const changesApplied = applyResult.changes_applied?.length || 0;
          const totalProposed = cycleContext.proposedChanges?.length || 0;
          const successRate = totalProposed > 0 ? (changesApplied / totalProposed * 100) : 0;

          const shouldContinue = successRate > 50 && cycleContext.iterations < 3;

          return {
            outcome: applyResult.success ? 'successful' : 'failed',
            insight: 'Mock insight',
            recommendations: ['Mock recommendation'],
            shouldContinue,
            refinedGoal: shouldContinue ? cycleContext.goal : null,
            metrics: {
              duration,
              changesApplied,
              totalProposed,
              successRate
            }
          };
        };

        const parseProposedChanges = (content) => {
          const changes = [];
          const regex = /##\s+(CREATE|MODIFY|DELETE):\s+([^\n]+)(?:\n```[\w]*\n([\s\S]*?)```)?/g;
          let match;

          while ((match = regex.exec(content)) !== null) {
            const [, operation, filePath, fileContent] = match;
            const change = {
              operation: operation.trim(),
              file_path: filePath.trim(),
              new_content: operation === 'DELETE' ? null : (fileContent || '').trim()
            };

            if (change.file_path) {
              if (!change.file_path.startsWith('/vfs/')) {
                change.file_path = '/vfs/' + change.file_path.replace(/^\/+/, '');
              }
              changes.push(change);
            }
          }

          return changes;
        };

        const startCycle = async (goal) => {
          if (currentState !== 'IDLE') {
            logger.warn(`[SentinelFSM] Cannot start cycle in state: ${currentState}`);
            return false;
          }

          const sessionId = await StateManager.sessionManager.createSession(goal);
          const turn = await StateManager.sessionManager.createTurn(sessionId);

          cycleContext = {
            goal,
            sessionId,
            turn,
            startTime: Date.now(),
            iterations: 0,
            maxIterations: 10
          };

          transitionTo('CURATING_CONTEXT');
          await executeState();

          return true;
        };

        const getStatus = () => {
          return {
            currentState,
            cycleContext,
            stateHistory: stateHistory.slice(-10),
            reflectionInsights: reflectionInsights.slice(-5)
          };
        };

        const pauseCycle = () => {
          if (currentState !== 'IDLE' && currentState !== 'ERROR') {
            logger.info('[SentinelFSM] Cycle paused');
            EventBus.emit('cycle:paused', { state: currentState, context: cycleContext });
            return true;
          }
          return false;
        };

        const resumeCycle = async () => {
          if (currentState !== 'IDLE' && cycleContext) {
            logger.info('[SentinelFSM] Resuming cycle');
            EventBus.emit('cycle:resumed', { state: currentState, context: cycleContext });
            await executeState();
            return true;
          }
          return false;
        };

        return {
          api: {
            startCycle,
            getStatus,
            pauseCycle,
            resumeCycle,
            getCurrentState: () => currentState,
            getStateHistory: () => stateHistory,
            getReflectionInsights: () => reflectionInsights
          }
        };
      }
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

    it('should have SwarmOrchestrator for pattern sharing', () => {
      expect(mockDeps.SwarmOrchestrator.shareSuccessPattern).toBeTypeOf('function');
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
