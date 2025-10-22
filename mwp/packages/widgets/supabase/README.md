# @mwp/widget-supabase

Supabase dashboard widget for the MCP Widget Protocol. Surfaces database, auth, and storage primitives from the Supabase MCP server (official or community variants).

## Highlights

- **Schema awareness** – Lists table resources and their URIs when exposed by the server
- **Auth & storage inventory** – Groups Supabase tools by capability (auth, buckets, SQL)
- **Interactive SQL studio** – Run syntax-highlighted queries, edit rows inline, and inspect RLS policies
- **Realtime feed** – Subscribe to table changes with live payload inspection
- **Health metrics** – Monitor latency, connections, throughput, and replication lag
- **Safe host integration** – Operates entirely through injected EventBus + MCPBridge APIs

## Prerequisites

You need a Supabase-compatible MCP server. The community reference implementation lives at [`modelcontextprotocol/server-supabase`](https://github.com/modelcontextprotocol/server-supabase).

```bash
npm install -g @modelcontextprotocol/server-supabase
```

Example dashboard wiring:

```json
{
  "servers": [
    {
      "name": "supabase",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-supabase"],
        "env": {
          "SUPABASE_URL": "https://project.supabase.co",
          "SUPABASE_SERVICE_KEY": "service_role_token"
        }
      }
    }
  ],
  "widgets": [
    {
      "id": "supabase-admin",
      "package": "@mwp/widget-supabase",
      "serverName": "supabase",
      "position": { "x": 6, "y": 0 },
      "size": { "w": 6, "h": 5 }
    }
  ]
}
```

## Usage

```ts
import createSupabaseWidget from '@mwp/widget-supabase';

const { api, widget } = createSupabaseWidget({ EventBus, MCPBridge, Configuration }, bridge.getServerInfo('supabase'));
await api.initialize();

const element = document.createElement(widget.element);
container.appendChild(element);
```

## Roadmap

- ⚙️ SQL execution forms with result preview (planned)
- 📦 Storage browser for bucket contents (planned)
- 🔐 Auth session inspector (planned)

Pull requests welcome—share production requirements so we can prioritise the next iterations.
