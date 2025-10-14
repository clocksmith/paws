// ES6 Module Loader System
// Provides dynamic module loading with dependency resolution

export class ModuleLoader {
  constructor() {
    this.modules = new Map();
    this.loadingPromises = new Map();
  }

  async loadModule(modulePath) {
    // Check if already loaded
    if (this.modules.has(modulePath)) {
      return this.modules.get(modulePath);
    }

    // Check if currently loading
    if (this.loadingPromises.has(modulePath)) {
      return this.loadingPromises.get(modulePath);
    }

    // Start loading
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
    try {
      // Dynamic import for ES6 modules
      const module = await import(modulePath);
      return module.default || module;
    } catch (error) {
      console.error(`Failed to load module: ${modulePath}`, error);
      throw new Error(`Module loading failed: ${modulePath}`);
    }
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

// Singleton instance
export const moduleLoader = new ModuleLoader();

// Helper function to convert legacy modules to ES6
export async function convertLegacyModule(legacyModule) {
  if (typeof legacyModule === 'function') {
    // Legacy factory function
    return {
      default: legacyModule,
      factory: legacyModule
    };
  }
  
  if (legacyModule.factory) {
    // Legacy module with factory
    return {
      ...legacyModule,
      default: legacyModule.factory
    };
  }
  
  return legacyModule;
}

// Dependency injection container
export class DIContainer {
  constructor() {
    this.services = new Map();
    this.factories = new Map();
  }

  register(name, factory, metadata = {}) {
    this.factories.set(name, { factory, metadata });
  }

  async resolve(name) {
    if (this.services.has(name)) {
      return this.services.get(name);
    }

    const registration = this.factories.get(name);
    if (!registration) {
      throw new Error(`Service not registered: ${name}`);
    }

    const { factory, metadata } = registration;
    const dependencies = await this.resolveDependencies(metadata.dependencies || []);
    
    const service = metadata.async 
      ? await factory(dependencies)
      : factory(dependencies);
    
    this.services.set(name, service);
    return service;
  }

  async resolveDependencies(deps) {
    const resolved = {};
    for (const dep of deps) {
      resolved[dep] = await this.resolve(dep);
    }
    return resolved;
  }

  clear() {
    this.services.clear();
    this.factories.clear();
  }
}

export const container = new DIContainer();

// Export default instance
export default {
  ModuleLoader,
  moduleLoader,
  convertLegacyModule,
  DIContainer,
  container
};