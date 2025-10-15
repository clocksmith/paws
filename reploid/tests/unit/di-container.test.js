import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('DIContainer Module', () => {
  let DIContainer;
  let mockDeps;
  let container;

  beforeEach(() => {
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
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
            logger.error(
              '[DIContainer] Invalid module registration attempt.\n' +
              'Modules must have structure: { metadata: { id: "ModuleName", ... }, factory: (deps) => {...} }\n' +
              `Received: ${JSON.stringify(module?.metadata || 'undefined')}`
            );
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
            throw new Error(
              `[DIContainer] Service not found: ${id}\n` +
              `Available services: ${available || 'none'}\n` +
              `Tip: Check module ID spelling and ensure the module is registered in config.json`
            );
          }

          const dependencies = {};
          if (module.metadata.dependencies) {
            for (const depId of module.metadata.dependencies) {
              try {
                dependencies[depId] = await resolve(depId);
              } catch (err) {
                throw new Error(
                  `[DIContainer] Failed to resolve dependency '${depId}' for module '${id}'.\n` +
                  `Dependency chain: ${id} → ${depId}\n` +
                  `Original error: ${err.message}\n` +
                  `Check for circular dependencies or missing module registrations.`
                );
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

        return {
          register,
          resolve,
        };
      }
    };

    container = DIContainer.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(DIContainer.metadata.id).toBe('DIContainer');
      expect(DIContainer.metadata.version).toBe('1.0.0');
      expect(DIContainer.metadata.type).toBe('service');
    });

    it('should declare Utils dependency', () => {
      expect(DIContainer.metadata.dependencies).toContain('Utils');
    });

    it('should be synchronous', () => {
      expect(DIContainer.metadata.async).toBe(false);
    });
  });

  describe('register()', () => {
    it('should register valid module', () => {
      const testModule = {
        metadata: {
          id: 'TestModule',
          version: '1.0.0',
          dependencies: [],
          type: 'service'
        },
        factory: () => ({ api: { test: () => 'test' } })
      };

      container.register(testModule);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Registered module: TestModule')
      );
    });

    it('should reject module without metadata', () => {
      container.register({});

      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Invalid module registration attempt')
      );
    });

    it('should reject module without id', () => {
      const invalidModule = {
        metadata: {
          version: '1.0.0'
        },
        factory: () => ({})
      };

      container.register(invalidModule);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should reject null module', () => {
      container.register(null);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should reject undefined module', () => {
      container.register(undefined);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should register multiple modules', () => {
      const module1 = {
        metadata: { id: 'Module1', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };
      const module2 = {
        metadata: { id: 'Module2', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };

      container.register(module1);
      container.register(module2);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledTimes(2);
    });
  });

  describe('resolve()', () => {
    it('should resolve registered module', async () => {
      const testModule = {
        metadata: {
          id: 'TestModule',
          dependencies: [],
          type: 'service'
        },
        factory: () => ({ api: { getValue: () => 42 } })
      };

      container.register(testModule);
      const instance = await container.resolve('TestModule');

      expect(instance).toBeDefined();
      expect(instance.getValue()).toBe(42);
    });

    it('should throw on unregistered module', async () => {
      await expect(container.resolve('NonExistent')).rejects.toThrow(
        'Service not found: NonExistent'
      );
    });

    it('should return singleton instance', async () => {
      let callCount = 0;
      const testModule = {
        metadata: {
          id: 'Singleton',
          dependencies: [],
          type: 'service'
        },
        factory: () => {
          callCount++;
          return { api: { getCount: () => callCount } };
        }
      };

      container.register(testModule);

      const instance1 = await container.resolve('Singleton');
      const instance2 = await container.resolve('Singleton');

      expect(instance1).toBe(instance2);
      expect(callCount).toBe(1);
    });

    it('should list available services in error', async () => {
      const module1 = {
        metadata: { id: 'Service1', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };
      const module2 = {
        metadata: { id: 'Service2', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };

      container.register(module1);
      container.register(module2);

      try {
        await container.resolve('NonExistent');
      } catch (err) {
        expect(err.message).toContain('Available services:');
        expect(err.message).toContain('Service1');
        expect(err.message).toContain('Service2');
      }
    });
  });

  describe('Dependency Resolution', () => {
    it('should resolve module with dependencies', async () => {
      const depModule = {
        metadata: {
          id: 'Dependency',
          dependencies: [],
          type: 'service'
        },
        factory: () => ({ api: { getValue: () => 10 } })
      };

      const mainModule = {
        metadata: {
          id: 'Main',
          dependencies: ['Dependency'],
          type: 'service'
        },
        factory: (deps) => ({
          api: {
            useValue: () => deps.Dependency.getValue() * 2
          }
        })
      };

      container.register(depModule);
      container.register(mainModule);

      const instance = await container.resolve('Main');
      expect(instance.useValue()).toBe(20);
    });

    it('should resolve nested dependencies', async () => {
      const level3 = {
        metadata: { id: 'Level3', dependencies: [], type: 'service' },
        factory: () => ({ api: { value: 3 } })
      };

      const level2 = {
        metadata: { id: 'Level2', dependencies: ['Level3'], type: 'service' },
        factory: (deps) => ({ api: { value: deps.Level3.value + 2 } })
      };

      const level1 = {
        metadata: { id: 'Level1', dependencies: ['Level2'], type: 'service' },
        factory: (deps) => ({ api: { value: deps.Level2.value + 1 } })
      };

      container.register(level3);
      container.register(level2);
      container.register(level1);

      const instance = await container.resolve('Level1');
      expect(instance.value).toBe(6);
    });

    it('should resolve multiple dependencies', async () => {
      const dep1 = {
        metadata: { id: 'Dep1', dependencies: [], type: 'service' },
        factory: () => ({ api: { a: 10 } })
      };

      const dep2 = {
        metadata: { id: 'Dep2', dependencies: [], type: 'service' },
        factory: () => ({ api: { b: 20 } })
      };

      const main = {
        metadata: {
          id: 'Main',
          dependencies: ['Dep1', 'Dep2'],
          type: 'service'
        },
        factory: (deps) => ({
          api: {
            sum: () => deps.Dep1.a + deps.Dep2.b
          }
        })
      };

      container.register(dep1);
      container.register(dep2);
      container.register(main);

      const instance = await container.resolve('Main');
      expect(instance.sum()).toBe(30);
    });

    it('should throw on missing dependency', async () => {
      const main = {
        metadata: {
          id: 'Main',
          dependencies: ['MissingDep'],
          type: 'service'
        },
        factory: (deps) => ({ api: {} })
      };

      container.register(main);

      await expect(container.resolve('Main')).rejects.toThrow(
        'Failed to resolve dependency \'MissingDep\' for module \'Main\''
      );
    });

    it('should include dependency chain in error', async () => {
      const main = {
        metadata: {
          id: 'Main',
          dependencies: ['MissingDep'],
          type: 'service'
        },
        factory: () => ({ api: {} })
      };

      container.register(main);

      try {
        await container.resolve('Main');
      } catch (err) {
        expect(err.message).toContain('Dependency chain: Main → MissingDep');
      }
    });
  });

  describe('Async Initialization', () => {
    it('should call init on async modules', async () => {
      const initSpy = vi.fn().mockResolvedValue(undefined);

      const asyncModule = {
        metadata: {
          id: 'AsyncModule',
          dependencies: [],
          async: true,
          type: 'service'
        },
        factory: () => ({
          init: initSpy,
          api: { value: 42 }
        })
      };

      container.register(asyncModule);
      await container.resolve('AsyncModule');

      expect(initSpy).toHaveBeenCalledTimes(1);
    });

    it('should not call init on sync modules', async () => {
      const initSpy = vi.fn();

      const syncModule = {
        metadata: {
          id: 'SyncModule',
          dependencies: [],
          async: false,
          type: 'service'
        },
        factory: () => ({
          init: initSpy,
          api: { value: 42 }
        })
      };

      container.register(syncModule);
      await container.resolve('SyncModule');

      expect(initSpy).not.toHaveBeenCalled();
    });

    it('should not call init if method missing', async () => {
      const asyncModule = {
        metadata: {
          id: 'AsyncModule',
          dependencies: [],
          async: true,
          type: 'service'
        },
        factory: () => ({
          api: { value: 42 }
        })
      };

      container.register(asyncModule);
      const instance = await container.resolve('AsyncModule');

      expect(instance.value).toBe(42);
    });

    it('should wait for init to complete', async () => {
      let initialized = false;

      const asyncModule = {
        metadata: {
          id: 'AsyncModule',
          dependencies: [],
          async: true,
          type: 'service'
        },
        factory: () => ({
          init: async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
            initialized = true;
          },
          api: { isReady: () => initialized }
        })
      };

      container.register(asyncModule);
      const instance = await container.resolve('AsyncModule');

      expect(instance.isReady()).toBe(true);
    });
  });

  describe('Module Types', () => {
    it('should return instance directly for pure modules', async () => {
      const pureModule = {
        metadata: {
          id: 'PureModule',
          dependencies: [],
          type: 'pure'
        },
        factory: () => ({
          calculate: (x) => x * 2
        })
      };

      container.register(pureModule);
      const instance = await container.resolve('PureModule');

      expect(instance.calculate(5)).toBe(10);
    });

    it('should return api property for service modules', async () => {
      const serviceModule = {
        metadata: {
          id: 'ServiceModule',
          dependencies: [],
          type: 'service'
        },
        factory: () => ({
          _private: 'secret',
          api: {
            public: 'visible'
          }
        })
      };

      container.register(serviceModule);
      const instance = await container.resolve('ServiceModule');

      expect(instance.public).toBe('visible');
      expect(instance._private).toBeUndefined();
    });

    it('should return api property for ui modules', async () => {
      const uiModule = {
        metadata: {
          id: 'UIModule',
          dependencies: [],
          type: 'ui'
        },
        factory: () => ({
          _internal: 'hidden',
          api: {
            render: () => '<div>UI</div>'
          }
        })
      };

      container.register(uiModule);
      const instance = await container.resolve('UIModule');

      expect(instance.render()).toBe('<div>UI</div>');
      expect(instance._internal).toBeUndefined();
    });
  });

  describe('Logging', () => {
    it('should log module registration', () => {
      const module = {
        metadata: { id: 'TestModule', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };

      container.register(module);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        '[DIContainer] Registered module: TestModule'
      );
    });

    it('should log instance creation', async () => {
      const module = {
        metadata: { id: 'TestModule', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };

      container.register(module);
      await container.resolve('TestModule');

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith(
        '[DIContainer] Creating instance of: TestModule'
      );
    });

    it('should only log creation once for singletons', async () => {
      const module = {
        metadata: { id: 'TestModule', dependencies: [], type: 'service' },
        factory: () => ({ api: {} })
      };

      container.register(module);
      await container.resolve('TestModule');
      await container.resolve('TestModule');

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Messages', () => {
    it('should provide helpful error for invalid module', () => {
      container.register({ metadata: {} });

      const errorCall = mockDeps.Utils.logger.error.mock.calls[0][0];
      expect(errorCall).toContain('Invalid module registration attempt');
      expect(errorCall).toContain('Modules must have structure');
    });

    it('should provide helpful error for missing service', async () => {
      try {
        await container.resolve('Missing');
      } catch (err) {
        expect(err.message).toContain('Service not found');
        expect(err.message).toContain('Available services');
        expect(err.message).toContain('Tip: Check module ID spelling');
      }
    });

    it('should provide helpful error for missing dependency', async () => {
      const module = {
        metadata: {
          id: 'Main',
          dependencies: ['Missing'],
          type: 'service'
        },
        factory: () => ({ api: {} })
      };

      container.register(module);

      try {
        await container.resolve('Main');
      } catch (err) {
        expect(err.message).toContain('Failed to resolve dependency');
        expect(err.message).toContain('Dependency chain');
        expect(err.message).toContain('Check for circular dependencies');
      }
    });
  });
});
