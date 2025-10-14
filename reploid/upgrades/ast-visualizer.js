// AST Visualizer - JavaScript Abstract Syntax Tree Visualization with D3.js
// Provides interactive tree visualization of JavaScript code structure

const ASTVisualizer = {
  metadata: {
    id: 'ASTVisualizer',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    // Visualization state
    let svg = null;
    let tree = null;
    let root = null;
    let container = null;
    let initialized = false;
    let currentCode = '';

    // AST node type styling
    const NODE_STYLES = {
      // Declarations
      'Program': { color: '#9575cd', shape: 'rect', label: 'Program' },
      'FunctionDeclaration': { color: '#64b5f6', shape: 'rect', label: 'Function' },
      'VariableDeclaration': { color: '#81c784', shape: 'rect', label: 'Variable' },
      'ClassDeclaration': { color: '#ba68c8', shape: 'rect', label: 'Class' },

      // Statements
      'ExpressionStatement': { color: '#4fc3f7', shape: 'circle', label: 'Expression' },
      'ReturnStatement': { color: '#ffb74d', shape: 'circle', label: 'Return' },
      'IfStatement': { color: '#e57373', shape: 'diamond', label: 'If' },
      'ForStatement': { color: '#f06292', shape: 'diamond', label: 'For' },
      'WhileStatement': { color: '#f06292', shape: 'diamond', label: 'While' },
      'BlockStatement': { color: '#90a4ae', shape: 'rect', label: 'Block' },

      // Expressions
      'CallExpression': { color: '#4dd0e1', shape: 'circle', label: 'Call' },
      'BinaryExpression': { color: '#7986cb', shape: 'circle', label: 'Binary' },
      'MemberExpression': { color: '#4db6ac', shape: 'circle', label: 'Member' },
      'ArrowFunctionExpression': { color: '#64b5f6', shape: 'circle', label: 'Arrow Fn' },
      'Identifier': { color: '#aed581', shape: 'circle', label: 'ID' },
      'Literal': { color: '#fff176', shape: 'circle', label: 'Literal' },

      // Default
      'default': { color: '#888', shape: 'circle', label: 'Node' }
    };

    // Parse JavaScript code into AST
    const parseCode = (code) => {
      try {
        if (typeof acorn === 'undefined') {
          throw new Error('Acorn parser not loaded');
        }

        const ast = acorn.parse(code, {
          ecmaVersion: 2023,
          sourceType: 'module',
          locations: true
        });

        return ast;
      } catch (error) {
        logger.error('[ASTVisualizer] Parse error:', error);
        throw error;
      }
    };

    // Convert AST to D3 hierarchical data
    const astToHierarchy = (node, depth = 0) => {
      if (!node || typeof node !== 'object') {
        return null;
      }

      // Get node style
      const style = NODE_STYLES[node.type] || NODE_STYLES.default;

      // Create hierarchy node
      const hierarchyNode = {
        name: node.type,
        label: style.label,
        color: style.color,
        shape: style.shape,
        depth: depth,
        nodeType: node.type,
        properties: {},
        children: [],
        _collapsed: depth > 2 // Auto-collapse deep nodes
      };

      // Add relevant properties
      if (node.name) hierarchyNode.properties.name = node.name;
      if (node.value !== undefined) hierarchyNode.properties.value = node.value;
      if (node.operator) hierarchyNode.properties.operator = node.operator;
      if (node.kind) hierarchyNode.properties.kind = node.kind;
      if (node.raw) hierarchyNode.properties.raw = node.raw;

      // Process children
      const childKeys = Object.keys(node).filter(key =>
        !['type', 'loc', 'range', 'start', 'end'].includes(key)
      );

      for (const key of childKeys) {
        const value = node[key];

        if (Array.isArray(value)) {
          value.forEach((item, index) => {
            if (item && typeof item === 'object' && item.type) {
              const child = astToHierarchy(item, depth + 1);
              if (child) {
                child.name = `${key}[${index}]`;
                hierarchyNode.children.push(child);
              }
            }
          });
        } else if (value && typeof value === 'object' && value.type) {
          const child = astToHierarchy(value, depth + 1);
          if (child) {
            child.name = key;
            hierarchyNode.children.push(child);
          }
        }
      }

      return hierarchyNode;
    };

    // Initialize D3 tree visualization
    const initVisualization = (containerEl) => {
      if (!containerEl || typeof d3 === 'undefined') {
        logger.warn('[ASTVisualizer] Cannot initialize: container or D3 not available');
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
        .scaleExtent([0.1, 3])
        .on('zoom', (event) => {
          g.attr('transform', event.transform);
        });
      svg.call(zoom);

      // Create tree layout
      tree = d3.tree()
        .size([height - 100, width - 200])
        .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

      initialized = true;
      logger.info('[ASTVisualizer] Visualization initialized');
    };

    // Update visualization with new AST
    const updateVisualization = (hierarchyData) => {
      if (!initialized || !svg || !tree) {
        logger.warn('[ASTVisualizer] Not initialized');
        return;
      }

      // Create hierarchy from data
      root = d3.hierarchy(hierarchyData);
      root.x0 = 0;
      root.y0 = 0;

      // Collapse nodes if specified
      root.descendants().forEach(d => {
        if (d.data._collapsed && d.children) {
          d._children = d.children;
          d.children = null;
        }
      });

      // Render tree
      renderTree(root);
    };

    // Render tree with animations
    const renderTree = (source) => {
      if (!source) return;

      const width = container.clientWidth || 800;
      const height = container.clientHeight || 600;

      // Compute new tree layout
      const treeData = tree(root);
      const nodes = treeData.descendants();
      const links = treeData.links();

      // Normalize for horizontal layout
      nodes.forEach(d => {
        d.y = d.depth * 180;
      });

      // Get SVG group
      const g = svg.select('g');

      // Update links
      const link = g.selectAll('.link')
        .data(links, d => d.target.id || (d.target.id = ++i));

      const linkEnter = link.enter()
        .append('path')
        .attr('class', 'link')
        .attr('d', d => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        })
        .attr('fill', 'none')
        .attr('stroke', 'rgba(255, 255, 255, 0.2)')
        .attr('stroke-width', 1.5);

      link.merge(linkEnter)
        .transition()
        .duration(500)
        .attr('d', d => diagonal(d.source, d.target));

      link.exit()
        .transition()
        .duration(500)
        .attr('d', d => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // Update nodes
      const node = g.selectAll('.node')
        .data(nodes, d => d.id || (d.id = ++i));

      const nodeEnter = node.enter()
        .append('g')
        .attr('class', 'node')
        .attr('transform', d => `translate(${source.y0},${source.x0})`)
        .on('click', (event, d) => toggleNode(event, d));

      // Add node shapes
      nodeEnter.each(function(d) {
        const nodeG = d3.select(this);
        const style = NODE_STYLES[d.data.nodeType] || NODE_STYLES.default;

        if (style.shape === 'rect') {
          nodeG.append('rect')
            .attr('x', -20)
            .attr('y', -10)
            .attr('width', 40)
            .attr('height', 20)
            .attr('rx', 3)
            .attr('fill', style.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        } else if (style.shape === 'diamond') {
          nodeG.append('path')
            .attr('d', 'M 0,-15 L 15,0 L 0,15 L -15,0 Z')
            .attr('fill', style.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        } else {
          nodeG.append('circle')
            .attr('r', 10)
            .attr('fill', style.color)
            .attr('stroke', '#fff')
            .attr('stroke-width', 2);
        }
      });

      // Add labels
      nodeEnter.append('text')
        .attr('dy', -20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '11px')
        .attr('fill', '#ccc')
        .text(d => d.data.label || d.data.name);

      // Add property labels for leaf nodes
      nodeEnter.filter(d => Object.keys(d.data.properties).length > 0)
        .append('text')
        .attr('dy', 25)
        .attr('text-anchor', 'middle')
        .attr('font-size', '9px')
        .attr('fill', '#888')
        .text(d => {
          const props = d.data.properties;
          if (props.name) return props.name;
          if (props.value !== undefined) return String(props.value);
          if (props.operator) return props.operator;
          return '';
        });

      // Add expand/collapse indicators
      nodeEnter.filter(d => d.data.children && d.data.children.length > 0)
        .append('text')
        .attr('dy', 4)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', '#fff')
        .attr('font-weight', 'bold')
        .text(d => d.children ? '−' : '+');

      // Merge and transition
      node.merge(nodeEnter)
        .transition()
        .duration(500)
        .attr('transform', d => `translate(${d.y},${d.x})`);

      node.exit()
        .transition()
        .duration(500)
        .attr('transform', d => `translate(${source.y},${source.x})`)
        .remove();

      // Store old positions
      nodes.forEach(d => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    };

    // Counter for unique IDs
    let i = 0;

    // Diagonal path generator
    const diagonal = (s, d) => {
      return `M ${s.y} ${s.x}
              C ${(s.y + d.y) / 2} ${s.x},
                ${(s.y + d.y) / 2} ${d.x},
                ${d.y} ${d.x}`;
    };

    // Toggle node expansion
    const toggleNode = (event, d) => {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      renderTree(d);
    };

    // Visualize code
    const visualizeCode = (code) => {
      if (!code || !code.trim()) {
        logger.warn('[ASTVisualizer] Empty code');
        return;
      }

      try {
        currentCode = code;
        const ast = parseCode(code);
        const hierarchyData = astToHierarchy(ast);

        if (hierarchyData) {
          updateVisualization(hierarchyData);
          logger.info('[ASTVisualizer] AST visualized successfully');
        }
      } catch (error) {
        logger.error('[ASTVisualizer] Visualization error:', error);
        EventBus.emit('ast:parse:error', { error: error.message, code });
      }
    };

    // Initialize the visualizer
    const init = (containerEl) => {
      if (initialized) {
        logger.warn('[ASTVisualizer] Already initialized');
        return;
      }

      initVisualization(containerEl);
    };

    // Cleanup
    const destroy = () => {
      if (container) {
        d3.select(container).selectAll('*').remove();
      }
      initialized = false;
      logger.info('[ASTVisualizer] Destroyed');
    };

    // Expand all nodes
    const expandAll = () => {
      if (!root) return;

      root.descendants().forEach(d => {
        if (d._children) {
          d.children = d._children;
          d._children = null;
        }
      });
      renderTree(root);
    };

    // Collapse all nodes
    const collapseAll = () => {
      if (!root) return;

      root.descendants().forEach(d => {
        if (d.children && d.depth > 0) {
          d._children = d.children;
          d.children = null;
        }
      });
      renderTree(root);
    };

    return {
      init,
      destroy,
      visualizeCode,
      expandAll,
      collapseAll,
      getCurrentCode: () => currentCode
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ASTVisualizer);
}

export default ASTVisualizer;
