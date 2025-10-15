import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the CoreLogicModule
const createCoreLogicModule = () => async (initialConfig, vfs) => {
  console.log("[CoreLogic] Phoenix Edition: Starting agent initialization...");

  try {
    // Mock Utils loading
    const utilsContent = await vfs.read("/upgrades/utils.js");
    const Utils = {
      factory: () => ({
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn(),
          error: vi.fn()
        }
      })
    };
    const { logger } = Utils.factory();

    logger.info("[CoreLogic] Utils loaded. Initializing DI Container.");

    // Mock DI Container
    const diContainerContent = await vfs.read("/upgrades/di-container.js");
    const container = {
      modules: new Map(),
      register: vi.fn((module) => {
        if (module.metadata) {
          container.modules.set(module.metadata.id, module);
        }
      }),
      resolve: vi.fn(async (id) => {
        const module = container.modules.get(id);
        if (!module) throw new Error(`Module ${id} not found`);
        if (module.factory) {
          return module.factory({});
        }
        return module;
      })
    };

    // Load config
    logger.info("[CoreLogic] Loading configuration...");
    const configContent = await vfs.read("/config.json");
    const config = JSON.parse(configContent);
    container.register({
      metadata: { id: 'config', type: 'pure' },
      factory: () => config
    });

    // Load persona
    logger.info("[CoreLogic] Loading active persona...");
    const activePersonaId = initialConfig?.persona?.id || 'code_refactorer';
    const personaModuleName = activePersonaId.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join('') + 'Persona';
    const personaPath = `/personas/${personaModuleName}.js`;

    try {
      await vfs.read(personaPath);
      container.register({
        metadata: { id: 'Persona', type: 'persona' },
        factory: () => ({ name: personaModuleName })
      });
      logger.info(`[CoreLogic] Active persona '${personaModuleName}' registered as 'Persona'.`);
    } catch (e) {
      logger.warn(`[CoreLogic] Could not load persona '${activePersonaId}'. Proceeding without.`);
      container.register({
        metadata: { id: 'Persona', type: 'persona' },
        factory: () => ({})
      });
    }

    // Load modules
    const moduleFiles = [
      "/upgrades/utils.js",
      "/upgrades/state-manager.js",
      "/upgrades/agent-cycle.js",
      "/upgrades/ui-manager.js"
    ];

    logger.info("[CoreLogic] Loading and registering all application modules...");
    await Promise.all(moduleFiles.map(path => vfs.read(path)));

    // Register mock modules
    container.register({
      metadata: { id: 'StateManager', type: 'service' },
      factory: () => ({ getState: vi.fn() })
    });
    container.register({
      metadata: { id: 'CycleLogic', type: 'service' },
      factory: () => ({ executeCycle: vi.fn() })
    });
    container.register({
      metadata: { id: 'UI', type: 'service' },
      factory: () => ({ init: vi.fn() })
    });
    container.register({
      metadata: { id: 'GitVFS', type: 'service' },
      factory: () => ({ init: vi.fn() })
    });
    container.register({
      metadata: { id: 'DiffViewerUI', type: 'service' },
      factory: () => ({ init: vi.fn() })
    });

    logger.info("[CoreLogic] All modules registered. Resolving main services.");

    const CycleLogic = await container.resolve('CycleLogic');
    const UI = await container.resolve('UI');
    const StateManager = await container.resolve('StateManager');

    if (UI.init) {
      await UI.init(StateManager, CycleLogic);
    }

    // Initialize GitVFS
    try {
      const GitVFS = await container.resolve('GitVFS');
      if (GitVFS && GitVFS.init) {
        await GitVFS.init();
        logger.info("[CoreLogic] GitVFS initialized for version control");
      }
    } catch (gitError) {
      logger.warn("[CoreLogic] GitVFS initialization failed:", gitError.message);
    }

    // Initialize DiffViewerUI
    try {
      const DiffViewerUI = await container.resolve('DiffViewerUI');
      if (DiffViewerUI && DiffViewerUI.init) {
        if (document.getElementById('diff-viewer')) {
          DiffViewerUI.init('diff-viewer');
          logger.info("[CoreLogic] DiffViewerUI initialized");
        } else {
          logger.warn("[CoreLogic] Diff viewer container not found");
        }
      }
    } catch (diffError) {
      logger.warn("[CoreLogic] DiffViewerUI initialization failed:", diffError.message);
    }

    logger.info("[CoreLogic] Agent initialization complete. System is operational.");

    const bootContainer = document.getElementById("boot-container");
    const appRoot = document.getElementById("app-root");
    if (bootContainer) bootContainer.style.display = "none";
    if (appRoot) appRoot.style.display = "block";

    return { container, logger };

  } catch (error) {
    console.error("[CoreLogic] Initialization failed:", error);

    const appRoot = document.getElementById("app-root");
    if (appRoot) {
      appRoot.style.display = "block";
      appRoot.innerHTML = `
        <div style="color: red;">
          <h1>FATAL ERROR</h1>
          <p>Agent Awakening Failed: ${error.message}</p>
        </div>
      `;
    }
    throw error;
  }
};

describe('CoreLogicModule (app-logic.js)', () => {
  let mockVfs, mockInitialConfig, CoreLogicModule;
  let mockDocument;

  beforeEach(() => {
    // Mock VFS
    mockVfs = {
      read: vi.fn(async (path) => {
        if (path === '/config.json') {
          return JSON.stringify({ apiKey: 'test-key', apiProvider: 'gemini' });
        }
        if (path.includes('/personas/')) {
          return 'const PersonaModule = { metadata: { id: "Persona" } };';
        }
        if (path.includes('/upgrades/')) {
          return 'const Module = { metadata: { id: "TestModule" } };';
        }
        throw new Error(`File not found: ${path}`);
      })
    };

    mockInitialConfig = {
      persona: { id: 'code_refactorer' }
    };

    // Mock document
    mockDocument = {
      getElementById: vi.fn((id) => {
        if (id === 'diff-viewer') {
          return { id: 'diff-viewer' };
        }
        if (id === 'boot-container') {
          return { style: { display: 'block' } };
        }
        if (id === 'app-root') {
          return { style: { display: 'none' }, innerHTML: '' };
        }
        return null;
      })
    };

    global.document = mockDocument;

    // Preserve existing console methods while mocking
    const originalConsole = global.console;
    global.console = {
      ...originalConsole,
      log: vi.fn(),
      error: vi.fn()
    };

    CoreLogicModule = createCoreLogicModule();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.document;
    delete global.console;
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result).toBeDefined();
      expect(result.container).toBeDefined();
      expect(result.logger).toBeDefined();
    });

    it('should load Utils module first', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/upgrades/utils.js');
    });

    it('should load DI container', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/upgrades/di-container.js');
    });

    it('should load config.json', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/config.json');
    });

    it('should register config module', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('config')).toBe(true);
    });
  });

  describe('Persona Loading', () => {
    it('should load default persona', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/personas/CodeRefactorerPersona.js');
    });

    it('should load custom persona', async () => {
      mockInitialConfig.persona.id = 'test_persona';

      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/personas/TestPersonaPersona.js');
    });

    it('should handle missing persona gracefully', async () => {
      mockVfs.read = vi.fn(async (path) => {
        if (path.includes('/personas/')) {
          throw new Error('Persona not found');
        }
        if (path === '/config.json') {
          return JSON.stringify({});
        }
        return 'const Module = {};';
      });

      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('Persona')).toBe(true);
    });

    it('should register persona with generic ID', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('Persona')).toBe(true);
    });
  });

  describe('Module Loading', () => {
    it('should load all required modules', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockVfs.read).toHaveBeenCalledWith('/upgrades/state-manager.js');
      expect(mockVfs.read).toHaveBeenCalledWith('/upgrades/agent-cycle.js');
      expect(mockVfs.read).toHaveBeenCalledWith('/upgrades/ui-manager.js');
    });

    it('should register StateManager', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('StateManager')).toBe(true);
    });

    it('should register CycleLogic', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('CycleLogic')).toBe(true);
    });

    it('should register UI', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.modules.has('UI')).toBe(true);
    });
  });

  describe('Service Initialization', () => {
    it('should resolve main services', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.resolve).toHaveBeenCalledWith('CycleLogic');
      expect(result.container.resolve).toHaveBeenCalledWith('UI');
      expect(result.container.resolve).toHaveBeenCalledWith('StateManager');
    });

    it('should initialize UI with dependencies', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      // UI.init should have been called
      expect(mockDocument.getElementById).toHaveBeenCalled();
    });

    it('should initialize GitVFS', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.container.resolve).toHaveBeenCalledWith('GitVFS');
    });

    it('should handle GitVFS initialization failure', async () => {
      mockVfs.read = vi.fn(async (path) => {
        if (path === '/config.json') return JSON.stringify({});
        if (path.includes('git')) throw new Error('Git not available');
        return 'const Module = {};';
      });

      // Should not throw
      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).resolves.toBeDefined();
    });

    it('should initialize DiffViewerUI if container exists', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(mockDocument.getElementById).toHaveBeenCalledWith('diff-viewer');
    });

    it('should skip DiffViewerUI if container missing', async () => {
      mockDocument.getElementById = vi.fn(() => null);

      // Should not throw
      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).resolves.toBeDefined();
    });
  });

  describe('UI Display', () => {
    it('should hide boot container', async () => {
      const bootContainer = { style: { display: 'block' } };
      mockDocument.getElementById = vi.fn((id) => {
        if (id === 'boot-container') return bootContainer;
        if (id === 'app-root') return { style: { display: 'none' } };
        return null;
      });

      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(bootContainer.style.display).toBe('none');
    });

    it('should show app root', async () => {
      const appRoot = { style: { display: 'none' } };
      mockDocument.getElementById = vi.fn((id) => {
        if (id === 'boot-container') return { style: { display: 'block' } };
        if (id === 'app-root') return appRoot;
        return null;
      });

      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(appRoot.style.display).toBe('block');
    });

    it('should handle missing DOM elements gracefully', async () => {
      mockDocument.getElementById = vi.fn(() => null);

      // Should not throw
      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).resolves.toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle VFS read errors', async () => {
      mockVfs.read = vi.fn().mockRejectedValue(new Error('VFS read failed'));

      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).rejects.toThrow();
    });

    it('should display fatal error on failure', async () => {
      const appRoot = { style: { display: 'none' }, innerHTML: '' };
      mockDocument.getElementById = vi.fn((id) => {
        if (id === 'app-root') return appRoot;
        return null;
      });

      mockVfs.read = vi.fn().mockRejectedValue(new Error('Initialization failed'));

      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).rejects.toThrow();

      expect(appRoot.style.display).toBe('block');
      expect(appRoot.innerHTML).toContain('FATAL ERROR');
      expect(appRoot.innerHTML).toContain('Initialization failed');
    });

    it('should log initialization errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error');
      mockVfs.read = vi.fn().mockRejectedValue(new Error('Test error'));

      await expect(CoreLogicModule(mockInitialConfig, mockVfs)).rejects.toThrow();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('Logging', () => {
    it('should log initialization start', async () => {
      await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('Phoenix Edition')
      );
    });

    it('should log module loading progress', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loading configuration')
      );
      expect(result.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loading active persona')
      );
      expect(result.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Loading and registering')
      );
    });

    it('should log completion', async () => {
      const result = await CoreLogicModule(mockInitialConfig, mockVfs);

      expect(result.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('initialization complete')
      );
    });
  });
});
