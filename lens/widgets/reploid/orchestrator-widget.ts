/**
 * Reploid Orchestrator Widget
 *
 * Task tree visualization and scheduling controls
 * Hierarchical view of autonomous agent tasks with state management
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockOrchestratorData: any;
if (USE_MOCK_DATA) {
  mockOrchestratorData = {
    tasks: [
      {
        id: 't1',
        name: 'Build MCP Servers',
        status: 'in_progress',
        progress: 60,
        dependencies: [],
        subtasks: [
          { id: 't1.1', name: 'Create config server', status: 'completed', progress: 100 },
          { id: 't1.2', name: 'Create VFS server', status: 'completed', progress: 100 },
          { id: 't1.3', name: 'Create tool-runner server', status: 'in_progress', progress: 50 },
          { id: 't1.4', name: 'Create state server', status: 'pending', progress: 0 }
        ]
      },
      {
        id: 't2',
        name: 'Build Lens Widgets',
        status: 'pending',
        progress: 0,
        dependencies: ['t1'],
        subtasks: [
          { id: 't2.1', name: 'Create config widget', status: 'pending', progress: 0 },
          { id: 't2.2', name: 'Create VFS widget', status: 'pending', progress: 0 }
        ]
      },
      {
        id: 't3',
        name: 'Integration Testing',
        status: 'blocked',
        progress: 0,
        dependencies: ['t1', 't2'],
        subtasks: []
      }
    ]
  };
}

export default function createOrchestratorWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class OrchestratorWidget extends HTMLElement {
    private taskTree: any = null;
    private expandedTasks: Set<string> = new Set();
    private selectedTask: string | null = null;
    private autoRefresh: boolean = true;
    private refreshInterval: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to orchestrator events
      const unsubRefresh = EventBus.on('reploid:orchestrator:refresh', () => {
        this.loadTaskTree();
      });
      this.unsubscribers.push(unsubRefresh);

      const unsubUpdate = EventBus.on('reploid:orchestrator:updated', () => {
        this.loadTaskTree();
      });
      this.unsubscribers.push(unsubUpdate);

      // Initial load
      this.loadTaskTree();

      // Auto-refresh every 5 seconds
      this.startAutoRefresh();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
      this.stopAutoRefresh();
    }

    private startAutoRefresh() {
      if (this.autoRefresh && !this.refreshInterval) {
        this.refreshInterval = setInterval(() => {
          this.loadTaskTree();
        }, 5000);
      }
    }

    private stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    private toggleAutoRefresh() {
      this.autoRefresh = !this.autoRefresh;
      if (this.autoRefresh) {
        this.startAutoRefresh();
      } else {
        this.stopAutoRefresh();
      }
      this.render();
    }

    private async loadTaskTree() {
      if (USE_MOCK_DATA) {
        this.taskTree = mockOrchestratorData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_task_tree',
          {}
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.taskTree = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load task tree:', error);
        this.showError('Failed to load task tree');
      }
    }

    private async pauseTask(taskId: string) {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Pausing task:', taskId);
        this.showSuccess('Task paused (mock mode)');
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'pause_task',
          { task_id: taskId }
        );

        this.showSuccess('Task paused');
        EventBus.emit('reploid:orchestrator:updated', { task_id: taskId, action: 'pause' });
        await this.loadTaskTree();
      } catch (error) {
        console.error('Failed to pause task:', error);
        this.showError('Failed to pause task');
      }
    }

    private async resumeTask(taskId: string) {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Resuming task:', taskId);
        this.showSuccess('Task resumed (mock mode)');
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'resume_task',
          { task_id: taskId }
        );

        this.showSuccess('Task resumed');
        EventBus.emit('reploid:orchestrator:updated', { task_id: taskId, action: 'resume' });
        await this.loadTaskTree();
      } catch (error) {
        console.error('Failed to resume task:', error);
        this.showError('Failed to resume task');
      }
    }

    private async cancelTask(taskId: string) {
      if (!confirm('Cancel this task?')) {
        return;
      }

      if (USE_MOCK_DATA) {
        console.log('MOCK: Cancelling task:', taskId);
        this.showSuccess('Task cancelled (mock mode)');
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'cancel_task',
          { task_id: taskId }
        );

        this.showSuccess('Task cancelled');
        EventBus.emit('reploid:orchestrator:updated', { task_id: taskId, action: 'cancel' });
        await this.loadTaskTree();
      } catch (error) {
        console.error('Failed to cancel task:', error);
        this.showError('Failed to cancel task');
      }
    }

    private async scheduleTask() {
      const taskName = prompt('Task name:');
      if (!taskName) return;

      const dependencies = prompt('Dependencies (comma-separated IDs, or leave empty):');
      const depArray = dependencies ? dependencies.split(',').map(d => d.trim()).filter(Boolean) : [];

      if (USE_MOCK_DATA) {
        console.log('MOCK: Creating task:', taskName, 'with deps:', depArray);
        this.showSuccess('Task scheduled (mock mode)');
        return;
      }

      try {
        await MCPBridge.callTool(
          serverInfo.serverName,
          'schedule_tasks',
          { tasks: [{ name: taskName, dependencies: depArray }] }
        );

        this.showSuccess('Task scheduled');
        EventBus.emit('reploid:orchestrator:updated', { action: 'schedule' });
        await this.loadTaskTree();
      } catch (error) {
        console.error('Failed to schedule task:', error);
        this.showError('Failed to schedule task');
      }
    }

    private toggleTask(taskId: string) {
      if (this.expandedTasks.has(taskId)) {
        this.expandedTasks.delete(taskId);
      } else {
        this.expandedTasks.add(taskId);
      }
      this.render();
    }

    private selectTask(taskId: string) {
      this.selectedTask = taskId;
      this.render();
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

      if (!this.taskTree) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="orchestrator-empty">
            <div class="empty-icon">🎯</div>
            <div class="empty-text">Loading task tree...</div>
          </div>
        `;
        return;
      }

      const stats = this.calculateStats();

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="orchestrator-widget">
          <div class="orchestrator-header">
            <h3>🎯 Task Orchestrator</h3>
            <div class="header-stats">
              <span class="stat-badge status-completed">${stats.completed}</span>
              <span class="stat-badge status-in_progress">${stats.in_progress}</span>
              <span class="stat-badge status-pending">${stats.pending}</span>
              <span class="stat-badge status-blocked">${stats.blocked}</span>
            </div>
            <div class="header-actions">
              <label class="auto-refresh-toggle">
                <input type="checkbox" ${this.autoRefresh ? 'checked' : ''}>
                <span>Auto</span>
              </label>
              <button class="btn-schedule">+ Schedule</button>
              <button class="btn-refresh">⟳</button>
            </div>
          </div>

          <div class="orchestrator-content">
            <div class="task-tree">
              ${this.taskTree.tasks.length === 0 ? `
                <div class="empty-state">
                  <div class="empty-icon">📋</div>
                  <div class="empty-text">No tasks scheduled</div>
                </div>
              ` : `
                ${this.taskTree.tasks.map((task: any) => this.renderTask(task, 0)).join('')}
              `}
            </div>

            ${this.selectedTask ? this.renderTaskDetails() : ''}
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private renderTask(task: any, depth: number): string {
      const isExpanded = this.expandedTasks.has(task.id);
      const isSelected = this.selectedTask === task.id;
      const hasSubtasks = task.subtasks && task.subtasks.length > 0;
      const indent = depth * 20;

      const statusIcon = {
        completed: '✅',
        in_progress: '🔄',
        pending: '⏸️',
        blocked: '🚫',
        paused: '⏸️'
      }[task.status] || '❓';

      const expandIcon = hasSubtasks ? (isExpanded ? '▼' : '▶') : '•';

      return `
        <div class="task-node ${isSelected ? 'selected' : ''}" style="padding-left: ${indent}px;">
          <div class="task-header" data-task-id="${task.id}">
            <span class="expand-icon ${hasSubtasks ? 'expandable' : ''}" data-task-id="${task.id}">
              ${expandIcon}
            </span>
            <span class="task-status">${statusIcon}</span>
            <span class="task-name">${this.escapeHtml(task.name)}</span>
            <span class="task-progress">${task.progress || 0}%</span>

            <div class="task-actions">
              ${task.status === 'in_progress' ? `
                <button class="btn-icon btn-pause" data-task-id="${task.id}" title="Pause">⏸</button>
              ` : task.status === 'paused' || task.status === 'pending' ? `
                <button class="btn-icon btn-resume" data-task-id="${task.id}" title="Resume">▶</button>
              ` : ''}
              <button class="btn-icon btn-cancel" data-task-id="${task.id}" title="Cancel">✕</button>
            </div>
          </div>

          ${task.dependencies && task.dependencies.length > 0 ? `
            <div class="task-dependencies" style="padding-left: ${indent + 40}px;">
              <span class="dep-label">Depends on:</span>
              ${task.dependencies.map((dep: string) => `<span class="dep-tag">${dep}</span>`).join('')}
            </div>
          ` : ''}

          ${isExpanded && hasSubtasks ? `
            <div class="task-subtasks">
              ${task.subtasks.map((subtask: any) => this.renderTask(subtask, depth + 1)).join('')}
            </div>
          ` : ''}

          <div class="task-progress-bar">
            <div class="progress-fill status-${task.status}" style="width: ${task.progress || 0}%"></div>
          </div>
        </div>
      `;
    }

    private renderTaskDetails(): string {
      const task = this.findTask(this.selectedTask!);
      if (!task) return '';

      return `
        <div class="task-details-panel">
          <div class="details-header">
            <h4>Task Details</h4>
            <button class="btn-close-details">✕</button>
          </div>
          <div class="details-content">
            <div class="detail-row">
              <span class="detail-label">ID:</span>
              <span class="detail-value">${task.id}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Name:</span>
              <span class="detail-value">${this.escapeHtml(task.name)}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Status:</span>
              <span class="detail-value status-${task.status}">${task.status}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">Progress:</span>
              <span class="detail-value">${task.progress || 0}%</span>
            </div>
            ${task.dependencies && task.dependencies.length > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Dependencies:</span>
                <span class="detail-value">${task.dependencies.join(', ')}</span>
              </div>
            ` : ''}
            ${task.subtasks && task.subtasks.length > 0 ? `
              <div class="detail-row">
                <span class="detail-label">Subtasks:</span>
                <span class="detail-value">${task.subtasks.length} subtasks</span>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }

    private findTask(taskId: string): any {
      const searchTasks = (tasks: any[]): any => {
        for (const task of tasks) {
          if (task.id === taskId) return task;
          if (task.subtasks) {
            const found = searchTasks(task.subtasks);
            if (found) return found;
          }
        }
        return null;
      };

      return searchTasks(this.taskTree.tasks);
    }

    private calculateStats() {
      const stats = {
        completed: 0,
        in_progress: 0,
        pending: 0,
        blocked: 0
      };

      const countTasks = (tasks: any[]) => {
        tasks.forEach(task => {
          if (task.status === 'completed') stats.completed++;
          else if (task.status === 'in_progress') stats.in_progress++;
          else if (task.status === 'pending') stats.pending++;
          else if (task.status === 'blocked') stats.blocked++;

          if (task.subtasks) {
            countTasks(task.subtasks);
          }
        });
      };

      countTasks(this.taskTree.tasks);
      return stats;
    }

    private attachEventListeners() {
      // Auto-refresh toggle
      this.shadowRoot?.querySelector('.auto-refresh-toggle input')?.addEventListener('change', () => {
        this.toggleAutoRefresh();
      });

      // Refresh button
      this.shadowRoot?.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadTaskTree();
      });

      // Schedule button
      this.shadowRoot?.querySelector('.btn-schedule')?.addEventListener('click', () => {
        this.scheduleTask();
      });

      // Expand icons
      const expandIcons = this.shadowRoot?.querySelectorAll('.expand-icon.expandable');
      expandIcons?.forEach(icon => {
        icon.addEventListener('click', (e) => {
          e.stopPropagation();
          const taskId = (icon as HTMLElement).dataset.taskId;
          if (taskId) this.toggleTask(taskId);
        });
      });

      // Task headers (select)
      const taskHeaders = this.shadowRoot?.querySelectorAll('.task-header');
      taskHeaders?.forEach(header => {
        header.addEventListener('click', () => {
          const taskId = (header as HTMLElement).dataset.taskId;
          if (taskId) this.selectTask(taskId);
        });
      });

      // Pause buttons
      const pauseBtns = this.shadowRoot?.querySelectorAll('.btn-pause');
      pauseBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const taskId = (btn as HTMLElement).dataset.taskId;
          if (taskId) this.pauseTask(taskId);
        });
      });

      // Resume buttons
      const resumeBtns = this.shadowRoot?.querySelectorAll('.btn-resume');
      resumeBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const taskId = (btn as HTMLElement).dataset.taskId;
          if (taskId) this.resumeTask(taskId);
        });
      });

      // Cancel buttons
      const cancelBtns = this.shadowRoot?.querySelectorAll('.btn-cancel');
      cancelBtns?.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const taskId = (btn as HTMLElement).dataset.taskId;
          if (taskId) this.cancelTask(taskId);
        });
      });

      // Close details button
      this.shadowRoot?.querySelector('.btn-close-details')?.addEventListener('click', () => {
        this.selectedTask = null;
        this.render();
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

        .orchestrator-empty {
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

        .orchestrator-widget {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .orchestrator-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .orchestrator-header h3 {
          margin: 0;
          color: #b5cea8;
          font-size: 16px;
          font-weight: bold;
        }

        .header-stats {
          display: flex;
          gap: 6px;
          flex: 1;
        }

        .stat-badge {
          padding: 4px 10px;
          font-size: 11px;
          font-weight: bold;
          border-radius: 12px;
        }

        .stat-badge.status-completed {
          background: rgba(78, 201, 176, 0.3);
          color: #4ec9b0;
        }

        .stat-badge.status-in_progress {
          background: rgba(79, 193, 255, 0.3);
          color: #4fc1ff;
        }

        .stat-badge.status-pending {
          background: rgba(206, 145, 120, 0.3);
          color: #ce9178;
        }

        .stat-badge.status-blocked {
          background: rgba(244, 71, 71, 0.3);
          color: #f44747;
        }

        .header-actions {
          display: flex;
          gap: 8px;
          align-items: center;
        }

        .auto-refresh-toggle {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: #888;
          cursor: pointer;
        }

        .auto-refresh-toggle input {
          cursor: pointer;
        }

        .btn-schedule {
          padding: 6px 12px;
          background: rgba(181, 206, 168, 0.2);
          border: 1px solid rgba(181, 206, 168, 0.4);
          color: #b5cea8;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
        }

        .btn-refresh {
          padding: 6px 12px;
          background: rgba(181, 206, 168, 0.2);
          border: 1px solid rgba(181, 206, 168, 0.4);
          color: #b5cea8;
          cursor: pointer;
          font-size: 14px;
        }

        .orchestrator-content {
          flex: 1;
          display: flex;
          overflow: hidden;
        }

        .task-tree {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .empty-state {
          padding: 60px 20px;
          text-align: center;
        }

        .task-node {
          border-bottom: 1px solid #333;
          transition: background 0.2s;
        }

        .task-node:hover {
          background: rgba(181, 206, 168, 0.05);
        }

        .task-node.selected {
          background: rgba(181, 206, 168, 0.15);
        }

        .task-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          cursor: pointer;
        }

        .expand-icon {
          width: 16px;
          text-align: center;
          font-size: 10px;
          color: #888;
        }

        .expand-icon.expandable {
          cursor: pointer;
        }

        .expand-icon.expandable:hover {
          color: #b5cea8;
        }

        .task-status {
          font-size: 16px;
        }

        .task-name {
          flex: 1;
          font-size: 12px;
          color: #e0e0e0;
        }

        .task-progress {
          font-size: 11px;
          color: #888;
          min-width: 40px;
          text-align: right;
        }

        .task-actions {
          display: flex;
          gap: 4px;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .task-node:hover .task-actions {
          opacity: 1;
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

        .task-dependencies {
          padding: 4px 12px 8px;
          font-size: 10px;
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .dep-label {
          color: #888;
        }

        .dep-tag {
          padding: 2px 6px;
          background: rgba(86, 156, 214, 0.2);
          border: 1px solid rgba(86, 156, 214, 0.4);
          color: #569cd6;
        }

        .task-progress-bar {
          height: 3px;
          background: rgba(30, 30, 30, 0.8);
        }

        .progress-fill {
          height: 100%;
          transition: width 0.3s ease;
        }

        .progress-fill.status-completed {
          background: #4ec9b0;
        }

        .progress-fill.status-in_progress {
          background: #4fc1ff;
        }

        .progress-fill.status-pending {
          background: #ce9178;
        }

        .progress-fill.status-blocked {
          background: #f44747;
        }

        .task-details-panel {
          width: 300px;
          border-left: 2px solid #333;
          background: rgba(30, 30, 30, 0.8);
          display: flex;
          flex-direction: column;
        }

        .details-header {
          padding: 16px;
          border-bottom: 1px solid #444;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .details-header h4 {
          margin: 0;
          color: #b5cea8;
          font-size: 14px;
        }

        .btn-close-details {
          background: none;
          border: none;
          color: #888;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
        }

        .btn-close-details:hover {
          color: #fff;
        }

        .details-content {
          padding: 16px;
          overflow-y: auto;
        }

        .detail-row {
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .detail-label {
          font-size: 10px;
          color: #888;
          text-transform: uppercase;
        }

        .detail-value {
          font-size: 12px;
          color: #e0e0e0;
        }

        .detail-value.status-completed {
          color: #4ec9b0;
        }

        .detail-value.status-in_progress {
          color: #4fc1ff;
        }

        .detail-value.status-pending {
          color: #ce9178;
        }

        .detail-value.status-blocked {
          color: #f44747;
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
  if (!customElements.get('reploid-orchestrator')) {
    customElements.define('reploid-orchestrator', OrchestratorWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[OrchestratorWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-orchestrator',
          displayName: 'Task Orchestrator'
        });
      },
      async destroy() {
        console.log('[OrchestratorWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-orchestrator',
          displayName: 'Task Orchestrator'
        });
      },
      async refresh() {
        console.log('[OrchestratorWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-orchestrator',
          displayName: 'Task Orchestrator'
        });
        EventBus.emit('reploid:orchestrator:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-orchestrator',
      displayName: 'Task Orchestrator',
      description: 'Visualize and control autonomous task execution with dependency management',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_task_tree', 'get_task_status', 'pause_task', 'resume_task', 'cancel_task', 'schedule_tasks']
      },
      category: 'orchestration',
      tags: ['reploid', 'orchestrator', 'tasks', 'scheduling', 'workflow']
    }
  };
}
