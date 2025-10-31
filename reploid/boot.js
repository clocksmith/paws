// REPLOID Bootstrap - Genesis Cycle & Agent Initialization
import { initModelConfig, hasModelsConfigured, getSelectedModels } from './boot/model-config.js';

console.log('[Boot] REPLOID starting...');

// Global reference to agent and modules
window.REPLOID = {
  vfs: null,
  llmClient: null,
  toolRunner: null,
  toolWriter: null,
  metaToolWriter: null,
  agentLoop: null,
  agentLog: null, // Renamed from chatUI
  codeViewer: null,
  substrateLoader: null,
  multiModelCoordinator: null
};

// Genesis: Copy core modules from disk to IndexedDB on first boot
async function genesisInit() {
  console.log('[Genesis] First boot detected - copying core modules to VFS...');

  const coreModules = [
    'vfs.js',
    'llm-client.js',
    'tool-runner.js',
    'tool-writer.js',
    'meta-tool-writer.js',
    'agent-loop.js',
    'substrate-loader.js',
    'substrate-tools.js',
    'multi-model-coordinator.js'
  ];

  const utils = window.REPLOID.vfs;

  for (const filename of coreModules) {
    const response = await fetch(`/core/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch /core/${filename}: ${response.statusText}`);
    }

    const code = await response.text();
    await utils.write(`/core/${filename}`, code);
    console.log(`[Genesis] Copied: /core/${filename}`);
  }

  // Create /tools/ directory
  await utils.write('/tools/.gitkeep', '');

  console.log('[Genesis] Genesis complete - core modules seeded in VFS');
}

// Load a module from VFS via blob URL
async function loadModuleFromVFS(path) {
  const code = await window.REPLOID.vfs.read(path);
  const blob = new Blob([code], { type: 'text/javascript' });
  const url = URL.createObjectURL(blob);

  try {
    const module = await import(/* webpackIgnore: true */ url);
    return module.default;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Initialize VFS (Simple VFS from disk, not from IndexedDB yet)
async function initVFS() {
  console.log('[Boot] Loading VFS module...');

  // Load simple-vfs directly from file system (this bootstraps everything)
  const vfsModule = await import('./core/vfs.js');
  const VFSFactory = vfsModule.default.factory;

  // Initialize VFS
  const vfs = VFSFactory({ logger: console });
  window.REPLOID.vfs = vfs;

  // Check if this is first boot (no files in VFS)
  const isFirstBoot = await vfs.isEmpty();

  if (isFirstBoot) {
    await genesisInit();
  } else {
    console.log('[Boot] Resuming from evolved state in VFS');

    // Check if all core modules exist (migration check)
    const requiredModules = [
      'vfs.js', 'llm-client.js', 'tool-runner.js', 'tool-writer.js',
      'meta-tool-writer.js', 'agent-loop.js', 'substrate-loader.js', 'substrate-tools.js',
      'multi-model-coordinator.js'
    ];

    let needsMigration = false;
    for (const module of requiredModules) {
      try {
        await vfs.read(`/core/${module}`);
      } catch (e) {
        console.log(`[Boot] Missing module: /core/${module} - triggering migration`);
        needsMigration = true;
        break;
      }
    }

    if (needsMigration) {
      console.log('[Boot] Migrating VFS to latest version...');
      await genesisInit();
    }
  }

  return vfs;
}

// Initialize all core modules
async function initCoreModules() {
  console.log('[Boot] Initializing core modules from VFS...');

  const vfs = window.REPLOID.vfs;

  // Load LLMClient
  const LLMClientModule = await loadModuleFromVFS('/core/llm-client.js');
  const llmClient = LLMClientModule.factory({});
  window.REPLOID.llmClient = llmClient;
  console.log('[Boot] LLMClient initialized');

  // Load ToolWriter (needs VFS)
  const ToolWriterModule = await loadModuleFromVFS('/core/tool-writer.js');
  const toolWriter = ToolWriterModule.factory({ vfs, toolRunner: null }); // toolRunner set later
  window.REPLOID.toolWriter = toolWriter;
  console.log('[Boot] ToolWriter initialized');

  // Load MetaToolWriter (needs VFS)
  const MetaToolWriterModule = await loadModuleFromVFS('/core/meta-tool-writer.js');
  const metaToolWriter = MetaToolWriterModule.factory({ vfs, toolRunner: null }); // toolRunner set later
  window.REPLOID.metaToolWriter = metaToolWriter;
  console.log('[Boot] MetaToolWriter initialized');

  // Load ToolRunner (needs VFS, ToolWriter, MetaToolWriter)
  const ToolRunnerModule = await loadModuleFromVFS('/core/tool-runner.js');
  const toolRunner = ToolRunnerModule.factory({ vfs, toolWriter, metaToolWriter });
  window.REPLOID.toolRunner = toolRunner;
  console.log('[Boot] ToolRunner initialized');

  // Update ToolWriter and MetaToolWriter with ToolRunner reference
  window.REPLOID.toolWriter.toolRunner = toolRunner;
  window.REPLOID.metaToolWriter.toolRunner = toolRunner;

  // Load dynamic tools from VFS (/tools/*)
  await loadDynamicTools(vfs, toolRunner);

  // Load AgentLoop (needs LLMClient, ToolRunner, VFS)
  const AgentLoopModule = await loadModuleFromVFS('/core/agent-loop.js');
  const agentLoop = AgentLoopModule.factory({ llmClient, toolRunner, vfs });
  window.REPLOID.agentLoop = agentLoop;
  console.log('[Boot] AgentLoop initialized');

  // Load SubstrateLoader (needs VFS, ToolRunner)
  const SubstrateLoaderModule = await loadModuleFromVFS('/core/substrate-loader.js');
  const substrateLoader = SubstrateLoaderModule.factory({ vfs, toolRunner });
  window.REPLOID.substrateLoader = substrateLoader;
  console.log('[Boot] SubstrateLoader initialized');

  // Register substrate manipulation tools
  const SubstrateToolsModule = await loadModuleFromVFS('/core/substrate-tools.js');
  SubstrateToolsModule.registerTools(toolRunner, substrateLoader);
  console.log('[Boot] Substrate tools registered');

  // Load MultiModelCoordinator (needs LLMClient, ToolRunner, VFS)
  const MultiModelModule = await loadModuleFromVFS('/core/multi-model-coordinator.js');
  const multiModelCoordinator = MultiModelModule.factory({ llmClient, toolRunner, vfs });
  window.REPLOID.multiModelCoordinator = multiModelCoordinator;
  console.log('[Boot] MultiModelCoordinator initialized');

  console.log('[Boot] All core modules initialized successfully');
}

// Load dynamic tools from /tools/ directory
async function loadDynamicTools(vfs, toolRunner) {
  console.log('[Boot] Loading dynamic tools from VFS...');

  try {
    const toolFiles = await vfs.list('/tools/');

    for (const file of toolFiles) {
      if (file.endsWith('.js') && !file.includes('.backup')) {
        const toolName = file.replace('.js', '').replace('/tools/', '');
        console.log(`[Boot] Loading dynamic tool: ${toolName}`);

        try {
          const code = await vfs.read(file);
          const blob = new Blob([code], { type: 'text/javascript' });
          const url = URL.createObjectURL(blob);

          const module = await import(/* webpackIgnore: true */ url);
          URL.revokeObjectURL(url);

          if (module.default && typeof module.default === 'function') {
            toolRunner.register(toolName, module.default);
            console.log(`[Boot] Registered dynamic tool: ${toolName}`);
          }
        } catch (error) {
          console.error(`[Boot] Failed to load tool ${toolName}:`, error);
        }
      }
    }
  } catch (error) {
    console.log('[Boot] No dynamic tools found (first boot?)');
  }
}

// Initialize Agent Log UI (formerly "Chat UI")
async function initAgentLog() {
  const AgentLogModule = await import('./ui/chat.js');
  const agentLog = AgentLogModule.default.init(window.REPLOID.agentLoop);
  window.REPLOID.agentLog = agentLog;
  console.log('[Boot] Agent Log initialized');
  return agentLog;
}

// Initialize Code Viewer
async function initCodeViewer() {
  const CodeViewerModule = await import('./ui/code-viewer.js');
  const codeViewer = CodeViewerModule.default.init(
    window.REPLOID.vfs,
    window.REPLOID.toolRunner,
    window.REPLOID.agentLoop
  );
  window.REPLOID.codeViewer = codeViewer;
  console.log('[Boot] Code Viewer initialized');
  return codeViewer;
}

// Main boot sequence
async function boot() {
  try {
    // Initialize model selector (existing boot screen)
    initModelConfig();

    // Set up Awaken Agent button
    const awakenBtn = document.getElementById('awaken-btn');
    const bootContainer = document.getElementById('boot-container');
    const agentContainer = document.getElementById('agent-container');
    const goalInput = document.getElementById('goal-input');

    awakenBtn.addEventListener('click', async () => {
      if (!hasModelsConfigured()) {
        alert('Please configure at least one model before awakening the agent');
        return;
      }

      const goal = goalInput.value.trim();
      if (!goal) {
        alert('Please enter a goal for the agent');
        return;
      }

      console.log('[Boot] Awakening agent with goal:', goal);

      // Hide boot screen (use display:none instead of remove() to prevent race conditions)
      bootContainer.style.display = 'none';
      agentContainer.style.display = 'flex';
      agentContainer.style.width = '100vw';
      agentContainer.style.height = '100vh';

      // Ensure body doesn't have any padding/margin that would show boot screen
      document.body.style.margin = '0';
      document.body.style.padding = '0';
      document.body.style.overflow = 'hidden';

      console.log('[Boot] Boot screen hidden, agent monitor displayed');

      // Get selected models
      const models = getSelectedModels();
      if (models.length === 0) {
        alert('No models selected');
        return;
      }

      // Use first model for now (multi-model support later)
      window.REPLOID.agentLoop.setModel(models[0]);

      // Start agent
      try {
        await window.REPLOID.agentLoop.run(goal);
      } catch (error) {
        console.error('[Boot] Agent error:', error);
        alert(`Agent error: ${error.message}`);
      }
    });

    // Clear Cache button
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    clearCacheBtn.addEventListener('click', async () => {
      if (confirm('Clear VFS cache and reload? This will reset to genesis state.')) {
        await window.REPLOID.vfs.clear();
        // Hard reload to bypass all caches including blob URLs
        location.reload(true);
      }
    });

    console.log('[Boot] Boot screen ready');

  } catch (error) {
    console.error('[Boot] Fatal error:', error);
    alert(`Boot error: ${error.message}`);
  }
}

// Start bootstrap sequence
(async () => {
  try {
    // 1. Initialize VFS and check for Genesis
    await initVFS();

    // 2. Initialize all core modules from VFS
    await initCoreModules();

    // 3. Initialize Agent Log UI
    await initAgentLog();

    // 4. Initialize Code Viewer
    await initCodeViewer();

    // 5. Setup boot screen handlers
    await boot();

    console.log('[Boot] REPLOID ready');

  } catch (error) {
    console.error('[Boot] Bootstrap failed:', error);
    document.body.innerHTML = `
      <div style="padding: 40px; text-align: center; font-family: monospace;">
        <h1>Boot Failed</h1>
        <pre style="text-align: left; background: #f5f5f5; padding: 20px; border-radius: 8px;">
${error.stack}
        </pre>
        <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px; font-size: 16px;">
          Reload
        </button>
      </div>
    `;
  }
})();
