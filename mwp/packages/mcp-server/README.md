# @mcp-wp/server

MCP server implementation for the MCP-WP (Model Context Protocol Widget Protocol) dashboard. This package provides a production-ready server that connects MCP servers to web-based widget dashboards.

## Features

- **WebSocket Support** - Real-time bidirectional communication
- **REST API** - HTTP endpoints for widget management
- **Multi-Protocol Support** - Stdio, SSE, and WebSocket transports
- **Dashboard Integration** - Seamless integration with @mcp-wp/dashboard
- **Widget Hot-Reloading** - Dynamic widget loading and updates
- **Security** - CORS, Helmet, rate limiting
- **Logging** - Comprehensive Winston-based logging
- **Health Checks** - Built-in health monitoring endpoints
- **Configuration** - Environment-based configuration
- **CLI Tool** - Easy server management

## Installation

```bash
npm install @mcp-wp/server
# or
pnpm add @mcp-wp/server
```

## Quick Start

### Using the CLI

```bash
# Start the server
npx mcp-wp-server start

# Start with custom port
npx mcp-wp-server start --port 8080

# Start with configuration file
npx mcp-wp-server start --config ./config.json

# Show help
npx mcp-wp-server --help
```

### Programmatic Usage

```typescript
import { MCPServer } from '@mcp-wp/server';

const server = new MCPServer({
  port: 3000,
  host: 'localhost',
  mcpServers: [
    {
      name: 'github',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_TOKEN: process.env.GITHUB_TOKEN
      }
    }
  ]
});

await server.start();
console.log('Server running on http://localhost:3000');
```

## Configuration

### Environment Variables

Create a `.env` file in your project root:

```env
# Server Configuration
PORT=3000
HOST=localhost
NODE_ENV=development

# CORS Configuration
CORS_ORIGIN=http://localhost:5173
CORS_CREDENTIALS=true

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/mcp-server.log

# MCP Servers (JSON array)
MCP_SERVERS='[{"name":"github","command":"npx","args":["-y","@modelcontextprotocol/server-github"]}]'
```

### Configuration File

Create a `mcp-server.config.json` file:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost"
  },
  "mcpServers": [
    {
      "name": "github",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    {
      "name": "filesystem",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/dir"]
    }
  ],
  "security": {
    "cors": {
      "origin": ["http://localhost:5173"],
      "credentials": true
    },
    "rateLimit": {
      "windowMs": 900000,
      "max": 100
    }
  },
  "logging": {
    "level": "info",
    "file": "./logs/mcp-server.log"
  }
}
```

## API Reference

### Server Class

```typescript
class MCPServer {
  constructor(config: ServerConfig);

  // Start the server
  async start(): Promise<void>;

  // Stop the server
  async stop(): Promise<void>;

  // Add MCP server dynamically
  async addMCPServer(config: MCPServerConfig): Promise<void>;

  // Remove MCP server
  async removeMCPServer(name: string): Promise<void>;

  // Get server status
  getStatus(): ServerStatus;

  // Get connected MCP servers
  getMCPServers(): MCPServerInfo[];
}
```

### Configuration Types

```typescript
interface ServerConfig {
  port?: number;
  host?: string;
  mcpServers?: MCPServerConfig[];
  security?: SecurityConfig;
  logging?: LoggingConfig;
}

interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  transport?: 'stdio' | 'sse' | 'websocket';
}

interface SecurityConfig {
  cors?: {
    origin: string | string[];
    credentials?: boolean;
  };
  rateLimit?: {
    windowMs: number;
    max: number;
  };
}

interface LoggingConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  file?: string;
}
```

## REST API Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345,
  "version": "1.0.0",
  "mcpServers": {
    "github": "connected",
    "filesystem": "connected"
  }
}
```

### GET /api/mcp-servers

List all connected MCP servers.

**Response:**
```json
{
  "servers": [
    {
      "name": "github",
      "status": "connected",
      "tools": ["list_repositories", "create_issue"],
      "resources": ["repo://"]
    }
  ]
}
```

### POST /api/mcp-servers

Add a new MCP server dynamically.

**Request:**
```json
{
  "name": "new-server",
  "command": "npx",
  "args": ["-y", "@modelcontextprotocol/server-example"],
  "env": {}
}
```

**Response:**
```json
{
  "success": true,
  "server": {
    "name": "new-server",
    "status": "connected"
  }
}
```

### DELETE /api/mcp-servers/:name

Remove an MCP server.

**Response:**
```json
{
  "success": true,
  "message": "Server removed successfully"
}
```

### GET /api/widgets

List available widgets.

**Response:**
```json
{
  "widgets": [
    {
      "name": "github",
      "version": "1.0.0",
      "description": "GitHub integration widget"
    }
  ]
}
```

## WebSocket API

Connect to the WebSocket endpoint at `ws://localhost:3000/ws`.

### Client Messages

**Subscribe to Events:**
```json
{
  "type": "subscribe",
  "event": "widget:update"
}
```

**Call MCP Tool:**
```json
{
  "type": "tool:call",
  "server": "github",
  "tool": "list_repositories",
  "arguments": {
    "username": "octocat"
  }
}
```

**Get Resource:**
```json
{
  "type": "resource:get",
  "server": "filesystem",
  "uri": "file:///path/to/file"
}
```

### Server Messages

**Tool Response:**
```json
{
  "type": "tool:response",
  "id": "request-id",
  "result": {
    "data": {}
  }
}
```

**Event Notification:**
```json
{
  "type": "event",
  "event": "widget:update",
  "data": {}
}
```

**Error:**
```json
{
  "type": "error",
  "message": "Error description"
}
```

## Dashboard Integration

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import { MCPServer } from '@mcp-wp/server';

// Create and start the server
const server = new MCPServer({ port: 3000 });
await server.start();

// Create dashboard connected to the server
const dashboard = new Dashboard({
  serverUrl: 'http://localhost:3000',
  wsUrl: 'ws://localhost:3000/ws'
});

await dashboard.initialize();

// Add widgets
await dashboard.addWidget('github', {
  position: { x: 0, y: 0 }
});
```

## Examples

### Basic Server

```typescript
import { MCPServer } from '@mcp-wp/server';

const server = new MCPServer({
  port: 3000,
  mcpServers: [
    {
      name: 'github',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github']
    }
  ]
});

await server.start();
```

### Server with Multiple MCP Servers

```typescript
const server = new MCPServer({
  port: 3000,
  mcpServers: [
    {
      name: 'github',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN }
    },
    {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', './workspace']
    },
    {
      name: 'brave',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-brave-search'],
      env: { BRAVE_API_KEY: process.env.BRAVE_API_KEY }
    }
  ]
});

await server.start();
```

### Dynamic Server Management

```typescript
const server = new MCPServer({ port: 3000 });
await server.start();

// Add server at runtime
await server.addMCPServer({
  name: 'postgres',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-postgres'],
  env: { DATABASE_URL: process.env.DATABASE_URL }
});

// Remove server
await server.removeMCPServer('postgres');

// Check status
const status = server.getStatus();
console.log('Server status:', status);
```

### Custom Security Configuration

```typescript
const server = new MCPServer({
  port: 3000,
  security: {
    cors: {
      origin: ['https://app.example.com', 'https://admin.example.com'],
      credentials: true
    },
    rateLimit: {
      windowMs: 60000, // 1 minute
      max: 50 // 50 requests per minute
    }
  }
});

await server.start();
```

## Logging

The server uses Winston for structured logging:

```typescript
import { MCPServer, logger } from '@mcp-wp/server';

const server = new MCPServer({
  port: 3000,
  logging: {
    level: 'debug',
    file: './logs/mcp-server.log'
  }
});

// Custom logging
logger.info('Custom log message', { context: 'data' });
logger.error('Error occurred', { error: err });
```

## Health Monitoring

```typescript
const server = new MCPServer({ port: 3000 });
await server.start();

// Periodic health checks
setInterval(() => {
  const status = server.getStatus();

  if (status.status !== 'healthy') {
    logger.warn('Server unhealthy', { status });
  }

  // Check individual MCP servers
  for (const [name, serverStatus] of Object.entries(status.mcpServers)) {
    if (serverStatus !== 'connected') {
      logger.warn(`MCP server ${name} not connected`);
    }
  }
}, 30000); // Every 30 seconds
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

EXPOSE 3000

CMD ["node", "dist/cli.js", "start"]
```

### Docker Compose

```yaml
version: '3.8'

services:
  mcp-server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - NODE_ENV=production
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    volumes:
      - ./config:/app/config
      - ./logs:/app/logs
    restart: unless-stopped
```

### Production Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure appropriate CORS origins
- [ ] Set up rate limiting
- [ ] Enable HTTPS
- [ ] Configure log rotation
- [ ] Set up health check monitoring
- [ ] Configure process manager (PM2, systemd)
- [ ] Set up firewall rules
- [ ] Enable security headers (Helmet)
- [ ] Configure environment variables securely

## Troubleshooting

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:** Change the port in configuration or stop the process using port 3000.

### MCP Server Connection Failed

**Solution:**
1. Verify the MCP server command is correct
2. Check environment variables are set
3. Review logs for specific error messages
4. Test the MCP server independently

### WebSocket Connection Issues

**Solution:**
1. Verify WebSocket URL is correct
2. Check CORS configuration
3. Ensure firewall allows WebSocket connections
4. Check for proxy/load balancer WebSocket support

## Development

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-wp.git
cd mcp-wp/packages/mcp-server

# Install dependencies
pnpm install

# Run in development mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development guidelines.

## License

MIT

## Related Packages

- [@mcp-wp/core](../core) - Core widget protocol
- [@mcp-wp/bridge](../bridge) - MCP bridge implementation
- [@mcp-wp/dashboard](../dashboard) - Dashboard orchestrator
- [@mcp-wp/eventbus](../eventbus) - Event bus system

## Support

- [Documentation](https://docs.mcp-wp.dev)
- [Discord Community](https://discord.gg/mcp-wp)
- [GitHub Issues](https://github.com/your-org/mcp-wp/issues)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/mcp-wp)
