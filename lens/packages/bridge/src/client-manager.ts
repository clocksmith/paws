/**
 * Client Manager
 *
 * Manages MCP client connections and lifecycle.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { EventBus } from '@mwp/core';
import type { MCPServerInfo, MCPCapabilities } from '@mwp/core';
import type { ServerConfiguration } from '@mwp/core';
import type { BridgeConfiguration } from './bridge.js';
import { ConnectionError } from './errors.js';

/**
 * Client Info
 */
interface ClientInfo {
  client: Client;
  config: ServerConfiguration;
  serverInfo: MCPServerInfo;
  connected: boolean;
  connecting: boolean;
}

/**
 * Client Manager
 *
 * Manages connections to multiple MCP servers.
 */
export class ClientManager {
  private clients = new Map<string, ClientInfo>();

  constructor(
    private readonly eventBus: EventBus,
    private readonly config: BridgeConfiguration
  ) {}

  /**
   * Connect to MCP server
   *
   * @param serverName - Server identifier
   * @param config - Server configuration
   */
  async connect(
    serverName: string,
    config: ServerConfiguration
  ): Promise<void> {
    // Check if already connected
    const existing = this.clients.get(serverName);
    if (existing?.connected) {
      return;
    }

    // Check if connection in progress
    if (existing?.connecting) {
      throw new ConnectionError(
        `Connection already in progress for ${serverName}`,
        serverName
      );
    }

    // Mark as connecting
    if (existing) {
      existing.connecting = true;
    }

    try {
      // Create transport based on config
      const transport = await this.createTransport(config);

      // Create MCP client
      const client = new Client(
        {
          name: 'mwp-bridge',
          version: '1.0.0',
        },
        {
          capabilities: {},
        }
      );

      // Connect to server
      await client.connect(transport);

      // Get server info
      const serverInfo = await this.getServerInfoFromClient(client, serverName, config);

      // Store client info
      this.clients.set(serverName, {
        client,
        config,
        serverInfo,
        connected: true,
        connecting: false,
      });

      // Emit connected event
      this.eventBus.emit('mcp:server:connected', {
        serverName,
        serverInfo,
        timestamp: new Date(),
      });
    } catch (error) {
      // Remove connecting flag
      const existing = this.clients.get(serverName);
      if (existing) {
        existing.connecting = false;
      }

      // Emit error event
      this.eventBus.emit('mcp:server:error', {
        serverName,
        error: {
          code: 'CONNECTION_FAILED',
          message: error instanceof Error ? error.message : 'Connection failed',
        },
        timestamp: new Date(),
      });

      throw new ConnectionError(
        `Failed to connect to ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        serverName,
        error
      );
    }
  }

  /**
   * Disconnect from MCP server
   *
   * @param serverName - Server identifier
   */
  async disconnect(serverName: string): Promise<void> {
    const clientInfo = this.clients.get(serverName);
    if (!clientInfo) {
      return;
    }

    try {
      await clientInfo.client.close();
      clientInfo.connected = false;

      // Emit disconnected event
      this.eventBus.emit('mcp:server:disconnected', {
        serverName,
        reason: 'Manual disconnect',
        timestamp: new Date(),
      });

      this.clients.delete(serverName);
    } catch (error) {
      throw new ConnectionError(
        `Failed to disconnect from ${serverName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        serverName,
        error
      );
    }
  }

  /**
   * Disconnect all servers
   */
  async disconnectAll(): Promise<void> {
    const serverNames = Array.from(this.clients.keys());
    await Promise.all(serverNames.map(name => this.disconnect(name)));
  }

  /**
   * Get client for server
   *
   * @param serverName - Server identifier
   * @returns MCP Client
   * @throws ConnectionError if not connected
   */
  getClient(serverName: string): Client {
    const clientInfo = this.clients.get(serverName);
    if (!clientInfo || !clientInfo.connected) {
      throw new ConnectionError(
        `Server ${serverName} is not connected`,
        serverName
      );
    }

    return clientInfo.client;
  }

  /**
   * Get server info
   *
   * @param serverName - Server identifier
   * @returns Server info or undefined
   */
  getServerInfo(serverName: string): MCPServerInfo | undefined {
    return this.clients.get(serverName)?.serverInfo;
  }

  /**
   * Check if server is connected
   *
   * @param serverName - Server identifier
   * @returns True if connected
   */
  isConnected(serverName: string): boolean {
    return this.clients.get(serverName)?.connected || false;
  }

  /**
   * Get all connected servers
   *
   * @returns Array of server names
   */
  getConnectedServers(): string[] {
    return Array.from(this.clients.entries())
      .filter(([, info]) => info.connected)
      .map(([name]) => name);
  }

  /**
   * Create transport for server config
   */
  private async createTransport(config: ServerConfiguration) {
    if (config.transport.type === 'stdio') {
      return new StdioClientTransport({
        command: config.transport.command,
        args: config.transport.args,
        env: {
          ...process.env,
          ...config.env,
          ...config.transport.env,
        },
        cwd: config.transport.cwd,
      });
    } else {
      // HTTP transport
      throw new Error('HTTP transport not yet implemented');
    }
  }

  /**
   * Get server info from connected client
   */
  private async getServerInfoFromClient(
    client: Client,
    serverName: string,
    config: ServerConfiguration
  ): Promise<MCPServerInfo> {
    // Get tools
    const toolsResult = await client.request({ method: 'tools/list' }, {});
    const tools = toolsResult.tools || [];

    // Get resources
    const resourcesResult = await client.request({ method: 'resources/list' }, {});
    const resources = resourcesResult.resources || [];

    // Get prompts
    const promptsResult = await client.request({ method: 'prompts/list' }, {});
    const prompts = promptsResult.prompts || [];

    // Get server capabilities (from initialization)
    const capabilities: MCPCapabilities = {
      tools: tools.length > 0 ? {} : undefined,
      resources: resources.length > 0 ? {} : undefined,
      prompts: prompts.length > 0 ? {} : undefined,
    };

    return {
      serverName,
      transport: config.transport.type,
      protocolVersion: '2025-06-18', // MCP protocol version
      capabilities,
      tools,
      resources,
      prompts,
    };
  }
}
