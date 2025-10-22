/**
 * Event System Types
 *
 * Defines all event types and payloads for the MCP-WP event system.
 * Based on MCP-WP Specification Section 8 (Event System)
 */

import type { ToolResult, ResourceContent, PromptMessages } from './dependencies.js';
import type { MCPServerInfo, MCPTool, MCPResource, MCPPrompt } from './mcp.js';

/**
 * MCP Event Names
 *
 * All possible event names in the MCP-WP system.
 */
export type MCPEvent =
  // Tool events
  | 'mcp:tool:invoke-requested'
  | 'mcp:tool:invoked'
  | 'mcp:tool:error'
  | 'mcp:tool:progress'
  | 'mcp:tools:list-changed'

  // Resource events
  | 'mcp:resource:read-requested'
  | 'mcp:resource:read'
  | 'mcp:resource:updated'
  | 'mcp:resource:error'
  | 'mcp:resource:subscribe-requested'
  | 'mcp:resource:unsubscribe-requested'
  | 'mcp:resources:list-changed'

  // Prompt events
  | 'mcp:prompt:get-requested'
  | 'mcp:prompt:got'
  | 'mcp:prompt:error'
  | 'mcp:prompts:list-changed'

  // Sampling events
  | 'mcp:sampling:requested'
  | 'mcp:sampling:completed'
  | 'mcp:sampling:error'

  // Server events
  | 'mcp:server:connected'
  | 'mcp:server:disconnected'
  | 'mcp:server:error'
  | 'mcp:server:capabilities-changed'

  // Widget lifecycle events
  | 'widget:initialized'
  | 'widget:destroyed'
  | 'widget:error'
  | 'widget:refresh-requested'
  | 'widget:refreshed'

  // Dashboard events
  | 'dashboard:widget-added'
  | 'dashboard:widget-removed'
  | 'dashboard:layout-changed'
  | 'dashboard:theme-changed'
  | 'dashboard:config-changed';

/**
 * Event Payload Map
 *
 * Maps event names to their payload types.
 */
export interface EventPayloadMap {
  // Tool events
  'mcp:tool:invoke-requested': ToolInvokeRequestedPayload;
  'mcp:tool:invoked': ToolInvokedPayload;
  'mcp:tool:error': ToolErrorPayload;
  'mcp:tool:progress': ToolProgressPayload;
  'mcp:tools:list-changed': ToolsListChangedPayload;

  // Resource events
  'mcp:resource:read-requested': ResourceReadRequestedPayload;
  'mcp:resource:read': ResourceReadPayload;
  'mcp:resource:updated': ResourceUpdatedPayload;
  'mcp:resource:error': ResourceErrorPayload;
  'mcp:resource:subscribe-requested': ResourceSubscribeRequestedPayload;
  'mcp:resource:unsubscribe-requested': ResourceUnsubscribeRequestedPayload;
  'mcp:resources:list-changed': ResourcesListChangedPayload;

  // Prompt events
  'mcp:prompt:get-requested': PromptGetRequestedPayload;
  'mcp:prompt:got': PromptGotPayload;
  'mcp:prompt:error': PromptErrorPayload;
  'mcp:prompts:list-changed': PromptsListChangedPayload;

  // Sampling events
  'mcp:sampling:requested': SamplingRequestedPayload;
  'mcp:sampling:completed': SamplingCompletedPayload;
  'mcp:sampling:error': SamplingErrorPayload;

  // Server events
  'mcp:server:connected': ServerConnectedPayload;
  'mcp:server:disconnected': ServerDisconnectedPayload;
  'mcp:server:error': ServerErrorPayload;
  'mcp:server:capabilities-changed': ServerCapabilitiesChangedPayload;

  // Widget lifecycle events
  'widget:initialized': WidgetInitializedPayload;
  'widget:destroyed': WidgetDestroyedPayload;
  'widget:error': WidgetErrorPayload;
  'widget:refresh-requested': WidgetRefreshRequestedPayload;
  'widget:refreshed': WidgetRefreshedPayload;

  // Dashboard events
  'dashboard:widget-added': DashboardWidgetAddedPayload;
  'dashboard:widget-removed': DashboardWidgetRemovedPayload;
  'dashboard:layout-changed': DashboardLayoutChangedPayload;
  'dashboard:theme-changed': DashboardThemeChangedPayload;
  'dashboard:config-changed': DashboardConfigChangedPayload;
}

/**
 * Get event payload type by event name
 */
export type EventPayload<E extends MCPEvent> = EventPayloadMap[E];

// ============================================================================
// Tool Event Payloads
// ============================================================================

export interface ToolInvokeRequestedPayload {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  widgetId?: string;
  requestId?: string;
}

export interface ToolInvokedPayload {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  result: ToolResult;
  widgetId?: string;
  requestId?: string;
  duration?: number; // milliseconds
}

export interface ToolErrorPayload {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  error: ErrorInfo;
  widgetId?: string;
  requestId?: string;
}

export interface ToolProgressPayload {
  serverName: string;
  toolName: string;
  requestId: string;
  progress: number; // 0-100
  message?: string;
  total?: number;
  completed?: number;
}

export interface ToolsListChangedPayload {
  serverName: string;
  tools: MCPTool[];
}

// ============================================================================
// Resource Event Payloads
// ============================================================================

export interface ResourceReadRequestedPayload {
  serverName: string;
  uri: string;
  widgetId?: string;
  requestId?: string;
}

export interface ResourceReadPayload {
  serverName: string;
  uri: string;
  content: ResourceContent;
  widgetId?: string;
  requestId?: string;
  cached?: boolean;
}

export interface ResourceUpdatedPayload {
  serverName: string;
  uri: string;
  content: ResourceContent;
}

export interface ResourceErrorPayload {
  serverName: string;
  uri: string;
  error: ErrorInfo;
  widgetId?: string;
  requestId?: string;
}

export interface ResourceSubscribeRequestedPayload {
  serverName: string;
  uri: string;
  widgetId: string;
}

export interface ResourceUnsubscribeRequestedPayload {
  serverName: string;
  uri: string;
  widgetId: string;
}

export interface ResourcesListChangedPayload {
  serverName: string;
  resources: MCPResource[];
}

// ============================================================================
// Prompt Event Payloads
// ============================================================================

export interface PromptGetRequestedPayload {
  serverName: string;
  promptName: string;
  args: Record<string, string>;
  widgetId?: string;
  requestId?: string;
}

export interface PromptGotPayload {
  serverName: string;
  promptName: string;
  args: Record<string, string>;
  messages: PromptMessages;
  widgetId?: string;
  requestId?: string;
}

export interface PromptErrorPayload {
  serverName: string;
  promptName: string;
  args: Record<string, string>;
  error: ErrorInfo;
  widgetId?: string;
  requestId?: string;
}

export interface PromptsListChangedPayload {
  serverName: string;
  prompts: MCPPrompt[];
}

// ============================================================================
// Sampling Event Payloads
// ============================================================================

export interface SamplingRequestedPayload {
  serverName: string;
  request: {
    messages: Array<{
      role: 'user' | 'assistant';
      content: unknown;
    }>;
    modelPreferences?: Record<string, unknown>;
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
  };
  widgetId?: string;
  requestId?: string;
}

export interface SamplingCompletedPayload {
  serverName: string;
  requestId: string;
  result: {
    model: string;
    stopReason?: string;
    role: 'assistant';
    content: unknown;
  };
  widgetId?: string;
}

export interface SamplingErrorPayload {
  serverName: string;
  requestId: string;
  error: ErrorInfo;
  widgetId?: string;
}

// ============================================================================
// Server Event Payloads
// ============================================================================

export interface ServerConnectedPayload {
  serverName: string;
  serverInfo: MCPServerInfo;
  timestamp: Date;
}

export interface ServerDisconnectedPayload {
  serverName: string;
  reason?: string;
  timestamp: Date;
}

export interface ServerErrorPayload {
  serverName: string;
  error: ErrorInfo;
  timestamp: Date;
}

export interface ServerCapabilitiesChangedPayload {
  serverName: string;
  capabilities: MCPServerInfo['capabilities'];
  timestamp: Date;
}

// ============================================================================
// Widget Event Payloads
// ============================================================================

export interface WidgetInitializedPayload {
  widgetId: string;
  element: string;
  serverName: string;
  timestamp: Date;
}

export interface WidgetDestroyedPayload {
  widgetId: string;
  element: string;
  serverName: string;
  timestamp: Date;
}

export interface WidgetErrorPayload {
  widgetId: string;
  element: string;
  serverName: string;
  error: ErrorInfo;
  timestamp: Date;
}

export interface WidgetRefreshRequestedPayload {
  widgetId: string;
  reason?: string;
}

export interface WidgetRefreshedPayload {
  widgetId: string;
  timestamp: Date;
  duration?: number; // milliseconds
}

// ============================================================================
// Dashboard Event Payloads
// ============================================================================

export interface DashboardWidgetAddedPayload {
  widgetId: string;
  element: string;
  serverName: string;
  position?: {
    x: number;
    y: number;
    w: number;
    h: number;
  };
}

export interface DashboardWidgetRemovedPayload {
  widgetId: string;
  element: string;
  serverName: string;
}

export interface DashboardLayoutChangedPayload {
  layout: Array<{
    widgetId: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
}

export interface DashboardThemeChangedPayload {
  mode: 'light' | 'dark' | 'auto';
  theme?: Record<string, unknown>;
}

export interface DashboardConfigChangedPayload {
  key: string;
  value: unknown;
  oldValue: unknown;
}

// ============================================================================
// Common Types
// ============================================================================

/**
 * Error Information
 *
 * Standard error structure used in error event payloads.
 */
export interface ErrorInfo {
  /**
   * Error code (JSON-RPC error code or custom code)
   */
  code: number | string;

  /**
   * Error message
   */
  message: string;

  /**
   * Additional error details
   */
  details?: unknown;

  /**
   * Error stack trace (for debugging)
   */
  stack?: string;

  /**
   * Original error object
   */
  cause?: Error;
}

/**
 * Event Metadata
 *
 * Optional metadata that can be attached to any event.
 */
export interface EventMetadata {
  /**
   * Event timestamp
   */
  timestamp?: Date;

  /**
   * Source widget ID
   */
  widgetId?: string;

  /**
   * Request ID (for tracking request-response pairs)
   */
  requestId?: string;

  /**
   * User ID (if authentication is enabled)
   */
  userId?: string;

  /**
   * Session ID
   */
  sessionId?: string;

  /**
   * Custom metadata
   */
  [key: string]: unknown;
}

/**
 * Typed Event Handler
 *
 * Event handler with proper typing for event payload.
 */
export type TypedEventHandler<E extends MCPEvent> = (
  payload: EventPayload<E>,
  metadata?: EventMetadata
) => void | Promise<void>;

/**
 * Event Filter
 *
 * Filter function for conditional event handling.
 */
export type EventFilter<E extends MCPEvent> = (
  payload: EventPayload<E>,
  metadata?: EventMetadata
) => boolean;

/**
 * Event Subscription Options
 */
export interface EventSubscriptionOptions<E extends MCPEvent> {
  /**
   * Filter function - handler only called if filter returns true
   */
  filter?: EventFilter<E>;

  /**
   * Priority (higher priority handlers called first)
   */
  priority?: number;

  /**
   * Call handler only once, then unsubscribe
   */
  once?: boolean;
}
