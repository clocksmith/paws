# Blueprint 0x00003A: Swarm Orchestration

**Objective:** Describe how REPLOID coordinates multi-agent collaboration over WebRTC to share workload, knowledge, and governance.

**Target Upgrade:** WRTC (`webrtc-coordinator.js`)

**Prerequisites:** 0x000043 (Browser APIs), 0x000044 (WebRTC Swarm Transport), 0x00001B (Code Introspection & Self-Analysis), 0x00003B (Reflection Store)

**Affected Artifacts:** `/upgrades/webrtc-coordinator.js`, `/upgrades/webrtc-swarm.js`, `/upgrades/reflection-store.js`, `/upgrades/tool-runner.js`

---

### 1. The Strategic Imperative
Distributed cognition multiplies capability:
- Delegate heavy computation (Python, code generation) to capable peers.
- Share successful reflections so improvements propagate quickly.
- Require consensus before risky modifications, building trust.

Swarm orchestration must remain deterministic and safe to avoid chaos.

### 2. Architectural Overview

The WebRTCCoordinator module provides peer-to-peer agent coordination via WebRTC with real-time monitoring through a Web Component widget. It wraps lower-level WebRTC signalling (WebRTCSwarm) with agent semantics for task delegation, knowledge exchange, and collaborative decision-making.

**Module Architecture:**
```javascript
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

    // Internal state (accessible to widget via closure)
    let isInitialized = false;
    let localCapabilities = [];
    let coordinationStats = {
      totalTasks: 0,
      tasksCompleted: 0,
      tasksFailed: 0,
      patternsShared: 0,
      consensusRequests: 0,
      knowledgeQueries: 0,
      lastActivity: null
    };

    // Core coordination functions
    const init = async () => {
      localCapabilities = await detectCapabilities();
      WebRTCSwarm.updateCapabilities(localCapabilities);
      registerMessageHandlers();
      isInitialized = true;
    };

    const delegateTask = async (taskType, taskData) => {
      const task = {
        name: taskType,
        requirements: getRequirementsForTaskType(taskType),
        data: taskData,
        delegator: WebRTCSwarm.getPeerId()
      };
      return await WebRTCSwarm.delegateTask(task);
    };

    const shareSuccessPattern = async (reflection) => {
      // Broadcast successful reflections to swarm
      return WebRTCSwarm.broadcast({ type: 'reflection-share', reflection });
    };

    const requestModificationConsensus = async (modification) => {
      // Request consensus for risky modifications
      return await WebRTCSwarm.requestConsensus(proposal, 30000);
    };

    // Web Component Widget (defined inside factory to access closure state)
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
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      getStatus() {
        const stats = getStats();
        return {
          state: isInitialized ? (stats.connectedPeers > 0 ? 'active' : 'idle') : 'disabled',
          primaryMetric: `${stats.connectedPeers} peers`,
          secondaryMetric: `${coordinationStats.totalTasks} tasks`,
          lastActivity: coordinationStats.lastActivity?.timestamp || null
        };
      }

      render() {
        this.shadowRoot.innerHTML = `<style>...</style>${this.renderPanel()}`;
      }
    }

    customElements.define('webrtc-coordinator-widget', WebRTCCoordinatorWidget);

    return {
      init,
      api: {
        delegateTask,
        shareSuccessPattern,
        requestModificationConsensus,
        queryKnowledge,
        getStats,
        isInitialized
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
```

**Core Coordination Features:**

- **Capability Detection**
  - `detectCapabilities()`: Scans for Python runtime, local LLM, Git VFS, and other features
  - Auto-registers capabilities with WebRTCSwarm on init
  - Detects: `python-execution`, `local-llm`, `git-vfs`, `code-generation`, `file-management`

- **Task Delegation**
  - `delegateTask(taskType, data)`: Builds task descriptor with requirements and delegates to capable peers
  - Supports: `python-computation`, `code-generation`, `file-analysis`, `git-operation`
  - `executeTask(task)`: Handles incoming tasks via ToolRunner, HybridLLM, or StateManager
  - Tracked delegation with success/failure statistics

- **Knowledge Exchange**
  - `queryKnowledge(query)`: Merges local reflection search with artifact search
  - Returns curated knowledge (reflections + artifacts) to requesting peers
  - Supports swarm-wide knowledge base building

- **Reflection Sharing**
  - `shareSuccessPattern(reflection)`: Broadcasts successful reflections to all peers
  - `integrateSharedReflection(peerId, reflection)`: Tags imported reflections with `shared_from_<peer>`
  - Enables swarm-wide learning from successful patterns

- **Consensus Mechanism**
  - `requestModificationConsensus(modification)`: Sends proposals to peers for voting
  - `assessModificationRisk(modification)`: Tags high-risk changes (core files, deletes, eval usage)
  - 30-second timeout with fallback to `consensus: true` when swarm unavailable
  - Prevents risky modifications without peer approval

- **Message Handling**
  - Registers handlers for: `task-execution`, `knowledge-request`, `reflection-share`
  - Auto-responds to peer requests with correlation IDs
  - Event-driven architecture via EventBus

- **Statistics & Tracking**
  - `getStats()`: Returns peer counts, capabilities, connected peer list
  - Tracks: total tasks, success rate, patterns shared, consensus requests, knowledge queries
  - Real-time activity monitoring with timestamps

**Web Component Widget Features:**

The `WebRTCCoordinatorWidget` provides comprehensive swarm monitoring and control:
- **Statistics Grid**: 3-column display showing total tasks, success rate, patterns shared
- **Swarm Status Panel**: Local peer ID, connected/total peers, capability list
- **Connected Peers List**: Scrollable list with peer IDs (truncated), capabilities, connection status
- **Activity Breakdown**: Consensus requests and knowledge queries in 2-column grid
- **Interactive Controls**: Initialize/Reinitialize button with loading state
- **Auto-refresh**: Updates every 2 seconds to show real-time coordination activity
- **Visual Feedback**: Color-coded status (cyan for active, purple for patterns, green for success)
- **Dashboard Integration**: `getStatus()` provides summary metrics for main dashboard

### 3. Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure WebRTCCoordinator is registered with dependencies
{
  "modules": {
    "WebRTCCoordinator": {
      "dependencies": ["WebRTCSwarm", "StateManager", "ReflectionStore", "EventBus", "Utils", "ToolRunner"],
      "enabled": true,
      "async": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates coordination logic:
```javascript
factory: (deps) => {
  const { WebRTCSwarm, StateManager, ReflectionStore, EventBus, Utils, ToolRunner } = deps;
  const { logger } = Utils;

  // Internal state (accessible to widget via closure)
  let isInitialized = false;
  let localCapabilities = [];
  let coordinationStats = {
    totalTasks: 0,
    tasksCompleted: 0,
    tasksFailed: 0,
    patternsShared: 0,
    consensusRequests: 0,
    knowledgeQueries: 0,
    lastActivity: null
  };

  // Initialization
  const init = async () => {
    logger.info('[SwarmOrch] Initializing swarm orchestrator');

    // Detect local capabilities
    localCapabilities = await detectCapabilities();

    // Register capabilities with WebRTCSwarm
    WebRTCSwarm.updateCapabilities(localCapabilities);

    // Register message handlers
    registerMessageHandlers();

    isInitialized = true;
    logger.info('[SwarmOrch] Initialized', { capabilities: localCapabilities });
    return true;
  };

  // Web Component defined here to access closure variables
  class WebRTCCoordinatorWidget extends HTMLElement { /*...*/ }
  customElements.define('webrtc-coordinator-widget', WebRTCCoordinatorWidget);

  return { init, api, widget };
}
```

**Step 3: Capability Detection Implementation**

Detect available features in the browser instance:
```javascript
const detectCapabilities = async () => {
  const caps = ['code-generation', 'file-management'];

  // Check for Python runtime (Pyodide)
  if (window.PyodideRuntime && window.PyodideRuntime.isReady()) {
    caps.push('python-execution');
    logger.info('[SwarmOrch] Python execution capability available');
  }

  // Check for local LLM (WebLLM, transformers.js, etc.)
  if (window.LocalLLM && window.LocalLLM.isReady()) {
    caps.push('local-llm');
    logger.info('[SwarmOrch] Local LLM capability available');
  }

  // Check for Git VFS
  const GitVFS = window.GitVFS;
  if (GitVFS && GitVFS.isInitialized()) {
    caps.push('git-vfs');
    logger.info('[SwarmOrch] Git VFS capability available');
  }

  logger.info(`[SwarmOrch] Detected ${caps.length} capabilities:`, caps);
  return caps;
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
```

**Step 4: Message Handler Registration**

Register handlers for incoming peer messages:
```javascript
const registerMessageHandlers = () => {
  // Handle task execution requests from peers
  WebRTCSwarm.registerMessageHandler('task-execution', async (peerId, message) => {
    logger.info(`[SwarmOrch] Task execution request from ${peerId}`, message.task);
    const result = await executeTask(message.task);

    WebRTCSwarm.sendToPeer(peerId, {
      type: 'task-result',
      taskId: message.taskId,
      result
    });
  });

  // Handle knowledge requests from peers
  WebRTCSwarm.registerMessageHandler('knowledge-request', async (peerId, message) => {
    logger.info(`[SwarmOrch] Knowledge request from ${peerId}`, message.query);
    const knowledge = await queryKnowledge(message.query);

    WebRTCSwarm.sendToPeer(peerId, {
      type: 'knowledge-response',
      requestId: message.requestId,
      knowledge
    });
  });

  // Handle reflection sharing from peers
  WebRTCSwarm.registerMessageHandler('reflection-share', async (peerId, message) => {
    logger.info(`[SwarmOrch] Reflection shared by ${peerId}`);
    await integrateSharedReflection(peerId, message.reflection);
  });

  logger.info('[SwarmOrch] Message handlers registered');
};
```

**Step 5: Task Delegation and Execution**

Implement task delegation to capable peers and local execution:
```javascript
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
    coordinationStats.tasksCompleted++;
    logger.info(`[SwarmOrch] Task ${taskType} completed by peer`, result);
    return result;
  } catch (error) {
    coordinationStats.tasksFailed++;
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
        if (!HybridLLM) throw new Error('LLM provider not available');

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
        if (!content) throw new Error(`File not found: ${task.data.path}`);

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
    return { success: false, error: error.message };
  }
};
```

**Step 6: Knowledge Exchange and Reflection Sharing**

Implement knowledge sharing and reflection distribution:
```javascript
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

  coordinationStats.patternsShared++;
  EventBus.emit('swarm:reflection-shared', { count: sharedCount });
  return sharedCount;
};

const integrateSharedReflection = async (peerId, reflection) => {
  logger.info(`[SwarmOrch] Integrating reflection from ${peerId}`);

  // Store reflection with special tag for provenance
  await ReflectionStore.addReflection({
    ...reflection,
    tags: [...(reflection.tags || []), `shared_from_${peerId}`],
    source: 'swarm'
  });

  EventBus.emit('swarm:reflection-integrated', { peerId, reflection });
};
```

**Step 7: Consensus Mechanism**

Implement consensus protocol for risky modifications:
```javascript
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

  coordinationStats.consensusRequests++;

  try {
    const result = await WebRTCSwarm.requestConsensus(proposal, 30000);

    logger.info('[SwarmOrch] Consensus result', {
      consensus: result.consensus,
      votes: result.votes
    });

    EventBus.emit('swarm:consensus-result', result);
    return result;
  } catch (error) {
    logger.error('[SwarmOrch] Consensus request failed:', error);
    return { consensus: false, reason: 'timeout', votes: {} };
  }
};

const assessModificationRisk = (modification) => {
  const coreFiles = ['agent-cycle', 'sentinel-fsm', 'tool-runner', 'state-manager'];
  const isCoreFile = coreFiles.some(core => modification.filePath.includes(core));

  if (isCoreFile) return 'high';
  if (modification.operation === 'DELETE') return 'high';
  if (modification.code?.includes('eval(')) return 'high';

  return 'medium';
};
```

**Step 8: Web Component Widget**

The widget provides real-time swarm monitoring and control:
```javascript
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
        <!-- 3-column statistics grid -->
        <div class="coordinator-stats" style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
          <div class="stat-card">
            <div>Tasks</div>
            <div>${coordinationStats.totalTasks}</div>
          </div>
          <div class="stat-card">
            <div>Success</div>
            <div>${taskSuccessRate}%</div>
          </div>
          <div class="stat-card">
            <div>Patterns</div>
            <div>${coordinationStats.patternsShared}</div>
          </div>
        </div>

        <!-- Swarm status panel -->
        ${isInitialized ? `
          <div class="peer-info">
            <h4>Swarm Status</h4>
            <div>Local Peer ID: ${stats.localPeerId || 'Unknown'}</div>
            <div>Connected Peers: ${stats.connectedPeers} / ${stats.totalPeers}</div>
            <div>Capabilities: ${stats.capabilities?.join(', ') || 'None'}</div>
          </div>

          <!-- Connected peers list -->
          ${stats.peers && stats.peers.length > 0 ? `
            <div class="peer-list">
              <h4>Connected Peers (${stats.peers.length})</h4>
              <div style="max-height: 200px; overflow-y: auto;">
                ${stats.peers.map(peer => `
                  <div class="peer-card">
                    <div>${peer.id.substring(0, 16)}...</div>
                    <div>Capabilities: ${peer.capabilities?.join(', ') || 'None'}</div>
                    <div>${peer.connected ? '✓ Connected' : '○ Disconnected'}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="no-peers">No peers connected</div>
          `}
        ` : `
          <div class="not-initialized">
            <h3>Coordinator Not Initialized</h3>
            <p>Click Initialize to start peer coordination</p>
          </div>
        `}

        <!-- Activity breakdown -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <div>Consensus Requests</div>
            <div>${coordinationStats.consensusRequests}</div>
          </div>
          <div>
            <div>Knowledge Queries</div>
            <div>${coordinationStats.knowledgeQueries}</div>
          </div>
        </div>

        <button class="init-btn">
          ▶ ${isInitialized ? 'Reinitialize' : 'Initialize'}
        </button>
      </div>
    `;
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">${this.renderPanel()}</div>
    `;

    // Wire up initialize button
    const initBtn = this.shadowRoot.querySelector('.init-btn');
    if (initBtn) {
      initBtn.addEventListener('click', async () => {
        try {
          initBtn.disabled = true;
          initBtn.textContent = '⏳ Initializing...';
          await init();
          EventBus.emit('toast:success', { message: 'Coordinator initialized' });
          this.render();
        } catch (error) {
          logger.error('[WebRTCCoordinator] Widget: Initialization failed', error);
          this.render();
        }
      });
    }
  }
}
```

**Step 9: Integration Points**

1. **Boot Sequence Integration**:
   - Call `await WebRTCCoordinator.init()` during application boot
   - Provide opt-in UI toggle (WebRTC disabled by default for security)
   - Display warning if WebRTCSwarm dependency unavailable

2. **Task Delegation from Agent Cycle**:
   - Delegate heavy Python computations to peers with `python-execution` capability
   - Offload code generation to peers with `local-llm` capability
   - Query swarm knowledge before making risky decisions

3. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard system
   - Provides `getStatus()` method for dashboard summary view
   - Updates every 2 seconds via `updateInterval: 2000`

4. **Event-Driven Communication**:
   - Emit `'swarm:reflection-shared'` when patterns broadcast to peers
   - Emit `'swarm:reflection-integrated'` when peer reflections imported
   - Emit `'swarm:consensus-result'` after consensus voting completes
   - Use for UI feedback, analytics, and decision-making

5. **Security Considerations**:
   - Sanitize incoming task data; reject unsupported task types
   - Limit file access to safe prefixes when executing remote requests
   - Record all swarm operations via AuditLogger when available
   - Validate peer identity before accepting high-risk task requests
   - Use consensus mechanism for modifications to core system files

### 4. Verification Checklist
- [ ] Initialization registers handlers exactly once (no duplicates).
- [ ] Delegated tasks execute and respond with correlation IDs.
- [ ] Reflection sharing results in stored entries tagged with `shared_from_<peer>`.
- [ ] Consensus fallback to `consensus: true` only when swarm unavailable (documented reason).
- [ ] `getStats()` reflects real-time peer counts and capability list.

### 5. Extension Opportunities
- Implement workload balancing (choose peer with required capabilities and lowest queue).
- Add encrypted payloads for end-to-end privacy.
- Support collaborative editing sessions beyond task delegation.
- Integrate with Paxos competitions to coordinate multi-agent tournaments.

Maintain this blueprint for any changes to swarm messaging, capability detection, or consensus logic.
