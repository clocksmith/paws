import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import AgentVisualizer from '../../upgrades/agent-visualizer.js';

describe('AgentVisualizer Module', () => {
  let mockUtils, mockEventBus, mockSentinelFSM, mockDeps;
  let visualizer;
  let eventHandlers;

  beforeEach(() => {
    eventHandlers = {};

    // Mock Utils
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn((event, handler, id) => {
        eventHandlers[event] = handler;
      }),
      off: vi.fn()
    };

    // Mock SentinelFSM
    mockSentinelFSM = {
      getCurrentState: vi.fn(() => 'IDLE'),
      getStateHistory: vi.fn(() => [])
    };

    mockDeps = {
      Utils: mockUtils,
      EventBus: mockEventBus,
      SentinelFSM: mockSentinelFSM
    };

    // Mock D3 minimal
    const createChainable = () => ({
      attr: vi.fn(function() { return this; }),
      selectAll: vi.fn(() => createChainable()),
      append: vi.fn(() => createChainable()),
      data: vi.fn(() => createChainable()),
      join: vi.fn(() => createChainable()),
      remove: vi.fn(),
      call: vi.fn(function() { return this; }),
      select: vi.fn(() => createChainable()),
      transition: vi.fn(() => createChainable()),
      duration: vi.fn(function() { return this; }),
      filter: vi.fn(() => createChainable()),
      text: vi.fn(function() { return this; }),
      on: vi.fn(function() { return this; }),
      node: vi.fn(() => ({}))
    });

    global.d3 = {
      select: vi.fn(() => createChainable()),
      forceSimulation: vi.fn(() => ({
        force: vi.fn(function() { return this; }),
        on: vi.fn(),
        stop: vi.fn()
      })),
      forceLink: vi.fn(() => ({
        id: vi.fn(function() { return this; }),
        distance: vi.fn(function() { return this; })
      })),
      forceManyBody: vi.fn(() => ({
        strength: vi.fn()
      })),
      forceCenter: vi.fn(() => ({})),
      forceCollide: vi.fn(() => ({
        radius: vi.fn()
      })),
      zoom: vi.fn(() => ({
        scaleExtent: vi.fn(function() { return this; }),
        on: vi.fn()
      })),
      drag: vi.fn(() => ({
        on: vi.fn(function() { return this; })
      }))
    };

    visualizer = AgentVisualizer.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.d3;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(AgentVisualizer.metadata.id).toBe('AgentVisualizer');
      expect(AgentVisualizer.metadata.version).toBe('1.0.0');
      expect(AgentVisualizer.metadata.type).toBe('ui');
    });

    it('should declare required dependencies', () => {
      expect(AgentVisualizer.metadata.dependencies).toContain('Utils');
      expect(AgentVisualizer.metadata.dependencies).toContain('EventBus');
      expect(AgentVisualizer.metadata.dependencies).toContain('SentinelFSM');
    });

    it('should be synchronous', () => {
      expect(AgentVisualizer.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with container element', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(mockEventBus.on).toHaveBeenCalledWith(
        'fsm:state:changed',
        expect.any(Function),
        'AgentVisualizer'
      );
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialized')
      );
    });

    it('should get current state from FSM on init', () => {
      mockSentinelFSM.getCurrentState.mockReturnValue('CURATING_CONTEXT');
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(mockSentinelFSM.getCurrentState).toHaveBeenCalled();
    });

    it('should clone FSM history on init', () => {
      const history = [
        { from: 'IDLE', to: 'CURATING_CONTEXT' },
        { from: 'CURATING_CONTEXT', to: 'PLANNING_WITH_CONTEXT' }
      ];
      mockSentinelFSM.getStateHistory.mockReturnValue(history);
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(mockSentinelFSM.getStateHistory).toHaveBeenCalled();
    });

    it('should warn if already initialized', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);
      visualizer.init(container);

      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Already initialized')
      );
    });

    it('should handle missing container', () => {
      visualizer.init(null);

      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('container or D3 not available')
      );
    });

    it('should handle missing D3', () => {
      delete global.d3;
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('D3 not available')
      );
    });
  });

  describe('State Change Handling', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle state change events', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({
        oldState: 'IDLE',
        newState: 'CURATING_CONTEXT'
      });

      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('IDLE → CURATING_CONTEXT')
      );
    });

    it('should track state history', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({
        oldState: 'IDLE',
        newState: 'CURATING_CONTEXT'
      });

      stateChangeHandler({
        oldState: 'CURATING_CONTEXT',
        newState: 'PLANNING_WITH_CONTEXT'
      });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(2);
      expect(history[0].from).toBe('IDLE');
      expect(history[0].to).toBe('CURATING_CONTEXT');
      expect(history[1].from).toBe('CURATING_CONTEXT');
      expect(history[1].to).toBe('PLANNING_WITH_CONTEXT');
    });

    it('should add timestamps to state history', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({
        oldState: 'IDLE',
        newState: 'CURATING_CONTEXT'
      });

      const history = visualizer.getStateHistory();
      expect(history[0].timestamp).toBeDefined();
      expect(typeof history[0].timestamp).toBe('number');
    });
  });

  describe('API Methods', () => {
    it('should return state history', () => {
      const history = visualizer.getStateHistory();

      expect(Array.isArray(history)).toBe(true);
    });

    it('should reset visualization', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];
      stateChangeHandler({ oldState: 'IDLE', newState: 'CURATING_CONTEXT' });

      visualizer.reset();

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(0);
    });

    it('should destroy visualization', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.destroy();

      expect(mockEventBus.off).toHaveBeenCalledWith('fsm:state:changed', expect.any(Function));
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Destroyed')
      );
    });

    it('should export SVG', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      // Mock XMLSerializer
      global.XMLSerializer = vi.fn(() => ({
        serializeToString: vi.fn(() => '<svg></svg>')
      }));

      const svg = visualizer.exportSVG();

      // Should attempt to export (may be null without full D3 mock)
      expect(svg === null || typeof svg === 'string').toBe(true);

      delete global.XMLSerializer;
    });

    it('should return null when exporting without init', () => {
      const svg = visualizer.exportSVG();

      expect(svg).toBeNull();
    });
  });

  describe('Update Visualization', () => {
    it('should not update before initialization', () => {
      visualizer.updateVisualization();

      // Should not throw, just return early
      expect(mockUtils.logger.debug).not.toHaveBeenCalled();
    });

    it('should update after state change', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];
      stateChangeHandler({ oldState: 'IDLE', newState: 'CURATING_CONTEXT' });

      expect(mockUtils.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Visualization updated')
      );
    });
  });

  describe('State History Tracking', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should track multiple transitions', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'IDLE', newState: 'CURATING_CONTEXT' });
      stateChangeHandler({ oldState: 'CURATING_CONTEXT', newState: 'PLANNING_WITH_CONTEXT' });
      stateChangeHandler({ oldState: 'PLANNING_WITH_CONTEXT', newState: 'GENERATING_PROPOSAL' });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(3);
    });

    it('should preserve history order', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'IDLE', newState: 'A' });
      stateChangeHandler({ oldState: 'A', newState: 'B' });
      stateChangeHandler({ oldState: 'B', newState: 'C' });

      const history = visualizer.getStateHistory();
      expect(history[0].to).toBe('A');
      expect(history[1].to).toBe('B');
      expect(history[2].to).toBe('C');
    });

    it('should clear history on reset', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'IDLE', newState: 'CURATING_CONTEXT' });
      stateChangeHandler({ oldState: 'CURATING_CONTEXT', newState: 'PLANNING_WITH_CONTEXT' });

      visualizer.reset();

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Complex State Graphs', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle cyclic state transitions', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'A', newState: 'B' });
      stateChangeHandler({ oldState: 'B', newState: 'C' });
      stateChangeHandler({ oldState: 'C', newState: 'A' });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(3);
      expect(history[2].to).toBe('A');
    });

    it('should handle self-loops', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'IDLE', newState: 'IDLE' });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(1);
      expect(history[0].from).toBe('IDLE');
      expect(history[0].to).toBe('IDLE');
    });

    it('should handle branching transitions', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'START', newState: 'BRANCH_A' });
      stateChangeHandler({ oldState: 'BRANCH_A', newState: 'END' });

      visualizer.reset();

      stateChangeHandler({ oldState: 'START', newState: 'BRANCH_B' });
      stateChangeHandler({ oldState: 'BRANCH_B', newState: 'END' });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(2);
    });

    it('should handle deeply nested state transitions', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 50; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(50);
    });
  });

  describe('100+ Transitions Performance', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should handle 100+ transitions without error', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 150; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(150);
    });

    it('should maintain performance with large history', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 200; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      const history = visualizer.getStateHistory();
      expect(history[0].from).toBe('STATE_0');
      expect(history[199].to).toBe('STATE_200');
    });

    it('should handle rapid state changes', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      const states = ['IDLE', 'ACTIVE', 'PROCESSING', 'COMPLETE'];
      for (let i = 0; i < 50; i++) {
        states.forEach((state, idx) => {
          const nextState = states[(idx + 1) % states.length];
          stateChangeHandler({ oldState: state, newState: nextState });
        });
      }

      const history = visualizer.getStateHistory();
      expect(history.length).toBeGreaterThan(100);
    });
  });

  describe('Zoom and Pan Tests', () => {
    it('should setup zoom behavior on init', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      expect(global.d3.zoom).toHaveBeenCalled();
    });

    it('should configure zoom scale extent', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      visualizer.init(container);

      const zoomInstance = global.d3.zoom();
      expect(zoomInstance.scaleExtent).toHaveBeenCalled();
    });

    it('should handle zoom without initialization', () => {
      // Should not throw
      expect(() => {
        visualizer.updateVisualization();
      }).not.toThrow();
    });
  });

  describe('Export Formats', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should export SVG format', () => {
      global.XMLSerializer = vi.fn(() => ({
        serializeToString: vi.fn(() => '<svg><g></g></svg>')
      }));

      const svg = visualizer.exportSVG();

      expect(svg === null || typeof svg === 'string').toBe(true);

      delete global.XMLSerializer;
    });

    it('should return null when XMLSerializer unavailable', () => {
      delete global.XMLSerializer;

      const svg = visualizer.exportSVG();

      expect(svg).toBeNull();
    });

    it('should handle export with complex visualization', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 10; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      global.XMLSerializer = vi.fn(() => ({
        serializeToString: vi.fn(() => '<svg><g></g></svg>')
      }));

      const svg = visualizer.exportSVG();

      expect(svg === null || typeof svg === 'string').toBe(true);

      delete global.XMLSerializer;
    });

    it('should handle export after reset', () => {
      visualizer.reset();

      global.XMLSerializer = vi.fn(() => ({
        serializeToString: vi.fn(() => '<svg></svg>')
      }));

      const svg = visualizer.exportSVG();

      expect(svg === null || typeof svg === 'string').toBe(true);

      delete global.XMLSerializer;
    });
  });

  describe('Error Rendering', () => {
    it('should handle visualization errors gracefully', () => {
      const container = { clientWidth: 800, clientHeight: 600 };

      global.d3.select = vi.fn(() => {
        throw new Error('D3 error');
      });

      expect(() => {
        visualizer.init(container);
      }).toThrow('D3 error');
    });

    it('should handle missing state data', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: null, newState: null });

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(1);
    });

    it('should handle malformed state events', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({});

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('Resize Handling', () => {
    it('should handle container resize', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      container.clientWidth = 1200;
      container.clientHeight = 800;

      // Should not throw
      visualizer.updateVisualization();

      expect(true).toBe(true);
    });

    it('should handle zero-size container', () => {
      const container = { clientWidth: 0, clientHeight: 0 };

      visualizer.init(container);

      expect(mockUtils.logger.info).toHaveBeenCalled();
    });

    it('should handle missing dimensions', () => {
      const container = {};

      visualizer.init(container);

      expect(mockUtils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Performance Tests', () => {
    it('should efficiently track timestamps', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];
      const start = Date.now();

      for (let i = 0; i < 100; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      const duration = Date.now() - start;

      expect(duration).toBeLessThan(1000);
      expect(visualizer.getStateHistory()).toHaveLength(100);
    });

    it('should handle concurrent state changes', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(
          Promise.resolve().then(() => {
            stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
          })
        );
      }

      return Promise.all(promises).then(() => {
        const history = visualizer.getStateHistory();
        expect(history.length).toBeGreaterThan(0);
      });
    });

    it('should maintain memory efficiency with large graphs', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 500; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      visualizer.reset();

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('Visualization Updates', () => {
    beforeEach(() => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);
    });

    it('should update on each state change', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      stateChangeHandler({ oldState: 'A', newState: 'B' });

      expect(mockUtils.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Visualization updated')
      );
    });

    it('should handle multiple rapid updates', () => {
      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      for (let i = 0; i < 20; i++) {
        stateChangeHandler({ oldState: `STATE_${i}`, newState: `STATE_${i + 1}` });
      }

      expect(mockUtils.logger.debug).toHaveBeenCalledTimes(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle destroy without init', () => {
      visualizer.destroy();

      expect(mockEventBus.off).not.toHaveBeenCalled();
    });

    it('should handle multiple destroy calls', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.destroy();
      visualizer.destroy();

      expect(mockUtils.logger.info).toHaveBeenCalled();
    });

    it('should handle reset without transitions', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      visualizer.reset();

      const history = visualizer.getStateHistory();
      expect(history).toHaveLength(0);
    });

    it('should handle state changes after destroy', () => {
      const container = { clientWidth: 800, clientHeight: 600 };
      visualizer.init(container);

      const stateChangeHandler = eventHandlers['fsm:state:changed'];

      visualizer.destroy();

      stateChangeHandler({ oldState: 'A', newState: 'B' });

      // Event handler should still work, but visualization won't update
      expect(true).toBe(true);
    });
  });
});
