/**
 * Type Guard Utilities
 *
 * Runtime type checking functions for MWP types.
 */

import type {
  ToolResult,
  ToolContent,
  ResourceContent,
  PromptMessages,
  PromptMessage,
} from '../types/dependencies.js';
import type {
  MCPServerInfo,
  MCPTool,
  MCPResource,
  MCPPrompt,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
} from '../types/mcp.js';
import type {
  WidgetFactory,
  WidgetAPI,
  WidgetMetadata,
  WidgetStatus,
  ResourceUsage,
} from '../types/widget.js';
import type { ErrorInfo } from '../types/events.js';

/**
 * Check if value is a valid ToolResult
 */
export function isToolResult(value: unknown): value is ToolResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const result = value as Record<string, unknown>;

  return (
    Array.isArray(result.content) &&
    (result.isError === undefined || typeof result.isError === 'boolean')
  );
}

/**
 * Check if value is valid ToolContent
 */
export function isToolContent(value: unknown): value is ToolContent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const content = value as Record<string, unknown>;

  if (typeof content.type !== 'string') {
    return false;
  }

  if (!['text', 'image', 'resource'].includes(content.type)) {
    return false;
  }

  // Type-specific validation
  if (content.type === 'text' && typeof content.text !== 'string') {
    return false;
  }

  if (content.type === 'image') {
    if (typeof content.data !== 'string' || typeof content.mimeType !== 'string') {
      return false;
    }
  }

  if (content.type === 'resource' && typeof content.resource !== 'string') {
    return false;
  }

  return true;
}

/**
 * Check if value is valid ResourceContent
 */
export function isResourceContent(value: unknown): value is ResourceContent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const content = value as Record<string, unknown>;

  return (
    typeof content.uri === 'string' &&
    (content.mimeType === undefined || typeof content.mimeType === 'string') &&
    (content.text === undefined || typeof content.text === 'string') &&
    (content.blob === undefined || typeof content.blob === 'string')
  );
}

/**
 * Check if value is valid PromptMessages
 */
export function isPromptMessages(value: unknown): value is PromptMessages {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const messages = value as Record<string, unknown>;

  return (
    (messages.description === undefined || typeof messages.description === 'string') &&
    Array.isArray(messages.messages) &&
    messages.messages.every(isPromptMessage)
  );
}

/**
 * Check if value is valid PromptMessage
 */
export function isPromptMessage(value: unknown): value is PromptMessage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const message = value as Record<string, unknown>;

  return (
    (message.role === 'user' || message.role === 'assistant') &&
    typeof message.content === 'object' &&
    message.content !== null
  );
}

/**
 * Check if value is valid MCPServerInfo
 */
export function isMCPServerInfo(value: unknown): value is MCPServerInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const info = value as Record<string, unknown>;

  return (
    typeof info.serverName === 'string' &&
    (info.transport === 'stdio' || info.transport === 'http') &&
    typeof info.protocolVersion === 'string' &&
    typeof info.capabilities === 'object' &&
    Array.isArray(info.tools) &&
    Array.isArray(info.resources) &&
    Array.isArray(info.prompts)
  );
}

/**
 * Check if value is valid MCPTool
 */
export function isMCPTool(value: unknown): value is MCPTool {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const tool = value as Record<string, unknown>;

  return (
    typeof tool.name === 'string' &&
    (tool.description === undefined || typeof tool.description === 'string') &&
    typeof tool.inputSchema === 'object' &&
    tool.inputSchema !== null
  );
}

/**
 * Check if value is valid MCPResource
 */
export function isMCPResource(value: unknown): value is MCPResource {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const resource = value as Record<string, unknown>;

  return (
    typeof resource.uri === 'string' &&
    typeof resource.name === 'string' &&
    (resource.description === undefined || typeof resource.description === 'string') &&
    (resource.mimeType === undefined || typeof resource.mimeType === 'string')
  );
}

/**
 * Check if value is valid MCPPrompt
 */
export function isMCPPrompt(value: unknown): value is MCPPrompt {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const prompt = value as Record<string, unknown>;

  return (
    typeof prompt.name === 'string' &&
    (prompt.description === undefined || typeof prompt.description === 'string') &&
    (prompt.arguments === undefined || Array.isArray(prompt.arguments))
  );
}

/**
 * Check if value is valid JSON-RPC Request
 */
export function isJSONRPCRequest(value: unknown): value is JSONRPCRequest {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const request = value as Record<string, unknown>;

  return (
    request.jsonrpc === '2.0' &&
    typeof request.method === 'string' &&
    (request.id === undefined ||
      typeof request.id === 'string' ||
      typeof request.id === 'number') &&
    (request.params === undefined ||
      (typeof request.params === 'object' && request.params !== null))
  );
}

/**
 * Check if value is valid JSON-RPC Response
 */
export function isJSONRPCResponse(value: unknown): value is JSONRPCResponse {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const response = value as Record<string, unknown>;

  return (
    response.jsonrpc === '2.0' &&
    (typeof response.id === 'string' ||
      typeof response.id === 'number' ||
      response.id === null) &&
    (response.result !== undefined || response.error !== undefined)
  );
}

/**
 * Check if value is valid JSON-RPC Error
 */
export function isJSONRPCError(value: unknown): value is JSONRPCError {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const error = value as Record<string, unknown>;

  return typeof error.code === 'number' && typeof error.message === 'string';
}

/**
 * Check if value is valid WidgetFactory
 */
export function isWidgetFactory(value: unknown): value is WidgetFactory {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const factory = value as Record<string, unknown>;

  return (
    typeof factory.api === 'object' &&
    factory.api !== null &&
    isWidgetAPI(factory.api) &&
    typeof factory.widget === 'object' &&
    factory.widget !== null &&
    isWidgetMetadata(factory.widget)
  );
}

/**
 * Check if value is valid WidgetAPI
 */
export function isWidgetAPI(value: unknown): value is WidgetAPI {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const api = value as Record<string, unknown>;

  return (
    typeof api.initialize === 'function' &&
    typeof api.destroy === 'function' &&
    typeof api.refresh === 'function'
  );
}

/**
 * Check if value is valid WidgetMetadata
 */
export function isWidgetMetadata(value: unknown): value is WidgetMetadata {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const metadata = value as Record<string, unknown>;

  return (
    typeof metadata.protocolVersion === 'string' &&
    typeof metadata.element === 'string' &&
    typeof metadata.displayName === 'string' &&
    typeof metadata.capabilities === 'object' &&
    metadata.capabilities !== null
  );
}

/**
 * Check if value is valid WidgetStatus
 */
export function isWidgetStatus(value: unknown): value is WidgetStatus {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const status = value as Record<string, unknown>;

  return (
    (status.status === 'healthy' ||
      status.status === 'degraded' ||
      status.status === 'error' ||
      status.status === 'initializing') &&
    (status.message === undefined || typeof status.message === 'string')
  );
}

/**
 * Check if value is valid ResourceUsage
 */
export function isResourceUsage(value: unknown): value is ResourceUsage {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const usage = value as Record<string, unknown>;

  return (
    typeof usage.memory === 'number' &&
    typeof usage.renderTime === 'number' &&
    (usage.bundleSize === undefined || typeof usage.bundleSize === 'number') &&
    (usage.domNodes === undefined || typeof usage.domNodes === 'number')
  );
}

/**
 * Check if value is valid ErrorInfo
 */
export function isErrorInfo(value: unknown): value is ErrorInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const error = value as Record<string, unknown>;

  return (
    (typeof error.code === 'number' || typeof error.code === 'string') &&
    typeof error.message === 'string'
  );
}

/**
 * Check if value is Error object
 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/**
 * Check if value is a function
 */
export function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

/**
 * Check if value is a Promise
 */
export function isPromise<T = unknown>(value: unknown): value is Promise<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'then' in value &&
    typeof (value as { then: unknown }).then === 'function'
  );
}

/**
 * Check if value is plain object (not array, not null, not class instance)
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === '[object Object]'
  );
}

/**
 * Check if value is empty (null, undefined, empty string, empty array, empty object)
 */
export function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  if (typeof value === 'string' || Array.isArray(value)) {
    return value.length === 0;
  }

  if (isPlainObject(value)) {
    return Object.keys(value).length === 0;
  }

  return false;
}

/**
 * Assert value is defined (not null or undefined)
 */
export function assertDefined<T>(
  value: T | null | undefined,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new Error(message || 'Value is null or undefined');
  }
}

/**
 * Assert value is of specific type
 */
export function assertType<T>(
  value: unknown,
  typeGuard: (value: unknown) => value is T,
  message?: string
): asserts value is T {
  if (!typeGuard(value)) {
    throw new Error(message || 'Value is not of expected type');
  }
}

/**
 * Check if value is valid HTMLElement
 */
export function isHTMLElement(value: unknown): value is HTMLElement {
  return value instanceof HTMLElement;
}

/**
 * Check if value is valid custom element (has connectedCallback, disconnectedCallback)
 */
export function isCustomElement(value: unknown): value is HTMLElement {
  if (!isHTMLElement(value)) {
    return false;
  }

  return (
    'connectedCallback' in value &&
    typeof value.connectedCallback === 'function' &&
    'disconnectedCallback' in value &&
    typeof value.disconnectedCallback === 'function'
  );
}

/**
 * Check if string is valid URL
 */
export function isValidURL(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if string is valid JSON
 */
export function isValidJSON(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for non-null values
 */
export function isNotNull<T>(value: T | null): value is T {
  return value !== null;
}

/**
 * Type guard for non-undefined values
 */
export function isNotUndefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/**
 * Type guard for defined values (not null and not undefined)
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
