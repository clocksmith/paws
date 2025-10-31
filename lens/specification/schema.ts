/**
 * MCP Observability Protocol (MCP Lens) - TypeScript Schema
 *
 * Complete type definitions for the MCP Lens specification.
 * Version: 1.0.0
 */

// ============================================================================
// WIDGET FACTORY TYPES
// ============================================================================

/**
 * Widget Factory Function
 *
 * Default export from widget packages. Creates and initializes a widget.
 */
export type WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
) => WidgetFactory | Promise<WidgetFactory>;

/**
 * Widget Factory Return Value
 */
export interface WidgetFactory {
  /** Widget lifecycle API */
  api: WidgetAPI;
  /** Widget metadata */
  widget: WidgetMetadata;
}

/**
 * Widget API - Lifecycle Methods
 */
export interface WidgetAPI {
  /** Initialize the widget (called once after creation) */
  initialize(): Promise<void>;
  /** Destroy the widget (cleanup resources) */
  destroy(): Promise<void>;
  /** Refresh widget data */
  refresh(): Promise<void>;
  /** Get widget status (optional) */
  getStatus?(): WidgetStatus;
  /** Get resource usage (optional) */
  getResourceUsage?(): ResourceUsage;
}

/**
 * Widget Metadata
 */
export interface WidgetMetadata {
  /** MCP Lens protocol version (e.g., "1.0.0") */
  protocolVersion: string;
  /** Custom element tag name (must include hyphen) */
  element: string;
  /** Human-readable widget name */
  displayName: string;
  /** Widget description */
  description?: string;
  /** Widget capabilities */
  capabilities: WidgetCapabilities;
  /** Required permissions */
  permissions?: WidgetPermissions;
  /** Widget version */
  version?: string;
  /** Author information */
  author?: string | AuthorInfo;
  /** Widget icon (URL or data URI) */
  icon?: string;
  /** Widget category */
  category?: WidgetCategory;
  /** Tags for discovery */
  tags?: string[];
}

/**
 * Widget Capabilities
 */
export interface WidgetCapabilities {
  tools: boolean;
  resources: boolean;
  prompts: boolean;
  sampling?: boolean;
  subscriptions?: boolean;
}

/**
 * Widget Status
 */
export interface WidgetStatus {
  status: 'healthy' | 'degraded' | 'error' | 'initializing';
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  lastUpdate?: Date;
}

/**
 * Resource Usage Metrics
 */
export interface ResourceUsage {
  memory: number;        // bytes
  renderTime: number;    // milliseconds
  bundleSize?: number;   // bytes
  domNodes?: number;     // count
}

/**
 * Author Information
 */
export interface AuthorInfo {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Widget Category
 */
export type WidgetCategory =
  | 'data-visualization'
  | 'form-input'
  | 'content-browser'
  | 'activity-monitor'
  | 'configuration'
  | 'other';

// ============================================================================
// DEPENDENCIES
// ============================================================================

/**
 * Dependencies Object
 *
 * Injected by host into widget factory.
 */
export interface Dependencies {
  /** EventBus - Required pub/sub system */
  EventBus: EventBus;
  /** MCPBridge - Required MCP interface */
  MCPBridge: MCPBridge;
  /** Configuration - Required settings */
  Configuration: Configuration;
  /** Theme - Optional theming system */
  Theme?: ThemeInterface;
  /** A11yHelper - Optional accessibility utilities */
  A11yHelper?: AccessibilityHelper;
  /** OfflineCache - Optional caching */
  OfflineCache?: OfflineCache;
  /** Telemetry - Optional tracking */
  Telemetry?: Telemetry;
  /** I18n - Optional internationalization */
  I18n?: InternationalizationInterface;
}

/**
 * EventBus Interface
 */
export interface EventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: EventHandler): UnsubscribeFunction;
  off(event: string, handler: EventHandler): void;
  once?(event: string, handler: EventHandler): UnsubscribeFunction;
}

export type EventHandler = (data: unknown) => void | Promise<void>;
export type UnsubscribeFunction = () => void;

/**
 * MCPBridge Interface
 */
export interface MCPBridge {
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  readResource(serverName: string, uri: string): Promise<ResourceContent>;
  getPrompt(serverName: string, promptName: string, args: Record<string, string>): Promise<PromptMessages>;
  listTools(serverName: string): Promise<Tool[]>;
  listResources(serverName: string): Promise<Resource[]>;
  listPrompts(serverName: string): Promise<Prompt[]>;
  subscribeToResource?(serverName: string, uri: string, callback: (content: ResourceContent) => void): Promise<UnsubscribeFunction>;
  completeSampling?(serverName: string, request: SamplingRequest): Promise<SamplingResult>;
}

/**
 * Configuration Interface
 */
export interface Configuration {
  get<T = unknown>(key: string, defaultValue?: T): T | undefined;
  set<T = unknown>(key: string, value: T): void;
  has(key: string): boolean;
  getAll(prefix?: string): Record<string, unknown>;
  onChange?(key: string, callback: (value: unknown, oldValue: unknown) => void): UnsubscribeFunction;
}

/**
 * Theme Interface
 */
export interface ThemeInterface {
  mode: 'light' | 'dark' | 'auto';
  colorScheme?: 'vibrant' | 'muted' | 'accessible';
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    info: string;
    success: string;
    text: string;
    textSecondary: string;
    border: string;
    [key: string]: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    [key: string]: string;
  };
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    [key: string]: string;
  };
  getCSSVar(property: string): string;
  onChange?(callback: (theme: ThemeInterface) => void): UnsubscribeFunction;
}

/**
 * Accessibility Helper Interface
 */
export interface AccessibilityHelper {
  announce(message: string, priority?: 'polite' | 'assertive'): void;
  focus(element: HTMLElement, options?: FocusOptions): void;
  createFocusTrap(container: HTMLElement): () => void;
  prefersReducedMotion(): boolean;
  getARIAAttributes(pattern: string, options?: Record<string, unknown>): Record<string, string>;
}

/**
 * Offline Cache Interface
 */
export interface OfflineCache {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;
  has(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  clear(prefix?: string): Promise<void>;
}

/**
 * Telemetry Interface
 */
export interface Telemetry {
  trackEvent(event: string, properties?: Record<string, unknown>): void;
  trackMetric(metric: string, value: number, unit?: string): void;
  trackError(error: Error, context?: Record<string, unknown>): void;
  startTiming(name: string): () => void;
}

/**
 * Internationalization Interface
 */
export interface InternationalizationInterface {
  locale: string;
  t(key: string, params?: Record<string, unknown>): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string;
  setLocale(locale: string): void;
  onChange?(callback: (locale: string) => void): UnsubscribeFunction;
}

// ============================================================================
// MCP TYPES
// ============================================================================

/**
 * MCP Server Information
 */
export interface MCPServerInfo {
  serverName: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
    sampling?: boolean;
    subscriptions?: boolean;
  };
  tools?: Tool[];
  resources?: Resource[];
  prompts?: Prompt[];
}

/**
 * Tool Definition
 */
export interface Tool {
  name: string;
  description?: string;
  inputSchema: JSONSchema;
}

/**
 * Tool Result
 */
export interface ToolResult {
  content: ToolContent[];
  isError?: boolean;
}

/**
 * Tool Content
 */
export interface ToolContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
  resource?: string;
}

/**
 * Resource Definition
 */
export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * Resource Content
 */
export interface ResourceContent {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;
}

/**
 * Prompt Definition
 */
export interface Prompt {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

/**
 * Prompt Argument
 */
export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

/**
 * Prompt Messages
 */
export interface PromptMessages {
  description?: string;
  messages: PromptMessage[];
}

/**
 * Prompt Message
 */
export interface PromptMessage {
  role: 'user' | 'assistant';
  content: PromptContent;
}

/**
 * Prompt Content
 */
export type PromptContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; uri: string; mimeType?: string; text?: string };

/**
 * JSON Schema
 */
export interface JSONSchema {
  type?: string;
  properties?: Record<string, JSONSchema>;
  required?: string[];
  items?: JSONSchema;
  additionalProperties?: boolean | JSONSchema;
  description?: string;
  enum?: unknown[];
  [key: string]: unknown;
}

/**
 * Sampling Request
 */
export interface SamplingRequest {
  messages: PromptMessage[];
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Sampling Result
 */
export interface SamplingResult {
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
  role: 'assistant';
  content: PromptContent;
}

// ============================================================================
// EVENT TYPES
// ============================================================================

/**
 * MCP Event Names
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
  // Widget events
  | 'mcp:widget:initialized'
  | 'mcp:widget:destroyed'
  | 'mcp:widget:error'
  | 'mcp:widget:refresh-requested'
  | 'mcp:widget:refreshed'
  // Dashboard events
  | 'mcp:dashboard:widget-added'
  | 'mcp:dashboard:widget-removed'
  | 'mcp:dashboard:layout-changed'
  | 'mcp:dashboard:theme-changed'
  | 'mcp:dashboard:config-changed';

/**
 * Tool Event Payloads
 */
export interface ToolInvokeRequestedPayload {
  serverName: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

export interface ToolInvokedPayload {
  serverName: string;
  toolName: string;
  result: ToolResult;
}

export interface ToolErrorPayload {
  serverName: string;
  toolName: string;
  error: ErrorInfo;
}

/**
 * Resource Event Payloads
 */
export interface ResourceReadPayload {
  serverName: string;
  uri: string;
  content: ResourceContent;
}

export interface ResourceUpdatedPayload {
  serverName: string;
  uri: string;
  content: ResourceContent;
}

/**
 * Widget Event Payloads
 */
export interface WidgetInitializedPayload {
  element: string;
  displayName: string;
}

export interface WidgetErrorPayload {
  element: string;
  error: ErrorInfo;
}

/**
 * Error Information
 */
export interface ErrorInfo {
  code: string;
  message: string;
  details?: unknown;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

/**
 * Widget Permissions
 */
export interface WidgetPermissions {
  tools?: string[];           // Tool name patterns (e.g., ['create_*', 'delete_*'])
  resources?: string[];       // Resource URI patterns
  prompts?: string[];         // Prompt name patterns
  network?: string[];         // Allowed domains
  storage?: boolean;          // Local storage access
  crossWidget?: boolean;      // Cross-widget communication
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Dashboard Configuration
 */
export interface DashboardConfiguration {
  version: string;
  metadata: {
    name: string;
    description?: string;
    author?: string;
  };
  servers: ServerConfiguration[];
  widgets: WidgetConfiguration[];
  layout?: LayoutConfiguration;
  theme?: ThemeConfiguration;
  features?: FeatureFlags;
}

/**
 * Server Configuration
 */
export interface ServerConfiguration {
  name: string;
  transport: 'stdio' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  auth?: {
    type: 'bearer' | 'basic';
    token?: string;
    username?: string;
    password?: string;
  };
}

/**
 * Widget Configuration
 */
export interface WidgetConfiguration {
  id: string;
  package: string;
  serverName: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  config?: Record<string, unknown>;
}

/**
 * Layout Configuration
 */
export interface LayoutConfiguration {
  type: 'grid' | 'flex' | 'absolute';
  columns?: number;
  gap?: string;
  responsive?: boolean;
}

/**
 * Theme Configuration
 */
export interface ThemeConfiguration {
  mode: 'light' | 'dark' | 'auto';
  colorScheme?: 'vibrant' | 'muted' | 'accessible';
  customColors?: Record<string, string>;
}

/**
 * Feature Flags
 */
export interface FeatureFlags {
  confirmations?: boolean;
  telemetry?: boolean;
  offlineMode?: boolean;
  experimentalFeatures?: boolean;
}

// ============================================================================
// EDGE CASE TYPES
// ============================================================================

/**
 * Standard MCP Lens Error Codes
 */
export type MCPLensErrorCode =
  // Transient errors (retryable)
  | 'TIMEOUT'
  | 'SERVER_DISCONNECTED'
  | 'NETWORK_ERROR'
  | 'RATE_LIMIT_EXCEEDED'
  // Permanent errors (not retryable)
  | 'USER_REJECTED'
  | 'USER_TIMEOUT'
  | 'INVALID_ARGUMENTS'
  | 'PERMISSION_DENIED'
  | 'TOOL_NOT_FOUND'
  | 'RESOURCE_NOT_FOUND'
  | 'SCHEMA_VALIDATION_ERROR'
  | 'SERVER_ERROR';

/**
 * Widget Timeout Configuration
 */
export interface WidgetTimeouts {
  /** Tool call timeout in milliseconds (default: 30000) */
  toolCall?: number;
  /** Initialization timeout in milliseconds (default: 5000) */
  initialize?: number;
  /** Destroy timeout in milliseconds (default: 3000) */
  destroy?: number;
}

/**
 * Server Disconnection Event
 */
export interface ServerDisconnectedPayload {
  serverName: string;
  reason: 'network' | 'process-exit' | 'timeout';
  pendingOperations: number;
}

/**
 * Server Reconnection Event
 */
export interface ServerConnectedPayload {
  serverName: string;
  wasReconnection: boolean;
  downtime?: number;  // milliseconds
}

/**
 * Widget Resource Warning Event
 */
export interface WidgetResourceWarningPayload {
  element: string;
  metric: 'memory' | 'bundle-size' | 'dom-nodes';
  value: number;
  budget: number;
}

/**
 * Widget Performance Warning Event
 */
export interface WidgetPerformanceWarningPayload {
  element: string;
  metric: 'render-time' | 'event-handler-duration';
  value: number;  // milliseconds
  budget: number; // milliseconds
}

/**
 * Widget Security Violation Event
 */
export interface WidgetSecurityViolationPayload {
  element: string;
  violation: 'PERMISSION_ESCALATION' | 'CSP_VIOLATION' | 'XSS_ATTEMPT';
  attempted: {
    operation: string;
    [key: string]: unknown;
  };
  declared: {
    [key: string]: unknown;
  };
}

/**
 * Retry Configuration
 */
export interface RetryConfig {
  maxRetries: number;
  backoffMs: number;
  exponential: boolean;
}

