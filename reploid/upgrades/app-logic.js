// REPLOID Core Logic - Project Phoenix Edition
// This module orchestrates the agent's boot sequence using a Dependency Injection container.

const CoreLogicModule = async (initialConfig, vfs) => {
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
    const moduleFiles = [
      "/upgrades/utils.js",
      "/upgrades/event-bus.js",
      "/upgrades/di-container.js",
      "/upgrades/state-helpers-pure.js",
      "/upgrades/tool-runner-pure-helpers.js",
      "/upgrades/agent-logic-pure.js",
      "/upgrades/storage-indexeddb.js",
      "/upgrades/state-manager.js",
      "/upgrades/api-client.js",
      "/upgrades/tool-runner.js",
      "/upgrades/diff-generator.js",
      "/upgrades/ui-manager.js",
      "/upgrades/agent-cycle.js",
      // Sentinel modules
      "/upgrades/git-vfs.js",
      "/upgrades/sentinel-tools.js",
      "/upgrades/diff-viewer-ui.js",
      "/upgrades/sentinel-fsm.js"
    ];

    // Load and register all modules
    logger.info("[CoreLogic] Loading and registering all application modules...");
    const moduleContents = await Promise.all(moduleFiles.map(path => vfs.read(path)));
    
    for (let i = 0; i < moduleContents.length; i++) {
      const content = moduleContents[i];
      const filePath = moduleFiles[i];

      // DANGER: This uses Function constructor. Assumes VFS content is trusted.
      // Extended to handle Sentinel modules
      const module = new Function(content + `
        return (typeof CycleLogic !== 'undefined') ? CycleLogic :
               (typeof StateManager !== 'undefined') ? StateManager :
               (typeof ApiClient !== 'undefined') ? ApiClient :
               (typeof ToolRunner !== 'undefined') ? ToolRunner :
               (typeof UI !== 'undefined') ? UI :
               (typeof Utils !== 'undefined') ? Utils :
               (typeof DIContainer !== 'undefined') ? DIContainer :
               (typeof StateHelpersPure !== 'undefined') ? StateHelpersPure :
               (typeof ToolRunnerPureHelpers !== 'undefined') ? ToolRunnerPureHelpers :
               (typeof AgentLogicPureHelpers !== 'undefined') ? AgentLogicPureHelpers :
               (typeof Storage !== 'undefined') ? Storage :
               (typeof DiffGenerator !== 'undefined') ? DiffGenerator :
               (typeof GitVFS !== 'undefined') ? GitVFS :
               (typeof SentinelTools !== 'undefined') ? SentinelTools :
               (typeof DiffViewerUI !== 'undefined') ? DiffViewerUI :
               (typeof SentinelFSM !== 'undefined') ? SentinelFSM :
               (typeof EventBus !== 'undefined') ? EventBus :
               undefined;`)();

      if (module && module.metadata && module.metadata.id !== 'config') {
        container.register(module);
        logger.debug(`[CoreLogic] Registered module: ${module.metadata.id} from ${filePath}`);
      }
    }

    logger.info("[CoreLogic] All modules registered. Resolving main services.");

    // Resolve the main application services
    const CycleLogic = await container.resolve('CycleLogic');
    const UI = await container.resolve('UI');

    // The UI's init was designed to take dependencies. In a pure DI system,
    // this would be handled differently, but we adapt for now.
    const StateManager = await container.resolve('StateManager');
    if (UI.init) {
        await UI.init(StateManager, CycleLogic);
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
    try {
        const DiffViewerUI = await container.resolve('DiffViewerUI');
        if (DiffViewerUI && DiffViewerUI.init) {
            // Use the existing diff-viewer div from ui-dashboard.html
            const diffViewerId = 'diff-viewer';
            if (document.getElementById(diffViewerId)) {
                DiffViewerUI.init(diffViewerId);
                logger.info("[CoreLogic] DiffViewerUI initialized");
            } else {
                logger.warn("[CoreLogic] Diff viewer container not found in UI");
            }
        }
    } catch (diffError) {
        logger.warn("[CoreLogic] DiffViewerUI initialization failed:", diffError.message);
    }

    logger.info("[CoreLogic] Agent initialization complete. System is operational.");

    // Hide boot container and show app
    const bootContainer = document.getElementById("boot-container");
    const appRoot = document.getElementById("app-root");
    if (bootContainer) bootContainer.style.display = "none";
    if (appRoot) appRoot.style.display = "block";

  } catch (error) {
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