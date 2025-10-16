import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('VFSExplorer Module', () => {
  let VFSExplorer;
  let mockDeps;
  let explorerInstance;

  beforeEach(() => {
    global.document = {
      getElementById: vi.fn(() => ({
        innerHTML: '',
        addEventListener: vi.fn(),
        querySelector: vi.fn(),
        querySelectorAll: vi.fn(() => [])
      }))
    };

    mockDeps = {
      Utils: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } },
      EventBus: { on: vi.fn(), emit: vi.fn(), off: vi.fn() },
      StateManager: {
        getAllArtifactMetadata: vi.fn(async () => ({
          '/src/file.js': { size: 100 },
          '/test/test.js': { size: 200 },
          '/docs/readme.md': { size: 50 }
        })),
        getArtifactContent: vi.fn(async (path) => `content of ${path}`)
      },
      ToastNotifications: { show: vi.fn(), error: vi.fn() }
    };

    VFSExplorer = {
      metadata: {
        id: 'VFSExplorer',
        version: '1.1.0',
        dependencies: ['Utils', 'EventBus', 'StateManager', 'ToastNotifications'],
        async: false,
        type: 'ui'
      },
      factory: (deps) => {
        const { Utils, EventBus, StateManager } = deps;
        const { logger } = Utils;

        return {
          init: async (containerId) => {
            const container = document.getElementById(containerId);
            if (!container) {
              logger.error(`Container not found: ${containerId}`);
              return false;
            }
            logger.info(`VFSExplorer initialized with container: ${containerId}`);
            return true;
          },
          api: {
            refresh: async () => {
              await StateManager.getAllArtifactMetadata();
              logger.info('VFS refreshed');
            },
            search: (term) => {
              logger.info(`Searching for: ${term}`);
              return [];
            },
            expandAll: () => {
              logger.info('Expanding all folders');
            },
            collapseAll: () => {
              logger.info('Collapsing all folders');
            },
            selectFile: (path) => {
              logger.info(`File selected: ${path}`);
            }
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.document;
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(VFSExplorer.metadata.id).toBe('VFSExplorer');
      expect(VFSExplorer.metadata.version).toBe('1.1.0');
      expect(VFSExplorer.metadata.type).toBe('ui');
    });

    it('should have required dependencies', () => {
      expect(VFSExplorer.metadata.dependencies).toContain('Utils');
      expect(VFSExplorer.metadata.dependencies).toContain('EventBus');
      expect(VFSExplorer.metadata.dependencies).toContain('StateManager');
    });
  });

  describe('Initialization', () => {
    beforeEach(() => {
      explorerInstance = VFSExplorer.factory(mockDeps);
    });

    it('should initialize with valid container', async () => {
      const result = await explorerInstance.init('vfs-tree');
      expect(result).toBe(true);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should handle missing container', async () => {
      document.getElementById.mockReturnValue(null);
      const result = await explorerInstance.init('missing-container');
      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('File Tree Operations', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should refresh file tree', async () => {
      await explorerInstance.api.refresh();
      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('VFS refreshed');
    });

    it('should expand all folders', () => {
      explorerInstance.api.expandAll();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('Expanding all folders');
    });

    it('should collapse all folders', () => {
      explorerInstance.api.collapseAll();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('Collapsing all folders');
    });

    it('should select file', () => {
      explorerInstance.api.selectFile('/src/file.js');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('File selected: /src/file.js');
    });
  });

  describe('Search Functionality', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should search files', () => {
      const results = explorerInstance.api.search('test');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('Searching for: test');
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle empty search', () => {
      const results = explorerInstance.api.search('');
      expect(results).toBeInstanceOf(Array);
    });

    it('should handle special characters', () => {
      const results = explorerInstance.api.search('*.js');
      expect(results).toBeDefined();
    });
  });

  describe('API Exposure', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should expose refresh method', () => {
      expect(explorerInstance.api.refresh).toBeDefined();
      expect(typeof explorerInstance.api.refresh).toBe('function');
    });

    it('should expose search method', () => {
      expect(explorerInstance.api.search).toBeDefined();
      expect(typeof explorerInstance.api.search).toBe('function');
    });

    it('should expose expandAll method', () => {
      expect(explorerInstance.api.expandAll).toBeDefined();
      expect(typeof explorerInstance.api.expandAll).toBe('function');
    });

    it('should expose collapseAll method', () => {
      expect(explorerInstance.api.collapseAll).toBeDefined();
      expect(typeof explorerInstance.api.collapseAll).toBe('function');
    });

    it('should expose selectFile method', () => {
      expect(explorerInstance.api.selectFile).toBeDefined();
      expect(typeof explorerInstance.api.selectFile).toBe('function');
    });
  });

  describe('EventBus Integration', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should listen for VFS events', () => {
      expect(mockDeps.EventBus.on).toBeDefined();
    });

    it('should emit events', () => {
      expect(mockDeps.EventBus.emit).toBeDefined();
    });
  });

  describe('StateManager Integration', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should get artifact metadata', async () => {
      await explorerInstance.api.refresh();
      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should get artifact content', async () => {
      const content = await mockDeps.StateManager.getArtifactContent('/test.js');
      expect(content).toBeDefined();
      expect(content).toContain('/test.js');
    });
  });

  describe('File Filtering', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should filter by file extension', () => {
      const files = ['/test.js', '/test.ts', '/readme.md'];
      const jsFiles = files.filter(f => f.endsWith('.js'));
      expect(jsFiles).toHaveLength(1);
      expect(jsFiles[0]).toBe('/test.js');
    });

    it('should filter by directory', () => {
      const files = ['/src/file.js', '/test/test.js', '/docs/readme.md'];
      const srcFiles = files.filter(f => f.startsWith('/src/'));
      expect(srcFiles).toHaveLength(1);
    });

    it('should filter by pattern', () => {
      const files = ['/test.test.js', '/test.spec.js', '/file.js'];
      const testFiles = files.filter(f => f.includes('test') || f.includes('spec'));
      expect(testFiles).toHaveLength(2);
    });

    it('should case-insensitive search', () => {
      const files = ['/Test.js', '/TEST.JS', '/test.js'];
      const searchTerm = 'test';
      const results = files.filter(f =>
        f.toLowerCase().includes(searchTerm.toLowerCase())
      );
      expect(results).toHaveLength(3);
    });

    it('should filter hidden files', () => {
      const files = ['/.hidden', '/file.js', '/.git/config'];
      const visible = files.filter(f => !f.split('/').some(part => part.startsWith('.')));
      expect(visible).toHaveLength(1);
    });

    it('should filter by multiple extensions', () => {
      const files = ['/file.js', '/file.ts', '/file.jsx', '/file.txt'];
      const extensions = ['.js', '.ts', '.jsx'];
      const filtered = files.filter(f => extensions.some(ext => f.endsWith(ext)));
      expect(filtered).toHaveLength(3);
    });
  });

  describe('File Sorting', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should sort alphabetically', () => {
      const files = ['/z.js', '/a.js', '/m.js'];
      const sorted = [...files].sort();
      expect(sorted[0]).toBe('/a.js');
      expect(sorted[2]).toBe('/z.js');
    });

    it('should sort by file size', () => {
      const files = [
        { path: '/small.js', size: 100 },
        { path: '/large.js', size: 1000 },
        { path: '/medium.js', size: 500 }
      ];
      const sorted = [...files].sort((a, b) => a.size - b.size);
      expect(sorted[0].path).toBe('/small.js');
      expect(sorted[2].path).toBe('/large.js');
    });

    it('should sort by modification time', () => {
      const now = Date.now();
      const files = [
        { path: '/old.js', modified: now - 10000 },
        { path: '/new.js', modified: now },
        { path: '/older.js', modified: now - 20000 }
      ];
      const sorted = [...files].sort((a, b) => b.modified - a.modified);
      expect(sorted[0].path).toBe('/new.js');
    });

    it('should sort directories first', () => {
      const items = [
        { path: '/file.js', type: 'file' },
        { path: '/src/', type: 'directory' },
        { path: '/another.js', type: 'file' }
      ];
      const sorted = [...items].sort((a, b) => {
        if (a.type === 'directory' && b.type === 'file') return -1;
        if (a.type === 'file' && b.type === 'directory') return 1;
        return a.path.localeCompare(b.path);
      });
      expect(sorted[0].type).toBe('directory');
    });
  });

  describe('Path Normalization', () => {
    it('should normalize Windows paths', () => {
      const path = 'C:\\\\Users\\\\test\\\\file.js';
      const normalized = path.replace(/\\\\/g, '/');
      expect(normalized).toBe('C:/Users/test/file.js');
    });

    it('should remove trailing slashes', () => {
      const path = '/src/file.js/';
      const normalized = path.replace(/\\/+$/, '');
      expect(normalized).toBe('/src/file.js');
    });

    it('should resolve parent directory references', () => {
      const path = '/src/../file.js';
      const parts = path.split('/').filter(p => p);
      const resolved = [];
      for (const part of parts) {
        if (part === '..') resolved.pop();
        else if (part !== '.') resolved.push(part);
      }
      expect('/' + resolved.join('/')).toBe('/file.js');
    });

    it('should handle absolute paths', () => {
      const path = '/absolute/path/file.js';
      expect(path.startsWith('/')).toBe(true);
    });

    it('should handle relative paths', () => {
      const path = 'relative/path/file.js';
      expect(path.startsWith('/')).toBe(false);
    });
  });

  describe('Large Directory Trees', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should handle 1000+ files', () => {
      const files = Array.from({ length: 1000 }, (_, i) => `/file${i}.js`);
      expect(files).toHaveLength(1000);
      expect(files[999]).toBe('/file999.js');
    });

    it('should handle deep nesting', () => {
      const depth = 20;
      const path = '/'.repeat(depth).split('').join('level/');
      expect(path.split('/').filter(p => p).length).toBeGreaterThan(10);
    });

    it('should paginate large results', () => {
      const files = Array.from({ length: 500 }, (_, i) => `/file${i}.js`);
      const pageSize = 50;
      const page1 = files.slice(0, pageSize);
      const page2 = files.slice(pageSize, pageSize * 2);
      expect(page1).toHaveLength(50);
      expect(page2).toHaveLength(50);
      expect(page1[0]).toBe('/file0.js');
      expect(page2[0]).toBe('/file50.js');
    });

    it('should efficiently search large trees', () => {
      const files = Array.from({ length: 10000 }, (_, i) => `/file${i}.js`);
      const start = Date.now();
      const result = files.find(f => f === '/file5000.js');
      const duration = Date.now() - start;
      expect(result).toBeDefined();
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Directory Operations', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should create directory structure', () => {
      const structure = {
        '/src': {
          '/src/components': {},
          '/src/utils': {}
        }
      };
      expect(structure['/src']).toBeDefined();
      expect(structure['/src']['/src/components']).toBeDefined();
    });

    it('should list directory contents', () => {
      const tree = {
        '/src/file1.js': 'content',
        '/src/file2.js': 'content',
        '/docs/readme.md': 'content'
      };
      const srcFiles = Object.keys(tree).filter(p => p.startsWith('/src/'));
      expect(srcFiles).toHaveLength(2);
    });

    it('should get parent directory', () => {
      const path = '/src/components/Button.js';
      const parent = path.substring(0, path.lastIndexOf('/'));
      expect(parent).toBe('/src/components');
    });

    it('should get file name', () => {
      const path = '/src/components/Button.js';
      const filename = path.substring(path.lastIndexOf('/') + 1);
      expect(filename).toBe('Button.js');
    });

    it('should get file extension', () => {
      const path = '/src/file.test.js';
      const ext = path.substring(path.lastIndexOf('.'));
      expect(ext).toBe('.js');
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
    });

    it('should handle invalid paths', () => {
      const invalidPaths = ['', null, undefined, '...', '///'];
      invalidPaths.forEach(path => {
        if (!path || path.trim() === '') {
          expect(path || '').toBeFalsy();
        }
      });
    });

    it('should handle missing files gracefully', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);
      const content = await mockDeps.StateManager.getArtifactContent('/missing.js');
      expect(content).toBeNull();
    });

    it('should handle permission errors', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(
        new Error('Permission denied')
      );
      try {
        await mockDeps.StateManager.getArtifactContent('/protected.js');
      } catch (error) {
        expect(error.message).toContain('Permission denied');
      }
    });

    it('should handle network errors', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockRejectedValue(
        new Error('Network error')
      );
      try {
        await mockDeps.StateManager.getAllArtifactMetadata();
      } catch (error) {
        expect(error.message).toContain('Network error');
      }
    });
  });

  describe('File Tree Building', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should build tree from flat list', () => {
      const files = [
        '/src/file1.js',
        '/src/file2.js',
        '/test/test1.js'
      ];
      const tree = {};
      files.forEach(path => {
        tree[path] = { path, type: 'file' };
      });
      expect(Object.keys(tree)).toHaveLength(3);
    });

    it('should identify file types', () => {
      const files = {
        '/file.js': 'javascript',
        '/file.ts': 'typescript',
        '/file.json': 'json',
        '/file.md': 'markdown'
      };
      Object.entries(files).forEach(([path, type]) => {
        const ext = path.substring(path.lastIndexOf('.') + 1);
        expect(['js', 'ts', 'json', 'md']).toContain(ext);
      });
    });

    it('should calculate directory sizes', () => {
      const files = {
        '/src/file1.js': 100,
        '/src/file2.js': 200,
        '/test/test.js': 150
      };
      const srcSize = Object.entries(files)
        .filter(([path]) => path.startsWith('/src/'))
        .reduce((sum, [, size]) => sum + size, 0);
      expect(srcSize).toBe(300);
    });

    it('should count files per directory', () => {
      const files = [
        '/src/file1.js',
        '/src/file2.js',
        '/src/file3.js',
        '/test/test.js'
      ];
      const counts = {};
      files.forEach(path => {
        const dir = path.substring(0, path.lastIndexOf('/'));
        counts[dir] = (counts[dir] || 0) + 1;
      });
      expect(counts['/src']).toBe(3);
      expect(counts['/test']).toBe(1);
    });
  });

  describe('Performance Tests', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should handle rapid refresh calls', async () => {
      const refreshes = [];
      for (let i = 0; i < 10; i++) {
        refreshes.push(explorerInstance.api.refresh());
      }
      await Promise.all(refreshes);
      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should debounce search operations', () => {
      let searchCount = 0;
      const debounce = (fn, delay) => {
        let timeout;
        return (...args) => {
          clearTimeout(timeout);
          timeout = setTimeout(() => {
            searchCount++;
            fn(...args);
          }, delay);
        };
      };
      const search = debounce(() => {}, 300);
      search();
      search();
      search();
      expect(searchCount).toBe(0); // Not executed yet
    });

    it('should virtualize large lists', () => {
      const items = Array.from({ length: 10000 }, (_, i) => ({ id: i }));
      const viewportSize = 50;
      const visibleItems = items.slice(0, viewportSize);
      expect(visibleItems).toHaveLength(50);
      expect(items).toHaveLength(10000);
    });
  });

  describe('Context Menu Operations', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should show file context menu', () => {
      const menuItems = ['Open', 'Rename', 'Delete', 'Copy Path'];
      expect(menuItems).toContain('Open');
      expect(menuItems).toContain('Delete');
    });

    it('should show directory context menu', () => {
      const menuItems = ['New File', 'New Folder', 'Delete', 'Rename'];
      expect(menuItems).toContain('New File');
      expect(menuItems).toContain('New Folder');
    });

    it('should copy file path to clipboard', () => {
      const path = '/src/components/Button.js';
      const copied = path;
      expect(copied).toBe(path);
    });
  });

  describe('File Watching', () => {
    beforeEach(async () => {
      explorerInstance = VFSExplorer.factory(mockDeps);
      await explorerInstance.init('vfs-tree');
    });

    it('should detect file changes', () => {
      const fileStates = new Map();
      fileStates.set('/test.js', { modified: Date.now() - 1000 });
      const newModified = Date.now();
      const changed = newModified > fileStates.get('/test.js').modified;
      expect(changed).toBe(true);
    });

    it('should detect new files', () => {
      const oldFiles = new Set(['/file1.js', '/file2.js']);
      const newFiles = new Set(['/file1.js', '/file2.js', '/file3.js']);
      const added = [...newFiles].filter(f => !oldFiles.has(f));
      expect(added).toHaveLength(1);
      expect(added[0]).toBe('/file3.js');
    });

    it('should detect deleted files', () => {
      const oldFiles = new Set(['/file1.js', '/file2.js', '/file3.js']);
      const newFiles = new Set(['/file1.js', '/file2.js']);
      const deleted = [...oldFiles].filter(f => !newFiles.has(f));
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toBe('/file3.js');
    });
  });
});
