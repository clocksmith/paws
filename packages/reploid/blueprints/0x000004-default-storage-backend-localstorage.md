# Blueprint 0x000004: Default Storage Backend (localStorage)

**Objective:** To provide a simple, synchronous persistence layer for the agent's Virtual File System (VFS) using the browser's `localStorage` API.

**Target Upgrade:** LSTR (`storage-localstorage.js`)


**Prerequisites:** `0x000003`

**Affected Artifacts:** `/modules/storage.js`

---

### 1. The Strategic Imperative

An agent requires a persistent memory to store its state, its own source code (artifacts), and its knowledge base (blueprints). For the primordial agent, the persistence layer must be simple, universally available, and easy to implement. The browser's `localStorage` API fits these requirements perfectly. It provides a straightforward key-value store that can serve as the foundational backend for the agent's VFS.

### 2. The Architectural Solution

The `/modules/storage.js` artifact will act as a dedicated wrapper around the global `localStorage` object. This abstraction is critical, as it isolates the rest of the application from the specific storage implementation. The module will expose a clean, file-system-like API for other modules to use.

Key features of the implementation:
-   **VFS Prefixing:** All keys stored in `localStorage` will be prefixed with a unique string (e.g., `_x0_vfs_`) to prevent collisions with other web applications using the same origin.
-   **Path-Based Keys:** The module will translate VFS paths (e.g., `/modules/utils.js`) into valid `localStorage` keys (e.g., `_x0_vfs_/modules/utils.js`).
-   **Error Handling:** All calls to `localStorage` will be wrapped in `try...catch` blocks to gracefully handle potential storage errors, such as the quota being exceeded, and re-throw them as custom `StorageError` types.

**Widget Interface (Web Component):**

The module exposes a `StorageLocalStorageWidget` custom element for dashboard visualization:

```javascript
class StorageLocalStorageWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._updateInterval = null;
  }

  connectedCallback() {
    this.render();
    // 5-second refresh for storage monitoring
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
    const usage = calculateStorageUsage();
    const isActive = _lastActivity && (Date.now() - _lastActivity < 2000);
    return {
      state: isActive ? 'active' : 'idle',
      primaryMetric: `${usage.totalMB} MB`,
      secondaryMetric: `${_artifactPaths.size} artifacts`,
      lastActivity: _lastActivity,
      message: `${_ioStats.reads}R ${_ioStats.writes}W ${_ioStats.deletes}D`
    };
  }

  render() {
    const usage = calculateStorageUsage();
    const isActive = _lastActivity && (Date.now() - _lastActivity < 2000);

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">
        <!-- Storage usage grid (total MB, percentage, artifact count, I/O stats) -->
        <!-- Recent operations list (last 20 operations with timestamps) -->
        <!-- Interactive controls (Clear All, Reset Stats) -->
      </div>
    `;
  }
}

const elementName = 'storage-localstorage-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, StorageLocalStorageWidget);
}
```

**Key Widget Features:**
- **Storage Usage Monitoring**: Real-time display of total storage in MB and percentage of quota
- **Artifact Tracking**: Shows count of stored artifacts (files in VFS)
- **I/O Statistics**: Tracks and displays read/write/delete operation counts since initialization
- **Recent Operations Log**: Displays last 20 storage operations with timestamps and operation type
- **Activity Detection**: Widget state changes from 'idle' to 'active' based on recent activity (within 2 seconds)
- **Interactive Controls**:
  - Clear All button to wipe all VFS storage
  - Reset Stats button to clear I/O counters
- **Auto-Refresh**: Updates every 5 seconds to monitor storage usage trends
- **Quota Warning**: Visual indication when storage approaches browser limits

The widget provides essential visibility into the persistence layer, critical for monitoring storage health, debugging VFS operations, and managing browser storage quota constraints.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `StorageModule` factory function in `/modules/storage.js`.
2.  **Implement Core Functions:**
    -   `getArtifactContent(path)`: Constructs the prefixed key and calls `localStorage.getItem()`.
    -   `setArtifactContent(path, content)`: Constructs the key and calls `localStorage.setItem()`.
    -   `deleteArtifactVersion(path)`: Constructs the key and calls `localStorage.removeItem()`.
3.  **Implement State Helpers:** Create convenience functions like `getState()` and `saveState(stateString)` that simply call the core functions with the hardcoded path for the state artifact (e.g., `/system/state.json`).
4.  **Dependency Injection:** The `/modules/app-logic.js` orchestrator will inject the initialized `Storage` module into the `StateManager`, which will then use it for all persistence operations.