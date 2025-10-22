# Blueprint 0x000036: Pyodide Runtime Orchestration

**Objective:** Document the worker-based Python runtime that powers REPLOID’s Pyodide integration.

**Target Upgrade:** PYOD (`pyodide-runtime.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000005 (State Management Architecture), 0x000010 (Static Tool Manifest), `pyodide-worker.js`

**Affected Artifacts:** `/upgrades/pyodide-runtime.js`, `/upgrades/pyodide-worker.js`, `/upgrades/python-tool.js`, `/upgrades/state-manager.js`

---

### 1. The Strategic Imperative
Running Python inside the browser unlocks a rich ecosystem without server round-trips. To stay safe:
- Execution must be sandboxed (Web Worker with Pyodide).
- Output/side effects must stream through controlled channels.
- The runtime must integrate with VFS for file IO.

### 2. Architectural Overview
`PyodideRuntime` manages a dedicated worker and message bus.

```javascript
const PyRuntime = await ModuleLoader.getModule('PyodideRuntime');
await PyRuntime.init();
const { stdout, result} = await PyRuntime.execute('print(41 + 1)');
```

Core components:
- **Worker Lifecycle**
  - `createWorker()` spins up `upgrades/pyodide-worker.js`.
  - `worker.onmessage` → `handleWorkerMessage`.
  - Emits `pyodide:ready`, `pyodide:stdout`, `pyodide:stderr` events on EventBus.
- **Message Protocol**
  - `sendMessage(type, data)` assigns incremental IDs, stores promises in `pendingMessages`, times out after 30s.
  - Responses with same ID resolve/reject callers.
- **Runtime API**
  - `init()` bootstraps worker and sends `init` message.
  - `execute(code, options)` runs Python, capturing stdout/stderr and returning result.
  - `installPackage(name)` uses micropip inside worker.
  - `syncFileToWorker(path)` / `syncFileFromWorker(path)` for VFS integration.
  - `syncWorkspace()` syncs entire artifact tree to Pyodide FS.
  - `listFiles(path)` / `getPackages()` for inspection.
  - `terminate()` gracefully stops worker.
- **State Integration**
  - `StateManager` persists session artifacts under `/vfs/python/`.
  - EventBus messages keep UI (console panel) in sync.

#### Monitoring Widget (Web Component)

The runtime provides a Web Component widget for monitoring and control:

```javascript
class PyodideRuntimeWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  getStatus() {
    // Access module state via closure
    const hasErrors = _executionErrors.length > 0;
    return {
      state: !isReady ? 'warning' : (hasErrors ? 'error' : (_executionCount > 0 ? 'active' : 'idle')),
      primaryMetric: isReady ? `${_executionCount} executions` : 'Initializing',
      secondaryMetric: `${_installedPackages.length} packages`,
      lastActivity: _lastExecutionTime,
      message: initError ? `Error: ${initError.message}` : (isReady ? 'Ready' : 'Loading...')
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .stat-value { font-size: 1.3em; font-weight: bold; }
        .stat-value.ready { color: #0c0; }
        .stat-value.error { color: #f00; }
      </style>
      <div class="widget-panel">
        <h3>⚯ Pyodide Runtime</h3>
        <div class="stats-grid">
          <!-- Status, executions, packages, file syncs -->
        </div>
        <!-- Installed packages list, recent errors, controls -->
      </div>
    `;

    // Event listeners for interactive controls
    this.shadowRoot.querySelector('.list-packages')?.addEventListener('click', async () => {
      const result = await getPackages();
      console.log('[PyodideRuntime] Packages:', result);
    });
  }
}

// Register custom element
if (!customElements.get('pyodide-runtime-widget')) {
  customElements.define('pyodide-runtime-widget', PyodideRuntimeWidget);
}

const widget = {
  element: 'pyodide-runtime-widget',
  displayName: 'Pyodide Runtime',
  icon: '⚯',
  category: 'runtime',
  updateInterval: 3000
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses module state (`isReady`, `_executionCount`, `_installedPackages`, `_executionErrors`) directly via closure.
- **Status Reporting**: `getStatus()` provides runtime state for dashboard integration.
- **Auto-Refresh**: Updates every 3 seconds to show current execution stats.
- **Interactive Controls**: Buttons to list packages and reset statistics.
- **Error Display**: Shows recent Python execution errors with timestamps.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core Runtime Implementation

1. **Initialization Flow**
   - On persona boot, call `init()`; listen for `pyodide:ready`.
   - Handle failures by showing toast + storing `initError`.
2. **Execution Pipeline**
   - Validate `isReady` before calling `execute`.
   - Provide options (`async`, `globals`, `files`) depending on worker capabilities.
   - Normalize results (convert PyProxy to JSON-friendly output).
   - Track execution stats: `_executionCount`, `_lastExecutionTime`, `_executionErrors`.
3. **VFS Integration**
   - Implement `syncFileToWorker(path)` to push files from Storage to Pyodide FS.
   - Implement `syncFileFromWorker(path)` to pull modified files back to VFS.
   - Implement `syncWorkspace()` to sync all artifacts.
4. **Error Handling**
   - Worker posts error messages; runtime rejects promise with error object.
   - Emit `pyodide:error` to EventBus for UI display.
   - Store recent errors in `_executionErrors` array (max 10).
5. **Resource Management**
   - Expose `terminate()` to gracefully stop worker.
   - Clean up `pendingMessages` on worker death to avoid dangling promises.

#### Widget Implementation (Web Component)

6. **Define Web Component Class** inside factory function:
   ```javascript
   class PyodideRuntimeWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```
7. **Implement Lifecycle Methods**:
   - `connectedCallback()`: Initial render and start 3-second auto-refresh interval
   - `disconnectedCallback()`: Clean up interval to prevent memory leaks
8. **Implement getStatus()** as class method with closure access:
   - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
   - Access module state (`isReady`, `_executionCount`, `_installedPackages`) via closure
9. **Implement render()** method:
   - Set `this.shadowRoot.innerHTML` with encapsulated styles
   - Display stats grid (status, executions, packages, file syncs)
   - Show installed packages list (if any)
   - Show recent errors with timestamps (if any)
   - Add interactive controls (list packages, reset stats)
   - Attach event listeners to buttons
10. **Register Custom Element**:
    - Use kebab-case naming: `pyodide-runtime-widget`
    - Add duplicate check: `if (!customElements.get('pyodide-runtime-widget'))`
    - Call `customElements.define('pyodide-runtime-widget', PyodideRuntimeWidget)`
11. **Return Widget Object** with new format:
    - `{ element: 'pyodide-runtime-widget', displayName: 'Pyodide Runtime', icon: '⚯', category: 'runtime' }`
12. **Test** Shadow DOM rendering, lifecycle cleanup, and closure access to runtime state

### 4. Verification Checklist
- [ ] Double init doesn’t spawn duplicate workers (guard via `isReady`).
- [ ] Timeouts reject promises with descriptive errors.
- [ ] stdout/stderr events arrive in order and include original payload.
- [ ] Packages install inside worker without blocking UI thread.
- [ ] Worker termination frees resources (no zombie workers).

### 5. Extension Opportunities
- Support multiple named runtimes (parallel sandboxes).
- Streamlined file mounts (select subset of VFS directories).
- Integrate with `ToolRunner` so Python tools run seamlessly.
- Add execution quotas (max runtime, memory) enforced by worker watchdog.

Maintain this blueprint when altering worker protocol, initialization sequence, or storage integration.
