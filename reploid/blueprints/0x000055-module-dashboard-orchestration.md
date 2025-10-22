# Blueprint 0x00005E: Module Dashboard Orchestration

**Objective:** To provide a unified dashboard that auto-discovers and renders all module widgets with consistent layout, filtering, and interaction patterns.

**Target Upgrade:** MDSH (`module-dashboard.js`)

**Prerequisites:** 0x00004E (Module Widget Protocol), 0x000003 (Core Utilities), 0x000002 (Event Bus)

**Affected Artifacts:** `/upgrades/module-dashboard.js`

---

### 1. The Strategic Imperative

A modular agent system with dozens of modules needs a centralized dashboard to:

- **Auto-Discovery**: Automatically detect and display all registered module widgets
- **Consistent Layout**: Provide uniform grid/list views for all widgets regardless of their implementation
- **State Aggregation**: Display real-time status from all modules in one view
- **Category Filtering**: Group and filter modules by category (core, debugging, rsi, etc.)
- **Interaction Hub**: Centralized access to module controls and actions
- **HITL Integration**: Show human-in-the-loop modes for each module

Without a dashboard, users must manually discover and access each module's UI individually, creating a fragmented experience.

### 2. The Architectural Solution

The `/upgrades/module-dashboard.js` implements a **pure UI orchestrator** that renders other module widgets without having its own widget component.

#### Module Structure

```javascript
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
     * Initialize the dashboard
     */
    const init = (container) => {
      logger.info('[ModuleDashboard] Initializing module dashboard');

      containerElement = container;

      // Listen for widget lifecycle events
      EventBus.on('widget:registered', handleWidgetRegistered);
      EventBus.on('widget:unregistered', handleWidgetUnregistered);
      EventBus.on('widget:state-updated', handleStateUpdated);
      EventBus.on('widget:toggled', handleWidgetToggled);

      // Initial render
      render();

      // Load saved preferences (minimized states, view mode, etc.)
      ModuleWidgetProtocol.loadWidgetPreferences();
    };

    /**
     * Main render function
     */
    const render = () => {
      if (!containerElement) return;

      const widgets = ModuleWidgetProtocol.getAllWidgets();
      const categories = extractCategories(widgets);

      containerElement.innerHTML = `
        <div class="module-dashboard">
          <div class="dashboard-header">
            <h2>Module Dashboard</h2>
            <div class="dashboard-controls">
              ${renderViewToggle()}
              ${renderRefreshButton()}
            </div>
          </div>

          ${renderFilters(widgets, categories)}
          ${renderWidgetGrid(widgets)}
        </div>
      `;

      // Attach event listeners for interactive elements
      attachEventListeners();
    };

    /**
     * Render individual widget card
     */
    const renderWidgetCard = (widget) => {
      const state = widget.currentState || {};
      const statusClass = state.state || 'idle';
      const controls = ModuleWidgetProtocol.getWidgetControls(widget.moduleId);
      const hitlMode = HITLController ? HITLController.getModuleMode(widget.moduleId) : null;

      return `
        <div class="module-widget-card ${statusClass} ${widget.minimized ? 'minimized' : ''}"
             data-module-id="${widget.moduleId}">
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
              <button class="minimize" onclick="window.ModuleDashboard.toggleWidget('${widget.moduleId}')">
                ${widget.minimized ? '▲' : '▼'}
              </button>
            </div>
          </div>

          <!-- Card Body (collapsed when minimized) -->
          ${!widget.minimized ? `
            <div class="widget-card-body">
              <!-- Status Indicator -->
              <div class="widget-status ${statusClass}">
                <span class="status-dot">●</span>
                <span class="status-text">${formatStatus(state.state)}</span>
              </div>

              <!-- Metrics -->
              <div class="widget-metrics">
                <div class="metric-primary">${state.primaryMetric || 'N/A'}</div>
                <div class="metric-secondary">${state.secondaryMetric || ''}</div>
              </div>

              <!-- Message -->
              ${state.message ? `
                <div class="widget-message">${escapeHtml(state.message)}</div>
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
                    <button class="control-btn"
                            onclick="window.ModuleDashboard.executeControl('${widget.moduleId}', '${c.id}')">
                      ${c.icon || ''} ${c.label}
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
     * Event handlers for widget lifecycle
     */
    const handleWidgetRegistered = () => {
      render(); // Re-render to show new widget
    };

    const handleWidgetUnregistered = () => {
      render(); // Re-render to remove widget
    };

    const handleStateUpdated = ({ moduleId, state }) => {
      // Optimized: update just the specific widget card
      const card = containerElement?.querySelector(`[data-module-id="${moduleId}"]`);
      if (card) {
        updateWidgetCard(card, moduleId, state);
      } else {
        render(); // Full re-render if card not found
      }
    };

    const handleWidgetToggled = () => {
      render(); // Re-render to show minimized state
    };

    /**
     * Public API exposed to window for onclick handlers
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

    return {
      api: {
        init,
        render
      }
      // NOTE: No widget component - this is a pure UI orchestrator
    };
  }
};
```

#### Core Responsibilities

1. **Auto-Discovery**: Query ModuleWidgetProtocol for all registered widgets
2. **Dynamic Rendering**: Generate HTML grid/list layout for all widgets
3. **State Display**: Show real-time status, metrics, and messages from each widget
4. **Category Filtering**: Filter displayed widgets by category (all, core, debugging, rsi, etc.)
5. **View Modes**: Toggle between grid and list layouts
6. **Control Execution**: Proxy control actions to ModuleWidgetProtocol
7. **HITL Integration**: Display human-in-the-loop mode badges for each module
8. **Event Handling**: Listen to widget lifecycle events and update display accordingly

### 3. The Implementation Pathway

#### Step 1: Initialize Dashboard Container

Accept container element and register event listeners:

```javascript
const init = (container) => {
  containerElement = container;

  // Register lifecycle listeners
  EventBus.on('widget:registered', handleWidgetRegistered);
  EventBus.on('widget:unregistered', handleWidgetUnregistered);
  EventBus.on('widget:state-updated', handleStateUpdated);
  EventBus.on('widget:toggled', handleWidgetToggled);

  // Initial render
  render();

  // Load user preferences
  ModuleWidgetProtocol.loadWidgetPreferences();
};
```

#### Step 2: Implement Main Render Function

Query all widgets and generate dashboard layout:

```javascript
const render = () => {
  if (!containerElement) return;

  const widgets = ModuleWidgetProtocol.getAllWidgets();
  const categories = extractCategories(widgets);

  containerElement.innerHTML = `
    <div class="module-dashboard">
      <div class="dashboard-header">
        <h2>Module Dashboard</h2>
        <div class="dashboard-controls">
          ${renderViewToggle()}
          ${renderRefreshButton()}
        </div>
      </div>

      ${renderFilters(widgets, categories)}
      ${renderWidgetGrid(widgets)}
    </div>
  `;

  attachEventListeners();
};
```

#### Step 3: Implement Widget Card Rendering

Generate individual widget cards with status, metrics, and controls:

```javascript
const renderWidgetCard = (widget) => {
  const state = widget.currentState || {};
  const statusClass = state.state || 'idle';
  const controls = ModuleWidgetProtocol.getWidgetControls(widget.moduleId);

  return `
    <div class="module-widget-card ${statusClass}"
         data-module-id="${widget.moduleId}">
      <!-- Header with icon, name, category, minimize button -->
      <!-- Body with status indicator, metrics, message, controls -->
    </div>
  `;
};
```

#### Step 4: Implement Category Filtering

Filter widgets by category and render only matching widgets:

```javascript
const renderFilters = (widgets, categories) => {
  return `
    <div class="category-filters">
      <button onclick="window.ModuleDashboard.setFilter('all')"
              class="${currentFilter === 'all' ? 'active' : ''}">
        All (${widgets.length})
      </button>
      ${categories.map(cat => `
        <button onclick="window.ModuleDashboard.setFilter('${cat}')"
                class="${currentFilter === cat ? 'active' : ''}">
          ${cat} (${widgets.filter(w => w.category === cat).length})
        </button>
      `).join('')}
    </div>
  `;
};
```

#### Step 5: Implement Event Handlers

Handle widget lifecycle events for dynamic updates:

```javascript
const handleWidgetRegistered = () => {
  render(); // Full re-render to show new widget
};

const handleStateUpdated = ({ moduleId, state }) => {
  // Optimized: update just the specific widget card
  const card = containerElement?.querySelector(`[data-module-id="${moduleId}"]`);
  if (card) {
    updateWidgetCard(card, moduleId, state);
  } else {
    render(); // Fallback to full re-render
  }
};
```

#### Step 6: Implement Optimized Card Updates

Update individual widget cards without full re-render:

```javascript
const updateWidgetCard = (card, moduleId, state) => {
  // Update status indicator
  const statusEl = card.querySelector('.widget-status');
  if (statusEl) {
    statusEl.className = `widget-status ${state.state}`;
  }

  // Update primary metric
  const primaryMetric = card.querySelector('.metric-primary');
  if (primaryMetric && state.primaryMetric) {
    primaryMetric.textContent = state.primaryMetric;
  }

  // Update secondary metric
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
```

#### Step 7: Expose Public API to Window

Enable onclick handlers in rendered HTML:

```javascript
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

if (typeof window !== 'undefined') {
  window.ModuleDashboard = publicAPI;
}
```

#### Step 8: Return API (No Widget Component)

```javascript
return {
  api: {
    init,
    render
  }
  // NOTE: No widget property - this is a pure UI orchestrator
};
```

### 4. Operational Safeguards & Quality Gates

- **XSS Prevention**: Escape all user-generated content with `escapeHtml()` helper
- **Null Safety**: Handle missing widget states gracefully
- **Event Cleanup**: Unsubscribe from EventBus if dashboard is destroyed
- **Performance**: Use optimized card updates for state changes instead of full re-render
- **Error Boundary**: Catch rendering errors for individual widgets to prevent dashboard crash

### 5. Extension Points

- **Drag-and-Drop**: Allow users to reorder widget cards
- **Custom Layouts**: Support user-defined dashboard layouts (grid sizes, positions)
- **Widget Search**: Add search bar to filter widgets by name or category
- **Export Dashboard**: Export current dashboard state for sharing or backup
- **Widget Pinning**: Pin frequently-used widgets to top of dashboard
- **Multi-Dashboard**: Support multiple named dashboards (e.g., "Debug", "RSI", "Core")

Use this blueprint whenever modifying dashboard layout, adding filtering capabilities, or implementing widget lifecycle handling.
