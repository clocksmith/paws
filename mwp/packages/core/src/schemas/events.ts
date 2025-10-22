/**
 * Events Zod Schema
 *
 * Runtime validation schema for event payloads.
 */

import { z } from 'zod';

/**
 * Error Info Schema
 */
export const ErrorInfoSchema = z.object({
  code: z.union([z.number(), z.string()]),
  message: z.string(),
  details: z.unknown().optional(),
  stack: z.string().optional(),
  cause: z.instanceof(Error).optional(),
});

/**
 * Tool Invoke Requested Payload Schema
 */
export const ToolInvokeRequestedPayloadSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * Tool Invoked Payload Schema
 */
export const ToolInvokedPayloadSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  result: z.object({
    content: z.array(z.unknown()),
    isError: z.boolean().optional(),
  }),
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
  duration: z.number().optional(),
});

/**
 * Tool Error Payload Schema
 */
export const ToolErrorPayloadSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
  args: z.record(z.unknown()),
  error: ErrorInfoSchema,
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * Tool Progress Payload Schema
 */
export const ToolProgressPayloadSchema = z.object({
  serverName: z.string(),
  toolName: z.string(),
  requestId: z.string(),
  progress: z.number().min(0).max(100),
  message: z.string().optional(),
  total: z.number().optional(),
  completed: z.number().optional(),
});

/**
 * Resource Read Requested Payload Schema
 */
export const ResourceReadRequestedPayloadSchema = z.object({
  serverName: z.string(),
  uri: z.string(),
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * Resource Read Payload Schema
 */
export const ResourceReadPayloadSchema = z.object({
  serverName: z.string(),
  uri: z.string(),
  content: z.object({
    uri: z.string(),
    mimeType: z.string().optional(),
    text: z.string().optional(),
    blob: z.string().optional(),
  }),
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
  cached: z.boolean().optional(),
});

/**
 * Resource Updated Payload Schema
 */
export const ResourceUpdatedPayloadSchema = z.object({
  serverName: z.string(),
  uri: z.string(),
  content: z.object({
    uri: z.string(),
    mimeType: z.string().optional(),
    text: z.string().optional(),
    blob: z.string().optional(),
  }),
});

/**
 * Resource Error Payload Schema
 */
export const ResourceErrorPayloadSchema = z.object({
  serverName: z.string(),
  uri: z.string(),
  error: ErrorInfoSchema,
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
});

/**
 * Server Connected Payload Schema
 */
export const ServerConnectedPayloadSchema = z.object({
  serverName: z.string(),
  serverInfo: z.object({
    serverName: z.string(),
    transport: z.enum(['stdio', 'http']),
    protocolVersion: z.string(),
    capabilities: z.record(z.unknown()),
    tools: z.array(z.unknown()),
    resources: z.array(z.unknown()),
    prompts: z.array(z.unknown()),
  }),
  timestamp: z.date(),
});

/**
 * Server Disconnected Payload Schema
 */
export const ServerDisconnectedPayloadSchema = z.object({
  serverName: z.string(),
  reason: z.string().optional(),
  timestamp: z.date(),
});

/**
 * Server Error Payload Schema
 */
export const ServerErrorPayloadSchema = z.object({
  serverName: z.string(),
  error: ErrorInfoSchema,
  timestamp: z.date(),
});

/**
 * Widget Initialized Payload Schema
 */
export const WidgetInitializedPayloadSchema = z.object({
  widgetId: z.string(),
  element: z.string(),
  serverName: z.string(),
  timestamp: z.date(),
});

/**
 * Widget Destroyed Payload Schema
 */
export const WidgetDestroyedPayloadSchema = z.object({
  widgetId: z.string(),
  element: z.string(),
  serverName: z.string(),
  timestamp: z.date(),
});

/**
 * Widget Error Payload Schema
 */
export const WidgetErrorPayloadSchema = z.object({
  widgetId: z.string(),
  element: z.string(),
  serverName: z.string(),
  error: ErrorInfoSchema,
  timestamp: z.date(),
});

/**
 * Widget Refresh Requested Payload Schema
 */
export const WidgetRefreshRequestedPayloadSchema = z.object({
  widgetId: z.string(),
  reason: z.string().optional(),
});

/**
 * Widget Refreshed Payload Schema
 */
export const WidgetRefreshedPayloadSchema = z.object({
  widgetId: z.string(),
  timestamp: z.date(),
  duration: z.number().optional(),
});

/**
 * Dashboard Widget Added Payload Schema
 */
export const DashboardWidgetAddedPayloadSchema = z.object({
  widgetId: z.string(),
  element: z.string(),
  serverName: z.string(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    w: z.number(),
    h: z.number(),
  }).optional(),
});

/**
 * Dashboard Widget Removed Payload Schema
 */
export const DashboardWidgetRemovedPayloadSchema = z.object({
  widgetId: z.string(),
  element: z.string(),
  serverName: z.string(),
});

/**
 * Dashboard Theme Changed Payload Schema
 */
export const DashboardThemeChangedPayloadSchema = z.object({
  mode: z.enum(['light', 'dark', 'auto']),
  theme: z.record(z.unknown()).optional(),
});

/**
 * Event Metadata Schema
 */
export const EventMetadataSchema = z.object({
  timestamp: z.date().optional(),
  widgetId: z.string().optional(),
  requestId: z.string().optional(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
}).catchall(z.unknown());

/**
 * Inferred TypeScript types
 */
export type ErrorInfo = z.infer<typeof ErrorInfoSchema>;
export type ToolInvokeRequestedPayload = z.infer<typeof ToolInvokeRequestedPayloadSchema>;
export type ToolInvokedPayload = z.infer<typeof ToolInvokedPayloadSchema>;
export type ToolErrorPayload = z.infer<typeof ToolErrorPayloadSchema>;
export type ToolProgressPayload = z.infer<typeof ToolProgressPayloadSchema>;
export type ResourceReadRequestedPayload = z.infer<typeof ResourceReadRequestedPayloadSchema>;
export type ResourceReadPayload = z.infer<typeof ResourceReadPayloadSchema>;
export type ResourceUpdatedPayload = z.infer<typeof ResourceUpdatedPayloadSchema>;
export type ResourceErrorPayload = z.infer<typeof ResourceErrorPayloadSchema>;
export type ServerConnectedPayload = z.infer<typeof ServerConnectedPayloadSchema>;
export type ServerDisconnectedPayload = z.infer<typeof ServerDisconnectedPayloadSchema>;
export type ServerErrorPayload = z.infer<typeof ServerErrorPayloadSchema>;
export type WidgetInitializedPayload = z.infer<typeof WidgetInitializedPayloadSchema>;
export type WidgetDestroyedPayload = z.infer<typeof WidgetDestroyedPayloadSchema>;
export type WidgetErrorPayload = z.infer<typeof WidgetErrorPayloadSchema>;
export type WidgetRefreshRequestedPayload = z.infer<typeof WidgetRefreshRequestedPayloadSchema>;
export type WidgetRefreshedPayload = z.infer<typeof WidgetRefreshedPayloadSchema>;
export type DashboardWidgetAddedPayload = z.infer<typeof DashboardWidgetAddedPayloadSchema>;
export type DashboardWidgetRemovedPayload = z.infer<typeof DashboardWidgetRemovedPayloadSchema>;
export type DashboardThemeChangedPayload = z.infer<typeof DashboardThemeChangedPayloadSchema>;
export type EventMetadata = z.infer<typeof EventMetadataSchema>;

/**
 * Validation Result
 */
export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
}

/**
 * Validation Error
 */
export interface ValidationError {
  path: (string | number)[];
  message: string;
  code: string;
}

/**
 * Validate Tool Invoke Requested Payload
 */
export function validateToolInvokeRequestedPayload(
  data: unknown
): ValidationResult<ToolInvokeRequestedPayload> {
  const result = ToolInvokeRequestedPayloadSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path,
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate Server Connected Payload
 */
export function validateServerConnectedPayload(
  data: unknown
): ValidationResult<ServerConnectedPayload> {
  const result = ServerConnectedPayloadSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path,
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate Widget Error Payload
 */
export function validateWidgetErrorPayload(
  data: unknown
): ValidationResult<WidgetErrorPayload> {
  const result = WidgetErrorPayloadSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path,
      message: err.message,
      code: err.code,
    })),
  };
}

/**
 * Validate Event Metadata
 */
export function validateEventMetadata(
  data: unknown
): ValidationResult<EventMetadata> {
  const result = EventMetadataSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: result.error.errors.map(err => ({
      path: err.path,
      message: err.message,
      code: err.code,
    })),
  };
}
