## 13. Example Implementation (Informative)

### 14.1 GitHub MCP Widget Example

```javascript
// widgets/github-mcp-widget/index.js

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
      this._selectedTool = null;
    }

    connectedCallback() {
      this.render();
      this._boundRefresh = () => this.refresh();
      EventBus.on(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    disconnectedCallback() {
      EventBus.off(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    async refresh() {
      this._tools = await MCPBridge.listTools(serverName);
      this.render();
    }

    getStatus() {
      const isConnected = MCPBridge.isConnected(serverName);
      return {
        state: isConnected ? 'active' : 'error',
        primaryMetric: `${this._tools.length} tools`,
        secondaryMetric: mcpServerInfo.transport,
        lastActivity: null,
        message: isConnected ? null : 'Server disconnected'
      };
    }

    getMCPInfo() {
      return {
        serverName,
        availableTools: this._tools.length,
        availableResources: resources.length,
        availablePrompts: 0,
        connectionState: MCPBridge.isConnected(serverName) ? 'connected' : 'disconnected',
        lastError: null
      };
    }

    render() {
      this.shadowRoot.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; font-family: monospace; }
        .panel { padding: 16px; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; }
        .tool { padding: 8px; margin: 4px 0; background: #2d2d2d; cursor: pointer; }
        .tool:hover { background: #3d3d3d; }
        button { padding: 8px 16px; margin-top: 8px; }
      `;

      const panel = document.createElement('div');
      panel.className = 'panel';

      const title = document.createElement('h3');
      title.textContent = `🔧 ${serverName} MCP Server`;
      panel.appendChild(title);

      const toolList = document.createElement('div');
      for (const tool of this._tools) {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool';

        const toolName = document.createElement('strong');
        toolName.textContent = tool.name;

        const toolDesc = document.createElement('p');
        toolDesc.textContent = tool.description;

        toolDiv.appendChild(toolName);
        toolDiv.appendChild(toolDesc);

        toolDiv.onclick = () => {
          this._selectedTool = tool;
          this.showToolForm(tool);
        };

        toolList.appendChild(toolDiv);
      }
      panel.appendChild(toolList);

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(panel);
    }

    showToolForm(tool) {
      // Generate form from tool.inputSchema (JSON Schema)
      // For brevity, simplified example
      const form = document.createElement('div');

      const formTitle = document.createElement('h4');
      formTitle.textContent = `Invoke: ${tool.name}`;
      form.appendChild(formTitle);

      const invokeBtn = document.createElement('button');
      invokeBtn.textContent = 'Invoke Tool';
      invokeBtn.onclick = () => {
        // Emit event for host to handle (with confirmation dialog)
        EventBus.emit('mcp:tool:invoke-requested', {
          serverName,
          toolName: tool.name,
          args: {} // Extract from form inputs
        });
      };
      form.appendChild(invokeBtn);

      this.shadowRoot.querySelector('.panel').appendChild(form);
    }
  }

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
      icon: '🔧',
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

---
