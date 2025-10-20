/**
 * @fileoverview HITL Control Panel UI
 * Visual interface for managing Human-in-the-Loop vs Autonomous modes
 *
 * @blueprint 0x00004C
 * @module HITLControlPanel
 * @version 1.0.0
 * @category ui
 */

const HITLControlPanel = {
  metadata: {
    id: 'HITLControlPanel',
    version: '1.0.0',
    dependencies: ['HITLController', 'EventBus', 'Utils'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { HITLController, EventBus, Utils } = deps;
    const { logger } = Utils;

    let containerElement = null;
    let approvalQueueContainer = null;

    /**
     * Initialize the control panel
     */
    const init = (container, queueContainer = null) => {
      logger.info('[HITLControlPanel] Initializing control panel UI');

      containerElement = container;
      approvalQueueContainer = queueContainer;

      // Listen for events
      EventBus.on('hitl:master-mode-changed', handleMasterModeChanged);
      EventBus.on('hitl:module-mode-changed', handleModuleModeChanged);
      EventBus.on('hitl:module-registered', handleModuleRegistered);
      EventBus.on('hitl:approval-pending', handleApprovalPending);
      EventBus.on('hitl:approval-granted', handleApprovalGranted);
      EventBus.on('hitl:approval-rejected', handleApprovalRejected);

      render();
      renderApprovalQueue();
    };

    /**
     * Render the main control panel
     */
    const render = () => {
      if (!containerElement) return;

      const config = HITLController.getConfig();
      const modules = config.registeredModules;

      const html = `
        <div class="hitl-control-panel">
          <!-- Master Toggle -->
          <div class="hitl-master-section">
            <div class="hitl-master-header">
              <div class="hitl-master-title">
                <span class="hitl-icon">${config.masterMode === 'autonomous' ? '⚙' : '⚇'}</span>
                <h3>Master Mode</h3>
              </div>
              <div class="hitl-master-toggle">
                <button
                  class="hitl-mode-btn ${config.masterMode === 'hitl' ? 'active' : ''}"
                  data-mode="hitl"
                  onclick="window.HITLPanel.setMasterMode('hitl')"
                >
                  <span class="mode-icon">⚇</span>
                  <span class="mode-label">Human-in-Loop</span>
                </button>
                <button
                  class="hitl-mode-btn ${config.masterMode === 'autonomous' ? 'active' : ''}"
                  data-mode="autonomous"
                  onclick="window.HITLPanel.setMasterMode('autonomous')"
                >
                  <span class="mode-icon">⚙</span>
                  <span class="mode-label">Autonomous</span>
                </button>
              </div>
            </div>
            <p class="hitl-master-desc">
              ${config.masterMode === 'hitl'
                ? '✓ Agent will request approval for critical actions'
                : '⚡ Agent operates independently without approval requests'}
            </p>
          </div>

          <!-- Module List -->
          <div class="hitl-modules-section">
            <div class="hitl-section-header">
              <h4>Module Controls</h4>
              <span class="hitl-module-count">${modules.length} modules</span>
            </div>
            ${modules.length === 0 ? renderEmptyModules() : renderModuleList(modules, config.masterMode)}
          </div>

          <!-- Quick Actions -->
          <div class="hitl-actions">
            <button class="hitl-action-btn" onclick="window.HITLPanel.resetToDefaults()">
              Reset to Defaults
            </button>
          </div>
        </div>
      `;

      containerElement.innerHTML = html;
    };

    /**
     * Render empty state for modules
     */
    const renderEmptyModules = () => {
      return `
        <div class="hitl-empty">
          <p>No HITL-capable modules registered yet</p>
          <small>Modules will appear here as they initialize</small>
        </div>
      `;
    };

    /**
     * Render module list
     */
    const renderModuleList = (modules, masterMode) => {
      // Group by effective mode
      const autonomous = modules.filter(m => m.effectiveMode === 'autonomous');
      const hitl = modules.filter(m => m.effectiveMode === 'hitl');

      return `
        <div class="hitl-module-list">
          ${hitl.length > 0 ? `
            <div class="hitl-module-group">
              <div class="hitl-group-header">
                <span class="hitl-group-icon">⚇</span>
                <span class="hitl-group-label">Human-in-Loop (${hitl.length})</span>
              </div>
              ${hitl.map(m => renderModuleCard(m, masterMode)).join('')}
            </div>
          ` : ''}

          ${autonomous.length > 0 ? `
            <div class="hitl-module-group">
              <div class="hitl-group-header">
                <span class="hitl-group-icon">⚙</span>
                <span class="hitl-group-label">Autonomous (${autonomous.length})</span>
              </div>
              ${autonomous.map(m => renderModuleCard(m, masterMode)).join('')}
            </div>
          ` : ''}
        </div>
      `;
    };

    /**
     * Render individual module card
     */
    const renderModuleCard = (module, masterMode) => {
      const isInherit = module.currentMode === 'inherit';
      const statusIcon = module.effectiveMode === 'autonomous' ? '⚙' : '⚇';
      const capabilities = module.capabilities.map(cap =>
        cap.replace(/_/g, ' ').toLowerCase()
      ).join(', ');

      return `
        <div class="hitl-module-card" data-module-id="${module.id}">
          <div class="hitl-module-header">
            <div class="hitl-module-title">
              <span class="hitl-module-icon">${statusIcon}</span>
              <div class="hitl-module-info">
                <span class="hitl-module-name">${module.id}</span>
                <span class="hitl-module-desc">${module.description}</span>
              </div>
            </div>
            ${isInherit ? `
              <span class="hitl-inherit-badge">Inherits</span>
            ` : ''}
          </div>

          <div class="hitl-module-capabilities">
            <small>${capabilities}</small>
          </div>

          <div class="hitl-module-controls">
            <select
              class="hitl-module-select"
              onchange="window.HITLPanel.setModuleMode('${module.id}', this.value)"
            >
              <option value="inherit" ${module.currentMode === 'inherit' ? 'selected' : ''}>
                Inherit from master (${masterMode === 'hitl' ? 'HITL' : 'Auto'})
              </option>
              <option value="hitl" ${module.currentMode === 'hitl' ? 'selected' : ''}>
                ⚇ Human-in-Loop
              </option>
              <option value="autonomous" ${module.currentMode === 'autonomous' ? 'selected' : ''}>
                ⚙ Autonomous
              </option>
            </select>
          </div>
        </div>
      `;
    };

    /**
     * Render approval queue
     */
    const renderApprovalQueue = () => {
      if (!approvalQueueContainer) return;

      const queue = HITLController.getApprovalQueue();

      if (queue.length === 0) {
        approvalQueueContainer.innerHTML = `
          <div class="hitl-queue-empty">
            <p>No pending approvals</p>
          </div>
        `;
        return;
      }

      const html = `
        <div class="hitl-approval-queue">
          <div class="hitl-queue-header">
            <h4>Pending Approvals</h4>
            <span class="hitl-queue-count">${queue.length}</span>
          </div>
          <div class="hitl-queue-list">
            ${queue.map(renderApprovalItem).join('')}
          </div>
        </div>
      `;

      approvalQueueContainer.innerHTML = html;
    };

    /**
     * Render approval item
     */
    const renderApprovalItem = (item) => {
      const elapsed = Date.now() - item.timestamp;
      const elapsedSeconds = Math.floor(elapsed / 1000);

      return `
        <div class="hitl-approval-item" data-approval-id="${item.id}">
          <div class="hitl-approval-header">
            <div class="hitl-approval-title">
              <span class="hitl-approval-icon">⚠️</span>
              <strong>${item.action}</strong>
            </div>
            <span class="hitl-approval-time">${elapsedSeconds}s ago</span>
          </div>

          <div class="hitl-approval-details">
            <div class="hitl-approval-module">Module: ${item.moduleId}</div>
            <div class="hitl-approval-capability">${item.capability.replace(/_/g, ' ')}</div>
          </div>

          ${item.data ? `
            <div class="hitl-approval-data">
              <button class="hitl-data-toggle" onclick="window.HITLPanel.toggleData('${item.id}')">
                <span class="toggle-icon">▶</span>
                View Details
              </button>
              <pre class="hitl-data-content hidden" id="data-${item.id}">${JSON.stringify(item.data, null, 2)}</pre>
            </div>
          ` : ''}

          <div class="hitl-approval-actions">
            <button
              class="hitl-approve-btn"
              onclick="window.HITLPanel.approve('${item.id}')"
            >
              ✓ Approve
            </button>
            <button
              class="hitl-reject-btn"
              onclick="window.HITLPanel.reject('${item.id}')"
            >
              ✗ Reject
            </button>
          </div>
        </div>
      `;
    };

    /**
     * Event handlers
     */
    const handleMasterModeChanged = () => {
      render();
    };

    const handleModuleModeChanged = () => {
      render();
    };

    const handleModuleRegistered = () => {
      render();
    };

    const handleApprovalPending = () => {
      renderApprovalQueue();
    };

    const handleApprovalGranted = () => {
      renderApprovalQueue();
    };

    const handleApprovalRejected = () => {
      renderApprovalQueue();
    };

    /**
     * Public API for window bindings
     */
    const publicAPI = {
      setMasterMode: (mode) => {
        HITLController.setMasterMode(mode);
      },

      setModuleMode: (moduleId, mode) => {
        HITLController.setModuleMode({ moduleId, mode });
      },

      approve: (approvalId) => {
        HITLController.approve({ approvalId });
      },

      reject: (approvalId) => {
        const reason = prompt('Rejection reason (optional):') || 'User rejected';
        HITLController.reject({ approvalId, reason });
      },

      toggleData: (approvalId) => {
        const dataEl = document.getElementById(`data-${approvalId}`);
        const toggleBtn = event.target.closest('.hitl-data-toggle');
        const icon = toggleBtn?.querySelector('.toggle-icon');

        if (dataEl && icon) {
          dataEl.classList.toggle('hidden');
          icon.textContent = dataEl.classList.contains('hidden') ? '▶' : '▼';
        }
      },

      resetToDefaults: () => {
        if (confirm('Reset all modules to HITL mode?')) {
          HITLController.resetToDefaults();
        }
      }
    };

    // Expose to window for onclick handlers
    if (typeof window !== 'undefined') {
      window.HITLPanel = publicAPI;
    }

    return {
      api: {
        init,
        render,
        renderApprovalQueue
      },

      // Widget interface
      widget: (() => {
        class HITLControlPanelWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();

            // Listen for HITL events to trigger re-render
            this._listeners = [
              () => this.render(),
              () => this.render(),
              () => this.render(),
              () => this.render(),
              () => this.render(),
              () => this.render()
            ];

            EventBus.on('hitl:master-mode-changed', this._listeners[0]);
            EventBus.on('hitl:module-mode-changed', this._listeners[1]);
            EventBus.on('hitl:module-registered', this._listeners[2]);
            EventBus.on('hitl:approval-pending', this._listeners[3]);
            EventBus.on('hitl:approval-granted', this._listeners[4]);
            EventBus.on('hitl:approval-rejected', this._listeners[5]);
          }

          disconnectedCallback() {
            if (this._listeners) {
              EventBus.off('hitl:master-mode-changed', this._listeners[0]);
              EventBus.off('hitl:module-mode-changed', this._listeners[1]);
              EventBus.off('hitl:module-registered', this._listeners[2]);
              EventBus.off('hitl:approval-pending', this._listeners[3]);
              EventBus.off('hitl:approval-granted', this._listeners[4]);
              EventBus.off('hitl:approval-rejected', this._listeners[5]);
            }
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const config = HITLController.getConfig();
            const queue = HITLController.getApprovalQueue();

            return {
              state: queue.length > 0 ? 'warning' : 'idle',
              primaryMetric: config.masterMode === 'autonomous' ? '⚙ Autonomous' : '⚇ Manual',
              secondaryMetric: `${config.registeredModules.length} modules`,
              lastActivity: queue.length > 0 ? queue[0].timestamp : null,
              message: queue.length > 0 ? `${queue.length} pending approval${queue.length > 1 ? 's' : ''}` : null
            };
          }

          render() {
            const config = HITLController.getConfig();
            const queue = HITLController.getApprovalQueue();
            const modules = config.registeredModules;

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  font-family: monospace;
                  color: #e0e0e0;
                }
                .widget-panel-content {
                  padding: 12px;
                  background: #1a1a1a;
                  border-radius: 4px;
                }
                h4 {
                  margin: 0 0 12px 0;
                  font-size: 14px;
                  color: #4fc3f7;
                }
                .controls {
                  margin-bottom: 12px;
                  display: flex;
                  gap: 8px;
                }
                button {
                  padding: 6px 12px;
                  background: #333;
                  color: #e0e0e0;
                  border: 1px solid #555;
                  border-radius: 3px;
                  cursor: pointer;
                  font-family: monospace;
                  font-size: 11px;
                }
                button:hover {
                  background: #444;
                }
                .hitl-module-list, .hitl-queue-list {
                  display: flex;
                  flex-direction: column;
                  gap: 8px;
                }
                .hitl-approval-section {
                  margin-top: 16px;
                  padding-top: 16px;
                  border-top: 1px solid #333;
                }
              </style>
              <div class="widget-panel-content">
                <div class="controls">
                  ${config.masterMode === 'autonomous' ? `
                    <button class="switch-to-hitl">⚇ Switch to HITL</button>
                  ` : `
                    <button class="switch-to-auto">⚙ Switch to Autonomous</button>
                  `}
                  <button class="reset">↻ Reset to Defaults</button>
                </div>

                ${renderModuleList(modules, config.masterMode)}

                ${queue.length > 0 ? `
                  <div class="hitl-approval-section">
                    <h4>Pending Approvals (${queue.length})</h4>
                    <div class="hitl-queue-list">
                      ${queue.map(renderApprovalItem).join('')}
                    </div>
                  </div>
                ` : ''}
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.switch-to-hitl')?.addEventListener('click', () => {
              HITLController.setMasterMode('hitl');
            });

            this.shadowRoot.querySelector('.switch-to-auto')?.addEventListener('click', () => {
              HITLController.setMasterMode('autonomous');
            });

            this.shadowRoot.querySelector('.reset')?.addEventListener('click', () => {
              if (confirm('Reset all modules to HITL mode?')) {
                HITLController.resetToDefaults();
              }
            });
          }
        }

        if (!customElements.get('hitl-control-panel-widget')) {
          customElements.define('hitl-control-panel-widget', HITLControlPanelWidget);
        }

        return {
          element: 'hitl-control-panel-widget',
          displayName: 'HITL Control Panel',
          icon: '⚇',
          category: 'ui',
          order: 20
        };
      })()
    };
  }
};

// Export
export default HITLControlPanel;
