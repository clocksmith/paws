/**
 * PAWS Core Infrastructure
 *
 * Comprehensive infrastructure layer providing:
 * - Error handling with typed error classes and recovery suggestions
 * - Structured logging with multiple transports and log rotation
 * - Configuration management with .pawsrc.json support and profiles
 * - Cost tracking with per-model pricing and budget alerts
 * - Enhanced session management with metadata and analytics
 * - Robust API client with retry, rate limiting, and circuit breaker
 *
 * This core infrastructure maintains PAWS's unique multi-agent capabilities
 * while providing enterprise-grade reliability and observability.
 */

export * as errors from './errors';
export * as logging from './logging';
export * as config from './config';
export * as costTracker from './cost-tracker';
export * as session from './session';
export * as apiClient from './api-client';
