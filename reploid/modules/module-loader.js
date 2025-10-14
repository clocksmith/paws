// ES6 Module Loader for REPLOID
// Standardizes all modules to use ES6 import/export syntax

export class ModuleSystem {
  constructor() {
    this.modules = new Map();
    this.loadingPromises = new Map();
    this.dependencies = new Map();
  }

  async registerModule(name, moduleFactory) {
    if (this.modules.has(name)) {
      console.warn(`Module ${name} already registered`);
      return this.modules.get(name);
    }

    // Store factory for lazy initialization
    this.modules.set(name, {
      factory: moduleFactory,
      instance: null,
      initialized: false
    });

    return this;
  }

  async loadModule(name) {
    if (!this.modules.has(name)) {
      throw new Error(`Module ${name} not registered`);
    }

    const moduleEntry = this.modules.get(name);
    
    if (moduleEntry.initialized) {
      return moduleEntry.instance;
    }

    if (this.loadingPromises.has(name)) {
      return this.loadingPromises.get(name);
    }

    const loadPromise = this._initializeModule(name, moduleEntry);
    this.loadingPromises.set(name, loadPromise);

    try {
      const instance = await loadPromise;
      moduleEntry.instance = instance;
      moduleEntry.initialized = true;
      this.loadingPromises.delete(name);
      return instance;
    } catch (error) {
      this.loadingPromises.delete(name);
      throw error;
    }
  }

  async _initializeModule(name, moduleEntry) {
    const { factory } = moduleEntry;
    
    // Get module metadata
    const metadata = factory.metadata || {};
    const dependencies = metadata.dependencies || [];

    // Load dependencies first
    const deps = {};
    for (const dep of dependencies) {
      try {
        deps[dep] = await this.loadModule(dep);
      } catch (error) {
        console.error(`Failed to load dependency ${dep} for module ${name}:`, error);
        throw new Error(`Dependency resolution failed for ${name}: ${dep}`);
      }
    }

    // Initialize the module with its dependencies
    try {
      const moduleInstance = factory.factory ? factory.factory(deps) : factory(deps);
      
      // If module has async init, call it
      if (metadata.async && moduleInstance.init) {
        return await moduleInstance.init();
      }
      
      return moduleInstance;
    } catch (error) {
      console.error(`Failed to initialize module ${name}:`, error);
      throw error;
    }
  }

  getModule(name) {
    const entry = this.modules.get(name);
    return entry?.instance || null;
  }

  isLoaded(name) {
    const entry = this.modules.get(name);
    return entry?.initialized || false;
  }

  getAllModules() {
    const result = {};
    for (const [name, entry] of this.modules) {
      if (entry.initialized) {
        result[name] = entry.instance;
      }
    }
    return result;
  }

  clear() {
    this.modules.clear();
    this.loadingPromises.clear();
    this.dependencies.clear();
  }
}

// Create singleton instance
export const moduleSystem = new ModuleSystem();

// Helper to convert legacy modules to ES6 format
export function convertLegacyModule(legacyModule) {
  // If it's already ES6, return as-is
  if (legacyModule.__esModule) {
    return legacyModule;
  }

  // Convert legacy format
  const converted = {
    __esModule: true,
    metadata: legacyModule.metadata || {},
    factory: legacyModule.factory || legacyModule,
    default: legacyModule
  };

  return converted;
}

// Bootstrap function to initialize core modules
export async function bootstrapModules(vfs, config) {
  console.log('Bootstrapping ES6 module system...');
  
  // Import and register core modules
  const coreModules = [
    { name: 'config', factory: () => config },
    { name: 'vfs', factory: () => vfs }
  ];

  for (const { name, factory } of coreModules) {
    await moduleSystem.registerModule(name, {
      metadata: { dependencies: [] },
      factory
    });
  }

  // Load module definitions from VFS
  const moduleFiles = [
    'utils.js',
    'storage-indexeddb.js', 
    'state-manager.js',
    'api-client.js',
    'agent-cycle.js',
    'tool-runner.js',
    'ui-manager.js'
  ];

  for (const file of moduleFiles) {
    try {
      const content = await vfs.read(`/modules/${file}`);
      if (content) {
        // Dynamically import the module
        const module = await import(`data:text/javascript,${encodeURIComponent(content)}`);
        const name = file.replace('.js', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
        
        // Register with module system
        await moduleSystem.registerModule(name, convertLegacyModule(module.default || module));
      }
    } catch (error) {
      console.warn(`Failed to load module ${file}:`, error);
    }
  }

  console.log('Module system bootstrap complete');
  return moduleSystem;
}

// Export default
export default {
  ModuleSystem,
  moduleSystem,
  convertLegacyModule,
  bootstrapModules
};