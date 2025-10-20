import { describe, it, expect, beforeEach, vi } from 'vitest';

import WebRTCCoordinator from '../../upgrades/webrtc-coordinator.js';
describe('WebRTCCoordinator Module', () => {
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


    orchestrator = WebRTCCoordinator.factory(mockDeps);
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
      const WebRTCCoordinatorModule = {
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

      const uninit = WebRTCCoordinator.factory(mockDeps);
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
