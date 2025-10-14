/**
 * @fileoverview Swarm Orchestrator for REPLOID
 * Enables multi-agent distributed intelligence via WebRTC swarm coordination.
 * Agents can delegate tasks, share knowledge, and request consensus.
 *
 * @module SwarmOrchestrator
 * @version 1.0.0
 * @category service
 */

const SwarmOrchestrator = {
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

    /**
     * Initialize swarm orchestrator
     */
    const init = async () => {
      logger.info('[SwarmOrch] Initializing swarm orchestrator');

      // Detect local capabilities
      localCapabilities = await detectCapabilities();

      // Register capabilities with swarm
      WebRTCSwarm.updateCapabilities(localCapabilities);

      // Register message handlers
      registerMessageHandlers();

      isInitialized = true;
      logger.info('[SwarmOrch] Swarm orchestrator initialized', { capabilities: localCapabilities });
    };

    /**
     * Detect what capabilities this agent instance has
     */
    const detectCapabilities = async () => {
      const caps = ['code-generation', 'file-management'];

      // Check for Python runtime
      if (window.PyodideRuntime && window.PyodideRuntime.isReady()) {
        caps.push('python-execution');
      }

      // Check for local LLM
      if (window.LocalLLM && window.LocalLLM.isReady()) {
        caps.push('local-llm');
      }

      // Check for Git VFS
      const GitVFS = window.GitVFS;
      if (GitVFS && GitVFS.isInitialized()) {
        caps.push('git-vfs');
      }

      return caps;
    };

    /**
     * Register handlers for swarm messages
     */
    const registerMessageHandlers = () => {
      // Handle task execution requests
      WebRTCSwarm.registerMessageHandler('task-execution', async (peerId, message) => {
        logger.info(`[SwarmOrch] Task execution request from ${peerId}`, message.task);
        const result = await executeTask(message.task);

        WebRTCSwarm.sendToPeer(peerId, {
          type: 'task-result',
          taskId: message.taskId,
          result
        });
      });

      // Handle knowledge requests
      WebRTCSwarm.registerMessageHandler('knowledge-request', async (peerId, message) => {
        logger.info(`[SwarmOrch] Knowledge request from ${peerId}`, message.query);
        const knowledge = await queryKnowledge(message.query);

        WebRTCSwarm.sendToPeer(peerId, {
          type: 'knowledge-response',
          requestId: message.requestId,
          knowledge
        });
      });

      // Handle reflection sharing
      WebRTCSwarm.registerMessageHandler('reflection-share', async (peerId, message) => {
        logger.info(`[SwarmOrch] Reflection shared by ${peerId}`);
        await integrateSharedReflection(peerId, message.reflection);
      });
    };

    /**
     * Delegate a computation task to the swarm
     * @param {string} taskType - Type of task (e.g., 'python-computation', 'code-generation')
     * @param {object} taskData - Task-specific data
     * @returns {Promise<object>} Task result from peer
     */
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

    /**
     * Execute a delegated task locally
     */
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
            // Use local LLM or fallback to cloud
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

    /**
     * Share a successful reflection with the swarm
     */
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

    /**
     * Integrate a reflection shared by a peer
     */
    const integrateSharedReflection = async (peerId, reflection) => {
      logger.info(`[SwarmOrch] Integrating reflection from ${peerId}`);

      // Store reflection with special tag
      await ReflectionStore.addReflection({
        ...reflection,
        tags: [...(reflection.tags || []), `shared_from_${peerId}`],
        source: 'swarm'
      });

      EventBus.emit('swarm:reflection-integrated', { peerId, reflection });
    };

    /**
     * Request consensus from swarm for a risky modification
     */
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

    /**
     * Assess risk level of a modification
     */
    const assessModificationRisk = (modification) => {
      const coreFiles = ['agent-cycle', 'sentinel-fsm', 'tool-runner', 'state-manager'];
      const isCoreFile = coreFiles.some(core => modification.filePath.includes(core));

      if (isCoreFile) return 'high';
      if (modification.operation === 'DELETE') return 'high';
      if (modification.code.includes('eval(')) return 'high';

      return 'medium';
    };

    /**
     * Query swarm for knowledge about a topic
     */
    const queryKnowledge = async (query) => {
      // Search local reflections
      const reflections = await ReflectionStore.searchReflections({
        keywords: query.split(' '),
        limit: 5
      });

      // Search artifacts
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

    /**
     * Get task requirements based on task type
     */
    const getRequirementsForTaskType = (taskType) => {
      const requirements = {
        'python-computation': ['python-execution'],
        'code-generation': ['local-llm'],
        'file-analysis': ['file-management'],
        'git-operation': ['git-vfs']
      };

      return requirements[taskType] || [];
    };

    /**
     * Get swarm statistics
     */
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

// Export
SwarmOrchestrator;
