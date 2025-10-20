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

**Widget Interface (Web Component):**

The module exposes a `HybridLLMProviderWidget` custom element for dashboard visualization:

```javascript
class HybridLLMProviderWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const mode = getMode();
    const totalTokens = usageStats.local.tokens + usageStats.cloud.tokens;

    return {
      state: isGenerating ? 'active' : 'idle',
      primaryMetric: mode === 'local' ? '⌨ Local' : '☁️ Cloud',
      secondaryMetric: `${totalTokens.toLocaleString()} tokens`,
      lastActivity: usageStats.switchHistory.length > 0 ? usageStats.switchHistory[0].timestamp : null
    };
  }

  renderPanel() {
    // Returns HTML for:
    // - Current provider indicator (Local/Cloud) with switch buttons
    // - Provider comparison table (requests, tokens, avg time, errors)
    // - Availability status (Local LLM ready, Cloud API available)
    // - Fallback history (recent auto-fallbacks from local to cloud)
    // - Mode switch history (manual vs automatic switches)
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">${this.renderPanel()}</div>
    `;

    // Wire up interactive switch buttons
    this.shadowRoot.querySelectorAll('.switch-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetMode = btn.dataset.mode;
        trackedSetMode(targetMode);
        this.render();
      });
    });
  }
}

customElements.define('hybrid-llm-provider-widget', HybridLLMProviderWidget);
```

**Key Widget Features:**
- **Provider Comparison Table**: Side-by-side statistics for local vs cloud (requests, tokens, average latency, error counts)
- **Interactive Mode Switching**: Buttons to switch between local and cloud modes directly from the widget
- **Availability Indicators**: Visual status of local LLM readiness (model name) and cloud API availability
- **Fallback Tracking**: Displays recent auto-fallbacks with timestamps and error messages
- **Switch History**: Shows last 5 mode switches with "Manual" vs "Auto" labels and relative timestamps
- **Real-time Updates**: Auto-refreshes every 5 seconds to display current mode and generation activity

The widget provides complete visibility into the hybrid orchestration system's behavior, enabling users to monitor performance differences and manually optimize inference routing.

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
