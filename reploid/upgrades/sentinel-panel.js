// @blueprint 0x00005F - Sentinel Panel Module
// Sentinel Panel UI Component for REPLOID Agent
// Provides approval workflow for context and proposal reviews
// CLUSTER 2 Phase 8 Implementation

const SentinelPanel = {
  metadata: {
    id: 'SentinelPanel',
    version: '1.0.0',
    description: 'Approval workflow panel for context and proposal reviews',
    features: [
      'Context approval (review selected files)',
      'Proposal approval (review changes with diff viewer)',
      'Auto-approve toggle for context-only approvals',
      'Integration with SentinelFSM state machine',
      'DiffViewerUI integration for visual diffs',
      'Feature flag support for incremental rollout'
    ],
    dependencies: ['EventBus', 'Utils', 'StateManager', 'DiffGenerator?', 'SentinelFSM?'],
    async: false,
    type: 'ui-core',
    widget: {
      element: 'sentinel-panel-widget',
      displayName: 'Sentinel Control',
      visible: false,  // Hidden from ModuleDashboard (core UI)
      category: 'core-ui'
    }
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger, escapeHtml } = Utils;

    // Closure state
    let container = null;
    let currentState = 'IDLE';
    let currentContext = null;
    let autoApproveEnabled = false;  // Persistent setting
    let lastApprovalTime = null;

    // Event listener tracking for cleanup
    const eventListeners = {
      fsmStateChanged: null,
      panelShow: null,
      panelHide: null
    };

    // Cleanup function (prevents memory leaks)
    const cleanup = () => {
      if (eventListeners.fsmStateChanged) {
        EventBus.off('fsm:state:changed', eventListeners.fsmStateChanged);
        eventListeners.fsmStateChanged = null;
      }
      if (eventListeners.panelShow) {
        EventBus.off('ui:panel-show', eventListeners.panelShow);
        eventListeners.panelShow = null;
      }
      if (eventListeners.panelHide) {
        EventBus.off('ui:panel-hide', eventListeners.panelHide);
        eventListeners.panelHide = null;
      }
      logger.info('[SentinelPanel] Cleanup complete');
    };

    // Initialize the sentinel panel
    const init = (containerId) => {
      logger.info('[SentinelPanel] init() called with containerId:', containerId);

      // Clean up any existing listeners first
      cleanup();

      container = document.getElementById(containerId);

      if (!container) {
        logger.error('[SentinelPanel] Container not found:', containerId);
        EventBus.emit('ui:panel-error', {
          panel: 'SentinelPanel',
          error: 'Container not found',
          timestamp: Date.now()
        });
        return;
      }

      // Load auto-approve setting from localStorage
      try {
        const saved = localStorage.getItem('reploid_auto_approve');
        if (saved !== null) {
          autoApproveEnabled = JSON.parse(saved);
          logger.info('[SentinelPanel] Loaded auto-approve setting:', autoApproveEnabled);
        }
      } catch (err) {
        logger.warn('[SentinelPanel] Failed to load auto-approve setting:', err);
      }

      // Add styles if not already present (idempotent)
      if (!document.getElementById('sentinel-panel-styles')) {
        const styles = document.createElement('style');
        styles.id = 'sentinel-panel-styles';
        styles.innerHTML = getSentinelPanelStyles();
        document.head.appendChild(styles);
      }

      // Register event listeners and store references
      eventListeners.fsmStateChanged = handleStateChange;
      eventListeners.panelShow = () => {
        logger.debug('[SentinelPanel] Panel shown');
      };
      eventListeners.panelHide = () => {
        logger.debug('[SentinelPanel] Panel hidden');
      };

      EventBus.on('fsm:state:changed', eventListeners.fsmStateChanged);
      EventBus.on('ui:panel-show', eventListeners.panelShow);
      EventBus.on('ui:panel-hide', eventListeners.panelHide);

      // Render initial state
      render();

      logger.info('[SentinelPanel] Initialized successfully');
      EventBus.emit('ui:panel-ready', {
        panel: 'SentinelPanel',
        mode: 'modular',
        timestamp: Date.now()
      });
    };

    // Handle FSM state changes (CRITICAL - must use 'to' field, not 'newState')
    const handleStateChange = async ({ from, to, context }) => {
      // Feature flag check (prevents duplicate UI)
      const featureFlags = window.reploidConfig?.featureFlags;
      if (featureFlags && !featureFlags.useModularPanels?.SentinelPanel) {
        return;  // Panel disabled, skip rendering
      }

      currentState = to;
      currentContext = context;

      logger.debug('[SentinelPanel] State changed:', { from, to });

      switch (to) {
        case 'AWAITING_CONTEXT_APPROVAL':
          await renderContextApproval(context);
          // Auto-approve if enabled
          if (autoApproveEnabled) {
            logger.info('[SentinelPanel] Auto-approving context');
            setTimeout(() => approveContext(), 100);  // Small delay for UI update
          }
          break;
        case 'AWAITING_PROPOSAL_APPROVAL':
          await renderProposalApproval(context);
          break;
        case 'IDLE':
          renderIdle();
          break;
        default:
          renderDefault(to);
      }
    };

    // Context approval rendering (preserves UIManager pattern)
    const renderContextApproval = async (context) => {
      try {
        let contextContent = '';
        let contextPath = context?.turn?.context_path || context?.catsPath || 'unknown';

        if (context?.turn?.context_path && StateManager) {
          contextContent = await StateManager.getArtifactContent(context.turn.context_path);
        } else if (context?.turn?.cats_content) {
          contextContent = context.turn.cats_content;
        } else if (context?.catsPath && StateManager) {
          contextContent = await StateManager.getArtifactContent(context.catsPath);
        } else {
          contextContent = 'No context content available';
        }

        // Extract filename from path for display
        const contextFileName = contextPath.split('/').pop();

        render(`
          <div class="sentinel-approval-header">
            <h4>Review Context (${contextFileName})</h4>
            <span class="sentinel-badge">Awaiting Approval</span>
          </div>
          <div class="sentinel-approval-content">
            <p class="sentinel-info">Agent wants to read the following files:</p>
            <pre class="sentinel-content">${escapeHtml(contextContent)}</pre>
            <div class="approval-actions">
              <button id="approve-context-btn" class="btn-approve">✓ Approve</button>
              <button id="revise-context-btn" class="btn-revise">⟲ Revise</button>
            </div>
          </div>
        `);

        // Attach button handlers
        const approveBtn = document.getElementById('approve-context-btn');
        const reviseBtn = document.getElementById('revise-context-btn');

        if (approveBtn) {
          approveBtn.onclick = approveContext;
        }

        if (reviseBtn) {
          reviseBtn.onclick = reviseContext;
        }
      } catch (err) {
        logger.error('[SentinelPanel] Failed to render context approval:', err);
        render(`<div class="sentinel-error">Error loading context: ${err.message}</div>`);
      }
    };

    // Proposal approval rendering (with DiffViewerUI integration)
    const renderProposalApproval = async (context) => {
      try {
        let dogsContent = '';

        if (context?.turn?.dogs_path && StateManager) {
          dogsContent = await StateManager.getArtifactContent(context.turn.dogs_path);
        } else if (context?.turn?.dogs_content) {
          dogsContent = context.turn.dogs_content;
        } else {
          dogsContent = 'No proposal content available';
        }

        render(`
          <div class="sentinel-approval-header">
            <h4>Review Proposal (dogs.md)</h4>
            <span class="sentinel-badge">Awaiting Approval</span>
          </div>
          <div class="sentinel-approval-content">
            <p class="sentinel-info">Agent proposes the following changes:</p>
            <div id="diff-viewer-integration"></div>
            <pre class="sentinel-content">${escapeHtml(dogsContent)}</pre>
            <div class="approval-actions">
              <button id="approve-proposal-btn" class="btn-approve">✓ Approve</button>
              <button id="revise-proposal-btn" class="btn-revise">⟲ Revise</button>
            </div>
          </div>
        `);

        // Trigger DiffViewerUI (if available)
        const diffViewerPanel = document.getElementById('diff-viewer-panel');
        if (diffViewerPanel && context?.turn?.dogs_path) {
          diffViewerPanel.classList.remove('hidden');
          EventBus.emit('diff:show', {
            dogs_path: context.turn.dogs_path,
            session_id: context.sessionId,
            turn: context.turn
          });
          logger.debug('[SentinelPanel] Triggered diff viewer');
        }

        // Attach button handlers
        const approveBtn = document.getElementById('approve-proposal-btn');
        const reviseBtn = document.getElementById('revise-proposal-btn');

        if (approveBtn) {
          approveBtn.onclick = approveProposal;
        }

        if (reviseBtn) {
          reviseBtn.onclick = reviseProposal;
        }
      } catch (err) {
        logger.error('[SentinelPanel] Failed to render proposal approval:', err);
        render(`<div class="sentinel-error">Error loading proposal: ${err.message}</div>`);
      }
    };

    // Render idle state
    const renderIdle = () => {
      render(`
        <div class="sentinel-idle">
          <div class="sentinel-idle-icon">✓</div>
          <p>No pending approvals</p>
          <p class="sentinel-idle-subtext">Sentinel is monitoring agent actions</p>
        </div>
      `);
    };

    // Render default state (non-approval states)
    const renderDefault = (state) => {
      render(`
        <div class="sentinel-status">
          <div class="sentinel-status-header">
            <h4>Sentinel Status</h4>
            <span class="sentinel-badge">${state}</span>
          </div>
          <p>Agent is currently: ${state.replace(/_/g, ' ').toLowerCase()}</p>
        </div>
      `);
    };

    // Approve context action
    const approveContext = () => {
      EventBus.emit('user:approve:context', {
        context: currentContext?.turn?.cats_content || currentContext?.turn?.cats_path || '',
        timestamp: Date.now(),
        approved: true
      });

      lastApprovalTime = Date.now();
      logger.info('[SentinelPanel] Context approved');
    };

    // Revise context action (reject)
    const reviseContext = () => {
      EventBus.emit('user:reject:context', {
        context: currentContext?.turn?.cats_content || currentContext?.turn?.cats_path || '',
        timestamp: Date.now(),
        approved: false
      });

      logger.info('[SentinelPanel] Context revision requested');
    };

    // Approve proposal action
    const approveProposal = () => {
      EventBus.emit('user:approve:proposal', {
        proposalId: currentContext?.turn?.dogs_path || '',
        proposalData: currentContext?.turn || {},
        timestamp: Date.now(),
        approved: true
      });

      lastApprovalTime = Date.now();
      logger.info('[SentinelPanel] Proposal approved');
    };

    // Revise proposal action (reject)
    const reviseProposal = () => {
      EventBus.emit('user:reject:proposal', {
        proposalId: currentContext?.turn?.dogs_path || '',
        proposalData: currentContext?.turn || {},
        timestamp: Date.now(),
        approved: false
      });

      logger.info('[SentinelPanel] Proposal revision requested');
    };

    // Toggle auto-approve setting
    const toggleAutoApprove = () => {
      autoApproveEnabled = !autoApproveEnabled;
      logger.info(`[SentinelPanel] Auto-approve: ${autoApproveEnabled}`);

      // Persist setting
      try {
        localStorage.setItem('reploid_auto_approve', JSON.stringify(autoApproveEnabled));
      } catch (err) {
        logger.warn('[SentinelPanel] Failed to persist auto-approve setting:', err);
      }

      // Re-render to update controls
      if (currentState === 'IDLE') {
        renderIdle();
      }

      return autoApproveEnabled;
    };

    // Helper: render content
    const render = (html) => {
      if (!container) return;

      if (html) {
        container.innerHTML = html;
      } else {
        // Default render with controls
        container.innerHTML = `
          <div class="sentinel-panel-header">
            <h4>Sentinel Control</h4>
            <div class="sentinel-controls">
              <button id="toggle-auto-approve-btn" class="btn-secondary ${autoApproveEnabled ? 'active' : ''}" title="${autoApproveEnabled ? 'Disable' : 'Enable'} Auto-Approve">
                ${autoApproveEnabled ? '🔓' : '🔒'} Auto-Approve
              </button>
            </div>
          </div>
          <div class="sentinel-panel-content">
            ${container.innerHTML || '<div class="sentinel-empty">Waiting for sentinel events...</div>'}
          </div>
        `;

        // Attach toggle handler
        const toggleBtn = document.getElementById('toggle-auto-approve-btn');
        if (toggleBtn) {
          toggleBtn.onclick = () => {
            toggleAutoApprove();
            render();  // Re-render to update button
          };
        }
      }
    };

    // Widget Protocol: getStatus()
    const getStatus = () => {
      return {
        state: currentState === 'AWAITING_CONTEXT_APPROVAL' || currentState === 'AWAITING_PROPOSAL_APPROVAL'
          ? 'awaiting-approval'
          : currentState.toLowerCase(),
        primaryMetric: currentState === 'AWAITING_CONTEXT_APPROVAL'
          ? 'Context Approval Required'
          : currentState === 'AWAITING_PROPOSAL_APPROVAL'
          ? 'Proposal Approval Required'
          : 'No Pending Approvals',
        secondaryMetric: autoApproveEnabled ? 'Auto-Approve: ON' : 'Manual Approval',
        lastActivity: lastApprovalTime,
        message: currentState === 'IDLE' ? null : `State: ${currentState}`
      };
    };

    // Widget Protocol: getControls()
    const getControls = () => {
      const controls = [];

      // Auto-Approve Toggle (always available)
      controls.push({
        id: 'toggle-auto-approve',
        label: autoApproveEnabled ? 'Disable Auto-Approve' : 'Enable Auto-Approve',
        icon: autoApproveEnabled ? '🔓' : '🔒',
        action: () => {
          const newState = toggleAutoApprove();
          return {
            success: true,
            message: `Auto-approve ${newState ? 'enabled' : 'disabled'}`
          };
        }
      });

      // Context-specific controls
      if (currentState === 'AWAITING_CONTEXT_APPROVAL') {
        controls.push({
          id: 'approve-context',
          label: 'Approve Context',
          icon: '✓',
          action: () => {
            approveContext();
            return { success: true, message: 'Context approved' };
          }
        });
        controls.push({
          id: 'revise-context',
          label: 'Revise Context',
          icon: '⟲',
          action: () => {
            reviseContext();
            return { success: true, message: 'Context revision requested' };
          }
        });
      }

      if (currentState === 'AWAITING_PROPOSAL_APPROVAL') {
        controls.push({
          id: 'approve-proposal',
          label: 'Approve Proposal',
          icon: '✓',
          action: () => {
            approveProposal();
            return { success: true, message: 'Proposal approved' };
          }
        });
        controls.push({
          id: 'revise-proposal',
          label: 'Revise Proposal',
          icon: '⟲',
          action: () => {
            reviseProposal();
            return { success: true, message: 'Proposal revision requested' };
          }
        });
      }

      return controls;
    };

    // Styles for sentinel panel
    const getSentinelPanelStyles = () => `
      .sentinel-panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.1);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }

      .sentinel-panel-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .sentinel-controls {
        display: flex;
        gap: 8px;
      }

      .sentinel-panel-content {
        padding: 16px;
      }

      .sentinel-approval-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
      }

      .sentinel-approval-header h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
      }

      .sentinel-badge {
        padding: 4px 12px;
        background: rgba(255, 165, 0, 0.2);
        border: 1px solid rgba(255, 165, 0, 0.4);
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        color: rgba(255, 165, 0, 0.9);
        text-transform: uppercase;
      }

      .sentinel-approval-content {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .sentinel-info {
        margin: 0;
        color: rgba(255, 255, 255, 0.7);
        font-size: 13px;
      }

      .sentinel-content {
        padding: 16px;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        border-left: 3px solid #2196F3;
        font-family: 'SF Mono', 'Consolas', monospace;
        font-size: 12px;
        line-height: 1.6;
        color: rgba(255, 255, 255, 0.9);
        max-height: 400px;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
      }

      .approval-actions {
        display: flex;
        gap: 12px;
        margin-top: 8px;
      }

      .btn-approve {
        flex: 1;
        padding: 12px 24px;
        background: #4CAF50;
        border: none;
        border-radius: 4px;
        color: white;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
      }

      .btn-approve:hover {
        background: #45a049;
        box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
      }

      .btn-revise {
        flex: 1;
        padding: 12px 24px;
        background: rgba(255, 152, 0, 0.2);
        border: 1px solid rgba(255, 152, 0, 0.4);
        border-radius: 4px;
        color: rgba(255, 152, 0, 0.9);
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        transition: all 0.2s;
      }

      .btn-revise:hover {
        background: rgba(255, 152, 0, 0.3);
        border-color: rgba(255, 152, 0, 0.6);
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

      .btn-secondary.active {
        background: rgba(76, 175, 80, 0.2);
        border-color: rgba(76, 175, 80, 0.4);
        color: rgba(76, 175, 80, 0.9);
      }

      .sentinel-idle {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 48px 24px;
        text-align: center;
      }

      .sentinel-idle-icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.7;
      }

      .sentinel-idle p {
        margin: 4px 0;
        color: rgba(255, 255, 255, 0.9);
        font-size: 14px;
      }

      .sentinel-idle-subtext {
        color: rgba(255, 255, 255, 0.5);
        font-size: 12px;
      }

      .sentinel-status {
        padding: 16px;
      }

      .sentinel-status-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }

      .sentinel-status-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
      }

      .sentinel-empty {
        padding: 32px;
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        font-style: italic;
      }

      .sentinel-error {
        padding: 16px;
        background: rgba(255, 0, 0, 0.1);
        border: 1px solid rgba(255, 0, 0, 0.3);
        border-radius: 4px;
        color: rgba(255, 100, 100, 0.9);
        font-size: 13px;
      }
    `;

    // Public API
    return {
      init,
      getCurrentState: () => currentState,
      isAutoApproveEnabled: () => autoApproveEnabled,
      toggleAutoApprove,
      approveContext,
      approveProposal,
      reviseContext,
      reviseProposal,
      getStatus,
      getControls,
      cleanup
    };
  }
};

// Export for module loader
export default SentinelPanel;
