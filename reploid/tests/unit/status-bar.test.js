/**
 * Unit Tests for Status Bar
 *
 * Blueprint: 0x00006B
 * Module: status-bar.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('StatusBar Module', () => {
  let StatusBar;
  let mockEventBus;
  let mockModuleLoader;

  beforeEach(async () => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock ModuleLoader with sample modules
    const mockModules = {
      'Module1': {
        widget: {
          element: 'module1-widget',
          displayName: 'Module 1'
        }
      },
      'Module2': {
        widget: {
          element: 'module2-widget',
          displayName: 'Module 2'
        }
      }
    };

    mockModuleLoader = {
      getModule: vi.fn(),
      getAllModules: vi.fn(async () => mockModules)
    };

    // Mock feature flag
    global.isModularPanelEnabled = vi.fn(() => true);
    global.config = {
      featureFlags: {
        useModularPanels: {
          StatusBar: true
        }
      }
    };

    // Mock DOM query selector (for widget status retrieval)
    global.document.querySelector = vi.fn((selector) => null);

    // Import module factory
    const factory = (await import('../../upgrades/status-bar.js')).default;
    StatusBar = factory(mockModuleLoader, mockEventBus);
  });

  afterEach(() => {
    if (StatusBar?.api?.cleanup) {
      StatusBar.api.cleanup();
    }

    delete global.isModularPanelEnabled;
    delete global.config;
  });

  describe('Initialization', () => {
    it('should export api and widget objects', () => {
      expect(StatusBar).toHaveProperty('api');
      expect(StatusBar).toHaveProperty('widget');
    });

    it('should subscribe to multiple events', () => {
      StatusBar.api.init();

      expect(mockEventBus.on).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-ready', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-error', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('status:updated', expect.any(Function));
    });

    it('should emit ui:panel-ready on successful init', () => {
      StatusBar.api.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'StatusBar',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('FSM State Tracking', () => {
    let stateChangeHandler;

    beforeEach(() => {
      StatusBar.api.init();

      stateChangeHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'fsm:state:changed'
      )[1];
    });

    it('should update FSM state on fsm:state:changed', () => {
      stateChangeHandler({ from: 'idle', to: 'planning', timestamp: Date.now() });

      expect(StatusBar.api.getCurrentFSMState()).toBe('planning');
    });

    it('should handle missing "to" field gracefully', () => {
      stateChangeHandler({ from: 'idle' });

      expect(StatusBar.api.getCurrentFSMState()).toBe('unknown');
    });

    it('should not process events when feature flag disabled', () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.StatusBar = false;

      const initialState = StatusBar.api.getCurrentFSMState();

      stateChangeHandler({ from: 'idle', to: 'planning' });

      expect(StatusBar.api.getCurrentFSMState()).toBe(initialState);
    });
  });

  describe('System Health Aggregation', () => {
    beforeEach(() => {
      StatusBar.api.init();
    });

    it('should aggregate status from all modules', async () => {
      // Mock widget elements with getStatus()
      const mockWidget1 = {
        getStatus: () => ({
          state: 'active',
          primaryMetric: '10 items',
          secondaryMetric: '100ms',
          lastActivity: Date.now(),
          message: null
        })
      };

      const mockWidget2 = {
        getStatus: () => ({
          state: 'idle',
          primaryMetric: 'Ready',
          secondaryMetric: '',
          lastActivity: null,
          message: null
        })
      };

      global.document.querySelector = vi.fn((selector) => {
        if (selector === 'module1-widget') return mockWidget1;
        if (selector === 'module2-widget') return mockWidget2;
        return null;
      });

      const health = await StatusBar.api.getSystemHealth();

      expect(health.totalModules).toBe(2);
      expect(health.activeCount).toBe(1);
      expect(health.idleCount).toBe(1);
      expect(health.errorCount).toBe(0);
    });

    it('should count error modules', async () => {
      const mockWidget1 = {
        getStatus: () => ({
          state: 'error',
          primaryMetric: 'Error',
          secondaryMetric: '',
          lastActivity: Date.now(),
          message: 'Connection failed'
        })
      };

      const mockWidget2 = {
        getStatus: () => ({
          state: 'active',
          primaryMetric: 'Running',
          secondaryMetric: '',
          lastActivity: Date.now(),
          message: null
        })
      };

      global.document.querySelector = vi.fn((selector) => {
        if (selector === 'module1-widget') return mockWidget1;
        if (selector === 'module2-widget') return mockWidget2;
        return null;
      });

      const health = await StatusBar.api.getSystemHealth();

      expect(health.errorCount).toBe(1);
      expect(health.activeCount).toBe(1);
    });

    it('should handle widgets without mounted elements', async () => {
      // All widgets return null (not mounted)
      global.document.querySelector = vi.fn(() => null);

      const health = await StatusBar.api.getSystemHealth();

      expect(health.totalModules).toBe(2);
      // Should default to idle for unmounted widgets
      expect(health.idleCount).toBe(2);
    });

    it('should handle getStatus() errors gracefully', async () => {
      const mockWidget1 = {
        getStatus: () => {
          throw new Error('getStatus failed');
        }
      };

      global.document.querySelector = vi.fn((selector) => {
        if (selector === 'module1-widget') return mockWidget1;
        return null;
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const health = await StatusBar.api.getSystemHealth();

      // Should still return a valid summary
      expect(health).toHaveProperty('totalModules');
      expect(health.totalModules).toBe(2);

      consoleErrorSpy.mockRestore();
    });

    it('should sort modules by state (errors first)', async () => {
      const mockWidget1 = {
        getStatus: () => ({ state: 'idle', primaryMetric: 'Idle', secondaryMetric: '', lastActivity: null, message: null })
      };

      const mockWidget2 = {
        getStatus: () => ({ state: 'error', primaryMetric: 'Error', secondaryMetric: '', lastActivity: null, message: 'Failed' })
      };

      global.document.querySelector = vi.fn((selector) => {
        if (selector === 'module1-widget') return mockWidget1;
        if (selector === 'module2-widget') return mockWidget2;
        return null;
      });

      const health = await StatusBar.api.getSystemHealth();

      // Error modules should come first
      expect(health.modules[0].state).toBe('error');
      expect(health.modules[1].state).toBe('idle');
    });

    it('should return empty summary when feature flag disabled', async () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.StatusBar = false;

      const health = await StatusBar.api.getSystemHealth();

      expect(health.totalModules).toBe(0);
      expect(health.modules).toEqual([]);
    });
  });

  describe('Status Refresh', () => {
    beforeEach(() => {
      StatusBar.api.init();
    });

    it('should emit status:updated on manual refresh', () => {
      StatusBar.api.refreshStatus();

      expect(mockEventBus.emit).toHaveBeenCalledWith('status:updated');
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe all event listeners', () => {
      StatusBar.api.init();
      StatusBar.api.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-ready', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-error', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('status:updated', expect.any(Function));
    });

    it('should be idempotent', () => {
      StatusBar.api.init();
      StatusBar.api.cleanup();
      StatusBar.api.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledTimes(4);  // 4 events
    });
  });

  describe('Widget Protocol v2.0', () => {
    it('should include all required widget fields', () => {
      const widget = StatusBar.widget;

      expect(widget.element).toBe('status-bar-widget');
      expect(widget.displayName).toBe('Status Bar');
      expect(widget.icon).toBe('📍');
      expect(widget.category).toBe('UI/Panels');
    });

    it('should include v2.0 fields', () => {
      const widget = StatusBar.widget;

      expect(widget).toHaveProperty('visible');
      expect(widget).toHaveProperty('priority');
      expect(widget).toHaveProperty('collapsible');
      expect(widget).toHaveProperty('defaultCollapsed');
    });

    it('should have highest priority (10)', () => {
      expect(StatusBar.widget.priority).toBe(10);
    });

    it('should not be collapsible (always visible)', () => {
      expect(StatusBar.widget.collapsible).toBe(false);
    });

    it('should respect feature flag for visibility', () => {
      expect(StatusBar.widget.visible).toBe(true);

      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.StatusBar = false;

      const factory = require('../../upgrades/status-bar.js').default;
      const SB = factory(mockModuleLoader, mockEventBus);

      expect(SB.widget.visible).toBe(false);
    });
  });

  describe('Web Component', () => {
    it('should register custom element', () => {
      const elementName = 'status-bar-widget';
      const element = customElements.get(elementName);

      expect(element).toBeDefined();
    });

    it('should implement getStatus() with 5 required fields', async () => {
      StatusBar.api.init();

      const widgetEl = document.createElement('status-bar-widget');
      document.body.appendChild(widgetEl);

      // Wait for async render
      await new Promise(resolve => setTimeout(resolve, 100));

      const status = widgetEl.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      document.body.removeChild(widgetEl);
    });

    it('should show error state when modules have errors', async () => {
      StatusBar.api.init();

      // Mock module with error
      const mockWidget1 = {
        getStatus: () => ({
          state: 'error',
          primaryMetric: 'Error',
          secondaryMetric: '',
          lastActivity: Date.now(),
          message: 'Failed'
        })
      };

      global.document.querySelector = vi.fn(() => mockWidget1);

      const widgetEl = document.createElement('status-bar-widget');
      document.body.appendChild(widgetEl);

      await new Promise(resolve => setTimeout(resolve, 100));

      const status = widgetEl.getStatus();

      expect(status.state).toBe('error');
      expect(status.message).toContain('error');

      document.body.removeChild(widgetEl);
    });

    it('should clean up interval on disconnect', () => {
      vi.useFakeTimers();

      const widgetEl = document.createElement('status-bar-widget');
      document.body.appendChild(widgetEl);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      document.body.removeChild(widgetEl);

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should not render when feature flag disabled', () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.StatusBar = false;

      const widgetEl = document.createElement('status-bar-widget');
      document.body.appendChild(widgetEl);

      expect(widgetEl.shadowRoot.innerHTML.trim()).toBe('');

      document.body.removeChild(widgetEl);
    });

    it('should toggle expanded state on click', async () => {
      StatusBar.api.init();

      const widgetEl = document.createElement('status-bar-widget');
      document.body.appendChild(widgetEl);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Initially not expanded
      expect(widgetEl._expanded).toBe(false);

      // Click status bar
      const statusBar = widgetEl.shadowRoot.getElementById('status-bar-toggle');
      if (statusBar) {
        statusBar.click();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(widgetEl._expanded).toBe(true);
      }

      document.body.removeChild(widgetEl);
    });
  });

  describe('Error Handling', () => {
    it('should handle ModuleLoader.getAllModules() failure', async () => {
      mockModuleLoader.getAllModules = vi.fn(async () => {
        throw new Error('ModuleLoader failed');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const health = await StatusBar.api.getSystemHealth();

      // Should return empty summary
      expect(health.totalModules).toBe(0);
      expect(health.modules).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should handle render errors gracefully', async () => {
      StatusBar.api.init();

      const widgetEl = document.createElement('status-bar-widget');

      // Force render error by making getSystemHealth throw
      StatusBar.api.getSystemHealth = vi.fn(async () => {
        throw new Error('Render failed');
      });

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      document.body.appendChild(widgetEl);

      await new Promise(resolve => setTimeout(resolve, 100));

      // Widget should render error state
      const shadowContent = widgetEl.shadowRoot.innerHTML;
      expect(shadowContent).toContain('StatusBar Error');

      document.body.removeChild(widgetEl);
      consoleErrorSpy.mockRestore();
    });
  });
});
