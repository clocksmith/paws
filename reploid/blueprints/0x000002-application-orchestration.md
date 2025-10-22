# Blueprint 0x000002: Application Orchestration

**Objective:** To define the role of the central application orchestrator, which is responsible for loading all composed modules and managing their dependency injection upon agent awakening.

**Target Upgrade:** APPL (`app-logic.js`)


**Prerequisites:**
- **0x00004E** (Module Widget Protocol) - REQUIRED for widget implementation

**Affected Artifacts:** `/modules/app-logic.js`, `/boot.js`

---

### 1. The Strategic Imperative

A modular agent architecture requires a robust mechanism to "wire" its components together. Hardcoding module relationships and initialization order is brittle and defeats the purpose of compositionality. A dedicated orchestrator is needed to manage the complex process of loading modules from the VFS, resolving their dependencies, and initializing them in the correct sequence to form a cohesive, functional agent.

### 2. The Architectural Solution

The `/upgrades/app-logic.js` artifact serves as the central orchestrator, executed first by the `/boot.js` harness. It implements a **Dependency Injection (DI) container-based architecture** for module loading and initialization, with comprehensive boot performance tracking via a Web Component dashboard widget.

#### Module Structure

```javascript
const AppLogic = {
  metadata: {
    id: 'AppLogic',
    version: '3.0.0',
    dependencies: [], // Loaded first, no dependencies
    async: false,
    type: 'orchestrator'
  },
  factory: (deps = {}) => {
    // Web Component Widget (closure-based access to _bootStats)
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
        // No auto-refresh - boot stats are static after boot
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      getStatus() {
        const durationSec = _bootStats.totalDuration
          ? (_bootStats.totalDuration / 1000).toFixed(2)
          : '—';

        return {
          state: _bootStats.status === 'ready' ? 'idle'
            : (_bootStats.status === 'failed' ? 'error' : 'active'),
          primaryMetric: _bootStats.status === 'ready' ? 'Ready' : _bootStats.status,
          secondaryMetric: `${durationSec}s`,
          lastActivity: _bootStats.endTime,
          message: `${_bootStats.modulesLoaded.length} modules loaded`
        };
      }

      render() {
        const durationSec = _bootStats.totalDuration
          ? (_bootStats.totalDuration / 1000).toFixed(2)
          : '—';

        const avgLoadTime = _bootStats.modulesLoaded.length > 0
          ? (_bootStats.totalDuration / _bootStats.modulesLoaded.length).toFixed(0)
          : '—';

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }
            .boot-panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 8px;
            }
            .status-badge {
              display: inline-block;
              padding: 4px 8px;
              border-radius: 4px;
              font-weight: bold;
            }
            .status-ready { background: #0a0; color: #000; }
            .status-failed { background: #a00; color: #fff; }
            .module-list {
              max-height: 300px;
              overflow-y: auto;
              margin-top: 8px;
            }
            .error { color: #f00; }
            .success { color: #0f0; }
          </style>
          <div class="boot-panel">
            <h4>⛻ Boot Orchestrator</h4>
            <div class="status-badge status-${_bootStats.status}">
              ${_bootStats.status}
            </div>
            <div>Total Time: ${durationSec}s</div>
            <div>Modules: ${_bootStats.modulesLoaded.length}</div>
            ${_bootStats.moduleErrors.length > 0 ? `
              <div class="error">Errors: ${_bootStats.moduleErrors.length}</div>
            ` : ''}
            <div class="module-list">
              ${_bootStats.modulesLoaded.slice(-10).map(m => `
                <div>
                  <span class="success">✓</span> ${m.id} (${m.loadTime}ms)
                </div>
              `).join('')}
            </div>
            <div style="margin-top: 8px; color: #888;">
              Avg load time: ${avgLoadTime}ms
            </div>
          </div>
        `;
      }
    }

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
```

#### Boot Statistics Tracking

Global `_bootStats` object tracks boot performance:

```javascript
const _bootStats = {
  startTime: null,           // Boot start timestamp
  endTime: null,             // Boot completion timestamp
  totalDuration: null,       // Total boot time in ms
  modulesLoaded: [],         // Array of {id, path, loadTime, timestamp}
  moduleErrors: [],          // Array of {path, error}
  status: 'not_started'      // 'not_started' | 'booting' | 'ready' | 'failed'
};
```

#### DI Container-Based Loading

The orchestrator uses a **Dependency Injection Container** for automatic dependency resolution:

1.  **Foundation (Manual Load):** `utils.js` and `di-container.js` are loaded manually first
2.  **Configuration Registration:** `config.json` and active `Persona` are registered as modules
3.  **Automatic Dependency Resolution:** The DI container reads module manifests and resolves dependencies automatically, loading modules in topologically-sorted order
4.  **Module Registration:** Each module is registered with the container via `container.register(moduleDefinition)`
5.  **Widget Integration:** Modules return both `api` (business logic) and `widget` (Web Component) objects

This architecture eliminates manual dependency ordering and ensures each module receives its dependencies at instantiation time.

### 3. The Implementation Pathway

#### Step 1: Initialize Boot Tracking

Create a global `_bootStats` object to track the boot process:

```javascript
const _bootStats = {
  startTime: null,
  endTime: null,
  totalDuration: null,
  modulesLoaded: [],
  moduleErrors: [],
  status: 'not_started'
};
```

Set `_bootStats.startTime = Date.now()` and `_bootStats.status = 'booting'` when the orchestrator begins.

#### Step 2: Load Foundation Modules

The `/boot.js` harness loads and executes `/upgrades/app-logic.js`. The orchestrator manually loads the two foundation modules:

```javascript
// Load Utils (zero dependencies)
const utilsContent = await vfs.read("/upgrades/utils.js");
const Utils = new Function(utilsContent + "\nreturn Utils;")().factory();

// Load DI Container
const diContainerContent = await vfs.read("/upgrades/di-container.js");
const DIContainerModule = new Function(diContainerContent + "\nreturn DIContainer;");
const container = DIContainerModule().factory({ Utils });

// Expose globally for lazy resolution
globalThis.DIContainer = container;
```

Track each load in `_bootStats.modulesLoaded` with `{id, path, loadTime, timestamp}`.

#### Step 3: Register Configuration and Persona

Load `config.json` and the active Persona module, registering them with the container:

```javascript
const configContent = await vfs.read("/config.json");
const config = JSON.parse(configContent);
container.register({
  metadata: { id: 'config', type: 'pure' },
  factory: () => config
});

// Load active persona
const personaPath = `/personas/${personaModuleName}.js`;
const personaContent = await vfs.read(personaPath);
const PersonaModule = new Function(personaContent + `\nreturn ${personaModuleName};`)();
container.register({ ...PersonaModule, metadata: { ...PersonaModule.metadata, id: 'Persona' } });
```

#### Step 4: Load Modules via DI Container

Define the module manifest (list of all module paths) and use the DI container to load them with automatic dependency resolution:

```javascript
const moduleManifest = [
  '/upgrades/event-bus.js',
  '/upgrades/state-helpers-pure.js',
  '/upgrades/storage-localstorage.js',
  '/upgrades/state-manager.js',
  '/upgrades/api-client.js',
  '/upgrades/tool-runner.js',
  '/upgrades/agent-cycle.js',
  '/upgrades/ui-manager.js',
  // ... all other modules
];

for (const modulePath of moduleManifest) {
  const moduleContent = await vfs.read(modulePath);
  const ModuleDefinition = evaluateModule(moduleContent, modulePath);
  container.register(ModuleDefinition);
}

// Resolve all modules (DI container handles dependency order)
const resolvedModules = container.resolveAll();
```

The DI container performs topological sorting to ensure dependencies are loaded before dependents.

#### Step 5: Create AppLogic Widget

Define the `AppLogicWidget` Web Component inside the factory function to allow closure-based access to `_bootStats`:

```javascript
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
  }

  disconnectedCallback() {
    // No cleanup needed
  }

  getStatus() {
    // Return dashboard status based on _bootStats
  }

  render() {
    const durationSec = _bootStats.totalDuration
      ? (_bootStats.totalDuration / 1000).toFixed(2)
      : '—';

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .boot-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .status-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; }
        .status-ready { background: #0a0; color: #000; }
        .error { color: #f00; }
        .success { color: #0f0; }
      </style>
      <div class="boot-panel">
        <h4>⛻ Boot Orchestrator</h4>
        <div class="status-badge status-${_bootStats.status}">${_bootStats.status}</div>
        <div>Total Time: ${durationSec}s</div>
        <div>Modules: ${_bootStats.modulesLoaded.length}</div>
        ${_bootStats.moduleErrors.length > 0 ? `
          <div class="error">Errors: ${_bootStats.moduleErrors.length}</div>
        ` : ''}
        <div>
          ${_bootStats.modulesLoaded.slice(-10).map(m => `
            <div><span class="success">✓</span> ${m.id} (${m.loadTime}ms)</div>
          `).join('')}
        </div>
      </div>
    `;
  }
}

const elementName = 'app-logic-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, AppLogicWidget);
}
```

#### Step 6: Return API and Widget

Return an object with both the API and widget:

```javascript
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
```

#### Step 7: Finalize Boot Process

After all modules are loaded:

```javascript
_bootStats.endTime = Date.now();
_bootStats.totalDuration = _bootStats.endTime - _bootStats.startTime;
_bootStats.status = 'ready';

// Initialize UI with resolved modules
const UI = resolvedModules.UIManager;
UI.init();
```

#### Step 8: Error Handling

Wrap module loading in try-catch blocks and track errors in `_bootStats.moduleErrors`:

```javascript
try {
  // ... load module
} catch (error) {
  _bootStats.moduleErrors.push({ path: modulePath, error: error.message });
  _bootStats.status = 'failed';
}
```

The widget displays errors in a dedicated panel for debugging.