/**
 * Mock implementations of core MCP-WP dependencies
 */

import type {
  EventBus,
  MCPBridge,
  Configuration,
  MCPServerInfo,
  UnsubscribeFunction,
} from '@mcp-wp/core';

/**
 * Mock EventBus implementation
 */
export class MockEventBus implements EventBus {
  private listeners = new Map<string, Set<Function>>();
  private emittedEvents: Array<{ event: string; data: any }> = [];

  on(event: string, handler: Function): UnsubscribeFunction {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(handler);

    return () => {
      this.listeners.get(event)?.delete(handler);
    };
  }

  emit(event: string, data?: any): void {
    this.emittedEvents.push({ event, data });

    // Emit to specific listeners
    this.listeners.get(event)?.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });

    // Emit to wildcard listeners
    this.listeners.get('*')?.forEach(handler => {
      try {
        handler(data, event);
      } catch (error) {
        console.error(`Error in wildcard event handler:`, error);
      }
    });
  }

  getEmittedEvents(eventName?: string): Array<{ event: string; data: any }> {
    if (eventName) {
      return this.emittedEvents.filter(e => e.event === eventName);
    }
    return [...this.emittedEvents];
  }

  clearEmittedEvents(): void {
    this.emittedEvents = [];
  }

  reset(): void {
    this.listeners.clear();
    this.emittedEvents = [];
  }
}

/**
 * Mock MCPBridge implementation
 */
export class MockMCPBridge implements MCPBridge {
  private toolResponses = new Map<string, any>();
  private toolErrors = new Map<string, Error>();
  private toolDelays = new Map<string, number>();
  private calledTools: Array<{
    serverName: string;
    toolName: string;
    args: any;
    timestamp: Date;
  }> = [];

  private defaultDelay = 0;

  constructor(options?: { defaultDelay?: number }) {
    if (options?.defaultDelay !== undefined) {
      this.defaultDelay = options.defaultDelay;
    }
  }

  async callTool(
    serverName: string,
    toolName: string,
    args: any
  ): Promise<any> {
    // Record the call
    this.calledTools.push({
      serverName,
      toolName,
      args,
      timestamp: new Date(),
    });

    // Simulate delay
    const delay = this.toolDelays.get(toolName) ?? this.defaultDelay;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Check for error
    const error = this.toolErrors.get(toolName);
    if (error) {
      throw error;
    }

    // Return mock response
    const response = this.toolResponses.get(toolName);
    if (response !== undefined) {
      return typeof response === 'function' ? response(args) : response;
    }

    // Default response
    return { success: true };
  }

  getServerInfo(serverName: string): MCPServerInfo {
    return {
      serverName,
      protocolVersion: '1.0.0',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
    };
  }

  /**
   * Register a mock response for a tool
   */
  registerTool<TArgs = any, TResult = any>(
    toolName: string,
    response: TResult | ((args: TArgs) => TResult | Promise<TResult>)
  ): void {
    this.toolResponses.set(toolName, response);
  }

  /**
   * Register a mock error for a tool
   */
  registerToolError(toolName: string, error: Error): void {
    this.toolErrors.set(toolName, error);
  }

  /**
   * Set delay for tool call simulation
   */
  setToolDelay(toolName: string, delayMs: number): void {
    this.toolDelays.set(toolName, delayMs);
  }

  /**
   * Get all called tools
   */
  getCalledTools(toolName?: string): Array<any> {
    if (toolName) {
      return this.calledTools.filter(t => t.toolName === toolName);
    }
    return [...this.calledTools];
  }

  /**
   * Check if a tool was called
   */
  wasToolCalled(serverName: string, toolName: string, args?: any): boolean {
    return this.calledTools.some(call => {
      if (call.serverName !== serverName || call.toolName !== toolName) {
        return false;
      }
      if (args !== undefined) {
        return JSON.stringify(call.args) === JSON.stringify(args);
      }
      return true;
    });
  }

  /**
   * Clear call history
   */
  clearCalledTools(): void {
    this.calledTools = [];
  }

  /**
   * Reset all mocks
   */
  reset(): void {
    this.toolResponses.clear();
    this.toolErrors.clear();
    this.toolDelays.clear();
    this.calledTools = [];
  }
}

/**
 * Mock Configuration implementation
 */
export class MockConfiguration implements Configuration {
  private store = new Map<string, any>();

  constructor(initialData?: Record<string, any>) {
    if (initialData) {
      Object.entries(initialData).forEach(([key, value]) => {
        this.store.set(key, value);
      });
    }
  }

  get<T = any>(key: string): T | undefined {
    return this.store.get(key);
  }

  set<T = any>(key: string, value: T): void {
    this.store.set(key, value);
  }

  has(key: string): boolean {
    return this.store.has(key);
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  keys(): string[] {
    return Array.from(this.store.keys());
  }

  values(): any[] {
    return Array.from(this.store.values());
  }

  entries(): [string, any][] {
    return Array.from(this.store.entries());
  }

  reset(): void {
    this.store.clear();
  }
}

/**
 * Bundle of all mock dependencies
 */
export interface MockDependencies {
  eventBus: MockEventBus;
  mcpBridge: MockMCPBridge;
  configuration: MockConfiguration;
}

/**
 * Create all mock dependencies
 */
export function createMockDependencies(options?: {
  bridgeDelay?: number;
  initialConfig?: Record<string, any>;
}): MockDependencies {
  return {
    eventBus: new MockEventBus(),
    mcpBridge: new MockMCPBridge({ defaultDelay: options?.bridgeDelay }),
    configuration: new MockConfiguration(options?.initialConfig),
  };
}

/**
 * Convenience functions for creating individual mocks
 */
export function mockEventBus(): MockEventBus {
  return new MockEventBus();
}

export function mockMCPBridge(options?: {
  tools?: Record<string, any>;
  defaultDelay?: number;
}): MockMCPBridge {
  const bridge = new MockMCPBridge({ defaultDelay: options?.defaultDelay });

  if (options?.tools) {
    Object.entries(options.tools).forEach(([toolName, response]) => {
      bridge.registerTool(toolName, response.result || response);
      if (response.delay !== undefined) {
        bridge.setToolDelay(toolName, response.delay);
      }
      if (response.error) {
        bridge.registerToolError(toolName, response.error);
      }
    });
  }

  return bridge;
}

export function mockConfiguration(initialData?: Record<string, any>): MockConfiguration {
  return new MockConfiguration(initialData);
}
