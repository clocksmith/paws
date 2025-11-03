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

// Genesis module sets based on selected level
const GENESIS_LEVELS = {
  full: {
    name: 'Full Substrate',
    modules: [
      'vfs.js', 'llm-client.js', 'tool-runner.js', 'tool-writer.js',
      'meta-tool-writer.js', 'agent-loop.js', 'substrate-loader.js',
      'substrate-tools.js', 'multi-model-coordinator.js'
    ],
    blueprints: [
      // Seed comprehensive architectural knowledge
      '0x000001-system-prompt-architecture.md',
      '0x000002-application-orchestration.md',
      '0x000008-agent-cognitive-cycle.md',
      '0x00000A-tool-runner-engine.md',
      '0x000012-structured-self-evaluation.md',
      '0x000014-working-memory-scratchpad.md',
      '0x000015-dynamic-tool-creation.md',
      '0x000016-meta-tool-creation-patterns.md',
      '0x000017-goal-modification-safety.md',
      '0x000019-visual-self-improvement.md'
    ]
  },
  minimal: {
    name: 'Minimal Axioms',
    modules: ['vfs.js', 'llm-client.js', 'agent-loop.js'],
    blueprints: [
      '0x00000A-tool-runner-engine.md',
      '0x000015-dynamic-tool-creation.md',
      '0x000016-meta-tool-creation-patterns.md'
    ]
  },
  tabula: {
    name: 'Tabula Rasa',
    modules: [
      'vfs.js', 'llm-client.js', 'tool-runner.js', 'tool-writer.js',
      'agent-loop.js'
    ],
    blueprints: [] // No guidance - agent discovers patterns through experimentation
  }
};

// Genesis: Copy core modules from disk to IndexedDB on first boot
async function genesisInit(level = 'full') {
  const genesisConfig = GENESIS_LEVELS[level] || GENESIS_LEVELS.full;
  console.log(`[Genesis] Initializing with ${genesisConfig.name} (${genesisConfig.modules.length} modules)...`);

  const utils = window.REPLOID.vfs;

  // Copy selected core modules
  for (const filename of genesisConfig.modules) {
    const response = await fetch(`/core/${filename}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch /core/${filename}: ${response.statusText}`);
    }

    const code = await response.text();
    await utils.write(`/core/${filename}`, code);
    console.log(`[Genesis] Copied: /core/${filename}`);
  }

  // Seed essential blueprints if specified
  if (genesisConfig.blueprints.length > 0) {
    console.log(`[Genesis] Seeding ${genesisConfig.blueprints.length} essential blueprints...`);
    for (const blueprint of genesisConfig.blueprints) {
      const response = await fetch(`/blueprints/${blueprint}`);
      if (response.ok) {
        const content = await response.text();
        await utils.write(`/blueprints/${blueprint}`, content);
        console.log(`[Genesis] Seeded blueprint: ${blueprint}`);
      }
    }
  }

  // Create /tools/ directory
  await utils.write('/tools/.gitkeep', '');

  console.log(`[Genesis] Genesis complete - ${genesisConfig.name} initialized`);
}

// Load a module from VFS via blob URL (with cache-busting via code comment)
async function loadModuleFromVFS(path) {
  const code = await window.REPLOID.vfs.read(path);
  // Add timestamp comment to bust module cache
  const cacheBustedCode = `// Loaded at ${Date.now()} from ${path}\n${code}`;
  const blob = new Blob([cacheBustedCode], { type: 'text/javascript' });
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
    // Get selected genesis level from UI (defaults to 'full')
    const selectedLevel = window.getGenesisLevel ? window.getGenesisLevel() : 'full';
    await genesisInit(selectedLevel);
  } else {
    console.log('[Boot] Resuming from evolved state in VFS');

    // Check if all core modules exist and are up-to-date (migration check)
    const requiredModules = [
      'vfs.js', 'llm-client.js', 'tool-runner.js', 'tool-writer.js',
      'meta-tool-writer.js', 'agent-loop.js', 'substrate-loader.js', 'substrate-tools.js',
      'multi-model-coordinator.js'
    ];

    let needsMigration = false;
    for (const module of requiredModules) {
      try {
        const code = await vfs.read(`/core/${module}`);

        // Check for specific migration: tool-writer.js must have state object
        if (module === 'tool-writer.js' && !code.includes('state // Expose state')) {
          console.log(`[Boot] Module ${module} needs update (missing state export) - triggering migration`);
          needsMigration = true;
          break;
        }
      } catch (e) {
        console.log(`[Boot] Missing module: /core/${module} - triggering migration`);
        needsMigration = true;
        break;
      }
    }

    if (needsMigration) {
      console.log('[Boot] Migrating VFS to latest version...');
      // Always use 'full' for migrations to ensure proper update
      await genesisInit('full');
    }
  }

  return vfs;
}

// Helper: Check if a module exists in VFS
async function moduleExists(vfs, path) {
  try {
    await vfs.read(path);
    return true;
  } catch (e) {
    return false;
  }
}

// Initialize all core modules (conditionally based on what exists in VFS)
async function initCoreModules() {
  console.log('[Boot] Initializing core modules from VFS...');

  const vfs = window.REPLOID.vfs;

  // Load LLMClient (REQUIRED)
  const LLMClientModule = await loadModuleFromVFS('/core/llm-client.js');
  const llmClient = LLMClientModule.factory({});
  window.REPLOID.llmClient = llmClient;
  console.log('[Boot] LLMClient initialized');

  // Load ToolWriter if exists
  let toolWriter = null;
  if (await moduleExists(vfs, '/core/tool-writer.js')) {
    const ToolWriterModule = await loadModuleFromVFS('/core/tool-writer.js');
    toolWriter = ToolWriterModule.factory({ vfs, toolRunner: null });
    window.REPLOID.toolWriter = toolWriter;
    console.log('[Boot] ToolWriter initialized');
  } else {
    console.log('[Boot] ToolWriter not found - skipping');
  }

  // Load MetaToolWriter if exists
  let metaToolWriter = null;
  if (await moduleExists(vfs, '/core/meta-tool-writer.js')) {
    const MetaToolWriterModule = await loadModuleFromVFS('/core/meta-tool-writer.js');
    metaToolWriter = MetaToolWriterModule.factory({ vfs, toolRunner: null });
    window.REPLOID.metaToolWriter = metaToolWriter;
    console.log('[Boot] MetaToolWriter initialized');
  } else {
    console.log('[Boot] MetaToolWriter not found - skipping');
  }

  // Load ToolRunner if exists
  let toolRunner = null;
  if (await moduleExists(vfs, '/core/tool-runner.js')) {
    const ToolRunnerModule = await loadModuleFromVFS('/core/tool-runner.js');
    toolRunner = ToolRunnerModule.factory({ vfs, toolWriter, metaToolWriter });
    window.REPLOID.toolRunner = toolRunner;
    console.log('[Boot] ToolRunner initialized');

    // Update ToolWriter and MetaToolWriter with ToolRunner reference
    if (toolWriter) toolWriter.state.toolRunner = toolRunner;
    if (metaToolWriter) metaToolWriter.state.toolRunner = toolRunner;

    // Load dynamic tools from VFS
    await loadDynamicTools(vfs, toolRunner);
  } else {
    console.log('[Boot] ToolRunner not found - skipping');
  }

  // Load AgentLoop (REQUIRED - needs LLMClient, ToolRunner, VFS)
  const AgentLoopModule = await loadModuleFromVFS('/core/agent-loop.js');
  const agentLoop = AgentLoopModule.factory({ llmClient, toolRunner, vfs });
  window.REPLOID.agentLoop = agentLoop;
  console.log('[Boot] AgentLoop initialized');

  // Load SubstrateLoader if exists
  if (await moduleExists(vfs, '/core/substrate-loader.js')) {
    const SubstrateLoaderModule = await loadModuleFromVFS('/core/substrate-loader.js');
    const substrateLoader = SubstrateLoaderModule.factory({ vfs, toolRunner });
    window.REPLOID.substrateLoader = substrateLoader;
    console.log('[Boot] SubstrateLoader initialized');

    // Register substrate manipulation tools if substrate-tools exists
    if (await moduleExists(vfs, '/core/substrate-tools.js')) {
      const SubstrateToolsModule = await loadModuleFromVFS('/core/substrate-tools.js');
      SubstrateToolsModule.registerTools(toolRunner, substrateLoader);
      console.log('[Boot] Substrate tools registered');
    }
  } else {
    console.log('[Boot] SubstrateLoader not found - skipping');
  }

  // Load MultiModelCoordinator if exists
  if (await moduleExists(vfs, '/core/multi-model-coordinator.js')) {
    const MultiModelModule = await loadModuleFromVFS('/core/multi-model-coordinator.js');
    const multiModelCoordinator = MultiModelModule.factory({ llmClient, toolRunner, vfs });
    window.REPLOID.multiModelCoordinator = multiModelCoordinator;
    console.log('[Boot] MultiModelCoordinator initialized');
  } else {
    console.log('[Boot] MultiModelCoordinator not found - skipping');
  }

  console.log('[Boot] Core modules initialized successfully');
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
          // Add timestamp comment to bust module cache
          const cacheBustedCode = `// Loaded at ${Date.now()} from ${file}\n${code}`;
          const blob = new Blob([cacheBustedCode], { type: 'text/javascript' });
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

    // Import State button
    const importStateBtn = document.getElementById('import-state-btn');
    const importFileInput = document.getElementById('import-file-input');

    importStateBtn.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      try {
        console.log('[Import] Reading file:', file.name);
        const text = await file.text();
        const importData = JSON.parse(text);

        console.log('[Import] Validating import data...');
        if (!importData.vfs || !importData.vfs.files) {
          throw new Error('Invalid export file: missing VFS data');
        }

        if (!confirm(`Import REPLOID state from ${file.name}?\n\nThis will overwrite current VFS with:\n- ${importData.vfs.fileCount} files\n- ${importData.agent?.logLength || 0} agent log entries\n\nCurrent state will be lost.`)) {
          console.log('[Import] Import cancelled by user');
          return;
        }

        console.log('[Import] Clearing current VFS...');
        await window.REPLOID.vfs.clear();

        console.log('[Import] Writing imported files...');
        for (const file of importData.vfs.files) {
          await window.REPLOID.vfs.write(file.path, file.content);
          console.log(`[Import] Wrote: ${file.path}`);
        }

        console.log(`[Import] Import complete: ${importData.vfs.fileCount} files restored`);
        alert(`Import successful!\n\n${importData.vfs.fileCount} files restored.\n\nReloading to apply changes...`);

        // Reload to reinitialize from imported state
        location.reload(true);

      } catch (error) {
        console.error('[Import] Import failed:', error);
        alert(`Import failed: ${error.message}`);
      } finally {
        // Clear file input so same file can be imported again
        importFileInput.value = '';
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
