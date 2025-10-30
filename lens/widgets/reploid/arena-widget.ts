/**
 * Reploid Model Arena Widget
 *
 * Model competition and voting UI
 * Run head-to-head model comparisons and vote on best responses
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

const USE_MOCK_DATA = false;

let mockArenaData: any;
if (USE_MOCK_DATA) {
  mockArenaData = {
    activeArenas: [
      {
        id: 'arena-1',
        prompt: 'Explain quantum computing',
        models: ['gpt-4', 'claude-3-opus'],
        responses: [
          { model: 'gpt-4', text: 'Quantum computing uses qubits...', votes: 3 },
          { model: 'claude-3-opus', text: 'Quantum computers leverage...', votes: 5 }
        ],
        status: 'voting'
      }
    ]
  };
}

export default function createArenaWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class ArenaWidget extends HTMLElement {
    private arenaState: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsub = EventBus.on('reploid:arena:refresh', () => this.loadState());
      this.unsubscribers.push(unsub);
      this.loadState();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadState() {
      if (USE_MOCK_DATA) {
        this.arenaState = mockArenaData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'get_history', {});
        this.arenaState = JSON.parse(result.content[0].text);
        this.render();
      } catch (error) {
        console.error('Failed to load arena state:', error);
        this.showError('Failed to load arenas');
      }
    }

    private async startArena() {
      const prompt = window.prompt('Enter prompt for arena:');
      if (!prompt) return;

      const modelsInput = window.prompt('Enter model IDs (comma-separated):');
      if (!modelsInput) return;

      const models = modelsInput.split(',').map(m => m.trim());

      if (USE_MOCK_DATA) {
        this.showSuccess('Arena started (mock)');
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'start_arena', {
          prompt: prompt,
          models: models
        });
        this.showSuccess('Arena started successfully');
        await this.loadState();
      } catch (error) {
        console.error('Failed to start arena:', error);
        this.showError('Failed to start arena');
      }
    }

    private async submitVote(arenaId: string, modelId: string) {
      if (USE_MOCK_DATA) {
        this.showSuccess(`Voted for ${modelId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'submit_vote', {
          arena_id: arenaId,
          model_id: modelId,
          vote: 1
        });
        this.showSuccess(`Vote submitted for ${modelId}`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to submit vote:', error);
        this.showError('Failed to submit vote');
      }
    }

    private async getResults(arenaId: string) {
      if (USE_MOCK_DATA) {
        alert('Arena Results (mock):\n\nWinner: claude-3-opus\nVotes: 5 vs 3');
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'get_results', { arena_id: arenaId });
        const results = JSON.parse(result.content[0].text);
        this.showResults(results);
      } catch (error) {
        console.error('Failed to get results:', error);
        this.showError('Failed to get results');
      }
    }

    private showResults(results: any) {
      const modal = document.createElement('div');
      modal.className = 'results-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Arena Results</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <pre>${this.escapeHtml(JSON.stringify(results, null, 2))}</pre>
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

      if (!this.arenaState) {
        this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="loading">Loading...</div>`;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="arena-widget">
          <div class="widget-header">
            <h3>🏆 Model Arena</h3>
            <button class="btn-start">+ Start Arena</button>
          </div>

          <div class="widget-content">
            ${(this.arenaState.activeArenas || []).length === 0 ? `
              <div class="empty">No active arenas</div>
            ` : (this.arenaState.activeArenas || []).map((arena: any) => `
              <div class="arena-card">
                <div class="arena-header">
                  <div class="arena-prompt">${this.escapeHtml(arena.prompt)}</div>
                  <div class="arena-status">${arena.status}</div>
                </div>

                <div class="responses-grid">
                  ${arena.responses.map((resp: any) => `
                    <div class="response-card">
                      <div class="response-header">
                        <span class="model-name">${resp.model}</span>
                        <span class="vote-count">👍 ${resp.votes}</span>
                      </div>
                      <div class="response-text">${this.escapeHtml(resp.text.substring(0, 200))}...</div>
                      <button class="btn-vote" data-arena="${arena.id}" data-model="${resp.model}">Vote for This</button>
                    </div>
                  `).join('')}
                </div>

                <button class="btn-results" data-arena="${arena.id}">View Final Results</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelector('.btn-start')?.addEventListener('click', () => this.startArena());

      this.shadowRoot?.querySelectorAll('.btn-vote').forEach(btn => {
        btn.addEventListener('click', () => {
          const arena = (btn as HTMLElement).dataset.arena;
          const model = (btn as HTMLElement).dataset.model;
          if (arena && model) this.submitVote(arena, model);
        });
      });

      this.shadowRoot?.querySelectorAll('.btn-results').forEach(btn => {
        btn.addEventListener('click', () => {
          const arena = (btn as HTMLElement).dataset.arena;
          if (arena) this.getResults(arena);
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
        .arena-widget { background: rgba(40, 40, 40, 0.6); border: 2px solid #333; height: 600px; display: flex; flex-direction: column; }
        .widget-header { background: rgba(20, 20, 20, 0.8); padding: 16px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; }
        .widget-header h3 { margin: 0; color: #ffd700; font-size: 16px; }
        .btn-start { padding: 6px 12px; background: rgba(255, 215, 0, 0.2); border: 1px solid rgba(255, 215, 0, 0.4); color: #ffd700; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .widget-content { flex: 1; overflow-y: auto; padding: 16px; }
        .empty { padding: 60px 20px; text-align: center; color: #666; font-size: 14px; }
        .arena-card { background: rgba(30, 30, 30, 0.8); border: 2px solid #444; padding: 16px; margin-bottom: 16px; }
        .arena-header { display: flex; justify-content: space-between; margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #444; }
        .arena-prompt { font-size: 14px; font-weight: bold; color: #ffd700; }
        .arena-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(255, 215, 0, 0.3); color: #ffd700; }
        .responses-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-bottom: 12px; }
        .response-card { background: rgba(20, 20, 20, 0.8); border: 1px solid #555; padding: 12px; }
        .response-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .model-name { font-size: 12px; font-weight: bold; color: #9cdcfe; }
        .vote-count { font-size: 11px; color: #ffd700; }
        .response-text { font-size: 11px; color: #cccccc; line-height: 1.5; margin-bottom: 10px; }
        .btn-vote { width: 100%; padding: 6px; background: rgba(255, 215, 0, 0.2); border: 1px solid rgba(255, 215, 0, 0.4); color: #ffd700; cursor: pointer; font-family: 'Courier New', monospace; font-size: 10px; }
        .btn-vote:hover { background: rgba(255, 215, 0, 0.3); }
        .btn-results { width: 100%; padding: 8px; background: rgba(78, 201, 176, 0.2); border: 1px solid rgba(78, 201, 176, 0.4); color: #4ec9b0; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .results-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { background: #1e1e1e; border: 2px solid #444; width: 600px; max-width: 90%; }
        .modal-header { padding: 16px; background: #252526; border-bottom: 1px solid #444; display: flex; justify-content: space-between; }
        .modal-header h3 { margin: 0; color: #ffd700; }
        .modal-close { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; }
        .modal-body { padding: 16px; max-height: 400px; overflow-y: auto; }
        .modal-body pre { margin: 0; color: #cccccc; font-size: 12px; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; z-index: 10000; }
        .toast-error { background: #f44747; color: white; }
        .toast-success { background: #4ec9b0; color: #000; }
      `;
    }
  }

  if (!customElements.get('reploid-arena')) {
    customElements.define('reploid-arena', ArenaWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[ArenaWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', { element: 'reploid-arena', displayName: 'Model Arena' });
      },
      async destroy() { console.log('[ArenaWidget] Destroyed'); },
      async refresh() { EventBus.emit('reploid:arena:refresh', {}); }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-arena',
      displayName: 'Model Arena',
      description: 'Run head-to-head model competitions and vote on best responses',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: { tools: ['start_arena', 'submit_vote', 'get_results', 'configure_judges', 'get_history'] },
      category: 'competition',
      tags: ['reploid', 'arena', 'models', 'voting', 'competition']
    }
  };
}
