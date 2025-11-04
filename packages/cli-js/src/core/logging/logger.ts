/**
 * Logger implementation
 */

import {
  Logger,
  LoggerConfig,
  LogEntry,
  LogLevel,
  Transport,
  PerformanceEntry,
} from './types';

export class PawsLogger implements Logger {
  private minLevel: LogLevel;
  private source?: string;
  private transports: Transport[];

  constructor(config: LoggerConfig = {}) {
    this.minLevel = config.minLevel ?? LogLevel.INFO;
    this.source = config.source;
    this.transports = config.transports ?? [];
  }

  async debug(message: string, data?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.DEBUG, message, data);
  }

  async info(message: string, data?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.INFO, message, data);
  }

  async warn(message: string, data?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.WARN, message, data);
  }

  async error(message: string, data?: Record<string, any>): Promise<void> {
    await this.log(LogLevel.ERROR, message, data);
  }

  async perf(entry: PerformanceEntry): Promise<void> {
    await this.info(`Performance: ${entry.operation}`, {
      durationMs: entry.durationMs,
      ...entry.metadata,
    });
  }

  child(source: string): Logger {
    return new PawsLogger({
      minLevel: this.minLevel,
      source: this.source ? `${this.source}:${source}` : source,
      transports: this.transports,
    });
  }

  async flush(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.flush()));
  }

  async close(): Promise<void> {
    await Promise.all(this.transports.map((t) => t.close()));
  }

  startTimer(operation: string): () => Promise<void> {
    const startTime = Date.now();

    return async () => {
      const durationMs = Date.now() - startTime;
      await this.perf({ operation, durationMs });
    };
  }

  private async log(
    level: LogLevel,
    message: string,
    data?: Record<string, any>
  ): Promise<void> {
    // Skip if below minimum level
    if (level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      data,
      source: this.source,
    };

    // Extract error if present in data
    if (data?.error) {
      entry.error = this.extractError(data.error);
    }

    // Write to all transports
    await Promise.all(
      this.transports.map((transport) =>
        transport.write(entry).catch((error) => {
          // Fallback to console if transport fails
          console.error(`Failed to write to transport ${transport.name}:`, error);
        })
      )
    );
  }

  private extractError(error: any): LogEntry['error'] {
    if (!error) return undefined;

    return {
      name: error.name || 'Error',
      message: error.message || String(error),
      stack: error.stack,
      code: error.code,
    };
  }

  /**
   * Add a transport to the logger
   */
  addTransport(transport: Transport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport from the logger
   */
  removeTransport(name: string): void {
    const index = this.transports.findIndex((t) => t.name === name);
    if (index >= 0) {
      this.transports.splice(index, 1);
    }
  }

  /**
   * Set minimum log level
   */
  setMinLevel(level: LogLevel): void {
    this.minLevel = level;
  }
}

/**
 * Create a logger with default configuration
 */
export function createLogger(config?: LoggerConfig): Logger {
  return new PawsLogger(config);
}

/**
 * Parse log level from string
 */
export function parseLogLevel(level: string): LogLevel {
  const upper = level.toUpperCase();
  switch (upper) {
    case 'DEBUG':
      return LogLevel.DEBUG;
    case 'INFO':
      return LogLevel.INFO;
    case 'WARN':
    case 'WARNING':
      return LogLevel.WARN;
    case 'ERROR':
      return LogLevel.ERROR;
    default:
      return LogLevel.INFO;
  }
}
