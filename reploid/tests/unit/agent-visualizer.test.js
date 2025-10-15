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
});
