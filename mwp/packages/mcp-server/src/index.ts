/**
 * Main entry point for @mcp-wp/server
 */

export { MCPServer } from './server.js';
export { loadConfig, resolveEnvVariables, getDefaultConfig, mergeConfig } from './config.js';
export { createLogger, logger, logError, logRequest, logMCPEvent, logWSEvent } from './logger.js';

export type {
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
  WSMessageType,
  WSClientContext,
  SecurityConfig,
  LoggingConfig,
  WidgetConfig,
  ToolInfo,
  ResourceInfo,
  EventSubscription,
  ServerContext,
  MCPRequest,
  ErrorResponse,
  SuccessResponse,
} from './types.js';
