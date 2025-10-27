/**
 * Resource Reader
 *
 * Handles MCP resource reading with caching support.
 */

import type { EventBus, ResourceContent } from '@mwp/core';
import type { ClientManager } from './client-manager.js';
import { ResourceReadError } from './errors.js';

/**
 * Cache Entry
 */
interface CacheEntry {
  content: ResourceContent;
  timestamp: number;
  size: number;
}

/**
 * Resource Reader
 *
 * Reads MCP resources with optional caching.
 */
export class ResourceReader {
  private cache = new Map<string, CacheEntry>();
  private cacheSize = 0;

  constructor(
    private readonly eventBus: EventBus,
    private readonly clientManager: ClientManager,
    private readonly cacheConfig?: {
      enabled: boolean;
      ttl: number;
      maxSize: number;
    }
  ) {
    // Start cache cleanup interval if caching is enabled
    if (this.cacheConfig?.enabled) {
      setInterval(() => this.cleanupCache(), 60000); // Every minute
    }
  }

  /**
   * Read MCP resource
   *
   * @param serverName - Server identifier
   * @param uri - Resource URI
   * @returns Resource content
   */
  async readResource(serverName: string, uri: string): Promise<ResourceContent> {
    const requestId = this.generateRequestId();
    const cacheKey = `${serverName}:${uri}`;

    // Check cache
    if (this.cacheConfig?.enabled) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        // Emit read event with cached flag
        this.eventBus.emit('mcp:resource:read', {
          serverName,
          uri,
          content: cached,
          requestId,
          cached: true,
        });

        return cached;
      }
    }

    // Emit request event
    this.eventBus.emit('mcp:resource:read-requested', {
      serverName,
      uri,
      requestId,
    });

    try {
      // Get client
      const client = this.clientManager.getClient(serverName);

      // Read resource via MCP
      const result = await client.request(
        { method: 'resources/read' },
        { uri }
      );

      const content: ResourceContent = {
        uri,
        mimeType: result.mimeType,
        text: result.text,
        blob: result.blob,
      };

      // Cache if enabled
      if (this.cacheConfig?.enabled) {
        this.addToCache(cacheKey, content);
      }

      // Emit success event
      this.eventBus.emit('mcp:resource:read', {
        serverName,
        uri,
        content,
        requestId,
        cached: false,
      });

      return content;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:resource:error', {
        serverName,
        uri,
        error: {
          code: 'RESOURCE_READ_ERROR',
          message: error instanceof Error ? error.message : 'Resource read failed',
          details: error,
        },
        requestId,
      });

      throw new ResourceReadError(
        `Failed to read resource ${uri} from ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        serverName,
        uri,
        error
      );
    }
  }

  /**
   * Get resource from cache
   */
  private getFromCache(key: string): ResourceContent | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.cacheConfig!.ttl) {
      this.removeFromCache(key);
      return undefined;
    }

    return entry.content;
  }

  /**
   * Add resource to cache
   */
  private addToCache(key: string, content: ResourceContent): void {
    if (!this.cacheConfig) return;

    // Calculate content size (rough estimate)
    const size = this.estimateSize(content);

    // Check if adding would exceed max size
    while (this.cacheSize + size > this.cacheConfig.maxSize && this.cache.size > 0) {
      // Remove oldest entry (LRU)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.removeFromCache(oldestKey);
      }
    }

    // Add to cache
    this.cache.set(key, {
      content,
      timestamp: Date.now(),
      size,
    });

    this.cacheSize += size;
  }

  /**
   * Remove resource from cache
   */
  private removeFromCache(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.cacheSize -= entry.size;
      this.cache.delete(key);
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupCache(): void {
    if (!this.cacheConfig) return;

    const now = Date.now();
    const toRemove: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.cacheConfig.ttl) {
        toRemove.push(key);
      }
    }

    for (const key of toRemove) {
      this.removeFromCache(key);
    }
  }

  /**
   * Estimate content size in bytes
   */
  private estimateSize(content: ResourceContent): number {
    let size = content.uri.length * 2; // URI (rough)

    if (content.text) {
      size += content.text.length * 2; // Text (UTF-16)
    }

    if (content.blob) {
      size += content.blob.length; // Blob (base64)
    }

    if (content.mimeType) {
      size += content.mimeType.length * 2;
    }

    return size;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `resource-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheSize = 0;
  }

  /**
   * Get cache stats
   */
  getCacheStats(): { entries: number; sizeBytes: number; hitRate?: number } {
    return {
      entries: this.cache.size,
      sizeBytes: this.cacheSize,
    };
  }
}
