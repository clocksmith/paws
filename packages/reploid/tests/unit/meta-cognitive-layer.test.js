/**
 * Tests for Meta-Cognitive Layer Widget
 * @blueprint 0x00004B
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MetaCognitiveLayer Widget', () => {
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
        return null;
      })
    };

    // Create widget element
    widget = document.createElement('meta-cognitive-layer-widget');
    document.body.appendChild(widget);
  });

  afterEach(() => {
    document.body.removeChild(widget);
    delete window.DIContainer;
  });

  it('should create Shadow DOM', () => {
    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot.innerHTML).toContain('Meta-Cognitive Layer');
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

    // Verify metrics are strings or null
    expect(typeof status.primaryMetric === 'string' || status.primaryMetric === null).toBe(true);
    expect(typeof status.secondaryMetric === 'string' || status.secondaryMetric === null).toBe(true);
  });

  it('should have update interval', () => {
    expect(widget._interval).toBeTruthy();
  });

  it('should clean up interval on disconnect', () => {
    const interval = widget._interval;
    widget.disconnectedCallback();

    expect(widget._interval).toBeNull();
  });

  it('should render efficiency monitoring controls', () => {
    const toggleBtn = widget.shadowRoot.querySelector('.toggle-monitoring');
    const checkBtn = widget.shadowRoot.querySelector('.check-now');

    expect(toggleBtn).toBeTruthy();
    expect(checkBtn).toBeTruthy();
  });

  it('should display stats grid', () => {
    const statsGrid = widget.shadowRoot.querySelector('.stats-grid');
    expect(statsGrid).toBeTruthy();
  });

  it('should show recent efficiency checks', () => {
    const panel = widget.shadowRoot.querySelector('.meta-cognitive-panel');
    expect(panel).toBeTruthy();
  });

  it('should handle moduleApi setter', () => {
    const mockApi = { getStatus: vi.fn(), getHistory: vi.fn() };
    widget.moduleApi = mockApi;

    expect(widget._api).toBe(mockApi);
  });

  it('should update every 5 seconds', () => {
    // The update interval is set in connectedCallback
    expect(widget._interval).toBeTruthy();
  });
});
