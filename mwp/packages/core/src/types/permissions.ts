/**
 * Permission Model Types
 *
 * Defines permission system for widgets accessing MCP server capabilities.
 * Based on MWP Specification Section 10 (Security & Permissions)
 */

/**
 * Widget Permissions
 *
 * Declares what MCP capabilities a widget requires access to.
 */
export interface WidgetPermissions {
  /**
   * Required tool permissions
   */
  tools?: ToolPermissions;

  /**
   * Required resource permissions
   */
  resources?: ResourcePermissions;

  /**
   * Required prompt permissions
   */
  prompts?: PromptPermissions;

  /**
   * Required sampling permissions
   */
  sampling?: SamplingPermissions;

  /**
   * Network access permissions
   */
  network?: NetworkPermissions;

  /**
   * Storage/cache permissions
   */
  storage?: StoragePermissions;

  /**
   * Cross-widget communication permissions
   */
  crossWidget?: CrossWidgetPermissions;
}

/**
 * Tool Permissions
 *
 * Controls which tools a widget can invoke.
 */
export interface ToolPermissions {
  /**
   * Permission scope
   * - "all": Widget can invoke any tool
   * - "allowlist": Widget can only invoke listed tools
   * - "denylist": Widget can invoke any tool except listed ones
   * - "none": Widget cannot invoke any tools
   */
  scope: 'all' | 'allowlist' | 'denylist' | 'none';

  /**
   * Tool patterns (for allowlist/denylist)
   * Supports wildcards (e.g., "github:*", "filesystem:read_*")
   */
  patterns?: string[];

  /**
   * Require user confirmation before invoking tools
   * - true: Always require confirmation
   * - false: Never require confirmation
   * - Array: Require confirmation for specific tools
   */
  requireConfirmation?: boolean | string[];

  /**
   * Maximum number of tool calls per time period
   */
  rateLimit?: RateLimit;

  /**
   * Additional tool-specific constraints
   */
  constraints?: ToolConstraints;
}

/**
 * Resource Permissions
 *
 * Controls which resources a widget can read.
 */
export interface ResourcePermissions {
  /**
   * Permission scope
   */
  scope: 'all' | 'allowlist' | 'denylist' | 'none';

  /**
   * Resource URI patterns (for allowlist/denylist)
   * Supports wildcards (e.g., "file:///*", "github://user/repo/*")
   */
  patterns?: string[];

  /**
   * Allow resource subscriptions
   */
  allowSubscriptions?: boolean;

  /**
   * Maximum number of resource reads per time period
   */
  rateLimit?: RateLimit;

  /**
   * Maximum resource size (in bytes)
   */
  maxResourceSize?: number;
}

/**
 * Prompt Permissions
 *
 * Controls which prompts a widget can access.
 */
export interface PromptPermissions {
  /**
   * Permission scope
   */
  scope: 'all' | 'allowlist' | 'denylist' | 'none';

  /**
   * Prompt name patterns (for allowlist/denylist)
   */
  patterns?: string[];

  /**
   * Maximum number of prompt requests per time period
   */
  rateLimit?: RateLimit;
}

/**
 * Sampling Permissions
 *
 * Controls LLM sampling access.
 */
export interface SamplingPermissions {
  /**
   * Allow sampling requests
   */
  allowed: boolean;

  /**
   * Require user confirmation before sampling
   */
  requireConfirmation?: boolean;

  /**
   * Maximum tokens per request
   */
  maxTokens?: number;

  /**
   * Maximum number of sampling requests per time period
   */
  rateLimit?: RateLimit;

  /**
   * Allowed model preferences
   */
  allowedModels?: string[];

  /**
   * Maximum cost per request (in cents)
   */
  maxCostPerRequest?: number;
}

/**
 * Network Permissions
 *
 * Controls external network access (e.g., fetch() calls).
 */
export interface NetworkPermissions {
  /**
   * Allow external network requests
   */
  allowed: boolean;

  /**
   * Allowed domains/origins
   * Supports wildcards (e.g., "*.github.com", "api.openai.com")
   */
  allowedOrigins?: string[];

  /**
   * Blocked domains/origins
   */
  blockedOrigins?: string[];

  /**
   * Maximum number of requests per time period
   */
  rateLimit?: RateLimit;

  /**
   * Maximum response size (in bytes)
   */
  maxResponseSize?: number;
}

/**
 * Storage Permissions
 *
 * Controls access to local storage, IndexedDB, cache, etc.
 */
export interface StoragePermissions {
  /**
   * Allow localStorage access
   */
  localStorage?: boolean;

  /**
   * Allow sessionStorage access
   */
  sessionStorage?: boolean;

  /**
   * Allow IndexedDB access
   */
  indexedDB?: boolean;

  /**
   * Allow Cache API access
   */
  cache?: boolean;

  /**
   * Maximum storage quota (in bytes)
   */
  maxQuota?: number;

  /**
   * Storage key prefix (namespace isolation)
   * Widget can only access keys starting with this prefix
   */
  keyPrefix?: string;
}

/**
 * Cross-Widget Communication Permissions
 *
 * Controls whether widget can communicate with other widgets.
 */
export interface CrossWidgetPermissions {
  /**
   * Allow sending messages to other widgets
   */
  send?: boolean;

  /**
   * Allow receiving messages from other widgets
   */
  receive?: boolean;

  /**
   * Allowed target widgets (element names or widget IDs)
   */
  allowedTargets?: string[];

  /**
   * Rate limit for message sending
   */
  rateLimit?: RateLimit;
}

/**
 * Rate Limit
 *
 * Rate limiting configuration.
 */
export interface RateLimit {
  /**
   * Maximum number of requests
   */
  maxRequests: number;

  /**
   * Time window (in milliseconds)
   */
  windowMs: number;

  /**
   * Behavior when limit exceeded
   * - "block": Block further requests
   * - "queue": Queue requests until window resets
   * - "error": Throw error
   */
  onExceeded?: 'block' | 'queue' | 'error';
}

/**
 * Tool Constraints
 *
 * Additional constraints on tool invocation.
 */
export interface ToolConstraints {
  /**
   * Maximum execution time (in milliseconds)
   */
  maxExecutionTime?: number;

  /**
   * Maximum argument size (in bytes)
   */
  maxArgumentSize?: number;

  /**
   * Disallow tools with specific annotations
   * e.g., ["destructive", "expensive"]
   */
  disallowAnnotations?: string[];

  /**
   * Custom validation function (not serializable, for runtime use)
   */
  customValidator?: (toolName: string, args: Record<string, unknown>) => boolean;
}

/**
 * Permission Request
 *
 * Widget requests permission at runtime (for dynamic permissions).
 */
export interface PermissionRequest {
  /**
   * Permission type
   */
  type: 'tool' | 'resource' | 'prompt' | 'sampling' | 'network' | 'storage';

  /**
   * Specific permission being requested
   * e.g., tool name, resource URI, domain
   */
  target: string;

  /**
   * Reason for requesting permission (shown to user)
   */
  reason?: string;

  /**
   * Whether this is a one-time request
   */
  oneTime?: boolean;
}

/**
 * Permission Grant
 *
 * User/host grants permission to widget.
 */
export interface PermissionGrant {
  /**
   * Permission type
   */
  type: 'tool' | 'resource' | 'prompt' | 'sampling' | 'network' | 'storage';

  /**
   * Granted target
   */
  target: string;

  /**
   * Grant status
   */
  granted: boolean;

  /**
   * Expiration time (for temporary grants)
   */
  expiresAt?: Date;

  /**
   * Grant timestamp
   */
  grantedAt: Date;

  /**
   * User who granted permission
   */
  grantedBy?: string;
}

/**
 * Permission Denial
 *
 * Host denies permission request.
 */
export interface PermissionDenial {
  /**
   * Permission type
   */
  type: 'tool' | 'resource' | 'prompt' | 'sampling' | 'network' | 'storage';

  /**
   * Denied target
   */
  target: string;

  /**
   * Reason for denial
   */
  reason: string;

  /**
   * Whether user can retry
   */
  canRetry: boolean;
}

/**
 * Permission Validator
 *
 * Validates whether a widget has permission for an action.
 */
export interface PermissionValidator {
  /**
   * Check if widget has tool permission
   */
  canInvokeTool(
    widgetPermissions: WidgetPermissions,
    toolName: string,
    args?: Record<string, unknown>
  ): boolean;

  /**
   * Check if widget has resource permission
   */
  canReadResource(
    widgetPermissions: WidgetPermissions,
    resourceUri: string
  ): boolean;

  /**
   * Check if widget has prompt permission
   */
  canGetPrompt(
    widgetPermissions: WidgetPermissions,
    promptName: string
  ): boolean;

  /**
   * Check if widget has sampling permission
   */
  canRequestSampling(
    widgetPermissions: WidgetPermissions,
    request: {
      maxTokens?: number;
      model?: string;
    }
  ): boolean;

  /**
   * Check if widget has network permission
   */
  canAccessNetwork(
    widgetPermissions: WidgetPermissions,
    origin: string
  ): boolean;

  /**
   * Check if widget has storage permission
   */
  canAccessStorage(
    widgetPermissions: WidgetPermissions,
    storageType: 'localStorage' | 'sessionStorage' | 'indexedDB' | 'cache',
    key?: string
  ): boolean;
}

/**
 * Permission Helper Functions
 */

/**
 * Check if pattern matches target
 * Supports wildcards (*, **)
 */
export function matchesPattern(pattern: string, target: string): boolean {
  const regexPattern = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*');
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(target);
}

/**
 * Check if target matches any pattern in list
 */
export function matchesAnyPattern(patterns: string[], target: string): boolean {
  return patterns.some(pattern => matchesPattern(pattern, target));
}

/**
 * Merge permission sets (for permission inheritance)
 */
export function mergePermissions(
  base: WidgetPermissions,
  override: WidgetPermissions
): WidgetPermissions {
  return {
    tools: override.tools ?? base.tools,
    resources: override.resources ?? base.resources,
    prompts: override.prompts ?? base.prompts,
    sampling: override.sampling ?? base.sampling,
    network: override.network ?? base.network,
    storage: override.storage ?? base.storage,
    crossWidget: override.crossWidget ?? base.crossWidget,
  };
}

/**
 * Create restrictive default permissions (deny all)
 */
export function createDefaultPermissions(): WidgetPermissions {
  return {
    tools: { scope: 'none' },
    resources: { scope: 'none' },
    prompts: { scope: 'none' },
    sampling: { allowed: false },
    network: { allowed: false },
    storage: { localStorage: false, sessionStorage: false, indexedDB: false, cache: false },
    crossWidget: { send: false, receive: false },
  };
}

/**
 * Create permissive default permissions (allow all, for development)
 */
export function createPermissivePermissions(): WidgetPermissions {
  return {
    tools: { scope: 'all' },
    resources: { scope: 'all', allowSubscriptions: true },
    prompts: { scope: 'all' },
    sampling: { allowed: true },
    network: { allowed: true },
    storage: { localStorage: true, sessionStorage: true, indexedDB: true, cache: true },
    crossWidget: { send: true, receive: true },
  };
}
