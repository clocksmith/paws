// @blueprint 0x00002A - Describes the module graph visualization.
// Module Graph Visualizer - D3.js Force-Directed Graph for Module Dependencies
// Visualizes the module dependency graph from Introspector

const ModuleGraphVisualizer = {
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

    // Category colors
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

    // Initialize D3 visualization
    const init = (containerEl) => {
      if (!containerEl || typeof d3 === 'undefined') {
        logger.warn('[ModuleGraphVisualizer] Cannot initialize: container or D3 not available');
        return;
      }

      container = containerEl;
      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      // Clear any existing SVG
      d3.select(container).selectAll('*').remove();

      // Create SVG
      svg = d3.select(container)
        .append('svg')
        .attr('width', '100%')
        .attr('height', '100%')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .attr('preserveAspectRatio', 'xMidYMid meet');

      // Add zoom behavior
      const g = svg.append('g');
      const zoom = d3.zoom()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });
      svg.call(zoom);

      // Create force simulation
      simulation = d3.forceSimulation()
        .force('link', d3.forceLink().id(d => d.id).distance(100))
        .force('charge', d3.forceManyBody().strength(-300))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(40));

      initialized = true;
      logger.info('[ModuleGraphVisualizer] Visualization initialized');
    };

    // Visualize module graph
    const visualize = async () => {
      if (!initialized || !svg) {
        logger.warn('[ModuleGraphVisualizer] Not initialized');
        return;
      }

      try {
        // Get module graph from Introspector
        graphData = await Introspector.getModuleGraph();

        if (!graphData || !graphData.modules) {
          logger.warn('[ModuleGraphVisualizer] No graph data available');
          return;
        }

        // Transform data for D3
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

    // Render graph with D3
    const renderGraph = (nodes, links) => {
      const g = svg.select('g');

      // Clear previous visualization
      g.selectAll('*').remove();

      // Update simulation
      simulation.nodes(nodes);
      simulation.force('link').links(links);

      // Create links
      const link = g.append('g')
        .selectAll('line')
        .data(links)
        .enter()
        .append('line')
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 1.5)
        .attr('marker-end', 'url(#arrowhead)');

      // Add arrowhead marker
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

      // Create node groups
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

      // Add circles for nodes
      node.append('circle')
        .attr('r', 15)
        .attr('fill', d => CATEGORY_COLORS[d.category] || CATEGORY_COLORS.default)
        .attr('stroke', '#fff')
        .attr('stroke-width', 2);

      // Add labels
      node.append('text')
        .attr('dy', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#ccc')
        .attr('font-weight', 'bold')
        .text(d => d.label);

      // Add dependency count badges
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

      // Add tooltips
      node.append('title')
        .text(d => `${d.label}\nCategory: ${d.category}\nDependencies: ${d.dependencies.length}\n${d.description}`);

      // Update positions on simulation tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

      // Restart simulation
      simulation.alpha(1).restart();
    };

    // Drag handlers
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

    // Reset view
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

    // Get graph statistics
    const getStats = () => {
      if (!graphData) return null;
      return {
        totalModules: graphData.modules.length,
        totalDependencies: graphData.edges.length,
        categories: Object.keys(graphData.statistics.byCategory).length,
        avgDependencies: graphData.statistics.avgDependencies
      };
    };

    // Web Component Widget
    class ModuleGraphVisualizerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        // Manual update - no auto-refresh needed
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const stats = getStats();

        return {
          state: initialized ? (stats ? 'idle' : 'loading') : 'disabled',
          primaryMetric: stats ? `${stats.totalModules} modules` : 'Not loaded',
          secondaryMetric: stats ? `${stats.totalDependencies} deps` : '',
          lastActivity: null,
          message: initialized ? null : 'D3.js not available'
        };
      }

      render() {
        const stats = getStats();

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }
            .widget-panel { padding: 12px; height: 100%; }
            h3 { margin: 0 0 12px 0; font-size: 1.1em; color: #fff; }
            .controls { display: flex; gap: 8px; margin-bottom: 12px; }
            button {
              padding: 6px 12px;
              background: rgba(100,150,255,0.2);
              border: 1px solid rgba(100,150,255,0.4);
              border-radius: 4px;
              color: #fff;
              cursor: pointer;
              font-size: 0.9em;
            }
            button:hover { background: rgba(100,150,255,0.3); }
          </style>

          <div class="widget-panel">
            <h3>⚌️ Module Graph</h3>

            ${typeof d3 !== 'undefined' ? `
              <div class="controls">
                <button id="refresh-btn">↻ Refresh</button>
                <button id="reset-btn">↻ Reset View</button>
              </div>

              ${stats ? `
                <div style="padding: 10px; background: rgba(0,0,0,0.2); margin-bottom: 10px; border-radius: 5px;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; font-size: 13px;">
                    <div><span style="color: #888;">Modules:</span> <strong>${stats.totalModules}</strong></div>
                    <div><span style="color: #888;">Dependencies:</span> <strong>${stats.totalDependencies}</strong></div>
                    <div><span style="color: #888;">Categories:</span> <strong>${stats.categories}</strong></div>
                    <div><span style="color: #888;">Avg Deps:</span> <strong>${stats.avgDependencies.toFixed(1)}</strong></div>
                  </div>
                </div>
              ` : ''}

              <div id="module-graph-container" style="width: 100%; height: 500px; background: rgba(0,0,0,0.2); border-radius: 5px;"></div>
            ` : `
              <div style="padding: 20px; text-align: center;">
                <div style="font-size: 48px; margin-bottom: 20px;">⚌️</div>
                <h3 style="color: #0ff;">D3.js Not Loaded</h3>
                <p style="color: #888;">Include D3.js library to visualize module dependencies</p>
              </div>
            `}
          </div>
        `;

        // Attach event listeners
        const refreshBtn = this.shadowRoot.getElementById('refresh-btn');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', async () => {
            await visualize();
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:success', { message: 'Graph refreshed' });
            }
            this.render();
          });
        }

        const resetBtn = this.shadowRoot.getElementById('reset-btn');
        if (resetBtn) {
          resetBtn.addEventListener('click', () => {
            reset();
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:info', { message: 'Graph reset' });
            }
            this.render();
          });
        }

        // Initialize and render the graph
        const graphContainer = this.shadowRoot.getElementById('module-graph-container');
        if (graphContainer && typeof d3 !== 'undefined') {
          if (!initialized) {
            init(graphContainer);
          }
          if (initialized) {
            visualize();
          }
        }
      }
    }

    // Register custom element
    const elementName = 'module-graph-visualizer-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ModuleGraphVisualizerWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Module Graph',
      icon: '⚌️',
      category: 'ui',
      updateInterval: null
    };

    return {
      init,
      visualize,
      reset,
      getStats,
      widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ModuleGraphVisualizer);
}

export default ModuleGraphVisualizer;
