import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('DIContainer Module', () => {
  let DIContainer;
  let mockDeps;
  let containerInstance;

  beforeEach(() => {
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn(),
          debug: vi.fn()
        }
      }
    };

    DIContainer = {
      metadata: {
        id: 'DIContainer',
        version: '1.0.0',
        dependencies: ['Utils'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { Utils } = deps;
        const { logger } = Utils;
        const _services = new Map();
        const _singletons = new Map();

        const register = (module) => {
          if (!module || !module.metadata || !module.metadata.id) {
            logger.error('[DIContainer] Invalid module registration attempt.');
            return;
          }
          logger.info(`[DIContainer] Registered module: ${module.metadata.id}`);
          _services.set(module.metadata.id, module);
        };

        const resolve = async (id) => {
          if (_singletons.has(id)) {
            return _singletons.get(id);
          }

          const module = _services.get(id);
          if (!module) {
            const available = Array.from(_services.keys()).join(', ');
            throw new Error(`[DIContainer] Service not found: ${id}\nAvailable services: ${available || 'none'}`);
          }

          const dependencies = {};
          if (module.metadata.dependencies) {
            for (const depId of module.metadata.dependencies) {
              try {
                dependencies[depId] = await resolve(depId);
              } catch (err) {
                throw new Error(`[DIContainer] Failed to resolve dependency '${depId}' for module '${id}'.`);
              }
            }
          }

          logger.debug(`[DIContainer] Creating instance of: ${id}`);
          const instance = module.factory(dependencies);

          if (module.metadata.async && typeof instance.init === 'function') {
            await instance.init();
          }

          const publicApi = (module.metadata.type === 'pure') ? instance : instance.api;
          _singletons.set(id, publicApi);
          return publicApi;
        };

        return { register, resolve };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(DIContainer.metadata.id).toBe('DIContainer');
      expect(DIContainer.metadata.version).toBe('1.0.0');
      expect(DIContainer.metadata.type).toBe('service');
    });

    it('should have required dependencies', () => {
      expect(DIContainer.metadata.dependencies).toContain('Utils');
    });

    it('should not be async', () => {
      expect(DIContainer.metadata.async).toBe(false);
    });
  });

  describe('Container Initialization', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should create container instance', () => {
      expect(containerInstance).toBeDefined();
      expect(containerInstance.register).toBeDefined();
      expect(containerInstance.resolve).toBeDefined();
    });

    it('should have register method', () => {
      expect(typeof containerInstance.register).toBe('function');
    });

    it('should have resolve method', () => {
      expect(typeof containerInstance.resolve).toBe('function');
    });
  });

  describe('Module Registration', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should register valid module', () => {
      const module = {
        metadata: { id: 'TestModule', version: '1.0.0' },
        factory: () => ({ api: {} })
      };
      containerInstance.register(module);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[DIContainer] Registered module: TestModule');
    });

    it('should reject module without metadata', () => {
      containerInstance.register({});
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should reject module without id', () => {
      containerInstance.register({ metadata: {} });
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should reject null module', () => {
      containerInstance.register(null);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should register multiple modules', () => {
      const module1 = {
        metadata: { id: 'Module1', version: '1.0.0' },
        factory: () => ({ api: {} })
      };
      const module2 = {
        metadata: { id: 'Module2', version: '1.0.0' },
        factory: () => ({ api: {} })
      };
      containerInstance.register(module1);
      containerInstance.register(module2);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('Module Resolution', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should resolve registered module', async () => {
      const module = {
        metadata: { id: 'TestModule', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { test: () => 'hello' } })
      };
      containerInstance.register(module);
      const resolved = await containerInstance.resolve('TestModule');
      expect(resolved).toBeDefined();
      expect(resolved.test()).toBe('hello');
    });

    it('should throw error for unregistered module', async () => {
      await expect(containerInstance.resolve('NonExistent')).rejects.toThrow('Service not found');
    });

    it('should return singleton on multiple resolves', async () => {
      const module = {
        metadata: { id: 'Singleton', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { id: Math.random() } })
      };
      containerInstance.register(module);
      const first = await containerInstance.resolve('Singleton');
      const second = await containerInstance.resolve('Singleton');
      expect(first.id).toBe(second.id);
    });

    it('should log debug message when creating instance', async () => {
      const module = {
        metadata: { id: 'Debug', version: '1.0.0', type: 'service' },
        factory: () => ({ api: {} })
      };
      containerInstance.register(module);
      await containerInstance.resolve('Debug');
      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith('[DIContainer] Creating instance of: Debug');
    });
  });

  describe('Dependency Resolution', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should resolve module with dependencies', async () => {
      const depModule = {
        metadata: { id: 'Dependency', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { getValue: () => 42 } })
      };
      const mainModule = {
        metadata: { id: 'Main', version: '1.0.0', dependencies: ['Dependency'], type: 'service' },
        factory: (deps) => ({ api: { getDepValue: () => deps.Dependency.getValue() } })
      };

      containerInstance.register(depModule);
      containerInstance.register(mainModule);

      const resolved = await containerInstance.resolve('Main');
      expect(resolved.getDepValue()).toBe(42);
    });

    it('should throw error for missing dependency', async () => {
      const module = {
        metadata: { id: 'NeedsDep', version: '1.0.0', dependencies: ['Missing'], type: 'service' },
        factory: () => ({ api: {} })
      };
      containerInstance.register(module);
      await expect(containerInstance.resolve('NeedsDep')).rejects.toThrow('Failed to resolve dependency');
    });

    it('should resolve multiple dependencies', async () => {
      const dep1 = {
        metadata: { id: 'Dep1', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { value: 1 } })
      };
      const dep2 = {
        metadata: { id: 'Dep2', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { value: 2 } })
      };
      const main = {
        metadata: { id: 'Main', version: '1.0.0', dependencies: ['Dep1', 'Dep2'], type: 'service' },
        factory: (deps) => ({ api: { sum: () => deps.Dep1.value + deps.Dep2.value } })
      };

      containerInstance.register(dep1);
      containerInstance.register(dep2);
      containerInstance.register(main);

      const resolved = await containerInstance.resolve('Main');
      expect(resolved.sum()).toBe(3);
    });

    it('should resolve transitive dependencies', async () => {
      const base = {
        metadata: { id: 'Base', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { value: 10 } })
      };
      const middle = {
        metadata: { id: 'Middle', version: '1.0.0', dependencies: ['Base'], type: 'service' },
        factory: (deps) => ({ api: { value: deps.Base.value * 2 } })
      };
      const top = {
        metadata: { id: 'Top', version: '1.0.0', dependencies: ['Middle'], type: 'service' },
        factory: (deps) => ({ api: { value: deps.Middle.value + 5 } })
      };

      containerInstance.register(base);
      containerInstance.register(middle);
      containerInstance.register(top);

      const resolved = await containerInstance.resolve('Top');
      expect(resolved.value).toBe(25);
    });
  });

  describe('Async Module Initialization', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should handle async module initialization', async () => {
      const asyncModule = {
        metadata: { id: 'AsyncModule', version: '1.0.0', async: true, type: 'service' },
        factory: () => ({
          init: async () => {
            return new Promise(resolve => setTimeout(resolve, 10));
          },
          api: { ready: true }
        })
      };
      containerInstance.register(asyncModule);
      const resolved = await containerInstance.resolve('AsyncModule');
      expect(resolved.ready).toBe(true);
    });

    it('should not call init for non-async modules', async () => {
      const initSpy = vi.fn();
      const syncModule = {
        metadata: { id: 'SyncModule', version: '1.0.0', async: false, type: 'service' },
        factory: () => ({
          init: initSpy,
          api: {}
        })
      };
      containerInstance.register(syncModule);
      await containerInstance.resolve('SyncModule');
      expect(initSpy).not.toHaveBeenCalled();
    });

    it('should call init for async modules', async () => {
      const initSpy = vi.fn(async () => {});
      const asyncModule = {
        metadata: { id: 'InitModule', version: '1.0.0', async: true, type: 'service' },
        factory: () => ({
          init: initSpy,
          api: {}
        })
      };
      containerInstance.register(asyncModule);
      await containerInstance.resolve('InitModule');
      expect(initSpy).toHaveBeenCalled();
    });
  });

  describe('Module Types', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should handle pure module type', async () => {
      const pureModule = {
        metadata: { id: 'Pure', version: '1.0.0', type: 'pure' },
        factory: () => ({ add: (a, b) => a + b })
      };
      containerInstance.register(pureModule);
      const resolved = await containerInstance.resolve('Pure');
      expect(resolved.add(2, 3)).toBe(5);
    });

    it('should handle service module type', async () => {
      const serviceModule = {
        metadata: { id: 'Service', version: '1.0.0', type: 'service' },
        factory: () => ({ api: { test: () => 'service' } })
      };
      containerInstance.register(serviceModule);
      const resolved = await containerInstance.resolve('Service');
      expect(resolved.test()).toBe('service');
    });

    it('should handle ui module type', async () => {
      const uiModule = {
        metadata: { id: 'UI', version: '1.0.0', type: 'ui' },
        factory: () => ({ api: { render: () => 'rendered' } })
      };
      containerInstance.register(uiModule);
      const resolved = await containerInstance.resolve('UI');
      expect(resolved.render()).toBe('rendered');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should provide helpful error for missing service', async () => {
      containerInstance.register({
        metadata: { id: 'Available', version: '1.0.0' },
        factory: () => ({ api: {} })
      });

      try {
        await containerInstance.resolve('Missing');
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('Service not found');
        expect(error.message).toContain('Available services');
      }
    });

    it('should provide dependency chain in error', async () => {
      const module = {
        metadata: { id: 'Parent', version: '1.0.0', dependencies: ['Child'], type: 'service' },
        factory: () => ({ api: {} })
      };
      containerInstance.register(module);

      try {
        await containerInstance.resolve('Parent');
        fail('Should have thrown error');
      } catch (error) {
        expect(error.message).toContain('Failed to resolve dependency');
        expect(error.message).toContain('Child');
        expect(error.message).toContain('Parent');
      }
    });

    it('should handle factory errors gracefully', async () => {
      const brokenModule = {
        metadata: { id: 'Broken', version: '1.0.0', type: 'service' },
        factory: () => {
          throw new Error('Factory failed');
        }
      };
      containerInstance.register(brokenModule);
      await expect(containerInstance.resolve('Broken')).rejects.toThrow('Factory failed');
    });
  });

  describe('API Exposure', () => {
    beforeEach(() => {
      containerInstance = DIContainer.factory(mockDeps);
    });

    it('should expose register method', () => {
      expect(containerInstance.register).toBeDefined();
      expect(typeof containerInstance.register).toBe('function');
    });

    it('should expose resolve method', () => {
      expect(containerInstance.resolve).toBeDefined();
      expect(typeof containerInstance.resolve).toBe('function');
    });
  });
});
