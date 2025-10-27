/**
 * Memory Widget Component
 *
 * Web Component for Memory MCP server interaction.
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
  MemoryWidgetConfig,
  Entity,
  Relation,
  KnowledgeGraph,
  EntityWithRelations,
  GraphData,
  GraphNode,
  GraphEdge,
  SearchResult,
  EntityFilter,
  ExportOptions,
  GraphLayoutOptions,
} from './types.js';

/**
 * Widget State
 */
interface WidgetState {
  graph: KnowledgeGraph | null;
  selectedEntity: EntityWithRelations | null;
  searchQuery: string;
  searchResults: SearchResult[];
  view: 'graph' | 'list';
  loading: boolean;
  error: string | null;
}

/**
 * Memory Widget
 */
export class MemoryWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;
  private config!: Configuration;
  private serverInfo!: MCPServerInfo;
  private widgetConfig: MemoryWidgetConfig;

  private state: WidgetState = {
    graph: null,
    selectedEntity: null,
    searchQuery: '',
    searchResults: [],
    view: 'list',
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
      defaultView: 'list',
      graphLayout: 'force',
      showRelationLabels: true,
      animateTransitions: true,
      groupByType: true,
      showObservations: true,
      maxObservationsDisplay: 5,
      entityColors: {
        user: '#3b82f6',
        project: '#10b981',
        language: '#f59e0b',
        technology: '#8b5cf6',
        concept: '#ec4899',
        default: '#6b7280',
      },
      searchMinLength: 2,
      searchDebounce: 300,
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

    const savedConfig = this.config.get('memoryWidget');
    if (savedConfig) {
      this.widgetConfig = { ...this.widgetConfig, ...savedConfig };
    }

    this.state.view = this.widgetConfig.defaultView || 'list';

    this.eventBus.emit('widget:initialized', {
      widgetId: this.id || 'memory-widget',
      element: 'memory-widget',
      serverName: this.serverInfo.serverName,
      timestamp: this.initTimestamp,
    });

    this.setupEventListeners();
    await this.loadGraph();
    this.render();
  }

  async destroy(): Promise<void> {
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    this.eventBus.emit('widget:destroyed', {
      widgetId: this.id || 'memory-widget',
      element: 'memory-widget',
      serverName: this.serverInfo.serverName,
      timestamp: new Date(),
    });

    if (this.shadowRoot) {
      this.shadowRoot.innerHTML = '';
    }
  }

  async refresh(): Promise<void> {
    await this.loadGraph();
  }

  getStatus(): WidgetStatus {
    if (this.state.loading) {
      return { status: 'initializing', message: 'Loading...' };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: { code: 'WIDGET_ERROR', message: this.state.error },
      };
    }

    const entityCount = this.state.graph?.entities.length || 0;
    const relationCount = this.state.graph?.relations.length || 0;
    return {
      status: 'healthy',
      message: `${entityCount} entities, ${relationCount} relations`,
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
  async createEntity(entity: Entity): Promise<void> {
    await this.createEntities([entity]);
  }

  async createEntities(entities: Entity[]): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'create_entities', {
        entities,
      });

      this.eventBus.emit('memory:entity:created', {
        count: entities.length,
        timestamp: new Date(),
      });

      await this.loadGraph();
    } catch (error) {
      this.handleError(error);
    }
  }

  async createRelation(relation: Relation): Promise<void> {
    await this.createRelations([relation]);
  }

  async createRelations(relations: Relation[]): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'create_relations', {
        relations,
      });

      this.eventBus.emit('memory:relation:created', {
        count: relations.length,
        timestamp: new Date(),
      });

      await this.loadGraph();
    } catch (error) {
      this.handleError(error);
    }
  }

  async addObservations(entityName: string, contents: string[]): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'add_observations', {
        observations: [{ entityName, contents }],
      });

      this.eventBus.emit('memory:observation:added', {
        entityName,
        count: contents.length,
        timestamp: new Date(),
      });

      await this.loadGraph();
    } catch (error) {
      this.handleError(error);
    }
  }

  async deleteEntity(entityName: string): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      await this.mcpBridge.callTool(this.serverInfo.serverName, 'delete_entities', {
        entityNames: [entityName],
      });

      this.eventBus.emit('memory:entity:deleted', {
        entityName,
        timestamp: new Date(),
      });

      await this.loadGraph();
    } catch (error) {
      this.handleError(error);
    }
  }

  async searchEntities(query: string): Promise<SearchResult[]> {
    if (!this.state.graph) return [];

    const lowerQuery = query.toLowerCase();
    const results: SearchResult[] = [];

    this.state.graph.entities.forEach(entity => {
      let score = 0;
      const matchedObservations: number[] = [];

      // Match on name
      if (entity.name.toLowerCase().includes(lowerQuery)) {
        score += 0.5;
      }

      // Match on type
      if (entity.entityType.toLowerCase().includes(lowerQuery)) {
        score += 0.3;
      }

      // Match on observations
      entity.observations.forEach((obs, idx) => {
        if (obs.toLowerCase().includes(lowerQuery)) {
          score += 0.2;
          matchedObservations.push(idx);
        }
      });

      if (score > 0) {
        results.push({
          entity,
          score: Math.min(score, 1),
          matchedObservations,
        });
      }
    });

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    this.eventBus.emit('memory:search:completed', {
      query,
      count: results.length,
      timestamp: new Date(),
    });

    return results;
  }

  filterEntities(filter: EntityFilter): Entity[] {
    if (!this.state.graph) return [];

    return this.state.graph.entities.filter(entity => {
      if (filter.type && entity.entityType !== filter.type) {
        return false;
      }

      if (filter.name && !filter.name.test(entity.name)) {
        return false;
      }

      if (filter.observation) {
        const hasMatch = entity.observations.some(obs =>
          filter.observation!.test(obs)
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }

  async exportGraph(
    format: 'json' = 'json',
    options?: ExportOptions
  ): Promise<string> {
    if (!this.state.graph) return '';

    let entities = this.state.graph.entities;
    let relations = this.state.graph.relations;

    if (options?.entities) {
      const entityNames = new Set(options.entities);
      entities = entities.filter(e => entityNames.has(e.name));
    }

    if (!options?.includeRelations) {
      relations = [];
    }

    const exported = {
      entities: options?.includeObservations !== false ? entities : entities.map(e => ({
        name: e.name,
        entityType: e.entityType,
      })),
      relations,
    };

    return JSON.stringify(exported, null, 2);
  }

  setGraphLayout(options: GraphLayoutOptions): void {
    this.widgetConfig.graphLayout = options.layout;
    this.render();
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

  private async loadGraph(): Promise<void> {
    this.setState({ loading: true, error: null });

    try {
      const result = await this.mcpBridge.callTool(
        this.serverInfo.serverName,
        'read_graph',
        {}
      );

      // Parse graph from result
      const graph: KnowledgeGraph = this.parseGraphResult(result);

      this.setState({
        graph,
        loading: false,
      });

      this.eventBus.emit('memory:graph:updated', {
        entityCount: graph.entities.length,
        relationCount: graph.relations.length,
        timestamp: new Date(),
      });
    } catch (error) {
      this.handleError(error);
    }
  }

  private parseGraphResult(result: any): KnowledgeGraph {
    // Parse the MCP tool result into our graph format
    // The actual format depends on the Memory MCP server response
    if (result.content && Array.isArray(result.content)) {
      const content = result.content[0];
      if (content.type === 'text') {
        try {
          const parsed = JSON.parse(content.text);
          return {
            entities: parsed.entities || [],
            relations: parsed.relations || [],
          };
        } catch {
          // Fall through to default
        }
      }
    }

    return {
      entities: [],
      relations: [],
    };
  }

  private getEntityWithRelations(entityName: string): EntityWithRelations | null {
    if (!this.state.graph) return null;

    const entity = this.state.graph.entities.find(e => e.name === entityName);
    if (!entity) return null;

    const outgoing = this.state.graph.relations.filter(r => r.from === entityName);
    const incoming = this.state.graph.relations.filter(r => r.to === entityName);

    return {
      ...entity,
      outgoing,
      incoming,
    };
  }

  private handleSearch(query: string): void {
    this.setState({ searchQuery: query });

    if (this.searchDebounceTimeout) {
      clearTimeout(this.searchDebounceTimeout);
    }

    const minLength = this.widgetConfig.searchMinLength || 2;
    if (query.length < minLength) {
      this.setState({ searchResults: [] });
      return;
    }

    this.searchDebounceTimeout = window.setTimeout(async () => {
      const results = await this.searchEntities(query);
      this.setState({ searchResults: results });
    }, this.widgetConfig.searchDebounce || 300);
  }

  private getEntityColor(entityType: string): string {
    const colors = this.widgetConfig.entityColors || {};
    return colors[entityType] || colors.default || '#6b7280';
  }

  private toGraphData(): GraphData {
    if (!this.state.graph) {
      return { nodes: [], edges: [] };
    }

    const nodes: GraphNode[] = this.state.graph.entities.map(entity => ({
      id: entity.name,
      label: entity.name,
      type: entity.entityType,
      color: this.getEntityColor(entity.entityType),
      size: 10 + entity.observations.length * 2,
    }));

    const edges: GraphEdge[] = this.state.graph.relations.map((rel, idx) => ({
      id: `edge-${idx}`,
      source: rel.from,
      target: rel.to,
      label: rel.relationType,
      type: rel.relationType,
      color: '#9ca3af',
    }));

    return { nodes, edges };
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.renderStartTime = Date.now();

    this.shadowRoot.innerHTML = `
      <style>${styles}</style>
      <div class="memory-widget">
        <header class="widget-header">
          <h2>🧠 Memory & Knowledge Graph</h2>
          <div class="header-actions">
            <input
              type="text"
              id="search-input"
              class="search-input"
              placeholder="Search entities..."
              value="${this.state.searchQuery}"
            />
            <button class="icon-button" id="toggle-view-btn">
              ${this.state.view === 'graph' ? '📋 List' : '🌐 Graph'}
            </button>
            <button class="icon-button" id="new-entity-btn">+ Entity</button>
            <button class="icon-button" id="new-relation-btn">+ Relation</button>
          </div>
        </header>

        ${this.renderContent()}
      </div>
    `;

    this.attachEventHandlers();
  }

  private renderContent(): string {
    if (this.state.loading) {
      return '<div class="loading">Loading...</div>';
    }

    if (this.state.error) {
      return `<div class="error">Error: ${this.state.error}</div>`;
    }

    if (!this.state.graph) {
      return '<div class="empty">No graph data available</div>';
    }

    if (this.state.searchQuery && this.state.searchResults.length > 0) {
      return this.renderSearchResults();
    }

    if (this.state.selectedEntity) {
      return this.renderEntityDetails();
    }

    return this.state.view === 'graph'
      ? this.renderGraphView()
      : this.renderListView();
  }

  private renderListView(): string {
    if (!this.state.graph) return '';

    const { entities } = this.state.graph;

    if (entities.length === 0) {
      return '<div class="empty">No entities yet. Create your first entity!</div>';
    }

    // Group by type if configured
    const grouped = this.widgetConfig.groupByType
      ? this.groupEntitiesByType(entities)
      : { All: entities };

    return `
      <div class="list-view">
        ${Object.entries(grouped)
          .map(([type, typeEntities]) => `
            <div class="entity-group">
              <h3 class="group-header">${type} (${typeEntities.length})</h3>
              <div class="entity-list">
                ${typeEntities.map(entity => this.renderEntityCard(entity)).join('')}
              </div>
            </div>
          `)
          .join('')}
      </div>
    `;
  }

  private renderGraphView(): string {
    const graphData = this.toGraphData();

    return `
      <div class="graph-view">
        <div class="graph-canvas" id="graph-canvas">
          <svg width="100%" height="100%">
            ${this.renderSVGGraph(graphData)}
          </svg>
        </div>
        <div class="graph-stats">
          Entities: ${graphData.nodes.length} | Relations: ${graphData.edges.length}
        </div>
      </div>
    `;
  }

  private renderSVGGraph(data: GraphData): string {
    // Simple force-directed layout visualization
    const width = 800;
    const height = 600;

    // Simple circular layout for demo
    const nodes = data.nodes.map((node, i) => {
      const angle = (2 * Math.PI * i) / data.nodes.length;
      const radius = Math.min(width, height) / 3;
      return {
        ...node,
        x: width / 2 + radius * Math.cos(angle),
        y: height / 2 + radius * Math.sin(angle),
      };
    });

    const edges = data.edges.map(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);
      return { ...edge, source, target };
    });

    return `
      ${edges
        .map(edge => {
          if (!edge.source || !edge.target) return '';
          return `
            <line
              x1="${edge.source.x}"
              y1="${edge.source.y}"
              x2="${edge.target.x}"
              y2="${edge.target.y}"
              stroke="${edge.color || '#9ca3af'}"
              stroke-width="2"
            />
            ${
              this.widgetConfig.showRelationLabels
                ? `<text
                    x="${(edge.source.x + edge.target.x) / 2}"
                    y="${(edge.source.y + edge.target.y) / 2}"
                    fill="#6b7280"
                    font-size="12"
                    text-anchor="middle"
                  >${edge.label}</text>`
                : ''
            }
          `;
        })
        .join('')}

      ${nodes
        .map(node => `
          <g class="graph-node" data-entity="${node.id}">
            <circle
              cx="${node.x}"
              cy="${node.y}"
              r="${node.size || 20}"
              fill="${node.color}"
              stroke="#fff"
              stroke-width="2"
              style="cursor: pointer;"
            />
            <text
              x="${node.x}"
              y="${node.y + (node.size || 20) + 15}"
              fill="currentColor"
              font-size="12"
              text-anchor="middle"
            >${node.label}</text>
          </g>
        `)
        .join('')}
    `;
  }

  private renderEntityCard(entity: Entity): string {
    const color = this.getEntityColor(entity.entityType);
    const maxObs = this.widgetConfig.maxObservationsDisplay || 5;
    const observations = entity.observations.slice(0, maxObs);
    const hasMore = entity.observations.length > maxObs;

    return `
      <div class="entity-card" data-entity="${entity.name}">
        <div class="entity-header">
          <span class="entity-icon" style="background: ${color}">
            ${this.getEntityIcon(entity.entityType)}
          </span>
          <div class="entity-title">
            <h4>${entity.name}</h4>
            <span class="entity-type">${entity.entityType}</span>
          </div>
        </div>
        ${
          this.widgetConfig.showObservations && observations.length > 0
            ? `
          <div class="entity-observations">
            ${observations.map(obs => `<div class="observation">• ${obs}</div>`).join('')}
            ${hasMore ? `<div class="observation-more">+ ${entity.observations.length - maxObs} more</div>` : ''}
          </div>
        `
            : ''
        }
      </div>
    `;
  }

  private renderEntityDetails(): string {
    if (!this.state.selectedEntity) return '';

    const entity = this.state.selectedEntity;
    const color = this.getEntityColor(entity.entityType);

    return `
      <div class="entity-details">
        <button class="back-button" id="back-btn">← Back</button>

        <div class="entity-detail-header" style="border-left: 4px solid ${color}">
          <h3>${entity.name}</h3>
          <span class="entity-type">${entity.entityType}</span>
        </div>

        <div class="detail-section">
          <h4>Observations (${entity.observations.length})</h4>
          <div class="observations-list">
            ${entity.observations.map(obs => `<div class="observation">• ${obs}</div>`).join('')}
          </div>
        </div>

        ${
          entity.outgoing.length > 0
            ? `
          <div class="detail-section">
            <h4>Outgoing Relations (${entity.outgoing.length})</h4>
            <div class="relations-list">
              ${entity.outgoing
                .map(
                  rel => `
                <div class="relation">
                  ${entity.name} <span class="relation-type">${rel.relationType}</span> → ${rel.to}
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        ${
          entity.incoming.length > 0
            ? `
          <div class="detail-section">
            <h4>Incoming Relations (${entity.incoming.length})</h4>
            <div class="relations-list">
              ${entity.incoming
                .map(
                  rel => `
                <div class="relation">
                  ${rel.from} <span class="relation-type">${rel.relationType}</span> → ${entity.name}
                </div>
              `
                )
                .join('')}
            </div>
          </div>
        `
            : ''
        }

        <div class="detail-actions">
          <button id="add-observation-btn">Add Observation</button>
          <button id="delete-entity-btn" class="danger-button">Delete Entity</button>
        </div>
      </div>
    `;
  }

  private renderSearchResults(): string {
    return `
      <div class="search-results">
        <h3>Search Results (${this.state.searchResults.length})</h3>
        <div class="results-list">
          ${this.state.searchResults.map(result => this.renderEntityCard(result.entity)).join('')}
        </div>
      </div>
    `;
  }

  private groupEntitiesByType(entities: Entity[]): Record<string, Entity[]> {
    const grouped: Record<string, Entity[]> = {};

    entities.forEach(entity => {
      if (!grouped[entity.entityType]) {
        grouped[entity.entityType] = [];
      }
      grouped[entity.entityType]!.push(entity);
    });

    return grouped;
  }

  private getEntityIcon(entityType: string): string {
    const icons: Record<string, string> = {
      user: '👤',
      project: '📁',
      language: '💻',
      technology: '⚙️',
      concept: '💡',
      default: '📦',
    };
    return icons[entityType] || icons.default;
  }

  private attachEventHandlers(): void {
    if (!this.shadowRoot) return;

    // Search
    const searchInput = this.shadowRoot.getElementById('search-input') as HTMLInputElement;
    searchInput?.addEventListener('input', e => {
      this.handleSearch((e.target as HTMLInputElement).value);
    });

    // Toggle view
    const toggleViewBtn = this.shadowRoot.getElementById('toggle-view-btn');
    toggleViewBtn?.addEventListener('click', () => {
      this.setState({ view: this.state.view === 'graph' ? 'list' : 'graph' });
    });

    // New entity
    const newEntityBtn = this.shadowRoot.getElementById('new-entity-btn');
    newEntityBtn?.addEventListener('click', () => {
      this.showNewEntityForm();
    });

    // New relation
    const newRelationBtn = this.shadowRoot.getElementById('new-relation-btn');
    newRelationBtn?.addEventListener('click', () => {
      this.showNewRelationForm();
    });

    // Entity card clicks
    this.shadowRoot.querySelectorAll('.entity-card').forEach(card => {
      card.addEventListener('click', () => {
        const entityName = card.getAttribute('data-entity');
        if (entityName) {
          const entity = this.getEntityWithRelations(entityName);
          if (entity) {
            this.setState({ selectedEntity: entity });
          }
        }
      });
    });

    // Graph node clicks
    this.shadowRoot.querySelectorAll('.graph-node').forEach(node => {
      node.addEventListener('click', () => {
        const entityName = node.getAttribute('data-entity');
        if (entityName) {
          const entity = this.getEntityWithRelations(entityName);
          if (entity) {
            this.setState({ selectedEntity: entity });
          }
        }
      });
    });

    // Back button
    const backBtn = this.shadowRoot.getElementById('back-btn');
    backBtn?.addEventListener('click', () => {
      this.setState({ selectedEntity: null });
    });
  }

  private showNewEntityForm(): void {
    // Simple prompt-based form (in production, use a modal)
    const name = prompt('Entity name:');
    if (!name) return;

    const entityType = prompt('Entity type:') || 'default';
    const observationsInput = prompt('Observations (comma-separated):') || '';
    const observations = observationsInput.split(',').map(s => s.trim()).filter(Boolean);

    this.createEntity({ name, entityType, observations });
  }

  private showNewRelationForm(): void {
    // Simple prompt-based form (in production, use a modal)
    const from = prompt('From entity:');
    if (!from) return;

    const to = prompt('To entity:');
    if (!to) return;

    const relationType = prompt('Relation type:') || 'related_to';

    this.createRelation({ from, to, relationType });
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
      widgetId: this.id || 'memory-widget',
      element: 'memory-widget',
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
}
