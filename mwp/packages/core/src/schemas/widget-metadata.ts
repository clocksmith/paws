/**
 * Widget Metadata Zod Schema
 *
 * Runtime validation schema for widget metadata.
 */

import { z } from 'zod';

/**
 * Widget Capabilities Schema
 */
export const WidgetCapabilitiesSchema = z.object({
  tools: z.boolean(),
  resources: z.boolean(),
  prompts: z.boolean(),
  sampling: z.boolean().optional(),
  subscriptions: z.boolean().optional(),
});

/**
 * Author Info Schema
 */
export const AuthorInfoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  url: z.string().url().optional(),
});

/**
 * Widget Category Schema
 */
export const WidgetCategorySchema = z.enum([
  'data-visualization',
  'form-input',
  'content-browser',
  'activity-monitor',
  'configuration',
  'other',
]);

/**
 * Widget Metadata Schema
 *
 * Validates widget metadata structure.
 */
export const WidgetMetadataSchema = z.object({
  protocolVersion: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Protocol version must be in semver format (e.g., "1.0.0")'),

  element: z
    .string()
    .regex(
      /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/,
      'Element name must be valid custom element name (lowercase, hyphen-separated)'
    )
    .min(2)
    .max(100),

  displayName: z
    .string()
    .min(1, 'Display name is required')
    .max(100, 'Display name must be at most 100 characters'),

  description: z
    .string()
    .max(500, 'Description must be at most 500 characters')
    .optional(),

  capabilities: WidgetCapabilitiesSchema,

  permissions: z.any().optional(), // TODO: Use PermissionsSchema when available

  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, 'Version must be in semver format')
    .optional(),

  author: z.union([
    z.string().min(1),
    AuthorInfoSchema,
  ]).optional(),

  icon: z
    .string()
    .url('Icon must be a valid URL or data URI')
    .or(z.string().startsWith('data:', { message: 'Icon must be URL or data URI' }))
    .optional(),

  category: WidgetCategorySchema.optional(),

  tags: z
    .array(z.string().min(1).max(50))
    .max(20, 'Maximum 20 tags allowed')
    .optional(),
});

/**
 * Inferred TypeScript type from schema
 */
export type WidgetMetadata = z.infer<typeof WidgetMetadataSchema>;
export type WidgetCapabilities = z.infer<typeof WidgetCapabilitiesSchema>;
export type AuthorInfo = z.infer<typeof AuthorInfoSchema>;
export type WidgetCategory = z.infer<typeof WidgetCategorySchema>;

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
 * Validate Widget Metadata
 *
 * @param data - Data to validate
 * @returns Validation result with typed data or errors
 */
export function validateWidgetMetadata(
  data: unknown
): ValidationResult<WidgetMetadata> {
  const result = WidgetMetadataSchema.safeParse(data);

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
 * Validate Widget Capabilities
 *
 * @param data - Data to validate
 * @returns Validation result
 */
export function validateWidgetCapabilities(
  data: unknown
): ValidationResult<WidgetCapabilities> {
  const result = WidgetCapabilitiesSchema.safeParse(data);

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
 * Parse Widget Metadata (throws on error)
 *
 * @param data - Data to parse
 * @returns Parsed and validated widget metadata
 * @throws ZodError if validation fails
 */
export function parseWidgetMetadata(data: unknown): WidgetMetadata {
  return WidgetMetadataSchema.parse(data);
}

/**
 * Check if data is valid widget metadata (type guard)
 *
 * @param data - Data to check
 * @returns True if data is valid WidgetMetadata
 */
export function isValidWidgetMetadata(data: unknown): data is WidgetMetadata {
  return WidgetMetadataSchema.safeParse(data).success;
}

/**
 * Create example widget metadata (for testing/docs)
 */
export function createExampleWidgetMetadata(): WidgetMetadata {
  return {
    protocolVersion: '1.0.0',
    element: 'example-mcp-widget',
    displayName: 'Example Widget',
    description: 'An example MCP widget for demonstration purposes',
    capabilities: {
      tools: true,
      resources: true,
      prompts: false,
    },
    version: '1.0.0',
    author: {
      name: 'Example Author',
      email: 'author@example.com',
    },
    category: 'other',
    tags: ['example', 'demo'],
  };
}
