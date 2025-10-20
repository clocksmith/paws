# Blueprint 0x000032: Rate Limiting Strategies

**Objective:** Govern the token-bucket and sliding-window rate limiter utilities used to protect external APIs and internal resources.

**Target Upgrade:** RATE (`rate-limiter.js`)

**Prerequisites:** 0x000007 (API Client & Communication), 0x000027 (Multi-Provider API Gateway), 0x000002 (Application Orchestration)

**Affected Artifacts:** `/upgrades/rate-limiter.js`, `/upgrades/api-client.js`, `/upgrades/api-client-multi.js`, `/upgrades/performance-monitor.js`

---

### 1. The Strategic Imperative
LLM providers enforce quotas; breaches trigger costly lockouts. Internally, aggressive tool usage can starve resources. Rate limiting:
- Smooths burst traffic.
- Guards against runaway loops or retry storms.
- Enables persona-specific budgets (e.g., Sandbox vs Production).

### 2. Architectural Overview
The module exports two limiter classes with consistent APIs:

```javascript
const { TokenBucketLimiter, SlidingWindowLimiter } = await ModuleLoader.getModule('RateLimiter');
const globalLimiter = new TokenBucketLimiter({ maxTokens: 60, refillRate: 1, name: 'openai' });

if (!globalLimiter.tryConsume()) {
  throw new Errors.RateLimitExceeded(globalLimiter.getTimeUntilNextToken());
}
```

- **TokenBucketLimiter**
  - Fields: `maxTokens`, `refillRate` (per second), `tokens`, `lastRefill`, `name`.
  - Methods: `tryConsume(tokensNeeded)`, `getTimeUntilNextToken()`, `getState()`, `reset()`.
  - Suitable for API calls allowing short bursts.

- **SlidingWindowLimiter**
  - Fields: `maxRequests`, `windowMs`, `requests[]`, `name`.
  - Methods: `tryConsume()`, `getRemainingRequests()`, `getTimeUntilReset()`, `reset()`.
  - Suitable for strict request ceilings (e.g., moderation endpoints).

### 3. Implementation Pathway
1. **Instantiation**
   - Create limiters during boot based on configuration (`config.rateLimits`).
   - Reuse instances; avoid recreating per request to keep stateful history.
2. **Integration Points**
   - Wrap API calls in `tryConsume()`; if false, surface friendly toast + optional retry timer.
   - Use EventBus to broadcast `rate:limited` events so UI and diagnostics react.
   - Combine with `PerformanceMonitor` to log rate-limit hits.
3. **Dynamic Adjustments**
   - Allow personas/hunter mode to adjust token budgets at runtime.
   - Provide admin command to call `reset()` after manual intervention.
4. **Observability**
   - Expose `getState()` telemetry for dashboards (tokens available, window usage).
   - Log debug messages when tokens consumed or limits exceeded (redacted for production if noisy).
5. **Fallback Strategy**
   - On limit breach, queue deferred tasks with exponential backoff or degrade to cached responses.
   - Offer `Estimate` version that returns wait time to user (`getTimeUntilNextToken`).

### 4. Verification Checklist
- [ ] Token bucket accurately refills proportional to elapsed time (unit tests across intervals).
- [ ] Sliding window purges timestamps older than window.
- [ ] Limiters remain deterministic regardless of clock skew (use Date.now).
- [ ] Logging levels appropriate (info on creation, warn on limit).
- [ ] Works in offline/browser contexts without Node globals.

### 5. Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class RateLimiterWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 500ms since tokens refill over time
    this._interval = setInterval(() => this.render(), 500);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const apiLimiter = limiters.api;
    const availableTokens = Math.floor(apiLimiter.tokens);
    const maxTokens = apiLimiter.maxTokens;
    const fillPercent = (availableTokens / maxTokens * 100).toFixed(0);

    let state = 'idle';
    if (availableTokens < maxTokens * 0.3) state = 'warning';
    if (availableTokens === 0) state = 'error';

    return {
      state,
      primaryMetric: `${availableTokens}/${maxTokens} tokens`,
      secondaryMetric: `${fillPercent}% available`,
      lastActivity: apiLimiter.lastRefill,
      message: null
    };
  }

  getControls() {
    return [
      {
        id: 'reset-limiter',
        label: '↻ Reset',
        action: () => {
          Object.values(limiters).forEach(limiter => limiter.reset());
          this.render();
          return { success: true, message: 'Rate limiters reset' };
        }
      }
    ];
  }

  render() {
    const apiLimiter = limiters.api;
    const strictLimiter = limiters.strict;

    // Token bucket visualization for API limiter
    const tokenPercent = (apiLimiter.tokens / apiLimiter.maxTokens * 100).toFixed(1);

    // Sliding window info for strict limiter
    const strictPercent = ((strictLimiter.requests.length / strictLimiter.maxRequests) * 100).toFixed(1);

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .rate-limiter-panel { padding: 12px; color: #fff; }
        h4 { margin: 0 0 12px 0; font-size: 1.1em; color: #0ff; }
        .limiter-section {
          margin: 20px 0;
          padding: 15px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 8px;
        }
        .bucket-container {
          width: 80px;
          height: 200px;
          border: 2px solid #4fc3f7;
          border-radius: 8px;
          position: relative;
          background: rgba(79, 195, 247, 0.1);
        }
        .bucket-fill {
          position: absolute;
          bottom: 0;
          background: linear-gradient(to top, #4fc3f7, #64b5f6);
          transition: height 0.3s ease;
        }
        .window-bar {
          height: 30px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }
        .window-fill {
          height: 100%;
          background: linear-gradient(to right, #4caf50, #66bb6a);
          transition: width 0.3s ease;
        }
      </style>
      <div class="rate-limiter-panel">
        <h4>⏲ Rate Limiter</h4>
        <div class="limiter-section">
          <h5>API Limiter (Token Bucket)</h5>
          <div class="token-bucket-visual">
            <div class="bucket-container">
              <div class="bucket-fill" style="height: ${tokenPercent}%">
                <span>${tokenPercent}%</span>
              </div>
            </div>
          </div>
          <div>Available: ${Math.floor(apiLimiter.tokens)} / ${apiLimiter.maxTokens}</div>
        </div>
        <div class="limiter-section">
          <h5>Strict Limiter (Sliding Window)</h5>
          <div class="sliding-window-visual">
            <div class="window-bar">
              <div class="window-fill" style="width: ${strictPercent}%"></div>
            </div>
          </div>
          <div>Requests: ${strictLimiter.requests.length} / ${strictLimiter.maxRequests}</div>
        </div>
      </div>
    `;
  }
}

// Register custom element
const elementName = 'rate-limiter-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, RateLimiterWidget);
}

const widget = {
  element: elementName,
  displayName: 'Rate Limiter',
  icon: '⏲',
  category: 'performance'
};
```

**Key features:**
- Real-time visual display of token bucket fill level
- Sliding window request count visualization
- Auto-refresh every 500ms to show token refill
- Color-coded status (idle/warning/error based on token availability)
- Control to reset all limiters
- Uses closure access to module state (limiters)
- Shadow DOM encapsulation for styling

### 6. Extension Ideas
- Persist rate limiter state in `StateManager` to survive reloads.
- Support distributed coordination (share counts across tabs via `TabCoordinator`, 0x000040).
- Provide policy DSL (e.g., "3 requests per 10s and 60 requests per hour").

Keep this blueprint updated when adding limiter variants or integrating with new providers.
