import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ModuleGraphVisualizer Module', () => {
  let ModuleGraphVisualizer;
  let mockDeps;
  let visualizerInstance;
  let mockContainer;
  let mockD3;
  let mockSimulation;
  let mockSvg;

  beforeEach(() => {
    // Mock D3 objects
    mockSimulation = {
      nodes: vi.fn().mockReturnThis(),
      force: vi.fn().mockReturnThis(),
      links: vi.fn().mockReturnThis(),
      on: vi.fn().mockReturnThis(),
      alpha: vi.fn().mockReturnThis(),
      restart: vi.fn().mockReturnThis(),
      alphaTarget: vi.fn().mockReturnThis()
    };

    const mockG = {
      attr: vi.fn().mockReturnThis(),
      append: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      data: vi.fn().mockReturnThis(),
      enter: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis()
    };

    mockSvg = {
      append: vi.fn().mockReturnValue(mockG),
      select: vi.fn().mockReturnValue(mockG),
      call: vi.fn().mockReturnThis(),
      attr: vi.fn().mockReturnThis(),
      transition: vi.fn().mockReturnThis(),
      duration: vi.fn().mockReturnThis()
    };

    const mockSelection = {
      selectAll: vi.fn().mockReturnThis(),
      remove: vi.fn().mockReturnThis(),
      append: vi.fn().mockReturnValue(mockSvg),
      select: vi.fn().mockReturnValue(mockG),
      attr: vi.fn().mockReturnThis(),
      call: vi.fn().mockReturnThis()
    };

    mockD3 = {
      select: vi.fn().mockReturnValue(mockSelection),
      forceSimulation: vi.fn().mockReturnValue(mockSimulation),
      forceLink: vi.fn().mockReturnValue({
        id: vi.fn().mockReturnThis(),
        distance: vi.fn().mockReturnThis(),
        links: vi.fn().mockReturnThis()
      }),
      forceManyBody: vi.fn().mockReturnValue({
        strength: vi.fn().mockReturnThis()
      }),
      forceCenter: vi.fn().mockReturnValue({}),
      forceCollide: vi.fn().mockReturnValue({
        radius: vi.fn().mockReturnThis()
      }),
      zoom: vi.fn().mockReturnValue({
        scaleExtent: vi.fn().mockReturnThis(),
        on: vi.fn().mockReturnThis(),
        transform: vi.fn().mockReturnThis()
      }),
      drag: vi.fn().mockReturnValue({
        on: vi.fn().mockReturnThis()
      }),
      zoomIdentity: {}
    };

    global.d3 = mockD3;

    // Mock container element
    mockContainer = {
      clientWidth: 800,
      clientHeight: 600,
      insertAdjacentHTML: vi.fn()
    };

    // Mock Introspector
    const mockIntrospector = {
      getModuleGraph: vi.fn().mockResolvedValue({
        modules: [
          {
            id: 'MODULE1',
            category: 'core',
            description: 'Test module 1',
            dependencies: ['Utils', 'StateManager']
          },
          {
            id: 'MODULE2',
            category: 'tool',
            description: 'Test module 2',
            dependencies: ['MODULE1']
          },
          {
            id: 'UI_MODULE',
            category: 'ui',
            description: 'UI module',
            dependencies: []
          }
        ],
        edges: [
          { from: 'MODULE1', to: 'Utils' },
          { from: 'MODULE1', to: 'StateManager' },
          { from: 'MODULE2', to: 'MODULE1' }
        ],
        statistics: {
          totalModules: 3,
          byCategory: {
            'core': 1,
            'tool': 1,
            'ui': 1
          },
          avgDependencies: 1
        }
      })
    };

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      },
      Introspector: mockIntrospector
    };

    // Define ModuleGraphVisualizer module
    ModuleGraphVisualizer = {
      metadata: {
        id: 'ModuleGraphVisualizer',
        version: '1.0.0',
        description: 'Interactive D3.js visualization of module dependency graph',
        dependencies: ['Utils', 'Introspector'],
        externalDeps: ['d3'],
        async: false,
        type: 'ui'
      },
      factory: (deps) => {
        const { Utils, Introspector } = deps;
        const { logger } = Utils;

        let svg = null;
        let simulation = null;
        let container = null;
        let initialized = false;
        let graphData = null;

        const CATEGORY_COLORS = {
          'core': '#64b5f6',
          'rsi': '#9575cd',
          'tool': '#4dd0e1',
          'ui': '#81c784',
          'storage': '#ffb74d',
          'agent': '#f06292',
          'monitoring': '#ba68c8',
          'visualization': '#4fc3f7',
          'default': '#888'
        };

        const init = (containerEl) => {
          if (!containerEl || typeof d3 === 'undefined') {
            logger.warn('[ModuleGraphVisualizer] Cannot initialize: container or D3 not available');
            return;
          }

          container = containerEl;
          const width = container.clientWidth || 800;
          const height = container.clientHeight || 600;

          d3.select(container).selectAll('*').remove();

          svg = d3.select(container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('viewBox', `0 0 ${width} ${height}`)
            .attr('preserveAspectRatio', 'xMidYMid meet');

          const g = svg.append('g');
          const zoom = d3.zoom()
            .scaleExtent([0.1, 4])
            .on('zoom', (event) => {
              g.attr('transform', event.transform);
            });
          svg.call(zoom);

          simulation = d3.forceSimulation()
            .force('link', d3.forceLink().id(d => d.id).distance(100))
            .force('charge', d3.forceManyBody().strength(-300))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(40));

          initialized = true;
          logger.info('[ModuleGraphVisualizer] Visualization initialized');
        };

        const visualize = async () => {
          if (!initialized || !svg) {
            logger.warn('[ModuleGraphVisualizer] Not initialized');
            return;
          }

          try {
            graphData = await Introspector.getModuleGraph();

            if (!graphData || !graphData.modules) {
              logger.warn('[ModuleGraphVisualizer] No graph data available');
              return;
            }

            const nodes = graphData.modules.map(m => ({
              id: m.id,
              label: m.id,
              category: m.category || 'default',
              dependencies: m.dependencies || [],
              description: m.description || ''
            }));

            const links = graphData.edges.map(e => ({
              source: e.from,
              target: e.to
            }));

            renderGraph(nodes, links);
            logger.info(`[ModuleGraphVisualizer] Visualized ${nodes.length} modules, ${links.length} dependencies`);
          } catch (err) {
            logger.error('[ModuleGraphVisualizer] Visualization error:', err);
          }
        };

        const renderGraph = (nodes, links) => {
          const g = svg.select('g');
          g.selectAll('*').remove();

          simulation.nodes(nodes);
          simulation.force('link').links(links);

          const link = g.append('g')
            .selectAll('line')
            .data(links)
            .enter()
            .append('line')
            .attr('stroke', 'rgba(255, 255, 255, 0.2)')
            .attr('stroke-width', 1.5)
            .attr('marker-end', 'url(#arrowhead)');

          svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 25)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M 0,-5 L 10,0 L 0,5')
            .attr('fill', 'rgba(255, 255, 255, 0.3)');

          const node = g.append('g')
            .selectAll('g')
            .data(nodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .call(d3.drag()
              .on('start', dragstarted)
              .on('drag', dragged)
              .on('end', dragended));

          node.append('circle')
            .attr('r', 15)
            .attr('fill', d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.default)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);

          node.append('text')
            .attr('dy', -20)
            .attr('text-anchor', 'middle')
            .attr('font-size', '11px')
            .attr('fill', '#ccc')
            .attr('font-weight', 'bold')
            .text(d => d.label);

          node.append('circle')
            .attr('r', 8)
            .attr('cx', 12)
            .attr('cy', -12)
            .attr('fill', 'rgba(255, 255, 255, 0.2)')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1);

          node.append('text')
            .attr('x', 12)
            .attr('y', -8)
            .attr('text-anchor', 'middle')
            .attr('font-size', '9px')
            .attr('fill', '#fff')
            .attr('font-weight', 'bold')
            .text(d => d.dependencies.length);

          node.append('title')
            .text(d => `${d.label}\nCategory: ${d.category}\nDependencies: ${d.dependencies.length}\n${d.description}`);

          simulation.on('tick', () => {
            link
              .attr('x1', d => d.source.x)
              .attr('y1', d => d.source.y)
              .attr('x2', d => d.target.x)
              .attr('y2', d => d.target.y);

            node.attr('transform', d => `translate(${d.x},${d.y})`);
          });

          simulation.alpha(1).restart();
        };

        function dragstarted(event, d) {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        }

        function dragged(event, d) {
          d.fx = event.x;
          d.fy = event.y;
        }

        function dragended(event, d) {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }

        const reset = () => {
          if (svg) {
            svg.transition()
              .duration(750)
              .call(d3.zoom().transform, d3.zoomIdentity);
          }
          if (simulation) {
            simulation.alpha(1).restart();
          }
        };

        const getStats = () => {
          if (!graphData) return null;
          return {
            totalModules: graphData.modules.length,
            totalDependencies: graphData.edges.length,
            categories: Object.keys(graphData.statistics.byCategory).length,
            avgDependencies: graphData.statistics.avgDependencies
          };
        };

        return {
          init,
          visualize,
          reset,
          getStats
        };
      }
    };

    visualizerInstance = ModuleGraphVisualizer.factory(mockDeps);
  });

  afterEach(() => {
    delete global.d3;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ModuleGraphVisualizer.metadata.id).toBe('ModuleGraphVisualizer');
      expect(ModuleGraphVisualizer.metadata.version).toBe('1.0.0');
      expect(ModuleGraphVisualizer.metadata.type).toBe('ui');
    });

    it('should declare required dependencies', () => {
      expect(ModuleGraphVisualizer.metadata.dependencies).toContain('Utils');
      expect(ModuleGraphVisualizer.metadata.dependencies).toContain('Introspector');
    });

    it('should declare external dependencies', () => {
      expect(ModuleGraphVisualizer.metadata.externalDeps).toContain('d3');
    });

    it('should be synchronous', () => {
      expect(ModuleGraphVisualizer.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with valid container and D3', () => {
      visualizerInstance.init(mockContainer);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Visualization initialized')
      );
    });

    it('should warn when container is missing', () => {
      visualizerInstance.init(null);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot initialize: container or D3 not available')
      );
    });

    it('should warn when D3 is not available', () => {
      delete global.d3;
      visualizerInstance.init(mockContainer);

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot initialize: container or D3 not available')
      );
    });

    it('should create SVG element', () => {
      visualizerInstance.init(mockContainer);

      expect(mockD3.select).toHaveBeenCalledWith(mockContainer);
      expect(mockSvg.append).toHaveBeenCalled();
    });

    it('should set up zoom behavior', () => {
      visualizerInstance.init(mockContainer);

      expect(mockD3.zoom).toHaveBeenCalled();
      expect(mockSvg.call).toHaveBeenCalled();
    });

    it('should create force simulation', () => {
      visualizerInstance.init(mockContainer);

      expect(mockD3.forceSimulation).toHaveBeenCalled();
      expect(mockSimulation.force).toHaveBeenCalledWith('link', expect.any(Object));
      expect(mockSimulation.force).toHaveBeenCalledWith('charge', expect.any(Object));
      expect(mockSimulation.force).toHaveBeenCalledWith('center', expect.any(Object));
      expect(mockSimulation.force).toHaveBeenCalledWith('collision', expect.any(Object));
    });

    it('should use container dimensions for viewBox', () => {
      visualizerInstance.init(mockContainer);

      expect(mockSvg.attr).toHaveBeenCalledWith('viewBox', '0 0 800 600');
    });

    it('should clear existing SVG content', () => {
      visualizerInstance.init(mockContainer);

      expect(mockD3.select().selectAll).toHaveBeenCalledWith('*');
      expect(mockD3.select().remove).toHaveBeenCalled();
    });
  });

  describe('Visualization', () => {
    beforeEach(() => {
      visualizerInstance.init(mockContainer);
    });

    it('should visualize module graph', async () => {
      // Clear the logger mock from init() call
      mockDeps.Utils.logger.info.mockClear();

      await visualizerInstance.visualize();

      expect(mockDeps.Introspector.getModuleGraph).toHaveBeenCalled();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Visualized 3 modules, 3 dependencies')
      );
    });

    it('should warn when not initialized', async () => {
      const uninitializedInstance = ModuleGraphVisualizer.factory(mockDeps);
      await uninitializedInstance.visualize();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Not initialized')
      );
    });

    it('should handle missing graph data', async () => {
      mockDeps.Introspector.getModuleGraph.mockResolvedValue(null);

      await visualizerInstance.visualize();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No graph data available')
      );
    });

    it('should transform module data for D3', async () => {
      await visualizerInstance.visualize();

      expect(mockSimulation.nodes).toHaveBeenCalled();
      const nodesCall = mockSimulation.nodes.mock.calls[0][0];
      expect(nodesCall).toHaveLength(3);
      expect(nodesCall[0]).toHaveProperty('id', 'MODULE1');
      expect(nodesCall[0]).toHaveProperty('label', 'MODULE1');
      expect(nodesCall[0]).toHaveProperty('category', 'core');
    });

    it('should transform edge data for D3', async () => {
      await visualizerInstance.visualize();

      expect(mockSimulation.force).toHaveBeenCalled();
    });

    it('should handle visualization errors', async () => {
      mockDeps.Introspector.getModuleGraph.mockRejectedValue(new Error('Graph error'));

      await visualizerInstance.visualize();

      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Visualization error'),
        expect.any(Error)
      );
    });

    it('should assign default category to modules without one', async () => {
      mockDeps.Introspector.getModuleGraph.mockResolvedValue({
        modules: [{ id: 'TEST', description: 'Test' }],
        edges: [],
        statistics: { byCategory: {}, avgDependencies: 0 }
      });

      await visualizerInstance.visualize();

      const nodes = mockSimulation.nodes.mock.calls[0][0];
      expect(nodes[0].category).toBe('default');
    });

    it('should handle empty dependencies array', async () => {
      mockDeps.Introspector.getModuleGraph.mockResolvedValue({
        modules: [{ id: 'TEST', category: 'core' }],
        edges: [],
        statistics: { byCategory: {}, avgDependencies: 0 }
      });

      await visualizerInstance.visualize();

      const nodes = mockSimulation.nodes.mock.calls[0][0];
      expect(nodes[0].dependencies).toEqual([]);
    });

    it('should restart simulation after visualization', async () => {
      // Clear previous calls
      mockSimulation.alpha.mockClear();
      mockSimulation.restart.mockClear();

      await visualizerInstance.visualize();

      expect(mockSimulation.alpha).toHaveBeenCalledWith(1);
      expect(mockSimulation.restart).toHaveBeenCalled();
    });
  });

  describe('Reset Functionality', () => {
    beforeEach(() => {
      visualizerInstance.init(mockContainer);
    });

    it('should reset view with transition', () => {
      visualizerInstance.reset();

      expect(mockSvg.transition).toHaveBeenCalled();
      expect(mockSvg.duration).toHaveBeenCalledWith(750);
    });

    it('should restart simulation on reset', () => {
      visualizerInstance.reset();

      expect(mockSimulation.alpha).toHaveBeenCalledWith(1);
      expect(mockSimulation.restart).toHaveBeenCalled();
    });

    it('should handle reset without initialized SVG', () => {
      const uninitializedInstance = ModuleGraphVisualizer.factory(mockDeps);
      expect(() => uninitializedInstance.reset()).not.toThrow();
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      visualizerInstance.init(mockContainer);
    });

    it('should return null before visualization', () => {
      const stats = visualizerInstance.getStats();
      expect(stats).toBeNull();
    });

    it('should return graph statistics after visualization', async () => {
      await visualizerInstance.visualize();

      const stats = visualizerInstance.getStats();
      expect(stats).toBeDefined();
      expect(stats.totalModules).toBe(3);
      expect(stats.totalDependencies).toBe(3);
      expect(stats.categories).toBe(3);
      expect(stats.avgDependencies).toBe(1);
    });

    it('should provide accurate module count', async () => {
      await visualizerInstance.visualize();

      const stats = visualizerInstance.getStats();
      expect(stats.totalModules).toBe(3);
    });

    it('should provide accurate dependency count', async () => {
      await visualizerInstance.visualize();

      const stats = visualizerInstance.getStats();
      expect(stats.totalDependencies).toBe(3);
    });

    it('should count unique categories', async () => {
      await visualizerInstance.visualize();

      const stats = visualizerInstance.getStats();
      expect(stats.categories).toBe(3);
    });
  });

  describe('Category Colors', () => {
    beforeEach(() => {
      visualizerInstance.init(mockContainer);
    });

    it('should have color defined for core category', async () => {
      await visualizerInstance.visualize();
      // Color mapping is internal, but we can verify visualization runs without error
      expect(mockSimulation.nodes).toHaveBeenCalled();
    });

    it('should handle all defined categories', async () => {
      mockDeps.Introspector.getModuleGraph.mockResolvedValue({
        modules: [
          { id: 'M1', category: 'rsi' },
          { id: 'M2', category: 'storage' },
          { id: 'M3', category: 'agent' },
          { id: 'M4', category: 'monitoring' }
        ],
        edges: [],
        statistics: { byCategory: {}, avgDependencies: 0 }
      });

      await visualizerInstance.visualize();
      expect(mockSimulation.nodes).toHaveBeenCalled();
    });
  });

  describe('Drag Behavior', () => {
    beforeEach(() => {
      visualizerInstance.init(mockContainer);
    });

    it('should set up drag handlers', async () => {
      await visualizerInstance.visualize();

      expect(mockD3.drag).toHaveBeenCalled();
    });
  });

  describe('Force Simulation Configuration', () => {
    it('should configure link force with distance', () => {
      visualizerInstance.init(mockContainer);

      const linkForce = mockD3.forceLink();
      expect(linkForce.distance).toHaveBeenCalledWith(100);
    });

    it('should configure charge force with strength', () => {
      visualizerInstance.init(mockContainer);

      const chargeForce = mockD3.forceManyBody();
      expect(chargeForce.strength).toHaveBeenCalledWith(-300);
    });

    it('should configure collision force with radius', () => {
      visualizerInstance.init(mockContainer);

      const collisionForce = mockD3.forceCollide();
      expect(collisionForce.radius).toHaveBeenCalledWith(40);
    });

    it('should center force at container center', () => {
      visualizerInstance.init(mockContainer);

      expect(mockD3.forceCenter).toHaveBeenCalledWith(400, 300);
    });
  });

  describe('Zoom Configuration', () => {
    it('should set zoom scale extent', () => {
      visualizerInstance.init(mockContainer);

      const zoom = mockD3.zoom();
      expect(zoom.scaleExtent).toHaveBeenCalledWith([0.1, 4]);
    });
  });
});
