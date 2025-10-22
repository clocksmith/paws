/**
 * Configuration Types
 *
 * Defines configuration structures for dashboard and widgets.
 * Based on MCP-WP Specification Section 11 (Configuration)
 */

import type { WidgetPermissions } from './permissions.js';

/**
 * Dashboard Configuration
 *
 * Complete configuration for an MCP-WP dashboard.
 */
export interface DashboardConfiguration {
  /**
   * Dashboard metadata
   */
  metadata: DashboardMetadata;

  /**
   * MCP server configurations
   */
  servers: ServerConfiguration[];

  /**
   * Widget configurations
   */
  widgets: WidgetConfiguration[];

  /**
   * Dashboard layout
   */
  layout?: LayoutConfiguration;

  /**
   * Theme configuration
   */
  theme?: ThemeConfiguration;

  /**
   * Global permissions (applied to all widgets unless overridden)
   */
  globalPermissions?: WidgetPermissions;

  /**
   * Feature flags
   */
  features?: FeatureFlags;

  /**
   * Advanced settings
   */
  advanced?: AdvancedConfiguration;
}

/**
 * Dashboard Metadata
 */
export interface DashboardMetadata {
  /**
   * Dashboard name
   */
  name: string;

  /**
   * Dashboard version
   */
  version: string;

  /**
   * Dashboard description
   */
  description?: string;

  /**
   * Author information
   */
  author?: string | {
    name: string;
    email?: string;
    url?: string;
  };

  /**
   * Dashboard tags
   */
  tags?: string[];

  /**
   * Creation timestamp
   */
  createdAt?: string;

  /**
   * Last modified timestamp
   */
  updatedAt?: string;
}

/**
 * Server Configuration
 *
 * Configuration for connecting to an MCP server.
 */
export interface ServerConfiguration {
  /**
   * Server identifier (unique name)
   */
  name: string;

  /**
   * Server display name
   */
  displayName?: string;

  /**
   * Server description
   */
  description?: string;

  /**
   * Transport configuration
   */
  transport: StdioTransportConfiguration | HttpTransportConfiguration;

  /**
   * Server environment variables
   */
  env?: Record<string, string>;

  /**
   * Connection timeout (in milliseconds)
   */
  timeout?: number;

  /**
   * Retry configuration
   */
  retry?: RetryConfiguration;

  /**
   * Server-specific permissions
   */
  permissions?: WidgetPermissions;

  /**
   * Auto-connect on dashboard load
   */
  autoConnect?: boolean;

  /**
   * Server icon (URL or data URI)
   */
  icon?: string;

  /**
   * Server tags
   */
  tags?: string[];

  /**
   * Whether server is enabled
   */
  enabled?: boolean;
}

/**
 * Stdio Transport Configuration
 */
export interface StdioTransportConfiguration {
  /**
   * Transport type
   */
  type: 'stdio';

  /**
   * Command to execute
   */
  command: string;

  /**
   * Command arguments
   */
  args?: string[];

  /**
   * Working directory
   */
  cwd?: string;

  /**
   * Additional environment variables
   */
  env?: Record<string, string>;
}

/**
 * HTTP Transport Configuration
 */
export interface HttpTransportConfiguration {
  /**
   * Transport type
   */
  type: 'http';

  /**
   * Server URL
   */
  url: string;

  /**
   * HTTP headers
   */
  headers?: Record<string, string>;

  /**
   * Authentication configuration
   */
  auth?: HttpAuthConfiguration;
}

/**
 * HTTP Authentication Configuration
 */
export interface HttpAuthConfiguration {
  /**
   * Auth type
   */
  type: 'bearer' | 'basic' | 'apikey';

  /**
   * Bearer token
   */
  token?: string;

  /**
   * Basic auth username
   */
  username?: string;

  /**
   * Basic auth password
   */
  password?: string;

  /**
   * API key name (header or query param)
   */
  apiKeyName?: string;

  /**
   * API key value
   */
  apiKeyValue?: string;

  /**
   * Where to send API key
   */
  apiKeyIn?: 'header' | 'query';
}

/**
 * Retry Configuration
 */
export interface RetryConfiguration {
  /**
   * Maximum number of retry attempts
   */
  maxAttempts: number;

  /**
   * Initial delay (in milliseconds)
   */
  initialDelay: number;

  /**
   * Maximum delay (in milliseconds)
   */
  maxDelay: number;

  /**
   * Backoff multiplier
   */
  backoffMultiplier: number;

  /**
   * Retry on these error codes
   */
  retryOnCodes?: number[];
}

/**
 * Widget Configuration
 *
 * Configuration for a widget instance.
 */
export interface WidgetConfiguration {
  /**
   * Widget instance ID (unique)
   */
  id: string;

  /**
   * Widget package name (e.g., "@mcp-wp/widget-github")
   */
  package: string;

  /**
   * MCP server name this widget connects to
   */
  serverName: string;

  /**
   * Widget display name (overrides default)
   */
  displayName?: string;

  /**
   * Widget-specific configuration
   */
  config?: Record<string, unknown>;

  /**
   * Widget permissions (overrides global permissions)
   */
  permissions?: WidgetPermissions;

  /**
   * Widget position in layout
   */
  position?: WidgetPosition;

  /**
   * Widget size in layout
   */
  size?: WidgetSize;

  /**
   * Whether widget is visible
   */
  visible?: boolean;

  /**
   * Whether widget is enabled
   */
  enabled?: boolean;

  /**
   * Auto-refresh interval (in milliseconds, 0 = disabled)
   */
  refreshInterval?: number;
}

/**
 * Widget Position
 */
export interface WidgetPosition {
  /**
   * X coordinate (grid column)
   */
  x: number;

  /**
   * Y coordinate (grid row)
   */
  y: number;
}

/**
 * Widget Size
 */
export interface WidgetSize {
  /**
   * Width (grid columns)
   */
  w: number;

  /**
   * Height (grid rows)
   */
  h: number;

  /**
   * Minimum width (grid columns)
   */
  minW?: number;

  /**
   * Minimum height (grid rows)
   */
  minH?: number;

  /**
   * Maximum width (grid columns)
   */
  maxW?: number;

  /**
   * Maximum height (grid rows)
   */
  maxH?: number;
}

/**
 * Layout Configuration
 */
export interface LayoutConfiguration {
  /**
   * Layout type
   */
  type: 'grid' | 'flexbox' | 'masonry' | 'custom';

  /**
   * Number of columns
   */
  columns?: number;

  /**
   * Row height (in pixels)
   */
  rowHeight?: number;

  /**
   * Gap between widgets (in pixels)
   */
  gap?: number;

  /**
   * Padding around dashboard (in pixels)
   */
  padding?: number;

  /**
   * Whether layout is responsive
   */
  responsive?: boolean;

  /**
   * Breakpoints for responsive layout
   */
  breakpoints?: LayoutBreakpoint[];

  /**
   * Whether widgets can be dragged
   */
  draggable?: boolean;

  /**
   * Whether widgets can be resized
   */
  resizable?: boolean;

  /**
   * Compact mode (minimize gaps)
   */
  compact?: boolean;
}

/**
 * Layout Breakpoint
 */
export interface LayoutBreakpoint {
  /**
   * Breakpoint name
   */
  name: string;

  /**
   * Minimum width (in pixels)
   */
  minWidth: number;

  /**
   * Number of columns at this breakpoint
   */
  columns: number;

  /**
   * Row height at this breakpoint
   */
  rowHeight?: number;
}

/**
 * Theme Configuration
 */
export interface ThemeConfiguration {
  /**
   * Theme mode
   */
  mode: 'light' | 'dark' | 'auto';

  /**
   * Color scheme intensity
   * Affects saturation and vibrancy of theme colors
   */
  colorScheme?: 'vibrant' | 'muted' | 'accessible';

  /**
   * Primary color
   */
  primaryColor?: string;

  /**
   * Secondary color
   */
  secondaryColor?: string;

  /**
   * Accent color
   */
  accentColor?: string;

  /**
   * Background color
   */
  backgroundColor?: string;

  /**
   * Surface color
   */
  surfaceColor?: string;

  /**
   * Text color
   */
  textColor?: string;

  /**
   * Secondary text color
   */
  textSecondaryColor?: string;

  /**
   * Border color
   */
  borderColor?: string;

  /**
   * Semantic colors
   */
  successColor?: string;
  warningColor?: string;
  errorColor?: string;
  infoColor?: string;

  /**
   * Accent colors for multi-color visualizations
   * Array of 5 colors for data categories, tags, etc.
   */
  accentColors?: [string, string, string, string, string];

  /**
   * Data visualization colors
   * Array of 10 colors for charts and graphs
   */
  dataColors?: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string
  ];

  /**
   * Semantic color gradients
   * Light/medium/dark variants for each semantic state
   */
  semanticGradients?: {
    success?: [string, string, string]; // light, medium, dark
    warning?: [string, string, string];
    error?: [string, string, string];
    info?: [string, string, string];
  };

  /**
   * Border radius (in pixels)
   */
  borderRadius?: number;

  /**
   * Font family
   */
  fontFamily?: string;

  /**
   * Font size (base)
   */
  fontSize?: number;

  /**
   * Spacing scale
   */
  spacing?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
  };

  /**
   * Scoped theming configuration
   * Allows widgets to use different themes for chrome vs content
   */
  scopedTheming?: {
    enabled?: boolean;
    defaultScope?: 'host' | 'custom';
  };

  /**
   * Custom CSS variables
   */
  cssVariables?: Record<string, string>;
}

/**
 * Feature Flags
 */
export interface FeatureFlags {
  /**
   * Enable offline mode
   */
  offlineMode?: boolean;

  /**
   * Enable telemetry
   */
  telemetry?: boolean;

  /**
   * Enable accessibility features
   */
  accessibility?: boolean;

  /**
   * Enable internationalization
   */
  i18n?: boolean;

  /**
   * Enable developer tools
   */
  devTools?: boolean;

  /**
   * Enable experimental features
   */
  experimental?: boolean;

  /**
   * Custom feature flags
   */
  [key: string]: boolean | undefined;
}

/**
 * Advanced Configuration
 */
export interface AdvancedConfiguration {
  /**
   * EventBus configuration
   */
  eventBus?: {
    /**
     * Maximum event history size
     */
    maxHistorySize?: number;

    /**
     * Log events to console
     */
    logEvents?: boolean;
  };

  /**
   * MCPBridge configuration
   */
  mcpBridge?: {
    /**
     * Request timeout (in milliseconds)
     */
    requestTimeout?: number;

    /**
     * Enable request batching
     */
    enableBatching?: boolean;

    /**
     * Batch delay (in milliseconds)
     */
    batchDelay?: number;
  };

  /**
   * Cache configuration
   */
  cache?: {
    /**
     * Enable caching
     */
    enabled?: boolean;

    /**
     * Cache TTL (in milliseconds)
     */
    ttl?: number;

    /**
     * Maximum cache size (in bytes)
     */
    maxSize?: number;

    /**
     * Cache strategy
     */
    strategy?: 'lru' | 'lfu' | 'fifo';
  };

  /**
   * Performance configuration
   */
  performance?: {
    /**
     * Enable performance monitoring
     */
    monitoring?: boolean;

    /**
     * Warn if render time exceeds this (in milliseconds)
     */
    renderTimeThreshold?: number;

    /**
     * Warn if memory usage exceeds this (in bytes)
     */
    memoryThreshold?: number;
  };

  /**
   * Security configuration
   */
  security?: {
    /**
     * Enable Content Security Policy
     */
    enableCSP?: boolean;

    /**
     * CSP directives
     */
    cspDirectives?: Record<string, string[]>;

    /**
     * Enable Subresource Integrity
     */
    enableSRI?: boolean;

    /**
     * Trusted widget sources
     */
    trustedSources?: string[];
  };

  /**
   * Logging configuration
   */
  logging?: {
    /**
     * Log level
     */
    level?: 'debug' | 'info' | 'warn' | 'error';

    /**
     * Log to console
     */
    console?: boolean;

    /**
     * Log to remote service
     */
    remote?: {
      enabled: boolean;
      endpoint: string;
      batchSize?: number;
    };
  };
}

/**
 * Configuration Schema Version
 */
export const CONFIGURATION_SCHEMA_VERSION = '1.0.0';

/**
 * Default Dashboard Configuration
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
