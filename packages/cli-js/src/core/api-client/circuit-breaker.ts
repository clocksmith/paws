/**
 * Circuit breaker for API requests
 */

import { CircuitState, CircuitBreakerStatus } from './types';
import { APIError } from '../errors';

export class CircuitBreaker {
  private provider: string;
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: Date;
  private nextRetryTime?: Date;

  private failureThreshold: number;
  private timeout: number;
  private halfOpenSuccessThreshold: number = 2;

  constructor(provider: string, failureThreshold: number = 5, timeout: number = 60000) {
    this.provider = provider;
    this.failureThreshold = failureThreshold;
    this.timeout = timeout;
  }

  /**
   * Check if request can proceed
   */
  async canProceed(): Promise<boolean> {
    switch (this.state) {
      case CircuitState.CLOSED:
        return true;

      case CircuitState.OPEN:
        // Check if timeout has elapsed
        if (this.nextRetryTime && Date.now() >= this.nextRetryTime.getTime()) {
          this.transitionToHalfOpen();
          return true;
        }
        return false;

      case CircuitState.HALF_OPEN:
        return true;

      default:
        return false;
    }
  }

  /**
   * Record a successful request
   */
  recordSuccess(): void {
    switch (this.state) {
      case CircuitState.CLOSED:
        // Reset failure count on success
        this.failureCount = 0;
        break;

      case CircuitState.HALF_OPEN:
        this.successCount++;
        if (this.successCount >= this.halfOpenSuccessThreshold) {
          this.transitionToClosed();
        }
        break;
    }
  }

  /**
   * Record a failed request
   */
  recordFailure(): void {
    this.lastFailureTime = new Date();

    switch (this.state) {
      case CircuitState.CLOSED:
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
          this.transitionToOpen();
        }
        break;

      case CircuitState.HALF_OPEN:
        this.transitionToOpen();
        break;
    }
  }

  /**
   * Get current status
   */
  getStatus(): CircuitBreakerStatus {
    return {
      state: this.state,
      provider: this.provider,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextRetryTime: this.nextRetryTime,
    };
  }

  /**
   * Reset circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.nextRetryTime = undefined;
  }

  /**
   * Manually open the circuit
   */
  open(): void {
    this.transitionToOpen();
  }

  /**
   * Manually close the circuit
   */
  close(): void {
    this.transitionToClosed();
  }

  /**
   * Transition to CLOSED state
   */
  private transitionToClosed(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextRetryTime = undefined;
  }

  /**
   * Transition to OPEN state
   */
  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    this.successCount = 0;
    this.nextRetryTime = new Date(Date.now() + this.timeout);
  }

  /**
   * Transition to HALF_OPEN state
   */
  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.successCount = 0;
    this.failureCount = 0;
  }

  /**
   * Create error for open circuit
   */
  createCircuitOpenError(): Error {
    return new APIError(
      `Circuit breaker is open for ${this.provider}. Service may be experiencing issues.`,
      {
        provider: this.provider,
        retryable: true,
        context: {
          state: this.state,
          failureCount: this.failureCount,
          nextRetryTime: this.nextRetryTime?.toISOString(),
        },
      }
    );
  }
}
