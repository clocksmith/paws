/**
 * Tests for HITL Control Panel Widget
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('HITLControlPanel Widget', () => {
  let widget;
  let mockEventBus;
  let mockHITLController;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock HITLController
    mockHITLController = {
      getConfig: vi.fn(() => ({
        masterMode: 'hitl',
        registeredModules: []
      })),
      getApprovalQueue: vi.fn(() => []),
      setMasterMode: vi.fn(),
      resetToDefaults: vi.fn()
    };

    // Setup global mocks
    window.DIContainer = {
      resolve: vi.fn((name) => {
        if (name === 'EventBus') return mockEventBus;
        return null;
      })
    };

    window.HITLController = mockHITLController;

    // Create widget element
    widget = document.createElement('hitl-control-panel-widget');
    document.body.appendChild(widget);
  });

  afterEach(() => {
    document.body.removeChild(widget);
    delete window.DIContainer;
    delete window.HITLController;
  });

  it('should create Shadow DOM', () => {
    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot.innerHTML).not.toBe('');
  });

  it('should implement getStatus() correctly', () => {
    const status = widget.getStatus();

    // Verify all 5 required fields
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('primaryMetric');
    expect(status).toHaveProperty('secondaryMetric');
    expect(status).toHaveProperty('lastActivity');
    expect(status).toHaveProperty('message');

    // Verify state is one of the valid values
    expect(['idle', 'active', 'warning', 'error', 'disabled']).toContain(status.state);
  });

  it('should listen to HITL events', () => {
    expect(mockEventBus.on).toHaveBeenCalled();

    const eventNames = mockEventBus.on.mock.calls.map(call => call[0]);
    expect(eventNames).toContain('hitl:master-mode-changed');
    expect(eventNames).toContain('hitl:module-mode-changed');
  });

  it('should clean up event listeners on disconnect', () => {
    widget.disconnectedCallback();

    expect(mockEventBus.off).toHaveBeenCalled();
  });

  it('should render control buttons', () => {
    const switchBtn = widget.shadowRoot.querySelector('.switch-to-auto, .switch-to-hitl');
    const resetBtn = widget.shadowRoot.querySelector('.reset');

    expect(switchBtn).toBeTruthy();
    expect(resetBtn).toBeTruthy();
  });

  it('should show pending approvals if queue has items', () => {
    mockHITLController.getApprovalQueue.mockReturnValue([
      { id: 'test', timestamp: Date.now() }
    ]);

    widget.render();

    const panel = widget.shadowRoot.querySelector('.widget-panel-content');
    expect(panel).toBeTruthy();
  });

  it('should handle moduleApi setter', () => {
    const mockApi = { someMethod: vi.fn() };
    widget.moduleApi = mockApi;

    expect(widget._api).toBe(mockApi);
  });
});
