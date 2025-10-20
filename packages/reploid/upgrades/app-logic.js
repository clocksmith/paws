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
    // Manually load and instantiate the foundational Utils module
    const utilsContent = await vfs.read("/upgrades/utils.js");
    const Utils = new Function(utilsContent + "\nreturn Utils;")().factory();
    const { logger } = Utils;

    logger.info("[CoreLogic] Utils loaded. Initializing DI Container.");

    // Load and instantiate the DI Container
    const diContainerContent = await vfs.read("/upgrades/di-container.js");
    const DIContainerModule = new Function(diContainerContent + "\nreturn DIContainer;");
    const container = DIContainerModule().factory({ Utils });

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
    const activePersonaId = initialConfig?.persona?.id || 'code_refactorer'; // Default to code_refactorer
    const personaModuleName = activePersonaId.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Persona';
    const personaPath = `/personas/${personaModuleName}.js`;

    try {
        const personaContent = await vfs.read(personaPath);
        const PersonaModule = new Function(personaContent + `\nreturn ${personaModuleName};`)();
        // Register it with a generic 'Persona' ID for the agent cycle to consume
        container.register({ ...PersonaModule, metadata: { ...PersonaModule.metadata, id: 'Persona' } });
        logger.info(`[CoreLogic] Active persona '${personaModuleName}' registered as 'Persona'.`);
    } catch (e) {
        logger.warn(`[CoreLogic] Could not load persona '${activePersonaId}' from ${personaPath}. Proceeding without a persona.`);
        // Register a dummy persona module if loading fails
        container.register({ metadata: { id: 'Persona', type: 'persona' }, factory: () => ({}) });
    }


    // Define all modules to be loaded
    const transpileESMForEval = (code) => {
      const cleaned = code
        .replace(/import[^;]+;\s*/g, '')
        .replace(/import\s+\{[\s\S]*?\}\s+from\s+['"][^'"]+['"];?/g, '')
        .replace(/export\s+\{[\s\S]*?\};?/g, '');

      let transformed = cleaned.replace(/export\s+default\s+/g, 'return ');
      transformed = transformed.replace(/export\s+const\s+/g, 'const ');
      transformed = transformed.replace(/export\s+class\s+/g, 'class ');
      transformed = transformed.replace(/export\s+function\s+/g, 'function ');
      return transformed;
    };

    const evaluateLegacyModule = (code, path = '') => {
      const wrapped = `/* module: ${path} */
${code}
        return (typeof CycleLogic !== 'undefined') ? CycleLogic :
               (typeof StateManager !== 'undefined') ? StateManager :
               (typeof ApiClient !== 'undefined') ? ApiClient :
               (typeof ToolRunner !== 'undefined') ? ToolRunner :
               (typeof UI !== 'undefined') ? UI :
               (typeof Utils !== 'undefined') ? Utils :
               (typeof StateHelpersPure !== 'undefined') ? StateHelpersPure :
               (typeof ToolRunnerPureHelpers !== 'undefined') ? ToolRunnerPureHelpers :
               (typeof AgentLogicPureHelpers !== 'undefined') ? AgentLogicPureHelpers :
               (typeof DIContainer !== 'undefined') ? DIContainer :
               (typeof Storage !== 'undefined') ? Storage :
               (typeof DiffGenerator !== 'undefined') ? DiffGenerator :
               (typeof GitVFS !== 'undefined') ? GitVFS :
               (typeof SentinelTools !== 'undefined') ? SentinelTools :
               (typeof DiffViewerUIModule !== 'undefined') ? DiffViewerUIModule :
               (typeof DiffViewerUI !== 'undefined') ? DiffViewerUI :
               (typeof SentinelFSM !== 'undefined') ? SentinelFSM :
               (typeof MetaToolCreator !== 'undefined') ? MetaToolCreator :
               (typeof StreamingResponseHandler !== 'undefined') ? StreamingResponseHandler :
               (typeof ContextManager !== 'undefined') ? ContextManager :
               (typeof EventBus !== 'undefined') ? EventBus :
               (typeof LocalLLM !== 'undefined') ? LocalLLM :
               (typeof HybridLLMProvider !== 'undefined') ? HybridLLMProvider :
               (typeof RateLimiter !== 'undefined') ? RateLimiter :
               (typeof AuditLogger !== 'undefined') ? AuditLogger :
               (typeof AgentVisualizer !== 'undefined') ? AgentVisualizer :
               (typeof ApiClientMulti !== 'undefined') ? ApiClientMulti :
               (typeof AppLogic !== 'undefined') ? AppLogic :
               (typeof ASTVisualizer !== 'undefined') ? ASTVisualizer :
               (typeof AutonomousOrchestrator !== 'undefined') ? AutonomousOrchestrator :
               (typeof BackupRestore !== 'undefined') ? BackupRestore :
               (typeof BrowserAPIs !== 'undefined') ? BrowserAPIs :
               (typeof ConfirmationModal !== 'undefined') ? ConfirmationModal :
               (typeof CostTracker !== 'undefined') ? CostTracker :
               (typeof HotReload !== 'undefined') ? HotReload :
               (typeof InterTabCoordinator !== 'undefined') ? InterTabCoordinator :
               (typeof Introspector !== 'undefined') ? Introspector :
               (typeof MetricsDashboard !== 'undefined') ? MetricsDashboard :
               (typeof ModuleGraphVisualizer !== 'undefined') ? ModuleGraphVisualizer :
               (typeof ModuleIntegrity !== 'undefined') ? ModuleIntegrity :
               (typeof MultiProviderAPI !== 'undefined') ? MultiProviderAPI :
               (typeof PenteractAnalytics !== 'undefined') ? PenteractAnalytics :
               (typeof PenteractVisualizer !== 'undefined') ? PenteractVisualizer :
               (typeof PerformanceMonitor !== 'undefined') ? PerformanceMonitor :
               (typeof PerformanceOptimizer !== 'undefined') ? PerformanceOptimizer :
               (typeof PyodideRuntime !== 'undefined') ? PyodideRuntime :
               (typeof PythonTool !== 'undefined') ? PythonTool :
               (typeof ReflectionAnalyzer !== 'undefined') ? ReflectionAnalyzer :
               (typeof ReflectionSearch !== 'undefined') ? ReflectionSearch :
               (typeof ReflectionStore !== 'undefined') ? ReflectionStore :
               (typeof RFCAuthor !== 'undefined') ? RFCAuthor :
               (typeof SelfTester !== 'undefined') ? SelfTester :
               (typeof WebRTCCoordinator !== 'undefined') ? WebRTCCoordinator :
               (typeof TabCoordinator !== 'undefined') ? TabCoordinator :
               (typeof ToastNotifications !== 'undefined') ? ToastNotifications :
               (typeof ToolAnalytics !== 'undefined') ? ToolAnalytics :
               (typeof ToolDocGenerator !== 'undefined') ? ToolDocGenerator :
               (typeof TutorialSystem !== 'undefined') ? TutorialSystem :
               (typeof VerificationManager !== 'undefined') ? VerificationManager :
               (typeof VFSExplorer !== 'undefined') ? VFSExplorer :
               (typeof VDAT !== 'undefined') ? VDAT :
               (typeof VRSI !== 'undefined') ? VRSI :
               (typeof WebRTCSwarm !== 'undefined') ? WebRTCSwarm :
               (typeof WorkerPool !== 'undefined') ? WorkerPool :
               undefined;`;

      try {
        return new Function(wrapped)();
      } catch (err) {
        console.error(`[CoreLogic] Legacy evaluation failed for ${path}:`, err);
        throw err;
      }
    };

    const importESModule = async (code, path) => {
      const blob = new Blob([code], { type: 'text/javascript' });
      const url = URL.createObjectURL(blob);

      try {
        const importedModule = await import(/* webpackIgnore: true */ url);
        const candidate =
          importedModule?.default ||
          Object.values(importedModule).find(value => value && typeof value === 'object' && value.metadata) ||
          importedModule;

        if (!candidate || !candidate.metadata) {
          console.warn(`[CoreLogic] ESM module at ${path} did not expose metadata; registration may fail.`);
        }

        return candidate;
      } catch (err) {
        console.warn(`[CoreLogic] Failed to import ESM module at ${path}; falling back to legacy evaluator.`, err);
        return evaluateLegacyModule(transpileESMForEval(code), path);
      } finally {
        URL.revokeObjectURL(url);
      }
    };

    const loadModuleFromContent = async (code, path) => {
      const isESModule = /^\s*export\s+/m.test(code) || /^\s*import\s+/m.test(code);
      if (isESModule) {
        const imported = await importESModule(code, path);
        if (imported && imported.metadata) {
          return imported;
        }
        console.warn(`[CoreLogic] ESM module at ${path} did not expose metadata; attempting legacy evaluation fallback.`);
        return evaluateLegacyModule(transpileESMForEval(code), path);
      }
      const result = evaluateLegacyModule(code, path);
      console.log(`[CoreLogic] Loaded module from ${path}:`, result?.metadata?.id || 'NO_METADATA');
      return result;
    };

    // Load module manifest for dynamic module loading
    logger.info("[CoreLogic] Loading module manifest...");
    const manifestContent = await vfs.read("/module-manifest.json");
    const manifest = JSON.parse(manifestContent);

    logger.info(`[CoreLogic] Manifest version ${manifest.version} loaded with ${manifest.loadGroups.length} load groups`);

    // Flatten manifest into module file list for loading
    const moduleFiles = [];
    for (const group of manifest.loadGroups) {
      for (const moduleSpec of group.modules) {
        moduleFiles.push({
          id: moduleSpec.id,
          path: moduleSpec.path
        });
      }
    }

    // Load and register all modules
    logger.info("[CoreLogic] Loading and registering all application modules...");
    logger.info(`[CoreLogic] Total module files to load: ${moduleFiles.length}`);
    logger.info(`[CoreLogic] Module list includes agent-logic-pure: ${moduleFiles.some(f => f.path.includes('agent-logic-pure'))}`);

    const moduleContents = await Promise.all(moduleFiles.map(spec => vfs.read(spec.path)));

    logger.info(`[CoreLogic] Module contents loaded: ${moduleContents.length} items`);
    logger.info(`[CoreLogic] agent-logic-pure content length: ${moduleContents[moduleFiles.findIndex(f => f.path.includes('agent-logic-pure'))]?.length || 'NOT FOUND'}`);

    for (let i = 0; i < moduleContents.length; i++) {
      const content = moduleContents[i];
      const fileSpec = moduleFiles[i];
      const filePath = fileSpec.path;

      if (!content) {
        logger.warn(`[CoreLogic] No content returned for ${filePath}; skipping module registration.`);
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
      }

      if (module && module.metadata && module.metadata.id !== 'config') {
        const moduleLoadStart = Date.now();
        container.register(module);
        const moduleLoadEnd = Date.now();

        // Track module load
        _bootStats.modulesLoaded.push({
          id: module.metadata.id,
          path: filePath,
          loadTime: moduleLoadEnd - moduleLoadStart,
          timestamp: moduleLoadEnd
        });

        logger.info(`[CoreLogic] Registered module: ${module.metadata.id} from ${filePath}`);
      } else {
        // Track error
        _bootStats.moduleErrors.push({
          path: filePath,
          error: 'Missing metadata',
          timestamp: Date.now()
        });

        logger.warn(`[CoreLogic] Module at ${filePath} missing metadata. Module:`, module);
      }
    }

    logger.info("[CoreLogic] All modules registered. Resolving main services.");

    // Resolve the main application services
    const CycleLogic = await container.resolve('CycleLogic');
    const UI = await container.resolve('UI');

    // Initialize UI (StateManager is now injected via DI)
    if (UI.init) {
        await UI.init();
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

    // Hide boot container and show app
    const bootContainer = document.getElementById("boot-container");
    const appRoot = document.getElementById("app-root");
    if (bootContainer) bootContainer.style.display = "none";
    if (appRoot) appRoot.style.display = "block";

    // If a goal was provided, start the agent cycle
    if (initialConfig && initialConfig.goal) {
      logger.info("[CoreLogic] Starting agent with initial goal:", initialConfig.goal);

      try {
        // Update UI with the goal
        if (UI.updateGoal) {
          UI.updateGoal(initialConfig.goal);
        }

        // Start the agent cycle
        const SentinelFSM = await container.resolve('SentinelFSM');
        if (SentinelFSM && SentinelFSM.startCycle) {
          await SentinelFSM.startCycle(initialConfig.goal);
          logger.info("[CoreLogic] Agent cycle started successfully");
        } else {
          logger.error("[CoreLogic] SentinelFSM.startCycle not available");
        }
      } catch (startError) {
        logger.error("[CoreLogic] Failed to start agent cycle:", {
          name: startError.name,
          message: startError.message,
          stack: startError.stack,
          details: startError.details
        });
      }
    } else {
      logger.info("[CoreLogic] No initial goal provided. Agent is in IDLE state.");
    }

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

export default AppLogic;
