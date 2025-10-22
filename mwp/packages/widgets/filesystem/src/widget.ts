/**
 * Filesystem Widget Component
 *
 * Web Component for Filesystem MCP server interaction.
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
  FilesystemWidgetConfig,
  Entry,
  FileEntry,
  DirectoryEntry,
  FileContent,
  SearchResult,
  Breadcrumb,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  currentPath: string;
  entries: Entry[];
  selectedEntry: Entry | null;
  openFile: FileContent | null;
  searchResults: SearchResult[];
  breadcrumbs: Breadcrumb[];
  view: 'browser' | 'editor' | 'search';
  loading: boolean;
  error: string | null;
}

/**
 * Filesystem Widget
 *
 * Custom element for filesystem browsing and management.
 */
export class FilesystemWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: FilesystemWidgetConfig;

  private state: WidgetState = {
    currentPath: '',
    entries: [],
    selectedEntry: null,
    openFile: null,
    searchResults: [],
    breadcrumbs: [],
    view: 'browser',
    loading: false,
    error: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private initTimestamp?: Date;
  private renderStartTime?: number;

  // Default file icons
  private readonly defaultFileIcons: Record<string, string> = {
    '.ts': '📘',
    '.tsx': '⚛️',
    '.js': '📙',
    '.jsx': '⚛️',
    '.json': '📋',
    '.md': '📝',
    '.html': '🌐',
    '.css': '🎨',
    '.scss': '🎨',
    '.py': '🐍',
    '.go': '🐹',
    '.rs': '🦀',
    '.java': '☕',
    '.cpp': '⚙️',
    '.c': '⚙️',
    '.sh': '🔧',
    '.yml': '⚙️',
    '.yaml': '⚙️',
    '.toml': '⚙️',
    '.xml': '📄',
    '.svg': '🖼️',
    '.png': '🖼️',
    '.jpg': '🖼️',
    '.gif': '🖼️',
    '.pdf': '📕',
    '.zip': '📦',
    '.tar': '📦',
    '.gz': '📦',
  };

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.widgetConfig = {
      showHidden: false,
      fileSizeFormat: 'human',
      confirmDelete: true,
      maxFileSize: 1024 * 1024, // 1MB
      editor: {
        tabSize: 2,
        insertSpaces: true,
        lineNumbers: true,
        syntaxHighlighting: true,
      },
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
    const savedConfig = this.config.get('filesystemWidget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    // Emit initialized event
    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'filesystem-widget',
      element: 'filesystem-mcp-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    // Setup event listeners
    this.setupEventListeners();

    // Initial render
    this.render();

    // Load initial directory
    await this.loadInitialDirectory();
  }

  /**
   * Destroy widget
   */
  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'filesystem-widget',
      element: 'filesystem-mcp-widget',
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
    const startTime = Date.now();

    try {
      if (this.state.view === 'browser') {
        await this.loadDirectory(this.state.currentPath);
      } else if (this.state.view === 'editor' && this.state.openFile) {
        await this.loadFile(this.state.openFile.path);
      }

      const duration = Date.now() - startTime;

      this.eventBus.emit('widget:refreshed', {
        widgetId: this.id || 'filesystem-widget',
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
      message: `Path: ${this.state.currentPath}`,
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
   * Load initial directory
   */
  private async loadInitialDirectory(): Promise<void> {
    try {
      // Get allowed directories
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'list_allowed_directories',
        {}
      );

      // TODO: Parse allowed directories from result
      const allowedDirs = []; // Parse from result

      const initialPath =
        this.widgetConfig.initialPath || allowedDirs[0] || '/';

      await this.loadDirectory(initialPath);
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Load directory contents
   */
  private async loadDirectory(path: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'list_directory',
        { path }
      );

      // Parse directory listing from result
      // TODO: Implement proper parsing based on MCP response format
      const entries: Entry[] = []; // Parse from result

      // Generate breadcrumbs
      const breadcrumbs = this.generateBreadcrumbs(path);

      this.setState({
        currentPath: path,
        entries,
        breadcrumbs,
        loading: false,
        view: 'browser',
      });

      this.eventBus.emit('filesystem:directory:changed', {
        path,
        entryCount: entries.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Load file content
   */
  private async loadFile(path: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'read_file',
        { path }
      );

      // Parse file content from result
      const fileContent: FileContent = {
        path,
        content: '', // TODO: Extract from result
        size: 0, // TODO: Extract from result
      };

      // Check file size
      if (
        this.widgetConfig.maxFileSize &&
        fileContent.size > this.widgetConfig.maxFileSize
      ) {
        throw new Error(
          `File too large (${this.formatBytes(fileContent.size)}). Max: ${this.formatBytes(this.widgetConfig.maxFileSize)}`
        );
      }

      this.setState({
        openFile: fileContent,
        loading: false,
        view: 'editor',
      });

      this.eventBus.emit('filesystem:file:opened', {
        path,
        size: fileContent.size,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Save file
   */
  private async saveFile(path: string, content: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'write_file', {
        path,
        content,
      });

      this.setState({
        loading: false,
        openFile: this.state.openFile
          ? { ...this.state.openFile, content }
          : null,
      });

      this.eventBus.emit('filesystem:file:saved', {
        path,
        size: content.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Delete file or directory
   */
  private async deleteEntry(path: string): Promise<void> {
    if (this.widgetConfig.confirmDelete) {
      if (!confirm(`Are you sure you want to delete ${path}?`)) {
        return;
      }
    }

    this.setState({ loading: true, error: null });

    try {
      // Use move_file to trash (move to non-existent location effectively deletes)
      // Note: Filesystem MCP server may not have delete directly
      // This is a simplified implementation
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'move_file', {
        source: path,
        destination: `${path}.deleted-${Date.now()}`,
      });

      // Reload current directory
      await this.loadDirectory(this.state.currentPath);

      this.eventBus.emit('filesystem:file:deleted', {
        path,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Create directory
   */
  private async createDirectory(path: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'create_directory',
        { path }
      );

      // Reload current directory
      await this.loadDirectory(this.state.currentPath);

      this.eventBus.emit('filesystem:directory:created', {
        path,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Search files
   */
  private async searchFiles(pattern: string): Promise<void> {
    this.setState({ loading: true, error: null, view: 'search' });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'search_files',
        {
          path: this.state.currentPath,
          pattern,
        }
      );

      // Parse search results
      const searchResults: SearchResult[] = []; // TODO: Parse from result

      this.setState({
        searchResults,
        loading: false,
      });

      this.eventBus.emit('filesystem:search:complete', {
        pattern,
        resultCount: searchResults.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  /**
   * Generate breadcrumbs from path
   */
  private generateBreadcrumbs(path: string): Breadcrumb[] {
    const parts = path.split('/').filter(Boolean);
    const breadcrumbs: Breadcrumb[] = [{ name: 'Root', path: '/' }];

    let currentPath = '';
    for (const part of parts) {
      currentPath += `/${part}`;
      breadcrumbs.push({ name: part, path: currentPath });
    }

    return breadcrumbs;
  }

  /**
   * Get file icon
   */
  private getFileIcon(entry: Entry): string {
    if (entry.type === 'directory') {
      return '📁';
    }

    const fileEntry = entry as FileEntry;
    const icons = { ...this.defaultFileIcons, ...this.widgetConfig.fileIcons };
    return icons[fileEntry.extension] || '📄';
  }

  /**
   * Format bytes
   */
  private formatBytes(bytes: number): string {
    if (this.widgetConfig.fileSizeFormat === 'bytes') {
      return `${bytes} B`;
    }

    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  }

  /**
   * Render widget
   */
  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="filesystem-widget">
        <header class="widget-header">
          <h2>📁 Filesystem</h2>
          <div class="header-actions">
            <button class="icon-button" id="search-btn" title="Search">🔍</button>
            <button class="icon-button" id="new-folder-btn" title="New Folder">📁+</button>
            <button class="icon-button" id="refresh-btn" title="Refresh">⟳</button>
          </div>
        </header>

        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  /**
   * Render content
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
        return this.renderBrowser();
      case 'editor':
        return this.renderEditor();
      case 'search':
        return this.renderSearch();
      default:
        return '<div>Unknown view</div>';
    }
  }

  /**
   * Render file browser
   */
  private renderBrowser(): string {
    return `
      <div class="browser-view">
        <nav class="breadcrumbs">
          ${this.state.breadcrumbs
            .map(
              (crumb, idx) => `
            <button class="breadcrumb" data-path="${crumb.path}">
              ${crumb.name}
            </button>
            ${idx < this.state.breadcrumbs.length - 1 ? '<span class="separator">/</span>' : ''}
          `
            )
            .join('')}
        </nav>

        <div class="file-list">
          ${this.state.entries.length === 0 ? '<div class="empty">Empty directory</div>' : ''}
          ${this.state.entries
            .map(
              entry => `
            <div class="file-entry ${entry === this.state.selectedEntry ? 'selected' : ''}"
                 data-path="${entry.path}"
                 data-type="${entry.type}">
              <span class="file-icon">${this.getFileIcon(entry)}</span>
              <span class="file-name">${entry.name}</span>
              <span class="file-meta">
                ${entry.type === 'file' ? this.formatBytes((entry as FileEntry).size) : ''}
              </span>
            </div>
          `
            )
            .join('')}
        </div>
      </div>
    `;
  }

  /**
   * Render file editor
   */
  private renderEditor(): string {
    if (!this.state.openFile) {
      return '<div class="empty">No file open</div>';
    }

    return `
      <div class="editor-view">
        <div class="editor-toolbar">
          <button class="toolbar-button" id="close-editor-btn">← Back</button>
          <span class="editor-title">${this.state.openFile.path}</span>
          <button class="toolbar-button primary" id="save-btn">💾 Save</button>
        </div>

        <textarea
          class="editor-content"
          id="editor-textarea"
          spellcheck="false"
        >${this.state.openFile.content}</textarea>
      </div>
    `;
  }

  /**
   * Render search results
   */
  private renderSearch(): string {
    return `
      <div class="search-view">
        <div class="search-toolbar">
          <button class="toolbar-button" id="close-search-btn">← Back</button>
          <input
            type="text"
            class="search-input"
            id="search-input"
            placeholder="Search files (e.g., *.ts)..."
          />
          <button class="toolbar-button primary" id="search-submit-btn">Search</button>
        </div>

        <div class="search-results">
          ${this.state.searchResults.length === 0 ? '<div class="empty">No results</div>' : ''}
          ${this.state.searchResults
            .map(
              result => `
            <div class="search-result" data-path="${result.path}">
              <span class="result-path">${result.path}</span>
              ${result.matches ? `<span class="result-matches">${result.matches} matches</span>` : ''}
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

    // Refresh button
    const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
    refreshBtn?.addEventListener('click', () => this.refresh());

    // Search button
    const searchBtn = this.shadowRoot.getElementById('search-btn');
    searchBtn?.addEventListener('click', () =>
      this.setState({ view: 'search' })
    );

    // New folder button
    const newFolderBtn = this.shadowRoot.getElementById('new-folder-btn');
    newFolderBtn?.addEventListener('click', () => {
      const name = prompt('Folder name:');
      if (name) {
        const path = `${this.state.currentPath}/${name}`;
        this.createDirectory(path);
      }
    });

    // Breadcrumbs
    this.shadowRoot.querySelectorAll('.breadcrumb').forEach(crumb => {
      crumb.addEventListener('click', () => {
        const path = (crumb as HTMLElement).dataset.path;
        if (path) {
          this.loadDirectory(path);
        }
      });
    });

    // File entries
    this.shadowRoot.querySelectorAll('.file-entry').forEach(entry => {
      entry.addEventListener('click', () => {
        const path = (entry as HTMLElement).dataset.path;
        const type = (entry as HTMLElement).dataset.type;

        if (path && type === 'directory') {
          this.loadDirectory(path);
        } else if (path && type === 'file') {
          this.loadFile(path);
        }
      });
    });

    // Editor
    const closeEditorBtn = this.shadowRoot.getElementById('close-editor-btn');
    closeEditorBtn?.addEventListener('click', () =>
      this.setState({ view: 'browser', openFile: null })
    );

    const saveBtn = this.shadowRoot.getElementById('save-btn');
    const editorTextarea = this.shadowRoot.getElementById(
      'editor-textarea'
    ) as HTMLTextAreaElement;

    saveBtn?.addEventListener('click', () => {
      if (this.state.openFile && editorTextarea) {
        this.saveFile(this.state.openFile.path, editorTextarea.value);
      }
    });

    // Search
    const closeSearchBtn = this.shadowRoot.getElementById('close-search-btn');
    closeSearchBtn?.addEventListener('click', () =>
      this.setState({ view: 'browser' })
    );

    const searchInput = this.shadowRoot.getElementById(
      'search-input'
    ) as HTMLInputElement;
    const searchSubmitBtn = this.shadowRoot.getElementById('search-submit-btn');

    searchSubmitBtn?.addEventListener('click', () => {
      if (searchInput?.value) {
        this.searchFiles(searchInput.value);
      }
    });

    searchInput?.addEventListener('keypress', e => {
      if (e.key === 'Enter' && searchInput.value) {
        this.searchFiles(searchInput.value);
      }
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
      widgetId: this.id || 'filesystem-widget',
      element: 'filesystem-mcp-widget',
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
    const fileContentSize = this.state.openFile?.content.length || 0;
    return stateSize + domSize + fileContentSize * 2;
  }
}
