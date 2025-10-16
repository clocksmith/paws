# Blueprint 0x000039: Hybrid LLM Orchestration

**Objective:** Define how REPLOID seamlessly switches between local WebLLM inference and cloud APIs.

**Target Upgrade:** HYBR (`hybrid-llm-provider.js`)

**Prerequisites:** 0x000027 (Multi-Provider API Gateway), 0x000038 (Local LLM Runtime), 0x00002C (Performance Monitoring Stack)

**Affected Artifacts:** `/upgrades/hybrid-llm-provider.js`, `/upgrades/local-llm.js`, `/upgrades/api-client-multi.js`, `/upgrades/app-logic.js`

---

### 1. The Strategic Imperative
Hybrid inference unlocks the best of both worlds:
- **Cost & latency** via local models when available.
- **Raw capability** via cloud providers when necessary.
- **Resilience** through automatic fallback.

The orchestration layer coordinates this without exposing complexity to personas.

### 2. Architectural Overview
`HybridLLMProvider` exports a unified interface:

```javascript
const Hybrid = await ModuleLoader.getModule('HybridLLMProvider');
await Hybrid.init(cloudClient);
Hybrid.api.setMode('local'); // or 'cloud'
const result = await Hybrid.api.complete(messages, options);
```

Responsibilities:
- **Initialization**
  - Stores reference to `cloudAPIClient`.
  - Listens for `local-llm:ready`/`local-llm:unloaded` events to update availability.
- **Mode Management**
  - `setMode('local'|'cloud')` toggles inference path; emits `hybrid-llm:mode-changed`.
  - `getMode()` returns current selection; `isLocalAvailable()` checks runtime readiness.
- **Completion Pipeline**
  - `complete(messages, options)` chooses local or cloud based on mode.
  - On local failure, auto-fallback to cloud and emit `hybrid-llm:fallback`.
  - `completeLocal` formats messages for WebLLM, captures tokens/sec metrics.
  - `completeCloud` delegates to cloud client using Gemini-style schema.
- **Streaming**
  - If local mode with streaming supported, returns async generator from `LocalLLM.chat`.
  - Cloud streaming simulated by chunking text; can be replaced with true streaming when provider supports.
- **Status APIs**
  - `getStatus()` summarises mode, availability, current local model.
  - `getAutoSwitchConfig()` placeholder for future automatic heuristics.

### 3. Implementation Pathway
1. **Hook into App Logic**
   - Provide UI control allowing user to switch modes.
   - Persist preference in `StateManager` and reload on boot.
2. **Fallback Strategy**
   - When local inference throws, log event, emit fallback telemetry, and automatically retry cloud once.
   - Consider exponential backoff to avoid thrashing between providers.
3. **Telemetry**
   - Use `PerformanceMonitor` to record latency, tokens, and fallback counts.
   - Emit toast notification when fallback occurs so user is aware.
4. **Streaming Integration**
   - Normalize streaming payload to `{ delta, text, done, provider }`.
   - For cloud simulation, ensure consistent timing (50ms delay may be tuned).
5. **Extensibility**
   - Accept config object (weights, provider priority) for auto mode in future.
   - Support multi-modal messages (images) when both providers handle them.

### 4. Verification Checklist
- [ ] Switching to local fails gracefully if runtime not ready (returns false and logs warning).
- [ ] Fallback triggers only once per failure and notifies UI.
- [ ] Streaming generator terminates with `done: true` and usage data.
- [ ] `getStatus()` accurately reflects runtime state immediately after events.
- [ ] Cloud client absence surfaces helpful error message.

### 5. Extension Opportunities
- Integrate with persona definitions (some personas default to local/local-first).
- Add automatic mode: prefer local unless token quality drops below threshold.
- Provide cost estimator comparing modes per session.
- Support hybrid ensembles (combine local + cloud responses).

Maintain this blueprint when adjusting mode logic, telemetry, or fallback behaviour.
