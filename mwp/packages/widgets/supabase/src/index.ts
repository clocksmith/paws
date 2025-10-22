import type {
  Dependencies,
  MCPServerInfo,
  WidgetFactory,
  WidgetFactoryFunction,
} from '@mcp-wp/core';
import { SupabaseWidget } from './widget.js';

const TAG_NAME = 'mcp-supabase-widget';

const createSupabaseWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get(TAG_NAME)) {
    customElements.define(TAG_NAME, SupabaseWidget);
  }

  const element = document.createElement(TAG_NAME) as SupabaseWidget;
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
      element: TAG_NAME,
      displayName: 'Supabase',
      description: 'Inspect Supabase tables, auth tools, and storage APIs exposed by the Supabase MCP server.',
      category: 'database',
      version: '1.0.0',
      tags: ['supabase', 'database', 'auth', 'storage'],
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
          patterns: ['query_sql', 'list_tables', 'list_buckets', 'auth_*', 'storage_*', '*'],
        },
        resources: {
          scope: 'allowlist',
          patterns: ['supabase://*'],
        },
      },
    },
  };
};

export default createSupabaseWidget;
export { SupabaseWidget };
export type { SupabaseState, SupabaseView } from './types.js';
