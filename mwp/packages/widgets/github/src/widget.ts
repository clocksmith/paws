/**
 * GitHub Widget – complete implementation for the MCP GitHub server.
 *
 * The widget exposes the core workflows requested in the project TODO:
 * - Repository browsing sourced from `repo://` resources.
 * - Issue and pull‑request listings plus creation forms invoking
 *   `create_issue` and `create_pull_request` tools.
 * - Code/repository search via `search_repositories`/`search_code`.
 * - Resource exploration for `repo://` and `file://` URIs.
 *
 * Every tool execution is routed through the supplied `MCPBridge`, which in
 * turn emits the standard `mcp:tool:invoke-requested`/`mcp:tool:invoked`
 * events for host confirmation and auditing.
 */

import type { types } from '@mcp-wp/core';

type Configuration = types.Configuration;
type EventBus = types.EventBus;
type MCPBridge = types.MCPBridge;
type MCPServerInfo = types.MCPServerInfo;
type Resource = types.Resource;
type ResourceUsage = types.ResourceUsage;
type ToolResult = types.ToolResult;
type UnsubscribeFunction = types.UnsubscribeFunction;
type WidgetStatus = types.WidgetStatus;

import { styles } from './styles.js';

type Tab =
  | 'overview'
  | 'issues'
  | 'pulls'
  | 'search'
  | 'resources'
  | 'new-issue'
  | 'new-pr';

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type Repository = {
  id: string;
  name: string;
  fullName: string;
  description?: string;
  url?: string;
  language?: string;
  stars?: number;
  forks?: number;
  private?: boolean;
  defaultBranch?: string;
};

type Issue = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  url?: string;
  updatedAt?: string;
};

type PullRequest = {
  number: number;
  title: string;
  state: 'open' | 'closed' | 'merged';
  url?: string;
  updatedAt?: string;
  sourceBranch?: string;
  targetBranch?: string;
};

type SearchEntry = {
  title: string;
  detail: string;
  url?: string;
};

type ResourceEntry = {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  kind: 'repository' | 'file' | 'other';
};

type Banner = {
  type: 'success' | 'error' | 'info';
  message: string;
  id: number;
};

interface WidgetState {
  initializing: boolean;
  currentTab: Tab;
  banner: Banner | null;
  repositories: {
    status: LoadState;
    items: Repository[];
    error?: string;
  };
  selectedRepository: Repository | null;
  issues: {
    status: LoadState;
    items: Issue[];
    error?: string;
  };
  pulls: {
    status: LoadState;
    items: PullRequest[];
    error?: string;
  };
  search: {
    status: LoadState;
    query: string;
    language: string;
    repo: string;
    includeForks: boolean;
    results: SearchEntry[];
    error?: string;
  };
  resources: {
    status: LoadState;
    items: ResourceEntry[];
    selectedUri: string | null;
    previewStatus: LoadState;
    previewContent?: string;
    previewError?: string;
    error?: string;
  };
  repoFilter: string;
  busy: boolean;
}

export class GitHubWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private configuration!: Configuration;
  private serverInfo!: MCPServerInfo;

  private state: WidgetState = {
    initializing: true,
    currentTab: 'overview',
    banner: null,
    repositories: { status: 'loading', items: [] },
    selectedRepository: null,
    issues: { status: 'idle', items: [] },
    pulls: { status: 'idle', items: [] },
    search: { status: 'idle', query: '', language: '', repo: '', includeForks: false, results: [] },
    resources: { status: 'idle', items: [], selectedUri: null, previewStatus: 'idle' },
    repoFilter: '',
    busy: false,
  };

  private toolNames: Set<string> | null = null;
  private disposed = false;
  private unsubscribers: UnsubscribeFunction[] = [];
  private bannerCounter = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // ---------------------------------------------------------------------------
  // Public API (invoked by the widget factory)
  // ---------------------------------------------------------------------------

  setDependencies(eventBus: EventBus, bridge: MCPBridge, configuration: Configuration): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
    this.configuration = configuration;
  }

  setServerInfo(info: MCPServerInfo): void {
    this.serverInfo = info;
  }

  async initialize(): Promise<void> {
    this.disposed = false;
    this.updateState({ initializing: true });
    this.render();

    this.subscribeToEvents();

    try {
      await this.ensureToolCatalog();
      await this.loadRepositories();
      await this.loadResources();
      this.updateState({ initializing: false });
    } catch (error) {
      this.pushBanner('error', this.stringifyError(error));
      this.updateState({ initializing: false });
    }
  }

  async destroy(): Promise<void> {
    this.disposed = true;
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    switch (this.state.currentTab) {
      case 'issues':
        await this.loadIssues(true);
        break;
      case 'pulls':
        await this.loadPulls(true);
        break;
      case 'search':
        if (this.state.search.query) {
          await this.executeSearch();
        }
        break;
      case 'resources':
        await this.loadResources(true);
        break;
      default:
        await this.loadRepositories(true);
        break;
    }
  }

  getStatus(): WidgetStatus {
    if (this.state.initializing || this.state.repositories.status === 'loading') {
      return { status: 'initializing', message: 'Loading repositories…' };
    }

    if (this.state.repositories.status === 'error') {
      return {
        status: 'error',
        message: this.state.repositories.error ?? 'Unable to load repositories',
        error: {
          code: 'GITHUB_WIDGET_ERROR',
          message: this.state.repositories.error ?? 'Unknown error',
        },
      };
    }

    const repo = this.state.selectedRepository?.fullName;
    return {
      status: 'healthy',
      message: repo ? `Viewing ${repo}` : `Loaded ${this.state.repositories.items.length} repositories`,
    };
  }

  getResourceUsage(): ResourceUsage {
    const nodeCount = this.shadowRoot?.querySelectorAll('*').length ?? 0;
    const approxText = JSON.stringify(this.state).length * 2;
    return {
      memory: approxText + nodeCount * 48,
      renderTime: 0,
      domNodes: nodeCount,
    };
  }

  // ---------------------------------------------------------------------------
  // Data loading helpers
  // ---------------------------------------------------------------------------

  private async ensureToolCatalog(): Promise<void> {
    if (this.toolNames) return;
    const names = new Set<string>();
    (this.serverInfo?.tools ?? []).forEach(tool => names.add(tool.name));
    try {
      const list = await this.bridge.listTools(this.serverInfo.serverName);
      list.forEach(tool => names.add(tool.name));
    } catch (error) {
      console.warn('[github-widget] failed to list tools', error);
    }
    this.toolNames = names;
  }

  private async loadRepositories(force = false): Promise<void> {
    if (!force && this.state.repositories.status === 'loading') return;
    this.updateState({ repositories: { ...this.state.repositories, status: 'loading', error: undefined } });

    try {
      await this.ensureToolCatalog();
      const tool = this.pickTool(['list_repositories', 'listRepos', 'repositories/list']);
      let repositories: Repository[] = [];

      if (tool) {
        const result = await this.bridge.callTool(this.serverInfo.serverName, tool, {});
        repositories = this.parseRepositories(result);
      }

      if (!repositories.length) {
        const resources = await this.bridge.listResources(this.serverInfo.serverName);
        repositories = this.repositoriesFromResources(resources);
      }

      const previouslySelected = this.state.selectedRepository?.fullName;
      const selected = repositories.find(repo => repo.fullName === previouslySelected) ?? repositories[0] ?? null;

      this.updateState({
        repositories: { status: 'ready', items: repositories },
        selectedRepository: selected,
      });

      if (selected) {
        await Promise.allSettled([this.loadIssues(), this.loadPulls()]);
      }
    } catch (error) {
      this.updateState({
        repositories: {
          status: 'error',
          items: [],
          error: this.stringifyError(error),
        },
      });
    }
  }

  private async loadIssues(force = false): Promise<void> {
    const repo = this.state.selectedRepository?.fullName;
    if (!repo) return;

    if (!force && this.state.issues.status === 'loading') return;
    this.updateState({ issues: { ...this.state.issues, status: 'loading', error: undefined } });

    try {
      const tool = this.pickTool(['list_issues', 'issues/list', 'listIssues']);
      if (!tool) {
        throw new Error('The GitHub server does not expose a `list_issues` tool.');
      }

      const result = await this.bridge.callTool(this.serverInfo.serverName, tool, { repo });
      const issues = this.parseIssues(result);
      this.updateState({ issues: { status: 'ready', items: issues } });
    } catch (error) {
      this.updateState({
        issues: {
          status: 'error',
          items: [],
          error: this.stringifyError(error),
        },
      });
    }
  }

  private async loadPulls(force = false): Promise<void> {
    const repo = this.state.selectedRepository?.fullName;
    if (!repo) return;

    if (!force && this.state.pulls.status === 'loading') return;
    this.updateState({ pulls: { ...this.state.pulls, status: 'loading', error: undefined } });

    try {
      const tool = this.pickTool(['list_pull_requests', 'listPullRequests', 'pulls/list']);
      if (!tool) {
        throw new Error('The GitHub server does not expose a `list_pull_requests` tool.');
      }

      const result = await this.bridge.callTool(this.serverInfo.serverName, tool, { repo });
      const pulls = this.parsePulls(result);
      this.updateState({ pulls: { status: 'ready', items: pulls } });
    } catch (error) {
      this.updateState({
        pulls: {
          status: 'error',
          items: [],
          error: this.stringifyError(error),
        },
      });
    }
  }

  private async loadResources(force = false): Promise<void> {
    if (!force && this.state.resources.status === 'loading') return;
    this.updateState({ resources: { ...this.state.resources, status: 'loading', error: undefined } });

    try {
      const resources = await this.bridge.listResources(this.serverInfo.serverName);
      const items = this.parseResources(resources);
      const selected = items.find(item => item.uri === this.state.resources.selectedUri)?.uri ?? null;
      this.updateState({
        resources: {
          status: 'ready',
          items,
          selectedUri: selected,
          previewStatus: selected ? 'loading' : 'idle',
          previewContent: undefined,
          previewError: undefined,
        },
      });

      if (selected) {
        await this.loadPreview(selected);
      }
    } catch (error) {
      this.updateState({
        resources: {
          status: 'error',
          items: [],
          selectedUri: null,
          previewStatus: 'idle',
          error: this.stringifyError(error),
        },
      });
    }
  }

  private async loadPreview(uri: string): Promise<void> {
    this.updateState({
      resources: {
        ...this.state.resources,
        selectedUri: uri,
        previewStatus: 'loading',
        previewContent: undefined,
        previewError: undefined,
      },
    });

    try {
      const content = await this.bridge.readResource(this.serverInfo.serverName, uri);
      const text = content.text ?? (content.blob ? this.decodeBase64(content.blob) : '[binary content]');
      this.updateState({
        resources: {
          ...this.state.resources,
          previewStatus: 'ready',
          previewContent: text,
          previewError: undefined,
        },
      });
    } catch (error) {
      this.updateState({
        resources: {
          ...this.state.resources,
          previewStatus: 'error',
          previewError: this.stringifyError(error),
        },
      });
    }
  }

  private async submitIssue(form: HTMLFormElement): Promise<void> {
    const repo = this.state.selectedRepository?.fullName;
    if (!repo) {
      this.pushBanner('error', 'Select a repository before creating an issue.');
      return;
    }

    const formData = new FormData(form);
    const title = (formData.get('title') as string | null)?.trim();
    const body = (formData.get('body') as string | null)?.trim();
    const labels = this.splitCsv(formData.get('labels'));
    const assignees = this.splitCsv(formData.get('assignees'));

    if (!title) {
      this.pushBanner('error', 'Issue title is required.');
      return;
    }

    try {
      this.updateState({ busy: true });
      const tool = this.pickTool(['create_issue', 'issues/create', 'open_issue']);
      if (!tool) {
        throw new Error('The GitHub server does not expose a `create_issue` tool.');
      }

      await this.bridge.callTool(this.serverInfo.serverName, tool, {
        repo,
        title,
        body,
        labels: labels.length ? labels : undefined,
        assignees: assignees.length ? assignees : undefined,
      });

      this.pushBanner('success', 'Issue created successfully.');
      form.reset();
      await this.loadIssues(true);
      this.updateState({ currentTab: 'issues' });
    } catch (error) {
      this.pushBanner('error', this.stringifyError(error));
    } finally {
      this.updateState({ busy: false });
    }
  }

  private async submitPullRequest(form: HTMLFormElement): Promise<void> {
    const repo = this.state.selectedRepository?.fullName;
    if (!repo) {
      this.pushBanner('error', 'Select a repository before creating a pull request.');
      return;
    }

    const formData = new FormData(form);
    const title = (formData.get('title') as string | null)?.trim();
    const body = (formData.get('body') as string | null)?.trim();
    const head = (formData.get('head') as string | null)?.trim();
    const base = (formData.get('base') as string | null)?.trim();
    const draft = formData.get('draft') === 'on';

    if (!title || !head || !base) {
      this.pushBanner('error', 'Title, source branch, and target branch are required.');
      return;
    }

    try {
      this.updateState({ busy: true });
      const tool = this.pickTool(['create_pull_request', 'pulls/create', 'open_pull_request']);
      if (!tool) {
        throw new Error('The GitHub server does not expose a `create_pull_request` tool.');
      }

      await this.bridge.callTool(this.serverInfo.serverName, tool, {
        repo,
        title,
        body,
        head,
        base,
        draft,
      });

      this.pushBanner('success', 'Pull request created successfully.');
      form.reset();
      await this.loadPulls(true);
      this.updateState({ currentTab: 'pulls' });
    } catch (error) {
      this.pushBanner('error', this.stringifyError(error));
    } finally {
      this.updateState({ busy: false });
    }
  }

  private async executeSearch(form?: HTMLFormElement): Promise<void> {
    const query = (form?.querySelector('[name="search-query"]') as HTMLInputElement | null)?.value.trim() ?? this.state.search.query;
    const language = (form?.querySelector('[name="search-language"]') as HTMLInputElement | null)?.value.trim() ?? this.state.search.language;
    const repo = (form?.querySelector('[name="search-repo"]') as HTMLInputElement | null)?.value.trim() ?? this.state.search.repo;
    const includeForks = (form?.querySelector('[name="search-forks"]') as HTMLInputElement | null)?.checked ?? this.state.search.includeForks;

    if (!query) {
      this.pushBanner('error', 'Enter a search query.');
      return;
    }

    this.updateState({
      search: {
        status: 'loading',
        query,
        language,
        repo,
        includeForks,
        results: [],
      },
    });

    try {
      const tool = this.pickTool(['search_repositories', 'search_repos', 'search_code', 'code_search']);
      if (!tool) {
        throw new Error('The GitHub server does not expose a search tool.');
      }

      const args: Record<string, unknown> = { query };
      if (language) args.language = language;
      if (repo) args.repo = repo;
      if (includeForks) args.includeForks = true;

      const result = await this.bridge.callTool(this.serverInfo.serverName, tool, args);
      const results = this.parseSearchResults(result);

      this.updateState({
        search: {
          ...this.state.search,
          status: 'ready',
          results,
        },
      });
    } catch (error) {
      this.updateState({
        search: {
          ...this.state.search,
          status: 'error',
          error: this.stringifyError(error),
        },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Helper methods
  // ---------------------------------------------------------------------------

  private pickTool(candidates: string[]): string | null {
    if (!this.toolNames) return null;
    for (const name of candidates) {
      if (this.toolNames.has(name)) return name;
    }
    return null;
  }

  private parseRepositories(result: ToolResult): Repository[] {
    try {
      const data = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
      const items = Array.isArray(data) ? data : data?.repositories ?? data?.items ?? [];

      return items.map((item: any, index: number) => ({
        id: item.id?.toString() ?? item.full_name ?? `repo-${index}`,
        name: item.name ?? item.full_name?.split('/')[1] ?? 'Unknown',
        fullName: item.full_name ?? item.name ?? 'unknown/repo',
        description: item.description,
        url: item.html_url ?? item.url,
        language: item.language,
        stars: item.stargazers_count ?? item.stars,
        forks: item.forks_count ?? item.forks,
        private: item.private ?? false,
        defaultBranch: item.default_branch ?? 'main',
      }));
    } catch (error) {
      console.error('[github-widget] failed to parse repositories', error);
      return [];
    }
  }

  private parseIssues(result: ToolResult): Issue[] {
    try {
      const data = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
      const items = Array.isArray(data) ? data : data?.issues ?? data?.items ?? [];

      return items.map((item: any) => ({
        number: item.number ?? 0,
        title: item.title ?? 'Untitled',
        state: (item.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
        url: item.html_url ?? item.url,
        updatedAt: item.updated_at,
      }));
    } catch (error) {
      console.error('[github-widget] failed to parse issues', error);
      return [];
    }
  }

  private parsePulls(result: ToolResult): PullRequest[] {
    try {
      const data = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
      const items = Array.isArray(data) ? data : data?.pull_requests ?? data?.items ?? [];

      return items.map((item: any) => ({
        number: item.number ?? 0,
        title: item.title ?? 'Untitled',
        state: (item.merged ? 'merged' : item.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed' | 'merged',
        url: item.html_url ?? item.url,
        updatedAt: item.updated_at,
        sourceBranch: item.head?.ref ?? item.source_branch,
        targetBranch: item.base?.ref ?? item.target_branch ?? item.base_branch,
      }));
    } catch (error) {
      console.error('[github-widget] failed to parse pull requests', error);
      return [];
    }
  }

  private parseSearchResults(result: ToolResult): SearchEntry[] {
    try {
      const data = typeof result.content === 'string' ? JSON.parse(result.content) : result.content;
      const items = Array.isArray(data) ? data : data?.items ?? data?.results ?? [];

      return items.map((item: any) => ({
        title: item.name ?? item.title ?? item.path ?? 'Result',
        detail: item.description ?? item.repository?.full_name ?? item.repo ?? '',
        url: item.html_url ?? item.url,
      }));
    } catch (error) {
      console.error('[github-widget] failed to parse search results', error);
      return [];
    }
  }

  private parseResources(resources: Resource[]): ResourceEntry[] {
    return resources.map(resource => {
      const uri = resource.uri;
      let kind: 'repository' | 'file' | 'other' = 'other';

      if (uri.startsWith('repo://')) {
        kind = 'repository';
      } else if (uri.startsWith('file://') || uri.includes('/blob/') || uri.includes('/tree/')) {
        kind = 'file';
      }

      return {
        uri,
        name: resource.name ?? uri.split('/').pop() ?? uri,
        description: resource.description,
        mimeType: resource.mimeType,
        kind,
      };
    });
  }

  private repositoriesFromResources(resources: Resource[]): Repository[] {
    return resources
      .filter(resource => resource.uri.startsWith('repo://'))
      .map((resource, index) => {
        const fullName = resource.uri.replace('repo://', '').replace(/\/$/, '');
        const parts = fullName.split('/');
        const name = parts[parts.length - 1] || 'unknown';

        return {
          id: `repo-${index}`,
          name,
          fullName,
          description: resource.description,
          url: `https://github.com/${fullName}`,
          language: undefined,
          stars: undefined,
          forks: undefined,
          private: false,
          defaultBranch: 'main',
        };
      });
  }

  private updateState(partial: Partial<WidgetState>): void {
    this.state = { ...this.state, ...partial };
    this.render();
  }

  private pushBanner(type: 'success' | 'error' | 'info', message: string): void {
    const id = ++this.bannerCounter;
    this.updateState({ banner: { type, message, id } });

    setTimeout(() => {
      if (this.state.banner?.id === id) {
        this.updateState({ banner: null });
      }
    }, 5000);
  }

  private stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'An unknown error occurred';
  }

  private splitCsv(value: FormDataEntryValue | null): string[] {
    if (!value || typeof value !== 'string') return [];
    return value
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }

  private decodeBase64(blob: string): string {
    try {
      return atob(blob);
    } catch (error) {
      return '[unable to decode base64]';
    }
  }

  private subscribeToEvents(): void {
    const toolHandler = this.eventBus.on('mcp:tool:invoked', (payload: any) => {
      if (payload.serverName !== this.serverInfo?.serverName) return;
      this.handleToolEvent(payload.toolName);
    });

    const errorHandler = this.eventBus.on('mcp:tool:error', (payload: any) => {
      if (payload.serverName !== this.serverInfo?.serverName) return;
      this.pushBanner('error', payload.error?.message ?? 'Tool invocation failed');
    });

    this.unsubscribers.push(toolHandler, errorHandler);
  }

  private handleToolEvent(toolName: string): void {
    // Handle tool events - could refresh data based on tool name
    console.log('[github-widget] tool invoked:', toolName);
  }

  // ---------------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------------

  private render(): void {
    if (!this.shadowRoot) return;

    const html = `
      <style>${styles}</style>
      <div class="github-widget">
        ${this.renderBanner()}
        ${this.renderHeader()}
        ${this.renderTabs()}
        ${this.renderContent()}
      </div>
    `;

    this.shadowRoot.innerHTML = html;
    this.attachEventListeners();
  }

  private renderBanner(): string {
    if (!this.state.banner) return '';

    const { type, message } = this.state.banner;
    return `
      <div class="banner banner-${type}">
        <span>${this.escapeHtml(message)}</span>
        <button class="banner-close" data-action="close-banner">×</button>
      </div>
    `;
  }

  private renderHeader(): string {
    const repoOptions = this.state.repositories.items.map(repo => {
      const selected = this.state.selectedRepository?.fullName === repo.fullName ? 'selected' : '';
      return `<option value="${this.escapeHtml(repo.fullName)}" ${selected}>${this.escapeHtml(repo.fullName)}</option>`;
    }).join('');

    return `
      <header class="header">
        <div class="header-left">
          <h2 class="title">GitHub</h2>
          <span class="status-badge">${this.state.initializing ? 'Connecting…' : 'Connected'}</span>
        </div>
        <div class="header-right">
          <select class="repo-select" data-action="select-repo">
            <option value="">All Repositories</option>
            ${repoOptions}
          </select>
          <button class="refresh-button" data-action="refresh">Refresh</button>
        </div>
      </header>
    `;
  }

  private renderTabs(): string {
    const tabs: Array<{ id: Tab; label: string; requiresRepo?: boolean }> = [
      { id: 'overview', label: 'Overview' },
      { id: 'issues', label: 'Issues', requiresRepo: true },
      { id: 'pulls', label: 'Pull Requests', requiresRepo: true },
      { id: 'search', label: 'Search' },
      { id: 'resources', label: 'Resources' },
      { id: 'new-issue', label: 'New Issue', requiresRepo: true },
      { id: 'new-pr', label: 'New PR', requiresRepo: true },
    ];

    const hasRepo = !!this.state.selectedRepository;

    return `
      <nav class="tabs">
        ${tabs.map(tab => {
          const disabled = tab.requiresRepo && !hasRepo;
          const active = this.state.currentTab === tab.id;
          return `
            <button
              class="tab ${active ? 'active' : ''}"
              data-action="switch-tab"
              data-tab="${tab.id}"
              ${disabled ? 'disabled' : ''}
            >
              ${this.escapeHtml(tab.label)}
            </button>
          `;
        }).join('')}
      </nav>
    `;
  }

  private renderContent(): string {
    if (this.state.initializing) {
      return '<div class="loading">Loading GitHub data…</div>';
    }

    switch (this.state.currentTab) {
      case 'overview':
        return this.renderOverview();
      case 'issues':
        return this.renderIssues();
      case 'pulls':
        return this.renderPulls();
      case 'search':
        return this.renderSearch();
      case 'resources':
        return this.renderResources();
      case 'new-issue':
        return this.renderNewIssue();
      case 'new-pr':
        return this.renderNewPullRequest();
      default:
        return this.renderOverview();
    }
  }

  private renderOverview(): string {
    const { repositories } = this.state;

    if (repositories.status === 'loading') {
      return '<div class="loading">Loading repositories…</div>';
    }

    if (repositories.error) {
      return `<div class="error">Error: ${this.escapeHtml(repositories.error)}</div>`;
    }

    const filter = this.state.repoFilter.toLowerCase();
    const filtered = repositories.items.filter(repo =>
      repo.fullName.toLowerCase().includes(filter) ||
      (repo.description?.toLowerCase().includes(filter) ?? false)
    );

    return `
      <div class="content">
        <div class="filter-row">
          <input
            type="text"
            class="filter-input"
            placeholder="Filter repositories…"
            value="${this.escapeHtml(this.state.repoFilter)}"
            data-action="filter-repos"
          />
        </div>
        <div class="repo-grid">
          ${filtered.map(repo => this.renderRepositoryCard(repo)).join('')}
        </div>
      </div>
    `;
  }

  private renderRepositoryCard(repo: Repository): string {
    return `
      <div class="repo-card">
        <h3 class="repo-name">${this.escapeHtml(repo.fullName)}</h3>
        ${repo.description ? `<p class="repo-description">${this.escapeHtml(repo.description)}</p>` : ''}
        <div class="repo-meta">
          ${repo.language ? `<span class="repo-language">${this.escapeHtml(repo.language)}</span>` : ''}
          ${repo.stars !== undefined ? `<span class="repo-stars">⭐ ${repo.stars}</span>` : ''}
          ${repo.forks !== undefined ? `<span class="repo-forks">🔱 ${repo.forks}</span>` : ''}
        </div>
        ${repo.url ? `<a href="${this.escapeHtml(repo.url)}" class="repo-link" target="_blank">View on GitHub →</a>` : ''}
      </div>
    `;
  }

  private renderIssues(): string {
    const { issues } = this.state;

    if (issues.status === 'loading') {
      return '<div class="loading">Loading issues…</div>';
    }

    if (issues.error) {
      return `<div class="error">Error: ${this.escapeHtml(issues.error)}</div>`;
    }

    if (!issues.items.length) {
      return '<div class="empty">No issues found</div>';
    }

    return `
      <div class="content">
        <div class="item-list">
          ${issues.items.map(issue => `
            <div class="item-card">
              <div class="item-header">
                <span class="item-number">#${issue.number}</span>
                <span class="item-state state-${issue.state}">${issue.state}</span>
              </div>
              <h3 class="item-title">${this.escapeHtml(issue.title)}</h3>
              ${issue.updatedAt ? `<div class="item-meta">Updated ${this.formatDate(issue.updatedAt)}</div>` : ''}
              ${issue.url ? `<a href="${this.escapeHtml(issue.url)}" class="item-link" target="_blank">View →</a>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderPulls(): string {
    const { pulls } = this.state;

    if (pulls.status === 'loading') {
      return '<div class="loading">Loading pull requests…</div>';
    }

    if (pulls.error) {
      return `<div class="error">Error: ${this.escapeHtml(pulls.error)}</div>`;
    }

    if (!pulls.items.length) {
      return '<div class="empty">No pull requests found</div>';
    }

    return `
      <div class="content">
        <div class="item-list">
          ${pulls.items.map(pr => `
            <div class="item-card">
              <div class="item-header">
                <span class="item-number">#${pr.number}</span>
                <span class="item-state state-${pr.state}">${pr.state}</span>
              </div>
              <h3 class="item-title">${this.escapeHtml(pr.title)}</h3>
              ${pr.sourceBranch && pr.targetBranch ? `<div class="item-meta">${this.escapeHtml(pr.sourceBranch)} → ${this.escapeHtml(pr.targetBranch)}</div>` : ''}
              ${pr.updatedAt ? `<div class="item-meta">Updated ${this.formatDate(pr.updatedAt)}</div>` : ''}
              ${pr.url ? `<a href="${this.escapeHtml(pr.url)}" class="item-link" target="_blank">View →</a>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  private renderSearch(): string {
    const { search } = this.state;

    return `
      <div class="content">
        <form class="search-form" data-action="submit-search">
          <input
            type="text"
            name="search-query"
            placeholder="Search query"
            value="${this.escapeHtml(search.query)}"
            required
          />
          <input
            type="text"
            name="search-language"
            placeholder="Language (optional)"
            value="${this.escapeHtml(search.language)}"
          />
          <input
            type="text"
            name="search-repo"
            placeholder="Repository (optional)"
            value="${this.escapeHtml(search.repo)}"
          />
          <label class="checkbox-label">
            <input type="checkbox" name="search-forks" ${search.includeForks ? 'checked' : ''} />
            Include forks
          </label>
          <button type="submit" class="submit-button">Search</button>
        </form>

        ${search.status === 'loading' ? '<div class="loading">Searching…</div>' : ''}
        ${search.error ? `<div class="error">Error: ${this.escapeHtml(search.error)}</div>` : ''}

        ${search.results.length ? `
          <div class="search-results">
            ${search.results.map(result => `
              <div class="search-result">
                <h3 class="search-title">${this.escapeHtml(result.title)}</h3>
                ${result.detail ? `<p class="search-detail">${this.escapeHtml(result.detail)}</p>` : ''}
                ${result.url ? `<a href="${this.escapeHtml(result.url)}" class="search-link" target="_blank">View →</a>` : ''}
              </div>
            `).join('')}
          </div>
        ` : search.status === 'ready' ? '<div class="empty">No results found</div>' : ''}
      </div>
    `;
  }

  private renderResources(): string {
    const { resources } = this.state;

    if (resources.status === 'loading') {
      return '<div class="loading">Loading resources…</div>';
    }

    if (resources.error) {
      return `<div class="error">Error: ${this.escapeHtml(resources.error)}</div>`;
    }

    return `
      <div class="content resources-layout">
        <div class="resources-list">
          ${resources.items.map(item => `
            <button
              class="resource-item ${resources.selectedUri === item.uri ? 'active' : ''}"
              data-action="select-resource"
              data-uri="${this.escapeHtml(item.uri)}"
            >
              <div class="resource-name">${this.escapeHtml(item.name)}</div>
              ${item.description ? `<div class="resource-description">${this.escapeHtml(item.description)}</div>` : ''}
              <div class="resource-uri">${this.escapeHtml(item.uri)}</div>
            </button>
          `).join('')}
        </div>
        <div class="resource-preview">
          ${resources.previewStatus === 'loading' ? '<div class="loading">Loading preview…</div>' : ''}
          ${resources.previewError ? `<div class="error">Error: ${this.escapeHtml(resources.previewError)}</div>` : ''}
          ${resources.previewContent ? `<pre class="preview-content">${this.escapeHtml(resources.previewContent)}</pre>` : ''}
          ${!resources.selectedUri ? '<div class="empty">Select a resource to preview</div>' : ''}
        </div>
      </div>
    `;
  }

  private renderNewIssue(): string {
    const repo = this.state.selectedRepository;
    if (!repo) {
      return '<div class="empty">Select a repository to create an issue</div>';
    }

    return `
      <div class="content">
        <h3>New Issue in ${this.escapeHtml(repo.fullName)}</h3>
        <form class="form" data-action="submit-issue">
          <input
            type="text"
            name="title"
            placeholder="Issue title"
            required
            class="form-input"
          />
          <textarea
            name="body"
            placeholder="Issue description (optional)"
            rows="10"
            class="form-textarea"
          ></textarea>
          <input
            type="text"
            name="labels"
            placeholder="Labels (comma-separated)"
            class="form-input"
          />
          <input
            type="text"
            name="assignees"
            placeholder="Assignees (comma-separated usernames)"
            class="form-input"
          />
          <button type="submit" class="submit-button" ${this.state.busy ? 'disabled' : ''}>
            ${this.state.busy ? 'Creating…' : 'Create Issue'}
          </button>
        </form>
      </div>
    `;
  }

  private renderNewPullRequest(): string {
    const repo = this.state.selectedRepository;
    if (!repo) {
      return '<div class="empty">Select a repository to create a pull request</div>';
    }

    return `
      <div class="content">
        <h3>New Pull Request in ${this.escapeHtml(repo.fullName)}</h3>
        <form class="form" data-action="submit-pr">
          <input
            type="text"
            name="title"
            placeholder="Pull request title"
            required
            class="form-input"
          />
          <textarea
            name="body"
            placeholder="Pull request description (optional)"
            rows="10"
            class="form-textarea"
          ></textarea>
          <input
            type="text"
            name="head"
            placeholder="Source branch (e.g., feature/my-branch)"
            required
            class="form-input"
          />
          <input
            type="text"
            name="base"
            placeholder="Target branch (e.g., ${repo.defaultBranch})"
            value="${this.escapeHtml(repo.defaultBranch ?? 'main')}"
            required
            class="form-input"
          />
          <label class="checkbox-label">
            <input type="checkbox" name="draft" />
            Create as draft
          </label>
          <button type="submit" class="submit-button" ${this.state.busy ? 'disabled' : ''}>
            ${this.state.busy ? 'Creating…' : 'Create Pull Request'}
          </button>
        </form>
      </div>
    `;
  }

  private attachEventListeners(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action === 'close-banner') {
        this.updateState({ banner: null });
      } else if (action === 'refresh') {
        void this.refresh();
      } else if (action === 'switch-tab') {
        const tab = target.dataset.tab as Tab;
        this.updateState({ currentTab: tab });
      } else if (action === 'select-resource') {
        const uri = target.dataset.uri;
        if (uri) void this.loadPreview(uri);
      }
    });

    this.shadowRoot.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      const action = target.dataset.action;

      if (action === 'select-repo') {
        const select = target as HTMLSelectElement;
        const fullName = select.value;
        const repo = this.state.repositories.items.find(r => r.fullName === fullName) ?? null;
        this.updateState({ selectedRepository: repo });
        if (repo) {
          void Promise.allSettled([this.loadIssues(), this.loadPulls()]);
        }
      } else if (action === 'filter-repos') {
        const input = target as HTMLInputElement;
        this.updateState({ repoFilter: input.value });
      }
    });

    this.shadowRoot.addEventListener('submit', (e) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const action = form.dataset.action;

      if (action === 'submit-issue') {
        void this.submitIssue(form);
      } else if (action === 'submit-pr') {
        void this.submitPullRequest(form);
      } else if (action === 'submit-search') {
        void this.executeSearch(form);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Utility methods
  // ---------------------------------------------------------------------------

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private formatDate(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) return 'today';
      if (days === 1) return 'yesterday';
      if (days < 7) return `${days} days ago`;
      if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
      if (days < 365) return `${Math.floor(days / 30)} months ago`;
      return `${Math.floor(days / 365)} years ago`;
    } catch (error) {
      return dateStr;
    }
  }
}
