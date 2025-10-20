import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EventBusWidget from '../../upgrades/event-bus-widget.js';

describe('EventBusWidget', () => {
  let instance;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      EventBus: {
        on: vi.fn().mockReturnValue(vi.fn()),
        off: vi.fn(),
        emit: vi.fn(),
        getListeners: vi.fn().mockReturnValue([]),
        getStats: vi.fn().mockReturnValue({
          totalListeners: 0,
          uniqueEvents: 0,
          listenersByEvent: [],
          recentEvents: [],
          dependencies: {}
        })
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    instance = EventBusWidget.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(EventBusWidget.metadata.id).toBe('EventBusWidget');
      expect(EventBusWidget.metadata.type).toBe('ui');
      expect(EventBusWidget.metadata.dependencies).toContain('EventBus');
    });

    it('should return widget configuration', () => {
      expect(instance.widget).toBeDefined();
      expect(instance.widget.element).toBe('event-bus-widget');
      expect(instance.widget.displayName).toBe('Event Bus Monitor');
      expect(instance.widget.category).toBe('debugging');
    });
  });

  describe('EventBusWidget Web Component', () => {
    let widget;

    beforeEach(() => {
      document.body.innerHTML = '';
      expect(customElements.get('event-bus-widget')).toBeDefined();
      widget = document.createElement('event-bus-widget');
    });

    afterEach(() => {
      if (widget.parentNode) {
        widget.parentNode.removeChild(widget);
      }
    });

    it('should create shadow DOM on construction', () => {
      expect(widget.shadowRoot).toBeDefined();
      expect(widget.shadowRoot.mode).toBe('open');
    });

    it('should render stats when connected', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Event Bus Monitor');
    });

    it('should implement getStatus() correctly', () => {
      const status = widget.getStatus();

      // All 5 required fields
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      // Validate state value
      const validStates = ['idle', 'active', 'error', 'warning', 'disabled'];
      expect(validStates).toContain(status.state);

      // Validate metric types
      expect(typeof status.primaryMetric).toBe('string');
      expect(typeof status.secondaryMetric).toBe('string');
    });

    it('should implement getControls() correctly', () => {
      const controls = widget.getControls();

      // Verify it returns an array
      expect(Array.isArray(controls)).toBe(true);
      expect(controls.length).toBeGreaterThan(0);

      // Verify each control has required fields
      controls.forEach(control => {
        expect(control).toHaveProperty('id');
        expect(control).toHaveProperty('label');
        expect(control).toHaveProperty('action');
        expect(typeof control.action).toBe('function');
      });
    });

    it('should have toggle logging control', () => {
      const controls = widget.getControls();
      const toggleControl = controls.find(c => c.id === 'toggle-logging');

      expect(toggleControl).toBeDefined();
      expect(toggleControl.label).toMatch(/logging/i);
    });

    it('should have clear history control', () => {
      const controls = widget.getControls();
      const clearControl = controls.find(c => c.id === 'clear-history');

      expect(clearControl).toBeDefined();
      expect(clearControl.label).toMatch(/clear/i);
    });

    it('should execute control actions correctly', () => {
      const controls = widget.getControls();
      const toggleControl = controls.find(c => c.id === 'toggle-logging');

      const result = toggleControl.action();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });

    it('should auto-refresh with interval', () => {
      document.body.appendChild(widget);

      expect(widget._updateInterval).toBeDefined();
    });

    it('should clean up interval on disconnect', () => {
      document.body.appendChild(widget);

      expect(widget._updateInterval).toBeDefined();

      document.body.removeChild(widget);

      expect(widget._updateInterval).toBeUndefined();
    });

    it('should listen to EventBus activity on connect', () => {
      // Mock global EventBus
      global.window = global.window || {};
      global.window.DIContainer = {
        resolve: vi.fn().mockReturnValue(mockDeps.EventBus)
      };

      document.body.appendChild(widget);

      expect(widget._activityHandler).toBeDefined();
    });

    it('should unsubscribe from EventBus on disconnect', () => {
      global.window = global.window || {};
      global.window.DIContainer = {
        resolve: vi.fn().mockReturnValue(mockDeps.EventBus)
      };

      document.body.appendChild(widget);
      const activityHandler = widget._activityHandler;

      document.body.removeChild(widget);

      expect(mockDeps.EventBus.off).toHaveBeenCalledWith('eventbus:activity', activityHandler);
    });
  });
});
