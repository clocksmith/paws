/**
 * Sequential Thinking Widget Factory
 *
 * Creates Sequential Thinking MCP widget for AI reasoning visualization.
 */

import type { types } from '@mwp/core';

type WidgetFactoryFunction = types.WidgetFactoryFunction;
type WidgetFactory = types.WidgetFactory;
type Dependencies = types.Dependencies;
type MCPServerInfo = types.MCPServerInfo;
import { SequentialThinkingWidget } from './widget.js';

/**
 * Create Sequential Thinking Widget
 *
 * Factory function that creates a Sequential Thinking widget instance.
 *
 * @param dependencies - Host-provided dependencies
 * @param mcpServerInfo - Sequential Thinking MCP server information
 * @returns Widget factory with API and metadata
 */
const createSequentialThinkingWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element if not already defined
  if (!customElements.get('sequential-thinking-widget')) {
    customElements.define('sequential-thinking-widget', SequentialThinkingWidget);
  }

  // Create widget element
  const widget = document.createElement(
    'sequential-thinking-widget'
  ) as SequentialThinkingWidget;

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
      element: 'sequential-thinking-widget',
      displayName: 'Sequential Thinking',
      description: 'AI reasoning and chain-of-thought visualization',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      tags: ['thinking', 'reasoning', 'chain-of-thought', 'ai', 'visualization'],
      version: '1.0.0',
      author: {
        name: 'MWP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: [
            'start_thinking',
            'add_step',
            'get_session',
            'list_sessions',
            'thinking_*',
          ],
        },
      },
    },
  };
};

export default createSequentialThinkingWidget;
export type {
  ThinkingWidgetConfig,
  ThinkingSession,
  ThinkingStep,
} from './types.js';
