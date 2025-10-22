/**
 * @mcp-wp/core Types
 *
 * Re-exports all type definitions from the MCP-WP core package.
 */

// Widget types
export type {
  WidgetFactoryFunction,
  WidgetFactory,
  WidgetAPI,
  WidgetMetadata,
  WidgetCapabilities,
  WidgetStatus,
  ResourceUsage,
  AuthorInfo,
  WidgetCategory,
  WidgetComponent,
  WidgetConstructor,
} from './widget.js';

// Dependencies types
export type {
  Dependencies,
  EventBus,
  EventHandler,
  UnsubscribeFunction,
  MCPBridge,
  ToolResult,
  ToolContent,
  ResourceContent,
  PromptMessages,
  PromptMessage,
  PromptContent,
  Tool,
  Resource,
  Prompt,
  PromptArgument,
  JSONSchema,
  SamplingRequest,
  SamplingResult,
  Configuration,
  ThemeInterface,
  AccessibilityHelper,
  OfflineCache,
  Telemetry,
  InternationalizationInterface,
} from './dependencies.js';

// MCP types
export type {
  MCPServerInfo,
  MCPServerMetadata,
  MCPCapabilities,
  MCPTool,
  ToolAnnotations,
  MCPResource,
  ResourceAnnotations,
  MCPPrompt,
  MCPPromptArgument,
  PromptAnnotations,
  MCPRoot,
  MCPImplementationInfo,
  JSONRPCRequest,
  JSONRPCResponse,
  JSONRPCError,
  MCPNotification,
  MCPSessionState,
  MCPConnectionInfo,
} from './mcp.js';

export {
  JSONRPCErrorCode,
  hasToolsCapability,
  hasResourcesCapability,
  hasPromptsCapability,
  hasSamplingCapability,
  supportsResourceSubscriptions,
} from './mcp.js';

// Events types
export type {
  MCPEvent,
  EventPayloadMap,
  EventPayload,
  // Tool events
  ToolInvokeRequestedPayload,
  ToolInvokedPayload,
  ToolErrorPayload,
  ToolProgressPayload,
  ToolsListChangedPayload,
  // Resource events
  ResourceReadRequestedPayload,
  ResourceReadPayload,
  ResourceUpdatedPayload,
  ResourceErrorPayload,
  ResourceSubscribeRequestedPayload,
  ResourceUnsubscribeRequestedPayload,
  ResourcesListChangedPayload,
  // Prompt events
  PromptGetRequestedPayload,
  PromptGotPayload,
  PromptErrorPayload,
  PromptsListChangedPayload,
  // Sampling events
  SamplingRequestedPayload,
  SamplingCompletedPayload,
  SamplingErrorPayload,
  // Server events
  ServerConnectedPayload,
  ServerDisconnectedPayload,
  ServerErrorPayload,
  ServerCapabilitiesChangedPayload,
  // Widget events
  WidgetInitializedPayload,
  WidgetDestroyedPayload,
  WidgetErrorPayload,
  WidgetRefreshRequestedPayload,
  WidgetRefreshedPayload,
  // Dashboard events
  DashboardWidgetAddedPayload,
  DashboardWidgetRemovedPayload,
  DashboardLayoutChangedPayload,
  DashboardThemeChangedPayload,
  DashboardConfigChangedPayload,
  // Common
  ErrorInfo,
  EventMetadata,
  TypedEventHandler,
  EventFilter,
  EventSubscriptionOptions,
} from './events.js';

// Permissions types
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
  PermissionValidator,
} from './permissions.js';

export {
  matchesPattern,
  matchesAnyPattern,
  mergePermissions,
  createDefaultPermissions,
  createPermissivePermissions,
} from './permissions.js';

// Configuration types
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

export {
  CONFIGURATION_SCHEMA_VERSION,
  createDefaultDashboardConfiguration,
} from './configuration.js';
