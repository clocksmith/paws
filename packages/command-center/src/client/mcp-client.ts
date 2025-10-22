/**
 * Core MCP Client wrapper
 *
 * Provides a simplified interface for interacting with MCP servers,
 * handling connection lifecycle, capability detection, and error handling.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type {
  ServerConfig,
  ConnectedServer,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
  ToolExecutionOptions,
  ResourceReadOptions
} from "../types/index.js";
import { spawn } from "child_process";

export class MCPClient {
  private connectedServers = new Map<string, ConnectedServer>();

  /**
   * Connect to an MCP server
   */
  async connect(config: ServerConfig): Promise<ConnectedServer> {
    console.error(`[MCP] Connecting to ${config.name}...`);

    try {
      // Create client
      const client = new Client(
        {
          name: "paws-command-center",
          version: "1.0.0",
        },
        {
          capabilities: {
            sampling: {},
            roots: {
              listChanged: true,
            },
          },
        }
      );

      // Create transport
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
          ? {
              ...(process.env as Record<string, string>),
              ...config.env,
            }
          : undefined,
      });

      // Connect
      await client.connect(transport);

      // Get server capabilities
      const serverInfo = client.getServerVersion();
      const capabilities = {
        resources: true, // Assume all capabilities for now
        tools: true,
        prompts: true,
        sampling: true,
      };

      const connectedServer: ConnectedServer = {
        config,
        client,
        capabilities,
        status: "connected",
      };

      this.connectedServers.set(config.name, connectedServer);
      console.error(`[MCP] ✓ Connected to ${config.name} (${serverInfo?.name || "unknown"})`);

      return connectedServer;
    } catch (error) {
      console.error(`[MCP] ✗ Failed to connect to ${config.name}:`, error);

      const errorServer: ConnectedServer = {
        config,
        client: null as any,
        capabilities: {},
        status: "error",
        error: error instanceof Error ? error.message : String(error),
      };

      this.connectedServers.set(config.name, errorServer);
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnect(serverName: string): Promise<void> {
    const server = this.connectedServers.get(serverName);
    if (!server || server.status !== "connected") {
      return;
    }

    try {
      await server.client.close();
      server.status = "disconnected";
      console.error(`[MCP] Disconnected from ${serverName}`);
    } catch (error) {
      console.error(`[MCP] Error disconnecting from ${serverName}:`, error);
    }
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connectedServers.keys()).map(
      (name) => this.disconnect(name)
    );
    await Promise.allSettled(disconnectPromises);
  }

  /**
   * Get a connected server
   */
  getServer(serverName: string): ConnectedServer | undefined {
    return this.connectedServers.get(serverName);
  }

  /**
   * Get all connected servers
   */
  getAllServers(): ConnectedServer[] {
    return Array.from(this.connectedServers.values());
  }

  /**
   * List available resources from a server
   */
  async listResources(serverName: string): Promise<Array<{ uri: string; name: string }>> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.listResources();
      return result.resources.map((r) => ({
        uri: r.uri,
        name: r.name,
      }));
    } catch (error) {
      console.error(`[MCP] Error listing resources from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Read a resource from a server
   */
  async readResource(
    serverName: string,
    uri: string,
    options: ResourceReadOptions = {}
  ): Promise<ReadResourceResult> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.readResource({ uri });
      return result;
    } catch (error) {
      console.error(`[MCP] Error reading resource ${uri} from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * List available tools from a server
   */
  async listTools(serverName: string): Promise<Array<{ name: string; description?: string }>> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.listTools();
      return result.tools.map((t) => ({
        name: t.name,
        description: t.description,
      }));
    } catch (error) {
      console.error(`[MCP] Error listing tools from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Call a tool on a server
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {},
    options: ToolExecutionOptions = {}
  ): Promise<CallToolResult> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args,
      });
      return result as CallToolResult;
    } catch (error) {
      console.error(`[MCP] Error calling tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * List available prompts from a server
   */
  async listPrompts(serverName: string): Promise<Array<{ name: string; description?: string }>> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.listPrompts();
      return result.prompts.map((p) => ({
        name: p.name,
        description: p.description,
      }));
    } catch (error) {
      console.error(`[MCP] Error listing prompts from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Get a prompt from a server
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string> = {}
  ): Promise<GetPromptResult> {
    const server = this.getServer(serverName);
    if (!server || server.status !== "connected") {
      throw new Error(`Server ${serverName} not connected`);
    }

    try {
      const result = await server.client.getPrompt({
        name: promptName,
        arguments: args,
      });
      return result;
    } catch (error) {
      console.error(`[MCP] Error getting prompt ${promptName} from ${serverName}:`, error);
      throw error;
    }
  }

  /**
   * Send roots list to all connected servers
   */
  async notifyRootsChanged(roots: Array<{ uri: string; name?: string }>): Promise<void> {
    const notifyPromises = this.getAllServers()
      .filter((s) => s.status === "connected")
      .map(async (server) => {
        try {
          // Note: The SDK will handle this through the roots capability
          // For now, we just log it
          console.error(`[MCP] Notifying ${server.config.name} of roots change`);
        } catch (error) {
          console.error(`[MCP] Error notifying ${server.config.name} of roots:`, error);
        }
      });

    await Promise.allSettled(notifyPromises);
  }

  /**
   * Check if a server is connected
   */
  isConnected(serverName: string): boolean {
    const server = this.getServer(serverName);
    return server?.status === "connected";
  }

  /**
   * Get connection status for all servers
   */
  getStatus(): Record<string, "connected" | "disconnected" | "error"> {
    const status: Record<string, "connected" | "disconnected" | "error"> = {};
    for (const [name, server] of this.connectedServers) {
      status[name] = server.status;
    }
    return status;
  }
}
