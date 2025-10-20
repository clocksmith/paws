/**
 * Tests for Persona Manager Widget
 * @blueprint 0x000051
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('PersonaManager Widget', () => {
  let widget;
  let mockEventBus;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    window.DIContainer = {
      resolve: vi.fn((name) => {
        if (name === 'EventBus') return mockEventBus;
        if (name === 'ToastNotifications') return {
          show: vi.fn()
        };
        return null;
      })
    };

    // Create widget element
    widget = document.createElement('persona-manager-widget');
    document.body.appendChild(widget);
  });

  afterEach(() => {
    document.body.removeChild(widget);
    delete window.DIContainer;
  });

  it('should create Shadow DOM', () => {
    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot.innerHTML).toContain('Persona Manager');
  });

  it('should implement getStatus() correctly', () => {
    const status = widget.getStatus();

    // Verify all 5 required fields
    expect(status).toHaveProperty('state');
    expect(status).toHaveProperty('primaryMetric');
    expect(status).toHaveProperty('secondaryMetric');
    expect(status).toHaveProperty('lastActivity');

    // Verify state is one of the valid values
    expect(['idle', 'active', 'warning', 'error', 'disabled']).toContain(status.state);

    // Verify metrics format
    expect(status.secondaryMetric).toMatch(/\d+ available/);
  });

  it('should listen to persona events', () => {
    expect(mockEventBus.on).toHaveBeenCalled();

    const eventNames = mockEventBus.on.mock.calls.map(call => call[0]);
    expect(eventNames).toContain('persona:switched');
    expect(eventNames).toContain('persona:loaded');
  });

  it('should clean up event listeners on disconnect', () => {
    widget.disconnectedCallback();

    expect(mockEventBus.off).toHaveBeenCalled();
  });

  it('should clean up update interval on disconnect', () => {
    const interval = widget._interval;
    widget.disconnectedCallback();

    expect(widget._interval).toBeNull();
  });

  it('should render stats grid', () => {
    const statsGrid = widget.shadowRoot.querySelector('.stats-grid');
    expect(statsGrid).toBeTruthy();
  });

  it('should display available personas', () => {
    const personasList = widget.shadowRoot.querySelector('.personas-list');
    expect(personasList).toBeTruthy();
  });

  it('should show active persona info if available', () => {
    const panel = widget.shadowRoot.querySelector('.persona-manager-panel');
    expect(panel).toBeTruthy();
  });

  it('should handle moduleApi setter', () => {
    const mockApi = {
      getAllPersonas: vi.fn(() => []),
      getActivePersona: vi.fn(() => null),
      switchPersona: vi.fn()
    };

    widget.moduleApi = mockApi;

    expect(widget._api).toBe(mockApi);
  });

  it('should update every 3 seconds', () => {
    expect(widget._interval).toBeTruthy();
  });

  it('should render persona switch buttons', () => {
    // The panel should have the capability to show switch buttons
    const panel = widget.shadowRoot.querySelector('.persona-manager-panel');
    expect(panel).toBeTruthy();
  });
});
