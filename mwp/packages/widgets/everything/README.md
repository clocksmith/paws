# @mcp-wp/widget-everything

Dashboard widget for the official [Everything MCP server](https://github.com/modelcontextprotocol/server-everything). Surface desktop search tools, resources, and prompts through the MCP Widget Protocol.

## Features

- **Interactive desktop search** – Run queries with filters, real-time results, and instant host-approved tool invocations
- **Server snapshot** – Enumerates all tools, resources, and prompts exposed by the Everything MCP server
- **Live updates** – Re-renders automatically when the server emits capability changes
- **Friendly inspection** – Tabs for tools, resources, and prompts with metadata and annotations
- **MCP-native** – Uses EventBus + MCPBridge dependency injection for safe interaction

## Prerequisites

Install and configure the official Everything MCP server:

```bash
npm install -g @modelcontextprotocol/server-everything
```

Example dashboard configuration:

```json
{
  "servers": [
    {
      "name": "everything",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-everything"]
      }
    }
  ],
  "widgets": [
    {
      "id": "everything-inspector",
      "package": "@mcp-wp/widget-everything",
      "serverName": "everything",
      "position": { "x": 0, "y": 0 },
      "size": { "w": 6, "h": 4 }
    }
  ]
}
```

## Usage

```ts
import createEverythingWidget from '@mcp-wp/widget-everything';

const { api, widget } = createEverythingWidget({
  EventBus,
  MCPBridge,
  Configuration,
}, bridge.getServerInfo('everything'));

await api.initialize();
container.appendChild(document.createElement(widget.element));
```

## Roadmap

- 🔍 Execute search queries with inline result preview (planned)
- 📁 Resource previews for desktop files and indexing metadata (planned)

Contributions welcome! Please open an issue or PR with enhancements.
