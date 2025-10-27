/**
 * Dependencies Interface Types
 *
 * Defines the Dependencies object that hosts inject into widget factories.
 * Based on MWP Specification Section 6 (Dependencies)
 */

/**
 * Dependencies Object
 *
 * Injected by host into widget factory. Contains required and optional services.
 */
export interface Dependencies {
  /**
   * EventBus - Required
   * Pub/sub system for MCP and widget events
   */
  EventBus: EventBus;

  /**
   * MCPBridge - Required
   * Interface to MCP servers (tools, resources, prompts)
   */
  MCPBridge: MCPBridge;

  /**
   * Configuration - Required
   * Widget and dashboard configuration
   */
  Configuration: Configuration;

  /**
   * Theme - Optional
   * Theming system (dark/light mode, colors, spacing)
   */
  Theme?: ThemeInterface;

  /**
   * A11yHelper - Optional
   * Accessibility utilities (ARIA, keyboard nav, screen readers)
   */
  A11yHelper?: AccessibilityHelper;

  /**
   * OfflineCache - Optional
   * Offline caching for resources and tool results
   */
  OfflineCache?: OfflineCache;

  /**
   * Telemetry - Optional
   * Performance and usage tracking
   */
  Telemetry?: Telemetry;

  /**
   * I18n - Optional
   * Internationalization and localization
   */
  I18n?: InternationalizationInterface;
}

/**
 * EventBus Interface
 *
 * Pub/sub system for communication between widgets and host.
 * Emits typed events defined in events.ts.
 */
export interface EventBus {
  /**
   * Emit an event
   * @param event - Event name (see MCPEvent in events.ts)
   * @param data - Event payload
   */
  emit(event: string, data: unknown): void;

  /**
   * Subscribe to an event
   * @param event - Event name
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on(event: string, handler: EventHandler): UnsubscribeFunction;

  /**
   * Unsubscribe from an event
   * @param event - Event name
   * @param handler - Event handler to remove
   */
  off(event: string, handler: EventHandler): void;

  /**
   * Subscribe to an event (one-time)
   * Optional method - handler is called once then removed
   */
  once?(event: string, handler: EventHandler): UnsubscribeFunction;
}

/**
 * Event Handler Function
 */
export type EventHandler = (data: unknown) => void | Promise<void>;

/**
 * Unsubscribe Function
 *
 * Returned by EventBus.on() to allow cleanup.
 */
export type UnsubscribeFunction = () => void;

/**
 * MCPBridge Interface
 *
 * Provides access to MCP server operations (tools, resources, prompts).
 * Abstracts MCP SDK client connection and request handling.
 */
export interface MCPBridge {
  /**
   * Call an MCP tool
   * @param serverName - MCP server identifier
   * @param toolName - Tool name
   * @param args - Tool arguments (validated against tool's inputSchema)
   * @returns Tool execution result
   */
  callTool(
    serverName: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<ToolResult>;

  /**
   * Read an MCP resource
   * @param serverName - MCP server identifier
   * @param uri - Resource URI
   * @returns Resource content
   */
  readResource(serverName: string, uri: string): Promise<ResourceContent>;

  /**
   * Get an MCP prompt
   * @param serverName - MCP server identifier
   * @param promptName - Prompt name
   * @param args - Prompt arguments
   * @returns Prompt messages
   */
  getPrompt(
    serverName: string,
    promptName: string,
    args: Record<string, string>
  ): Promise<PromptMessages>;

  /**
   * List available tools from MCP server
   * @param serverName - MCP server identifier
   * @returns Array of tools
   */
  listTools(serverName: string): Promise<Tool[]>;

  /**
   * List available resources from MCP server
   * @param serverName - MCP server identifier
   * @returns Array of resources
   */
  listResources(serverName: string): Promise<Resource[]>;

  /**
   * List available prompts from MCP server
   * @param serverName - MCP server identifier
   * @returns Array of prompts
   */
  listPrompts(serverName: string): Promise<Prompt[]>;

  /**
   * Subscribe to resource updates (if server supports subscriptions)
   * @param serverName - MCP server identifier
   * @param uri - Resource URI
   * @param callback - Called when resource changes
   * @returns Unsubscribe function
   */
  subscribeToResource?(
    serverName: string,
    uri: string,
    callback: (content: ResourceContent) => void
  ): Promise<UnsubscribeFunction>;

  /**
   * Complete a sampling request (if server supports sampling)
   * @param serverName - MCP server identifier
   * @param request - Sampling request
   * @returns Sampling result
   */
  completeSampling?(
    serverName: string,
    request: SamplingRequest
  ): Promise<SamplingResult>;
}

/**
 * Tool Result
 *
 * Result from calling an MCP tool.
 */
export interface ToolResult {
  /**
   * Tool output content
   */
  content: ToolContent[];

  /**
   * Whether tool call completed successfully
   */
  isError?: boolean;
}

/**
 * Tool Content
 *
 * Content item in tool result.
 */
export interface ToolContent {
  /**
   * Content type
   */
  type: 'text' | 'image' | 'resource';

  /**
   * Text content (if type === 'text')
   */
  text?: string;

  /**
   * Image data (if type === 'image')
   */
  data?: string;

  /**
   * MIME type (if type === 'image')
   */
  mimeType?: string;

  /**
   * Resource URI (if type === 'resource')
   */
  resource?: string;
}

/**
 * Resource Content
 *
 * Content from reading an MCP resource.
 */
export interface ResourceContent {
  /**
   * Resource URI
   */
  uri: string;

  /**
   * MIME type
   */
  mimeType?: string;

  /**
   * Resource content (text or blob)
   */
  text?: string;
  blob?: string;
}

/**
 * Prompt Messages
 *
 * Messages from getting an MCP prompt.
 */
export interface PromptMessages {
  /**
   * Prompt description
   */
  description?: string;

  /**
   * Prompt messages
   */
  messages: PromptMessage[];
}

/**
 * Prompt Message
 */
export interface PromptMessage {
  /**
   * Message role
   */
  role: 'user' | 'assistant';

  /**
   * Message content
   */
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
 * Tool Definition
 */
export interface Tool {
  /**
   * Tool name
   */
  name: string;

  /**
   * Tool description
   */
  description?: string;

  /**
   * Input schema (JSON Schema)
   */
  inputSchema: JSONSchema;
}

/**
 * Resource Definition
 */
export interface Resource {
  /**
   * Resource URI
   */
  uri: string;

  /**
   * Resource name
   */
  name: string;

  /**
   * Resource description
   */
  description?: string;

  /**
   * MIME type
   */
  mimeType?: string;
}

/**
 * Prompt Definition
 */
export interface Prompt {
  /**
   * Prompt name
   */
  name: string;

  /**
   * Prompt description
   */
  description?: string;

  /**
   * Prompt arguments
   */
  arguments?: PromptArgument[];
}

/**
 * Prompt Argument
 */
export interface PromptArgument {
  /**
   * Argument name
   */
  name: string;

  /**
   * Argument description
   */
  description?: string;

  /**
   * Whether argument is required
   */
  required?: boolean;
}

/**
 * JSON Schema
 *
 * Standard JSON Schema for validation.
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
 *
 * Request for LLM sampling (if server supports sampling capability).
 */
export interface SamplingRequest {
  /**
   * Messages to send to LLM
   */
  messages: PromptMessage[];

  /**
   * Model preferences
   */
  modelPreferences?: {
    hints?: Array<{ name?: string }>;
    costPriority?: number;
    speedPriority?: number;
    intelligencePriority?: number;
  };

  /**
   * System prompt
   */
  systemPrompt?: string;

  /**
   * Include context
   */
  includeContext?: 'none' | 'thisServer' | 'allServers';

  /**
   * Temperature
   */
  temperature?: number;

  /**
   * Max tokens
   */
  maxTokens?: number;

  /**
   * Stop sequences
   */
  stopSequences?: string[];

  /**
   * Additional metadata
   */
  metadata?: Record<string, unknown>;
}

/**
 * Sampling Result
 *
 * Result from LLM sampling.
 */
export interface SamplingResult {
  /**
   * Model used
   */
  model: string;

  /**
   * Stop reason
   */
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';

  /**
   * Role of response
   */
  role: 'assistant';

  /**
   * Response content
   */
  content: PromptContent;
}

/**
 * Configuration Interface
 *
 * Widget and dashboard configuration.
 */
export interface Configuration {
  /**
   * Get configuration value
   * @param key - Configuration key (dot-notation supported, e.g., 'widget.github.token')
   * @param defaultValue - Default value if key not found
   * @returns Configuration value
   */
  get<T = unknown>(key: string, defaultValue?: T): T | undefined;

  /**
   * Set configuration value
   * @param key - Configuration key
   * @param value - Configuration value
   */
  set<T = unknown>(key: string, value: T): void;

  /**
   * Check if configuration key exists
   * @param key - Configuration key
   * @returns True if key exists
   */
  has(key: string): boolean;

  /**
   * Get all configuration for a prefix
   * @param prefix - Key prefix (e.g., 'widget.github')
   * @returns Configuration object
   */
  getAll(prefix?: string): Record<string, unknown>;

  /**
   * Subscribe to configuration changes
   * @param key - Configuration key (or prefix with wildcard, e.g., 'widget.*')
   * @param callback - Called when configuration changes
   * @returns Unsubscribe function
   */
  onChange?(
    key: string,
    callback: (value: unknown, oldValue: unknown) => void
  ): UnsubscribeFunction;
}

/**
 * Theme Interface
 *
 * Optional theming system with support for complex widget styling.
 */
export interface ThemeInterface {
  /**
   * Current theme mode
   */
  mode: 'light' | 'dark' | 'auto';

  /**
   * Theme color scheme
   * Influences color saturation and intensity
   */
  colorScheme?: 'vibrant' | 'muted' | 'accessible';

  /**
   * Base theme colors
   */
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

  /**
   * Accent colors for multi-color visualizations
   * Use for data categories, tags, or visual accents
   */
  accentColors?: {
    accent1: string;
    accent2: string;
    accent3: string;
    accent4: string;
    accent5: string;
    [key: string]: string;
  };

  /**
   * Data visualization colors
   * Designed for charts, graphs, and data-heavy widgets
   */
  dataColors?: {
    data1: string;
    data2: string;
    data3: string;
    data4: string;
    data5: string;
    data6: string;
    data7: string;
    data8: string;
    data9: string;
    data10: string;
    [key: string]: string;
  };

  /**
   * Semantic color gradients
   * Provide light/medium/dark variants for semantic states
   */
  semanticColors?: {
    successLight: string;
    successMedium: string;
    successDark: string;
    warningLight: string;
    warningMedium: string;
    warningDark: string;
    errorLight: string;
    errorMedium: string;
    errorDark: string;
    infoLight: string;
    infoMedium: string;
    infoDark: string;
    [key: string]: string;
  };

  /**
   * Spacing scale (in pixels or rem)
   */
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    [key: string]: string;
  };

  /**
   * Typography
   */
  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    [key: string]: string;
  };

  /**
   * Get CSS custom property value
   * @param property - CSS custom property name (e.g., '--color-primary')
   * @returns Property value
   */
  getCSSVar(property: string): string;

  /**
   * Get current color scheme setting
   * @returns Color scheme ('vibrant' | 'muted' | 'accessible')
   */
  getColorScheme?(): 'vibrant' | 'muted' | 'accessible';

  /**
   * Calculate contrast ratio between two colors (WCAG)
   * @param color1 - First color (hex, rgb, or CSS color)
   * @param color2 - Second color (hex, rgb, or CSS color)
   * @returns Contrast ratio (1-21)
   */
  getContrastRatio?(color1: string, color2: string): number;

  /**
   * Adapt a custom color to the current theme mode
   * Automatically adjusts saturation/brightness for dark mode
   * @param color - Custom color to adapt (hex, rgb, or CSS color)
   * @param options - Adaptation options
   * @returns Adapted color string
   */
  adaptColor?(color: string, options?: ColorAdaptationOptions): string;

  /**
   * Generate a color scale from a base color
   * Useful for creating gradients or shades
   * @param baseColor - Starting color
   * @param steps - Number of steps in the scale (default: 5)
   * @returns Array of color strings
   */
  generateColorScale?(baseColor: string, steps?: number): string[];

  /**
   * Subscribe to theme changes
   * @param callback - Called when theme changes
   * @returns Unsubscribe function
   */
  onChange?(callback: (theme: ThemeInterface) => void): UnsubscribeFunction;
}

/**
 * Color Adaptation Options
 *
 * Options for adapting custom colors to theme mode.
 */
export interface ColorAdaptationOptions {
  /**
   * Respect current theme mode (light/dark)
   * If true, color will be adjusted for visibility in current mode
   */
  respectMode?: boolean;

  /**
   * Preserve hue while adapting saturation and brightness
   */
  preserveHue?: boolean;

  /**
   * Target contrast ratio against background (WCAG)
   * Will adjust color to meet this ratio (e.g., 4.5 for AA)
   */
  targetContrast?: number;

  /**
   * Intensity adjustment (-1 to 1)
   * Negative values darken, positive values lighten
   */
  intensity?: number;
}

/**
 * Scoped Theme Configuration
 *
 * Allows widgets to apply different theming to different zones.
 */
export interface ScopedThemeConfig {
  /**
   * Theme scope for widget chrome (borders, headers, controls)
   * 'host' - Use host theme tokens
   * 'custom' - Use widget-specific styling
   */
  chrome: 'host' | 'custom';

  /**
   * Theme scope for widget content (data visualizations, custom UI)
   * 'host' - Use host theme tokens
   * 'custom' - Use widget-specific styling
   */
  content: 'host' | 'custom';

  /**
   * Custom theme tokens (if chrome or content is 'custom')
   */
  customTokens?: Record<string, string>;
}

/**
 * Accessibility Helper Interface
 *
 * Optional accessibility utilities.
 */
export interface AccessibilityHelper {
  /**
   * Announce to screen readers
   * @param message - Message to announce
   * @param priority - Priority level ('polite' | 'assertive')
   */
  announce(message: string, priority?: 'polite' | 'assertive'): void;

  /**
   * Focus element with proper focus management
   * @param element - Element to focus
   * @param options - Focus options
   */
  focus(element: HTMLElement, options?: FocusOptions): void;

  /**
   * Create keyboard trap (for modals)
   * @param container - Container element
   * @returns Cleanup function
   */
  createFocusTrap(container: HTMLElement): () => void;

  /**
   * Check if reduced motion is preferred
   * @returns True if prefers reduced motion
   */
  prefersReducedMotion(): boolean;

  /**
   * Get ARIA attributes for common patterns
   * @param pattern - Pattern name (e.g., 'dialog', 'menu', 'tabs')
   * @param options - Pattern-specific options
   * @returns ARIA attributes object
   */
  getARIAAttributes(
    pattern: string,
    options?: Record<string, unknown>
  ): Record<string, string>;
}

/**
 * Offline Cache Interface
 *
 * Optional offline caching for resources and tool results.
 */
export interface OfflineCache {
  /**
   * Get cached value
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  get<T = unknown>(key: string): Promise<T | undefined>;

  /**
   * Set cached value
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Time to live in milliseconds (optional)
   */
  set<T = unknown>(key: string, value: T, ttl?: number): Promise<void>;

  /**
   * Check if cache has key
   * @param key - Cache key
   * @returns True if cached
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete cached value
   * @param key - Cache key
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cached values (or prefix)
   * @param prefix - Optional key prefix to clear
   */
  clear(prefix?: string): Promise<void>;
}

/**
 * Telemetry Interface
 *
 * Optional performance and usage tracking.
 */
export interface Telemetry {
  /**
   * Track event
   * @param event - Event name
   * @param properties - Event properties
   */
  trackEvent(event: string, properties?: Record<string, unknown>): void;

  /**
   * Track performance metric
   * @param metric - Metric name
   * @param value - Metric value
   * @param unit - Unit of measurement
   */
  trackMetric(metric: string, value: number, unit?: string): void;

  /**
   * Track error
   * @param error - Error object
   * @param context - Additional context
   */
  trackError(error: Error, context?: Record<string, unknown>): void;

  /**
   * Start performance timing
   * @param name - Timer name
   * @returns Stop function
   */
  startTiming(name: string): () => void;
}

/**
 * Internationalization Interface
 *
 * Optional i18n and l10n support.
 */
export interface InternationalizationInterface {
  /**
   * Current locale
   */
  locale: string;

  /**
   * Translate message
   * @param key - Translation key
   * @param params - Interpolation parameters
   * @returns Translated message
   */
  t(key: string, params?: Record<string, unknown>): string;

  /**
   * Format number
   * @param value - Number to format
   * @param options - Formatting options
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;

  /**
   * Format date
   * @param value - Date to format
   * @param options - Formatting options
   */
  formatDate(value: Date, options?: Intl.DateTimeFormatOptions): string;

  /**
   * Change locale
   * @param locale - New locale
   */
  setLocale(locale: string): void;

  /**
   * Subscribe to locale changes
   * @param callback - Called when locale changes
   * @returns Unsubscribe function
   */
  onChange?(callback: (locale: string) => void): UnsubscribeFunction;
}
