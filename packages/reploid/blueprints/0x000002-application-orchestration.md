# Blueprint 0x000002: Application Orchestration

**Objective:** To define the role of the central application orchestrator, which is responsible for loading all composed modules and managing their dependency injection upon agent awakening.

**Prerequisites:** None

**Affected Artifacts:** `/modules/app-logic.js`, `/boot.js`

---

### 1. The Strategic Imperative

A modular agent architecture requires a robust mechanism to "wire" its components together. Hardcoding module relationships and initialization order is brittle and defeats the purpose of compositionality. A dedicated orchestrator is needed to manage the complex process of loading modules from the VFS, resolving their dependencies, and initializing them in the correct sequence to form a cohesive, functional agent.

### 2. The Architectural Solution

The `/modules/app-logic.js` artifact will serve as this central orchestrator. It is the first piece of the agent's own code executed by the `/boot.js` harness. Its primary function is to conduct a multi-stage loading process:

1.  **Level 0 (Pure):** Load and instantiate modules with zero dependencies, such as `utils.js` and the pure helper modules (`agent-logic-pure.js`, `state-helpers-pure.js`). These provide foundational functions and types.
2.  **Level 1 (Core Services):** Load modules that depend only on Level 0 code, such as `storage.js` and `state-manager.js`.
3.  **Level 2 (Application Services):** Load modules that depend on core services, such as `api-client.js` and `tool-runner.js`.
4.  **Level 3 (Top-Level Logic):** Finally, load the highest-level modules that tie everything together, `ui-manager.js` and `agent-cycle.js`.

This layered approach ensures that when a module is initialized, all of its dependencies have already been loaded and are available for injection.

### 3. The Implementation Pathway

1.  **Harness Execution:** The `/boot.js` harness awakens the agent by fetching the content of `/modules/app-logic.js` from the VFS and executing it as a new `Function`.
2.  **Orchestrator Logic:** The `/modules/app-logic.js` script will contain an `initializeApplication` function that performs the following:
    a.  Reads the string content of each required module from the VFS using the injected `vfs.read()` function.
    b.  Uses `new Function(...)` to execute each module's script content, which returns the module's factory function.
    c.  Calls the factory function, passing in the already-loaded dependencies to get the module instance.
    d.  Stores each initialized module instance in a local variable.
    e.  Follows the strict, layered loading order described above.
3.  **Finalization:** Once all modules are loaded, the orchestrator makes the final call to `UI.init()`, passing it the fully-initialized `StateManager` and `CycleLogic` modules to link the UI to the agent's core.