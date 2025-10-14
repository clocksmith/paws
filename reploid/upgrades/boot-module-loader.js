// Universal Module Loader for REPLOID
// Provides consistent module loading, dependency injection, and lifecycle management

const ModuleLoader = {
  modules: new Map(),
  loadOrder: [],
  config: null,
  vfs: null,
  auditLogger: null, // SEC-4: Audit logging

  // Initialize the loader with VFS and config
  init(vfs, config, auditLogger = null) {
    this.vfs = vfs;
    this.config = config;
    this.auditLogger = auditLogger; // SEC-4: Store audit logger
    this.modules.clear();
    this.loadOrder = [];
    console.log("[ModuleLoader] Initialized with VFS and config");
  },
  
  // Load a module definition from VFS
  async loadModule(vfsPath, moduleId) {
    const startTime = Date.now();
    try {
      console.log(`[ModuleLoader] Loading module ${moduleId} from ${vfsPath}`);

      // Read module code from VFS
      const code = await this.vfs.read(vfsPath);
      if (!code) {
        throw new Error(`No code found at ${vfsPath}`);
      }

      // Parse module using Function constructor
      // Module should define itself with standard format and return itself
      const moduleDefinition = new Function(`
        ${code}
        if (typeof ${moduleId} !== 'undefined') {
          return ${moduleId};
        }
        // Fallback for legacy modules
        if (typeof ${moduleId}Module !== 'undefined') {
          return ${moduleId}Module;
        }
        throw new Error('Module ${moduleId} not found in loaded code');
      `)();

      // Check if it's a legacy module (function) or new format (object with metadata)
      const isLegacy = typeof moduleDefinition === 'function';

      if (isLegacy) {
        console.log(`[ModuleLoader] ${moduleId} is a legacy module, wrapping...`);
        // Wrap legacy module - we'll handle this in instantiation
        this.modules.set(moduleId, {
          definition: moduleDefinition,
          isLegacy: true,
          instance: null,
          vfsPath
        });
      } else {
        // Validate new module structure
        if (!moduleDefinition.metadata || !moduleDefinition.factory) {
          throw new Error(`Invalid module format: ${moduleId} (missing metadata or factory)`);
        }

        console.log(`[ModuleLoader] ${moduleId} loaded with dependencies:`, moduleDefinition.metadata.dependencies);

        // Store module definition
        this.modules.set(moduleId, {
          definition: moduleDefinition,
          isLegacy: false,
          instance: null,
          vfsPath
        });
      }

      this.loadOrder.push(moduleId);

      // SEC-4: Audit log successful module load
      if (this.auditLogger) {
        await this.auditLogger.logModuleLoad(moduleId, vfsPath, true, {
          isLegacy,
          loadTimeMs: Date.now() - startTime,
          codeSize: code.length
        });
      }

      return moduleDefinition;

    } catch (e) {
      console.error(`[ModuleLoader] Failed to load module ${moduleId}:`, e);

      // SEC-4: Audit log failed module load
      if (this.auditLogger) {
        await this.auditLogger.logModuleLoad(moduleId, vfsPath, false, {
          error: e.message,
          loadTimeMs: Date.now() - startTime
        });
      }

      throw e;
    }
  },
  
  // Instantiate a module with its dependencies
  async instantiateModule(moduleId, providedDeps = {}) {
    const moduleEntry = this.modules.get(moduleId);
    if (!moduleEntry) {
      throw new Error(`Module not loaded: ${moduleId}`);
    }
    
    // Return cached instance if already instantiated
    if (moduleEntry.instance) {
      console.log(`[ModuleLoader] Returning cached instance for ${moduleId}`);
      return moduleEntry.instance;
    }
    
    console.log(`[ModuleLoader] Instantiating module ${moduleId}`);
    
    if (moduleEntry.isLegacy) {
      // Handle legacy modules - they expect direct dependency injection
      // This is a temporary compatibility layer
      console.log(`[ModuleLoader] Creating legacy module instance for ${moduleId}`);
      
      // Legacy modules are functions that expect specific arguments
      // We need to know their signatures - this is the main issue with legacy format
      // For now, we'll pass common dependencies based on module name patterns
      const instance = this.instantiateLegacyModule(moduleId, moduleEntry.definition, providedDeps);
      moduleEntry.instance = instance;
      return instance;
    }
    
    const { definition } = moduleEntry;
    const { dependencies = [], async: needsAsync } = definition.metadata;
    
    // Resolve dependencies
    const deps = { ...providedDeps }; // Include any provided dependencies
    for (const depId of dependencies) {
      if (!deps[depId]) {
        // Check if it's a built-in dependency
        if (depId === 'config') {
          deps[depId] = this.config;
        } else if (depId === 'vfs') {
          deps[depId] = this.vfs;
        } else if (depId === 'logger' || depId === 'Errors') {
          // logger and Errors come from Utils module
          const utils = await this.getModule('Utils');
          if (depId === 'logger') {
            deps[depId] = utils.logger || console;
          } else {
            deps[depId] = utils.Errors || {};
          }
        } else {
          // Recursively instantiate dependency
          deps[depId] = await this.getModule(depId);
        }
      }
    }
    
    // Create instance using factory
    console.log(`[ModuleLoader] Creating instance of ${moduleId} with deps:`, Object.keys(deps));
    const instance = definition.factory(deps);
    
    // Run async init if needed
    if (needsAsync && instance.init) {
      console.log(`[ModuleLoader] Running async init for ${moduleId}`);
      await instance.init();
    }
    
    // Cache and return (use api property if available, otherwise the instance itself)
    moduleEntry.instance = instance.api || instance;
    return moduleEntry.instance;
  },
  
  // Handle legacy module instantiation (compatibility layer)
  instantiateLegacyModule(moduleId, ModuleFunction, providedDeps) {
    // Map of known legacy module signatures
    // This is a temporary solution until all modules are migrated
    const legacySignatures = {
      'Utils': [],
      'UtilsModule': [],
      'AgentLogicPureHelpers': [],
      'AgentLogicPureHelpersModule': [],
      'StateHelpersPure': [],
      'StateHelpersPureModule': [],
      'ToolRunnerPureHelpers': [],
      'ToolRunnerPureHelpersModule': [],
      'Storage': ['config', 'logger', 'Errors'],
      'StorageModule': ['config', 'logger', 'Errors'],
      'StateManager': ['config', 'logger', 'Storage', 'Errors', 'StateHelpersPure', 'Utils'],
      'StateManagerModule': ['config', 'logger', 'Storage', 'Errors', 'StateHelpersPure', 'Utils'],
      'ApiClient': ['config', 'logger', 'Errors', 'Utils', 'StateManager'],
      'ApiClientModule': ['config', 'logger', 'Errors', 'Utils', 'StateManager'],
      'ToolRunner': ['config', 'logger', 'Storage', 'StateManager', 'ApiClient', 'Errors', 'Utils', 'ToolRunnerPureHelpers'],
      'ToolRunnerModule': ['config', 'logger', 'Storage', 'StateManager', 'ApiClient', 'Errors', 'Utils', 'ToolRunnerPureHelpers'],
      'UI': ['config', 'logger', 'Utils', 'Storage', 'StateManager', 'Errors'],
      'UIModule': ['config', 'logger', 'Utils', 'Storage', 'StateManager', 'Errors'],
      'CycleLogic': ['config', 'logger', 'Utils', 'Storage', 'StateManager', 'UI', 'ApiClient', 'ToolRunner', 'Errors', 'AgentLogicPureHelpers'],
      'CycleLogicModule': ['config', 'logger', 'Utils', 'Storage', 'StateManager', 'UI', 'ApiClient', 'ToolRunner', 'Errors', 'AgentLogicPureHelpers']
    };
    
    const signature = legacySignatures[moduleId] || legacySignatures[moduleId + 'Module'] || [];
    const args = [];
    
    // Build arguments in correct order
    for (const depName of signature) {
      if (depName === 'config') {
        args.push(this.config);
      } else if (depName === 'logger') {
        // Get logger from Utils if available
        const utils = providedDeps.Utils || this.modules.get('Utils')?.instance;
        args.push(utils?.logger || console);
      } else if (depName === 'Errors') {
        // Get Errors from Utils if available  
        const utils = providedDeps.Utils || this.modules.get('Utils')?.instance;
        args.push(utils?.Errors || {});
      } else {
        args.push(providedDeps[depName] || this.modules.get(depName)?.instance);
      }
    }
    
    // Call the legacy module function with its expected arguments
    return ModuleFunction(...args);
  },
  
  // Get a module instance (load and instantiate if needed)
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
  
  // Load modules from manifest
  async loadFromManifest(manifest) {
    console.log("[ModuleLoader] Loading modules from manifest");
    
    for (const group of manifest.loadGroups) {
      console.log(`[ModuleLoader] Loading group: ${group.description}`);
      
      // Load all modules in parallel within each level
      const loadPromises = group.modules.map(m => 
        this.loadModule(m.path, m.id).catch(e => {
          console.error(`Failed to load ${m.id}:`, e);
          // Return null to allow other modules to load
          return null;
        })
      );
      
      await Promise.all(loadPromises);
    }
    
    console.log("[ModuleLoader] All modules loaded from manifest");
  },
  
  // Instantiate all loaded modules in dependency order
  async instantiateAll() {
    console.log("[ModuleLoader] Instantiating all modules in dependency order");
    
    // First pass: instantiate pure modules (no dependencies)
    for (const moduleId of this.loadOrder) {
      const entry = this.modules.get(moduleId);
      if (!entry) continue;
      
      if (!entry.isLegacy && entry.definition.metadata) {
        const deps = entry.definition.metadata.dependencies || [];
        if (deps.length === 0) {
          console.log(`[ModuleLoader] Instantiating pure module: ${moduleId}`);
          await this.instantiateModule(moduleId);
        }
      }
    }
    
    // Second pass: instantiate remaining modules
    for (const moduleId of this.loadOrder) {
      if (!this.modules.get(moduleId)?.instance) {
        await this.instantiateModule(moduleId);
      }
    }
    
    console.log("[ModuleLoader] All modules instantiated");
  },
  
  // Get all loaded module IDs
  getLoadedModules() {
    return Array.from(this.modules.keys());
  },
  
  // Check if a module is loaded
  isLoaded(moduleId) {
    return this.modules.has(moduleId);
  },
  
  // Clear all modules (useful for hot reload)
  clear() {
    this.modules.clear();
    this.loadOrder = [];
    console.log("[ModuleLoader] All modules cleared");
  }
};

// Export for use
ModuleLoader;