/**
 * Permissions Zod Schema
 *
 * Runtime validation schema for widget permissions.
 */

import { z } from 'zod';

/**
 * Permission Scope Schema
 */
export const PermissionScopeSchema = z.enum(['all', 'allowlist', 'denylist', 'none']);

/**
 * Rate Limit Schema
 */
export const RateLimitSchema = z.object({
  maxRequests: z.number().int().positive(),
  windowMs: z.number().int().positive(),
  onExceeded: z.enum(['block', 'queue', 'error']).optional(),
});

/**
 * Tool Constraints Schema
 */
export const ToolConstraintsSchema = z.object({
  maxExecutionTime: z.number().int().positive().optional(),
  maxArgumentSize: z.number().int().positive().optional(),
  disallowAnnotations: z.array(z.string()).optional(),
});

/**
 * Tool Permissions Schema
 */
export const ToolPermissionsSchema = z.object({
  scope: PermissionScopeSchema,
  patterns: z.array(z.string()).optional(),
  requireConfirmation: z.union([
    z.boolean(),
    z.array(z.string()),
  ]).optional(),
  rateLimit: RateLimitSchema.optional(),
  constraints: ToolConstraintsSchema.optional(),
});

/**
 * Resource Permissions Schema
 */
export const ResourcePermissionsSchema = z.object({
  scope: PermissionScopeSchema,
  patterns: z.array(z.string()).optional(),
  allowSubscriptions: z.boolean().optional(),
  rateLimit: RateLimitSchema.optional(),
  maxResourceSize: z.number().int().positive().optional(),
});

/**
 * Prompt Permissions Schema
 */
export const PromptPermissionsSchema = z.object({
  scope: PermissionScopeSchema,
  patterns: z.array(z.string()).optional(),
  rateLimit: RateLimitSchema.optional(),
});

/**
 * Sampling Permissions Schema
 */
export const SamplingPermissionsSchema = z.object({
  allowed: z.boolean(),
  requireConfirmation: z.boolean().optional(),
  maxTokens: z.number().int().positive().optional(),
  rateLimit: RateLimitSchema.optional(),
  allowedModels: z.array(z.string()).optional(),
  maxCostPerRequest: z.number().positive().optional(),
});

/**
 * Network Permissions Schema
 */
export const NetworkPermissionsSchema = z.object({
  allowed: z.boolean(),
  allowedOrigins: z.array(z.string()).optional(),
  blockedOrigins: z.array(z.string()).optional(),
  rateLimit: RateLimitSchema.optional(),
  maxResponseSize: z.number().int().positive().optional(),
});

/**
 * Storage Permissions Schema
 */
export const StoragePermissionsSchema = z.object({
  localStorage: z.boolean().optional(),
  sessionStorage: z.boolean().optional(),
  indexedDB: z.boolean().optional(),
  cache: z.boolean().optional(),
  maxQuota: z.number().int().positive().optional(),
  keyPrefix: z.string().optional(),
});

/**
 * Cross-Widget Communication Permissions Schema
 */
export const CrossWidgetPermissionsSchema = z.object({
  send: z.boolean().optional(),
  receive: z.boolean().optional(),
  allowedTargets: z.array(z.string()).optional(),
  rateLimit: RateLimitSchema.optional(),
});

/**
 * Widget Permissions Schema
 */
export const WidgetPermissionsSchema = z.object({
  tools: ToolPermissionsSchema.optional(),
  resources: ResourcePermissionsSchema.optional(),
  prompts: PromptPermissionsSchema.optional(),
  sampling: SamplingPermissionsSchema.optional(),
  network: NetworkPermissionsSchema.optional(),
  storage: StoragePermissionsSchema.optional(),
  crossWidget: CrossWidgetPermissionsSchema.optional(),
});

/**
 * Permission Request Schema
 */
export const PermissionRequestSchema = z.object({
  type: z.enum(['tool', 'resource', 'prompt', 'sampling', 'network', 'storage']),
  target: z.string(),
  reason: z.string().optional(),
  oneTime: z.boolean().optional(),
});

/**
 * Permission Grant Schema
 */
export const PermissionGrantSchema = z.object({
  type: z.enum(['tool', 'resource', 'prompt', 'sampling', 'network', 'storage']),
  target: z.string(),
  granted: z.boolean(),
  expiresAt: z.date().optional(),
  grantedAt: z.date(),
  grantedBy: z.string().optional(),
});

/**
 * Permission Denial Schema
 */
export const PermissionDenialSchema = z.object({
  type: z.enum(['tool', 'resource', 'prompt', 'sampling', 'network', 'storage']),
  target: z.string(),
  reason: z.string(),
  canRetry: z.boolean(),
});

/**
 * Inferred TypeScript types
 */
export type WidgetPermissions = z.infer<typeof WidgetPermissionsSchema>;
export type ToolPermissions = z.infer<typeof ToolPermissionsSchema>;
export type ResourcePermissions = z.infer<typeof ResourcePermissionsSchema>;
export type PromptPermissions = z.infer<typeof PromptPermissionsSchema>;
export type SamplingPermissions = z.infer<typeof SamplingPermissionsSchema>;
export type NetworkPermissions = z.infer<typeof NetworkPermissionsSchema>;
export type StoragePermissions = z.infer<typeof StoragePermissionsSchema>;
export type CrossWidgetPermissions = z.infer<typeof CrossWidgetPermissionsSchema>;
export type RateLimit = z.infer<typeof RateLimitSchema>;
export type ToolConstraints = z.infer<typeof ToolConstraintsSchema>;
export type PermissionRequest = z.infer<typeof PermissionRequestSchema>;
export type PermissionGrant = z.infer<typeof PermissionGrantSchema>;
export type PermissionDenial = z.infer<typeof PermissionDenialSchema>;

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
 * Validate Widget Permissions
 */
export function validateWidgetPermissions(
  data: unknown
): ValidationResult<WidgetPermissions> {
  const result = WidgetPermissionsSchema.safeParse(data);

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
 * Validate Tool Permissions
 */
export function validateToolPermissions(
  data: unknown
): ValidationResult<ToolPermissions> {
  const result = ToolPermissionsSchema.safeParse(data);

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
 * Validate Permission Request
 */
export function validatePermissionRequest(
  data: unknown
): ValidationResult<PermissionRequest> {
  const result = PermissionRequestSchema.safeParse(data);

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
 * Parse Widget Permissions (throws on error)
 */
export function parseWidgetPermissions(data: unknown): WidgetPermissions {
  return WidgetPermissionsSchema.parse(data);
}

/**
 * Check if data is valid widget permissions (type guard)
 */
export function isValidWidgetPermissions(data: unknown): data is WidgetPermissions {
  return WidgetPermissionsSchema.safeParse(data).success;
}

/**
 * Create default (restrictive) permissions
 */
export function createDefaultPermissions(): WidgetPermissions {
  return {
    tools: { scope: 'none' },
    resources: { scope: 'none' },
    prompts: { scope: 'none' },
    sampling: { allowed: false },
    network: { allowed: false },
    storage: {
      localStorage: false,
      sessionStorage: false,
      indexedDB: false,
      cache: false,
    },
    crossWidget: { send: false, receive: false },
  };
}

/**
 * Create permissive permissions (for development/testing)
 */
export function createPermissivePermissions(): WidgetPermissions {
  return {
    tools: { scope: 'all' },
    resources: { scope: 'all', allowSubscriptions: true },
    prompts: { scope: 'all' },
    sampling: { allowed: true },
    network: { allowed: true },
    storage: {
      localStorage: true,
      sessionStorage: true,
      indexedDB: true,
      cache: true,
    },
    crossWidget: { send: true, receive: true },
  };
}

/**
 * Create example tool permissions
 */
export function createExampleToolPermissions(): ToolPermissions {
  return {
    scope: 'allowlist',
    patterns: ['github:*', 'filesystem:read_*'],
    requireConfirmation: ['filesystem:write_file', 'filesystem:delete_file'],
    rateLimit: {
      maxRequests: 100,
      windowMs: 60000, // 1 minute
      onExceeded: 'block',
    },
  };
}
