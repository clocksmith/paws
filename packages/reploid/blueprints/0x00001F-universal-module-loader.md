# Blueprint 0x000025: Universal Module Loader & Lifecycle Governance

**Objective:** Formalize how REPLOID bootstraps, hydrates, and supervises runtime upgrades through the `ModuleLoader` orchestrator.

**Target Upgrade:** MLDR (`boot-module-loader.js`)

**Prerequisites:** 0x000002 (Application Orchestration), 0x000003 (Core Utilities & Error Handling), 0x000013 (System Configuration Structure)

**Affected Artifacts:** `/upgrades/boot-module-loader.js`, `/upgrades/module-manifest.json`, `/upgrades/audit-logger.js`

---

### 1. The Strategic Imperative
The loader is the choke point between configuration intent and executable code. Without a disciplined loader, modules can bypass dependency contracts, degrade determinism, or silently fail to initialize. A blueprinted loader ensures:
- **Deterministic boot**: modules always start in the same order with traceable dependencies.
- **Legacy isolation**: transitional modules using the “function export” format remain sandboxed.
- **Auditability**: every load/instantiate event emits telemetry for forensic replay.
- **Recovery hooks**: failures bubble predictably so boot sequences can degrade gracefully.

### 2. Architectural Overview
`ModuleLoader` is a DI container and lifecycle supervisor. Its responsibilities break down as:

- **Initialization**
  ```javascript
  ModuleLoader.init(vfs, config, auditLogger);
  ```
  Stores references, resets caches, and primes audit logging.

- **Load Phase**
  ```javascript
  const definition = await ModuleLoader.loadModule('/upgrades/api-client.js', 'ApiClient');
  ```
  - Fetches code from the VFS.
  - Uses a `new Function` wrapper that returns either `ApiClient` or `ApiClientModule` for legacy support.
  - Registers metadata, load order, and emits audit events (`logModuleLoad`).

- **Instantiate Phase**
  ```javascript
  const apiClient = await ModuleLoader.getModule('ApiClient');
  ```
  - Resolves dependency graph (including config, VFS, logger/Errors from Utils).
  - Instantiates once, caching the instance for future calls.
  - Legacy modules route through `instantiateLegacyModule` with curated dependency bundles so they cannot "reach around" the container.

- **Lifecycle Hooks**
  - Maintains `loadOrder` for reverse iteration during teardown.
  - Offers `unloadModule` and `reset` to clear caches when hot-reloading or switching personas.

- **Web Component Dashboard Widget**
  The module includes a `ModuleLoaderWidget` custom element for real-time visualization:
  ```javascript
  class ModuleLoaderWidget extends HTMLElement {
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
      const totalModules = ModuleLoader.modules.size;
      const instantiatedCount = Array.from(ModuleLoader.modules.values())
        .filter(m => m.instance !== null).length;
      const legacyCount = Array.from(ModuleLoader.modules.values())
        .filter(m => m.isLegacy).length;

      return {
        state: totalModules > 0 ? 'active' : 'disabled',
        primaryMetric: `${totalModules} module${totalModules !== 1 ? 's' : ''}`,
        secondaryMetric: `${instantiatedCount} loaded`,
        lastActivity: totalModules > 0 ? Date.now() : null,
        message: legacyCount > 0 ? `${legacyCount} legacy` : null
      };
    }

    getControls() {
      return [
        {
          id: 'list-modules',
          label: '☷ List Modules',
          action: () => {
            const modules = ModuleLoader.getLoadedModules();
            console.log('Loaded Modules:', modules);
            console.table(modules.map(id => {
              const entry = ModuleLoader.modules.get(id);
              return {
                ID: id,
                Type: entry.isLegacy ? 'Legacy' : 'Modern',
                Instantiated: entry.instance ? 'Yes' : 'No',
                Path: entry.vfsPath
              };
            }));
            return { success: true, message: `${modules.length} modules (check console)` };
          }
        },
        {
          id: 'show-load-order',
          label: '⚎ Show Load Order',
          action: () => {
            console.log('Module Load Order:', ModuleLoader.loadOrder);
            return { success: true, message: `${ModuleLoader.loadOrder.length} modules in order` };
          }
        }
      ];
    }

    render() {
      // Calculates module statistics
      const totalModules = ModuleLoader.modules.size;
      const instantiatedCount = Array.from(ModuleLoader.modules.values())
        .filter(m => m.instance !== null).length;
      const legacyCount = Array.from(ModuleLoader.modules.values())
        .filter(m => m.isLegacy).length;
      const modernCount = totalModules - legacyCount;

      // Renders comprehensive module dashboard with:
      // - Module summary (total, instantiated, pending)
      // - Module types breakdown (modern vs legacy)
      // - Load order (first 10 modules with status icons)
      // - Dependency graph (top 5 modules with dependencies)
      // - Shadow DOM styles for visual presentation
      this.shadowRoot.innerHTML = `<style>/* ... */</style><div>/* ... */</div>`;
    }
  }

  if (!customElements.get('module-loader-widget')) {
    customElements.define('module-loader-widget', ModuleLoaderWidget);
  }
  ```

  **Widget Features:**
  - **Module Summary**: Total modules, instantiated count, pending count
  - **Module Types**: Breakdown of modern (metadata/factory) vs legacy (function) formats
  - **Load Order**: Shows first 10 modules in load sequence with status indicators (✓ = loaded, ⏳ = pending) and type indicators (⛝ = modern, ⚒ = legacy)
  - **Dependency Graph**: Displays top 5 modules with their dependency chains
  - **Interactive Controls**:
    - "☷ List Modules" - Logs module table to console with ID, type, instantiation status, and path
    - "⚎ Show Load Order" - Logs complete load order array to console
  - **Real-time Status**: Dashboard status shows total modules, loaded count, and legacy count
  - **Shadow DOM Styling**: Encapsulated styles with color-coded indicators (#0ff for active, #0f0 for success, #ff0 for legacy/pending)

### 3. Implementation Pathway
1. **Normalize Modules**
   - Require every modern module to export `{ metadata, factory }`.
   - Fill `metadata.dependencies` with module IDs rather than file paths.
   - Tag async factories (`metadata.async = true`) so the loader awaits instantiation.
2. **Wire Manifest**
   - Ensure every module ID in `module-manifest.json` resolves to a loader-aware upgrade (see 0x000026).
   - Use manifest load groups to batch `loadModule` calls before `instantiate`.
3. **Instrument Audit Logging**
   - Inject `AuditLogger` (0x000034) when initializing the loader so successes/failures persist.
   - Include contextual payloads (`codeSize`, `loadTimeMs`, `isLegacy`) for forensic utility.
4. **Handle Failures**
   - Wrap load/instantiate in try/catch, propagate errors with descriptive context.
   - Bubble load errors to the boot UI so users can retry or switch configurations.
5. **Implement Web Component Widget**
   - Create `ModuleLoaderWidget` class extending `HTMLElement`
   - Implement Shadow DOM in constructor
   - Implement `getStatus()` to return loader state (total modules, loaded count, legacy count)
   - Implement `render()` to display module list with metadata, load order, and status
   - Add controls for listing modules and inspecting statistics
   - Register custom element as `boot-module-loader-widget`
6. **Return Widget in Factory**
   - Return standardized object with:
     - `api`: ModuleLoader API (init, loadModule, getModule, etc.)
     - `widget`: Widget configuration (element, displayName, icon, category)
7. **Expose Diagnostics**
   - Provide `ModuleLoader.getStatus()` to report active modules, unresolved deps, and legacy compatibility usage.
   - Widget automatically displays this information in real-time

### 4. Operational Safeguards & Quality Gates
- **Static Analysis**: before committing a new module, ensure it declares the right dependencies and avoids direct globals.
- **Load Tests**: run `ModuleLoader.reset()` followed by sequential persona boots to confirm no dependency leaks.
- **Regression Hooks**: maintain fixtures that mimic legacy modules so compatibility shims stay alive until the migration is complete.
- **Audit Review**: periodically export audit logs to validate that critical modules (security, storage) never bypass the loader.

### 5. Extension Points
- **Hot Reloading**: pair with `HotReload` upgrade to invalidate caches when VFS artifacts change.
- **Sandbox Modes**: inject policy-based filters (e.g., block experimental modules in “safe” personas).
- **Future Multi-Process**: the load contract allows modules to be instantiated in Web Workers once VFS bridges exist.

Use this blueprint whenever touching loader logic, adding new module categories, or investigating boot anomalies. It is the contract that keeps REPLOID’s modularity honest.
