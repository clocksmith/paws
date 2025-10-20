// @blueprint 0x000053 - Hot Module Reload system
// Hot Module Reload System for REPLOID
// Enables dynamic code replacement without losing state

const HotReload = {
  metadata: {
    id: 'HotReload',
    version: '1.0.0',
    dependencies: ['logger', 'StateManager', 'Storage'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { logger, StateManager, Storage } = deps;
    
    // Module registry for hot reloading
    const moduleRegistry = new Map();
    const moduleProxies = new Map();
    const updateCallbacks = new Map();
    const moduleVersions = new Map();
    
    // Initialize hot reload system
    const initialize = () => {
      logger.info('[HotReload] Initializing hot module reload system');
      
      // Set up global error handler for dynamic imports
      window.addEventListener('unhandledrejection', handleImportError);
      
      // Monitor VFS for module changes
      if (StateManager.watchArtifacts) {
        StateManager.watchArtifacts('/modules/', handleModuleChange);
      }
      
      logger.info('[HotReload] Hot reload system ready');
    };
    
    // Create a hot-reloadable module
    const createModule = async (moduleId, sourcePath) => {
      logger.info(`[HotReload] Creating hot module: ${moduleId}`);
      
      // Get module source from VFS
      const source = await Storage.getArtifactContent(sourcePath);
      if (!source) {
        throw new Error(`Module source not found: ${sourcePath}`);
      }
      
      // Create module using dynamic import with data URL
      const module = await loadModuleFromSource(source, moduleId);
      
      // Create proxy for hot swapping
      const proxy = createModuleProxy(module, moduleId);
      
      // Register module
      moduleRegistry.set(moduleId, module);
      moduleProxies.set(moduleId, proxy);
      moduleVersions.set(moduleId, { version: 1, sourcePath });
      
      logger.info(`[HotReload] Module ${moduleId} created and registered`);
      return proxy;
    };
    
    // Load module from source code using dynamic import
    const loadModuleFromSource = async (source, moduleId) => {
      logger.debug(`[HotReload] Loading module from source: ${moduleId}`);
      
      // Wrap source in module format if needed
      const wrappedSource = wrapModuleSource(source, moduleId);
      
      // Create blob URL for dynamic import
      const blob = new Blob([wrappedSource], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(blob);
      
      try {
        // Dynamic import from blob URL
        const module = await import(moduleUrl);
        
        // Clean up blob URL
        URL.revokeObjectURL(moduleUrl);
        
        return module;
      } catch (error) {
        URL.revokeObjectURL(moduleUrl);
        logger.error(`[HotReload] Failed to load module ${moduleId}:`, error);
        throw error;
      }
    };
    
    // Wrap module source for proper export
    const wrapModuleSource = (source, moduleId) => {
      // Check if source already has export statements
      if (source.includes('export ') || source.includes('export{')) {
        return source;
      }
      
      // Auto-wrap in module format
      return `
        // Hot-reloadable module: ${moduleId}
        ${source}
        
        // Auto-export detected entities
        const __module = {
          ${detectExports(source)}
        };
        
        export default __module;
        export const __moduleId = '${moduleId}';
        export const __hotReload = true;
      `;
    };
    
    // Detect exportable entities in source
    const detectExports = (source) => {
      const exports = [];
      
      // Detect function declarations
      const funcRegex = /function\s+(\w+)\s*\(/g;
      let match;
      while ((match = funcRegex.exec(source)) !== null) {
        exports.push(`${match[1]}: typeof ${match[1]} !== 'undefined' ? ${match[1]} : null`);
      }
      
      // Detect const/let/var declarations
      const varRegex = /(?:const|let|var)\s+(\w+)\s*=/g;
      while ((match = varRegex.exec(source)) !== null) {
        exports.push(`${match[1]}: typeof ${match[1]} !== 'undefined' ? ${match[1]} : null`);
      }
      
      // Detect class declarations
      const classRegex = /class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g;
      while ((match = classRegex.exec(source)) !== null) {
        exports.push(`${match[1]}: typeof ${match[1]} !== 'undefined' ? ${match[1]} : null`);
      }
      
      return exports.join(',\n  ');
    };
    
    // Create a proxy for hot-swappable module
    const createModuleProxy = (module, moduleId) => {
      const handler = {
        get(target, prop) {
          // Always get from latest module version
          const currentModule = moduleRegistry.get(moduleId);
          
          if (currentModule && currentModule.default) {
            return currentModule.default[prop] || currentModule[prop];
          }
          
          return currentModule ? currentModule[prop] : undefined;
        },
        
        set(target, prop, value) {
          const currentModule = moduleRegistry.get(moduleId);
          if (currentModule) {
            if (currentModule.default) {
              currentModule.default[prop] = value;
            } else {
              currentModule[prop] = value;
            }
            return true;
          }
          return false;
        }
      };
      
      return new Proxy({}, handler);
    };
    
    // Hot reload a module
    const reloadModule = async (moduleId) => {
      logger.info(`[HotReload] Reloading module: ${moduleId}`);
      
      const versionInfo = moduleVersions.get(moduleId);
      if (!versionInfo) {
        throw new Error(`Module not registered: ${moduleId}`);
      }
      
      // Get updated source
      const newSource = await Storage.getArtifactContent(versionInfo.sourcePath);
      if (!newSource) {
        throw new Error(`Module source not found: ${versionInfo.sourcePath}`);
      }
      
      // Store old module for rollback
      const oldModule = moduleRegistry.get(moduleId);
      
      try {
        // Load new module version
        const newModule = await loadModuleFromSource(newSource, moduleId);
        
        // Call module's hot reload hook if present
        if (newModule.__acceptHotReload) {
          await newModule.__acceptHotReload(oldModule);
        }
        
        // Update registry
        moduleRegistry.set(moduleId, newModule);
        versionInfo.version++;
        
        // Notify update callbacks
        const callbacks = updateCallbacks.get(moduleId) || [];
        for (const callback of callbacks) {
          try {
            await callback(newModule, oldModule);
          } catch (error) {
            logger.error(`[HotReload] Update callback error:`, error);
          }
        }
        
        logger.info(`[HotReload] Module ${moduleId} reloaded to version ${versionInfo.version}`);
        return newModule;
        
      } catch (error) {
        logger.error(`[HotReload] Failed to reload module ${moduleId}:`, error);
        
        // Rollback on error
        moduleRegistry.set(moduleId, oldModule);
        throw error;
      }
    };
    
    // Handle module changes from VFS
    const handleModuleChange = async (event) => {
      const { artifactId, changeType } = event;
      
      // Check if this is a registered module
      let moduleId = null;
      for (const [id, info] of moduleVersions.entries()) {
        if (info.sourcePath === artifactId) {
          moduleId = id;
          break;
        }
      }
      
      if (moduleId && changeType === 'modified') {
        logger.info(`[HotReload] Detected change in module: ${moduleId}`);
        
        try {
          await reloadModule(moduleId);
        } catch (error) {
          logger.error(`[HotReload] Auto-reload failed for ${moduleId}:`, error);
        }
      }
    };
    
    // Register update callback for a module
    const onModuleUpdate = (moduleId, callback) => {
      if (!updateCallbacks.has(moduleId)) {
        updateCallbacks.set(moduleId, []);
      }
      
      updateCallbacks.get(moduleId).push(callback);
      logger.debug(`[HotReload] Registered update callback for ${moduleId}`);
    };
    
    // Create a safe execution context using blob URL
    const createSafeContext = async (code, contextVars = {}) => {
      logger.debug('[HotReload] Creating safe execution context');
      
      // Create isolated module
      const contextCode = `
        // Safe execution context
        const context = ${JSON.stringify(contextVars)};
        
        const execute = async () => {
          ${code}
        };
        
        export default execute;
      `;
      
      const blob = new Blob([contextCode], { type: 'application/javascript' });
      const moduleUrl = URL.createObjectURL(blob);
      
      try {
        const module = await import(moduleUrl);
        URL.revokeObjectURL(moduleUrl);
        return module.default;
      } catch (error) {
        URL.revokeObjectURL(moduleUrl);
        throw error;
      }
    };
    
    // Execute code in isolated context
    const executeSafe = async (code, args = {}) => {
      logger.debug('[HotReload] Executing code in safe context');
      
      const executor = await createSafeContext(code, args);
      return await executor();
    };
    
    // Hot-patch a function in an existing module
    const patchFunction = async (moduleId, functionName, newImplementation) => {
      logger.info(`[HotReload] Patching function ${functionName} in module ${moduleId}`);
      
      const module = moduleRegistry.get(moduleId);
      if (!module) {
        throw new Error(`Module not found: ${moduleId}`);
      }
      
      // Store original for rollback
      const original = module.default ? 
        module.default[functionName] : 
        module[functionName];
      
      if (typeof original !== 'function') {
        throw new Error(`Function not found: ${functionName}`);
      }
      
      // Create patched version
      const patchedFunction = new Function(
        'original',
        `return ${newImplementation}`
      )(original);
      
      // Apply patch
      if (module.default) {
        module.default[functionName] = patchedFunction;
      } else {
        module[functionName] = patchedFunction;
      }
      
      logger.info(`[HotReload] Function ${functionName} patched successfully`);
      
      return {
        rollback: () => {
          if (module.default) {
            module.default[functionName] = original;
          } else {
            module[functionName] = original;
          }
          logger.info(`[HotReload] Rolled back patch for ${functionName}`);
        }
      };
    };
    
    // Monitor and optimize module performance
    const profileModule = (moduleId) => {
      const module = moduleProxies.get(moduleId);
      if (!module) {
        throw new Error(`Module not found: ${moduleId}`);
      }
      
      const metrics = {
        calls: new Map(),
        totalTime: 0,
        errors: 0
      };
      
      // Create profiling proxy
      const profilingProxy = new Proxy(module, {
        get(target, prop) {
          const original = target[prop];
          
          if (typeof original === 'function') {
            return function(...args) {
              const startTime = performance.now();
              
              try {
                const result = original.apply(this, args);
                
                const duration = performance.now() - startTime;
                metrics.totalTime += duration;
                
                if (!metrics.calls.has(prop)) {
                  metrics.calls.set(prop, { count: 0, totalTime: 0 });
                }
                
                const callMetrics = metrics.calls.get(prop);
                callMetrics.count++;
                callMetrics.totalTime += duration;
                
                return result;
              } catch (error) {
                metrics.errors++;
                throw error;
              }
            };
          }
          
          return original;
        }
      });
      
      // Replace module proxy temporarily
      moduleProxies.set(moduleId, profilingProxy);
      
      // Return profiling controller
      return {
        stop: () => {
          moduleProxies.set(moduleId, module);
          return metrics;
        },
        getMetrics: () => metrics
      };
    };
    
    // Handle import errors
    const handleImportError = (event) => {
      if (event.reason && event.reason.message && event.reason.message.includes('import')) {
        logger.error('[HotReload] Dynamic import error:', event.reason);
        event.preventDefault();
      }
    };
    
    // Get module statistics
    const getStats = () => {
      return {
        totalModules: moduleRegistry.size,
        modules: Array.from(moduleVersions.entries()).map(([id, info]) => ({
          id,
          version: info.version,
          sourcePath: info.sourcePath,
          hasProxy: moduleProxies.has(id),
          updateCallbacks: (updateCallbacks.get(id) || []).length
        }))
      };
    };
    
    // Clean up resources
    const cleanup = () => {
      logger.info('[HotReload] Cleaning up hot reload system');
      
      // Remove event listener
      window.removeEventListener('unhandledrejection', handleImportError);
      
      // Clear registries
      moduleRegistry.clear();
      moduleProxies.clear();
      updateCallbacks.clear();
      moduleVersions.clear();
    };
    
    // Initialize on module load
    initialize();
    
    // Web Component Widget
    const widget = (() => {
      class HotReloadWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
        }

        disconnectedCallback() {
          // No interval to clean up
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        getStatus() {
          const stats = getStats();
          return {
            state: stats.totalModules > 0 ? 'active' : 'idle',
            primaryMetric: `${stats.totalModules} modules`,
            secondaryMetric: `${stats.modules.reduce((sum, m) => sum + m.version - 1, 0)} reloads`,
            lastActivity: null,
            message: null
          };
        }

        render() {
          const stats = getStats();
          const totalReloads = stats.modules.reduce((sum, m) => sum + m.version - 1, 0);

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
              }
              h3 {
                margin: 0 0 16px 0;
                font-size: 1.4em;
                color: #fff;
              }
              h4 {
                margin: 16px 0 10px 0;
                font-size: 1.1em;
                color: #0ff;
              }
              .controls {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
              }
              button {
                padding: 6px 12px;
                background: rgba(100,150,255,0.2);
                border: 1px solid rgba(100,150,255,0.4);
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 0.9em;
              }
              button:hover {
                background: rgba(100,150,255,0.3);
              }
              .stats-grid {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 10px;
                margin-bottom: 20px;
              }
              .stat-card {
                padding: 10px;
                border-radius: 5px;
              }
              .stat-card.modules {
                background: rgba(255,87,34,0.1);
              }
              .stat-card.reloads {
                background: rgba(0,255,255,0.1);
              }
              .stat-card.rate {
                background: rgba(76,175,80,0.1);
              }
              .stat-label {
                color: #888;
                font-size: 12px;
              }
              .stat-value {
                font-size: 24px;
                font-weight: bold;
              }
              .stat-value.modules { color: #ff5722; }
              .stat-value.reloads { color: #0ff; }
              .stat-value.rate { color: #4caf50; }
              .module-list {
                max-height: 300px;
                overflow-y: auto;
              }
              .module-item {
                padding: 10px;
                background: rgba(255,255,255,0.03);
                margin-bottom: 8px;
                border-radius: 3px;
              }
              .module-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
              }
              .module-id {
                font-weight: bold;
                color: #ccc;
              }
              .module-version {
                font-size: 12px;
                color: #666;
              }
              .module-path {
                font-size: 11px;
                color: #666;
                margin-top: 4px;
              }
              .empty-state {
                color: #888;
                padding: 20px;
                text-align: center;
              }
            </style>

            <div class="hot-reload-panel">
              <h3>☄ Hot Reload</h3>

              <div class="controls">
                <button class="cleanup">⛶ Cleanup</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card modules">
                  <div class="stat-label">Active Modules</div>
                  <div class="stat-value modules">${stats.totalModules}</div>
                </div>
                <div class="stat-card reloads">
                  <div class="stat-label">Total Reloads</div>
                  <div class="stat-value reloads">${totalReloads}</div>
                </div>
                <div class="stat-card rate">
                  <div class="stat-label">Modules</div>
                  <div class="stat-value rate">${stats.totalModules}</div>
                </div>
              </div>

              <h4>Active Modules (${moduleRegistry.size})</h4>
              <div class="module-list">
                ${stats.modules.length > 0 ? stats.modules.map(module => `
                  <div class="module-item">
                    <div class="module-header">
                      <span class="module-id">${module.id}</span>
                      <span class="module-version">v${module.version}</span>
                    </div>
                    <div class="module-path">${module.sourcePath}</div>
                  </div>
                `).join('') : '<div class="empty-state">No active modules</div>'}
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.cleanup')?.addEventListener('click', () => {
            cleanup();
            if (typeof EventBus !== 'undefined') {
              EventBus.emit('toast:success', { message: 'Hot reload cleaned up' });
            }
            this.render();
          });
        }
      }

      if (!customElements.get('hot-reload-widget')) {
        customElements.define('hot-reload-widget', HotReloadWidget);
      }

      return {
        element: 'hot-reload-widget',
        displayName: 'Hot Reload',
        icon: '☄',
        category: 'core'
      };
    })();

    // Public API
    return {
      api: {
        createModule,
        reloadModule,
        onModuleUpdate,
        createSafeContext,
        executeSafe,
        patchFunction,
        profileModule,
        getStats,
        cleanup
      },
      widget
    };
  }
};

// Legacy compatibility wrapper
const HotReloadModule = (logger, StateManager, Storage) => {
  const instance = HotReload.factory({ logger, StateManager, Storage });
  return instance.api;
};

// Export both formats
HotReload;
HotReloadModule;