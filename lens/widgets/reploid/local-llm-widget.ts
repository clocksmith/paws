/**
 * Reploid Local LLM Widget
 *
 * WebGPU model management UI
 * Load, unload, and run inference on local models
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

const USE_MOCK_DATA = false;

let mockLocalLLMData: any;
if (USE_MOCK_DATA) {
  mockLocalLLMData = {
    loadedModels: [
      { id: 'llama-3-8b', name: 'Llama 3 8B', status: 'ready', memory: 8192, device: 'WebGPU' }
    ],
    availableModels: [
      { id: 'llama-3-70b', name: 'Llama 3 70B', size: 70000 },
      { id: 'mistral-7b', name: 'Mistral 7B', size: 7000 }
    ]
  };
}

export default function createLocalLLMWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class LocalLLMWidget extends HTMLElement {
    private llmState: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsub = EventBus.on('reploid:local-llm:refresh', () => this.loadState());
      this.unsubscribers.push(unsub);
      this.loadState();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadState() {
      if (USE_MOCK_DATA) {
        this.llmState = mockLocalLLMData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'list_loaded_models', {});
        this.llmState = JSON.parse(result.content[0].text);
        this.render();
      } catch (error) {
        console.error('Failed to load local LLM state:', error);
        this.showError('Failed to load state');
      }
    }

    private async loadModel(modelId: string) {
      if (USE_MOCK_DATA) {
        this.showSuccess(`Loading ${modelId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'load_model', { model_id: modelId });
        this.showSuccess(`Model ${modelId} loaded successfully`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to load model:', error);
        this.showError('Failed to load model');
      }
    }

    private async unloadModel(modelId: string) {
      if (!confirm(`Unload ${modelId}?`)) return;

      if (USE_MOCK_DATA) {
        this.llmState.loadedModels = this.llmState.loadedModels.filter((m: any) => m.id !== modelId);
        this.showSuccess(`Unloaded ${modelId} (mock)`);
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'unload_model', { model_id: modelId });
        this.showSuccess(`Model ${modelId} unloaded`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to unload model:', error);
        this.showError('Failed to unload model');
      }
    }

    private async runInference(modelId: string) {
      const prompt = window.prompt('Enter prompt:');
      if (!prompt) return;

      if (USE_MOCK_DATA) {
        alert(`Inference result from ${modelId}:\n\nThis is a mock response.`);
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'infer', {
          model_id: modelId,
          prompt: prompt
        });
        const output = JSON.parse(result.content[0].text);
        this.showInferenceResult(output);
      } catch (error) {
        console.error('Failed to run inference:', error);
        this.showError('Inference failed');
      }
    }

    private showInferenceResult(result: any) {
      const modal = document.createElement('div');
      modal.className = 'inference-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Inference Result</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <pre>${this.escapeHtml(JSON.stringify(result, null, 2))}</pre>
          </div>
        </div>
      `;
      modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
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

      if (!this.llmState) {
        this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="loading">Loading...</div>`;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="local-llm-widget">
          <div class="widget-header">
            <h3>🖥️ Local LLM</h3>
            <button class="btn-refresh">⟳</button>
          </div>

          <div class="loaded-section">
            <div class="section-title">Loaded Models (${this.llmState.loadedModels?.length || 0})</div>
            ${(this.llmState.loadedModels || []).map((m: any) => `
              <div class="model-card loaded">
                <div class="model-name">${m.name}</div>
                <div class="model-stats">
                  <span>Status: ${m.status}</span>
                  <span>Memory: ${m.memory}MB</span>
                  <span>Device: ${m.device}</span>
                </div>
                <div class="model-actions">
                  <button class="btn-infer" data-model="${m.id}">Run Inference</button>
                  <button class="btn-unload" data-model="${m.id}">Unload</button>
                </div>
              </div>
            `).join('') || '<div class="empty">No models loaded</div>'}
          </div>

          <div class="available-section">
            <div class="section-title">Available Models</div>
            ${(this.llmState.availableModels || []).map((m: any) => `
              <div class="model-card available">
                <div class="model-name">${m.name}</div>
                <div class="model-size">Size: ${m.size}MB</div>
                <button class="btn-load" data-model="${m.id}">Load Model</button>
              </div>
            `).join('') || '<div class="empty">No models available</div>'}
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => this.loadState());

      this.shadowRoot?.querySelectorAll('.btn-load').forEach(btn => {
        btn.addEventListener('click', () => {
          const model = (btn as HTMLElement).dataset.model;
          if (model) this.loadModel(model);
        });
      });

      this.shadowRoot?.querySelectorAll('.btn-unload').forEach(btn => {
        btn.addEventListener('click', () => {
          const model = (btn as HTMLElement).dataset.model;
          if (model) this.unloadModel(model);
        });
      });

      this.shadowRoot?.querySelectorAll('.btn-infer').forEach(btn => {
        btn.addEventListener('click', () => {
          const model = (btn as HTMLElement).dataset.model;
          if (model) this.runInference(model);
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
        :host { display: block; font-family: 'Courier New', monospace; color: #e0e0e0; }
        .local-llm-widget { background: rgba(40, 40, 40, 0.6); border: 2px solid #333; height: 600px; display: flex; flex-direction: column; }
        .widget-header { background: rgba(20, 20, 20, 0.8); padding: 16px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; }
        .widget-header h3 { margin: 0; color: #608b4e; font-size: 16px; }
        .btn-refresh { padding: 6px 12px; background: rgba(96, 139, 78, 0.2); border: 1px solid rgba(96, 139, 78, 0.4); color: #608b4e; cursor: pointer; }
        .loaded-section, .available-section { padding: 16px; overflow-y: auto; }
        .section-title { font-size: 12px; font-weight: bold; color: #608b4e; margin-bottom: 12px; }
        .model-card { background: rgba(30, 30, 30, 0.8); border: 2px solid #444; padding: 12px; margin-bottom: 8px; }
        .model-card.loaded { border-left: 4px solid #608b4e; }
        .model-name { font-size: 14px; font-weight: bold; color: #9cdcfe; margin-bottom: 8px; }
        .model-stats { font-size: 11px; color: #888; display: flex; gap: 12px; margin-bottom: 8px; }
        .model-size { font-size: 11px; color: #888; margin-bottom: 8px; }
        .model-actions { display: flex; gap: 6px; }
        .model-actions button, .btn-load { flex: 1; padding: 6px; background: rgba(96, 139, 78, 0.2); border: 1px solid rgba(96, 139, 78, 0.4); color: #608b4e; cursor: pointer; font-family: 'Courier New', monospace; font-size: 10px; }
        .btn-unload { background: rgba(244, 71, 71, 0.2) !important; border-color: rgba(244, 71, 71, 0.4) !important; color: #f44747 !important; }
        .empty { padding: 20px; text-align: center; color: #666; font-size: 12px; }
        .inference-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { background: #1e1e1e; border: 2px solid #444; width: 600px; max-width: 90%; }
        .modal-header { padding: 16px; background: #252526; border-bottom: 1px solid #444; display: flex; justify-content: space-between; }
        .modal-header h3 { margin: 0; color: #608b4e; }
        .modal-close { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; }
        .modal-body { padding: 16px; max-height: 400px; overflow-y: auto; }
        .modal-body pre { margin: 0; color: #cccccc; font-size: 12px; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; z-index: 10000; }
        .toast-error { background: #f44747; color: white; }
        .toast-success { background: #4ec9b0; color: #000; }
      `;
    }
  }

  if (!customElements.get('reploid-local-llm')) {
    customElements.define('reploid-local-llm', LocalLLMWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[LocalLLMWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', { element: 'reploid-local-llm', displayName: 'Local LLM' });
      },
      async destroy() { console.log('[LocalLLMWidget] Destroyed'); },
      async refresh() { EventBus.emit('reploid:local-llm:refresh', {}); }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-local-llm',
      displayName: 'Local LLM',
      description: 'Load and run inference on local WebGPU models',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: { tools: ['load_model', 'unload_model', 'list_loaded_models', 'get_model_status', 'infer'] },
      category: 'models',
      tags: ['reploid', 'local', 'llm', 'webgpu', 'inference']
    }
  };
}
