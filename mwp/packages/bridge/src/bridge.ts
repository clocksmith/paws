/**
 * MCPBridge Implementation
 *
 * Main bridge class for connecting to and interacting with MCP servers.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type {
  EventBus,
  MCPBridge as IMCPBridge,
  ToolResult,
  ResourceContent,
  PromptMessages,
  Tool,
  Resource,
  Prompt,
  UnsubscribeFunction,
  SamplingRequest,
  SamplingResult,
} from '@mcp-wp/core';
import type {
  MCPServerInfo,
  MCPCapabilities,
  MCPTool,
  MCPResource,
  MCPPrompt,
} from '@mcp-wp/core';
import type { ServerConfiguration } from '@mcp-wp/core';
import { ClientManager } from './client-manager.js';
import { ToolExecutor } from './tool-executor.js';
import { ResourceReader } from './resource-reader.js';
import { PromptGetter } from './prompt-getter.js';
import { MCPBridgeError, ConnectionError } from './errors.js';

/**
 * Bridge Configuration
 */
export interface BridgeConfiguration {
  /**
   * Server configurations
   */
  servers: ServerConfiguration[];

  /**
   * Cache configuration (optional)
   */
  cache?: {
    enabled: boolean;
    ttl: number;
    maxSize: number;
  };

  /**
   * Default retry configuration (optional)
   */
  retry?: {
    maxAttempts: number;
    initialDelay: number;
    maxDelay: number;
    backoffMultiplier: number;
  };
}

/**
 * MCPBridge
 *
 * Implementation of MCPBridge interface for connecting to MCP servers.
 */
export class MCPBridge implements IMCPBridge {
  private clientManager: ClientManager;
  private toolExecutor: ToolExecutor;
  private resourceReader: ResourceReader;
  private promptGetter: PromptGetter;
  private serverConfigs: Map<string, ServerConfiguration>;

  /**
   * Create MCPBridge instance
   *
   * @param eventBus - EventBus for event emission
   * @param config - Bridge configuration
   */
  constructor(
    private readonly eventBus: EventBus,
    private readonly config: BridgeConfiguration
  ) {
    this.serverConfigs = new Map(
      config.servers.map(server => [server.name, server])
    );

    this.clientManager = new ClientManager(eventBus, config);
    this.toolExecutor = new ToolExecutor(eventBus, this.clientManager);
    this.resourceReader = new ResourceReader(
      eventBus,
      this.clientManager,
      config.cache
    );
    this.promptGetter = new PromptGetter(eventBus, this.clientManager);
  }

  /**
   * Connect to MCP server
   *
   * @param serverName - Server identifier
   */
  async connect(serverName: string): Promise<void> {
    const config = this.serverConfigs.get(serverName);
    if (!config) {
      throw new ConnectionError(
        `Server configuration not found: ${serverName}`,
        serverName
      );
    }

    await this.clientManager.connect(serverName, config);
  }

  /**
   * Disconnect from MCP server
   *
   * @param serverName - Server identifier
   */
  async disconnect(serverName: string): Promise<void> {
    await this.clientManager.disconnect(serverName);
  }

  /**
   * Call MCP tool
   *
   * @param serverName - Server identifier
   * @param toolName - Tool name
   * @param args - Tool arguments
   * @returns Tool result
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult> {
    return this.toolExecutor.callTool(serverName, toolName, args);
  }

  /**
   * Read MCP resource
   *
   * @param serverName - Server identifier
   * @param uri - Resource URI
   * @returns Resource content
   */
  async readResource(serverName: string, uri: string): Promise<ResourceContent> {
    return this.resourceReader.readResource(serverName, uri);
  }

  /**
   * Get MCP prompt
   *
   * @param serverName - Server identifier
   * @param promptName - Prompt name
   * @param args - Prompt arguments
   * @returns Prompt messages
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<PromptMessages> {
    return this.promptGetter.getPrompt(serverName, promptName, args);
  }

  /**
   * List available tools from server
   *
   * @param serverName - Server identifier
   * @returns Array of tools
   */
  async listTools(serverName: string): Promise<Tool[]> {
    const client = this.clientManager.getClient(serverName);
    const result = await client.request({ method: 'tools/list' }, {});

    return (result.tools || []).map((tool: MCPTool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    }));
  }

  /**
   * List available resources from server
   *
   * @param serverName - Server identifier
   * @returns Array of resources
   */
  async listResources(serverName: string): Promise<Resource[]> {
    const client = this.clientManager.getClient(serverName);
    const result = await client.request({ method: 'resources/list' }, {});

    return (result.resources || []).map((resource: MCPResource) => ({
      uri: resource.uri,
      name: resource.name,
      description: resource.description,
      mimeType: resource.mimeType,
    }));
  }

  /**
   * List available prompts from server
   *
   * @param serverName - Server identifier
   * @returns Array of prompts
   */
  async listPrompts(serverName: string): Promise<Prompt[]> {
    const client = this.clientManager.getClient(serverName);
    const result = await client.request({ method: 'prompts/list' }, {});

    return (result.prompts || []).map((prompt: MCPPrompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: prompt.arguments,
    }));
  }

  /**
   * Subscribe to resource updates
   *
   * @param serverName - Server identifier
   * @param uri - Resource URI
   * @param callback - Update callback
   * @returns Unsubscribe function
   */
  async subscribeToResource(
    serverName: string,
    uri: string,
    callback: (content: ResourceContent) => void
  ): Promise<UnsubscribeFunction> {
    const client = this.clientManager.getClient(serverName);

    // Subscribe via MCP
    await client.request(
      { method: 'resources/subscribe' },
      { uri }
    );

    // Listen for resource updated events
    const handler = (data: unknown) => {
      const payload = data as { uri: string; content: ResourceContent };
      if (payload.uri === uri) {
        callback(payload.content);
      }
    };

    this.eventBus.on('mcp:resource:updated', handler);

    // Return unsubscribe function
    return async () => {
      this.eventBus.off('mcp:resource:updated', handler);
      await client.request(
        { method: 'resources/unsubscribe' },
        { uri }
      );
    };
  }

  /**
   * Complete sampling request
   *
   * @param serverName - Server identifier
   * @param request - Sampling request
   * @returns Sampling result
   */
  async completeSampling(
    serverName: string,
    request: SamplingRequest
  ): Promise<SamplingResult> {
    const client = this.clientManager.getClient(serverName);

    // Emit request event
    this.eventBus.emit('mcp:sampling:requested', {
      serverName,
      request,
    });

    try {
      const result = await client.request(
        { method: 'sampling/createMessage' },
        {
          messages: request.messages,
          modelPreferences: request.modelPreferences,
          systemPrompt: request.systemPrompt,
          includeContext: request.includeContext,
          temperature: request.temperature,
          maxTokens: request.maxTokens,
          stopSequences: request.stopSequences,
          metadata: request.metadata,
        }
      );

      const samplingResult: SamplingResult = {
        model: result.model,
        stopReason: result.stopReason,
        role: result.role,
        content: result.content,
      };

      // Emit success event
      this.eventBus.emit('mcp:sampling:completed', {
        serverName,
        requestId: '', // TODO: Generate request ID
        result: samplingResult,
      });

      return samplingResult;
    } catch (error) {
      // Emit error event
      this.eventBus.emit('mcp:sampling:error', {
        serverName,
        requestId: '',
        error: {
          code: 'SAMPLING_FAILED',
          message: error instanceof Error ? error.message : 'Sampling failed',
        },
      });

      throw error;
    }
  }

  /**
   * Get server information
   *
   * @param serverName - Server identifier
   * @returns Server info or undefined if not connected
   */
  getServerInfo(serverName: string): MCPServerInfo | undefined {
    return this.clientManager.getServerInfo(serverName);
  }

  /**
   * Check if server is connected
   *
   * @param serverName - Server identifier
   * @returns True if connected
   */
  isConnected(serverName: string): boolean {
    return this.clientManager.isConnected(serverName);
  }

  /**
   * Get all connected servers
   *
   * @returns Array of server names
   */
  getConnectedServers(): string[] {
    return this.clientManager.getConnectedServers();
  }

  /**
   * Disconnect all servers and cleanup
   */
  async shutdown(): Promise<void> {
    await this.clientManager.disconnectAll();
  }
}
