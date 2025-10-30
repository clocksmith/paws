/**
 * Reploid VFS Explorer Widget
 *
 * File browser for exploring the virtual file system
 * Tree view with file/folder navigation
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

// Mock data inline for development
let mockVFSData: any;
if (USE_MOCK_DATA) {
  mockVFSData = {
    "root": "/home/clocksmith/deco/paws",
    "tree": [
      {
        "path": "/home/clocksmith/deco/paws/reploid",
        "name": "reploid",
        "type": "directory",
        "expanded": false,
        "children": [
          {
            "path": "/home/clocksmith/deco/paws/reploid/boot.js",
            "name": "boot.js",
            "type": "file",
            "size": 15420
          },
          {
            "path": "/home/clocksmith/deco/paws/reploid/config.json",
            "name": "config.json",
            "type": "file",
            "size": 2048
          },
          {
            "path": "/home/clocksmith/deco/paws/reploid/upgrades",
            "name": "upgrades",
            "type": "directory",
            "expanded": false,
            "children": [
              {
                "path": "/home/clocksmith/deco/paws/reploid/upgrades/core",
                "name": "core",
                "type": "directory",
                "expanded": false,
                "children": [
                  {
                    "path": "/home/clocksmith/deco/paws/reploid/upgrades/core/sentinel-fsm.js",
                    "name": "sentinel-fsm.js",
                    "type": "file",
                    "size": 8192
                  },
                  {
                    "path": "/home/clocksmith/deco/paws/reploid/upgrades/core/tool-runner.js",
                    "name": "tool-runner.js",
                    "type": "file",
                    "size": 6144
                  }
                ]
              },
              {
                "path": "/home/clocksmith/deco/paws/reploid/upgrades/ui",
                "name": "ui",
                "type": "directory",
                "expanded": false,
                "children": [
                  {
                    "path": "/home/clocksmith/deco/paws/reploid/upgrades/ui/sentinel-panel.js",
                    "name": "sentinel-panel.js",
                    "type": "file",
                    "size": 12288
                  }
                ]
              }
            ]
          }
        ]
      },
      {
        "path": "/home/clocksmith/deco/paws/lens",
        "name": "lens",
        "type": "directory",
        "expanded": false,
        "children": [
          {
            "path": "/home/clocksmith/deco/paws/lens/SPEC.md",
            "name": "SPEC.md",
            "type": "file",
            "size": 32768
          }
        ]
      }
    ]
  };
}

export default function createVFSExplorerWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class VFSExplorerWidget extends HTMLElement {
    private vfsData: any = null;
    private selectedPath: string | null = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Subscribe to VFS events
      const unsubRefresh = EventBus.on('reploid:vfs:refresh', () => {
        this.loadVFS();
      });
      this.unsubscribers.push(unsubRefresh);

      // Initial load
      this.loadVFS();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadVFS() {
      if (USE_MOCK_DATA) {
        this.vfsData = mockVFSData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'get_vfs_tree',
          { root: '/' }
        );

        if (result.content && result.content[0] && result.content[0].text) {
          this.vfsData = JSON.parse(result.content[0].text);
          this.render();
        }
      } catch (error) {
        console.error('Failed to load VFS:', error);
        this.showError('Failed to load file system');
      }
    }

    private toggleFolder(path: string) {
      if (!this.vfsData) return;

      const toggleNode = (nodes: any[]): boolean => {
        for (const node of nodes) {
          if (node.path === path && node.type === 'directory') {
            node.expanded = !node.expanded;
            return true;
          }
          if (node.children && toggleNode(node.children)) {
            return true;
          }
        }
        return false;
      };

      toggleNode(this.vfsData.tree);
      this.render();
    }

    private selectFile(path: string, name: string) {
      this.selectedPath = path;
      EventBus.emit('reploid:vfs:file-selected', {
        path,
        name
      });
      this.render();
    }

    private async openFile(path: string) {
      if (USE_MOCK_DATA) {
        console.log('MOCK: Opening file:', path);
        alert(`Would open file: ${path}\n(Mock mode)`);
        return;
      }

      try {
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'read_file',
          { path }
        );

        EventBus.emit('reploid:vfs:file-opened', {
          path,
          content: result.content[0].text
        });
      } catch (error) {
        console.error('Failed to open file:', error);
        this.showError('Failed to open file');
      }
    }

    private showError(message: string) {
      const errorDiv = document.createElement('div');
      errorDiv.className = 'error-toast';
      errorDiv.textContent = message;
      this.shadowRoot?.appendChild(errorDiv);
      setTimeout(() => errorDiv.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      if (!this.vfsData) {
        this.shadowRoot.innerHTML = `
          <style>${this.getStyles()}</style>
          <div class="vfs-explorer-empty">
            <div class="empty-icon">📁</div>
            <div class="empty-text">Loading file system...</div>
          </div>
        `;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="vfs-explorer">
          <div class="vfs-header">
            <h3>📁 File Explorer</h3>
            <div class="vfs-root">${this.escapeHtml(this.vfsData.root)}</div>
          </div>

          <div class="vfs-toolbar">
            <button class="btn-refresh">⟳ Refresh</button>
            <button class="btn-collapse">▼ Collapse All</button>
          </div>

          <div class="vfs-tree">
            ${this.vfsData.tree.map((node: any) => this.renderNode(node, 0)).join('')}
          </div>

          ${this.selectedPath ? `
            <div class="vfs-footer">
              <div class="selected-path">Selected: ${this.escapeHtml(this.selectedPath)}</div>
              <button class="btn-open">Open File</button>
            </div>
          ` : ''}
        </div>
      `;

      // Attach event listeners
      this.shadowRoot.querySelector('.btn-refresh')?.addEventListener('click', () => {
        this.loadVFS();
      });

      this.shadowRoot.querySelector('.btn-collapse')?.addEventListener('click', () => {
        this.collapseAll();
      });

      this.shadowRoot.querySelector('.btn-open')?.addEventListener('click', () => {
        if (this.selectedPath) {
          this.openFile(this.selectedPath);
        }
      });

      // Attach node-specific listeners
      this.attachNodeListeners();
    }

    private attachNodeListeners() {
      const folders = this.shadowRoot?.querySelectorAll('.folder-toggle');
      folders?.forEach(folder => {
        folder.addEventListener('click', (e) => {
          const path = (e.currentTarget as HTMLElement).dataset.path;
          if (path) {
            this.toggleFolder(path);
          }
        });
      });

      const files = this.shadowRoot?.querySelectorAll('.file-item');
      files?.forEach(file => {
        file.addEventListener('click', (e) => {
          const path = (e.currentTarget as HTMLElement).dataset.path;
          const name = (e.currentTarget as HTMLElement).dataset.name;
          if (path && name) {
            this.selectFile(path, name);
          }
        });

        file.addEventListener('dblclick', (e) => {
          const path = (e.currentTarget as HTMLElement).dataset.path;
          if (path) {
            this.openFile(path);
          }
        });
      });
    }

    private collapseAll() {
      if (!this.vfsData) return;

      const collapseNode = (nodes: any[]) => {
        nodes.forEach(node => {
          if (node.type === 'directory') {
            node.expanded = false;
            if (node.children) {
              collapseNode(node.children);
            }
          }
        });
      };

      collapseNode(this.vfsData.tree);
      this.render();
    }

    private renderNode(node: any, depth: number): string {
      const indent = depth * 20;
      const isSelected = this.selectedPath === node.path;

      if (node.type === 'directory') {
        const icon = node.expanded ? '📂' : '📁';
        const expandIcon = node.expanded ? '▼' : '▶';

        return `
          <div class="tree-node directory ${isSelected ? 'selected' : ''}" style="padding-left: ${indent}px;">
            <div class="node-content folder-toggle" data-path="${node.path}">
              <span class="expand-icon">${expandIcon}</span>
              <span class="node-icon">${icon}</span>
              <span class="node-name">${this.escapeHtml(node.name)}</span>
            </div>
            ${node.expanded && node.children ? `
              <div class="node-children">
                ${node.children.map((child: any) => this.renderNode(child, depth + 1)).join('')}
              </div>
            ` : ''}
          </div>
        `;
      } else {
        const icon = this.getFileIcon(node.name);
        const size = this.formatFileSize(node.size);

        return `
          <div class="tree-node file ${isSelected ? 'selected' : ''}" style="padding-left: ${indent}px;">
            <div class="node-content file-item" data-path="${node.path}" data-name="${node.name}">
              <span class="expand-icon"></span>
              <span class="node-icon">${icon}</span>
              <span class="node-name">${this.escapeHtml(node.name)}</span>
              <span class="file-size">${size}</span>
            </div>
          </div>
        `;
      }
    }

    private getFileIcon(filename: string): string {
      const ext = filename.split('.').pop()?.toLowerCase();
      const iconMap: Record<string, string> = {
        'js': '📜',
        'ts': '📘',
        'json': '📋',
        'md': '📝',
        'css': '🎨',
        'html': '🌐',
        'jpg': '🖼️',
        'png': '🖼️',
        'svg': '🎨'
      };
      return iconMap[ext || ''] || '📄';
    }

    private formatFileSize(bytes: number): string {
      if (bytes < 1024) return `${bytes}B`;
      if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host {
          display: block;
          font-family: 'Courier New', monospace;
          color: #e0e0e0;
        }

        .vfs-explorer-empty {
          padding: 60px 20px;
          text-align: center;
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
        }

        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
          opacity: 0.5;
        }

        .empty-text {
          font-size: 18px;
          color: #888;
        }

        .vfs-explorer {
          background: rgba(40, 40, 40, 0.6);
          border: 2px solid #333;
          display: flex;
          flex-direction: column;
          height: 600px;
        }

        .vfs-header {
          background: rgba(20, 20, 20, 0.8);
          padding: 16px;
          border-bottom: 2px solid #333;
        }

        .vfs-header h3 {
          margin: 0 0 8px 0;
          color: #4ec9b0;
          font-size: 16px;
          font-weight: bold;
        }

        .vfs-root {
          color: #888;
          font-size: 12px;
        }

        .vfs-toolbar {
          padding: 8px 16px;
          background: rgba(30, 30, 30, 0.8);
          border-bottom: 1px solid #333;
          display: flex;
          gap: 8px;
        }

        .vfs-toolbar button {
          padding: 4px 12px;
          background: rgba(78, 201, 176, 0.2);
          border: 1px solid rgba(78, 201, 176, 0.4);
          color: #4ec9b0;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          transition: all 0.2s;
        }

        .vfs-toolbar button:hover {
          background: rgba(78, 201, 176, 0.3);
        }

        .vfs-tree {
          flex: 1;
          overflow-y: auto;
          padding: 8px 0;
        }

        .tree-node {
          cursor: pointer;
          transition: background 0.2s;
        }

        .tree-node:hover {
          background: rgba(78, 201, 176, 0.1);
        }

        .tree-node.selected {
          background: rgba(78, 201, 176, 0.2);
        }

        .node-content {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          font-size: 13px;
        }

        .expand-icon {
          width: 16px;
          text-align: center;
          font-size: 10px;
          color: #888;
        }

        .node-icon {
          font-size: 16px;
        }

        .node-name {
          flex: 1;
          color: #e0e0e0;
        }

        .file-size {
          font-size: 11px;
          color: #888;
          margin-left: auto;
        }

        .node-children {
          /* Children are already indented via style attribute */
        }

        .folder-toggle {
          cursor: pointer;
        }

        .file-item {
          cursor: pointer;
        }

        .vfs-footer {
          padding: 12px 16px;
          background: rgba(20, 20, 20, 0.8);
          border-top: 2px solid #333;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .selected-path {
          font-size: 12px;
          color: #4ec9b0;
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .btn-open {
          padding: 8px 16px;
          background: #4ec9b0;
          color: #000;
          border: none;
          cursor: pointer;
          font-family: 'Courier New', monospace;
          font-size: 12px;
          font-weight: bold;
          transition: all 0.2s;
        }

        .btn-open:hover {
          background: #6ee7ce;
        }

        .error-toast {
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #ff4444;
          color: white;
          padding: 12px 20px;
          border-radius: 4px;
          font-size: 14px;
          z-index: 10000;
        }
      `;
    }
  }

  // Register custom element
  if (!customElements.get('reploid-vfs-explorer')) {
    customElements.define('reploid-vfs-explorer', VFSExplorerWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        console.log('[VFSExplorerWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', {
          element: 'reploid-vfs-explorer',
          displayName: 'Reploid VFS Explorer'
        });
      },
      async destroy() {
        console.log('[VFSExplorerWidget] Destroyed');
        EventBus.emit('mcp:widget:destroyed', {
          element: 'reploid-vfs-explorer',
          displayName: 'Reploid VFS Explorer'
        });
      },
      async refresh() {
        console.log('[VFSExplorerWidget] Refreshed');
        EventBus.emit('mcp:widget:refreshed', {
          element: 'reploid-vfs-explorer',
          displayName: 'Reploid VFS Explorer'
        });
        // Trigger VFS reload
        EventBus.emit('reploid:vfs:refresh', {});
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-vfs-explorer',
      displayName: 'Reploid VFS Explorer',
      description: 'Browse and explore the virtual file system',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false
      },
      permissions: {
        tools: ['get_vfs_tree', 'read_file']
      },
      category: 'content-browser',
      tags: ['reploid', 'vfs', 'files', 'explorer']
    }
  };
}
