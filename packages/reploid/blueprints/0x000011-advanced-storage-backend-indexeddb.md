# Blueprint 0x000011: Advanced Storage Backend (IndexedDB)

**Objective:** To outline the architectural upgrade from the default, synchronous `localStorage` backend to a more robust, asynchronous `IndexedDB` backend.

**Target Upgrade:** IDXB (`storage-indexeddb.js`)


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

**Widget Interface (Web Component):**

The module exposes a `StorageIndexedDBWidget` custom element for dashboard visualization:

```javascript
class StorageIndexedDBWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._updateInterval = null;
  }

  connectedCallback() {
    this.render();
    // 5-second refresh for Git VFS monitoring
    this._updateInterval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    const totalOps = _writeCount + _readCount + _deleteCount;
    return {
      state: totalOps > 0 ? 'active' : 'idle',
      primaryMetric: `${_commitCount} commits`,
      secondaryMetric: `${totalOps} operations`,
      lastActivity: _lastOperationTime,
      message: 'Git-powered VFS'
    };
  }

  render() {
    const totalOps = _writeCount + _readCount + _deleteCount;
    const writePercent = totalOps > 0 ? (_writeCount / totalOps * 100) : 0;
    const readPercent = totalOps > 0 ? (_readCount / totalOps * 100) : 0;
    const deletePercent = totalOps > 0 ? (_deleteCount / totalOps * 100) : 0;

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">
        <!-- Git VFS statistics (commits, total operations) -->
        <!-- Operation breakdown with visual percentage bars (writes, reads, deletes) -->
        <!-- Last operation timestamp with relative time display -->
        <!-- Info box explaining Git VFS storage with IndexedDB backend -->
      </div>
    `;
  }
}

const elementName = 'storage-indexeddb-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, StorageIndexedDBWidget);
}
```

**Key Widget Features:**
- **Git VFS Integration**: Built on isomorphic-git with LightningFS for IndexedDB-backed virtual filesystem
- **Commit Tracking**: Displays total Git commits made by the agent (each write/delete creates a commit)
- **Operation Statistics**: Tracks and displays read/write/delete operation counts
- **Operation Breakdown**: Visual percentage bars showing distribution of operation types:
  - Writes (blue) - Files written and committed to Git
  - Reads (green) - Files read from VFS
  - Deletes (red) - Files removed and committed
- **Last Activity Tracking**: Shows relative time since last VFS operation (e.g., "5s ago", "2m ago")
- **Auto-Refresh**: Updates every 5 seconds to monitor ongoing VFS activity
- **Git History API**: Exposes `getArtifactHistory()` and `getArtifactDiff()` for version control operations
- **Automatic Commits**: Every write/delete operation auto-commits to Git with descriptive message

The widget provides visibility into the Git-powered persistence layer, essential for monitoring version control operations, tracking VFS activity, and debugging asynchronous storage operations.

### 3. The Implementation Pathway

1.  **Create `idb` Upgrade:** Create a new upgrade file, `/modules/storage-indexeddb.js`.
2.  **Implement `IndexedDB` Logic:** Inside the new module, implement the necessary logic for opening a database, creating an object store, and wrapping `get`, `put`, and `delete` operations in `Promise`s.
3.  **Analyze the Call Stack:** The agent must perform a full-system analysis to identify every function that directly or indirectly calls a `Storage` method.
4.  **Propose Widespread Refactoring:** The agent must propose a large set of `modified` artifact changes. These changes will involve adding the `async` and `await` keywords to functions throughout the entire codebase (`state-manager.js`, `tool-runner.js`, `agent-cycle.js`, `app-logic.js`, etc.) to correctly handle the new asynchronous nature of the VFS.
5.  **Test Composition:** The final step would be for the operator to compose the agent using the `idb` upgrade instead of the `store` upgrade to activate the new backend.