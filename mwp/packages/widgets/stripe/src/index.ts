import type {
  Dependencies,
  MCPServerInfo,
  WidgetFactory,
  WidgetFactoryFunction,
} from '@mcp-wp/core';
import { StripeWidget } from './widget.js';

const TAG = 'mcp-stripe-widget';

const createStripeWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory => {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get(TAG)) {
    customElements.define(TAG, StripeWidget);
  }

  const element = document.createElement(TAG) as StripeWidget;
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
      element: TAG,
      displayName: 'Stripe',
      description: 'Group Stripe MCP tools by payments, billing, customers, and catalog to supervise activity.',
      category: 'payments',
      version: '1.0.0',
      tags: ['stripe', 'payments', 'billing', 'finance'],
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
          patterns: ['payment_*', 'checkout_*', 'invoice_*', 'customer_*', 'product_*', '*'],
        },
        resources: {
          scope: 'allowlist',
          patterns: ['stripe://*'],
        },
      },
    },
  };
};

export default createStripeWidget;
export { StripeWidget };
export type { StripeSegment, StripeState } from './types.js';
