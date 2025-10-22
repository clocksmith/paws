/**
 * Playwright Widget Component
 *
 * Web Component for Playwright MCP server interaction.
 */

import type { types } from '@mwp/core';

type EventBus = types.EventBus;
type MCPBridge = types.MCPBridge;
type Configuration = types.Configuration;
type MCPServerInfo = types.MCPServerInfo;
type WidgetStatus = types.WidgetStatus;
type ResourceUsage = types.ResourceUsage;
type UnsubscribeFunction = types.UnsubscribeFunction;
import { styles } from './styles.js';
import type {
  PlaywrightWidgetConfig,
  BrowserSession,
  Screenshot,
  ConsoleMessage,
  Workflow,
  WorkflowAction,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  session: BrowserSession | null;
  screenshots: Screenshot[];
  console: ConsoleMessage[];
  workflows: Workflow[];
  currentWorkflow: Workflow | null;
  view: 'browser' | 'screenshots' | 'console' | 'workflows';
  loading: boolean;
  error: string | null;
}

/**
 * Playwright Widget
 *
 * Custom element for Playwright browser automation.
 */
export class PlaywrightWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: PlaywrightWidgetConfig;

  private state: WidgetState = {
    session: null,
    screenshots: [],
    console: [],
    workflows: [],
    currentWorkflow: null,
    view: 'browser',
    loading: false,
    error: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private initTimestamp?: Date;
  private renderStartTime?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {};
  }

  /**
   * Set dependencies (called by factory)
   */
  setDependencies(
    eventBus: EventBus,
    mcpBridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
    this.config = config;
  }

  /**
   * Set server info (called by factory)
   */
  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  /**
   * Initialize widget
   */
  async initialize(): Promise<void> {
    this.initTimestamp = new Date();

    // Load widget config from Configuration
    const savedConfig = this.config.get('playwrightWidget');
    if (savedConfig) {
      this.widgetConfig = savedConfig as PlaywrightWidgetConfig;
    }

    // Emit initialized event
    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'playwright-widget',
      element: 'playwright-mcp-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    this.render();

    // Initialize session
    await this.initializeSession();
  }

  /**
   * Destroy widget
   */
  async destroy(): Promise<void> {
    // Unsubscribe from all events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // Emit destroyed event
    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'playwright-widget',
      element: 'playwright-mcp-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    // Clear shadow root
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  /**
   * Refresh widget data
   */
  async refresh(): Promise<void> {
    const startTime = Date.now();

    try {
      // Refresh current view
      if (this.state.view === 'screenshots') {
        // Screenshots are already loaded
      } else if (this.state.view === 'console') {
        // Console messages are already loaded
      } else if (this.state.view === 'browser' && this.state.session) {
        // Reload current page
        await this.navigate(this.state.session.currentUrl);
      }

      const duration = Date.now() - startTime;

      this.eventBus.emit('widget:refreshed', {
        widgetId: this.id || 'playwright-widget',
        timestamp: new Date(),
        duration,
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Get widget status
   */
  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return {
        status: 'initializing',
        message: 'Loading...',
      };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: {
          code: 'WIDGET_ERROR',
          message: this.state.error,
        },
      };
    }

    return {
      status: 'healthy',
      message: this.state.session
        ? `Browser: ${this.state.session.browser}`
        : 'Ready',
      lastUpdate: new Date(),
    };
  }

  /**
   * Get resource usage
   */
  getResourceUsage(): ResourceUsage {
    const memory = this.estimateMemoryUsage();
    const domNodes = this.shadowRoot?.querySelectorAll('*').length || 0;

    return {
      memory,
      renderTime: this.renderStartTime ? Date.now() - this.renderStartTime : 0,
      domNodes,
    };
  }

  /**
   * Connected callback
   */
  connectedCallback(): void {
    // Widget will be initialized via factory API
  }

  /**
   * Disconnected callback
   */
  disconnectedCallback(): void {
    // Widget will be destroyed via factory API
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen for tool results
    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:invoked', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleToolResult(data);
        }
      })
    );

    // Listen for tool errors
    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:error', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleError(data.error);
        }
      })
    );
  }

  /**
   * Initialize browser session
   */
  private async initializeSession(): Promise<void> {
    this.setState({
      session: {
        id: this.generateId(),
        browser: this.widgetConfig.browser || 'chromium',
        currentUrl: '',
        status: 'idle',
        startedAt: new Date(),
      },
    });
  }

  /**
   * Navigate to URL
   */
  private async navigate(url: string): Promise<void> {
    if (!this.state.session) return;

    this.setState({
      loading: true,
      error: null,
      session: { ...this.state.session, status: 'navigating' },
    });

    this.eventBus.emit('playwright:navigate:start', {
      url,
      timestamp: new Date(),
    });

    try {
      const startTime = Date.now();

      await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'playwright_navigate',
        { url }
      );

      const duration = Date.now() - startTime;

      this.setState({
        loading: false,
        session: {
          ...this.state.session!,
          currentUrl: url,
          status: 'loaded',
        },
      });

      this.eventBus.emit('playwright:navigate:complete', {
        url,
        duration,
        timestamp: new Date(),
      });

      this.addConsoleMessage('log', `Navigated to ${url}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Take screenshot
   */
  private async takeScreenshot(name?: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const screenshotName = name || `screenshot-${Date.now()}`;

      await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'playwright_screenshot',
        {
          name: screenshotName,
          width: this.widgetConfig.viewport?.width,
          height: this.widgetConfig.viewport?.height,
        }
      );

      // Parse screenshot data from result
      const screenshot: Screenshot = {
        id: this.generateId(),
        name: screenshotName,
        url: this.state.session?.currentUrl || '',
        dataUrl: '', // TODO: Extract from result
        width: this.widgetConfig.viewport?.width || 1280,
        height: this.widgetConfig.viewport?.height || 720,
        size: 0, // TODO: Calculate from result
        timestamp: new Date(),
      };

      this.setState({
        loading: false,
        screenshots: [...this.state.screenshots, screenshot],
      });

      this.eventBus.emit('playwright:screenshot:captured', {
        name: screenshotName,
        size: screenshot.size,
        timestamp: new Date(),
      });

      this.addConsoleMessage('log', `Screenshot captured: ${screenshotName}`);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Click element
   */
  private async clickElement(selector: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'playwright_click',
        { selector }
      );

      this.setState({ loading: false });

      this.addConsoleMessage('log', `Clicked: ${selector}`);

      this.eventBus.emit('playwright:action:complete', {
        action: 'click',
        selector,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Fill input
   */
  private async fillInput(selector: string, value: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'playwright_fill',
        { selector, value }
      );

      this.setState({ loading: false });

      this.addConsoleMessage('log', `Filled: ${selector} = "${value}"`);

      this.eventBus.emit('playwright:action:complete', {
        action: 'fill',
        selector,
        value,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Run workflow
   * @internal - Used by workflow UI (coming soon)
   */
  private async _runWorkflow(workflow: Workflow): Promise<void> {
    this.setState({
      loading: true,
      error: null,
      currentWorkflow: workflow,
    });

    try {
      for (const action of workflow.actions) {
        // Execute action
        await this.executeWorkflowAction(action);

        // Delay if specified
        if (action.delay) {
          await new Promise(resolve => setTimeout(resolve, action.delay));
        }
      }

      this.setState({
        loading: false,
        currentWorkflow: null,
      });

      this.addConsoleMessage('log', `Workflow completed: ${workflow.name}`);
    } catch (error) {
      this.handleError(error);
      this.setState({ currentWorkflow: null });
    }
  }

  /**
   * Execute workflow action
   */
  private async executeWorkflowAction(action: WorkflowAction): Promise<void> {
    switch (action.type) {
      case 'navigate':
        await this.navigate(action.params.url as string);
        break;
      case 'click':
        await this.clickElement(action.params.selector as string);
        break;
      case 'fill':
        await this.fillInput(
          action.params.selector as string,
          action.params.value as string
        );
        break;
      case 'screenshot':
        await this.takeScreenshot(action.params.name as string);
        break;
      case 'evaluate':
        await this.mcpBridge.callTool(
          this.serverInfo.serverName,
          'playwright_evaluate',
          { script: action.params.script as string }
        );
        break;
    }
  }

  /**
   * Add console message
   */
  private addConsoleMessage(
    level: ConsoleMessage['level'],
    message: string
  ): void {
    const maxMessages = this.widgetConfig.console?.maxMessages || 100;

    const consoleMessage: ConsoleMessage = {
      id: this.generateId(),
      level,
      message,
      timestamp: new Date(),
      url: this.state.session?.currentUrl,
    };

    const updatedConsole = [...this.state.console, consoleMessage].slice(
      -maxMessages
    );

    this.setState({ console: updatedConsole });

    this.eventBus.emit('playwright:console', {
      level,
      message,
      timestamp: new Date(),
    });
  }

  /**
   * Render widget
   */
  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="playwright-widget">
        <header class="widget-header">
          <h2>Playwright</h2>
          <nav class="view-tabs">
            <button class="tab-button ${this.state.view === 'browser' ? 'active' : ''}" data-view="browser">Browser</button>
            <button class="tab-button ${this.state.view === 'screenshots' ? 'active' : ''}" data-view="screenshots">Screenshots</button>
            <button class="tab-button ${this.state.view === 'console' ? 'active' : ''}" data-view="console">Console</button>
            <button class="tab-button ${this.state.view === 'workflows' ? 'active' : ''}" data-view="workflows">Workflows</button>
          </nav>
        </header>

        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  /**
   * Render content based on view
   */
  private renderContent(): string {
    if (this.state.loading) {
      return '<div class="loading">Loading...</div>';
    }

    if (this.state.error) {
      return `<div class="error">Error: ${this.state.error}</div>`;
    }

    switch (this.state.view) {
      case 'browser':
        return this.renderBrowserView();
      case 'screenshots':
        return this.renderScreenshotsView();
      case 'console':
        return this.renderConsoleView();
      case 'workflows':
        return this.renderWorkflowsView();
      default:
        return '<div>Unknown view</div>';
    }
  }

  /**
   * Render browser view
   */
  private renderBrowserView(): string {
    return `
      <div class="browser-view">
        <div class="navigation-bar">
          <button class="nav-button" id="back-btn" title="Back">←</button>
          <button class="nav-button" id="forward-btn" title="Forward">→</button>
          <button class="nav-button" id="reload-btn" title="Reload">⟳</button>
          <input
            type="text"
            class="url-input"
            id="url-input"
            placeholder="Enter URL..."
            value="${this.state.session?.currentUrl || ''}"
          />
          <button class="nav-button primary" id="go-btn">Go</button>
        </div>

        <div class="browser-info">
          <div class="info-item">
            <span class="label">Browser:</span>
            <span class="value">${this.state.session?.browser || 'chromium'}</span>
          </div>
          <div class="info-item">
            <span class="label">Status:</span>
            <span class="value status-${this.state.session?.status || 'idle'}">${this.state.session?.status || 'idle'}</span>
          </div>
        </div>

        <div class="action-buttons">
          <button class="action-button" id="screenshot-btn">📸 Screenshot</button>
          <button class="action-button" id="click-btn">🖱️ Click</button>
          <button class="action-button" id="fill-btn">⌨️ Fill</button>
        </div>
      </div>
    `;
  }

  /**
   * Render screenshots view
   */
  private renderScreenshotsView(): string {
    if (this.state.screenshots.length === 0) {
      return '<div class="empty">No screenshots captured yet</div>';
    }

    return `
      <div class="screenshots-view">
        <div class="screenshots-grid">
          ${this.state.screenshots
            .map(
              screenshot => `
            <div class="screenshot-card" data-id="${screenshot.id}">
              <div class="screenshot-preview">
                <img src="${screenshot.dataUrl}" alt="${screenshot.name}" />
              </div>
              <div class="screenshot-info">
                <div class="screenshot-name">${screenshot.name}</div>
                <div class="screenshot-meta">
                  ${screenshot.width}×${screenshot.height} • ${this.formatBytes(screenshot.size)}
                </div>
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render console view
   */
  private renderConsoleView(): string {
    if (this.state.console.length === 0) {
      return '<div class="empty">No console messages</div>';
    }

    return `
      <div class="console-view">
        <div class="console-messages">
          ${this.state.console
            .map(
              msg => `
            <div class="console-message console-${msg.level}">
              ${this.widgetConfig.console?.showTimestamps ? `<span class="console-time">${this.formatTime(msg.timestamp)}</span>` : ''}
              <span class="console-level">[${msg.level}]</span>
              <span class="console-text">${msg.message}</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render workflows view
   */
  private renderWorkflowsView(): string {
    return `
      <div class="workflows-view">
        <button class="create-button" id="create-workflow-btn">+ Create Workflow</button>
        <div class="workflows-list">
          ${this.state.workflows.length === 0 ? '<div class="empty">No workflows created</div>' : ''}
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers
   */
  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;

    // View tabs
    this.shadowRoot.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', () => {
        const view = (button as HTMLElement).dataset.view as WidgetState['view'];
        this.setState({ view });
      });
    });

    // Navigation
    const urlInput = this.shadowRoot.getElementById('url-input') as HTMLInputElement;
    const goBtn = this.shadowRoot.getElementById('go-btn');
    const reloadBtn = this.shadowRoot.getElementById('reload-btn');

    goBtn?.addEventListener('click', () => {
      if (urlInput?.value) {
        this.navigate(urlInput.value);
      }
    });

    urlInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && urlInput.value) {
        this.navigate(urlInput.value);
      }
    });

    reloadBtn?.addEventListener('click', () => {
      if (this.state.session?.currentUrl) {
        this.navigate(this.state.session.currentUrl);
      }
    });

    // Actions
    const screenshotBtn = this.shadowRoot.getElementById('screenshot-btn');
    screenshotBtn?.addEventListener('click', () => this.takeScreenshot());
  }

  /**
   * Update state and re-render
   */
  private setState(updates: Partial<WidgetState>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  /**
   * Handle tool result
   */
  private handleToolResult(data: any): void {
    console.log('Tool result:', data);
  }

  /**
   * Handle error
   */
  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.setState({ error: message, loading: false });

    this.eventBus.emit('widget:error', {
      widgetId: this.id || 'playwright-widget',
      element: 'playwright-mcp-widget',
      serverName: this.serverInfo.serverName,
      error: {
        code: 'WIDGET_ERROR',
        message,
      },
      timestamp: new Date(),
    });

    this.addConsoleMessage('error', message);
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    const stateSize = JSON.stringify(this.state).length * 2;
    const domSize = (this.shadowRoot?.innerHTML.length || 0) * 2;
    const screenshotsSize = this.state.screenshots.reduce(
      (sum, s) => sum + s.size,
      0
    );
    return stateSize + domSize + screenshotsSize;
  }

  /**
   * Generate unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Format time
   */
  private formatTime(date: Date): string {
    return date.toLocaleTimeString();
  }
}
