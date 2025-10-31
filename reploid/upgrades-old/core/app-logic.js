// @blueprint 0x000002 - Details the app-logic.js module's role in loading other modules.
// REPLOID Core Logic - Project Phoenix Edition
// This module orchestrates the agent's boot sequence using a Dependency Injection container.

// Widget tracking state (global for boot process)
const _bootStats = {
  startTime: null,
  endTime: null,
  totalDuration: null,
  modulesLoaded: [],
  moduleErrors: [],
  status: 'not_started'
};

const CoreLogicModule = async (initialConfig, vfs) => {
  _bootStats.startTime = Date.now();
  _bootStats.status = 'booting';

  console.log("[CoreLogic] Phoenix Edition: Starting agent initialization...");

  try {
    // Manually load and instantiate the foundational Utils module using ES import
    const utilsContent = await vfs.read("/upgrades/core/utils.js");
    const utilsBlob = new Blob([utilsContent], { type: 'text/javascript' });
    const utilsUrl = URL.createObjectURL(utilsBlob);
    const utilsModule = await import(/* webpackIgnore: true */ utilsUrl);
    URL.revokeObjectURL(utilsUrl);
    const Utils = utilsModule.default.factory();
    const { logger } = Utils;

    logger.info("[CoreLogic] Utils loaded. Initializing DI Container.");

    // Load and instantiate the DI Container using ES import
    const diContainerContent = await vfs.read("/upgrades/core/di-container.js");
    const diBlob = new Blob([diContainerContent], { type: 'text/javascript' });
    const diUrl = URL.createObjectURL(diBlob);
    const diModule = await import(/* webpackIgnore: true */ diUrl);
    URL.revokeObjectURL(diUrl);
    const DIContainerModule = diModule.default;
    const { api: container } = DIContainerModule().factory({ Utils });

    // Expose container globally for lazy dependency resolution
    globalThis.DIContainer = container;

    // Load config.json and register it as a module
    logger.info("[CoreLogic] Loading configuration...");
    const configContent = await vfs.read("/config.json");
    const config = JSON.parse(configContent);
    const configModule = {
        metadata: { id: 'config', type: 'pure' },
        factory: () => config
    };
    container.register(configModule);

    // Load and register the active Persona
    logger.info("[CoreLogic] Loading active persona...");
    const activePersonaId = initialConfig?.persona?.id || 'multi_mind_synthesis'; // Default to multi_mind_synthesis
    const personaModuleName = activePersonaId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Persona';
    const personaPath = `/personas/${personaModuleName}.js`;

    try {
        const personaContent = await vfs.read(personaPath);
        // Load persona using ES import
        const personaBlob = new Blob([personaContent], { type: 'text/javascript' });
        const personaUrl = URL.createObjectURL(personaBlob);
        const personaImport = await import(/* webpackIgnore: true */ personaUrl);
        URL.revokeObjectURL(personaUrl);
        const PersonaModule = personaImport.default;
        // Register it with a generic 'Persona' ID for the agent cycle to consume
        container.register({ ...PersonaModule, metadata: { ...PersonaModule.metadata, id: 'Persona' } });
        logger.info(`[CoreLogic] Active persona '${personaModuleName}' registered as 'Persona'.`);
    } catch (e) {
        logger.warn(`[CoreLogic] Could not load persona '${activePersonaId}' from ${personaPath}. Proceeding without a persona.`);
        // Register a dummy persona module if loading fails
        container.register({ metadata: { id: 'Persona', type: 'persona' }, factory: () => ({}) });
    }


    // Load module from ES module code
    const loadModuleFromContent = async (code, path) => {
      // Create blob URL for ES module import
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      try {
        // Import the module
        const importedModule = await import(/* webpackIgnore: true */ url);
        const exported = importedModule?.default;

        // Validate module structure
        if (!exported || !exported.metadata || !exported.factory) {
          const error = new Error(
            `[CoreLogic] Invalid module structure at ${path}.\n` +
            `All modules must export { metadata: {...}, factory: (deps) => {...} }.\n` +
            `See blueprint 0x00001F (Universal Module Loader) for requirements.\n` +
            `\nModule export structure:\n` +
            `  - has default export: ${!!exported}\n` +
            `  - has metadata: ${!!(exported?.metadata)}\n` +
            `  - has factory: ${!!(exported?.factory)}\n`
          );
          logger.error(`[CoreLogic] Module load failed:`, error.message);
          throw error;
        }

        logger.debug(`[CoreLogic] Loaded module: ${exported.metadata.id} from ${path}`);
        return exported;

      } catch (err) {
        // If the error is already our validation error, re-throw it
        if (err.message.includes('Invalid module structure')) {
          throw err;
        }

        // Otherwise, wrap the import error with context
        const error = new Error(
          `[CoreLogic] Failed to import module at ${path}.\n` +
          `Error: ${err.message}\n` +
          `\nEnsure the module:\n` +
          `  1. Uses ES module syntax (export default)\n` +
          `  2. Exports an object with { metadata, factory }\n` +
          `  3. Has no syntax errors\n` +
          `See blueprint 0x00001F for module structure requirements.`
        );
        logger.error(`[CoreLogic] Module import error:`, error.message);
        throw error;

      } finally {
        // Clean up blob URL
        URL.revokeObjectURL(url);
      }
    };

    /**
     * Topological sort for module dependency graph
     * @param {Array} modules - Array of module objects with metadata.id and metadata.dependencies
     * @returns {Array} - Topologically sorted array of modules
     */
    const topologicalSort = (modules) => {
      const sorted = [];
      const visited = new Set();
      const visiting = new Set();
      const moduleMap = new Map();

      // Build module map for quick lookup
      for (const module of modules) {
        if (module && module.metadata && module.metadata.id) {
          moduleMap.set(module.metadata.id, module);
        }
      }

      const visit = (moduleId) => {
        // Already processed
        if (visited.has(moduleId)) return;

        // Cycle detection
        if (visiting.has(moduleId)) {
          logger.warn(`[CoreLogic] Circular dependency detected involving: ${moduleId}`);
          return;
        }

        const module = moduleMap.get(moduleId);
        if (!module) {
          // Module not found - might be optional or external
          return;
        }

        visiting.add(moduleId);

        // Visit dependencies first
        const dependencies = module.metadata.dependencies || [];
        for (const dep of dependencies) {
          // Strip optional marker '?'
          const depId = dep.endsWith('?') ? dep.slice(0, -1) : dep;
          visit(depId);
        }

        visiting.delete(moduleId);
        visited.add(moduleId);
        sorted.push(module);
      };

      // Visit all modules
      for (const module of modules) {
        if (module && module.metadata && module.metadata.id) {
          visit(module.metadata.id);
        }
      }

      return sorted;
    };

    // Load module manifest for dynamic module loading
    logger.info("[CoreLogic] Loading module manifest...");
    const manifestContent = await vfs.read("/module-manifest.json");
    const manifest = JSON.parse(manifestContent);

    logger.info(`[CoreLogic] Manifest version ${manifest.version} loaded`);

    // Get the boot mode from initial config to determine which preset to load
    const bootMode = initialConfig?.bootMode || 'meta';
    logger.info(`[CoreLogic] Boot mode: ${bootMode}, loading modules from preset`);

    // Get module paths from the selected preset (these are the ones already in VFS)
    const presetPaths = manifest.presets?.[bootMode] || manifest.presets?.meta || [];
    logger.info(`[CoreLogic] Loading ${presetPaths.length} modules from '${bootMode}' preset`);

    // Create module file list from preset paths
    const moduleFiles = presetPaths.map(path => {
      // Extract module ID from path (e.g., /upgrades/core/utils.js -> Utils)
      const filename = path.split('/').pop().replace('.js', '');
      const id = filename.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
      return { id, path };
    });

    // Load and register all modules
    logger.info("[CoreLogic] Loading and registering all application modules...");
    logger.info(`[CoreLogic] Total module files to load: ${moduleFiles.length}`);
    logger.info(`[CoreLogic] Module list includes agent-logic-pure: ${moduleFiles.some(f => f.path.includes('agent-logic-pure'))}`);

    const moduleContents = await Promise.all(moduleFiles.map(spec => vfs.read(spec.path)));

    logger.info(`[CoreLogic] Module contents loaded: ${moduleContents.length} items`);
    logger.info(`[CoreLogic] agent-logic-pure content length: ${moduleContents[moduleFiles.findIndex(f => f.path.includes('agent-logic-pure'))]?.length || 'NOT FOUND'}`);

    // STEP 1: Parse all module metadata (without registering yet)
    const parsedModules = [];
    for (let i = 0; i < moduleContents.length; i++) {
      const content = moduleContents[i];
      const fileSpec = moduleFiles[i];
      const filePath = fileSpec.path;

      if (!content) {
        logger.warn(`[CoreLogic] No content returned for ${filePath}; skipping module.`);
        continue;
      }

      // Special debug logging for agent-logic-pure
      if (filePath.includes('agent-logic-pure')) {
        logger.info(`[CoreLogic] Loading agent-logic-pure.js (size: ${content.length})`);
      }

      const module = await loadModuleFromContent(content, filePath);

      // Special debug logging for agent-logic-pure
      if (filePath.includes('agent-logic-pure')) {
        logger.info(`[CoreLogic] agent-logic-pure.js loaded:`, {
          hasModule: !!module,
          hasMetadata: !!(module && module.metadata),
          moduleType: typeof module,
          moduleKeys: module ? Object.keys(module) : [],
          metadataId: module?.metadata?.id,
          factoryType: module?.factory ? typeof module.factory : 'undefined'
        });
      }

      // Debug logging for problematic modules
      if (!module || !module.metadata) {
        logger.error(`[CoreLogic] Module load failed for ${filePath}:`, {
          hasModule: !!module,
          hasMetadata: !!(module && module.metadata),
          moduleKeys: module ? Object.keys(module) : [],
          metadataId: module?.metadata?.id
        });
        _bootStats.moduleErrors.push({
          path: filePath,
          error: 'Missing metadata',
          timestamp: Date.now()
        });
      } else {
        // Store module with path for later registration
        parsedModules.push({ module, filePath });
      }
    }

    logger.info(`[CoreLogic] Parsed ${parsedModules.length} modules, performing topological sort...`);

    // STEP 2: Topologically sort modules based on dependencies
    const modulesToSort = parsedModules.map(pm => pm.module);
    const sortedModules = topologicalSort(modulesToSort);

    logger.info(`[CoreLogic] Topological sort complete. Registration order:`);
    sortedModules.slice(0, 10).forEach((m, idx) => {
      const deps = m.metadata.dependencies || [];
      logger.info(`  ${idx + 1}. ${m.metadata.id} (deps: ${deps.length ? deps.join(', ') : 'none'})`);
    });
    if (sortedModules.length > 10) {
      logger.info(`  ... and ${sortedModules.length - 10} more modules`);
    }

    // STEP 3: Register modules in topological order
    for (const module of sortedModules) {
      if (module.metadata.id === 'config') {
        continue; // Skip config, it's handled separately
      }

      const moduleLoadStart = Date.now();
      container.register(module);
      const moduleLoadEnd = Date.now();

      // Find original path for this module
      const originalModule = parsedModules.find(pm => pm.module === module);
      const filePath = originalModule?.filePath || 'unknown';

      // Track module load
      _bootStats.modulesLoaded.push({
        id: module.metadata.id,
        path: filePath,
        loadTime: moduleLoadEnd - moduleLoadStart,
        timestamp: moduleLoadEnd
      });
    }

    logger.info(`[CoreLogic] Registered ${_bootStats.modulesLoaded.length} modules successfully. Resolving main services.`);

    // Resolve the main application services
    const CycleLogic = await container.resolve('AgentCycleStructured');

    // Initialize UI if available (not needed in headless mode)
    let UI = null;
    try {
        UI = await container.resolve('UI');
        logger.info("[CoreLogic] UI module resolved successfully");
        if (UI && UI.init) {
            logger.info("[CoreLogic] Calling UI.init()...");
            await UI.init();
            logger.info("[CoreLogic] UI.init() completed successfully");
        } else {
            logger.warn("[CoreLogic] UI module has no init() method");
        }
    } catch (e) {
        logger.error("[CoreLogic] UI initialization failed:", e.message);
        logger.error("[CoreLogic] UI error stack:", e.stack);
    }

    // Initialize GitVFS for version control
    try {
        const GitVFS = await container.resolve('GitVFS');
        if (GitVFS && GitVFS.init) {
            await GitVFS.init();
            logger.info("[CoreLogic] GitVFS initialized for version control");
        }
    } catch (gitError) {
        logger.warn("[CoreLogic] GitVFS initialization failed, continuing without Git support:", gitError.message);
    }

    // Initialize the interactive diff viewer
    console.log('[CoreLogic] Attempting to initialize DiffViewerUI...');
    try {
        console.log('[CoreLogic] Resolving DiffViewerUI from container...');
        const DiffViewerUI = await container.resolve('DiffViewerUI');
        console.log('[CoreLogic] DiffViewerUI resolved:', DiffViewerUI);
        console.log('[CoreLogic] DiffViewerUI.init exists?', typeof DiffViewerUI?.init);

        if (DiffViewerUI && DiffViewerUI.init) {
            // Use the existing diff-viewer div from ui-dashboard.html
            const diffViewerId = 'diff-viewer';
            const diffViewerElement = document.getElementById(diffViewerId);
            console.log('[CoreLogic] Looking for element with id:', diffViewerId);
            console.log('[CoreLogic] Element found:', diffViewerElement);

            if (diffViewerElement) {
                console.log('[CoreLogic] Calling DiffViewerUI.init()...');
                DiffViewerUI.init(diffViewerId);
                console.log('[CoreLogic] DiffViewerUI.init() completed');
                logger.info("[CoreLogic] DiffViewerUI initialized");
            } else {
                console.warn('[CoreLogic] Diff viewer container not found in UI');
                logger.warn("[CoreLogic] Diff viewer container not found in UI");
            }
        } else {
            console.warn('[CoreLogic] DiffViewerUI or DiffViewerUI.init not available');
        }
    } catch (diffError) {
        console.error('[CoreLogic] DiffViewerUI initialization error:', diffError);
        logger.warn("[CoreLogic] DiffViewerUI initialization failed:", diffError.message);
    }

    logger.info("[CoreLogic] Agent initialization complete. System is operational.");

    // ============================================================
    // GENESIS BOOTSTRAP: Catalog VFS files as birth context
    // ============================================================
    logger.info("[CoreLogic] Running genesis bootstrap...");
    try {
      // List all files in VFS to create birth context
      const allFiles = [];
      const walkDir = async (dir) => {
        try {
          const entries = await vfs.fs.promises.readdir(dir);
          for (const entry of entries) {
            const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
            try {
              const stat = await vfs.fs.promises.stat(fullPath);
              if (stat.isDirectory()) {
                await walkDir(fullPath);
              } else if (stat.isFile()) {
                allFiles.push(fullPath);
              }
            } catch (e) {
              // Skip unreadable files
            }
          }
        } catch (e) {
          // Skip unreadable directories
        }
      };

      await walkDir('/');
      logger.info(`[CoreLogic] Genesis: Found ${allFiles.length} files in VFS`);

      // Create genesis context bundle (simple catalog)
      const genesisContext = {
        timestamp: new Date().toISOString(),
        bootMode: initialConfig.bootMode,
        totalFiles: allFiles.length,
        files: allFiles.map(path => ({
          path,
          type: path.endsWith('.js') ? 'module' :
                path.endsWith('.json') ? 'config' :
                path.endsWith('.md') ? 'documentation' : 'other'
        })),
        modules: allFiles
          .filter(f => f.includes('/upgrades/') && f.endsWith('.js'))
          .map(f => f.replace('/upgrades/', '').replace('.js', '')),
        config: allFiles.filter(f => f.endsWith('.json')),
        personas: allFiles.filter(f => f.includes('/personas/'))
      };

      // Save genesis context to VFS
      const genesisMarkdown = `# Genesis Bootstrap Context

**Timestamp:** ${genesisContext.timestamp}
**Boot Mode:** ${genesisContext.bootMode}
**Total Files:** ${genesisContext.totalFiles}

## Loaded Modules (${genesisContext.modules.length})
${genesisContext.modules.map(m => `- ${m}`).join('\n')}

## Configuration Files (${genesisContext.config.length})
${genesisContext.config.map(c => `- ${c}`).join('\n')}

## Personas (${genesisContext.personas.length})
${genesisContext.personas.map(p => `- ${p}`).join('\n')}

## All Files
${genesisContext.files.map(f => `- [${f.type}] ${f.path}`).join('\n')}

---
*This is the agent's birth memory - a catalog of all source code present at initialization.*
`;

      await vfs.write('/system/genesis-context.md', genesisMarkdown);
      await vfs.write('/system/genesis-context.json', JSON.stringify(genesisContext, null, 2));

      logger.info("[CoreLogic] Genesis bootstrap complete - birth context saved to /system/genesis-context.md");
      logger.info(`[CoreLogic] Genesis summary: ${genesisContext.totalFiles} files, ${genesisContext.modules.length} modules`);
    } catch (genesisError) {
      logger.warn("[CoreLogic] Genesis bootstrap failed (non-fatal):", genesisError.message);
    }

    // Mark boot as complete
    _bootStats.endTime = Date.now();
    _bootStats.totalDuration = _bootStats.endTime - _bootStats.startTime;
    _bootStats.status = 'ready';

    // Save genesis snapshot after initialization
    logger.info("[CoreLogic] Creating genesis snapshot of initial boot state...");
    try {
        const GenesisSnapshot = await container.resolve('GenesisSnapshot');
        if (GenesisSnapshot) {
            const genesisData = {
                persona: config.persona || initialConfig.persona,
                upgrades: Array.from(container.registry.values())
                    .filter(m => m.metadata && m.metadata.id !== 'config')
                    .map(m => ({
                        id: m.metadata.id,
                        path: m.metadata.path || `${m.metadata.id}.js`,
                        category: m.metadata.category || 'unknown'
                    })),
                config: config,
                vfs: vfs,
                timestamp: new Date().toISOString()
            };

            await GenesisSnapshot.saveGenesisSnapshot(genesisData);
            logger.info("[CoreLogic] Genesis snapshot created successfully");
        } else {
            logger.warn("[CoreLogic] GenesisSnapshot module not available");
        }
    } catch (genesisError) {
        logger.warn("[CoreLogic] Failed to create genesis snapshot (non-fatal):", genesisError.message);
    }

    // Boot container will be hidden by boot.js after loading overlay clears
    // Just ensure app root is visible and ready
    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.style.display = "block";
      appRoot.style.visibility = "visible";
    }

    // Set the goal in UI if provided (but don't start cycle yet - boot.js will do that)
    if (initialConfig && initialConfig.goal) {
      logger.info("[CoreLogic] Initial goal set:", initialConfig.goal);
      try {
        if (UI.updateGoal) {
          UI.updateGoal(initialConfig.goal);
        }
      } catch (e) {
        logger.warn("[CoreLogic] Could not update goal in UI:", e.message);
      }
    }

    // Return container and goal so boot.js can start the cycle after clearing boot screen
    return {
      container,
      goal: initialConfig?.goal || null
    };

  } catch (error) {
    // Track boot failure
    _bootStats.endTime = Date.now();
    _bootStats.totalDuration = _bootStats.endTime - _bootStats.startTime;
    _bootStats.status = 'failed';
    _bootStats.moduleErrors.push({
      error: error.message,
      stack: error.stack,
      timestamp: Date.now()
    });

    handleInitializationError(error);

    // Re-throw so boot.js can handle it
    throw error;
  }
};

// Handle initialization errors
function handleInitializationError(error) {
  console.error("[CoreLogic] Initialization failed:", error);
  
  const appRoot = document.getElementById("app-root");
  if (appRoot) {
    appRoot.style.display = "block";
    appRoot.innerHTML = `
      <div style="color: red; padding: 2em; font-family: monospace;">
        <h1>FATAL ERROR</h1>
        <p>Agent Awakening Failed: ${error.message}</p>
        <pre>${error.stack}</pre>
        <hr>
        <p style="color: #888;">
          This may be due to missing or corrupt modules in the Virtual File System.
          Please check the console for more details.
        </p>
      </div>
    `;
  }
}

// Make CoreLogicModule available
CoreLogicModule;

// AppLogic module for DI container (provides boot stats via widget)
const AppLogic = {
  metadata: {
    id: 'AppLogic',
    version: '1.0.0',
    dependencies: [],
    async: false,
    type: 'service'
  },

  factory: (deps = {}) => {
    // Web Component Widget (defined inside factory to access closure state)
    class AppLogicWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // No auto-refresh needed - boot stats are static after boot
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      getStatus() {
        const durationSec = _bootStats.totalDuration ? (_bootStats.totalDuration / 1000).toFixed(2) : '—';

        return {
          state: _bootStats.status === 'ready' ? 'idle' : (_bootStats.status === 'failed' ? 'error' : 'active'),
          primaryMetric: _bootStats.status === 'ready' ? 'Ready' : _bootStats.status,
          secondaryMetric: `${durationSec}s`,
          lastActivity: _bootStats.endTime,
          message: `${_bootStats.modulesLoaded.length} modules loaded`
        };
      }

      getControls() {
        return [];
      }

      renderPanel() {
        const durationMs = _bootStats.totalDuration || 0;
        const durationSec = (durationMs / 1000).toFixed(2);

        const sortedModules = [..._bootStats.modulesLoaded].sort((a, b) => b.loadTime - a.loadTime);
        const slowestModules = sortedModules.slice(0, 10);
        const avgLoadTime = _bootStats.modulesLoaded.length > 0
          ? (_bootStats.modulesLoaded.reduce((sum, m) => sum + m.loadTime, 0) / _bootStats.modulesLoaded.length).toFixed(2)
          : 0;

        const statusColors = {
          'not_started': 'rgba(150,150,150,0.1)',
          'booting': 'rgba(255,165,0,0.1)',
          'ready': 'rgba(0,200,100,0.1)',
          'failed': 'rgba(255,0,0,0.1)'
        };

        const statusColor = statusColors[_bootStats.status] || statusColors.not_started;

        return `
          <div class="widget-panel">
            <h3>☱ Boot Statistics</h3>
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px;">
              <div style="padding: 12px; background: ${statusColor}; border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Status</div>
                <div style="font-size: 1.2em; font-weight: bold; text-transform: uppercase;">${_bootStats.status}</div>
              </div>
              <div style="padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Total Time</div>
                <div style="font-size: 1.2em; font-weight: bold;">${durationSec}s</div>
              </div>
              <div style="padding: 12px; background: rgba(0,200,100,0.1); border-radius: 4px;">
                <div style="font-size: 0.85em; color: #888;">Modules</div>
                <div style="font-size: 1.2em; font-weight: bold;">${_bootStats.modulesLoaded.length}</div>
              </div>
            </div>

            ${_bootStats.moduleErrors.length > 0 ? `
              <h3 style="margin-top: 20px;">⚠️ Module Errors (${_bootStats.moduleErrors.length})</h3>
              <div style="margin-top: 12px; max-height: 200px; overflow-y: auto;">
                ${_bootStats.moduleErrors.map(err => `
                  <div style="padding: 8px; background: rgba(255,0,0,0.1); border-left: 3px solid #ff6b6b; border-radius: 4px; margin-bottom: 6px;">
                    <div style="font-weight: bold; color: #ff6b6b; font-size: 0.9em;">${err.path || 'Boot Error'}</div>
                    <div style="color: #aaa; font-size: 0.85em; margin-top: 4px;">${err.error}</div>
                  </div>
                `).join('')}
              </div>
            ` : ''}

            <h3 style="margin-top: 20px;">⌇ Slowest Modules (Top 10)</h3>
            <div style="margin-top: 12px;">
              ${slowestModules.length > 0 ? slowestModules.map((mod, idx) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 4px;">
                  <div style="flex: 1;">
                    <div style="font-size: 0.85em; color: #888;">#${idx + 1}</div>
                    <div style="font-size: 0.9em; font-weight: bold;">${mod.id}</div>
                    <div style="font-size: 0.8em; color: #666;">${mod.path}</div>
                  </div>
                  <div style="text-align: right; padding-left: 12px;">
                    <div style="font-weight: bold; color: ${mod.loadTime > 100 ? '#ff6b6b' : mod.loadTime > 50 ? '#ffa500' : '#0c0'};">${mod.loadTime}ms</div>
                  </div>
                </div>
              `).join('') : '<div style="color: #888; font-style: italic;">No modules loaded yet</div>'}
            </div>

            <h3 style="margin-top: 20px;">⤊ Load Timeline</h3>
            <div style="margin-top: 12px; max-height: 300px; overflow-y: auto;">
              ${_bootStats.modulesLoaded.map((mod, idx) => {
                const relativeTime = _bootStats.startTime ? ((mod.timestamp - _bootStats.startTime) / 1000).toFixed(2) : '—';
                return `
                  <div style="padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 3px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between;">
                      <span style="color: #888;">+${relativeTime}s</span>
                      <span>${mod.id}</span>
                      <span style="color: #666;">${mod.loadTime}ms</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
              <strong>☱ Summary</strong>
              <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                ${_bootStats.modulesLoaded.length} modules loaded in ${durationSec}s<br>
                Average load time: ${avgLoadTime}ms per module<br>
                Errors: ${_bootStats.moduleErrors.length}
              </div>
            </div>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: system-ui, -apple-system, sans-serif;
              color: #ccc;
            }

            .widget-panel {
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
            }

            h3 {
              margin: 16px 0 8px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h3:first-child {
              margin-top: 0;
            }
          </style>

          ${this.renderPanel()}
        `;
      }
    }

    // Define custom element
    const elementName = 'app-logic-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, AppLogicWidget);
    }

    return {
      api: {
        getBootStats: () => ({ ..._bootStats })
      },
      widget: {
        element: elementName,
        displayName: 'Boot Orchestrator',
        icon: '⛻',
        category: 'core',
        updateInterval: null
      }
    };
  }
};

// Export CoreLogicModule as default for boot.js to import
export default CoreLogicModule;

// Also export AppLogic module for DI container
export { AppLogic };
