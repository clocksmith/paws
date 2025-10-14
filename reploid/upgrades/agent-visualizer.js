// Agent Visualizer - FSM State Machine Visualization with D3.js
// Provides real-time visual representation of Sentinel FSM state transitions

const AgentVisualizer = {
  metadata: {
    id: 'AgentVisualizer',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'SentinelFSM'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, EventBus, SentinelFSM } = deps;
    const { logger } = Utils;

    // Visualization state
    let svg = null;
    let simulation = null;
    let container = null;
    let initialized = false;
    let nodes = [];
    let links = [];
    let currentState = null;
    let stateHistory = [];

    // FSM State definitions (from sentinel-fsm.js)
    const FSM_STATES = {
      'IDLE': { icon: '⚪', color: '#888', label: 'Idle' },
      'CURATING_CONTEXT': { icon: '🔍', color: '#4fc3f7', label: 'Curating Context' },
      'AWAITING_CONTEXT_APPROVAL': { icon: '⏸️', color: '#ffb74d', label: 'Awaiting Context' },
      'PLANNING_WITH_CONTEXT': { icon: '🧠', color: '#9575cd', label: 'Planning' },
      'GENERATING_PROPOSAL': { icon: '✍️', color: '#64b5f6', label: 'Generating' },
      'AWAITING_PROPOSAL_APPROVAL': { icon: '⏸️', color: '#ffb74d', label: 'Awaiting Approval' },
      'APPLYING_CHANGESET': { icon: '⚙️', color: '#81c784', label: 'Applying' },
      'REFLECTING': { icon: '💭', color: '#ba68c8', label: 'Reflecting' },
      'ERROR': { icon: '❌', color: '#e57373', label: 'Error' }
    };

    // Valid transitions (from sentinel-fsm.js)
    const VALID_TRANSITIONS = {
      'IDLE': ['CURATING_CONTEXT'],
      'CURATING_CONTEXT': ['AWAITING_CONTEXT_APPROVAL', 'ERROR'],
      'AWAITING_CONTEXT_APPROVAL': ['PLANNING_WITH_CONTEXT', 'CURATING_CONTEXT', 'IDLE'],
      'PLANNING_WITH_CONTEXT': ['GENERATING_PROPOSAL', 'ERROR'],
      'GENERATING_PROPOSAL': ['AWAITING_PROPOSAL_APPROVAL', 'ERROR'],
      'AWAITING_PROPOSAL_APPROVAL': ['APPLYING_CHANGESET', 'PLANNING_WITH_CONTEXT', 'IDLE'],
      'APPLYING_CHANGESET': ['REFLECTING', 'ERROR'],
      'REFLECTING': ['IDLE', 'CURATING_CONTEXT'],
      'ERROR': ['IDLE']
    };

    // Build graph data structure
    const buildGraphData = () => {
      // Create nodes for each state
      nodes = Object.keys(FSM_STATES).map(state => ({
        id: state,
        label: FSM_STATES[state].label,
        icon: FSM_STATES[state].icon,
        color: FSM_STATES[state].color,
        isActive: state === currentState,
        visitCount: 0
      }));

      // Create links from valid transitions
      links = [];
      Object.entries(VALID_TRANSITIONS).forEach(([from, toStates]) => {
        toStates.forEach(to => {
          links.push({
            source: from,
            target: to,
            transitionCount: 0
          });
        });
      });

      // Count transitions from history
      stateHistory.forEach((transition, idx) => {
        // Update node visit counts
        const node = nodes.find(n => n.id === transition.to);
        if (node) node.visitCount++;

        // Update link transition counts
        const link = links.find(l =>
          l.source.id === transition.from && l.target.id === transition.to ||
          l.source === transition.from && l.target === transition.to
        );
        if (link) link.transitionCount++;
      });

      return { nodes, links };
    };

    // Initialize D3 visualization
    const initVisualization = (containerEl) => {
      if (!containerEl || typeof d3 === 'undefined') {
        logger.warn('[AgentVisualizer] Cannot initialize: container or D3 not available');
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
        .scaleExtent([0.3, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });
      svg.call(zoom);

      // Build graph data
      const graphData = buildGraphData();

      // Create force simulation
      simulation = d3.forceSimulation(graphData.nodes)
        .force('link', d3.forceLink(graphData.links)
          .id(d => d.id)
          .distance(150))
        .force('charge', d3.forceManyBody().strength(-400))
        .force('center', d3.forceCenter(width / 2, height / 2))
        .force('collision', d3.forceCollide().radius(60));

      // Create arrow markers for directed edges
      svg.append('defs').selectAll('marker')
        .data(['arrow', 'arrow-active'])
        .join('marker')
        .attr('id', d => d)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 45)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', d => d === 'arrow-active' ? '#0ff' : 'rgba(255, 255, 255, 0.3)');

      // Create links
      const link = g.append('g')
        .selectAll('line')
        .data(graphData.links)
        .join('line')
        .attr('class', 'link')
        .attr('stroke', 'rgba(255, 255, 255, 0.3)')
        .attr('stroke-width', d => Math.min(1 + d.transitionCount * 0.5, 4))
        .attr('marker-end', 'url(#arrow)');

      // Create node groups
      const node = g.append('g')
        .selectAll('g')
        .data(graphData.nodes)
        .join('g')
        .attr('class', 'node')
        .call(d3.drag()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded));

      // Add circles to nodes
      node.append('circle')
        .attr('r', 40)
        .attr('fill', d => d.color)
        .attr('stroke', d => d.isActive ? '#0ff' : 'rgba(255, 255, 255, 0.5)')
        .attr('stroke-width', d => d.isActive ? 4 : 2)
        .attr('class', d => d.isActive ? 'active-state' : '');

      // Add icons to nodes
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .attr('font-size', '24px')
        .text(d => d.icon);

      // Add labels below nodes
      node.append('text')
        .attr('text-anchor', 'middle')
        .attr('dy', '3.5em')
        .attr('font-size', '11px')
        .attr('fill', '#ccc')
        .text(d => d.label);

      // Add visit count badges
      node.filter(d => d.visitCount > 0)
        .append('circle')
        .attr('cx', 25)
        .attr('cy', -25)
        .attr('r', 12)
        .attr('fill', '#0ff')
        .attr('stroke', '#000')
        .attr('stroke-width', 1);

      node.filter(d => d.visitCount > 0)
        .append('text')
        .attr('x', 25)
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .attr('font-size', '10px')
        .attr('fill', '#000')
        .attr('font-weight', 'bold')
        .text(d => d.visitCount);

      // Add tooltips
      node.append('title')
        .text(d => `${d.label}\nVisits: ${d.visitCount}\nStatus: ${d.isActive ? 'ACTIVE' : 'idle'}`);

      // Update positions on simulation tick
      simulation.on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);

        node
          .attr('transform', d => `translate(${d.x},${d.y})`);
      });

      initialized = true;
      logger.info('[AgentVisualizer] Visualization initialized');
    };

    // Drag event handlers
    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Update visualization when state changes
    const updateVisualization = () => {
      if (!initialized || !svg) return;

      // Rebuild graph data with updated counts
      const graphData = buildGraphData();

      // Update nodes
      const nodeSelection = svg.selectAll('.node')
        .data(graphData.nodes, d => d.id);

      // Update active state styling
      nodeSelection.select('circle')
        .transition()
        .duration(300)
        .attr('fill', d => d.color)
        .attr('stroke', d => d.isActive ? '#0ff' : 'rgba(255, 255, 255, 0.5)')
        .attr('stroke-width', d => d.isActive ? 4 : 2);

      // Update visit count badges
      nodeSelection.selectAll('circle[cx="25"]').remove();
      nodeSelection.selectAll('text[x="25"]').remove();

      const nodeWithCounts = nodeSelection.filter(d => d.visitCount > 0);

      nodeWithCounts
        .append('circle')
        .attr('cx', 25)
        .attr('cy', -25)
        .attr('r', 12)
        .attr('fill', '#0ff')
        .attr('stroke', '#000')
        .attr('stroke-width', 1);

      nodeWithCounts
        .append('text')
        .attr('x', 25)
        .attr('y', -25)
        .attr('text-anchor', 'middle')
        .attr('dy', '0.3em')
        .attr('font-size', '10px')
        .attr('fill', '#000')
        .attr('font-weight', 'bold')
        .text(d => d.visitCount);

      // Update tooltips
      nodeSelection.select('title')
        .text(d => `${d.label}\nVisits: ${d.visitCount}\nStatus: ${d.isActive ? 'ACTIVE' : 'idle'}`);

      // Update links
      svg.selectAll('.link')
        .data(graphData.links, d => `${d.source.id}-${d.target.id}`)
        .transition()
        .duration(300)
        .attr('stroke-width', d => Math.min(1 + d.transitionCount * 0.5, 4));

      // Pulse animation for active node
      if (currentState) {
        const activeNode = nodeSelection.filter(d => d.id === currentState);
        activeNode.select('circle')
          .transition()
          .duration(500)
          .attr('r', 45)
          .transition()
          .duration(500)
          .attr('r', 40);
      }

      logger.debug('[AgentVisualizer] Visualization updated');
    };

    // Handle FSM state change events
    const onStateChange = (event) => {
      const { oldState, newState } = event;
      logger.info(`[AgentVisualizer] State transition: ${oldState} → ${newState}`);

      currentState = newState;
      stateHistory.push({ from: oldState, to: newState, timestamp: Date.now() });

      updateVisualization();
    };

    // Initialize the visualizer
    const init = (containerEl) => {
      if (initialized) {
        logger.warn('[AgentVisualizer] Already initialized');
        return;
      }

      // Get current state from FSM
      if (SentinelFSM) {
        currentState = SentinelFSM.getCurrentState();
        stateHistory = SentinelFSM.getStateHistory().slice(); // Clone history
      }

      // Subscribe to state change events
      EventBus.on('fsm:state:changed', onStateChange, 'AgentVisualizer');

      // Initialize visualization
      initVisualization(containerEl);
    };

    // Cleanup
    const destroy = () => {
      if (simulation) {
        simulation.stop();
      }
      if (container) {
        d3.select(container).selectAll('*').remove();
      }
      EventBus.off('fsm:state:changed', onStateChange);
      initialized = false;
      logger.info('[AgentVisualizer] Destroyed');
    };

    // Export visualization as SVG
    const exportSVG = () => {
      if (!svg) return null;

      const svgNode = svg.node();
      const serializer = new XMLSerializer();
      const svgString = serializer.serializeToString(svgNode);
      return svgString;
    };

    // Reset visualization
    const reset = () => {
      stateHistory = [];
      currentState = SentinelFSM ? SentinelFSM.getCurrentState() : 'IDLE';
      if (initialized) {
        updateVisualization();
      }
    };

    return {
      init,
      destroy,
      updateVisualization,
      exportSVG,
      reset,
      getStateHistory: () => stateHistory
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(AgentVisualizer);
}

export default AgentVisualizer;
