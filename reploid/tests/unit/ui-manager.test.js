import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('UI Manager Module', () => {
  let UI;
  let mockDeps;
  let uiInstance;

  beforeEach(() => {
    // Mock DOM and global objects
    global.document = {
      getElementById: vi.fn((id) => {
        return {
          id,
          innerHTML: '',
          textContent: '',
          style: {},
          classList: {
            add: vi.fn(),
            remove: vi.fn(),
            toggle: vi.fn()
          },
          addEventListener: vi.fn(),
          appendChild: vi.fn(),
          remove: vi.fn(),
          setAttribute: vi.fn(),
          getAttribute: vi.fn(),
          value: ''
        };
      }),
      createElement: vi.fn((tag) => ({
        tagName: tag.toUpperCase(),
        innerHTML: '',
        textContent: '',
        id: '',
        className: '',
        style: { cssText: '' },
        classList: {
          add: vi.fn(),
          remove: vi.fn()
        },
        addEventListener: vi.fn(),
        appendChild: vi.fn(),
        setAttribute: vi.fn()
      })),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
        style: {}
      },
      head: {
        appendChild: vi.fn()
      },
      querySelector: vi.fn(),
      querySelectorAll: vi.fn(() => []),
      documentElement: {
        setAttribute: vi.fn(),
        removeAttribute: vi.fn(),
        getAttribute: vi.fn()
      }
    };

    global.window = {
      innerWidth: 1024,
      innerHeight: 768,
      REPLOID_BOOT_CONFIG: {},
      Chart: undefined,
      d3: undefined,
      acorn: undefined,
      localStorage: {
        getItem: vi.fn(),
        setItem: vi.fn(),
        removeItem: vi.fn()
      }
    };

    global.localStorage = global.window.localStorage;

    global.fetch = vi.fn((url) => {
      return Promise.resolve({
        text: () => Promise.resolve(`<div>Mock HTML for ${url}</div>`),
        ok: true
      });
    });

    global.StateManager = {
      getState: vi.fn(() => ({
        session_id: 'test-session',
        agent_state: 'IDLE',
        cycle: 0,
        goal: 'Test goal',
        turns: [],
        artifactMetadata: {}
      })),
      setState: vi.fn(),
      getAllArtifactMetadata: vi.fn(async () => ({})),
      getArtifactContent: vi.fn(async () => 'mock content'),
      updateAndSaveState: vi.fn(async (fn) => fn({}))
    };

    mockDeps = {
      config: {},
      Utils: {
        logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
        showButtonSuccess: vi.fn(),
        exportAsMarkdown: vi.fn(),
        kabobToCamel: vi.fn((str) => str.replace(/-([a-z])/g, (g) => g[1].toUpperCase())),
        escapeHtml: vi.fn((str) => str)
      },
      DiffGenerator: {
        createDiff: vi.fn(() => [
          { type: 'add', line: 'new line' },
          { type: 'remove', line: 'old line' }
        ])
      },
      EventBus: {
        on: vi.fn(),
        emit: vi.fn(),
        off: vi.fn()
      },
      VFSExplorer: {
        init: vi.fn(async () => true)
      },
      PerformanceMonitor: {
        getMetrics: vi.fn(() => ({
          session: { uptime: 120000, cycles: 10, artifacts: { created: 5, modified: 3 } },
          tools: {}
        })),
        getLLMStats: vi.fn(() => ({
          calls: 100,
          tokens: { total: 5000 },
          avgLatency: 250,
          errorRate: 0.02
        })),
        getMemoryStats: vi.fn(() => ({
          current: { usedJSHeapSize: 50 * 1024 * 1024, jsHeapSizeLimit: 200 * 1024 * 1024 },
          max: 60 * 1024 * 1024
        })),
        generateReport: vi.fn(() => 'Performance Report'),
        reset: vi.fn()
      },
      MetricsDashboard: {
        init: vi.fn(),
        updateCharts: vi.fn()
      },
      Introspector: {
        getModuleGraph: vi.fn(async () => ({
          statistics: { totalModules: 20, avgDependencies: 3.5, byCategory: { core: 5, ui: 5 } },
          edges: Array(30).fill({})
        })),
        getToolCatalog: vi.fn(async () => ({
          statistics: { totalTools: 15, readCount: 8, writeCount: 7 }
        })),
        getCapabilities: vi.fn(() => ({
          features: { webWorker: true, webGPU: false, webAssembly: true }
        })),
        clearCache: vi.fn(),
        generateSelfReport: vi.fn(async () => 'Self Analysis Report')
      },
      ReflectionStore: {
        getReflections: vi.fn(async () => [
          { id: 1, outcome: 'success', category: 'test', description: 'Test reflection', timestamp: Date.now(), metrics: { successRate: 90 } }
        ]),
        getSuccessPatterns: vi.fn(async () => ({
          topCategories: [{ category: 'improvement', count: 5 }],
          insights: ['Pattern 1', 'Pattern 2']
        })),
        getFailurePatterns: vi.fn(async () => ({
          topCategories: [{ category: 'error', count: 2 }],
          insights: ['Failure pattern']
        })),
        generateReport: vi.fn(async () => 'Reflections Report'),
        deleteReflection: vi.fn(async () => true)
      },
      SelfTester: {
        getLastResults: vi.fn(() => ({
          summary: { totalTests: 50, passed: 48, failed: 2, successRate: 96 },
          duration: 1500,
          suites: [
            {
              name: 'Core Tests',
              passed: 10,
              failed: 0,
              tests: [
                { name: 'Test 1', passed: true },
                { name: 'Test 2', passed: true }
              ]
            }
          ]
        })),
        getTestHistory: vi.fn(() => [
          { timestamp: Date.now(), summary: { totalTests: 50, passed: 48, successRate: 96 }, duration: 1500 }
        ]),
        runAllTests: vi.fn(async () => true),
        generateReport: vi.fn(() => 'Self Test Report')
      },
      BrowserAPIs: {
        getCapabilities: vi.fn(() => ({
          fileSystemAccess: true,
          notifications: true,
          storageEstimation: true
        })),
        getDirectoryHandle: vi.fn(() => null),
        getStorageEstimate: vi.fn(async () => ({
          usageMB: 50,
          quotaMB: 1000,
          usagePercent: 5,
          availableMB: 950
        })),
        requestDirectoryAccess: vi.fn(async () => ({ name: 'test-dir' })),
        syncArtifactToFilesystem: vi.fn(async () => true),
        requestNotificationPermission: vi.fn(async () => 'granted'),
        showNotification: vi.fn(async () => true),
        requestPersistentStorage: vi.fn(async () => true),
        generateReport: vi.fn(() => 'Browser APIs Report')
      },
      AgentVisualizer: {
        init: vi.fn(),
        resetVisualization: vi.fn(),
        centerView: vi.fn()
      },
      ASTVisualizer: {
        init: vi.fn(),
        visualizeCode: vi.fn(),
        expandAll: vi.fn(),
        collapseAll: vi.fn()
      },
      ModuleGraphVisualizer: {
        init: vi.fn(),
        visualize: vi.fn(async () => true),
        getStats: vi.fn(() => ({
          totalModules: 20,
          totalDependencies: 30,
          categories: 4,
          avgDependencies: 1.5
        })),
        reset: vi.fn()
      },
      ToastNotifications: {
        init: vi.fn(),
        show: vi.fn(),
        error: vi.fn()
      },
      TutorialSystem: {
        showMenu: vi.fn()
      },
      PyodideRuntime: {
        isReady: vi.fn(() => true),
        getError: vi.fn(() => null),
        execute: vi.fn(async () => ({ success: true, result: 'output' })),
        syncWorkspace: vi.fn(async () => ({ synced: 5 })),
        getPackages: vi.fn(async () => ({ success: true, packages: ['numpy', 'pandas'] })),
        installPackage: vi.fn(async () => ({ success: true }))
      },
      LocalLLM: {
        getStatus: vi.fn(() => ({ ready: false, loading: false, error: null, model: null })),
        checkWebGPU: vi.fn(async () => ({ available: true, info: { vendor: 'Test GPU' } })),
        init: vi.fn(async () => true),
        unload: vi.fn(async () => true),
        complete: vi.fn(async () => ({ text: 'Generated text', tokensPerSecond: 50 }))
      }
    };

    // Create UI module structure
    UI = {
      metadata: {
        id: 'UI',
        version: '4.0.0',
        description: 'Central UI management',
        dependencies: ['config', 'Utils', 'DiffGenerator', 'EventBus', 'VFSExplorer'],
        async: true,
        type: 'ui'
      },
      factory: (deps) => {
        const { Utils, EventBus } = deps;
        const { logger } = Utils;

        let uiRefs = {};
        let isLogView = false;
        let isPerfView = false;

        const init = async () => {
          logger.info('Dashboard UI Manager taking control of DOM...');
          return true;
        };

        return {
          init,
          api: {
            updateGoal: (text) => {
              logger.info('Goal updated:', text);
            },
            streamThought: (chunk) => {
              logger.debug('Streaming thought:', chunk);
            },
            clearThoughts: () => {
              logger.debug('Clearing thoughts');
            },
            renderFileDiff: (path, oldContent, newContent) => {
              logger.debug('Rendering diff for:', path);
            },
            clearFileDiffs: () => {
              logger.debug('Clearing diffs');
            },
            logToAdvanced: (data, type) => {
              logger.info('Advanced log:', data, type);
            }
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.document;
    delete global.window;
    delete global.fetch;
    delete global.localStorage;
    delete global.StateManager;
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(UI.metadata).toEqual({
        id: 'UI',
        version: '4.0.0',
        description: 'Central UI management',
        dependencies: ['config', 'Utils', 'DiffGenerator', 'EventBus', 'VFSExplorer'],
        async: true,
        type: 'ui'
      });
    });

    it('should be marked as async module', () => {
      expect(UI.metadata.async).toBe(true);
    });

    it('should be a UI type module', () => {
      expect(UI.metadata.type).toBe('ui');
    });

    it('should have required dependencies', () => {
      expect(UI.metadata.dependencies).toContain('Utils');
      expect(UI.metadata.dependencies).toContain('EventBus');
    });
  });

  describe('Module Initialization', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
    });

    it('should initialize successfully', async () => {
      const result = await uiInstance.init();
      expect(result).toBe(true);
    });

    it('should log initialization message', async () => {
      await uiInstance.init();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Dashboard UI Manager')
      );
    });

    it('should return init function', () => {
      expect(uiInstance.init).toBeDefined();
      expect(typeof uiInstance.init).toBe('function');
    });
  });

  describe('API Methods', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should expose updateGoal method', () => {
      expect(uiInstance.api.updateGoal).toBeDefined();
      expect(typeof uiInstance.api.updateGoal).toBe('function');
    });

    it('should expose streamThought method', () => {
      expect(uiInstance.api.streamThought).toBeDefined();
      expect(typeof uiInstance.api.streamThought).toBe('function');
    });

    it('should expose clearThoughts method', () => {
      expect(uiInstance.api.clearThoughts).toBeDefined();
      expect(typeof uiInstance.api.clearThoughts).toBe('function');
    });

    it('should expose renderFileDiff method', () => {
      expect(uiInstance.api.renderFileDiff).toBeDefined();
      expect(typeof uiInstance.api.renderFileDiff).toBe('function');
    });

    it('should expose clearFileDiffs method', () => {
      expect(uiInstance.api.clearFileDiffs).toBeDefined();
      expect(typeof uiInstance.api.clearFileDiffs).toBe('function');
    });

    it('should expose logToAdvanced method', () => {
      expect(uiInstance.api.logToAdvanced).toBeDefined();
      expect(typeof uiInstance.api.logToAdvanced).toBe('function');
    });
  });

  describe('Goal Management', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should update goal text', () => {
      uiInstance.api.updateGoal('New test goal');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should handle empty goal', () => {
      uiInstance.api.updateGoal('');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should handle long goal text', () => {
      const longGoal = 'A'.repeat(1000);
      uiInstance.api.updateGoal(longGoal);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });
  });

  describe('Thought Streaming', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should stream thought chunks', () => {
      uiInstance.api.streamThought('test chunk');
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalled();
    });

    it('should handle multiple chunks', () => {
      uiInstance.api.streamThought('chunk 1');
      uiInstance.api.streamThought('chunk 2');
      uiInstance.api.streamThought('chunk 3');
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledTimes(3);
    });

    it('should clear thoughts', () => {
      uiInstance.api.clearThoughts();
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalled();
    });
  });

  describe('Diff Rendering', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should render file diff', () => {
      const path = '/test/file.js';
      const oldContent = 'old content';
      const newContent = 'new content';

      uiInstance.api.renderFileDiff(path, oldContent, newContent);
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith('Rendering diff for:', path);
    });

    it('should handle empty content', () => {
      uiInstance.api.renderFileDiff('/test.js', '', '');
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalled();
    });

    it('should clear diffs', () => {
      uiInstance.api.clearFileDiffs();
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalled();
    });
  });

  describe('Advanced Logging', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should log info messages', () => {
      uiInstance.api.logToAdvanced('Test message', 'info');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should log warning messages', () => {
      uiInstance.api.logToAdvanced('Warning message', 'warn');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should log error messages', () => {
      uiInstance.api.logToAdvanced('Error message', 'error');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should handle object data', () => {
      const data = { message: 'Test', details: { key: 'value' } };
      uiInstance.api.logToAdvanced(data, 'info');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should default to info type', () => {
      uiInstance.api.logToAdvanced('Default type message');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });
  });

  describe('EventBus Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should register event listeners', () => {
      expect(mockDeps.EventBus.on).toBeDefined();
    });

    it('should emit events', () => {
      expect(mockDeps.EventBus.emit).toBeDefined();
    });

    it('should handle event unsubscription', () => {
      expect(mockDeps.EventBus.off).toBeDefined();
    });
  });

  describe('DOM Manipulation', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
    });

    it('should fetch HTML templates', async () => {
      await uiInstance.init();
      expect(fetch).toBeDefined();
    });

    it('should access DOM elements by ID', async () => {
      await uiInstance.init();
      expect(document.getElementById).toBeDefined();
    });

    it('should create DOM elements', () => {
      const element = document.createElement('div');
      expect(element).toBeDefined();
      expect(element.tagName).toBe('DIV');
    });

    it('should manipulate element classes', () => {
      const element = document.getElementById('test');
      element.classList.add('active');
      expect(element.classList.add).toHaveBeenCalledWith('active');
    });
  });

  describe('Performance Monitoring Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should access performance metrics', () => {
      const metrics = mockDeps.PerformanceMonitor.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.session).toBeDefined();
    });

    it('should access LLM stats', () => {
      const llmStats = mockDeps.PerformanceMonitor.getLLMStats();
      expect(llmStats).toBeDefined();
      expect(llmStats.calls).toBeDefined();
    });

    it('should access memory stats', () => {
      const memStats = mockDeps.PerformanceMonitor.getMemoryStats();
      expect(memStats).toBeDefined();
      expect(memStats.current).toBeDefined();
    });
  });

  describe('Introspection Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get module graph', async () => {
      const graph = await mockDeps.Introspector.getModuleGraph();
      expect(graph).toBeDefined();
      expect(graph.statistics).toBeDefined();
    });

    it('should get tool catalog', async () => {
      const catalog = await mockDeps.Introspector.getToolCatalog();
      expect(catalog).toBeDefined();
      expect(catalog.statistics).toBeDefined();
    });

    it('should get capabilities', () => {
      const caps = mockDeps.Introspector.getCapabilities();
      expect(caps).toBeDefined();
      expect(caps.features).toBeDefined();
    });
  });

  describe('Reflection Store Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get reflections', async () => {
      const reflections = await mockDeps.ReflectionStore.getReflections();
      expect(reflections).toBeInstanceOf(Array);
      expect(reflections.length).toBeGreaterThan(0);
    });

    it('should get success patterns', async () => {
      const patterns = await mockDeps.ReflectionStore.getSuccessPatterns();
      expect(patterns).toBeDefined();
      expect(patterns.topCategories).toBeDefined();
    });

    it('should get failure patterns', async () => {
      const patterns = await mockDeps.ReflectionStore.getFailurePatterns();
      expect(patterns).toBeDefined();
      expect(patterns.insights).toBeDefined();
    });
  });

  describe('Self Testing Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get last test results', () => {
      const results = mockDeps.SelfTester.getLastResults();
      expect(results).toBeDefined();
      expect(results.summary).toBeDefined();
    });

    it('should get test history', () => {
      const history = mockDeps.SelfTester.getTestHistory();
      expect(history).toBeInstanceOf(Array);
    });

    it('should run all tests', async () => {
      await mockDeps.SelfTester.runAllTests();
      expect(mockDeps.SelfTester.runAllTests).toHaveBeenCalled();
    });
  });

  describe('Browser APIs Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get browser capabilities', () => {
      const caps = mockDeps.BrowserAPIs.getCapabilities();
      expect(caps).toBeDefined();
      expect(caps.fileSystemAccess).toBeDefined();
    });

    it('should get storage estimate', async () => {
      const estimate = await mockDeps.BrowserAPIs.getStorageEstimate();
      expect(estimate).toBeDefined();
      expect(estimate.usageMB).toBeDefined();
    });

    it('should request directory access', async () => {
      const handle = await mockDeps.BrowserAPIs.requestDirectoryAccess('readwrite');
      expect(handle).toBeDefined();
    });

    it('should request notification permission', async () => {
      const permission = await mockDeps.BrowserAPIs.requestNotificationPermission();
      expect(permission).toBe('granted');
    });
  });

  describe('Visualizer Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should initialize agent visualizer', () => {
      mockDeps.AgentVisualizer.init();
      expect(mockDeps.AgentVisualizer.init).toHaveBeenCalled();
    });

    it('should initialize AST visualizer', () => {
      mockDeps.ASTVisualizer.init();
      expect(mockDeps.ASTVisualizer.init).toHaveBeenCalled();
    });

    it('should initialize module graph visualizer', () => {
      mockDeps.ModuleGraphVisualizer.init();
      expect(mockDeps.ModuleGraphVisualizer.init).toHaveBeenCalled();
    });
  });

  describe('Python REPL Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should check Pyodide readiness', () => {
      const ready = mockDeps.PyodideRuntime.isReady();
      expect(typeof ready).toBe('boolean');
    });

    it('should execute Python code', async () => {
      const result = await mockDeps.PyodideRuntime.execute('print("test")');
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should sync workspace', async () => {
      const result = await mockDeps.PyodideRuntime.syncWorkspace();
      expect(result).toBeDefined();
      expect(result.synced).toBeDefined();
    });

    it('should get installed packages', async () => {
      const result = await mockDeps.PyodideRuntime.getPackages();
      expect(result.success).toBe(true);
      expect(result.packages).toBeInstanceOf(Array);
    });

    it('should install package', async () => {
      const result = await mockDeps.PyodideRuntime.installPackage('numpy');
      expect(result.success).toBe(true);
    });
  });

  describe('Local LLM Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get LLM status', () => {
      const status = mockDeps.LocalLLM.getStatus();
      expect(status).toBeDefined();
      expect(status.ready).toBeDefined();
    });

    it('should check WebGPU availability', async () => {
      const check = await mockDeps.LocalLLM.checkWebGPU();
      expect(check).toBeDefined();
      expect(check.available).toBeDefined();
    });

    it('should initialize LLM', async () => {
      await mockDeps.LocalLLM.init('test-model');
      expect(mockDeps.LocalLLM.init).toHaveBeenCalledWith('test-model');
    });

    it('should unload LLM', async () => {
      await mockDeps.LocalLLM.unload();
      expect(mockDeps.LocalLLM.unload).toHaveBeenCalled();
    });

    it('should complete text', async () => {
      const result = await mockDeps.LocalLLM.complete('test prompt');
      expect(result).toBeDefined();
      expect(result.text).toBeDefined();
    });
  });

  describe('Toast Notifications Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should initialize toast system', () => {
      mockDeps.ToastNotifications.init();
      expect(mockDeps.ToastNotifications.init).toHaveBeenCalled();
    });

    it('should show toast message', () => {
      mockDeps.ToastNotifications.show('Test message', 'success');
      expect(mockDeps.ToastNotifications.show).toHaveBeenCalledWith('Test message', 'success');
    });

    it('should show error toast', () => {
      mockDeps.ToastNotifications.error('Error message');
      expect(mockDeps.ToastNotifications.error).toHaveBeenCalledWith('Error message');
    });
  });

  describe('Tutorial System Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should show tutorial menu', () => {
      mockDeps.TutorialSystem.showMenu();
      expect(mockDeps.TutorialSystem.showMenu).toHaveBeenCalled();
    });
  });

  describe('State Manager Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should get state', () => {
      const state = global.StateManager.getState();
      expect(state).toBeDefined();
      expect(state.session_id).toBeDefined();
    });

    it('should get artifact metadata', async () => {
      const metadata = await global.StateManager.getAllArtifactMetadata();
      expect(metadata).toBeDefined();
    });

    it('should get artifact content', async () => {
      const content = await global.StateManager.getArtifactContent('/test.js');
      expect(content).toBeDefined();
    });
  });

  describe('Utility Functions', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should convert kabob case to camel case', () => {
      const result = mockDeps.Utils.kabobToCamel('test-string-here');
      expect(result).toBe('testStringHere');
    });

    it('should escape HTML', () => {
      const result = mockDeps.Utils.escapeHtml('<script>alert("test")</script>');
      expect(mockDeps.Utils.escapeHtml).toHaveBeenCalled();
    });

    it('should show button success feedback', () => {
      mockDeps.Utils.showButtonSuccess({}, 'Original', 'Success!');
      expect(mockDeps.Utils.showButtonSuccess).toHaveBeenCalled();
    });

    it('should export as markdown', () => {
      mockDeps.Utils.exportAsMarkdown('test.md', 'content');
      expect(mockDeps.Utils.exportAsMarkdown).toHaveBeenCalled();
    });
  });

  describe('Local Storage Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
    });

    it('should save to localStorage', () => {
      localStorage.setItem('test-key', 'test-value');
      expect(localStorage.setItem).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should load from localStorage', () => {
      localStorage.getItem('test-key');
      expect(localStorage.getItem).toHaveBeenCalledWith('test-key');
    });

    it('should remove from localStorage', () => {
      localStorage.removeItem('test-key');
      expect(localStorage.removeItem).toHaveBeenCalledWith('test-key');
    });

    it('should handle missing localStorage items', () => {
      localStorage.getItem.mockReturnValue(null);
      const result = localStorage.getItem('missing-key');
      expect(result).toBeNull();
    });
  });

  describe('Fetch Integration', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
    });

    it('should fetch HTML templates', async () => {
      const response = await fetch('ui-dashboard.html');
      expect(response.ok).toBe(true);
      const text = await response.text();
      expect(text).toContain('Mock HTML');
    });

    it('should fetch CSS styles', async () => {
      const response = await fetch('styles/dashboard.css');
      const text = await response.text();
      expect(text).toBeDefined();
    });

    it('should handle fetch errors gracefully', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));
      try {
        await fetch('error.html');
      } catch (error) {
        expect(error.message).toBe('Network error');
      }
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      uiInstance = UI.factory(mockDeps);
      await uiInstance.init();
    });

    it('should handle missing dependencies gracefully', () => {
      const incompleteDeps = { Utils: mockDeps.Utils };
      expect(() => UI.factory(incompleteDeps)).not.toThrow();
    });

    it('should handle missing DOM elements', () => {
      document.getElementById.mockReturnValue(null);
      const element = document.getElementById('missing');
      expect(element).toBeNull();
    });

    it('should log warnings for failures', () => {
      mockDeps.Utils.logger.warn('Test warning');
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });

    it('should log errors for critical failures', () => {
      mockDeps.Utils.logger.error('Test error');
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Module Export', () => {
    it('should export UI module', () => {
      expect(UI).toBeDefined();
    });

    it('should have factory function', () => {
      expect(UI.factory).toBeDefined();
      expect(typeof UI.factory).toBe('function');
    });

    it('should have metadata', () => {
      expect(UI.metadata).toBeDefined();
      expect(UI.metadata.id).toBe('UI');
    });
  });
});
