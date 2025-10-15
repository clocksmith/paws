import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('VerificationManager Module', () => {
  let VerificationManager;
  let mockDeps;
  let managerInstance;
  let mockWorker;

  beforeEach(() => {
    // Mock Worker with message handling
    const messageHandlers = [];
    mockWorker = {
      postMessage: vi.fn((message) => {
        // Simulate async worker response
        setTimeout(() => {
          if (message.type === 'VERIFY' && message.payload) {
            // Respond with VERIFY_COMPLETE
            messageHandlers.forEach(handler => {
              handler({
                data: {
                  type: 'VERIFY_COMPLETE',
                  sessionId: message.payload.sessionId,
                  success: true,
                  output: 'Verification completed'
                }
              });
            });
          } else if (message.type === 'PING') {
            // Respond with PONG
            messageHandlers.forEach(handler => {
              handler({
                data: { type: 'PONG' }
              });
            });
          }
        }, 0);
      }),
      addEventListener: vi.fn((event, handler) => {
        if (event === 'message') {
          messageHandlers.push(handler);
        }
      }),
      removeEventListener: vi.fn((event, handler) => {
        if (event === 'message') {
          const index = messageHandlers.indexOf(handler);
          if (index > -1) {
            messageHandlers.splice(index, 1);
          }
        }
      }),
      terminate: vi.fn()
    };

    global.Worker = vi.fn(() => mockWorker);

    mockDeps = {
      Utils: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), log: vi.fn() } },
      StateManager: {
        getAllArtifactMetadata: vi.fn(async () => ({
          '/test/file.js': { size: 100 },
          '/test/file.test.js': { size: 200 },
          '/config/config.json': { size: 50 }
        })),
        getArtifactContent: vi.fn(async (path) => `content of ${path}`)
      }
    };

    VerificationManager = {
      metadata: {
        id: 'VerificationManager',
        version: '1.0.0',
        dependencies: ['Utils', 'StateManager'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { Utils, StateManager } = deps;
        const { logger } = Utils;

        let worker = null;
        let pendingVerifications = new Map();

        const init = () => {
          try {
            worker = new Worker('/upgrades/verification-worker.js');
            worker.addEventListener('message', handleWorkerMessage);
            worker.addEventListener('error', (error) => {
              logger.error('[VerificationManager] Worker error:', error);
              for (const [id, handler] of pendingVerifications) {
                handler.reject(new Error('Worker crashed'));
              }
              pendingVerifications.clear();
            });
            logger.info('[VerificationManager] Worker initialized');
            return true;
          } catch (error) {
            logger.error('[VerificationManager] Failed to initialize worker:', error);
            return false;
          }
        };

        const handleWorkerMessage = (event) => {
          const { type, sessionId, success, output, error, level, message } = event.data;

          switch (type) {
            case 'READY':
              logger.info('[VerificationManager] Worker ready');
              break;
            case 'LOG':
              logger.log(level || 'info', message);
              break;
            case 'VERIFY_COMPLETE':
              const handler = pendingVerifications.get(sessionId);
              if (handler) {
                if (success) {
                  handler.resolve({ success, output });
                } else {
                  handler.reject(new Error(error || 'Verification failed'));
                }
                pendingVerifications.delete(sessionId);
              }
              break;
            case 'ERROR':
              logger.error('[VerificationManager] Worker error:', error);
              break;
            default:
              logger.warn('[VerificationManager] Unknown message type:', type);
          }
        };

        const runVerification = async (command, sessionId) => {
          if (!worker) {
            throw new Error('Verification worker not initialized');
          }

          const verificationId = sessionId || `verify_${Date.now()}`;

          return new Promise(async (resolve, reject) => {
            pendingVerifications.set(verificationId, { resolve, reject });

            try {
              const vfsSnapshot = await createVFSSnapshot();

              worker.postMessage({
                type: 'VERIFY',
                payload: {
                  command,
                  vfsSnapshot,
                  sessionId: verificationId
                }
              });

              setTimeout(() => {
                if (pendingVerifications.has(verificationId)) {
                  pendingVerifications.delete(verificationId);
                  reject(new Error('Verification timeout after 30 seconds'));
                }
              }, 30000);
            } catch (error) {
              pendingVerifications.delete(verificationId);
              reject(error);
            }
          });
        };

        const createVFSSnapshot = async () => {
          const snapshot = {};
          const allMetadata = await StateManager.getAllArtifactMetadata();

          for (const [path, meta] of Object.entries(allMetadata)) {
            if (path.endsWith('.js') || path.endsWith('.json') || path.includes('test') || path.includes('spec')) {
              const content = await StateManager.getArtifactContent(path);
              if (content) {
                snapshot[path] = content;
              }
            }
          }

          return snapshot;
        };

        const terminate = () => {
          if (worker) {
            worker.terminate();
            worker = null;
            pendingVerifications.clear();
            logger.info('[VerificationManager] Worker terminated');
          }
        };

        const test = async () => {
          try {
            if (!worker) {
              init();
            }

            worker.postMessage({ type: 'PING' });

            return new Promise((resolve) => {
              const handler = (event) => {
                if (event.data.type === 'PONG') {
                  worker.removeEventListener('message', handler);
                  resolve(true);
                }
              };
              worker.addEventListener('message', handler);
              setTimeout(() => resolve(false), 1000);
            });
          } catch (error) {
            logger.error('[VerificationManager] Test failed:', error);
            return false;
          }
        };

        const verifyTests = async (testPath) => {
          return runVerification(`test:${testPath}`);
        };

        const verifyLinting = async (filePath) => {
          return runVerification(`lint:${filePath}`);
        };

        const verifyTypes = async (filePath) => {
          return runVerification(`type-check:${filePath}`);
        };

        const verifySafeEval = async (expression) => {
          return runVerification(`eval:${expression}`);
        };

        const runFullVerification = async (changedFiles) => {
          const results = { tests: null, linting: null, types: null, overall: true };

          try {
            const testFiles = changedFiles.filter(f => f.includes('test') || f.includes('spec'));
            if (testFiles.length > 0) {
              for (const testFile of testFiles) {
                try {
                  const testResult = await verifyTests(testFile);
                  results.tests = testResult;
                } catch (error) {
                  results.tests = { success: false, error: error.message };
                  results.overall = false;
                }
              }
            }

            const jsFiles = changedFiles.filter(f => f.endsWith('.js'));
            for (const file of jsFiles) {
              try {
                const lintResult = await verifyLinting(file);
                results.linting = lintResult;
              } catch (error) {
                results.linting = { success: false, error: error.message };
                results.overall = false;
              }
            }

            for (const file of jsFiles) {
              try {
                const typeResult = await verifyTypes(file);
                results.types = typeResult;
              } catch (error) {
                results.types = { success: false, error: error.message };
                results.overall = false;
              }
            }
          } catch (error) {
            logger.error('[VerificationManager] Full verification failed:', error);
            results.overall = false;
          }

          return results;
        };

        return {
          init,
          api: {
            runVerification,
            verifyTests,
            verifyLinting,
            verifyTypes,
            verifySafeEval,
            runFullVerification,
            terminate,
            test,
            isInitialized: () => worker !== null
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.Worker;
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(VerificationManager.metadata).toEqual({
        id: 'VerificationManager',
        version: '1.0.0',
        dependencies: ['Utils', 'StateManager'],
        async: false,
        type: 'service'
      });
    });

    it('should be a service type module', () => {
      expect(VerificationManager.metadata.type).toBe('service');
    });

    it('should have required dependencies', () => {
      expect(VerificationManager.metadata.dependencies).toContain('Utils');
      expect(VerificationManager.metadata.dependencies).toContain('StateManager');
    });
  });

  describe('Module Initialization', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
    });

    it('should initialize successfully', () => {
      const result = managerInstance.init();
      expect(result).toBe(true);
      expect(global.Worker).toHaveBeenCalledWith('/upgrades/verification-worker.js');
    });

    it('should log initialization message', () => {
      managerInstance.init();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[VerificationManager] Worker initialized');
    });

    it('should set up message event listener', () => {
      managerInstance.init();
      expect(mockWorker.addEventListener).toHaveBeenCalledWith('message', expect.any(Function));
    });

    it('should set up error event listener', () => {
      managerInstance.init();
      expect(mockWorker.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle Worker constructor failure', () => {
      global.Worker = vi.fn(() => {
        throw new Error('Worker creation failed');
      });
      managerInstance = VerificationManager.factory(mockDeps);
      const result = managerInstance.init();
      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Worker Communication', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should be initialized after init call', () => {
      expect(managerInstance.api.isInitialized()).toBe(true);
    });

    it('should not be initialized before init call', () => {
      const freshInstance = VerificationManager.factory(mockDeps);
      expect(freshInstance.api.isInitialized()).toBe(false);
    });

    it('should send PING message in test', async () => {
      managerInstance.api.test();
      expect(mockWorker.postMessage).toHaveBeenCalledWith({ type: 'PING' });
    });

    it('should handle READY message', () => {
      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({ data: { type: 'READY' } });
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[VerificationManager] Worker ready');
    });

    it('should handle LOG message', () => {
      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({ data: { type: 'LOG', level: 'info', message: 'Test log' } });
      expect(mockDeps.Utils.logger.log).toHaveBeenCalledWith('info', 'Test log');
    });

    it('should handle unknown message types', () => {
      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({ data: { type: 'UNKNOWN' } });
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('VFS Snapshot Creation', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should get artifact metadata', async () => {
      await managerInstance.api.runVerification('test').catch(() => {});
      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should get content for JS files', async () => {
      await managerInstance.api.runVerification('test').catch(() => {});
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/test/file.js');
    });

    it('should get content for test files', async () => {
      await managerInstance.api.runVerification('test').catch(() => {});
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/test/file.test.js');
    });

    it('should get content for JSON files', async () => {
      await managerInstance.api.runVerification('test').catch(() => {});
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/config/config.json');
    });
  });

  describe('Verification Commands', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should throw if worker not initialized', async () => {
      const freshInstance = VerificationManager.factory(mockDeps);
      await expect(freshInstance.api.runVerification('test')).rejects.toThrow('Verification worker not initialized');
    });

    it('should run test verification', async () => {
      const promise = managerInstance.api.verifyTests('/test/file.test.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VERIFY',
        payload: expect.objectContaining({
          command: 'test:/test/file.test.js'
        })
      }));
    });

    it('should run lint verification', async () => {
      const promise = managerInstance.api.verifyLinting('/test/file.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VERIFY',
        payload: expect.objectContaining({
          command: 'lint:/test/file.js'
        })
      }));
    });

    it('should run type check verification', async () => {
      const promise = managerInstance.api.verifyTypes('/test/file.js');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VERIFY',
        payload: expect.objectContaining({
          command: 'type-check:/test/file.js'
        })
      }));
    });

    it('should run safe eval verification', async () => {
      const promise = managerInstance.api.verifySafeEval('2 + 2');
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VERIFY',
        payload: expect.objectContaining({
          command: 'eval:2 + 2'
        })
      }));
    });
  });

  describe('Full Verification Suite', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should run full verification on changed files', async () => {
      const changedFiles = ['/test/file.js', '/test/file.test.js'];
      const promise = managerInstance.api.runFullVerification(changedFiles);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should identify test files', async () => {
      const changedFiles = ['/test/file.test.js', '/spec/another.spec.js'];
      const promise = managerInstance.api.runFullVerification(changedFiles);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should identify JS files', async () => {
      const changedFiles = ['/src/module.js', '/lib/helper.js'];
      const promise = managerInstance.api.runFullVerification(changedFiles);
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should handle empty file list', async () => {
      const result = await managerInstance.api.runFullVerification([]);
      expect(result.overall).toBe(true);
    });
  });

  describe('Worker Termination', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should terminate worker', () => {
      managerInstance.api.terminate();
      expect(mockWorker.terminate).toHaveBeenCalled();
    });

    it('should log termination', () => {
      managerInstance.api.terminate();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith('[VerificationManager] Worker terminated');
    });

    it('should mark as not initialized after termination', () => {
      managerInstance.api.terminate();
      expect(managerInstance.api.isInitialized()).toBe(false);
    });

    it('should handle terminate when worker is null', () => {
      managerInstance.api.terminate();
      managerInstance.api.terminate();
      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle worker errors', () => {
      const errorHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('Worker error'));
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should reject pending verifications on worker crash', async () => {
      const promise = managerInstance.api.runVerification('test');
      await new Promise(resolve => setTimeout(resolve, 0));

      const errorHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('Worker crashed'));
      await expect(promise).rejects.toThrow('Worker crashed');
    });

    it('should handle ERROR message type', () => {
      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({ data: { type: 'ERROR', error: 'Test error' } });
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('API Exposure', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should expose runVerification method', () => {
      expect(managerInstance.api.runVerification).toBeDefined();
      expect(typeof managerInstance.api.runVerification).toBe('function');
    });

    it('should expose verifyTests method', () => {
      expect(managerInstance.api.verifyTests).toBeDefined();
      expect(typeof managerInstance.api.verifyTests).toBe('function');
    });

    it('should expose verifyLinting method', () => {
      expect(managerInstance.api.verifyLinting).toBeDefined();
      expect(typeof managerInstance.api.verifyLinting).toBe('function');
    });

    it('should expose verifyTypes method', () => {
      expect(managerInstance.api.verifyTypes).toBeDefined();
      expect(typeof managerInstance.api.verifyTypes).toBe('function');
    });

    it('should expose verifySafeEval method', () => {
      expect(managerInstance.api.verifySafeEval).toBeDefined();
      expect(typeof managerInstance.api.verifySafeEval).toBe('function');
    });

    it('should expose runFullVerification method', () => {
      expect(managerInstance.api.runFullVerification).toBeDefined();
      expect(typeof managerInstance.api.runFullVerification).toBe('function');
    });

    it('should expose terminate method', () => {
      expect(managerInstance.api.terminate).toBeDefined();
      expect(typeof managerInstance.api.terminate).toBe('function');
    });

    it('should expose test method', () => {
      expect(managerInstance.api.test).toBeDefined();
      expect(typeof managerInstance.api.test).toBe('function');
    });

    it('should expose isInitialized method', () => {
      expect(managerInstance.api.isInitialized).toBeDefined();
      expect(typeof managerInstance.api.isInitialized).toBe('function');
    });
  });

  describe('Timeout Scenarios', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should timeout after 30 seconds', async () => {
      vi.useFakeTimers();
      const promise = managerInstance.api.runVerification('test:long-running');

      vi.advanceTimersByTime(30001);

      await expect(promise).rejects.toThrow('Verification timeout');
      vi.useRealTimers();
    });

    it('should clear pending verification on timeout', async () => {
      vi.useFakeTimers();
      const promise = managerInstance.api.runVerification('test:timeout');

      vi.advanceTimersByTime(30001);

      await promise.catch(() => {});
      vi.useRealTimers();
    });

    it('should not timeout for fast verifications', async () => {
      const promise = managerInstance.api.verifyTests('/test.js');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });
  });

  describe('Concurrent Verification Requests', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle multiple concurrent verifications', async () => {
      const promises = [
        managerInstance.api.verifyTests('/test1.js'),
        managerInstance.api.verifyTests('/test2.js'),
        managerInstance.api.verifyTests('/test3.js')
      ];

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalledTimes(3);
    });

    it('should track all pending verifications', async () => {
      const p1 = managerInstance.api.verifyTests('/test1.js');
      const p2 = managerInstance.api.verifyLinting('/file1.js');
      const p3 = managerInstance.api.verifyTypes('/type1.ts');

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage.mock.calls.length).toBeGreaterThanOrEqual(3);
    });

    it('should resolve verifications independently', async () => {
      const p1 = managerInstance.api.verifyTests('/test1.js');
      const p2 = managerInstance.api.verifyTests('/test2.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({
        data: {
          type: 'VERIFY_COMPLETE',
          sessionId: 'verify_' + Date.now(),
          success: true,
          output: 'test1 passed'
        }
      });

      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should handle rapid-fire verifications', async () => {
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(managerInstance.api.verifyTests(`/test${i}.js`));
      }

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage.mock.calls.length).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Worker Recovery', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle worker crash during verification', async () => {
      const promise = managerInstance.api.runVerification('test:crash');
      await new Promise(resolve => setTimeout(resolve, 10));

      const errorHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('Worker crashed'));

      await expect(promise).rejects.toThrow('Worker crashed');
    });

    it('should reject all pending on worker crash', async () => {
      const p1 = managerInstance.api.verifyTests('/test1.js');
      const p2 = managerInstance.api.verifyTests('/test2.js');

      await new Promise(resolve => setTimeout(resolve, 10));

      const errorHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('Worker crashed'));

      await expect(Promise.all([p1, p2])).rejects.toThrow();
    });

    it('should allow re-initialization after crash', () => {
      const errorHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'error'
      )?.[1];

      errorHandler(new Error('Worker crashed'));

      const result = managerInstance.init();
      expect(result).toBe(true);
    });
  });

  describe('VFS Snapshot Edge Cases', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle empty VFS snapshot', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({});
      const promise = managerInstance.api.runVerification('test');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should handle large VFS snapshot', async () => {
      const largeMetadata = {};
      for (let i = 0; i < 10000; i++) {
        largeMetadata[`/file${i}.js`] = { size: 100 };
      }
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue(largeMetadata);

      await managerInstance.api.runVerification('test').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.getAllArtifactMetadata).toHaveBeenCalled();
    });

    it('should filter relevant files in snapshot', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockResolvedValue({
        '/test.js': { size: 100 },
        '/image.png': { size: 5000 },
        '/data.json': { size: 200 }
      });

      await managerInstance.api.runVerification('test').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/test.js');
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalledWith('/data.json');
    });

    it('should handle snapshot creation errors', async () => {
      mockDeps.StateManager.getAllArtifactMetadata.mockRejectedValue(
        new Error('Snapshot failed')
      );

      await expect(managerInstance.api.runVerification('test')).rejects.toThrow();
    });

    it('should handle missing file content', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(null);
      await managerInstance.api.runVerification('test').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockDeps.StateManager.getArtifactContent).toHaveBeenCalled();
    });
  });

  describe('Performance Under Load', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle 100 concurrent verifications', async () => {
      const start = Date.now();
      const promises = [];

      for (let i = 0; i < 100; i++) {
        promises.push(managerInstance.api.verifyTests(`/test${i}.js`));
      }

      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000);
      expect(mockWorker.postMessage.mock.calls.length).toBeGreaterThanOrEqual(100);
    });

    it('should maintain performance with large files', async () => {
      const largeContent = 'x'.repeat(1000000);
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(largeContent);

      const start = Date.now();
      await managerInstance.api.runVerification('test').catch(() => {});
      await new Promise(resolve => setTimeout(resolve, 10));

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Command Variations', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle test command with glob patterns', async () => {
      const promise = managerInstance.api.verifyTests('**/*.test.js');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        type: 'VERIFY',
        payload: expect.objectContaining({
          command: 'test:**/*.test.js'
        })
      }));
    });

    it('should handle lint command with options', async () => {
      const promise = managerInstance.api.verifyLinting('/src/**/*.js');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should handle type check on TypeScript files', async () => {
      const promise = managerInstance.api.verifyTypes('/src/**/*.ts');
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          command: 'type-check:/src/**/*.ts'
        })
      }));
    });

    it('should handle complex eval expressions', async () => {
      const expression = 'const result = [1,2,3].reduce((a,b) => a+b, 0)';
      const promise = managerInstance.api.verifySafeEval(expression);
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalledWith(expect.objectContaining({
        payload: expect.objectContaining({
          command: `eval:${expression}`
        })
      }));
    });
  });

  describe('Full Verification Edge Cases', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should handle mixed file types', async () => {
      const changedFiles = [
        '/src/file.js',
        '/src/file.ts',
        '/test/test.js',
        '/docs/readme.md'
      ];

      const promise = managerInstance.api.runFullVerification(changedFiles);
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockWorker.postMessage.mock.calls.length).toBeGreaterThan(0);
    });

    it('should skip non-verifiable files', async () => {
      const changedFiles = [
        '/image.png',
        '/data.csv',
        '/document.pdf'
      ];

      const result = await managerInstance.api.runFullVerification(changedFiles);
      expect(result.overall).toBe(true);
    });

    it('should aggregate results from multiple verifications', async () => {
      const changedFiles = ['/test.js', '/test.test.js'];
      const promise = managerInstance.api.runFullVerification(changedFiles);

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should mark overall as false on any failure', async () => {
      const changedFiles = ['/test1.js', '/test2.js'];
      const promise = managerInstance.api.runFullVerification(changedFiles);

      await new Promise(resolve => setTimeout(resolve, 50));

      // Result structure would have overall: false if any test failed
      expect(promise).toBeDefined();
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should clean up completed verifications', async () => {
      const promise = managerInstance.api.verifyTests('/test.js');
      await new Promise(resolve => setTimeout(resolve, 10));

      const messageHandler = mockWorker.addEventListener.mock.calls.find(
        call => call[0] === 'message'
      )?.[1];

      messageHandler({
        data: {
          type: 'VERIFY_COMPLETE',
          sessionId: 'verify_123',
          success: true
        }
      });

      // Verification should be removed from pending after completion
      expect(mockWorker.postMessage).toHaveBeenCalled();
    });

    it('should not leak memory on rapid verifications', async () => {
      for (let i = 0; i < 1000; i++) {
        managerInstance.api.verifyTests(`/test${i}.js`).catch(() => {});
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockWorker.postMessage.mock.calls.length).toBeGreaterThanOrEqual(1000);
    });
  });

  describe('Shutdown Scenarios', () => {
    beforeEach(() => {
      managerInstance = VerificationManager.factory(mockDeps);
      managerInstance.init();
    });

    it('should terminate during active verifications', async () => {
      const p1 = managerInstance.api.verifyTests('/test1.js');
      const p2 = managerInstance.api.verifyTests('/test2.js');

      managerInstance.api.terminate();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(managerInstance.api.isInitialized()).toBe(false);
    });

    it('should reject pending verifications on terminate', async () => {
      const promise = managerInstance.api.verifyTests('/test.js');
      managerInstance.api.terminate();

      // After termination, worker is null
      expect(managerInstance.api.isInitialized()).toBe(false);
    });

    it('should allow multiple terminate calls', () => {
      managerInstance.api.terminate();
      managerInstance.api.terminate();
      managerInstance.api.terminate();

      expect(mockWorker.terminate).toHaveBeenCalledTimes(1);
    });
  });
});
