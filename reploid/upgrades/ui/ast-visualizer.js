// @blueprint 0x000029 - Details the AST visualization framework.
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

    // Widget tracking state
    let _nodeCount = 0;
    let _parseErrors = [];
    let _lastVisualizationTime = null;

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
          _lastVisualizationTime = Date.now();

          // Count nodes
          _nodeCount = root ? root.descendants().length : 0;

          logger.info('[ASTVisualizer] AST visualized successfully');
        }
      } catch (error) {
        logger.error('[ASTVisualizer] Visualization error:', error);

        // Track parse error
        _parseErrors.push({
          message: error.message,
          timestamp: Date.now(),
          codeSnippet: code.substring(0, 100)
        });
        if (_parseErrors.length > 20) _parseErrors.shift();

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

    // Web Component Widget
    class ASTVisualizerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        // Manual update - no auto-refresh needed for AST viz
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const isActive = _lastVisualizationTime && (Date.now() - _lastVisualizationTime < 3000);

        return {
          state: isActive ? 'active' : (initialized ? 'idle' : 'disabled'),
          primaryMetric: `${_nodeCount} nodes`,
          secondaryMetric: _parseErrors.length > 0 ? `${_parseErrors.length} errors` : 'OK',
          lastActivity: _lastVisualizationTime,
          message: initialized ? 'Ready to visualize' : 'Not initialized'
        };
      }

      render() {
        // Count node types
        const nodeTypeCounts = {};
        if (root) {
          root.descendants().forEach(d => {
            const type = d.data.nodeType || 'unknown';
            nodeTypeCounts[type] = (nodeTypeCounts[type] || 0) + 1;
          });
        }

        const topNodeTypes = Object.entries(nodeTypeCounts)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }
            .widget-panel {
              padding: 12px;
            }
            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }
            .controls {
              display: flex;
              gap: 8px;
              margin-bottom: 12px;
            }
            button {
              padding: 6px 12px;
              background: rgba(100,150,255,0.2);
              border: 1px solid rgba(100,150,255,0.4);
              border-radius: 4px;
              color: #fff;
              cursor: pointer;
              font-size: 0.9em;
            }
            button:hover:not(:disabled) {
              background: rgba(100,150,255,0.3);
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          </style>

          <div class="widget-panel">
            <h3>♣ AST Statistics</h3>

            ${initialized && root ? `
              <div class="controls">
                <button id="expand-btn">▽ Expand All</button>
                <button id="collapse-btn">△ Collapse All</button>
              </div>
            ` : ''}

            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 12px;">
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Total Nodes</div>
                <div style="font-size: 1.3em; font-weight: bold;">${_nodeCount}</div>
              </div>
              <div style="padding: 12px; background: ${_parseErrors.length > 0 ? 'rgba(255,0,0,0.1)' : 'rgba(0,200,100,0.1)'}; border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Parse Errors</div>
                <div style="font-size: 1.3em; font-weight: bold; color: ${_parseErrors.length > 0 ? '#ff6b6b' : 'inherit'};">${_parseErrors.length}</div>
              </div>
            </div>

            ${currentCode ? `
              <h3 style="margin-top: 20px;">⛿ Current Code</h3>
              <div style="margin-top: 12px; padding: 10px; background: rgba(0,0,0,0.3); border-radius: 4px; font-family: monospace; font-size: 0.85em; color: #aaa; max-height: 150px; overflow-y: auto;">
                ${currentCode.substring(0, 500).split('\n').map(line =>
                  `<div style="white-space: pre;">${line.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div>`
                ).join('')}
                ${currentCode.length > 500 ? '<div style="color: #666; font-style: italic;">... (truncated)</div>' : ''}
              </div>
            ` : '<div style="margin-top: 12px; color: #888; font-style: italic;">No code visualized yet</div>'}

            ${topNodeTypes.length > 0 ? `
              <h3 style="margin-top: 20px;">☷️ Top Node Types</h3>
              <div style="margin-top: 12px;">
                ${topNodeTypes.map(([type, count]) => {
                  const style = NODE_STYLES[type] || NODE_STYLES.default;
                  return `
                    <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 4px;">
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 12px; height: 12px; background: ${style.color}; border-radius: 50%;"></div>
                        <span style="font-size: 0.9em;">${type}</span>
                      </div>
                      <span style="font-weight: bold; color: ${style.color};">${count}</span>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            ${_parseErrors.length > 0 ? `
              <h3 style="margin-top: 20px;">⚠️ Recent Parse Errors</h3>
              <div style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
                ${_parseErrors.slice(-5).reverse().map(err => {
                  const timeAgo = Math.floor((Date.now() - err.timestamp) / 1000);
                  return `
                    <div style="padding: 8px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff6b6b; border-radius: 4px; margin-bottom: 6px;">
                      <div style="font-weight: bold; color: #ff6b6b; font-size: 0.9em;">${err.message}</div>
                      <div style="color: #aaa; font-size: 0.85em; margin-top: 4px; font-family: monospace;">${err.codeSnippet}...</div>
                      <div style="color: #666; font-size: 0.8em; margin-top: 4px;">${timeAgo}s ago</div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : ''}

            <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
              <strong>ℹ️ AST Visualization</strong>
              <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                Powered by Acorn parser and D3.js tree layout.<br>
                Click nodes to expand/collapse. Zoom and pan with mouse/touch.
              </div>
            </div>
          </div>
        `;

        // Attach event listeners for control buttons
        const expandBtn = this.shadowRoot.getElementById('expand-btn');
        if (expandBtn) {
          expandBtn.addEventListener('click', () => {
            expandAll();
            this.render();
          });
        }

        const collapseBtn = this.shadowRoot.getElementById('collapse-btn');
        if (collapseBtn) {
          collapseBtn.addEventListener('click', () => {
            collapseAll();
            this.render();
          });
        }
      }
    }

    // Register custom element
    const elementName = 'ast-visualizer-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ASTVisualizerWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'AST Visualizer',
      icon: '♣',
      category: 'ui',
      updateInterval: null
    };

    return {
      api: {
        init,
        destroy,
        visualizeCode,
        expandAll,
        collapseAll,
        getCurrentCode: () => currentCode
      },
      widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ASTVisualizer);
}

export default ASTVisualizer;
