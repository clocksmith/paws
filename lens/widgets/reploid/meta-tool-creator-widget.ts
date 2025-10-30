/**
 * Reploid Meta Tool Creator Widget
 *
 * Dynamic tool creation UI with schema editor
 * Allows creating and testing new tools at runtime
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockToolData: any;
if (USE_MOCK_DATA) {
  mockToolData = {
    templates: [
      { id: 'simple', name: 'Simple Tool', description: 'Basic tool with string input/output' },
      { id: 'complex', name: 'Complex Tool', description: 'Tool with structured input/output' },
      { id: 'async', name: 'Async Tool', description: 'Tool with async operations' }
    ],
    tools: [
      {
        id: 'tool1',
        name: 'example_tool',
        description: 'Example custom tool',
        schema: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' }
          },
          required: ['input']
        }
      }
    ]
  };
}

export default function createMetaToolCreatorWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class MetaToolCreatorWidget extends HTMLElement {
    private templates: any[] = [];
    private tools: any[] = [];
    private currentTool: any = null;
    private editMode: 'json' | 'form' = 'form';
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to tool events
      const unsubRefresh = EventBus.on('reploid:tools:refresh', () => {
        this.loadTemplates();
        this.loadTools();
      });
      this.unsubscribers.push(unsubRefresh);

      // Initial load
      this.loadTemplates();
      this.loadTools();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadTemplates() {
      if (USE_MOCK_DATA) {
        this.templates = mockToolData.templates;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'list_tool_templates',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.templates = data.templates || [];
          this.render();
        }
      } catch (error) {
        console.error('Failed to load templates:', error);
        this.showError('Failed to load tool templates');
      }
    }

    private async loadTools() {
      if (USE_MOCK_DATA) {
        this.tools = mockToolData.tools;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'list_created_tools',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const data = JSON.parse(result.content[0].text);
          this.tools = data.tools || [];
          this.render();
        }
      } catch (error) {
        console.error('Failed to load tools:', error);
      }
    }

    private async createTool() {
      const toolData = this.collectToolData();

      // Validate schema first
      const isValid = await this.validateToolSchema(toolData.schema);
      if (!isValid) {
        return;
      }

      if (USE_MOCK_DATA) {
        console.log('MOCK: Creating tool:', toolData);
        this.tools.push({ id: `tool${this.tools.length + 1}`, ...toolData });
        this.currentTool = null;
        this.showSuccess('Tool created (mock mode)');
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'create_tool',
          toolData
        );

        this.showSuccess('Tool created successfully');
        this.currentTool = null;
        EventBus.emit('reploid:tools:created', { tool: toolData });
        await this.loadTools();
      } catch (error) {
        console.error('Failed to create tool:', error);
        this.showError('Failed to create tool');
      }
    }

    private async validateToolSchema(schema: any): Promise<boolean> {
      if (USE_MOCK_DATA) {
        return true;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'validate_tool_schema',
          { schema }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const validation = JSON.parse(result.content[0].text);
          if (!validation.valid) {
            this.showError(`Invalid schema: ${validation.errors.join(', ')}`);
          }
          return validation.valid;
        }
      } catch (error) {
        console.error('Failed to validate schema:', error);
        this.showError('Schema validation failed');
        return false;
      }

      return false;
    }

    private async testTool(toolId: string) {
      const testInput = prompt('Enter test input (JSON format):');
      if (!testInput) return;

      let parsedInput;
      try {
        parsedInput = JSON.parse(testInput);
      } catch {
        this.showError('Invalid JSON input');
        return;
      }

      if (USE_MOCK_DATA) {
        console.log('MOCK: Testing tool:', toolId, 'with input:', parsedInput);
        alert(`Test result for ${toolId}:\n\n{"output": "test result"}\n\n(Mock mode)`);
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'test_tool',
          { tool_id: toolId, input: parsedInput }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          const output = JSON.parse(result.content[0].text);
          this.showTestResult(output);
        }
      } catch (error) {
        console.error('Failed to test tool:', error);
        this.showError('Tool test failed');
      }
    }

    private async deleteTool(toolId: string) {
      if (!confirm('Delete this tool?')) {
        return;
      }

      if (USE_MOCK_DATA) {
        this.tools = this.tools.filter(t => t.id !== toolId);
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'delete_tool',
          { tool_id: toolId }
        );

        this.showSuccess('Tool deleted');
        await this.loadTools();
      } catch (error) {
        console.error('Failed to delete tool:', error);
        this.showError('Failed to delete tool');
      }
    }

    private collectToolData(): any {
      const nameInput = this.shadowRoot?.querySelector('#tool-name') as HTMLInputElement;
      const descInput = this.shadowRoot?.querySelector('#tool-desc') as HTMLTextAreaElement;
      const schemaInput = this.shadowRoot?.querySelector('#tool-schema') as HTMLTextAreaElement;

      let schema;
      try {
        schema = JSON.parse(schemaInput?.value || '{}');
      } catch {
        this.showError('Invalid JSON schema');
        throw new Error('Invalid schema');
      }

      return {
        name: nameInput?.value || '',
        description: descInput?.value || '',
        schema
      };
    }

    private loadTemplate(templateId: string) {
      const template = this.templates.find(t => t.id === templateId);
      if (!template) return;

      const defaultSchemas: Record<string, any> = {
        simple: {
          type: 'object',
          properties: {
            input: { type: 'string', description: 'Input parameter' }
          },
          required: ['input']
        },
        complex: {
          type: 'object',
          properties: {
            data: {
              type: 'object',
              properties: {
                key: { type: 'string' },
                value: { type: 'any' }
              }
            }
          },
          required: ['data']
        },
        async: {
          type: 'object',
          properties: {
            url: { type: 'string', format: 'uri' },
            method: { type: 'string', enum: ['GET', 'POST'] }
          },
          required: ['url', 'method']
        }
      };

      this.currentTool = {
        name: '',
        description: template.description,
        schema: defaultSchemas[templateId] || {}
      };

      this.render();
    }

    private toggleEditMode() {
      this.editMode = this.editMode === 'json' ? 'form' : 'json';
      this.render();
    }

    private showTestResult(result: any) {
      const modal = document.createElement('div');
      modal.className = 'test-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Test Result</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <pre>${this.escapeHtml(JSON.stringify(result, null, 2))}</pre>
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

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="meta-tool-widget">
          <div class="widget-header">
            <h3>🔧 Meta Tool Creator</h3>
            <div class="header-actions">
              <button class="btn-new">+ New Tool</button>
              <button class="btn-refresh">⟳</button>
            </div>
          </div>

          <div class="widget-content">
            <div class="left-panel">
              <div class="panel-section">
                <div class="section-title">📋 Templates</div>
                <div class="templates-list">
                  ${this.templates.map(t => `
                    <div class="template-item" data-template="${t.id}">
                      <div class="template-name">${this.escapeHtml(t.name)}</div>
                      <div class="template-desc">${this.escapeHtml(t.description)}</div>
                    </div>
                  `).join('')}
                </div>
              </div>

              <div class="panel-section">
                <div class="section-title">🔨 Created Tools (${this.tools.length})</div>
                <div class="tools-list">
                  ${this.tools.length === 0 ? `
                    <div class="empty-message">No tools created yet</div>
                  ` : this.tools.map(t => `
                    <div class="tool-item">
                      <div class="tool-name">${this.escapeHtml(t.name)}</div>
                      <div class="tool-actions">
                        <button class="btn-icon btn-test" data-tool="${t.id}" title="Test">▶</button>
                        <button class="btn-icon btn-delete" data-tool="${t.id}" title="Delete">🗑</button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              </div>
            </div>

            <div class="right-panel">
              ${this.currentTool === null ? `
                <div class="empty-creator">
                  <div class="empty-icon">🔧</div>
                  <div class="empty-text">Select a template or click "New Tool" to begin</div>
                </div>
              ` : `
                <div class="tool-creator">
                  <div class="creator-header">
                    <h4>Create New Tool</h4>
                    <button class="btn-toggle-mode">${this.editMode === 'json' ? '📝 Form Mode' : '{ } JSON Mode'}</button>
                  </div>

                  <div class="creator-form">
                    <div class="form-group">
                      <label>Tool Name</label>
                      <input type="text" id="tool-name" placeholder="my_custom_tool" value="${this.currentTool.name || ''}">
                    </div>

                    <div class="form-group">
                      <label>Description</label>
                      <textarea id="tool-desc" rows="2" placeholder="What does this tool do?">${this.currentTool.description || ''}</textarea>
                    </div>

                    <div class="form-group">
                      <label>Schema (JSON)</label>
                      <textarea id="tool-schema" rows="12" placeholder='{"type": "object", "properties": {...}}'>${JSON.stringify(this.currentTool.schema || {}, null, 2)}</textarea>
                    </div>

                    <div class="creator-actions">
                      <button class="btn-secondary btn-cancel">Cancel</button>
                      <button class="btn-primary btn-create">🔧 Create Tool</button>
                    </div>
                  </div>
                </div>
              `}
            </div>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      // New tool button
      this.shadowRoot?.querySelector('.btn-new')?.addEventListener('click', () => {
        this.currentTool = { name: '', description: '', schema: {} };
        this.render();
      });

      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadTemplates();
        this.loadTools();
      });

      // Template items
      const templates = this.shadowRoot?.querySelectorAll('.template-item');
      templates?.forEach(item => {
        item.addEventListener('click', () => {
          const templateId = (item as HTMLElement).dataset.template;
          if (templateId) this.loadTemplate(templateId);
        });
      });

      // Test buttons
      const testBtns = this.shadowRoot?.querySelectorAll('.btn-test');
      testBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const toolId = (btn as HTMLElement).dataset.tool;
          if (toolId) this.testTool(toolId);
        });
      });

      // Delete buttons
      const deleteBtns = this.shadowRoot?.querySelectorAll('.btn-delete');
      deleteBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const toolId = (btn as HTMLElement).dataset.tool;
          if (toolId) this.deleteTool(toolId);
        });
      });

      // Create button
      this.shadowRoot?.querySelector('.btn-create')?.addEventListener('click', () => {
        this.createTool();
      });

      // Cancel button
      this.shadowRoot?.querySelector('.btn-cancel')?.addEventListener('click', () => {
        this.currentTool = null;
        this.render();
      });

      // Toggle mode button
      this.shadowRoot?.querySelector('.btn-toggle-mode')?.addEventListener('click', () => {
        this.toggleEditMode();
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

        .meta-tool-widget {
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
          color: #c586c0;
          font-size: 16px;
          font-weight: bold;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .btn-new {
          padding: 6px 12px;
          background: rgba(197, 134, 192, 0.2);
          border: 1px solid rgba(197, 134, 192, 0.4);
          color: #c586c0;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          transition: all 0.2s;
        }

        .btn-new:hover {
          background: rgba(197, 134, 192, 0.3);
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(197, 134, 192, 0.2);
          border: 1px solid rgba(197, 134, 192, 0.4);
          color: #c586c0;
          cursor: pointer;
          font-size: 14px;
        }

        .widget-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .left-panel {
          width: 300px;
          border-right: 2px solid #333;
          display: flex;
          flex-direction: column;
          overflow-y: auto;
        }

        .panel-section {
          border-bottom: 1px solid #333;
          padding: 12px;
        }

        .section-title {
          font-size: 12px;
          font-weight: bold;
          color: #c586c0;
          margin-bottom: 8px;
        }

        .templates-list, .tools-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .template-item {
          padding: 10px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #444;
          cursor: pointer;
          transition: all 0.2s;
        }

        .template-item:hover {
          background: rgba(197, 134, 192, 0.1);
          border-color: #c586c0;
        }

        .template-name {
          font-size: 12px;
          font-weight: bold;
          color: #c586c0;
          margin-bottom: 4px;
        }

        .template-desc {
          font-size: 10px;
          color: #888;
        }

        .tool-item {
          padding: 8px 10px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tool-name {
          font-size: 12px;
          color: #9cdcfe;
        }

        .tool-actions {
          display: flex;
          gap: 4px;
        }

        .btn-icon {
          padding: 4px 8px;
          background: rgba(156, 220, 254, 0.1);
          border: 1px solid rgba(156, 220, 254, 0.3);
          color: #9cdcfe;
          cursor: pointer;
          font-size: 10px;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: rgba(156, 220, 254, 0.2);
        }

        .empty-message {
          padding: 20px;
          text-align: center;
          color: #666;
          font-size: 11px;
        }

        .right-panel {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }

        .empty-creator {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px;
        }

        .empty-icon {
          font-size: 64px;
          margin-bottom: 16px;
          opacity: 0.3;
        }

        .empty-text {
          font-size: 14px;
          color: #666;
          text-align: center;
        }

        .tool-creator {
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .creator-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 1px solid #444;
        }

        .creator-header h4 {
          margin: 0;
          color: #c586c0;
          font-size: 14px;
        }

        .btn-toggle-mode {
          padding: 6px 12px;
          background: rgba(197, 134, 192, 0.2);
          border: 1px solid rgba(197, 134, 192, 0.4);
          color: #c586c0;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 10px;
        }

        .creator-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 11px;
          color: #9cdcfe;
          font-weight: bold;
        }

        .form-group input,
        .form-group textarea {
          padding: 8px 12px;
          background: rgba(30, 30, 30, 0.8);
          border: 1px solid #555;
          color: #e0e0e0;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: #c586c0;
        }

        .creator-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding-top: 12px;
          border-top: 1px solid #444;
        }

        .btn-primary {
          padding: 8px 16px;
          background: #c586c0;
          color: #000;
          border: none;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .btn-primary:hover {
          background: #d4a0cf;
        }

        .btn-secondary {
          padding: 8px 16px;
          background: rgba(197, 134, 192, 0.2);
          border: 1px solid rgba(197, 134, 192, 0.4);
          color: #c586c0;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
        }

        .btn-secondary:hover {
          background: rgba(197, 134, 192, 0.3);
        }

        .test-modal {
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
          width: 80%;
          max-width: 700px;
          max-height: 80%;
          display: flex;
          flex-direction: column;
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
          color: #c586c0;
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
          overflow-y: auto;
          flex: 1;
        }

        .modal-body pre {
          margin: 0;
          color: #cccccc;
          font-size: 12px;
          line-height: 1.5;
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
  if (!customElements.get('reploid-meta-tool-creator')) {
    customElements.define('reploid-meta-tool-creator', MetaToolCreatorWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[MetaToolCreatorWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-meta-tool-creator',
          displayName: 'Meta Tool Creator'
        });
      },
      async destroy() {
        console.log('[MetaToolCreatorWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-meta-tool-creator',
          displayName: 'Meta Tool Creator'
        });
      },
      async refresh() {
        console.log('[MetaToolCreatorWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-meta-tool-creator',
          displayName: 'Meta Tool Creator'
        });
        EventBus.emit('reploid:tools:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-meta-tool-creator',
      displayName: 'Meta Tool Creator',
      description: 'Create and test custom tools dynamically with schema editor',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['create_tool', 'list_tool_templates', 'validate_tool_schema', 'test_tool', 'list_created_tools', 'delete_tool']
      },
      category: 'development',
      tags: ['reploid', 'tools', 'meta', 'creator', 'development']
    }
  };
}
