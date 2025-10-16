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
  - Legacy modules route through `instantiateLegacyModule` with curated dependency bundles so they cannot “reach around” the container.

- **Lifecycle Hooks**
  - Maintains `loadOrder` for reverse iteration during teardown.
  - Offers `unloadModule` and `reset` to clear caches when hot-reloading or switching personas.

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
5. **Expose Diagnostics**
   - Provide `ModuleLoader.getStatus()` to report active modules, unresolved deps, and legacy compatibility usage.

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
