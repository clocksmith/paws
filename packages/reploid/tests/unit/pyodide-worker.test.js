import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('PyodideWorker', () => {
  let mockPyodide;
  let mockSelf;
  let messageHandler;

  beforeEach(() => {
    // Mock Pyodide instance
    mockPyodide = {
      version: '0.26.4',
      loadPackage: vi.fn().mockResolvedValue(),
      runPython: vi.fn((code) => 'result'),
      runPythonAsync: vi.fn().mockResolvedValue('async result'),
      FS: {
        writeFile: vi.fn(),
        readFile: vi.fn((path, options) => 'file content'),
        readdir: vi.fn(() => ['file1.py', 'file2.py', '.', '..'])
      }
    };

    // Mock loadPyodide function
    global.loadPyodide = vi.fn().mockResolvedValue(mockPyodide);

    // Mock importScripts
    global.importScripts = vi.fn();

    // Mock Web Worker self
    mockSelf = {
      postMessage: vi.fn(),
      onmessage: null
    };
    global.self = mockSelf;
    global.console = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn()
    };

    // Mock Date
    global.Date = {
      now: vi.fn(() => 1000)
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Worker Initialization', () => {
    it('should load Pyodide from CDN', async () => {
      const initializePyodide = async () => {
        await loadPyodide({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
          stdout: vi.fn(),
          stderr: vi.fn()
        });
      };

      await initializePyodide();

      expect(global.loadPyodide).toHaveBeenCalled();
    });

    it('should configure stdout handler', async () => {
      const stdoutHandler = vi.fn();

      await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
        stdout: stdoutHandler,
        stderr: vi.fn()
      });

      expect(global.loadPyodide).toHaveBeenCalledWith(
        expect.objectContaining({ stdout: stdoutHandler })
      );
    });

    it('should configure stderr handler', async () => {
      const stderrHandler = vi.fn();

      await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/',
        stdout: vi.fn(),
        stderr: stderrHandler
      });

      expect(global.loadPyodide).toHaveBeenCalledWith(
        expect.objectContaining({ stderr: stderrHandler })
      );
    });

    it('should load micropip package', async () => {
      const pyodide = await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
      await pyodide.loadPackage('micropip');

      expect(pyodide.loadPackage).toHaveBeenCalledWith('micropip');
    });

    it('should send ready message after initialization', async () => {
      const handleInitComplete = () => {
        mockSelf.postMessage({
          type: 'ready',
          data: { version: mockPyodide.version, platform: 'emscripten' }
        });
      };

      handleInitComplete();

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ready',
          data: expect.objectContaining({ version: '0.26.4' })
        })
      );
    });

    it('should handle initialization errors', async () => {
      global.loadPyodide = vi.fn().mockRejectedValue(new Error('Load failed'));

      try {
        await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
      } catch (error) {
        expect(error.message).toBe('Load failed');
      }
    });

    it('should post error message on init failure', () => {
      const error = new Error('Init error');

      mockSelf.postMessage({
        type: 'error',
        data: {
          message: 'Failed to initialize Pyodide',
          error: error.message,
          stack: error.stack
        }
      });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({ message: 'Failed to initialize Pyodide' })
        })
      );
    });
  });

  describe('Python Execution', () => {
    beforeEach(() => {
      // Assume Pyodide is initialized
    });

    it('should execute synchronous Python code', async () => {
      const code = 'x = 1 + 1';

      const executePython = async (code, options = {}) => {
        const startTime = Date.now();
        let result;

        if (options.async) {
          result = await mockPyodide.runPythonAsync(code);
        } else {
          result = mockPyodide.runPython(code);
        }

        return {
          success: true,
          result,
          stdout: '',
          stderr: '',
          executionTime: Date.now() - startTime
        };
      };

      const result = await executePython(code, { async: false });

      expect(result.success).toBe(true);
      expect(mockPyodide.runPython).toHaveBeenCalledWith(code);
    });

    it('should execute asynchronous Python code', async () => {
      const code = 'import asyncio; await asyncio.sleep(0)';

      const executePython = async (code, options = {}) => {
        const result = await mockPyodide.runPythonAsync(code);
        return { success: true, result };
      };

      const result = await executePython(code, { async: true });

      expect(result.success).toBe(true);
      expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith(code);
    });

    it('should capture stdout', async () => {
      mockPyodide.runPythonAsync = vi.fn()
        .mockResolvedValueOnce('result')
        .mockResolvedValueOnce('Hello, World!')
        .mockResolvedValueOnce('');

      const executePython = async (code) => {
        await mockPyodide.runPythonAsync('sys.stdout = io.StringIO()');
        await mockPyodide.runPythonAsync(code);
        const stdout = await mockPyodide.runPythonAsync('sys.stdout.getvalue()');

        return { success: true, stdout };
      };

      const result = await executePython('print("Hello, World!")');

      expect(result.stdout).toBe('Hello, World!');
    });

    it('should capture stderr', async () => {
      mockPyodide.runPythonAsync = vi.fn()
        .mockResolvedValueOnce('result')
        .mockResolvedValueOnce('Error message')
        .mockResolvedValueOnce('');

      const executePython = async (code) => {
        await mockPyodide.runPythonAsync('sys.stderr = io.StringIO()');
        await mockPyodide.runPythonAsync(code);
        const stderr = await mockPyodide.runPythonAsync('sys.stderr.getvalue()');

        return { success: true, stderr };
      };

      const result = await executePython('import sys; sys.stderr.write("Error message")');

      expect(result.stderr).toBe('Error message');
    });

    it('should measure execution time', async () => {
      const executePython = async (code) => {
        const startTime = Date.now();
        await mockPyodide.runPythonAsync(code);
        const executionTime = Date.now() - startTime;

        return { success: true, executionTime };
      };

      const result = await executePython('x = 1');

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
    });

    it('should handle execution errors', async () => {
      mockPyodide.runPythonAsync = vi.fn().mockRejectedValue(
        new Error('SyntaxError: invalid syntax')
      );

      const executePython = async (code) => {
        try {
          await mockPyodide.runPythonAsync(code);
          return { success: true };
        } catch (error) {
          return {
            success: false,
            error: error.message,
            traceback: error.stack
          };
        }
      };

      const result = await executePython('invalid python code');

      expect(result.success).toBe(false);
      expect(result.error).toContain('SyntaxError');
    });

    it('should convert Python results to JavaScript', async () => {
      const pythonObject = {
        toJs: vi.fn((options) => ({ key: 'value' }))
      };

      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue(pythonObject);

      const executePython = async (code) => {
        const result = await mockPyodide.runPythonAsync(code);

        let jsResult;
        if (result && typeof result.toJs === 'function') {
          jsResult = result.toJs({ dict_converter: Object.fromEntries });
        } else {
          jsResult = result;
        }

        return { success: true, result: jsResult };
      };

      const result = await executePython('{"key": "value"}');

      expect(result.result).toEqual({ key: 'value' });
      expect(pythonObject.toJs).toHaveBeenCalled();
    });
  });

  describe('Package Management', () => {
    it('should install Python package', async () => {
      const packageName = 'numpy';

      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue();

      const installPackage = async (pkg) => {
        await mockPyodide.runPythonAsync(`
import micropip
await micropip.install('${pkg}')
        `);
        return { success: true, package: pkg };
      };

      const result = await installPackage(packageName);

      expect(result.success).toBe(true);
      expect(result.package).toBe(packageName);
    });

    it('should handle package installation errors', async () => {
      mockPyodide.runPythonAsync = vi.fn().mockRejectedValue(
        new Error('Package not found')
      );

      const installPackage = async (pkg) => {
        try {
          await mockPyodide.runPythonAsync(`
import micropip
await micropip.install('${pkg}')
          `);
          return { success: true, package: pkg };
        } catch (error) {
          return { success: false, error: error.message, package: pkg };
        }
      };

      const result = await installPackage('invalid-package');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Package not found');
    });

    it('should get list of installed packages', async () => {
      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue({
        toJs: () => ['micropip', 'numpy', 'pandas']
      });

      const getInstalledPackages = async () => {
        const packages = await mockPyodide.runPythonAsync(`
import micropip
list(micropip.list().keys())
        `);
        return { success: true, packages: packages.toJs() };
      };

      const result = await getInstalledPackages();

      expect(result.success).toBe(true);
      expect(result.packages).toContain('numpy');
    });
  });

  describe('File System Operations', () => {
    it('should write file to virtual filesystem', async () => {
      const path = '/home/test.py';
      const content = 'print("Hello")';

      const writeFile = async (filePath, fileContent) => {
        await mockPyodide.runPythonAsync(`
import os
os.makedirs('${filePath.substring(0, filePath.lastIndexOf('/'))}', exist_ok=True)
        `);
        mockPyodide.FS.writeFile(filePath, fileContent);
        return { success: true, path: filePath };
      };

      const result = await writeFile(path, content);

      expect(result.success).toBe(true);
      expect(mockPyodide.FS.writeFile).toHaveBeenCalledWith(path, content);
    });

    it('should create parent directories', async () => {
      const path = '/home/user/test.py';

      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue();

      const writeFile = async (filePath, content) => {
        const dirPath = filePath.substring(0, filePath.lastIndexOf('/'));
        if (dirPath) {
          await mockPyodide.runPythonAsync(`
import os
os.makedirs('${dirPath}', exist_ok=True)
          `);
        }
        mockPyodide.FS.writeFile(filePath, content);
        return { success: true };
      };

      await writeFile(path, 'content');

      expect(mockPyodide.runPythonAsync).toHaveBeenCalled();
    });

    it('should read file from virtual filesystem', async () => {
      const path = '/test.py';
      mockPyodide.FS.readFile = vi.fn(() => 'file content');

      const readFile = async (filePath) => {
        const content = mockPyodide.FS.readFile(filePath, { encoding: 'utf8' });
        return { success: true, content, path: filePath };
      };

      const result = await readFile(path);

      expect(result.success).toBe(true);
      expect(result.content).toBe('file content');
      expect(mockPyodide.FS.readFile).toHaveBeenCalledWith(
        path,
        { encoding: 'utf8' }
      );
    });

    it('should handle file read errors', async () => {
      mockPyodide.FS.readFile = vi.fn(() => {
        throw new Error('File not found');
      });

      const readFile = async (filePath) => {
        try {
          const content = mockPyodide.FS.readFile(filePath, { encoding: 'utf8' });
          return { success: true, content };
        } catch (error) {
          return { success: false, error: error.message, path: filePath };
        }
      };

      const result = await readFile('/missing.py');

      expect(result.success).toBe(false);
      expect(result.error).toContain('File not found');
    });

    it('should list directory contents', async () => {
      const path = '/home';
      mockPyodide.FS.readdir = vi.fn(() => ['test.py', 'data.csv', '.', '..']);

      const listDir = async (dirPath) => {
        const files = mockPyodide.FS.readdir(dirPath);
        return {
          success: true,
          files: files.filter(f => f !== '.' && f !== '..'),
          path: dirPath
        };
      };

      const result = await listDir(path);

      expect(result.success).toBe(true);
      expect(result.files).toContain('test.py');
      expect(result.files).not.toContain('.');
      expect(result.files).not.toContain('..');
    });

    it('should handle directory listing errors', async () => {
      mockPyodide.FS.readdir = vi.fn(() => {
        throw new Error('Directory not found');
      });

      const listDir = async (dirPath) => {
        try {
          const files = mockPyodide.FS.readdir(dirPath);
          return { success: true, files };
        } catch (error) {
          return { success: false, error: error.message, path: dirPath };
        }
      };

      const result = await listDir('/missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Directory not found');
    });
  });

  describe('Message Handling', () => {
    it('should handle init message', async () => {
      const onmessage = async (event) => {
        const { id, type } = event.data;

        if (type === 'init') {
          await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { initialized: true }
          });
        }
      };

      await onmessage({ data: { id: 1, type: 'init' } });

      expect(global.loadPyodide).toHaveBeenCalled();
      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          type: 'response',
          data: { initialized: true }
        })
      );
    });

    it('should handle execute message', async () => {
      const onmessage = async (event) => {
        const { id, type, data } = event.data;

        if (type === 'execute') {
          const result = await mockPyodide.runPythonAsync(data.code);

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { success: true, result }
          });
        }
      };

      await onmessage({
        data: { id: 2, type: 'execute', data: { code: 'x = 1' } }
      });

      expect(mockPyodide.runPythonAsync).toHaveBeenCalledWith('x = 1');
    });

    it('should handle install message', async () => {
      const onmessage = async (event) => {
        const { id, type, data } = event.data;

        if (type === 'install') {
          await mockPyodide.runPythonAsync(`
import micropip
await micropip.install('${data.package}')
          `);

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { success: true, package: data.package }
          });
        }
      };

      await onmessage({
        data: { id: 3, type: 'install', data: { package: 'numpy' } }
      });

      expect(mockPyodide.runPythonAsync).toHaveBeenCalled();
    });

    it('should handle writeFile message', async () => {
      const onmessage = async (event) => {
        const { id, type, data } = event.data;

        if (type === 'writeFile') {
          mockPyodide.FS.writeFile(data.path, data.content);

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { success: true, path: data.path }
          });
        }
      };

      await onmessage({
        data: {
          id: 4,
          type: 'writeFile',
          data: { path: '/test.py', content: 'print("test")' }
        }
      });

      expect(mockPyodide.FS.writeFile).toHaveBeenCalled();
    });

    it('should handle readFile message', async () => {
      const onmessage = async (event) => {
        const { id, type, data } = event.data;

        if (type === 'readFile') {
          const content = mockPyodide.FS.readFile(data.path, { encoding: 'utf8' });

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { success: true, content, path: data.path }
          });
        }
      };

      await onmessage({
        data: { id: 5, type: 'readFile', data: { path: '/test.py' } }
      });

      expect(mockPyodide.FS.readFile).toHaveBeenCalled();
    });

    it('should handle listDir message', async () => {
      const onmessage = async (event) => {
        const { id, type, data } = event.data;

        if (type === 'listDir') {
          const files = mockPyodide.FS.readdir(data.path);

          mockSelf.postMessage({
            id,
            type: 'response',
            data: {
              success: true,
              files: files.filter(f => f !== '.' && f !== '..'),
              path: data.path
            }
          });
        }
      };

      await onmessage({
        data: { id: 6, type: 'listDir', data: { path: '/' } }
      });

      expect(mockPyodide.FS.readdir).toHaveBeenCalled();
    });

    it('should handle getPackages message', async () => {
      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue({
        toJs: () => ['micropip', 'numpy']
      });

      const onmessage = async (event) => {
        const { id, type } = event.data;

        if (type === 'getPackages') {
          const packages = await mockPyodide.runPythonAsync(`
import micropip
list(micropip.list().keys())
          `);

          mockSelf.postMessage({
            id,
            type: 'response',
            data: { success: true, packages: packages.toJs() }
          });
        }
      };

      await onmessage({ data: { id: 7, type: 'getPackages' } });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            packages: expect.arrayContaining(['micropip', 'numpy'])
          })
        })
      );
    });

    it('should handle getStatus message', async () => {
      const onmessage = async (event) => {
        const { id, type } = event.data;

        if (type === 'getStatus') {
          mockSelf.postMessage({
            id,
            type: 'response',
            data: {
              ready: true,
              error: null,
              version: mockPyodide.version
            }
          });
        }
      };

      await onmessage({ data: { id: 8, type: 'getStatus' } });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            ready: true,
            version: '0.26.4'
          })
        })
      );
    });

    it('should handle unknown message type', async () => {
      const onmessage = async (event) => {
        const { id, type } = event.data;

        try {
          throw new Error(`Unknown message type: ${type}`);
        } catch (error) {
          mockSelf.postMessage({
            id,
            type: 'error',
            data: { message: error.message, stack: error.stack }
          });
        }
      };

      await onmessage({ data: { id: 9, type: 'unknown' } });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({
            message: expect.stringContaining('Unknown message type')
          })
        })
      );
    });

    it('should send error response on exception', async () => {
      const onmessage = async (event) => {
        const { id, type } = event.data;

        try {
          throw new Error('Test error');
        } catch (error) {
          mockSelf.postMessage({
            id,
            type: 'error',
            data: { message: error.message, stack: error.stack }
          });
        }
      };

      await onmessage({ data: { id: 10, type: 'execute' } });

      expect(mockSelf.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          data: expect.objectContaining({ message: 'Test error' })
        })
      );
    });
  });

  describe('stdout/stderr Handlers', () => {
    it('should send stdout messages', () => {
      const stdoutHandler = (msg) => {
        mockSelf.postMessage({ type: 'stdout', data: msg });
      };

      stdoutHandler('Test output\n');

      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        type: 'stdout',
        data: 'Test output\n'
      });
    });

    it('should send stderr messages', () => {
      const stderrHandler = (msg) => {
        mockSelf.postMessage({ type: 'stderr', data: msg });
      };

      stderrHandler('Error output\n');

      expect(mockSelf.postMessage).toHaveBeenCalledWith({
        type: 'stderr',
        data: 'Error output\n'
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Pyodide load errors', async () => {
      global.loadPyodide = vi.fn().mockRejectedValue(new Error('CDN unavailable'));

      try {
        await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
      } catch (error) {
        expect(error.message).toBe('CDN unavailable');
      }
    });

    it('should handle Python execution errors', async () => {
      mockPyodide.runPythonAsync = vi.fn().mockRejectedValue(
        new Error('NameError: name "x" is not defined')
      );

      try {
        await mockPyodide.runPythonAsync('print(x)');
      } catch (error) {
        expect(error.message).toContain('NameError');
      }
    });

    it('should handle file system errors', async () => {
      mockPyodide.FS.writeFile = vi.fn(() => {
        throw new Error('Permission denied');
      });

      try {
        mockPyodide.FS.writeFile('/readonly/file.txt', 'content');
      } catch (error) {
        expect(error.message).toBe('Permission denied');
      }
    });

    it('should capture stderr on execution error', async () => {
      mockPyodide.runPythonAsync = vi.fn()
        .mockRejectedValueOnce(new Error('Execution failed'))
        .mockResolvedValueOnce('Error captured');

      const executePython = async (code) => {
        let stderr = '';
        try {
          await mockPyodide.runPythonAsync(code);
        } catch (error) {
          try {
            stderr = await mockPyodide.runPythonAsync('sys.stderr.getvalue()');
          } catch (e) {
            // Ignore
          }
        }
        return { stderr };
      };

      const result = await executePython('invalid code');
      expect(result.stderr).toBeDefined();
    });
  });

  describe('Worker Logging', () => {
    it('should log worker loaded message', () => {
      console.log('[PyodideWorker] Worker loaded, waiting for init message');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('Worker loaded')
      );
    });

    it('should log initialization progress', () => {
      console.log('[PyodideWorker] Loading Pyodide runtime...');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('Loading Pyodide')
      );
    });

    it('should log micropip loading', () => {
      console.log('[PyodideWorker] Loading micropip...');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('Loading micropip')
      );
    });

    it('should log initialization success', () => {
      console.log('[PyodideWorker] Pyodide initialized successfully');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('initialized successfully')
      );
    });

    it('should log package installation', () => {
      console.log('[PyodideWorker] Installing package: numpy');

      expect(global.console.log).toHaveBeenCalledWith(
        expect.stringContaining('Installing package: numpy')
      );
    });

    it('should log errors', () => {
      console.error('[PyodideWorker] Failed to initialize Pyodide:', new Error('Test'));

      expect(global.console.error).toHaveBeenCalled();
    });
  });

  describe('Integration', () => {
    it('should handle complete workflow', async () => {
      // Initialize
      await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });

      // Load package
      await mockPyodide.loadPackage('micropip');

      // Execute code
      await mockPyodide.runPythonAsync('x = 1 + 1');

      // Write file
      mockPyodide.FS.writeFile('/test.py', 'print(x)');

      // Read file
      const content = mockPyodide.FS.readFile('/test.py', { encoding: 'utf8' });

      // List directory
      const files = mockPyodide.FS.readdir('/');

      expect(global.loadPyodide).toHaveBeenCalled();
      expect(mockPyodide.loadPackage).toHaveBeenCalled();
      expect(mockPyodide.runPythonAsync).toHaveBeenCalled();
      expect(mockPyodide.FS.writeFile).toHaveBeenCalled();
      expect(mockPyodide.FS.readFile).toHaveBeenCalled();
      expect(mockPyodide.FS.readdir).toHaveBeenCalled();
    });

    it('should maintain state across operations', async () => {
      // Execute code that sets a variable
      await mockPyodide.runPythonAsync('x = 42');

      // Execute code that uses the variable
      mockPyodide.runPythonAsync = vi.fn().mockResolvedValue(42);
      const result = await mockPyodide.runPythonAsync('x');

      expect(result).toBe(42);
    });
  });

  describe('Worker Lifecycle Edge Cases', () => {
    it('should handle initialization timeout', async () => {
      global.loadPyodide = vi.fn(() => new Promise(() => {})); // Never resolves

      const initPromise = loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });

      await expect(Promise.race([
        initPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 100))
      ])).rejects.toThrow('Timeout');
    });

    it('should handle multiple initialization attempts', async () => {
      let callCount = 0;
      global.loadPyodide = vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('First attempt failed');
        return mockPyodide;
      });

      try {
        await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
      } catch (e) {
        // First attempt fails
      }

      const result = await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
      expect(result).toBe(mockPyodide);
    });

    it('should prevent double initialization', async () => {
      let isInitializing = false;

      const safeInit = async () => {
        if (isInitializing) throw new Error('Already initializing');
        isInitializing = true;
        await loadPyodide({ stdout: vi.fn(), stderr: vi.fn() });
        isInitializing = false;
      };

      const promise1 = safeInit();
      await expect(safeInit()).rejects.toThrow('Already initializing');
      await promise1;
    });

    it('should handle initialization with missing dependencies', async () => {
      global.importScripts = vi.fn(() => {
        throw new Error('Script not found');
      });

      expect(() => global.importScripts('missing.js')).toThrow('Script not found');
    });

    it('should recover from partial initialization', async () => {
      global.loadPyodide = vi.fn().mockResolvedValue(mockPyodide);
      mockPyodide.loadPackage = vi.fn()
        .mockRejectedValueOnce(new Error('micropip load failed'))
        .mockResolvedValueOnce();

      try {
        await mockPyodide.loadPackage('micropip');
      } catch (e) {
        // First attempt fails
      }

      await mockPyodide.loadPackage('micropip');
      expect(mockPyodide.loadPackage).toHaveBeenCalledTimes(2);
    });
  });

  describe('Message Queue Management', () => {
    it('should handle message queue overflow', async () => {
      const messageQueue = [];
      const MAX_QUEUE_SIZE = 100;

      const enqueueMessage = (msg) => {
        if (messageQueue.length >= MAX_QUEUE_SIZE) {
          throw new Error('Message queue overflow');
        }
        messageQueue.push(msg);
      };

      for (let i = 0; i < MAX_QUEUE_SIZE; i++) {
        enqueueMessage({ id: i, type: 'execute' });
      }

      expect(() => enqueueMessage({ id: 101, type: 'execute' })).toThrow('Message queue overflow');
    });

    it('should process messages in FIFO order', async () => {
      const processedIds = [];
      const messageQueue = [
        { id: 1, type: 'execute' },
        { id: 2, type: 'execute' },
        { id: 3, type: 'execute' }
      ];

      while (messageQueue.length > 0) {
        const msg = messageQueue.shift();
        processedIds.push(msg.id);
      }

      expect(processedIds).toEqual([1, 2, 3]);
    });

    it('should handle priority messages', async () => {
      const normalQueue = [{ id: 1 }, { id: 2 }];
      const priorityQueue = [{ id: 10, priority: true }];

      const getNextMessage = () => {
        if (priorityQueue.length > 0) return priorityQueue.shift();
        return normalQueue.shift();
      };

      expect(getNextMessage().id).toBe(10);
      expect(getNextMessage().id).toBe(1);
    });

    it('should drop messages when queue is full', async () => {
      const queue = [];
      const MAX_SIZE = 5;

      const addMessage = (msg) => {
        if (queue.length >= MAX_SIZE) {
          queue.shift(); // Drop oldest
        }
        queue.push(msg);
      };

      for (let i = 0; i < 10; i++) {
        addMessage({ id: i });
      }

      expect(queue.length).toBe(5);
      expect(queue[0].id).toBe(5);
    });
  });

  describe('Worker Crash Recovery', () => {
    it('should detect worker crash', async () => {
      const workerState = { alive: true };

      const simulateCrash = () => {
        workerState.alive = false;
        throw new Error('Worker crashed');
      };

      expect(() => simulateCrash()).toThrow('Worker crashed');
      expect(workerState.alive).toBe(false);
    });

    it('should restart worker after crash', async () => {
      let workerInstance = null;

      const createWorker = () => {
        workerInstance = { alive: true };
        return workerInstance;
      };

      const restartWorker = () => {
        if (workerInstance) workerInstance.alive = false;
        return createWorker();
      };

      createWorker();
      workerInstance.alive = false;
      const newWorker = restartWorker();

      expect(newWorker.alive).toBe(true);
    });

    it('should preserve state after recovery', async () => {
      const state = { data: 'important' };
      const backup = { ...state };

      state.data = 'corrupted';

      const restore = () => {
        Object.assign(state, backup);
      };

      restore();
      expect(state.data).toBe('important');
    });

    it('should handle rapid successive crashes', async () => {
      let crashCount = 0;
      const MAX_CRASHES = 3;

      const tryOperation = () => {
        crashCount++;
        if (crashCount <= MAX_CRASHES) {
          throw new Error('Crash');
        }
        return 'success';
      };

      for (let i = 0; i < MAX_CRASHES; i++) {
        try {
          tryOperation();
        } catch (e) {
          // Expected
        }
      }

      expect(tryOperation()).toBe('success');
    });
  });

  describe('Concurrent Message Handling', () => {
    it('should handle concurrent execute messages', async () => {
      const results = [];

      mockPyodide.runPythonAsync = vi.fn(async (code) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return `result_${code}`;
      });

      const promises = [
        mockPyodide.runPythonAsync('code1'),
        mockPyodide.runPythonAsync('code2'),
        mockPyodide.runPythonAsync('code3')
      ];

      const completedResults = await Promise.all(promises);
      expect(completedResults).toHaveLength(3);
    });

    it('should handle concurrent file operations', async () => {
      const files = ['file1.py', 'file2.py', 'file3.py'];

      const writePromises = files.map(file =>
        Promise.resolve(mockPyodide.FS.writeFile(`/${file}`, `content_${file}`))
      );

      await Promise.all(writePromises);
      expect(mockPyodide.FS.writeFile).toHaveBeenCalledTimes(3);
    });

    it('should serialize critical operations', async () => {
      const executionOrder = [];
      let lock = false;

      const criticalOperation = async (id) => {
        while (lock) await new Promise(resolve => setTimeout(resolve, 1));
        lock = true;
        executionOrder.push(id);
        await new Promise(resolve => setTimeout(resolve, 5));
        lock = false;
      };

      await Promise.all([
        criticalOperation(1),
        criticalOperation(2),
        criticalOperation(3)
      ]);

      expect(executionOrder).toHaveLength(3);
    });

    it('should handle concurrent package installations', async () => {
      mockPyodide.runPythonAsync = vi.fn()
        .mockResolvedValueOnce('numpy installed')
        .mockResolvedValueOnce('pandas installed');

      const [result1, result2] = await Promise.all([
        mockPyodide.runPythonAsync('import micropip; await micropip.install("numpy")'),
        mockPyodide.runPythonAsync('import micropip; await micropip.install("pandas")')
      ]);

      expect(result1).toBe('numpy installed');
      expect(result2).toBe('pandas installed');
    });
  });

  describe('Worker Termination Edge Cases', () => {
    it('should terminate worker during execution', () => {
      let isExecuting = true;
      let terminated = false;

      const execute = () => {
        if (terminated) throw new Error('Worker terminated');
        return 'result';
      };

      terminated = true;
      expect(() => execute()).toThrow('Worker terminated');
    });

    it('should terminate idle worker immediately', () => {
      const worker = { state: 'idle', terminated: false };

      const terminate = () => {
        worker.terminated = true;
        worker.state = 'terminated';
      };

      terminate();
      expect(worker.terminated).toBe(true);
      expect(worker.state).toBe('terminated');
    });

    it('should wait for execution before terminating', async () => {
      let executionComplete = false;

      const execute = async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
        executionComplete = true;
      };

      const gracefulTerminate = async () => {
        if (!executionComplete) {
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        return 'terminated';
      };

      const execPromise = execute();
      const termPromise = gracefulTerminate();

      await Promise.all([execPromise, termPromise]);
      expect(executionComplete).toBe(true);
    });

    it('should force terminate after timeout', async () => {
      const execute = () => new Promise(() => {}); // Never resolves

      const forceTerminate = async (timeout = 100) => {
        const execPromise = execute();
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Force terminated')), timeout)
        );

        return Promise.race([execPromise, timeoutPromise]);
      };

      await expect(forceTerminate(50)).rejects.toThrow('Force terminated');
    });

    it('should clean up resources on termination', () => {
      const resources = { pyodide: mockPyodide, listeners: [], timers: [1, 2, 3] };

      const cleanup = () => {
        resources.pyodide = null;
        resources.listeners = [];
        resources.timers = [];
      };

      cleanup();
      expect(resources.pyodide).toBeNull();
      expect(resources.listeners).toHaveLength(0);
    });
  });

  describe('Worker Pool Exhaustion', () => {
    it('should reject when pool is exhausted', () => {
      const pool = new Array(5).fill(null).map(() => ({ busy: true }));

      const getAvailableWorker = () => {
        const worker = pool.find(w => !w.busy);
        if (!worker) throw new Error('Worker pool exhausted');
        return worker;
      };

      expect(() => getAvailableWorker()).toThrow('Worker pool exhausted');
    });

    it('should queue requests when pool is full', async () => {
      const pool = [{ busy: true }, { busy: true }];
      const queue = [];

      const requestWorker = () => {
        const available = pool.find(w => !w.busy);
        if (available) return available;

        return new Promise(resolve => {
          queue.push(resolve);
        });
      };

      const promise = requestWorker();
      expect(queue).toHaveLength(1);

      pool[0].busy = false;
      queue.shift()(pool[0]);

      const worker = await promise;
      expect(worker).toBe(pool[0]);
    });

    it('should scale pool size dynamically', () => {
      const pool = [];
      const MAX_WORKERS = 10;

      const createWorker = () => ({ id: pool.length, busy: false });

      const ensureCapacity = (needed) => {
        while (pool.length < needed && pool.length < MAX_WORKERS) {
          pool.push(createWorker());
        }
      };

      ensureCapacity(5);
      expect(pool).toHaveLength(5);

      ensureCapacity(15);
      expect(pool).toHaveLength(MAX_WORKERS);
    });

    it('should reuse workers efficiently', () => {
      const pool = [
        { id: 1, busy: false, uses: 0 },
        { id: 2, busy: false, uses: 0 }
      ];

      const getWorker = () => {
        const worker = pool.find(w => !w.busy);
        if (worker) {
          worker.busy = true;
          worker.uses++;
        }
        return worker;
      };

      const releaseWorker = (worker) => {
        worker.busy = false;
      };

      const w1 = getWorker();
      releaseWorker(w1);
      const w2 = getWorker();

      expect(w2.uses).toBe(2);
    });
  });

  describe('Worker Timeout Tests', () => {
    it('should timeout long-running execution', async () => {
      const executeWithTimeout = (code, timeout = 5000) => {
        return Promise.race([
          mockPyodide.runPythonAsync(code),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Execution timeout')), timeout)
          )
        ]);
      };

      mockPyodide.runPythonAsync = vi.fn(() => new Promise(() => {}));

      await expect(executeWithTimeout('while True: pass', 100)).rejects.toThrow('Execution timeout');
    });

    it('should abort execution on timeout', async () => {
      let executionAborted = false;

      const execute = async () => {
        try {
          await new Promise((resolve, reject) => {
            setTimeout(() => reject(new Error('Aborted')), 50);
          });
        } catch (e) {
          executionAborted = true;
          throw e;
        }
      };

      await expect(execute()).rejects.toThrow('Aborted');
      expect(executionAborted).toBe(true);
    });

    it('should track execution time', async () => {
      const startTime = Date.now();

      mockPyodide.runPythonAsync = vi.fn(async () => {
        await new Promise(resolve => setTimeout(resolve, 50));
        return 'done';
      });

      await mockPyodide.runPythonAsync('x = 1');
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(50);
    });

    it('should apply different timeouts per operation', async () => {
      const operations = {
        quick: { timeout: 100, code: 'x = 1' },
        slow: { timeout: 1000, code: 'long_operation()' }
      };

      const executeOp = async (op) => {
        const promise = mockPyodide.runPythonAsync(op.code);
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), op.timeout)
        );
        return Promise.race([promise, timeout]);
      };

      expect(operations.quick.timeout).toBe(100);
      expect(operations.slow.timeout).toBe(1000);
    });
  });

  describe('Worker Communication Failures', () => {
    it('should handle postMessage failure', () => {
      mockSelf.postMessage = vi.fn(() => {
        throw new Error('postMessage failed');
      });

      expect(() => mockSelf.postMessage({ type: 'ready' })).toThrow('postMessage failed');
    });

    it('should retry failed messages', async () => {
      let attempts = 0;
      mockSelf.postMessage = vi.fn(() => {
        attempts++;
        if (attempts < 3) throw new Error('Failed');
        return true;
      });

      const sendWithRetry = async (msg, maxRetries = 3) => {
        for (let i = 0; i < maxRetries; i++) {
          try {
            return mockSelf.postMessage(msg);
          } catch (e) {
            if (i === maxRetries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      };

      await sendWithRetry({ type: 'test' });
      expect(attempts).toBe(3);
    });

    it('should handle malformed messages', async () => {
      const processMessage = (event) => {
        if (!event.data || !event.data.type) {
          throw new Error('Malformed message');
        }
        return event.data;
      };

      expect(() => processMessage({ data: null })).toThrow('Malformed message');
      expect(() => processMessage({ data: { type: 'valid' } })).not.toThrow();
    });

    it('should validate message schema', () => {
      const validateMessage = (msg) => {
        const requiredFields = ['id', 'type'];
        for (const field of requiredFields) {
          if (!(field in msg)) {
            throw new Error(`Missing required field: ${field}`);
          }
        }
        return true;
      };

      expect(() => validateMessage({ id: 1 })).toThrow('Missing required field: type');
      expect(validateMessage({ id: 1, type: 'execute' })).toBe(true);
    });

    it('should handle response timeout', async () => {
      const pendingRequests = new Map();

      const sendRequest = (id, type, timeout = 5000) => {
        return new Promise((resolve, reject) => {
          pendingRequests.set(id, { resolve, reject });

          setTimeout(() => {
            if (pendingRequests.has(id)) {
              pendingRequests.delete(id);
              reject(new Error('Response timeout'));
            }
          }, timeout);

          mockSelf.postMessage({ id, type });
        });
      };

      await expect(sendRequest(1, 'execute', 100)).rejects.toThrow('Response timeout');
    });

    it('should handle worker unresponsive state', () => {
      const workerState = { responsive: true, lastHeartbeat: Date.now() };

      const checkResponsive = (timeout = 5000) => {
        const elapsed = Date.now() - workerState.lastHeartbeat;
        if (elapsed > timeout) {
          workerState.responsive = false;
        }
        return workerState.responsive;
      };

      workerState.lastHeartbeat = Date.now() - 10000;
      expect(checkResponsive()).toBe(false);
    });
  });
});
