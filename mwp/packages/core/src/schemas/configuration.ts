/**
 * Configuration Zod Schema
 *
 * Runtime validation schema for dashboard and widget configuration.
 */

import { z } from 'zod';
import { WidgetPermissionsSchema } from './permissions.js';

/**
 * Dashboard Metadata Schema
 */
export const DashboardMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  description: z.string().optional(),
  author: z.union([
    z.string(),
    z.object({
      name: z.string(),
      email: z.string().email().optional(),
      url: z.string().url().optional(),
    }),
  ]).optional(),
  tags: z.array(z.string()).optional(),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional(),
});

/**
 * Stdio Transport Configuration Schema
 */
export const StdioTransportConfigurationSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  cwd: z.string().optional(),
  env: z.record(z.string()).optional(),
});

/**
 * HTTP Auth Configuration Schema
 */
export const HttpAuthConfigurationSchema = z.object({
  type: z.enum(['bearer', 'basic', 'apikey']),
  token: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  apiKeyName: z.string().optional(),
  apiKeyValue: z.string().optional(),
  apiKeyIn: z.enum(['header', 'query']).optional(),
});

/**
 * HTTP Transport Configuration Schema
 */
export const HttpTransportConfigurationSchema = z.object({
  type: z.literal('http'),
  url: z.string().url(),
  headers: z.record(z.string()).optional(),
  auth: HttpAuthConfigurationSchema.optional(),
});

/**
 * Transport Configuration Schema (union)
 */
export const TransportConfigurationSchema = z.union([
  StdioTransportConfigurationSchema,
  HttpTransportConfigurationSchema,
]);

/**
 * Retry Configuration Schema
 */
export const RetryConfigurationSchema = z.object({
  maxAttempts: z.number().int().positive(),
  initialDelay: z.number().int().positive(),
  maxDelay: z.number().int().positive(),
  backoffMultiplier: z.number().positive(),
  retryOnCodes: z.array(z.number().int()).optional(),
});

/**
 * Server Configuration Schema
 */
export const ServerConfigurationSchema = z.object({
  name: z.string().min(1),
  displayName: z.string().optional(),
  description: z.string().optional(),
  transport: TransportConfigurationSchema,
  env: z.record(z.string()).optional(),
  timeout: z.number().int().positive().optional(),
  retry: RetryConfigurationSchema.optional(),
  permissions: WidgetPermissionsSchema.optional(),
  autoConnect: z.boolean().optional(),
  icon: z.string().optional(),
  tags: z.array(z.string()).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Widget Position Schema
 */
export const WidgetPositionSchema = z.object({
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
});

/**
 * Widget Size Schema
 */
export const WidgetSizeSchema = z.object({
  w: z.number().int().positive(),
  h: z.number().int().positive(),
  minW: z.number().int().positive().optional(),
  minH: z.number().int().positive().optional(),
  maxW: z.number().int().positive().optional(),
  maxH: z.number().int().positive().optional(),
});

/**
 * Widget Configuration Schema
 */
export const WidgetConfigurationSchema = z.object({
  id: z.string().min(1),
  package: z.string().min(1),
  serverName: z.string().min(1),
  displayName: z.string().optional(),
  config: z.record(z.unknown()).optional(),
  permissions: WidgetPermissionsSchema.optional(),
  position: WidgetPositionSchema.optional(),
  size: WidgetSizeSchema.optional(),
  visible: z.boolean().optional(),
  enabled: z.boolean().optional(),
  refreshInterval: z.number().int().nonnegative().optional(),
});

/**
 * Layout Breakpoint Schema
 */
export const LayoutBreakpointSchema = z.object({
  name: z.string(),
  minWidth: z.number().int().positive(),
  columns: z.number().int().positive(),
  rowHeight: z.number().int().positive().optional(),
});

/**
 * Layout Configuration Schema
 */
export const LayoutConfigurationSchema = z.object({
  type: z.enum(['grid', 'flexbox', 'masonry', 'custom']),
  columns: z.number().int().positive().optional(),
  rowHeight: z.number().int().positive().optional(),
  gap: z.number().int().nonnegative().optional(),
  padding: z.number().int().nonnegative().optional(),
  responsive: z.boolean().optional(),
  breakpoints: z.array(LayoutBreakpointSchema).optional(),
  draggable: z.boolean().optional(),
  resizable: z.boolean().optional(),
  compact: z.boolean().optional(),
});

/**
 * Theme Configuration Schema
 */
export const ThemeConfigurationSchema = z.object({
  mode: z.enum(['light', 'dark', 'auto']),
  primaryColor: z.string().optional(),
  accentColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  surfaceColor: z.string().optional(),
  textColor: z.string().optional(),
  borderColor: z.string().optional(),
  borderRadius: z.number().int().nonnegative().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().positive().optional(),
  cssVariables: z.record(z.string()).optional(),
});

/**
 * Feature Flags Schema
 */
export const FeatureFlagsSchema = z.record(z.boolean());

/**
 * Advanced Configuration Schema
 */
export const AdvancedConfigurationSchema = z.object({
  eventBus: z.object({
    maxHistorySize: z.number().int().positive().optional(),
    logEvents: z.boolean().optional(),
  }).optional(),
  mcpBridge: z.object({
    requestTimeout: z.number().int().positive().optional(),
    enableBatching: z.boolean().optional(),
    batchDelay: z.number().int().positive().optional(),
  }).optional(),
  cache: z.object({
    enabled: z.boolean().optional(),
    ttl: z.number().int().positive().optional(),
    maxSize: z.number().int().positive().optional(),
    strategy: z.enum(['lru', 'lfu', 'fifo']).optional(),
  }).optional(),
  performance: z.object({
    monitoring: z.boolean().optional(),
    renderTimeThreshold: z.number().int().positive().optional(),
    memoryThreshold: z.number().int().positive().optional(),
  }).optional(),
  security: z.object({
    enableCSP: z.boolean().optional(),
    cspDirectives: z.record(z.array(z.string())).optional(),
    enableSRI: z.boolean().optional(),
    trustedSources: z.array(z.string()).optional(),
  }).optional(),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).optional(),
    console: z.boolean().optional(),
    remote: z.object({
      enabled: z.boolean(),
      endpoint: z.string().url(),
      batchSize: z.number().int().positive().optional(),
    }).optional(),
  }).optional(),
});

/**
 * Dashboard Configuration Schema
 */
export const DashboardConfigurationSchema = z.object({
  metadata: DashboardMetadataSchema,
  servers: z.array(ServerConfigurationSchema),
  widgets: z.array(WidgetConfigurationSchema),
  layout: LayoutConfigurationSchema.optional(),
  theme: ThemeConfigurationSchema.optional(),
  globalPermissions: WidgetPermissionsSchema.optional(),
  features: FeatureFlagsSchema.optional(),
  advanced: AdvancedConfigurationSchema.optional(),
});

/**
 * Inferred TypeScript types
 */
export type DashboardConfiguration = z.infer<typeof DashboardConfigurationSchema>;
export type DashboardMetadata = z.infer<typeof DashboardMetadataSchema>;
export type ServerConfiguration = z.infer<typeof ServerConfigurationSchema>;
export type StdioTransportConfiguration = z.infer<typeof StdioTransportConfigurationSchema>;
export type HttpTransportConfiguration = z.infer<typeof HttpTransportConfigurationSchema>;
export type HttpAuthConfiguration = z.infer<typeof HttpAuthConfigurationSchema>;
export type RetryConfiguration = z.infer<typeof RetryConfigurationSchema>;
export type WidgetConfiguration = z.infer<typeof WidgetConfigurationSchema>;
export type WidgetPosition = z.infer<typeof WidgetPositionSchema>;
export type WidgetSize = z.infer<typeof WidgetSizeSchema>;
export type LayoutConfiguration = z.infer<typeof LayoutConfigurationSchema>;
export type LayoutBreakpoint = z.infer<typeof LayoutBreakpointSchema>;
export type ThemeConfiguration = z.infer<typeof ThemeConfigurationSchema>;
export type FeatureFlags = z.infer<typeof FeatureFlagsSchema>;
export type AdvancedConfiguration = z.infer<typeof AdvancedConfigurationSchema>;

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
 * Validate Dashboard Configuration
 */
export function validateDashboardConfiguration(
  data: unknown
): ValidationResult<DashboardConfiguration> {
  const result = DashboardConfigurationSchema.safeParse(data);

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
 * Validate Server Configuration
 */
export function validateServerConfiguration(
  data: unknown
): ValidationResult<ServerConfiguration> {
  const result = ServerConfigurationSchema.safeParse(data);

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
 * Validate Widget Configuration
 */
export function validateWidgetConfiguration(
  data: unknown
): ValidationResult<WidgetConfiguration> {
  const result = WidgetConfigurationSchema.safeParse(data);

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
 * Parse Dashboard Configuration (throws on error)
 */
export function parseDashboardConfiguration(data: unknown): DashboardConfiguration {
  return DashboardConfigurationSchema.parse(data);
}

/**
 * Check if data is valid dashboard configuration (type guard)
 */
export function isValidDashboardConfiguration(
  data: unknown
): data is DashboardConfiguration {
  return DashboardConfigurationSchema.safeParse(data).success;
}

/**
 * Create default dashboard configuration
 */
export function createDefaultDashboardConfiguration(): DashboardConfiguration {
  return {
    metadata: {
      name: 'My MCP Dashboard',
      version: '1.0.0',
    },
    servers: [],
    widgets: [],
    layout: {
      type: 'grid',
      columns: 12,
      rowHeight: 60,
      gap: 16,
      padding: 24,
      responsive: true,
      draggable: true,
      resizable: true,
      compact: false,
    },
    theme: {
      mode: 'auto',
      borderRadius: 8,
      fontSize: 14,
      fontFamily: 'system-ui, -apple-system, sans-serif',
    },
    features: {
      offlineMode: false,
      telemetry: false,
      accessibility: true,
      i18n: false,
      devTools: false,
      experimental: false,
    },
  };
}

/**
 * Create example server configuration (stdio)
 */
export function createExampleStdioServerConfiguration(): ServerConfiguration {
  return {
    name: 'github',
    displayName: 'GitHub',
    description: 'GitHub MCP server for repository management',
    transport: {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_example',
      },
    },
    autoConnect: true,
    enabled: true,
  };
}

/**
 * Create example server configuration (HTTP)
 */
export function createExampleHttpServerConfiguration(): ServerConfiguration {
  return {
    name: 'api-server',
    displayName: 'API Server',
    description: 'HTTP-based MCP server',
    transport: {
      type: 'http',
      url: 'https://api.example.com/mcp',
      headers: {
        'Content-Type': 'application/json',
      },
      auth: {
        type: 'bearer',
        token: 'example-token',
      },
    },
    timeout: 30000,
    retry: {
      maxAttempts: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
    },
    autoConnect: true,
    enabled: true,
  };
}

/**
 * Create example widget configuration
 */
export function createExampleWidgetConfiguration(): WidgetConfiguration {
  return {
    id: 'widget-1',
    package: '@mcp-wp/widget-github',
    serverName: 'github',
    displayName: 'GitHub Issues',
    position: { x: 0, y: 0 },
    size: { w: 6, h: 4, minW: 3, minH: 2 },
    visible: true,
    enabled: true,
    refreshInterval: 60000, // 1 minute
  };
}
