// @blueprint 0x000052 - HITL Controller for human-in-the-loop management
/**
 * @fileoverview HITL Controller - Human-in-the-Loop vs Autonomous Mode Management
 * Provides centralized control over which modules require human approval vs running autonomously
 *
 * @module HITLController
 * @version 1.0.0
 * @category core
 */

const HITLController = {
  metadata: {
    id: 'HITLController',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { EventBus, Utils } = deps;
    const { logger } = Utils;

    // Storage key
    const STORAGE_KEY = 'REPLOID_HITL_CONFIG';

    // Registry of HITL-capable modules
    const moduleRegistry = new Map();

    // Current configuration
    let config = {
      masterMode: 'hitl', // 'hitl' or 'autonomous'
      moduleOverrides: {}, // { moduleId: 'hitl' | 'autonomous' | 'inherit' }
      approvalQueue: []
    };

    /**
     * Module capabilities that can be controlled
     */
    const HITL_CAPABILITIES = {
      APPROVE_CODE_CHANGES: 'approve_code_changes',
      APPROVE_TOOL_EXECUTION: 'approve_tool_execution',
      APPROVE_FILE_OPERATIONS: 'approve_file_operations',
      APPROVE_SELF_MODIFICATION: 'approve_self_modification',
      APPROVE_EXTERNAL_ACTIONS: 'approve_external_actions',
      REVIEW_TEST_RESULTS: 'review_test_results',
      CONFIRM_DESTRUCTIVE_OPS: 'confirm_destructive_ops',
      MANUAL_VERIFICATION: 'manual_verification'
    };

    /**
     * Initialize the HITL controller
     */
    const init = () => {
      logger.info('[HITLController] Initializing HITL/Autonomous mode controller');

      // Load saved configuration
      loadConfig();

      // Listen for mode change requests
      EventBus.on('hitl:set-master-mode', setMasterMode);
      EventBus.on('hitl:set-module-mode', setModuleMode);
      EventBus.on('hitl:request-approval', handleApprovalRequest);
      EventBus.on('hitl:approve', handleApprove);
      EventBus.on('hitl:reject', handleReject);

      logger.info(`[HITLController] Master mode: ${config.masterMode}`);
    };

    /**
     * Register a module as HITL-capable
     */
    const registerModule = (moduleId, capabilities, description) => {
      if (!moduleId) {
        logger.warn('[HITLController] Cannot register module without ID');
        return;
      }

      moduleRegistry.set(moduleId, {
        id: moduleId,
        description: description || moduleId,
        capabilities: Array.isArray(capabilities) ? capabilities : [capabilities],
        currentMode: config.moduleOverrides[moduleId] || 'inherit',
        registeredAt: Date.now()
      });

      logger.info(`[HITLController] Registered HITL module: ${moduleId}`);
      EventBus.emit('hitl:module-registered', { moduleId });
    };

    /**
     * Get effective mode for a module (considering master switch and overrides)
     */
    const getModuleMode = (moduleId) => {
      const override = config.moduleOverrides[moduleId];

      // If module has explicit override, use it
      if (override && override !== 'inherit') {
        return override;
      }

      // Otherwise use master mode
      return config.masterMode;
    };

    /**
     * Check if a module should request approval for a capability
     */
    const requiresApproval = (moduleId, capability) => {
      const mode = getModuleMode(moduleId);

      // In autonomous mode, never require approval
      if (mode === 'autonomous') {
        return false;
      }

      // In HITL mode, check if module has this capability
      const module = moduleRegistry.get(moduleId);
      if (!module) {
        logger.warn(`[HITLController] Unknown module: ${moduleId}`);
        return false; // Default to allowing if not registered
      }

      // Check if module has this capability
      return module.capabilities.includes(capability);
    };

    /**
     * Set master mode (affects all modules without overrides)
     */
    const setMasterMode = (mode) => {
      if (mode !== 'hitl' && mode !== 'autonomous') {
        logger.error(`[HITLController] Invalid mode: ${mode}`);
        return;
      }

      const oldMode = config.masterMode;
      config.masterMode = mode;

      logger.info(`[HITLController] Master mode changed: ${oldMode} → ${mode}`);
      saveConfig();

      EventBus.emit('hitl:master-mode-changed', {
        oldMode,
        newMode: mode,
        affectedModules: getAffectedModules()
      });
    };

    /**
     * Set mode for a specific module
     */
    const setModuleMode = ({ moduleId, mode }) => {
      if (!moduleRegistry.has(moduleId)) {
        logger.warn(`[HITLController] Cannot set mode for unregistered module: ${moduleId}`);
        return;
      }

      if (mode !== 'hitl' && mode !== 'autonomous' && mode !== 'inherit') {
        logger.error(`[HITLController] Invalid mode: ${mode}`);
        return;
      }

      const oldMode = getModuleMode(moduleId);
      config.moduleOverrides[moduleId] = mode;

      const module = moduleRegistry.get(moduleId);
      module.currentMode = mode;

      const effectiveMode = getModuleMode(moduleId);

      logger.info(`[HITLController] Module ${moduleId}: ${oldMode} → ${effectiveMode} (override: ${mode})`);
      saveConfig();

      EventBus.emit('hitl:module-mode-changed', {
        moduleId,
        oldMode,
        newMode: effectiveMode,
        override: mode
      });
    };

    /**
     * Handle approval request from a module
     */
    const handleApprovalRequest = async (request) => {
      const {
        moduleId,
        capability,
        action,
        data,
        onApprove,
        onReject,
        timeout = null
      } = request;

      // Check if approval is actually required
      if (!requiresApproval(moduleId, capability)) {
        logger.info(`[HITLController] Auto-approving ${action} for ${moduleId} (autonomous mode)`);
        if (onApprove) onApprove(data);
        return;
      }

      // Create approval item
      const approvalId = `${moduleId}-${Date.now()}`;
      const approvalItem = {
        id: approvalId,
        moduleId,
        capability,
        action,
        data,
        onApprove,
        onReject,
        timestamp: Date.now(),
        timeout,
        status: 'pending'
      };

      // Add to queue
      config.approvalQueue.push(approvalItem);

      logger.info(`[HITLController] Approval requested: ${action} (${moduleId})`);

      // Emit event for UI
      EventBus.emit('hitl:approval-pending', approvalItem);

      // Set timeout if specified
      if (timeout) {
        setTimeout(() => {
          const item = config.approvalQueue.find(i => i.id === approvalId);
          if (item && item.status === 'pending') {
            logger.warn(`[HITLController] Approval timeout: ${approvalId}`);
            handleReject({ approvalId, reason: 'Timeout' });
          }
        }, timeout);
      }
    };

    /**
     * Handle approval
     */
    const handleApprove = ({ approvalId, data }) => {
      const index = config.approvalQueue.findIndex(item => item.id === approvalId);
      if (index === -1) {
        logger.warn(`[HITLController] Approval not found: ${approvalId}`);
        return;
      }

      const item = config.approvalQueue[index];
      item.status = 'approved';

      logger.info(`[HITLController] Approved: ${item.action} (${item.moduleId})`);

      // Execute approval callback
      if (item.onApprove) {
        item.onApprove(data || item.data);
      }

      // Remove from queue
      config.approvalQueue.splice(index, 1);

      EventBus.emit('hitl:approval-granted', { approvalId, item });
    };

    /**
     * Handle rejection
     */
    const handleReject = ({ approvalId, reason }) => {
      const index = config.approvalQueue.findIndex(item => item.id === approvalId);
      if (index === -1) {
        logger.warn(`[HITLController] Approval not found: ${approvalId}`);
        return;
      }

      const item = config.approvalQueue[index];
      item.status = 'rejected';
      item.rejectionReason = reason;

      logger.info(`[HITLController] Rejected: ${item.action} (${item.moduleId}) - ${reason}`);

      // Execute rejection callback
      if (item.onReject) {
        item.onReject(reason);
      }

      // Remove from queue
      config.approvalQueue.splice(index, 1);

      EventBus.emit('hitl:approval-rejected', { approvalId, item, reason });
    };

    /**
     * Get all registered modules
     */
    const getRegisteredModules = () => {
      return Array.from(moduleRegistry.values()).map(module => ({
        ...module,
        effectiveMode: getModuleMode(module.id)
      }));
    };

    /**
     * Get modules affected by master switch
     */
    const getAffectedModules = () => {
      return Array.from(moduleRegistry.values())
        .filter(module => !config.moduleOverrides[module.id] || config.moduleOverrides[module.id] === 'inherit')
        .map(module => module.id);
    };

    /**
     * Get current approval queue
     */
    const getApprovalQueue = () => {
      return [...config.approvalQueue];
    };

    /**
     * Get current configuration
     */
    const getConfig = () => {
      return {
        masterMode: config.masterMode,
        moduleOverrides: { ...config.moduleOverrides },
        registeredModules: getRegisteredModules(),
        pendingApprovals: config.approvalQueue.length
      };
    };

    /**
     * Save configuration to localStorage
     */
    const saveConfig = () => {
      try {
        const toSave = {
          masterMode: config.masterMode,
          moduleOverrides: config.moduleOverrides
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
        logger.debug('[HITLController] Configuration saved');
      } catch (error) {
        logger.error('[HITLController] Failed to save config:', error);
      }
    };

    /**
     * Load configuration from localStorage
     */
    const loadConfig = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          config.masterMode = parsed.masterMode || 'hitl';
          config.moduleOverrides = parsed.moduleOverrides || {};
          logger.info('[HITLController] Configuration loaded from storage');
        }
      } catch (error) {
        logger.warn('[HITLController] Failed to load config, using defaults:', error);
      }
    };

    /**
     * Reset to defaults (HITL mode everywhere)
     */
    const resetToDefaults = () => {
      config.masterMode = 'hitl';
      config.moduleOverrides = {};
      config.approvalQueue = [];
      saveConfig();

      logger.info('[HITLController] Reset to default (HITL mode)');
      EventBus.emit('hitl:config-reset');
    };

    // Track approval statistics
    const approvalStats = {
      total: 0,
      approved: 0,
      rejected: 0,
      timedOut: 0,
      history: []
    };

    // Wrap original handlers to track stats
    const originalApprove = handleApprove;
    const originalReject = handleReject;

    const trackApproval = (approvalId, outcome, reason = null) => {
      approvalStats.total++;
      if (outcome === 'approved') approvalStats.approved++;
      else if (outcome === 'rejected') approvalStats.rejected++;
      else if (outcome === 'timeout') approvalStats.timedOut++;

      approvalStats.history.unshift({
        approvalId,
        outcome,
        reason,
        timestamp: Date.now()
      });

      // Keep only last 50
      if (approvalStats.history.length > 50) {
        approvalStats.history = approvalStats.history.slice(0, 50);
      }
    };

    /**
     * Expose state for widget
     */
    const getState = () => ({
      config,
      approvalStats,
      registeredModules: getRegisteredModules(),
      approvalQueue: getApprovalQueue()
    });

    // Initialize on load
    init();

    return {
      api: {
        // Registration
        registerModule,

        // Mode management
        setMasterMode,
        setModuleMode,
        getModuleMode,
        requiresApproval,

        // Approval flow
        requestApproval: handleApprovalRequest,
        approve: (params) => {
          const result = originalApprove(params);
          trackApproval(params.approvalId, 'approved');
          return result;
        },
        reject: (params) => {
          const result = originalReject(params);
          trackApproval(params.approvalId, params.reason === 'Timeout' ? 'timeout' : 'rejected', params.reason);
          return result;
        },

        // Queries
        getConfig,
        getRegisteredModules,
        getApprovalQueue,
        getApprovalStats: () => ({ ...approvalStats, history: [...approvalStats.history] }),
        getState,

        // Utilities
        resetToDefaults,

        // Constants
        CAPABILITIES: HITL_CAPABILITIES
      },

      widget: {
        element: 'hitl-controller-widget',
        displayName: 'HITL Controller',
        icon: '⚙',
        category: 'core',
        order: 15,
        updateInterval: null
      }
    };
  }
};

// Web Component for HITL Controller Widget
class HITLControllerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventBus = null;
  }

  connectedCallback() {
    // Resolve EventBus from DI container
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._eventBus = window.DIContainer.resolve('EventBus');
    }

    this.render();

    // Set up EventBus listeners for real-time updates
    if (this._eventBus) {
      this._updateHandler = () => this.render();
      this._eventBus.on('hitl:master-mode-changed', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:module-mode-changed', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-pending', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-granted', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:approval-rejected', this._updateHandler, 'HITLControllerWidget');
      this._eventBus.on('hitl:config-reset', this._updateHandler, 'HITLControllerWidget');
    }
  }

  disconnectedCallback() {
    // Clean up EventBus listeners
    if (this._eventBus && this._updateHandler) {
      this._eventBus.off('hitl:master-mode-changed', this._updateHandler);
      this._eventBus.off('hitl:module-mode-changed', this._updateHandler);
      this._eventBus.off('hitl:approval-pending', this._updateHandler);
      this._eventBus.off('hitl:approval-granted', this._updateHandler);
      this._eventBus.off('hitl:approval-rejected', this._updateHandler);
      this._eventBus.off('hitl:config-reset', this._updateHandler);
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const state = this._api.getState();
    const queue = state.approvalQueue;
    const hasWarning = queue.length > 0;

    return {
      state: hasWarning ? 'warning' : 'idle',
      primaryMetric: `Mode: ${state.config.masterMode === 'autonomous' ? 'Auto' : 'HITL'}`,
      secondaryMetric: queue.length > 0 ? `${queue.length} pending` : 'No pending',
      lastActivity: queue.length > 0 ? queue[0].timestamp : null,
      message: hasWarning ? `${queue.length} approval${queue.length > 1 ? 's' : ''} needed` : null
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { config, approvalStats, registeredModules, approvalQueue } = state;

    const formatTimestamp = (timestamp) => {
      if (!timestamp) return 'Never';
      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) return `${seconds}s ago`;
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return new Date(timestamp).toLocaleDateString();
    };

    const approvalRate = approvalStats.total > 0
      ? Math.round((approvalStats.approved / approvalStats.total) * 100)
      : 0;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .mode-overview {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-card.warning {
          background: rgba(255, 165, 0, 0.1);
          border-left: 3px solid #ffa500;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.2em;
          font-weight: bold;
          color: #4fc3f7;
        }

        .stat-value.warning {
          color: #ffa500;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-item {
          background: rgba(255,255,255,0.03);
          border-radius: 6px;
          padding: 12px;
          text-align: center;
        }

        .stat-item.success {
          background: rgba(102, 187, 106, 0.1);
          border-left: 3px solid #66bb6a;
        }

        .stat-item.error {
          background: rgba(244, 135, 113, 0.1);
          border-left: 3px solid #f48771;
        }

        .stat-number {
          font-size: 1.5em;
          font-weight: bold;
          color: #4fc3f7;
          margin-bottom: 4px;
        }

        .stat-item.success .stat-number { color: #66bb6a; }
        .stat-item.error .stat-number { color: #f48771; }

        .stat-name {
          font-size: 0.85em;
          color: #888;
        }

        .override-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .override-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .module-name {
          color: #fff;
          font-size: 0.9em;
        }

        .module-mode {
          color: #4fc3f7;
          font-size: 0.85em;
          font-weight: bold;
        }

        .history-list {
          max-height: 200px;
          overflow-y: auto;
        }

        .history-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 6px;
          display: flex;
          gap: 10px;
          align-items: center;
          font-size: 0.9em;
        }

        .history-item.approved {
          border-left: 3px solid #66bb6a;
          background: rgba(102, 187, 106, 0.05);
        }

        .history-item.rejected {
          border-left: 3px solid #f48771;
          background: rgba(244, 135, 113, 0.05);
        }

        .history-item.timeout {
          border-left: 3px solid #ffa500;
          background: rgba(255, 165, 0, 0.05);
        }

        .history-icon {
          font-weight: bold;
        }

        .history-item.approved .history-icon { color: #66bb6a; }
        .history-item.rejected .history-icon { color: #f48771; }
        .history-item.timeout .history-icon { color: #ffa500; }

        .history-time {
          color: #888;
          font-size: 0.85em;
          min-width: 80px;
        }

        .history-reason {
          color: #aaa;
          font-size: 0.85em;
          font-style: italic;
        }

        .button-group {
          display: flex;
          gap: 8px;
          margin-top: 16px;
        }

        button {
          flex: 1;
          background: rgba(79, 195, 247, 0.3);
          border: 1px solid #4fc3f7;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 10px 12px;
          font-size: 0.9em;
          font-weight: bold;
          transition: background 0.2s;
        }

        button:hover {
          background: rgba(79, 195, 247, 0.5);
        }

        button.danger {
          background: rgba(244, 135, 113, 0.3);
          border-color: #f48771;
        }

        button.danger:hover {
          background: rgba(244, 135, 113, 0.5);
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        .scrollable {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 195, 247, 0.5) rgba(255,255,255,0.1);
        }

        .scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .scrollable::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .scrollable::-webkit-scrollbar-thumb {
          background: rgba(79, 195, 247, 0.5);
          border-radius: 3px;
        }
      </style>

      <div class="hitl-controller-panel">
        <h4>⚙ HITL Controller</h4>

        <div class="mode-overview">
          <div class="stat-card">
            <div class="stat-label">Master Mode</div>
            <div class="stat-value">${config.masterMode === 'autonomous' ? '⚙ Autonomous' : '⚇ HITL'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Registered Modules</div>
            <div class="stat-value">${registeredModules.length}</div>
          </div>
          <div class="stat-card ${approvalQueue.length > 0 ? 'warning' : ''}">
            <div class="stat-label">Pending Approvals</div>
            <div class="stat-value ${approvalQueue.length > 0 ? 'warning' : ''}">${approvalQueue.length}</div>
          </div>
        </div>

        <h5>Approval Statistics</h5>
        <div class="stats-grid">
          <div class="stat-item">
            <div class="stat-number">${approvalStats.total}</div>
            <div class="stat-name">Total</div>
          </div>
          <div class="stat-item success">
            <div class="stat-number">${approvalStats.approved}</div>
            <div class="stat-name">Approved</div>
          </div>
          <div class="stat-item error">
            <div class="stat-number">${approvalStats.rejected}</div>
            <div class="stat-name">Rejected</div>
          </div>
          <div class="stat-item">
            <div class="stat-number">${approvalRate}%</div>
            <div class="stat-name">Approval Rate</div>
          </div>
        </div>

        ${registeredModules.filter(m => m.currentMode !== 'inherit').length > 0 ? `
          <h5>Module Overrides (${registeredModules.filter(m => m.currentMode !== 'inherit').length})</h5>
          <div class="override-list scrollable">
            ${registeredModules
              .filter(m => m.currentMode !== 'inherit')
              .map(m => `
                <div class="override-item">
                  <span class="module-name">${m.id}</span>
                  <span class="module-mode">${m.effectiveMode === 'autonomous' ? '⚙' : '⚇'} ${m.effectiveMode}</span>
                </div>
              `).join('')}
          </div>
        ` : ''}

        ${approvalStats.history.length > 0 ? `
          <h5>Recent Approvals (${Math.min(10, approvalStats.history.length)})</h5>
          <div class="history-list scrollable">
            ${approvalStats.history.slice(0, 10).map(h => `
              <div class="history-item ${h.outcome}">
                <span class="history-icon">${
                  h.outcome === 'approved' ? '✓' :
                  h.outcome === 'rejected' ? '✗' : '⏱'
                }</span>
                <span class="history-time">${formatTimestamp(h.timestamp)}</span>
                ${h.reason ? `<span class="history-reason">${h.reason}</span>` : ''}
              </div>
            `).join('')}
          </div>
        ` : ''}

        <div class="button-group">
          <button id="toggle-mode">
            ${config.masterMode === 'autonomous' ? '⚇ Enable HITL' : '⚙ Enable Auto'}
          </button>
          <button id="reset" class="danger">↻ Reset All</button>
        </div>

        <div class="info-panel">
          <strong>ⓘ HITL Controller</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Human-in-the-Loop vs Autonomous Mode Management.<br>
            Controls which modules require human approval vs running autonomously.
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const toggleBtn = this.shadowRoot.getElementById('toggle-mode');
    const resetBtn = this.shadowRoot.getElementById('reset');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        this._api.setMasterMode(config.masterMode === 'autonomous' ? 'hitl' : 'autonomous');
        this.render();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._api.resetToDefaults();
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('hitl-controller-widget')) {
  customElements.define('hitl-controller-widget', HITLControllerWidget);
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HITLController;
}
export default HITLController;
