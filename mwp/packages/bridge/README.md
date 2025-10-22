# @mcp-wp/bridge

MCPBridge implementation for connecting to MCP servers.

## Overview

This package provides a production-ready implementation of the MCPBridge interface defined in `@mcp-wp/core`. It handles:

- **MCP Server Connections** - Connect to stdio and HTTP MCP servers
- **Tool Invocation** - Call MCP tools with argument validation
- **Resource Reading** - Read MCP resources with caching
- **Prompt Retrieval** - Get MCP prompts with argument interpolation
- **Event Integration** - Emits events via EventBus for all operations
- **Error Handling** - Robust error handling and retry logic
- **Connection Management** - Automatic reconnection and health checks

## Installation

```bash
pnpm add @mcp-wp/bridge
```

## Usage

### Basic Usage

```typescript
import { MCPBridge } from '@mcp-wp/bridge';
import { EventBus } from '@mcp-wp/eventbus';

// Create EventBus instance
const eventBus = new EventBus();

// Create bridge with server configurations
const bridge = new MCPBridge(eventBus, {
  servers: [
    {
      name: 'github',
      transport: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {
          GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
        },
      },
    },
  ],
});

// Connect to server
await bridge.connect('github');

// Call a tool
const result = await bridge.callTool('github', 'create_issue', {
  repo: 'owner/repo',
  title: 'Bug report',
  body: 'Description',
});

// Read a resource
const content = await bridge.readResource('github', 'github://owner/repo/issues');

// Get a prompt
const messages = await bridge.getPrompt('github', 'create-pr', {
  branch: 'feature-branch',
});
```

### With Retry Configuration

```typescript
const bridge = new MCPBridge(eventBus, {
  servers: [
    {
      name: 'api-server',
      transport: {
        type: 'http',
        url: 'https://api.example.com/mcp',
      },
      retry: {
        maxAttempts: 3,
        initialDelay: 1000,
        maxDelay: 10000,
        backoffMultiplier: 2,
      },
      timeout: 30000,
    },
  ],
});
```

### Event Handling

The bridge emits events for all operations:

```typescript
// Listen for tool invocations
eventBus.on('mcp:tool:invoked', ({ serverName, toolName, result }) => {
  console.log(`Tool ${toolName} on ${serverName} returned:`, result);
});

// Listen for errors
eventBus.on('mcp:tool:error', ({ serverName, toolName, error }) => {
  console.error(`Tool ${toolName} on ${serverName} failed:`, error);
});

// Listen for server connection events
eventBus.on('mcp:server:connected', ({ serverName, serverInfo }) => {
  console.log(`Connected to ${serverName}`, serverInfo);
});
```

## API

### Class: MCPBridge

#### Constructor

```typescript
new MCPBridge(eventBus: EventBus, config: BridgeConfiguration)
```

**Parameters:**
- `eventBus` - EventBus instance for event emission
- `config` - Bridge configuration with server definitions

#### Methods

##### connect(serverName: string): Promise<void>

Connect to an MCP server.

```typescript
await bridge.connect('github');
```

##### disconnect(serverName: string): Promise<void>

Disconnect from an MCP server.

```typescript
await bridge.disconnect('github');
```

##### callTool(serverName, toolName, args): Promise<ToolResult>

Invoke an MCP tool.

```typescript
const result = await bridge.callTool('github', 'create_issue', {
  repo: 'owner/repo',
  title: 'Issue title',
  body: 'Issue body',
});
```

##### readResource(serverName, uri): Promise<ResourceContent>

Read an MCP resource.

```typescript
const content = await bridge.readResource(
  'github',
  'github://owner/repo/issues'
);
```

##### getPrompt(serverName, promptName, args): Promise<PromptMessages>

Get an MCP prompt.

```typescript
const messages = await bridge.getPrompt('github', 'review-pr', {
  number: '123',
});
```

##### listTools(serverName): Promise<Tool[]>

List available tools from server.

```typescript
const tools = await bridge.listTools('github');
```

##### listResources(serverName): Promise<Resource[]>

List available resources from server.

```typescript
const resources = await bridge.listResources('github');
```

##### listPrompts(serverName): Promise<Prompt[]>

List available prompts from server.

```typescript
const prompts = await bridge.listPrompts('github');
```

##### subscribeToResource(serverName, uri, callback): Promise<UnsubscribeFunction>

Subscribe to resource updates (if server supports subscriptions).

```typescript
const unsubscribe = await bridge.subscribeToResource(
  'filesystem',
  'file:///path/to/file.txt',
  (content) => {
    console.log('Resource updated:', content);
  }
);

// Later: unsubscribe
unsubscribe();
```

##### getServerInfo(serverName): MCPServerInfo | undefined

Get information about connected server.

```typescript
const info = bridge.getServerInfo('github');
console.log('Server capabilities:', info?.capabilities);
```

##### isConnected(serverName): boolean

Check if server is connected.

```typescript
if (bridge.isConnected('github')) {
  // Server is connected
}
```

## Configuration

### BridgeConfiguration

```typescript
interface BridgeConfiguration {
  servers: ServerConfiguration[];
  cache?: CacheConfiguration;
  retry?: RetryConfiguration;
}
```

### ServerConfiguration

See `@mcp-wp/core` for complete ServerConfiguration type definition.

```typescript
interface ServerConfiguration {
  name: string;
  transport: StdioTransportConfiguration | HttpTransportConfiguration;
  timeout?: number;
  retry?: RetryConfiguration;
  autoConnect?: boolean;
}
```

### CacheConfiguration

```typescript
interface CacheConfiguration {
  enabled: boolean;
  ttl: number; // milliseconds
  maxSize: number; // bytes
}
```

## Error Handling

The bridge throws typed errors for different failure scenarios:

```typescript
import { MCPBridgeError, ConnectionError, ToolExecutionError } from '@mcp-wp/bridge';

try {
  await bridge.callTool('github', 'create_issue', args);
} catch (error) {
  if (error instanceof ConnectionError) {
    // Server connection failed
  } else if (error instanceof ToolExecutionError) {
    // Tool execution failed
  } else if (error instanceof MCPBridgeError) {
    // Generic bridge error
  }
}
```

## Events

The bridge emits the following events via EventBus:

**Tool Events:**
- `mcp:tool:invoke-requested` - Before tool invocation
- `mcp:tool:invoked` - After successful invocation
- `mcp:tool:error` - After failed invocation

**Resource Events:**
- `mcp:resource:read-requested` - Before resource read
- `mcp:resource:read` - After successful read
- `mcp:resource:error` - After failed read
- `mcp:resource:updated` - When subscribed resource updates

**Prompt Events:**
- `mcp:prompt:get-requested` - Before prompt retrieval
- `mcp:prompt:got` - After successful retrieval
- `mcp:prompt:error` - After failed retrieval

**Server Events:**
- `mcp:server:connected` - After server connection
- `mcp:server:disconnected` - After server disconnection
- `mcp:server:error` - Server error occurred

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## Implementation Details

### Connection Management

- Maintains connection pool for multiple servers
- Automatic reconnection on connection loss
- Health check pings (configurable interval)
- Graceful shutdown on disconnect

### Request Handling

- Request ID generation for tracking
- Timeout handling per request
- Retry logic with exponential backoff
- Request queuing for batch operations

### Caching

- Optional resource caching (LRU strategy)
- Configurable TTL and size limits
- Cache invalidation on resource updates
- Per-server cache namespacing

### Performance

- Connection pooling
- Request batching (when supported by server)
- Lazy connection initialization
- Efficient JSON-RPC message handling

## License

MIT
