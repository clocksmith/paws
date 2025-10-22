/**
 * Fetch Widget Factory
 *
 * Creates Fetch MCP widget for web content fetching.
 */

import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { FetchWidget } from './widget.js';

/**
 * Create Fetch Widget
 *
 * Factory function that creates a Fetch widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Fetch MCP server information
 * @returns Widget factory with API and metadata
 */
const createFetchWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('fetch-widget')) {
    customElements.define('fetch-widget', FetchWidget);
  }

  // Create widget element
  const widget = document.createElement('fetch-widget') as FetchWidget;

  // Inject dependencies
  widget.setDependencies(EventBus, MCPBridge, Configuration);
  widget.setServerInfo(mcpServerInfo);

  // Return widget factory
  return {
    api: {
      async initialize(): Promise<void> {
        await widget.initialize();
      },

      async destroy(): Promise<void> {
        await widget.destroy();
      },

      async refresh(): Promise<void> {
        await widget.refresh();
      },

      getStatus() {
        return widget.getStatus();
      },

      getResourceUsage() {
        return widget.getResourceUsage();
      },
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'fetch-widget',
      displayName: 'Fetch',
      description: 'Web content fetching and processing',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      category: 'web-tools',
      tags: ['fetch', 'web', 'scraping', 'content', 'http'],
      version: '1.0.0',
      author: {
        name: 'MCP-WP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: ['fetch', 'fetch_html'],
        },
      },
    },
  };
};

export default createFetchWidget;
export type {
  FetchWidgetConfig,
  FetchRequest,
  FetchResult,
  FetchHistoryItem,
} from './types.js';
