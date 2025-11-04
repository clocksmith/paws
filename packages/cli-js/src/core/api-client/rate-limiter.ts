/**
 * Rate limiter for API requests
 */

import { RateLimiterState } from './types';
import { RateLimitError } from '../errors';

export class RateLimiter {
  private provider: string;
  private requestsPerMinute: number;
  private requests: number[] = []; // timestamps of recent requests

  constructor(provider: string, requestsPerMinute: number) {
    this.provider = provider;
    this.requestsPerMinute = requestsPerMinute;
  }

  /**
   * Check if a request can proceed
   */
  async acquire(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60000; // 1 minute ago

    // Remove requests outside the window
    this.requests = this.requests.filter((timestamp) => timestamp > windowStart);

    // Check if we're at the limit
    if (this.requests.length >= this.requestsPerMinute) {
      // Calculate when the oldest request will expire
      const oldestRequest = this.requests[0];
      const waitTime = oldestRequest + 60000 - now;
      const retryAfter = Math.ceil(waitTime / 1000);

      throw new RateLimitError(
        `Rate limit exceeded for ${this.provider}: ${this.requestsPerMinute} requests per minute`,
        { retryAfter }
      );
    }

    // Add current request
    this.requests.push(now);
  }

  /**
   * Get current rate limiter state
   */
  getState(): RateLimiterState {
    const now = Date.now();
    const windowStart = now - 60000;

    // Clean up old requests
    this.requests = this.requests.filter((timestamp) => timestamp > windowStart);

    const nextAvailable =
      this.requests.length >= this.requestsPerMinute
        ? new Date(this.requests[0] + 60000)
        : new Date(now);

    return {
      provider: this.provider,
      requestsPerMinute: this.requestsPerMinute,
      currentCount: this.requests.length,
      windowStart: new Date(windowStart),
      nextAvailable,
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requests = [];
  }

  /**
   * Update rate limit
   */
  setRateLimit(requestsPerMinute: number): void {
    this.requestsPerMinute = requestsPerMinute;
  }
}
