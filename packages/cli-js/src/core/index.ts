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

// Namespace exports for backwards compatibility
export * as errors from './errors';
export * as logging from './logging';
export * as config from './config';
export * as costTracker from './cost-tracker';
export * as session from './session';
export * as apiClient from './api-client';

// Direct exports for shared-context.ts
export { ConfigManager } from './config/manager';
export type { PawsConfig, ConfigFile, ConfigLoadOptions } from './config/types';
export { createLogger, parseLogLevel, PawsLogger } from './logging/logger';
export type { Logger, LoggerConfig } from './logging/types';
export { LogLevel } from './logging/types';
export { ConsoleTransport } from './logging/transports/console';
export { FileTransport } from './logging/transports/file';
export { CostTracker } from './cost-tracker/tracker';
export { createCostTracker } from './cost-tracker/factory';
export { EnhancedSessionManager } from './session/manager';
export { setupGlobalErrorHandler } from './errors/handler';
