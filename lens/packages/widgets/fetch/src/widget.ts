/**
 * Fetch Widget Component
 *
 * Web Component for Fetch MCP server interaction.
 */

import type {
  EventBus,
  MCPBridge,
  Configuration,
  MCPServerInfo,
  WidgetStatus,
  ResourceUsage,
  UnsubscribeFunction,
} from '@mwp/core';
import { styles } from './styles.js';
import type {
  FetchWidgetConfig,
  FetchRequest,
  HTMLFetchRequest,
  FetchResult,
  FetchHistoryItem,
  ContentDisplayOptions,
  ExportOptions,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  currentResult: FetchResult | null;
  history: FetchHistoryItem[];
  view: 'fetch' | 'history';
  loading: boolean;
  error: string | null;
  urlInput: string;
  selectorInput: string;
  rawMode: boolean;
  htmlMode: boolean;
}

/**
 * Fetch Widget
 */
export class FetchWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: FetchWidgetConfig;

  private state: WidgetState = {
    currentResult: null,
    history: [],
    view: 'fetch',
    loading: false,
    error: null,
    urlInput: '',
    selectorInput: '',
    rawMode: false,
    htmlMode: false,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private initTimestamp?: Date;
  private renderStartTime?: number;
  private autoRefreshInterval?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {
      defaultRaw: false,
      defaultMaxLength: 50000,
      syntaxHighlight: true,
      wordWrap: true,
      showLineNumbers: true,
      maxHistoryItems: 50,
      saveHistory: true,
      autoRefresh: false,
      refreshInterval: 60000,
      exportFormat: 'html',
    };
  }

  setDependencies(
    eventBus: EventBus,
    mcpBridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
    this.config = config;
  }

  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  async initialize(): Promise<void> {
    this.initTimestamp = new Date();

    const savedConfig = this.config.get('fetchWidget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    // Load history from localStorage
    if (this.widgetConfig.saveHistory) {
      this.loadHistory();
    }

    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'fetch-widget',
      element: 'fetch-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    this.setupEventListeners();
    this.render();

    // Setup auto-refresh if enabled
    if (this.widgetConfig.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'fetch-widget',
      element: 'fetch-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    if (this.state.currentResult) {
      await this.fetchURL(this.state.currentResult.url);
    }
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return { status: 'initializing', message: 'Fetching...' };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: { code: 'WIDGET_ERROR', message: this.state.error },
      };
    }

    return {
      status: 'healthy',
      message: this.state.currentResult
        ? `${this.formatSize(this.state.currentResult.size)}`
        : 'Ready',
      lastUpdate: new Date(),
    };
  }

  getResourceUsage(): ResourceUsage {
    const memory = this.estimateMemoryUsage();
    const domNodes = this.shadowRoot?.querySelectorAll('*').length || 0;

    return {
      memory,
      renderTime: this.renderStartTime ? Date.now() - this.renderStartTime : 0,
      domNodes,
    };
  }

  // Public API methods
  async fetch(request: FetchRequest): Promise<FetchResult> {
    this.setState({ loading: true, error: null });

    this.eventBus.emit('fetch:started', {
      url: request.url,
      timestamp: new Date(),
    });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'fetch',
        {
          url: request.url,
          max_length: request.maxLength || this.widgetConfig.defaultMaxLength,
          start_index: request.startIndex || 0,
          raw: request.raw || false,
        }
      );

      const fetchResult = this.parseFetchResult(result, request.url, request.raw || false);

      this.setState({
        currentResult: fetchResult,
        loading: false,
      });

      this.addToHistory({
        request,
        result: fetchResult,
      });

      this.eventBus.emit('fetch:completed', {
        url: request.url,
        size: fetchResult.size,
        timestamp: new Date(),
      });

      return fetchResult;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async fetchHTML(request: HTMLFetchRequest): Promise<FetchResult> {
    this.setState({ loading: true, error: null });

    this.eventBus.emit('fetch:started', {
      url: request.url,
      selector: request.selector,
      timestamp: new Date(),
    });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'fetch_html',
        {
          url: request.url,
          selector: request.selector,
          max_length: request.maxLength || this.widgetConfig.defaultMaxLength,
        }
      );

      const fetchResult = this.parseFetchResult(result, request.url, false, request.selector);

      this.setState({
        currentResult: fetchResult,
        loading: false,
      });

      this.addToHistory({
        request,
        result: fetchResult,
      });

      this.eventBus.emit('fetch:extracted', {
        url: request.url,
        selector: request.selector,
        size: fetchResult.size,
        timestamp: new Date(),
      });

      return fetchResult;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  async fetchURL(url: string): Promise<void> {
    const request: FetchRequest | HTMLFetchRequest = this.state.htmlMode
      ? {
          url,
          selector: this.state.selectorInput || undefined,
        }
      : {
          url,
          raw: this.state.rawMode,
        };

    if (this.state.htmlMode) {
      await this.fetchHTML(request as HTMLFetchRequest);
    } else {
      await this.fetch(request as FetchRequest);
    }
  }

  getCurrentContent(): string {
    return this.state.currentResult?.content || '';
  }

  setAutoRefresh(enabled: boolean, interval?: number): void {
    this.widgetConfig.autoRefresh = enabled;
    if (interval) {
      this.widgetConfig.refreshInterval = interval;
    }

    if (enabled) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  exportContent(options?: ExportOptions): void {
    if (!this.state.currentResult) return;

    const format = options?.format || this.widgetConfig.exportFormat || 'html';
    const includeMetadata = options?.includeMetadata ?? true;

    let content = this.state.currentResult.content;
    let filename = options?.filename || this.generateFilename(format);

    if (includeMetadata && format !== 'html') {
      const metadata = this.formatMetadata(this.state.currentResult);
      content = `${metadata}\n\n${content}`;
    }

    this.downloadFile(content, filename);

    this.eventBus.emit('fetch:exported', {
      url: this.state.currentResult.url,
      format,
      timestamp: new Date(),
    });
  }

  connectedCallback(): void {}
  disconnectedCallback(): void {}

  private setupEventListeners(): void {
    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:invoked', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleToolResult(data);
        }
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('mcp:tool:error', (data: any) => {
        if (data.serverName === this.serverInfo.serverName) {
          this.handleError(data.error);
        }
      })
    );
  }

  private parseFetchResult(
    result: any,
    url: string,
    raw: boolean,
    selector?: string
  ): FetchResult {
    let content = '';
    let contentType = 'text/plain';

    if (result.content && Array.isArray(result.content)) {
      const firstContent = result.content[0];
      if (firstContent?.type === 'text') {
        content = firstContent.text;
      }
    }

    return {
      content,
      contentType,
      size: content.length,
      timestamp: new Date(),
      url,
      selector,
      raw,
    };
  }

  private addToHistory(item: Omit<FetchHistoryItem, 'id' | 'timestamp'>): void {
    if (!this.widgetConfig.saveHistory) return;

    const historyItem: FetchHistoryItem = {
      id: this.generateId(),
      ...item,
      timestamp: new Date(),
    };

    const maxItems = this.widgetConfig.maxHistoryItems || 50;
    const history = [historyItem, ...this.state.history].slice(0, maxItems);

    this.setState({ history });
    this.saveHistory();
  }

  private loadHistory(): void {
    try {
      const saved = localStorage.getItem('fetch-widget-history');
      if (saved) {
        const history = JSON.parse(saved);
        this.setState({ history });
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  }

  private saveHistory(): void {
    try {
      localStorage.setItem('fetch-widget-history', JSON.stringify(this.state.history));
    } catch (error) {
      console.error('Failed to save history:', error);
    }
  }

  private startAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
    }

    const interval = this.widgetConfig.refreshInterval || 60000;
    this.autoRefreshInterval = window.setInterval(() => {
      if (this.state.currentResult) {
        this.refresh();
      }
    }, interval);
  }

  private stopAutoRefresh(): void {
    if (this.autoRefreshInterval) {
      clearInterval(this.autoRefreshInterval);
      this.autoRefreshInterval = undefined;
    }
  }

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private formatMetadata(result: FetchResult): string {
    return [
      `URL: ${result.url}`,
      `Fetched: ${result.timestamp.toLocaleString()}`,
      `Size: ${this.formatSize(result.size)}`,
      result.selector ? `Selector: ${result.selector}` : '',
      `Raw: ${result.raw}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private generateFilename(format: string): string {
    const date = new Date().toISOString().split('T')[0];
    const url = this.state.currentResult?.url || 'content';
    const domain = url.replace(/https?:\/\//, '').replace(/[^a-z0-9]/gi, '-');
    return `fetch-${domain}-${date}.${format}`;
  }

  private downloadFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private getTimeSince(timestamp: Date): string {
    const seconds = Math.floor((Date.now() - timestamp.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="fetch-widget">
        <header class="widget-header">
          <h2>🌐 Fetch Content</h2>
          <div class="header-actions">
            <button class="icon-button ${this.state.view === 'fetch' ? 'active' : ''}" id="fetch-view-btn">
              Fetch
            </button>
            <button class="icon-button ${this.state.view === 'history' ? 'active' : ''}" id="history-view-btn">
              History
            </button>
          </div>
        </header>

        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  private renderContent(): string {
    if (this.state.view === 'history') {
      return this.renderHistory();
    }

    return this.renderFetchView();
  }

  private renderFetchView(): string {
    return `
      <div class="fetch-view">
        <div class="fetch-form">
          <div class="url-input-group">
            <input
              type="url"
              id="url-input"
              class="url-input"
              placeholder="Enter URL to fetch..."
              value="${this.state.urlInput}"
            />
            <button class="fetch-button" id="fetch-btn" ${this.state.loading ? 'disabled' : ''}>
              ${this.state.loading ? 'Fetching...' : 'Go'}
            </button>
          </div>

          <div class="fetch-options">
            <label class="checkbox-label">
              <input type="checkbox" id="raw-checkbox" ${this.state.rawMode ? 'checked' : ''} />
              Raw
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="html-checkbox" ${this.state.htmlMode ? 'checked' : ''} />
              HTML
            </label>
            ${
              this.state.htmlMode
                ? `
              <input
                type="text"
                id="selector-input"
                class="selector-input"
                placeholder="CSS selector (optional)"
                value="${this.state.selectorInput}"
              />
            `
                : ''
            }
          </div>
        </div>

        ${this.state.loading ? '<div class="loading">Fetching content...</div>' : ''}
        ${this.state.error ? `<div class="error">Error: ${this.state.error}</div>` : ''}
        ${this.state.currentResult ? this.renderResult() : '<div class="empty">Enter a URL to fetch content</div>'}
      </div>
    `;
  }

  private renderResult(): string {
    if (!this.state.currentResult) return '';

    const result = this.state.currentResult;
    const displayContent = this.formatContentForDisplay(result.content);

    return `
      <div class="result-view">
        <div class="result-header">
          <div class="result-meta">
            <span class="result-url">${result.url}</span>
            <span class="result-info">
              ${this.formatSize(result.size)} | ${this.getTimeSince(result.timestamp)}
            </span>
          </div>
          <div class="result-actions">
            <button class="icon-button" id="copy-btn">📋 Copy</button>
            <button class="icon-button" id="export-btn">💾 Export</button>
            <button class="icon-button" id="refresh-btn">🔄 Refresh</button>
          </div>
        </div>

        <div class="content-display ${this.widgetConfig.syntaxHighlight ? 'highlight' : ''} ${this.widgetConfig.wordWrap ? 'wrap' : ''}">
          <pre><code>${displayContent}</code></pre>
        </div>
      </div>
    `;
  }

  private renderHistory(): string {
    if (this.state.history.length === 0) {
      return '<div class="empty">No fetch history yet</div>';
    }

    return `
      <div class="history-view">
        <div class="history-header">
          <h3>Fetch History (${this.state.history.length})</h3>
          <button class="icon-button" id="clear-history-btn">Clear</button>
        </div>

        <div class="history-list">
          ${this.state.history
            .map(
              item => `
            <div class="history-item" data-item-id="${item.id}">
              <div class="history-item-header">
                <span class="history-url">📄 ${item.result.url}</span>
                <span class="history-time">${this.getTimeSince(item.timestamp)}</span>
              </div>
              <div class="history-item-meta">
                ${this.formatSize(item.result.size)}
                ${item.result.selector ? `| Selector: ${item.result.selector}` : ''}
              </div>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  private formatContentForDisplay(content: string): string {
    // Escape HTML for display
    const escaped = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    // Truncate if too long
    const maxChars = 100000;
    if (escaped.length > maxChars) {
      return escaped.substring(0, maxChars) + '\n\n... (content truncated)';
    }

    return escaped;
  }

  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;

    // View toggle
    const fetchViewBtn = this.shadowRoot.getElementById('fetch-view-btn');
    fetchViewBtn?.addEventListener('click', () => {
      this.setState({ view: 'fetch' });
    });

    const historyViewBtn = this.shadowRoot.getElementById('history-view-btn');
    historyViewBtn?.addEventListener('click', () => {
      this.setState({ view: 'history' });
    });

    // URL input
    const urlInput = this.shadowRoot.getElementById('url-input') as HTMLInputElement;
    urlInput?.addEventListener('input', e => {
      this.setState({ urlInput: (e.target as HTMLInputElement).value });
    });

    urlInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter' && !this.state.loading) {
        this.fetchURL(this.state.urlInput);
      }
    });

    // Fetch button
    const fetchBtn = this.shadowRoot.getElementById('fetch-btn');
    fetchBtn?.addEventListener('click', () => {
      if (this.state.urlInput && !this.state.loading) {
        this.fetchURL(this.state.urlInput);
      }
    });

    // Options
    const rawCheckbox = this.shadowRoot.getElementById('raw-checkbox') as HTMLInputElement;
    rawCheckbox?.addEventListener('change', e => {
      this.setState({ rawMode: (e.target as HTMLInputElement).checked });
    });

    const htmlCheckbox = this.shadowRoot.getElementById('html-checkbox') as HTMLInputElement;
    htmlCheckbox?.addEventListener('change', e => {
      this.setState({ htmlMode: (e.target as HTMLInputElement).checked });
    });

    const selectorInput = this.shadowRoot.getElementById('selector-input') as HTMLInputElement;
    selectorInput?.addEventListener('input', e => {
      this.setState({ selectorInput: (e.target as HTMLInputElement).value });
    });

    // Result actions
    const copyBtn = this.shadowRoot.getElementById('copy-btn');
    copyBtn?.addEventListener('click', () => {
      if (this.state.currentResult) {
        navigator.clipboard.writeText(this.state.currentResult.content);
      }
    });

    const exportBtn = this.shadowRoot.getElementById('export-btn');
    exportBtn?.addEventListener('click', () => {
      this.exportContent();
    });

    const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
    refreshBtn?.addEventListener('click', () => {
      this.refresh();
    });

    // History items
    this.shadowRoot.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const itemId = item.getAttribute('data-item-id');
        if (itemId) {
          const historyItem = this.state.history.find(h => h.id === itemId);
          if (historyItem) {
            this.setState({
              currentResult: historyItem.result,
              view: 'fetch',
              urlInput: historyItem.result.url,
            });
          }
        }
      });
    });

    // Clear history
    const clearHistoryBtn = this.shadowRoot.getElementById('clear-history-btn');
    clearHistoryBtn?.addEventListener('click', () => {
      if (confirm('Clear all fetch history?')) {
        this.setState({ history: [] });
        this.saveHistory();
      }
    });
  }

  private setState(updates: Partial<WidgetState>): void {
    this.state = { ...this.state, ...updates };
    this.render();
  }

  private handleToolResult(data: any): void {
    console.log('Tool result:', data);
  }

  private handleError(error: unknown): void {
    const message = error instanceof Error ? error.message : 'Unknown error';
    this.setState({ error: message, loading: false });

    this.eventBus.emit('widget:error', {
      widgetId: this.id || 'fetch-widget',
      element: 'fetch-widget',
      serverName: this.serverInfo.serverName,
      error: { code: 'WIDGET_ERROR', message },
      timestamp: new Date(),
    });
  }

  private estimateMemoryUsage(): number {
    const stateSize = JSON.stringify(this.state).length * 2;
    const domSize = (this.shadowRoot?.innerHTML.length || 0) * 2;
    return stateSize + domSize;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}
