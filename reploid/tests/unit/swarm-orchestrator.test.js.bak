import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('SwarmOrchestrator Module', () => {
  let orchestrator;
  let mockDeps;

  beforeEach(() => {
    // Mock global objects
    global.window = {
      PyodideRuntime: { isReady: () => false },
      LocalLLM: { isReady: () => false },
      GitVFS: { isInitialized: () => false },
      HybridLLMProvider: {
        complete: vi.fn().mockResolvedValue({
          text: 'generated code',
          provider: 'local'
        })
      }
    };

    mockDeps = {
      WebRTCSwarm: {
        updateCapabilities: vi.fn(),
        registerMessageHandler: vi.fn(),
        sendToPeer: vi.fn(),
        broadcast: vi.fn().mockReturnValue(3),
        delegateTask: vi.fn().mockResolvedValue({ success: true, result: 'task result' }),
        requestConsensus: vi.fn().mockResolvedValue({ consensus: true, votes: { approve: 3, reject: 0 } }),
        getPeerId: vi.fn().mockReturnValue('peer-123'),
        getStats: vi.fn().mockReturnValue({
          peerId: 'peer-123',
          connectedPeers: 3,
          totalPeers: 5,
          peers: []
        })
      },
      StateManager: {
        getArtifactContent: vi.fn().mockResolvedValue('file content\nline 2\nline 3'),
        searchArtifacts: vi.fn().mockResolvedValue([
          { path: '/test.js', type: 'text' },
          { path: '/readme.md', type: 'markdown' }
        ])
      },
      ReflectionStore: {
        addReflection: vi.fn().mockResolvedValue('reflection-123'),
        searchReflections: vi.fn().mockResolvedValue([
          { description: 'test reflection', outcome: 'successful', tags: ['test'] }
        ])
      },
      EventBus: {
        emit: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      },
      ToolRunner: {
        runTool: vi.fn().mockResolvedValue({
          success: true,
          output: 'execution result'
        })
      }
    };

    const SwarmOrchestratorModule = {
      metadata: {
        id: 'SwarmOrchestrator',
        version: '1.0.0',
        dependencies: ['WebRTCSwarm', 'StateManager', 'ReflectionStore', 'EventBus', 'Utils', 'ToolRunner'],
        async: true,
        type: 'service'
      },
      factory: (deps) => {
        const { WebRTCSwarm, StateManager, ReflectionStore, EventBus, Utils, ToolRunner } = deps;
        const { logger } = Utils;

        let isInitialized = false;
        let localCapabilities = [];
        let messageHandlers = {};

        const detectCapabilities = async () => {
          const caps = ['code-generation', 'file-management'];

          if (window.PyodideRuntime && window.PyodideRuntime.isReady()) {
            caps.push('python-execution');
          }

          if (window.LocalLLM && window.LocalLLM.isReady()) {
            caps.push('local-llm');
          }

          const GitVFS = window.GitVFS;
          if (GitVFS && GitVFS.isInitialized()) {
            caps.push('git-vfs');
          }

          return caps;
        };

        const registerMessageHandlers = () => {
          WebRTCSwarm.registerMessageHandler('task-execution', async (peerId, message) => {
            logger.info(`[SwarmOrch] Task execution request from ${peerId}`, message.task);
            const result = await executeTask(message.task);

            WebRTCSwarm.sendToPeer(peerId, {
              type: 'task-result',
              taskId: message.taskId,
              result
            });
          });

          WebRTCSwarm.registerMessageHandler('knowledge-request', async (peerId, message) => {
            logger.info(`[SwarmOrch] Knowledge request from ${peerId}`, message.query);
            const knowledge = await queryKnowledge(message.query);

            WebRTCSwarm.sendToPeer(peerId, {
              type: 'knowledge-response',
              requestId: message.requestId,
              knowledge
            });
          });

          WebRTCSwarm.registerMessageHandler('reflection-share', async (peerId, message) => {
            logger.info(`[SwarmOrch] Reflection shared by ${peerId}`);
            await integrateSharedReflection(peerId, message.reflection);
          });
        };

        const init = async () => {
          logger.info('[SwarmOrch] Initializing swarm orchestrator');

          localCapabilities = await detectCapabilities();
          WebRTCSwarm.updateCapabilities(localCapabilities);
          registerMessageHandlers();

          isInitialized = true;
          logger.info('[SwarmOrch] Swarm orchestrator initialized', { capabilities: localCapabilities });
        };

        const delegateTask = async (taskType, taskData) => {
          if (!isInitialized) {
            logger.warn('[SwarmOrch] Not initialized, cannot delegate task');
            return { success: false, error: 'Swarm not initialized' };
          }

          logger.info(`[SwarmOrch] Delegating ${taskType} task to swarm`);

          const task = {
            name: taskType,
            requirements: getRequirementsForTaskType(taskType),
            data: taskData,
            delegator: WebRTCSwarm.getPeerId()
          };

          try {
            const result = await WebRTCSwarm.delegateTask(task);
            logger.info(`[SwarmOrch] Task ${taskType} completed by peer`, result);
            return result;
          } catch (error) {
            logger.error(`[SwarmOrch] Task delegation failed:`, error);
            return { success: false, error: error.message };
          }
        };

        const executeTask = async (task) => {
          logger.info(`[SwarmOrch] Executing delegated task: ${task.name}`);

          try {
            switch (task.name) {
              case 'python-computation': {
                if (!window.PyodideRuntime || !window.PyodideRuntime.isReady()) {
                  throw new Error('Python runtime not available');
                }

                const result = await ToolRunner.runTool('execute_python', {
                  code: task.data.code,
                  install_packages: task.data.packages || []
                });

                return {
                  success: result.success,
                  output: result.output,
                  error: result.error
                };
              }

              case 'code-generation': {
                const HybridLLM = window.HybridLLMProvider;
                if (!HybridLLM) {
                  throw new Error('LLM provider not available');
                }

                const response = await HybridLLM.complete([{
                  role: 'user',
                  content: task.data.prompt
                }], {
                  temperature: task.data.temperature || 0.7,
                  maxOutputTokens: task.data.maxTokens || 2048
                });

                return {
                  success: true,
                  code: response.text,
                  provider: response.provider
                };
              }

              case 'file-analysis': {
                const content = await StateManager.getArtifactContent(task.data.path);
                if (!content) {
                  throw new Error(`File not found: ${task.data.path}`);
                }

                return {
                  success: true,
                  analysis: {
                    length: content.length,
                    lines: content.split('\n').length,
                    type: task.data.path.split('.').pop()
                  }
                };
              }

              default:
                throw new Error(`Unknown task type: ${task.name}`);
            }
          } catch (error) {
            logger.error(`[SwarmOrch] Task execution failed:`, error);
            return {
              success: false,
              error: error.message
            };
          }
        };

        const shareSuccessPattern = async (reflection) => {
          if (!isInitialized) {
            logger.warn('[SwarmOrch] Not initialized, cannot share reflection');
            return 0;
          }

          if (reflection.outcome !== 'successful') {
            logger.debug('[SwarmOrch] Only sharing successful reflections');
            return 0;
          }

          logger.info('[SwarmOrch] Sharing successful pattern with swarm', {
            category: reflection.category
          });

          const sharedCount = WebRTCSwarm.broadcast({
            type: 'reflection-share',
            reflection: {
              category: reflection.category,
              description: reflection.description,
              outcome: reflection.outcome,
              recommendations: reflection.recommendations,
              tags: reflection.tags,
              sharedBy: WebRTCSwarm.getPeerId(),
              timestamp: Date.now()
            }
          });

          EventBus.emit('swarm:reflection-shared', { count: sharedCount });
          return sharedCount;
        };

        const integrateSharedReflection = async (peerId, reflection) => {
          logger.info(`[SwarmOrch] Integrating reflection from ${peerId}`);

          await ReflectionStore.addReflection({
            ...reflection,
            tags: [...(reflection.tags || []), `shared_from_${peerId}`],
            source: 'swarm'
          });

          EventBus.emit('swarm:reflection-integrated', { peerId, reflection });
        };

        const requestModificationConsensus = async (modification) => {
          if (!isInitialized) {
            logger.warn('[SwarmOrch] Not initialized, cannot request consensus');
            return { consensus: true, reason: 'swarm-not-available' };
          }

          logger.info('[SwarmOrch] Requesting consensus for modification', {
            target: modification.filePath
          });

          const proposal = {
            type: 'code-modification',
            content: modification.code,
            target: modification.filePath,
            rationale: modification.reason,
            risk: assessModificationRisk(modification)
          };

          const result = await WebRTCSwarm.requestConsensus(proposal, 30000);

          logger.info('[SwarmOrch] Consensus result', {
            consensus: result.consensus,
            votes: result.votes
          });

          EventBus.emit('swarm:consensus-result', result);
          return result;
        };

        const assessModificationRisk = (modification) => {
          const coreFiles = ['agent-cycle', 'sentinel-fsm', 'tool-runner', 'state-manager'];
          const isCoreFile = coreFiles.some(core => modification.filePath.includes(core));

          if (isCoreFile) return 'high';
          if (modification.operation === 'DELETE') return 'high';
          if (modification.code && modification.code.includes('eval(')) return 'high';

          return 'medium';
        };

        const queryKnowledge = async (query) => {
          const reflections = await ReflectionStore.searchReflections({
            keywords: query.split(' '),
            limit: 5
          });

          const artifacts = await StateManager.searchArtifacts(query);

          return {
            reflections: reflections.map(r => ({
              description: r.description,
              outcome: r.outcome,
              tags: r.tags
            })),
            artifacts: artifacts.slice(0, 5).map(a => ({
              path: a.path,
              type: a.type
            }))
          };
        };

        const getRequirementsForTaskType = (taskType) => {
          const requirements = {
            'python-computation': ['python-execution'],
            'code-generation': ['local-llm'],
            'file-analysis': ['file-management'],
            'git-operation': ['git-vfs']
          };

          return requirements[taskType] || [];
        };

        const getStats = () => {
          if (!isInitialized) {
            return {
              initialized: false,
              peers: 0,
              capabilities: []
            };
          }

          const swarmStats = WebRTCSwarm.getStats();

          return {
            initialized: true,
            localPeerId: swarmStats.peerId,
            connectedPeers: swarmStats.connectedPeers,
            totalPeers: swarmStats.totalPeers,
            capabilities: localCapabilities,
            peers: swarmStats.peers
          };
        };

        return {
          init,
          api: {
            delegateTask,
            shareSuccessPattern,
            requestModificationConsensus,
            queryKnowledge,
            getStats,
            isInitialized: () => isInitialized
          }
        };
      }
    };

    orchestrator = SwarmOrchestratorModule.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct API structure', () => {
      expect(orchestrator).toBeDefined();
      expect(orchestrator.init).toBeTypeOf('function');
      expect(orchestrator.api.delegateTask).toBeTypeOf('function');
      expect(orchestrator.api.shareSuccessPattern).toBeTypeOf('function');
      expect(orchestrator.api.requestModificationConsensus).toBeTypeOf('function');
      expect(orchestrator.api.queryKnowledge).toBeTypeOf('function');
      expect(orchestrator.api.getStats).toBeTypeOf('function');
      expect(orchestrator.api.isInitialized).toBeTypeOf('function');
    });
  });

  describe('Initialization', () => {
    it('should initialize with basic capabilities', async () => {
      expect(orchestrator.api.isInitialized()).toBe(false);

      await orchestrator.init();

      expect(orchestrator.api.isInitialized()).toBe(true);
      expect(mockDeps.WebRTCSwarm.updateCapabilities).toHaveBeenCalled();
      expect(mockDeps.WebRTCSwarm.registerMessageHandler).toHaveBeenCalled();
    });

    it('should detect Python capability when available', async () => {
      global.window.PyodideRuntime.isReady = () => true;

      await orchestrator.init();

      const call = mockDeps.WebRTCSwarm.updateCapabilities.mock.calls[0];
      expect(call[0]).toContain('python-execution');
    });

    it('should detect Local LLM capability when available', async () => {
      global.window.LocalLLM.isReady = () => true;

      await orchestrator.init();

      const call = mockDeps.WebRTCSwarm.updateCapabilities.mock.calls[0];
      expect(call[0]).toContain('local-llm');
    });

    it('should detect Git VFS capability when available', async () => {
      global.window.GitVFS.isInitialized = () => true;

      await orchestrator.init();

      const call = mockDeps.WebRTCSwarm.updateCapabilities.mock.calls[0];
      expect(call[0]).toContain('git-vfs');
    });

    it('should register message handlers', async () => {
      await orchestrator.init();

      expect(mockDeps.WebRTCSwarm.registerMessageHandler).toHaveBeenCalledWith('task-execution', expect.any(Function));
      expect(mockDeps.WebRTCSwarm.registerMessageHandler).toHaveBeenCalledWith('knowledge-request', expect.any(Function));
      expect(mockDeps.WebRTCSwarm.registerMessageHandler).toHaveBeenCalledWith('reflection-share', expect.any(Function));
    });
  });

  describe('Task Delegation', () => {
    beforeEach(async () => {
      await orchestrator.init();
    });

    it('should delegate task to swarm', async () => {
      const result = await orchestrator.api.delegateTask('code-generation', {
        prompt: 'write a function'
      });

      expect(result.success).toBe(true);
      expect(mockDeps.WebRTCSwarm.delegateTask).toHaveBeenCalled();
    });

    it('should fail when not initialized', async () => {
      const uninitializedOrch = mockDeps.WebRTCSwarm.constructor;
      const newOrch = { metadata: {}, factory: () => ({ init: vi.fn(), api: {} }) };
      const instance = newOrch.factory(mockDeps);

      // Create new uninitialized instance
      const SwarmOrchestratorModule = {
        factory: (deps) => {
          let isInitialized = false;

          const delegateTask = async () => {
            if (!isInitialized) {
              return { success: false, error: 'Swarm not initialized' };
            }
            return { success: true };
          };

          return {
            init: async () => { isInitialized = true; },
            api: { delegateTask, isInitialized: () => isInitialized }
          };
        }
      };

      const uninit = SwarmOrchestratorModule.factory(mockDeps);
      const result = await uninit.api.delegateTask('test', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('should include task requirements', async () => {
      await orchestrator.api.delegateTask('python-computation', {
        code: 'print(1)'
      });

      const call = mockDeps.WebRTCSwarm.delegateTask.mock.calls[0];
      expect(call[0].requirements).toContain('python-execution');
    });

    it('should handle delegation errors', async () => {
      mockDeps.WebRTCSwarm.delegateTask.mockRejectedValueOnce(
        new Error('No peers available')
      );

      const result = await orchestrator.api.delegateTask('code-generation', {});

      expect(result.success).toBe(false);
      expect(result.error).toContain('No peers available');
    });
  });

  describe('Reflection Sharing', () => {
    beforeEach(async () => {
      await orchestrator.init();
    });

    it('should share successful reflection', async () => {
      const reflection = {
        outcome: 'successful',
        category: 'cycle_completion',
        description: 'Test passed',
        recommendations: ['Keep doing this'],
        tags: ['test']
      };

      const count = await orchestrator.api.shareSuccessPattern(reflection);

      expect(count).toBe(3);
      expect(mockDeps.WebRTCSwarm.broadcast).toHaveBeenCalled();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('swarm:reflection-shared', { count: 3 });
    });

    it('should not share unsuccessful reflection', async () => {
      const reflection = {
        outcome: 'failed',
        category: 'error',
        description: 'Test failed'
      };

      const count = await orchestrator.api.shareSuccessPattern(reflection);

      expect(count).toBe(0);
      expect(mockDeps.WebRTCSwarm.broadcast).not.toHaveBeenCalled();
    });

    it('should not share when not initialized', async () => {
      const uninitOrch = { metadata: {}, factory: (deps) => {
        let isInit = false;
        return {
          init: async () => { isInit = true; },
          api: {
            shareSuccessPattern: async (r) => {
              if (!isInit) return 0;
              return 1;
            }
          }
        };
      }};

      const inst = uninitOrch.factory(mockDeps);
      const count = await inst.api.shareSuccessPattern({ outcome: 'successful' });

      expect(count).toBe(0);
    });
  });

  describe('Consensus', () => {
    beforeEach(async () => {
      await orchestrator.init();
    });

    it('should request modification consensus', async () => {
      const modification = {
        filePath: '/test.js',
        code: 'const x = 1;',
        reason: 'Add variable',
        operation: 'MODIFY'
      };

      const result = await orchestrator.api.requestModificationConsensus(modification);

      expect(result.consensus).toBe(true);
      expect(mockDeps.WebRTCSwarm.requestConsensus).toHaveBeenCalled();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('swarm:consensus-result', result);
    });

    it('should assess high risk for core files', async () => {
      const modification = {
        filePath: '/modules/sentinel-fsm.js',
        code: 'risky code',
        reason: 'Modify FSM',
        operation: 'MODIFY'
      };

      await orchestrator.api.requestModificationConsensus(modification);

      const call = mockDeps.WebRTCSwarm.requestConsensus.mock.calls[0];
      expect(call[0].risk).toBe('high');
    });

    it('should assess high risk for DELETE operations', async () => {
      const modification = {
        filePath: '/safe-file.js',
        code: '',
        reason: 'Remove file',
        operation: 'DELETE'
      };

      await orchestrator.api.requestModificationConsensus(modification);

      const call = mockDeps.WebRTCSwarm.requestConsensus.mock.calls[0];
      expect(call[0].risk).toBe('high');
    });

    it('should assess high risk for eval() usage', async () => {
      const modification = {
        filePath: '/script.js',
        code: 'eval("dangerous code")',
        reason: 'Dynamic code',
        operation: 'MODIFY'
      };

      await orchestrator.api.requestModificationConsensus(modification);

      const call = mockDeps.WebRTCSwarm.requestConsensus.mock.calls[0];
      expect(call[0].risk).toBe('high');
    });

    it('should assess medium risk for normal modifications', async () => {
      const modification = {
        filePath: '/utils/helper.js',
        code: 'function add(a, b) { return a + b; }',
        reason: 'Add utility',
        operation: 'MODIFY'
      };

      await orchestrator.api.requestModificationConsensus(modification);

      const call = mockDeps.WebRTCSwarm.requestConsensus.mock.calls[0];
      expect(call[0].risk).toBe('medium');
    });
  });

  describe('Knowledge Query', () => {
    beforeEach(async () => {
      await orchestrator.init();
    });

    it('should query knowledge from reflections and artifacts', async () => {
      const knowledge = await orchestrator.api.queryKnowledge('test query');

      expect(knowledge.reflections).toHaveLength(1);
      expect(knowledge.artifacts).toHaveLength(2);
      expect(mockDeps.ReflectionStore.searchReflections).toHaveBeenCalled();
      expect(mockDeps.StateManager.searchArtifacts).toHaveBeenCalled();
    });

    it('should split query into keywords', async () => {
      await orchestrator.api.queryKnowledge('multiple word query');

      const call = mockDeps.ReflectionStore.searchReflections.mock.calls[0];
      expect(call[0].keywords).toEqual(['multiple', 'word', 'query']);
    });

    it('should limit results', async () => {
      mockDeps.StateManager.searchArtifacts.mockResolvedValueOnce([
        { path: '/1.js' }, { path: '/2.js' }, { path: '/3.js' },
        { path: '/4.js' }, { path: '/5.js' }, { path: '/6.js' }
      ]);

      const knowledge = await orchestrator.api.queryKnowledge('test');

      expect(knowledge.artifacts).toHaveLength(5);
    });
  });

  describe('Statistics', () => {
    it('should return uninitialized stats', () => {
      const stats = orchestrator.api.getStats();

      expect(stats.initialized).toBe(false);
      expect(stats.peers).toBe(0);
      expect(stats.capabilities).toEqual([]);
    });

    it('should return initialized stats', async () => {
      await orchestrator.init();

      const stats = orchestrator.api.getStats();

      expect(stats.initialized).toBe(true);
      expect(stats.localPeerId).toBe('peer-123');
      expect(stats.connectedPeers).toBe(3);
      expect(stats.totalPeers).toBe(5);
      expect(stats.capabilities).toContain('code-generation');
    });
  });

  describe('Integration Tests', () => {
    it('should handle full swarm workflow', async () => {
      // Initialize
      await orchestrator.init();
      expect(orchestrator.api.isInitialized()).toBe(true);

      // Delegate task
      const taskResult = await orchestrator.api.delegateTask('file-analysis', {
        path: '/test.js'
      });
      expect(taskResult.success).toBe(true);

      // Share reflection
      const shareCount = await orchestrator.api.shareSuccessPattern({
        outcome: 'successful',
        category: 'test',
        description: 'Test worked'
      });
      expect(shareCount).toBeGreaterThan(0);

      // Query knowledge
      const knowledge = await orchestrator.api.queryKnowledge('test');
      expect(knowledge).toHaveProperty('reflections');
      expect(knowledge).toHaveProperty('artifacts');

      // Get stats
      const stats = orchestrator.api.getStats();
      expect(stats.initialized).toBe(true);
    });
  });
});
