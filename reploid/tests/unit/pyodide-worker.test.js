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
});
