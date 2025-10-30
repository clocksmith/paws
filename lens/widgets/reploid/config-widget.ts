/**
 * Reploid Configuration Editor Widget
 *
 * Settings editor with validation and schema-driven forms
 * Allows editing REPLOID configuration with real-time validation
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockConfigData: any;
if (USE_MOCK_DATA) {
  mockConfigData = {
    bootMode: 'rsi-core',
    consensusType: 'arena',
    curatorMode: {
      enabled: true,
      autoApproveContext: false,
      requireExplicitApproval: true
    },
    tokenBudget: 100000,
    maxHistoryEntries: 50,
    enableSentinel: true,
    debugMode: false
  };
}

export default function createConfigWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class ConfigWidget extends HTMLElement {
    private configData: any = null;
    private configSchema: any = null;
    private isDirty: boolean = false;
    private validationErrors: string[] = [];
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to config events
      const unsubRefresh = EventBus.on('reploid:config:refresh', () => {
        this.loadConfig();
      });
      this.unsubscribers.push(unsubRefresh);

      // Initial load
      this.loadConfig();
      this.loadSchema();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadConfig() {
      if (USE_MOCK_DATA) {
        this.configData = mockConfigData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_config',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.configData = JSON.parse(result.content[0].text);
          this.isDirty = false;
          this.render();
        }
      } catch (error) {
        console.error('Failed to load config:', error);
        this.showError('Failed to load configuration');
      }
    }

    private async loadSchema() {
      if (USE_MOCK_DATA) {
        this.configSchema = {
          bootMode: { type: 'string', enum: ['rsi-core', 'rsi-full', 'basic'] },
          consensusType: { type: 'string', enum: ['arena', 'swarm', 'single'] },
          tokenBudget: { type: 'number', min: 1000, max: 200000 },
          enableSentinel: { type: 'boolean' }
        };
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_schema',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.configSchema = JSON.parse(result.content[0].text);
        }
      } catch (error) {
        console.error('Failed to load schema:', error);
      }
    }

    private async validateConfig(config: any) {
      if (USE_MOCK_DATA) {
        this.validationErrors = [];
        return true;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'validate_config',
          { config }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const validation = JSON.parse(result.content[0].text);
          this.validationErrors = validation.errors || [];
          return validation.valid;
        }
      } catch (error) {
        console.error('Failed to validate config:', error);
        this.validationErrors = ['Validation failed'];
        return false;
      }

      return false;
    }

    private async saveConfig() {
      const config = this.collectFormData();

      // Validate before saving
      const isValid = await this.validateConfig(config);
      if (!isValid) {
        this.render();
        return;
      }

      if (USE_MOCK_DATA) {
        console.log('MOCK: Saving config:', config);
        this.configData = config;
        this.isDirty = false;
        this.showSuccess('Configuration saved (mock)');
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'update_config',
          { config }
        );

        this.isDirty = false;
        this.showSuccess('Configuration saved successfully');
        EventBus.emit('reploid:config:updated', { config });
        await this.loadConfig();
      } catch (error) {
        console.error('Failed to save config:', error);
        this.showError('Failed to save configuration');
      }
    }

    private async resetToDefaults() {
      if (!confirm('Reset all settings to defaults?')) {
        return;
      }

      if (USE_MOCK_DATA) {
        this.configData = mockConfigData;
        this.isDirty = false;
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'reset_to_defaults',
          {}
        );

        this.showSuccess('Configuration reset to defaults');
        await this.loadConfig();
      } catch (error) {
        console.error('Failed to reset config:', error);
        this.showError('Failed to reset configuration');
      }
    }

    private collectFormData(): any {
      const config: any = {};
      const inputs = this.shadowRoot?.querySelectorAll('.config-input');

      inputs?.forEach(input => {
        const key = (input as HTMLElement).dataset.key;
        if (!key) return;

        if (input instanceof HTMLInputElement) {
          if (input.type === 'checkbox') {
            config[key] = input.checked;
          } else if (input.type === 'number') {
            config[key] = parseFloat(input.value);
          } else {
            config[key] = input.value;
          }
        } else if (input instanceof HTMLSelectElement) {
          config[key] = input.value;
        }
      });

      return config;
    }

    private filterConfig(searchTerm: string) {
      const items = this.shadowRoot?.querySelectorAll('.config-item');
      items?.forEach(item => {
        const label = (item.querySelector('.config-label') as HTMLElement)?.textContent || '';
        const matches = label.toLowerCase().includes(searchTerm.toLowerCase());
        (item as HTMLElement).style.display = matches ? 'flex' : 'none';
      });
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

      if (!this.configData) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="config-empty">
            <div class="empty-icon">⚙️</div>
            <div class="empty-text">Loading configuration...</div>
          </div>
        `;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="config-widget">
          <div class="config-header">
            <h3>⚙️ Configuration Editor</h3>
            <div class="header-actions">
              <button class="btn-secondary btn-refresh">⟳ Refresh</button>
              <button class="btn-secondary btn-reset">↺ Reset to Defaults</button>
            </div>
          </div>

          <div class="config-toolbar">
            <input type="text" class="search-input" placeholder="🔍 Search settings...">
            ${this.isDirty ? '<span class="dirty-indicator">● Unsaved changes</span>' : ''}
          </div>

          ${this.validationErrors.length > 0 ? `
            <div class="validation-errors">
              <div class="error-header">❌ Validation Errors:</div>
              ${this.validationErrors.map(err => `<div class="error-item">• ${this.escapeHtml(err)}</div>`).join('')}
            </div>
          ` : ''}

          <div class="config-content">
            ${this.renderConfigForm()}
          </div>

          <div class="config-footer">
            <button class="btn-secondary btn-discard" ${!this.isDirty ? 'disabled' : ''}>Discard Changes</button>
            <button class="btn-primary btn-save" ${!this.isDirty ? 'disabled' : ''}>💾 Save Configuration</button>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private renderConfigForm(): string {
      if (!this.configData) return '';

      let html = '<div class="config-form">';

      const renderValue = (key: string, value: any, path: string = key): string => {
        const fullKey = path;
        const schema = this.configSchema?.[key];

        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          return `
            <div class="config-group">
              <div class="group-label">${this.formatLabel(key)}</div>
              <div class="group-items">
                ${Object.entries(value).map(([subKey, subValue]) =>
                  renderValue(subKey, subValue, `${path}.${subKey}`)
                ).join('')}
              </div>
            </div>
          `;
        }

        if (typeof value === 'boolean') {
          return `
            <div class="config-item">
              <label class="config-label">${this.formatLabel(key)}</label>
              <input
                type="checkbox"
                class="config-input"
                data-key="${fullKey}"
                ${value ? 'checked' : ''}
              />
            </div>
          `;
        }

        if (typeof value === 'number') {
          return `
            <div class="config-item">
              <label class="config-label">${this.formatLabel(key)}</label>
              <input
                type="number"
                class="config-input"
                data-key="${fullKey}"
                value="${value}"
                ${schema?.min !== undefined ? `min="${schema.min}"` : ''}
                ${schema?.max !== undefined ? `max="${schema.max}"` : ''}
              />
            </div>
          `;
        }

        if (schema?.enum) {
          return `
            <div class="config-item">
              <label class="config-label">${this.formatLabel(key)}</label>
              <select class="config-input" data-key="${fullKey}">
                ${schema.enum.map((opt: string) => `
                  <option value="${opt}" ${value === opt ? 'selected' : ''}>${opt}</option>
                `).join('')}
              </select>
            </div>
          `;
        }

        return `
          <div class="config-item">
            <label class="config-label">${this.formatLabel(key)}</label>
            <input
              type="text"
              class="config-input"
              data-key="${fullKey}"
              value="${this.escapeHtml(String(value))}"
            />
          </div>
        `;
      };

      for (const [key, value] of Object.entries(this.configData)) {
        html += renderValue(key, value);
      }

      html += '</div>';
      return html;
    }

    private formatLabel(key: string): string {
      return key
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, str => str.toUpperCase())
        .trim();
    }

    private attachEventListeners() {
      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadConfig();
      });

      // Reset button
      this.shadowRoot?.querySelector('.btn-reset')?.addEventListener('click', () => {
        this.resetToDefaults();
      });

      // Save button
      this.shadowRoot?.querySelector('.btn-save')?.addEventListener('click', () => {
        this.saveConfig();
      });

      // Discard button
      this.shadowRoot?.querySelector('.btn-discard')?.addEventListener('click', () => {
        this.loadConfig();
      });

      // Search input
      this.shadowRoot?.querySelector('.search-input')?.addEventListener('input', (e) => {
        const searchTerm = (e.target as HTMLInputElement).value;
        this.filterConfig(searchTerm);
      });

      // Config inputs - mark as dirty on change
      const inputs = this.shadowRoot?.querySelectorAll('.config-input');
      inputs?.forEach(input => {
        input.addEventListener('change', () => {
          this.isDirty = true;
          this.validationErrors = [];
          this.render();
        });
      });
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

        .config-empty {
          padding: 60px 20px;
          text-align: center;
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 18px;
          color: #888;
        }

        .config-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .config-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .config-header h3 {
          margin: 0;
          color: #ce9178;
          font-size: 16px;
          font-weight: bold;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .config-toolbar {
          padding: 12px 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
          display: flex;
          align-items: center;
          gap: 16px;
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
          border-color: #ce9178;
        }

        .dirty-indicator {
          color: #f48771;
          font-size: 12px;
          font-weight: bold;
        }

        .validation-errors {
          background: rgba(244, 71, 71, 0.2);
          border: 1px solid #f44747;
          padding: 12px 16px;
          margin: 0;
        }

        .error-header {
          color: #f44747;
          font-weight: bold;
          margin-bottom: 8px;
        }

        .error-item {
          color: #f48771;
          font-size: 12px;
          margin-left: 12px;
        }

        .config-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        .config-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .config-group {
          border: 1px solid #555;
          padding: 12px;
          background: rgba(30, 30, 30, 0.5);
        }

        .group-label {
          color: #569cd6;
          font-weight: bold;
          margin-bottom: 8px;
          font-size: 13px;
        }

        .group-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
          margin-left: 12px;
        }

        .config-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          background: rgba(20, 20, 20, 0.5);
          border: 1px solid #444;
        }

        .config-label {
          flex: 0 0 200px;
          color: #9cdcfe;
          font-size: 12px;
        }

        .config-input {
          flex: 1;
          padding: 6px 12px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #555;
          color: #e0e0e0;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .config-input:focus {
          outline: none;
          border-color: #ce9178;
        }

        input[type="checkbox"] {
          width: 20px;
          height: 20px;
          cursor: pointer;
        }

        select {
          cursor: pointer;
        }

        .config-footer {
          padding: 16px;
          background: rgba(20, 20, 20, 0.8);
          border-top: 2px solid #333;
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        button {
          padding: 8px 16px;
          border: none;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #ce9178;
          color: #000;
        }

        .btn-primary:hover:not(:disabled) {
          background: #dda78f;
        }

        .btn-secondary {
          background: rgba(206, 145, 120, 0.2);
          border: 1px solid rgba(206, 145, 120, 0.4);
          color: #ce9178;
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(206, 145, 120, 0.3);
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
  if (!customElements.get('reploid-config')) {
    customElements.define('reploid-config', ConfigWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[ConfigWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-config',
          displayName: 'Configuration Editor'
        });
      },
      async destroy() {
        console.log('[ConfigWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-config',
          displayName: 'Configuration Editor'
        });
      },
      async refresh() {
        console.log('[ConfigWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-config',
          displayName: 'Configuration Editor'
        });
        EventBus.emit('reploid:config:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-config',
      displayName: 'Configuration Editor',
      description: 'Edit REPLOID settings with validation and schema support',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_config', 'update_config', 'validate_config', 'reset_to_defaults', 'get_schema']
      },
      category: 'settings',
      tags: ['reploid', 'config', 'settings', 'editor']
    }
  };
}
