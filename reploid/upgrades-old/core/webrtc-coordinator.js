/**
 * @fileoverview WebRTC Coordinator for REPLOID
 * Enables peer-to-peer agent coordination via WebRTC.
 * Browser instances can delegate tasks, share knowledge, and collaborate.
 * 
 * Note: This is different from PAWS swarm.js (LLM-based multi-agent collaboration).
 * This module handles P2P browser-to-browser coordination.
 *
 * @blueprint 0x000034 - Details swarm orchestration behaviors.
 * @module WebRTCCoordinator
 * @version 1.0.0
 * @category service
 */

const WebRTCCoordinator = {
  metadata: {
    id: 'WebRTCCoordinator',
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

    // Track coordination activity for widget
    let coordinationStats = {
      totalTasks: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      patternsShared: 0,
      consensusRequests: 0,
      knowledgeQueries: 0,
      lastActivity: null
    };

    // Wrap functions to track stats
    const trackedDelegateTask = async (task, requiredCapability) => {
      coordinationStats.totalTasks++;
      coordinationStats.lastActivity = { type: 'task-delegation', timestamp: Date.now() };

      try {
        const result = await delegateTask(task, requiredCapability);
        coordinationStats.tasksCompleted++;
        return result;
      } catch (error) {
        coordinationStats.tasksFailed++;
        throw error;
      }
    };

    const trackedShareSuccessPattern = async (pattern) => {
      coordinationStats.patternsShared++;
      coordinationStats.lastActivity = { type: 'pattern-sharing', timestamp: Date.now() };
      return await shareSuccessPattern(pattern);
    };

    const trackedRequestConsensus = async (modification) => {
      coordinationStats.consensusRequests++;
      coordinationStats.lastActivity = { type: 'consensus-request', timestamp: Date.now() };
      return await requestModificationConsensus(modification);
    };

    const trackedQueryKnowledge = async (query) => {
      coordinationStats.knowledgeQueries++;
      coordinationStats.lastActivity = { type: 'knowledge-query', timestamp: Date.now() };
      return await queryKnowledge(query);
    };

    // Web Component Widget (INSIDE factory closure to access state)
    class WebRTCCoordinatorWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 2 seconds
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const stats = getStats();
        const taskSuccessRate = coordinationStats.totalTasks > 0
          ? Math.round((coordinationStats.tasksCompleted / coordinationStats.totalTasks) * 100)
          : 100;

        return {
          state: isInitialized ? (stats.connectedPeers > 0 ? 'active' : 'idle') : 'disabled',
          primaryMetric: `${stats.connectedPeers} peers`,
          secondaryMetric: `${coordinationStats.totalTasks} tasks`,
          lastActivity: coordinationStats.lastActivity?.timestamp || null,
          message: !isInitialized ? 'Not initialized' : (stats.connectedPeers === 0 ? 'No peers' : null)
        };
      }

      renderPanel() {
        const stats = getStats();
        const taskSuccessRate = coordinationStats.totalTasks > 0
          ? Math.round((coordinationStats.tasksCompleted / coordinationStats.totalTasks) * 100)
          : 100;

        return `
          <div class="webrtc-coordinator-panel">
            <div class="coordinator-stats" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
              <div class="stat-card" style="background: rgba(0,255,255,0.1); padding: 10px; border-radius: 5px;">
                <div style="color: #888; font-size: 12px;">Tasks</div>
                <div style="font-size: 24px; font-weight: bold; color: #0ff;">${coordinationStats.totalTasks}</div>
              </div>
              <div class="stat-card" style="background: rgba(76,175,80,0.1); padding: 10px; border-radius: 5px;">
                <div style="color: #888; font-size: 12px;">Success</div>
                <div style="font-size: 24px; font-weight: bold; color: #4caf50;">${taskSuccessRate}%</div>
              </div>
              <div class="stat-card" style="background: rgba(156,39,176,0.1); padding: 10px; border-radius: 5px;">
                <div style="color: #888; font-size: 12px;">Patterns</div>
                <div style="font-size: 24px; font-weight: bold; color: #9c27b0;">${coordinationStats.patternsShared}</div>
              </div>
            </div>

            ${isInitialized ? `
              <div class="peer-info" style="background: rgba(0,255,255,0.1); padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                <h4 style="color: #0ff; margin-bottom: 10px;">Swarm Status</h4>
                <div style="font-size: 13px; color: #ccc; line-height: 1.8;">
                  <div><strong>Local Peer ID:</strong> ${stats.localPeerId || 'Unknown'}</div>
                  <div><strong>Connected Peers:</strong> ${stats.connectedPeers} / ${stats.totalPeers}</div>
                  <div><strong>Capabilities:</strong> ${stats.capabilities?.join(', ') || 'None'}</div>
                </div>
              </div>

              ${stats.peers && stats.peers.length > 0 ? `
                <div class="peer-list">
                  <h4 style="color: #0ff; margin-bottom: 10px;">Connected Peers (${stats.peers.length})</h4>
                  <div style="max-height: 200px; overflow-y: auto;">
                    ${stats.peers.map(peer => `
                      <div style="padding: 10px; background: rgba(255,255,255,0.03); margin-bottom: 8px; border-radius: 5px;">
                        <div style="font-weight: bold; color: #ccc; margin-bottom: 4px;">${peer.id.substring(0, 16)}...</div>
                        <div style="font-size: 12px; color: #888;">
                          Capabilities: ${peer.capabilities?.join(', ') || 'None'}
                        </div>
                        <div style="font-size: 11px; color: #666; margin-top: 4px;">
                          ${peer.connected ? '✓ Connected' : '○ Disconnected'}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : `
                <div style="color: #888; padding: 20px; text-align: center; background: rgba(255,255,255,0.03); border-radius: 5px;">
                  No peers connected
                </div>
              `}
            ` : `
              <div style="padding: 20px; text-align: center; background: rgba(255,255,255,0.03); border-radius: 5px;">
                <div style="font-size: 48px; margin-bottom: 20px;">♁</div>
                <h3 style="color: #0ff;">Coordinator Not Initialized</h3>
                <p style="color: #888;">Click Initialize to start peer coordination</p>
              </div>
            `}

            <div class="activity-breakdown" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
              <div style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 5px;">
                <div style="color: #888; font-size: 12px;">Consensus Requests</div>
                <div style="font-size: 20px; font-weight: bold;">${coordinationStats.consensusRequests}</div>
              </div>
              <div style="padding: 8px; background: rgba(255,255,255,0.03); border-radius: 5px;">
                <div style="color: #888; font-size: 12px;">Knowledge Queries</div>
                <div style="font-size: 20px; font-weight: bold;">${coordinationStats.knowledgeQueries}</div>
              </div>
            </div>

            <button class="init-btn" style="width: 100%; margin-top: 16px; padding: 10px; background: #0ff; border: none; border-radius: 4px; color: #000; font-weight: bold; cursor: pointer; font-size: 0.95em;">
              ▶ ${isInitialized ? 'Reinitialize' : 'Initialize'}
            </button>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-content {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h4 {
              margin: 16px 0 8px 0;
              font-size: 0.95em;
              color: #aaa;
            }

            button {
              transition: all 0.2s ease;
            }

            .init-btn:hover {
              background: #0dd !important;
              transform: translateY(-1px);
            }

            button:active {
              transform: translateY(0);
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up initialize button
        const initBtn = this.shadowRoot.querySelector('.init-btn');
        if (initBtn) {
          initBtn.addEventListener('click', async () => {
            try {
              initBtn.disabled = true;
              initBtn.textContent = '⏳ Initializing...';

              await init();

              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:success', { message: 'Coordinator initialized' });
              }

              this.render(); // Refresh
            } catch (error) {
              logger.error('[WebRTCCoordinator] Widget: Initialization failed', error);
              this.render();
            }
          });
        }
      }
    }

    // Define custom element
    if (!customElements.get('webrtc-coordinator-widget')) {
      customElements.define('webrtc-coordinator-widget', WebRTCCoordinatorWidget);
    }

    return {
      init,
      api: {
        delegateTask: trackedDelegateTask,
        shareSuccessPattern: trackedShareSuccessPattern,
        requestModificationConsensus: trackedRequestConsensus,
        queryKnowledge: trackedQueryKnowledge,
        getStats,
        isInitialized: () => isInitialized
      },
      widget: {
        element: 'webrtc-coordinator-widget',
        displayName: 'WebRTC Coordinator',
        icon: '♁',
        category: 'communication',
        updateInterval: 2000
      }
    };
  }
};

// Export
export default WebRTCCoordinator;
