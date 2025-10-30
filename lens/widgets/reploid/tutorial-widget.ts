/**
 * Reploid Tutorial Widget
 *
 * Interactive tutorial system UI
 * Step-by-step guided tutorials for REPLOID features
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

const USE_MOCK_DATA = false;

let mockTutorialData: any;
if (USE_MOCK_DATA) {
  mockTutorialData = {
    currentTutorial: {
      id: 'intro-to-reploid',
      name: 'Introduction to REPLOID',
      currentStep: 2,
      totalSteps: 5,
      steps: [
        { id: 1, title: 'Welcome', content: 'Welcome to REPLOID!', completed: true },
        { id: 2, title: 'Core Concepts', content: 'Learn about RSI loops...', completed: false },
        { id: 3, title: 'MCP Servers', content: 'Understanding MCP...', completed: false }
      ]
    },
    availableTutorials: [
      { id: 'intro-to-reploid', name: 'Introduction to REPLOID', difficulty: 'beginner', duration: 10 },
      { id: 'advanced-mcp', name: 'Advanced MCP', difficulty: 'advanced', duration: 20 }
    ]
  };
}

export default function createTutorialWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class TutorialWidget extends HTMLElement {
    private tutorialState: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsub = EventBus.on('reploid:tutorial:refresh', () => this.loadState());
      this.unsubscribers.push(unsub);
      this.loadState();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadState() {
      if (USE_MOCK_DATA) {
        this.tutorialState = mockTutorialData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'get_current_step', {});
        this.tutorialState = JSON.parse(result.content[0].text);
        this.render();
      } catch (error) {
        console.error('Failed to load tutorial state:', error);
        this.showError('Failed to load tutorials');
      }
    }

    private async startTutorial(tutorialId: string) {
      if (USE_MOCK_DATA) {
        this.showSuccess(`Started tutorial: ${tutorialId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'start_tutorial', { tutorial_id: tutorialId });
        this.showSuccess(`Tutorial started: ${tutorialId}`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to start tutorial:', error);
        this.showError('Failed to start tutorial');
      }
    }

    private async nextStep() {
      if (USE_MOCK_DATA) {
        if (this.tutorialState.currentTutorial.currentStep < this.tutorialState.currentTutorial.totalSteps) {
          this.tutorialState.currentTutorial.currentStep++;
          this.showSuccess('Moved to next step (mock)');
          this.render();
        }
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'next_step', {});
        this.showSuccess('Moved to next step');
        await this.loadState();
      } catch (error) {
        console.error('Failed to move to next step:', error);
        this.showError('Failed to proceed');
      }
    }

    private async previousStep() {
      if (USE_MOCK_DATA) {
        if (this.tutorialState.currentTutorial.currentStep > 1) {
          this.tutorialState.currentTutorial.currentStep--;
          this.showSuccess('Moved to previous step (mock)');
          this.render();
        }
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'previous_step', {});
        this.showSuccess('Moved to previous step');
        await this.loadState();
      } catch (error) {
        console.error('Failed to move to previous step:', error);
        this.showError('Failed to go back');
      }
    }

    private async completeTutorial() {
      if (!confirm('Mark this tutorial as complete?')) return;

      if (USE_MOCK_DATA) {
        this.tutorialState.currentTutorial = null;
        this.showSuccess('Tutorial completed (mock)');
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'complete_tutorial', {});
        this.showSuccess('Tutorial completed!');
        await this.loadState();
      } catch (error) {
        console.error('Failed to complete tutorial:', error);
        this.showError('Failed to complete tutorial');
      }
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

      if (!this.tutorialState) {
        this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="loading">Loading...</div>`;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="tutorial-widget">
          <div class="widget-header">
            <h3>📚 Tutorials</h3>
          </div>

          ${!this.tutorialState.currentTutorial ? `
            <div class="tutorial-list">
              <div class="list-title">Available Tutorials</div>
              ${this.tutorialState.availableTutorials.map((tut: any) => `
                <div class="tutorial-card">
                  <div class="tutorial-name">${tut.name}</div>
                  <div class="tutorial-meta">
                    <span class="difficulty difficulty-${tut.difficulty}">${tut.difficulty}</span>
                    <span class="duration">${tut.duration} min</span>
                  </div>
                  <button class="btn-start" data-tutorial="${tut.id}">Start Tutorial</button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="tutorial-active">
              <div class="tutorial-header">
                <div class="tutorial-title">${this.tutorialState.currentTutorial.name}</div>
                <div class="tutorial-progress">
                  Step ${this.tutorialState.currentTutorial.currentStep} of ${this.tutorialState.currentTutorial.totalSteps}
                </div>
              </div>

              <div class="progress-bar">
                <div class="progress-fill" style="width: ${(this.tutorialState.currentTutorial.currentStep / this.tutorialState.currentTutorial.totalSteps) * 100}%"></div>
              </div>

              <div class="tutorial-content">
                ${this.renderCurrentStep()}
              </div>

              <div class="tutorial-navigation">
                <button class="btn-prev" ${this.tutorialState.currentTutorial.currentStep === 1 ? 'disabled' : ''}>
                  ← Previous
                </button>
                ${this.tutorialState.currentTutorial.currentStep === this.tutorialState.currentTutorial.totalSteps ? `
                  <button class="btn-complete">✓ Complete Tutorial</button>
                ` : `
                  <button class="btn-next">Next →</button>
                `}
              </div>
            </div>
          `}
        </div>
      `;

      this.attachEventListeners();
    }

    private renderCurrentStep(): string {
      const tutorial = this.tutorialState.currentTutorial;
      const currentStep = tutorial.steps.find((s: any) => s.id === tutorial.currentStep);
      if (!currentStep) return '<div class="no-step">No step data</div>';

      return `
        <div class="step-container">
          <div class="step-title">${currentStep.title}</div>
          <div class="step-content">${this.escapeHtml(currentStep.content)}</div>
          ${currentStep.completed ? '<div class="step-badge">✓ Completed</div>' : ''}
        </div>
      `;
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', () => {
          const tutorial = (btn as HTMLElement).dataset.tutorial;
          if (tutorial) this.startTutorial(tutorial);
        });
      });

      this.shadowRoot?.querySelector('.btn-prev')?.addEventListener('click', () => this.previousStep());
      this.shadowRoot?.querySelector('.btn-next')?.addEventListener('click', () => this.nextStep());
      this.shadowRoot?.querySelector('.btn-complete')?.addEventListener('click', () => this.completeTutorial());
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host { display: block; font-family: 'Courier New', monospace; color: #e0e0e0; }
        .tutorial-widget { background: rgba(40, 40, 40, 0.6); border: 2px solid #333; height: 600px; display: flex; flex-direction: column; }
        .widget-header { background: rgba(20, 20, 20, 0.8); padding: 16px; border-bottom: 2px solid #333; }
        .widget-header h3 { margin: 0; color: #c586c0; font-size: 16px; }
        .tutorial-list { padding: 16px; overflow-y: auto; flex: 1; }
        .list-title { font-size: 12px; font-weight: bold; color: #c586c0; margin-bottom: 12px; }
        .tutorial-card { background: rgba(30, 30, 30, 0.8); border: 2px solid #444; padding: 16px; margin-bottom: 12px; }
        .tutorial-name { font-size: 14px; font-weight: bold; color: #9cdcfe; margin-bottom: 8px; }
        .tutorial-meta { display: flex; gap: 12px; margin-bottom: 10px; font-size: 11px; }
        .difficulty { padding: 2px 8px; border-radius: 10px; }
        .difficulty-beginner { background: rgba(78, 201, 176, 0.3); color: #4ec9b0; }
        .difficulty-intermediate { background: rgba(255, 170, 0, 0.3); color: #ffaa00; }
        .difficulty-advanced { background: rgba(244, 71, 71, 0.3); color: #f44747; }
        .duration { color: #888; }
        .btn-start { width: 100%; padding: 8px; background: rgba(197, 134, 192, 0.2); border: 1px solid rgba(197, 134, 192, 0.4); color: #c586c0; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .tutorial-active { display: flex; flex-direction: column; flex: 1; }
        .tutorial-header { padding: 16px; background: rgba(30, 30, 30, 0.8); border-bottom: 1px solid #444; }
        .tutorial-title { font-size: 14px; font-weight: bold; color: #c586c0; margin-bottom: 6px; }
        .tutorial-progress { font-size: 11px; color: #888; }
        .progress-bar { height: 6px; background: rgba(20, 20, 20, 0.8); }
        .progress-fill { height: 100%; background: #c586c0; transition: width 0.3s; }
        .tutorial-content { flex: 1; padding: 20px; overflow-y: auto; }
        .step-container { }
        .step-title { font-size: 16px; font-weight: bold; color: #9cdcfe; margin-bottom: 16px; }
        .step-content { font-size: 13px; color: #cccccc; line-height: 1.8; }
        .step-badge { margin-top: 12px; padding: 6px 12px; background: rgba(78, 201, 176, 0.3); color: #4ec9b0; display: inline-block; font-size: 11px; }
        .tutorial-navigation { padding: 16px; background: rgba(20, 20, 20, 0.8); border-top: 1px solid #444; display: flex; gap: 12px; justify-content: space-between; }
        .tutorial-navigation button { flex: 1; padding: 10px; border: 1px solid; cursor: pointer; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; }
        .btn-prev { background: rgba(197, 134, 192, 0.2); border-color: rgba(197, 134, 192, 0.4); color: #c586c0; }
        .btn-next { background: rgba(197, 134, 192, 0.2); border-color: rgba(197, 134, 192, 0.4); color: #c586c0; }
        .btn-complete { background: rgba(78, 201, 176, 0.2); border-color: rgba(78, 201, 176, 0.4); color: #4ec9b0; }
        .btn-prev:disabled, .btn-next:disabled { opacity: 0.5; cursor: not-allowed; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; z-index: 10000; }
        .toast-error { background: #f44747; color: white; }
        .toast-success { background: #4ec9b0; color: #000; }
      `;
    }
  }

  if (!customElements.get('reploid-tutorial')) {
    customElements.define('reploid-tutorial', TutorialWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[TutorialWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', { element: 'reploid-tutorial', displayName: 'Tutorials' });
      },
      async destroy() { console.log('[TutorialWidget] Destroyed'); },
      async refresh() { EventBus.emit('reploid:tutorial:refresh', {}); }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-tutorial',
      displayName: 'Tutorials',
      description: 'Step-by-step guided tutorials for REPLOID features',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: { tools: ['start_tutorial', 'get_current_step', 'next_step', 'previous_step', 'complete_tutorial'] },
      category: 'learning',
      tags: ['reploid', 'tutorial', 'learning', 'guide', 'education']
    }
  };
}
