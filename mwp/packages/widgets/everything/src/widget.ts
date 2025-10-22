import type {
  Configuration,
  EventBus,
  MCPBridge,
  MCPServerInfo,
  ResourceUsage,
  UnsubscribeFunction,
  WidgetStatus,
} from '@mcp-wp/core';
import { styles } from './styles.js';
import type {
  DesktopSearchFilters,
  DesktopSearchResult,
  DesktopFileMetadata,
  EverythingState,
  EverythingTab,
  SearchSnippetSegment,
} from './types.js';

const HEADER_TITLE = 'Everything MCP Server';
const SEARCH_TOOL_NAME = 'desktop_search';
const DEBOUNCE_DEFAULT_MS = 350;
const DEFAULT_MAX_RESULTS = 50;

export class EverythingWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private serverInfo!: MCPServerInfo;

  private searchDebounceTimer: number | null = null;

  private state: EverythingState = {
    loading: true,
    error: null,
    tools: [],
    resources: [],
    prompts: [],
    activeTab: 'search',
    search: {
      query: '',
      filters: this.createDefaultFilters(),
      debounceMs: DEBOUNCE_DEFAULT_MS,
      searching: false,
      results: [],
      selectedResult: null,
      preview: {
        loading: false,
        error: null,
      },
    },
  };

  private unsubscribers: UnsubscribeFunction[] = [];
  private renderStartTimestamp?: number;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setDependencies(eventBus: EventBus, bridge: MCPBridge, _configuration: Configuration): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
  }

  setServerInfo(serverInfo: MCPServerInfo): void {
    this.serverInfo = serverInfo;
  }

  async initialize(): Promise<void> {
    this.render();
    this.setupEventListeners();
    await this.loadSnapshot();
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    if (this.searchDebounceTimer) {
      window.clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    await this.loadSnapshot();
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return {
        status: 'initializing',
        message: 'Loading MCP server snapshot…',
      };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: {
          code: 'EVERYTHING_WIDGET_ERROR',
          message: this.state.error,
        },
      };
    }

    return {
      status: 'healthy',
      message: `Connected to ${this.serverInfo.serverName}`,
      lastUpdate: this.state.lastUpdated,
      details: {
        tools: this.state.tools.length,
        resources: this.state.resources.length,
        prompts: this.state.prompts.length,
      },
    };
  }

  getResourceUsage(): ResourceUsage {
    const renderTime = this.renderStartTimestamp ? Date.now() - this.renderStartTimestamp : 0;
    const domNodes = this.shadowRoot?.querySelectorAll('*').length ?? 0;

    return {
      renderTime,
      domNodes,
      memory: 0,
    };
  }

  private setupEventListeners(): void {
    const updateEvent = `mcp:server:${this.serverInfo.serverName}:updated`;

    this.unsubscribers.push(
      this.eventBus.on(updateEvent, () => {
        void this.loadSnapshot();
      })
    );

    this.unsubscribers.push(
      this.eventBus.on('widget:refresh-requested', payload => {
        if (payload?.widgetId === this.id || payload?.serverName === this.serverInfo.serverName) {
          void this.loadSnapshot();
        }
      })
    );
  }

  private async loadSnapshot(): Promise<void> {
    this.renderStartTimestamp = Date.now();
    this.setState({ loading: true, error: null });

    try {
      const [tools, resources, prompts] = await Promise.all([
        this.bridge.listTools(this.serverInfo.serverName),
        this.bridge.listResources(this.serverInfo.serverName).catch(() => []),
        this.bridge.listPrompts(this.serverInfo.serverName).catch(() => []),
      ]);

      this.setState({
        tools,
        resources,
        prompts,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load MCP server data';
      this.setState({ loading: false, error: message });
    }
  }

  private setState(partial: Partial<EverythingState>): void {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  private render(): void {
    if (!this.shadowRoot) {
      return;
    }

    const root = this.shadowRoot;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = styles;
    root.appendChild(style);

    const container = document.createElement('div');
    container.className = 'widget';
    root.appendChild(container);

    container.appendChild(this.renderHeader());
    container.appendChild(this.renderSummary());
    container.appendChild(this.renderTabs());
    container.appendChild(this.renderBody());
  }

  private renderHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h2');
    title.textContent = HEADER_TITLE;
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = 'status-chip';
    status.textContent = this.state.loading ? 'Loading…' : 'Live';
    header.appendChild(status);

    return header;
  }

  private renderSummary(): HTMLElement {
    const summary = document.createElement('div');
    summary.className = 'summary';

    summary.appendChild(this.createStatCard(this.state.tools.length, 'Tools'));
    summary.appendChild(this.createStatCard(this.state.resources.length, 'Resources'));
    summary.appendChild(this.createStatCard(this.state.prompts.length, 'Prompts'));

    if (this.state.lastUpdated) {
      summary.appendChild(this.createStatCard(this.state.lastUpdated.toLocaleTimeString(), 'Last Updated'));
    }

    return summary;
  }

  private createStatCard(value: string | number, label: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'stat-card';

    const valueEl = document.createElement('div');
    valueEl.className = 'stat-value';
    valueEl.textContent = typeof value === 'number' ? value.toString() : value;

    const labelEl = document.createElement('div');
    labelEl.className = 'stat-label';
    labelEl.textContent = label;

    card.appendChild(valueEl);
    card.appendChild(labelEl);

    return card;
  }

  private renderTabs(): HTMLElement {
    const tabs = document.createElement('div');
    tabs.className = 'tabs';

    const tabDefinitions: Array<{ id: EverythingTab; label: string }> = [
      { id: 'search', label: 'Search' },
      { id: 'overview', label: 'Overview' },
      { id: 'tools', label: 'Tools' },
      { id: 'resources', label: 'Resources' },
      { id: 'prompts', label: 'Prompts' },
    ];

    for (const tab of tabDefinitions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `tab${tab.id === this.state.activeTab ? ' active' : ''}`;
      button.textContent = tab.label;
      button.addEventListener('click', () => {
        if (tab.id !== this.state.activeTab) {
          this.setState({ activeTab: tab.id });
        }
      });
      tabs.appendChild(button);
    }

    return tabs;
  }

  private renderBody(): HTMLElement {
    const content = document.createElement('div');
    content.className = 'content';

    if (this.state.error) {
      content.appendChild(this.renderError(this.state.error));
      return content;
    }

    if (this.state.loading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Loading server metadata…';
      content.appendChild(loading);
      return content;
    }

    switch (this.state.activeTab) {
      case 'overview':
        content.appendChild(this.renderOverview());
        break;
      case 'search':
        content.appendChild(this.renderSearchPanel());
        break;
      case 'tools':
        content.appendChild(this.renderTools());
        break;
      case 'resources':
        content.appendChild(this.renderResources());
        break;
      case 'prompts':
        content.appendChild(this.renderPrompts());
        break;
    }

    return content;
  }

  private renderOverview(): HTMLElement {
    const wrapper = document.createElement('div');

    if (this.state.tools.length === 0 && this.state.resources.length === 0 && this.state.prompts.length === 0) {
      wrapper.appendChild(this.renderEmpty('No MCP primitives discovered yet. Confirm the Everything MCP server is running.'));
      return wrapper;
    }

    const description = document.createElement('div');
    description.className = 'item';

    const title = document.createElement('div');
    title.className = 'item-title';
    title.textContent = 'Desktop Search Overview';

    const body = document.createElement('div');
    body.className = 'item-description';
    body.textContent = 'Browse all tools, resources, and prompts exposed by the Everything MCP server. Use the tabs to inspect each capability.';

    const meta = document.createElement('div');
    meta.className = 'item-meta';
    meta.appendChild(this.createTag(`${this.state.tools.length} tools`));
    meta.appendChild(this.createTag(`${this.state.resources.length} resources`));
    meta.appendChild(this.createTag(`${this.state.prompts.length} prompts`));

    description.appendChild(title);
    description.appendChild(body);
    description.appendChild(meta);

    wrapper.appendChild(description);

    return wrapper;
  }

  private renderTools(): HTMLElement {
    if (this.state.tools.length === 0) {
      return this.renderEmpty('No tools available.');
    }

    const fragment = document.createDocumentFragment();

    for (const tool of this.state.tools) {
      const item = document.createElement('div');
      item.className = 'item';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = tool.title || tool.name;
      item.appendChild(title);

      if (tool.description) {
        const description = document.createElement('div');
        description.className = 'item-description';
        description.textContent = tool.description;
        item.appendChild(description);
      }

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.appendChild(this.createTag(tool.name));

      if (tool.annotations?.category) {
        meta.appendChild(this.createTag(tool.annotations.category));
      }

      if (tool.annotations?.executionTime) {
        meta.appendChild(this.createTag(`${tool.annotations.executionTime} exec`));
      }

      item.appendChild(meta);
      fragment.appendChild(item);
    }

    const container = document.createElement('div');
    container.appendChild(fragment);
    return container;
  }

  private renderResources(): HTMLElement {
    if (this.state.resources.length === 0) {
      return this.renderEmpty('No resources advertised by this server.');
    }

    const fragment = document.createDocumentFragment();

    for (const resource of this.state.resources) {
      const item = document.createElement('div');
      item.className = 'item';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = resource.name || resource.uri;
      item.appendChild(title);

      if (resource.description) {
        const description = document.createElement('div');
        description.className = 'item-description';
        description.textContent = resource.description;
        item.appendChild(description);
      }

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.appendChild(this.createTag(resource.uri));
      if (resource.mimeType) {
        meta.appendChild(this.createTag(resource.mimeType));
      }

      item.appendChild(meta);
      fragment.appendChild(item);
    }

    const container = document.createElement('div');
    container.appendChild(fragment);
    return container;
  }

  private renderPrompts(): HTMLElement {
    if (this.state.prompts.length === 0) {
      return this.renderEmpty('No prompts available.');
    }

    const fragment = document.createDocumentFragment();

    for (const prompt of this.state.prompts) {
      const item = document.createElement('div');
      item.className = 'item';

      const title = document.createElement('div');
      title.className = 'item-title';
      title.textContent = prompt.title || prompt.name;
      item.appendChild(title);

      if (prompt.description) {
        const description = document.createElement('div');
        description.className = 'item-description';
        description.textContent = prompt.description;
        item.appendChild(description);
      }

      const meta = document.createElement('div');
      meta.className = 'item-meta';
      meta.appendChild(this.createTag(`${prompt.arguments?.length ?? 0} args`));

      item.appendChild(meta);
      fragment.appendChild(item);
    }

    const container = document.createElement('div');
    container.appendChild(fragment);
    return container;
  }

  private renderError(message: string): HTMLElement {
    const error = document.createElement('div');
    error.className = 'error';
    error.textContent = message;
    return error;
  }

  private renderEmpty(message: string): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = message;
    return empty;
  }

  private createTag(label: string): HTMLElement {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.textContent = label;
    return tag;
  }

  private renderSearchPanel(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'search-panel';

    wrapper.appendChild(this.renderSearchControls());
    wrapper.appendChild(this.renderSearchResultsAndPreview());

    return wrapper;
  }

  private renderSearchControls(): HTMLElement {
    const form = document.createElement('form');
    form.className = 'search-controls';
    form.addEventListener('submit', event => {
      event.preventDefault();
      void this.executeSearch(true);
    });

    const queryGroup = document.createElement('div');
    queryGroup.className = 'control-group';

    const label = document.createElement('label');
    label.textContent = 'Query';
    label.setAttribute('for', 'desktop-search-input');
    queryGroup.appendChild(label);

    const input = document.createElement('input');
    input.id = 'desktop-search-input';
    input.type = 'search';
    input.placeholder = 'Search filenames or contents (e.g., app.ts OR "error code")';
    input.value = this.state.search.query;
    input.addEventListener('input', event => {
      const value = (event.target as HTMLInputElement).value;
      this.setSearchState({ query: value });
      this.scheduleSearch();
    });
    queryGroup.appendChild(input);
    form.appendChild(queryGroup);

    const filterRow = document.createElement('div');
    filterRow.className = 'filter-row';

    const fileTypeInput = document.createElement('input');
    fileTypeInput.type = 'text';
    fileTypeInput.placeholder = 'File types (comma separated, e.g., ts,js,md)';
    fileTypeInput.value = this.state.search.filters.fileTypes.join(',');
    fileTypeInput.addEventListener('change', event => {
      const raw = (event.target as HTMLInputElement).value;
      const next = raw
        .split(',')
        .map(token => token.trim())
        .filter(Boolean);
      this.updateFilters({ fileTypes: next });
      this.scheduleSearch();
    });
    filterRow.appendChild(this.wrapInputWithLabel('File Types', fileTypeInput));

    const rootPathsInput = document.createElement('input');
    rootPathsInput.type = 'text';
    rootPathsInput.placeholder = 'Root directories (comma separated)';
    rootPathsInput.value = this.state.search.filters.rootPaths.join(',');
    rootPathsInput.addEventListener('change', event => {
      const raw = (event.target as HTMLInputElement).value;
      const next = raw
        .split(',')
        .map(token => token.trim())
        .filter(Boolean);
      this.updateFilters({ rootPaths: next });
      this.scheduleSearch();
    });
    filterRow.appendChild(this.wrapInputWithLabel('Root Paths', rootPathsInput));

    const matchCaseToggle = this.createToggle('Match Case', this.state.search.filters.matchCase, value => {
      this.updateFilters({ matchCase: value });
      this.scheduleSearch();
    });

    const hiddenToggle = this.createToggle('Include Hidden', this.state.search.filters.includeHidden, value => {
      this.updateFilters({ includeHidden: value });
      this.scheduleSearch();
    });

    filterRow.appendChild(matchCaseToggle);
    filterRow.appendChild(hiddenToggle);

    form.appendChild(filterRow);

    const actions = document.createElement('div');
    actions.className = 'search-actions';

    const searchButton = document.createElement('button');
    searchButton.type = 'submit';
    searchButton.className = 'primary';
    searchButton.textContent = this.state.search.searching ? 'Searching…' : 'Search';
    searchButton.disabled = this.state.search.searching || this.state.search.query.trim().length === 0;
    actions.appendChild(searchButton);

    const resetButton = document.createElement('button');
    resetButton.type = 'button';
    resetButton.textContent = 'Reset';
    resetButton.addEventListener('click', () => {
      this.resetSearch();
    });
    actions.appendChild(resetButton);

    form.appendChild(actions);

    return form;
  }

  private renderSearchResultsAndPreview(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'search-results-container';

    container.appendChild(this.renderSearchResults());
    container.appendChild(this.renderSearchPreview());

    return container;
  }

  private renderSearchResults(): HTMLElement {
    const section = document.createElement('section');
    section.className = 'search-results';

    const header = document.createElement('div');
    header.className = 'results-header';
    header.textContent = `Results (${this.state.search.results.length})`;
    section.appendChild(header);

    if (this.state.search.searching) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Searching desktop index…';
      section.appendChild(loading);
      return section;
    }

    if (!this.state.search.query.trim()) {
      section.appendChild(this.renderEmpty('Enter a query to search desktop content.'));
      return section;
    }

    if (this.state.search.results.length === 0) {
      section.appendChild(this.renderEmpty('No matches found. Adjust filters and try again.'));
      return section;
    }

    const list = document.createElement('ul');
    list.className = 'search-result-list';

    for (const result of this.state.search.results) {
      const item = document.createElement('li');
      item.className = 'search-result-item';
      if (result === this.state.search.selectedResult) {
        item.classList.add('selected');
      }

      item.addEventListener('click', () => {
        this.onResultSelected(result);
      });

      const icon = document.createElement('span');
      icon.className = 'result-icon';
      icon.textContent = this.resolveIcon(result.metadata);
      item.appendChild(icon);

      const body = document.createElement('div');
      body.className = 'result-body';

      const title = document.createElement('div');
      title.className = 'result-title';
      title.textContent = result.metadata.name;
      body.appendChild(title);

      const path = document.createElement('div');
      path.className = 'result-path';
      path.textContent = result.metadata.path;
      body.appendChild(path);

      const snippet = document.createElement('div');
      snippet.className = 'result-snippet';
      this.populateSnippet(snippet, result.snippet);
      body.appendChild(snippet);

      item.appendChild(body);

      const score = document.createElement('span');
      score.className = 'result-score';
      score.textContent = result.score.toFixed(2);
      item.appendChild(score);

      list.appendChild(item);
    }

    section.appendChild(list);
    return section;
  }

  private renderSearchPreview(): HTMLElement {
    const aside = document.createElement('aside');
    aside.className = 'preview-panel';

    const header = document.createElement('div');
    header.className = 'preview-header';
    header.textContent = 'Preview';
    aside.appendChild(header);

    const content = document.createElement('div');
    content.className = 'preview-content';

    if (!this.state.search.selectedResult) {
      const empty = document.createElement('div');
      empty.className = 'empty-state';
      empty.textContent = 'Select a result to preview file contents and metadata.';
      content.appendChild(empty);
      aside.appendChild(content);
      return aside;
    }

    if (this.state.search.preview.loading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Loading preview…';
      content.appendChild(loading);
      aside.appendChild(content);
      return aside;
    }

    if (this.state.search.preview.error) {
      content.appendChild(this.renderError(this.state.search.preview.error));
      aside.appendChild(content);
      return aside;
    }

    if (this.state.search.preview.metadata) {
      const metadata = this.state.search.preview.metadata;
      const metaList = document.createElement('dl');
      metaList.className = 'preview-metadata';

      this.appendMetadata(metaList, 'Path', metadata.path);
      this.appendMetadata(metaList, 'Type', metadata.type);
      if (metadata.sizeInBytes !== undefined) {
        this.appendMetadata(metaList, 'Size', `${metadata.sizeInBytes.toLocaleString()} bytes`);
      }
      if (metadata.updatedAt) {
        this.appendMetadata(metaList, 'Modified', new Date(metadata.updatedAt).toLocaleString());
      }
      if (metadata.tags && metadata.tags.length) {
        this.appendMetadata(metaList, 'Tags', metadata.tags.join(', '));
      }

      content.appendChild(metaList);
    }

    if (this.state.search.preview.snippet && this.state.search.preview.snippet.length) {
      const snippet = document.createElement('pre');
      snippet.className = 'preview-snippet';
      this.populateSnippet(snippet, this.state.search.preview.snippet);
      content.appendChild(snippet);
    }

    if (this.state.search.preview.rawContent) {
      const raw = document.createElement('pre');
      raw.className = 'preview-raw';
      raw.textContent = this.state.search.preview.rawContent;
      content.appendChild(raw);
    }

    aside.appendChild(content);
    return aside;
  }

  private appendMetadata(list: HTMLElement, name: string, value: string | number): void {
    const dt = document.createElement('dt');
    dt.textContent = name;
    list.appendChild(dt);

    const dd = document.createElement('dd');
    dd.textContent = String(value);
    list.appendChild(dd);
  }

  private populateSnippet(container: HTMLElement, segments: SearchSnippetSegment[]): void {
    container.innerHTML = '';

    const queryTerms = this.extractHighlightTerms(this.state.search.query);
    const patternSource = queryTerms.length ? `(${queryTerms.join('|')})` : null;
    const flags = this.state.search.filters.matchCase ? 'g' : 'gi';

    segments.forEach(segment => {
      const line = document.createElement('div');
      line.className = 'snippet-line';

      if (segment.lineNumber !== undefined) {
        const lineNumber = document.createElement('span');
        lineNumber.className = 'snippet-line-number';
        lineNumber.textContent = `${segment.lineNumber}`;
        line.appendChild(lineNumber);
      }

      const textContainer = document.createElement('span');
      textContainer.className = 'snippet-text';

      const text = segment.text ?? '';
      if (patternSource) {
        const regex = new RegExp(patternSource, flags);
        const parts = text.split(regex);
        if (parts.length > 1) {
          parts.forEach((part, idx) => {
            if (!part) {
              return;
            }
            const span = document.createElement('span');
            if ((idx % 2 === 1) || segment.highlight) {
              span.className = 'snippet-highlight';
            }
            span.textContent = part;
            textContainer.appendChild(span);
          });
        } else {
          const span = document.createElement('span');
          if (segment.highlight) {
            span.className = 'snippet-highlight';
          }
          span.textContent = text;
          textContainer.appendChild(span);
        }
      } else {
        const span = document.createElement('span');
        if (segment.highlight) {
          span.className = 'snippet-highlight';
        }
        span.textContent = text;
        textContainer.appendChild(span);
      }

      line.appendChild(textContainer);
      container.appendChild(line);
    });
  }

  private wrapInputWithLabel(label: string, input: HTMLElement): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'filter-control';
    const span = document.createElement('span');
    span.textContent = label;
    wrapper.appendChild(span);
    wrapper.appendChild(input);
    return wrapper;
  }

  private createToggle(label: string, value: boolean, onChange: (next: boolean) => void): HTMLElement {
    const wrapper = document.createElement('label');
    wrapper.className = 'filter-control toggle';

    const text = document.createElement('span');
    text.textContent = label;
    wrapper.appendChild(text);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = value;
    checkbox.addEventListener('change', event => {
      onChange((event.target as HTMLInputElement).checked);
    });
    wrapper.appendChild(checkbox);

    return wrapper;
  }

  private resolveIcon(metadata: DesktopFileMetadata): string {
    if (metadata.type === 'directory') {
      return '📁';
    }

    const ext = metadata.extension.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) {
      return '🖼️';
    }
    if (['mp4', 'mov', 'mkv', 'webm'].includes(ext)) {
      return '🎞️';
    }
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) {
      return '🎧';
    }
    if (['ts', 'tsx', 'js', 'jsx', 'json', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp'].includes(ext)) {
      return '💻';
    }
    if (['md', 'txt', 'log'].includes(ext)) {
      return '📄';
    }
    return '📦';
  }

  private onResultSelected(result: DesktopSearchResult): void {
    if (this.state.search.selectedResult === result) {
      return;
    }

    this.setSearchState({ selectedResult: result, preview: { loading: true, error: null } });
    void this.loadPreview(result);
  }

  private async loadPreview(result: DesktopSearchResult): Promise<void> {
    if (!result.resourceUri) {
      this.setSearchState({
        preview: {
          loading: false,
          error: null,
          metadata: result.metadata,
          snippet: result.snippet,
        },
      });
      return;
    }

    try {
      const resource = await this.bridge.readResource(this.serverInfo.serverName, result.resourceUri);

      let rawContent: string | undefined;
      if (resource?.text) {
        rawContent = resource.text;
      }

      this.setSearchState({
        preview: {
          loading: false,
          error: null,
          metadata: result.metadata,
          snippet: result.snippet,
          rawContent,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load resource preview';
      this.setSearchState({
        preview: {
          loading: false,
          error: message,
        },
      });
    }
  }

  private setSearchState(partial: Partial<EverythingState['search']>): void {
    const nextPreview = partial.preview !== undefined ? partial.preview : this.state.search.preview;

    this.state = {
      ...this.state,
      search: {
        ...this.state.search,
        ...partial,
        preview: nextPreview,
      },
    };
    this.render();
  }

  private createDefaultFilters(): DesktopSearchFilters {
    return {
      rootPaths: [],
      fileTypes: [],
      includeHidden: false,
      matchCase: false,
      maxResults: DEFAULT_MAX_RESULTS,
    };
  }

  private updateFilters(partial: Partial<DesktopSearchFilters>): void {
    this.setSearchState({ filters: { ...this.state.search.filters, ...partial } });
  }

  private resetSearch(): void {
    this.setSearchState({
      query: '',
      filters: this.createDefaultFilters(),
      searching: false,
      results: [],
      selectedResult: null,
      preview: {
        loading: false,
        error: null,
      },
    });
  }

  private scheduleSearch(): void {
    if (this.searchDebounceTimer) {
      window.clearTimeout(this.searchDebounceTimer);
    }

    if (!this.state.search.query.trim()) {
      this.setSearchState({
        results: [],
        selectedResult: null,
        preview: { loading: false, error: null },
      });
      return;
    }

    this.searchDebounceTimer = window.setTimeout(() => {
      void this.executeSearch(false);
    }, this.state.search.debounceMs);
  }

  private async executeSearch(force: boolean): Promise<void> {
    const query = this.state.search.query.trim();
    if (!query) {
      return;
    }

    if (!force && query === this.state.search.lastExecutedQuery) {
      return;
    }

    if (this.searchDebounceTimer) {
      window.clearTimeout(this.searchDebounceTimer);
      this.searchDebounceTimer = null;
    }

    this.setSearchState({ searching: true, lastExecutedQuery: query });

    try {
      const toolName = this.getSearchToolName();
      const toolResult = await this.bridge.callTool(this.serverInfo.serverName, toolName, {
        query,
        filters: this.state.search.filters,
      });

      const parsedResults = this.parseSearchResults(toolResult);
      this.setSearchState({
        results: parsedResults,
        searching: false,
        selectedResult: parsedResults[0] ?? null,
        preview: parsedResults.length
          ? { loading: true, error: null }
          : { loading: false, error: null },
      });

      if (parsedResults[0]) {
        void this.loadPreview(parsedResults[0]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Desktop search failed';
      this.setSearchState({ searching: false, preview: { loading: false, error: message } });
    }
  }

  private parseSearchResults(toolResult: any): DesktopSearchResult[] {
    if (!toolResult) {
      return [];
    }

    const payload = this.extractJSONPayload(toolResult);
    if (!payload || !Array.isArray(payload.results)) {
      return [];
    }

    const highlightedResults = payload.results.map((result: any, index: number): DesktopSearchResult => {
      const metadata: DesktopFileMetadata = {
        path: String(result.path ?? result.metadata?.path ?? ''),
        name: String(result.name ?? result.metadata?.name ?? ''),
        extension: String(result.extension ?? result.metadata?.extension ?? ''),
        type: (result.type ?? result.metadata?.type ?? 'file') as DesktopFileMetadata['type'],
        sizeInBytes: typeof result.size === 'number' ? result.size : result.metadata?.size,
        createdAt: result.metadata?.createdAt ?? result.createdAt,
        updatedAt: result.metadata?.updatedAt ?? result.updatedAt,
        tags: Array.isArray(result.metadata?.tags) ? result.metadata.tags : undefined,
      };

      const snippet = this.parseSnippet(result.snippet ?? result.preview);

      return {
        id: String(result.id ?? `${metadata.path}-${index}`),
        score: typeof result.score === 'number' ? result.score : 0,
        metadata,
        snippet,
        resourceUri: result.resourceUri ?? result.metadata?.resourceUri,
      };
    });

    const query = this.state.search.query;
    if (!query.trim()) {
      return highlightedResults;
    }

    return highlightedResults.map(result => ({
      ...result,
      snippet: this.applyQueryHighlight(result.snippet, query),
    }));
  }

  private parseSnippet(raw: any): SearchSnippetSegment[] {
    if (!raw) {
      return [];
    }

    if (Array.isArray(raw)) {
      return raw.map((segment: any) => ({
        text: String(segment.text ?? segment.content ?? ''),
        highlight: Boolean(segment.highlight ?? segment.match),
        lineNumber: typeof segment.lineNumber === 'number' ? segment.lineNumber : undefined,
      }));
    }

    if (typeof raw === 'string') {
      return raw.split('\n').map(line => ({ text: line, highlight: false }));
    }

    return [];
  }

  private extractJSONPayload(toolResult: any): any {
    if (!toolResult) {
      return null;
    }

    if (Array.isArray(toolResult.content)) {
      const jsonEntry = toolResult.content.find(item => item.mimeType === 'application/json' || item.type === 'json');
      if (jsonEntry?.text) {
        try {
          return JSON.parse(jsonEntry.text);
        } catch (error) {
          console.warn('Failed to parse JSON payload from search result', error);
        }
      }

      const textEntry = toolResult.content.find(item => item.text);
      if (textEntry?.text) {
        try {
          return JSON.parse(textEntry.text);
        } catch (error) {
          /* noop */
        }
      }
    }

    return null;
  }

  private getSearchToolName(): string {
    const candidateNames = [
      SEARCH_TOOL_NAME,
      'search',
      'search_files',
      'search_desktop',
    ];

    const availableNames = new Set(this.state.tools.map(tool => tool.name));
    for (const candidate of candidateNames) {
      if (availableNames.has(candidate)) {
        return candidate;
      }
    }

    return candidateNames[0];
  }

  private applyQueryHighlight(segments: SearchSnippetSegment[], query: string): SearchSnippetSegment[] {
    const terms = this.extractHighlightTerms(query);
    if (!terms.length) {
      return segments;
    }

    const flags = this.state.search.filters.matchCase ? 'g' : 'gi';
    const patternSource = `(${terms.join('|')})`;

    return segments.map(segment => {
      if (segment.highlight) {
        return segment;
      }

      const text = segment.text ?? '';
      const regex = new RegExp(patternSource, flags);
      if (!regex.test(text)) {
        return segment;
      }

      return {
        ...segment,
        highlight: true,
      };
    });
  }

  private extractHighlightTerms(query: string): string[] {
    return query
      .split(/[\s,]+/)
      .map(token => token.trim())
      .filter(token => token.length > 1)
      .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }
}
