# Blueprint 0x00003F: API Cost Tracker & Rate Governance

**Objective:** Provide a framework for tracking token usage, estimating spend, and enforcing rate limits across LLM providers.

**Target Upgrade:** COST (`cost-tracker.js`)

**Prerequisites:** 0x000027 (Multi-Provider API Gateway), 0x000032 (Rate Limiting Strategies), 0x00002C (Performance Monitoring Stack)

**Affected Artifacts:** `/upgrades/cost-tracker.js`, `/upgrades/api-client-multi.js`, `/styles/dashboard.css`

---

### 1. The Strategic Imperative
API usage maps directly to operational cost and user experience. Without tracking:
- Budgets can be exceeded silently.
- Providers throttle requests unpredictably.
- The agent cannot optimise provider selection.

This blueprint ensures transparency and control over inference spend.

### 2. Architectural Overview
`CostTracker` subscribes to API completion events and maintains session/stateful metrics.

```javascript
const CostTracker = await ModuleLoader.getModule('CostTracker');
await CostTracker.init();
if (!CostTracker.api.checkRateLimit('gemini')) return; // back off
```

Key responsibilities:
- **Pricing Table** (`PRICING`): per-provider USD per million tokens (input/output). Local models cost 0.
- **Rate Limits** (`RATE_LIMITS`): max requests per minute per provider.
- **Event Handling**
  - `handleApiComplete`: logs cloud API calls (`api:complete` event) with token usage and cost.
  - `handleHybridComplete`: maps hybrid responses to cloud/local handlers.
  - `handleLocalComplete`: records token usage for local completions (zero cost).
- **Cost Calculation**
  - `calculateCost(call)` multiplies token usage by pricing.
  - `getTotalCost()`, `getSessionCost()`, `getCostStats(period)`.
  - `getCostByProvider()` summarises per provider (count, tokens, cost).
- **Rate Limiting**
  - `checkRateLimit(provider)` uses sliding window (60s) to decide if a request is allowed; emits `rate-limit:exceeded` when throttled.
  - `getRateLimitStatus()` exposes utilisation and reset timers.
- **Reporting**
  - `generateReport()` outputs markdown summarising session spend, last 24h stats, provider breakdown, rate limits.
- **Persistence**
  - Stores `apiCalls` and `sessionStart` in `StateManager` so data survives reload.
  - `resetSession()` resets counters; `clearAll()` wipes history.

**Web Component Widget:**

The widget uses a Web Component with Shadow DOM for encapsulated cost visualization:

```javascript
class CostTrackerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
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
    const totalCost = getTotalCost();
    const sessionCost = getSessionCost();
    const recentCalls = apiCalls.filter(c =>
      Date.now() - c.timestamp < 300000
    ).length;
    const hasRecentActivity = recentCalls > 0;

    return {
      state: hasRecentActivity ? 'active' : (apiCalls.length > 0 ? 'idle' : 'disabled'),
      primaryMetric: totalCost > 0 ? `$${totalCost.toFixed(3)}` : '$0.000',
      secondaryMetric: `${apiCalls.length} calls`,
      lastActivity: apiCalls.length > 0 ? apiCalls[apiCalls.length - 1].timestamp : null,
      message: sessionCost > 0 ? `Session: $${sessionCost.toFixed(3)}` : null
    };
  }

  getControls() {
    return [
      {
        id: 'reset-session',
        label: '🔄 Reset Session',
        action: () => {
          resetSession();
          this.render();
          return { success: true, message: 'Session reset' };
        }
      },
      {
        id: 'export-report',
        label: '📊 Export Report',
        action: () => {
          const report = generateReport();
          return { success: true, message: 'Report generated', data: report };
        }
      }
    ];
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        /* Cost visualization styles */
      </style>
      <div class="cost-tracker-panel">
        <h4>⚯ Cost Tracker</h4>
        <!-- Cost breakdown, provider stats, rate limits -->
      </div>
    `;
  }
}

// Register custom element
const elementName = 'cost-tracker-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, CostTrackerWidget);
}

const widget = {
  element: elementName,
  displayName: 'Cost Tracker',
  icon: '⚯',
  category: 'analytics'
};
```

**Key features:**
- Real-time cost tracking via closure access to `apiCalls` array
- Auto-refreshes every 2 seconds to display current spend
- Shows total cost, session cost, and API call count
- Interactive controls for session reset and report generation

### 3. Implementation Pathway
1. **Event Integration**
   - Ensure API clients emit `api:complete` with provider + `usage` (prompt/completion token fields).
   - Hybrid/local providers should emit `hybrid-llm:complete` / `local-llm:complete` and call tracker.
2. **Budget Awareness**
   - Offer UI to set session/weekly budget thresholds; emit `cost:warning` when nearing limit (future enhancement).
3. **Rate Enforcement**
   - Call `checkRateLimit()` before issuing requests; if false, delay or queue.
   - Use `RateLimiter` (0x000032) for fine-grained control; cost tracker handles per-provider quotas.
4. **Analytics Display**
   - Feed data to metrics dashboard (cost over time chart, provider pie chart).
   - Provide quick summary in status bar (e.g., `$0.12 today`).
5. **Data Hygiene**
   - Consider pruning old `apiCalls` to avoid unbounded growth (e.g., keep last 30 days).
   - Persist aggregated totals for long-term history (per-day sums).

### 4. Verification Checklist
- [ ] Logging cloud API call with usage updates cost totals and emits `cost:updated`.
- [ ] Rate limit warnings trigger when limit exceeded and cooldown respected.
- [ ] Hybrid/local flows map to appropriate provider stats (no double-counting).
- [ ] Session restore from `StateManager` seeds previous totals.
- [ ] Report values match manual calculations for sample data.

### 5. Extension Opportunities
- Integrate with `ToastNotifications` for budget alerts.
- Add per-persona budgets and provider preference suggestions.
- Export CSV of API usage for accounting.
- Overlay cost data with reflection success to evaluate ROI per provider.

Maintain this blueprint when pricing changes, new providers are added, or budgeting features evolve.
