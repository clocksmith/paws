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
        const stats = getStats();
        const totalUpdates = coordinationStats.totalTasks;
        const successRate = coordinationStats.tasksCompleted > 0
          ? Math.round((coordinationStats.tasksCompleted / coordinationStats.totalTasks) * 100)
          : 0;
        const connectedPeers = stats.connectedPeers || [];

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; font-size: 12px; }
            .coordinator-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin: 8px 0; }
            .stat { padding: 6px; background: rgba(255, 255, 255, 0.08); }
            .swarm-status { margin: 8px 0; padding: 8px; background: rgba(0, 255, 255, 0.05); }
            .peer-list { margin: 8px 0; max-height: 150px; overflow-y: auto; }
            .peer-item { padding: 4px; margin: 2px 0; background: rgba(255, 255, 255, 0.08); font-size: 10px; }
            .activity-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 8px; }
            .init-btn { padding: 4px 8px; background: #0a0; color: #000; border: none; cursor: pointer; margin-top: 8px; }
          </style>
          <div class="coordinator-panel">
            <h4>♁ WebRTC Coordinator</h4>
            <div class="stats-grid">
              <div class="stat">Tasks: ${coordinationStats.totalTasks}</div>
              <div class="stat">Success: ${successRate}%</div>
              <div class="stat">Patterns: ${coordinationStats.patternsShared}</div>
            </div>
            <div class="swarm-status">
              <div><strong>Swarm Status</strong></div>
              <div>Local Peer: ${stats.localPeerId?.substring(0, 8) || 'N/A'}...</div>
              <div>Connected: ${stats.connectedPeers?.length || 0} / ${stats.totalPeers || 0} peers</div>
              <div>Capabilities: ${stats.capabilities?.join(', ') || 'None'}</div>
            </div>
            ${connectedPeers.length > 0 ? `
              <div class="peer-list">
                <strong>Connected Peers:</strong>
                ${connectedPeers.map(peer => `
                  <div class="peer-item">
                    ${peer.id.substring(0, 8)}... | ${peer.capabilities?.join(', ') || 'No caps'} | ${peer.status || 'active'}
                  </div>
                `).join('')}
              </div>
            ` : '<div>No peers connected</div>'}
            <div class="activity-grid">
              <div class="stat">Consensus: ${coordinationStats.consensusRequests}</div>
              <div class="stat">Knowledge: ${coordinationStats.knowledgeQueries}</div>
            </div>
            ${!isInitialized ? `
              <button class="init-btn init-coordinator-btn">Initialize Coordinator</button>
            ` : ''}
          </div>
        `;

        // Wire up initialize button
        const initBtn = this.shadowRoot.querySelector('.init-coordinator-btn');
        if (initBtn) {
          initBtn.addEventListener('click', async () => {
            await init();
            this.render();
          });
        }
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
- Register WebRTCCoordinator in `config.json` with all dependencies
- Dependencies: WebRTCSwarm, StateManager, ReflectionStore, EventBus, Utils, ToolRunner
- Mark as `async: true` since initialization is asynchronous
- Enable module by default or make opt-in via persona configuration

**Step 2: Define Module Structure with Closure State**
- Create factory function receiving dependencies via DI
- Define internal state variables accessible to widget via closure:
  - `isInitialized`: Boolean tracking initialization status
  - `localCapabilities`: Array of detected capabilities
  - `coordinationStats`: Object tracking tasks, patterns, consensus, queries
- This closure pattern eliminates need for property injection in widget

**Step 3: Implement Capability Detection**
- Create `detectCapabilities()` async function
- Check for Python runtime: `window.PyodideRuntime?.isReady()`
- Check for local LLM: `window.LocalLLM?.isReady()`
- Check for Git VFS: `window.GitVFS?.isInitialized()`
- Return array of capability strings: 'python-execution', 'local-llm', 'git-vfs', etc.
- Map task types to requirements: 'python-computation' → ['python-execution']

**Step 4: Define Web Component Class Inside Factory**
- Create `WebRTCCoordinatorWidget` class extending `HTMLElement`
- Attach Shadow DOM in constructor: `this.attachShadow({ mode: 'open' })`
- Widget has direct closure access to: isInitialized, coordinationStats, getStats(), init()
- No property injection needed - all state accessible via closure

**Step 5: Implement Widget Lifecycle Methods**
- `connectedCallback()`: Initial render + start auto-refresh
  - Set interval to refresh every 2000ms
  - Store interval reference in `this._interval`
- `disconnectedCallback()`: Clean up intervals
  - Clear `this._interval` to prevent memory leaks

**Step 6: Implement Widget Status Protocol**
- `getStatus()` as class method with ALL 5 required fields:
  - `state`: 'disabled' if not initialized, 'active' if peers connected, 'idle' if no peers
  - `primaryMetric`: Connected peer count
  - `secondaryMetric`: Total tasks delegated
  - `lastActivity`: Timestamp of last coordination activity
  - `message`: Status message if applicable
- Access coordinationStats and getStats() directly via closure

**Step 7: Implement Widget Render Method**
- Single `render()` method sets `this.shadowRoot.innerHTML`
- Include `<style>` tag with `:host` selector for scoped styles
- Render 3-column statistics grid (tasks, success rate, patterns shared)
- Display swarm status (peer ID, connected peers, capabilities)
- Show connected peers list with scrollable container
- Display activity breakdown (consensus, knowledge queries)
- Add initialize/reinitialize button
- Wire up button click handlers after render

**Step 8: Register Custom Element**
- Use kebab-case naming: `'webrtc-coordinator-widget'`
- Add duplicate check: `if (!customElements.get(elementName))`
- Call `customElements.define(elementName, WebRTCCoordinatorWidget)`
- Registration happens inside factory, after class definition

**Step 9: Return Module Interface**
- Return object with: init function, api object, widget descriptor
- Widget descriptor: `{ element, displayName, icon, category }`
- Remove old properties: renderPanel, getStatus, updateInterval
- Element name is the custom element tag string

**Step 10: Implement Message Handler Registration**
- Create `registerMessageHandlers()` function
- Register handler for 'task-execution' messages from peers
- Register handler for 'knowledge-request' messages
- Register handler for 'reflection-share' messages
- Each handler executes appropriate module function and responds
- Use WebRTCSwarm.sendToPeer() for responses with correlation IDs

**Step 11: Implement Task Delegation**
- Create `delegateTask(taskType, taskData)` function
- Build task descriptor with: name, requirements, data, delegator peer ID
- Call WebRTCSwarm.delegateTask() to find capable peer
- Track delegation stats: totalTasks++, tasksCompleted++ or tasksFailed++
- Log success/failure and emit events
- Return result object with success flag and data/error

**Step 12: Implement Task Execution**
- Create `executeTask(task)` function to handle incoming delegated tasks
- Switch on task.name to route to appropriate handler:
  - 'python-computation': Execute via ToolRunner.runTool('execute_python')
  - 'code-generation': Generate via HybridLLMProvider.complete()
  - 'file-analysis': Analyze via StateManager.getArtifactContent()
  - 'git-operation': Perform Git operations via GitVFS
- Return standardized result: `{ success, output/code/analysis, error }`
- Update coordinationStats.lastActivity on each execution

**Step 13: Implement Knowledge Exchange**
- Create `queryKnowledge(query)` function
- Search local reflections via ReflectionStore.searchReflections()
- Search artifacts via StateManager.searchArtifacts()
- Return curated knowledge object with both reflections and artifacts
- Limit results to prevent overwhelming responses (e.g., top 5 each)
- Track knowledgeQueries++ in coordinationStats

**Step 14: Implement Reflection Sharing**
- Create `shareSuccessPattern(reflection)` function
- Filter: only share reflections with outcome === 'successful'
- Build broadcast message with reflection data + metadata (sharedBy, timestamp)
- Call WebRTCSwarm.broadcast() to send to all connected peers
- Track patternsShared++ in coordinationStats
- Emit 'swarm:reflection-shared' event for UI feedback

**Step 15: Implement Reflection Integration**
- Create `integrateSharedReflection(peerId, reflection)` function
- Store incoming reflection via ReflectionStore.addReflection()
- Tag with provenance: add `shared_from_${peerId}` to tags array
- Add source field: 'swarm'
- Emit 'swarm:reflection-integrated' event
- Enables tracking which insights came from peers

**Step 16: Implement Consensus Mechanism**
- Create `requestModificationConsensus(modification)` function
- Create proposal object with: type, content, target, rationale, risk level
- Call assessModificationRisk() to determine risk: 'high' | 'medium' | 'low'
- Risk factors: core files, DELETE operations, eval() usage
- Call WebRTCSwarm.requestConsensus(proposal, 30000) with 30s timeout
- Track consensusRequests++ in coordinationStats
- Return consensus result with votes and decision
- Fallback to approval if swarm unavailable (document reason)

**Step 17: Boot Integration**
- Call `await WebRTCCoordinator.init()` during application boot
- Provide opt-in UI toggle (WebRTC disabled by default for security)
- Display warning toast if WebRTCSwarm dependency unavailable
- Widget shows "Not initialized" state until init() called

**Step 18: Dashboard Integration**
- Widget automatically integrates with module dashboard system
- Provides `getStatus()` for dashboard summary view
- Updates every 2 seconds via auto-refresh interval
- Initialize button in widget allows manual initialization

**Step 19: Security Considerations**
- Sanitize incoming task data; reject unsupported task types
- Limit file access to safe prefixes when executing remote requests
- Record all swarm operations via AuditLogger when available
- Validate peer identity before accepting high-risk task requests
- Use consensus mechanism for modifications to core system files

---

### 4. Verification Checklist
- [ ] Initialization registers handlers exactly once (no duplicates).
- [ ] Delegated tasks execute and respond with correlation IDs.
- [ ] Reflection sharing results in stored entries tagged with `shared_from_<peer>`.
- [ ] Consensus fallback to `consensus: true` only when swarm unavailable (documented reason).
- [ ] `getStats()` reflects real-time peer counts and capability list.

---

### 5. Extension Opportunities
- Implement workload balancing (choose peer with required capabilities and lowest queue).
- Add encrypted payloads for end-to-end privacy.
- Support collaborative editing sessions beyond task delegation.
- Integrate with Paxos competitions to coordinate multi-agent tournaments.

Maintain this blueprint for any changes to swarm messaging, capability detection, or consensus logic.
