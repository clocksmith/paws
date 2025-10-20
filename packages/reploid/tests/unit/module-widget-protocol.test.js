import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModuleWidgetProtocol from '../../upgrades/module-widget-protocol.js';

describe('ModuleWidgetProtocol', () => {
  let instance;
  let mockDeps;
  let mockEventBus;

  beforeEach(() => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    mockDeps = {
      EventBus: mockEventBus,
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      }
    };

    // Mock localStorage
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn()
    };

    instance = ModuleWidgetProtocol.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(ModuleWidgetProtocol.metadata.id).toBe('ModuleWidgetProtocol');
      expect(ModuleWidgetProtocol.metadata.type).toBe('service');
      expect(ModuleWidgetProtocol.metadata.dependencies).toContain('EventBus');
      expect(ModuleWidgetProtocol.metadata.dependencies).toContain('Utils');
    });

    it('should return widget configuration', () => {
      expect(instance.widget).toBeDefined();
      expect(instance.widget.element).toBe('module-widget-protocol-widget');
      expect(instance.widget.displayName).toBe('Widget Protocol');
      expect(instance.widget.category).toBe('core');
      expect(instance.widget.icon).toBe('🔌');
    });

    it('should expose API methods', () => {
      expect(instance.api).toBeDefined();
      expect(typeof instance.api.registerWidget).toBe('function');
      expect(typeof instance.api.unregisterWidget).toBe('function');
      expect(typeof instance.api.createWidgetInstance).toBe('function');
      expect(typeof instance.api.getWidgetState).toBe('function');
      expect(typeof instance.api.getAllWidgets).toBe('function');
      expect(typeof instance.api.getWidgetsByCategory).toBe('function');
      expect(typeof instance.api.getWidgetControls).toBe('function');
      expect(typeof instance.api.executeControl).toBe('function');
      expect(typeof instance.api.toggleMinimized).toBe('function');
      expect(typeof instance.api.refreshWidget).toBe('function');
      expect(typeof instance.api.refreshAllWidgets).toBe('function');
      expect(typeof instance.api.getMetaCognitiveSummary).toBe('function');
      expect(typeof instance.api.saveWidgetPreferences).toBe('function');
      expect(typeof instance.api.loadWidgetPreferences).toBe('function');
    });

    it('should expose constants', () => {
      expect(instance.api.STATUS).toBeDefined();
      expect(instance.api.CATEGORIES).toBeDefined();
      expect(instance.api.STATUS.ACTIVE).toBe('active');
      expect(instance.api.STATUS.IDLE).toBe('idle');
      expect(instance.api.STATUS.ERROR).toBe('error');
      expect(instance.api.CATEGORIES.CORE).toBe('core');
    });
  });

  describe('Event Handlers', () => {
    it('should register event handlers on initialization', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith('module:loaded', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('module:unloaded', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('widget:refresh', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('widget:refresh-all', expect.any(Function));
    });
  });

  describe('Widget Registration', () => {
    it('should register a Web Component widget', () => {
      const widgetInterface = {
        element: 'test-widget',
        displayName: 'Test Widget',
        icon: '🧪',
        category: 'testing'
      };

      instance.api.registerWidget('TestModule', widgetInterface, { id: 'TestModule' });

      const allWidgets = instance.api.getAllWidgets();
      expect(allWidgets.length).toBe(1);
      expect(allWidgets[0].moduleId).toBe('TestModule');
      expect(allWidgets[0].displayName).toBe('Test Widget');
      expect(allWidgets[0].isWebComponent).toBe(true);
    });

    it('should emit registration event', () => {
      const widgetInterface = {
        element: 'test-widget',
        displayName: 'Test Widget'
      };

      instance.api.registerWidget('TestModule', widgetInterface);

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:registered', expect.objectContaining({
        moduleId: 'TestModule'
      }));
    });

    it('should not register widget without module ID', () => {
      const widgetInterface = { element: 'test-widget' };

      instance.api.registerWidget('', widgetInterface);

      const allWidgets = instance.api.getAllWidgets();
      expect(allWidgets.length).toBe(0);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should use default values for missing widget properties', () => {
      const minimalWidget = {
        element: 'minimal-widget'
      };

      instance.api.registerWidget('MinimalModule', minimalWidget);

      const widgets = instance.api.getAllWidgets();
      expect(widgets[0].icon).toBe('⚙️');
      expect(widgets[0].category).toBe('core');
      expect(widgets[0].minimized).toBe(false);
    });

    it('should register getStatus function or use default', () => {
      const customStatus = vi.fn(() => ({
        state: 'active',
        primaryMetric: 'Custom',
        secondaryMetric: 'Metric',
        lastActivity: Date.now(),
        message: null
      }));

      const widgetInterface = {
        element: 'custom-widget',
        getStatus: customStatus
      };

      instance.api.registerWidget('CustomModule', widgetInterface);

      const state = instance.api.getWidgetState('CustomModule');
      expect(customStatus).toHaveBeenCalled();
      expect(state.state).toBe('active');
      expect(state.primaryMetric).toBe('Custom');
    });

    it('should register getControls function or use default', () => {
      const customControls = vi.fn(() => [
        { id: 'test-control', label: 'Test', action: () => {} }
      ]);

      const widgetInterface = {
        element: 'custom-widget',
        getControls: customControls
      };

      instance.api.registerWidget('CustomModule', widgetInterface);

      const controls = instance.api.getWidgetControls('CustomModule');
      expect(customControls).toHaveBeenCalled();
      expect(controls.length).toBe(1);
      expect(controls[0].id).toBe('test-control');
    });
  });

  describe('Widget Unregistration', () => {
    beforeEach(() => {
      const widgetInterface = { element: 'test-widget' };
      instance.api.registerWidget('TestModule', widgetInterface);
    });

    it('should unregister a widget', () => {
      expect(instance.api.getAllWidgets().length).toBe(1);

      instance.api.unregisterWidget('TestModule');

      expect(instance.api.getAllWidgets().length).toBe(0);
    });

    it('should emit unregistration event', () => {
      instance.api.unregisterWidget('TestModule');

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:unregistered', expect.objectContaining({
        moduleId: 'TestModule'
      }));
    });

    it('should handle unregistering non-existent widget', () => {
      instance.api.unregisterWidget('NonExistentModule');

      // Should not throw error
      expect(instance.api.getAllWidgets().length).toBe(1);
    });
  });

  describe('Widget State Management', () => {
    beforeEach(() => {
      const widgetInterface = {
        element: 'test-widget',
        getStatus: () => ({
          state: 'active',
          primaryMetric: 'Test metric',
          secondaryMetric: 'Secondary',
          lastActivity: Date.now(),
          message: null
        })
      };
      instance.api.registerWidget('TestModule', widgetInterface);
    });

    it('should get widget state', () => {
      const state = instance.api.getWidgetState('TestModule');

      expect(state).toBeDefined();
      expect(state.state).toBe('active');
      expect(state.primaryMetric).toBe('Test metric');
    });

    it('should return null for non-existent widget', () => {
      const state = instance.api.getWidgetState('NonExistent');

      expect(state).toBeNull();
    });

    it('should cache widget state', () => {
      const getStatusSpy = vi.fn(() => ({
        state: 'idle',
        primaryMetric: 'Cached',
        secondaryMetric: 'Test',
        lastActivity: null,
        message: null
      }));

      const widgetInterface = {
        element: 'cached-widget',
        getStatus: getStatusSpy
      };

      instance.api.registerWidget('CachedModule', widgetInterface);

      // First call - should call getStatus
      instance.api.getWidgetState('CachedModule');
      expect(getStatusSpy).toHaveBeenCalledTimes(1);

      // Second call within 1 second - should use cache
      instance.api.getWidgetState('CachedModule');
      expect(getStatusSpy).toHaveBeenCalledTimes(1);
    });

    it('should handle errors in getStatus gracefully', () => {
      const errorWidget = {
        element: 'error-widget',
        getStatus: () => {
          throw new Error('Test error');
        }
      };

      instance.api.registerWidget('ErrorModule', errorWidget);

      const state = instance.api.getWidgetState('ErrorModule');

      expect(state.state).toBe('error');
      expect(state.message).toContain('Test error');
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Widget Queries', () => {
    beforeEach(() => {
      // Register multiple widgets with different categories
      const widgets = [
        { id: 'Module1', category: 'core', element: 'widget-1' },
        { id: 'Module2', category: 'tools', element: 'widget-2' },
        { id: 'Module3', category: 'core', element: 'widget-3' },
        { id: 'Module4', category: 'ui', element: 'widget-4' }
      ];

      widgets.forEach(w => {
        instance.api.registerWidget(w.id, { element: w.element, category: w.category });
      });
    });

    it('should get all widgets', () => {
      const allWidgets = instance.api.getAllWidgets();

      expect(allWidgets.length).toBe(4);
    });

    it('should get widgets by category', () => {
      const coreWidgets = instance.api.getWidgetsByCategory('core');

      expect(coreWidgets.length).toBe(2);
      expect(coreWidgets.every(w => w.category === 'core')).toBe(true);
    });

    it('should include current state in getAllWidgets', () => {
      const allWidgets = instance.api.getAllWidgets();

      allWidgets.forEach(widget => {
        expect(widget.currentState).toBeDefined();
        expect(widget.currentState.state).toBeDefined();
      });
    });
  });

  describe('Widget Controls', () => {
    let controlAction;

    beforeEach(() => {
      controlAction = vi.fn();

      const widgetInterface = {
        element: 'controlled-widget',
        getControls: () => [
          {
            id: 'test-control',
            label: 'Test Control',
            action: controlAction
          }
        ]
      };

      instance.api.registerWidget('ControlledModule', widgetInterface);
    });

    it('should get widget controls', () => {
      const controls = instance.api.getWidgetControls('ControlledModule');

      expect(controls.length).toBe(1);
      expect(controls[0].id).toBe('test-control');
      expect(controls[0].label).toBe('Test Control');
    });

    it('should execute control action', () => {
      instance.api.executeControl('ControlledModule', 'test-control');

      expect(controlAction).toHaveBeenCalled();
      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:control-executed', expect.objectContaining({
        moduleId: 'ControlledModule',
        controlId: 'test-control'
      }));
    });

    it('should refresh widget after control execution', () => {
      instance.api.executeControl('ControlledModule', 'test-control');

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:state-updated', expect.any(Object));
    });

    it('should handle non-existent control', () => {
      instance.api.executeControl('ControlledModule', 'non-existent');

      expect(controlAction).not.toHaveBeenCalled();
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should handle control action errors', () => {
      const errorAction = vi.fn(() => {
        throw new Error('Control error');
      });

      const errorWidget = {
        element: 'error-control-widget',
        getControls: () => [
          { id: 'error-control', label: 'Error', action: errorAction }
        ]
      };

      instance.api.registerWidget('ErrorControlModule', errorWidget);

      instance.api.executeControl('ErrorControlModule', 'error-control');

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:control-error', expect.objectContaining({
        moduleId: 'ErrorControlModule',
        controlId: 'error-control'
      }));
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should return empty array for widget without controls', () => {
      const noControlsWidget = { element: 'no-controls' };
      instance.api.registerWidget('NoControlsModule', noControlsWidget);

      const controls = instance.api.getWidgetControls('NoControlsModule');

      expect(Array.isArray(controls)).toBe(true);
      expect(controls.length).toBe(0);
    });
  });

  describe('Widget Minimization', () => {
    beforeEach(() => {
      instance.api.registerWidget('TestModule', { element: 'test-widget' });
    });

    it('should toggle widget minimized state', () => {
      const widgets = instance.api.getAllWidgets();
      expect(widgets[0].minimized).toBe(false);

      instance.api.toggleMinimized('TestModule');

      const updatedWidgets = instance.api.getAllWidgets();
      expect(updatedWidgets[0].minimized).toBe(true);
    });

    it('should emit toggle event', () => {
      instance.api.toggleMinimized('TestModule');

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:toggled', expect.objectContaining({
        moduleId: 'TestModule',
        minimized: true
      }));
    });

    it('should save preferences after toggle', () => {
      instance.api.toggleMinimized('TestModule');

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'REPLOID_WIDGET_PREFERENCES',
        expect.any(String)
      );
    });
  });

  describe('Widget Refresh', () => {
    beforeEach(() => {
      instance.api.registerWidget('TestModule', { element: 'test-widget' });
    });

    it('should refresh single widget', () => {
      instance.api.refreshWidget({ moduleId: 'TestModule' });

      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:state-updated', expect.objectContaining({
        moduleId: 'TestModule'
      }));
    });

    it('should refresh all widgets', () => {
      instance.api.registerWidget('Module2', { element: 'widget-2' });
      instance.api.registerWidget('Module3', { element: 'widget-3' });

      instance.api.refreshAllWidgets();

      // Should emit state-updated for each widget
      expect(mockEventBus.emit).toHaveBeenCalledWith('widget:state-updated', expect.any(Object));
    });
  });

  describe('Meta-Cognitive Summary', () => {
    beforeEach(() => {
      // Register widgets with different states
      const activeWidget = {
        element: 'active-widget',
        category: 'tools',
        getStatus: () => ({
          state: 'active',
          primaryMetric: 'Running',
          secondaryMetric: 'Test',
          lastActivity: Date.now(),
          message: null
        })
      };

      const idleWidget = {
        element: 'idle-widget',
        category: 'core',
        getStatus: () => ({
          state: 'idle',
          primaryMetric: 'Idle',
          secondaryMetric: 'Waiting',
          lastActivity: null,
          message: null
        })
      };

      const errorWidget = {
        element: 'error-widget',
        category: 'ui',
        getStatus: () => ({
          state: 'error',
          primaryMetric: 'Failed',
          secondaryMetric: 'Error',
          lastActivity: Date.now(),
          message: 'Test error'
        })
      };

      instance.api.registerWidget('ActiveModule', activeWidget);
      instance.api.registerWidget('IdleModule', idleWidget);
      instance.api.registerWidget('ErrorModule', errorWidget);
    });

    it('should generate summary with correct totals', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.totalModules).toBe(3);
    });

    it('should count by status', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.byStatus.active).toBe(1);
      expect(summary.byStatus.idle).toBe(1);
      expect(summary.byStatus.error).toBe(1);
    });

    it('should count by category', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.byCategory.tools).toBe(1);
      expect(summary.byCategory.core).toBe(1);
      expect(summary.byCategory.ui).toBe(1);
    });

    it('should track active modules', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.activeModules.length).toBe(1);
      expect(summary.activeModules[0].moduleId).toBe('ActiveModule');
      expect(summary.activeModules[0].primaryMetric).toBe('Running');
    });

    it('should track error modules', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.errorModules.length).toBe(1);
      expect(summary.errorModules[0].moduleId).toBe('ErrorModule');
      expect(summary.errorModules[0].message).toBe('Test error');
    });

    it('should collect metrics', () => {
      const summary = instance.api.getMetaCognitiveSummary();

      expect(summary.metrics.ActiveModule).toBeDefined();
      expect(summary.metrics.ActiveModule.primary).toBe('Running');
      expect(summary.metrics.IdleModule).toBeDefined();
      expect(summary.metrics.IdleModule.primary).toBe('Idle');
    });
  });

  describe('Preferences Persistence', () => {
    beforeEach(() => {
      instance.api.registerWidget('Module1', { element: 'widget-1', order: 10 });
      instance.api.registerWidget('Module2', { element: 'widget-2', order: 20 });
    });

    it('should save widget preferences', () => {
      instance.api.toggleMinimized('Module1');

      instance.api.saveWidgetPreferences();

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'REPLOID_WIDGET_PREFERENCES',
        expect.stringContaining('Module1')
      );
    });

    it('should load widget preferences', () => {
      const savedPrefs = {
        Module1: { minimized: true, order: 5 },
        Module2: { minimized: false, order: 15 }
      };

      localStorage.getItem.mockReturnValue(JSON.stringify(savedPrefs));

      instance.api.loadWidgetPreferences();

      const widgets = instance.api.getAllWidgets();
      const module1 = widgets.find(w => w.moduleId === 'Module1');

      expect(module1.minimized).toBe(true);
      expect(module1.order).toBe(5);
    });

    it('should handle missing preferences gracefully', () => {
      localStorage.getItem.mockReturnValue(null);

      expect(() => {
        instance.api.loadWidgetPreferences();
      }).not.toThrow();
    });

    it('should handle corrupted preferences gracefully', () => {
      localStorage.getItem.mockReturnValue('invalid json{');

      expect(() => {
        instance.api.loadWidgetPreferences();
      }).not.toThrow();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Module Lifecycle Events', () => {
    let moduleLoadedHandler;
    let moduleUnloadedHandler;

    beforeEach(() => {
      // Get event handlers
      moduleLoadedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'module:loaded'
      )[1];
      moduleUnloadedHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'module:unloaded'
      )[1];
    });

    it('should register widget when module is loaded', () => {
      const module = {
        metadata: { id: 'TestModule' },
        widget: {
          element: 'test-widget',
          displayName: 'Test Widget'
        }
      };

      moduleLoadedHandler({ moduleId: 'TestModule', module });

      const allWidgets = instance.api.getAllWidgets();
      expect(allWidgets.length).toBe(1);
      expect(allWidgets[0].moduleId).toBe('TestModule');
    });

    it('should not register if module has no widget', () => {
      const module = {
        metadata: { id: 'NoWidgetModule' }
        // no widget property
      };

      moduleLoadedHandler({ moduleId: 'NoWidgetModule', module });

      const allWidgets = instance.api.getAllWidgets();
      expect(allWidgets.length).toBe(0);
    });

    it('should unregister widget when module is unloaded', () => {
      // First register a widget
      instance.api.registerWidget('TestModule', { element: 'test-widget' });
      expect(instance.api.getAllWidgets().length).toBe(1);

      // Then unload it
      moduleUnloadedHandler({ moduleId: 'TestModule' });

      expect(instance.api.getAllWidgets().length).toBe(0);
    });
  });

  describe('ModuleWidgetProtocolWidget Web Component', () => {
    let widget;

    beforeEach(() => {
      document.body.innerHTML = '';
      expect(customElements.get('module-widget-protocol-widget')).toBeDefined();
      widget = document.createElement('module-widget-protocol-widget');

      // Register some test widgets
      instance.api.registerWidget('Module1', { element: 'widget-1', category: 'core' });
      instance.api.registerWidget('Module2', { element: 'widget-2', category: 'tools' });
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

    it('should render protocol statistics when connected', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Widget Protocol');
      expect(content).toContain('Total Widgets');
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

    it('should return active state when widgets are registered', () => {
      const status = widget.getStatus();

      expect(status.state).toBe('active');
      expect(status.primaryMetric).toContain('widgets');
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

    it('should have refresh-all-widgets control', () => {
      const controls = widget.getControls();
      const refreshControl = controls.find(c => c.id === 'refresh-all-widgets');

      expect(refreshControl).toBeDefined();
      expect(refreshControl.label).toContain('Refresh');
    });

    it('should have save-preferences control', () => {
      const controls = widget.getControls();
      const saveControl = controls.find(c => c.id === 'save-preferences');

      expect(saveControl).toBeDefined();
      expect(saveControl.label).toContain('Prefs');
    });

    it('should execute refresh control action', () => {
      const controls = widget.getControls();
      const refreshControl = controls.find(c => c.id === 'refresh-all-widgets');

      const result = refreshControl.action();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('message');
    });

    it('should execute save preferences control action', () => {
      const controls = widget.getControls();
      const saveControl = controls.find(c => c.id === 'save-preferences');

      const result = saveControl.action();

      expect(result).toHaveProperty('success');
      expect(result.success).toBe(true);
      expect(localStorage.setItem).toHaveBeenCalled();
    });

    it('should auto-refresh with interval', () => {
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();
    });

    it('should clean up interval on disconnect', () => {
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();

      document.body.removeChild(widget);

      expect(widget._interval).toBeNull();
    });

    it('should display widget count', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('2'); // Should show 2 registered widgets
    });

    it('should display category breakdown', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('By Category');
      expect(content).toContain('core');
      expect(content).toContain('tools');
    });
  });
});
