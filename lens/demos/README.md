# MCP Lens Demo Dashboard

**Live demonstration of protocol-semantic analytics** with real MCP servers.

See MCP Lens in action - analyzing *why* protocol operations succeed or fail, not just *that* they happened.

## What This Is

This demo shows MCP Lens in action:
- **Real MCP servers** (filesystem, memory, fetch, sequential-thinking) running via Node.js
- **MCP Lens dashboard** providing visual monitoring and control
- **User confirmation** workflows for tool invocations
- **Server chaining** examples showing multi-step pipelines

## Quick Start

### 1. Install Dependencies

```bash
cd demos
npm install
```

### 2. Create Sandbox Directory

The filesystem server needs a sandbox directory:

```bash
mkdir -p sandbox
echo "Hello from MCP Lens demo!" > sandbox/example.txt
```

### 3. Build and Start

```bash
npm run build  # Compile TypeScript
npm start      # Start server
```

Or for development with auto-reload:

```bash
npm run dev
```

This will:
- Compile TypeScript to JavaScript
- Start Express server on http://localhost:3000
- Launch 4 MCP servers (filesystem, memory, fetch, sequential-thinking)
- Serve the dashboard UI

### 4. Open Dashboard

Open http://localhost:3000 in your browser.

## Features

### 1. Server Monitoring

View all connected MCP servers with:
- Connection status (green = connected)
- Server descriptions
- Capabilities

### 2. Tool Browser

- Select any server from dropdown
- View available tools
- Click tools to execute (with confirmation)

### 3. User Confirmation (SPEC §7.1)

When you click a tool, you'll see a confirmation modal showing:
- Server name
- Tool name
- Arguments (if any)
- [Approve] or [Cancel] buttons

**This is SPEC §7.1 in action:** All tool invocations require explicit user confirmation before execution, preventing unauthorized operations.

### 4. Example Pipelines

Pre-configured multi-server workflows:

**Research Pipeline:**
1. Fetch data from GitHub API (`fetch` server)
2. Analyze with reasoning (`sequential-thinking` server)
3. Store findings (`memory` server)

**File Analysis:**
1. Read file from sandbox (`filesystem` server)
2. Summarize content (`sequential-thinking` server)
3. Write summary back to file (`filesystem` server)

Click "Run Pipeline" to execute all steps in sequence.

### 5. Activity Log

Real-time log showing:
- Server connections
- Tool executions
- Pipeline steps
- Errors and warnings

## Architecture

```
┌─────────────────────────────────────────┐
│      Browser (http://localhost:3000)    │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │   Dashboard UI (HTML + JS)       │  │
│  │   - Server list widget           │  │
│  │   - Tool browser widget          │  │
│  │   - Pipeline executor            │  │
│  │   - Activity log widget          │  │
│  └──────────────┬───────────────────┘  │
└─────────────────┼──────────────────────-┘
                  │ HTTP + WebSocket
                  │
┌─────────────────▼──────────────────────┐
│      Express Server (Node.js)          │
│                                        │
│  ┌────────────────────────────────┐   │
│  │   MCP Bridge                   │   │
│  │   - Routes HTTP → MCP calls    │   │
│  │   - Manages server connections │   │
│  │   - Emits events via WebSocket │   │
│  └────────────┬───────────────────┘   │
└───────────────┼───────────────────────-┘
                │ MCP JSON-RPC (stdio)
                │
    ┌───────────┴───────────┐
    │                       │
┌───▼────┐  ┌───▼────┐  ┌─▼──────┐  ┌───▼──────────┐
│filesystem│  memory  │  fetch    │  sequential-  │
│MCP Server│ MCP Server│ MCP Server│  thinking     │
│          │           │           │  MCP Server   │
└──────────┘  └────────┘  └────────┘  └──────────────┘
```

## MCP Servers Used

### 1. Filesystem (`@modelcontextprotocol/server-filesystem`)

**Tools:**
- `read_file` - Read file from sandbox
- `write_file` - Write file to sandbox
- `list_directory` - List directory contents

**Security:** Scoped to `./sandbox` directory only.

### 2. Memory (`@modelcontextprotocol/server-memory`)

**Tools:**
- `store` - Store key-value pair
- `retrieve` - Retrieve value by key
- `delete` - Delete key

**Use case:** Agent context persistence across requests.

### 3. Fetch (`@modelcontextprotocol/server-fetch`)

**Tools:**
- `fetch` - HTTP GET/POST requests

**Use case:** Retrieve external data (APIs, web pages).

### 4. Sequential Thinking (`@modelcontextprotocol/server-sequential-thinking`)

**Tools:**
- `create_thinking_session` - Start reasoning session
- `add_thought` - Add reasoning step
- `complete_session` - Finalize reasoning

**Use case:** Step-by-step problem solving.

## Development

### Watch Mode

```bash
npm run dev
```

Uses nodemon for auto-restart on file changes.

### Add New Servers

Edit `config.json`:

```json
{
  "servers": [
    {
      "name": "my-server",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-my-server"],
      "description": "My custom MCP server"
    }
  ]
}
```

Restart the server to load changes.

## Troubleshooting

### Servers not starting

Check that MCP server packages are available:

```bash
npx -y @modelcontextprotocol/server-filesystem --help
```

### Port 3000 already in use

Set custom port:

```bash
PORT=3001 npm start
```

Update `API_BASE` in `public/app.js` accordingly.

### Sandbox permission errors

Ensure sandbox directory exists and is writable:

```bash
mkdir -p sandbox
chmod 755 sandbox
```

## Next Steps

1. **Try the pipelines** - Click "Run Pipeline" to see server chaining
2. **Explore tools** - Browse each server's available tools
3. **Monitor activity** - Watch the Activity Log for real-time updates
4. **Build your own** - Use this as a template for your MCP Lens dashboards

## Related Resources

- **[POSITIONING.md](../POSITIONING.md)** - Strategic positioning & competitive analysis
- **[SPEC.md](../SPEC.md)** - Complete protocol specification
- **[schema.ts](../schema.ts)** - TypeScript type definitions
- **[examples/](../examples/)** - Widget implementation examples
- **[MCP Documentation](https://modelcontextprotocol.io/)** - Model Context Protocol docs
