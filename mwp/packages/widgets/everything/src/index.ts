import type {
  WidgetFactoryFunction,
  WidgetFactory,
  Dependencies,
  MCPServerInfo,
} from '@mcp-wp/core';
import { EverythingWidget } from './widget.js';

const ELEMENT_TAG = 'mcp-everything-widget';

const createEverythingWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get(ELEMENT_TAG)) {
    customElements.define(ELEMENT_TAG, EverythingWidget);
  }

  const element = document.createElement(ELEMENT_TAG) as EverythingWidget;
  element.setDependencies(EventBus, MCPBridge, Configuration);
  element.setServerInfo(serverInfo);

  return {
    api: {
      async initialize(): Promise<void> {
        await element.initialize();
      },
      async destroy(): Promise<void> {
        await element.destroy();
      },
      async refresh(): Promise<void> {
        await element.refresh();
      },
      getStatus() {
        return element.getStatus();
      },
      getResourceUsage() {
        return element.getResourceUsage();
      },
    },
    widget: {
      protocolVersion: '1.0.0',
      element: ELEMENT_TAG,
      displayName: 'Everything',
      description: 'Discover tools, resources, and prompts from the Everything MCP desktop search server.',
      category: 'search',
      version: '1.0.0',
      tags: ['search', 'desktop', 'indexing', 'everything'],
      capabilities: {
        tools: true,
        resources: true,
        prompts: true,
      },
      author: {
        name: 'MCP-WP Team',
      },
      permissions: {
        tools: {
          scope: 'allowlist',
          patterns: ['*'],
        },
        resources: {
          scope: 'allowlist',
          patterns: ['*'],
        },
      },
    },
  };
};

export default createEverythingWidget;
export { EverythingWidget };
export type { EverythingState, EverythingTab } from './types.js';
