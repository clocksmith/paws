/**
 * Widget Factory and API Types
 *
 * These types define the contract for widget factories and the APIs they expose.
 * Based on MCP-WP Specification Section 3 (Widget Factory Contract)
 */

import type { Dependencies } from './dependencies.js';
import type { MCPServerInfo } from './mcp.js';
import type { WidgetPermissions } from './permissions.js';

/**
 * Widget Factory Function
 *
 * Default export from widget packages. Creates and initializes a widget.
 *
 * @param dependencies - Host-provided dependencies (EventBus, MCPBridge, etc.)
 * @param mcpServerInfo - Information about the MCP server this widget represents
 * @returns WidgetFactory containing API and metadata
 */
export type WidgetFactoryFunction = (
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
) => WidgetFactory | Promise<WidgetFactory>;

/**
 * Widget Factory Return Value
 *
 * Contains the widget API and metadata.
 */
export interface WidgetFactory {
  /**
   * Widget API - lifecycle methods
   */
  api: WidgetAPI;

  /**
   * Widget Metadata - describes the widget
   */
  widget: WidgetMetadata;
}

/**
 * Widget API
 *
 * Lifecycle methods that host can call to manage widget.
 */
export interface WidgetAPI {
  /**
   * Initialize the widget
   * Called after widget factory returns but before first render
   */
  initialize(): Promise<void>;

  /**
   * Destroy the widget
   * Called when widget is being removed from dashboard
   * Should cleanup event listeners, timers, etc.
   */
  destroy(): Promise<void>;

  /**
   * Refresh the widget
   * Called when user requests manual refresh or when MCP server state changes
   */
  refresh(): Promise<void>;

  /**
   * Get widget status
   * Optional method to report widget health/state
   */
  getStatus?(): WidgetStatus;

  /**
   * Get resource usage
   * Optional method for performance monitoring
   */
  getResourceUsage?(): ResourceUsage;
}

/**
 * Widget Metadata
 *
 * Describes the widget and its capabilities.
 */
export interface WidgetMetadata {
  /**
   * MCP-WP protocol version (e.g., "1.0.0")
   */
  protocolVersion: string;

  /**
   * Custom element tag name (must include hyphen, e.g., "github-mcp-widget")
   */
  element: string;

  /**
   * Human-readable widget name
   */
  displayName: string;

  /**
   * Widget description (optional)
   */
  description?: string;

  /**
   * Widget capabilities (what MCP features it uses)
   */
  capabilities: WidgetCapabilities;

  /**
   * Required permissions (optional)
   */
  permissions?: WidgetPermissions;

  /**
   * Widget version
   */
  version?: string;

  /**
   * Author information
   */
  author?: string | AuthorInfo;

  /**
   * Widget icon (URL or data URI)
   */
  icon?: string;

  /**
   * Widget category
   */
  category?: WidgetCategory;

  /**
   * Tags for discovery
   */
  tags?: string[];
}

/**
 * Widget Capabilities
 *
 * Declares which MCP features the widget uses.
 */
export interface WidgetCapabilities {
  /**
   * Widget uses MCP tools
   */
  tools: boolean;

  /**
   * Widget reads MCP resources
   */
  resources: boolean;

  /**
   * Widget uses MCP prompts
   */
  prompts: boolean;

  /**
   * Widget uses sampling
   */
  sampling?: boolean;

  /**
   * Widget subscribes to resource updates
   */
  subscriptions?: boolean;
}

/**
 * Widget Status
 *
 * Current operational status of the widget.
 */
export interface WidgetStatus {
  /**
   * Overall status
   */
  status: 'healthy' | 'degraded' | 'error' | 'initializing';

  /**
   * Status message
   */
  message?: string;

  /**
   * Detailed error information (if status is 'error')
   */
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  /**
   * Last update timestamp
   */
  lastUpdate?: Date;
}

/**
 * Resource Usage
 *
 * Widget resource consumption metrics.
 * Used for performance monitoring per MCP-WP Section 18.
 */
export interface ResourceUsage {
  /**
   * Memory usage in bytes
   */
  memory: number;

  /**
   * Render time in milliseconds
   */
  renderTime: number;

  /**
   * Bundle size in bytes
   */
  bundleSize?: number;

  /**
   * Number of DOM nodes
   */
  domNodes?: number;
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

/**
 * Widget Component (Custom Element)
 *
 * The actual Web Component class.
 */
export interface WidgetComponent extends HTMLElement {
  /**
   * Connected callback - element added to DOM
   */
  connectedCallback(): void;

  /**
   * Disconnected callback - element removed from DOM
   */
  disconnectedCallback(): void;

  /**
   * Attribute changed callback
   */
  attributeChangedCallback?(
    name: string,
    oldValue: string | null,
    newValue: string | null
  ): void;
}

/**
 * Widget Constructor
 */
export interface WidgetConstructor {
  new (): WidgetComponent;
  observedAttributes?: string[];
}
