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
