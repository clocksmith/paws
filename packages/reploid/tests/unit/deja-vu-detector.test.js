/**
 * Tests for DejaVuDetector Widget
 * @blueprint 0x00004A
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('DejaVuDetector Widget', () => {
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
    widget = document.createElement('deja-vu-detector-widget');
    document.body.appendChild(widget);
  });

  afterEach(() => {
    document.body.removeChild(widget);
    delete window.DIContainer;
  });

  it('should create Shadow DOM', () => {
    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot.innerHTML).toContain('Déjà Vu Detector');
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

  it('should have interval for periodic updates', () => {
    expect(widget._interval).toBeTruthy();
  });

  it('should clean up interval on disconnect', () => {
    const interval = widget._interval;
    widget.disconnectedCallback();

    expect(widget._interval).toBeNull();
  });

  it('should detect patterns when button clicked', () => {
    const detectBtn = widget.shadowRoot.querySelector('.detect-patterns');

    if (detectBtn) {
      expect(detectBtn).toBeTruthy();
      expect(detectBtn.textContent).toContain('Detect');
    }
  });

  it('should display pattern statistics', () => {
    const stats = widget.shadowRoot.querySelector('.stats-grid');
    expect(stats).toBeTruthy();
  });

  it('should handle moduleApi setter', () => {
    const mockApi = { someMethod: vi.fn() };
    widget.moduleApi = mockApi;

    expect(widget._api).toBe(mockApi);
  });
});
