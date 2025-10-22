import type {
  Configuration,
  EventBus,
  MCPBridge,
  MCPResource,
  MCPServerInfo,
  MCPTool,
  ResourceUsage,
  UnsubscribeFunction,
  WidgetStatus,
} from '@mwp/core';
import { styles } from './styles.js';
import type {
  SupabaseFilters,
  SupabaseMetricsSnapshot,
  SupabaseQueryResult,
  SupabaseQueryState,
  SupabaseRealtimeMessage,
  SupabaseSchemaOverview,
  SupabaseState,
  SupabaseTableDefinition,
  SupabaseView,
} from './types.js';

const DEFAULT_FILTERS: SupabaseFilters = {
  schema: 'public',
  search: '',
};

const DEFAULT_QUERY_STATE: SupabaseQueryState = {
  sql: 'select * from public.your_table limit 50;\n',
  parameters: {},
  executing: false,
  error: null,
};

const DEFAULT_METRICS: SupabaseMetricsSnapshot = {
  activeConnections: 0,
  averageLatencyMs: 0,
  throughputPerMinute: 0,
  replicationLagMs: 0,
};

const TOOL_PREFERENCES: Record<string, string[]> = {
  schema: ['describe_database', 'list_tables', 'get_schema'],
  tableData: ['fetch_table_rows', 'list_rows'],
  updateRow: ['update_row', 'update_table_row'],
  executeSql: ['execute_sql', 'run_query'],
  metrics: ['get_metrics', 'database_metrics'],
};

export class SupabaseWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private serverInfo!: MCPServerInfo;
  private realtimeUnsubscribe: UnsubscribeFunction | null = null;

  private state: SupabaseState = {
    loading: true,
    error: null,
    tools: [],
    resources: [],
    prompts: [],
    view: 'schema',
    schema: { schemas: [], tables: [] },
    filters: DEFAULT_FILTERS,
    query: DEFAULT_QUERY_STATE,
    realtimeMessages: [],
    metrics: DEFAULT_METRICS,
    liveSubscriptionId: null,
    selectedTable: null,
  };

  private unsubscribers: UnsubscribeFunction[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setDependencies(eventBus: EventBus, bridge: MCPBridge, _configuration: Configuration): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
  }

  setServerInfo(info: MCPServerInfo): void {
    this.serverInfo = info;
  }

  async initialize(): Promise<void> {
    this.render();
    this.registerEventListeners();
    await this.loadSnapshot();
  }

  async destroy(): Promise<void> {
    this.unsubscribeRealtime();
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
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
        message: 'Connecting to Supabase…',
      };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: {
          code: 'SUPABASE_WIDGET_ERROR',
          message: this.state.error,
        },
      };
    }

    return {
      status: 'healthy',
      message: `Supabase ready (${this.state.schema.tables.length} tables)` ,
      lastUpdate: this.state.lastUpdated,
      details: {
        schemas: this.state.schema.schemas.length,
        realtime: this.state.realtimeMessages.length,
      },
    };
  }

  getResourceUsage(): ResourceUsage {
    const domNodes = this.shadowRoot?.querySelectorAll('*').length ?? 0;
    return { domNodes, memory: 0, renderTime: 0 };
  }

  private registerEventListeners(): void {
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
    this.setState({ loading: true, error: null });

    try {
      const [tools, resources, prompts] = await Promise.all([
        this.bridge.listTools(this.serverInfo.serverName),
        this.bridge.listResources(this.serverInfo.serverName).catch(() => []),
        this.bridge.listPrompts(this.serverInfo.serverName).catch(() => []),
      ]);
      this.setState({ tools, resources, prompts });

      await Promise.all([this.loadSchema(), this.loadMetrics()]);
      this.setState({ loading: false, lastUpdated: new Date() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Supabase overview';
      this.setState({ loading: false, error: message });
    }
  }

  private async loadSchema(): Promise<void> {
    const payload = await this.invokeTool('schema');
    if (!payload) {
      this.setState({ schema: { schemas: [], tables: [] } });
      return;
    }

    const schemas = Array.isArray(payload.schemas) ? payload.schemas.map(String) : ['public'];
    const tables = Array.isArray(payload.tables)
      ? payload.tables.map((table: any) => this.normalizeTable(table))
      : [];

    const selectedTable = tables.find(table => table.schema === this.state.filters.schema) ?? tables[0] ?? null;

    this.setState({
      schema: { schemas, tables },
      selectedTable,
    });

    if (selectedTable) {
      await this.loadTableData(selectedTable);
    }
  }

  private async loadTableData(table: SupabaseTableDefinition, limit = 50, offset = 0): Promise<void> {
    const resourceUri = `supabase://table/${table.schema}.${table.name}?limit=${limit}&offset=${offset}`;
    try {
      const resource = await this.bridge.readResource(this.serverInfo.serverName, resourceUri);
      const data = this.extractJSON(resource?.text ?? resource?.data ?? resource);
      if (Array.isArray(data?.rows)) {
        const enriched = { ...table, rows: data.rows } as SupabaseTableDefinition & { rows: any[] };
        this.setState({ selectedTable: enriched });
      }
    } catch (error) {
      console.warn('Failed to load table data', error);
    }
  }

  private async loadMetrics(): Promise<void> {
    const payload = await this.invokeTool('metrics');
    if (!payload) {
      return;
    }

    this.setState({
      metrics: {
        activeConnections: Number(payload.activeConnections ?? DEFAULT_METRICS.activeConnections),
        averageLatencyMs: Number(payload.averageLatencyMs ?? DEFAULT_METRICS.averageLatencyMs),
        throughputPerMinute: Number(payload.throughputPerMinute ?? DEFAULT_METRICS.throughputPerMinute),
        replicationLagMs: Number(payload.replicationLagMs ?? DEFAULT_METRICS.replicationLagMs),
      },
    });
  }

  private normalizeTable(entry: any): SupabaseTableDefinition {
    return {
      name: String(entry.name ?? entry.table_name ?? 'unknown'),
      schema: String(entry.schema ?? entry.table_schema ?? 'public'),
      rowCount: typeof entry.row_count === 'number' ? entry.row_count : undefined,
      sizeBytes: typeof entry.size_bytes === 'number' ? entry.size_bytes : undefined,
      columns: Array.isArray(entry.columns)
        ? entry.columns.map((column: any) => ({
            name: String(column.name ?? column.column_name ?? 'unknown'),
            dataType: String(column.data_type ?? column.type ?? 'text'),
            isNullable: column.is_nullable ?? column.nullable ?? true,
            defaultValue: column.default_value ?? column.default ?? undefined,
            isPrimaryKey: Boolean(column.is_primary_key ?? column.primary_key ?? false),
          }))
        : [],
      policies: Array.isArray(entry.policies)
        ? entry.policies.map((policy: any) => ({
            name: String(policy.name ?? 'policy'),
            action: (policy.action ?? 'select').toLowerCase(),
            definition: policy.definition ?? policy.policy ?? undefined,
            check: policy.check ?? undefined,
            enabled: policy.enabled ?? true,
          }))
        : [],
    };
  }

  private async invokeTool(namespace: keyof typeof TOOL_PREFERENCES): Promise<any> {
    for (const toolName of TOOL_PREFERENCES[namespace]) {
      const available = this.state.tools.some((tool: MCPTool) => tool.name === toolName);
      if (!available) {
        continue;
      }
      try {
        const result = await this.bridge.callTool(this.serverInfo.serverName, toolName, {
          schema: this.state.filters.schema,
        });
        return this.extractJSONPayload(result);
      } catch (error) {
        continue;
      }
    }

    return null;
  }

  private extractJSONPayload(result: any): any {
    if (!result) {
      return null;
    }

    if (Array.isArray(result.content)) {
      const json = result.content.find((item: any) => item.mimeType === 'application/json');
      if (json?.text) {
        return this.extractJSON(json.text);
      }

      const text = result.content.find((item: any) => item.text)?.text;
      if (text) {
        return this.extractJSON(text);
      }
    }

    return result;
  }

  private extractJSON(payload: any): any {
    if (!payload) {
      return null;
    }
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch (error) {
        return null;
      }
    }
    return payload;
  }

  private setState(partial: Partial<SupabaseState>): void {
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
    container.appendChild(this.renderNav());
    container.appendChild(this.renderBody());
  }

  private renderHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h2');
    title.textContent = 'Supabase Studio';
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = this.state.loading ? 'Syncing…' : 'Connected';
    header.appendChild(status);

    return header;
  }

  private renderNav(): HTMLElement {
    const nav = document.createElement('div');
    nav.className = 'nav';

    const tabs: Array<{ id: SupabaseView; label: string }> = [
      { id: 'schema', label: 'Schema' },
      { id: 'query', label: 'Query' },
      { id: 'realtime', label: 'Realtime' },
      { id: 'metrics', label: 'Metrics' },
      { id: 'overview', label: 'Overview' },
    ];

    tabs.forEach(tab => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = tab.label;
      button.className = 'nav-tab';
      if (this.state.view === tab.id) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => {
        this.setState({ view: tab.id });
        if (tab.id === 'realtime') {
          this.ensureRealtimeSubscription();
        }
      });
      nav.appendChild(button);
    });

    return nav;
  }

  private renderBody(): HTMLElement {
    const body = document.createElement('div');
    body.className = 'body';

    if (this.state.loading) {
      body.appendChild(this.createMessage('Loading Supabase metadata…', 'loading'));
      return body;
    }

    if (this.state.error) {
      body.appendChild(this.createMessage(this.state.error, 'error'));
      return body;
    }

    switch (this.state.view) {
      case 'schema':
        body.appendChild(this.renderSchemaView());
        break;
      case 'query':
        body.appendChild(this.renderQueryView());
        break;
      case 'realtime':
        body.appendChild(this.renderRealtimeView());
        break;
      case 'metrics':
        body.appendChild(this.renderMetricsView());
        break;
      case 'overview':
        body.appendChild(this.renderOverview());
        break;
      default:
        body.appendChild(this.renderSchemaView());
        break;
    }

    return body;
  }

  private renderSchemaView(): HTMLElement {
    const layout = document.createElement('div');
    layout.className = 'schema-layout';

    const sidebar = document.createElement('div');
    sidebar.className = 'schema-sidebar';

    const schemaSelect = document.createElement('select');
    this.state.schema.schemas.forEach(schema => {
      const option = document.createElement('option');
      option.value = schema;
      option.textContent = schema;
      schemaSelect.appendChild(option);
    });
    schemaSelect.value = this.state.filters.schema;
    schemaSelect.addEventListener('change', event => {
      const schema = (event.target as HTMLSelectElement).value;
      this.setState({ filters: { ...this.state.filters, schema } });
      const table = this.state.schema.tables.find(t => t.schema === schema) ?? null;
      this.setState({ selectedTable: table });
      if (table) {
        void this.loadTableData(table);
      }
    });
    sidebar.appendChild(schemaSelect);

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Filter tables…';
    searchInput.value = this.state.filters.search;
    searchInput.addEventListener('input', event => {
      const value = (event.target as HTMLInputElement).value;
      this.setState({ filters: { ...this.state.filters, search: value } });
    });
    sidebar.appendChild(searchInput);

    const tableList = document.createElement('ul');
    tableList.className = 'table-list';
    const filteredTables = this.state.schema.tables.filter(table => {
      const matchesSchema = table.schema === this.state.filters.schema;
      const matchesSearch = this.state.filters.search
        ? table.name.toLowerCase().includes(this.state.filters.search.toLowerCase())
        : true;
      return matchesSchema && matchesSearch;
    });
    filteredTables.forEach(table => {
      const item = document.createElement('li');
      item.textContent = table.name;
      if (this.state.selectedTable?.name === table.name) {
        item.classList.add('active');
      }
      item.addEventListener('click', () => {
        this.setState({ selectedTable: table });
        void this.loadTableData(table);
      });
      tableList.appendChild(item);
    });
    sidebar.appendChild(tableList);

    const detail = document.createElement('div');
    detail.className = 'schema-detail';

    if (!this.state.selectedTable) {
      detail.appendChild(this.createMessage('Select a table to inspect structure and policies.', 'empty'));
    } else {
      detail.appendChild(this.renderTableDetail());
    }

    layout.appendChild(sidebar);
    layout.appendChild(detail);
    return layout;
  }

  private renderTableDetail(): HTMLElement {
    const table = this.state.selectedTable!;
    const container = document.createElement('div');
    container.className = 'table-detail';

    const header = document.createElement('div');
    header.className = 'table-header';
    header.innerHTML = `<h3>${table.schema}.${table.name}</h3>`;
    container.appendChild(header);

    const structure = document.createElement('div');
    structure.className = 'table-structure';

    const columnTable = document.createElement('table');
    columnTable.className = 'data-table';
    columnTable.innerHTML = '<thead><tr><th>Column</th><th>Type</th><th>Nullable</th><th>Default</th></tr></thead>';
    const tbody = document.createElement('tbody');
    table.columns.forEach(column => {
      const row = document.createElement('tr');
      row.appendChild(this.createCell(column.name));
      row.appendChild(this.createCell(column.dataType));
      row.appendChild(this.createCell(column.isNullable ? 'YES' : 'NO'));
      row.appendChild(this.createCell(column.defaultValue ?? '—'));
      tbody.appendChild(row);
    });
    columnTable.appendChild(tbody);
    structure.appendChild(columnTable);
    container.appendChild(structure);

    if (Array.isArray(table.policies) && table.policies.length) {
      const policySection = document.createElement('div');
      policySection.className = 'policy-section';
      const title = document.createElement('h4');
      title.textContent = 'Row Level Security';
      policySection.appendChild(title);

      table.policies.forEach(policy => {
        const policyCard = document.createElement('div');
        policyCard.className = 'policy-card';
        policyCard.innerHTML = `<div class="policy-name">${policy.name} – ${policy.action.toUpperCase()}</div>`;
        if (policy.definition) {
          const def = document.createElement('code');
          def.textContent = policy.definition;
          policyCard.appendChild(def);
        }
        policySection.appendChild(policyCard);
      });

      container.appendChild(policySection);
    }

    if ((table as any).rows) {
      container.appendChild(this.renderTableRows((table as any).rows, table));
    }

    return container;
  }

  private renderTableRows(rows: Array<Record<string, unknown>>, table: SupabaseTableDefinition): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-rows';

    if (!rows.length) {
      wrapper.appendChild(this.createMessage('No data returned for this table.', 'empty'));
      return wrapper;
    }

    const columns = Object.keys(rows[0]);
    const tableEl = document.createElement('table');
    tableEl.className = 'data-table editable';

    const thead = document.createElement('thead');
    thead.innerHTML = `<tr>${columns.map(col => `<th>${col}</th>`).join('')}<th></th></tr>`;
    tableEl.appendChild(thead);

    const tbody = document.createElement('tbody');
    rows.forEach(rowData => {
      const row = document.createElement('tr');
      columns.forEach(column => {
        const cell = document.createElement('td');
        cell.contentEditable = 'true';
        cell.textContent = rowData[column] !== null && rowData[column] !== undefined ? String(rowData[column]) : '';
        cell.dataset.column = column;
        row.appendChild(cell);
      });

      const actionCell = document.createElement('td');
      const saveButton = document.createElement('button');
      saveButton.type = 'button';
      saveButton.textContent = 'Save';
      saveButton.className = 'save-button';
      saveButton.addEventListener('click', () => {
        const updatedRow: Record<string, unknown> = {};
        row.querySelectorAll('td[data-column]').forEach(cell => {
          const column = (cell as HTMLTableCellElement).dataset.column!;
          updatedRow[column] = (cell as HTMLTableCellElement).textContent ?? null;
        });
        void this.updateRow(table, updatedRow, rowData);
      });
      actionCell.appendChild(saveButton);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });
    tableEl.appendChild(tbody);

    wrapper.appendChild(tableEl);
    return wrapper;
  }

  private async updateRow(
    table: SupabaseTableDefinition,
    updatedRow: Record<string, unknown>,
    originalRow: Record<string, unknown>
  ): Promise<void> {
    try {
      const toolName = this.resolveToolName('updateRow');
      if (!toolName) {
        throw new Error('Update tool unavailable');
      }
      await this.bridge.callTool(this.serverInfo.serverName, toolName, {
        table: `${table.schema}.${table.name}`,
        values: updatedRow,
        primaryKey: table.columns.find(column => column.isPrimaryKey)?.name,
        original: originalRow,
      });
      await this.loadTableData(table);
    } catch (error) {
      console.warn('Failed to update row', error);
    }
  }

  private renderQueryView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'query-view';

    const editor = document.createElement('div');
    editor.className = 'sql-editor';

    const textarea = document.createElement('textarea');
    textarea.value = this.state.query.sql;
    textarea.addEventListener('input', event => {
      const value = (event.target as HTMLTextAreaElement).value;
      this.setState({ query: { ...this.state.query, sql: value } });
      this.updateSqlPreview(value);
    });
    editor.appendChild(textarea);

    const preview = document.createElement('pre');
    preview.className = 'sql-preview';
    preview.textContent = this.state.query.sql;
    editor.appendChild(preview);

    container.appendChild(editor);

    const actions = document.createElement('div');
    actions.className = 'query-actions';

    const runButton = document.createElement('button');
    runButton.type = 'button';
    runButton.textContent = this.state.query.executing ? 'Running…' : 'Run Query';
    runButton.disabled = this.state.query.executing || !this.state.query.sql.trim();
    runButton.addEventListener('click', () => {
      void this.executeQuery();
    });
    actions.appendChild(runButton);

    container.appendChild(actions);

    if (this.state.query.error) {
      container.appendChild(this.createMessage(this.state.query.error, 'error'));
    }

    if (this.state.query.lastResult) {
      container.appendChild(this.renderQueryResult(this.state.query.lastResult));
    }

    return container;
  }

  private updateSqlPreview(sql: string): void {
    const preview = this.shadowRoot?.querySelector('.sql-preview');
    if (!preview) {
      return;
    }
    preview.textContent = sql;
  }

  private async executeQuery(): Promise<void> {
    this.setState({ query: { ...this.state.query, executing: true, error: null } });

    try {
      const toolName = this.resolveToolName('executeSql');
      if (!toolName) {
        throw new Error('SQL execution tool not available');
      }
      const payload = await this.bridge.callTool(this.serverInfo.serverName, toolName, {
        sql: this.state.query.sql,
        parameters: this.state.query.parameters,
      });
      const result = this.extractJSONPayload(payload) as SupabaseQueryResult;
      this.setState({
        query: {
          ...this.state.query,
          executing: false,
          lastResult: result,
          lastExecutedAt: new Date(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Query failed';
      this.setState({ query: { ...this.state.query, executing: false, error: message } });
    }
  }

  private renderQueryResult(result: SupabaseQueryResult): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'query-result';

    const meta = document.createElement('div');
    meta.className = 'query-meta';
    meta.textContent = `${result.rowCount} rows • ${result.durationMs ?? '—'} ms`;
    wrapper.appendChild(meta);

    if (!result.rows || !result.rows.length) {
      wrapper.appendChild(this.createMessage('Query executed successfully with no rows returned.', 'empty'));
      return wrapper;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    const columns = result.columns ?? Object.keys(result.rows[0]);
    table.innerHTML = `<thead><tr>${columns.map(column => `<th>${column}</th>`).join('')}</tr></thead>`;
    const tbody = document.createElement('tbody');
    result.rows.forEach(row => {
      const tr = document.createElement('tr');
      columns.forEach(column => {
        tr.appendChild(this.createCell(
          row[column] !== undefined && row[column] !== null ? String(row[column]) : 'NULL'
        ));
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);

    return wrapper;
  }

  private renderRealtimeView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'realtime-view';

    const header = document.createElement('div');
    header.className = 'realtime-header';
    header.textContent = this.state.liveSubscriptionId
      ? `Subscribed to ${this.state.filters.schema}.*`
      : 'Realtime events (click subscribe)';
    container.appendChild(header);

    const actions = document.createElement('div');
    actions.className = 'realtime-actions';

    const subscribeButton = document.createElement('button');
    subscribeButton.type = 'button';
    subscribeButton.textContent = this.state.liveSubscriptionId ? 'Unsubscribe' : 'Subscribe';
    subscribeButton.addEventListener('click', () => {
      if (this.state.liveSubscriptionId) {
        this.unsubscribeRealtime();
        this.setState({ liveSubscriptionId: null, realtimeMessages: [] });
      } else {
        this.ensureRealtimeSubscription();
      }
    });
    actions.appendChild(subscribeButton);
    container.appendChild(actions);

    if (!this.state.realtimeMessages.length) {
      container.appendChild(this.createMessage('No realtime events yet. Trigger changes in Supabase to see live updates.', 'empty'));
      return container;
    }

    const list = document.createElement('ul');
    list.className = 'realtime-list';
    this.state.realtimeMessages
      .slice(-50)
      .reverse()
      .forEach(event => {
        const item = document.createElement('li');
        item.innerHTML = `<span class="realtime-type">${event.type}</span> <span class="realtime-table">${event.table}</span> <span class="realtime-time">${new Date(event.timestamp).toLocaleTimeString()}</span>`;
        const payload = document.createElement('pre');
        payload.textContent = JSON.stringify(event.payload, null, 2);
        item.appendChild(payload);
        list.appendChild(item);
      });
    container.appendChild(list);
    return container;
  }

  private renderMetricsView(): HTMLElement {
    const container = document.createElement('div');
    container.className = 'metrics-view';

    const grid = document.createElement('div');
    grid.className = 'metrics-grid';

    grid.appendChild(this.createMetricCard('Active Connections', String(this.state.metrics.activeConnections)));
    grid.appendChild(this.createMetricCard('Average Latency', `${this.state.metrics.averageLatencyMs} ms`));
    grid.appendChild(this.createMetricCard('Throughput', `${this.state.metrics.throughputPerMinute} ops/min`));
    grid.appendChild(this.createMetricCard('Replication Lag', `${this.state.metrics.replicationLagMs} ms`));

    container.appendChild(grid);
    return container;
  }

  private renderOverview(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'overview';

    const summary = document.createElement('div');
    summary.className = 'overview-summary';
    summary.innerHTML = `
      <p><strong>${this.state.schema.schemas.length}</strong> schemas with <strong>${this.state.schema.tables.length}</strong> tables.</p>
      <p>Use the tabs to inspect your database structure, run SQL queries, monitor realtime changes, and capture health metrics.</p>
    `;
    wrapper.appendChild(summary);

    return wrapper;
  }

  private createMetricCard(label: string, value: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'metric-card';
    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.textContent = label;
    const valueEl = document.createElement('span');
    valueEl.className = 'metric-value';
    valueEl.textContent = value;
    card.appendChild(labelEl);
    card.appendChild(valueEl);
    return card;
  }

  private renderRealtimeMessage(event: SupabaseRealtimeMessage): HTMLElement {
    const item = document.createElement('li');
    item.className = 'realtime-item';
    item.innerHTML = `<span class="realtime-type">${event.type}</span> <span class="realtime-table">${event.table}</span>`;
    const payload = document.createElement('pre');
    payload.textContent = JSON.stringify(event.payload, null, 2);
    item.appendChild(payload);
    return item;
  }

  private createCell(value: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  private createMessage(text: string, variant: 'loading' | 'error' | 'empty'): HTMLElement {
    const div = document.createElement('div');
    div.className = `message ${variant}`;
    div.textContent = text;
    return div;
  }

  private resolveToolName(namespace: keyof typeof TOOL_PREFERENCES): string | null {
    const candidates = TOOL_PREFERENCES[namespace];
    for (const toolName of candidates) {
      if (this.state.tools.some(tool => tool.name === toolName)) {
        return toolName;
      }
    }

    return candidates[0] ?? null;
  }

  private ensureRealtimeSubscription(): void {
    if (this.state.liveSubscriptionId) {
      return;
    }

    const resourceUri = `supabase://realtime/${this.state.filters.schema}.*`;
    try {
      this.realtimeUnsubscribe = this.bridge.subscribeToResource(
        this.serverInfo.serverName,
        resourceUri,
        message => {
          const payload = this.extractJSON(message);
          if (!payload) {
            return;
          }
          const event: SupabaseRealtimeMessage = {
            table: payload.table ?? payload.table_name ?? 'unknown',
            type: payload.type ?? payload.eventType ?? 'UPDATE',
            timestamp: new Date().toISOString(),
            payload,
          };
          this.setState({ realtimeMessages: [...this.state.realtimeMessages, event] });
        }
      );
      this.setState({ liveSubscriptionId: resourceUri });
    } catch (error) {
      console.warn('Realtime subscription failed', error);
      this.setState({ realtimeMessages: [], liveSubscriptionId: null });
    }
  }

  private unsubscribeRealtime(): void {
    if (this.realtimeUnsubscribe) {
      this.realtimeUnsubscribe();
      this.realtimeUnsubscribe = null;
    }
    this.setState({ liveSubscriptionId: null });
  }
}
