/**
 * Console transport for logging
 */

import * as chalk from 'chalk';
import { Transport, LogEntry, LogLevel, ConsoleTransportOptions } from '../types';

export class ConsoleTransport implements Transport {
  public readonly name = 'console';
  public readonly minLevel: LogLevel;

  private colorize: boolean;
  private includeTimestamp: boolean;
  private prettyPrint: boolean;

  constructor(options: ConsoleTransportOptions = {}) {
    this.minLevel = options.minLevel ?? LogLevel.INFO;
    this.colorize = options.colorize ?? true;
    this.includeTimestamp = options.includeTimestamp ?? true;
    this.prettyPrint = options.prettyPrint ?? true;
  }

  async write(entry: LogEntry): Promise<void> {
    // Skip if below minimum level
    if (entry.level < this.minLevel) {
      return;
    }

    const parts: string[] = [];

    // Add timestamp
    if (this.includeTimestamp) {
      const timestamp = entry.timestamp.toISOString();
      parts.push(this.colorize ? chalk.gray(timestamp) : timestamp);
    }

    // Add level
    const levelStr = this.formatLevel(entry.level);
    parts.push(levelStr);

    // Add source if present
    if (entry.source) {
      const sourceStr = `[${entry.source}]`;
      parts.push(this.colorize ? chalk.cyan(sourceStr) : sourceStr);
    }

    // Add message
    const message = this.formatMessage(entry.message, entry.level);
    parts.push(message);

    // Output to appropriate stream
    const output = parts.join(' ');
    if (entry.level >= LogLevel.ERROR) {
      console.error(output);
    } else {
      console.log(output);
    }

    // Add data if present
    if (entry.data && Object.keys(entry.data).length > 0) {
      if (this.prettyPrint) {
        console.log(this.formatData(entry.data));
      } else {
        console.log(JSON.stringify(entry.data));
      }
    }

    // Add error if present
    if (entry.error) {
      const errorStr = this.formatError(entry.error);
      console.error(errorStr);
    }
  }

  async flush(): Promise<void> {
    // Console output is immediate, no buffering to flush
  }

  async close(): Promise<void> {
    // Nothing to close for console
  }

  private formatLevel(level: LogLevel): string {
    let levelStr: string;
    let colorFn: chalk.Chalk;

    switch (level) {
      case LogLevel.DEBUG:
        levelStr = 'DEBUG';
        colorFn = chalk.gray;
        break;
      case LogLevel.INFO:
        levelStr = 'INFO ';
        colorFn = chalk.blue;
        break;
      case LogLevel.WARN:
        levelStr = 'WARN ';
        colorFn = chalk.yellow;
        break;
      case LogLevel.ERROR:
        levelStr = 'ERROR';
        colorFn = chalk.red;
        break;
      default:
        levelStr = 'UNKNOWN';
        colorFn = chalk.white;
    }

    return this.colorize ? colorFn(levelStr) : levelStr;
  }

  private formatMessage(message: string, level: LogLevel): string {
    if (!this.colorize) {
      return message;
    }

    switch (level) {
      case LogLevel.DEBUG:
        return chalk.gray(message);
      case LogLevel.INFO:
        return message;
      case LogLevel.WARN:
        return chalk.yellow(message);
      case LogLevel.ERROR:
        return chalk.red(message);
      default:
        return message;
    }
  }

  private formatData(data: Record<string, any>): string {
    const formatted = JSON.stringify(data, null, 2);
    return this.colorize ? chalk.gray(formatted) : formatted;
  }

  private formatError(error: LogEntry['error']): string {
    if (!error) return '';

    let output = '';

    if (this.colorize) {
      output += chalk.red.bold(`${error.name}: ${error.message}`);
      if (error.code) {
        output += chalk.red(` [${error.code}]`);
      }
      if (error.stack) {
        output += '\n' + chalk.gray(error.stack);
      }
    } else {
      output += `${error.name}: ${error.message}`;
      if (error.code) {
        output += ` [${error.code}]`;
      }
      if (error.stack) {
        output += '\n' + error.stack;
      }
    }

    return output;
  }
}
