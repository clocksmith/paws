/**
 * Robust API client with retry, rate limiting, circuit breaker, and queue
 */

import { v4 as uuidv4 } from 'uuid';
import { APIClientOptions, APIRequest, APIResponse, QueueItem } from './types';
import { RateLimiter } from './rate-limiter';
import { CircuitBreaker } from './circuit-breaker';
import { retryOperation } from '../errors/handler';
import { TimeoutError, isPawsError } from '../errors';

export class APIClient {
  private provider: string;
  private defaultTimeout: number;
  private defaultMaxRetries: number;
  private retryBackoffMultiplier: number;
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private queue: QueueItem[] = [];
  private enableQueue: boolean;
  private maxQueueSize: number;
  private processing = false;
  private enableLogging: boolean;
  private logger?: any;

  constructor(options: APIClientOptions) {
    this.provider = options.provider;
    this.defaultTimeout = options.defaultTimeout ?? 60000;
    this.defaultMaxRetries = options.defaultMaxRetries ?? 3;
    this.retryBackoffMultiplier = options.retryBackoffMultiplier ?? 2;
    this.enableQueue = options.enableQueue ?? true;
    this.maxQueueSize = options.maxQueueSize ?? 100;
    this.enableLogging = options.enableLogging ?? false;
    this.logger = options.logger;

    // Initialize rate limiter
    if (options.rateLimitPerMinute) {
      this.rateLimiter = new RateLimiter(options.provider, options.rateLimitPerMinute);
    }

    // Initialize circuit breaker
    if (options.enableCircuitBreaker) {
      this.circuitBreaker = new CircuitBreaker(
        options.provider,
        options.circuitBreakerThreshold,
        options.circuitBreakerTimeout
      );
    }
  }

  /**
   * Execute an API request
   */
  async request<T>(request: Omit<APIRequest<T>, 'id'>): Promise<APIResponse<T>> {
    const fullRequest: APIRequest<T> = {
      id: uuidv4(),
      provider: this.provider,
      ...request,
    };

    if (this.enableQueue) {
      return this.enqueue(fullRequest);
    } else {
      return this.executeRequest(fullRequest);
    }
  }

  /**
   * Enqueue a request
   */
  private async enqueue<T>(request: APIRequest<T>): Promise<APIResponse<T>> {
    // Check queue size
    if (this.queue.length >= this.maxQueueSize) {
      throw new Error(`Request queue full: ${this.maxQueueSize} items`);
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        request,
        resolve,
        reject,
        enqueuedAt: new Date(),
      });

      // Sort by priority (higher first)
      this.queue.sort((a, b) => (b.request.priority || 0) - (a.request.priority || 0));

      // Process queue
      this.processQueue();
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift()!;

      try {
        const response = await this.executeRequest(item.request);
        item.resolve(response);
      } catch (error) {
        item.reject(error);
      }

      // Small delay between requests
      await this.sleep(100);
    }

    this.processing = false;
  }

  /**
   * Execute a single request with all protections
   */
  private async executeRequest<T>(request: APIRequest<T>): Promise<APIResponse<T>> {
    const startTime = Date.now();

    // Log request start
    if (this.enableLogging && this.logger) {
      await this.logger.debug(`API request started: ${request.operation}`, {
        provider: request.provider,
        requestId: request.id,
      });
    }

    try {
      // Check circuit breaker
      if (this.circuitBreaker) {
        const canProceed = await this.circuitBreaker.canProceed();
        if (!canProceed) {
          throw this.circuitBreaker.createCircuitOpenError();
        }
      }

      // Apply rate limiting
      if (this.rateLimiter && !request.bypassRateLimit) {
        await this.rateLimiter.acquire();
      }

      // Execute with retry
      const data = await retryOperation(
        () => this.executeWithTimeout(request),
        {
          maxRetries: request.maxRetries ?? this.defaultMaxRetries,
          backoffMultiplier: this.retryBackoffMultiplier,
          shouldRetry: (error) => {
            // Don't retry if circuit breaker is open
            if (this.circuitBreaker && !this.circuitBreaker.canProceed()) {
              return false;
            }
            // Retry on retryable errors
            return isPawsError(error) && error.retryable;
          },
          onRetry: async (error, attempt) => {
            if (this.enableLogging && this.logger) {
              await this.logger.warn(`Retrying request (attempt ${attempt})`, {
                provider: request.provider,
                requestId: request.id,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          },
        }
      );

      // Record success
      if (this.circuitBreaker) {
        this.circuitBreaker.recordSuccess();
      }

      const responseTimeMs = Date.now() - startTime;

      // Log success
      if (this.enableLogging && this.logger) {
        await this.logger.debug(`API request completed: ${request.operation}`, {
          provider: request.provider,
          requestId: request.id,
          responseTimeMs,
        });
      }

      return {
        requestId: request.id,
        data,
        responseTimeMs,
        retryCount: 0, // TODO: track actual retry count
      };
    } catch (error) {
      // Record failure
      if (this.circuitBreaker) {
        this.circuitBreaker.recordFailure();
      }

      // Log error
      if (this.enableLogging && this.logger) {
        await this.logger.error(`API request failed: ${request.operation}`, {
          provider: request.provider,
          requestId: request.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      throw error;
    }
  }

  /**
   * Execute request with timeout
   */
  private async executeWithTimeout<T>(request: APIRequest<T>): Promise<T> {
    const timeout = request.timeout ?? this.defaultTimeout;

    return Promise.race([
      request.execute(),
      this.createTimeout(timeout, request.operation),
    ]);
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(timeoutMs: number, operation: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new TimeoutError(
            `Request timed out after ${timeoutMs}ms: ${operation}`,
            timeoutMs
          )
        );
      }, timeoutMs);
    });
  }

  /**
   * Sleep for a duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    // Reject all pending requests
    for (const item of this.queue) {
      item.reject(new Error('Queue cleared'));
    }
    this.queue = [];
  }

  /**
   * Get rate limiter state
   */
  getRateLimiterState() {
    return this.rateLimiter?.getState();
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus() {
    return this.circuitBreaker?.getStatus();
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(): void {
    this.circuitBreaker?.reset();
  }

  /**
   * Reset rate limiter
   */
  resetRateLimiter(): void {
    this.rateLimiter?.reset();
  }
}
