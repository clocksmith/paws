/**
 * Type definitions for API client
 */

/**
 * API request options
 */
export interface APIRequest<T = any> {
  /** Unique request ID */
  id: string;

  /** Provider name */
  provider: string;

  /** Operation name */
  operation: string;

  /** Request function to execute */
  execute: () => Promise<T>;

  /** Priority (higher = more important) */
  priority?: number;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Maximum retries */
  maxRetries?: number;

  /** Whether this request should bypass rate limiting */
  bypassRateLimit?: boolean;

  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * API response wrapper
 */
export interface APIResponse<T = any> {
  /** Request ID */
  requestId: string;

  /** Response data */
  data: T;

  /** Response time in milliseconds */
  responseTimeMs: number;

  /** Number of retry attempts */
  retryCount: number;

  /** Whether this came from cache */
  fromCache?: boolean;
}

/**
 * Rate limiter state
 */
export interface RateLimiterState {
  /** Provider name */
  provider: string;

  /** Requests allowed per minute */
  requestsPerMinute: number;

  /** Current request count in window */
  currentCount: number;

  /** Window start time */
  windowStart: Date;

  /** Next available time */
  nextAvailable: Date;
}

/**
 * Circuit breaker state
 */
export enum CircuitState {
  CLOSED = 'CLOSED', // Normal operation
  OPEN = 'OPEN', // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN', // Testing if service recovered
}

/**
 * Circuit breaker status
 */
export interface CircuitBreakerStatus {
  /** Current state */
  state: CircuitState;

  /** Provider name */
  provider: string;

  /** Failure count */
  failureCount: number;

  /** Success count in half-open state */
  successCount: number;

  /** Last failure time */
  lastFailureTime?: Date;

  /** When circuit will transition to half-open */
  nextRetryTime?: Date;
}

/**
 * API client options
 */
export interface APIClientOptions {
  /** Provider name */
  provider: string;

  /** Default timeout in milliseconds */
  defaultTimeout?: number;

  /** Default maximum retries */
  defaultMaxRetries?: number;

  /** Retry backoff multiplier */
  retryBackoffMultiplier?: number;

  /** Rate limit (requests per minute) */
  rateLimitPerMinute?: number;

  /** Enable circuit breaker */
  enableCircuitBreaker?: boolean;

  /** Circuit breaker failure threshold */
  circuitBreakerThreshold?: number;

  /** Circuit breaker timeout (ms before half-open) */
  circuitBreakerTimeout?: number;

  /** Enable request queue */
  enableQueue?: boolean;

  /** Maximum queue size */
  maxQueueSize?: number;

  /** Enable request logging */
  enableLogging?: boolean;

  /** Logger instance */
  logger?: any;
}

/**
 * Request queue item
 */
export interface QueueItem<T = any> {
  /** Request */
  request: APIRequest<T>;

  /** Promise resolve function */
  resolve: (value: APIResponse<T>) => void;

  /** Promise reject function */
  reject: (error: any) => void;

  /** Enqueue time */
  enqueuedAt: Date;
}
