# Blueprint 0x000037: Python Tool Interface

**Objective:** Specify the tool contract that exposes Pyodide capabilities to the agent via structured tool calls.

**Target Upgrade:** PYTH (`python-tool.js`)

**Prerequisites:** 0x000036 (Pyodide Runtime Orchestration), 0x000010 (Static Tool Manifest), 0x000025 (Universal Module Loader)

**Affected Artifacts:** `/upgrades/python-tool.js`, `/modules/tools-write.json`, `/upgrades/tool-runner.js`

---

### 1. The Strategic Imperative
The agent needs a safe bridge from natural-language plans to executable Python. This tool layer:
- Defines deterministic tool schemas so LLMs can reason about available actions.
- Handles runtime readiness, package installation, and workspace syncing.
- Normalizes results and errors for downstream reasoning.

### 2. Architectural Overview
`PythonTool` registers three tools with the Tool Runner:

```javascript
const Python = await ModuleLoader.getModule('PythonTool');
const declarations = Python.api.getToolDeclarations();
await ToolRunner.registerTools(declarations, Python.api.executeTool);
```

- **`execute_python`**
  - Parameters: `code`, optional `install_packages[]`, `sync_workspace`.
  - Flow: ensure runtime ready → install packages → optional sync → `PyodideRuntime.execute`.
  - Returns `{ success, result, stdout, stderr, executionTime }` or error info.
- **`install_python_package`**
  - Thin wrapper around `PyodideRuntime.installPackage`.
- **`list_python_packages`**
  - Returns installed packages metadata from runtime.

Utility functions:
- `getToolDeclarations()` provides schema to `tools-write.json`.
- `executeTool(name, args)` dispatches to the appropriate helper.

**Widget Interface (Web Component):**

The module exposes a `PythonToolWidget` custom element for dashboard visualization:

```javascript
class PythonToolWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), this.updateInterval || 2000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this._pyodideRuntime = window.DIContainer?.resolve('PyodideRuntime');
    this.render();
  }

  getStatus() {
    const stats = this._api.getStats();
    const isReady = this._pyodideRuntime?.isReady?.() || false;

    return {
      state: isReady ? (stats.executionCount > 0 ? 'active' : 'idle') : 'warning',
      primaryMetric: `${stats.executionCount} executions`,
      secondaryMetric: isReady ? 'Ready' : 'Initializing',
      lastActivity: stats.lastExecutionTime
    };
  }

  render() {
    const stats = this._api.getStats();
    const isReady = this._pyodideRuntime?.isReady?.() || false;
    const pyodideState = this._pyodideRuntime?.getState?.() || {};

    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div class="widget-content">
        <!-- Statistics grid (executions, success rate, avg time, errors) -->
        <!-- Available tools list (execute_python, install_package, list_packages) -->
        <!-- Installed packages list (scrollable) -->
        <!-- Pyodide runtime status (ready/initializing/error) -->
        <!-- Last execution timestamp -->
      </div>
    `;
  }
}

customElements.define('python-tool-widget', PythonToolWidget);
```

**Key Widget Features:**
- **Execution Statistics Grid**: Displays execution count, success rate, average execution time, and error count
- **Tool Catalog**: Lists available Python tools (execute_python, install_python_package, list_python_packages)
- **Package Manager**: Scrollable list of installed Pyodide packages with version numbers
- **Runtime Status Indicator**: Shows Pyodide readiness state (Ready/Initializing/Error) with color coding
- **Activity Tracking**: Displays time since last execution with relative timestamps (e.g., "2m ago")
- **Auto-refresh**: Updates every 2 seconds to reflect current execution state

The widget provides visibility into Python execution activity and Pyodide runtime health, essential for debugging tool calls and package dependencies.

### 3. Implementation Pathway
1. **Initialization**
   - Ensure `PyodideRuntime.init()` runs during persona boot; tool should check `isReady()` before usage.
2. **Package Management**
   - Iterate `install_packages` sequentially, aborting on first failure with descriptive message.
   - Consider caching installed packages to avoid duplicate work.
3. **Workspace Sync**
   - When `sync_workspace` true, call `PyodideRuntime.syncWorkspace()` prior to execution so Python sees latest files.
   - Future enhancement: allow selective syncing (paths whitelist).
4. **Result Formatting**
   - Standardize success object to help LLM summarise output.
   - Include stdout/stderr even on success for transparency.
   - Mask stack traces when sending to user-facing UI, but keep for logs.
5. **Error Handling**
   - Catch runtime exceptions, log via `logger.error`, and return `success: false` with message/traceback.
   - Map common errors to actionable advice (runtime not ready, package missing, syntax error).

### 4. Verification Checklist
- [ ] Tools registered with Tool Runner and appear in `tools-write.json`.
- [ ] Runtime-not-ready path returns friendly error (no throw).
- [ ] Package installs respect micropip semantics; failure surfaces actual pip error.
- [ ] Execution results propagate to reflections/test harness when required.
- [ ] Tool call remains deterministic (no non-serializable data).

### 5. Extension Opportunities
- Support uploading Python files via VFS for large scripts.
- Provide `execute_python_file` tool referencing path rather than inline code.
- Add resource limits (max execution time) configurable per persona.
- Stream stdout for long-running jobs via EventBus.

This blueprint must accompany changes to the Python tool API or integration with Pyodide.
