/**
 * File transport for logging with rotation support
 */

import * as fs from 'fs';
import * as path from 'path';
import { Transport, LogEntry, LogLevel, FileTransportOptions } from '../types';

export class FileTransport implements Transport {
  public readonly name = 'file';
  public readonly minLevel: LogLevel;

  private filePath: string;
  private maxSize: number;
  private maxFiles: number;
  private json: boolean;
  private writeStream: fs.WriteStream | null = null;
  private currentSize: number = 0;
  private buffer: string[] = [];
  private flushTimer: NodeJS.Timeout | null = null;
  private readonly flushIntervalMs = 1000;

  constructor(options: FileTransportOptions) {
    this.filePath = options.filePath;
    this.minLevel = options.minLevel ?? LogLevel.DEBUG;
    this.maxSize = options.maxSize ?? 10 * 1024 * 1024; // 10MB default
    this.maxFiles = options.maxFiles ?? 5;
    this.json = options.json ?? true;

    // Ensure directory exists
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Initialize write stream
    this.initializeStream();

    // Start periodic flush
    this.startPeriodicFlush();
  }

  private initializeStream(): void {
    // Get current file size
    if (fs.existsSync(this.filePath)) {
      const stats = fs.statSync(this.filePath);
      this.currentSize = stats.size;

      // Rotate if file is too large
      if (this.currentSize >= this.maxSize) {
        this.rotateLog();
        this.currentSize = 0;
      }
    }

    // Create write stream in append mode
    this.writeStream = fs.createWriteStream(this.filePath, { flags: 'a' });
  }

  async write(entry: LogEntry): Promise<void> {
    // Skip if below minimum level
    if (entry.level < this.minLevel) {
      return;
    }

    const line = this.formatEntry(entry);
    const size = Buffer.byteLength(line, 'utf8');

    // Check if we need to rotate
    if (this.currentSize + size >= this.maxSize) {
      await this.flush();
      this.rotateLog();
      this.currentSize = 0;
    }

    // Add to buffer
    this.buffer.push(line);
    this.currentSize += size;

    // Flush if buffer is large
    if (this.buffer.length >= 100) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.buffer.length === 0 || !this.writeStream) {
      return;
    }

    const content = this.buffer.join('');
    this.buffer = [];

    return new Promise((resolve, reject) => {
      this.writeStream!.write(content, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  async close(): Promise<void> {
    // Stop periodic flush
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }

    // Flush remaining buffer
    await this.flush();

    // Close stream
    if (this.writeStream) {
      return new Promise((resolve) => {
        this.writeStream!.end(() => {
          this.writeStream = null;
          resolve();
        });
      });
    }
  }

  private formatEntry(entry: LogEntry): string {
    if (this.json) {
      // JSON format
      const jsonEntry = {
        timestamp: entry.timestamp.toISOString(),
        level: LogLevel[entry.level],
        source: entry.source,
        message: entry.message,
        data: entry.data,
        error: entry.error,
      };
      return JSON.stringify(jsonEntry) + '\n';
    } else {
      // Text format
      const parts: string[] = [];

      parts.push(entry.timestamp.toISOString());
      parts.push(LogLevel[entry.level].padEnd(5));

      if (entry.source) {
        parts.push(`[${entry.source}]`);
      }

      parts.push(entry.message);

      let line = parts.join(' ') + '\n';

      if (entry.data) {
        line += '  Data: ' + JSON.stringify(entry.data) + '\n';
      }

      if (entry.error) {
        line += `  Error: ${entry.error.name}: ${entry.error.message}`;
        if (entry.error.code) {
          line += ` [${entry.error.code}]`;
        }
        line += '\n';
        if (entry.error.stack) {
          line += entry.error.stack + '\n';
        }
      }

      return line;
    }
  }

  private rotateLog(): void {
    if (!fs.existsSync(this.filePath)) {
      return;
    }

    // Close current stream
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }

    // Rotate existing files
    for (let i = this.maxFiles - 1; i >= 1; i--) {
      const oldPath = `${this.filePath}.${i}`;
      const newPath = `${this.filePath}.${i + 1}`;

      if (fs.existsSync(oldPath)) {
        if (i === this.maxFiles - 1) {
          // Delete oldest file
          fs.unlinkSync(oldPath);
        } else {
          // Rename file
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // Rename current file to .1
    fs.renameSync(this.filePath, `${this.filePath}.1`);

    // Reinitialize stream
    this.initializeStream();
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Failed to flush log buffer:', error);
      });
    }, this.flushIntervalMs);

    // Don't prevent process exit
    if (this.flushTimer.unref) {
      this.flushTimer.unref();
    }
  }
}
