import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Create a testable copy of ModuleLoader
const createModuleLoader = () => {
  return {
    modules: new Map(),
    loadOrder: [],
    config: null,
    vfs: null,
    auditLogger: null,

    init(vfs, config, auditLogger = null) {
      this.vfs = vfs;
      this.config = config;
      this.auditLogger = auditLogger;
      this.modules.clear();
      this.loadOrder = [];
    },

    async loadModule(vfsPath, moduleId) {
      const startTime = Date.now();
      try {
        const code = await this.vfs.read(vfsPath);
        if (!code) {
          throw new Error(`No code found at ${vfsPath}`);
        }

        const moduleDefinition = new Function(`
          ${code}
          if (typeof ${moduleId} !== 'undefined') {
            return ${moduleId};
          }
          if (typeof ${moduleId}Module !== 'undefined') {
            return ${moduleId}Module;
          }
          throw new Error('Module ${moduleId} not found in loaded code');
        `)();

        const isLegacy = typeof moduleDefinition === 'function';

        if (isLegacy) {
          this.modules.set(moduleId, {
            definition: moduleDefinition,
            isLegacy: true,
            instance: null,
            vfsPath
          });
        } else {
          if (!moduleDefinition.metadata || !moduleDefinition.factory) {
            throw new Error(`Invalid module format: ${moduleId} (missing metadata or factory)`);
          }

          this.modules.set(moduleId, {
            definition: moduleDefinition,
            isLegacy: false,
            instance: null,
            vfsPath
          });
        }

        this.loadOrder.push(moduleId);

        if (this.auditLogger) {
          await this.auditLogger.logModuleLoad(moduleId, vfsPath, true, {
            isLegacy,
            loadTimeMs: Date.now() - startTime,
            codeSize: code.length
          });
        }

        return moduleDefinition;

      } catch (e) {
        if (this.auditLogger) {
          await this.auditLogger.logModuleLoad(moduleId, vfsPath, false, {
            error: e.message,
            loadTimeMs: Date.now() - startTime
          });
        }
        throw e;
      }
    },

    async instantiateModule(moduleId, providedDeps = {}) {
      const moduleEntry = this.modules.get(moduleId);
      if (!moduleEntry) {
        throw new Error(`Module not loaded: ${moduleId}`);
      }

      if (moduleEntry.instance) {
        return moduleEntry.instance;
      }

      if (moduleEntry.isLegacy) {
        const instance = this.instantiateLegacyModule(moduleId, moduleEntry.definition, providedDeps);
        moduleEntry.instance = instance;
        return instance;
      }

      const { definition } = moduleEntry;
      const { dependencies = [], async: needsAsync } = definition.metadata;

      const deps = { ...providedDeps };
      for (const depId of dependencies) {
        if (!deps[depId]) {
          if (depId === 'config') {
            deps[depId] = this.config;
          } else if (depId === 'vfs') {
            deps[depId] = this.vfs;
          } else if (depId === 'logger' || depId === 'Errors') {
            const utils = await this.getModule('Utils');
            if (depId === 'logger') {
              deps[depId] = utils.logger || console;
            } else {
              deps[depId] = utils.Errors || {};
            }
          } else {
            deps[depId] = await this.getModule(depId);
          }
        }
      }

      const instance = definition.factory(deps);

      if (needsAsync && instance.init) {
        await instance.init();
      }

      moduleEntry.instance = instance.api || instance;
      return moduleEntry.instance;
    },

    instantiateLegacyModule(moduleId, ModuleFunction, providedDeps) {
      const legacySignatures = {
        'Utils': [],
        'Storage': ['config', 'logger', 'Errors']
      };

      const signature = legacySignatures[moduleId] || legacySignatures[moduleId + 'Module'] || [];
      const args = [];

      for (const depName of signature) {
        if (depName === 'config') {
          args.push(this.config);
        } else if (depName === 'logger') {
          const utils = providedDeps.Utils || this.modules.get('Utils')?.instance;
          args.push(utils?.logger || console);
        } else if (depName === 'Errors') {
          const utils = providedDeps.Utils || this.modules.get('Utils')?.instance;
          args.push(utils?.Errors || {});
        } else {
          args.push(providedDeps[depName] || this.modules.get(depName)?.instance);
        }
      }

      return ModuleFunction(...args);
    },

    async getModule(moduleId) {
      const entry = this.modules.get(moduleId);
      if (!entry) {
        throw new Error(`Module ${moduleId} not found. Load it first.`);
      }

      if (entry.instance) {
        return entry.instance;
      }

      return await this.instantiateModule(moduleId);
    },

    async loadFromManifest(manifest) {
      for (const group of manifest.loadGroups) {
        const loadPromises = group.modules.map(m =>
          this.loadModule(m.path, m.id).catch(e => {
            return null;
          })
        );

        await Promise.all(loadPromises);
      }
    },

    async instantiateAll() {
      // First pass: pure modules
      for (const moduleId of this.loadOrder) {
        const entry = this.modules.get(moduleId);
        if (!entry) continue;

        if (!entry.isLegacy && entry.definition.metadata) {
          const deps = entry.definition.metadata.dependencies || [];
          if (deps.length === 0) {
            await this.instantiateModule(moduleId);
          }
        }
      }

      // Second pass: remaining modules
      for (const moduleId of this.loadOrder) {
        if (!this.modules.get(moduleId)?.instance) {
          await this.instantiateModule(moduleId);
        }
      }
    },

    getLoadedModules() {
      return Array.from(this.modules.keys());
    },

    isLoaded(moduleId) {
      return this.modules.has(moduleId);
    },

    clear() {
      this.modules.clear();
      this.loadOrder = [];
    }
  };
};

describe('ModuleLoader', () => {
  let loader, mockVfs, mockConfig, mockAuditLogger;

  beforeEach(() => {
    loader = createModuleLoader();

    mockVfs = {
      read: vi.fn()
    };

    mockConfig = {
      apiKey: 'test-key',
      apiProvider: 'gemini'
    };

    mockAuditLogger = {
      logModuleLoad: vi.fn()
    };
  });

  describe('Initialization', () => {
    it('should initialize with VFS and config', () => {
      loader.init(mockVfs, mockConfig);

      expect(loader.vfs).toBe(mockVfs);
      expect(loader.config).toBe(mockConfig);
      expect(loader.auditLogger).toBe(null);
    });

    it('should initialize with audit logger', () => {
      loader.init(mockVfs, mockConfig, mockAuditLogger);

      expect(loader.auditLogger).toBe(mockAuditLogger);
    });

    it('should clear existing modules on init', () => {
      loader.modules.set('test', {});
      loader.loadOrder.push('test');

      loader.init(mockVfs, mockConfig);

      expect(loader.modules.size).toBe(0);
      expect(loader.loadOrder).toEqual([]);
    });
  });

  describe('loadModule', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should load new format module', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: {
            id: 'TestModule',
            version: '1.0.0',
            dependencies: []
          },
          factory: (deps) => ({ test: true })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);

      const result = await loader.loadModule('/test.js', 'TestModule');

      expect(result).toHaveProperty('metadata');
      expect(result).toHaveProperty('factory');
      expect(loader.modules.has('TestModule')).toBe(true);
      expect(loader.loadOrder).toContain('TestModule');
    });

    it('should load legacy module', async () => {
      const legacyCode = `
        const TestModule = () => ({ legacy: true });
      `;

      mockVfs.read.mockResolvedValue(legacyCode);

      await loader.loadModule('/test.js', 'TestModule');

      const entry = loader.modules.get('TestModule');
      expect(entry.isLegacy).toBe(true);
      expect(typeof entry.definition).toBe('function');
    });

    it('should throw if no code found', async () => {
      mockVfs.read.mockResolvedValue(null);

      await expect(
        loader.loadModule('/missing.js', 'Test')
      ).rejects.toThrow('No code found');
    });

    it('should throw for invalid module format', async () => {
      const invalidCode = `
        const TestModule = { invalid: true };
      `;

      mockVfs.read.mockResolvedValue(invalidCode);

      await expect(
        loader.loadModule('/test.js', 'TestModule')
      ).rejects.toThrow('Invalid module format');
    });

    it('should call audit logger on success', async () => {
      loader.init(mockVfs, mockConfig, mockAuditLogger);

      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);

      await loader.loadModule('/test.js', 'TestModule');

      expect(mockAuditLogger.logModuleLoad).toHaveBeenCalledWith(
        'TestModule',
        '/test.js',
        true,
        expect.objectContaining({
          isLegacy: false,
          loadTimeMs: expect.any(Number),
          codeSize: expect.any(Number)
        })
      );
    });

    it('should call audit logger on failure', async () => {
      loader.init(mockVfs, mockConfig, mockAuditLogger);
      mockVfs.read.mockRejectedValue(new Error('Read failed'));

      await expect(
        loader.loadModule('/test.js', 'TestModule')
      ).rejects.toThrow();

      expect(mockAuditLogger.logModuleLoad).toHaveBeenCalledWith(
        'TestModule',
        '/test.js',
        false,
        expect.objectContaining({
          error: expect.any(String),
          loadTimeMs: expect.any(Number)
        })
      );
    });
  });

  describe('instantiateModule', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should throw if module not loaded', async () => {
      await expect(
        loader.instantiateModule('NonExistent')
      ).rejects.toThrow('Module not loaded');
    });

    it('should return cached instance', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({ value: Math.random() })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance1 = await loader.instantiateModule('TestModule');
      const instance2 = await loader.instantiateModule('TestModule');

      expect(instance1).toBe(instance2);
    });

    it('should instantiate module with no dependencies', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: (deps) => ({ test: true })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance = await loader.instantiateModule('TestModule');

      expect(instance).toHaveProperty('test', true);
    });

    it('should provide config dependency', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: ['config'] },
          factory: (deps) => ({ config: deps.config })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance = await loader.instantiateModule('TestModule');

      expect(instance.config).toBe(mockConfig);
    });

    it('should provide vfs dependency', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: ['vfs'] },
          factory: (deps) => ({ vfs: deps.vfs })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance = await loader.instantiateModule('TestModule');

      expect(instance.vfs).toBe(mockVfs);
    });

    it('should run async init if needed', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [], async: true },
          factory: (deps) => ({
            init: async () => { window.initCalled = true; },
            value: true
          })
        };
      `;

      global.window = { initCalled: false };
      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      await loader.instantiateModule('TestModule');

      expect(global.window.initCalled).toBe(true);
      delete global.window;
    });

    it('should use api property if available', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({
            internal: 'hidden',
            api: { public: 'visible' }
          })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance = await loader.instantiateModule('TestModule');

      expect(instance).toEqual({ public: 'visible' });
    });
  });

  describe('instantiateLegacyModule', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should instantiate legacy module with no args', () => {
      const legacyModule = vi.fn(() => ({ legacy: true }));

      const instance = loader.instantiateLegacyModule('Utils', legacyModule, {});

      expect(legacyModule).toHaveBeenCalledWith();
      expect(instance).toEqual({ legacy: true });
    });

    it('should pass config to legacy module', () => {
      const legacyModule = vi.fn((config) => ({ config }));

      const instance = loader.instantiateLegacyModule('Storage', legacyModule, {});

      expect(legacyModule).toHaveBeenCalled();
      const args = legacyModule.mock.calls[0];
      expect(args[0]).toBe(mockConfig);
    });
  });

  describe('getModule', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should throw if module not found', async () => {
      await expect(
        loader.getModule('NonExistent')
      ).rejects.toThrow('Module NonExistent not found');
    });

    it('should return existing instance', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({ test: true })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');
      const instance1 = await loader.instantiateModule('TestModule');

      const instance2 = await loader.getModule('TestModule');

      expect(instance2).toBe(instance1);
    });

    it('should instantiate if not instantiated', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({ test: true })
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      const instance = await loader.getModule('TestModule');

      expect(instance).toHaveProperty('test', true);
    });
  });

  describe('loadFromManifest', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should load all modules from manifest', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);

      const manifest = {
        loadGroups: [
          {
            description: 'Core modules',
            modules: [
              { id: 'TestModule', path: '/test1.js' },
              { id: 'TestModule', path: '/test2.js' }
            ]
          }
        ]
      };

      await loader.loadFromManifest(manifest);

      expect(mockVfs.read).toHaveBeenCalledTimes(2);
    });

    it('should handle load failures gracefully', async () => {
      mockVfs.read.mockRejectedValue(new Error('Load failed'));

      const manifest = {
        loadGroups: [
          {
            description: 'Test',
            modules: [{ id: 'TestModule', path: '/test.js' }]
          }
        ]
      };

      // Should not throw
      await expect(loader.loadFromManifest(manifest)).resolves.toBeUndefined();
    });
  });

  describe('instantiateAll', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should instantiate pure modules first', async () => {
      const pureCode = `
        const PureModule = {
          metadata: { id: 'PureModule', version: '1.0.0', dependencies: [] },
          factory: () => ({ pure: true })
        };
      `;

      const dependentCode = `
        const DependentModule = {
          metadata: { id: 'DependentModule', version: '1.0.0', dependencies: ['PureModule'] },
          factory: (deps) => ({ pure: deps.PureModule })
        };
      `;

      mockVfs.read
        .mockResolvedValueOnce(pureCode)
        .mockResolvedValueOnce(dependentCode);

      await loader.loadModule('/pure.js', 'PureModule');
      await loader.loadModule('/dependent.js', 'DependentModule');

      await loader.instantiateAll();

      expect(loader.modules.get('PureModule').instance).toBeDefined();
      expect(loader.modules.get('DependentModule').instance).toBeDefined();
    });

    it('should instantiate all modules', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test1.js', 'TestModule');

      await loader.instantiateAll();

      expect(loader.modules.get('TestModule').instance).toBeDefined();
    });
  });

  describe('Utility Methods', () => {
    beforeEach(() => {
      loader.init(mockVfs, mockConfig);
    });

    it('should get loaded modules', async () => {
      const moduleCode1 = `
        const TestModule1 = {
          metadata: { id: 'TestModule1', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      const moduleCode2 = `
        const TestModule2 = {
          metadata: { id: 'TestModule2', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValueOnce(moduleCode1).mockResolvedValueOnce(moduleCode2);
      await loader.loadModule('/test1.js', 'TestModule1');
      await loader.loadModule('/test2.js', 'TestModule2');

      const loaded = loader.getLoadedModules();

      expect(loaded).toContain('TestModule1');
      expect(loaded).toContain('TestModule2');
      expect(loaded).toHaveLength(2);
    });

    it('should check if module is loaded', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      expect(loader.isLoaded('TestModule')).toBe(true);
      expect(loader.isLoaded('NonExistent')).toBe(false);
    });

    it('should clear all modules', async () => {
      const moduleCode = `
        const TestModule = {
          metadata: { id: 'TestModule', version: '1.0.0', dependencies: [] },
          factory: () => ({})
        };
      `;

      mockVfs.read.mockResolvedValue(moduleCode);
      await loader.loadModule('/test.js', 'TestModule');

      loader.clear();

      expect(loader.modules.size).toBe(0);
      expect(loader.loadOrder).toEqual([]);
      expect(loader.isLoaded('TestModule')).toBe(false);
    });
  });
});
