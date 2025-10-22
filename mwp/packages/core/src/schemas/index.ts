/**
 * @mcp-wp/core Schemas
 *
 * Re-exports all Zod schemas and validation functions.
 */

// Widget Metadata Schemas
export {
  WidgetMetadataSchema,
  WidgetCapabilitiesSchema,
  AuthorInfoSchema,
  WidgetCategorySchema,
  validateWidgetMetadata,
  validateWidgetCapabilities,
  parseWidgetMetadata,
  isValidWidgetMetadata,
  createExampleWidgetMetadata,
} from './widget-metadata.js';

export type {
  WidgetMetadata,
  WidgetCapabilities,
  AuthorInfo,
  WidgetCategory,
  ValidationResult,
  ValidationError,
} from './widget-metadata.js';

// Permissions Schemas
export {
  WidgetPermissionsSchema,
  ToolPermissionsSchema,
  ResourcePermissionsSchema,
  PromptPermissionsSchema,
  SamplingPermissionsSchema,
  NetworkPermissionsSchema,
  StoragePermissionsSchema,
  CrossWidgetPermissionsSchema,
  RateLimitSchema,
  ToolConstraintsSchema,
  PermissionRequestSchema,
  PermissionGrantSchema,
  PermissionDenialSchema,
  PermissionScopeSchema,
  validateWidgetPermissions,
  validateToolPermissions,
  validatePermissionRequest,
  parseWidgetPermissions,
  isValidWidgetPermissions,
  createDefaultPermissions,
  createPermissivePermissions,
  createExampleToolPermissions,
} from './permissions.js';

export type {
  WidgetPermissions,
  ToolPermissions,
  ResourcePermissions,
  PromptPermissions,
  SamplingPermissions,
  NetworkPermissions,
  StoragePermissions,
  CrossWidgetPermissions,
  RateLimit,
  ToolConstraints,
  PermissionRequest,
  PermissionGrant,
  PermissionDenial,
} from './permissions.js';

// Configuration Schemas
export {
  DashboardConfigurationSchema,
  DashboardMetadataSchema,
  ServerConfigurationSchema,
  StdioTransportConfigurationSchema,
  HttpTransportConfigurationSchema,
  HttpAuthConfigurationSchema,
  RetryConfigurationSchema,
  WidgetConfigurationSchema,
  WidgetPositionSchema,
  WidgetSizeSchema,
  LayoutConfigurationSchema,
  LayoutBreakpointSchema,
  ThemeConfigurationSchema,
  FeatureFlagsSchema,
  AdvancedConfigurationSchema,
  TransportConfigurationSchema,
  validateDashboardConfiguration,
  validateServerConfiguration,
  validateWidgetConfiguration,
  parseDashboardConfiguration,
  isValidDashboardConfiguration,
  createDefaultDashboardConfiguration,
  createExampleStdioServerConfiguration,
  createExampleHttpServerConfiguration,
  createExampleWidgetConfiguration,
} from './configuration.js';

export type {
  DashboardConfiguration,
  DashboardMetadata,
  ServerConfiguration,
  StdioTransportConfiguration,
  HttpTransportConfiguration,
  HttpAuthConfiguration,
  RetryConfiguration,
  WidgetConfiguration,
  WidgetPosition,
  WidgetSize,
  LayoutConfiguration,
  LayoutBreakpoint,
  ThemeConfiguration,
  FeatureFlags,
  AdvancedConfiguration,
} from './configuration.js';

// Event Schemas
export {
  ErrorInfoSchema,
  ToolInvokeRequestedPayloadSchema,
  ToolInvokedPayloadSchema,
  ToolErrorPayloadSchema,
  ToolProgressPayloadSchema,
  ResourceReadRequestedPayloadSchema,
  ResourceReadPayloadSchema,
  ResourceUpdatedPayloadSchema,
  ResourceErrorPayloadSchema,
  ServerConnectedPayloadSchema,
  ServerDisconnectedPayloadSchema,
  ServerErrorPayloadSchema,
  WidgetInitializedPayloadSchema,
  WidgetDestroyedPayloadSchema,
  WidgetErrorPayloadSchema,
  WidgetRefreshRequestedPayloadSchema,
  WidgetRefreshedPayloadSchema,
  DashboardWidgetAddedPayloadSchema,
  DashboardWidgetRemovedPayloadSchema,
  DashboardThemeChangedPayloadSchema,
  EventMetadataSchema,
  validateToolInvokeRequestedPayload,
  validateServerConnectedPayload,
  validateWidgetErrorPayload,
  validateEventMetadata,
} from './events.js';

export type {
  ErrorInfo,
  ToolInvokeRequestedPayload,
  ToolInvokedPayload,
  ToolErrorPayload,
  ToolProgressPayload,
  ResourceReadRequestedPayload,
  ResourceReadPayload,
  ResourceUpdatedPayload,
  ResourceErrorPayload,
  ServerConnectedPayload,
  ServerDisconnectedPayload,
  ServerErrorPayload,
  WidgetInitializedPayload,
  WidgetDestroyedPayload,
  WidgetErrorPayload,
  WidgetRefreshRequestedPayload,
  WidgetRefreshedPayload,
  DashboardWidgetAddedPayload,
  DashboardWidgetRemovedPayload,
  DashboardThemeChangedPayload,
  EventMetadata,
} from './events.js';
