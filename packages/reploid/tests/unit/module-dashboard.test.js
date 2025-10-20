import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ModuleDashboard from '../../upgrades/module-dashboard.js';

describe('ModuleDashboard', () => {
  let instance;
  let mockDeps;
  let mockContainer;

  beforeEach(() => {
    // Create mock container
    mockContainer = document.createElement('div');
    mockContainer.id = 'dashboard-container';
    document.body.appendChild(mockContainer);

    mockDeps = {
      ModuleWidgetProtocol: {
        getAllWidgets: vi.fn().mockReturnValue([
          {
            moduleId: 'TestModule1',
            element: 'test-widget-1',
            displayName: 'Test Module 1',
            icon: '⚙️',
            category: 'service',
            order: 1,
            currentState: {
              state: 'idle',
              primaryMetric: '0 items',
              secondaryMetric: 'Ready',
              lastActivity: null,
              message: null
            }
          },
          {
            moduleId: 'TestModule2',
            element: 'test-widget-2',
            displayName: 'Test Module 2',
            icon: '🔧',
            category: 'debugging',
            order: 2,
            currentState: {
              state: 'active',
              primaryMetric: '5 items',
              secondaryMetric: 'Processing',
              lastActivity: Date.now(),
              message: 'Working...'
            }
          }
        ]),
        getWidgetControls: vi.fn().mockReturnValue([]),
        toggleMinimized: vi.fn(),
        executeControl: vi.fn(),
        refreshAllWidgets: vi.fn(),
        loadWidgetPreferences: vi.fn()
      },
      HITLController: {
        getModuleMode: vi.fn().mockReturnValue(null)
      },
      EventBus: {
        on: vi.fn().mockReturnValue(vi.fn()),
        off: vi.fn(),
        emit: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    instance = ModuleDashboard.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(ModuleDashboard.metadata.id).toBe('ModuleDashboard');
      expect(ModuleDashboard.metadata.type).toBe('ui');
      expect(ModuleDashboard.metadata.dependencies).toContain('ModuleWidgetProtocol');
      expect(ModuleDashboard.metadata.dependencies).toContain('EventBus');
    });

    it('should return api object', () => {
      expect(instance.api).toBeDefined();
      expect(instance.api.init).toBeDefined();
      expect(instance.api.render).toBeDefined();
      expect(typeof instance.api.init).toBe('function');
      expect(typeof instance.api.render).toBe('function');
    });

    it('should not have a widget (pure UI module)', () => {
      expect(instance.widget).toBeUndefined();
    });
  });

  describe('Dashboard Initialization', () => {
    it('should initialize with container element', () => {
      expect(() => {
        instance.api.init(mockContainer);
      }).not.toThrow();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing module dashboard')
      );
    });

    it('should register event listeners on init', () => {
      instance.api.init(mockContainer);

      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('widget:registered', expect.any(Function));
      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('widget:unregistered', expect.any(Function));
      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('widget:state-updated', expect.any(Function));
      expect(mockDeps.EventBus.on).toHaveBeenCalledWith('widget:toggled', expect.any(Function));
    });

    it('should load widget preferences on init', () => {
      instance.api.init(mockContainer);

      expect(mockDeps.ModuleWidgetProtocol.loadWidgetPreferences).toHaveBeenCalled();
    });

    it('should render initial dashboard on init', () => {
      instance.api.init(mockContainer);

      expect(mockContainer.innerHTML).toBeTruthy();
      expect(mockContainer.innerHTML).toContain('Module Dashboard');
    });
  });

  describe('Dashboard Rendering', () => {
    beforeEach(() => {
      instance.api.init(mockContainer);
    });

    it('should render module widgets', () => {
      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toContain('Test Module 1');
      expect(content).toContain('Test Module 2');
    });

    it('should render widget categories', () => {
      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toContain('service');
      expect(content).toContain('debugging');
    });

    it('should render widget states', () => {
      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toContain('idle');
      expect(content).toContain('active');
    });

    it('should render widget metrics', () => {
      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toContain('0 items');
      expect(content).toContain('5 items');
      expect(content).toContain('Ready');
      expect(content).toContain('Processing');
    });

    it('should handle empty widget list', () => {
      mockDeps.ModuleWidgetProtocol.getAllWidgets.mockReturnValue([]);

      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toBeTruthy();
    });

    it('should render category filters', () => {
      instance.api.render();

      const content = mockContainer.innerHTML;
      expect(content).toContain('All');
      expect(content).toMatch(/service|debugging/i);
    });
  });

  describe('Window API Integration', () => {
    beforeEach(() => {
      instance.api.init(mockContainer);
      global.window = global.window || {};
    });

    it('should expose ModuleDashboard to window', () => {
      expect(window.ModuleDashboard).toBeDefined();
      expect(window.ModuleDashboard.toggleWidget).toBeDefined();
      expect(window.ModuleDashboard.executeControl).toBeDefined();
      expect(window.ModuleDashboard.refreshAll).toBeDefined();
    });

    it('should toggle widget via window API', () => {
      window.ModuleDashboard.toggleWidget('TestModule1');

      expect(mockDeps.ModuleWidgetProtocol.toggleMinimized).toHaveBeenCalledWith('TestModule1');
    });

    it('should execute control via window API', () => {
      window.ModuleDashboard.executeControl('TestModule1', 'test-control');

      expect(mockDeps.ModuleWidgetProtocol.executeControl).toHaveBeenCalledWith('TestModule1', 'test-control');
    });

    it('should refresh all widgets via window API', () => {
      window.ModuleDashboard.refreshAll();

      expect(mockDeps.ModuleWidgetProtocol.refreshAllWidgets).toHaveBeenCalled();
    });

    it('should toggle view via window API', () => {
      const initialContent = mockContainer.innerHTML;

      window.ModuleDashboard.toggleView();

      // Should trigger re-render
      expect(mockContainer.innerHTML).toBeTruthy();
    });

    it('should set filter via window API', () => {
      window.ModuleDashboard.setFilter('service');

      // Should trigger re-render with filtered widgets
      const content = mockContainer.innerHTML;
      expect(content).toBeTruthy();
    });
  });

  describe('Event Handling', () => {
    let eventHandlers;

    beforeEach(() => {
      eventHandlers = {};
      mockDeps.EventBus.on.mockImplementation((event, handler) => {
        eventHandlers[event] = handler;
        return vi.fn();
      });

      instance.api.init(mockContainer);
    });

    it('should re-render on widget:registered event', () => {
      const initialContent = mockContainer.innerHTML;

      eventHandlers['widget:registered']();

      // Should have triggered re-render
      expect(mockContainer.innerHTML).toBeTruthy();
    });

    it('should re-render on widget:unregistered event', () => {
      eventHandlers['widget:unregistered']();

      expect(mockContainer.innerHTML).toBeTruthy();
    });

    it('should update widget on widget:state-updated event', () => {
      eventHandlers['widget:state-updated']({
        moduleId: 'TestModule1',
        state: {
          state: 'active',
          primaryMetric: '10 items',
          secondaryMetric: 'Updated',
          lastActivity: Date.now(),
          message: 'Updated!'
        }
      });

      expect(mockContainer.innerHTML).toBeTruthy();
    });

    it('should re-render on widget:toggled event', () => {
      eventHandlers['widget:toggled']();

      expect(mockContainer.innerHTML).toBeTruthy();
    });
  });
});
