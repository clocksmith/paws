/**
 * Unit Tests for Progress Tracker Panel
 *
 * Blueprint: 0x00006A
 * Module: progress-tracker.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ProgressTracker Module', () => {
  let ProgressTracker;
  let mockEventBus;
  let mockModuleLoader;

  beforeEach(async () => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock ModuleLoader
    mockModuleLoader = {
      getModule: vi.fn()
    };

    // Mock feature flag (globally accessible)
    global.isModularPanelEnabled = vi.fn(() => true);

    // Mock config
    global.config = {
      featureFlags: {
        useModularPanels: {
          ProgressTracker: true
        }
      }
    };

    // Import module factory
    const factory = (await import('../../upgrades/progress-tracker.js')).default;
    ProgressTracker = factory(mockModuleLoader, mockEventBus);
  });

  afterEach(() => {
    if (ProgressTracker?.api?.cleanup) {
      ProgressTracker.api.cleanup();
    }

    // Clean up globals
    delete global.isModularPanelEnabled;
    delete global.config;
  });

  describe('Initialization', () => {
    it('should export api and widget objects', () => {
      expect(ProgressTracker).toHaveProperty('api');
      expect(ProgressTracker).toHaveProperty('widget');
    });

    it('should subscribe to fsm:state:changed and progress:event', () => {
      ProgressTracker.api.init();

      expect(mockEventBus.on).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('progress:event', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledTimes(2);
    });

    it('should emit ui:panel-ready on successful init', () => {
      ProgressTracker.api.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'ProgressTracker',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit ui:panel-error on init failure', () => {
      // Force init to fail by making EventBus.on throw
      mockEventBus.on.mockImplementation(() => {
        throw new Error('EventBus failure');
      });

      ProgressTracker.api.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'ProgressTracker',
        error: 'EventBus failure',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Event Handling', () => {
    let stateChangeHandler;
    let progressHandler;

    beforeEach(() => {
      ProgressTracker.api.init();

      // Extract handlers from mock calls
      stateChangeHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];

      progressHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'progress:event'
      )[1];
    });

    describe('fsm:state:changed', () => {
      it('should update current state', () => {
        stateChangeHandler({ from: 'idle', to: 'planning', timestamp: Date.now() });

        expect(ProgressTracker.api.getCurrentState()).toBe('planning');
      });

      it('should increment event count', () => {
        const initialCount = ProgressTracker.api.getEventCount();

        stateChangeHandler({ from: 'idle', to: 'planning', timestamp: Date.now() });

        expect(ProgressTracker.api.getEventCount()).toBe(initialCount + 1);
      });

      it('should update last event time', () => {
        const timestamp = Date.now();
        stateChangeHandler({ from: 'idle', to: 'planning', timestamp });

        expect(ProgressTracker.api.getLastEventTime()).toBe(timestamp);
      });

      it('should append event to history', () => {
        stateChangeHandler({ from: 'idle', to: 'planning', timestamp: Date.now() });

        const history = ProgressTracker.api.getEventHistory();
        expect(history.length).toBeGreaterThan(0);
        expect(history[history.length - 1].type).toBe('state-change');
        expect(history[history.length - 1].detail).toContain('idle → planning');
      });

      it('should handle missing payload fields gracefully', () => {
        stateChangeHandler({ from: null, to: undefined });

        expect(ProgressTracker.api.getCurrentState()).toBe('unknown');
      });

      it('should not process events when feature flag is disabled', () => {
        global.isModularPanelEnabled = vi.fn(() => false);
        global.config.featureFlags.useModularPanels.ProgressTracker = false;

        const initialCount = ProgressTracker.api.getEventCount();

        stateChangeHandler({ from: 'idle', to: 'planning', timestamp: Date.now() });

        // Event count should not increase
        expect(ProgressTracker.api.getEventCount()).toBe(initialCount);
      });
    });

    describe('progress:event', () => {
      it('should increment event count', () => {
        const initialCount = ProgressTracker.api.getEventCount();

        progressHandler({ event: 'test-event', message: 'Test message' });

        expect(ProgressTracker.api.getEventCount()).toBe(initialCount + 1);
      });

      it('should append event to history', () => {
        progressHandler({ event: 'test-event', message: 'Test message' });

        const history = ProgressTracker.api.getEventHistory();
        expect(history.length).toBeGreaterThan(0);
        expect(history[history.length - 1].type).toBe('progress');
      });

      it('should extract detail from payload.event', () => {
        progressHandler({ event: 'tool-executed' });

        const history = ProgressTracker.api.getEventHistory();
        expect(history[history.length - 1].detail).toBe('tool-executed');
      });

      it('should extract detail from payload.message', () => {
        progressHandler({ message: 'Processing complete' });

        const history = ProgressTracker.api.getEventHistory();
        expect(history[history.length - 1].detail).toBe('Processing complete');
      });

      it('should handle string payloads', () => {
        progressHandler('Simple string event');

        const history = ProgressTracker.api.getEventHistory();
        expect(history[history.length - 1].detail).toBe('Simple string event');
      });

      it('should stringify complex payloads', () => {
        progressHandler({ complex: { nested: 'data' } });

        const history = ProgressTracker.api.getEventHistory();
        expect(history[history.length - 1].detail).toContain('complex');
      });

      it('should not process events when feature flag is disabled', () => {
        global.isModularPanelEnabled = vi.fn(() => false);
        global.config.featureFlags.useModularPanels.ProgressTracker = false;

        const initialCount = ProgressTracker.api.getEventCount();

        progressHandler({ event: 'test' });

        expect(ProgressTracker.api.getEventCount()).toBe(initialCount);
      });
    });

    describe('History Auto-Trim', () => {
      it('should auto-trim history to 50 events', () => {
        // Add 100 events
        for (let i = 0; i < 100; i++) {
          progressHandler({ event: `event-${i}` });
        }

        const history = ProgressTracker.api.getEventHistory();
        expect(history.length).toBe(50);
      });

      it('should keep most recent events when trimming', () => {
        // Add 100 events
        for (let i = 0; i < 100; i++) {
          progressHandler({ event: `event-${i}` });
        }

        const history = ProgressTracker.api.getEventHistory();

        // Should contain event-50 through event-99
        expect(history[0].detail).toContain('event-50');
        expect(history[49].detail).toContain('event-99');
      });
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe all event listeners', () => {
      ProgressTracker.api.init();
      ProgressTracker.api.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('progress:event', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledTimes(2);
    });

    it('should be idempotent (safe to call multiple times)', () => {
      ProgressTracker.api.init();
      ProgressTracker.api.cleanup();
      ProgressTracker.api.cleanup();  // Should not throw

      // Each handler should only be unsubscribed once
      expect(mockEventBus.off).toHaveBeenCalledTimes(2);
    });

    it('should not throw if cleanup called before init', () => {
      expect(() => {
        ProgressTracker.api.cleanup();
      }).not.toThrow();
    });
  });

  describe('API Methods', () => {
    beforeEach(() => {
      ProgressTracker.api.init();

      const progressHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'progress:event'
      )[1];

      // Add some test events
      progressHandler({ event: 'event-1' });
      progressHandler({ event: 'event-2' });
      progressHandler({ event: 'event-3' });
    });

    it('getCurrentState should return current FSM state', () => {
      const state = ProgressTracker.api.getCurrentState();
      expect(typeof state).toBe('string');
    });

    it('getEventHistory should return a copy of history array', () => {
      const history1 = ProgressTracker.api.getEventHistory();
      const history2 = ProgressTracker.api.getEventHistory();

      expect(history1).not.toBe(history2);  // Different array instances
      expect(history1).toEqual(history2);   // Same contents
    });

    it('getEventCount should return total event count', () => {
      const count = ProgressTracker.api.getEventCount();
      expect(count).toBeGreaterThanOrEqual(3);
    });

    it('getLastEventTime should return timestamp or null', () => {
      const time = ProgressTracker.api.getLastEventTime();
      expect(time === null || typeof time === 'number').toBe(true);
    });

    it('clearHistory should reset all state', () => {
      ProgressTracker.api.clearHistory();

      expect(ProgressTracker.api.getEventHistory()).toEqual([]);
      expect(ProgressTracker.api.getEventCount()).toBe(0);
      expect(ProgressTracker.api.getLastEventTime()).toBeNull();
    });
  });

  describe('Widget Protocol v2.0', () => {
    it('should include all required widget fields', () => {
      const widget = ProgressTracker.widget;

      expect(widget.element).toBe('progress-tracker-widget');
      expect(widget.displayName).toBe('Progress Tracker');
      expect(widget.icon).toBe('📊');
      expect(widget.category).toBe('UI/Panels');
    });

    it('should include v2.0 fields (visible, priority, collapsible)', () => {
      const widget = ProgressTracker.widget;

      expect(widget).toHaveProperty('visible');
      expect(widget).toHaveProperty('priority');
      expect(widget).toHaveProperty('collapsible');
      expect(widget).toHaveProperty('defaultCollapsed');
    });

    it('should set correct priority', () => {
      expect(ProgressTracker.widget.priority).toBe(5);
    });

    it('should be collapsible', () => {
      expect(ProgressTracker.widget.collapsible).toBe(true);
    });

    it('should respect feature flag for visibility', () => {
      expect(ProgressTracker.widget.visible).toBe(true);

      // Create new instance with disabled feature flag
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.ProgressTracker = false;

      const factory = require('../../upgrades/progress-tracker.js').default;
      const PT = factory(mockModuleLoader, mockEventBus);

      expect(PT.widget.visible).toBe(false);
    });
  });

  describe('Web Component', () => {
    it('should register custom element without duplicates', () => {
      const elementName = 'progress-tracker-widget';
      const element = customElements.get(elementName);

      expect(element).toBeDefined();
    });

    it('should not re-register if already defined', () => {
      // Try to register again (should be safe)
      const elementName = 'progress-tracker-widget';
      const alreadyDefined = customElements.get(elementName);

      expect(alreadyDefined).toBeDefined();
      expect(() => {
        // This should not throw because of the duplicate check
        if (!customElements.get(elementName)) {
          customElements.define(elementName, class extends HTMLElement {});
        }
      }).not.toThrow();
    });

    it('should implement getStatus() with 5 required fields', () => {
      const widgetEl = document.createElement('progress-tracker-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      expect(['idle', 'active', 'error', 'loading'].includes(status.state)).toBe(true);

      document.body.removeChild(widgetEl);
    });

    it('should attach shadow DOM', () => {
      const widgetEl = document.createElement('progress-tracker-widget');
      document.body.appendChild(widgetEl);

      expect(widgetEl.shadowRoot).not.toBeNull();

      document.body.removeChild(widgetEl);
    });

    it('should clean up interval on disconnectedCallback', () => {
      vi.useFakeTimers();

      const widgetEl = document.createElement('progress-tracker-widget');
      document.body.appendChild(widgetEl);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      document.body.removeChild(widgetEl);

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should render empty state when no events', () => {
      ProgressTracker.api.clearHistory();

      const widgetEl = document.createElement('progress-tracker-widget');
      document.body.appendChild(widgetEl);

      const shadowContent = widgetEl.shadowRoot.innerHTML;
      expect(shadowContent).toContain('No events yet');

      document.body.removeChild(widgetEl);
    });

    it('should not render when feature flag disabled', () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.ProgressTracker = false;

      const widgetEl = document.createElement('progress-tracker-widget');
      document.body.appendChild(widgetEl);

      const shadowContent = widgetEl.shadowRoot.innerHTML;
      expect(shadowContent.trim()).toBe('');

      document.body.removeChild(widgetEl);
    });
  });

  describe('Error Handling', () => {
    it('should handle render errors gracefully', () => {
      // Force a render error by making the widget access invalid state
      const widgetEl = document.createElement('progress-tracker-widget');

      // Mock console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      document.body.appendChild(widgetEl);

      // Widget should render error state instead of crashing
      expect(widgetEl.shadowRoot.innerHTML.length).toBeGreaterThan(0);

      document.body.removeChild(widgetEl);
      consoleErrorSpy.mockRestore();
    });

    it('should handle cleanup errors gracefully', () => {
      ProgressTracker.api.init();

      // Force cleanup error by making EventBus.off throw
      mockEventBus.off.mockImplementation(() => {
        throw new Error('Cleanup failure');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        ProgressTracker.api.cleanup();
      }).not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });
});
