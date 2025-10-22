/**
 * @mwp/mcp-ui-adapter
 *
 * Adapter to run MWP widgets in mcp-ui's iframe environment.
 * This enables MWP widgets to work with the existing mcp-ui ecosystem.
 *
 * @packageDocumentation
 */

import type { types } from '@mwp/core';

type WidgetFactory = types.WidgetFactory;
type Dependencies = types.Dependencies;
type MCPServerInfo = types.MCPServerInfo;

/**
 * Adapter configuration
 */
export interface AdapterConfig {
  /**
   * Base URL for loading widget bundles
   */
  baseUrl?: string;

  /**
   * Whether to inject CSS for theming
   */
  injectTheme?: boolean;

  /**
   * Custom theme CSS variables
   */
  theme?: Record<string, string>;
}

/**
 * Convert an MWP widget factory to mcp-ui compatible HTML
 *
 * @param widgetFactory - The MWP widget factory function
 * @param serverInfo - MCP server information
 * @param config - Adapter configuration
 * @returns HTML string that can be loaded in an iframe by mcp-ui
 *
 * @example
 * ```typescript
 * import createGitHubWidget from '@mwp/widget-github';
 * import { adaptMWPForMcpUI } from '@mwp/mcp-ui-adapter';
 *
 * const html = adaptMWPForMcpUI(
 *   createGitHubWidget,
 *   { serverName: 'github', capabilities: { tools: true } },
 *   { injectTheme: true }
 * );
 *
 * // html can now be served to mcp-ui's iframe
 * ```
 */
export function adaptMWPForMcpUI(
  widgetFactory: (deps: Dependencies, info: MCPServerInfo) => WidgetFactory,
  serverInfo: MCPServerInfo,
  config: AdapterConfig = {}
): string {
  const { baseUrl = '', injectTheme = true, theme = {} } = config;

  // Generate CSS custom properties from theme
  const themeCSS = Object.entries(theme)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MWP Widget - ${serverInfo.serverName}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    ${injectTheme ? `
    :root {
      /* Default theme */
      --mwp-bg-primary: #ffffff;
      --mwp-bg-secondary: #f5f5f5;
      --mwp-text-primary: #000000;
      --mwp-text-secondary: #666666;
      --mwp-border: #e0e0e0;
      --mwp-accent: #0066cc;
      --mwp-error: #d32f2f;
      --mwp-success: #388e3c;

      /* User overrides */
${themeCSS}
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --mwp-bg-primary: #1e1e1e;
        --mwp-bg-secondary: #2d2d2d;
        --mwp-text-primary: #ffffff;
        --mwp-text-secondary: #b0b0b0;
        --mwp-border: #404040;
      }
    }
    ` : ''}

    html, body {
      width: 100%;
      height: 100%;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--mwp-bg-primary, #ffffff);
      color: var(--mwp-text-primary, #000000);
    }

    #widget-container {
      width: 100%;
      height: 100%;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 14px;
      color: var(--mwp-text-secondary, #666666);
    }

    .error {
      padding: 20px;
      color: var(--mwp-error, #d32f2f);
      border: 1px solid var(--mwp-error, #d32f2f);
      border-radius: 4px;
      margin: 20px;
      background: var(--mwp-bg-secondary, #f5f5f5);
    }
  </style>
</head>
<body>
  <div id="widget-container">
    <div class="loading">Loading widget...</div>
  </div>

  <script type="module">
    // mcp-ui Bridge Adapter
    // This creates MWP-compatible APIs from mcp-ui's postMessage interface

    class McpUIEventBusAdapter {
      constructor() {
        this.listeners = new Map();
        this.eventId = 0;

        // Listen for events from mcp-ui parent
        window.addEventListener('message', (event) => {
          if (event.data.type?.startsWith('mcp:')) {
            this.emit(event.data.type, event.data.payload);
          }
        });
      }

      on(eventName, handler) {
        if (!this.listeners.has(eventName)) {
          this.listeners.set(eventName, new Set());
        }
        this.listeners.get(eventName).add(handler);

        return () => {
          this.listeners.get(eventName)?.delete(handler);
        };
      }

      emit(eventName, payload) {
        const handlers = this.listeners.get(eventName);
        if (handlers) {
          handlers.forEach(handler => {
            try {
              handler(payload);
            } catch (error) {
              console.error('Event handler error:', error);
            }
          });
        }

        // Forward to parent mcp-ui
        window.parent.postMessage({
          type: eventName,
          payload
        }, '*');
      }
    }

    class McpUIBridgeAdapter {
      constructor(serverName) {
        this.serverName = serverName;
        this.requestId = 0;
        this.pendingRequests = new Map();

        // Listen for responses from mcp-ui parent
        window.addEventListener('message', (event) => {
          if (event.data.type === 'mcp:response') {
            const { requestId, result, error } = event.data;
            const pending = this.pendingRequests.get(requestId);
            if (pending) {
              this.pendingRequests.delete(requestId);
              if (error) {
                pending.reject(new Error(error.message || 'Tool execution failed'));
              } else {
                pending.resolve(result);
              }
            }
          }
        });
      }

      async callTool(serverName, toolName, args) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          // Request tool execution from mcp-ui parent
          window.parent.postMessage({
            type: 'mcp:tool:invoke',
            requestId,
            serverName,
            toolName,
            arguments: args
          }, '*');

          // Timeout after 30 seconds
          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('Tool execution timeout'));
            }
          }, 30000);
        });
      }

      async listTools(serverName) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type: 'mcp:tools:list',
            requestId,
            serverName
          }, '*');

          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('List tools timeout'));
            }
          }, 10000);
        });
      }

      async listResources(serverName) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type: 'mcp:resources:list',
            requestId,
            serverName
          }, '*');

          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('List resources timeout'));
            }
          }, 10000);
        });
      }

      async readResource(serverName, uri) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type: 'mcp:resource:read',
            requestId,
            serverName,
            uri
          }, '*');

          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('Read resource timeout'));
            }
          }, 10000);
        });
      }

      async listPrompts(serverName) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type: 'mcp:prompts:list',
            requestId,
            serverName
          }, '*');

          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('List prompts timeout'));
            }
          }, 10000);
        });
      }

      async getPrompt(serverName, name, args) {
        const requestId = ++this.requestId;

        return new Promise((resolve, reject) => {
          this.pendingRequests.set(requestId, { resolve, reject });

          window.parent.postMessage({
            type: 'mcp:prompt:get',
            requestId,
            serverName,
            name,
            arguments: args
          }, '*');

          setTimeout(() => {
            if (this.pendingRequests.has(requestId)) {
              this.pendingRequests.delete(requestId);
              reject(new Error('Get prompt timeout'));
            }
          }, 10000);
        });
      }
    }

    // Configuration stub
    const Configuration = {
      get(key) {
        return localStorage.getItem(\`mwp:\${key}\`);
      },
      set(key, value) {
        localStorage.setItem(\`mwp:\${key}\`, value);
      }
    };

    // Initialize widget
    async function initWidget() {
      try {
        const container = document.getElementById('widget-container');
        const serverInfo = ${JSON.stringify(serverInfo)};

        // Create MWP-compatible dependencies from mcp-ui environment
        const eventBus = new McpUIEventBusAdapter();
        const bridge = new McpUIBridgeAdapter(serverInfo.serverName);

        const dependencies = {
          EventBus: class { constructor() { return eventBus; } },
          MCPBridge: class { constructor() { return bridge; } },
          Configuration
        };

        // Load widget factory (in real implementation, this would be loaded dynamically)
        // For now, assume widget bundle is loaded globally
        if (typeof window.createMWPWidget !== 'function') {
          throw new Error('Widget factory not found. Ensure widget bundle is loaded.');
        }

        const widgetFactory = window.createMWPWidget(dependencies, serverInfo);

        // Create and mount widget element
        const widgetElement = document.createElement(widgetFactory.widget.element);
        container.innerHTML = '';
        container.appendChild(widgetElement);

        // Initialize widget
        await widgetFactory.api.initialize();

        // Notify parent that widget is ready
        window.parent.postMessage({
          type: 'mwp:widget:ready',
          widget: widgetFactory.widget
        }, '*');

      } catch (error) {
        console.error('Widget initialization failed:', error);
        document.getElementById('widget-container').innerHTML = \`
          <div class="error">
            <strong>Failed to load widget</strong><br>
            \${error.message}
          </div>
        \`;
      }
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initWidget);
    } else {
      initWidget();
    }
  </script>
</body>
</html>
  `.trim();

  return html;
}

/**
 * Create a data URL for the adapted HTML
 * This can be used directly as iframe src
 *
 * @param widgetFactory - The MWP widget factory
 * @param serverInfo - MCP server information
 * @param config - Adapter configuration
 * @returns Data URL string
 */
export function createIframeDataURL(
  widgetFactory: (deps: Dependencies, info: MCPServerInfo) => WidgetFactory,
  serverInfo: MCPServerInfo,
  config?: AdapterConfig
): string {
  const html = adaptMWPForMcpUI(widgetFactory, serverInfo, config);
  const base64 = btoa(unescape(encodeURIComponent(html)));
  return `data:text/html;base64,${base64}`;
}

/**
 * Package version
 */
export const VERSION = '1.0.0';
