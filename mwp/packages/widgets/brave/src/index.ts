/**
 * Brave Search Widget Factory
 *
 * Creates Brave Search MCP widget for web search.
 */

import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { BraveWidget } from './widget.js';

/**
 * Create Brave Search Widget
 *
 * Factory function that creates a Brave Search widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Brave Search MCP server information
 * @returns Widget factory with API and metadata
 */
const createBraveWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('brave-mcp-widget')) {
    customElements.define('brave-mcp-widget', BraveWidget);
  }

  // Create widget element
  const widget = document.createElement('brave-mcp-widget') as BraveWidget;

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
      element: 'brave-mcp-widget',
      displayName: 'Brave Search',
      description: 'Privacy-focused web search',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      category: 'content-browser',
      tags: ['brave', 'search', 'web', 'privacy', 'discovery'],
      version: '1.0.0',
      author: {
        name: 'MCP-WP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: ['brave_web_search', 'brave_local_search', 'brave_*'],
        },
      },
    },
  };
};

export default createBraveWidget;
export type {
  BraveWidgetConfig,
  SearchResult,
  SearchFilters,
  SearchHistory,
} from './types.js';
