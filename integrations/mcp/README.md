# PAWS MCP Server

**[↑ Back to Main](../../README.md)** | **[↑ Integrations](../README.md)** | **[→ VS Code](../vscode/README.md)**

---

Model Context Protocol (MCP) server that exposes PAWS tools for use with Claude Desktop and other MCP-compatible clients.

## Overview

This integration allows you to use PAWS commands directly from Claude Desktop or any MCP-compatible client. Claude can invoke `cats`, `dogs`, and `paxos` as native tools.

**Available Tools:**
- `cats` - Create context bundles from your project files
- `dogs` - Apply AI-generated change bundles
- `paxos` - Run multi-agent competitive workflows

## Installation

### 1. Build the Server

```bash
# From repository root
pnpm install

# Or from this directory
cd integrations/mcp
pnpm install
```

### 2. Configure Claude Desktop

Add to your Claude Desktop config file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "paws": {
      "command": "node",
      "args": ["/absolute/path/to/paws/integrations/mcp/src/server.js"]
    }
  }
}
```

### 3. Restart Claude Desktop

The PAWS tools will now be available in Claude Desktop conversations.

## Usage

### Create Context Bundle

```
You: Create a context bundle from my authentication files

Claude: I'll use the cats tool to bundle your auth-related files...
[Creates cats.md with relevant files]
```

### Apply Changes

```
You: Apply the changes from changes.md

Claude: I'll use the dogs tool to apply these changes...
[Reviews and applies changes with your approval]
```

### Multi-Agent Workflow

```
You: Run a Paxos workflow to implement user registration

Claude: I'll coordinate multiple AI agents to generate and test solutions...
[Runs competitive workflow with consensus selection]
```

## Architecture

```
integrations/mcp/
├── src/
│   └── server.js          # MCP server implementation
├── package.json           # Dependencies
└── README.md             # This file
```

The server uses `@paws/cli-js` to execute PAWS commands and translates them into MCP tool interfaces.

## Development

### Running the Server

```bash
# Start server
node src/server.js

# Or via pnpm
pnpm start
```

### Testing

Test the server with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node src/server.js
```

## Troubleshooting

**Server not appearing in Claude Desktop:**
- Check that the path in `claude_desktop_config.json` is absolute
- Verify Node.js is in your PATH
- Restart Claude Desktop completely

**Tools failing:**
- Ensure `@paws/cli-js` is installed (`pnpm install` from repo root)
- Check that you're in a git repository when using PAWS commands
- Review Claude Desktop logs (Help > View Logs)

## Dependencies

- `@paws/cli-js` - PAWS JavaScript CLI tools
- Node.js 16+ - Runtime environment

---

**[↑ Back to Main](../../README.md)** | **[↑ Integrations](../README.md)** | **[→ VS Code](../vscode/README.md)**
