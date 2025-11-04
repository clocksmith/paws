/**
 * Error handler utilities for consistent error logging and display
 */

import * as chalk from 'chalk';
import { PawsError, isPawsError, wrapError } from './base';
import type { Logger } from '../logging';

/**
 * Options for error handling
 */
export interface ErrorHandlerOptions {
  /** Logger instance to use for error logging */
  logger?: Logger;

  /** Whether to exit the process after handling */
  exitProcess?: boolean;

  /** Exit code to use when exiting */
  exitCode?: number;

  /** Whether to show stack trace */
  showStack?: boolean;

  /** Whether to log the error (in addition to displaying) */
  logError?: boolean;
}

/**
 * Handle an error with consistent formatting and optional logging
 */
export async function handleError(
  error: unknown,
  options: ErrorHandlerOptions = {}
): Promise<void> {
  const {
    logger,
    exitProcess = false,
    exitCode = 1,
    showStack = process.env.PAWS_DEBUG === 'true',
    logError = true,
  } = options;

  // Wrap non-PAWS errors
  const pawsError = isPawsError(error) ? error : wrapError(error);

  // Log error if logger is provided
  if (logError && logger) {
    await logger.error('Error occurred', pawsError.toLogObject());
  }

  // Display error to user
  displayError(pawsError, showStack);

  // Exit if requested
  if (exitProcess) {
    process.exit(exitCode);
  }
}

/**
 * Display error to user with consistent formatting
 */
export function displayError(error: PawsError, showStack: boolean = false): void {
  console.error('');
  console.error(chalk.red.bold('✖ Error'));
  console.error('');
  console.error(chalk.red(error.toUserString()));
  console.error('');

  // Show stack trace in debug mode
  if (showStack && error.stack) {
    console.error(chalk.gray('Stack trace:'));
    console.error(chalk.gray(error.stack));
    console.error('');

    // Show cause stack if available
    if (error.cause?.stack) {
      console.error(chalk.gray('Caused by:'));
      console.error(chalk.gray(error.cause.stack));
      console.error('');
    }
  }
}

/**
 * Create a process-level error handler
 */
export function setupGlobalErrorHandler(logger?: Logger): void {
  // Handle unhandled promise rejections
  process.on('unhandledRejection', async (reason) => {
    console.error(chalk.red.bold('\n✖ Unhandled Promise Rejection\n'));
    await handleError(reason, {
      logger,
      exitProcess: true,
      exitCode: 1,
      showStack: true,
    });
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error(chalk.red.bold('\n✖ Uncaught Exception\n'));
    await handleError(error, {
      logger,
      exitProcess: true,
      exitCode: 1,
      showStack: true,
    });
  });

  // Handle SIGINT (Ctrl+C) gracefully
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\n\nReceived SIGINT. Cleaning up...\n'));

    if (logger) {
      await logger.info('Process interrupted by user (SIGINT)');
      await logger.flush();
    }

    process.exit(130); // Standard exit code for SIGINT
  });

  // Handle SIGTERM gracefully
  process.on('SIGTERM', async () => {
    console.log(chalk.yellow('\n\nReceived SIGTERM. Shutting down gracefully...\n'));

    if (logger) {
      await logger.info('Process terminated (SIGTERM)');
      await logger.flush();
    }

    process.exit(143); // Standard exit code for SIGTERM
  });
}

/**
 * Try-catch wrapper that converts errors to PawsError
 */
export async function tryWithContext<T>(
  fn: () => Promise<T>,
  context: string
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw wrapError(error, context);
  }
}

/**
 * Retry an operation with exponential backoff
 */
export async function retryOperation<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void | Promise<void>;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    backoffMultiplier = 2,
    shouldRetry = (error) => isPawsError(error) && error.retryable,
    onRetry,
  } = options;

  let lastError: unknown;
  let delayMs = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      // Check if we should retry
      if (attempt >= maxRetries || !shouldRetry(error)) {
        throw error;
      }

      // Call retry callback if provided
      if (onRetry) {
        await onRetry(error, attempt + 1);
      }

      // Wait before retrying
      await sleep(delayMs);

      // Increase delay for next retry (exponential backoff)
      delayMs = Math.min(delayMs * backoffMultiplier, maxDelayMs);
    }
  }

  throw lastError;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Format bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format duration to human-readable string
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}
