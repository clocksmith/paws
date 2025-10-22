# @mcp-wp/widget-stripe

Stripe control surface for the MCP Widget Protocol. Gives teams visibility into tools, resources, and prompts exposed by a Stripe MCP server (community implementation required today).

## Features

- **Segmented view** – Payments, billing, customers, and product tools grouped automatically
- **Visualization dashboards** – Payment flow timelines, renewal tracking, customer MRR insights, and webhook tracing
- **Live metadata** – Lists MCP tools/resources as soon as the server advertises them
- **Host-friendly** – No direct API keys inside the widget; all operations flow through the host’s MCPBridge
- **Launchpad for automations** – Emits EventBus signals you can connect to custom dashboards or guardrails

## Prerequisites

At the moment Stripe connectivity is available through community MCP servers (for example, [`astral-sh/mcp-server-stripe`](https://github.com/astral-sh/mcp-server-stripe)). Provide the necessary API keys via MCP server environment variables.

```bash
npm install -g @astral-sh/mcp-server-stripe
```

Example dashboard configuration:

```json
{
  "servers": [
    {
      "name": "stripe",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@astral-sh/mcp-server-stripe"],
        "env": {
          "STRIPE_SECRET_KEY": "sk_live_or_test",
          "STRIPE_ACCOUNT": "acct_123"  
        }
      }
    }
  ],
  "widgets": [
    {
      "id": "stripe-ops",
      "package": "@mcp-wp/widget-stripe",
      "serverName": "stripe",
      "position": { "x": 0, "y": 4 },
      "size": { "w": 6, "h": 5 }
    }
  ]
}
```

## Usage

```ts
import createStripeWidget from '@mcp-wp/widget-stripe';

const { api, widget } = createStripeWidget({ EventBus, MCPBridge, Configuration }, bridge.getServerInfo('stripe'));
await api.initialize();

document.body.appendChild(document.createElement(widget.element));
```

## Roadmap

- 🧾 Invoice + subscription drill-down views (planned)
- 💳 Quick actions for refunds/capture with confirmation dialogs (planned)
- 📊 Revenue sparkline powered by MCP resources (planned)

PRs and design proposals are welcome—let us know how you’re using Stripe with MCP.
