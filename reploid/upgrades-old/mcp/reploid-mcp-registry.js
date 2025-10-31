// @blueprint 0x000075 - MCP Server Registry for REPLOID
/**
 * ReploidMCPRegistry
 *
 * Central registry for managing MCP servers in REPLOID
 * Provides discovery, health checking, and lifecycle management
 *
 * Key Features:
 * - Register/unregister MCP servers
 * - Discovery API (list all servers and their tools)
 * - Health checking for all registered servers
 * - EventBus integration for real-time updates
 * - Widget for monitoring server status
 *
 * Usage:
 *   await MCPRegistry.registerServer('vfs', vfsServerInstance);
 *   const servers = MCPRegistry.listServers();
 *   const tools = MCPRegistry.getAllTools();
 */

const ReploidMCPRegistry = {
  metadata: {
    id: 'ReploidMCPRegistry',
    version: '1.0.0',
    description: 'Central registry for REPLOID MCP servers',
    dependencies: ['Utils', 'EventBus?'],
    async: true,
    type: 'registry'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    // Registry state
    const serverRegistry = new Map(); // serverName -> serverInstance
    const healthStatus = new Map();   // serverName -> { healthy, lastCheck, error }
    let healthCheckInterval = null;

    // Widget tracking
    const stats = {
      totalServers: 0,
      totalTools: 0,
      healthyServers: 0,
      lastRegistration: null,
      lastHealthCheck: null
    };

    logger.info('[MCPRegistry] Initializing registry...');

    /**
     * Register an MCP server
     * @param {string} name - Server identifier
     * @param {Object} serverInstance - MCP server instance (from createMCPServer)
     * @returns {boolean} Success status
     */
    const registerServer = (name, serverInstance) => {
      if (!name || !serverInstance) {
        logger.error('[MCPRegistry] Invalid server registration', { name, serverInstance });
        return false;
      }

      // Validate server has required MCP methods
      if (!serverInstance.listTools || !serverInstance.callTool) {
        logger.error(`[MCPRegistry] Server '${name}' missing required MCP methods`);
        return false;
      }

      // Check if already registered
      if (serverRegistry.has(name)) {
        logger.warn(`[MCPRegistry] Server '${name}' already registered, overwriting`);
      }

      // Register server
      serverRegistry.set(name, serverInstance);
      healthStatus.set(name, {
        healthy: true,
        lastCheck: Date.now(),
        error: null
      });

      stats.totalServers = serverRegistry.size;
      stats.totalTools = countAllTools();
      stats.lastRegistration = Date.now();

      logger.info(`[MCPRegistry] Registered server: ${name}`, {
        toolCount: serverInstance.listTools().length
      });

      // Emit registration event
      if (EventBus) {
        EventBus.emit('mcp:registry:server:registered', {
          serverName: name,
          serverInfo: serverInstance.getServerInfo(),
          timestamp: Date.now()
        });
      }

      return true;
    };

    /**
     * Unregister an MCP server
     * @param {string} name - Server identifier
     * @returns {boolean} Success status
     */
    const unregisterServer = (name) => {
      const server = serverRegistry.get(name);
      if (!server) {
        logger.warn(`[MCPRegistry] Server '${name}' not found for unregistration`);
        return false;
      }

      // Cleanup server
      if (server.cleanup) {
        server.cleanup();
      }

      serverRegistry.delete(name);
      healthStatus.delete(name);

      stats.totalServers = serverRegistry.size;
      stats.totalTools = countAllTools();

      logger.info(`[MCPRegistry] Unregistered server: ${name}`);

      // Emit unregistration event
      if (EventBus) {
        EventBus.emit('mcp:registry:server:unregistered', {
          serverName: name,
          timestamp: Date.now()
        });
      }

      return true;
    };

    /**
     * Get a registered server by name
     * @param {string} name - Server identifier
     * @returns {Object|null} Server instance or null
     */
    const getServer = (name) => {
      return serverRegistry.get(name) || null;
    };

    /**
     * List all registered servers
     * @returns {Array} Array of server info objects
     */
    const listServers = () => {
      const servers = [];
      for (const [name, server] of serverRegistry.entries()) {
        const health = healthStatus.get(name);
        servers.push({
          name,
          ...server.getServerInfo(),
          health: {
            healthy: health?.healthy ?? false,
            lastCheck: health?.lastCheck ?? null,
            error: health?.error ?? null
          }
        });
      }
      return servers;
    };

    /**
     * Get all tools from all registered servers
     * @returns {Array} Array of tool definitions with server context
     */
    const getAllTools = () => {
      const allTools = [];
      for (const [serverName, server] of serverRegistry.entries()) {
        const tools = server.listTools();
        tools.forEach(tool => {
          allTools.push({
            ...tool,
            serverName,
            qualifiedName: `${serverName}__${tool.name}`
          });
        });
      }
      return allTools;
    };

    /**
     * Call a tool on a specific server
     * @param {string} serverName - Server identifier
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    const callTool = async (serverName, toolName, args = {}) => {
      const server = serverRegistry.get(serverName);
      if (!server) {
        throw new Error(`Server '${serverName}' not found in registry`);
      }

      // Check health before calling
      const health = healthStatus.get(serverName);
      if (!health?.healthy) {
        logger.warn(`[MCPRegistry] Calling tool on unhealthy server: ${serverName}`);
      }

      return await server.callTool(toolName, args);
    };

    /**
     * Call a tool by qualified name (serverName__toolName)
     * @param {string} qualifiedName - Qualified tool name
     * @param {Object} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    const callToolByQualifiedName = async (qualifiedName, args = {}) => {
      const parts = qualifiedName.split('__');
      if (parts.length !== 2) {
        throw new Error(`Invalid qualified tool name: ${qualifiedName} (expected format: serverName__toolName)`);
      }

      const [serverName, toolName] = parts;
      return await callTool(serverName, toolName, args);
    };

    /**
     * Count total tools across all servers
     */
    const countAllTools = () => {
      let count = 0;
      for (const server of serverRegistry.values()) {
        count += server.listTools().length;
      }
      return count;
    };

    /**
     * Health check all registered servers
     */
    const performHealthCheck = async () => {
      stats.lastHealthCheck = Date.now();
      stats.healthyServers = 0;

      for (const [name, server] of serverRegistry.entries()) {
        try {
          // Try to list tools as a basic health check
          const tools = server.listTools();

          healthStatus.set(name, {
            healthy: true,
            lastCheck: Date.now(),
            error: null,
            toolCount: tools.length
          });

          stats.healthyServers++;
        } catch (error) {
          healthStatus.set(name, {
            healthy: false,
            lastCheck: Date.now(),
            error: error.message
          });

          logger.error(`[MCPRegistry] Health check failed for ${name}:`, error);

          // Emit health check failure event
          if (EventBus) {
            EventBus.emit('mcp:registry:health:failed', {
              serverName: name,
              error: error.message,
              timestamp: Date.now()
            });
          }
        }
      }

      // Emit overall health status
      if (EventBus) {
        EventBus.emit('mcp:registry:health:checked', {
          totalServers: serverRegistry.size,
          healthyServers: stats.healthyServers,
          timestamp: Date.now()
        });
      }
    };

    /**
     * Start periodic health checks
     * @param {number} intervalMs - Check interval in milliseconds (default: 60000 = 1 minute)
     */
    const startHealthChecks = (intervalMs = 60000) => {
      if (healthCheckInterval) {
        logger.warn('[MCPRegistry] Health checks already running');
        return;
      }

      logger.info(`[MCPRegistry] Starting health checks (interval: ${intervalMs}ms)`);

      // Initial check
      performHealthCheck();

      // Periodic checks
      healthCheckInterval = setInterval(() => {
        performHealthCheck();
      }, intervalMs);
    };

    /**
     * Stop periodic health checks
     */
    const stopHealthChecks = () => {
      if (healthCheckInterval) {
        clearInterval(healthCheckInterval);
        healthCheckInterval = null;
        logger.info('[MCPRegistry] Stopped health checks');
      }
    };

    /**
     * Get registry statistics
     */
    const getStats = () => {
      return { ...stats };
    };

    /**
     * Initialize registry
     */
    const init = async () => {
      logger.info('[MCPRegistry] Initialized');

      // Start health checks
      startHealthChecks();

      return true;
    };

    /**
     * Cleanup registry
     */
    const cleanup = () => {
      stopHealthChecks();

      // Cleanup all servers
      for (const [name, server] of serverRegistry.entries()) {
        if (server.cleanup) {
          server.cleanup();
        }
      }

      serverRegistry.clear();
      healthStatus.clear();

      logger.info('[MCPRegistry] Cleaned up');
    };

    // Widget for monitoring
    const widget = {
      element: 'mcp-registry-widget',
      displayName: 'MCP Registry',
      icon: '⚡',
      category: 'mcp',
      order: 1,
      updateInterval: 5000
    };

    // Web Component Widget
    class MCPRegistryWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      connectedCallback() {
        this.render();
        this._updateInterval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const stats = getStats();
        const healthPercent = stats.totalServers > 0
          ? Math.round((stats.healthyServers / stats.totalServers) * 100)
          : 0;

        return {
          state: stats.healthyServers === stats.totalServers ? 'active' :
                 stats.healthyServers > 0 ? 'warning' : 'error',
          primaryMetric: `${stats.totalServers} servers`,
          secondaryMetric: `${stats.totalTools} tools`,
          lastActivity: stats.lastHealthCheck,
          message: `${healthPercent}% healthy`
        };
      }

      getControls() {
        return [
          {
            id: 'refresh-health',
            label: '↻ Check Health',
            action: async () => {
              await performHealthCheck();
              this.render();
              return { success: true, message: 'Health check completed' };
            }
          },
          {
            id: 'list-servers',
            label: '⚡ List Servers',
            action: () => {
              const servers = listServers();
              console.table(servers);
              return { success: true, message: `${servers.length} servers logged` };
            }
          }
        ];
      }

      renderPanel() {
        const stats = getStats();
        const servers = listServers();

        let html = '<div style="font-family: monospace; font-size: 12px; color: #e0e0e0;">';

        // Stats summary
        html += '<div style="margin-bottom: 16px; padding: 12px; background: rgba(0,255,255,0.05); border: 1px solid rgba(0,255,255,0.2); border-radius: 4px;">';
        html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">Registry Stats</div>';
        html += `<div>Total Servers: <span style="color: #0ff; font-weight: bold;">${stats.totalServers}</span></div>`;
        html += `<div>Healthy: <span style="color: #0f0;">${stats.healthyServers}</span> / ${stats.totalServers}</div>`;
        html += `<div>Total Tools: <span style="color: #0ff;">${stats.totalTools}</span></div>`;
        if (stats.lastHealthCheck) {
          const ago = Math.floor((Date.now() - stats.lastHealthCheck) / 1000);
          html += `<div style="color: #888; font-size: 10px; margin-top: 4px;">Last check: ${ago}s ago</div>`;
        }
        html += '</div>';

        // Server list
        if (servers.length > 0) {
          html += '<div style="margin-bottom: 12px;">';
          html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">Registered Servers</div>';

          servers.forEach(server => {
            const statusColor = server.health.healthy ? '#0f0' : '#f00';
            const statusIcon = server.health.healthy ? '●' : '●';

            html += '<div style="margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-left: 3px solid ' + statusColor + ';">';
            html += `<div style="display: flex; justify-content: space-between; align-items: center;">`;
            html += `<span style="color: #fff; font-weight: bold;">${server.name}</span>`;
            html += `<span style="color: ${statusColor}; font-size: 16px;">${statusIcon}</span>`;
            html += `</div>`;
            html += `<div style="color: #aaa; font-size: 10px; margin-top: 2px;">${server.description || 'No description'}</div>`;
            html += `<div style="color: #888; font-size: 10px; margin-top: 4px;">Tools: ${server.toolCount} | Version: ${server.version}</div>`;
            if (!server.health.healthy && server.health.error) {
              html += `<div style="color: #f00; font-size: 10px; margin-top: 4px;">Error: ${server.health.error}</div>`;
            }
            html += '</div>';
          });

          html += '</div>';
        } else {
          html += '<div style="color: #888; text-align: center; padding: 20px;">No servers registered</div>';
        }

        html += '</div>';
        return html;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #ccc;
            }
          </style>
          ${this.renderPanel()}
        `;
      }
    }

    // Define custom element
    const elementName = 'mcp-registry-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, MCPRegistryWidget);
    }

    // Public API
    return {
      init,
      api: {
        registerServer,
        unregisterServer,
        getServer,
        listServers,
        getAllTools,
        callTool,
        callToolByQualifiedName,
        performHealthCheck,
        startHealthChecks,
        stopHealthChecks,
        getStats,
        cleanup
      },
      widget
    };
  }
};

export default ReploidMCPRegistry;
