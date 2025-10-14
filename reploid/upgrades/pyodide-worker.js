/**
 * @fileoverview Pyodide Web Worker for REPLOID
 * Runs Python code in a sandboxed WebAssembly environment.
 * Isolated in a Web Worker to prevent blocking the main thread.
 *
 * @module PyodideWorker
 * @version 1.0.0
 * @category runtime
 */

// This file runs in a Web Worker context, not the main thread
importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');

let pyodide = null;
let isReady = false;
let initError = null;

/**
 * Initialize Pyodide runtime
 */
async function initializePyodide() {
  try {
    console.log('[PyodideWorker] Loading Pyodide runtime...');

    // Load Pyodide from CDN
    pyodide = await loadPyodide({
      indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
      stdout: (msg) => {
        // Send stdout to main thread
        self.postMessage({
          type: 'stdout',
          data: msg
        });
      },
      stderr: (msg) => {
        // Send stderr to main thread
        self.postMessage({
          type: 'stderr',
          data: msg
        });
      }
    });

    // Load commonly used packages
    console.log('[PyodideWorker] Loading micropip...');
    await pyodide.loadPackage('micropip');

    // Set up sys.path and basic environment
    await pyodide.runPythonAsync(`
import sys
import io
from js import Object

# Redirect stdout/stderr to capture output
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()

print("[Pyodide] Python runtime initialized")
print(f"[Pyodide] Python version: {sys.version}")
    `);

    isReady = true;
    console.log('[PyodideWorker] Pyodide initialized successfully');

    self.postMessage({
      type: 'ready',
      data: {
        version: pyodide.version,
        platform: 'emscripten'
      }
    });

  } catch (error) {
    initError = error;
    console.error('[PyodideWorker] Failed to initialize Pyodide:', error);

    self.postMessage({
      type: 'error',
      data: {
        message: 'Failed to initialize Pyodide',
        error: error.message,
        stack: error.stack
      }
    });
  }
}

/**
 * Execute Python code
 */
async function executePython(code, options = {}) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
    const startTime = Date.now();

    // Clear previous stdout/stderr
    await pyodide.runPythonAsync(`
sys.stdout = io.StringIO()
sys.stderr = io.StringIO()
    `);

    // Execute the code
    let result;
    if (options.async) {
      result = await pyodide.runPythonAsync(code);
    } else {
      result = pyodide.runPython(code);
    }

    // Capture stdout/stderr
    const stdout = await pyodide.runPythonAsync('sys.stdout.getvalue()');
    const stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');

    const executionTime = Date.now() - startTime;

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
      executionTime
    };

  } catch (error) {
    // Capture stderr even on error
    let stderr = '';
    try {
      stderr = await pyodide.runPythonAsync('sys.stderr.getvalue()');
    } catch (e) {
      // Ignore errors getting stderr
    }

    return {
      success: false,
      error: error.message,
      traceback: error.stack,
      stderr,
      executionTime: Date.now() - startTime
    };
  }
}

/**
 * Install Python package using micropip
 */
async function installPackage(packageName) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
    console.log(`[PyodideWorker] Installing package: ${packageName}`);

    await pyodide.runPythonAsync(`
import micropip
await micropip.install('${packageName}')
    `);

    console.log(`[PyodideWorker] Package installed: ${packageName}`);

    return {
      success: true,
      package: packageName
    };

  } catch (error) {
    console.error(`[PyodideWorker] Failed to install ${packageName}:`, error);

    return {
      success: false,
      error: error.message,
      package: packageName
    };
  }
}

/**
 * Write file to Pyodide virtual filesystem
 */
async function writeFile(path, content) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
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

    return {
      success: true,
      path
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

/**
 * Read file from Pyodide virtual filesystem
 */
async function readFile(path) {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
    const content = pyodide.FS.readFile(path, { encoding: 'utf8' });

    return {
      success: true,
      content,
      path
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

/**
 * List files in directory
 */
async function listDir(path = '/') {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
    const files = pyodide.FS.readdir(path);

    return {
      success: true,
      files: files.filter(f => f !== '.' && f !== '..'),
      path
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      path
    };
  }
}

/**
 * Get list of installed packages
 */
async function getInstalledPackages() {
  if (!isReady) {
    throw new Error('Pyodide not initialized');
  }

  try {
    const packages = await pyodide.runPythonAsync(`
import micropip
list(micropip.list().keys())
    `);

    return {
      success: true,
      packages: packages.toJs()
    };

  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Message handler
 */
self.onmessage = async (event) => {
  const { id, type, data } = event.data;

  try {
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

      case 'listDir':
        result = await listDir(data.path);
        break;

      case 'getPackages':
        result = await getInstalledPackages();
        break;

      case 'getStatus':
        result = {
          ready: isReady,
          error: initError ? initError.message : null,
          version: pyodide ? pyodide.version : null
        };
        break;

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    // Send response back to main thread
    self.postMessage({
      id,
      type: 'response',
      data: result
    });

  } catch (error) {
    // Send error response
    self.postMessage({
      id,
      type: 'error',
      data: {
        message: error.message,
        stack: error.stack
      }
    });
  }
};

// Log that worker is loaded
console.log('[PyodideWorker] Worker loaded, waiting for init message');
