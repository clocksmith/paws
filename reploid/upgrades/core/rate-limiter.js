// @blueprint 0x00002C - Covers rate limiting strategies for API usage.
// Rate Limiter Module for API calls
// Implements token bucket algorithm for rate limiting

const RateLimiter = {
  metadata: {
    id: 'RateLimiter',
    version: '1.0.0',
    description: 'Token bucket rate limiter for API calls',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    /**
     * Token Bucket Rate Limiter
     *
     * Algorithm:
     * - Bucket starts with max tokens
     * - Each API call consumes 1 token
     * - Tokens refill at a constant rate
     * - If bucket is empty, calls are rejected
     *
     * Benefits:
     * - Prevents API quota exhaustion
     * - Allows bursts up to bucket capacity
     * - Smooth rate over time
     */
    class TokenBucketLimiter {
      constructor(options = {}) {
        this.maxTokens = options.maxTokens || 10; // Max tokens in bucket
        this.refillRate = options.refillRate || 1; // Tokens per second
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
        this.name = options.name || 'default';

        logger.info(`[RateLimiter] Created ${this.name} limiter`, {
          maxTokens: this.maxTokens,
          refillRate: this.refillRate
        });
      }

      /**
       * Refill tokens based on time elapsed
       * @private
       */
      _refill() {
        const now = Date.now();
        const elapsed = (now - this.lastRefill) / 1000; // Convert to seconds
        const tokensToAdd = elapsed * this.refillRate;

        this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
        this.lastRefill = now;
      }

      /**
       * Try to consume a token
       * @param {number} tokensNeeded - Number of tokens to consume (default: 1)
       * @returns {boolean} True if token was consumed, false if rate limited
       */
      tryConsume(tokensNeeded = 1) {
        this._refill();

        if (this.tokens >= tokensNeeded) {
          this.tokens -= tokensNeeded;
          logger.debug(`[RateLimiter] ${this.name}: Consumed ${tokensNeeded} token(s), ${this.tokens.toFixed(2)} remaining`);
          return true;
        }

        logger.warn(`[RateLimiter] ${this.name}: Rate limit exceeded, ${this.tokens.toFixed(2)} tokens available, ${tokensNeeded} needed`);
        return false;
      }

      /**
       * Get time until next token is available
       * @returns {number} Milliseconds until next token
       */
      getTimeUntilNextToken() {
        this._refill();

        if (this.tokens >= 1) {
          return 0;
        }

        const tokensNeeded = 1 - this.tokens;
        const timeNeeded = (tokensNeeded / this.refillRate) * 1000; // Convert to ms
        return Math.ceil(timeNeeded);
      }

      /**
       * Get current state
       * @returns {Object} Current limiter state
       */
      getState() {
        this._refill();
        return {
          tokens: this.tokens,
          maxTokens: this.maxTokens,
          refillRate: this.refillRate,
          percentage: (this.tokens / this.maxTokens) * 100
        };
      }

      /**
       * Reset the limiter
       */
      reset() {
        this.tokens = this.maxTokens;
        this.lastRefill = Date.now();
        logger.info(`[RateLimiter] ${this.name}: Reset to ${this.maxTokens} tokens`);
      }
    }

    /**
     * Sliding Window Rate Limiter
     * Alternative algorithm that tracks requests in a time window
     */
    class SlidingWindowLimiter {
      constructor(options = {}) {
        this.maxRequests = options.maxRequests || 10;
        this.windowMs = options.windowMs || 60000; // 1 minute default
        this.requests = [];
        this.name = options.name || 'sliding-window';

        logger.info(`[RateLimiter] Created ${this.name} limiter`, {
          maxRequests: this.maxRequests,
          windowMs: this.windowMs
        });
      }

      /**
       * Clean old requests outside the window
       * @private
       */
      _cleanOldRequests() {
        const now = Date.now();
        const cutoff = now - this.windowMs;
        this.requests = this.requests.filter(timestamp => timestamp > cutoff);
      }

      /**
       * Try to record a request
       * @returns {boolean} True if request allowed, false if rate limited
       */
      tryConsume() {
        this._cleanOldRequests();

        if (this.requests.length < this.maxRequests) {
          this.requests.push(Date.now());
          logger.debug(`[RateLimiter] ${this.name}: Request allowed, ${this.requests.length}/${this.maxRequests} used`);
          return true;
        }

        logger.warn(`[RateLimiter] ${this.name}: Rate limit exceeded, ${this.requests.length}/${this.maxRequests} requests in window`);
        return false;
      }

      /**
       * Get time until next request is allowed
       * @returns {number} Milliseconds until next request
       */
      getTimeUntilNextToken() {
        this._cleanOldRequests();

        if (this.requests.length < this.maxRequests) {
          return 0;
        }

        const oldestRequest = Math.min(...this.requests);
        const timeUntilExpire = (oldestRequest + this.windowMs) - Date.now();
        return Math.max(0, timeUntilExpire);
      }

      /**
       * Get current state
       * @returns {Object} Current limiter state
       */
      getState() {
        this._cleanOldRequests();
        return {
          requests: this.requests.length,
          maxRequests: this.maxRequests,
          windowMs: this.windowMs,
          percentage: (this.requests.length / this.maxRequests) * 100
        };
      }

      /**
       * Reset the limiter
       */
      reset() {
        this.requests = [];
        logger.info(`[RateLimiter] ${this.name}: Reset`);
      }
    }

    // Default limiters for common use cases
    const limiters = {
      // API call limiter: 10 calls/min with burst of 5
      api: new TokenBucketLimiter({
        name: 'api',
        maxTokens: 5,
        refillRate: 10 / 60 // 10 per minute = 0.167 per second
      }),

      // Strict limiter: 20 calls/min
      strict: new SlidingWindowLimiter({
        name: 'strict',
        maxRequests: 20,
        windowMs: 60000
      })
    };

    /**
     * Create a new rate limiter
     * @param {string} type - 'token-bucket' or 'sliding-window'
     * @param {Object} options - Limiter configuration
     * @returns {TokenBucketLimiter|SlidingWindowLimiter}
     */
    const createLimiter = (type = 'token-bucket', options = {}) => {
      if (type === 'token-bucket') {
        return new TokenBucketLimiter(options);
      } else if (type === 'sliding-window') {
        return new SlidingWindowLimiter(options);
      } else {
        throw new Error(`Unknown limiter type: ${type}`);
      }
    };

    /**
     * Get a default limiter by name
     * @param {string} name - 'api' or 'strict'
     * @returns {TokenBucketLimiter|SlidingWindowLimiter}
     */
    const getLimiter = (name = 'api') => {
      return limiters[name] || limiters.api;
    };

    /**
     * Async wait for rate limit to be available
     * @param {Object} limiter - Rate limiter instance
     * @param {number} maxWaitMs - Max time to wait (default: 5000ms)
     * @returns {Promise<boolean>} True if acquired, false if timeout
     */
    const waitForToken = async (limiter, maxWaitMs = 5000) => {
      const startTime = Date.now();

      while (Date.now() - startTime < maxWaitMs) {
        if (limiter.tryConsume()) {
          return true;
        }

        const waitTime = Math.min(
          limiter.getTimeUntilNextToken(),
          maxWaitMs - (Date.now() - startTime)
        );

        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      logger.warn(`[RateLimiter] Timeout waiting for token after ${maxWaitMs}ms`);
      return false;
    };

    // Web Component Widget
    class RateLimiterWidget extends HTMLElement {
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
          lastActivity: apiLimiter.lastRefill
        };
      }

      getControls() {
        return [
          {
            id: 'reset-limiter',
            label: '↻ Reset',
            action: () => {
              Object.values(limiters).forEach(limiter => {
                if (limiter.reset) limiter.reset();
                if (limiter.tokens !== undefined) {
                  limiter.tokens = limiter.maxTokens;
                  limiter.lastRefill = Date.now();
                }
              });
              this.render();
              return { success: true, message: 'Rate limiters reset' };
            }
          }
        ];
      }

      render() {
        const apiLimiter = limiters.api;
        const strictLimiter = limiters.strict;

        const formatTime = (ms) => {
          if (ms < 1000) return `${ms.toFixed(0)}ms`;
          return `${(ms / 1000).toFixed(1)}s`;
        };

        // Token bucket visualization for API limiter
        const tokenPercent = (apiLimiter.tokens / apiLimiter.maxTokens * 100).toFixed(1);

        // Sliding window info for strict limiter
        const strictPercent = strictLimiter.requests
          ? ((strictLimiter.requests.length / strictLimiter.maxRequests) * 100).toFixed(1)
          : 0;

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }
            .rate-limiter-panel {
              padding: 12px;
              color: #fff;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }
            h5 {
              margin: 0 0 8px 0;
              font-size: 1em;
              color: #0ff;
            }
            .limiter-section {
              margin: 20px 0;
              padding: 15px;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 8px;
            }
            .limiter-stats {
              margin-bottom: 15px;
            }
            .stat-row {
              display: flex;
              justify-content: space-between;
              padding: 4px 0;
              color: #ccc;
            }
            .stat-label {
              color: #888;
            }
            .stat-value {
              font-weight: bold;
              color: #0ff;
            }
            .token-bucket-visual {
              display: flex;
              gap: 20px;
              margin: 15px 0;
              align-items: flex-end;
            }
            .bucket-container {
              width: 80px;
              height: 200px;
              border: 2px solid #4fc3f7;
              border-radius: 8px 8px 4px 4px;
              position: relative;
              background: rgba(79, 195, 247, 0.1);
            }
            .bucket-fill {
              position: absolute;
              bottom: 0;
              left: 0;
              right: 0;
              background: linear-gradient(to top, #4fc3f7, #64b5f6);
              border-radius: 4px 4px 4px 4px;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: height 0.3s ease;
            }
            .bucket-label {
              color: white;
              font-weight: bold;
              font-size: 14px;
            }
            .bucket-markers {
              position: relative;
              height: 200px;
            }
            .bucket-marker {
              position: absolute;
              left: 0;
              font-size: 11px;
              color: #888;
            }
            .sliding-window-visual {
              margin: 15px 0;
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
            .window-label {
              text-align: center;
              margin-top: 5px;
              font-size: 12px;
              color: #aaa;
            }
            .limiter-info {
              margin-top: 20px;
              padding: 15px;
              background: rgba(0,0,0,0.3);
              border-radius: 8px;
            }
            .limiter-info p {
              margin: 8px 0;
              color: #ccc;
              font-size: 11px;
            }
          </style>
          <div class="rate-limiter-panel">
            <h4>⏲ Rate Limiter</h4>

            <div class="limiter-section">
              <h5>API Limiter (Token Bucket)</h5>
              <div class="limiter-stats">
                <div class="stat-row">
                  <span class="stat-label">Available Tokens:</span>
                  <span class="stat-value">${Math.floor(apiLimiter.tokens)} / ${apiLimiter.maxTokens}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Refill Rate:</span>
                  <span class="stat-value">${(apiLimiter.refillRate * 60).toFixed(1)}/min</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Time to Next Token:</span>
                  <span class="stat-value">${formatTime(apiLimiter.getTimeUntilNextToken())}</span>
                </div>
              </div>

              <div class="token-bucket-visual">
                <div class="bucket-container">
                  <div class="bucket-fill" style="height: ${tokenPercent}%">
                    <span class="bucket-label">${tokenPercent}%</span>
                  </div>
                </div>
                <div class="bucket-markers">
                  ${Array.from({length: apiLimiter.maxTokens + 1}, (_, i) => `
                    <div class="bucket-marker" style="bottom: ${(i / apiLimiter.maxTokens) * 100}%">${i}</div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="limiter-section">
              <h5>Strict Limiter (Sliding Window)</h5>
              <div class="limiter-stats">
                <div class="stat-row">
                  <span class="stat-label">Requests in Window:</span>
                  <span class="stat-value">${strictLimiter.requests?.length || 0} / ${strictLimiter.maxRequests}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Window Size:</span>
                  <span class="stat-value">${strictLimiter.windowMs / 1000}s</span>
                </div>
                <div class="stat-row">
                  <span class="stat-label">Capacity:</span>
                  <span class="stat-value">${strictPercent}% used</span>
                </div>
              </div>

              <div class="sliding-window-visual">
                <div class="window-bar">
                  <div class="window-fill" style="width: ${strictPercent}%"></div>
                </div>
                <div class="window-label">${strictLimiter.requests?.length || 0} / ${strictLimiter.maxRequests} requests</div>
              </div>
            </div>

            <div class="limiter-info">
              <h5>Rate Limiting Strategy</h5>
              <p><strong>Token Bucket:</strong> Allows bursts up to ${apiLimiter.maxTokens} requests, refills at ${(apiLimiter.refillRate * 60).toFixed(1)} tokens/min</p>
              <p><strong>Sliding Window:</strong> Max ${strictLimiter.maxRequests} requests per ${strictLimiter.windowMs / 1000}s window</p>
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

    return {
      TokenBucketLimiter,
      SlidingWindowLimiter,
      createLimiter,
      getLimiter,
      waitForToken,
      limiters, // Expose default limiters

      widget: {
        element: elementName,
        displayName: 'Rate Limiter',
        icon: '⏲',
        category: 'performance'
      }
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(RateLimiter);
}

export default RateLimiter;
