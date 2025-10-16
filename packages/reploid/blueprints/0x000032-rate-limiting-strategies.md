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

### 5. Extension Ideas
- Persist rate limiter state in `StateManager` to survive reloads.
- Support distributed coordination (share counts across tabs via `TabCoordinator`, 0x000040).
- Provide policy DSL (e.g., “3 requests per 10s and 60 requests per hour”).

Keep this blueprint updated when adding limiter variants or integrating with new providers.
