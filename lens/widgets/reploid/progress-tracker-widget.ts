/**
 * Reploid Progress Tracker Widget
 *
 * Visual progress tracking for agent workflows and tasks
 * Displays current progress with step-by-step breakdown
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

let mockProgressData: any;
if (USE_MOCK_DATA) {
  mockProgressData = {
    "current_task": "Implementing authentication feature",
    "steps": [
      { "name": "Analyze codebase", "status": "completed" },
      { "name": "Curate context", "status": "completed" },
      { "name": "Design solution", "status": "in_progress", "progress": 65 },
      { "name": "Implement changes", "status": "pending" },
      { "name": "Test and verify", "status": "pending" }
    ],
    "overall_progress": 45
  };
}

export default function createProgressTrackerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class ProgressTrackerWidget extends HTMLElement {
    private pollInterval: any;
    private progress: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      if (USE_MOCK_DATA) {
        this.progress = mockProgressData;
        this.render();
      } else {
        // Subscribe to progress updates
        const unsubProgress = EventBus.on('agent:progress', (data: any) => {
          this.progress = data;
          this.render();
        });
        this.unsubscribers.push(unsubProgress);

        // Subscribe to state changes
        const unsubStateChange = EventBus.on('fsm:state:changed', () => {
          this.pollProgress();
        });
        this.unsubscribers.push(unsubStateChange);

        // Poll for progress
        this.startPolling();
      }
    }

    disconnectedCallback() {
      if (this.pollInterval) {
        clearInterval(this.pollInterval);
      }
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async pollProgress() {
      try {
        const result = await MCPBridge.callTool(
          'agent-control',
          'get_cycle_state',
          {}
        );

        if (result.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);

          // Transform agent state into progress data
          this.progress = {
            current_task: data.goal || 'No active task',
            steps: this.deriveSteps(data.state),
            overall_progress: this.calculateProgress(data.state)
          };

          this.render();
        }
      } catch (error) {
        console.error('[ProgressTracker] Failed to fetch progress:', error);
      }
    }

    private deriveSteps(state: string): any[] {
      const stateSteps: Record<string, number> = {
        'IDLE': 0,
        'CURATING_CONTEXT': 1,
        'AWAITING_CONTEXT_APPROVAL': 2,
        'PLANNING_WITH_CONTEXT': 3,
        'DRAFTING_PROPOSAL': 4,
        'AWAITING_PROPOSAL_APPROVAL': 5,
        'APPLYING_CHANGES': 6,
        'GOAL_COMPLETE': 7
      };

      const allSteps = [
        { name: 'Start', status: 'completed' },
        { name: 'Curate context', status: 'pending' },
        { name: 'Context approval', status: 'pending' },
        { name: 'Plan solution', status: 'pending' },
        { name: 'Draft proposal', status: 'pending' },
        { name: 'Proposal approval', status: 'pending' },
        { name: 'Apply changes', status: 'pending' },
        { name: 'Complete', status: 'pending' }
      ];

      const currentStep = stateSteps[state] || 0;

      return allSteps.map((step, index) => {
        if (index < currentStep) {
          return { ...step, status: 'completed' };
        } else if (index === currentStep) {
          return { ...step, status: 'in_progress' };
        } else {
          return step;
        }
      });
    }

    private calculateProgress(state: string): number {
      const stateProgress: Record<string, number> = {
        'IDLE': 0,
        'CURATING_CONTEXT': 15,
        'AWAITING_CONTEXT_APPROVAL': 25,
        'PLANNING_WITH_CONTEXT': 40,
        'DRAFTING_PROPOSAL': 60,
        'AWAITING_PROPOSAL_APPROVAL': 75,
        'APPLYING_CHANGES': 90,
        'GOAL_COMPLETE': 100
      };
      return stateProgress[state] || 0;
    }

    private async startPolling() {
      await this.pollProgress();
      this.pollInterval = setInterval(() => this.pollProgress(), 3000);
    }

    private getStatusIcon(status: string): string {
      switch (status) {
        case 'completed': return '✓';
        case 'in_progress': return '⟳';
        case 'pending': return '○';
        default: return '○';
      }
    }

    private getStatusColor(status: string): string {
      switch (status) {
        case 'completed': return '#51cf66';
        case 'in_progress': return '#4dabf7';
        case 'pending': return '#868e96';
        default: return '#868e96';
      }
    }

    private render() {
      if (!this.shadowRoot) return;

      const progress = this.progress;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
            padding: 1rem;
          }

          .progress-tracker {
            display: flex;
            flex-direction: column;
            gap: 1rem;
          }

          .current-task {
            font-size: 1rem;
            font-weight: 600;
            color: #e0e0e0;
            margin-bottom: 0.5rem;
          }

          .overall-progress {
            margin-bottom: 1rem;
          }

          .progress-bar-container {
            width: 100%;
            height: 8px;
            background: #333;
            border-radius: 4px;
            overflow: hidden;
          }

          .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4dabf7, #51cf66);
            transition: width 0.5s ease;
          }

          .progress-percentage {
            text-align: right;
            font-size: 0.875rem;
            color: #888;
            margin-top: 0.25rem;
          }

          .steps {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
          }

          .step {
            display: flex;
            align-items: center;
            gap: 0.75rem;
          }

          .step-icon {
            font-size: 1.25rem;
            width: 24px;
            text-align: center;
          }

          .step-content {
            flex: 1;
          }

          .step-name {
            font-size: 0.875rem;
            color: #e0e0e0;
          }

          .step-progress {
            width: 100%;
            height: 4px;
            background: #333;
            border-radius: 2px;
            margin-top: 0.25rem;
            overflow: hidden;
          }

          .step-progress-fill {
            height: 100%;
            background: #4dabf7;
            transition: width 0.3s ease;
          }

          .empty {
            text-align: center;
            padding: 2rem;
            color: #666;
          }
        </style>

        <div class="progress-tracker">
          ${progress ? `
            <div class="current-task">${progress.current_task}</div>

            <div class="overall-progress">
              <div class="progress-bar-container">
                <div class="progress-bar-fill" style="width: ${progress.overall_progress}%"></div>
              </div>
              <div class="progress-percentage">${progress.overall_progress}% complete</div>
            </div>

            <div class="steps">
              ${progress.steps.map((step: any) => `
                <div class="step">
                  <div class="step-icon" style="color: ${this.getStatusColor(step.status)}">
                    ${this.getStatusIcon(step.status)}
                  </div>
                  <div class="step-content">
                    <div class="step-name">${step.name}</div>
                    ${step.progress !== undefined ? `
                      <div class="step-progress">
                        <div class="step-progress-fill" style="width: ${step.progress}%"></div>
                      </div>
                    ` : ''}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : `
            <div class="empty">No active task</div>
          `}
        </div>
      `;
    }
  }

  customElements.define('reploid-progress-tracker', ProgressTrackerWidget);

  return {
    factory: () => {
      return new ProgressTrackerWidget();
    }
  };
}
