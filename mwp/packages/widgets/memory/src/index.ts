/**
 * Memory Widget Factory
 *
 * Creates Memory MCP widget for knowledge graph management.
 */

import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { MemoryWidget } from './widget.js';

/**
 * Create Memory Widget
 *
 * Factory function that creates a Memory widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Memory MCP server information
 * @returns Widget factory with API and metadata
 */
const createMemoryWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('memory-widget')) {
    customElements.define('memory-widget', MemoryWidget);
  }

  // Create widget element
  const widget = document.createElement('memory-widget') as MemoryWidget;

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
      element: 'memory-widget',
      displayName: 'Memory',
      description: 'Knowledge graph and entity management',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      category: 'data-management',
      tags: ['memory', 'knowledge-graph', 'entities', 'relations', 'data'],
      version: '1.0.0',
      author: {
        name: 'MCP-WP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: [
            'create_entities',
            'create_relations',
            'add_observations',
            'delete_entities',
            'delete_observations',
            'delete_relations',
            'read_graph',
            'search_nodes',
            'open_nodes',
          ],
        },
      },
    },
  };
};

export default createMemoryWidget;
export type {
  MemoryWidgetConfig,
  Entity,
  Relation,
  KnowledgeGraph,
} from './types.js';
