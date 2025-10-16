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
const { stdout, result } = await PyRuntime.execute('print(41 + 1)');
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
  - `runModule(path)` loads module from VFS.
  - `installPackage(name)` uses micropip inside worker.
  - `terminate()` gracefully stops worker.
- **State Integration**
  - `StateManager` persists session artifacts under `/vfs/python/`.
  - EventBus messages keep UI (console panel) in sync.

### 3. Implementation Pathway
1. **Initialization Flow**
   - On persona boot, call `init()`; listen for `pyodide:ready`.
   - Handle failures by showing toast + storing `initError`.
2. **Execution Pipeline**
   - Validate `isReady` before calling `execute`.
   - Provide options (`async`, `globals`, `files`) depending on worker capabilities.
   - Normalize results (convert PyProxy to JSON-friendly output).
3. **VFS Integration**
   - Prior to execution, sync necessary files into worker via message (`syncFiles`).
   - After execution, persist modified files back to VFS (`Storage.setArtifactContent`).
4. **Error Handling**
   - Worker posts error messages; runtime rejects promise with error object.
   - Emit `pyodide:error` to EventBus for UI display.
5. **Resource Management**
   - Expose `reset()` to terminate and recreate worker (useful after fatal errors).
   - Clean up `pendingMessages` on worker death to avoid dangling promises.

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
