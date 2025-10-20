# Blueprint 0x000060: Pyodide Worker & Visualization Widget

**Objective:** Provide a sandboxed Python runtime using Pyodide WebAssembly in a Web Worker, with real-time status visualization.

**Target Upgrade:** PyodideWorker (`pyodide-worker.js`)

**Prerequisites:** 0x000057 (Worker Pool), 0x000036 (Pyodide Runtime)

**Affected Artifacts:** `/upgrades/pyodide-worker.js`

---

### 1. The Strategic Imperative

Running Python code in a browser-based AI agent requires:

- **Thread Isolation**: Pyodide initialization and execution must not block the main UI thread
- **WebAssembly Sandbox**: Python code runs in a secure, isolated environment
- **Output Capture**: Stdout/stderr must be captured and sent to the main thread
- **Package Management**: Dynamic installation of Python packages via micropip
- **Virtual Filesystem**: Python code needs file I/O capabilities within the worker
- **Status Monitoring**: Real-time visibility into worker state, queue, and performance

The Pyodide Worker implements a dedicated Web Worker that loads and manages the Pyodide runtime, providing a Python execution environment for the REPLOID agent.

### 2. The Architectural Solution

The `/upgrades/pyodide-worker.js` implements both **Web Worker logic** (runs in worker context) and **Widget visualization** (runs in main thread).

#### Worker Context Architecture

```javascript
// Runs in Web Worker context
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;
let isReady = false;
let initError = null;

async function initializePyodide() {
  pyodide = await loadPyodide({
    indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
    stdout: (msg) => {
      self.postMessage({ type: 'stdout', data: msg });
    },
    stderr: (msg) => {
      self.postMessage({ type: 'stderr', data: msg });
    }
  });

  await pyodide.loadPackage('micropip');
  isReady = true;
}

async function executePython(code, options = {}) {
  const result = options.async
    ? await pyodide.runPythonAsync(code)
    : pyodide.runPython(code);

  return {
    success: true,
    result: result?.toJs?.({ dict_converter: Object.fromEntries }) || result,
    stdout: await pyodide.runPythonAsync('sys.stdout.getvalue()'),
    stderr: await pyodide.runPythonAsync('sys.stderr.getvalue()')
  };
}
```

#### Message Handler Protocol

```javascript
self.onmessage = async (event) => {
  const { id, type, data } = event.data;

  let result;
  switch (type) {
    case 'init':
      await initializePyodide();
      result = { initialized: true };
      break;

    case 'execute':
      result = await executePython(data.code, data.options || {});
      break;

    case 'install':
      result = await installPackage(data.package);
      break;

    case 'writeFile':
      result = await writeFile(data.path, data.content);
      break;

    case 'readFile':
      result = await readFile(data.path);
      break;
  }

  self.postMessage({ id, type: 'response', data: result });
};
```

#### Widget Visualization (Main Thread)

```javascript
class PyodideWorkerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getStatus() {
    const runtime = window.app?.modules?.PyodideRuntime;
    const workerState = runtime.getWorkerState?.() || {};
    const queueSize = runtime.getQueueSize?.() || 0;
    const isReady = workerState.ready || false;
    const error = workerState.error || null;

    return {
      state: error ? 'error' : (isReady ? 'idle' : 'active'),
      primaryMetric: `${queueSize} queued`,
      secondaryMetric: isReady ? `Ready (${workerState.version})` : 'Initializing...',
      lastActivity: workerState.lastTaskTime || null,
      message: error || null
    };
  }

  render() {
    const status = this.getStatus();
    // Render status panel with queue size, ready state, version
  }
}

customElements.define('pyodide-worker-widget', PyodideWorkerWidget);
```

### 3. Core Responsibilities

1. **Worker Initialization**: Load Pyodide CDN, configure stdout/stderr capture
2. **Python Execution**: Run synchronous or asynchronous Python code
3. **Package Management**: Install Python packages via micropip
4. **Virtual Filesystem**: Provide file I/O within Pyodide's Emscripten FS
5. **Output Streaming**: Capture and forward stdout/stderr to main thread
6. **Error Handling**: Catch Python exceptions and return structured error responses
7. **Status Widget**: Real-time visualization of worker state, queue, errors

### 4. The Implementation Pathway

#### Step 1: Worker Initialization

```javascript
async function initializePyodide() {
  try {
    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      stdout: (msg) => self.postMessage({ type: 'stdout', data: msg }),
      stderr: (msg) => self.postMessage({ type: 'stderr', data: msg })
    });

    await pyodide.loadPackage('micropip');

    // Set up Python environment
    await pyodide.runPythonAsync(`
import sys
import io
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    isReady = true;
    self.postMessage({ type: 'ready', data: { version: pyodide.version } });
  } catch (error) {
    initError = error;
    self.postMessage({ type: 'error', data: { message: error.message } });
  }
}
```

#### Step 2: Python Code Execution

```javascript
async function executePython(code, options = {}) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  const startTime = Date.now();

  // Clear previous output
  await pyodide.runPythonAsync(`
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
  `);

  // Execute code
  let result = options.async
    ? await pyodide.runPythonAsync(code)
    : pyodide.runPython(code);

  // Capture output
  const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
  const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');

  // Convert result to JavaScript
  let jsResult;
  if (result && typeof result.toJs === 'function') {
    jsResult = result.toJs({ dict_converter: Object.fromEntries });
  } else {
    jsResult = result;
  }

  return {
    success: true,
    result: jsResult,
    stdout: stdout || '',
    stderr: stderr || '',
    executionTime: Date.now() - startTime
  };
}
```

#### Step 3: Package Installation

```javascript
async function installPackage(packageName) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  await pyodide.runPythonAsync(`
import micropip
await micropip.install('${packageName}')
  `);

  return {
    success: true,
    package: packageName
  };
}
```

#### Step 4: Virtual Filesystem Operations

```javascript
async function writeFile(path, content) {
  // Ensure parent directory exists
  const dirPath = path.substring(0, path.lastIndexOf('/'));
  if (dirPath) {
    await pyodide.runPythonAsync(`
import os
os.makedirs('${dirPath}', exist_ok=True)
    `);
  }

  // Write file
  pyodide.FS.writeFile(path, content);

  return { success: true, path };
}

async function readFile(path) {
  const content = pyodide.FS.readFile(path, { encoding: 'utf8' });
  return { success: true, content, path };
}
```

#### Step 5: Widget Status Monitoring

```javascript
class PyodideWorkerWidget extends HTMLElement {
  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
    }
  }

  getStatus() {
    const runtime = window.app?.modules?.PyodideRuntime;

    if (!runtime) {
      return {
        state: 'disabled',
        primaryMetric: 'Not loaded',
        secondaryMetric: 'Runtime missing',
        message: 'PyodideRuntime module not available'
      };
    }

    const workerState = runtime.getWorkerState?.() || {};
    const queueSize = runtime.getQueueSize?.() || 0;
    const isReady = workerState.ready || false;
    const error = workerState.error || null;

    return {
      state: error ? 'error' : (isReady ? 'idle' : 'active'),
      primaryMetric: `${queueSize} queued`,
      secondaryMetric: isReady ? `Ready (${workerState.version})` : 'Initializing...',
      lastActivity: workerState.lastTaskTime || null,
      message: error || null
    };
  }
}
```

### 5. Operational Safeguards & Quality Gates

- **Initialization Check**: All operations verify `isReady` before executing
- **Error Boundaries**: Wrap all Python execution in try/catch blocks
- **Output Isolation**: Clear stdout/stderr before each execution
- **Type Conversion**: Use `toJs()` with dict_converter for Python→JS objects
- **CDN Stability**: Pin Pyodide version (v0.26.4) for reproducibility
- **Worker Lifecycle**: Handle worker termination and cleanup

### 6. Widget Protocol Compliance

**Required `getStatus()` Method:**

```javascript
getStatus() {
  return {
    state: 'idle' | 'active' | 'error' | 'disabled',
    primaryMetric: `${queueSize} queued`,
    secondaryMetric: `Ready (${version})` | 'Initializing...',
    lastActivity: timestamp | null,
    message: errorMessage | null
  };
}
```

**Widget Registration:**

```javascript
window.PyodideWorkerWidget = {
  element: 'pyodide-worker-widget',
  displayName: 'Pyodide Worker',
  icon: '⚙️',
  category: 'worker'
};
```

### 7. Extension Points

- **Package Caching**: Cache installed packages across sessions
- **Execution Limits**: Add timeout and memory limits to Python execution
- **Multi-Worker Pool**: Create multiple Pyodide workers for parallelism
- **Custom Packages**: Pre-load commonly used Python packages
- **WASM Optimization**: Use custom Pyodide builds with specific packages
- **Performance Metrics**: Track execution time, memory usage, package load time

Use this blueprint when implementing Python tool execution, adding Python-based analysis capabilities, or debugging the Pyodide runtime worker.
