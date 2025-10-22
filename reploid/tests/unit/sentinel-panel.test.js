/**
 * Unit Tests for Sentinel Panel
 *
 * Blueprint: 0x000069
 * Module: sentinel-panel.js
 * CLUSTER 2 Phase 8 Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('SentinelPanel Module', () => {
  let SentinelPanel;
  let mockEventBus;
  let mockUtils;
  let mockStateManager;

  beforeEach(async () => {
    // Mock DOM
    const mockContainer = { innerHTML: '', classList: { remove: vi.fn() } };
    global.document = {
      getElementById: vi.fn((id) => {
        if (id === 'sentinel-panel-container') return mockContainer;
        if (id === 'diff-viewer-panel') return mockContainer;
        return null;
      }),
      createElement: vi.fn(() => ({ id: '', innerHTML: '', className: '' })),
      head: { appendChild: vi.fn() }
    };
    global.window = {
      reploidConfig: {
        featureFlags: {
          useModularPanels: {
            SentinelPanel: true
          }
        }
      }
    };
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock Utils
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      },
      escapeHtml: vi.fn((text) => text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '')
    };

    // Mock StateManager
    mockStateManager = {
      getArtifactContent: vi.fn(async (path) => `Mock content from ${path}`)
    };

    // Import module
    const SentinelPanelModule = await import('../../upgrades/sentinel-panel.js');
    SentinelPanel = SentinelPanelModule.default.factory({
      EventBus: mockEventBus,
      Utils: mockUtils,
      StateManager: mockStateManager
    });
  });

  afterEach(() => {
    if (SentinelPanel?.cleanup) {
      SentinelPanel.cleanup();
    }

    // Clean up globals
    delete global.document;
    delete global.window;
    delete global.localStorage;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid container', () => {
      SentinelPanel.init('sentinel-panel-container');

      expect(mockEventBus.on).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'SentinelPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit error event when container not found', () => {
      SentinelPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'SentinelPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });

    it('should load auto-approve setting from localStorage', () => {
      global.localStorage.getItem.mockReturnValue('true');

      SentinelPanel.init('sentinel-panel-container');

      expect(SentinelPanel.isAutoApproveEnabled()).toBe(true);
    });
  });

  describe('FSM State Handling', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should track current FSM state', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({ from: 'IDLE', to: 'PLANNING', context: {} });

      expect(SentinelPanel.getCurrentState()).toBe('PLANNING');
    });

    it('should handle AWAITING_CONTEXT_APPROVAL state', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_CONTEXT_APPROVAL',
        context: {
          turn: {
            cats_path: '/path/to/cats.md',
            cats_content: 'File list'
          }
        }
      });

      expect(SentinelPanel.getCurrentState()).toBe('AWAITING_CONTEXT_APPROVAL');
      expect(mockStateManager.getArtifactContent).toHaveBeenCalledWith('/path/to/cats.md');
    });

    it('should handle AWAITING_PROPOSAL_APPROVAL state', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_PROPOSAL_APPROVAL',
        context: {
          turn: {
            dogs_path: '/path/to/dogs.md',
            dogs_content: 'Proposed changes'
          }
        }
      });

      expect(SentinelPanel.getCurrentState()).toBe('AWAITING_PROPOSAL_APPROVAL');
      expect(mockStateManager.getArtifactContent).toHaveBeenCalledWith('/path/to/dogs.md');
    });

    it('should handle IDLE state', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({ from: 'PLANNING', to: 'IDLE', context: {} });

      expect(SentinelPanel.getCurrentState()).toBe('IDLE');
    });

    it('should ignore events when feature flag disabled', async () => {
      global.window.reploidConfig.featureFlags.useModularPanels.SentinelPanel = false;

      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({ from: 'IDLE', to: 'PLANNING', context: {} });

      // State should not update
      expect(SentinelPanel.getCurrentState()).toBe('IDLE');
    });
  });

  describe('Approval Actions', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should emit user:approve:context on approveContext', () => {
      SentinelPanel.approveContext();

      expect(mockEventBus.emit).toHaveBeenCalledWith('user:approve:context', {
        context: '',
        timestamp: expect.any(Number),
        approved: true
      });
    });

    it('should emit user:reject:context on reviseContext', () => {
      SentinelPanel.reviseContext();

      expect(mockEventBus.emit).toHaveBeenCalledWith('user:reject:context', {
        context: '',
        timestamp: expect.any(Number),
        approved: false
      });
    });

    it('should emit user:approve:proposal on approveProposal', () => {
      SentinelPanel.approveProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('user:approve:proposal', {
        proposalId: '',
        proposalData: {},
        timestamp: expect.any(Number),
        approved: true
      });
    });

    it('should emit user:reject:proposal on reviseProposal', () => {
      SentinelPanel.reviseProposal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('user:reject:proposal', {
        proposalId: '',
        proposalData: {},
        timestamp: expect.any(Number),
        approved: false
      });
    });
  });

  describe('Auto-Approve Feature', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should start with auto-approve disabled by default', () => {
      expect(SentinelPanel.isAutoApproveEnabled()).toBe(false);
    });

    it('should toggle auto-approve setting', () => {
      const initialState = SentinelPanel.isAutoApproveEnabled();

      const newState = SentinelPanel.toggleAutoApprove();

      expect(newState).toBe(!initialState);
      expect(SentinelPanel.isAutoApproveEnabled()).toBe(newState);
    });

    it('should persist auto-approve setting to localStorage', () => {
      SentinelPanel.toggleAutoApprove();

      expect(global.localStorage.setItem).toHaveBeenCalledWith(
        'reploid_auto_approve',
        expect.stringContaining('true')
      );
    });
  });

  describe('Widget Protocol - getStatus()', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should return idle state by default', () => {
      const status = SentinelPanel.getStatus();

      expect(status.state).toBe('idle');
      expect(status.primaryMetric).toBe('No Pending Approvals');
      expect(status.secondaryMetric).toBe('Manual Approval');
      expect(status.lastActivity).toBeNull();
      expect(status.message).toBeNull();
    });

    it('should return awaiting-approval state for context approval', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_CONTEXT_APPROVAL',
        context: { turn: { cats_content: 'test' } }
      });

      const status = SentinelPanel.getStatus();

      expect(status.state).toBe('awaiting-approval');
      expect(status.primaryMetric).toBe('Context Approval Required');
    });

    it('should return awaiting-approval state for proposal approval', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_PROPOSAL_APPROVAL',
        context: { turn: { dogs_content: 'test' } }
      });

      const status = SentinelPanel.getStatus();

      expect(status.state).toBe('awaiting-approval');
      expect(status.primaryMetric).toBe('Proposal Approval Required');
    });

    it('should show auto-approve status in secondaryMetric', () => {
      SentinelPanel.toggleAutoApprove();

      const status = SentinelPanel.getStatus();

      expect(status.secondaryMetric).toBe('Auto-Approve: ON');
    });

    it('should track last approval time', () => {
      SentinelPanel.approveContext();

      const status = SentinelPanel.getStatus();

      expect(status.lastActivity).toBeGreaterThan(0);
    });
  });

  describe('Widget Protocol - getControls()', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should always include auto-approve toggle control', () => {
      const controls = SentinelPanel.getControls();

      expect(controls).toHaveLength(1);
      expect(controls[0].id).toBe('toggle-auto-approve');
    });

    it('should include context approval controls when awaiting context approval', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_CONTEXT_APPROVAL',
        context: { turn: { cats_content: 'test' } }
      });

      const controls = SentinelPanel.getControls();

      expect(controls).toHaveLength(3);  // toggle + approve + revise
      expect(controls.find(c => c.id === 'approve-context')).toBeTruthy();
      expect(controls.find(c => c.id === 'revise-context')).toBeTruthy();
    });

    it('should include proposal approval controls when awaiting proposal approval', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_PROPOSAL_APPROVAL',
        context: { turn: { dogs_content: 'test' } }
      });

      const controls = SentinelPanel.getControls();

      expect(controls).toHaveLength(3);  // toggle + approve + revise
      expect(controls.find(c => c.id === 'approve-proposal')).toBeTruthy();
      expect(controls.find(c => c.id === 'revise-proposal')).toBeTruthy();
    });

    it('should execute auto-approve toggle action', () => {
      const controls = SentinelPanel.getControls();
      const toggleControl = controls.find(c => c.id === 'toggle-auto-approve');
      const result = toggleControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Auto-approve');
    });
  });

  describe('DiffViewerUI Integration', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should emit diff:show event for proposal approval', async () => {
      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      await stateHandler({
        from: 'IDLE',
        to: 'AWAITING_PROPOSAL_APPROVAL',
        context: {
          sessionId: 'test-session',
          turn: {
            dogs_path: '/path/to/dogs.md',
            dogs_content: 'Proposed changes'
          }
        }
      });

      expect(mockEventBus.emit).toHaveBeenCalledWith('diff:show', {
        dogs_path: '/path/to/dogs.md',
        session_id: 'test-session',
        turn: expect.objectContaining({
          dogs_path: '/path/to/dogs.md'
        })
      });
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      SentinelPanel.init('sentinel-panel-container');
    });

    it('should unsubscribe all event listeners on cleanup', () => {
      SentinelPanel.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
    });
  });

  describe('Communication Contract Compliance', () => {
    it('should emit ui:panel-ready on successful init', () => {
      SentinelPanel.init('sentinel-panel-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'SentinelPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit ui:panel-error on init failure', () => {
      SentinelPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'SentinelPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });

    it('should use "to" field from fsm:state:changed event', async () => {
      SentinelPanel.init('sentinel-panel-container');

      const stateHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      // Use "to" field (NOT "newState")
      await stateHandler({
        from: 'IDLE',
        to: 'PLANNING',
        context: {}
      });

      expect(SentinelPanel.getCurrentState()).toBe('PLANNING');
    });
  });
});
