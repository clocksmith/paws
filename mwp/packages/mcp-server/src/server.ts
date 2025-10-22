/**
 * Main MCP server implementation
 */

import express, { Express, Request, Response, NextFunction } from 'express';
import { createServer, Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { v4 as uuidv4 } from 'uuid';

import {
  ServerConfig,
  ServerStatus,
  MCPServerConfig,
  MCPServerInfo,
  MCPServerStatus,
  ToolCallRequest,
  ToolCallResponse,
  ResourceRequest,
  ResourceResponse,
  WSMessage,
  WSClientContext,
  ErrorResponse,
  SuccessResponse,
} from './types.js';
import { createLogger, logError, logRequest, logMCPEvent, logWSEvent } from './logger.js';

const DEFAULT_PORT = 3000;
const DEFAULT_HOST = 'localhost';

/**
 * Main MCP server class
 */
export class MCPServer {
  private config: ServerConfig;
  private app: Express;
  private httpServer: HTTPServer | null = null;
  private wsServer: WebSocketServer | null = null;
  private mcpClients: Map<string, Client> = new Map();
  private wsClients: Map<string, WSClientContext> = new Map();
  private logger;
  private startTime: number = Date.now();

  constructor(config: ServerConfig = {}) {
    this.config = {
      port: config.port || DEFAULT_PORT,
      host: config.host || DEFAULT_HOST,
      mcpServers: config.mcpServers || [],
      security: config.security || {},
      logging: config.logging || { level: 'info' },
      widgets: config.widgets || {},
    };

    this.logger = createLogger(this.config.logging);
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Setup Express middleware
   */
  private setupMiddleware(): void {
    // Request ID middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      (req as any).requestId = uuidv4();
      (req as any).startTime = Date.now();
      next();
    });

    // Security middleware
    if (this.config.security?.helmet !== false) {
      this.app.use(helmet(this.config.security?.helmet || {}));
    }

    // CORS middleware
    if (this.config.security?.cors) {
      this.app.use(cors(this.config.security.cors));
    }

    // Compression
    this.app.use(compression());

    // JSON parser
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging middleware
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        const duration = Date.now() - (req as any).startTime;
        logRequest(req.method, req.path, res.statusCode, duration, {
          requestId: (req as any).requestId,
        });
      });
      next();
    });
  }

  /**
   * Setup Express routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/api/health', (req: Request, res: Response) => {
      const status = this.getStatus();
      res.json(status);
    });

    // List MCP servers
    this.app.get('/api/mcp-servers', (req: Request, res: Response) => {
      const servers = this.getMCPServers();
      const response: SuccessResponse<{ servers: MCPServerInfo[] }> = {
        success: true,
        data: { servers },
      };
      res.json(response);
    });

    // Add MCP server
    this.app.post('/api/mcp-servers', async (req: Request, res: Response) => {
      try {
        const config: MCPServerConfig = req.body;

        if (!config.name || !config.command) {
          const error: ErrorResponse = {
            code: 'INVALID_CONFIG',
            message: 'Missing required fields: name and command',
            requestId: (req as any).requestId,
          };
          return res.status(400).json(error);
        }

        await this.addMCPServer(config);

        const response: SuccessResponse = {
          success: true,
          data: {
            server: {
              name: config.name,
              status: 'connected',
            },
          },
        };
        res.status(201).json(response);
      } catch (error: any) {
        logError(error, { requestId: (req as any).requestId });
        const errorResponse: ErrorResponse = {
          code: 'SERVER_ADD_FAILED',
          message: error.message,
          requestId: (req as any).requestId,
        };
        res.status(500).json(errorResponse);
      }
    });

    // Remove MCP server
    this.app.delete('/api/mcp-servers/:name', async (req: Request, res: Response) => {
      try {
        const { name } = req.params;

        if (!this.mcpClients.has(name)) {
          const error: ErrorResponse = {
            code: 'SERVER_NOT_FOUND',
            message: `MCP server '${name}' not found`,
            requestId: (req as any).requestId,
          };
          return res.status(404).json(error);
        }

        await this.removeMCPServer(name);

        const response: SuccessResponse = {
          success: true,
          data: { message: 'Server removed successfully' },
        };
        res.json(response);
      } catch (error: any) {
        logError(error, { requestId: (req as any).requestId });
        const errorResponse: ErrorResponse = {
          code: 'SERVER_REMOVE_FAILED',
          message: error.message,
          requestId: (req as any).requestId,
        };
        res.status(500).json(errorResponse);
      }
    });

    // List available widgets
    this.app.get('/api/widgets', (req: Request, res: Response) => {
      // TODO: Implement widget registry
      const response: SuccessResponse = {
        success: true,
        data: { widgets: [] },
      };
      res.json(response);
    });

    // Error handler
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logError(err, { requestId: (req as any).requestId });
      const error: ErrorResponse = {
        code: 'INTERNAL_ERROR',
        message: err.message,
        requestId: (req as any).requestId,
      };
      res.status(500).json(error);
    });
  }

  /**
   * Setup WebSocket server
   */
  private setupWebSocket(): void {
    if (!this.httpServer) {
      throw new Error('HTTP server not initialized');
    }

    this.wsServer = new WebSocketServer({ server: this.httpServer, path: '/ws' });

    this.wsServer.on('connection', (ws: WebSocket, req) => {
      const clientId = uuidv4();
      const context: WSClientContext = {
        ws,
        clientId,
        subscriptions: new Set(),
      };

      this.wsClients.set(clientId, context);
      logWSEvent(clientId, 'connected', { ip: req.socket.remoteAddress });

      ws.on('message', async (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          await this.handleWSMessage(context, message);
        } catch (error: any) {
          logError(error, { clientId });
          this.sendWSError(ws, 'INVALID_MESSAGE', error.message);
        }
      });

      ws.on('close', () => {
        logWSEvent(clientId, 'disconnected');
        this.wsClients.delete(clientId);
      });

      ws.on('error', (error) => {
        logError(error, { clientId });
      });

      // Send welcome message
      this.sendWSMessage(ws, {
        type: 'event',
        data: {
          event: 'connected',
          clientId,
          servers: Array.from(this.mcpClients.keys()),
        },
      });
    });
  }

  /**
   * Handle WebSocket message
   */
  private async handleWSMessage(context: WSClientContext, message: WSMessage): Promise<void> {
    switch (message.type) {
      case 'subscribe':
        if (message.data?.event) {
          context.subscriptions.add(message.data.event);
          logWSEvent(context.clientId, 'subscribe', { event: message.data.event });
        }
        break;

      case 'unsubscribe':
        if (message.data?.event) {
          context.subscriptions.delete(message.data.event);
          logWSEvent(context.clientId, 'unsubscribe', { event: message.data.event });
        }
        break;

      case 'tool:call':
        await this.handleToolCall(context, message);
        break;

      case 'resource:get':
        await this.handleResourceGet(context, message);
        break;

      case 'ping':
        this.sendWSMessage(context.ws, { type: 'pong', id: message.id });
        break;

      default:
        this.sendWSError(context.ws, 'UNKNOWN_MESSAGE_TYPE', `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle tool call request
   */
  private async handleToolCall(context: WSClientContext, message: WSMessage): Promise<void> {
    try {
      const request: ToolCallRequest = message.data;

      if (!request.server || !request.tool) {
        throw new Error('Missing required fields: server and tool');
      }

      const client = this.mcpClients.get(request.server);
      if (!client) {
        throw new Error(`MCP server '${request.server}' not found`);
      }

      const result = await client.callTool({
        name: request.tool,
        arguments: request.arguments || {},
      });

      const response: ToolCallResponse = {
        id: message.id || uuidv4(),
        success: true,
        result: result.content,
      };

      this.sendWSMessage(context.ws, {
        type: 'tool:response',
        id: response.id,
        data: response,
      });
    } catch (error: any) {
      const response: ToolCallResponse = {
        id: message.id || uuidv4(),
        success: false,
        error: {
          code: 'TOOL_CALL_FAILED',
          message: error.message,
        },
      };

      this.sendWSMessage(context.ws, {
        type: 'tool:response',
        id: response.id,
        data: response,
      });
    }
  }

  /**
   * Handle resource get request
   */
  private async handleResourceGet(context: WSClientContext, message: WSMessage): Promise<void> {
    try {
      const request: ResourceRequest = message.data;

      if (!request.server || !request.uri) {
        throw new Error('Missing required fields: server and uri');
      }

      const client = this.mcpClients.get(request.server);
      if (!client) {
        throw new Error(`MCP server '${request.server}' not found`);
      }

      const result = await client.readResource({ uri: request.uri });

      const response: ResourceResponse = {
        id: message.id || uuidv4(),
        success: true,
        content: result.contents[0],
      };

      this.sendWSMessage(context.ws, {
        type: 'resource:response',
        id: response.id,
        data: response,
      });
    } catch (error: any) {
      const response: ResourceResponse = {
        id: message.id || uuidv4(),
        success: false,
        error: {
          code: 'RESOURCE_GET_FAILED',
          message: error.message,
        },
      };

      this.sendWSMessage(context.ws, {
        type: 'resource:response',
        id: response.id,
        data: response,
      });
    }
  }

  /**
   * Send WebSocket message
   */
  private sendWSMessage(ws: WebSocket, message: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send WebSocket error
   */
  private sendWSError(ws: WebSocket, code: string, message: string): void {
    this.sendWSMessage(ws, {
      type: 'error',
      error: { code, message },
    });
  }

  /**
   * Broadcast event to subscribed clients
   */
  private broadcastEvent(event: string, data: any): void {
    this.wsClients.forEach((context) => {
      if (context.subscriptions.has(event) || context.subscriptions.has('*')) {
        this.sendWSMessage(context.ws, {
          type: 'event',
          data: { event, ...data },
        });
      }
    });
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    // Create HTTP server
    this.httpServer = createServer(this.app);

    // Setup WebSocket
    this.setupWebSocket();

    // Connect to MCP servers
    await Promise.all(
      (this.config.mcpServers || []).map((config) => this.addMCPServer(config))
    );

    // Start listening
    await new Promise<void>((resolve, reject) => {
      this.httpServer!.listen(this.config.port, this.config.host, () => {
        this.logger.info(`Server started on http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.httpServer!.on('error', reject);
    });

    this.startTime = Date.now();
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping server...');

    // Close WebSocket connections
    if (this.wsServer) {
      this.wsServer.clients.forEach((ws) => ws.close());
      this.wsServer.close();
    }

    // Disconnect MCP clients
    await Promise.all(
      Array.from(this.mcpClients.keys()).map((name) => this.removeMCPServer(name))
    );

    // Close HTTP server
    if (this.httpServer) {
      await new Promise<void>((resolve) => {
        this.httpServer!.close(() => resolve());
      });
    }

    this.logger.info('Server stopped');
  }

  /**
   * Add MCP server connection
   */
  async addMCPServer(config: MCPServerConfig): Promise<void> {
    if (this.mcpClients.has(config.name)) {
      throw new Error(`MCP server '${config.name}' already exists`);
    }

    logMCPEvent(config.name, 'connecting', { command: config.command });

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args || [],
        env: { ...process.env, ...config.env },
      });

      const client = new Client({
        name: 'mcp-wp-server',
        version: '1.0.0',
      }, {
        capabilities: {},
      });

      await client.connect(transport);

      this.mcpClients.set(config.name, client);

      logMCPEvent(config.name, 'connected');

      // Broadcast event
      this.broadcastEvent('mcp:server:connected', { server: config.name });
    } catch (error: any) {
      logError(error, { server: config.name });
      throw new Error(`Failed to connect to MCP server '${config.name}': ${error.message}`);
    }
  }

  /**
   * Remove MCP server connection
   */
  async removeMCPServer(name: string): Promise<void> {
    const client = this.mcpClients.get(name);
    if (!client) {
      throw new Error(`MCP server '${name}' not found`);
    }

    logMCPEvent(name, 'disconnecting');

    try {
      await client.close();
      this.mcpClients.delete(name);

      logMCPEvent(name, 'disconnected');

      // Broadcast event
      this.broadcastEvent('mcp:server:disconnected', { server: name });
    } catch (error: any) {
      logError(error, { server: name });
      throw error;
    }
  }

  /**
   * Get server status
   */
  getStatus(): ServerStatus {
    const mcpServers: Record<string, MCPServerStatus> = {};

    this.mcpClients.forEach((client, name) => {
      // Simple status check - in production, implement proper health checks
      mcpServers[name] = 'connected';
    });

    const memUsage = process.memoryUsage();

    return {
      status: this.mcpClients.size > 0 ? 'healthy' : 'degraded',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      version: '1.0.0',
      mcpServers,
      connections: {
        websocket: this.wsClients.size,
        http: 0, // TODO: Track active HTTP connections
      },
      memory: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
      },
    };
  }

  /**
   * Get MCP server information
   */
  getMCPServers(): MCPServerInfo[] {
    const servers: MCPServerInfo[] = [];

    this.mcpClients.forEach((client, name) => {
      // TODO: Fetch actual tools and resources from the client
      servers.push({
        name,
        status: 'connected',
        tools: [],
        resources: [],
        capabilities: {
          tools: true,
          resources: true,
        },
      });
    });

    return servers;
  }
}
