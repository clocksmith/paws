/**
 * Reploid Model Selector Widget
 *
 * Model registry and selection UI
 * Browse, search, and manage available LLM models
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockModelData: any;
if (USE_MOCK_DATA) {
  mockModelData = {
    models: [
      {
        id: 'gpt-4',
        name: 'GPT-4',
        provider: 'OpenAI',
        contextWindow: 8192,
        pricing: { input: 0.03, output: 0.06 },
        capabilities: ['chat', 'completion', 'vision'],
        status: 'available'
      },
      {
        id: 'claude-3-opus',
        name: 'Claude 3 Opus',
        provider: 'Anthropic',
        contextWindow: 200000,
        pricing: { input: 0.015, output: 0.075 },
        capabilities: ['chat', 'completion', 'analysis'],
        status: 'available'
      },
      {
        id: 'llama-3-70b',
        name: 'Llama 3 70B',
        provider: 'Meta',
        contextWindow: 8192,
        pricing: { input: 0.0, output: 0.0 },
        capabilities: ['chat', 'completion'],
        status: 'local'
      }
    ]
  };
}

export default function createModelSelectorWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class ModelSelectorWidget extends HTMLElement {
    private models: any[] = [];
    private filteredModels: any[] = [];
    private selectedModel: string | null = null;
    private searchTerm: string = '';
    private filterProvider: string = 'all';
    private sortBy: string = 'name';
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to model events
      const unsubRefresh = EventBus.on('reploid:models:refresh', () => {
        this.loadModels();
      });
      this.unsubscribers.push(unsubRefresh);

      const unsubUpdate = EventBus.on('reploid:models:updated', () => {
        this.loadModels();
      });
      this.unsubscribers.push(unsubUpdate);

      // Initial load
      this.loadModels();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadModels() {
      if (USE_MOCK_DATA) {
        this.models = mockModelData.models;
        this.applyFilters();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'list_models',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.models = data.models || [];
          this.applyFilters();
        }
      } catch (error) {
        console.error('Failed to load models:', error);
        this.showError('Failed to load models');
      }
    }

    private async getModelInfo(modelId: string) {
      if (USE_MOCK_DATA) {
        const model = this.models.find(m => m.id === modelId);
        if (model) {
          this.showModelDetails(model);
        }
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_model_info',
          { model_id: modelId }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const modelInfo = JSON.parse(result.content[0].text);
          this.showModelDetails(modelInfo);
        }
      } catch (error) {
        console.error('Failed to get model info:', error);
        this.showError('Failed to load model details');
      }
    }

    private async addModel() {
      const modelId = prompt('Model ID:');
      if (!modelId) return;

      const modelName = prompt('Model Name:');
      if (!modelName) return;

      const provider = prompt('Provider:');
      if (!provider) return;

      if (USE_MOCK_DATA) {
        this.models.push({
          id: modelId,
          name: modelName,
          provider: provider,
          contextWindow: 4096,
          pricing: { input: 0.01, output: 0.02 },
          capabilities: ['chat'],
          status: 'available'
        });
        this.showSuccess('Model added (mock mode)');
        this.applyFilters();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'add_model',
          {
            id: modelId,
            name: modelName,
            provider: provider
          }
        );

        this.showSuccess('Model added successfully');
        EventBus.emit('reploid:models:updated', {});
        await this.loadModels();
      } catch (error) {
        console.error('Failed to add model:', error);
        this.showError('Failed to add model');
      }
    }

    private async removeModel(modelId: string) {
      if (!confirm(`Remove model ${modelId}?`)) {
        return;
      }

      if (USE_MOCK_DATA) {
        this.models = this.models.filter(m => m.id !== modelId);
        this.showSuccess('Model removed (mock mode)');
        this.applyFilters();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'remove_model',
          { model_id: modelId }
        );

        this.showSuccess('Model removed');
        EventBus.emit('reploid:models:updated', {});
        await this.loadModels();
      } catch (error) {
        console.error('Failed to remove model:', error);
        this.showError('Failed to remove model');
      }
    }

    private applyFilters() {
      let filtered = [...this.models];

      // Apply provider filter
      if (this.filterProvider !== 'all') {
        filtered = filtered.filter(m => m.provider.toLowerCase() === this.filterProvider.toLowerCase());
      }

      // Apply search filter
      if (this.searchTerm) {
        const term = this.searchTerm.toLowerCase();
        filtered = filtered.filter(m =>
          m.id.toLowerCase().includes(term) ||
          m.name.toLowerCase().includes(term) ||
          m.provider.toLowerCase().includes(term)
        );
      }

      // Sort
      filtered.sort((a, b) => {
        if (this.sortBy === 'name') return a.name.localeCompare(b.name);
        if (this.sortBy === 'provider') return a.provider.localeCompare(b.provider);
        if (this.sortBy === 'context') return b.contextWindow - a.contextWindow;
        return 0;
      });

      this.filteredModels = filtered;
      this.render();
    }

    private selectModel(modelId: string) {
      this.selectedModel = modelId;
      this.getModelInfo(modelId);
      EventBus.emit('reploid:model:selected', { modelId });
      this.render();
    }

    private showModelDetails(model: any) {
      const modal = document.createElement('div');
      modal.className = 'model-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>${this.escapeHtml(model.name)}</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <div class="detail-row">
              <span class="label">ID:</span>
              <span class="value">${this.escapeHtml(model.id)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Provider:</span>
              <span class="value">${this.escapeHtml(model.provider)}</span>
            </div>
            <div class="detail-row">
              <span class="label">Context Window:</span>
              <span class="value">${this.formatNumber(model.contextWindow)} tokens</span>
            </div>
            <div class="detail-row">
              <span class="label">Pricing:</span>
              <span class="value">
                $${model.pricing.input}/1K input, $${model.pricing.output}/1K output
              </span>
            </div>
            <div class="detail-row">
              <span class="label">Capabilities:</span>
              <span class="value">${model.capabilities.join(', ')}</span>
            </div>
            <div class="detail-row">
              <span class="label">Status:</span>
              <span class="value status-${model.status}">${model.status}</span>
            </div>
          </div>
        </div>
      `;

      modal.querySelector('.modal-close')?.addEventListener('click', () => {
        modal.remove();
      });

      this.shadowRoot?.appendChild(modal);
    }

    private showError(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-error';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private showSuccess(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-success';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      const providers = ['all', ...new Set(this.models.map(m => m.provider))];

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="model-selector-widget">
          <div class="widget-header">
            <h3>🤖 Model Registry</h3>
            <div class="header-actions">
              <button class="btn-add">+ Add Model</button>
              <button class="btn-refresh">⟳</button>
            </div>
          </div>

          <div class="widget-toolbar">
            <input type="text" class="search-input" placeholder="🔍 Search models..." value="${this.searchTerm}">
            <select class="filter-provider">
              ${providers.map(p => `
                <option value="${p}" ${this.filterProvider === p ? 'selected' : ''}>
                  ${p === 'all' ? 'All Providers' : p}
                </option>
              `).join('')}
            </select>
            <select class="sort-by">
              <option value="name" ${this.sortBy === 'name' ? 'selected' : ''}>Sort: Name</option>
              <option value="provider" ${this.sortBy === 'provider' ? 'selected' : ''}>Sort: Provider</option>
              <option value="context" ${this.sortBy === 'context' ? 'selected' : ''}>Sort: Context</option>
            </select>
          </div>

          <div class="widget-content">
            ${this.filteredModels.length === 0 ? `
              <div class="empty-state">
                <div class="empty-icon">🤖</div>
                <div class="empty-text">
                  ${this.searchTerm || this.filterProvider !== 'all' ? 'No models match your filters' : 'No models available'}
                </div>
              </div>
            ` : `
              <div class="models-grid">
                ${this.filteredModels.map(m => this.renderModelCard(m)).join('')}
              </div>
            `}
          </div>

          <div class="widget-footer">
            <div class="footer-stats">
              ${this.filteredModels.length} of ${this.models.length} models
            </div>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private renderModelCard(model: any): string {
      const isSelected = this.selectedModel === model.id;
      const statusClass = `status-${model.status}`;

      return `
        <div class="model-card ${isSelected ? 'selected' : ''}" data-model-id="${model.id}">
          <div class="card-header">
            <div class="card-title">${this.escapeHtml(model.name)}</div>
            <div class="card-status ${statusClass}">${model.status}</div>
          </div>

          <div class="card-body">
            <div class="card-provider">
              <span class="provider-label">Provider:</span>
              <span class="provider-value">${this.escapeHtml(model.provider)}</span>
            </div>

            <div class="card-context">
              <span class="context-icon">📝</span>
              <span class="context-value">${this.formatNumber(model.contextWindow)}</span>
            </div>

            <div class="card-pricing">
              <span class="pricing-label">Pricing:</span>
              <span class="pricing-value">$${model.pricing.input}/$${model.pricing.output}</span>
            </div>

            <div class="card-capabilities">
              ${model.capabilities.slice(0, 3).map((cap: string) => `
                <span class="capability-tag">${cap}</span>
              `).join('')}
              ${model.capabilities.length > 3 ? `<span class="capability-tag">+${model.capabilities.length - 3}</span>` : ''}
            </div>
          </div>

          <div class="card-actions">
            <button class="btn-select" data-model-id="${model.id}">Select</button>
            <button class="btn-info" data-model-id="${model.id}">Info</button>
            <button class="btn-remove" data-model-id="${model.id}">Remove</button>
          </div>
        </div>
      `;
    }

    private attachEventListeners() {
      // Add button
      this.shadowRoot?.querySelector('.btn-add')?.addEventListener('click', () => {
        this.addModel();
      });

      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadModels();
      });

      // Search input
      this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', (e) => {
        this.searchTerm = (e.target as HTMLInputElement).value;
        this.applyFilters();
      });

      // Provider filter
      this.shadowRoot?.querySelector('.filter-provider')?.addEventListener('change', (e) => {
        this.filterProvider = (e.target as HTMLSelectElement).value;
        this.applyFilters();
      });

      // Sort dropdown
      this.shadowRoot?.querySelector('.sort-by')?.addEventListener('change', (e) => {
        this.sortBy = (e.target as HTMLSelectElement).value;
        this.applyFilters();
      });

      // Select buttons
      const selectBtns = this.shadowRoot?.querySelectorAll('.btn-select');
      selectBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modelId = (btn as HTMLElement).dataset.modelId;
          if (modelId) this.selectModel(modelId);
        });
      });

      // Info buttons
      const infoBtns = this.shadowRoot?.querySelectorAll('.btn-info');
      infoBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modelId = (btn as HTMLElement).dataset.modelId;
          if (modelId) this.getModelInfo(modelId);
        });
      });

      // Remove buttons
      const removeBtns = this.shadowRoot?.querySelectorAll('.btn-remove');
      removeBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const modelId = (btn as HTMLElement).dataset.modelId;
          if (modelId) this.removeModel(modelId);
        });
      });
    }

    private formatNumber(num: number): string {
      return num.toLocaleString();
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host {
          display: block;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .model-selector-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .widget-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .widget-header h3 {
          margin: 0;
          color: #569cd6;
          font-size: 16px;
          font-weight: bold;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .btn-add {
          padding: 6px 12px;
          background: rgba(86, 156, 214, 0.2);
          border: 1px solid rgba(86, 156, 214, 0.4);
          color: #569cd6;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          transition: all 0.2s;
        }

        .btn-add:hover {
          background: rgba(86, 156, 214, 0.3);
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(86, 156, 214, 0.2);
          border: 1px solid rgba(86, 156, 214, 0.4);
          color: #569cd6;
          cursor: pointer;
          font-size: 14px;
        }

        .widget-toolbar {
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
          display: flex;
          gap: 12px;
        }

        .search-input {
          flex: 1;
          padding: 6px 12px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #555;
          color: #e0e0e0;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .search-input:focus {
          outline: none;
          border-color: #569cd6;
        }

        .filter-provider, .sort-by {
          padding: 6px 12px;
          background: rgba(20, 20, 20, 0.8);
          border: 1px solid #555;
          color: #e0e0e0;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          cursor: pointer;
        }

        .widget-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 16px;
          color: #888;
        }

        .models-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 16px;
        }

        .model-card {
          background: rgba(30, 30, 30, 0.8);
          border: 2px solid #444;
          padding: 16px;
          transition: all 0.2s;
          cursor: pointer;
        }

        .model-card:hover {
          border-color: #569cd6;
          background: rgba(40, 40, 40, 0.8);
        }

        .model-card.selected {
          border-color: #569cd6;
          background: rgba(86, 156, 214, 0.1);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid #444;
        }

        .card-title {
          font-size: 14px;
          font-weight: bold;
          color: #569cd6;
        }

        .card-status {
          padding: 2px 8px;
          font-size: 10px;
          border-radius: 10px;
        }

        .status-available {
          background: rgba(78, 201, 176, 0.3);
          color: #4ec9b0;
        }

        .status-local {
          background: rgba(206, 145, 120, 0.3);
          color: #ce9178;
        }

        .status-unavailable {
          background: rgba(244, 71, 71, 0.3);
          color: #f44747;
        }

        .card-body {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-bottom: 12px;
        }

        .card-provider {
          font-size: 12px;
          color: #cccccc;
        }

        .provider-label {
          color: #888;
        }

        .card-context {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #9cdcfe;
        }

        .card-pricing {
          font-size: 11px;
          color: #888;
        }

        .pricing-value {
          color: #dcdcaa;
        }

        .card-capabilities {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .capability-tag {
          padding: 2px 6px;
          background: rgba(156, 220, 254, 0.2);
          border: 1px solid rgba(156, 220, 254, 0.4);
          color: #9cdcfe;
          font-size: 9px;
          text-transform: uppercase;
        }

        .card-actions {
          display: flex;
          gap: 6px;
        }

        .card-actions button {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 10px;
          transition: all 0.2s;
        }

        .btn-select {
          background: rgba(78, 201, 176, 0.2);
          border-color: rgba(78, 201, 176, 0.4);
          color: #4ec9b0;
        }

        .btn-select:hover {
          background: rgba(78, 201, 176, 0.3);
        }

        .btn-info {
          background: rgba(86, 156, 214, 0.2);
          border-color: rgba(86, 156, 214, 0.4);
          color: #569cd6;
        }

        .btn-info:hover {
          background: rgba(86, 156, 214, 0.3);
        }

        .btn-remove {
          background: rgba(244, 71, 71, 0.2);
          border-color: rgba(244, 71, 71, 0.4);
          color: #f44747;
        }

        .btn-remove:hover {
          background: rgba(244, 71, 71, 0.3);
        }

        .widget-footer {
          padding: 12px 16px;
          background: rgba(20, 20, 20, 0.8);
          border-top: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .footer-stats {
          font-size: 11px;
          color: #888;
        }

        .model-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .modal-content {
          background: #1e1e1e;
          border: 2px solid #444;
          width: 500px;
          max-width: 90%;
        }

        .modal-header {
          padding: 16px;
          background: #252526;
          border-bottom: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .modal-header h3 {
          margin: 0;
          color: #569cd6;
        }

        .modal-close {
          background: none;
          border: none;
          color: #888;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 30px;
          height: 30px;
        }

        .modal-close:hover {
          color: #fff;
        }

        .modal-body {
          padding: 16px;
        }

        .detail-row {
          padding: 8px 0;
          border-bottom: 1px solid #333;
          display: flex;
          justify-content: space-between;
        }

        .detail-row:last-child {
          border-bottom: none;
        }

        .detail-row .label {
          font-size: 11px;
          color: #888;
          font-weight: bold;
        }

        .detail-row .value {
          font-size: 12px;
          color: #e0e0e0;
        }

        .toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10000;
        }

        .toast-error {
          background: #f44747;
          color: white;
        }

        .toast-success {
          background: #4ec9b0;
          color: #000;
        }
      `;
    }
  }

  // Register custom element
  if (!customElements.get('reploid-model-selector')) {
    customElements.define('reploid-model-selector', ModelSelectorWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[ModelSelectorWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-model-selector',
          displayName: 'Model Registry'
        });
      },
      async destroy() {
        console.log('[ModelSelectorWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-model-selector',
          displayName: 'Model Registry'
        });
      },
      async refresh() {
        console.log('[ModelSelectorWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-model-selector',
          displayName: 'Model Registry'
        });
        EventBus.emit('reploid:models:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-model-selector',
      displayName: 'Model Registry',
      description: 'Browse, search, and manage available LLM models',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['list_models', 'get_model_info', 'add_model', 'remove_model', 'get_pricing']
      },
      category: 'models',
      tags: ['reploid', 'models', 'registry', 'selector', 'llm']
    }
  };
}
