/**
 * Type definitions for the MCP server
 */

import { Server as HTTPServer } from 'http';
import { Server as WebSocketServer, WebSocket } from 'ws';
import { Express } from 'express';

/**
 * Main server configuration
 */
export interface ServerConfig {
  /** Port to listen on (default: 3000) */
  port?: number;

  /** Host to bind to (default: localhost) */
  host?: string;

  /** MCP servers to connect to */
  mcpServers?: MCPServerConfig[];

  /** Security configuration */
  security?: SecurityConfig;

  /** Logging configuration */
  logging?: LoggingConfig;

  /** Widget configuration */
  widgets?: WidgetConfig;
}

/**
 * Configuration for an MCP server connection
 */
export interface MCPServerConfig {
  /** Unique name for this MCP server */
  name: string;

  /** Command to execute */
  command: string;

  /** Command arguments */
  args?: string[];

  /** Environment variables */
  env?: Record<string, string>;

  /** Transport protocol */
  transport?: 'stdio' | 'sse' | 'websocket';

  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    maxAttempts: number;
    delayMs: number;
  };
}

/**
 * Security configuration
 */
export interface SecurityConfig {
  /** CORS configuration */
  cors?: {
    origin: string | string[] | boolean;
    credentials?: boolean;
    methods?: string[];
    allowedHeaders?: string[];
  };

  /** Rate limiting configuration */
  rateLimit?: {
    windowMs: number;
    max: number;
    message?: string;
  };

  /** Helmet security options */
  helmet?: boolean | Record<string, any>;

  /** Enable HTTPS */
  https?: {
    cert: string;
    key: string;
  };
}

/**
 * Logging configuration
 */
export interface LoggingConfig {
  /** Log level */
  level: 'error' | 'warn' | 'info' | 'debug';

  /** Log file path (optional) */
  file?: string;

  /** Enable console logging */
  console?: boolean;

  /** Log format */
  format?: 'json' | 'simple';
}

/**
 * Widget configuration
 */
export interface WidgetConfig {
  /** Widget directory paths */
  paths?: string[];

  /** Enable hot reloading */
  hotReload?: boolean;

  /** Widget registry URL */
  registry?: string;
}

/**
 * Server status information
 */
export interface ServerStatus {
  /** Overall server status */
  status: 'healthy' | 'degraded' | 'unhealthy';

  /** Server uptime in seconds */
  uptime: number;

  /** Server version */
  version: string;

  /** MCP server statuses */
  mcpServers: Record<string, MCPServerStatus>;

  /** Active connections */
  connections: {
    websocket: number;
    http: number;
  };

  /** Memory usage */
  memory?: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

/**
 * MCP server status
 */
export type MCPServerStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

/**
 * Information about a connected MCP server
 */
export interface MCPServerInfo {
  /** Server name */
  name: string;

  /** Connection status */
  status: MCPServerStatus;

  /** Available tools */
  tools: ToolInfo[];

  /** Available resources */
  resources: ResourceInfo[];

  /** Server capabilities */
  capabilities?: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

/**
 * Tool information
 */
export interface ToolInfo {
  /** Tool name */
  name: string;

  /** Tool description */
  description?: string;

  /** Input schema */
  inputSchema?: Record<string, any>;
}

/**
 * Resource information
 */
export interface ResourceInfo {
  /** Resource URI */
  uri: string;

  /** Resource name */
  name: string;

  /** Resource description */
  description?: string;

  /** MIME type */
  mimeType?: string;
}

/**
 * WebSocket message types
 */
export type WSMessageType =
  | 'subscribe'
  | 'unsubscribe'
  | 'tool:call'
  | 'tool:response'
  | 'resource:get'
  | 'resource:response'
  | 'event'
  | 'error'
  | 'ping'
  | 'pong';

/**
 * WebSocket message structure
 */
export interface WSMessage {
  /** Message type */
  type: WSMessageType;

  /** Message ID for request/response correlation */
  id?: string;

  /** Message payload */
  data?: any;

  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Tool call request
 */
export interface ToolCallRequest {
  /** MCP server name */
  server: string;

  /** Tool name */
  tool: string;

  /** Tool arguments */
  arguments: Record<string, any>;

  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Tool call response
 */
export interface ToolCallResponse {
  /** Request ID */
  id: string;

  /** Success flag */
  success: boolean;

  /** Result data */
  result?: any;

  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Resource request
 */
export interface ResourceRequest {
  /** MCP server name */
  server: string;

  /** Resource URI */
  uri: string;
}

/**
 * Resource response
 */
export interface ResourceResponse {
  /** Request ID */
  id: string;

  /** Success flag */
  success: boolean;

  /** Resource content */
  content?: {
    uri: string;
    mimeType?: string;
    text?: string;
    blob?: string;
  };

  /** Error information */
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

/**
 * Event subscription
 */
export interface EventSubscription {
  /** Event name or pattern */
  event: string;

  /** Subscription callback */
  callback: (data: any) => void;
}

/**
 * Server context passed to handlers
 */
export interface ServerContext {
  /** Express app instance */
  app: Express;

  /** HTTP server instance */
  httpServer: HTTPServer;

  /** WebSocket server instance */
  wsServer: WebSocketServer;

  /** Server configuration */
  config: ServerConfig;

  /** Logger instance */
  logger: any;

  /** MCP servers map */
  mcpServers: Map<string, any>;
}

/**
 * WebSocket client context
 */
export interface WSClientContext {
  /** WebSocket connection */
  ws: WebSocket;

  /** Client ID */
  clientId: string;

  /** Active subscriptions */
  subscriptions: Set<string>;

  /** Client metadata */
  metadata?: Record<string, any>;
}

/**
 * HTTP request with custom properties
 */
export interface MCPRequest extends Express.Request {
  /** Request ID */
  requestId?: string;

  /** Client IP */
  clientIp?: string;

  /** Request start time */
  startTime?: number;
}

/**
 * Error response structure
 */
export interface ErrorResponse {
  /** Error code */
  code: string;

  /** Error message */
  message: string;

  /** Additional error details */
  details?: any;

  /** Request ID for tracking */
  requestId?: string;

  /** Timestamp */
  timestamp?: string;
}

/**
 * Success response structure
 */
export interface SuccessResponse<T = any> {
  /** Success flag */
  success: true;

  /** Response data */
  data: T;

  /** Response metadata */
  metadata?: {
    timestamp: string;
    requestId?: string;
  };
}
