/**
 * Brave Search Widget Component
 *
 * Web Component for Brave Search MCP server interaction.
 */

import type {
  EventBus,
  MCPBridge,
  Configuration,
  MCPServerInfo,
  WidgetStatus,
  ResourceUsage,
  UnsubscribeFunction,
} from '@mcp-wp/core';
import { styles } from './styles.js';
import type {
  BraveWidgetConfig,
  SearchFilters,
  SearchResult,
  SearchResponse,
  SearchHistory,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  query: string;
  filters: SearchFilters;
  response: SearchResponse | null;
  history: SearchHistory[];
  loading: boolean;
  error: string | null;
}

/**
 * Brave Search Widget
 *
 * Custom element for Brave Search web search.
 */
export class BraveWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: BraveWidgetConfig;

  private state: WidgetState = {
    query: '',
    filters: {
      type: 'all',
      count: 10,
      offset: 0,
      safesearch: 'moderate',
    },
    response: null,
    history: [],
    loading: false,
    error: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private initTimestamp?: Date;
  private renderStartTime?: number;
  private searchDebounceTimeout?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {
      defaultCount: 10,
      defaultSafesearch: 'moderate',
      showSnippets: true,
      showThumbnails: true,
      showMetadata: true,
      maxHistoryItems: 50,
      saveHistory: true,
      compactMode: false,
      highlightKeywords: true,
      openLinksInNewTab: true,
      showRelatedSearches: true,
    };
  }

  /**
   * Set dependencies
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
   * Set server info
   */
  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  /**
   * Initialize widget
   */
  async initialize(): Promise<void> {
    this.initTimestamp = new Date();

    // Load widget config
    const savedConfig = this.config.get('braveWidget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    // Load search history from storage
    if (this.widgetConfig.saveHistory) {
      this.loadHistory();
    }

    // Set default filters
    this.state.filters = {
      type: 'all',
      count: this.widgetConfig.defaultCount || 10,
      offset: 0,
      safesearch: this.widgetConfig.defaultSafesearch || 'moderate',
    };

    // Emit initialized event
    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'brave-widget',
      element: 'brave-mcp-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    this.render();
  }

  /**
   * Destroy widget
   */
  async destroy(): Promise<void> {
    // Clear debounce timeout
    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    // Unsubscribe from events
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    // Save history
    if (this.widgetConfig.saveHistory) {
      this.saveHistory();
    }

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'brave-widget',
      element: 'brave-mcp-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  /**
   * Refresh widget
   */
  async refresh(): Promise<void> {
    if (this.state.query) {
      await this.search(this.state.query, this.state.filters);
    }
  }

  /**
   * Get widget status
   */
  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return {
        status: 'initializing',
        message: 'Searching...',
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
      message: this.state.response
        ? `${this.state.response.totalResults} results`
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
   * Get current results
   */
  getCurrentResults(): SearchResponse | null {
    return this.state.response;
  }

  /**
   * Get search history
   */
  getSearchHistory(): SearchHistory[] {
    return this.state.history;
  }

  /**
   * Connected callback
   */
  connectedCallback(): void {
    // Initialized via factory
  }

  /**
   * Disconnected callback
   */
  disconnectedCallback(): void {
    // Destroyed via factory
  }

  /**
   * Setup event listeners
   */
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

  /**
   * Perform search
   */
  private async search(query: string, filters: SearchFilters): Promise<void> {
    if (!query.trim()) return;

    this.setState({ loading: true, error: null, query });

    this.eventBus.emit('brave:search:started', {
      query,
      filters,
      timestamp: new Date(),
    });

    try {
      const startTime = Date.now();

      // Call Brave Search MCP tool
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'brave_web_search',
        {
          query,
          count: filters.count || 10,
          offset: filters.offset || 0,
          freshness: filters.freshness,
          safesearch: filters.safesearch || 'moderate',
        }
      );

      const duration = Date.now() - startTime;

      // Parse search results
      // TODO: Implement proper parsing based on MCP response format
      const response: SearchResponse = {
        query,
        results: [], // Parse from result
        totalResults: 0, // Parse from result
        page: Math.floor((filters.offset || 0) / (filters.count || 10)) + 1,
        totalPages: 1, // Calculate from totalResults
        relatedSearches: [], // Parse from result
        timestamp: new Date(),
      };

      this.setState({
        response,
        loading: false,
      });

      // Add to history
      if (this.widgetConfig.saveHistory) {
        this.addToHistory(query, filters, response.totalResults);
      }

      this.eventBus.emit('brave:search:complete', {
        query,
        resultCount: response.totalResults,
        duration,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Change page
   */
  private async changePage(page: number): Promise<void> {
    if (!this.state.response) return;

    const offset = (page - 1) * (this.state.filters.count || 10);
    const filters = { ...this.state.filters, offset };

    await this.search(this.state.query, filters);
  }

  /**
   * Update filter
   */
  private async updateFilter(
    key: keyof SearchFilters,
    value: any
  ): Promise<void> {
    const filters = { ...this.state.filters, [key]: value, offset: 0 };

    this.setState({ filters });

    this.eventBus.emit('brave:filter:changed', {
      filter: key,
      value,
      timestamp: new Date(),
    });

    if (this.state.query) {
      await this.search(this.state.query, filters);
    }
  }

  /**
   * Add to search history
   */
  private addToHistory(
    query: string,
    filters: SearchFilters,
    resultCount: number
  ): void {
    const historyEntry: SearchHistory = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      query,
      filters,
      resultCount,
      timestamp: new Date(),
    };

    const history = [
      historyEntry,
      ...this.state.history.filter(h => h.query !== query),
    ].slice(0, this.widgetConfig.maxHistoryItems || 50);

    this.setState({ history });
  }

  /**
   * Load history from storage
   */
  private loadHistory(): void {
    try {
      const stored = localStorage.getItem('brave-search-history');
      if (stored) {
        const history = JSON.parse(stored).map((h: any) => ({
          ...h,
          timestamp: new Date(h.timestamp),
        }));
        this.setState({ history });
      }
    } catch (error) {
      console.error('Failed to load search history:', error);
    }
  }

  /**
   * Save history to storage
   */
  private saveHistory(): void {
    try {
      localStorage.setItem(
        'brave-search-history',
        JSON.stringify(this.state.history)
      );
    } catch (error) {
      console.error('Failed to save search history:', error);
    }
  }

  /**
   * Highlight keywords in text
   */
  private highlightKeywords(text: string): string {
    if (!this.widgetConfig.highlightKeywords || !this.state.query) {
      return text;
    }

    const keywords = this.state.query.split(/\s+/);
    let highlighted = text;

    for (const keyword of keywords) {
      const regex = new RegExp(`(${keyword})`, 'gi');
      highlighted = highlighted.replace(
        regex,
        '<mark class="highlight">$1</mark>'
      );
    }

    return highlighted;
  }

  /**
   * Render widget
   */
  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="brave-widget">
        <header class="widget-header">
          <h2>🔍 Brave Search</h2>
        </header>

        ${this.renderSearchBar()}
        ${this.renderFilters()}
        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  /**
   * Render search bar
   */
  private renderSearchBar(): string {
    return `
      <div class="search-bar">
        <input
          type="text"
          class="search-input"
          id="search-input"
          placeholder="Search the web..."
          value="${this.state.query}"
        />
        <button class="search-button" id="search-btn">Search</button>
      </div>
    `;
  }

  /**
   * Render filters
   */
  private renderFilters(): string {
    return `
      <div class="filters">
        <div class="filter-group">
          <button class="filter-button ${this.state.filters.type === 'all' ? 'active' : ''}" data-filter="type" data-value="all">All</button>
          <button class="filter-button ${this.state.filters.type === 'images' ? 'active' : ''}" data-filter="type" data-value="images">Images</button>
          <button class="filter-button ${this.state.filters.type === 'news' ? 'active' : ''}" data-filter="type" data-value="news">News</button>
          <button class="filter-button ${this.state.filters.type === 'videos' ? 'active' : ''}" data-filter="type" data-value="videos">Videos</button>
        </div>

        <div class="filter-group">
          <select class="filter-select" id="freshness-filter">
            <option value="">Any time</option>
            <option value="day" ${this.state.filters.freshness === 'day' ? 'selected' : ''}>Past day</option>
            <option value="week" ${this.state.filters.freshness === 'week' ? 'selected' : ''}>Past week</option>
            <option value="month" ${this.state.filters.freshness === 'month' ? 'selected' : ''}>Past month</option>
            <option value="year" ${this.state.filters.freshness === 'year' ? 'selected' : ''}>Past year</option>
          </select>
        </div>
      </div>
    `;
  }

  /**
   * Render content
   */
  private renderContent(): string {
    if (this.state.loading) {
      return '<div class="loading">Searching...</div>';
    }

    if (this.state.error) {
      return `<div class="error">Error: ${this.state.error}</div>`;
    }

    if (!this.state.response) {
      return this.renderHistory();
    }

    return this.renderResults();
  }

  /**
   * Render search results
   */
  private renderResults(): string {
    if (!this.state.response) return '';

    if (this.state.response.results.length === 0) {
      return '<div class="empty">No results found</div>';
    }

    return `
      <div class="results">
        <div class="results-info">
          About ${this.state.response.totalResults.toLocaleString()} results
        </div>

        <div class="results-list">
          ${this.state.response.results
            .map(
              (result, idx) => `
            <div class="result-item" data-url="${result.url}">
              <div class="result-position">${result.position}.</div>
              <div class="result-content">
                <h3 class="result-title">${this.highlightKeywords(result.title)}</h3>
                <div class="result-url">${result.url}</div>
                ${this.widgetConfig.showSnippets ? `<p class="result-snippet">${this.highlightKeywords(result.snippet)}</p>` : ''}
              </div>
            </div>
          `
            )
            .join('')}
        </div>

        ${this.renderPagination()}
      </div>
    `;
  }

  /**
   * Render pagination
   */
  private renderPagination(): string {
    if (!this.state.response) return '';

    const { page, totalPages } = this.state.response;

    return `
      <div class="pagination">
        <button
          class="pagination-button"
          id="prev-page"
          ${page <= 1 ? 'disabled' : ''}
        >
          ← Previous
        </button>

        <span class="pagination-info">Page ${page} of ${totalPages}</span>

        <button
          class="pagination-button"
          id="next-page"
          ${page >= totalPages ? 'disabled' : ''}
        >
          Next →
        </button>
      </div>
    `;
  }

  /**
   * Render search history
   */
  private renderHistory(): string {
    if (this.state.history.length === 0) {
      return '<div class="empty">Search the web with Brave</div>';
    }

    return `
      <div class="history">
        <h3 class="history-title">Recent Searches</h3>
        <div class="history-list">
          ${this.state.history
            .slice(0, 10)
            .map(
              entry => `
            <div class="history-item" data-query="${entry.query}">
              <span class="history-query">${entry.query}</span>
              <span class="history-meta">${entry.resultCount} results</span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Attach event handlers
   */
  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;

    // Search
    const searchInput = this.shadowRoot.getElementById(
      'search-input'
    ) as HTMLInputElement;
    const searchBtn = this.shadowRoot.getElementById('search-btn');

    searchBtn?.addEventListener('click', () => {
      if (searchInput?.value) {
        this.search(searchInput.value, this.state.filters);
      }
    });

    searchInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter' && searchInput.value) {
        this.search(searchInput.value, this.state.filters);
      }
    });

    // Filters
    this.shadowRoot.querySelectorAll('.filter-button').forEach(button => {
      button.addEventListener('click', () => {
        const filter = (button as HTMLElement).dataset.filter as keyof SearchFilters;
        const value = (button as HTMLElement).dataset.value;
        this.updateFilter(filter, value);
      });
    });

    const freshnessFilter = this.shadowRoot.getElementById('freshness-filter');
    freshnessFilter?.addEventListener('change', e => {
      const value = (e.target as HTMLSelectElement).value;
      this.updateFilter('freshness', value || undefined);
    });

    // Results
    this.shadowRoot.querySelectorAll('.result-item').forEach(item => {
      item.addEventListener('click', () => {
        const url = (item as HTMLElement).dataset.url;
        if (url) {
          this.eventBus.emit('brave:result:clicked', {
            url,
            timestamp: new Date(),
          });

          if (this.widgetConfig.openLinksInNewTab) {
            window.open(url, '_blank');
          } else {
            window.location.href = url;
          }
        }
      });
    });

    // Pagination
    const prevBtn = this.shadowRoot.getElementById('prev-page');
    const nextBtn = this.shadowRoot.getElementById('next-page');

    prevBtn?.addEventListener('click', () => {
      if (this.state.response) {
        this.changePage(this.state.response.page - 1);
      }
    });

    nextBtn?.addEventListener('click', () => {
      if (this.state.response) {
        this.changePage(this.state.response.page + 1);
      }
    });

    // History
    this.shadowRoot.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        const query = (item as HTMLElement).dataset.query;
        if (query && searchInput) {
          searchInput.value = query;
          this.search(query, this.state.filters);
        }
      });
    });
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
      widgetId: this.id || 'brave-widget',
      element: 'brave-mcp-widget',
      serverName: this.serverInfo.serverName,
      error: {
        code: 'WIDGET_ERROR',
        message,
      },
      timestamp: new Date(),
    });
  }

  /**
   * Estimate memory usage
   */
  private estimateMemoryUsage(): number {
    const stateSize = JSON.stringify(this.state).length * 2;
    const domSize = (this.shadowRoot?.innerHTML.length || 0) * 2;
    return stateSize + domSize;
  }
}
