/**
 * Progress Event Bus (TypeScript)
 *
 * File-based event publisher for progress updates during bundle operations.
 * Events are written to .paws/cache/progress-stream.ndjson as newline-delimited JSON.
 */

import * as fs from 'fs/promises';
import * as path from 'path';

export interface ProgressEvent {
  event: string;
  timestamp?: string;
  [key: string]: any;
}

export function getProgressLogPath(rootPath: string = '.'): string {
  const root = path.resolve(rootPath);
  return path.join(root, '.paws', 'cache', 'progress-stream.ndjson');
}

export class ProgressBus {
  private rootPath: string;
  private logPath: string;

  constructor(rootPath: string = '.') {
    this.rootPath = path.resolve(rootPath);
    this.logPath = getProgressLogPath(this.rootPath);
  }

  async publish(event: ProgressEvent): Promise<void> {
    const payload: ProgressEvent = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    try {
      await fs.mkdir(path.dirname(this.logPath), { recursive: true });
      await fs.appendFile(this.logPath, JSON.stringify(payload) + '\n', 'utf-8');
    } catch (err) {
      if (process.env.PAWS_DEBUG) {
        const error = err as Error;
        console.warn('[ProgressBus] Failed to publish event:', error.message);
      }
    }
  }
}
