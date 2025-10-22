# MWP Integration Guide for REPLOID

**A practical guide for integrating MCP Widget Protocol (MWP) with REPLOID**

Version: 1.0.0 | Date: 2025-10-20

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Understanding MWP vs REPLOID Architecture](#understanding-mwp-vs-reploid-architecture)
3. [Hybrid Integration Tutorial](#hybrid-integration-tutorial)
4. [Converting Upgrades to MCP Servers](#converting-upgrades-to-mcp-servers)
5. [Widget Migration Patterns](#widget-migration-patterns)
6. [Configuration Reference](#configuration-reference)
7. [Testing & Validation](#testing--validation)
8. [Common Pitfalls](#common-pitfalls)
9. [FAQs](#faqs)

---

## Quick Start

### Prerequisites

- REPLOID installed and running
- Node.js 18+ (for MCP servers)
- Basic understanding of Web Components
- Familiarity with JSON-RPC (optional but helpful)

### 5-Minute Demo: Add GitHub MCP Server

**Step 1:** Install GitHub MCP server

```bash
cd paws/packages/reploid
npm install @modelcontextprotocol/server-github
```

**Step 2:** Add configuration to `.reploidrc.json`

```json
{
  "mcp": {
    "enabled": true,
    "servers": {
      "github": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "your_github_token_here"
        },
        "autoStart": true
      }
    }
  }
}
```

**Step 3:** Create MCPBridge module (if not exists)

```bash
cp upgrades/template-module.js upgrades/mcp-bridge.js
# Edit mcp-bridge.js following the template in Section 3
```

**Step 4:** Restart REPLOID and verify

```javascript
// Check in browser console
console.log(MCPBridge.listServers()); // ['github']
console.log(await MCPBridge.listTools('github')); // GitHub tools
```

**Step 5:** Create MWP widget for GitHub

```bash
mkdir -p widgets/mcp
touch widgets/mcp/github-widget.js
# Copy widget template from Section 3
```

**Done!** You should now see the GitHub widget in your dashboard.

---

## Understanding MWP vs REPLOID Architecture

### Side-by-Side Comparison

| Feature | REPLOID (Current) | MWP (Target) |
|---------|-------------------|--------------|
| **Widget Purpose** | Visualize internal modules | Visualize external MCP servers |
| **State Management** | Closure-based (direct access) | Event-driven (query via bridge) |
| **Communication** | Function calls | JSON-RPC over stdio/HTTP |
| **Security** | Trusted (same origin) | Sandboxed (user confirmation) |
| **Tool Discovery** | Static JSON manifests | Dynamic RPC (`tools/list`) |
| **Example Use Case** | Show ToolRunner execution stats | Show GitHub repo operations |

### Visual Architecture

**Current REPLOID:**

```
┌─────────────────────────────────────────────┐
│ Dashboard (Browser)                         │
│                                              │
│  ┌───────────┐    ┌──────────────┐         │
│  │ Widget    │◄──►│ Module       │         │
│  │ (UI)      │    │ (Logic)      │         │
│  └───────────┘    └──────────────┘         │
│       ↓ Closure         ↓ Direct call      │
│   Shared State      Internal API           │
└─────────────────────────────────────────────┘
```

**With MWP Integration:**

```
┌──────────────────────────────────────────────────────────┐
│ Dashboard (Browser)                                       │
│                                                            │
│  ┌──────────────┐          ┌─────────────────┐          │
│  │ MWP Widget   │◄────────►│ MCPBridge       │          │
│  │ (GitHub)     │  Events  │ (JSON-RPC)      │          │
│  └──────────────┘          └────────┬────────┘          │
│                                      │                    │
└──────────────────────────────────────┼────────────────────┘
                                       │ stdio/HTTP
                                       ↓
                        ┌──────────────────────────┐
                        │ MCP Server (Node.js)     │
                        │ • GitHub                 │
                        │ • Slack                  │
                        │ • REPLOID Storage        │
                        └──────────────────────────┘
```

### Key Conceptual Differences

#### REPLOID Tool Execution

```javascript
// Direct call - no network overhead
const result = await ToolRunner.runTool('read_artifact', { path: '/config.json' });
// ⚡ ~3ms latency
```

#### MCP Tool Execution

```javascript
// JSON-RPC call via bridge
const result = await MCPBridge.callTool('reploid-storage', 'read_file', { path: '/config.json' });
// ⚡ ~25ms latency (includes process spawn + serialization)
```

**Trade-off:** 8x slower, but gains isolation, reusability, and standardization.

---

## Hybrid Integration Tutorial

This section walks through adding MCP support **without changing existing REPLOID architecture**.

### Part 1: Implement MCPBridge Module

Create `upgrades/mcp-bridge.js`:

```javascript
/**
 * @fileoverview MCPBridge - JSON-RPC bridge for MCP servers
 * Implements MWP Section 6.2 (MCPBridgeInterface)
 *
 * @blueprint TBD
 * @module MCPBridge
 * @version 1.0.0
 * @category core
 */

const MCPBridge = {
  metadata: {
    id: 'MCPBridge',
    version: '1.0.0',
    dependencies: ['EventBus', 'Configuration', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { EventBus, Configuration, Utils } = deps;
    const { logger } = Utils;

    // Registry of MCP server connections
    const mcpServers = new Map();
    const serverMetadata = new Map();

    // Widget state
    let _lastActivity = null;
    let _connectionStats = { total: 0, connected: 0, failed: 0 };

    /**
     * Connect to MCP server via stdio transport
     */
    const connectStdio = async (serverName, config) => {
      logger.info(`[MCPBridge] Connecting to ${serverName} via stdio`);

      try {
        // For browser environment, we'll use a proxy approach
        // The actual stdio spawning happens in a Node.js backend
        const proxyUrl = Configuration.get('mcp.proxyUrl') || 'http://localhost:8000/mcp';

        const connection = {
          serverName,
          transport: 'stdio',
          proxyUrl,
          config,
          connected: false,
          lastError: null
        };

        // Initialize connection via proxy
        const initResponse = await fetch(`${proxyUrl}/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverName,
            command: config.command,
            args: config.args,
            env: config.env
          })
        });

        if (!initResponse.ok) {
          throw new Error(`Failed to connect: ${initResponse.statusText}`);
        }

        const initData = await initResponse.json();
        connection.connected = true;
        connection.capabilities = initData.capabilities;

        mcpServers.set(serverName, connection);
        _connectionStats.total++;
        _connectionStats.connected++;
        _lastActivity = Date.now();

        EventBus.emit('mcp:server:connected', { serverName });
        logger.info(`[MCPBridge] Connected to ${serverName}`);

        // Fetch initial data
        const tools = await listTools(serverName);
        const resources = await listResources(serverName);
        const prompts = await listPrompts(serverName);

        serverMetadata.set(serverName, {
          tools,
          resources,
          prompts,
          capabilities: connection.capabilities,
          connectedAt: Date.now()
        });

        return connection;
      } catch (error) {
        logger.error(`[MCPBridge] Failed to connect to ${serverName}:`, error);
        _connectionStats.failed++;
        EventBus.emit('mcp:server:error', { serverName, error });
        throw error;
      }
    };

    /**
     * Connect to MCP server via HTTP transport
     */
    const connectHTTP = async (serverName, config) => {
      logger.info(`[MCPBridge] Connecting to ${serverName} via HTTP`);

      try {
        const connection = {
          serverName,
          transport: 'http',
          url: config.url,
          headers: config.headers || {},
          connected: false,
          lastError: null
        };

        // Test connection with initialize request
        const initResponse = await fetch(config.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...connection.headers
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'initialize',
            params: {
              protocolVersion: '2025-03-26',
              capabilities: {},
              clientInfo: {
                name: 'REPLOID',
                version: '1.0.0'
              }
            }
          })
        });

        if (!initResponse.ok) {
          throw new Error(`HTTP ${initResponse.status}: ${initResponse.statusText}`);
        }

        const initData = await initResponse.json();
        connection.connected = true;
        connection.capabilities = initData.result?.capabilities;

        mcpServers.set(serverName, connection);
        _connectionStats.total++;
        _connectionStats.connected++;
        _lastActivity = Date.now();

        EventBus.emit('mcp:server:connected', { serverName });
        logger.info(`[MCPBridge] Connected to ${serverName}`);

        // Fetch initial data
        const tools = await listTools(serverName);
        const resources = await listResources(serverName);
        const prompts = await listPrompts(serverName);

        serverMetadata.set(serverName, {
          tools,
          resources,
          prompts,
          capabilities: connection.capabilities,
          connectedAt: Date.now()
        });

        return connection;
      } catch (error) {
        logger.error(`[MCPBridge] Failed to connect to ${serverName}:`, error);
        _connectionStats.failed++;
        EventBus.emit('mcp:server:error', { serverName, error });
        throw error;
      }
    };

    /**
     * Connect to MCP server (auto-detect transport)
     */
    const connectToServer = async (serverName, config) => {
      if (config.transport === 'stdio') {
        return await connectStdio(serverName, config);
      } else if (config.transport === 'http') {
        return await connectHTTP(serverName, config);
      } else {
        throw new Error(`Unknown transport: ${config.transport}`);
      }
    };

    /**
     * Send JSON-RPC request to MCP server
     */
    const sendRequest = async (serverName, method, params = {}) => {
      const connection = mcpServers.get(serverName);
      if (!connection) {
        throw new Error(`Server not connected: ${serverName}`);
      }

      const request = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params
      };

      try {
        let response;

        if (connection.transport === 'stdio') {
          // Send via proxy
          const proxyResponse = await fetch(`${connection.proxyUrl}/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ serverName, request })
          });

          if (!proxyResponse.ok) {
            throw new Error(`Proxy error: ${proxyResponse.statusText}`);
          }

          response = await proxyResponse.json();
        } else if (connection.transport === 'http') {
          // Send directly
          const httpResponse = await fetch(connection.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...connection.headers
            },
            body: JSON.stringify(request)
          });

          if (!httpResponse.ok) {
            throw new Error(`HTTP ${httpResponse.status}: ${httpResponse.statusText}`);
          }

          response = await httpResponse.json();
        }

        _lastActivity = Date.now();

        if (response.error) {
          throw new Error(`JSON-RPC error: ${response.error.message}`);
        }

        return response.result;
      } catch (error) {
        logger.error(`[MCPBridge] Request failed for ${serverName}.${method}:`, error);
        connection.lastError = error.message;
        throw error;
      }
    };

    /**
     * List available tools from MCP server
     */
    const listTools = async (serverName) => {
      const result = await sendRequest(serverName, 'tools/list');
      return result.tools || [];
    };

    /**
     * List available resources from MCP server
     */
    const listResources = async (serverName) => {
      const result = await sendRequest(serverName, 'resources/list');
      return result.resources || [];
    };

    /**
     * List available prompts from MCP server
     */
    const listPrompts = async (serverName) => {
      const result = await sendRequest(serverName, 'prompts/list');
      return result.prompts || [];
    };

    /**
     * Call a tool on MCP server
     */
    const callTool = async (serverName, toolName, args) => {
      logger.info(`[MCPBridge] Calling tool: ${serverName}.${toolName}`);

      EventBus.emit('mcp:tool:calling', { serverName, toolName, args });
      const startTime = Date.now();

      try {
        const result = await sendRequest(serverName, 'tools/call', {
          name: toolName,
          arguments: args
        });

        const latency = Date.now() - startTime;
        EventBus.emit('mcp:tool:result', { serverName, toolName, result, latency });

        logger.info(`[MCPBridge] Tool completed in ${latency}ms: ${serverName}.${toolName}`);
        return result;
      } catch (error) {
        EventBus.emit('mcp:tool:error', { serverName, toolName, error });
        throw error;
      }
    };

    /**
     * Read a resource from MCP server
     */
    const readResource = async (serverName, uri) => {
      logger.info(`[MCPBridge] Reading resource: ${serverName}:${uri}`);

      EventBus.emit('mcp:resource:read-requested', { serverName, uri });

      try {
        const result = await sendRequest(serverName, 'resources/read', { uri });

        EventBus.emit('mcp:resource:read', { serverName, uri, contents: result.contents });
        return result.contents;
      } catch (error) {
        EventBus.emit('mcp:resource:error', { serverName, uri, error });
        throw error;
      }
    };

    /**
     * Get a prompt from MCP server
     */
    const getPrompt = async (serverName, promptName, args) => {
      logger.info(`[MCPBridge] Getting prompt: ${serverName}.${promptName}`);

      EventBus.emit('mcp:prompt:invoke-requested', { serverName, promptName, args });

      try {
        const result = await sendRequest(serverName, 'prompts/get', {
          name: promptName,
          arguments: args
        });

        EventBus.emit('mcp:prompt:result', { serverName, promptName, messages: result.messages });
        return result.messages;
      } catch (error) {
        EventBus.emit('mcp:prompt:error', { serverName, promptName, error });
        throw error;
      }
    };

    /**
     * Subscribe to resource updates
     */
    const subscribeToResource = (serverName, uri, callback) => {
      const eventName = `mcp:resource:updated:${serverName}:${uri}`;

      EventBus.on(eventName, callback);

      // Send subscription request
      sendRequest(serverName, 'resources/subscribe', { uri })
        .catch(error => {
          logger.warn(`[MCPBridge] Subscription failed for ${uri}:`, error);
        });

      // Return unsubscribe function
      return () => {
        EventBus.off(eventName, callback);
        sendRequest(serverName, 'resources/unsubscribe', { uri })
          .catch(error => {
            logger.warn(`[MCPBridge] Unsubscribe failed for ${uri}:`, error);
          });
      };
    };

    /**
     * Get server connection
     */
    const getServer = (serverName) => {
      return mcpServers.get(serverName);
    };

    /**
     * Check if server is connected
     */
    const isConnected = (serverName) => {
      const connection = mcpServers.get(serverName);
      return connection?.connected === true;
    };

    /**
     * List all connected servers
     */
    const listServers = () => {
      return Array.from(mcpServers.keys());
    };

    /**
     * Get server metadata (tools, resources, prompts)
     */
    const getServerMetadata = (serverName) => {
      return serverMetadata.get(serverName);
    };

    /**
     * Initialize - connect to all configured servers
     */
    const init = async () => {
      logger.info('[MCPBridge] Initializing MCP connections');

      const mcpConfig = Configuration.get('mcp');
      if (!mcpConfig?.enabled) {
        logger.info('[MCPBridge] MCP disabled in configuration');
        return;
      }

      const servers = mcpConfig.servers || {};

      for (const [serverName, config] of Object.entries(servers)) {
        if (config.autoStart !== false) {
          try {
            await connectToServer(serverName, config);
          } catch (error) {
            logger.error(`[MCPBridge] Failed to auto-start ${serverName}:`, error);
          }
        }
      }

      logger.info(`[MCPBridge] Connected to ${_connectionStats.connected} servers`);
    };

    // Auto-initialize if configured
    if (Configuration.get('mcp.enabled')) {
      init().catch(error => {
        logger.error('[MCPBridge] Initialization failed:', error);
      });
    }

    // Web Component Widget
    class MCPBridgeWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        return {
          state: _connectionStats.connected > 0 ? 'active' : 'idle',
          primaryMetric: `${_connectionStats.connected}/${_connectionStats.total} servers`,
          secondaryMetric: _connectionStats.failed > 0 ? `${_connectionStats.failed} failed` : 'OK',
          lastActivity: _lastActivity,
          message: null
        };
      }

      render() {
        const servers = Array.from(mcpServers.entries());

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }
            .bridge-panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 8px;
              border-left: 3px solid #2196f3;
            }
            h3 {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #2196f3;
            }
            .server-list {
              margin-top: 12px;
            }
            .server {
              padding: 8px;
              margin-bottom: 8px;
              background: rgba(0, 0, 0, 0.3);
              border-radius: 4px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .server-name {
              font-weight: bold;
            }
            .status {
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 10px;
            }
            .status.connected {
              background: #4caf50;
              color: #000;
            }
            .status.disconnected {
              background: #f44336;
              color: #fff;
            }
            .stats {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
              color: #888;
            }
          </style>

          <div class="bridge-panel">
            <h3>🌉 MCP Bridge</h3>

            <div class="stats">
              Total Servers: ${_connectionStats.total} |
              Connected: ${_connectionStats.connected} |
              Failed: ${_connectionStats.failed}
            </div>

            <div class="server-list">
              ${servers.length === 0 ? '<div style="color: #666;">No servers configured</div>' : ''}
              ${servers.map(([name, conn]) => {
                const metadata = serverMetadata.get(name);
                return `
                  <div class="server">
                    <div>
                      <div class="server-name">${name}</div>
                      <div style="font-size: 10px; color: #666;">
                        ${metadata ? `${metadata.tools.length} tools, ${metadata.resources.length} resources` : 'Loading...'}
                      </div>
                    </div>
                    <div class="status ${conn.connected ? 'connected' : 'disconnected'}">
                      ${conn.connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'mcp-bridge-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, MCPBridgeWidget);
    }

    return {
      // MCPBridgeInterface implementation
      getServer,
      listServers,
      isConnected,
      callTool,
      readResource,
      getPrompt,
      listTools,
      listResources,
      listPrompts,
      subscribeToResource,

      // Additional methods
      connectToServer,
      getServerMetadata,
      init,

      // Widget
      widget: {
        element: elementName,
        displayName: 'MCP Bridge',
        icon: '🌉',
        category: 'core'
      }
    };
  }
};

export default MCPBridge;
```

**Register in module manifest:**

Add to `upgrades/module-manifest.json`:

```json
{
  "modules": [
    "/upgrades/mcp-bridge.js",
    ...
  ]
}
```

### Part 2: Create GitHub MWP Widget

Create `widgets/mcp/github-widget.js`:

```javascript
/**
 * GitHub MCP Widget (MWP-compliant)
 *
 * Visualizes GitHub MCP server tools and resources
 */

export default function createMCPWidget(
  { EventBus, MCPBridge, Configuration },
  mcpServerInfo
) {
  const { serverName, tools, resources } = mcpServerInfo;

  class GitHubMCPWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._tools = tools;
      this._resources = resources;
      this._selectedTool = null;
    }

    connectedCallback() {
      this.render();

      // Listen for MCP events
      this._boundRefresh = () => this.refresh();
      EventBus.on(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    disconnectedCallback() {
      EventBus.off(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    async refresh() {
      // Re-fetch tools and resources
      this._tools = await MCPBridge.listTools(serverName);
      this._resources = await MCPBridge.listResources(serverName);
      this.render();
    }

    getStatus() {
      const isConnected = MCPBridge.isConnected(serverName);
      return {
        state: isConnected ? 'active' : 'error',
        primaryMetric: `${this._tools.length} tools`,
        secondaryMetric: `${this._resources.length} resources`,
        lastActivity: Date.now(),
        message: isConnected ? null : 'Server disconnected'
      };
    }

    getMCPInfo() {
      return {
        serverName,
        availableTools: this._tools.length,
        availableResources: this._resources.length,
        availablePrompts: 0,
        connectionState: MCPBridge.isConnected(serverName) ? 'connected' : 'disconnected',
        lastError: null
      };
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: monospace;
            font-size: 12px;
            color: #e0e0e0;
          }
          .panel {
            padding: 16px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 8px;
            border-left: 3px solid #ff9800;
          }
          h3 {
            margin: 0 0 12px 0;
            color: #ff9800;
          }
          .section {
            margin-bottom: 16px;
          }
          .section-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: #ccc;
          }
          .tool {
            padding: 8px;
            margin-bottom: 4px;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            cursor: pointer;
          }
          .tool:hover {
            background: rgba(255, 152, 0, 0.2);
          }
          .tool-name {
            font-weight: bold;
            color: #ff9800;
          }
          .tool-desc {
            font-size: 11px;
            color: #888;
            margin-top: 4px;
          }
          button {
            padding: 8px 16px;
            background: #ff9800;
            color: #000;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-family: monospace;
          }
          button:hover {
            background: #ffa726;
          }
        </style>

        <div class="panel">
          <h3>🐙 GitHub MCP Server</h3>

          <div class="section">
            <div class="section-title">Available Tools (${this._tools.length})</div>
            ${this._tools.map(tool => `
              <div class="tool" data-tool="${tool.name}">
                <div class="tool-name">${tool.name}</div>
                <div class="tool-desc">${tool.description}</div>
              </div>
            `).join('')}
          </div>

          ${this._resources.length > 0 ? `
            <div class="section">
              <div class="section-title">Resources (${this._resources.length})</div>
              ${this._resources.slice(0, 5).map(resource => `
                <div style="padding: 4px; font-size: 11px; color: #666;">
                  📄 ${resource.name}
                </div>
              `).join('')}
            </div>
          ` : ''}

          <button id="refresh-btn">Refresh Data</button>
        </div>
      `;

      // Attach event listeners
      this.shadowRoot.querySelectorAll('.tool').forEach(toolEl => {
        toolEl.addEventListener('click', () => {
          const toolName = toolEl.dataset.tool;
          this.invokeTool(toolName);
        });
      });

      this.shadowRoot.getElementById('refresh-btn').addEventListener('click', () => {
        this.refresh();
      });
    }

    invokeTool(toolName) {
      // Emit event - host will handle confirmation and execution
      EventBus.emit('mcp:tool:invoke-requested', {
        serverName,
        toolName,
        args: {} // In real implementation, show form to collect args
      });
    }
  }

  // Register custom element
  const elementName = `mcp-${serverName}-widget`;
  if (!customElements.get(elementName)) {
    customElements.define(elementName, GitHubMCPWidget);
  }

  return {
    api: {
      async initialize() {
        // Setup subscriptions if needed
      },
      async destroy() {
        // Cleanup
      },
      async refresh() {
        const element = document.querySelector(elementName);
        if (element) await element.refresh();
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: elementName,
      displayName: `${serverName} Server`,
      icon: '🐙',
      category: 'MCP Servers',
      mcpServerName: serverName,
      transport: mcpServerInfo.transport,
      mcpProtocolVersion: mcpServerInfo.protocolVersion,
      capabilities: {
        tools: tools.length > 0,
        resources: resources.length > 0,
        prompts: false,
        sampling: false
      },
      widgetType: 'server-panel',
      priority: 0
    }
  };
}
```

### Part 3: Load MCP Widgets in UIManager

Update `upgrades/ui-manager.js`:

```javascript
// Add to UIManager.factory()

const loadMCPWidgets = async () => {
  const mcpConfig = Configuration.get('mcp');
  if (!mcpConfig?.enabled) return;

  const mcpContainer = document.getElementById('mcp-widgets-container');
  if (!mcpContainer) {
    logger.warn('[UIManager] MCP widgets container not found');
    return;
  }

  for (const serverName of MCPBridge.listServers()) {
    try {
      const metadata = MCPBridge.getServerMetadata(serverName);
      if (!metadata) continue;

      const mcpServerInfo = {
        serverName,
        transport: MCPBridge.getServer(serverName).transport,
        protocolVersion: '2025-03-26',
        capabilities: metadata.capabilities,
        tools: metadata.tools,
        resources: metadata.resources,
        prompts: metadata.prompts
      };

      // Load widget
      const widgetPath = `/widgets/mcp/${serverName}-widget.js`;
      const widgetModule = await import(widgetPath);
      const createWidget = widgetModule.default;

      // Create widget instance
      const widget = createWidget(
        { EventBus, MCPBridge, Configuration },
        mcpServerInfo
      );

      // Create element
      const element = document.createElement(widget.widget.element);
      mcpContainer.appendChild(element);

      logger.info(`[UIManager] Loaded MCP widget: ${serverName}`);
    } catch (error) {
      logger.error(`[UIManager] Failed to load MCP widget for ${serverName}:`, error);
    }
  }
};

// Call during init
const init = async () => {
  // ... existing init code ...

  // Load MCP widgets
  await loadMCPWidgets();
};
```

---

## Converting Upgrades to MCP Servers

### Example: Storage Module → MCP Server

This section demonstrates converting REPLOID's Storage module into a standalone MCP server.

**Step 1:** Create MCP server package

```bash
mkdir -p mcp-servers/storage-server
cd mcp-servers/storage-server
npm init -y
npm install @modelcontextprotocol/sdk
```

**Step 2:** Create server implementation

`mcp-servers/storage-server/index.js`:

```javascript
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import fs from 'fs/promises';
import path from 'path';

const STORAGE_DIR = process.env.REPLOID_STORAGE_DIR || './reploid-storage';

// Initialize storage directory
await fs.mkdir(STORAGE_DIR, { recursive: true });

const server = new Server(
  {
    name: 'reploid-storage',
    version: '1.0.0'
  },
  {
    capabilities: {
      resources: {},
      tools: {}
    }
  }
);

// Helper: Get MIME type
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const mimeTypes = {
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.html': 'text/html',
    '.css': 'text/css',
    '.txt': 'text/plain'
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Implement resources/list
server.setRequestHandler('resources/list', async () => {
  const files = await fs.readdir(STORAGE_DIR, { recursive: true });

  const resources = [];
  for (const file of files) {
    const fullPath = path.join(STORAGE_DIR, file);
    const stats = await fs.stat(fullPath);

    if (stats.isFile()) {
      resources.push({
        uri: `file:///${file}`,
        name: `/${file}`,
        mimeType: getMimeType(file)
      });
    }
  }

  return { resources };
});

// Implement resources/read
server.setRequestHandler('resources/read', async (request) => {
  const uri = new URL(request.params.uri);
  const filePath = path.join(STORAGE_DIR, uri.pathname);

  try {
    const content = await fs.readFile(filePath, 'utf-8');

    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: getMimeType(filePath),
          text: content
        }
      ]
    };
  } catch (error) {
    throw new Error(`Failed to read file: ${error.message}`);
  }
});

// Implement tools/list
server.setRequestHandler('tools/list', async () => ({
  tools: [
    {
      name: 'write_file',
      description: 'Write content to VFS file',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path (e.g., /modules/utils.js)'
          },
          content: {
            type: 'string',
            description: 'File content'
          }
        },
        required: ['path', 'content']
      }
    },
    {
      name: 'delete_file',
      description: 'Delete file from VFS',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'File path to delete'
          }
        },
        required: ['path']
      }
    },
    {
      name: 'list_files',
      description: 'List all files in VFS directory',
      inputSchema: {
        type: 'object',
        properties: {
          directory: {
            type: 'string',
            description: 'Directory path (default: /)',
            default: '/'
          }
        }
      }
    }
  ]
}));

// Implement tools/call
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'write_file': {
      const filePath = path.join(STORAGE_DIR, args.path);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, args.content, 'utf-8');

      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote ${args.content.length} bytes to ${args.path}`
          }
        ]
      };
    }

    case 'delete_file': {
      const filePath = path.join(STORAGE_DIR, args.path);
      await fs.unlink(filePath);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted ${args.path}`
          }
        ]
      };
    }

    case 'list_files': {
      const dir = args.directory || '/';
      const dirPath = path.join(STORAGE_DIR, dir);
      const files = await fs.readdir(dirPath, { withFileTypes: true });

      const listing = files.map((f) => ({
        name: f.name,
        type: f.isDirectory() ? 'directory' : 'file'
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(listing, null, 2)
          }
        ]
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);

console.error('REPLOID Storage MCP Server running on stdio');
```

**Step 3:** Update package.json

```json
{
  "name": "@reploid/storage-server",
  "version": "1.0.0",
  "type": "module",
  "bin": {
    "reploid-storage-server": "./index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0"
  }
}
```

**Step 4:** Configure in REPLOID

`.reploidrc.json`:

```json
{
  "mcp": {
    "enabled": true,
    "servers": {
      "reploid-storage": {
        "transport": "stdio",
        "command": "node",
        "args": ["./mcp-servers/storage-server/index.js"],
        "env": {
          "REPLOID_STORAGE_DIR": "./storage"
        },
        "autoStart": true
      }
    }
  }
}
```

**Step 5:** Test

```javascript
// In browser console
const tools = await MCPBridge.listTools('reploid-storage');
console.log(tools); // ['write_file', 'delete_file', 'list_files']

const result = await MCPBridge.callTool('reploid-storage', 'write_file', {
  path: '/test.txt',
  content: 'Hello from MCP!'
});
console.log(result); // { content: [{ type: 'text', text: 'Successfully wrote...' }] }
```

---

## Widget Migration Patterns

### Pattern 1: Closure State → Event-Driven Queries

**Before (REPLOID style):**

```javascript
const ToolRunner = {
  factory: (deps) => {
    let _executionStats = { total: 0, success: 0, error: 0 };

    class ToolRunnerWidget extends HTMLElement {
      getStatus() {
        // Direct closure access
        return {
          state: 'active',
          primaryMetric: `${_executionStats.total} executions`
        };
      }
    }

    return { api: { runTool }, widget: { element: 'tool-runner-widget' } };
  }
};
```

**After (MWP style):**

```javascript
export default function createMCPWidget({ EventBus, MCPBridge }, mcpServerInfo) {
  class ToolRunnerWidget extends HTMLElement {
    getStatus() {
      // Query via MCPBridge instead of closure
      const stats = MCPBridge.getServerStats(mcpServerInfo.serverName);
      return {
        state: 'active',
        primaryMetric: `${stats.totalCalls} executions`
      };
    }
  }

  return {
    api: { initialize, destroy },
    widget: {
      element: 'tool-runner-widget',
      mcpServerName: mcpServerInfo.serverName,
      transport: mcpServerInfo.transport
    }
  };
}
```

### Pattern 2: Direct Function Calls → Event Emission

**Before:**

```javascript
executeTool(name, args) {
  // Direct call
  ToolRunner.runTool(name, args);
}
```

**After:**

```javascript
executeTool(name, args) {
  // Emit event for host to handle
  EventBus.emit('mcp:tool:invoke-requested', {
    serverName: mcpServerInfo.serverName,
    toolName: name,
    args
  });
}
```

### Pattern 3: Generic Events → Namespaced MCP Events

**Before:**

```javascript
EventBus.on('tool:complete', (data) => {
  // Handle completion
});
```

**After:**

```javascript
EventBus.on('mcp:tool:result', (data) => {
  if (data.serverName === mcpServerInfo.serverName) {
    // Handle completion for this specific MCP server
  }
});
```

---

## Configuration Reference

### Complete .reploidrc.json Example

```json
{
  "version": "1.0",
  "api": {
    "provider": "local",
    "localEndpoint": "http://localhost:11434",
    "timeout": 180000,
    "maxRetries": 3
  },
  "mcp": {
    "enabled": true,
    "proxyUrl": "http://localhost:8000/mcp",
    "defaultTransport": "stdio",
    "pollingInterval": 5000,
    "confirmToolCalls": true,
    "servers": {
      "github": {
        "transport": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_TOKEN": "${GITHUB_TOKEN}"
        },
        "autoStart": true
      },
      "slack": {
        "transport": "http",
        "url": "http://localhost:3000/mcp",
        "headers": {
          "Authorization": "Bearer ${SLACK_TOKEN}"
        },
        "autoStart": true
      },
      "reploid-storage": {
        "transport": "stdio",
        "command": "node",
        "args": ["./mcp-servers/storage-server/index.js"],
        "env": {
          "REPLOID_STORAGE_DIR": "./storage"
        },
        "autoStart": true
      }
    }
  },
  "widgets": {
    "mcp": {
      "enabled": true,
      "directory": "./widgets/mcp",
      "autoLoad": true
    }
  }
}
```

---

## Testing & Validation

### Unit Testing MCPBridge

```javascript
// test/mcp-bridge.test.js
import { expect } from 'chai';
import MCPBridge from '../upgrades/mcp-bridge.js';

describe('MCPBridge', () => {
  let bridge;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: sinon.spy(),
      on: sinon.spy(),
      off: sinon.spy()
    };

    const mockConfig = {
      get: (key) => {
        if (key === 'mcp.enabled') return true;
        if (key === 'mcp.servers') return {};
        return null;
      }
    };

    bridge = MCPBridge.factory({
      EventBus: mockEventBus,
      Configuration: mockConfig,
      Utils: { logger: console }
    });
  });

  it('should list connected servers', () => {
    const servers = bridge.listServers();
    expect(servers).to.be.an('array');
  });

  it('should emit event on tool call', async () => {
    // Test implementation
  });
});
```

### Integration Testing with Real MCP Server

```javascript
// test/integration/github-mcp.test.js
describe('GitHub MCP Integration', () => {
  it('should list GitHub tools', async () => {
    const tools = await MCPBridge.listTools('github');
    expect(tools).to.include.members([
      'create_issue',
      'create_pull_request',
      'search_repositories'
    ]);
  });

  it('should call create_issue tool', async () => {
    const result = await MCPBridge.callTool('github', 'create_issue', {
      owner: 'test-org',
      repo: 'test-repo',
      title: 'Test Issue',
      body: 'This is a test'
    });

    expect(result).to.have.property('content');
    expect(result.content[0].type).to.equal('text');
  });
});
```

---

## Common Pitfalls

### Pitfall 1: Forgetting Event Namespaces

**Wrong:**

```javascript
EventBus.emit('tool:start', { toolName, args }); // REPLOID event
```

**Correct:**

```javascript
EventBus.emit('mcp:tool:calling', { serverName, toolName, args }); // MCP event
```

### Pitfall 2: Direct MCPBridge Calls from Widgets

**Wrong:**

```javascript
class MyWidget extends HTMLElement {
  async onClick() {
    // Direct call bypasses security confirmation
    await MCPBridge.callTool('github', 'create_issue', args); // ❌
  }
}
```

**Correct:**

```javascript
class MyWidget extends HTMLElement {
  onClick() {
    // Emit event, host handles confirmation
    EventBus.emit('mcp:tool:invoke-requested', {
      serverName: 'github',
      toolName: 'create_issue',
      args
    }); // ✅
  }
}
```

### Pitfall 3: Missing MCP Server Info Fields

**Wrong:**

```javascript
return {
  widget: {
    element: 'my-widget',
    displayName: 'My Widget',
    category: 'MCP Servers'
    // Missing: mcpServerName, transport, mcpProtocolVersion
  }
};
```

**Correct:**

```javascript
return {
  widget: {
    protocolVersion: '1.0.0', // ✅
    element: 'my-widget',
    displayName: 'My Widget',
    category: 'MCP Servers',
    mcpServerName: mcpServerInfo.serverName, // ✅
    transport: mcpServerInfo.transport, // ✅
    mcpProtocolVersion: mcpServerInfo.protocolVersion, // ✅
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
      sampling: false
    }
  }
};
```

---

## FAQs

**Q: Can I use both ModuleWidgetProtocol and MWP in the same dashboard?**

A: Yes! That's the recommended hybrid approach. Keep internal REPLOID modules using ModuleWidgetProtocol, and use MWP for external MCP servers.

**Q: What's the performance difference between in-process tools and MCP tools?**

A: MCP tools add ~20-50ms latency due to JSON-RPC serialization and process communication. For non-critical paths, this is acceptable. Keep hot-path tools (frequent reads, searches) in-process.

**Q: Do I need a Node.js backend to use MCP servers?**

A: For stdio transport, yes. You'll need a proxy server to spawn and communicate with MCP server processes. For HTTP transport, you can connect directly from the browser.

**Q: Can REPLOID widgets be used outside of REPLOID?**

A: No, REPLOID widgets are tightly coupled to REPLOID's DI container. However, MWP widgets can be used in any MWP-compliant dashboard (once you implement MCPBridge).

**Q: How do I debug JSON-RPC communication?**

A: Enable debug logging in MCPBridge and use browser DevTools Network tab. MCP SDK also provides debugging tools.

**Q: Can I convert all REPLOID upgrades to MCP servers?**

A: Technically yes, but not recommended. UI modules and core infrastructure should stay in-process. Only convert modules that provide reusable data/tools.

**Q: Is MWP compatible with Anthropic's mcp-ui?**

A: They serve different purposes. mcp-ui is Anthropic's reference UI for MCP servers. MWP is a widget protocol specification. You could theoretically adapt MWP widgets to work with mcp-ui, but they're designed for different architectures.

---

**End of Guide**

For more information:
- See `MWP_INTEGRATION_ANALYSIS.md` for architectural analysis
- See `MWP_ADAPTER_SPEC.ts` for TypeScript definitions
- See `mwp/MWP.md` for full MWP specification
- See REPLOID blueprints in `blueprints/` for module details
