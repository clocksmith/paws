/**
 * Playwright Widget Factory
 *
 * Creates Playwright MCP widget for browser automation.
 */

import type { types } from '@mwp/core';

type WidgetFactoryFunction = types.WidgetFactoryFunction;
type WidgetFactory = types.WidgetFactory;
type Dependencies = types.Dependencies;
type MCPServerInfo = types.MCPServerInfo;
import { PlaywrightWidget } from './widget.js';

/**
 * Create Playwright Widget
 *
 * Factory function that creates a Playwright widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Playwright MCP server information
 * @returns Widget factory with API and metadata
 */
const createPlaywrightWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('playwright-mcp-widget')) {
    customElements.define('playwright-mcp-widget', PlaywrightWidget);
  }

  // Create widget element
  const widget = document.createElement(
    'playwright-mcp-widget'
  ) as PlaywrightWidget;

  // Inject dependencies
  widget.setDependencies(EventBus, MCPBridge, Configuration);
  widget.setServerInfo(mcpServerInfo);

  // Return widget factory
  return {
    api: {
      /**
       * Initialize the widget
       */
      async initialize(): Promise<void> {
        await widget.initialize();
      },

      /**
       * Destroy the widget
       */
      async destroy(): Promise<void> {
        await widget.destroy();
      },

      /**
       * Refresh the widget
       */
      async refresh(): Promise<void> {
        await widget.refresh();
      },

      /**
       * Get widget status
       */
      getStatus() {
        return widget.getStatus();
      },

      /**
       * Get resource usage
       */
      getResourceUsage() {
        return widget.getResourceUsage();
      },
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'playwright-mcp-widget',
      displayName: 'Playwright',
      description: 'Browser automation and testing',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      tags: ['playwright', 'browser', 'automation', 'testing', 'screenshots'],
      version: '1.0.0',
      author: {
        name: 'MWP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: [
            'playwright_navigate',
            'playwright_screenshot',
            'playwright_click',
            'playwright_fill',
            'playwright_select',
            'playwright_hover',
            'playwright_evaluate',
            'playwright_*',
          ],
        },
      },
    },
  };
};

export default createPlaywrightWidget;
export type { PlaywrightWidgetConfig } from './types.js';
