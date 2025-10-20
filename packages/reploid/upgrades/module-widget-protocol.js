/**
 * @fileoverview Module Widget Protocol - Standardized UI interface for all modules
 *
 * @blueprint 0x000048
 *
 * Every module can optionally expose a .widget interface to provide:
 * - Visual status representation
 * - Real-time metrics/state
 * - Interactive controls
 * - Detailed panel views
 *
 * This creates consistency across the dashboard and enables meta-cognitive awareness
 * of module state through a uniform protocol.
 *
 * @module ModuleWidgetProtocol
 * @version 1.0.0
 * @category core
 */

const ModuleWidgetProtocol = {
  metadata: {
    id: 'ModuleWidgetProtocol',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { EventBus, Utils } = deps;
    const { logger } = Utils;

    // Registry of all module widgets
    const widgetRegistry = new Map();

    // Widget state cache (for performance)
    const widgetStateCache = new Map();

    // Update intervals
    const updateIntervals = new Map();

    /**
     * Widget Status States
     */
    const WIDGET_STATUS = {
      ACTIVE: 'active',        // Module is actively processing
      IDLE: 'idle',            // Module is loaded but not active
      ERROR: 'error',          // Module has errors
      DISABLED: 'disabled',    // Module is disabled
      LOADING: 'loading'       // Module is initializing
    };

    /**
     * Widget Categories for organization
     */
    const WIDGET_CATEGORIES = {
      CORE: 'core',           // StateManager, EventBus, etc.
      TOOLS: 'tools',         // Tool execution systems
      AI: 'ai',               // LLM providers, agents
      STORAGE: 'storage',     // VFS, persistence
      UI: 'ui',               // Dashboard components
      ANALYTICS: 'analytics', // Monitoring, metrics
      RSI: 'rsi',            // Self-improvement systems
      COMM: 'communication'   // WebRTC, signaling
    };

    /**
     * Initialize the widget protocol
     */
    const init = () => {
      logger.info('[ModuleWidgetProtocol] Initializing module widget system');

      // Listen for module lifecycle events
      EventBus.on('module:loaded', handleModuleLoaded);
      EventBus.on('module:unloaded', handleModuleUnloaded);
      EventBus.on('widget:refresh', refreshWidget);
      EventBus.on('widget:refresh-all', refreshAllWidgets);
    };

    /**
     * Register a module's widget interface
     *
     * @param {string} moduleId - Module identifier
     * @param {Object} widgetInterface - Widget configuration
     * @param {Object} moduleMetadata - Module metadata
     */
    const registerWidget = (moduleId, widgetInterface, moduleMetadata = {}) => {
      if (!moduleId) {
        logger.warn('[ModuleWidgetProtocol] Cannot register widget without module ID');
        return;
      }

      // Detect widget type: Web Component (new) or HTML string (old)
      const isWebComponent = widgetInterface.element && typeof widgetInterface.element === 'string';

      // Validate widget interface
      const widget = {
        moduleId,
        displayName: widgetInterface.displayName || moduleMetadata.id || moduleId,
        icon: widgetInterface.icon || '⚙️',
        category: widgetInterface.category || WIDGET_CATEGORIES.CORE,

        // Widget type for rendering
        isWebComponent,
        element: widgetInterface.element || null,

        // Function to get current status
        getStatus: widgetInterface.getStatus || (() => ({
          state: WIDGET_STATUS.IDLE,
          primaryMetric: null,
          secondaryMetric: null,
          lastActivity: null,
          message: null
        })),

        // Function to get available controls
        getControls: widgetInterface.getControls || (() => []),

        // Function to render full panel (optional - for old format)
        renderPanel: widgetInterface.renderPanel || null,

        // Update interval in ms (null = no auto-refresh)
        updateInterval: widgetInterface.updateInterval || null,

        // Widget preferences
        minimized: false,
        order: widgetInterface.order || 999,

        // Metadata
        registeredAt: Date.now(),
        metadata: moduleMetadata
      };

      widgetRegistry.set(moduleId, widget);
      logger.info(`[ModuleWidgetProtocol] Registered widget: ${moduleId} (${isWebComponent ? 'Web Component' : 'HTML'})`);

      // Start auto-refresh if configured (only for old HTML widgets)
      // Web Components handle their own refresh internally
      if (widget.updateInterval && !isWebComponent) {
        startAutoRefresh(moduleId, widget.updateInterval);
      }

      // Emit registration event
      EventBus.emit('widget:registered', { moduleId, widget });
    };

    /**
     * Unregister a widget
     */
    const unregisterWidget = (moduleId) => {
      if (widgetRegistry.has(moduleId)) {
        stopAutoRefresh(moduleId);
        widgetRegistry.delete(moduleId);
        widgetStateCache.delete(moduleId);

        logger.info(`[ModuleWidgetProtocol] Unregistered widget: ${moduleId}`);
        EventBus.emit('widget:unregistered', { moduleId });
      }
    };

    /**
     * Create a widget instance (for Web Components)
     *
     * @param {string} moduleId - Module identifier
     * @param {Object} moduleApi - Module's public API
     * @returns {HTMLElement|null} Widget element instance or null
     */
    const createWidgetInstance = (moduleId, moduleApi) => {
      const widget = widgetRegistry.get(moduleId);
      if (!widget) return null;

      // For Web Components, create element instance and inject API
      if (widget.isWebComponent && widget.element) {
        try {
          const element = document.createElement(widget.element);

          // Inject module API if the element has a moduleApi setter
          if (element && typeof element.moduleApi !== 'undefined') {
            element.moduleApi = moduleApi;
          }

          logger.debug(`[ModuleWidgetProtocol] Created widget instance for ${moduleId}`);
          return element;
        } catch (error) {
          logger.error(`[ModuleWidgetProtocol] Failed to create widget instance for ${moduleId}:`, error);
          return null;
        }
      }

      // For old HTML widgets, no instance needed (render via renderPanel())
      return null;
    };

    /**
     * Get a widget's current state
     */
    const getWidgetState = (moduleId) => {
      const widget = widgetRegistry.get(moduleId);
      if (!widget) return null;

      // Check cache first (if less than 1 second old)
      const cached = widgetStateCache.get(moduleId);
      if (cached && Date.now() - cached.timestamp < 1000) {
        return cached.state;
      }

      // Get fresh state
      try {
        // For Web Components, try to get status from the element instance
        if (widget.isWebComponent && widget._instance && typeof widget._instance.getStatus === 'function') {
          const state = widget._instance.getStatus();

          // Cache it
          widgetStateCache.set(moduleId, {
            state,
            timestamp: Date.now()
          });

          return state;
        }

        // For old widgets or Web Components without instance, use the widget's getStatus
        const state = widget.getStatus();

        // Cache it
        widgetStateCache.set(moduleId, {
          state,
          timestamp: Date.now()
        });

        return state;
      } catch (error) {
        logger.error(`[ModuleWidgetProtocol] Error getting state for ${moduleId}:`, error);
        return {
          state: WIDGET_STATUS.ERROR,
          message: error.message
        };
      }
    };

    /**
     * Get all registered widgets
     */
    const getAllWidgets = () => {
      return Array.from(widgetRegistry.entries()).map(([moduleId, widget]) => ({
        moduleId,
        ...widget,
        currentState: getWidgetState(moduleId)
      }));
    };

    /**
     * Get widgets by category
     */
    const getWidgetsByCategory = (category) => {
      return getAllWidgets().filter(w => w.category === category);
    };

    /**
     * Get widget controls
     */
    const getWidgetControls = (moduleId) => {
      const widget = widgetRegistry.get(moduleId);
      if (!widget) return [];

      try {
        return widget.getControls() || [];
      } catch (error) {
        logger.error(`[ModuleWidgetProtocol] Error getting controls for ${moduleId}:`, error);
        return [];
      }
    };

    /**
     * Execute a widget control action
     */
    const executeControl = (moduleId, controlId) => {
      const controls = getWidgetControls(moduleId);
      const control = controls.find(c => c.id === controlId);

      if (!control) {
        logger.warn(`[ModuleWidgetProtocol] Control not found: ${moduleId}.${controlId}`);
        return;
      }

      try {
        logger.info(`[ModuleWidgetProtocol] Executing control: ${moduleId}.${controlId}`);
        control.action();

        // Refresh widget state after control execution
        refreshWidget({ moduleId });

        EventBus.emit('widget:control-executed', { moduleId, controlId });
      } catch (error) {
        logger.error(`[ModuleWidgetProtocol] Error executing control ${moduleId}.${controlId}:`, error);
        EventBus.emit('widget:control-error', { moduleId, controlId, error });
      }
    };

    /**
     * Toggle widget minimized state
     */
    const toggleMinimized = (moduleId) => {
      const widget = widgetRegistry.get(moduleId);
      if (widget) {
        widget.minimized = !widget.minimized;
        saveWidgetPreferences();
        EventBus.emit('widget:toggled', { moduleId, minimized: widget.minimized });
      }
    };

    /**
     * Refresh a specific widget's state
     */
    const refreshWidget = ({ moduleId }) => {
      widgetStateCache.delete(moduleId);
      const state = getWidgetState(moduleId);
      EventBus.emit('widget:state-updated', { moduleId, state });
    };

    /**
     * Refresh all widgets
     */
    const refreshAllWidgets = () => {
      widgetStateCache.clear();
      widgetRegistry.forEach((widget, moduleId) => {
        const state = getWidgetState(moduleId);
        EventBus.emit('widget:state-updated', { moduleId, state });
      });
    };

    /**
     * Start auto-refresh for a widget
     */
    const startAutoRefresh = (moduleId, interval) => {
      stopAutoRefresh(moduleId); // Clear any existing interval

      const intervalId = setInterval(() => {
        refreshWidget({ moduleId });
      }, interval);

      updateIntervals.set(moduleId, intervalId);
    };

    /**
     * Stop auto-refresh for a widget
     */
    const stopAutoRefresh = (moduleId) => {
      const intervalId = updateIntervals.get(moduleId);
      if (intervalId) {
        clearInterval(intervalId);
        updateIntervals.delete(moduleId);
      }
    };

    /**
     * Get meta-cognitive summary of all module states
     * (For Reploid to understand its own state)
     */
    const getMetaCognitiveSummary = () => {
      const widgets = getAllWidgets();

      const summary = {
        totalModules: widgets.length,
        byStatus: {
          active: 0,
          idle: 0,
          error: 0,
          disabled: 0,
          loading: 0
        },
        byCategory: {},
        activeModules: [],
        errorModules: [],
        metrics: {}
      };

      widgets.forEach(widget => {
        const state = widget.currentState;

        // Count by status
        summary.byStatus[state.state] = (summary.byStatus[state.state] || 0) + 1;

        // Count by category
        summary.byCategory[widget.category] = (summary.byCategory[widget.category] || 0) + 1;

        // Track active modules
        if (state.state === WIDGET_STATUS.ACTIVE) {
          summary.activeModules.push({
            moduleId: widget.moduleId,
            displayName: widget.displayName,
            primaryMetric: state.primaryMetric,
            lastActivity: state.lastActivity
          });
        }

        // Track error modules
        if (state.state === WIDGET_STATUS.ERROR) {
          summary.errorModules.push({
            moduleId: widget.moduleId,
            displayName: widget.displayName,
            message: state.message
          });
        }

        // Collect metrics
        if (state.primaryMetric) {
          summary.metrics[widget.moduleId] = {
            primary: state.primaryMetric,
            secondary: state.secondaryMetric
          };
        }
      });

      return summary;
    };

    /**
     * Save widget preferences to localStorage
     */
    const saveWidgetPreferences = () => {
      const preferences = {};

      widgetRegistry.forEach((widget, moduleId) => {
        preferences[moduleId] = {
          minimized: widget.minimized,
          order: widget.order
        };
      });

      try {
        localStorage.setItem('REPLOID_WIDGET_PREFERENCES', JSON.stringify(preferences));
      } catch (error) {
        logger.warn('[ModuleWidgetProtocol] Failed to save preferences:', error);
      }
    };

    /**
     * Load widget preferences from localStorage
     */
    const loadWidgetPreferences = () => {
      try {
        const saved = localStorage.getItem('REPLOID_WIDGET_PREFERENCES');
        if (saved) {
          const preferences = JSON.parse(saved);

          Object.entries(preferences).forEach(([moduleId, prefs]) => {
            const widget = widgetRegistry.get(moduleId);
            if (widget) {
              widget.minimized = prefs.minimized || false;
              widget.order = prefs.order !== undefined ? prefs.order : widget.order;
            }
          });

          logger.info('[ModuleWidgetProtocol] Preferences loaded');
        }
      } catch (error) {
        logger.warn('[ModuleWidgetProtocol] Failed to load preferences:', error);
      }
    };

    /**
     * Handle module loaded event
     */
    const handleModuleLoaded = ({ moduleId, module }) => {
      // Check if module has widget interface
      if (module.widget) {
        registerWidget(moduleId, module.widget, module.metadata);
      }
    };

    /**
     * Handle module unloaded event
     */
    const handleModuleUnloaded = ({ moduleId }) => {
      unregisterWidget(moduleId);
    };

    // Initialize
    init();

    // Web Component Widget for Module Widget Protocol
    class ModuleWidgetProtocolWidget extends HTMLElement {
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
        // Access protocol state via closure
        const allWidgets = getAllWidgets();
        const summary = getMetaCognitiveSummary();

        return {
          state: allWidgets.length > 0 ? 'active' : 'idle',
          primaryMetric: `${allWidgets.length} widgets`,
          secondaryMetric: `${summary.byStatus.active} active`,
          lastActivity: Date.now(),
          message: summary.byStatus.error > 0 ? `${summary.byStatus.error} errors` : null
        };
      }

      getControls() {
        return [
          {
            id: 'refresh-all-widgets',
            label: 'Refresh All',
            icon: '↻',
            action: () => {
              refreshAllWidgets();
              return { success: true, message: 'Refreshing all widgets' };
            }
          },
          {
            id: 'save-preferences',
            label: 'Save Prefs',
            icon: '💾',
            action: () => {
              saveWidgetPreferences();
              return { success: true, message: 'Widget preferences saved' };
            }
          }
        ];
      }

      render() {
        const status = this.getStatus();
        const allWidgets = getAllWidgets();
        const byCategory = getWidgetsByCategory();

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }

            .protocol-panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 8px;
              border-left: 3px solid #ff9800;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #ff9800;
            }

            .stats-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
            }

            .label {
              color: #888;
            }

            .value {
              font-weight: bold;
              color: #0ff;
            }

            .categories {
              margin-top: 12px;
              padding-top: 12px;
              border-top: 1px solid rgba(255, 255, 255, 0.1);
            }

            .category {
              display: flex;
              justify-content: space-between;
              margin-bottom: 4px;
              font-size: 11px;
            }

            .category-name {
              color: #999;
            }

            .category-count {
              color: #666;
            }
          </style>

          <div class="protocol-panel">
            <h3>🔌 Widget Protocol</h3>

            <div class="stats-row">
              <span class="label">Total Widgets:</span>
              <span class="value">${allWidgets.length}</span>
            </div>

            <div class="stats-row">
              <span class="label">Status:</span>
              <span class="value">${status.state.toUpperCase()}</span>
            </div>

            ${Object.keys(byCategory).length > 0 ? `
              <div class="categories">
                <div style="margin-bottom: 6px; color: #888; font-size: 11px;">By Category:</div>
                ${Object.entries(byCategory).map(([cat, widgets]) => `
                  <div class="category">
                    <span class="category-name">${cat}</span>
                    <span class="category-count">${widgets.length}</span>
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'module-widget-protocol-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ModuleWidgetProtocolWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Widget Protocol',
      icon: '🔌',
      category: 'core'
    };

    return {
      api: {
        // Registration
        registerWidget,
        unregisterWidget,

        // Widget instance creation (for Web Components)
        createWidgetInstance,

        // State queries
        getWidgetState,
        getAllWidgets,
        getWidgetsByCategory,
        getWidgetControls,

        // Actions
        executeControl,
        toggleMinimized,
        refreshWidget,
        refreshAllWidgets,

        // Meta-cognitive
        getMetaCognitiveSummary,

        // Persistence
        saveWidgetPreferences,
        loadWidgetPreferences,

        // Constants
        STATUS: WIDGET_STATUS,
        CATEGORIES: WIDGET_CATEGORIES
      },
      widget
    };
  }
};

// Export
export default ModuleWidgetProtocol;
