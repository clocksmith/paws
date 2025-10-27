# MWP Demo

Interactive demonstration of the MWP GitHub widget showcasing security and observability features.

## Quick Start

```bash
# Install dependencies (from mwp root)
pnpm install

# Start demo server
cd packages/demo
pnpm dev
```

Opens browser at `http://localhost:3000` with the GitHub widget running against a mock MCP server.

## What's Demonstrated

### 1. Security: User Confirmation

Try creating a GitHub issue:
1. Click "New Issue" tab
2. Fill in repository, title, description
3. Click "Create Issue"
4. **Observe confirmation dialog** - This is MWP's security model in action
5. Approve or reject the operation

Every tool execution requires explicit user approval.

### 2. Observability: Event Logging

Watch the event log in the right sidebar:
- **Tool Request** - Widget requests tool execution
- **Tool Success** - Tool completed successfully
- **Tool Error** - Tool failed or was rejected
- **Connection** - MCP server connection events

All events are logged and can be audited.

### 3. Type Safety

Open DevTools console and inspect:
- TypeScript interfaces enforce correct API usage
- Runtime validation prevents invalid operations
- Full IntelliSense support during development

### 4. Shadow DOM Isolation

Inspect elements in DevTools:
- Widget styles don't leak to parent page
- Parent page styles don't affect widget
- Clean encapsulation boundaries

## Features Showcased

- ✅ Repository browsing
- ✅ Issue creation with confirmation
- ✅ Resource preview
- ✅ Search functionality
- ✅ Real-time event logging
- ✅ Error handling
- ✅ Responsive design

## Mock vs Real MCP Server

This demo uses a **mock MCP server** for ease of demonstration. The mock:
- Simulates network delays
- Returns static test data
- Doesn't require GitHub authentication
- Always succeeds (no real API calls)

To connect to a **real MCP server**:

```typescript
import { MCPBridge } from '@mwp/bridge';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-github']
});

const bridge = new MCPBridge({
  serverName: 'github',
  transport
});
```

## Comparison: MWP vs Plain Iframe

| Feature | MWP (This Demo) | Plain Iframe |
|---------|----------------|--------------|
| User Confirmation | ✅ Built-in | ❌ Must implement |
| Event Logging | ✅ Automatic | ❌ Manual postMessage |
| Type Safety | ✅ TypeScript | ❌ Plain HTML |
| Theming | ✅ CSS vars | ❌ Manual |
| Isolation | ✅ Shadow DOM | ✅ iframe |

## Architecture

```
┌─────────────────────────────────────┐
│         Demo Page (main.ts)         │
│  • Mock MCP Transport               │
│  • Confirmation Modal               │
│  • Event Logger                     │
└────────────┬────────────────────────┘
             │
    ┌────────┴────────┐
    │    EventBus     │ ← Logs all events
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │   MCPBridge     │ ← Intercepts tool calls
    └────────┬────────┘
             │
    ┌────────┴────────┐
    │  GitHub Widget  │ ← UI Component
    │  (Web Component)│
    └─────────────────┘
```

## Key Files

- `index.html` - Demo page layout and styles
- `src/main.ts` - Demo initialization and mock server
- `public/` - Static assets (if any)

## Extending the Demo

Add more widgets:

```typescript
import createPlaywrightWidget from '@mwp/widget-playwright';

const playwrightFactory = createPlaywrightWidget(dependencies, {
  serverName: 'playwright',
  capabilities: { tools: true }
});

await playwrightFactory.api.initialize();
```

Add real MCP server:

```bash
# Install MCP server
npm install @modelcontextprotocol/server-github

# Update main.ts to use real transport
# Remove mock responses
```

## Video Demo

Record a demo video:

1. Start demo server
2. Navigate through tabs
3. Create an issue
4. Show confirmation dialog
5. Observe event log
6. Inspect Shadow DOM in DevTools

## Publishing

This demo can be:
- Deployed to GitHub Pages
- Embedded in documentation
- Shared as CodeSandbox
- Used in presentations

## License

MIT
