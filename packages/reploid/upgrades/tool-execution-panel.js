// @blueprint 0x00004F - Visual Tool Execution Panel
/**
 * @fileoverview Visual Tool Execution Panel for REPLOID Dashboard
 * Provides real-time visual representation of tool executions with interactive cards
 *
 * @module ToolExecutionPanel
 * @version 1.0.0
 * @category ui
 */

const ToolExecutionPanel = {
  metadata: {
    id: 'ToolExecutionPanel',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { EventBus, Utils } = deps;
    const { logger } = Utils;

    // Active and recent tool executions
    const toolExecutions = new Map();
    const MAX_HISTORY = 20;
    let containerElement = null;

    // Tool icons mapping
    const TOOL_ICONS = {
      'create_artifact': '⛿',
      'update_artifact': '✏️',
      'delete_artifact': '⛶️',
      'read_artifact': '◉️',
      'list_artifacts': '☷',
      'create_dogs_bundle': '🐕',
      'apply_dogs_bundle': '⚡',
      'verify_dogs_bundle': '✓',
      'create_cats_bundle': 'ψ',
      'introspect': '⌕',
      'analyze_code': '⚛',
      'run_tests': '⚗',
      'reflect': '☁',
      'search_reflections': '⌕',
      'create_tool': '⚒️',
      'create_web_component': '⛉',
      'visualize': '☱',
      'python_exec': '⚯',
      'default': '⚙️'
    };

    // Status colors
    const STATUS_COLORS = {
      'pending': '#ffa500',
      'running': '#4fc3f7',
      'completed': '#4caf50',
      'failed': '#f44336'
    };

    /**
     * Initialize the tool execution panel
     */
    const init = (container) => {
      logger.info('[ToolExecutionPanel] Initializing visual tool panel');

      containerElement = container;

      // Listen for tool events
      EventBus.on('tool:start', handleToolStart);
      EventBus.on('tool:complete', handleToolComplete);
      EventBus.on('tool:error', handleToolError);
      EventBus.on('tool:progress', handleToolProgress);

      renderPanel();
    };

    /**
     * Handle tool start event
     */
    const handleToolStart = (data) => {
      const { toolName, args, executionId } = data;
      const id = executionId || `${toolName}-${Date.now()}`;

      logger.info(`[ToolExecutionPanel] Tool started: ${toolName}`);

      toolExecutions.set(id, {
        id,
        toolName,
        args,
        status: 'running',
        startTime: Date.now(),
        endTime: null,
        duration: null,
        result: null,
        error: null,
        progress: 0
      });

      renderPanel();
    };

    /**
     * Handle tool complete event
     */
    const handleToolComplete = (data) => {
      const { toolName, result, executionId } = data;
      const id = executionId || findExecutionByName(toolName);

      if (!id) {
        logger.warn(`[ToolExecutionPanel] No execution found for completed tool: ${toolName}`);
        return;
      }

      const execution = toolExecutions.get(id);
      if (execution) {
        execution.status = 'completed';
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        execution.result = result;
        execution.progress = 100;

        logger.info(`[ToolExecutionPanel] Tool completed: ${toolName} (${execution.duration}ms)`);
        renderPanel();

        // Auto-cleanup old executions
        cleanupOldExecutions();
      }
    };

    /**
     * Handle tool error event
     */
    const handleToolError = (data) => {
      const { toolName, error, executionId } = data;
      const id = executionId || findExecutionByName(toolName);

      if (!id) {
        logger.warn(`[ToolExecutionPanel] No execution found for failed tool: ${toolName}`);
        return;
      }

      const execution = toolExecutions.get(id);
      if (execution) {
        execution.status = 'failed';
        execution.endTime = Date.now();
        execution.duration = execution.endTime - execution.startTime;
        execution.error = error?.message || error || 'Unknown error';

        logger.error(`[ToolExecutionPanel] Tool failed: ${toolName} - ${execution.error}`);
        renderPanel();
      }
    };

    /**
     * Handle tool progress event
     */
    const handleToolProgress = (data) => {
      const { toolName, progress, executionId } = data;
      const id = executionId || findExecutionByName(toolName);

      if (!id) return;

      const execution = toolExecutions.get(id);
      if (execution) {
        execution.progress = progress;
        renderPanel();
      }
    };

    /**
     * Find execution by tool name (for events without executionId)
     */
    const findExecutionByName = (toolName) => {
      for (const [id, execution] of toolExecutions.entries()) {
        if (execution.toolName === toolName && execution.status === 'running') {
          return id;
        }
      }
      return null;
    };

    /**
     * Clean up old completed executions
     */
    const cleanupOldExecutions = () => {
      const executions = Array.from(toolExecutions.values());
      const completed = executions.filter(e => e.status === 'completed' || e.status === 'failed');

      if (completed.length > MAX_HISTORY) {
        // Sort by end time, keep most recent
        completed.sort((a, b) => b.endTime - a.endTime);
        const toRemove = completed.slice(MAX_HISTORY);
        toRemove.forEach(e => toolExecutions.delete(e.id));
      }
    };

    /**
     * Render the entire panel
     */
    const renderPanel = () => {
      if (!containerElement) return;

      const executions = Array.from(toolExecutions.values());

      // Sort: running first, then by start time (newest first)
      executions.sort((a, b) => {
        if (a.status === 'running' && b.status !== 'running') return -1;
        if (a.status !== 'running' && b.status === 'running') return 1;
        return b.startTime - a.startTime;
      });

      const html = executions.length === 0
        ? renderEmptyState()
        : executions.map(renderToolCard).join('');

      containerElement.innerHTML = html;

      // Attach event listeners for expandable sections
      attachEventListeners();
    };

    /**
     * Render empty state
     */
    const renderEmptyState = () => {
      return `
        <div class="tool-panel-empty">
          <div class="empty-icon">⚒️</div>
          <p>No tool executions yet</p>
          <small>Tool activity will appear here when the agent starts working</small>
        </div>
      `;
    };

    /**
     * Render a single tool execution card
     */
    const renderToolCard = (execution) => {
      const icon = TOOL_ICONS[execution.toolName] || TOOL_ICONS.default;
      const statusColor = STATUS_COLORS[execution.status];
      const duration = execution.duration
        ? `${execution.duration}ms`
        : `${Date.now() - execution.startTime}ms`;

      const statusText = execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
      const timestamp = new Date(execution.startTime).toLocaleTimeString();

      return `
        <div class="tool-card" data-execution-id="${execution.id}" data-status="${execution.status}">
          <!-- Header -->
          <div class="tool-card-header">
            <div class="tool-card-title">
              <span class="tool-icon">${icon}</span>
              <span class="tool-name">${execution.toolName}</span>
              <span class="tool-status" style="color: ${statusColor}">● ${statusText}</span>
            </div>
            <div class="tool-card-meta">
              <span class="tool-time">${timestamp}</span>
              <span class="tool-duration">${duration}</span>
            </div>
          </div>

          <!-- Progress bar (only for running tools) -->
          ${execution.status === 'running' ? renderProgressBar(execution.progress) : ''}

          <!-- Parameters (expandable) -->
          ${renderParameters(execution)}

          <!-- Result/Error (expandable) -->
          ${renderOutput(execution)}
        </div>
      `;
    };

    /**
     * Render progress bar
     */
    const renderProgressBar = (progress) => {
      const percentage = Math.min(100, Math.max(0, progress));
      return `
        <div class="tool-progress">
          <div class="tool-progress-bar">
            <div class="tool-progress-fill" style="width: ${percentage}%"></div>
          </div>
          <span class="tool-progress-text">${percentage}%</span>
        </div>
      `;
    };

    /**
     * Render parameters section
     */
    const renderParameters = (execution) => {
      if (!execution.args || Object.keys(execution.args).length === 0) {
        return '';
      }

      const argsJson = JSON.stringify(execution.args, null, 2);
      const argsPreview = Object.keys(execution.args).slice(0, 3).join(', ');
      const hasMore = Object.keys(execution.args).length > 3;

      return `
        <div class="tool-section">
          <button class="tool-section-toggle" data-section="params-${execution.id}">
            <span class="toggle-icon">▶</span>
            <span class="section-label">Parameters</span>
            <span class="section-preview">${argsPreview}${hasMore ? ', ...' : ''}</span>
          </button>
          <div class="tool-section-content hidden" id="params-${execution.id}">
            <pre class="tool-json">${escapeHtml(argsJson)}</pre>
          </div>
        </div>
      `;
    };

    /**
     * Render output/result section
     */
    const renderOutput = (execution) => {
      if (execution.status === 'running') {
        return '';
      }

      if (execution.status === 'failed') {
        return `
          <div class="tool-section">
            <button class="tool-section-toggle error" data-section="error-${execution.id}">
              <span class="toggle-icon">▶</span>
              <span class="section-label">Error</span>
            </button>
            <div class="tool-section-content hidden" id="error-${execution.id}">
              <pre class="tool-error">${escapeHtml(execution.error)}</pre>
            </div>
          </div>
        `;
      }

      if (execution.status === 'completed' && execution.result) {
        const resultJson = typeof execution.result === 'string'
          ? execution.result
          : JSON.stringify(execution.result, null, 2);

        const preview = resultJson.length > 50
          ? resultJson.substring(0, 50) + '...'
          : resultJson;

        return `
          <div class="tool-section">
            <button class="tool-section-toggle success" data-section="result-${execution.id}">
              <span class="toggle-icon">▶</span>
              <span class="section-label">Result</span>
              <span class="section-preview">${escapeHtml(preview)}</span>
            </button>
            <div class="tool-section-content hidden" id="result-${execution.id}">
              <pre class="tool-result">${escapeHtml(resultJson)}</pre>
            </div>
          </div>
        `;
      }

      return '';
    };

    /**
     * Attach event listeners for interactive elements
     */
    const attachEventListeners = () => {
      if (!containerElement) return;

      // Toggle section visibility
      containerElement.querySelectorAll('.tool-section-toggle').forEach(button => {
        button.addEventListener('click', (e) => {
          e.preventDefault();
          const sectionId = button.dataset.section;
          const content = document.getElementById(sectionId);
          const icon = button.querySelector('.toggle-icon');

          if (content) {
            content.classList.toggle('hidden');
            icon.textContent = content.classList.contains('hidden') ? '▶' : '▼';
          }
        });
      });
    };

    /**
     * Escape HTML for safe rendering
     */
    const escapeHtml = (text) => {
      const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      };
      return String(text).replace(/[&<>"']/g, m => map[m]);
    };

    /**
     * Clear all tool executions
     */
    const clear = () => {
      toolExecutions.clear();
      renderPanel();
    };

    /**
     * Get current executions
     */
    const getExecutions = () => {
      return Array.from(toolExecutions.values());
    };

    // Web Component Widget
    class ToolExecutionPanelWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 2 seconds
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const executions = Array.from(toolExecutions.values());
        const running = executions.filter(e => e.status === 'running').length;
        const completed = executions.filter(e => e.status === 'completed').length;
        const failed = executions.filter(e => e.status === 'failed').length;

        return {
          state: running > 0 ? 'active' : 'idle',
          primaryMetric: `${executions.length} tools`,
          secondaryMetric: running > 0 ? `${running} running` : 'Idle',
          lastActivity: executions.length > 0 ? Math.max(...executions.map(e => e.startTime)) : null,
          message: failed > 0 ? `${failed} failed` : `${completed} completed`
        };
      }

      getControls() {
        return [
          {
            id: 'clear-panel',
            label: '⛶️ Clear Panel',
            action: () => {
              clear();
              this.render();
              logger.info('[ToolExecutionPanel] Widget: Panel cleared');
              return { success: true, message: 'Panel cleared' };
            }
          }
        ];
      }

      render() {
        const executions = Array.from(toolExecutions.values());
        const running = executions.filter(e => e.status === 'running');
        const completed = executions.filter(e => e.status === 'completed');
        const failed = executions.filter(e => e.status === 'failed');

        const avgDuration = completed.length > 0
          ? (completed.reduce((sum, e) => sum + (e.duration || 0), 0) / completed.length).toFixed(0)
          : 0;

        // Tool usage breakdown
        const toolCounts = {};
        executions.forEach(e => {
          toolCounts[e.toolName] = (toolCounts[e.toolName] || 0) + 1;
        });

        const topTools = Object.entries(toolCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5);

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }
            .widget-panel {
              padding: 12px;
              color: #fff;
            }
            h3 {
              margin: 0 0 12px 0;
              font-size: 1em;
              color: #0ff;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(4, 1fr);
              gap: 8px;
              margin-top: 12px;
            }
            .stat-card {
              padding: 12px;
              border-radius: 4px;
            }
          </style>
          <div class="widget-panel">
            <h3>☱ Panel Statistics</h3>
            <div class="stats-grid">
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Total</div>
                <div style="font-size: 1.3em; font-weight: bold;">${executions.length}</div>
              </div>
              <div style="padding: 12px; background: rgba(255,165,0,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Running</div>
                <div style="font-size: 1.3em; font-weight: bold;">${running.length}</div>
              </div>
              <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Completed</div>
                <div style="font-size: 1.3em; font-weight: bold;">${completed.length}</div>
              </div>
              <div style="padding: 12px; background: ${failed.length > 0 ? 'rgba(255,0,0,0.1)' : 'rgba(255,255,255,0.05)'}; border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Failed</div>
                <div style="font-size: 1.3em; font-weight: bold; color: ${failed.length > 0 ? '#ff6b6b' : 'inherit'};">${failed.length}</div>
              </div>
            </div>

            ${running.length > 0 ? `
              <h3 style="margin-top: 20px;">↻ Currently Running</h3>
              <div style="margin-top: 12px;">
                ${running.map(exec => {
                  const duration = Date.now() - exec.startTime;
                  const icon = TOOL_ICONS[exec.toolName] || TOOL_ICONS.default;

                  return `
                    <div style="padding: 8px; background: rgba(255,165,0,0.1); border-radius: 4px; margin-bottom: 6px;">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span>${icon}</span>
                          <strong>${exec.toolName}</strong>
                        </div>
                        <span style="color: #ffa500; font-size: 0.85em;">${(duration / 1000).toFixed(1)}s</span>
                      </div>
                      ${exec.progress > 0 ? `
                        <div style="margin-top: 6px; background: rgba(0,0,0,0.3); height: 6px; border-radius: 3px; overflow: hidden;">
                          <div style="height: 100%; background: linear-gradient(90deg, #4fc3f7, #0c0); width: ${exec.progress}%; transition: width 0.3s;"></div>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            ${topTools.length > 0 ? `
              <h3 style="margin-top: 20px;">☄ Most Used Tools</h3>
              <div style="margin-top: 12px;">
                ${topTools.map(([toolName, count], idx) => {
                  const icon = TOOL_ICONS[toolName] || TOOL_ICONS.default;

                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 4px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #666; font-size: 0.85em;">#${idx + 1}</span>
                        <span>${icon}</span>
                        <span>${toolName}</span>
                      </div>
                      <span style="font-weight: bold; color: #6496ff;">${count}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            ${failed.length > 0 ? `
              <h3 style="margin-top: 20px;">⚠️ Recent Failures</h3>
              <div style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
                ${failed.slice(-5).reverse().map(exec => {
                  const timeAgo = Math.floor((Date.now() - exec.endTime) / 1000);
                  const icon = TOOL_ICONS[exec.toolName] || TOOL_ICONS.default;

                  return `
                    <div style="padding: 8px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff6b6b; border-radius: 4px; margin-bottom: 6px;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <span>${icon}</span>
                          <strong style="color: #ff6b6b;">${exec.toolName}</strong>
                        </div>
                        <span style="color: #666; font-size: 0.85em;">${timeAgo}s ago</span>
                      </div>
                      <div style="font-size: 0.85em; color: #aaa;">
                        ${exec.error.substring(0, 80)}${exec.error.length > 80 ? '...' : ''}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
              <strong>⚒️ Execution Panel Info</strong>
              <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                Tracking ${executions.length} tool executions (max ${MAX_HISTORY} in history)<br>
                Average duration: ${avgDuration}ms<br>
                Success rate: ${completed.length > 0 ? ((completed.length / (completed.length + failed.length)) * 100).toFixed(1) : 0}%
              </div>
            </div>
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'tool-execution-panel-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ToolExecutionPanelWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Tool Execution Panel',
      icon: '⚒️',
      category: 'ui'
    };

    return {
      api: {
        init,
        clear,
        getExecutions,
        renderPanel
      },
      widget
    };
  }
};

// Export
export default ToolExecutionPanel;
