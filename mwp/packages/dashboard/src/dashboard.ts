/**
 * Dashboard Implementation
 *
 * Widget host for loading and displaying MCP widgets.
 */

import type {
  EventBus as IEventBus,
  MCPBridge as IMCPBridge,
  Configuration as IConfiguration,
  ThemeConfiguration,
  MCPServerInfo,
} from '@mcp-wp/core';
import { EventBus } from '@mcp-wp/eventbus';
import { MCPBridge } from '@mcp-wp/bridge';
import type {
  DashboardOptions,
  AddWidgetOptions,
  LayoutConfiguration,
  WidgetInstance,
  DashboardMetrics,
  WidgetMetrics,
} from './types.js';
import { defaultTheme } from './themes.js';

/**
 * Dashboard Class
 *
 * Manages widget lifecycle, layout, and theming.
 */
export class Dashboard {
  private container: HTMLElement;
  private eventBus: IEventBus;
  private mcpBridge: IMCPBridge;
  private configuration: IConfiguration;

  private widgets = new Map<string, WidgetInstance>();
  private dashboardElement!: HTMLDivElement;
  private styleElement!: HTMLStyleElement;

  private _theme: ThemeConfiguration;
  private _layout: LayoutConfiguration;
  private _settings: Required<DashboardOptions['settings']>;

  private initialized = false;
  private initTimestamp?: Date;
  private autoRefreshInterval?: number;

  constructor(options: DashboardOptions) {
    this.container = options.container;
    this._theme = options.theme || defaultTheme;
    this._layout = options.layout || { type: 'grid', columns: 3, gap: 16 };
    this._settings = {
      autoRefresh: options.settings?.autoRefresh ?? 0,
      monitoring: options.settings?.monitoring ?? false,
      devtools: options.settings?.devtools ?? false,
      maxWidgets: options.settings?.maxWidgets ?? 20,
      animations: options.settings?.animations ?? true,
      spacing: options.settings?.spacing ?? 16,
    };

    // Create shared dependencies
    this.eventBus = new EventBus();
    this.mcpBridge = new MCPBridge(this.eventBus);
    this.configuration = this.createConfiguration();
  }

  /**
   * Initialize dashboard
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new Error('Dashboard already initialized');
    }

    this.initTimestamp = new Date();

    // Create dashboard container
    this.createDashboardElement();

    // Apply initial theme and layout
    this.applyTheme();
    this.applyLayout();

    // Setup auto-refresh
    if (this._settings.autoRefresh > 0) {
      this.setupAutoRefresh();
    }

    // Emit initialized event
    this.eventBus.emit('dashboard:initialized', {
      timestamp: this.initTimestamp,
      widgetCount: 0,
      theme: this._theme,
      layout: this._layout,
    });

    this.initialized = true;
  }

  /**
   * Add widget to dashboard
   */
  async addWidget(options: AddWidgetOptions): Promise<string> {
    if (!this.initialized) {
      throw new Error('Dashboard not initialized');
    }

    if (this.widgets.size >= this._settings.maxWidgets) {
      throw new Error(
        `Maximum widget limit reached (${this._settings.maxWidgets})`
      );
    }

    const widgetId = options.widgetId || this.generateWidgetId();

    try {
      // Connect to MCP server
      await this.mcpBridge.connect(options.serverName, options.config);

      // Get server info
      const serverInfo = this.mcpBridge.getServerInfo(options.serverName);
      if (!serverInfo) {
        throw new Error(`Server ${options.serverName} not found`);
      }

      // Create widget factory
      const factory = await options.factory(
        {
          EventBus: this.eventBus,
          MCPBridge: this.mcpBridge,
          Configuration: this.configuration,
        },
        serverInfo
      );

      // Create widget container
      const widgetContainer = this.createWidgetContainer(
        widgetId,
        options.layout
      );

      // Create widget element
      const widgetElement = document.createElement(factory.widget.element);
      widgetContainer.appendChild(widgetElement);

      // Store widget instance
      const widgetInstance: WidgetInstance = {
        widgetId,
        element: widgetElement as HTMLElement,
        api: factory.api,
        metadata: {
          protocolVersion: factory.widget.protocolVersion,
          element: factory.widget.element,
          displayName: factory.widget.displayName,
          description: factory.widget.description,
          serverName: options.serverName,
        },
        layout: options.layout,
        container: widgetContainer,
        createdAt: new Date(),
      };

      this.widgets.set(widgetId, widgetInstance);

      // Initialize widget
      await factory.api.initialize();

      // Emit event
      this.eventBus.emit('dashboard:widget:added', {
        widgetId,
        displayName: factory.widget.displayName,
        serverName: options.serverName,
        timestamp: new Date(),
      });

      return widgetId;
    } catch (error) {
      this.handleError('ADD_WIDGET_ERROR', error);
      throw error;
    }
  }

  /**
   * Remove widget from dashboard
   */
  async removeWidget(widgetId: string): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    try {
      // Destroy widget
      await widget.api.destroy();

      // Remove container from DOM
      widget.container.remove();

      // Remove from widgets map
      this.widgets.delete(widgetId);

      // Emit event
      this.eventBus.emit('dashboard:widget:removed', {
        widgetId,
        displayName: widget.metadata.displayName,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError('REMOVE_WIDGET_ERROR', error);
      throw error;
    }
  }

  /**
   * Refresh specific widget
   */
  async refreshWidget(widgetId: string): Promise<void> {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    try {
      await widget.api.refresh();
    } catch (error) {
      this.handleError('REFRESH_WIDGET_ERROR', error);
      throw error;
    }
  }

  /**
   * Refresh all widgets
   */
  async refreshAll(): Promise<void> {
    const promises = Array.from(this.widgets.values()).map(widget =>
      widget.api.refresh().catch(error => {
        console.error(`Failed to refresh widget ${widget.widgetId}:`, error);
      })
    );

    await Promise.all(promises);
  }

  /**
   * Get widget status
   */
  getWidgetStatus(widgetId: string) {
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      throw new Error(`Widget ${widgetId} not found`);
    }

    return widget.api.getStatus();
  }

  /**
   * Get dashboard metrics
   */
  getMetrics(): DashboardMetrics {
    const widgetMetrics: WidgetMetrics[] = [];
    let totalMemory = 0;
    let totalDomNodes = 0;
    let totalRenderTime = 0;

    for (const widget of this.widgets.values()) {
      const status = widget.api.getStatus();
      const resourceUsage = widget.api.getResourceUsage();

      widgetMetrics.push({
        widgetId: widget.widgetId,
        displayName: widget.metadata.displayName,
        status,
        resourceUsage,
        lastUpdate: status.lastUpdate,
        uptime: Date.now() - widget.createdAt.getTime(),
      });

      totalMemory += resourceUsage.memory || 0;
      totalDomNodes += resourceUsage.domNodes || 0;
      totalRenderTime += resourceUsage.renderTime || 0;
    }

    return {
      widgets: widgetMetrics,
      dashboard: {
        totalMemory,
        totalDomNodes,
        widgetCount: this.widgets.size,
        uptime: this.initTimestamp
          ? Date.now() - this.initTimestamp.getTime()
          : 0,
        averageRenderTime:
          this.widgets.size > 0 ? totalRenderTime / this.widgets.size : 0,
      },
    };
  }

  /**
   * Set theme
   */
  setTheme(theme: Partial<ThemeConfiguration>): void {
    this._theme = { ...this._theme, ...theme };
    this.applyTheme();

    this.eventBus.emit('dashboard:theme:changed', {
      theme: this._theme,
      timestamp: new Date(),
    });
  }

  /**
   * Set layout
   */
  setLayout(layout: LayoutConfiguration): void {
    this._layout = layout;
    this.applyLayout();

    this.eventBus.emit('dashboard:layout:changed', {
      layout: this._layout,
      timestamp: new Date(),
    });
  }

  /**
   * Get current theme
   */
  get theme(): ThemeConfiguration {
    return this._theme;
  }

  /**
   * Get current layout
   */
  get layout(): LayoutConfiguration {
    return this._layout;
  }

  /**
   * Get event bus
   */
  get events(): IEventBus {
    return this.eventBus;
  }

  /**
   * Destroy dashboard
   */
  async destroy(): Promise<void> {
    // Stop auto-refresh
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    // Destroy all widgets
    const destroyPromises = Array.from(this.widgets.keys()).map(widgetId =>
      this.removeWidget(widgetId).catch(error => {
        console.error(`Failed to destroy widget ${widgetId}:`, error);
      })
    );

    await Promise.all(destroyPromises);

    // Disconnect all MCP servers
    await this.mcpBridge.disconnectAll();

    // Remove dashboard element
    if (this.dashboardElement) {
      this.dashboardElement.remove();
    }

    if (this.styleElement) {
      this.styleElement.remove();
    }

    this.initialized = false;
  }

  /**
   * Create dashboard element
   */
  private createDashboardElement(): void {
    this.dashboardElement = document.createElement('div');
    this.dashboardElement.className = 'mcp-dashboard';
    this.dashboardElement.setAttribute('role', 'main');
    this.dashboardElement.setAttribute('aria-label', 'MCP Widget Dashboard');

    this.container.appendChild(this.dashboardElement);
  }

  /**
   * Create widget container
   */
  private createWidgetContainer(
    widgetId: string,
    layout?: AddWidgetOptions['layout']
  ): HTMLDivElement {
    const container = document.createElement('div');
    container.className = 'widget-slot';
    container.setAttribute('data-widget-id', widgetId);

    if (layout) {
      this.applyWidgetLayout(container, layout);
    }

    this.dashboardElement.appendChild(container);

    return container;
  }

  /**
   * Apply theme to dashboard
   */
  private applyTheme(): void {
    if (!this.styleElement) {
      this.styleElement = document.createElement('style');
      this.styleElement.id = 'mcp-dashboard-theme';
      document.head.appendChild(this.styleElement);
    }

    const theme = this._theme;

    this.styleElement.textContent = `
      .mcp-dashboard {
        --theme-mode: ${theme.mode};
        --theme-primary: ${theme.primary};
        --theme-secondary: ${theme.secondary || theme.primary};
        --theme-surface: ${theme.surface};
        --theme-background: ${theme.background || theme.surface};
        --theme-text: ${theme.text};
        --theme-border: ${theme.border || theme.text};
        --theme-error: ${theme.error || '#ef4444'};
        --theme-warning: ${theme.warning || '#f59e0b'};
        --theme-success: ${theme.success || '#10b981'};
        --theme-info: ${theme.info || theme.primary};
        --theme-font-family: ${theme.fontFamily || 'system-ui, sans-serif'};
        --theme-font-size: ${theme.fontSize || 14}px;
        --theme-border-radius: ${theme.borderRadius || 6}px;
        --theme-spacing-xs: ${theme.spacing?.xs || 4}px;
        --theme-spacing-sm: ${theme.spacing?.sm || 8}px;
        --theme-spacing-md: ${theme.spacing?.md || 16}px;
        --theme-spacing-lg: ${theme.spacing?.lg || 24}px;
        --theme-spacing-xl: ${theme.spacing?.xl || 32}px;
        --theme-shadow: ${theme.shadow || '0 1px 3px rgba(0, 0, 0, 0.1)'};

        background: var(--theme-background);
        color: var(--theme-text);
        font-family: var(--theme-font-family);
        font-size: var(--theme-font-size);
      }
    `;
  }

  /**
   * Apply layout to dashboard
   */
  private applyLayout(): void {
    if (!this.dashboardElement) return;

    const layout = this._layout;

    // Reset styles
    this.dashboardElement.style.cssText = '';

    if (layout.type === 'grid') {
      this.dashboardElement.style.display = 'grid';
      this.dashboardElement.style.gridTemplateColumns =
        layout.columnTemplate || `repeat(${layout.columns || 3}, 1fr)`;
      this.dashboardElement.style.gridTemplateRows =
        layout.rowTemplate ||
        (layout.rows === 'auto' || !layout.rows ? 'auto' : `repeat(${layout.rows}, 1fr)`);
      this.dashboardElement.style.gap = `${layout.gap || 16}px`;
    } else if (layout.type === 'flex') {
      this.dashboardElement.style.display = 'flex';
      this.dashboardElement.style.flexDirection = layout.direction || 'row';
      this.dashboardElement.style.flexWrap = layout.wrap ? 'wrap' : 'nowrap';
      this.dashboardElement.style.alignItems = layout.alignItems || 'stretch';
      this.dashboardElement.style.justifyContent =
        layout.justifyContent || 'flex-start';
      this.dashboardElement.style.gap = `${layout.gap || 16}px`;
    } else if (layout.type === 'custom' && layout.customStyles) {
      const styleEl = document.createElement('style');
      styleEl.textContent = layout.customStyles;
      document.head.appendChild(styleEl);
    }
  }

  /**
   * Apply layout to widget container
   */
  private applyWidgetLayout(
    container: HTMLDivElement,
    layout: AddWidgetOptions['layout']
  ): void {
    if (!layout) return;

    // Grid layout
    if (layout.column !== undefined) {
      container.style.gridColumn = `${layout.column} / span ${layout.width || 1}`;
    }
    if (layout.row !== undefined) {
      container.style.gridRow = `${layout.row} / span ${layout.height || 1}`;
    }

    // Flex layout
    if (layout.flex) {
      container.style.flex = layout.flex;
    }
    if (layout.order !== undefined) {
      container.style.order = String(layout.order);
    }
    if (layout.minWidth) {
      container.style.minWidth = `${layout.minWidth}px`;
    }
    if (layout.maxWidth) {
      container.style.maxWidth = `${layout.maxWidth}px`;
    }
    if (layout.minHeight) {
      container.style.minHeight = `${layout.minHeight}px`;
    }
    if (layout.maxHeight) {
      container.style.maxHeight = `${layout.maxHeight}px`;
    }

    // Custom styles
    if (layout.customStyles) {
      container.style.cssText += layout.customStyles;
    }
  }

  /**
   * Setup auto-refresh
   */
  private setupAutoRefresh(): void {
    this.autoRefreshInterval = window.setInterval(() => {
      this.refreshAll().catch(error => {
        console.error('Auto-refresh failed:', error);
      });
    }, this._settings.autoRefresh);
  }

  /**
   * Generate widget ID
   */
  private generateWidgetId(): string {
    return `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create configuration object
   */
  private createConfiguration(): IConfiguration {
    const self = this;

    return {
      get theme() {
        return self._theme;
      },
      get settings() {
        return self._settings;
      },
      get(key: string) {
        return (self._settings as any)[key];
      },
    };
  }

  /**
   * Handle error
   */
  private handleError(code: string, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';

    this.eventBus.emit('dashboard:error', {
      error: {
        code,
        message,
        details: error,
      },
      timestamp: new Date(),
    });
  }
}
