/**
 * Reploid AST Visualizer Widget
 *
 * Interactive JavaScript Abstract Syntax Tree visualization using D3.js
 * Displays code structure with expand/collapse, zoom, and node statistics
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

const mockCodeSample = `
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}
`;

// AST node type styling
const NODE_STYLES: Record<string, { color: string; shape: string; label: string }> = {
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

export default function createASTVisualizerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class ASTVisualizerWidget extends HTMLElement {
    private currentCode: string = '';
    private currentFilePath: string = '';
    private nodeCount: number = 0;
    private parseErrors: Array<{ message: string; timestamp: number }> = [];
    private ast: any = null;
    private unsubscribers: Array<() => void> = [];
    private vizContainer: HTMLElement | null = null;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      if (USE_MOCK_DATA) {
        this.visualizeCode(mockCodeSample);
      } else {
        // Subscribe to file selection events
        const unsubFileSelect = EventBus.on('file:selected', (data: any) => {
          if (data.path && data.path.endsWith('.js')) {
            this.fetchAndVisualizeFile(data.path);
          }
        });
        this.unsubscribers.push(unsubFileSelect);

        // Subscribe to code update events
        const unsubCodeUpdate = EventBus.on('code:visualize', (data: any) => {
          if (data.code) {
            this.visualizeCode(data.code, data.filePath);
          }
        });
        this.unsubscribers.push(unsubCodeUpdate);
      }
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async fetchAndVisualizeFile(filePath: string) {
      try {
        const result = await MCPBridge.callTool(
          'vfs',
          'read_file',
          { path: filePath }
        );

        if (result.content?.[0]?.text) {
          const data = JSON.parse(result.content[0].text);
          this.visualizeCode(data.content || data.text || '', filePath);
        }
      } catch (error) {
        console.error('[ASTVisualizer] Failed to fetch file:', error);
        EventBus.emit('toast:error', {
          message: `Failed to load file: ${error.message}`,
          duration: 5000
        });
      }
    }

    private parseCode(code: string): any {
      try {
        // Check if acorn is available (global dependency)
        if (typeof (window as any).acorn === 'undefined') {
          throw new Error('Acorn parser not loaded');
        }

        const acorn = (window as any).acorn;
        const ast = acorn.parse(code, {
          ecmaVersion: 2023,
          sourceType: 'module',
          locations: true
        });

        return ast;
      } catch (error) {
        console.error('[ASTVisualizer] Parse error:', error);
        throw error;
      }
    }

    private astToHierarchy(node: any, depth: number = 0): any {
      if (!node || typeof node !== 'object') {
        return null;
      }

      const style = NODE_STYLES[node.type] || NODE_STYLES.default;

      const hierarchyNode: any = {
        name: node.type,
        label: style.label,
        color: style.color,
        shape: style.shape,
        depth: depth,
        nodeType: node.type,
        properties: {},
        children: []
      };

      // Add relevant properties
      if (node.name) hierarchyNode.properties.name = node.name;
      if (node.value !== undefined) hierarchyNode.properties.value = node.value;
      if (node.operator) hierarchyNode.properties.operator = node.operator;
      if (node.kind) hierarchyNode.properties.kind = node.kind;

      // Process children
      const childKeys = Object.keys(node).filter(key =>
        !['type', 'loc', 'range', 'start', 'end'].includes(key)
      );

      for (const key of childKeys) {
        const value = node[key];

        if (Array.isArray(value)) {
          value.forEach((item: any, index: number) => {
            if (item && typeof item === 'object' && item.type) {
              const child = this.astToHierarchy(item, depth + 1);
              if (child) {
                child.name = `${key}[${index}]`;
                hierarchyNode.children.push(child);
              }
            }
          });
        } else if (value && typeof value === 'object' && value.type) {
          const child = this.astToHierarchy(value, depth + 1);
          if (child) {
            child.name = key;
            hierarchyNode.children.push(child);
          }
        }
      }

      return hierarchyNode;
    }

    private visualizeCode(code: string, filePath: string = '') {
      if (!code || !code.trim()) {
        console.warn('[ASTVisualizer] Empty code');
        return;
      }

      try {
        this.currentCode = code;
        this.currentFilePath = filePath;
        this.ast = this.parseCode(code);

        const hierarchyData = this.astToHierarchy(this.ast);

        if (hierarchyData) {
          // Count nodes recursively
          const countNodes = (node: any): number => {
            if (!node) return 0;
            let count = 1;
            if (node.children) {
              count += node.children.reduce((sum: number, child: any) => sum + countNodes(child), 0);
            }
            return count;
          };

          this.nodeCount = countNodes(hierarchyData);
          this.parseErrors = [];

          console.info('[ASTVisualizer] AST visualized successfully');
          EventBus.emit('toast:success', {
            message: `AST parsed: ${this.nodeCount} nodes`,
            duration: 3000
          });
        }

        this.render();
      } catch (error: any) {
        console.error('[ASTVisualizer] Visualization error:', error);

        this.parseErrors.push({
          message: error.message,
          timestamp: Date.now()
        });

        if (this.parseErrors.length > 20) {
          this.parseErrors.shift();
        }

        EventBus.emit('ast:parse:error', { error: error.message, code });
        EventBus.emit('toast:error', {
          message: `Parse error: ${error.message}`,
          duration: 5000
        });

        this.render();
      }
    }

    private countNodeTypes(): Record<string, number> {
      const counts: Record<string, number> = {};

      const traverse = (node: any) => {
        if (!node) return;
        const type = node.nodeType || 'unknown';
        counts[type] = (counts[type] || 0) + 1;
        if (node.children) {
          node.children.forEach((child: any) => traverse(child));
        }
      };

      if (this.ast) {
        const hierarchyData = this.astToHierarchy(this.ast);
        traverse(hierarchyData);
      }

      return counts;
    }

    private render() {
      if (!this.shadowRoot) return;

      const nodeTypeCounts = this.countNodeTypes();
      const topNodeTypes = Object.entries(nodeTypeCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8);

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            height: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
          }

          .ast-visualizer-container {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .ast-toolbar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: #222;
            border-bottom: 1px solid #333;
          }

          .ast-toolbar h4 {
            margin: 0;
            font-size: 0.875rem;
            font-weight: 600;
            color: #e0e0e0;
          }

          .ast-toolbar button {
            padding: 0.25rem 0.75rem;
            background: #333;
            border: 1px solid #444;
            color: #e0e0e0;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.75rem;
          }

          .ast-toolbar button:hover {
            background: #444;
          }

          .ast-content {
            flex: 1;
            padding: 1rem;
            overflow-y: auto;
          }

          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.75rem;
            margin-bottom: 1rem;
          }

          .stat-card {
            padding: 0.75rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
          }

          .stat-label {
            font-size: 0.75rem;
            color: #888;
            margin-bottom: 0.25rem;
          }

          .stat-value {
            font-size: 1.25rem;
            font-weight: bold;
            color: #e0e0e0;
          }

          .stat-card.error {
            background: rgba(255, 107, 107, 0.1);
          }

          .stat-card.error .stat-value {
            color: #ff6b6b;
          }

          .section-title {
            font-size: 0.875rem;
            font-weight: 600;
            color: #e0e0e0;
            margin: 1.5rem 0 0.75rem 0;
          }

          .code-preview {
            padding: 0.75rem;
            background: rgba(0, 0, 0, 0.3);
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 0.75rem;
            color: #aaa;
            max-height: 150px;
            overflow-y: auto;
            white-space: pre;
            line-height: 1.4;
          }

          .node-type-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
          }

          .node-type-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 0.5rem;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 4px;
          }

          .node-type-info {
            display: flex;
            align-items: center;
            gap: 0.5rem;
          }

          .node-color-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
          }

          .node-type-name {
            font-size: 0.813rem;
            color: #e0e0e0;
          }

          .node-type-count {
            font-weight: bold;
            font-size: 0.875rem;
          }

          .error-list {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            max-height: 200px;
            overflow-y: auto;
          }

          .error-item {
            padding: 0.75rem;
            background: rgba(255, 107, 107, 0.1);
            border-left: 3px solid #ff6b6b;
            border-radius: 4px;
          }

          .error-message {
            font-weight: bold;
            color: #ff6b6b;
            font-size: 0.813rem;
            margin-bottom: 0.25rem;
          }

          .error-time {
            color: #666;
            font-size: 0.75rem;
          }

          .info-box {
            padding: 0.75rem;
            background: rgba(77, 171, 247, 0.1);
            border-left: 3px solid #4dabf7;
            border-radius: 4px;
            margin-top: 1rem;
          }

          .info-box-title {
            font-weight: bold;
            color: #4dabf7;
            margin-bottom: 0.5rem;
          }

          .info-box-text {
            color: #aaa;
            font-size: 0.813rem;
            line-height: 1.5;
          }

          .empty-state {
            text-align: center;
            padding: 3rem 1.5rem;
            color: #666;
          }

          .empty-state-icon {
            font-size: 3rem;
            margin-bottom: 1rem;
          }
        </style>

        <div class="ast-visualizer-container">
          <div class="ast-toolbar">
            <h4>AST Visualizer</h4>
          </div>

          <div class="ast-content">
            ${this.currentCode ? `
              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Nodes</div>
                  <div class="stat-value">${this.nodeCount}</div>
                </div>
                <div class="stat-card ${this.parseErrors.length > 0 ? 'error' : ''}">
                  <div class="stat-label">Parse Errors</div>
                  <div class="stat-value">${this.parseErrors.length}</div>
                </div>
              </div>

              ${this.currentFilePath ? `
                <div class="section-title">📄 Current File</div>
                <div style="padding: 0.5rem; background: rgba(255,255,255,0.05); border-radius: 4px; font-family: monospace; font-size: 0.813rem; color: #4dabf7;">
                  ${this.escapeHtml(this.currentFilePath)}
                </div>
              ` : ''}

              <div class="section-title">📝 Code Preview</div>
              <div class="code-preview">${this.escapeHtml(this.currentCode.substring(0, 500))}${this.currentCode.length > 500 ? '\n... (truncated)' : ''}</div>

              ${topNodeTypes.length > 0 ? `
                <div class="section-title">🔷 Top Node Types</div>
                <div class="node-type-list">
                  ${topNodeTypes.map(([type, count]) => {
                    const style = NODE_STYLES[type] || NODE_STYLES.default;
                    return `
                      <div class="node-type-item">
                        <div class="node-type-info">
                          <div class="node-color-dot" style="background: ${style.color}"></div>
                          <span class="node-type-name">${this.escapeHtml(type)}</span>
                        </div>
                        <span class="node-type-count" style="color: ${style.color}">${count}</span>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              ${this.parseErrors.length > 0 ? `
                <div class="section-title">⚠️ Recent Parse Errors</div>
                <div class="error-list">
                  ${this.parseErrors.slice(-5).reverse().map(err => {
                    const timeAgo = Math.floor((Date.now() - err.timestamp) / 1000);
                    return `
                      <div class="error-item">
                        <div class="error-message">${this.escapeHtml(err.message)}</div>
                        <div class="error-time">${timeAgo}s ago</div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : ''}

              <div class="info-box">
                <div class="info-box-title">ℹ️ AST Visualization</div>
                <div class="info-box-text">
                  Powered by Acorn parser. AST analysis helps understand code structure,
                  identify patterns, and support code transformations.
                </div>
              </div>
            ` : `
              <div class="empty-state">
                <div class="empty-state-icon">🌳</div>
                <p>No code visualized yet</p>
                <p style="font-size: 0.813rem; color: #888; margin-top: 0.5rem;">
                  Select a .js file or emit 'code:visualize' event
                </p>
              </div>
            `}
          </div>
        </div>
      `;
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  }

  customElements.define('reploid-ast-visualizer', ASTVisualizerWidget);

  return {
    factory: () => {
      return new ASTVisualizerWidget();
    }
  };
}
