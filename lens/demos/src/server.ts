/**
 * MOP Demo Server
 *
 * Express server that:
 * 1. Hosts the dashboard UI
 * 2. Starts MCP servers
 * 3. Provides MCP Bridge API via HTTP and WebSocket
 */

import express, { Request, Response } from 'express';
import cors from 'cors';
import { WebSocketServer, WebSocket } from 'ws';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Types
interface ServerConfig {
  name: string;
  command: string;
  args: string[];
  description: string;
}

interface PipelineStep {
  server: string;
  tool: string;
  args: Record<string, any>;
}

interface ExamplePipeline {
  name: string;
  description: string;
  steps: PipelineStep[];
}

interface Config {
  servers: ServerConfig[];
  examples: ExamplePipeline[];
}

interface MCPServerInstance {
  client: Client;
  config: ServerConfig;
  state: 'connected' | 'disconnected' | 'error';
}

// Load configuration
const config: Config = JSON.parse(
  readFileSync(join(__dirname, '../config.json'), 'utf-8')
);

// Express app
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(join(__dirname, '../public')));

// MCP Server Management
const mcpServers = new Map<string, MCPServerInstance>();

async function startMCPServer(serverConfig: ServerConfig): Promise<Client> {
  console.log(`Starting MCP server: ${serverConfig.name}`);

  const transport = new StdioClientTransport({
    command: serverConfig.command,
    args: serverConfig.args
  });

  const client = new Client(
    {
      name: 'mop-demo-client',
      version: '1.0.0'
    },
    {
      capabilities: {}
    }
  );

  await client.connect(transport);

  mcpServers.set(serverConfig.name, {
    client,
    config: serverConfig,
    state: 'connected'
  });

  console.log(`✓ ${serverConfig.name} connected`);
  return client;
}

// Start all MCP servers
async function initializeMCPServers(): Promise<void> {
  console.log('Initializing MCP servers...');

  for (const serverConfig of config.servers) {
    try {
      await startMCPServer(serverConfig);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to start ${serverConfig.name}:`, message);
    }
  }

  console.log(`\n✓ ${mcpServers.size} MCP servers running\n`);
}

// API Routes

// Get all servers and their status
app.get('/api/servers', (req: Request, res: Response) => {
  const servers = [];

  for (const [name, server] of mcpServers) {
    servers.push({
      name,
      description: server.config.description,
      state: server.state,
      capabilities: server.client.getServerCapabilities()
    });
  }

  res.json({ servers });
});

// List tools from a server
app.get('/api/servers/:name/tools', async (req: Request, res: Response) => {
  const { name } = req.params;
  const server = mcpServers.get(name);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  try {
    const result = await server.client.listTools();
    res.json({ tools: result.tools || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// List resources from a server
app.get('/api/servers/:name/resources', async (req: Request, res: Response) => {
  const { name } = req.params;
  const server = mcpServers.get(name);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  try {
    const result = await server.client.listResources();
    res.json({ resources: result.resources || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Call a tool
app.post('/api/servers/:name/tools/:toolName', async (req: Request, res: Response) => {
  const { name, toolName } = req.params;
  const { arguments: args } = req.body;

  const server = mcpServers.get(name);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  try {
    const result = await server.client.callTool({
      name: toolName,
      arguments: args || {}
    });

    res.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Read a resource
app.get('/api/servers/:name/resources/:uri', async (req: Request, res: Response) => {
  const { name, uri } = req.params;
  const server = mcpServers.get(name);

  if (!server) {
    return res.status(404).json({ error: 'Server not found' });
  }

  try {
    const result = await server.client.readResource({ uri });
    res.json({ resource: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// Get example pipelines
app.get('/api/examples', (req: Request, res: Response) => {
  res.json({ examples: config.examples || [] });
});

// Execute an example pipeline
app.post('/api/examples/:name/execute', async (req: Request, res: Response) => {
  const { name } = req.params;
  const example = config.examples.find(e => e.name === name);

  if (!example) {
    return res.status(404).json({ error: 'Example not found' });
  }

  const results: any[] = [];
  const context: Record<string, any> = {};

  try {
    for (const step of example.steps) {
      const server = mcpServers.get(step.server);

      if (!server) {
        throw new Error(`Server ${step.server} not found`);
      }

      // Replace placeholders in args with previous results
      const args = replaceContextPlaceholders(step.args, context);

      const result = await server.client.callTool({
        name: step.tool,
        arguments: args
      });

      results.push({
        server: step.server,
        tool: step.tool,
        result
      });

      // Store result in context for next step
      context.previous_result = result;
    }

    res.json({ success: true, results });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message, results });
  }
});

// Helper function to replace context placeholders
function replaceContextPlaceholders(
  args: Record<string, any>,
  context: Record<string, any>
): Record<string, any> {
  const replaced: Record<string, any> = {};

  for (const [key, value] of Object.entries(args)) {
    if (typeof value === 'string' && value.startsWith('{{') && value.endsWith('}}')) {
      const contextKey = value.slice(2, -2);
      replaced[key] = context[contextKey] || value;
    } else {
      replaced[key] = value;
    }
  }

  return replaced;
}

// Start server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, async () => {
  console.log(`\nMOP Demo Server running on http://localhost:${PORT}\n`);

  // Initialize MCP servers
  await initializeMCPServers();

  console.log(`Dashboard ready at http://localhost:${PORT}`);
  console.log('Press Ctrl+C to stop\n');
});

// WebSocket server for real-time events
const wss = new WebSocketServer({ server });

wss.on('connection', (ws: WebSocket) => {
  console.log('Client connected');

  ws.on('message', (message: Buffer) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('Received:', data);

      // Handle WebSocket messages (tool calls, etc.)
      ws.send(JSON.stringify({ echo: data }));
    } catch (error) {
      console.error('WebSocket error:', error);
    }
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });

  // Send initial server list
  ws.send(JSON.stringify({
    type: 'server_list',
    servers: Array.from(mcpServers.keys())
  }));
});

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down MCP servers...');

  for (const [name, server] of mcpServers) {
    try {
      server.client.close();
      console.log(`✓ ${name} stopped`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Failed to stop ${name}:`, message);
    }
  }

  process.exit(0);
});
