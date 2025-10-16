# Blueprint 0x000011: Advanced Storage Backend (IndexedDB)

**Objective:** To outline the architectural upgrade from the default, synchronous `localStorage` backend to a more robust, asynchronous `IndexedDB` backend.

**Prerequisites:** `0x000004`

**Affected Artifacts:** `/modules/storage-indexeddb.js`, `/modules/state-manager.js`, `/modules/tool-runner.js`, `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

The default `localStorage` backend is simple but severely limited in both storage capacity (typically 5-10MB) and performance (it is a synchronous, blocking API). For the agent to evolve and handle large artifacts, extensive history, or complex data, it must upgrade to a more powerful persistence layer. `IndexedDB` is the standard browser API for large-scale, client-side storage, offering a much larger quota and a fully asynchronous, non-blocking API.

### 2. The Architectural Solution

This upgrade requires creating a new, alternative storage module, `/modules/storage-indexeddb.js`. This module will expose the same API contract as the original `storage.js` (e.g., `getArtifactContent`, `setArtifactContent`), but its methods will be `async` and return `Promise`s.

The core challenge of this upgrade is not the implementation of the `IndexedDB` logic itself, but managing the **"asynchronous cascade"** it creates. Because the storage methods become `async`, every function in every module that calls them must also become `async` and use `await` to get the result.

**Example Cascade:**
1.  `Storage.getArtifactContent` becomes `async`.
2.  `StateManager.init`, which calls it, must become `async`.
3.  `ToolRunner.runTool('read_artifact')`, which uses `Storage`, must become `async`.
4.  `AgentCycle._handleToolExecution`, which calls `ToolRunner`, must become `async`.
5.  `AgentCycle.executeCycle` must `await` the tool execution.

### 3. The Implementation Pathway

1.  **Create `idb` Upgrade:** Create a new upgrade file, `/modules/storage-indexeddb.js`.
2.  **Implement `IndexedDB` Logic:** Inside the new module, implement the necessary logic for opening a database, creating an object store, and wrapping `get`, `put`, and `delete` operations in `Promise`s.
3.  **Analyze the Call Stack:** The agent must perform a full-system analysis to identify every function that directly or indirectly calls a `Storage` method.
4.  **Propose Widespread Refactoring:** The agent must propose a large set of `modified` artifact changes. These changes will involve adding the `async` and `await` keywords to functions throughout the entire codebase (`state-manager.js`, `tool-runner.js`, `agent-cycle.js`, `app-logic.js`, etc.) to correctly handle the new asynchronous nature of the VFS.
5.  **Test Composition:** The final step would be for the operator to compose the agent using the `idb` upgrade instead of the `store` upgrade to activate the new backend.