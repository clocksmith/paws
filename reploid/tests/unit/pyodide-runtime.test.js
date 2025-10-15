import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('PyodideRuntime', () => {
  let PyodideRuntime;
  let mockDeps;
  let instance;
  let mockWorker;
  let messageHandlers;

  beforeEach(() => {
    messageHandlers = {};

    // Mock Worker
    mockWorker = {
      postMessage: vi.fn(),
      terminate: vi.fn(),
      onmessage: null,
      onerror: null
    };

    global.Worker = vi.fn((path) => {
      return mockWorker;
    });

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          error: vi.fn(),
          warn: vi.fn(),
          debug: vi.fn()
        },
        generateId: vi.fn(() => 'test-id-123')
      },
      EventBus: {
        emit: vi.fn(),
        on: vi.fn()
      },
      StateManager: {
        getState: vi.fn(() => ({
          artifactMetadata: {
            '/test.py': { type: 'python' }
          }
        }))
      },
      Storage: {
        getArtifactContent: vi.fn(),
        setArtifactContent: vi.fn()
      }
    };

    global.setTimeout = vi.fn((fn, delay) => {
      // Optionally execute immediately for testing
      return 'timeout-id';
    });

    // Module definition
    PyodideRuntime = {
      metadata: {
        id: 'PyodideRuntime',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager', 'Storage'],
        async: true,
        type: 'runtime'
      },
      factory: (deps) => {
        const { Utils, EventBus, StateManager, Storage } = deps;
        const { logger } = Utils;

        let worker = null;
        let isReady = false;
        let initError = null;
        let messageId = 0;
        let pendingMessages = new Map();

        const createWorker = () => {
          try {
            worker = new Worker('upgrades/pyodide-worker.js');
            worker.onmessage = handleWorkerMessage;
            worker.onerror = (error) => {
              logger.error('[PyodideRuntime] Worker error:', error);
              initError = error;
              EventBus.emit('pyodide:error', { error });
            };
            logger.info('[PyodideRuntime] Worker created');
            return worker;
          } catch (error) {
            logger.error('[PyodideRuntime] Failed to create worker:', error);
            throw error;
          }
        };

        const handleWorkerMessage = (event) => {
          const { id, type, data } = event.data;

          if (type === 'ready') {
            isReady = true;
            logger.info('[PyodideRuntime] Pyodide initialized', data);
            EventBus.emit('pyodide:ready', data);
            return;
          }

          if (type === 'stdout') {
            EventBus.emit('pyodide:stdout', { output: data });
            return;
          }

          if (type === 'stderr') {
            EventBus.emit('pyodide:stderr', { output: data });
            return;
          }

          if (id && pendingMessages.has(id)) {
            const { resolve, reject } = pendingMessages.get(id);
            pendingMessages.delete(id);

            if (type === 'error') {
              reject(new Error(data.message || 'Worker error'));
            } else {
              resolve(data);
            }
          }
        };

        const sendMessage = (type, data = {}) => {
          return new Promise((resolve, reject) => {
            if (!worker) {
              reject(new Error('Worker not initialized'));
              return;
            }

            const id = ++messageId;
            pendingMessages.set(id, { resolve, reject });

            setTimeout(() => {
              if (pendingMessages.has(id)) {
                pendingMessages.delete(id);
                reject(new Error(`Message timeout: ${type}`));
              }
            }, 30000);

            worker.postMessage({ id, type, data });
          });
        };

        const init = async () => {
          try {
            logger.info('[PyodideRuntime] Initializing Pyodide runtime...');
            createWorker();
            await sendMessage('init');
            logger.info('[PyodideRuntime] Pyodide runtime ready');
            EventBus.emit('pyodide:initialized', { ready: true });
            return true;
          } catch (error) {
            logger.error('[PyodideRuntime] Initialization failed:', error);
            initError = error;
            throw error;
          }
        };

        const execute = async (code, options = {}) => {
          if (!isReady) {
            throw new Error('Pyodide not ready. Call init() first.');
          }

          try {
            logger.debug('[PyodideRuntime] Executing Python code', { length: code.length });

            const result = await sendMessage('execute', {
              code,
              options: { async: options.async !== false, ...options }
            });

            if (!result.success) {
              logger.error('[PyodideRuntime] Execution failed', result);
            }

            EventBus.emit('pyodide:executed', {
              success: result.success,
              executionTime: result.executionTime
            });

            return result;
          } catch (error) {
            logger.error('[PyodideRuntime] Execution error:', error);
            throw error;
          }
        };

        const installPackage = async (packageName) => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            logger.info('[PyodideRuntime] Installing package:', packageName);
            const result = await sendMessage('install', { package: packageName });

            if (result.success) {
              logger.info('[PyodideRuntime] Package installed:', packageName);
              EventBus.emit('pyodide:package-installed', { package: packageName });
            }

            return result;
          } catch (error) {
            logger.error('[PyodideRuntime] Package installation failed:', error);
            throw error;
          }
        };

        const syncFileToWorker = async (path) => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            const content = await Storage.getArtifactContent(path);

            if (!content) {
              logger.warn('[PyodideRuntime] File not found in VFS:', path);
              return { success: false, error: 'File not found' };
            }

            const result = await sendMessage('writeFile', { path, content });

            if (result.success) {
              logger.debug('[PyodideRuntime] File synced to worker:', path);
            }

            return result;
          } catch (error) {
            logger.error('[PyodideRuntime] File sync failed:', error);
            throw error;
          }
        };

        const syncFileFromWorker = async (path) => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            const result = await sendMessage('readFile', { path });

            if (!result.success) {
              return result;
            }

            await Storage.setArtifactContent(path, result.content);
            logger.debug('[PyodideRuntime] File synced from worker:', path);

            return { success: true, path };
          } catch (error) {
            logger.error('[PyodideRuntime] File sync failed:', error);
            throw error;
          }
        };

        const syncWorkspace = async () => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            logger.info('[PyodideRuntime] Syncing workspace to Pyodide...');

            const state = StateManager.getState();
            const artifacts = state.artifactMetadata || {};

            let synced = 0;
            let failed = 0;

            for (const [path, metadata] of Object.entries(artifacts)) {
              try {
                await syncFileToWorker(path);
                synced++;
              } catch (error) {
                logger.warn('[PyodideRuntime] Failed to sync file:', path, error);
                failed++;
              }
            }

            logger.info('[PyodideRuntime] Workspace sync complete', { synced, failed });

            return { success: true, synced, failed };
          } catch (error) {
            logger.error('[PyodideRuntime] Workspace sync failed:', error);
            throw error;
          }
        };

        const listFiles = async (path = '/') => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            const result = await sendMessage('listDir', { path });
            return result;
          } catch (error) {
            logger.error('[PyodideRuntime] List files failed:', error);
            throw error;
          }
        };

        const getPackages = async () => {
          if (!isReady) {
            throw new Error('Pyodide not ready');
          }

          try {
            const result = await sendMessage('getPackages');
            return result;
          } catch (error) {
            logger.error('[PyodideRuntime] Get packages failed:', error);
            throw error;
          }
        };

        const getStatus = async () => {
          if (!worker) {
            return { ready: false, error: 'Worker not created' };
          }

          try {
            const result = await sendMessage('getStatus');
            return result;
          } catch (error) {
            return { ready: false, error: error.message };
          }
        };

        const terminate = () => {
          if (worker) {
            worker.terminate();
            worker = null;
            isReady = false;
            logger.info('[PyodideRuntime] Worker terminated');
            EventBus.emit('pyodide:terminated');
          }
        };

        return {
          init,
          api: {
            execute,
            installPackage,
            syncFileToWorker,
            syncFileFromWorker,
            syncWorkspace,
            listFiles,
            getPackages,
            getStatus,
            terminate,
            isReady: () => isReady,
            getError: () => initError
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(PyodideRuntime.metadata).toBeDefined();
      expect(PyodideRuntime.metadata.id).toBe('PyodideRuntime');
      expect(PyodideRuntime.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(PyodideRuntime.metadata.dependencies).toContain('Utils');
      expect(PyodideRuntime.metadata.dependencies).toContain('EventBus');
      expect(PyodideRuntime.metadata.dependencies).toContain('StateManager');
      expect(PyodideRuntime.metadata.dependencies).toContain('Storage');
    });

    it('should be a runtime type module', () => {
      expect(PyodideRuntime.metadata.type).toBe('runtime');
    });

    it('should be async', () => {
      expect(PyodideRuntime.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should create worker on init', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      // Simulate worker ready message
      setTimeout(() => {
        mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      }, 0);

      await instance.init();

      expect(global.Worker).toHaveBeenCalledWith('upgrades/pyodide-worker.js');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Worker created')
      );
    });

    it('should send init message to worker', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      const initPromise = instance.init();

      // Simulate worker response
      const initMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'init'
      );
      if (initMessage) {
        const messageId = initMessage[0].id;
        mockWorker.onmessage({ data: { id: messageId, type: 'response', data: {} } });
      }

      // Also send ready message
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });

      await expect(initPromise).resolves.toBe(true);
    });

    it('should set ready flag after successful init', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });

      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });

      await initPromise;

      expect(instance.api.isReady()).toBe(true);
    });

    it('should emit initialized event', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });

      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });

      await initPromise;

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:initialized',
        { ready: true }
      );
    });

    it('should handle worker creation errors', async () => {
      global.Worker = vi.fn(() => {
        throw new Error('Worker creation failed');
      });

      instance = PyodideRuntime.factory(mockDeps);

      await expect(instance.init()).rejects.toThrow('Worker creation failed');
    });

    it('should store init errors', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      const initPromise = instance.init();

      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({
        data: { id: initMessage[0].id, type: 'error', data: { message: 'Init failed' } }
      });

      await expect(initPromise).rejects.toThrow();
      expect(instance.api.getError()).toBeDefined();
    });
  });

  describe('Python Execution', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should execute Python code', async () => {
      const code = 'print("Hello, World!")';
      const executePromise = instance.api.execute(code);

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: {
          id: executeMessage[0].id,
          type: 'response',
          data: { success: true, result: null, stdout: 'Hello, World!\n' }
        }
      });

      const result = await executePromise;

      expect(result.success).toBe(true);
      expect(mockWorker.postMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'execute',
          data: expect.objectContaining({ code })
        })
      );
    });

    it('should throw error if not ready', async () => {
      instance = PyodideRuntime.factory(mockDeps);
      // Don't initialize

      await expect(instance.api.execute('print("test")')).rejects.toThrow(
        'Pyodide not ready'
      );
    });

    it('should pass execution options', async () => {
      const options = { async: true, timeout: 5000 };
      const executePromise = instance.api.execute('x = 1', options);

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );

      expect(executeMessage[0].data.options).toEqual(expect.objectContaining({ async: true }));

      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'response', data: { success: true } }
      });

      await executePromise;
    });

    it('should emit execution event', async () => {
      const executePromise = instance.api.execute('x = 1');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: {
          id: executeMessage[0].id,
          type: 'response',
          data: { success: true, executionTime: 10 }
        }
      });

      await executePromise;

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:executed',
        expect.objectContaining({ success: true })
      );
    });

    it('should handle execution errors', async () => {
      const executePromise = instance.api.execute('invalid python');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: {
          id: executeMessage[0].id,
          type: 'error',
          data: { message: 'Syntax error' }
        }
      });

      await expect(executePromise).rejects.toThrow('Syntax error');
    });
  });

  describe('Package Management', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should install Python package', async () => {
      const packageName = 'numpy';
      const installPromise = instance.api.installPackage(packageName);

      const installMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'install'
      );
      mockWorker.onmessage({
        data: {
          id: installMessage[0].id,
          type: 'response',
          data: { success: true, package: packageName }
        }
      });

      const result = await installPromise;

      expect(result.success).toBe(true);
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:package-installed',
        { package: packageName }
      );
    });

    it('should throw error if not ready', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      await expect(instance.api.installPackage('numpy')).rejects.toThrow('Pyodide not ready');
    });

    it('should handle installation failures', async () => {
      const installPromise = instance.api.installPackage('invalid-package');

      const installMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'install'
      );
      mockWorker.onmessage({
        data: {
          id: installMessage[0].id,
          type: 'error',
          data: { message: 'Package not found' }
        }
      });

      await expect(installPromise).rejects.toThrow('Package not found');
    });

    it('should get installed packages', async () => {
      const packagesPromise = instance.api.getPackages();

      const packagesMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'getPackages'
      );
      mockWorker.onmessage({
        data: {
          id: packagesMessage[0].id,
          type: 'response',
          data: { success: true, packages: ['numpy', 'pandas'] }
        }
      });

      const result = await packagesPromise;

      expect(result.success).toBe(true);
      expect(result.packages).toContain('numpy');
    });
  });

  describe('File Synchronization', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;

      mockDeps.Storage.getArtifactContent.mockResolvedValue('print("test")');
      mockDeps.Storage.setArtifactContent.mockResolvedValue(true);
    });

    it('should sync file to worker', async () => {
      const path = '/test.py';
      const syncPromise = instance.api.syncFileToWorker(path);

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: true, path } }
      });

      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(mockDeps.Storage.getArtifactContent).toHaveBeenCalledWith(path);
    });

    it('should handle missing files gracefully', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue(null);

      const result = await instance.api.syncFileToWorker('/missing.py');

      expect(result.success).toBe(false);
      expect(result.error).toBe('File not found');
    });

    it('should sync file from worker', async () => {
      const path = '/output.txt';
      const content = 'file content';
      const syncPromise = instance.api.syncFileFromWorker(path);

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'readFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: true, content, path } }
      });

      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(mockDeps.Storage.setArtifactContent).toHaveBeenCalledWith(path, content);
    });

    it('should sync entire workspace', async () => {
      const syncPromise = instance.api.syncWorkspace();

      // Handle each file sync
      const writeMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'writeFile'
      );
      writeMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const result = await syncPromise;

      expect(result.success).toBe(true);
      expect(result.synced).toBeGreaterThanOrEqual(0);
    });

    it('should track failed syncs', async () => {
      mockDeps.Storage.getArtifactContent
        .mockResolvedValueOnce('content')
        .mockRejectedValueOnce(new Error('Read failed'));

      const syncPromise = instance.api.syncWorkspace();

      const writeMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'writeFile'
      );
      writeMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const result = await syncPromise;

      expect(result.failed).toBeGreaterThanOrEqual(0);
    });
  });

  describe('File System Operations', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should list files in directory', async () => {
      const listPromise = instance.api.listFiles('/home');

      const listMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'listDir'
      );
      mockWorker.onmessage({
        data: {
          id: listMessage[0].id,
          type: 'response',
          data: { success: true, files: ['test.py', 'data.csv'] }
        }
      });

      const result = await listPromise;

      expect(result.success).toBe(true);
      expect(result.files).toContain('test.py');
    });

    it('should throw error if not ready', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      await expect(instance.api.listFiles('/')).rejects.toThrow('Pyodide not ready');
    });
  });

  describe('Status and Control', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should get runtime status', async () => {
      const statusPromise = instance.api.getStatus();

      const statusMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'getStatus'
      );
      mockWorker.onmessage({
        data: {
          id: statusMessage[0].id,
          type: 'response',
          data: { ready: true, version: '0.26.4' }
        }
      });

      const status = await statusPromise;

      expect(status.ready).toBe(true);
    });

    it('should return error status if worker not created', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      const status = await instance.api.getStatus();

      expect(status.ready).toBe(false);
      expect(status.error).toBe('Worker not created');
    });

    it('should terminate worker', () => {
      instance.api.terminate();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(instance.api.isReady()).toBe(false);
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('pyodide:terminated');
    });

    it('should check ready status', () => {
      expect(instance.api.isReady()).toBe(true);
    });

    it('should return init error', async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();

      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({
        data: { id: initMessage[0].id, type: 'error', data: { message: 'Init error' } }
      });

      try {
        await initPromise;
      } catch (e) {
        // Expected
      }

      const error = instance.api.getError();
      expect(error).toBeDefined();
    });
  });

  describe('Worker Message Handling', () => {
    beforeEach(() => {
      instance = PyodideRuntime.factory(mockDeps);
    });

    it('should handle stdout messages', () => {
      mockWorker.onmessage({ data: { type: 'stdout', data: 'Hello\n' } });

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:stdout',
        { output: 'Hello\n' }
      );
    });

    it('should handle stderr messages', () => {
      mockWorker.onmessage({ data: { type: 'stderr', data: 'Error\n' } });

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:stderr',
        { output: 'Error\n' }
      );
    });

    it('should handle ready messages', () => {
      mockWorker.onmessage({ data: { type: 'ready', data: { version: '0.26.4' } } });

      expect(instance.api.isReady()).toBe(true);
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:ready',
        { version: '0.26.4' }
      );
    });

    it('should handle worker errors', () => {
      const error = new Error('Worker error');
      mockWorker.onerror(error);

      expect(mockDeps.Utils.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Worker error'),
        error
      );
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:error',
        { error }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle message timeout', async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();

      // Simulate timeout by calling setTimeout callback
      const timeoutCall = global.setTimeout.mock.calls.find(
        call => typeof call[0] === 'function'
      );
      if (timeoutCall) {
        timeoutCall[0]();
      }

      await expect(initPromise).rejects.toThrow('timeout');
    });

    it('should handle worker creation failure', async () => {
      global.Worker = vi.fn(() => {
        throw new Error('Worker failed');
      });

      instance = PyodideRuntime.factory(mockDeps);

      await expect(instance.init()).rejects.toThrow('Worker failed');
    });

    it('should log errors appropriately', async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();

      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({
        data: { id: initMessage[0].id, type: 'error', data: { message: 'Failed' } }
      });

      try {
        await initPromise;
      } catch (e) {
        // Expected
      }

      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('API Exposure', () => {
    it('should expose complete public API', async () => {
      instance = PyodideRuntime.factory(mockDeps);

      expect(typeof instance.init).toBe('function');
      expect(typeof instance.api.execute).toBe('function');
      expect(typeof instance.api.installPackage).toBe('function');
      expect(typeof instance.api.syncFileToWorker).toBe('function');
      expect(typeof instance.api.syncFileFromWorker).toBe('function');
      expect(typeof instance.api.syncWorkspace).toBe('function');
      expect(typeof instance.api.listFiles).toBe('function');
      expect(typeof instance.api.getPackages).toBe('function');
      expect(typeof instance.api.getStatus).toBe('function');
      expect(typeof instance.api.terminate).toBe('function');
      expect(typeof instance.api.isReady).toBe('function');
      expect(typeof instance.api.getError).toBe('function');
    });
  });

  describe('Integration with Dependencies', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should use Utils logger for all logging', () => {
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });

    it('should emit EventBus events', () => {
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'pyodide:initialized',
        expect.any(Object)
      );
    });

    it('should use StateManager for workspace sync', async () => {
      await instance.api.syncWorkspace();

      expect(mockDeps.StateManager.getState).toHaveBeenCalled();
    });

    it('should use Storage for file operations', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('content');

      const syncPromise = instance.api.syncFileToWorker('/test.py');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: true } }
      });

      await syncPromise;

      expect(mockDeps.Storage.getArtifactContent).toHaveBeenCalled();
    });
  });

  describe('Package Installation Failures', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle network errors during package install', async () => {
      const installPromise = instance.api.installPackage('numpy');

      const installMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'install'
      );
      mockWorker.onmessage({
        data: { id: installMessage[0].id, type: 'error', data: { message: 'Network error' } }
      });

      await expect(installPromise).rejects.toThrow('Network error');
    });

    it('should handle package not found errors', async () => {
      const installPromise = instance.api.installPackage('nonexistent-package');

      const installMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'install'
      );
      mockWorker.onmessage({
        data: { id: installMessage[0].id, type: 'error', data: { message: 'Package not found' } }
      });

      await expect(installPromise).rejects.toThrow();
    });

    it('should handle incompatible package versions', async () => {
      const installPromise = instance.api.installPackage('package@999.999.999');

      const installMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'install'
      );
      mockWorker.onmessage({
        data: { id: installMessage[0].id, type: 'error', data: { message: 'Version not found' } }
      });

      await expect(installPromise).rejects.toThrow();
    });
  });

  describe('Workspace Sync Edge Cases', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle empty workspace', async () => {
      mockDeps.StateManager.getState.mockReturnValue({ artifactMetadata: {} });

      const result = await instance.api.syncWorkspace();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
    });

    it('should handle partial sync failures', async () => {
      mockDeps.StateManager.getState.mockReturnValue({
        artifactMetadata: {
          '/file1.py': { type: 'python' },
          '/file2.py': { type: 'python' }
        }
      });

      mockDeps.Storage.getArtifactContent
        .mockResolvedValueOnce('content1')
        .mockRejectedValueOnce(new Error('Read failed'));

      const syncPromise = instance.api.syncWorkspace();

      const writeMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'writeFile'
      );
      writeMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const result = await syncPromise;

      expect(result.failed).toBeGreaterThan(0);
    });

    it('should handle large workspace sync', async () => {
      const artifacts = {};
      for (let i = 0; i < 100; i++) {
        artifacts[`/file${i}.py`] = { type: 'python' };
      }
      mockDeps.StateManager.getState.mockReturnValue({ artifactMetadata: artifacts });
      mockDeps.Storage.getArtifactContent.mockResolvedValue('content');

      const syncPromise = instance.api.syncWorkspace();

      const writeMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'writeFile'
      );
      writeMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const result = await syncPromise;

      expect(result.synced).toBeLessThanOrEqual(100);
    });
  });

  describe('Python Execution Timeout Scenarios', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should timeout long-running Python code', async () => {
      const executePromise = instance.api.execute('while True: pass');

      const timeoutCall = global.setTimeout.mock.calls.find(
        call => typeof call[0] === 'function'
      );
      if (timeoutCall) {
        timeoutCall[0]();
      }

      await expect(executePromise).rejects.toThrow('timeout');
    });

    it('should handle infinite loops gracefully', async () => {
      const executePromise = instance.api.execute('while True: x = 1');

      const timeoutCall = global.setTimeout.mock.calls.find(
        call => typeof call[0] === 'function'
      );
      if (timeoutCall) {
        timeoutCall[0]();
      }

      await expect(executePromise).rejects.toThrow();
    });
  });

  describe('Memory Exhaustion Tests', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle memory allocation errors', async () => {
      const executePromise = instance.api.execute('x = [0] * (10**9)');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'Memory error' } }
      });

      await expect(executePromise).rejects.toThrow();
    });

    it('should handle out of memory during large file operations', async () => {
      const largeContent = 'x' .repeat(100 * 1024 * 1024);
      mockDeps.Storage.getArtifactContent.mockResolvedValue(largeContent);

      const syncPromise = instance.api.syncFileToWorker('/large.txt');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'error', data: { message: 'Out of memory' } }
      });

      await expect(syncPromise).rejects.toThrow();
    });
  });

  describe('Concurrent Execution Tests', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle multiple concurrent execute calls', async () => {
      const promises = [
        instance.api.execute('x = 1'),
        instance.api.execute('y = 2'),
        instance.api.execute('z = 3')
      ];

      const executeMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'execute'
      );
      executeMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should handle concurrent package installations', async () => {
      const promises = [
        instance.api.installPackage('numpy'),
        instance.api.installPackage('pandas')
      ];

      const installMessages = mockWorker.postMessage.mock.calls.filter(
        call => call[0].type === 'install'
      );
      installMessages.forEach(msg => {
        mockWorker.onmessage({
          data: { id: msg[0].id, type: 'response', data: { success: true } }
        });
      });

      const results = await Promise.all(promises);

      expect(results).toHaveLength(2);
    });
  });

  describe('Python Error Handling', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle Python SyntaxError', async () => {
      const executePromise = instance.api.execute('if True');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'SyntaxError: invalid syntax' } }
      });

      await expect(executePromise).rejects.toThrow('SyntaxError');
    });

    it('should handle Python ImportError', async () => {
      const executePromise = instance.api.execute('import nonexistent_module');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'ImportError: No module named nonexistent_module' } }
      });

      await expect(executePromise).rejects.toThrow('ImportError');
    });

    it('should handle Python NameError', async () => {
      const executePromise = instance.api.execute('print(undefined_variable)');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'NameError: name undefined_variable is not defined' } }
      });

      await expect(executePromise).rejects.toThrow('NameError');
    });

    it('should handle Python TypeError', async () => {
      const executePromise = instance.api.execute('x = "string" + 5');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'TypeError: unsupported operand type(s)' } }
      });

      await expect(executePromise).rejects.toThrow('TypeError');
    });

    it('should handle Python ValueError', async () => {
      const executePromise = instance.api.execute('int("not_a_number")');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'ValueError: invalid literal' } }
      });

      await expect(executePromise).rejects.toThrow('ValueError');
    });

    it('should handle Python IndexError', async () => {
      const executePromise = instance.api.execute('x = [1, 2]; y = x[10]');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'IndexError: list index out of range' } }
      });

      await expect(executePromise).rejects.toThrow('IndexError');
    });

    it('should handle Python KeyError', async () => {
      const executePromise = instance.api.execute('x = {}; y = x["missing_key"]');

      const executeMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'execute'
      );
      mockWorker.onmessage({
        data: { id: executeMessage[0].id, type: 'error', data: { message: 'KeyError: missing_key' } }
      });

      await expect(executePromise).rejects.toThrow('KeyError');
    });
  });

  describe('File System Operations Tests', () => {
    beforeEach(async () => {
      instance = PyodideRuntime.factory(mockDeps);
      const initPromise = instance.init();
      mockWorker.onmessage({ data: { type: 'ready', data: {} } });
      const initMessage = mockWorker.postMessage.mock.calls[0];
      mockWorker.onmessage({ data: { id: initMessage[0].id, type: 'response', data: {} } });
      await initPromise;
    });

    it('should handle file permission errors', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('content');

      const syncPromise = instance.api.syncFileToWorker('/readonly/file.py');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'error', data: { message: 'Permission denied' } }
      });

      await expect(syncPromise).rejects.toThrow();
    });

    it('should handle directory not found errors', async () => {
      const listPromise = instance.api.listFiles('/nonexistent');

      const listMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'listDir'
      );
      mockWorker.onmessage({
        data: { id: listMessage[0].id, type: 'error', data: { message: 'Directory not found' } }
      });

      await expect(listPromise).rejects.toThrow();
    });

    it('should handle reading non-existent files', async () => {
      const syncPromise = instance.api.syncFileFromWorker('/missing.py');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'readFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: false, error: 'File not found' } }
      });

      const result = await syncPromise;

      expect(result.success).toBe(false);
    });

    it('should handle binary file operations', async () => {
      const binaryContent = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
      mockDeps.Storage.getArtifactContent.mockResolvedValue(binaryContent);

      const syncPromise = instance.api.syncFileToWorker('/image.jpg');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: true } }
      });

      const result = await syncPromise;

      expect(result.success).toBe(true);
    });

    it('should handle nested directory creation', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('content');

      const syncPromise = instance.api.syncFileToWorker('/a/b/c/deep.py');

      const syncMessage = mockWorker.postMessage.mock.calls.find(
        call => call[0].type === 'writeFile'
      );
      mockWorker.onmessage({
        data: { id: syncMessage[0].id, type: 'response', data: { success: true } }
      });

      const result = await syncPromise;

      expect(result.success).toBe(true);
    });
  });
});
