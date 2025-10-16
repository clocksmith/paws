// Canvas Visualizer Module for REPLOID
// Provides 2D visualization of agent architecture, cognitive processes, and RSI activities

const CanvasVisualizer = {
  metadata: {
    id: 'CNVS',
    version: '1.0.0',
    dependencies: ['logger', 'Utils', 'StateManager', 'VizDataAdapter'],
    async: true,
    type: 'visualization'
  },

  factory: (deps) => {
    const { logger, Utils, StateManager, VizDataAdapter } = deps;
    
    if (!logger || !Utils || !StateManager) {
      throw new Error('CanvasVisualizer: Missing required dependencies');
    }

    let canvas = null;
    let ctx = null;
    let animationId = null;
    let vizState = {
      zoom: 1,
      panX: 0,
      panY: 0,
      selectedNode: null,
      hoveredNode: null,
      mode: 'dependency', // dependency, cognitive, memory, goals, tools
      animations: [],
      nodes: new Map(),
      edges: [],
      particles: [],
      heatmap: new Map()
    };

    // Color scheme for cyberpunk aesthetic
    const colors = {
      primary: '#0ff',
      secondary: '#ffd700',
      success: '#0f0',
      error: '#f00',
      warning: '#ff0',
      background: '#000',
      grid: 'rgba(0, 255, 255, 0.1)',
      node: {
        core: '#0ff',
        agent: '#ffd700',
        tool: '#0f0',
        experimental: '#f0f',
        ui: '#08f',
        storage: '#fa0'
      },
      edge: {
        dependency: 'rgba(0, 255, 255, 0.5)',
        dataFlow: 'rgba(255, 215, 0, 0.5)',
        active: '#fff'
      }
    };

    // Initialize canvas
    const initCanvas = async () => {
      // Create canvas element
      canvas = document.createElement('canvas');
      canvas.id = 'reploid-visualizer';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.right = '0';
      canvas.style.width = '400px';
      canvas.style.height = '300px';
      canvas.style.border = '1px solid #0ff';
      canvas.style.backgroundColor = 'rgba(0, 0, 0, 0.9)';
      canvas.style.zIndex = '10000';
      canvas.style.cursor = 'grab';
      
      // Set actual canvas size
      canvas.width = 400;
      canvas.height = 300;
      
      ctx = canvas.getContext('2d');
      
      // Add to DOM
      document.body.appendChild(canvas);
      
      // Setup event listeners
      setupInteractions();
      
      // Initialize visualization data
      if (VizDataAdapter) {
        await updateVisualizationData();
      }
      
      // Start animation loop
      startAnimation();
      
      logger.logEvent('info', 'Canvas visualizer initialized');
    };

    // Setup mouse/touch interactions
    const setupInteractions = () => {
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      let lastPan = { x: 0, y: 0 };

      canvas.addEventListener('mousedown', (e) => {
        isDragging = true;
        canvas.style.cursor = 'grabbing';
        dragStart.x = e.clientX - vizState.panX;
        dragStart.y = e.clientY - vizState.panY;
      });

      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - vizState.panX) / vizState.zoom;
        const y = (e.clientY - rect.top - vizState.panY) / vizState.zoom;

        if (isDragging) {
          vizState.panX = e.clientX - dragStart.x;
          vizState.panY = e.clientY - dragStart.y;
        } else {
          // Check for node hover
          vizState.hoveredNode = null;
          vizState.nodes.forEach((node) => {
            const dist = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
            if (dist < node.radius) {
              vizState.hoveredNode = node;
              canvas.style.cursor = 'pointer';
            }
          });
          if (!vizState.hoveredNode) {
            canvas.style.cursor = 'grab';
          }
        }
      });

      canvas.addEventListener('mouseup', () => {
        isDragging = false;
        canvas.style.cursor = 'grab';
      });

      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - vizState.panX) / vizState.zoom;
        const y = (e.clientY - rect.top - vizState.panY) / vizState.zoom;

        vizState.nodes.forEach((node) => {
          const dist = Math.sqrt(Math.pow(x - node.x, 2) + Math.pow(y - node.y, 2));
          if (dist < node.radius) {
            vizState.selectedNode = node;
            logger.logEvent('debug', `Selected node: ${node.id}`);
          }
        });
      });

      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
        vizState.zoom *= scaleFactor;
        vizState.zoom = Math.max(0.5, Math.min(3, vizState.zoom));
      });

      // Add mode switcher
      const createModeButton = (mode, label, x) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.position = 'fixed';
        btn.style.top = '305px';
        btn.style.right = `${x}px`;
        btn.style.padding = '5px 10px';
        btn.style.background = 'rgba(0, 255, 255, 0.1)';
        btn.style.color = '#0ff';
        btn.style.border = '1px solid #0ff';
        btn.style.cursor = 'pointer';
        btn.style.zIndex = '10001';
        btn.style.fontSize = '10px';
        btn.onclick = () => {
          vizState.mode = mode;
          updateVisualizationData();
        };
        document.body.appendChild(btn);
        return btn;
      };

      createModeButton('dependency', 'Deps', 400);
      createModeButton('cognitive', 'Think', 340);
      createModeButton('memory', 'Mem', 285);
      createModeButton('goals', 'Goals', 235);
      createModeButton('tools', 'Tools', 185);
    };

    // Update visualization data based on current mode
    const updateVisualizationData = async () => {
      if (!VizDataAdapter) return;

      switch (vizState.mode) {
        case 'dependency':
          const depData = await VizDataAdapter.getDependencyGraph();
          vizState.nodes = new Map(depData.nodes.map(n => [n.id, n]));
          vizState.edges = depData.edges;
          layoutCircular();
          break;
          
        case 'cognitive':
          const cogData = await VizDataAdapter.getCognitiveFlow();
          vizState.nodes = new Map(cogData.nodes.map(n => [n.id, n]));
          vizState.edges = cogData.edges;
          layoutHierarchical();
          break;
          
        case 'memory':
          const memData = await VizDataAdapter.getMemoryHeatmap();
          vizState.heatmap = memData.heatmap;
          vizState.nodes = new Map(memData.nodes.map(n => [n.id, n]));
          layoutGrid();
          break;
          
        case 'goals':
          const goalData = await VizDataAdapter.getGoalTree();
          vizState.nodes = new Map(goalData.nodes.map(n => [n.id, n]));
          vizState.edges = goalData.edges;
          layoutTree();
          break;
          
        case 'tools':
          const toolData = await VizDataAdapter.getToolUsage();
          vizState.nodes = new Map(toolData.nodes.map(n => [n.id, n]));
          vizState.edges = toolData.edges;
          layoutForce();
          break;
      }
    };

    // Layout algorithms
    const layoutCircular = () => {
      const nodeArray = Array.from(vizState.nodes.values());
      const angleStep = (Math.PI * 2) / nodeArray.length;
      const radius = Math.min(canvas.width, canvas.height) / 3;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      nodeArray.forEach((node, i) => {
        node.x = centerX + Math.cos(angleStep * i) * radius;
        node.y = centerY + Math.sin(angleStep * i) * radius;
        node.radius = 15;
      });
    };

    const layoutHierarchical = () => {
      const nodeArray = Array.from(vizState.nodes.values());
      const levels = new Map();
      
      // Assign levels based on dependencies
      nodeArray.forEach(node => {
        node.level = node.level || 0;
        levels.set(node.level, (levels.get(node.level) || []).concat(node));
      });

      const levelHeight = canvas.height / (levels.size + 1);
      
      levels.forEach((nodes, level) => {
        const nodeWidth = canvas.width / (nodes.length + 1);
        nodes.forEach((node, i) => {
          node.x = nodeWidth * (i + 1);
          node.y = levelHeight * (level + 1);
          node.radius = 12;
        });
      });
    };

    const layoutGrid = () => {
      const nodeArray = Array.from(vizState.nodes.values());
      const cols = Math.ceil(Math.sqrt(nodeArray.length));
      const rows = Math.ceil(nodeArray.length / cols);
      const cellWidth = canvas.width / cols;
      const cellHeight = canvas.height / rows;

      nodeArray.forEach((node, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        node.x = cellWidth * (col + 0.5);
        node.y = cellHeight * (row + 0.5);
        node.radius = Math.min(cellWidth, cellHeight) / 3;
      });
    };

    const layoutTree = () => {
      const nodeArray = Array.from(vizState.nodes.values());
      const root = nodeArray.find(n => n.isRoot) || nodeArray[0];
      
      const layoutSubtree = (node, x, y, width) => {
        node.x = x;
        node.y = y;
        node.radius = 10;
        
        const children = nodeArray.filter(n => n.parent === node.id);
        if (children.length > 0) {
          const childWidth = width / children.length;
          children.forEach((child, i) => {
            layoutSubtree(
              child,
              x - width/2 + childWidth * (i + 0.5),
              y + 50,
              childWidth
            );
          });
        }
      };

      if (root) {
        layoutSubtree(root, canvas.width / 2, 30, canvas.width);
      }
    };

    const layoutForce = () => {
      const nodeArray = Array.from(vizState.nodes.values());
      
      // Simple force-directed layout
      for (let iter = 0; iter < 50; iter++) {
        // Repulsion between nodes
        nodeArray.forEach((n1, i) => {
          nodeArray.slice(i + 1).forEach(n2 => {
            const dx = n2.x - n1.x;
            const dy = n2.y - n1.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const force = 1000 / (dist * dist);
            
            n1.x -= (dx / dist) * force;
            n1.y -= (dy / dist) * force;
            n2.x += (dx / dist) * force;
            n2.y += (dy / dist) * force;
          });
        });
        
        // Attraction along edges
        vizState.edges.forEach(edge => {
          const source = vizState.nodes.get(edge.source);
          const target = vizState.nodes.get(edge.target);
          if (source && target) {
            const dx = target.x - source.x;
            const dy = target.y - source.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const force = dist * 0.01;
            
            source.x += (dx / dist) * force;
            source.y += (dy / dist) * force;
            target.x -= (dx / dist) * force;
            target.y -= (dy / dist) * force;
          }
        });
        
        // Keep nodes on screen
        nodeArray.forEach(node => {
          node.x = Math.max(20, Math.min(canvas.width - 20, node.x));
          node.y = Math.max(20, Math.min(canvas.height - 20, node.y));
          node.radius = 12;
        });
      }
    };

    // Animation loop
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Save context
      ctx.save();
      
      // Apply transforms
      ctx.translate(vizState.panX, vizState.panY);
      ctx.scale(vizState.zoom, vizState.zoom);
      
      // Draw grid
      drawGrid();
      
      // Draw based on mode
      switch (vizState.mode) {
        case 'memory':
          drawHeatmap();
          break;
        default:
          drawEdges();
          drawNodes();
          break;
      }
      
      // Draw particles
      updateAndDrawParticles();
      
      // Restore context
      ctx.restore();
      
      // Draw UI overlay
      drawOverlay();
      
      animationId = requestAnimationFrame(animate);
    };

    const drawGrid = () => {
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 0.5;
      
      const gridSize = 20;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    };

    const drawNodes = () => {
      vizState.nodes.forEach(node => {
        // Node glow
        if (node === vizState.hoveredNode || node === vizState.selectedNode) {
          ctx.shadowBlur = 20;
          ctx.shadowColor = node.color || colors.primary;
        }
        
        // Draw node
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.color || colors.node[node.category] || colors.primary;
        ctx.fill();
        ctx.strokeStyle = node === vizState.selectedNode ? '#fff' : ctx.fillStyle;
        ctx.lineWidth = node === vizState.selectedNode ? 2 : 1;
        ctx.stroke();
        
        ctx.shadowBlur = 0;
        
        // Draw label
        if (vizState.zoom > 0.7) {
          ctx.fillStyle = '#fff';
          ctx.font = `${10 / vizState.zoom}px monospace`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(node.label || node.id, node.x, node.y);
        }
      });
    };

    const drawEdges = () => {
      vizState.edges.forEach(edge => {
        const source = vizState.nodes.get(edge.source);
        const target = vizState.nodes.get(edge.target);
        
        if (source && target) {
          ctx.beginPath();
          ctx.moveTo(source.x, source.y);
          
          if (edge.curved) {
            const cp1x = (source.x + target.x) / 2;
            const cp1y = source.y;
            const cp2x = (source.x + target.x) / 2;
            const cp2y = target.y;
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, target.x, target.y);
          } else {
            ctx.lineTo(target.x, target.y);
          }
          
          ctx.strokeStyle = edge.active ? colors.edge.active : 
                           (edge.color || colors.edge.dependency);
          ctx.lineWidth = edge.active ? 2 : 1;
          ctx.stroke();
          
          // Draw arrowhead
          if (edge.directed !== false) {
            const angle = Math.atan2(target.y - source.y, target.x - source.x);
            const arrowLength = 10;
            const arrowAngle = Math.PI / 6;
            
            ctx.beginPath();
            ctx.moveTo(target.x - target.radius * Math.cos(angle), 
                      target.y - target.radius * Math.sin(angle));
            ctx.lineTo(target.x - (target.radius + arrowLength) * Math.cos(angle - arrowAngle),
                      target.y - (target.radius + arrowLength) * Math.sin(angle - arrowAngle));
            ctx.moveTo(target.x - target.radius * Math.cos(angle),
                      target.y - target.radius * Math.sin(angle));
            ctx.lineTo(target.x - (target.radius + arrowLength) * Math.cos(angle + arrowAngle),
                      target.y - (target.radius + arrowLength) * Math.sin(angle + arrowAngle));
            ctx.stroke();
          }
        }
      });
    };

    const drawHeatmap = () => {
      const cellSize = 20;
      vizState.heatmap.forEach((value, key) => {
        const [x, y] = key.split(',').map(Number);
        const intensity = Math.min(1, value / 100);
        
        ctx.fillStyle = `rgba(255, ${Math.floor(215 * (1 - intensity))}, 0, ${intensity})`;
        ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
      });
    };

    const updateAndDrawParticles = () => {
      // Update particles
      vizState.particles = vizState.particles.filter(particle => {
        particle.life -= 0.02;
        particle.x += particle.vx;
        particle.y += particle.vy;
        return particle.life > 0;
      });
      
      // Draw particles
      vizState.particles.forEach(particle => {
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius * particle.life, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 215, 0, ${particle.life})`;
        ctx.fill();
      });
    };

    const drawOverlay = () => {
      // Mode indicator
      ctx.fillStyle = colors.primary;
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`Mode: ${vizState.mode}`, 10, 10);
      
      // Selected node info
      if (vizState.selectedNode) {
        const info = [
          `Selected: ${vizState.selectedNode.id}`,
          `Type: ${vizState.selectedNode.category || 'unknown'}`,
          `Status: ${vizState.selectedNode.status || 'idle'}`
        ];
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(10, canvas.height - 60, 150, 50);
        
        ctx.fillStyle = colors.primary;
        info.forEach((line, i) => {
          ctx.fillText(line, 15, canvas.height - 50 + i * 15);
        });
      }
      
      // Performance metrics
      if (vizState.mode === 'cognitive') {
        const state = StateManager.getState();
        ctx.fillStyle = colors.secondary;
        ctx.textAlign = 'right';
        ctx.fillText(`Cycles: ${state.totalCycles || 0}`, canvas.width - 10, 10);
      }
    };

    // Public API
    const startAnimation = () => {
      if (!animationId) {
        animate();
      }
    };

    const stopAnimation = () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
      }
    };

    const addParticle = (x, y, color = colors.secondary) => {
      vizState.particles.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        radius: 3,
        life: 1,
        color
      });
    };

    const triggerNodePulse = (nodeId) => {
      const node = vizState.nodes.get(nodeId);
      if (node) {
        // Add pulse animation
        vizState.animations.push({
          type: 'pulse',
          target: node,
          startTime: Date.now(),
          duration: 500
        });
        
        // Create particles around node
        for (let i = 0; i < 10; i++) {
          addParticle(node.x, node.y);
        }
      }
    };

    const highlightPath = (nodeIds) => {
      // Highlight edges between consecutive nodes
      for (let i = 0; i < nodeIds.length - 1; i++) {
        const edge = vizState.edges.find(e => 
          e.source === nodeIds[i] && e.target === nodeIds[i + 1]
        );
        if (edge) {
          edge.active = true;
          setTimeout(() => { edge.active = false; }, 1000);
        }
      }
    };

    const setMode = (mode) => {
      vizState.mode = mode;
      updateVisualizationData();
    };

    const resize = (width, height) => {
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + 'px';
      canvas.style.height = height + 'px';
      updateVisualizationData();
    };

    const destroy = () => {
      stopAnimation();
      if (canvas && canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
      }
      canvas = null;
      ctx = null;
    };

    // Initialize and return public interface
    const init = async () => {
      await initCanvas();
      
      return {
        startAnimation,
        stopAnimation,
        addParticle,
        triggerNodePulse,
        highlightPath,
        setMode,
        resize,
        destroy,
        updateData: updateVisualizationData
      };
    };

    return { init };
  }
};

// Module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CanvasVisualizer;
}