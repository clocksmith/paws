/**
 * MCP Server Info and Primitives
 *
 * Types for MCP server metadata and capabilities.
 * Based on MCP Specification (JSON-RPC 2.0, version 2025-06-18)
 */

import type { JSONSchema } from './dependencies.js';

/**
 * MCP Server Info
 *
 * Complete information about an MCP server including its capabilities,
 * tools, resources, and prompts.
 */
export interface MCPServerInfo {
  /**
   * Server identifier (unique name)
   */
  serverName: string;

  /**
   * Transport mechanism
   */
  transport: 'stdio' | 'http';

  /**
   * MCP protocol version (e.g., "2025-06-18")
   */
  protocolVersion: string;

  /**
   * Server capabilities
   */
  capabilities: MCPCapabilities;

  /**
   * Available tools
   */
  tools: MCPTool[];

  /**
   * Available resources
   */
  resources: MCPResource[];

  /**
   * Available prompts
   */
  prompts: MCPPrompt[];

  /**
   * Server metadata
   */
  serverInfo?: MCPServerMetadata;
}

/**
 * MCP Server Metadata
 *
 * Additional information about the MCP server.
 */
export interface MCPServerMetadata {
  /**
   * Server name
   */
  name: string;

  /**
   * Server version
   */
  version: string;

  /**
   * Vendor/author information
   */
  vendor?: string;

  /**
   * Server description
   */
  description?: string;

  /**
   * Server homepage URL
   */
  homepage?: string;

  /**
   * Server documentation URL
   */
  documentation?: string;
}

/**
 * MCP Capabilities
 *
 * Declares what features the MCP server supports.
 */
export interface MCPCapabilities {
  /**
   * Tools capability
   */
  tools?: {
    /**
     * Server emits notifications when tool list changes
     */
    listChanged?: boolean;
  };

  /**
   * Resources capability
   */
  resources?: {
    /**
     * Server supports resource subscriptions
     */
    subscribe?: boolean;

    /**
     * Server emits notifications when resource list changes
     */
    listChanged?: boolean;
  };

  /**
   * Prompts capability
   */
  prompts?: {
    /**
     * Server emits notifications when prompt list changes
     */
    listChanged?: boolean;
  };

  /**
   * Sampling capability (LLM integration)
   */
  sampling?: Record<string, never>; // Empty object indicates support

  /**
   * Roots capability (filesystem roots)
   */
  roots?: {
    /**
     * Server emits notifications when roots list changes
     */
    listChanged?: boolean;
  };

  /**
   * Logging capability
   */
  logging?: Record<string, never>;

  /**
   * Experimental capabilities
   */
  experimental?: Record<string, unknown>;
}

/**
 * MCP Tool
 *
 * Tool definition from MCP server.
 */
export interface MCPTool {
  /**
   * Tool name (unique identifier)
   */
  name: string;

  /**
   * Tool description
   */
  description?: string;

  /**
   * Input schema (JSON Schema)
   */
  inputSchema: JSONSchema;

  /**
   * Output schema (optional, MCP extension)
   */
  outputSchema?: JSONSchema;

  /**
   * Tool title (display name)
   */
  title?: string;

  /**
   * Tool annotations (metadata)
   */
  annotations?: ToolAnnotations;
}

/**
 * Tool Annotations
 *
 * Additional metadata for tools (MCP extension).
 */
export interface ToolAnnotations {
  /**
   * Audience (user-facing vs internal)
   */
  audience?: 'user' | 'assistant';

  /**
   * Progress reporting capability
   */
  progress?: boolean;

  /**
   * Expected execution time
   */
  executionTime?: 'fast' | 'medium' | 'slow';

  /**
   * Tool category
   */
  category?: string;

  /**
   * Tool tags
   */
  tags?: string[];

  /**
   * Custom annotations
   */
  [key: string]: unknown;
}

/**
 * MCP Resource
 *
 * Resource definition from MCP server.
 */
export interface MCPResource {
  /**
   * Resource URI (unique identifier)
   */
  uri: string;

  /**
   * Resource name (display name)
   */
  name: string;

  /**
   * Resource description
   */
  description?: string;

  /**
   * MIME type
   */
  mimeType?: string;

  /**
   * Resource size (in bytes)
   */
  size?: number;

  /**
   * Resource annotations (metadata)
   */
  annotations?: ResourceAnnotations;
}

/**
 * Resource Annotations
 *
 * Additional metadata for resources (MCP extension).
 */
export interface ResourceAnnotations {
  /**
   * Audience (user-facing vs internal)
   */
  audience?: 'user' | 'assistant';

  /**
   * Resource category
   */
  category?: string;

  /**
   * Resource tags
   */
  tags?: string[];

  /**
   * Last modified timestamp
   */
  lastModified?: string;

  /**
   * Resource permissions
   */
  permissions?: 'read' | 'write' | 'readwrite';

  /**
   * Custom annotations
   */
  [key: string]: unknown;
}

/**
 * MCP Prompt
 *
 * Prompt template definition from MCP server.
 */
export interface MCPPrompt {
  /**
   * Prompt name (unique identifier)
   */
  name: string;

  /**
   * Prompt description
   */
  description?: string;

  /**
   * Prompt arguments
   */
  arguments?: MCPPromptArgument[];

  /**
   * Prompt title (display name)
   */
  title?: string;

  /**
   * Prompt annotations (metadata)
   */
  annotations?: PromptAnnotations;
}

/**
 * Prompt Argument
 *
 * Argument definition for prompt template.
 */
export interface MCPPromptArgument {
  /**
   * Argument name
   */
  name: string;

  /**
   * Argument description
   */
  description?: string;

  /**
   * Whether argument is required
   */
  required?: boolean;
}

/**
 * Prompt Annotations
 *
 * Additional metadata for prompts (MCP extension).
 */
export interface PromptAnnotations {
  /**
   * Audience (user-facing vs internal)
   */
  audience?: 'user' | 'assistant';

  /**
   * Prompt category
   */
  category?: string;

  /**
   * Prompt tags
   */
  tags?: string[];

  /**
   * Use case examples
   */
  examples?: string[];

  /**
   * Custom annotations
   */
  [key: string]: unknown;
}

/**
 * MCP Root
 *
 * Filesystem root definition (for filesystem servers).
 */
export interface MCPRoot {
  /**
   * Root URI
   */
  uri: string;

  /**
   * Root name
   */
  name?: string;
}

/**
 * MCP Implementation Info
 *
 * Information about MCP client/server implementation.
 */
export interface MCPImplementationInfo {
  /**
   * Implementation name
   */
  name: string;

  /**
   * Implementation version
   */
  version: string;
}

/**
 * JSON-RPC Request
 *
 * Standard JSON-RPC 2.0 request structure.
 */
export interface JSONRPCRequest {
  /**
   * JSON-RPC version (always "2.0")
   */
  jsonrpc: '2.0';

  /**
   * Request ID (for matching responses)
   */
  id?: string | number;

  /**
   * Method name
   */
  method: string;

  /**
   * Method parameters
   */
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC Response
 *
 * Standard JSON-RPC 2.0 response structure.
 */
export interface JSONRPCResponse {
  /**
   * JSON-RPC version (always "2.0")
   */
  jsonrpc: '2.0';

  /**
   * Request ID (matches request)
   */
  id: string | number | null;

  /**
   * Response result (if successful)
   */
  result?: unknown;

  /**
   * Response error (if failed)
   */
  error?: JSONRPCError;
}

/**
 * JSON-RPC Error
 *
 * Standard JSON-RPC 2.0 error structure.
 */
export interface JSONRPCError {
  /**
   * Error code
   */
  code: number;

  /**
   * Error message
   */
  message: string;

  /**
   * Additional error data
   */
  data?: unknown;
}

/**
 * JSON-RPC Error Codes
 *
 * Standard and MCP-specific error codes.
 */
export enum JSONRPCErrorCode {
  // Standard JSON-RPC errors
  ParseError = -32700,
  InvalidRequest = -32600,
  MethodNotFound = -32601,
  InvalidParams = -32602,
  InternalError = -32603,

  // MCP-specific errors
  ConnectionClosed = -32000,
  RequestTimeout = -32001,
  ResourceNotFound = -32002,
  ToolNotFound = -32003,
  PromptNotFound = -32004,
  InvalidToolArguments = -32005,
  ToolExecutionError = -32006,
  ResourceReadError = -32007,
  PromptGetError = -32008,
  SamplingError = -32009,
}

/**
 * MCP Notification
 *
 * Server-to-client notification (no response expected).
 */
export interface MCPNotification {
  /**
   * JSON-RPC version (always "2.0")
   */
  jsonrpc: '2.0';

  /**
   * Method name
   */
  method: string;

  /**
   * Notification parameters
   */
  params?: Record<string, unknown>;
}

/**
 * MCP Session State
 *
 * Current state of MCP client-server session.
 */
export type MCPSessionState =
  | 'uninitialized'
  | 'initializing'
  | 'initialized'
  | 'operating'
  | 'shutdown'
  | 'error';

/**
 * MCP Connection Info
 *
 * Information about MCP connection.
 */
export interface MCPConnectionInfo {
  /**
   * Server name
   */
  serverName: string;

  /**
   * Connection state
   */
  state: MCPSessionState;

  /**
   * Transport type
   */
  transport: 'stdio' | 'http';

  /**
   * Last activity timestamp
   */
  lastActivity?: Date;

  /**
   * Error information (if state is 'error')
   */
  error?: {
    code: number;
    message: string;
    details?: unknown;
  };
}

/**
 * Type guard: Check if capabilities include tools
 */
export function hasToolsCapability(
  capabilities: MCPCapabilities
): capabilities is MCPCapabilities & { tools: NonNullable<MCPCapabilities['tools']> } {
  return capabilities.tools !== undefined;
}

/**
 * Type guard: Check if capabilities include resources
 */
export function hasResourcesCapability(
  capabilities: MCPCapabilities
): capabilities is MCPCapabilities & { resources: NonNullable<MCPCapabilities['resources']> } {
  return capabilities.resources !== undefined;
}

/**
 * Type guard: Check if capabilities include prompts
 */
export function hasPromptsCapability(
  capabilities: MCPCapabilities
): capabilities is MCPCapabilities & { prompts: NonNullable<MCPCapabilities['prompts']> } {
  return capabilities.prompts !== undefined;
}

/**
 * Type guard: Check if capabilities include sampling
 */
export function hasSamplingCapability(
  capabilities: MCPCapabilities
): capabilities is MCPCapabilities & { sampling: NonNullable<MCPCapabilities['sampling']> } {
  return capabilities.sampling !== undefined;
}

/**
 * Type guard: Check if resources capability supports subscriptions
 */
export function supportsResourceSubscriptions(
  capabilities: MCPCapabilities
): boolean {
  return capabilities.resources?.subscribe === true;
}
