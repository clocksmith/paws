# Blueprint 0x00004F: Dependency Injection Container

**Objective:** To formalize the Dependency Injection (DI) Container architecture that manages module registration, dependency resolution, and lifecycle management for the REPLOID agent system.

**Target Upgrade:** DIC (`di-container.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling)

**Affected Artifacts:** `/upgrades/di-container.js`, `/upgrades/module-manifest.json`

---

### 1. The Strategic Imperative

A modular agent architecture requires a robust dependency injection system to decouple module implementations from their dependencies. The DI Container serves as the central registry and orchestrator for all modules, ensuring:

- **Dependency Isolation**: Modules never access dependencies directly via globals, only through injected parameters
- **Lifecycle Management**: Single instantiation of singletons with proper dependency resolution order
- **Optional Dependencies**: Modules can declare optional dependencies (marked with `?`) that gracefully degrade if unavailable
- **Error Tracking**: Comprehensive failure tracking for debugging boot issues and dependency resolution errors
- **Observable State**: Real-time visibility into module registration, loading, and failure states via dashboard widget

Without a disciplined DI container, modules would create hidden coupling through global variables, making the system brittle and difficult to test.

### 2. The Architectural Solution

The `/upgrades/di-container.js` implements a **singleton-based DI container** with automatic dependency resolution and comprehensive failure tracking.

#### Module Structure

```javascript
const DIContainer = {
  metadata: {
    id: 'DIContainer',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    // Internal state
    const _services = new Map();      // moduleId -> module definition
    const _singletons = new Map();    // moduleId -> resolved instance
    const _moduleMetadata = new Map(); // moduleId -> tracking metadata
    const _failedModules = new Map();  // moduleId -> error message
    const _loadOrder = [];             // Array of {moduleId, timestamp}
    let _lastActivity = null;

    // Core API
    const register = (module) => {
      // Validates module structure: { metadata: { id, ... }, factory: (deps) => {...} }
      // Registers module definition in _services Map
      // Tracks registration in _moduleMetadata with timestamp
    };

    const resolve = async (id) => {
      // Returns cached singleton if already resolved
      // Recursively resolves all dependencies first
      // Handles optional dependencies (ending with '?')
      // Calls factory with resolved dependencies
      // Handles async init() if metadata.async = true
      // Returns public API (instance.api for services/ui, instance for pure modules)
      // Tracks resolution time and errors
    };

    // Web Component Widget (closure access to internal state)
    class DIContainerWidget extends HTMLElement {
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
        const totalModules = _services.size;
        const loadedModules = _singletons.size;
        const failedCount = _failedModules.size;
        const isActive = _lastActivity && (Date.now() - _lastActivity < 5000);

        return {
          state: failedCount > 0 ? 'warning' : (isActive ? 'active' : 'idle'),
          primaryMetric: `${loadedModules} loaded`,
          secondaryMetric: failedCount > 0 ? `${failedCount} failed` : `${totalModules} total`,
          lastActivity: _lastActivity,
          message: failedCount > 0 ? 'Some modules failed to load' : 'All modules OK'
        };
      }

      getControls() {
        return [];
      }

      render() {
        // Comprehensive dashboard with:
        // - Stats grid (registered, loaded, failed counts)
        // - Failed modules list with error details
        // - Load order with module cards showing:
        //   - Type icons (◊ = pure, ⚙ = service, ▣ = ui)
        //   - Status (✓ LOADED, ✗ FAILED, Registered)
        //   - Dependencies list
        //   - Load time in ms
        // - Module statistics (total, loaded, type breakdown)
      }
    }

    const elementName = 'di-container-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, DIContainerWidget);
    }

    return {
      api: {
        register,
        resolve
      },
      widget: {
        element: elementName,
        displayName: 'DI Container',
        icon: '◫',
        category: 'core',
        updateInterval: null
      }
    };
  }
};
```

#### Core Responsibilities

1. **Module Registration**: `register(module)` validates and stores module definitions with metadata tracking
2. **Dependency Resolution**: `resolve(id)` recursively resolves dependencies and instantiates modules
3. **Singleton Management**: Ensures each module is instantiated only once, caching resolved instances
4. **Optional Dependencies**: Supports `dependency?` syntax for graceful degradation when dependencies are unavailable
5. **Async Initialization**: Calls `init()` on modules with `metadata.async = true` after instantiation
6. **Error Tracking**: Maintains detailed failure information for dependency resolution and initialization errors
7. **Lifecycle Tracking**: Records registration time, resolution time, and load duration for each module

#### Module Metadata Tracking

Each module tracks comprehensive lifecycle metadata:

```javascript
{
  metadata: { id, version, dependencies, type, ... },
  registeredAt: timestamp,
  resolvedAt: timestamp | null,
  loadTime: milliseconds | null,
  failed: boolean,
  error: string | null
}
```

#### Module Types

The container handles three module types with different API extraction patterns:

- **Pure Modules** (`type: 'pure'`): Factory returns the API directly
- **Service Modules** (`type: 'service'`): Factory returns `{ api, widget }`, container extracts `.api`
- **UI Modules** (`type: 'ui'`): Factory returns `{ init, api, widget }`, container extracts `.api`

#### Web Component Widget Features

The widget provides comprehensive DI container visualization:

- **Stats Grid**:
  - Registered modules count (blue background)
  - Loaded modules count (green background)
  - Failed modules count (red background when > 0)

- **Failed Modules Section**:
  - Lists all failed modules with error messages
  - Shows first 150 characters of error with truncation indicator

- **Load Order Section**:
  - Displays all modules in load order
  - Color-coded by type (pure = blue, service = green, ui = orange)
  - Shows module header with: index, type icon, name, version, type badge
  - Displays dependencies list if present
  - Shows status: "✓ LOADED" (green) with load time, "✗ FAILED" (red), or "Registered" (gray)
  - Displays error messages for failed modules

- **Module Statistics Box**:
  - Total modules, loaded count
  - Breakdown by type: pure, service, ui

### 3. The Implementation Pathway

#### Step 1: Initialize Internal State

Create closure-scoped Maps and tracking variables:

```javascript
const _services = new Map();           // moduleId -> { metadata, factory }
const _singletons = new Map();         // moduleId -> resolved instance
const _moduleMetadata = new Map();     // moduleId -> { registeredAt, resolvedAt, loadTime, failed, error }
const _failedModules = new Map();      // moduleId -> error message
const _loadOrder = [];                 // Array of { moduleId, timestamp }
let _lastActivity = null;              // Last registration/resolution timestamp
```

#### Step 2: Implement Module Registration

```javascript
const register = (module) => {
  // 1. Validate module structure
  if (!module || !module.metadata || !module.metadata.id) {
    logger.error('[DIContainer] Invalid module registration attempt');
    return;
  }

  // 2. Store module definition
  _services.set(module.metadata.id, module);

  // 3. Track registration metadata
  _moduleMetadata.set(module.metadata.id, {
    metadata: module.metadata,
    registeredAt: Date.now(),
    resolvedAt: null,
    loadTime: null,
    failed: false,
    error: null
  });

  // 4. Update activity timestamp
  _lastActivity = Date.now();

  logger.info(`[DIContainer] Registered module: ${module.metadata.id}`);
};
```

#### Step 3: Implement Dependency Resolution

```javascript
const resolve = async (id) => {
  // 1. Return cached singleton if already resolved
  if (_singletons.has(id)) {
    return _singletons.get(id);
  }

  const startTime = Date.now();

  // 2. Get module definition
  const module = _services.get(id);
  if (!module) {
    const error = new Error(`[DIContainer] Service not found: ${id}`);
    _failedModules.set(id, error.message);
    throw error;
  }

  // 3. Resolve dependencies recursively
  const dependencies = {};
  if (module.metadata.dependencies) {
    for (const depId of module.metadata.dependencies) {
      const isOptional = depId.endsWith('?');
      const actualDepId = isOptional ? depId.slice(0, -1) : depId;

      try {
        dependencies[actualDepId] = await resolve(actualDepId);
      } catch (err) {
        if (isOptional) {
          dependencies[actualDepId] = null;
        } else {
          _failedModules.set(id, `Dependency resolution failed: ${depId}`);
          throw new Error(`[DIContainer] Failed to resolve dependency '${depId}' for '${id}'`);
        }
      }
    }
  }

  // 4. Instantiate module
  const instance = module.factory(dependencies);

  // 5. Handle async initialization
  if (module.metadata.async && typeof instance.init === 'function') {
    try {
      await instance.init();
    } catch (initError) {
      logger.warn(`[DIContainer] Module '${id}' init() failed:`, initError.message);
      _failedModules.set(id, `Init failed: ${initError.message}`);
    }
  }

  // 6. Extract public API based on module type
  const publicApi = (module.metadata.type === 'pure') ? instance : instance.api;

  // 7. Cache singleton
  _singletons.set(id, publicApi);

  // 8. Track successful resolution
  const loadTime = Date.now() - startTime;
  _loadOrder.push({ moduleId: id, timestamp: Date.now() });
  const meta = _moduleMetadata.get(id);
  meta.resolvedAt = Date.now();
  meta.loadTime = loadTime;
  _lastActivity = Date.now();

  return publicApi;
};
```

#### Step 4: Implement Widget Component

Create the `DIContainerWidget` class with comprehensive module visualization:

```javascript
class DIContainerWidget extends HTMLElement {
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
    const totalModules = _services.size;
    const loadedModules = _singletons.size;
    const failedCount = _failedModules.size;
    const isActive = _lastActivity && (Date.now() - _lastActivity < 5000);

    return {
      state: failedCount > 0 ? 'warning' : (isActive ? 'active' : 'idle'),
      primaryMetric: `${loadedModules} loaded`,
      secondaryMetric: failedCount > 0 ? `${failedCount} failed` : `${totalModules} total`,
      lastActivity: _lastActivity,
      message: failedCount > 0 ? 'Some modules failed to load' : 'All modules OK'
    };
  }

  render() {
    // Build modules array with metadata
    const modules = [];
    _moduleMetadata.forEach((meta, moduleId) => {
      modules.push({
        id: moduleId,
        ...meta,
        isLoaded: _singletons.has(moduleId)
      });
    });

    // Sort by load order
    modules.sort((a, b) => (a.resolvedAt || 0) - (b.resolvedAt || 0));

    // Generate HTML for:
    // - Stats grid (registered, loaded, failed)
    // - Failed modules list (if any)
    // - Load order with module cards
    // - Module statistics summary

    this.shadowRoot.innerHTML = `
      <style>
        /* Comprehensive Shadow DOM styles with:
         * - Stats grid layout
         * - Color-coded module type backgrounds
         * - Status indicators (loaded, failed, registered)
         * - Type icons and badges
         * - Scrollable module list
         */
      </style>
      <div class="widget-panel">
        <!-- Stats grid, failed modules, load order, statistics -->
      </div>
    `;
  }
}
```

#### Step 5: Define Custom Element

```javascript
const elementName = 'di-container-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, DIContainerWidget);
}
```

#### Step 6: Return Module Interface

```javascript
return {
  api: {
    register,
    resolve
  },
  widget: {
    element: elementName,
    displayName: 'DI Container',
    icon: '◫',
    category: 'core',
    updateInterval: null
  }
};
```

### 4. Operational Safeguards & Quality Gates

- **Circular Dependency Detection**: The recursive resolve() function will stack overflow on circular dependencies - consider adding cycle detection with a resolution stack
- **Dependency Validation**: Ensure all declared dependencies exist in the module registry before attempting resolution
- **Type Safety**: Validate module types ('pure', 'service', 'ui') and ensure correct API extraction
- **Error Reporting**: Failed modules should be visible in both console logs and the widget dashboard
- **Resolution Order Testing**: Verify that complex dependency graphs resolve in correct topological order

### 5. Extension Points

- **Lazy Loading**: Extend resolve() to support lazy module loading from VFS on-demand
- **Scoped Containers**: Create child containers with different module registries for isolated contexts (e.g., per-persona modules)
- **Lifecycle Hooks**: Add `beforeResolve` and `afterResolve` hooks for instrumentation and debugging
- **Hot Reload Integration**: Invalidate singleton cache when modules change in VFS
- **Dependency Graph Visualization**: Extend widget to show interactive dependency graph with D3.js or similar

Use this blueprint whenever modifying dependency resolution logic, adding new module types, or debugging module loading failures. The DI Container is the foundation of REPLOID's modular architecture and must maintain strict contracts for module registration and dependency resolution.
