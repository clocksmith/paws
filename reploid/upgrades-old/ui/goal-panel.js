// @blueprint 0x00005C - Goal Panel Module
// Goal Panel UI Component for REPLOID Agent
// Provides bidirectional goal management with history tracking
// CLUSTER 2 Phase 7 Implementation

const GoalPanel = {
  metadata: {
    id: 'GoalPanel',
    version: '1.0.0',
    description: 'Bidirectional goal management panel with history tracking',
    features: [
      'Real-time goal display from agent',
      'Inline goal editing capability',
      'Goal history breadcrumbs (50 item limit)',
      'Export goal history to markdown',
      'Feature flag support for incremental rollout'
    ],
    dependencies: ['EventBus', 'Utils', 'StateManager?', 'GoalModifier?'],
    async: false,
    type: 'ui-core',
    widget: {
      element: 'goal-panel-widget',
      displayName: 'Agent Goal',
      visible: false,  // Hidden from ModuleDashboard (core UI)
      category: 'core-ui'
    }
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager, GoalModifier } = deps;
    const { logger, escapeHtml } = Utils;

    // Closure state
    let container = null;
    let currentGoal = '';
    let goalHistory = [];  // Array of {timestamp, goal}
    const MAX_HISTORY = 50;
    let isEditing = false;
    let lastActivity = null;

    // Event listener tracking for cleanup
    const eventListeners = {
      goalSet: null,
      panelShow: null,
      panelHide: null
    };

    // Cleanup function (prevents memory leaks)
    const cleanup = () => {
      if (eventListeners.goalSet) {
        EventBus.off('goal:set', eventListeners.goalSet);
        eventListeners.goalSet = null;
      }
      if (eventListeners.panelShow) {
        EventBus.off('ui:panel-show', eventListeners.panelShow);
        eventListeners.panelShow = null;
      }
      if (eventListeners.panelHide) {
        EventBus.off('ui:panel-hide', eventListeners.panelHide);
        eventListeners.panelHide = null;
      }
      logger.info('[GoalPanel] Cleanup complete');
    };

    // Initialize the goal panel
    const init = (containerId) => {
      logger.info('[GoalPanel] init() called with containerId:', containerId);

      // Clean up any existing listeners first
      cleanup();

      container = document.getElementById(containerId);

      if (!container) {
        logger.error('[GoalPanel] Container not found:', containerId);
        EventBus.emit('ui:panel-error', {
          panel: 'GoalPanel',
          error: 'Container not found',
          timestamp: Date.now()
        });
        return;
      }

      // Add styles if not already present (idempotent)
      if (!document.getElementById('goal-panel-styles')) {
        const styles = document.createElement('style');
        styles.id = 'goal-panel-styles';
        styles.innerHTML = getGoalPanelStyles();
        document.head.appendChild(styles);
      }

      // Register event listeners and store references
      eventListeners.goalSet = handleGoalSet;
      eventListeners.panelShow = () => {
        logger.debug('[GoalPanel] Panel shown');
      };
      eventListeners.panelHide = () => {
        logger.debug('[GoalPanel] Panel hidden');
      };

      EventBus.on('goal:set', eventListeners.goalSet);
      EventBus.on('ui:panel-show', eventListeners.panelShow);
      EventBus.on('ui:panel-hide', eventListeners.panelHide);

      // Render initial state
      render();

      logger.info('[GoalPanel] Initialized successfully');
      EventBus.emit('ui:panel-ready', {
        panel: 'GoalPanel',
        mode: 'modular',
        timestamp: Date.now()
      });
    };

    // Handle incoming goal:set events
    const handleGoalSet = (goalText) => {
      // Feature flag check (prevents duplicate UI)
      const featureFlags = window.reploidConfig?.featureFlags;
      if (featureFlags && !featureFlags.useModularPanels?.GoalPanel) {
        return;  // Panel disabled, skip rendering
      }

      setGoal(goalText);
      addToHistory(goalText);
    };

    // Set current goal (from EventBus goal:set)
    const setGoal = (text) => {
      currentGoal = text || '';
      lastActivity = Date.now();
      isEditing = false;
      addToHistory(text);  // Track in history
      render();
      logger.debug('[GoalPanel] Goal set:', text);
    };

    // Get current goal text
    const getGoal = () => currentGoal;

    // Enter inline editing mode
    const editGoal = () => {
      isEditing = true;
      render();
      logger.debug('[GoalPanel] Edit mode enabled');
    };

    // Save edited goal
    const saveEdit = async (newGoal) => {
      // Validate with GoalModifier if available
      if (GoalModifier) {
        try {
          const isValid = await GoalModifier.validateGoal(newGoal);
          if (!isValid) {
            logger.error('[GoalPanel] Invalid goal:', newGoal);
            // Show error in UI
            showError('Goal validation failed');
            return;
          }
        } catch (err) {
          logger.warn('[GoalPanel] GoalModifier validation error:', err);
        }
      }

      // Emit edit request
      EventBus.emit('goal:edit-requested', {
        goal: newGoal,
        source: 'GoalPanel',
        timestamp: Date.now()
      });

      isEditing = false;
      lastActivity = Date.now();
      logger.info('[GoalPanel] Goal edit requested:', newGoal);
    };

    // Add to history with circular buffer
    const addToHistory = (goal) => {
      // Don't add if same as last goal
      if (goalHistory.length > 0 && goalHistory[goalHistory.length - 1].goal === goal) {
        return;
      }

      goalHistory.push({
        timestamp: Date.now(),
        goal: goal
      });

      // Trim if over limit
      if (goalHistory.length > MAX_HISTORY) {
        goalHistory = goalHistory.slice(goalHistory.length - MAX_HISTORY);
        logger.debug(`[GoalPanel] History trimmed to ${MAX_HISTORY} items`);
      }

      // Persist to localStorage (optional)
      try {
        localStorage.setItem('reploid_goal_history', JSON.stringify(goalHistory));
      } catch (err) {
        logger.warn('[GoalPanel] Failed to persist history:', err);
      }
    };

    // Get goal history
    const getHistory = () => goalHistory;

    // Clear goal
    const clearGoal = () => {
      EventBus.emit('goal:edit-requested', {
        goal: '',
        source: 'GoalPanel',
        timestamp: Date.now()
      });
      logger.info('[GoalPanel] Goal cleared');
    };

    // Export history to markdown
    const exportToMarkdown = () => {
      const markdown = goalHistory.map(({ timestamp, goal }) => {
        const date = new Date(timestamp).toISOString();
        return `**${date}**\n${goal}\n`;
      }).join('\n---\n\n');

      return `# Goal History Export\n\nTotal goals: ${goalHistory.length}\n\n${markdown}`;
    };

    // Show error message
    const showError = (message) => {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'goal-error';
      errorDiv.textContent = message;
      if (container) {
        container.prepend(errorDiv);
        setTimeout(() => errorDiv.remove(), 3000);
      }
    };

    // Render the goal panel
    const render = () => {
      if (!container) return;

      if (isEditing) {
        // Editing mode
        container.innerHTML = `
          <div class="goal-panel-header">
            <h4>Edit Agent Goal</h4>
          </div>
          <div class="goal-panel-content">
            <textarea id="goal-edit-textarea" class="goal-edit-textarea">${escapeHtml(currentGoal)}</textarea>
            <div class="goal-edit-actions">
              <button id="save-goal-btn" class="btn-primary">✓ Save</button>
              <button id="cancel-goal-btn" class="btn-secondary">✕ Cancel</button>
            </div>
          </div>
        `;

        // Attach event handlers
        const saveBtn = document.getElementById('save-goal-btn');
        const cancelBtn = document.getElementById('cancel-goal-btn');
        const textarea = document.getElementById('goal-edit-textarea');

        if (saveBtn) {
          saveBtn.onclick = () => {
            const newGoal = textarea?.value || '';
            saveEdit(newGoal);
          };
        }

        if (cancelBtn) {
          cancelBtn.onclick = () => {
            isEditing = false;
            render();
          };
        }
      } else {
        // Display mode
        container.innerHTML = `
          <div class="goal-panel-header">
            <h4>Agent Goal</h4>
            <div class="goal-controls">
              <button id="edit-goal-btn" class="btn-secondary" title="Edit Goal">✏️ Edit</button>
              <button id="clear-goal-btn" class="btn-secondary" title="Clear Goal">🗑️ Clear</button>
              <button id="history-goal-btn" class="btn-secondary" title="View History">📜 History (${goalHistory.length})</button>
            </div>
          </div>
          <div class="goal-panel-content">
            ${currentGoal
              ? `<div class="goal-display">${escapeHtml(currentGoal)}</div>`
              : '<div class="goal-empty">No goal set. Agent is waiting for instructions.</div>'}
          </div>
        `;

        // Attach event handlers
        const editBtn = document.getElementById('edit-goal-btn');
        const clearBtn = document.getElementById('clear-goal-btn');
        const historyBtn = document.getElementById('history-goal-btn');

        if (editBtn) {
          editBtn.onclick = () => editGoal();
        }

        if (clearBtn) {
          clearBtn.onclick = () => {
            if (confirm('Clear current goal?')) {
              clearGoal();
            }
          };
        }

        if (historyBtn) {
          historyBtn.onclick = () => {
            showHistoryModal();
          };
        }
      }
    };

    // Show history modal
    const showHistoryModal = () => {
      const historyHtml = goalHistory
        .slice()
        .reverse()
        .map(({ timestamp, goal }) => {
          const date = new Date(timestamp).toLocaleString();
          return `
            <div class="history-item">
              <span class="history-timestamp">${date}</span>
              <span class="history-goal">${escapeHtml(goal)}</span>
            </div>
          `;
        })
        .join('');

      const modal = document.createElement('div');
      modal.className = 'goal-history-modal';
      modal.innerHTML = `
        <div class="goal-history-modal-content">
          <div class="goal-history-modal-header">
            <h3>Goal History (${goalHistory.length}/${MAX_HISTORY})</h3>
            <button id="close-history-btn" class="btn-close">✕</button>
          </div>
          <div class="goal-history-modal-body">
            ${historyHtml || '<p>No history yet.</p>'}
          </div>
          <div class="goal-history-modal-footer">
            <button id="export-history-btn" class="btn-secondary">📥 Export</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      // Attach handlers
      const closeBtn = document.getElementById('close-history-btn');
      const exportBtn = document.getElementById('export-history-btn');

      if (closeBtn) {
        closeBtn.onclick = () => modal.remove();
      }

      if (exportBtn) {
        exportBtn.onclick = () => {
          const markdown = exportToMarkdown();
          downloadFile('goal-history.md', markdown);
          modal.remove();
        };
      }

      // Close on backdrop click
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      };
    };

    // Download helper
    const downloadFile = (filename, content) => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      logger.info(`[GoalPanel] Exported history to ${filename}`);
    };

    // Widget Protocol: getStatus()
    const getStatus = () => {
      return {
        state: currentGoal ? (isEditing ? 'editing' : 'goal-set') : 'no-goal',
        primaryMetric: currentGoal ? currentGoal.slice(0, 50) + (currentGoal.length > 50 ? '...' : '') : 'No goal set',
        secondaryMetric: `${goalHistory.length} changes`,
        lastActivity: lastActivity,
        message: isEditing ? 'Editing goal...' : null
      };
    };

    // Widget Protocol: getControls()
    const getControls = () => {
      return [
        {
          id: 'edit-goal',
          label: 'Edit Goal',
          icon: '✏️',
          action: () => {
            editGoal();
            return { success: true, message: 'Edit mode enabled' };
          }
        },
        {
          id: 'clear-goal',
          label: 'Clear Goal',
          icon: '🗑️',
          action: () => {
            clearGoal();
            return { success: true, message: 'Goal cleared' };
          }
        },
        {
          id: 'goal-history',
          label: 'View History',
          icon: '📜',
          action: () => {
            showHistoryModal();
            return { success: true, message: `${goalHistory.length} past goals` };
          }
        },
        {
          id: 'export-history',
          label: 'Export History',
          icon: '📥',
          action: () => {
            const markdown = exportToMarkdown();
            downloadFile('goal-history.md', markdown);
            return { success: true, message: `Exported ${goalHistory.length} goals` };
          }
        }
      ];
    };

    // Styles for goal panel
    const getGoalPanelStyles = () => `
      .goal-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .goal-panel-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .goal-controls {
        display: flex;
        gap: 8px;
      }

      .goal-panel-content {
        padding: 16px;
      }

      .goal-display {
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        border-left: 3px solid #4CAF50;
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
        white-space: pre-wrap;
        word-break: break-word;
      }

      .goal-empty {
        padding: 32px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
      }

      .goal-edit-textarea {
        width: 100%;
        min-height: 100px;
        padding: 12px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.9);
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 13px;
        line-height: 1.6;
        resize: vertical;
      }

      .goal-edit-actions {
        display: flex;
        gap: 8px;
        margin-top: 12px;
      }

      .btn-primary {
        padding: 8px 16px;
        background: #4CAF50;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        transition: all 0.2s;
      }

      .btn-primary:hover {
        background: #45a049;
      }

      .btn-secondary {
        padding: 6px 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        color: rgba(255, 255, 255, 0.9);
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .btn-secondary:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: rgba(255, 255, 255, 0.3);
      }

      .goal-error {
        padding: 12px;
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.3);
        border-radius: 4px;
        margin-bottom: 12px;
        color: rgba(255, 100, 100, 0.9);
        font-size: 13px;
      }

      .goal-history-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      }

      .goal-history-modal-content {
        background: #2a2a2a;
        border-radius: 8px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      }

      .goal-history-modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .goal-history-modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .btn-close {
        background: none;
        border: none;
        color: rgba(255, 255, 255, 0.7);
        font-size: 20px;
        cursor: pointer;
        padding: 4px 8px;
      }

      .btn-close:hover {
        color: rgba(255, 255, 255, 1);
      }

      .goal-history-modal-body {
        padding: 16px;
        overflow-y: auto;
        flex: 1;
      }

      .history-item {
        display: flex;
        flex-direction: column;
        padding: 12px;
        margin-bottom: 12px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        border-left: 3px solid #2196F3;
      }

      .history-timestamp {
        color: rgba(255, 255, 255, 0.5);
        font-size: 11px;
        margin-bottom: 6px;
      }

      .history-goal {
        color: rgba(255, 255, 255, 0.9);
        font-size: 13px;
        font-family: 'SF Mono', 'Consolas', monospace;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .goal-history-modal-footer {
        padding: 16px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
        display: flex;
        justify-content: flex-end;
      }
    `;

    // Public API
    return {
      init,
      setGoal,
      getGoal,
      editGoal,
      saveEdit,
      getHistory,
      clearGoal,
      export: exportToMarkdown,
      getStatus,
      getControls,
      cleanup
    };
  }
};

// Export for module loader
export default GoalPanel;
