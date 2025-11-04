/**
 * Type definitions for the logging system
 */

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * Log level names
 */
export type LogLevelName = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * Log entry structure
 */
export interface LogEntry {
  /** Timestamp of the log entry */
  timestamp: Date;

  /** Log level */
  level: LogLevel;

  /** Log message */
  message: string;

  /** Additional structured data */
  data?: Record<string, any>;

  /** Source/module that generated the log */
  source?: string;

  /** Error object if logging an error */
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
  };
}

/**
 * Transport interface for log output destinations
 */
export interface Transport {
  /** Name of the transport */
  readonly name: string;

  /** Minimum log level for this transport */
  readonly minLevel: LogLevel;

  /** Write a log entry */
  write(entry: LogEntry): Promise<void>;

  /** Flush any buffered logs */
  flush(): Promise<void>;

  /** Close the transport */
  close(): Promise<void>;
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  /** Minimum log level (logs below this level are ignored) */
  minLevel?: LogLevel;

  /** Source/module name for logs */
  source?: string;

  /** Transports to use */
  transports?: Transport[];

  /** Whether to include timestamps */
  includeTimestamp?: boolean;

  /** Whether to colorize console output */
  colorize?: boolean;
}

/**
 * Console transport options
 */
export interface ConsoleTransportOptions {
  /** Minimum log level */
  minLevel?: LogLevel;

  /** Whether to colorize output */
  colorize?: boolean;

  /** Whether to include timestamps */
  includeTimestamp?: boolean;

  /** Whether to pretty-print JSON data */
  prettyPrint?: boolean;
}

/**
 * File transport options
 */
export interface FileTransportOptions {
  /** Path to log file */
  filePath: string;

  /** Minimum log level */
  minLevel?: LogLevel;

  /** Maximum file size before rotation (in bytes) */
  maxSize?: number;

  /** Maximum number of rotated files to keep */
  maxFiles?: number;

  /** Whether to write as JSON (vs formatted text) */
  json?: boolean;
}

/**
 * Performance measurement data
 */
export interface PerformanceEntry {
  /** Operation name */
  operation: string;

  /** Duration in milliseconds */
  durationMs: number;

  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Logger interface
 */
export interface Logger {
  /** Log a debug message */
  debug(message: string, data?: Record<string, any>): Promise<void>;

  /** Log an info message */
  info(message: string, data?: Record<string, any>): Promise<void>;

  /** Log a warning message */
  warn(message: string, data?: Record<string, any>): Promise<void>;

  /** Log an error message */
  error(message: string, data?: Record<string, any>): Promise<void>;

  /** Log performance metrics */
  perf(entry: PerformanceEntry): Promise<void>;

  /** Create a child logger with a specific source */
  child(source: string): Logger;

  /** Flush all transports */
  flush(): Promise<void>;

  /** Close all transports */
  close(): Promise<void>;

  /** Start a performance timer */
  startTimer(operation: string): () => Promise<void>;
}
