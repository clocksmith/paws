import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('RateLimiter Module', () => {
  let RateLimiter;
  let mockDeps;
  let limiterInstance;

  beforeEach(() => {
    vi.useFakeTimers();

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    RateLimiter = {
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

        class TokenBucketLimiter {
          constructor(options = {}) {
            this.maxTokens = options.maxTokens || 10;
            this.refillRate = options.refillRate || 1;
            this.tokens = this.maxTokens;
            this.lastRefill = Date.now();
            this.name = options.name || 'default';

            logger.info(`[RateLimiter] Created ${this.name} limiter`, {
              maxTokens: this.maxTokens,
              refillRate: this.refillRate
            });
          }

          _refill() {
            const now = Date.now();
            const elapsed = (now - this.lastRefill) / 1000;
            const tokensToAdd = elapsed * this.refillRate;

            this.tokens = Math.min(this.maxTokens, this.tokens + tokensToAdd);
            this.lastRefill = now;
          }

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

          getTimeUntilNextToken() {
            this._refill();

            if (this.tokens >= 1) {
              return 0;
            }

            const tokensNeeded = 1 - this.tokens;
            const timeNeeded = (tokensNeeded / this.refillRate) * 1000;
            return Math.ceil(timeNeeded);
          }

          getState() {
            this._refill();
            return {
              tokens: this.tokens,
              maxTokens: this.maxTokens,
              refillRate: this.refillRate,
              percentage: (this.tokens / this.maxTokens) * 100
            };
          }

          reset() {
            this.tokens = this.maxTokens;
            this.lastRefill = Date.now();
            logger.info(`[RateLimiter] ${this.name}: Reset to ${this.maxTokens} tokens`);
          }
        }

        class SlidingWindowLimiter {
          constructor(options = {}) {
            this.maxRequests = options.maxRequests || 10;
            this.windowMs = options.windowMs || 60000;
            this.requests = [];
            this.name = options.name || 'sliding-window';

            logger.info(`[RateLimiter] Created ${this.name} limiter`, {
              maxRequests: this.maxRequests,
              windowMs: this.windowMs
            });
          }

          _cleanOldRequests() {
            const now = Date.now();
            const cutoff = now - this.windowMs;
            this.requests = this.requests.filter(timestamp => timestamp > cutoff);
          }

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

          getTimeUntilNextToken() {
            this._cleanOldRequests();

            if (this.requests.length < this.maxRequests) {
              return 0;
            }

            const oldestRequest = Math.min(...this.requests);
            const timeUntilExpire = (oldestRequest + this.windowMs) - Date.now();
            return Math.max(0, timeUntilExpire);
          }

          getState() {
            this._cleanOldRequests();
            return {
              requests: this.requests.length,
              maxRequests: this.maxRequests,
              windowMs: this.windowMs,
              percentage: (this.requests.length / this.maxRequests) * 100
            };
          }

          reset() {
            this.requests = [];
            logger.info(`[RateLimiter] ${this.name}: Reset`);
          }
        }

        const limiters = {
          api: new TokenBucketLimiter({
            name: 'api',
            maxTokens: 5,
            refillRate: 10 / 60
          }),
          strict: new SlidingWindowLimiter({
            name: 'strict',
            maxRequests: 20,
            windowMs: 60000
          })
        };

        const createLimiter = (type = 'token-bucket', options = {}) => {
          if (type === 'token-bucket') {
            return new TokenBucketLimiter(options);
          } else if (type === 'sliding-window') {
            return new SlidingWindowLimiter(options);
          } else {
            throw new Error(`Unknown limiter type: ${type}`);
          }
        };

        const getLimiter = (name = 'api') => {
          return limiters[name] || limiters.api;
        };

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
          limiters
        };
      }
    };

    limiterInstance = RateLimiter.factory(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(RateLimiter.metadata.id).toBe('RateLimiter');
      expect(RateLimiter.metadata.version).toBe('1.0.0');
      expect(RateLimiter.metadata.type).toBe('service');
    });

    it('should declare Utils dependency', () => {
      expect(RateLimiter.metadata.dependencies).toContain('Utils');
    });
  });

  describe('TokenBucketLimiter', () => {
    describe('initialization', () => {
      it('should create with default options', () => {
        const limiter = new limiterInstance.TokenBucketLimiter();
        const state = limiter.getState();

        expect(state.maxTokens).toBe(10);
        expect(state.refillRate).toBe(1);
        expect(state.tokens).toBe(10);
      });

      it('should create with custom options', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 20,
          refillRate: 2,
          name: 'custom'
        });
        const state = limiter.getState();

        expect(state.maxTokens).toBe(20);
        expect(state.refillRate).toBe(2);
        expect(state.tokens).toBe(20);
      });

      it('should log creation', () => {
        new limiterInstance.TokenBucketLimiter({ name: 'test' });
        expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
          expect.stringContaining('Created test limiter'),
          expect.any(Object)
        );
      });
    });

    describe('tryConsume()', () => {
      it('should consume token successfully', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });
        const result = limiter.tryConsume();

        expect(result).toBe(true);
        expect(limiter.getState().tokens).toBe(4);
      });

      it('should consume multiple tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });
        const result = limiter.tryConsume(3);

        expect(result).toBe(true);
        expect(limiter.getState().tokens).toBe(2);
      });

      it('should reject when insufficient tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 2 });
        limiter.tryConsume(2);

        const result = limiter.tryConsume();
        expect(result).toBe(false);
      });

      it('should allow burst up to max tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });

        for (let i = 0; i < 5; i++) {
          expect(limiter.tryConsume()).toBe(true);
        }
        expect(limiter.tryConsume()).toBe(false);
      });
    });

    describe('token refill', () => {
      it('should refill tokens over time', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 10,
          refillRate: 2
        });

        limiter.tryConsume(10);
        expect(limiter.getState().tokens).toBe(0);

        vi.advanceTimersByTime(1000);
        expect(limiter.getState().tokens).toBe(2);

        vi.advanceTimersByTime(1000);
        expect(limiter.getState().tokens).toBe(4);
      });

      it('should not exceed max tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 5,
          refillRate: 1
        });

        vi.advanceTimersByTime(10000);
        expect(limiter.getState().tokens).toBe(5);
      });

      it('should refill fractional tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 10,
          refillRate: 0.5
        });

        limiter.tryConsume(10);
        vi.advanceTimersByTime(3000);

        const state = limiter.getState();
        expect(state.tokens).toBeCloseTo(1.5, 1);
      });
    });

    describe('getTimeUntilNextToken()', () => {
      it('should return 0 when tokens available', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });
        expect(limiter.getTimeUntilNextToken()).toBe(0);
      });

      it('should calculate wait time when no tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 5,
          refillRate: 1
        });

        limiter.tryConsume(5);
        const waitTime = limiter.getTimeUntilNextToken();

        expect(waitTime).toBeGreaterThan(0);
        expect(waitTime).toBeLessThanOrEqual(1000);
      });
    });

    describe('getState()', () => {
      it('should return current state', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 10,
          refillRate: 2
        });

        const state = limiter.getState();

        expect(state).toHaveProperty('tokens');
        expect(state).toHaveProperty('maxTokens');
        expect(state).toHaveProperty('refillRate');
        expect(state).toHaveProperty('percentage');
        expect(state.percentage).toBe(100);
      });

      it('should calculate percentage correctly', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 10 });
        limiter.tryConsume(5);

        const state = limiter.getState();
        expect(state.percentage).toBe(50);
      });
    });

    describe('reset()', () => {
      it('should reset to max tokens', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });
        limiter.tryConsume(5);

        limiter.reset();
        expect(limiter.getState().tokens).toBe(5);
      });

      it('should log reset', () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5, name: 'test' });
        limiter.reset();

        expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
          expect.stringContaining('test: Reset to 5 tokens')
        );
      });
    });
  });

  describe('SlidingWindowLimiter', () => {
    describe('initialization', () => {
      it('should create with default options', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter();
        const state = limiter.getState();

        expect(state.maxRequests).toBe(10);
        expect(state.windowMs).toBe(60000);
        expect(state.requests).toBe(0);
      });

      it('should create with custom options', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({
          maxRequests: 20,
          windowMs: 30000,
          name: 'custom'
        });
        const state = limiter.getState();

        expect(state.maxRequests).toBe(20);
        expect(state.windowMs).toBe(30000);
      });
    });

    describe('tryConsume()', () => {
      it('should allow requests up to max', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({ maxRequests: 5 });

        for (let i = 0; i < 5; i++) {
          expect(limiter.tryConsume()).toBe(true);
        }
        expect(limiter.tryConsume()).toBe(false);
      });

      it('should track request timestamps', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({ maxRequests: 3 });

        limiter.tryConsume();
        limiter.tryConsume();

        expect(limiter.getState().requests).toBe(2);
      });
    });

    describe('sliding window', () => {
      it('should expire old requests', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({
          maxRequests: 2,
          windowMs: 1000
        });

        limiter.tryConsume();
        limiter.tryConsume();
        expect(limiter.tryConsume()).toBe(false);

        vi.advanceTimersByTime(1100);
        expect(limiter.tryConsume()).toBe(true);
      });

      it('should maintain rolling window', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({
          maxRequests: 3,
          windowMs: 2000
        });

        limiter.tryConsume();
        vi.advanceTimersByTime(500);
        limiter.tryConsume();
        vi.advanceTimersByTime(500);
        limiter.tryConsume();

        expect(limiter.tryConsume()).toBe(false);

        vi.advanceTimersByTime(1100);
        expect(limiter.tryConsume()).toBe(true);
      });
    });

    describe('getTimeUntilNextToken()', () => {
      it('should return 0 when under limit', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({ maxRequests: 5 });
        expect(limiter.getTimeUntilNextToken()).toBe(0);
      });

      it('should calculate wait time when at limit', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({
          maxRequests: 2,
          windowMs: 1000
        });

        limiter.tryConsume();
        limiter.tryConsume();

        const waitTime = limiter.getTimeUntilNextToken();
        expect(waitTime).toBeGreaterThan(0);
        expect(waitTime).toBeLessThanOrEqual(1000);
      });
    });

    describe('getState()', () => {
      it('should return current state', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter();
        const state = limiter.getState();

        expect(state).toHaveProperty('requests');
        expect(state).toHaveProperty('maxRequests');
        expect(state).toHaveProperty('windowMs');
        expect(state).toHaveProperty('percentage');
      });

      it('should calculate percentage', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({ maxRequests: 10 });
        limiter.tryConsume();
        limiter.tryConsume();
        limiter.tryConsume();
        limiter.tryConsume();
        limiter.tryConsume();

        const state = limiter.getState();
        expect(state.percentage).toBe(50);
      });
    });

    describe('reset()', () => {
      it('should clear all requests', () => {
        const limiter = new limiterInstance.SlidingWindowLimiter({ maxRequests: 5 });
        limiter.tryConsume();
        limiter.tryConsume();

        limiter.reset();
        expect(limiter.getState().requests).toBe(0);
      });
    });
  });

  describe('Factory Functions', () => {
    describe('createLimiter()', () => {
      it('should create token bucket limiter', () => {
        const limiter = limiterInstance.createLimiter('token-bucket', { maxTokens: 5 });
        expect(limiter).toBeInstanceOf(limiterInstance.TokenBucketLimiter);
      });

      it('should create sliding window limiter', () => {
        const limiter = limiterInstance.createLimiter('sliding-window', { maxRequests: 5 });
        expect(limiter).toBeInstanceOf(limiterInstance.SlidingWindowLimiter);
      });

      it('should throw on unknown type', () => {
        expect(() => limiterInstance.createLimiter('unknown')).toThrow('Unknown limiter type');
      });

      it('should default to token bucket', () => {
        const limiter = limiterInstance.createLimiter();
        expect(limiter).toBeInstanceOf(limiterInstance.TokenBucketLimiter);
      });
    });

    describe('getLimiter()', () => {
      it('should get api limiter', () => {
        const limiter = limiterInstance.getLimiter('api');
        expect(limiter).toBeDefined();
        expect(limiter).toBeInstanceOf(limiterInstance.TokenBucketLimiter);
      });

      it('should get strict limiter', () => {
        const limiter = limiterInstance.getLimiter('strict');
        expect(limiter).toBeDefined();
        expect(limiter).toBeInstanceOf(limiterInstance.SlidingWindowLimiter);
      });

      it('should default to api limiter', () => {
        const limiter = limiterInstance.getLimiter('nonexistent');
        expect(limiter).toBe(limiterInstance.limiters.api);
      });
    });

    describe('waitForToken()', () => {
      it('should return true immediately if token available', async () => {
        const limiter = new limiterInstance.TokenBucketLimiter({ maxTokens: 5 });
        const result = await limiterInstance.waitForToken(limiter);

        expect(result).toBe(true);
      });

      it('should wait for token to become available', async () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 1,
          refillRate: 2
        });

        limiter.tryConsume();

        const promise = limiterInstance.waitForToken(limiter);
        vi.advanceTimersByTime(600);

        const result = await promise;
        expect(result).toBe(true);
      });

      it('should timeout if token not available', async () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 1,
          refillRate: 0.1
        });

        limiter.tryConsume();

        const promise = limiterInstance.waitForToken(limiter, 100);
        vi.advanceTimersByTime(150);

        const result = await promise;
        expect(result).toBe(false);
      });

      it('should respect custom timeout', async () => {
        const limiter = new limiterInstance.TokenBucketLimiter({
          maxTokens: 1,
          refillRate: 0.5
        });

        limiter.tryConsume();

        const promise = limiterInstance.waitForToken(limiter, 3000);
        vi.advanceTimersByTime(2500);

        const result = await promise;
        expect(result).toBe(true);
      });
    });
  });

  describe('Default Limiters', () => {
    it('should have api limiter configured', () => {
      const apiLimiter = limiterInstance.limiters.api;
      const state = apiLimiter.getState();

      expect(state.maxTokens).toBe(5);
      expect(state.refillRate).toBeCloseTo(10 / 60, 3);
    });

    it('should have strict limiter configured', () => {
      const strictLimiter = limiterInstance.limiters.strict;
      const state = strictLimiter.getState();

      expect(state.maxRequests).toBe(20);
      expect(state.windowMs).toBe(60000);
    });
  });
});
