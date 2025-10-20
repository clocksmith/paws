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

  render() {
    // Access closure state for hybrid provider
    const mode = getMode();
    const modeIcon = mode === 'local' ? '⌨' : '☁️';
    const modeLabel = mode === 'local' ? 'Local' : 'Cloud';
    const isLocalAvailable = getLocalAvailability();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .hybrid-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .mode-indicator { font-size: 16px; font-weight: bold; margin: 8px 0; }
        .switch-btn { padding: 6px 12px; margin: 4px; background: #0a0; color: #000; border: none; cursor: pointer; }
        .switch-btn.active { background: #0f0; }
        .switch-btn:disabled { background: #444; color: #888; cursor: not-allowed; }
        .comparison-table { width: 100%; margin: 8px 0; border-collapse: collapse; }
        .comparison-table td { padding: 4px 8px; border: 1px solid #444; }
        .availability { margin: 8px 0; }
        .available { color: #0f0; }
        .unavailable { color: #f00; }
        .fallback-item { padding: 4px; margin: 2px 0; background: rgba(255, 165, 0, 0.1); font-size: 10px; }
      </style>
      <div class="hybrid-panel">
        <h4>🔀 Hybrid LLM Provider</h4>
        <div class="mode-indicator">${modeIcon} Current: ${modeLabel}</div>
        <div>
          <button class="switch-btn ${mode === 'local' ? 'active' : ''}"
                  data-mode="local"
                  ${!isLocalAvailable ? 'disabled' : ''}>
            ⌨ Local
          </button>
          <button class="switch-btn ${mode === 'cloud' ? 'active' : ''}"
                  data-mode="cloud">
            ☁️ Cloud
          </button>
        </div>
        <table class="comparison-table">
          <tr>
            <td><strong>Provider</strong></td>
            <td><strong>Requests</strong></td>
            <td><strong>Tokens</strong></td>
            <td><strong>Avg Time</strong></td>
            <td><strong>Errors</strong></td>
          </tr>
          <tr>
            <td>Local</td>
            <td>${usageStats.local.requests}</td>
            <td>${usageStats.local.tokens.toLocaleString()}</td>
            <td>${usageStats.local.avgTime.toFixed(0)}ms</td>
            <td>${usageStats.local.errors}</td>
          </tr>
          <tr>
            <td>Cloud</td>
            <td>${usageStats.cloud.requests}</td>
            <td>${usageStats.cloud.tokens.toLocaleString()}</td>
            <td>${usageStats.cloud.avgTime.toFixed(0)}ms</td>
            <td>${usageStats.cloud.errors}</td>
          </tr>
        </table>
        <div class="availability">
          <div>Local LLM: <span class="${isLocalAvailable ? 'available' : 'unavailable'}">
            ${isLocalAvailable ? `✓ Ready (${currentLocalModel})` : '✗ Not Available'}
          </span></div>
          <div>Cloud API: <span class="available">✓ Available</span></div>
        </div>
        ${usageStats.fallbackHistory.length > 0 ? `
          <div style="margin-top: 8px;">
            <strong>Recent Fallbacks:</strong>
            ${usageStats.fallbackHistory.slice(0, 3).map(fb => `
              <div class="fallback-item">
                ${new Date(fb.timestamp).toLocaleTimeString()}: ${fb.reason}
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
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

**Step 1: Define Web Component Class**
- Create `HybridLLMProviderWidget` class extending `HTMLElement` inside factory function
- Widget has closure access to module state: mode, usageStats, isGenerating
- Attach Shadow DOM in constructor: `this.attachShadow({ mode: 'open' })`

**Step 2: Implement Lifecycle Methods**
- `connectedCallback()`: Initial render + start auto-refresh
  - Set interval to refresh every 5000ms
  - Store interval reference in `this._interval`
- `disconnectedCallback()`: Clean up intervals to prevent memory leaks
  - Clear `this._interval` if exists

**Step 3: Implement Status Protocol**
- `getStatus()` as class method with ALL 5 required fields:
  - `state`: 'active' if generating, 'idle' otherwise
  - `primaryMetric`: Current mode ('⌨ Local' or '☁️ Cloud')
  - `secondaryMetric`: Total tokens across both providers
  - `lastActivity`: Timestamp of last mode switch
  - `message`: null (or error if applicable)
- Access module state directly via closure (getMode(), usageStats)

**Step 4: Implement Render Method**
- Single `render()` method sets `this.shadowRoot.innerHTML`
- Include `<style>` tag with `:host` selector for scoped styles
- Render provider comparison table (requests, tokens, avg time, errors)
- Show availability status (Local LLM ready, Cloud API available)
- Display fallback history with timestamps
- Show mode switch history (manual vs automatic)
- Wire up interactive switch buttons after render

**Step 5: Register Custom Element**
- Use kebab-case naming: `'hybrid-llm-provider-widget'`
- Add duplicate check: `if (!customElements.get(elementName))`
- Call `customElements.define(elementName, HybridLLMProviderWidget)`

**Step 6: Return New Widget Format**
- Return widget object: `{ element, displayName, icon, category }`
- Remove old properties: renderPanel, getStatus, updateInterval
- Element name is now the custom element tag

**Step 7: Hook into App Logic**
- Widget provides interactive mode switching via buttons
- Calls `trackedSetMode(targetMode)` directly via closure
- Persist preference in `StateManager` and reload on boot

**Step 8: Fallback Strategy**
- When local inference throws, log event and emit fallback telemetry
- Automatically retry cloud once
- Widget displays fallback events in history section
- Consider exponential backoff to avoid thrashing between providers

**Step 9: Telemetry Integration**
- Use `PerformanceMonitor` to record latency, tokens, and fallback counts
- Widget displays comparison table showing performance differences
- Emit toast notification when fallback occurs so user is aware
- Track switch history (manual vs automatic) for analysis

**Step 10: Streaming Integration**
- Normalize streaming payload to `{ delta, text, done, provider }`
- For cloud simulation, ensure consistent timing (50ms delay may be tuned)
- Both local and cloud return consistent formats

**Step 11: Extensibility**
- Accept config object (weights, provider priority) for auto mode in future
- Support multi-modal messages (images) when both providers handle them
- Widget can display additional metrics as features expand

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
