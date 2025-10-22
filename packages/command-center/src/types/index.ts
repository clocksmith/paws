/**
 * Type definitions for PAWS Command Center
 */

import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  CallToolResult,
  ReadResourceResult,
  GetPromptResult
} from "@modelcontextprotocol/sdk/types.js";

/**
 * Server configuration for MCP servers
 */
export interface ServerConfig {
  /** Unique identifier for the server */
  name: string;

  /** Command to execute (node, python, npx, etc.) */
  command: string;

  /** Arguments to pass to the command */
  args: string[];

  /** Optional environment variables */
  env?: Record<string, string>;

  /** Whether this server is trusted for auto-approval */
  trusted?: boolean;

  /** Optional description */
  description?: string;
}

/**
 * Filesystem root configuration
 */
export interface Root {
  /** File URI (must start with file://) */
  uri: string;

  /** Human-readable name for the root */
  name: string;
}

/**
 * Sampling request from a server
 */
export interface SamplingRequest {
  /** ID of the server making the request */
  serverId: string;

  /** Messages to send to the LLM */
  messages: Array<{
    role: "user" | "assistant";
    content: string;
  }>;

  /** Model preferences */
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };

  /** Optional system prompt */
  systemPrompt?: string;

  /** Maximum tokens to generate */
  maxTokens?: number;

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Sampling response
 */
export interface SamplingResponse {
  /** Generated content */
  content: string;

  /** Model used */
  model: string;

  /** Stop reason */
  stopReason?: "end_turn" | "max_tokens" | "stop_sequence";

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Elicitation request
 */
export interface ElicitationRequest {
  /** ID of the server making the request */
  serverId: string;

  /** Message explaining what information is needed */
  message: string;

  /** JSON Schema for the expected input */
  schema: {
    type: "object";
    properties: Record<string, {
      type: string;
      description?: string;
      enum?: string[];
      default?: unknown;
    }>;
    required?: string[];
  };

  /** Optional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Elicitation response
 */
export interface ElicitationResponse {
  /** User-provided data matching the schema */
  data: Record<string, unknown>;

  /** Whether the user approved */
  approved: boolean;

  /** Optional cancellation reason */
  cancellationReason?: string;
}

/**
 * Approval request for human-in-the-loop
 */
export interface ApprovalRequest {
  /** Type of approval needed */
  type: "sampling" | "tool_call" | "resource_access" | "modification";

  /** Server requesting approval */
  serverId: string;

  /** Title for the approval dialog */
  title: string;

  /** Detailed message */
  message: string;

  /** Additional context */
  context?: Record<string, unknown>;

  /** Default action (approve/deny) */
  defaultAction?: "approve" | "deny";
}

/**
 * Workflow context for agentic operations
 */
export interface WorkflowContext {
  /** Active servers in the workflow */
  servers: string[];

  /** Current filesystem roots */
  roots: Root[];

  /** Workflow state */
  state: Record<string, unknown>;

  /** History of operations */
  history: Array<{
    timestamp: Date;
    serverId: string;
    operation: string;
    result: unknown;
  }>;
}

/**
 * Connected server instance
 */
export interface ConnectedServer {
  /** Server configuration */
  config: ServerConfig;

  /** MCP client instance */
  client: Client;

  /** Available capabilities */
  capabilities: {
    resources?: boolean;
    tools?: boolean;
    prompts?: boolean;
    sampling?: boolean;
  };

  /** Connection status */
  status: "connected" | "disconnected" | "error";

  /** Optional error message */
  error?: string;
}

/**
 * Command Center configuration
 */
export interface CommandCenterConfig {
  /** List of servers to connect to */
  servers: ServerConfig[];

  /** Initial filesystem roots */
  roots?: Root[];

  /** Whether to require approval for all operations */
  requireApproval?: boolean;

  /** Trusted server names that can skip some approvals */
  trustedServers?: string[];

  /** Logging configuration */
  logging?: {
    level: "debug" | "info" | "warn" | "error";
    file?: string;
  };
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  /** Whether to require user approval */
  requireApproval?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Retry configuration */
  retry?: {
    attempts: number;
    delay: number;
  };
}

/**
 * Resource read options
 */
export interface ResourceReadOptions {
  /** Cache the result */
  cache?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;
}

export type { CallToolResult, ReadResourceResult, GetPromptResult };
