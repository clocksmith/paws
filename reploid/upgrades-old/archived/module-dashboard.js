/**
 * @fileoverview Module Dashboard - Auto-discovers and renders all module widgets
 *
 * Provides a consistent grid view of all loaded modules with their status,
 * metrics, and controls. Integrates with the Module Widget Protocol.
 *
 * @blueprint 0x000055
 * @module ModuleDashboard
 * @version 1.0.0
 * @category ui
 */

const ModuleDashboard = {
  metadata: {
    id: 'ModuleDashboard',
    version: '1.0.0',
    dependencies: ['ModuleWidgetProtocol', 'HITLController', 'EventBus', 'Utils'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { ModuleWidgetProtocol, HITLController, EventBus, Utils } = deps;
    const { logger } = Utils;

    let containerElement = null;
    let currentView = 'grid'; // 'grid' or 'list'
    let currentFilter = 'all'; // 'all' or category name

    /**
     * Initialize the module dashboard
     */
    const init = (container) => {
      logger.info('[ModuleDashboard] Initializing module dashboard');

      containerElement = container;

      // Listen for widget events
      EventBus.on('widget:registered', handleWidgetRegistered);
      EventBus.on('widget:unregistered', handleWidgetUnregistered);
      EventBus.on('widget:state-updated', handleStateUpdated);
      EventBus.on('widget:toggled', handleWidgetToggled);

      // Initial render
      render();

      // Load preferences
      ModuleWidgetProtocol.loadWidgetPreferences();
    };

    /**
     * Render the dashboard
     */
    const render = () => {
      if (!containerElement) return;

      const widgets = ModuleWidgetProtocol.getAllWidgets();
      const summary = ModuleWidgetProtocol.getMetaCognitiveSummary();

      const html = `
        <div class="module-dashboard">
          <!-- Dashboard Header -->
          ${renderHeader(summary)}

          <!-- Category Filters -->
          ${renderFilters(widgets)}

          <!-- Widget Grid -->
          ${renderWidgetGrid(widgets)}
        </div>
      `;

      containerElement.innerHTML = html;
    };

    /**
     * Render dashboard header with summary
     */
    const renderHeader = (summary) => {
      return `
        <div class="module-dashboard-header">
          <div class="dashboard-title">
            <h3>Module Dashboard</h3>
            <span class="module-count">${summary.totalModules} modules</span>
          </div>

          <div class="dashboard-summary">
            <div class="summary-item active">
              <span class="summary-icon">●</span>
              <span class="summary-label">${summary.byStatus.active} Active</span>
            </div>
            <div class="summary-item idle">
              <span class="summary-icon">○</span>
              <span class="summary-label">${summary.byStatus.idle} Idle</span>
            </div>
            ${summary.byStatus.error > 0 ? `
              <div class="summary-item error">
                <span class="summary-icon">✗</span>
                <span class="summary-label">${summary.byStatus.error} Error</span>
              </div>
            ` : ''}
          </div>

          <div class="dashboard-controls">
            <button class="dashboard-btn" onclick="window.ModuleDashboard.refreshAll()">
              ↻ Refresh
            </button>
            <button class="dashboard-btn" onclick="window.ModuleDashboard.toggleView()">
              ${currentView === 'grid' ? '☷' : '▦'} ${currentView === 'grid' ? 'List' : 'Grid'}
            </button>
          </div>
        </div>
      `;
    };

    /**
     * Render category filters
     */
    const renderFilters = (widgets) => {
      const categories = {};

      widgets.forEach(w => {
        categories[w.category] = (categories[w.category] || 0) + 1;
      });

      return `
        <div class="module-filters">
          <button
            class="filter-btn ${currentFilter === 'all' ? 'active' : ''}"
            onclick="window.ModuleDashboard.setFilter('all')"
          >
            All (${widgets.length})
          </button>
          ${Object.entries(categories).map(([cat, count]) => `
            <button
              class="filter-btn ${currentFilter === cat ? 'active' : ''}"
              onclick="window.ModuleDashboard.setFilter('${cat}')"
            >
              ${cat} (${count})
            </button>
          `).join('')}
        </div>
      `;
    };

    /**
     * Render widget grid
     */
    const renderWidgetGrid = (widgets) => {
      // Apply filter
      const filtered = currentFilter === 'all'
        ? widgets
        : widgets.filter(w => w.category === currentFilter);

      // Sort by order, then by name
      filtered.sort((a, b) => {
        if (a.order !== b.order) return a.order - b.order;
        return a.displayName.localeCompare(b.displayName);
      });

      if (filtered.length === 0) {
        return `
          <div class="module-grid-empty">
            <p>No modules in this category</p>
          </div>
        `;
      }

      return `
        <div class="module-grid ${currentView}">
          ${filtered.map(renderWidgetCard).join('')}
        </div>
      `;
    };

    /**
     * Render individual widget card
     */
    const renderWidgetCard = (widget) => {
      const state = widget.currentState || {};
      const statusClass = state.state || 'idle';
      const controls = ModuleWidgetProtocol.getWidgetControls(widget.moduleId);

      // Get HITL mode if applicable
      const hitlMode = HITLController ? HITLController.getModuleMode(widget.moduleId) : null;

      return `
        <div
          class="module-widget-card ${statusClass} ${widget.minimized ? 'minimized' : ''}"
          data-module-id="${widget.moduleId}"
          data-category="${widget.category}"
        >
          <!-- Card Header -->
          <div class="widget-card-header">
            <div class="widget-title">
              <span class="widget-icon">${widget.icon}</span>
              <div class="widget-info">
                <span class="widget-name">${widget.displayName}</span>
                <span class="widget-category">${widget.category}</span>
              </div>
            </div>
            <div class="widget-actions">
              ${hitlMode ? renderHITLBadge(hitlMode) : ''}
              <button
                class="widget-action-btn minimize"
                onclick="window.ModuleDashboard.toggleWidget('${widget.moduleId}')"
                title="${widget.minimized ? 'Expand' : 'Minimize'}"
              >
                ${widget.minimized ? '▲' : '▼'}
              </button>
            </div>
          </div>

          <!-- Card Body (hidden when minimized) -->
          ${!widget.minimized ? `
            <div class="widget-card-body">
              <!-- Status Indicator -->
              <div class="widget-status ${statusClass}">
                <span class="status-dot">●</span>
                <span class="status-text">${formatStatus(state.state)}</span>
              </div>

              <!-- Metrics -->
              ${state.primaryMetric ? `
                <div class="widget-metrics">
                  <div class="metric-primary">${state.primaryMetric}</div>
                  ${state.secondaryMetric ? `
                    <div class="metric-secondary">${state.secondaryMetric}</div>
                  ` : ''}
                </div>
              ` : ''}

              <!-- Message/Description -->
              ${state.message ? `
                <div class="widget-message ${statusClass}">
                  ${escapeHtml(state.message)}
                </div>
              ` : ''}

              <!-- Last Activity -->
              ${state.lastActivity ? `
                <div class="widget-activity">
                  Last activity: ${formatTimestamp(state.lastActivity)}
                </div>
              ` : ''}

              <!-- Controls -->
              ${controls.length > 0 ? `
                <div class="widget-controls">
                  ${controls.map(c => `
                    <button
                      class="widget-control-btn"
                      onclick="window.ModuleDashboard.executeControl('${widget.moduleId}', '${c.id}')"
                      title="${c.label}"
                    >
                      ${c.icon || '⚙️'} ${c.label}
                    </button>
                  `).join('')}
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `;
    };

    /**
     * Render HITL mode badge
     */
    const renderHITLBadge = (mode) => {
      const icon = mode === 'autonomous' ? '⚙' : '⚇';
      const label = mode === 'autonomous' ? 'Auto' : 'HITL';
      return `<span class="widget-hitl-badge ${mode}">${icon} ${label}</span>`;
    };

    /**
     * Format status text
     */
    const formatStatus = (status) => {
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown';
    };

    /**
     * Format timestamp
     */
    const formatTimestamp = (timestamp) => {
      const elapsed = Date.now() - timestamp;

      if (elapsed < 1000) return 'just now';
      if (elapsed < 60000) return `${Math.floor(elapsed / 1000)}s ago`;
      if (elapsed < 3600000) return `${Math.floor(elapsed / 60000)}m ago`;
      if (elapsed < 86400000) return `${Math.floor(elapsed / 3600000)}h ago`;
      return new Date(timestamp).toLocaleDateString();
    };

    /**
     * Escape HTML
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
     * Event handlers
     */
    const handleWidgetRegistered = () => {
      render();
    };

    const handleWidgetUnregistered = () => {
      render();
    };

    const handleStateUpdated = ({ moduleId, state }) => {
      // Update just the specific widget card if possible (for performance)
      const card = containerElement?.querySelector(`[data-module-id="${moduleId}"]`);
      if (card) {
        // Quick update without full re-render
        updateWidgetCard(card, moduleId, state);
      } else {
        // Full re-render if card not found
        render();
      }
    };

    const handleWidgetToggled = () => {
      render();
    };

    /**
     * Quick update of a widget card (without full re-render)
     */
    const updateWidgetCard = (card, moduleId, state) => {
      // Update status
      const statusEl = card.querySelector('.widget-status');
      if (statusEl) {
        statusEl.className = `widget-status ${state.state}`;
        const statusText = statusEl.querySelector('.status-text');
        if (statusText) statusText.textContent = formatStatus(state.state);
      }

      // Update metrics
      const primaryMetric = card.querySelector('.metric-primary');
      if (primaryMetric && state.primaryMetric) {
        primaryMetric.textContent = state.primaryMetric;
      }

      const secondaryMetric = card.querySelector('.metric-secondary');
      if (secondaryMetric && state.secondaryMetric) {
        secondaryMetric.textContent = state.secondaryMetric;
      }

      // Update activity timestamp
      const activityEl = card.querySelector('.widget-activity');
      if (activityEl && state.lastActivity) {
        activityEl.textContent = `Last activity: ${formatTimestamp(state.lastActivity)}`;
      }
    };

    /**
     * Public API for window bindings
     */
    const publicAPI = {
      toggleWidget: (moduleId) => {
        ModuleWidgetProtocol.toggleMinimized(moduleId);
      },

      executeControl: (moduleId, controlId) => {
        ModuleWidgetProtocol.executeControl(moduleId, controlId);
      },

      refreshAll: () => {
        ModuleWidgetProtocol.refreshAllWidgets();
      },

      toggleView: () => {
        currentView = currentView === 'grid' ? 'list' : 'grid';
        render();
      },

      setFilter: (filter) => {
        currentFilter = filter;
        render();
      }
    };

    // Expose to window for onclick handlers
    if (typeof window !== 'undefined') {
      window.ModuleDashboard = publicAPI;
    }

    // Web Component Widget for Module Dashboard
    class ModuleDashboardWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 3000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        // Access dashboard state via closure
        const summary = ModuleWidgetProtocol?.getMetaCognitiveSummary() || {
          totalModules: 0,
          byStatus: { active: 0, idle: 0, error: 0 }
        };

        return {
          state: summary.byStatus.error > 0 ? 'warning' : 'active',
          primaryMetric: `${summary.totalModules} modules`,
          secondaryMetric: `${summary.byStatus.active} active`,
          lastActivity: Date.now(),
          message: summary.byStatus.error > 0 ? `${summary.byStatus.error} errors` : null
        };
      }

      getControls() {
        return [
          {
            id: 'refresh-all',
            label: 'Refresh All',
            icon: '↻',
            action: () => {
              ModuleWidgetProtocol?.refreshAllWidgets();
              return { success: true, message: 'Refreshing all widgets' };
            }
          },
          {
            id: 'toggle-view',
            label: `${currentView === 'grid' ? 'List' : 'Grid'} View`,
            icon: currentView === 'grid' ? '☷' : '▦',
            action: () => {
              publicAPI.toggleView();
              return { success: true, message: `Switched to ${currentView} view` };
            }
          }
        ];
      }

      render() {
        const status = this.getStatus();
        const summary = ModuleWidgetProtocol?.getMetaCognitiveSummary() || {
          totalModules: 0,
          byStatus: { active: 0, idle: 0, error: 0, disabled: 0 }
        };

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }

            .dashboard-panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 8px;
              border-left: 3px solid #00bcd4;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #00bcd4;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 12px;
            }

            .stat {
              display: flex;
              justify-content: space-between;
              padding: 8px;
              background: rgba(255, 255, 255, 0.02);
              border-radius: 4px;
            }

            .stat-label {
              color: #888;
            }

            .stat-value {
              font-weight: bold;
            }

            .value-active { color: #0ff; }
            .value-idle { color: #0f0; }
            .value-error { color: #f00; }
            .value-disabled { color: #888; }
          </style>

          <div class="dashboard-panel">
            <h3>📊 Module Dashboard</h3>

            <div class="stats-grid">
              <div class="stat">
                <span class="stat-label">Total:</span>
                <span class="stat-value">${summary.totalModules}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Active:</span>
                <span class="stat-value value-active">${summary.byStatus.active}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Idle:</span>
                <span class="stat-value value-idle">${summary.byStatus.idle}</span>
              </div>
              <div class="stat">
                <span class="stat-label">Errors:</span>
                <span class="stat-value value-error">${summary.byStatus.error || 0}</span>
              </div>
            </div>

            <div class="stat">
              <span class="stat-label">View:</span>
              <span class="stat-value">${currentView}</span>
            </div>
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'module-dashboard-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ModuleDashboardWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Module Dashboard',
      icon: '📊',
      category: 'ui'
    };

    return {
      api: {
        init,
        render
      },
      widget
    };
  }
};

// Export
export default ModuleDashboard;
