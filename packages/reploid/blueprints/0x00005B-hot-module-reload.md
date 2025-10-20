# Blueprint 0x00005B: Hot Module Reload System

**Objective:** Enable dynamic code replacement without losing application state, allowing modules to be updated while REPLOID is running.

**Target Upgrade:** HMR (`hot-reload.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000004 (Default Storage Backend), 0x000005 (State Management Architecture)

**Affected Artifacts:** `/upgrades/hot-reload.js`, `/upgrades/state-manager.js`, `/upgrades/module-loader.js`

---

### 1. The Strategic Imperative

Traditional web applications require a full page reload to apply code changes, destroying all runtime state:
- **No state persistence** across code updates
- **Slow development cycle** (reload, navigate, recreate state)
- **No live debugging** of running agents
- **No dynamic patching** of production issues

This blueprint defines a **Hot Module Reload (HMR)** system that:
- **Loads modules dynamically** from source code using blob URLs
- **Preserves application state** during module updates
- **Proxies module references** for transparent hot-swapping
- **Auto-reloads modules** when VFS detects changes
- **Provides safe execution contexts** for isolated code evaluation
- **Profiles module performance** to identify bottlenecks

### 2. Architectural Overview

`HotReload` manages dynamic module loading and replacement using ES6 dynamic imports and Proxy objects.

```javascript
const HMR = await ModuleLoader.getModule('HotReload');

// Create a hot-reloadable module from VFS
const MyModule = await HMR.createModule('MyModule', '/modules/my-module.js');

// Register update callback
HMR.onModuleUpdate('MyModule', (newModule, oldModule) => {
  console.log('Module updated:', newModule);
});

// Manually reload a module
await HMR.reloadModule('MyModule');

// Patch a specific function without reloading entire module
const patch = await HMR.patchFunction('MyModule', 'compute', `
  function(originalCompute) {
    return function(...args) {
      console.log('Compute called with:', args);
      return originalCompute.apply(this, args);
    };
  }
`);

// Later: rollback patch
patch.rollback();
```

#### Key Components

**1. Module Loading from Source**
- **Dynamic Import with Blob URLs**: Creates a Blob from source code, generates object URL, imports as ES module
- **Source Wrapping**: Auto-detects exports and wraps in module format if needed
  - Detects `function`, `const`, `let`, `var`, `class` declarations
  - Generates export object from detected entities
  - Adds module metadata (`__moduleId`, `__hotReload`)
- **Error Handling**: Cleans up blob URLs on failure, prevents memory leaks
- **Export Detection Regex**:
  - Functions: `/function\s+(\w+)\s*\(/g`
  - Variables: `/(?:const|let|var)\s+(\w+)\s*=/g`
  - Classes: `/class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g`

**2. Module Registry**
- **moduleRegistry**: `Map<moduleId, module>` - Loaded module objects
- **moduleProxies**: `Map<moduleId, Proxy>` - Transparent proxy wrappers
- **moduleVersions**: `Map<moduleId, { version, sourcePath }>` - Version tracking
- **updateCallbacks**: `Map<moduleId, Function[]>` - Update notification callbacks

**3. Proxy-Based Hot Swapping**
- **Proxy Handler**:
  - `get(target, prop)`: Always returns property from latest module version in registry
  - `set(target, prop, value)`: Updates latest module version
- **Transparent Updates**: Code holding module reference sees new implementation immediately
- **No Reference Invalidation**: Existing references remain valid across reloads

**4. Module Reload Flow**
1. Retrieve updated source from VFS (`Storage.getArtifactContent`)
2. Store old module for rollback
3. Load new module from source (`loadModuleFromSource`)
4. Call module's `__acceptHotReload(oldModule)` hook if present
5. Update registry with new module
6. Increment version counter
7. Notify all registered update callbacks
8. Rollback to old module on error

**5. VFS Integration**
- **Watch Artifacts**: `StateManager.watchArtifacts('/modules/', handleModuleChange)`
- **Auto-Reload on Change**: Detects modified artifacts, triggers `reloadModule()`
- **Source Path Mapping**: Maps VFS artifact paths to module IDs for automatic reload

**6. Function Patching**
- **Runtime Function Replacement**: Replace specific functions without reloading entire module
- **Access to Original**: Patched function receives original as argument
- **Rollback Support**: Returns `{ rollback() }` to restore original implementation
- **Use Cases**:
  - Quick bug fixes
  - Performance optimizations
  - Debug logging injection
  - A/B testing

**7. Safe Code Execution**
- **Isolated Contexts**: Execute arbitrary code in isolated module scope
- **Context Variables**: Inject variables into execution context
- **Blob URL Isolation**: Creates temporary module with execution wrapper
- **Auto Cleanup**: Revokes blob URLs after import
- **API**:
  - `createSafeContext(code, contextVars)`: Returns async executor function
  - `executeSafe(code, args)`: One-shot execution with cleanup

**8. Module Profiling**
- **Performance Metrics**: Tracks function call counts, execution times, errors
- **Profiling Proxy**: Wraps module proxy with timing instrumentation
- **Non-Invasive**: Temporarily replaces module proxy during profiling
- **Metrics**:
  - `calls`: Map<functionName, { count, totalTime }>
  - `totalTime`: Cumulative execution time across all calls
  - `errors`: Error count
- **API**:
  - `profileModule(moduleId)`: Returns `{ stop(), getMetrics() }`
  - `stop()`: Restores original proxy, returns final metrics

#### Monitoring Widget (Web Component)

The Hot Reload system provides a Web Component widget for monitoring active modules:

```javascript
class HotReloadWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    // No interval to clean up (event-driven)
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    // Access module state via closure
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
        :host { display: block; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
        .stat-card.modules { background: rgba(255,87,34,0.1); }
        .stat-card.reloads { background: rgba(0,255,255,0.1); }
        .module-list { max-height: 300px; overflow-y: auto; }
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
          ${stats.modules.map(module => `
            <div class="module-item">
              <div class="module-header">
                <span class="module-id">${module.id}</span>
                <span class="module-version">v${module.version}</span>
              </div>
              <div class="module-path">${module.sourcePath}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.querySelector('.cleanup')?.addEventListener('click', () => {
      cleanup();
      this.render();
    });
  }
}

// Register custom element
if (!customElements.get('hot-reload-widget')) {
  customElements.define('hot-reload-widget', HotReloadWidget);
}

const widget = {
  element: 'hot-reload-widget',
  displayName: 'Hot Reload',
  icon: '☄',
  category: 'core'
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses module state (`moduleRegistry`, `moduleVersions`, `getStats`) directly via closure.
- **Status Reporting**: `getStatus()` provides active module count, total reloads across all modules.
- **Stats Grid**: Shows active modules, total reloads, module count (color-coded).
- **Module List**: Displays all active modules with ID, version, source path.
- **Cleanup Control**: Button to clear all module registries and reset system.
- **Auto-Calculate Stats**: Computes total reloads from version numbers (`sum(version - 1)`).
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core Hot Reload System Implementation

1. **Initialization**
   - Define module registries: `moduleRegistry`, `moduleProxies`, `moduleVersions`, `updateCallbacks`
   - Register global error handler for dynamic import failures
   - Set up VFS watcher: `StateManager.watchArtifacts('/modules/', handleModuleChange)`
   - Log system ready

2. **Module Creation from Source**
   - Implement `createModule(moduleId, sourcePath)`:
     - Fetch source from VFS: `Storage.getArtifactContent(sourcePath)`
     - Load module: `loadModuleFromSource(source, moduleId)`
     - Create proxy: `createModuleProxy(module, moduleId)`
     - Register in all maps
     - Initialize version to 1
     - Return proxy
   - Implement `loadModuleFromSource(source, moduleId)`:
     - Wrap source if needed: `wrapModuleSource(source, moduleId)`
     - Create Blob: `new Blob([wrappedSource], { type: 'application/javascript' })`
     - Generate object URL: `URL.createObjectURL(blob)`
     - Dynamic import: `await import(moduleUrl)`
     - Revoke URL: `URL.revokeObjectURL(moduleUrl)`
     - Return module object

3. **Source Wrapping and Export Detection**
   - Implement `wrapModuleSource(source, moduleId)`:
     - Check if source already has exports
     - If not, wrap with auto-export template
     - Call `detectExports(source)` to generate export object
   - Implement `detectExports(source)`:
     - Scan for function declarations: `/function\s+(\w+)\s*\(/g`
     - Scan for variable declarations: `/(?:const|let|var)\s+(\w+)\s*=/g`
     - Scan for class declarations: `/class\s+(\w+)\s*(?:extends\s+\w+)?\s*\{/g`
     - Return comma-separated export list

4. **Proxy Creation**
   - Implement `createModuleProxy(module, moduleId)`:
     - Create Proxy with handler:
       - `get(target, prop)`: Return `moduleRegistry.get(moduleId)[prop]` (always latest)
       - `set(target, prop, value)`: Update `moduleRegistry.get(moduleId)[prop]`
     - Return Proxy instance

5. **Module Reload**
   - Implement `reloadModule(moduleId)`:
     - Retrieve version info from `moduleVersions`
     - Fetch new source from VFS
     - Store old module for rollback
     - Load new module from source
     - Call `newModule.__acceptHotReload(oldModule)` if present
     - Update registry with new module
     - Increment version counter
     - Notify all update callbacks
     - Rollback on error

6. **VFS Integration**
   - Implement `handleModuleChange(event)`:
     - Extract `{ artifactId, changeType }` from event
     - Find module ID by matching `sourcePath` in `moduleVersions`
     - If found and `changeType === 'modified'`, call `reloadModule(moduleId)`
     - Log auto-reload attempts and errors

7. **Update Callbacks**
   - Implement `onModuleUpdate(moduleId, callback)`:
     - Initialize callback array if not exists
     - Push callback to array
     - Callbacks receive `(newModule, oldModule)` on reload

8. **Safe Code Execution**
   - Implement `createSafeContext(code, contextVars)`:
     - Wrap code in async executor function
     - Inject context variables as JSON
     - Create Blob and object URL
     - Dynamic import, return executor
     - Clean up URL
   - Implement `executeSafe(code, args)`:
     - Create safe context with `args`
     - Execute and return result

9. **Function Patching**
   - Implement `patchFunction(moduleId, functionName, newImplementation)`:
     - Retrieve module from registry
     - Store original function
     - Create patched function using `new Function()`
     - Replace in module
     - Return `{ rollback() }` closure

10. **Module Profiling**
    - Implement `profileModule(moduleId)`:
      - Initialize metrics object
      - Create profiling proxy wrapping module proxy
      - Intercept function calls, measure execution time
      - Track call counts, total times, errors
      - Replace module proxy temporarily
      - Return `{ stop(), getMetrics() }`

11. **Statistics and Cleanup**
    - Implement `getStats()`:
      - Return `{ totalModules: moduleRegistry.size, modules: [...moduleVersions.entries()] }`
      - Include version, sourcePath, hasProxy, updateCallbacks count per module
    - Implement `cleanup()`:
      - Remove global error handler
      - Clear all maps

#### Widget Implementation (Web Component)

12. **Define Web Component Class** inside factory function:
    ```javascript
    class HotReloadWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }
    }
    ```

13. **Implement Lifecycle Methods**:
    - `connectedCallback()`: Initial render (no interval needed, event-driven updates)
    - `disconnectedCallback()`: No cleanup needed (no intervals)

14. **Implement getStatus()** as class method with closure access:
    - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
    - Access module state (`moduleRegistry`, `getStats()`) via closure
    - State logic:
      - `active` if `totalModules > 0`
      - `idle` if `totalModules === 0`
    - Primary metric: Total active modules
    - Secondary metric: Total reloads (sum of `version - 1` across all modules)

15. **Implement render()** method:
    - Set `this.shadowRoot.innerHTML` with encapsulated styles
    - Call `getStats()` to get current module state
    - Calculate total reloads: `stats.modules.reduce((sum, m) => sum + m.version - 1, 0)`
    - Render stats grid (active modules, total reloads, module count)
    - Render module list with ID, version, source path
    - Add cleanup button event listener
    - Show empty state if no modules

16. **Register Custom Element**:
    - Use kebab-case naming: `hot-reload-widget`
    - Add duplicate check: `if (!customElements.get('hot-reload-widget'))`
    - Call `customElements.define('hot-reload-widget', HotReloadWidget)`

17. **Return Widget Object** with new format:
    - `{ element: 'hot-reload-widget', displayName: 'Hot Reload', icon: '☄', category: 'core' }`

18. **Test** Blob URL creation/cleanup, module proxy behavior, reload with state preservation, error rollback, profiling accuracy

### 4. Verification Checklist

- [ ] `createModule()` loads source from VFS and returns working proxy
- [ ] `loadModuleFromSource()` creates Blob URL, imports, cleans up
- [ ] `wrapModuleSource()` detects and wraps exports correctly
- [ ] Export detection regex finds functions, variables, classes
- [ ] Module proxy always returns latest module version properties
- [ ] `reloadModule()` updates registry, increments version, notifies callbacks
- [ ] Reload rollback restores old module on error
- [ ] VFS watcher triggers auto-reload on module modification
- [ ] Update callbacks receive (newModule, oldModule) correctly
- [ ] `patchFunction()` replaces function, provides rollback
- [ ] `profileModule()` measures call counts and execution times accurately
- [ ] `executeSafe()` runs code in isolated context
- [ ] `cleanup()` clears all registries and removes listeners
- [ ] Widget displays active modules, versions, source paths
- [ ] Widget calculates total reloads correctly
- [ ] Widget cleanup button works

### 5. Extension Opportunities

- Add module dependency tracking (reload dependents automatically)
- Add hot reload hooks for stateful modules (save/restore state)
- Add module isolation levels (full isolation vs shared globals)
- Add source maps support for debugging reloaded modules
- Add module caching (avoid re-parsing unchanged code)
- Add conditional reloading (reload only if tests pass)
- Add A/B testing support (load different versions for different users)
- Add module snapshots (save/restore module versions)
- Add performance regression detection (alert on slowdowns after reload)
- Add module health checks (validate module works after reload)

Maintain this blueprint as the hot reload capabilities evolve or new dynamic loading patterns are introduced.
