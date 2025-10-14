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

    return {
      TokenBucketLimiter,
      SlidingWindowLimiter,
      createLimiter,
      getLimiter,
      waitForToken,
      limiters // Expose default limiters
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(RateLimiter);
}

export default RateLimiter;
