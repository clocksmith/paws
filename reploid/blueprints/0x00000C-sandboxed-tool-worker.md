# Blueprint 0x00000C: Sandboxed Tool Worker

**Objective:** To explain the security and concurrency benefits of executing dynamically created tools within a sandboxed Web Worker.

**Target Upgrade:** WRKR (`tool-worker.js`)


**Prerequisites:** `0x00000A`

**Affected Artifacts:** `/modules/tool-worker.js`, `/modules/tool-runner.js`

---

### 1. The Strategic Imperative

A core goal of the agent is to improve itself by creating new tools. However, executing LLM-generated code directly on the main browser thread is extremely dangerous. It poses a significant security risk (the code could be malicious) and a performance risk (an infinite loop could freeze the entire application). A sandboxed environment is non-negotiable for safe, dynamic tool execution. The browser's `Web Worker` provides the perfect mechanism for this.

### 2. The Architectural Solution

The architecture involves a main thread `ToolRunner` and a separate `tool-worker.js` script.

1.  **The Worker (`/modules/tool-worker.js`):**
    -   This script runs in a completely separate global scope with no access to the `window` or `document` objects.
    -   It sets up an `onmessage` listener to receive code and arguments from the `ToolRunner`.
    -   It uses the `new Function()` constructor to safely execute the received tool code. The `Function` constructor provides a degree of sandboxing by controlling the scope of the executed code.
    -   It provides a "shim" API, allowing the sandboxed code to safely request data from the main thread (e.g., `LS_shim.getArtifactContent(...)`) via a `postMessage` request/response protocol.

2.  **The Runner (`/modules/tool-runner.js`):**
    -   When asked to run a *dynamic* tool, the `ToolRunner` will not execute the code itself.
    -   Instead, it will instantiate a new `Worker`, passing it the path to `/modules/tool-worker.js`.
    -   It will use `worker.postMessage()` to send the tool's code and arguments to the worker.
    -   It will listen for the `message` event from the worker to receive the result (or an error) and `await` a `Promise` that resolves when the worker is finished.
    -   Crucially, it will implement a timeout to terminate the worker if it runs for too long, preventing infinite loops.

### 3. The Implementation Pathway

1.  **Create Worker Script:** Implement `/modules/tool-worker.js`. It should contain the `onmessage` handler and the shimmed APIs for `localStorage` and `StateManager` access.
2.  **Modify `ToolRunner`:**
    a.  Add the logic to the `runTool` function to handle the `dynamicTool` case.
    b.  This logic will create a new `Worker` and return a `Promise`.
    c.  The promise's `resolve` and `reject` functions will be called inside the `worker.onmessage` and `worker.onerror` handlers.
    d.  Implement the `setTimeout` to call `worker.terminate()` and reject the promise if the tool execution exceeds a configured time limit.
3.  **Implement Worker Shim Handlers:** The `ToolRunner`'s `worker.onmessage` handler must also be able to respond to data requests from the worker's shims, calling the real `Storage` or `StateManager` and posting the result back to the worker.