# Blueprint 0x00003A: Swarm Orchestration

**Objective:** Describe how REPLOID coordinates multi-agent collaboration over WebRTC to share workload, knowledge, and governance.

**Target Upgrade:** SWRM (`swarm-orchestrator.js`)

**Prerequisites:** 0x000043 (Browser APIs), 0x000044 (WebRTC Swarm Transport), 0x00001B (Code Introspection & Self-Analysis), 0x00003B (Reflection Store)

**Affected Artifacts:** `/upgrades/swarm-orchestrator.js`, `/upgrades/webrtc-swarm.js`, `/upgrades/reflection-store.js`, `/upgrades/tool-runner.js`

---

### 1. The Strategic Imperative
Distributed cognition multiplies capability:
- Delegate heavy computation (Python, code generation) to capable peers.
- Share successful reflections so improvements propagate quickly.
- Require consensus before risky modifications, building trust.

Swarm orchestration must remain deterministic and safe to avoid chaos.

### 2. Architectural Overview
`SwarmOrchestrator` wraps lower-level WebRTC signalling (`WebRTCSwarm`) with agent semantics.

```javascript
const Swarm = await ModuleLoader.getModule('SwarmOrchestrator');
await Swarm.init();
const result = await Swarm.api.delegateTask('python-computation', { code: 'print(6*7)' });
```

Key responsibilities:
- **Initialization**
  - Detect local capabilities (`python-execution`, `local-llm`, `git-vfs`, etc.).
  - Register message handlers for `task-execution`, `knowledge-request`, `reflection-share`.
  - Sync capability list with swarm (`WebRTCSwarm.updateCapabilities`).
- **Task Delegation**
  - `delegateTask(taskType, data)` builds task descriptor with requirements then calls `WebRTCSwarm.delegateTask`.
  - Local `executeTask` resolves incoming tasks using Tool Runner, Hybrid LLM, or StateManager (file analysis).
- **Knowledge Exchange**
  - `queryKnowledge` merges local reflections search + artifact search; responds to peers with curated results.
- **Reflection Sharing**
  - `shareSuccessPattern` broadcasts winning reflections; `integrateSharedReflection` tags imported reflections for provenance.
- **Consensus**
  - `requestModificationConsensus` sends proposals (file, rationale, risk) and waits for peer votes.
  - `assessModificationRisk` tags high-risk changes (core files, deletes, `eval` usage).
- **Telemetry**
  - `getStats()` returns peer counts, capabilities, and IDs for UI dashboards.

### 3. Implementation Pathway
1. **Transport Setup**
   - Ensure `WebRTCSwarm` (0x000044) handles signalling server connection, peer lifecycle, and `delegateTask` API.
   - Provide opt-in UI toggle (WebRTC disabled by default for security).
2. **Capability Detection**
   - Extend `detectCapabilities()` when new local upgrades become available (e.g., GPU inference).
   - Publish updates to peers when capability set changes.
3. **Task Execution**
   - Wrap execution in try/catch; return `{ success, error }` on failure.
   - For Python tasks, rely on `ToolRunner.runTool('execute_python', ...)`.
   - For code-gen tasks, call `HybridLLM.complete` with fallback semantics.
4. **Consensus Workflow**
   - Use 30s timeout (configurable) when requesting consensus.
   - Display results via EventBus (`swarm:consensus-result`) and block application if consensus negative.
5. **Security Considerations**
   - Sanitize incoming tasks; reject unsupported types.
   - Limit file access to safe prefixes when executing remote requests.
   - Record operations via `AuditLogger`.

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
