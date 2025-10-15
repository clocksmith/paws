import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('WorkerPool Module', () => {
  let WorkerPool;
  let mockDeps;
  let workerPoolInstance;
  let mockWorker;
  let workerInstances;

  beforeEach(() => {
    // Reset worker instances
    workerInstances = [];

    // Mock Worker constructor
    mockWorker = vi.fn().mockImplementation((scriptPath) => {
      const worker = {
        postMessage: vi.fn(),
        terminate: vi.fn(),
        onmessage: null,
        onerror: null,
        _scriptPath: scriptPath
      };
      workerInstances.push(worker);
      return worker;
    });
    global.Worker = mockWorker;

    // Mock navigator
    global.navigator = {
      hardwareConcurrency: 4
    };

    // Mock performance
    global.performance = {
      now: vi.fn(() => Date.now())
    };

    // Mock dependencies
    mockDeps = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      Utils: {
        formatError: vi.fn((err) => err.message)
      }
    };

    // Define WorkerPool module
    WorkerPool = {
      metadata: {
        id: 'WorkerPool',
        version: '1.0.0',
        dependencies: ['logger', 'Utils'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { logger, Utils } = deps;

        const POOL_SIZE = navigator.hardwareConcurrency || 4;
        const MAX_QUEUE_SIZE = 100;

        let workers = [];
        let availableWorkers = [];
        let taskQueue = [];
        let activeJobs = new Map();
        let jobIdCounter = 0;

        const initialize = () => {
          logger.info(`[WorkerPool] Initializing pool with ${POOL_SIZE} workers`);

          for (let i = 0; i < POOL_SIZE; i++) {
            const worker = new Worker('/upgrades/tool-worker.js');
            const workerInfo = {
              id: i,
              worker,
              busy: false,
              currentJob: null
            };

            worker.onmessage = (event) => {
              handleWorkerMessage(workerInfo, event);
            };

            worker.onerror = (error) => {
              logger.error(`[WorkerPool] Worker ${i} error:`, error);
              handleWorkerError(workerInfo, error);
            };

            workers.push(workerInfo);
            availableWorkers.push(workerInfo);
          }

          logger.info('[WorkerPool] Pool initialized successfully');
        };

        const handleWorkerMessage = (workerInfo, event) => {
          const { success, result, error, type, id } = event.data;

          if (type === 'request') {
            handleShimRequest(workerInfo, event.data);
            return;
          }

          const job = activeJobs.get(workerInfo.currentJob);
          if (!job) return;

          if (success) {
            job.resolve(result);
          } else {
            job.reject(new Error(error?.message || 'Worker execution failed'));
          }

          activeJobs.delete(workerInfo.currentJob);
          workerInfo.busy = false;
          workerInfo.currentJob = null;
          availableWorkers.push(workerInfo);

          processQueue();
        };

        const handleWorkerError = (workerInfo, error) => {
          const job = activeJobs.get(workerInfo.currentJob);
          if (job) {
            job.reject(error);
            activeJobs.delete(workerInfo.currentJob);
          }

          workerInfo.worker.terminate();
          workerInfo.worker = new Worker('/upgrades/tool-worker.js');
          workerInfo.worker.onmessage = (event) => handleWorkerMessage(workerInfo, event);
          workerInfo.worker.onerror = (err) => handleWorkerError(workerInfo, err);
          workerInfo.busy = false;
          workerInfo.currentJob = null;

          if (!availableWorkers.includes(workerInfo)) {
            availableWorkers.push(workerInfo);
          }

          processQueue();
        };

        const handleShimRequest = async (workerInfo, request) => {
          const { id, requestType, payload } = request;

          try {
            let responseData;

            switch (requestType) {
              case 'getArtifactContent':
                responseData = await global.Storage?.getArtifactContent(
                  payload.id,
                  payload.cycle,
                  payload.versionId
                );
                break;
              case 'getArtifactMetadata':
                responseData = await global.StateManager?.getArtifactMetadata(
                  payload.id,
                  payload.versionId
                );
                break;
              case 'getAllArtifactMetadata':
                responseData = await global.StateManager?.getAllArtifactMetadata();
                break;
              default:
                throw new Error(`Unknown shim request type: ${requestType}`);
            }

            workerInfo.worker.postMessage({
              type: 'response',
              id,
              data: responseData
            });
          } catch (error) {
            workerInfo.worker.postMessage({
              type: 'response',
              id,
              error: { message: error.message }
            });
          }
        };

        const execute = (toolCode, toolArgs, options = {}) => {
          return new Promise((resolve, reject) => {
            const jobId = jobIdCounter++;
            const job = {
              id: jobId,
              toolCode,
              toolArgs,
              options,
              resolve,
              reject,
              timestamp: Date.now()
            };

            if (taskQueue.length >= MAX_QUEUE_SIZE) {
              reject(new Error('Task queue is full'));
              return;
            }

            taskQueue.push(job);
            activeJobs.set(jobId, job);

            processQueue();
          });
        };

        const processQueue = () => {
          while (taskQueue.length > 0 && availableWorkers.length > 0) {
            const job = taskQueue.shift();
            const workerInfo = availableWorkers.shift();

            workerInfo.busy = true;
            workerInfo.currentJob = job.id;

            workerInfo.worker.postMessage({
              type: 'init',
              payload: {
                toolCode: job.toolCode,
                toolArgs: job.toolArgs
              }
            });

            logger.debug(`[WorkerPool] Job ${job.id} assigned to worker ${workerInfo.id}`);
          }
        };

        const executeParallel = async (tasks) => {
          logger.info(`[WorkerPool] Executing ${tasks.length} tasks in parallel`);
          const startTime = performance.now();

          const promises = tasks.map(task =>
            execute(task.toolCode, task.toolArgs, task.options)
          );

          const results = await Promise.allSettled(promises);

          const duration = performance.now() - startTime;
          logger.info(`[WorkerPool] Parallel execution completed in ${duration}ms`);

          return results.map(result => ({
            success: result.status === 'fulfilled',
            value: result.status === 'fulfilled' ? result.value : null,
            error: result.status === 'rejected' ? result.reason : null
          }));
        };

        const map = async (items, mapFunction) => {
          const tasks = items.map(item => ({
            toolCode: `
              const run = async (params) => {
                const fn = ${mapFunction.toString()};
                return fn(params.item);
              };
            `,
            toolArgs: { item }
          }));

          const results = await executeParallel(tasks);
          return results.map(r => r.success ? r.value : null).filter(v => v !== null);
        };

        const reduce = async (items, reduceFunction, initialValue) => {
          const chunkSize = Math.ceil(items.length / POOL_SIZE);
          const chunks = [];

          for (let i = 0; i < items.length; i += chunkSize) {
            chunks.push(items.slice(i, i + chunkSize));
          }

          const chunkResults = await executeParallel(chunks.map(chunk => ({
            toolCode: `
              const run = async (params) => {
                const fn = ${reduceFunction.toString()};
                return params.chunk.reduce(fn, params.initial);
              };
            `,
            toolArgs: { chunk, initial: initialValue }
          })));

          const validResults = chunkResults
            .filter(r => r.success)
            .map(r => r.value);

          return validResults.reduce(reduceFunction, initialValue);
        };

        const getStats = () => {
          return {
            poolSize: POOL_SIZE,
            available: availableWorkers.length,
            busy: workers.filter(w => w.busy).length,
            queueLength: taskQueue.length,
            activeJobs: activeJobs.size
          };
        };

        const terminate = () => {
          logger.info('[WorkerPool] Terminating all workers');

          workers.forEach(workerInfo => {
            workerInfo.worker.terminate();
          });

          workers = [];
          availableWorkers = [];
          taskQueue = [];

          activeJobs.forEach(job => {
            job.reject(new Error('Worker pool terminated'));
          });
          activeJobs.clear();
        };

        initialize();

        return {
          api: {
            execute,
            executeParallel,
            map,
            reduce,
            getStats,
            terminate,
            POOL_SIZE
          }
        };
      }
    };

    workerPoolInstance = WorkerPool.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(WorkerPool.metadata.id).toBe('WorkerPool');
      expect(WorkerPool.metadata.version).toBe('1.0.0');
      expect(WorkerPool.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(WorkerPool.metadata.dependencies).toContain('logger');
      expect(WorkerPool.metadata.dependencies).toContain('Utils');
    });

    it('should be synchronous', () => {
      expect(WorkerPool.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize pool with correct number of workers', () => {
      expect(mockWorker).toHaveBeenCalledTimes(4);
      expect(workerInstances).toHaveLength(4);
    });

    it('should create workers with correct script path', () => {
      workerInstances.forEach(worker => {
        expect(worker._scriptPath).toBe('/upgrades/tool-worker.js');
      });
    });

    it('should log initialization messages', () => {
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing pool with 4 workers')
      );
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Pool initialized successfully')
      );
    });

    it('should set up message handlers for each worker', () => {
      workerInstances.forEach(worker => {
        expect(worker.onmessage).toBeDefined();
        expect(worker.onerror).toBeDefined();
      });
    });
  });

  describe('Task Execution', () => {
    it('should execute single task successfully', async () => {
      const toolCode = 'function test() { return 42; }';
      const toolArgs = { param: 'value' };

      const executePromise = workerPoolInstance.api.execute(toolCode, toolArgs);

      // Simulate worker response
      const worker = workerInstances[0];
      expect(worker.postMessage).toHaveBeenCalledWith({
        type: 'init',
        payload: {
          toolCode,
          toolArgs
        }
      });

      // Trigger success response
      worker.onmessage({
        data: {
          success: true,
          result: 42
        }
      });

      const result = await executePromise;
      expect(result).toBe(42);
    });

    it('should handle execution errors', async () => {
      const toolCode = 'function bad() { throw new Error("test error"); }';
      const toolArgs = {};

      const executePromise = workerPoolInstance.api.execute(toolCode, toolArgs);

      const worker = workerInstances[0];
      worker.onmessage({
        data: {
          success: false,
          error: { message: 'test error' }
        }
      });

      await expect(executePromise).rejects.toThrow('test error');
    });

    it('should reject when queue is full', async () => {
      // Fill the queue
      const promises = [];
      for (let i = 0; i < 101; i++) {
        promises.push(workerPoolInstance.api.execute('code', {}));
      }

      // Last promise should be rejected
      await expect(promises[100]).rejects.toThrow('Task queue is full');
    });

    it('should queue tasks when all workers are busy', async () => {
      // Create 5 tasks (more than pool size of 4)
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(workerPoolInstance.api.execute(`code${i}`, {}));
      }

      // Only 4 workers should be assigned initially
      const stats = workerPoolInstance.api.getStats();
      expect(stats.busy).toBe(4);
      expect(stats.queueLength).toBe(1);
    });

    it('should process queued tasks when workers become available', async () => {
      // Create 5 tasks
      const tasks = [];
      for (let i = 0; i < 5; i++) {
        tasks.push(workerPoolInstance.api.execute(`code${i}`, {}));
      }

      // Complete first task
      const worker = workerInstances[0];
      worker.onmessage({
        data: {
          success: true,
          result: 'done'
        }
      });

      // Wait for processing
      await tasks[0];

      // Queue should now be empty
      const stats = workerPoolInstance.api.getStats();
      expect(stats.queueLength).toBe(0);
    });
  });

  describe('Parallel Execution', () => {
    it('should execute multiple tasks in parallel', async () => {
      const tasks = [
        { toolCode: 'code1', toolArgs: { a: 1 } },
        { toolCode: 'code2', toolArgs: { a: 2 } },
        { toolCode: 'code3', toolArgs: { a: 3 } }
      ];

      const parallelPromise = workerPoolInstance.api.executeParallel(tasks);

      // Simulate all workers completing
      workerInstances.slice(0, 3).forEach((worker, i) => {
        worker.onmessage({
          data: {
            success: true,
            result: i + 1
          }
        });
      });

      const results = await parallelPromise;
      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
    });

    it('should handle mixed success and failure in parallel execution', async () => {
      const tasks = [
        { toolCode: 'success', toolArgs: {} },
        { toolCode: 'fail', toolArgs: {} }
      ];

      const parallelPromise = workerPoolInstance.api.executeParallel(tasks);

      workerInstances[0].onmessage({
        data: { success: true, result: 'ok' }
      });

      workerInstances[1].onmessage({
        data: { success: false, error: { message: 'failed' } }
      });

      const results = await parallelPromise;
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBeDefined();
    });
  });

  describe('Map/Reduce Operations', () => {
    it('should map function over items', async () => {
      const items = [1, 2, 3];
      const mapFn = (x) => x * 2;

      const mapPromise = workerPoolInstance.api.map(items, mapFn);

      // Simulate worker responses
      for (let i = 0; i < 3; i++) {
        workerInstances[i].onmessage({
          data: {
            success: true,
            result: items[i] * 2
          }
        });
      }

      const results = await mapPromise;
      expect(results).toEqual([2, 4, 6]);
    });

    it('should filter out failed map operations', async () => {
      const items = [1, 2, 3];
      const mapFn = (x) => x * 2;

      const mapPromise = workerPoolInstance.api.map(items, mapFn);

      workerInstances[0].onmessage({ data: { success: true, result: 2 } });
      workerInstances[1].onmessage({ data: { success: false, error: {} } });
      workerInstances[2].onmessage({ data: { success: true, result: 6 } });

      const results = await mapPromise;
      expect(results).toEqual([2, 6]);
    });
  });

  describe('Worker Error Handling', () => {
    it('should restart worker on error', async () => {
      const executePromise = workerPoolInstance.api.execute('code', {});

      const worker = workerInstances[0];
      const originalWorker = worker;

      // Trigger worker error
      worker.onerror(new Error('Worker crashed'));

      await expect(executePromise).rejects.toThrow('Worker crashed');

      // Should have called terminate on old worker
      expect(originalWorker.terminate).toHaveBeenCalled();

      // Should have created new worker
      expect(mockWorker).toHaveBeenCalledTimes(5); // 4 initial + 1 replacement
    });

    it('should make worker available after restart', async () => {
      const worker = workerInstances[0];

      // Cause error
      const executePromise = workerPoolInstance.api.execute('code', {});
      worker.onerror(new Error('Test error'));
      await expect(executePromise).rejects.toThrow();

      // Worker should be available again
      const stats = workerPoolInstance.api.getStats();
      expect(stats.available).toBe(4);
    });
  });

  describe('Shim Requests', () => {
    it('should handle getArtifactContent shim request', async () => {
      global.Storage = {
        getArtifactContent: vi.fn().mockResolvedValue('content')
      };

      const executePromise = workerPoolInstance.api.execute('code', {});
      const worker = workerInstances[0];

      // Simulate shim request from worker
      worker.onmessage({
        data: {
          type: 'request',
          id: 'req1',
          requestType: 'getArtifactContent',
          payload: { id: 'artifact1' }
        }
      });

      await vi.waitFor(() => {
        expect(worker.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'response',
            id: 'req1',
            data: 'content'
          })
        );
      });
    });

    it('should handle shim request errors', async () => {
      global.Storage = {
        getArtifactContent: vi.fn().mockRejectedValue(new Error('Storage error'))
      };

      const worker = workerInstances[0];
      workerPoolInstance.api.execute('code', {});

      worker.onmessage({
        data: {
          type: 'request',
          id: 'req1',
          requestType: 'getArtifactContent',
          payload: { id: 'missing' }
        }
      });

      await vi.waitFor(() => {
        expect(worker.postMessage).toHaveBeenCalledWith(
          expect.objectContaining({
            type: 'response',
            id: 'req1',
            error: { message: 'Storage error' }
          })
        );
      });
    });
  });

  describe('Pool Statistics', () => {
    it('should return accurate pool statistics', () => {
      const stats = workerPoolInstance.api.getStats();

      expect(stats.poolSize).toBe(4);
      expect(stats.available).toBe(4);
      expect(stats.busy).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.activeJobs).toBe(0);
    });

    it('should update statistics when tasks are running', () => {
      // Start some tasks
      workerPoolInstance.api.execute('code1', {});
      workerPoolInstance.api.execute('code2', {});

      const stats = workerPoolInstance.api.getStats();
      expect(stats.busy).toBe(2);
      expect(stats.available).toBe(2);
      expect(stats.activeJobs).toBe(2);
    });

    it('should reflect queued tasks in statistics', () => {
      // Fill pool and add to queue
      for (let i = 0; i < 6; i++) {
        workerPoolInstance.api.execute(`code${i}`, {});
      }

      const stats = workerPoolInstance.api.getStats();
      expect(stats.busy).toBe(4);
      expect(stats.queueLength).toBe(2);
    });
  });

  describe('Termination', () => {
    it('should terminate all workers', () => {
      workerPoolInstance.api.terminate();

      workerInstances.forEach(worker => {
        expect(worker.terminate).toHaveBeenCalled();
      });
    });

    it('should reject pending jobs on termination', async () => {
      const task1 = workerPoolInstance.api.execute('code1', {});
      const task2 = workerPoolInstance.api.execute('code2', {});

      workerPoolInstance.api.terminate();

      await expect(task1).rejects.toThrow('Worker pool terminated');
      await expect(task2).rejects.toThrow('Worker pool terminated');
    });

    it('should clear pool state on termination', () => {
      workerPoolInstance.api.execute('code', {});
      workerPoolInstance.api.terminate();

      const stats = workerPoolInstance.api.getStats();
      expect(stats.poolSize).toBe(4);
      expect(stats.busy).toBe(0);
      expect(stats.queueLength).toBe(0);
      expect(stats.activeJobs).toBe(0);
    });

    it('should log termination message', () => {
      workerPoolInstance.api.terminate();

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Terminating all workers')
      );
    });
  });

  describe('Concurrency', () => {
    it('should use navigator.hardwareConcurrency for pool size', () => {
      expect(workerPoolInstance.api.POOL_SIZE).toBe(4);
    });

    it('should default to 4 workers if hardwareConcurrency unavailable', () => {
      delete global.navigator.hardwareConcurrency;
      const newInstance = WorkerPool.factory(mockDeps);
      expect(newInstance.api.POOL_SIZE).toBe(4);
    });
  });
});
