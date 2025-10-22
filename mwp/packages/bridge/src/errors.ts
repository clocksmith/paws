/**
 * Bridge Error Classes
 *
 * Custom error types for MCPBridge operations.
 */

/**
 * Base MCPBridge Error
 */
export class MCPBridgeError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'BRIDGE_ERROR',
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'MCPBridgeError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Connection Error
 */
export class ConnectionError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly serverName: string,
    details?: unknown
  ) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
  }
}

/**
 * Tool Execution Error
 */
export class ToolExecutionError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly serverName: string,
    public readonly toolName: string,
    details?: unknown
  ) {
    super(message, 'TOOL_EXECUTION_ERROR', details);
    this.name = 'ToolExecutionError';
  }
}

/**
 * Resource Read Error
 */
export class ResourceReadError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly serverName: string,
    public readonly uri: string,
    details?: unknown
  ) {
    super(message, 'RESOURCE_READ_ERROR', details);
    this.name = 'ResourceReadError';
  }
}

/**
 * Prompt Get Error
 */
export class PromptGetError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly serverName: string,
    public readonly promptName: string,
    details?: unknown
  ) {
    super(message, 'PROMPT_GET_ERROR', details);
    this.name = 'PromptGetError';
  }
}

/**
 * Timeout Error
 */
export class TimeoutError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly timeoutMs: number
  ) {
    super(message, 'TIMEOUT_ERROR', { operation, timeoutMs });
    this.name = 'TimeoutError';
  }
}

/**
 * Validation Error
 */
export class ValidationError extends MCPBridgeError {
  constructor(
    message: string,
    public readonly field: string,
    details?: unknown
  ) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}
