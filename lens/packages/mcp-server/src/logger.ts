/**
 * Winston-based logging configuration
 */

import winston from 'winston';
import { LoggingConfig } from './types.js';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Create logger instance with configuration
 */
export function createLogger(config: LoggingConfig = { level: 'info' }): winston.Logger {
  const formats: winston.Logform.Format[] = [
    errors({ stack: true }),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  ];

  // Add format based on configuration
  if (config.format === 'json') {
    formats.push(json());
  } else {
    formats.push(
      printf(({ level, message, timestamp, stack, ...metadata }) => {
        let msg = `${timestamp} [${level}]: ${message}`;

        // Add metadata if present
        const metaKeys = Object.keys(metadata);
        if (metaKeys.length > 0) {
          msg += ` ${JSON.stringify(metadata)}`;
        }

        // Add stack trace if present
        if (stack) {
          msg += `\n${stack}`;
        }

        return msg;
      })
    );
  }

  const transports: winston.transport[] = [];

  // Console transport
  if (config.console !== false) {
    transports.push(
      new winston.transports.Console({
        format: combine(colorize(), ...formats),
      })
    );
  }

  // File transport
  if (config.file) {
    transports.push(
      new winston.transports.File({
        filename: config.file,
        format: combine(...formats),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );

    // Separate error log file
    transports.push(
      new winston.transports.File({
        filename: config.file.replace(/\.log$/, '.error.log'),
        level: 'error',
        format: combine(...formats),
        maxsize: 10485760, // 10MB
        maxFiles: 5,
      })
    );
  }

  return winston.createLogger({
    level: config.level,
    format: combine(...formats),
    transports,
    exitOnError: false,
  });
}

/**
 * Default logger instance
 */
export const logger = createLogger();

/**
 * Log an error with context
 */
export function logError(error: Error, context?: Record<string, any>): void {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
  });
}

/**
 * Log a request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number,
  context?: Record<string, any>
): void {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

  logger[level](`${method} ${path} ${statusCode}`, {
    method,
    path,
    statusCode,
    duration,
    ...context,
  });
}

/**
 * Log MCP server event
 */
export function logMCPEvent(
  serverName: string,
  event: string,
  details?: Record<string, any>
): void {
  logger.info(`MCP Server [${serverName}]: ${event}`, {
    server: serverName,
    event,
    ...details,
  });
}

/**
 * Log WebSocket event
 */
export function logWSEvent(
  clientId: string,
  event: string,
  details?: Record<string, any>
): void {
  logger.debug(`WebSocket [${clientId}]: ${event}`, {
    clientId,
    event,
    ...details,
  });
}

/**
 * Create a child logger with default context
 */
export function createChildLogger(
  parent: winston.Logger,
  context: Record<string, any>
): winston.Logger {
  return parent.child(context);
}
