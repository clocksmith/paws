/**
 * Dashboard Type Definitions
 */

import type {
  WidgetFactoryFunction,
  ServerConfiguration,
  ThemeConfiguration,
  WidgetStatus,
  ResourceUsage,
} from '@mwp/core';

/**
 * Dashboard Options
 */
export interface DashboardOptions {
  /** Container element for dashboard */
  container: HTMLElement;

  /** Theme configuration */
  theme?: ThemeConfiguration;

  /** Layout configuration */
  layout?: LayoutConfiguration;

  /** Dashboard settings */
  settings?: DashboardSettings;
}

/**
 * Dashboard Settings
 */
export interface DashboardSettings {
  /** Auto-refresh interval in milliseconds */
  autoRefresh?: number;

  /** Enable performance monitoring */
  monitoring?: boolean;

  /** Enable developer tools */
  devtools?: boolean;

  /** Maximum number of widgets */
  maxWidgets?: number;

  /** Enable widget animations */
  animations?: boolean;

  /** Widget spacing in pixels */
  spacing?: number;
}

/**
 * Layout Configuration
 */
export interface LayoutConfiguration {
  /** Layout type */
  type: 'grid' | 'flex' | 'custom';

  /** Grid-specific options */
  columns?: number;
  rows?: number | 'auto';
  gap?: number;
  columnTemplate?: string;
  rowTemplate?: string;

  /** Flex-specific options */
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  wrap?: boolean;
  alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
  justifyContent?:
    | 'flex-start'
    | 'flex-end'
    | 'center'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';

  /** Custom layout styles */
  customStyles?: string;
}

/**
 * Widget Layout Position
 */
export interface WidgetLayout {
  // Grid layout
  column?: number;
  row?: number;
  width?: number;
  height?: number;

  // Flex layout
  flex?: string;
  order?: number;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  maxHeight?: number;

  // Custom positioning
  customStyles?: string;
}

/**
 * Add Widget Options
 */
export interface AddWidgetOptions {
  /** Widget factory function */
  factory: WidgetFactoryFunction;

  /** MCP server name */
  serverName: string;

  /** MCP server configuration */
  config: ServerConfiguration;

  /** Widget layout configuration */
  layout?: WidgetLayout;

  /** Widget-specific configuration */
  widgetConfig?: Record<string, unknown>;

  /** Widget ID (auto-generated if not provided) */
  widgetId?: string;
}

/**
 * Widget Instance
 */
export interface WidgetInstance {
  /** Widget ID */
  widgetId: string;

  /** Widget element */
  element: HTMLElement;

  /** Widget API */
  api: {
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    refresh(): Promise<void>;
    getStatus(): WidgetStatus;
    getResourceUsage(): ResourceUsage;
  };

  /** Widget metadata */
  metadata: {
    protocolVersion: string;
    element: string;
    displayName: string;
    description: string;
    serverName: string;
  };

  /** Widget layout */
  layout?: WidgetLayout;

  /** Container element */
  container: HTMLDivElement;

  /** Initialization timestamp */
  createdAt: Date;
}

/**
 * Widget Metrics
 */
export interface WidgetMetrics {
  /** Widget ID */
  widgetId: string;

  /** Widget display name */
  displayName: string;

  /** Widget status */
  status: WidgetStatus;

  /** Resource usage */
  resourceUsage: ResourceUsage;

  /** Last update timestamp */
  lastUpdate?: Date;

  /** Widget uptime in milliseconds */
  uptime: number;
}

/**
 * Dashboard Metrics
 */
export interface DashboardMetrics {
  /** Per-widget metrics */
  widgets: WidgetMetrics[];

  /** Overall dashboard metrics */
  dashboard: {
    /** Total memory usage (bytes) */
    totalMemory: number;

    /** Total DOM nodes */
    totalDomNodes: number;

    /** Number of widgets */
    widgetCount: number;

    /** Dashboard uptime (ms) */
    uptime: number;

    /** Average render time (ms) */
    averageRenderTime: number;
  };
}

/**
 * Dashboard Event Data
 */
export interface DashboardInitializedEvent {
  timestamp: Date;
  widgetCount: number;
  theme: ThemeConfiguration;
  layout: LayoutConfiguration;
}

export interface WidgetAddedEvent {
  widgetId: string;
  displayName: string;
  serverName: string;
  timestamp: Date;
}

export interface WidgetRemovedEvent {
  widgetId: string;
  displayName: string;
  timestamp: Date;
}

export interface LayoutChangedEvent {
  layout: LayoutConfiguration;
  timestamp: Date;
}

export interface ThemeChangedEvent {
  theme: ThemeConfiguration;
  timestamp: Date;
}

export interface DashboardErrorEvent {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  timestamp: Date;
}
