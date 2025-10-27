import type {
  Configuration,
  EventBus,
  MCPBridge,
  MCPServerInfo,
  ResourceUsage,
  UnsubscribeFunction,
  WidgetStatus,
} from '@mwp/core';
import { styles } from './styles.js';
import type {
  StripeDashboardMetrics,
  StripeFilters,
  StripePayment,
  StripeSegment,
  StripeState,
  StripeSubscription,
  StripeWebhookEvent,
} from './types.js';

const DEFAULT_METRICS: StripeDashboardMetrics = {
  totalMRR: 0,
  activeSubscriptions: 0,
  churnRate: 0,
  paymentSuccessRate: 0,
};

const DEFAULT_FILTERS: StripeFilters = {
  customerSearch: '',
  paymentStatus: 'all',
  subscriptionStatus: 'all',
};

const TOOL_MAPPINGS = {
  payments: ['list_payments', 'payments_list', 'list_stripe_payments'],
  customers: ['list_customers', 'customers_list', 'list_stripe_customers'],
  subscriptions: ['list_subscriptions', 'subscriptions_list'],
  invoices: ['list_invoices', 'invoices_list'],
  webhooks: ['list_webhook_events', 'webhooks_list'],
  metrics: ['dashboard_metrics', 'stripe_metrics'],
};

export class StripeWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private serverInfo!: MCPServerInfo;

  private state: StripeState = {
    loading: true,
    error: null,
    tools: [],
    resources: [],
    prompts: [],
    segment: 'payments',
    payments: [],
    invoices: [],
    customers: [],
    subscriptions: [],
    webhookEvents: [],
    metrics: DEFAULT_METRICS,
    filters: DEFAULT_FILTERS,
    selectedPayment: null,
    selectedCustomer: null,
    selectedSubscription: null,
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
        message: 'Synchronising Stripe account…',
      };
    }

    if (this.state.error) {
      return {
        status: 'error',
        message: this.state.error,
        error: {
          code: 'STRIPE_WIDGET_ERROR',
          message: this.state.error,
        },
      };
    }

    return {
      status: 'healthy',
      message: `Stripe data loaded (${this.state.payments.length} payments)` ,
      lastUpdate: this.state.lastUpdated,
      details: {
        subscriptions: this.state.subscriptions.length,
        customers: this.state.customers.length,
        webhooks: this.state.webhookEvents.length,
      },
    };
  }

  getResourceUsage(): ResourceUsage {
    const domNodes = this.shadowRoot?.querySelectorAll('*').length ?? 0;
    return {
      domNodes,
      memory: 0,
      renderTime: 0,
    };
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

      this.setState({ tools, resources, prompts, lastUpdated: new Date() });
      await this.loadStripeData();
      this.setState({ loading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Stripe metadata';
      this.setState({ loading: false, error: message });
    }
  }

  private async loadStripeData(): Promise<void> {
    const [payments, customers, subscriptions, invoices, webhooks, metrics] = await Promise.all([
      this.invokeStripeTool('payments'),
      this.invokeStripeTool('customers'),
      this.invokeStripeTool('subscriptions'),
      this.invokeStripeTool('invoices'),
      this.invokeStripeTool('webhooks'),
      this.invokeStripeTool('metrics'),
    ]);

    this.setState({
      payments: this.normalizePayments(payments),
      customers: this.normalizeCustomers(customers),
      subscriptions: this.normalizeSubscriptions(subscriptions),
      invoices: this.normalizeInvoices(invoices),
      webhookEvents: this.normalizeWebhooks(webhooks),
      metrics: this.normalizeMetrics(metrics),
      selectedPayment: null,
      selectedCustomer: null,
      selectedSubscription: null,
    });
  }

  private async invokeStripeTool(category: keyof typeof TOOL_MAPPINGS): Promise<any> {
    const candidates = TOOL_MAPPINGS[category];

    for (const toolName of candidates) {
      const toolAvailable = this.state.tools.some(tool => tool.name === toolName);
      if (!toolAvailable) {
        continue;
      }
      try {
        const result = await this.bridge.callTool(this.serverInfo.serverName, toolName, {});
        const payload = this.extractJSONPayload(result);
        if (payload) {
          return payload;
        }
      } catch (error) {
        // Try next tool name if method not found or fails
        continue;
      }
    }

    return null;
  }

  private extractJSONPayload(payload: any): any {
    if (!payload) {
      return null;
    }

    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload.content)) {
      const jsonEntry = payload.content.find((item: any) => item.mimeType === 'application/json');
      if (jsonEntry?.text) {
        try {
          return JSON.parse(jsonEntry.text);
        } catch (error) {
          return null;
        }
      }
      const textEntry = payload.content.find((item: any) => item.text);
      if (textEntry?.text) {
        try {
          return JSON.parse(textEntry.text);
        } catch (error) {
          return null;
        }
      }
    }

    return payload;
  }

  private setState(partial: Partial<StripeState>): void {
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
    container.appendChild(this.renderMetrics());
    container.appendChild(this.renderSegments());
    container.appendChild(this.renderSegmentContent());
  }

  private renderHeader(): HTMLElement {
    const header = document.createElement('div');
    header.className = 'header';

    const title = document.createElement('h2');
    title.textContent = 'Stripe Control Center';
    header.appendChild(title);

    const status = document.createElement('span');
    status.className = 'status';
    status.textContent = this.state.loading ? 'Syncing…' : 'Live';
    header.appendChild(status);

    return header;
  }

  private renderMetrics(): HTMLElement {
    const grid = document.createElement('div');
    grid.className = 'metrics-grid';

    grid.appendChild(this.createMetricTile('Total MRR', this.formatCurrency(this.state.metrics.totalMRR)));
    grid.appendChild(this.createMetricTile('Active Subscriptions', this.state.metrics.activeSubscriptions.toString()));
    grid.appendChild(this.createMetricTile('Churn Rate', `${(this.state.metrics.churnRate * 100).toFixed(2)}%`));
    grid.appendChild(this.createMetricTile('Payment Success', `${(this.state.metrics.paymentSuccessRate * 100).toFixed(2)}%`));

    return grid;
  }

  private createMetricTile(label: string, value: string): HTMLElement {
    const tile = document.createElement('div');
    tile.className = 'metric-tile';

    const labelEl = document.createElement('span');
    labelEl.className = 'metric-label';
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'metric-value';
    valueEl.textContent = value;

    tile.appendChild(labelEl);
    tile.appendChild(valueEl);
    return tile;
  }

  private renderSegments(): HTMLElement {
    const segments = document.createElement('div');
    segments.className = 'segments';

    const definitions: Array<{ id: StripeSegment; title: string; description: string }> = [
      { id: 'payments', title: 'Payments', description: `${this.state.payments.length} transactions` },
      { id: 'billing', title: 'Invoices', description: `${this.state.invoices.length} open invoices` },
      { id: 'customers', title: 'Customers', description: `${this.state.customers.length} profiles` },
      { id: 'products', title: 'Subscriptions', description: `${this.state.subscriptions.length} active plans` },
      { id: 'webhooks', title: 'Webhooks', description: `${this.state.webhookEvents.length} events` },
    ];

    definitions.forEach(def => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'segment-card';
      if (this.state.segment === def.id) {
        button.classList.add('active');
      }
      button.addEventListener('click', () => {
        this.setState({ segment: def.id });
      });

      const title = document.createElement('span');
      title.className = 'segment-title';
      title.textContent = def.title;
      button.appendChild(title);

      const description = document.createElement('span');
      description.className = 'segment-description';
      description.textContent = def.description;
      button.appendChild(description);

      segments.appendChild(button);
    });

    return segments;
  }

  private renderSegmentContent(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'segment-panel';

    if (this.state.loading) {
      const loading = document.createElement('div');
      loading.className = 'loading';
      loading.textContent = 'Loading Stripe data…';
      panel.appendChild(loading);
      return panel;
    }

    if (this.state.error) {
      const error = document.createElement('div');
      error.className = 'error';
      error.textContent = this.state.error;
      panel.appendChild(error);
      return panel;
    }

    switch (this.state.segment) {
      case 'payments':
        panel.appendChild(this.renderPaymentsView());
        break;
      case 'billing':
        panel.appendChild(this.renderBillingView());
        break;
      case 'customers':
        panel.appendChild(this.renderCustomersView());
        break;
      case 'products':
        panel.appendChild(this.renderSubscriptionsView());
        break;
      case 'webhooks':
        panel.appendChild(this.renderWebhooksView());
        break;
      default:
        panel.appendChild(this.renderPaymentsView());
        break;
    }

    return panel;
  }

  private renderPaymentsView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'payments-view';

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const statusSelect = document.createElement('select');
    statusSelect.value = this.state.filters.paymentStatus;
    ['all', 'succeeded', 'pending', 'failed', 'refunded'].forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', event => {
      const value = (event.target as HTMLSelectElement).value;
      this.setState({ filters: { ...this.state.filters, paymentStatus: value } });
    });
    toolbar.appendChild(statusSelect);

    wrapper.appendChild(toolbar);

    const layout = document.createElement('div');
    layout.className = 'split-layout';

    const list = document.createElement('div');
    list.className = 'split-left';

    const filteredPayments = this.state.payments.filter(payment => {
      if (this.state.filters.paymentStatus === 'all') {
        return true;
      }
      return payment.status === this.state.filters.paymentStatus;
    });

    if (!filteredPayments.length) {
      list.appendChild(this.createEmptyState('No payments match the current filters.'));
    } else {
      const table = document.createElement('table');
      table.className = 'data-table';

      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>ID</th><th>Amount</th><th>Status</th><th>Customer</th><th>Created</th></tr>';
      table.appendChild(thead);

      const tbody = document.createElement('tbody');
      filteredPayments.forEach(payment => {
        const row = document.createElement('tr');
        if (this.state.selectedPayment?.id === payment.id) {
          row.classList.add('selected');
        }
        row.addEventListener('click', () => {
          this.setState({ selectedPayment: payment });
        });

        row.appendChild(this.createCell(payment.id));
        row.appendChild(this.createCell(this.formatCurrency(payment.amount, payment.currency)));
        row.appendChild(this.createStatusCell(payment.status));
        row.appendChild(this.createCell(payment.customerId ?? '—'));
        row.appendChild(this.createCell(new Date(payment.createdAt).toLocaleString()));

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      list.appendChild(table);
    }

    const detail = document.createElement('div');
    detail.className = 'split-right';

    if (!this.state.selectedPayment) {
      detail.appendChild(this.createEmptyState('Select a payment to inspect the flow timeline.'));
    } else {
      detail.appendChild(this.renderPaymentDetail(this.state.selectedPayment));
    }

    layout.appendChild(list);
    layout.appendChild(detail);
    wrapper.appendChild(layout);

    return wrapper;
  }

  private renderPaymentDetail(payment: StripePayment): HTMLElement {
    const card = document.createElement('div');
    card.className = 'detail-card';

    const title = document.createElement('h3');
    title.textContent = `Payment ${payment.id}`;
    card.appendChild(title);

    const meta = document.createElement('ul');
    meta.className = 'meta-list';
    meta.appendChild(this.createMetaItem('Amount', this.formatCurrency(payment.amount, payment.currency)));
    meta.appendChild(this.createMetaItem('Status', payment.status));
    if (payment.methodType) {
      meta.appendChild(this.createMetaItem('Method', payment.methodType));
    }
    if (payment.description) {
      meta.appendChild(this.createMetaItem('Description', payment.description));
    }
    if (payment.customerId) {
      meta.appendChild(this.createMetaItem('Customer', payment.customerId));
    }
    card.appendChild(meta);

    const timeline = document.createElement('div');
    timeline.className = 'timeline';
    timeline.appendChild(this.renderTimeline(payment));
    card.appendChild(timeline);

    return card;
  }

  private renderTimeline(payment: StripePayment): HTMLElement {
    const stages = payment.stages?.length ? payment.stages : this.deriveDefaultStages(payment);

    const list = document.createElement('ol');
    list.className = 'timeline-list';

    stages.forEach(stage => {
      const item = document.createElement('li');
      item.className = `timeline-item ${stage.status}`;

      const badge = document.createElement('span');
      badge.className = 'timeline-badge';
      badge.textContent = stage.label;
      item.appendChild(badge);

      if (stage.timestamp) {
        const time = document.createElement('span');
        time.className = 'timeline-time';
        time.textContent = new Date(stage.timestamp).toLocaleString();
        item.appendChild(time);
      }

      if (stage.details) {
        const details = document.createElement('div');
        details.className = 'timeline-details';
        details.textContent = stage.details;
        item.appendChild(details);
      }

      list.appendChild(item);
    });

    return list;
  }

  private deriveDefaultStages(payment: StripePayment): StripePayment['stages'] {
    const createdStage = {
      label: 'Created',
      timestamp: payment.createdAt,
      status: 'succeeded' as const,
    };

    const statusStage = {
      label: payment.status.charAt(0).toUpperCase() + payment.status.slice(1),
      status: (payment.status === 'succeeded' ? 'succeeded' : payment.status === 'failed' ? 'failed' : 'pending') as StripePayment['stages'][number]['status'],
      details: payment.description,
    };

    return [createdStage, statusStage];
  }

  private renderBillingView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'billing-view';

    if (!this.state.invoices.length) {
      wrapper.appendChild(this.createEmptyState('No invoices retrieved from Stripe.'));
      return wrapper;
    }

    const table = document.createElement('table');
    table.className = 'data-table';
    table.innerHTML = '<thead><tr><th>ID</th><th>Status</th><th>Amount Due</th><th>Amount Paid</th><th>Due Date</th></tr></thead>';

    const tbody = document.createElement('tbody');
    this.state.invoices.forEach(invoice => {
      const row = document.createElement('tr');
      row.appendChild(this.createCell(invoice.id));
      row.appendChild(this.createStatusCell(invoice.status));
      row.appendChild(this.createCell(this.formatCurrency(invoice.amountDue, invoice.currency)));
      row.appendChild(this.createCell(this.formatCurrency(invoice.amountPaid, invoice.currency)));
      row.appendChild(this.createCell(invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : '—'));
      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);
    return wrapper;
  }

  private renderCustomersView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'customers-view';

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search customers by name or email…';
    searchInput.value = this.state.filters.customerSearch;
    searchInput.addEventListener('input', event => {
      const value = (event.target as HTMLInputElement).value;
      this.setState({ filters: { ...this.state.filters, customerSearch: value } });
    });
    toolbar.appendChild(searchInput);
    wrapper.appendChild(toolbar);

    const layout = document.createElement('div');
    layout.className = 'split-layout';

    const list = document.createElement('div');
    list.className = 'split-left';

    const filtered = this.state.customers.filter(customer => {
      if (!this.state.filters.customerSearch.trim()) {
        return true;
      }
      const query = this.state.filters.customerSearch.toLowerCase();
      return (
        customer.name?.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.id.toLowerCase().includes(query)
      );
    });

    if (!filtered.length) {
      list.appendChild(this.createEmptyState('No customers match the current search criteria.'));
    } else {
      const table = document.createElement('table');
      table.className = 'data-table';
      table.innerHTML = '<thead><tr><th>Name</th><th>Email</th><th>MRR</th><th>Subs</th><th>Created</th></tr></thead>';

      const tbody = document.createElement('tbody');
      filtered.forEach(customer => {
        const row = document.createElement('tr');
        if (this.state.selectedCustomer?.id === customer.id) {
          row.classList.add('selected');
        }
        row.addEventListener('click', () => {
          const relatedSubscription = this.state.subscriptions.find(sub => sub.customerId === customer.id) ?? null;
          this.setState({ selectedCustomer: customer, selectedSubscription: relatedSubscription });
        });

        row.appendChild(this.createCell(customer.name ?? customer.id));
        row.appendChild(this.createCell(customer.email ?? '—'));
        row.appendChild(this.createCell(customer.mrr ? this.formatCurrency(customer.mrr) : '—'));
        row.appendChild(this.createCell(customer.subscriptionCount?.toString() ?? '0'));
        row.appendChild(this.createCell(new Date(customer.createdAt).toLocaleDateString()));

        tbody.appendChild(row);
      });

      table.appendChild(tbody);
      list.appendChild(table);
    }

    const detail = document.createElement('div');
    detail.className = 'split-right';

    if (!this.state.selectedCustomer) {
      detail.appendChild(this.createEmptyState('Select a customer to view details, subscriptions, and history.'));
    } else {
      detail.appendChild(this.renderCustomerDetail());
    }

    layout.appendChild(list);
    layout.appendChild(detail);
    wrapper.appendChild(layout);

    return wrapper;
  }

  private renderCustomerDetail(): HTMLElement {
    const customer = this.state.selectedCustomer!;
    const card = document.createElement('div');
    card.className = 'detail-card';

    const title = document.createElement('h3');
    title.textContent = customer.name ?? customer.id;
    card.appendChild(title);

    const meta = document.createElement('ul');
    meta.className = 'meta-list';
    meta.appendChild(this.createMetaItem('Email', customer.email ?? '—'));
    meta.appendChild(this.createMetaItem('Country', customer.country ?? '—'));
    meta.appendChild(this.createMetaItem('MRR', customer.mrr ? this.formatCurrency(customer.mrr) : '—'));
    meta.appendChild(this.createMetaItem('Subscriptions', customer.subscriptionCount?.toString() ?? '0'));
    meta.appendChild(this.createMetaItem('Created', new Date(customer.createdAt).toLocaleString()));
    card.appendChild(meta);

    if (this.state.selectedSubscription) {
      const subscriptionSection = document.createElement('div');
      subscriptionSection.className = 'detail-section';

      const heading = document.createElement('h4');
      heading.textContent = 'Active Subscription';
      subscriptionSection.appendChild(heading);

      subscriptionSection.appendChild(this.renderSubscriptionCard(this.state.selectedSubscription));
      card.appendChild(subscriptionSection);
    }

    return card;
  }

  private renderSubscriptionsView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'subscriptions-view';

    const toolbar = document.createElement('div');
    toolbar.className = 'toolbar';

    const statusSelect = document.createElement('select');
    statusSelect.value = this.state.filters.subscriptionStatus;
    ['all', 'active', 'trialing', 'past_due', 'canceled'].forEach(status => {
      const option = document.createElement('option');
      option.value = status;
      option.textContent = status.replace('_', ' ').toUpperCase();
      statusSelect.appendChild(option);
    });
    statusSelect.addEventListener('change', event => {
      const value = (event.target as HTMLSelectElement).value;
      this.setState({ filters: { ...this.state.filters, subscriptionStatus: value } });
    });
    toolbar.appendChild(statusSelect);
    wrapper.appendChild(toolbar);

    const cards = document.createElement('div');
    cards.className = 'subscription-cards';

    const filtered = this.state.subscriptions.filter(subscription => {
      if (this.state.filters.subscriptionStatus === 'all') {
        return true;
      }
      return subscription.status === this.state.filters.subscriptionStatus;
    });

    if (!filtered.length) {
      cards.appendChild(this.createEmptyState('No subscriptions for the selected status.'));
    } else {
      filtered.forEach(subscription => {
        cards.appendChild(this.renderSubscriptionCard(subscription));
      });
    }

    wrapper.appendChild(cards);
    return wrapper;
  }

  private renderSubscriptionCard(subscription: StripeSubscription): HTMLElement {
    const card = document.createElement('div');
    card.className = 'subscription-card';

    const header = document.createElement('div');
    header.className = 'subscription-header';
    header.textContent = subscription.planName ?? subscription.id;
    card.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'meta-list';
    list.appendChild(this.createMetaItem('Status', subscription.status));
    if (subscription.currentPeriodEnd) {
      list.appendChild(
        this.createMetaItem('Renews', new Date(subscription.currentPeriodEnd).toLocaleDateString())
      );
    }
    if (subscription.cancelAtPeriodEnd) {
      list.appendChild(this.createMetaItem('Cancellation', 'Scheduled'));
    }
    if (subscription.usage) {
      list.appendChild(
        this.createMetaItem(
          'Usage',
          subscription.usage.usage !== undefined
            ? `${subscription.usage.usage}/${subscription.usage.quantity ?? '∞'}`
            : 'Metered'
        )
      );
    }

    card.appendChild(list);
    return card;
  }

  private renderWebhooksView(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'webhooks-view';

    if (!this.state.webhookEvents.length) {
      wrapper.appendChild(this.createEmptyState('No webhook events captured.')); 
      return wrapper;
    }

    const list = document.createElement('ul');
    list.className = 'webhook-list';

    const latestEvents = this.state.webhookEvents
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);

    latestEvents.forEach(event => {
      const item = document.createElement('li');
      item.className = `webhook-item ${event.status ?? 'pending'}`;

      const header = document.createElement('div');
      header.className = 'webhook-header';
      header.textContent = event.type;
      item.appendChild(header);

      const meta = document.createElement('div');
      meta.className = 'webhook-meta';
      meta.textContent = `${new Date(event.createdAt).toLocaleString()} • ${event.requestId ?? 'no request id'}`;
      item.appendChild(meta);

      if (event.payloadPreview) {
        const preview = document.createElement('pre');
        preview.className = 'webhook-preview';
        preview.textContent = event.payloadPreview;
        item.appendChild(preview);
      }

      list.appendChild(item);
    });

    wrapper.appendChild(list);
    return wrapper;
  }

  private createEmptyState(message: string): HTMLElement {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = message;
    return div;
  }

  private createCell(value: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.textContent = value;
    return cell;
  }

  private createStatusCell(value: string): HTMLTableCellElement {
    const cell = document.createElement('td');
    cell.className = `status-pill status-${value}`;
    cell.textContent = value;
    return cell;
  }

  private createMetaItem(label: string, value: string): HTMLLIElement {
    const item = document.createElement('li');

    const labelSpan = document.createElement('span');
    labelSpan.className = 'meta-label';
    labelSpan.textContent = label;
    item.appendChild(labelSpan);

    const valueSpan = document.createElement('span');
    valueSpan.className = 'meta-value';
    valueSpan.textContent = value;
    item.appendChild(valueSpan);

    return item;
  }

  private formatCurrency(amount: number, currency = 'usd'): string {
    if (amount === undefined || amount === null || Number.isNaN(amount)) {
      return '—';
    }
    const normalized = Math.abs(amount) > 1000 ? amount / 100 : amount;

    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: currency.toUpperCase(),
      currencyDisplay: 'narrowSymbol',
    }).format(normalized);
  }

  private ensureArray<T>(input: any): T[] {
    if (Array.isArray(input)) {
      return input as T[];
    }
    if (!input) {
      return [];
    }
    if (Array.isArray(input?.data)) {
      return input.data as T[];
    }
    if (typeof input === 'object') {
      return Object.values(input) as T[];
    }
    return [];
  }

  private normalizePayments(raw: any): StripePayment[] {
    const entries = this.ensureArray<any>(raw?.payments ?? raw);
    return entries.map(entry => ({
      id: String(entry.id ?? entry.payment_intent ?? this.generateId('pay')),
      amount: Number(entry.amount ?? entry.amount_captured ?? entry.amount_received ?? 0),
      currency: String(entry.currency ?? 'usd'),
      createdAt: new Date(entry.created ? entry.created * 1000 : Date.now()).toISOString(),
      customerId: entry.customer ? String(entry.customer) : undefined,
      description: entry.description ? String(entry.description) : undefined,
      status: String(entry.status ?? 'unknown'),
      methodType: entry.payment_method_types?.[0] ?? entry.payment_method_details?.type,
      stages: Array.isArray(entry.timeline)
        ? entry.timeline.map((stage: any) => ({
            label: String(stage.label ?? stage.type ?? 'Stage'),
            status: String(stage.status ?? stage.result ?? 'pending') as StripePayment['stages'][number]['status'],
            timestamp: stage.timestamp
              ? new Date(stage.timestamp * 1000).toISOString()
              : undefined,
            details: stage.details ? String(stage.details) : undefined,
          }))
        : undefined,
    }));
  }

  private normalizeCustomers(raw: any) {
    const entries = this.ensureArray<any>(raw?.customers ?? raw);
    return entries.map(entry => ({
      id: String(entry.id ?? this.generateId('cus')),
      name: entry.name ? String(entry.name) : undefined,
      email: entry.email ? String(entry.email) : undefined,
      createdAt: new Date(entry.created ? entry.created * 1000 : Date.now()).toISOString(),
      country: entry.address?.country ?? entry.country ?? undefined,
      mrr: typeof entry.mrr === 'number' ? entry.mrr : undefined,
      subscriptionCount: entry.subscription_count ?? entry.subscriptions?.total_count ?? undefined,
      delinquent: Boolean(entry.delinquent),
    }));
  }

  private normalizeSubscriptions(raw: any) {
    const entries = this.ensureArray<any>(raw?.subscriptions ?? raw);
    return entries.map(entry => ({
      id: String(entry.id ?? this.generateId('sub')),
      customerId: String(entry.customer ?? 'unknown'),
      planName: entry.plan?.nickname ?? entry.plan?.id ?? undefined,
      status: String(entry.status ?? 'unknown'),
      currentPeriodEnd: entry.current_period_end
        ? new Date(entry.current_period_end * 1000).toISOString()
        : undefined,
      cancelAtPeriodEnd: Boolean(entry.cancel_at_period_end),
      usage: entry.items?.data?.[0]?.usage_record_summary
        ? {
            periodStart: new Date(entry.items.data[0].usage_record_summary.period.start * 1000).toISOString(),
            periodEnd: new Date(entry.items.data[0].usage_record_summary.period.end * 1000).toISOString(),
            usage: entry.items.data[0].usage_record_summary.total_usage,
            quantity: entry.quantity,
          }
        : undefined,
      renewalDate: entry.cancel_at ? new Date(entry.cancel_at * 1000).toISOString() : undefined,
    }));
  }

  private normalizeInvoices(raw: any) {
    const entries = this.ensureArray<any>(raw?.invoices ?? raw);
    return entries.map(entry => ({
      id: String(entry.id ?? this.generateId('inv')),
      status: String(entry.status ?? 'unknown'),
      amountDue: Number(entry.amount_due ?? 0),
      amountPaid: Number(entry.amount_paid ?? 0),
      currency: String(entry.currency ?? 'usd'),
      customerId: String(entry.customer ?? 'unknown'),
      createdAt: new Date(entry.created ? entry.created * 1000 : Date.now()).toISOString(),
      dueDate: entry.due_date ? new Date(entry.due_date * 1000).toISOString() : undefined,
    }));
  }

  private normalizeWebhooks(raw: any): StripeWebhookEvent[] {
    const entries = this.ensureArray<any>(raw?.events ?? raw);
    return entries.map(entry => ({
      id: String(entry.id ?? this.generateId('wh')),
      type: String(entry.type ?? 'unknown'),
      createdAt: new Date(entry.created ? entry.created * 1000 : Date.now()).toISOString(),
      requestId: entry.request?.id ?? entry.request ?? undefined,
      status: entry.delivery_status ?? entry.status ?? 'pending',
      payloadPreview: typeof entry.summary === 'string' ? entry.summary : entry.payload_preview ?? undefined,
    }));
  }

  private normalizeMetrics(raw: any): StripeDashboardMetrics {
    return {
      totalMRR: Number(raw?.totalMRR ?? DEFAULT_METRICS.totalMRR),
      activeSubscriptions: Number(raw?.activeSubscriptions ?? DEFAULT_METRICS.activeSubscriptions),
      churnRate: Number(raw?.churnRate ?? DEFAULT_METRICS.churnRate),
      paymentSuccessRate: Number(raw?.paymentSuccessRate ?? DEFAULT_METRICS.paymentSuccessRate),
    };
  }

  private generateId(prefix: string): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return `${prefix}_${crypto.randomUUID()}`;
    }
    return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
  }
}
