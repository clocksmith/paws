// @blueprint 0x000023 - Covers VFS explorer interactions and safeguards.
// VFS Explorer Module for REPLOID
// Enhanced file tree with search, expand/collapse, and file viewer

const VFSExplorer = {
  metadata: {
    id: 'VFSExplorer',
    version: '1.1.0',
    dependencies: ['Utils', 'EventBus', 'StateManager', 'ToastNotifications?'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager, ToastNotifications } = deps;
    const { logger } = Utils;

    class Explorer {
      constructor() {
        this.expanded = new Set(['/vfs']); // Track expanded folders
        this.selectedFile = null;
        this.searchTerm = '';
        this.container = null;
        this.fileViewerModal = null;
      }

      async init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
          logger.error(`[VFSExplorer] Container not found: ${containerId}`);
          return;
        }

        // Add styles if not already present (idempotent)
        if (!document.getElementById('vfs-explorer-styles')) {
          const styles = document.createElement('style');
          styles.id = 'vfs-explorer-styles';
          styles.innerHTML = getVFSExplorerStyles();
          document.head.appendChild(styles);
        }

        await this.render();

        // Listen for VFS changes
        EventBus.on('vfs:updated', () => this.render());
        EventBus.on('artifact:created', () => this.render());
        EventBus.on('artifact:updated', () => this.render());
        EventBus.on('artifact:deleted', () => this.render());
      }

      async render() {
        if (!this.container) return;

        const allMeta = await StateManager.getAllArtifactMetadata();
        const tree = this.buildTree(allMeta);

        this.container.innerHTML = `
          <div class="vfs-explorer">
            <div class="vfs-toolbar" role="toolbar" aria-label="File explorer controls">
              <input type="text"
                     class="vfs-search"
                     placeholder="⌕ Search files..."
                     value="${this.escapeHtml(this.searchTerm)}"
                     aria-label="Search files"
                     role="searchbox">
              <button class="vfs-refresh" title="Refresh" aria-label="Refresh file tree">↻</button>
              <button class="vfs-collapse-all" title="Collapse All" aria-label="Collapse all folders">⊟</button>
              <button class="vfs-expand-all" title="Expand All" aria-label="Expand all folders">⊞</button>
            </div>
            <div class="vfs-tree" role="tree" aria-label="File tree">${this.renderTree(tree)}</div>
            <div class="vfs-stats" role="status" aria-live="polite">
              ${Object.keys(allMeta).length} files
            </div>
          </div>
        `;

        this.attachEventListeners();
      }

      buildTree(allMeta) {
        const tree = {
          name: 'root',
          path: '',
          type: 'folder',
          children: []
        };

        for (const path in allMeta) {
          const parts = path.split('/').filter(p => p);
          let current = tree;

          parts.forEach((part, index) => {
            const isLast = index === parts.length - 1;

            if (isLast) {
              // File node
              current.children.push({
                name: part,
                path: path,
                type: 'file',
                size: allMeta[path].size || 0,
                metadata: allMeta[path]
              });
            } else {
              // Folder node
              let folder = current.children.find(c => c.name === part && c.type === 'folder');
              if (!folder) {
                folder = {
                  name: part,
                  path: parts.slice(0, index + 1).join('/'),
                  type: 'folder',
                  children: []
                };
                current.children.push(folder);
              }
              current = folder;
            }
          });
        }

        // Sort: folders first, then files, alphabetically
        const sortChildren = (node) => {
          if (node.children) {
            node.children.sort((a, b) => {
              if (a.type !== b.type) {
                return a.type === 'folder' ? -1 : 1;
              }
              return a.name.localeCompare(b.name);
            });
            node.children.forEach(sortChildren);
          }
        };
        sortChildren(tree);

        return tree;
      }

      renderTree(node, depth = 0) {
        if (!node.children || node.children.length === 0) {
          return '';
        }

        const filteredChildren = this.searchTerm
          ? node.children.filter(child => this.matchesSearch(child))
          : node.children;

        return filteredChildren.map(child => {
          if (child.type === 'file') {
            return this.renderFile(child, depth);
          } else {
            return this.renderFolder(child, depth);
          }
        }).join('');
      }

      renderFile(node, depth) {
        const icon = this.getFileIcon(node.path);
        const selected = node.path === this.selectedFile ? 'selected' : '';
        const highlight = this.searchTerm && node.name.toLowerCase().includes(this.searchTerm.toLowerCase())
          ? 'highlight' : '';

        return `
          <div class="vfs-item vfs-file ${selected} ${highlight}"
               data-path="${this.escapeHtml(node.path)}"
               data-type="file"
               role="treeitem"
               aria-selected="${selected ? 'true' : 'false'}"
               aria-label="${this.escapeHtml(node.name)} (${this.formatSize(node.size)})"
               tabindex="${selected ? '0' : '-1'}"
               style="padding-left:${depth * 20 + 20}px">
            <span class="vfs-icon" aria-hidden="true">${icon}</span>
            <span class="vfs-name">${this.escapeHtml(node.name)}</span>
            <span class="vfs-size">${this.formatSize(node.size)}</span>
          </div>
        `;
      }

      renderFolder(node, depth) {
        const isExpanded = this.expanded.has(node.path) || this.searchTerm !== '';
        const icon = isExpanded ? '⛁' : '⛁';
        const expandIcon = isExpanded ? '▼' : '▶';

        const childrenHtml = isExpanded ? this.renderTree(node, depth + 1) : '';
        const fileCount = this.countFiles(node);

        return `
          <div class="vfs-folder" role="group">
            <div class="vfs-item vfs-folder-header"
                 data-path="${this.escapeHtml(node.path)}"
                 data-type="folder"
                 role="treeitem"
                 aria-expanded="${isExpanded}"
                 aria-label="${this.escapeHtml(node.name)} folder (${fileCount} items)"
                 tabindex="0"
                 style="padding-left:${depth * 20 + 20}px">
              <span class="vfs-expand" aria-hidden="true">${expandIcon}</span>
              <span class="vfs-icon" aria-hidden="true">${icon}</span>
              <span class="vfs-name">${this.escapeHtml(node.name)}</span>
              <span class="vfs-count" aria-hidden="true">(${fileCount})</span>
            </div>
            <div class="vfs-children ${isExpanded ? 'expanded' : 'collapsed'}" role="group">
              ${childrenHtml}
            </div>
          </div>
        `;
      }

      countFiles(node) {
        if (node.type === 'file') return 1;
        if (!node.children) return 0;
        return node.children.reduce((sum, child) => sum + this.countFiles(child), 0);
      }

      getFileIcon(path) {
        const ext = path.split('.').pop().toLowerCase();
        const iconMap = {
          'js': '⚶',
          'json': '☷',
          'md': '✎',
          'css': '⛉',
          'html': '♁',
          'txt': '⛿',
          'yml': '⚙️',
          'yaml': '⚙️',
          'xml': '⚶',
          'svg': '☐️',
          'png': '☐️',
          'jpg': '☐️',
          'jpeg': '☐️',
          'gif': '☐️',
          'pdf': '◫',
          'zip': '⛝',
          'tar': '⛝',
          'gz': '⛝'
        };
        return iconMap[ext] || '⛿';
      }

      formatSize(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
      }

      matchesSearch(node) {
        if (!this.searchTerm) return true;
        const term = this.searchTerm.toLowerCase();

        // Search in name and path
        if (node.name.toLowerCase().includes(term)) return true;
        if (node.path.toLowerCase().includes(term)) return true;

        // Search in children
        if (node.children) {
          return node.children.some(child => this.matchesSearch(child));
        }

        return false;
      }

      attachEventListeners() {
        // Search input
        const searchInput = this.container.querySelector('.vfs-search');
        if (searchInput) {
          searchInput.addEventListener('input', (e) => {
            this.searchTerm = e.target.value;
            this.render();
          });

          // Keyboard shortcuts: Ctrl+F or Cmd+F to focus search
          document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'f' && !e.shiftKey) {
              const explorerVisible = this.container && this.container.offsetParent !== null;
              if (explorerVisible) {
                e.preventDefault();
                searchInput.focus();
              }
            }
            // ESC to clear search
            if (e.key === 'Escape' && document.activeElement === searchInput && this.searchTerm) {
              e.preventDefault();
              this.searchTerm = '';
              searchInput.value = '';
              this.render();
            }
          });
        }

        // Refresh button
        const refreshBtn = this.container.querySelector('.vfs-refresh');
        if (refreshBtn) {
          refreshBtn.addEventListener('click', () => {
            this.render();
            if (ToastNotifications) ToastNotifications.success('File tree refreshed');
            logger.info('[VFSExplorer] Refreshed');
          });
        }

        // Collapse all button
        const collapseBtn = this.container.querySelector('.vfs-collapse-all');
        if (collapseBtn) {
          collapseBtn.addEventListener('click', () => {
            this.expanded.clear();
            this.render();
          });
        }

        // Expand all button
        const expandBtn = this.container.querySelector('.vfs-expand-all');
        if (expandBtn) {
          expandBtn.addEventListener('click', async () => {
            const allMeta = await StateManager.getAllArtifactMetadata();
            const tree = this.buildTree(allMeta);
            this.expandAll(tree);
            this.render();
          });
        }

        // Folder click handlers
        this.container.querySelectorAll('.vfs-folder-header').forEach(header => {
          header.addEventListener('click', (e) => {
            e.stopPropagation();
            const path = header.dataset.path;
            if (this.expanded.has(path)) {
              this.expanded.delete(path);
            } else {
              this.expanded.add(path);
            }
            this.render();
          });

          // Keyboard navigation: Enter/Space to toggle folder
          header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const path = header.dataset.path;
              if (this.expanded.has(path)) {
                this.expanded.delete(path);
              } else {
                this.expanded.add(path);
              }
              this.render();
            }
          });
        });

        // File click handlers
        this.container.querySelectorAll('.vfs-file').forEach(fileItem => {
          fileItem.addEventListener('click', async (e) => {
            e.stopPropagation();
            const path = fileItem.dataset.path;
            this.selectedFile = path;
            await this.showFileViewer(path);
            this.render();
          });

          // Keyboard navigation: Enter to open file
          fileItem.addEventListener('keydown', async (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              const path = fileItem.dataset.path;
              this.selectedFile = path;
              await this.showFileViewer(path);
              this.render();
            }
          });
        });
      }

      expandAll(node) {
        if (node.type === 'folder') {
          this.expanded.add(node.path);
          if (node.children) {
            node.children.forEach(child => this.expandAll(child));
          }
        }
      }

      async showFileViewer(path) {
        try {
          const content = await StateManager.getArtifactContent(path);
          const metadata = await StateManager.getArtifactMetadata(path);

          // Create modal if it doesn't exist
          if (!this.fileViewerModal) {
            this.fileViewerModal = document.createElement('div');
            this.fileViewerModal.className = 'vfs-file-viewer-modal';
            document.body.appendChild(this.fileViewerModal);
          }

          const language = this.getLanguageFromPath(path);

          this.fileViewerModal.innerHTML = `
            <div class="vfs-file-viewer-overlay"></div>
            <div class="vfs-file-viewer-content">
              <div class="vfs-file-viewer-header">
                <div class="vfs-file-viewer-title">
                  <span class="vfs-icon">${this.getFileIcon(path)}</span>
                  <span>${this.escapeHtml(path)}</span>
                </div>
                <button class="vfs-file-viewer-close">✕</button>
              </div>
              <div class="vfs-file-viewer-meta">
                Type: ${metadata?.type || 'unknown'} |
                Size: ${this.formatSize(content?.length || 0)} |
                Lines: ${(content || '').split('\n').length}
              </div>
              <div class="vfs-file-viewer-body">
                <pre><code class="language-${language}">${this.escapeHtml(content || '')}</code></pre>
              </div>
              <div class="vfs-file-viewer-footer">
                <button class="vfs-file-viewer-copy">☷ Copy</button>
                <button class="vfs-file-viewer-history">⚶ History</button>
                <button class="vfs-file-viewer-edit">✏️ Edit</button>
              </div>
            </div>
          `;

          this.fileViewerModal.style.display = 'flex';

          // Attach modal event listeners
          this.fileViewerModal.querySelector('.vfs-file-viewer-close').addEventListener('click', () => {
            this.fileViewerModal.style.display = 'none';
          });

          this.fileViewerModal.querySelector('.vfs-file-viewer-overlay').addEventListener('click', () => {
            this.fileViewerModal.style.display = 'none';
          });

          this.fileViewerModal.querySelector('.vfs-file-viewer-copy').addEventListener('click', async (e) => {
            try {
              await navigator.clipboard.writeText(content);
              logger.info(`[VFSExplorer] Copied ${path} to clipboard`);

              // Visual feedback
              const btn = e.target;
              const originalText = btn.innerHTML;
              btn.innerHTML = '✓ Copied!';
              btn.style.background = 'rgba(76, 175, 80, 0.3)';
              setTimeout(() => {
                btn.innerHTML = originalText;
                btn.style.background = '';
              }, 2000);
            } catch (err) {
              logger.error(`[VFSExplorer] Failed to copy to clipboard:`, err);
              if (ToastNotifications) ToastNotifications.error('Failed to copy to clipboard');
            }
          });

          this.fileViewerModal.querySelector('.vfs-file-viewer-history').addEventListener('click', async () => {
            const history = await StateManager.getArtifactHistory?.(path) || [];
            logger.info(`[VFSExplorer] History for ${path}:`, history);
            if (ToastNotifications) ToastNotifications.info(`History: ${history.length} versions available`);
          });

          this.fileViewerModal.querySelector('.vfs-file-viewer-edit').addEventListener('click', () => {
            EventBus.emit('vfs:edit-file', { path, content });
            this.fileViewerModal.style.display = 'none';
          });

          // ESC key to close
          const handleEsc = (e) => {
            if (e.key === 'Escape' && this.fileViewerModal.style.display === 'flex') {
              this.fileViewerModal.style.display = 'none';
              document.removeEventListener('keydown', handleEsc);
            }
          };
          document.addEventListener('keydown', handleEsc);

        } catch (error) {
          logger.error(`[VFSExplorer] Failed to load file ${path}:`, error);
          if (ToastNotifications) ToastNotifications.error(`Failed to load file: ${error.message}`);
        }
      }

      getLanguageFromPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        const langMap = {
          'js': 'javascript',
          'json': 'json',
          'md': 'markdown',
          'css': 'css',
          'html': 'html',
          'txt': 'text',
          'yml': 'yaml',
          'yaml': 'yaml',
          'xml': 'xml',
          'py': 'python',
          'rb': 'ruby',
          'java': 'java',
          'go': 'go',
          'rs': 'rust',
          'c': 'c',
          'cpp': 'cpp',
          'sh': 'bash'
        };
        return langMap[ext] || 'text';
      }

      escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
    }

    const explorer = new Explorer();

    // Init function for DI container
    const init = () => {
      logger.info('[VFSExplorer] Module initialized');
    };

    // Widget interface for ModuleWidgetProtocol
    const widget = (() => {
      class VFSExplorerWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          this._updateInterval = setInterval(() => this.render(), 3000);

          // Listen for VFS changes
          this._vfsHandlers = [
            () => this.render(),
            () => this.render(),
            () => this.render(),
            () => this.render()
          ];

          EventBus.on('vfs:updated', this._vfsHandlers[0]);
          EventBus.on('artifact:created', this._vfsHandlers[1]);
          EventBus.on('artifact:updated', this._vfsHandlers[2]);
          EventBus.on('artifact:deleted', this._vfsHandlers[3]);
        }

        disconnectedCallback() {
          if (this._updateInterval) {
            clearInterval(this._updateInterval);
            this._updateInterval = null;
          }

          if (this._vfsHandlers) {
            EventBus.off('vfs:updated', this._vfsHandlers[0]);
            EventBus.off('artifact:created', this._vfsHandlers[1]);
            EventBus.off('artifact:updated', this._vfsHandlers[2]);
            EventBus.off('artifact:deleted', this._vfsHandlers[3]);
          }
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        async getStatus() {
          const allMeta = await StateManager.getAllArtifactMetadata();
          const fileCount = Object.keys(allMeta).length;
          const searchActive = explorer.searchTerm && explorer.searchTerm.length > 0;

          return {
            state: searchActive ? 'active' : 'idle',
            primaryMetric: `${fileCount} files`,
            secondaryMetric: explorer.selectedFile ? `Selected: ${explorer.selectedFile.split('/').pop()}` : 'No selection',
            lastActivity: explorer.selectedFile ? Date.now() : null,
            message: searchActive ? `Searching: "${explorer.searchTerm}"` : null
          };
        }

        async render() {
          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: monospace;
                color: #e0e0e0;
                height: 100%;
              }
              .vfs-explorer-widget {
                padding: 12px;
                background: #1a1a1a;
                border-radius: 4px;
                height: 100%;
                display: flex;
                flex-direction: column;
              }
              .controls {
                margin-bottom: 12px;
                display: flex;
                gap: 8px;
              }
              button {
                padding: 6px 12px;
                background: #333;
                color: #e0e0e0;
                border: 1px solid #555;
                border-radius: 3px;
                cursor: pointer;
                font-family: monospace;
                font-size: 11px;
              }
              button:hover {
                background: #444;
              }
              #vfs-explorer-widget-container {
                flex: 1;
                overflow: hidden;
              }
            </style>
            <div class="vfs-explorer-widget">
              <div class="controls">
                <button class="refresh">↻ Refresh</button>
                <button class="expand-all">⊞ Expand All</button>
                <button class="collapse-all">⊟ Collapse All</button>
              </div>
              <div id="vfs-explorer-widget-container"></div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.refresh')?.addEventListener('click', () => {
            explorer.render();
            EventBus.emit('toast:success', { message: 'File tree refreshed' });
          });

          this.shadowRoot.querySelector('.expand-all')?.addEventListener('click', async () => {
            const allMeta = await StateManager.getAllArtifactMetadata();
            const tree = explorer.buildTree(allMeta);
            explorer.expandAll(tree);
            explorer.render();
            EventBus.emit('toast:info', { message: 'All folders expanded' });
          });

          this.shadowRoot.querySelector('.collapse-all')?.addEventListener('click', () => {
            explorer.expanded.clear();
            explorer.render();
            EventBus.emit('toast:info', { message: 'All folders collapsed' });
          });

          // Use the existing explorer rendering
          const widgetContainer = this.shadowRoot.querySelector('#vfs-explorer-widget-container');
          explorer.container = widgetContainer;
          await explorer.render();
        }
      }

      if (!customElements.get('vfs-explorer-widget')) {
        customElements.define('vfs-explorer-widget', VFSExplorerWidget);
      }

      return {
        element: 'vfs-explorer-widget',
        displayName: 'VFS Explorer',
        icon: '⛁',
        category: 'storage',
        order: 20
      };
    })();

    // CSS styles for VFS Explorer
    const getVFSExplorerStyles = () => {
      return `
/* VFS Explorer Styles */

.vfs-explorer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(0, 20, 40, 0.8);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  overflow: hidden;
}

.vfs-toolbar {
  display: flex;
  gap: 8px;
  padding: 8px;
  background: rgba(0, 255, 255, 0.1);
  border-bottom: 1px solid rgba(0, 255, 255, 0.3);
}

.vfs-search {
  flex: 1;
  padding: 6px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  color: #00ffff;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.vfs-search:focus {
  outline: none;
  border-color: #00ffff;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.vfs-search::placeholder {
  color: rgba(0, 255, 255, 0.5);
}

.vfs-toolbar button {
  padding: 6px 12px;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  color: #00ffff;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
}

.vfs-toolbar button:hover {
  background: rgba(0, 255, 255, 0.2);
  border-color: #00ffff;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

.vfs-tree {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
  font-family: 'Courier New', monospace;
  font-size: 13px;
}

.vfs-tree::-webkit-scrollbar {
  width: 8px;
}

.vfs-tree::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.vfs-tree::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 255, 0.3);
  border-radius: 4px;
}

.vfs-tree::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 255, 255, 0.5);
}

.vfs-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: 3px;
  transition: background 0.15s;
  user-select: none;
  white-space: nowrap;
}

.vfs-item:hover {
  background: rgba(0, 255, 255, 0.15);
}

.vfs-item.selected {
  background: rgba(0, 255, 255, 0.25);
  border-left: 2px solid #00ffff;
}

.vfs-item.highlight .vfs-name {
  background: rgba(255, 255, 0, 0.3);
  color: #ffff00;
  padding: 2px 4px;
  border-radius: 2px;
}

.vfs-folder-header {
  font-weight: 600;
  color: #00ffff;
}

.vfs-file {
  color: rgba(255, 255, 255, 0.9);
}

.vfs-expand {
  display: inline-block;
  width: 16px;
  text-align: center;
  font-size: 10px;
  color: rgba(0, 255, 255, 0.7);
}

.vfs-icon {
  font-size: 14px;
  min-width: 20px;
}

.vfs-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.vfs-count {
  font-size: 11px;
  color: rgba(0, 255, 255, 0.6);
  margin-left: 4px;
}

.vfs-size {
  font-size: 11px;
  color: rgba(0, 255, 255, 0.6);
  margin-left: auto;
}

.vfs-children.collapsed {
  display: none;
}

.vfs-children.expanded {
  display: block;
}

.vfs-stats {
  padding: 8px;
  text-align: center;
  font-size: 11px;
  color: rgba(0, 255, 255, 0.6);
  background: rgba(0, 255, 255, 0.05);
  border-top: 1px solid rgba(0, 255, 255, 0.2);
}

/* File Viewer Modal */

.vfs-file-viewer-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 10000;
  display: none;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.2s;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.vfs-file-viewer-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
}

.vfs-file-viewer-content {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 90%;
  max-width: 1200px;
  height: 80vh;
  background: rgba(0, 20, 40, 0.95);
  border: 2px solid rgba(0, 255, 255, 0.5);
  border-radius: 8px;
  box-shadow: 0 0 30px rgba(0, 255, 255, 0.3);
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.vfs-file-viewer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(0, 255, 255, 0.1);
  border-bottom: 1px solid rgba(0, 255, 255, 0.3);
}

.vfs-file-viewer-title {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #00ffff;
  font-family: 'Courier New', monospace;
  font-size: 14px;
  font-weight: 600;
}

.vfs-file-viewer-close {
  padding: 4px 8px;
  background: transparent;
  border: 1px solid rgba(255, 0, 0, 0.5);
  border-radius: 4px;
  color: #ff6666;
  font-size: 18px;
  cursor: pointer;
  transition: all 0.2s;
}

.vfs-file-viewer-close:hover {
  background: rgba(255, 0, 0, 0.2);
  border-color: #ff0000;
  box-shadow: 0 0 8px rgba(255, 0, 0, 0.3);
}

.vfs-file-viewer-meta {
  padding: 8px 16px;
  font-size: 12px;
  color: rgba(0, 255, 255, 0.7);
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
}

.vfs-file-viewer-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
  background: rgba(0, 0, 0, 0.5);
}

.vfs-file-viewer-body::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.vfs-file-viewer-body::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
}

.vfs-file-viewer-body::-webkit-scrollbar-thumb {
  background: rgba(0, 255, 255, 0.3);
  border-radius: 6px;
}

.vfs-file-viewer-body::-webkit-scrollbar-thumb:hover {
  background: rgba(0, 255, 255, 0.5);
}

.vfs-file-viewer-body pre {
  margin: 0;
  font-family: 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #ffffff;
}

.vfs-file-viewer-body code {
  display: block;
  white-space: pre;
  color: #ffffff;
}

.vfs-file-viewer-footer {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 255, 255, 0.1);
  border-top: 1px solid rgba(0, 255, 255, 0.3);
}

.vfs-file-viewer-footer button {
  padding: 8px 16px;
  background: rgba(0, 255, 255, 0.1);
  border: 1px solid rgba(0, 255, 255, 0.3);
  border-radius: 4px;
  color: #00ffff;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
}

.vfs-file-viewer-footer button:hover {
  background: rgba(0, 255, 255, 0.2);
  border-color: #00ffff;
  box-shadow: 0 0 8px rgba(0, 255, 255, 0.3);
}

/* ========================================
   MOBILE RESPONSIVE DESIGN
   ======================================== */

/* Tablet breakpoint */
@media (max-width: 1024px) {
  .vfs-toolbar {
    gap: 6px;
    padding: 6px;
  }

  .vfs-item {
    padding: 3px 6px;
    font-size: 12px;
  }

  .vfs-file-viewer-content {
    width: 92%;
    height: 85vh;
  }
}

/* Mobile breakpoint */
@media (max-width: 768px) {
  .vfs-explorer {
    font-size: 12px;
  }

  .vfs-toolbar {
    flex-wrap: wrap;
    padding: 6px;
  }

  .vfs-search {
    min-width: 100%;
    flex-basis: 100%;
    order: 1;
    font-size: 12px;
  }

  .vfs-toolbar button {
    padding: 6px 10px;
    font-size: 14px;
  }

  .vfs-tree {
    font-size: 11px;
  }

  .vfs-item {
    padding: 4px 6px;
    gap: 4px;
  }

  .vfs-icon {
    font-size: 12px;
    min-width: 18px;
  }

  .vfs-size,
  .vfs-count {
    font-size: 10px;
  }

  .vfs-stats {
    padding: 6px;
    font-size: 10px;
  }

  /* File viewer modal */
  .vfs-file-viewer-content {
    width: 95%;
    height: 90vh;
  }

  .vfs-file-viewer-header {
    padding: 10px 12px;
  }

  .vfs-file-viewer-title {
    font-size: 12px;
    gap: 6px;
  }

  .vfs-file-viewer-meta {
    padding: 6px 12px;
    font-size: 11px;
  }

  .vfs-file-viewer-body {
    padding: 12px;
  }

  .vfs-file-viewer-body pre {
    font-size: 11px;
    line-height: 1.5;
  }

  .vfs-file-viewer-footer {
    padding: 10px 12px;
    gap: 6px;
    flex-wrap: wrap;
  }

  .vfs-file-viewer-footer button {
    padding: 6px 12px;
    font-size: 12px;
    flex: 1;
    min-width: 80px;
  }
}

/* Small mobile breakpoint */
@media (max-width: 480px) {
  .vfs-toolbar button {
    padding: 5px 8px;
    font-size: 12px;
  }

  .vfs-item {
    padding: 3px 4px;
    font-size: 10px;
  }

  .vfs-name {
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 150px;
  }

  .vfs-file-viewer-content {
    width: 98%;
    height: 95vh;
    border-radius: 4px;
  }

  .vfs-file-viewer-title {
    font-size: 11px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .vfs-file-viewer-body {
    padding: 8px;
  }

  .vfs-file-viewer-body pre {
    font-size: 10px;
    line-height: 1.4;
  }

  .vfs-file-viewer-footer button {
    font-size: 11px;
    padding: 5px 10px;
  }
}

/* Touch optimizations */
@media (hover: none) and (pointer: coarse) {
  .vfs-item {
    min-height: 36px;
    align-items: center;
  }

  .vfs-toolbar button {
    min-height: 36px;
    min-width: 36px;
  }

  .vfs-file-viewer-close {
    min-height: 40px;
    min-width: 40px;
  }

  .vfs-file-viewer-footer button {
    min-height: 40px;
  }

  /* Better scroll */
  .vfs-tree {
    -webkit-overflow-scrolling: touch;
  }

  .vfs-file-viewer-body {
    -webkit-overflow-scrolling: touch;
  }
}

/* Landscape mobile */
@media (max-height: 500px) and (orientation: landscape) {
  .vfs-file-viewer-content {
    height: 95vh;
  }

  .vfs-file-viewer-body pre {
    font-size: 10px;
  }
}
      `;
    };

    return {
      init,
      api: {
        init: (containerId) => explorer.init(containerId),
        render: () => explorer.render(),
        setSearchTerm: (term) => {
          explorer.searchTerm = term;
          explorer.render();
        },
        expandPath: (path) => {
          explorer.expanded.add(path);
          explorer.render();
        },
        collapsePath: (path) => {
          explorer.expanded.delete(path);
          explorer.render();
        },
        selectFile: (path) => {
          explorer.selectedFile = path;
          explorer.showFileViewer(path);
        }
      },
      widget
    };
  }
};

// Export
export default VFSExplorer;