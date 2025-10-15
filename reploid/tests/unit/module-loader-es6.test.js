import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the classes for testing
class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadingPromises = new Map();
  }

  async loadModule(modulePath) {
    if (this.modules.has(modulePath)) {
      return this.modules.get(modulePath);
    }

    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath);
    }

    const loadPromise = this._loadModuleImpl(modulePath);
    this.loadingPromises.set(modulePath, loadPromise);

    try {
      const module = await loadPromise;
      this.modules.set(modulePath, module);
      this.loadingPromises.delete(modulePath);
      return module;
    } catch (error) {
      this.loadingPromises.delete(modulePath);
      throw error;
    }
  }

  async _loadModuleImpl(modulePath) {
    // Mocked for testing
    return { name: modulePath };
  }

  async loadModules(modulePaths) {
    return Promise.all(modulePaths.map(path => this.loadModule(path)));
  }

  getModule(modulePath) {
    return this.modules.get(modulePath);
  }

  clearCache() {
    this.modules.clear();
    this.loadingPromises.clear();
  }
}

class DIContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, factory, dependencies = []) {
    this.factories.set(name, { factory, dependencies });
  }

  async resolve(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    const factoryInfo = this.factories.get(name);
    if (!factoryInfo) {
      throw new Error(`Service not found: ${name}`);
    }

    const deps = {};
    for (const dep of factoryInfo.dependencies) {
      deps[dep] = await this.resolve(dep);
    }

    const service = await factoryInfo.factory(deps);
    this.services.set(name, service);
    return service;
  }

  clear() {
    this.services.clear();
    this.factories.clear();
  }
}

describe('ModuleLoader', () => {
  let loader;

  beforeEach(() => {
    loader = new ModuleLoader();
  });

  it('should load module', async () => {
    const module = await loader.loadModule('/test/module.js');

    expect(module).toBeDefined();
    expect(loader.modules.has('/test/module.js')).toBe(true);
  });

  it('should return cached module', async () => {
    await loader.loadModule('/test/module.js');
    const module2 = await loader.loadModule('/test/module.js');

    expect(module2).toBe(loader.modules.get('/test/module.js'));
  });

  it('should load multiple modules', async () => {
    const modules = await loader.loadModules(['/mod1.js', '/mod2.js', '/mod3.js']);

    expect(modules).toHaveLength(3);
    expect(loader.modules.size).toBe(3);
  });

  it('should get loaded module', async () => {
    await loader.loadModule('/test/module.js');
    const module = loader.getModule('/test/module.js');

    expect(module).toBeDefined();
  });

  it('should return undefined for unloaded module', () => {
    const module = loader.getModule('/nonexistent.js');

    expect(module).toBeUndefined();
  });

  it('should clear cache', async () => {
    await loader.loadModule('/test/module.js');
    loader.clearCache();

    expect(loader.modules.size).toBe(0);
    expect(loader.getModule('/test/module.js')).toBeUndefined();
  });

  it('should handle concurrent loads', async () => {
    const promise1 = loader.loadModule('/test/module.js');
    const promise2 = loader.loadModule('/test/module.js');

    const [mod1, mod2] = await Promise.all([promise1, promise2]);

    expect(mod1).toBe(mod2);
    expect(loader.modules.size).toBe(1);
  });

  it('should clean up loading promise after success', async () => {
    await loader.loadModule('/test/module.js');

    expect(loader.loadingPromises.size).toBe(0);
  });

  it('should clean up loading promise after error', async () => {
    loader._loadModuleImpl = vi.fn().mockRejectedValue(new Error('Load failed'));

    await expect(loader.loadModule('/test/module.js')).rejects.toThrow();

    expect(loader.loadingPromises.size).toBe(0);
  });
});

describe('DIContainer', () => {
  let container;

  beforeEach(() => {
    container = new DIContainer();
  });

  it('should register service', () => {
    container.register('service1', () => ({ name: 'Service 1' }));

    expect(container.factories.has('service1')).toBe(true);
  });

  it('should resolve service', async () => {
    container.register('service1', () => ({ name: 'Service 1' }));

    const service = await container.resolve('service1');

    expect(service.name).toBe('Service 1');
  });

  it('should cache resolved services', async () => {
    container.register('service1', () => ({ name: 'Service 1' }));

    const service1 = await container.resolve('service1');
    const service2 = await container.resolve('service1');

    expect(service1).toBe(service2);
  });

  it('should resolve dependencies', async () => {
    container.register('depService', () => ({ value: 42 }));
    container.register('mainService', (deps) => ({
      dep: deps.depService
    }), ['depService']);

    const service = await container.resolve('mainService');

    expect(service.dep.value).toBe(42);
  });

  it('should throw for missing service', async () => {
    await expect(container.resolve('nonexistent')).rejects.toThrow('Service not found');
  });

  it('should clear services', async () => {
    container.register('service1', () => ({ name: 'Service 1' }));
    await container.resolve('service1');

    container.clear();

    expect(container.services.size).toBe(0);
    expect(container.factories.size).toBe(0);
  });

  it('should handle multiple dependencies', async () => {
    container.register('dep1', () => ({ value: 1 }));
    container.register('dep2', () => ({ value: 2 }));
    container.register('service', (deps) => ({
      sum: deps.dep1.value + deps.dep2.value
    }), ['dep1', 'dep2']);

    const service = await container.resolve('service');

    expect(service.sum).toBe(3);
  });

  it('should handle async factories', async () => {
    container.register('service', async () => {
      await new Promise(resolve => setTimeout(resolve, 1));
      return { async: true };
    });

    const service = await container.resolve('service');

    expect(service.async).toBe(true);
  });
});
