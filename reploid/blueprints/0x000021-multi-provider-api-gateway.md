# Blueprint 0x000027: Multi-Provider API Gateway

**Objective:** Establish the contract for routing LLM traffic across Gemini, OpenAI, Anthropic, and local inference backends through a unified client.

**Target Upgrade:** APMC (`api-client-multi.js`)

**Prerequisites:** 0x000007 (API Client & Communication), 0x000013 (System Configuration Structure), 0x000010 (Static Tool Manifest)

**Affected Artifacts:** `/upgrades/api-client-multi.js`, `/upgrades/state-manager.js`, `/config.json` (`defaultCore`, provider settings)

---

### 1. The Strategic Imperative
Self-improving agents must pivot providers based on cost, capability, or safety. Hard-coding a single API endpoint creates vendor lock-in and limits experimentation. This blueprint ensures:
- **Provider agility**: one switch toggles between Gemini, OpenAI, Anthropic, and local engines.
- **Tool parity**: function/tool calls remain consistent regardless of backend quirks.
- **Safety invariants**: retries, abort controllers, and rate limits stay enforced.
- **Proxy awareness**: the UI accurately reflects availability of a local proxy.

### 2. Architectural Overview
`ApiClientMulti` wraps provider-specific logic while exposing a single API:

```javascript
const client = await ModuleLoader.getModule('ApiClientMulti');
const response = await client.generate({
  goal,
  messages,
  tools,
  options: { provider: 'anthropic', temperature: 0.3 }
});
```

Key responsibilities:

- **Provider Detection**
  - `checkProxyAvailability()` probes `/api/proxy-status` and caches supported providers.
  - Auto-selects the best provider if `config.apiProvider` is unset.

- **Message Normalization**
  - `formatMessagesForProvider()` converts REPLOID chat format to provider-specific payloads.
  - Maintains function/tool call schemas even when providers use different fields.

- **Request Construction**
  - `buildRequestBody()` sets temperature, token limits, and tool definitions depending on provider.
  - Applies safety settings (Gemini harm categories, Anthropic system prompt management).

- **Execution Pipeline**
  - `callProvider()` handles retries, exponential backoff, abort support, and structured result parsing.
  - Surfaces errors through `ApiError`/`AbortError` from `Utils.Errors`.

- **State Integration**
  - Persists provider choice in `StateManager`.
  - Notifies UI via EventBus so the dashboard reflects active provider.

**Widget Interface (Web Component):**

The module exposes an `ApiClientMultiWidget` custom element for dashboard visualization and provider control:

```javascript
class ApiClientMultiWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    if (this.updateInterval) {
      this._interval = setInterval(() => this.render(), this.updateInterval);
    }
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const totalCalls = Object.values(_providerStats).reduce((sum, stat) => sum + stat.calls, 0);
    const totalSuccess = Object.values(_providerStats).reduce((sum, stat) => sum + stat.successes, 0);
    const isActive = _lastActivity && (Date.now() - _lastActivity < 2000);

    return {
      state: isActive ? 'active' : 'idle',
      primaryMetric: currentProvider,
      secondaryMetric: `${totalCalls} calls`,
      lastActivity: _lastActivity,
      message: `${totalSuccess}/${totalCalls} successful`
    };
  }

  render() {
    // Shadow DOM with provider status, controls, statistics, and recent calls
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">
        <!-- Active provider display with proxy status -->
        <!-- Provider switching controls (buttons for available providers) -->
        <!-- Provider statistics grid (gemini, openai, anthropic, local) -->
        <!-- Recent API calls history (last 20 with outcomes) -->
        <!-- Total statistics summary -->
      </div>
    `;

    // Event listeners for interactive controls
    this.shadowRoot.querySelectorAll('.provider-switch').forEach(btn => {
      btn.addEventListener('click', () => setProvider(btn.dataset.provider));
    });
    this.shadowRoot.querySelector('.check-proxy')?.addEventListener('click',
      async () => await checkProxyAvailability()
    );
  }
}

const elementName = 'api-client-multi-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, ApiClientMultiWidget);
}
```

**Key Widget Features:**
- **Active Provider Display**: Large, highlighted display of current provider (GEMINI/OPENAI/ANTHROPIC/LOCAL)
- **Proxy Status Indicator**: Shows proxy availability status with visual indicator
- **Provider Switching Controls**: Interactive buttons to switch between available providers
- **Proxy Check Button**: Manual trigger to refresh proxy availability status
- **Per-Provider Statistics**: Four-panel grid showing detailed stats for each provider:
  - Total API calls made to provider
  - Success rate percentage (color-coded: green >90%, orange >50%, red <50%)
  - Failure count
  - Average retries per successful call
  - Active provider highlighted with visual accent
- **Recent API Calls Log**: Last 20 API calls with detailed information:
  - Provider used (GEMINI/OPENAI/ANTHROPIC/LOCAL)
  - Success/failure indicator
  - Retry count if applicable
  - Error message preview (first 60 chars) for failed calls
  - Duration in seconds
  - Time ago (relative timestamp)
  - Color-coded by outcome (green for success, red for failure)
- **Total Statistics Summary**: Aggregate view across all providers
- **Auto-Refresh**: Updates every 5 seconds to track ongoing API activity
- **Interactive Controls**: Direct provider switching without leaving dashboard

The widget provides critical visibility into multi-provider API orchestration, essential for monitoring provider health, switching providers when needed, tracking success rates, and debugging API failures across different LLM backends.

### 3. Implementation Pathway
1. **Provider Onboarding**
   - Extend `SUPPORTED_PROVIDERS` map with endpoint URLs, headers, and adaptor logic.
   - Update `buildRequestBody` and `formatMessagesForProvider` accordingly.
2. **Tool Support**
   - Translate tool definitions from `tools-*.json` to provider-compatible function schemas.
   - Ensure providers lacking tool support short-circuit gracefully with informative errors.
3. **Safety & Observability**
   - Integrate with `RateLimiter` (0x000032) and `CostTracker` (0x00003F) to record usage.
   - Emit structured logs through `logger.info/error` so analytics dashboards capture latency and failures.
4. **Cancellation Semantics**
   - Maintain `currentAbortController` and expose `client.abortCurrentRequest()` to UI components.
5. **Offline Mode**
   - When `provider === 'local'`, target local inference endpoints (e.g., Ollama) with minimal schema adjustments.
   - Provide user guidance via toast notifications when a provider is unavailable.

### 4. Verification Criteria
- **Unit coverage**: stub each provider and assert request payloads are well-formed.
- **Integration drills**: simulate proxy offline/online transitions and confirm automatic fallback.
- **Tool invocation**: run end-to-end tests where the LLM returns `function_call` events and tool outputs feed back into the loop.
- **Telemetry parity**: ensure success/error metrics flow into `PerformanceMonitor` and `MetricsDashboard`.

### 5. Operational Playbook
- Expose provider controls in UI (drop-down or persona preset) bound to `client.setProvider`.
- Cache last-known error per provider so the agent can avoid thrashing between failing endpoints.
- Keep provider secrets isolated in browser-local storage (`config-modal`) and avoid logging raw keys.

Use this blueprint whenever introducing a new provider, adjusting retry logic, or debugging API discrepancies. The gateway is the backbone of multi-cloud resilience.
