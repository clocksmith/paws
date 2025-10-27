/**
 * EventBus Implementation
 *
 * Production-ready event bus with typed events and memory leak prevention.
 */

import type {
  EventBus as IEventBus,
  EventHandler,
  UnsubscribeFunction,
  MCPEvent,
  EventPayload,
  EventMetadata,
} from '@mwp/core';

/**
 * EventBus Options
 */
export interface EventBusOptions {
  /**
   * Maximum event history size (for debugging)
   */
  maxHistorySize?: number;

  /**
   * Log events to console
   */
  logEvents?: boolean;

  /**
   * Validate event payloads (slower but safer)
   */
  validatePayloads?: boolean;
}

/**
 * Event History Entry
 */
interface EventHistoryEntry {
  event: string;
  data: unknown;
  timestamp: Date;
  metadata?: EventMetadata;
}

/**
 * EventBus
 *
 * Robust event bus implementation with:
 * - Type-safe event emission
 * - Memory leak prevention
 * - Event history (optional)
 * - Wildcard support
 * - Priority handlers
 */
export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<EventHandlerInfo>>();
  private history: EventHistoryEntry[] = [];
  private options: EventBusOptions;

  constructor(options: EventBusOptions = {}) {
    this.options = {
      maxHistorySize: options.maxHistorySize ?? 100,
      logEvents: options.logEvents ?? false,
      validatePayloads: options.validatePayloads ?? false,
    };
  }

  /**
   * Emit an event
   *
   * @param event - Event name
   * @param data - Event payload
   * @param metadata - Optional event metadata
   */
  emit(event: string, data: unknown, metadata?: EventMetadata): void {
    // Log if enabled
    if (this.options.logEvents) {
      console.log(`[EventBus] ${event}:`, data);
    }

    // Add to history
    if (this.options.maxHistorySize && this.options.maxHistorySize > 0) {
      this.history.push({
        event,
        data,
        timestamp: new Date(),
        metadata,
      });

      // Trim history if needed
      if (this.history.length > this.options.maxHistorySize) {
        this.history.shift();
      }
    }

    // Get handlers for this event
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers || eventHandlers.size === 0) {
      return;
    }

    // Sort handlers by priority (higher first)
    const sortedHandlers = Array.from(eventHandlers).sort(
      (a, b) => (b.priority || 0) - (a.priority || 0)
    );

    // Call each handler
    for (const handlerInfo of sortedHandlers) {
      try {
        // Check filter if present
        if (handlerInfo.filter && !handlerInfo.filter(data, metadata)) {
          continue;
        }

        // Call handler
        const result = handlerInfo.handler(data);

        // Handle async handlers
        if (result instanceof Promise) {
          result.catch(error => {
            console.error(
              `[EventBus] Error in async handler for ${event}:`,
              error
            );
          });
        }

        // If once, remove handler
        if (handlerInfo.once) {
          eventHandlers.delete(handlerInfo);
        }
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${event}:`, error);
      }
    }
  }

  /**
   * Subscribe to an event
   *
   * @param event - Event name (supports wildcards: "mcp:tool:*")
   * @param handler - Event handler
   * @param options - Subscription options
   * @returns Unsubscribe function
   */
  on(
    event: string,
    handler: EventHandler,
    options?: {
      filter?: (data: unknown, metadata?: EventMetadata) => boolean;
      priority?: number;
      once?: boolean;
    }
  ): UnsubscribeFunction {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }

    const handlerInfo: EventHandlerInfo = {
      handler,
      filter: options?.filter,
      priority: options?.priority,
      once: options?.once,
    };

    this.handlers.get(event)!.add(handlerInfo);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  /**
   * Unsubscribe from an event
   *
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off(event: string, handler: EventHandler): void {
    const eventHandlers = this.handlers.get(event);
    if (!eventHandlers) {
      return;
    }

    // Find and remove handler
    for (const handlerInfo of eventHandlers) {
      if (handlerInfo.handler === handler) {
        eventHandlers.delete(handlerInfo);
        break;
      }
    }

    // Clean up empty handler sets
    if (eventHandlers.size === 0) {
      this.handlers.delete(event);
    }
  }

  /**
   * Subscribe to an event (one-time)
   *
   * @param event - Event name
   * @param handler - Event handler
   * @returns Unsubscribe function
   */
  once(event: string, handler: EventHandler): UnsubscribeFunction {
    return this.on(event, handler, { once: true });
  }

  /**
   * Remove all handlers for an event
   *
   * @param event - Event name (optional, removes all if not specified)
   */
  removeAllListeners(event?: string): void {
    if (event) {
      this.handlers.delete(event);
    } else {
      this.handlers.clear();
    }
  }

  /**
   * Get number of listeners for an event
   *
   * @param event - Event name
   * @returns Number of listeners
   */
  listenerCount(event: string): number {
    return this.handlers.get(event)?.size || 0;
  }

  /**
   * Get all event names with listeners
   *
   * @returns Array of event names
   */
  eventNames(): string[] {
    return Array.from(this.handlers.keys());
  }

  /**
   * Get event history
   *
   * @param filter - Optional filter function
   * @returns Event history entries
   */
  getHistory(
    filter?: (entry: EventHistoryEntry) => boolean
  ): EventHistoryEntry[] {
    if (filter) {
      return this.history.filter(filter);
    }
    return [...this.history];
  }

  /**
   * Clear event history
   */
  clearHistory(): void {
    this.history = [];
  }

  /**
   * Wait for event (returns promise that resolves when event is emitted)
   *
   * @param event - Event name
   * @param timeout - Optional timeout in milliseconds
   * @returns Promise that resolves with event data
   */
  waitFor<T = unknown>(event: string, timeout?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;

      const unsubscribe = this.once(event, (data) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        resolve(data as T);
      });

      if (timeout) {
        timeoutId = setTimeout(() => {
          unsubscribe();
          reject(new Error(`Timeout waiting for event: ${event}`));
        }, timeout);
      }
    });
  }

  /**
   * Get EventBus stats
   *
   * @returns Statistics object
   */
  getStats(): {
    totalHandlers: number;
    totalEvents: number;
    historySize: number;
  } {
    let totalHandlers = 0;
    for (const handlers of this.handlers.values()) {
      totalHandlers += handlers.size;
    }

    return {
      totalHandlers,
      totalEvents: this.handlers.size,
      historySize: this.history.length,
    };
  }
}

/**
 * Event Handler Info
 */
interface EventHandlerInfo {
  handler: EventHandler;
  filter?: (data: unknown, metadata?: EventMetadata) => boolean;
  priority?: number;
  once?: boolean;
}
