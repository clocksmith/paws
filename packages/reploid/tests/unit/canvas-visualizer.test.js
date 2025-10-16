import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CanvasVisualizer from '../../upgrades/canvas-visualizer.js';

describe('CanvasVisualizer Module', () => {
  let mockDeps, mockLogger, mockUtils, mockStateManager, mockVizDataAdapter;
  let mockCanvas, mockCtx, mockDocument;

  beforeEach(() => {
    mockLogger = {
      logEvent: vi.fn()
    };

    mockUtils = {
      formatDate: vi.fn(),
      generateId: vi.fn(() => 'test-id')
    };

    mockStateManager = {
      getState: vi.fn(() => ({ totalCycles: 0 })),
      getAllArtifactMetadata: vi.fn(() => ({}))
    };

    mockVizDataAdapter = {
      getDependencyGraph: vi.fn(async () => ({
        nodes: [
          { id: 'node1', x: 100, y: 100, radius: 20 },
          { id: 'node2', x: 200, y: 200, radius: 20 }
        ],
        edges: [
          { source: 'node1', target: 'node2' }
        ]
      })),
      getCognitiveFlow: vi.fn(async () => ({
        nodes: [],
        edges: []
      })),
      getMemoryHeatmap: vi.fn(async () => ({
        heatmap: new Map(),
        nodes: [],
        edges: []
      })),
      getGoalTree: vi.fn(async () => ({
        nodes: [],
        edges: []
      })),
      getToolUsage: vi.fn(async () => ({
        nodes: [],
        edges: []
      }))
    };

    mockDeps = {
      logger: mockLogger,
      Utils: mockUtils,
      StateManager: mockStateManager,
      VizDataAdapter: mockVizDataAdapter
    };

    // Mock canvas and context
    mockCtx = {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      scale: vi.fn(),
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      measureText: vi.fn(() => ({ width: 50 })),
      setLineDash: vi.fn()
    };

    mockCanvas = {
      id: '',
      style: {},
      width: 0,
      height: 0,
      getContext: vi.fn(() => mockCtx),
      addEventListener: vi.fn(),
      getBoundingClientRect: vi.fn(() => ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300
      }))
    };

    mockDocument = {
      createElement: vi.fn((tag) => {
        if (tag === 'canvas') {
          return mockCanvas;
        }
        if (tag === 'button') {
          return {
            textContent: '',
            style: {},
            onclick: null
          };
        }
        return {};
      }),
      body: {
        appendChild: vi.fn()
      }
    };

    global.document = mockDocument;
    // Don't call the callback immediately to avoid infinite loop
    global.requestAnimationFrame = vi.fn(() => 1);
    global.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    delete global.document;
    delete global.requestAnimationFrame;
    delete global.cancelAnimationFrame;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(CanvasVisualizer.metadata.id).toBe('CNVS');
      expect(CanvasVisualizer.metadata.version).toBe('1.0.0');
      expect(CanvasVisualizer.metadata.type).toBe('visualization');
    });

    it('should be async', () => {
      expect(CanvasVisualizer.metadata.async).toBe(true);
    });

    it('should declare dependencies', () => {
      expect(CanvasVisualizer.metadata.dependencies).toContain('logger');
      expect(CanvasVisualizer.metadata.dependencies).toContain('Utils');
      expect(CanvasVisualizer.metadata.dependencies).toContain('StateManager');
      expect(CanvasVisualizer.metadata.dependencies).toContain('VizDataAdapter');
    });
  });

  describe('Initialization', () => {
    it('should throw if dependencies missing', () => {
      expect(() => {
        CanvasVisualizer.factory({});
      }).toThrow('Missing required dependencies');
    });

    it('should initialize with valid dependencies', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      expect(visualizer).toHaveProperty('init');
      expect(typeof visualizer.init).toBe('function');
    });

    it('should create canvas element on init', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(mockDocument.createElement).toHaveBeenCalledWith('canvas');
      expect(mockDocument.body.appendChild).toHaveBeenCalledWith(mockCanvas);
    });

    it('should set canvas properties', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(mockCanvas.id).toBe('reploid-visualizer');
      expect(mockCanvas.width).toBe(400);
      expect(mockCanvas.height).toBe(300);
    });

    it('should setup event listeners', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousedown', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mousemove', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('mouseup', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
      expect(mockCanvas.addEventListener).toHaveBeenCalledWith('wheel', expect.any(Function));
    });

    it('should create mode buttons', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      const buttonCalls = mockDocument.createElement.mock.calls.filter(
        ([tag]) => tag === 'button'
      );
      expect(buttonCalls.length).toBeGreaterThanOrEqual(5);
    });

    it('should start animation loop', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(global.requestAnimationFrame).toHaveBeenCalled();
    });

    it('should log initialization', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('initialized')
      );
    });
  });

  describe('Public API', () => {
    it('should return public API after init', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);
      const api = await visualizer.init();

      expect(api).toHaveProperty('startAnimation');
      expect(api).toHaveProperty('stopAnimation');
      expect(api).toHaveProperty('addParticle');
      expect(api).toHaveProperty('triggerNodePulse');
      expect(api).toHaveProperty('highlightPath');
      expect(api).toHaveProperty('setMode');
      expect(api).toHaveProperty('resize');
      expect(api).toHaveProperty('destroy');
      expect(api).toHaveProperty('updateData');
    });

    describe('startAnimation', () => {
      it('should be callable', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        // Should not throw - animation is already running from init
        expect(() => api.startAnimation()).not.toThrow();
      });
    });

    describe('stopAnimation', () => {
      it('should stop animation loop', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.stopAnimation();

        expect(global.cancelAnimationFrame).toHaveBeenCalled();
      });
    });

    describe('setMode', () => {
      it('should change visualization mode', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.setMode('cognitive');

        // Should trigger data update for new mode
        // Wait a bit for async operations
        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockVizDataAdapter.getCognitiveFlow).toHaveBeenCalled();
      });

      it('should update memory mode', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.setMode('memory');

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockVizDataAdapter.getMemoryHeatmap).toHaveBeenCalled();
      });

      it('should update goals mode', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.setMode('goals');

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockVizDataAdapter.getGoalTree).toHaveBeenCalled();
      });

      it('should update tools mode', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.setMode('tools');

        await new Promise(resolve => setTimeout(resolve, 10));

        expect(mockVizDataAdapter.getToolUsage).toHaveBeenCalled();
      });
    });

    describe('resize', () => {
      it('should resize canvas', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.resize(800, 600);

        expect(mockCanvas.width).toBe(800);
        expect(mockCanvas.height).toBe(600);
        expect(mockCanvas.style.width).toBe('800px');
        expect(mockCanvas.style.height).toBe('600px');
      });
    });

    describe('destroy', () => {
      it('should stop animation and remove canvas', async () => {
        mockCanvas.parentNode = {
          removeChild: vi.fn()
        };

        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        api.destroy();

        expect(global.cancelAnimationFrame).toHaveBeenCalled();
        expect(mockCanvas.parentNode.removeChild).toHaveBeenCalledWith(mockCanvas);
      });

      it('should handle missing parent node', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        mockCanvas.parentNode = null;

        // Should not throw
        expect(() => api.destroy()).not.toThrow();
      });
    });

    describe('addParticle', () => {
      it('should be callable', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        // Should not throw
        expect(() => api.addParticle(100, 100, 'blue')).not.toThrow();
      });
    });

    describe('triggerNodePulse', () => {
      it('should be callable with node ID', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        // Should not throw
        expect(() => api.triggerNodePulse('node1')).not.toThrow();
      });
    });

    describe('highlightPath', () => {
      it('should be callable with node array', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        // Should not throw
        expect(() => api.highlightPath(['node1', 'node2'])).not.toThrow();
      });
    });

    describe('updateData', () => {
      it('should update visualization data', async () => {
        const visualizer = CanvasVisualizer.factory(mockDeps);
        const api = await visualizer.init();

        await api.updateData();

        // Should call the adapter
        expect(mockVizDataAdapter.getDependencyGraph).toHaveBeenCalled();
      });
    });
  });

  describe('Data Adapter Integration', () => {
    it('should work without VizDataAdapter', async () => {
      const depsWithoutAdapter = {
        logger: mockLogger,
        Utils: mockUtils,
        StateManager: mockStateManager
      };

      const visualizer = CanvasVisualizer.factory(depsWithoutAdapter);
      const api = await visualizer.init();

      // Should initialize without errors
      expect(api).toBeDefined();
    });

    it('should fetch dependency graph on init', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);

      await visualizer.init();

      expect(mockVizDataAdapter.getDependencyGraph).toHaveBeenCalled();
    });
  });

  describe('Canvas Interaction', () => {
    it('should setup mouse event handlers', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);
      await visualizer.init();

      const mousedownHandler = mockCanvas.addEventListener.mock.calls.find(
        ([event]) => event === 'mousedown'
      )?.[1];

      expect(mousedownHandler).toBeDefined();

      // Test mousedown
      if (mousedownHandler) {
        const event = { clientX: 100, clientY: 100 };
        mousedownHandler(event);

        expect(mockCanvas.style.cursor).toBe('grabbing');
      }
    });

    it('should setup wheel handler for zoom', async () => {
      const visualizer = CanvasVisualizer.factory(mockDeps);
      await visualizer.init();

      const wheelHandler = mockCanvas.addEventListener.mock.calls.find(
        ([event]) => event === 'wheel'
      )?.[1];

      expect(wheelHandler).toBeDefined();

      // Test wheel
      if (wheelHandler) {
        const event = {
          deltaY: -100,
          preventDefault: vi.fn()
        };
        wheelHandler(event);

        expect(event.preventDefault).toHaveBeenCalled();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing logger', () => {
      const invalidDeps = {
        Utils: mockUtils,
        StateManager: mockStateManager
      };

      expect(() => CanvasVisualizer.factory(invalidDeps)).toThrow();
    });

    it('should handle missing Utils', () => {
      const invalidDeps = {
        logger: mockLogger,
        StateManager: mockStateManager
      };

      expect(() => CanvasVisualizer.factory(invalidDeps)).toThrow();
    });

    it('should handle missing StateManager', () => {
      const invalidDeps = {
        logger: mockLogger,
        Utils: mockUtils
      };

      expect(() => CanvasVisualizer.factory(invalidDeps)).toThrow();
    });
  });
});
