/**
 * PAWS Command Center
 *
 * MCP client/host for orchestrating GAMMA, REPLOID, and external MCP servers
 * with sampling, elicitation, and roots management.
 */

import { MCPClient } from "./client/mcp-client.js";
import { SamplingHandler } from "./client/sampling-handler.js";
import { ElicitationHandler } from "./client/elicitation-handler.js";
import { RootsManager } from "./workflows/roots-manager.js";
import type {
  CommandCenterConfig,
  ServerConfig,
  Root,
  SamplingRequest,
  SamplingResponse,
  ElicitationRequest,
  ElicitationResponse,
  CallToolResult,
  ReadResourceResult,
  GetPromptResult,
} from "./types/index.js";

export class PAWSCommandCenter {
  private mcpClient: MCPClient;
  private samplingHandler: SamplingHandler;
  private elicitationHandler: ElicitationHandler;
  private rootsManager: RootsManager;
  private config: CommandCenterConfig;

  constructor(config: CommandCenterConfig) {
    this.config = config;
    this.mcpClient = new MCPClient();
    this.samplingHandler = new SamplingHandler(this.mcpClient, {
      requireApproval: config.requireApproval ?? true,
      autoApproveTrusted: !config.requireApproval,
      trustedServers: config.trustedServers || [],
    });
    this.elicitationHandler = new ElicitationHandler();
    this.rootsManager = new RootsManager({
      autoDetect: true,
      includeCwd: true,
    });
  }

  /**
   * Initialize the command center
   */
  async initialize(): Promise<void> {
    console.error("[CommandCenter] Initializing PAWS Command Center...");

    // Initialize roots
    const roots = await this.rootsManager.initialize();
    console.error(`[CommandCenter] Detected ${roots.length} filesystem roots`);

    // Add configured roots
    if (this.config.roots) {
      for (const root of this.config.roots) {
        this.rootsManager.addRoot(root.uri, root.name);
      }
    }

    // Connect to servers
    console.error(`[CommandCenter] Connecting to ${this.config.servers.length} servers...`);
    const connectionPromises = this.config.servers.map((serverConfig) =>
      this.connectServer(serverConfig)
    );

    const results = await Promise.allSettled(connectionPromises);

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    console.error(
      `[CommandCenter] Connected to ${successful}/${this.config.servers.length} servers (${failed} failed)`
    );

    // Setup roots change listener
    this.rootsManager.onRootsChanged((roots) => {
      this.mcpClient.notifyRootsChanged(roots);
    });

    // Notify all servers of initial roots
    await this.mcpClient.notifyRootsChanged(this.rootsManager.getRoots());

    console.error("[CommandCenter] ✓ Initialization complete\n");
  }

  /**
   * Connect to a server
   */
  async connectServer(config: ServerConfig): Promise<void> {
    try {
      await this.mcpClient.connect(config);
    } catch (error) {
      console.error(`[CommandCenter] Failed to connect to ${config.name}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from a server
   */
  async disconnectServer(serverName: string): Promise<void> {
    await this.mcpClient.disconnect(serverName);
  }

  /**
   * Shutdown the command center
   */
  async shutdown(): Promise<void> {
    console.error("\n[CommandCenter] Shutting down...");
    await this.mcpClient.disconnectAll();
    console.error("[CommandCenter] ✓ Shutdown complete");
  }

  // ============================================================================
  // Resource Operations
  // ============================================================================

  /**
   * List resources from a server
   */
  async listResources(serverName: string): Promise<Array<{ uri: string; name: string }>> {
    return this.mcpClient.listResources(serverName);
  }

  /**
   * Read a resource
   */
  async readResource(serverName: string, uri: string): Promise<ReadResourceResult> {
    return this.mcpClient.readResource(serverName, uri);
  }

  // ============================================================================
  // Tool Operations
  // ============================================================================

  /**
   * List tools from a server
   */
  async listTools(serverName: string): Promise<Array<{ name: string; description?: string }>> {
    return this.mcpClient.listTools(serverName);
  }

  /**
   * Call a tool
   */
  async callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown> = {}
  ): Promise<CallToolResult> {
    return this.mcpClient.callTool(serverName, toolName, args);
  }

  // ============================================================================
  // Prompt Operations
  // ============================================================================

  /**
   * List prompts from a server
   */
  async listPrompts(serverName: string): Promise<Array<{ name: string; description?: string }>> {
    return this.mcpClient.listPrompts(serverName);
  }

  /**
   * Get a prompt
   */
  async getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string> = {}
  ): Promise<GetPromptResult> {
    return this.mcpClient.getPrompt(serverName, promptName, args);
  }

  // ============================================================================
  // Sampling
  // ============================================================================

  /**
   * Handle a sampling request (typically called by servers)
   */
  async handleSamplingRequest(request: SamplingRequest): Promise<SamplingResponse | null> {
    return this.samplingHandler.handleSamplingRequest(request);
  }

  /**
   * Request LLM sampling (for direct use)
   */
  async sample(request: Omit<SamplingRequest, "serverId">): Promise<SamplingResponse | null> {
    return this.samplingHandler.handleSamplingRequest({
      ...request,
      serverId: "command-center",
    });
  }

  // ============================================================================
  // Elicitation
  // ============================================================================

  /**
   * Handle an elicitation request (typically called by servers)
   */
  async handleElicitationRequest(
    request: ElicitationRequest
  ): Promise<ElicitationResponse> {
    return this.elicitationHandler.handleElicitationRequest(request);
  }

  /**
   * Request user input (for direct use)
   */
  async elicit(
    message: string,
    schema: ElicitationRequest["schema"]
  ): Promise<ElicitationResponse> {
    return this.elicitationHandler.handleElicitationRequest({
      serverId: "command-center",
      message,
      schema,
    });
  }

  // ============================================================================
  // Roots Management
  // ============================================================================

  /**
   * Get current roots
   */
  getRoots(): Root[] {
    return this.rootsManager.getRoots();
  }

  /**
   * Set roots (replaces existing)
   */
  async setRoots(roots: Root[]): Promise<void> {
    this.rootsManager.setRoots(roots);
    await this.mcpClient.notifyRootsChanged(roots);
  }

  /**
   * Add a root
   */
  async addRoot(uri: string, name: string): Promise<void> {
    this.rootsManager.addRoot(uri, name);
    await this.mcpClient.notifyRootsChanged(this.rootsManager.getRoots());
  }

  /**
   * Remove a root
   */
  async removeRoot(uri: string): Promise<void> {
    this.rootsManager.removeRoot(uri);
    await this.mcpClient.notifyRootsChanged(this.rootsManager.getRoots());
  }

  // ============================================================================
  // Status & Introspection
  // ============================================================================

  /**
   * Get connection status for all servers
   */
  getStatus(): Record<string, "connected" | "disconnected" | "error"> {
    return this.mcpClient.getStatus();
  }

  /**
   * Check if a server is connected
   */
  isServerConnected(serverName: string): boolean {
    return this.mcpClient.isConnected(serverName);
  }

  /**
   * Get list of connected server names
   */
  getConnectedServers(): string[] {
    return Object.entries(this.getStatus())
      .filter(([_, status]) => status === "connected")
      .map(([name]) => name);
  }

  /**
   * Get MCP client instance (for advanced usage)
   */
  getClient(): MCPClient {
    return this.mcpClient;
  }
}

// Re-export types and utilities
export * from "./types/index.js";
export * from "./servers/registry.js";
export { MCPClient } from "./client/mcp-client.js";
export { SamplingHandler } from "./client/sampling-handler.js";
export { ElicitationHandler } from "./client/elicitation-handler.js";
export { RootsManager } from "./workflows/roots-manager.js";
