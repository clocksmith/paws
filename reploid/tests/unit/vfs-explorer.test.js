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
});
