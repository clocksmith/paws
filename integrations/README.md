# PAWS Integrations

**[↑ Back to Main](../README.md)** | **[← Packages](../packages/README.md)**

---

This directory contains integrations that connect PAWS to other tools and platforms.

## Available Integrations

### [MCP Server](mcp/README.md)
Model Context Protocol server that exposes PAWS tools (`cats`, `dogs`, `arena`, `swarm`, `session`) for use with Claude Desktop and other MCP-compatible clients.

**Use cases:**
- Use PAWS commands directly from Claude Desktop
- Create context bundles without leaving your chat
- Apply AI-generated changes with review

### [VS Code Extension](vscode/README.md)
Visual Studio Code extension that integrates PAWS workflows into your IDE.

**Features:**
- Create context bundles from selected files
- Apply change bundles with inline diff preview
- Keyboard shortcuts for common workflows
- Status bar integration

## Installation

Each integration has its own installation instructions. See the individual README files for details.

### Quick Links

- [Install MCP Server](mcp/README.md#installation)
- [Install VS Code Extension](vscode/README.md#installation)

## Development

Both integrations depend on `@paws/cli-js` and are part of the pnpm workspace:

```bash
# Install all dependencies
pnpm install

# Start MCP server
pnpm --filter paws-mcp-server start

# Build VS Code extension
pnpm --filter paws-vscode compile
```

---

**[↑ Back to Main](../README.md)** | **[← Packages](../packages/README.md)**
