// WebWorker Pool Module for REPLOID
// Enables parallel execution of tools and computations across multiple workers

const WorkerPool = {
  metadata: {
    id: 'WorkerPool',
    version: '1.0.0',
    dependencies: ['logger', 'Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { logger, Utils } = deps;
    
    // Pool configuration
    const POOL_SIZE = navigator.hardwareConcurrency || 4;
    const MAX_QUEUE_SIZE = 100;
    
    // Worker pool state
    let workers = [];
    let availableWorkers = [];
    let taskQueue = [];
    let activeJobs = new Map();
    let jobIdCounter = 0;
    
    // Initialize worker pool
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
        
        // Handle worker messages
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
    
    // Handle messages from workers
    const handleWorkerMessage = (workerInfo, event) => {
      const { success, result, error, type, id } = event.data;
      
      // Handle shim requests from worker
      if (type === 'request') {
        handleShimRequest(workerInfo, event.data);
        return;
      }
      
      // Handle job completion
      const job = activeJobs.get(workerInfo.currentJob);
      if (!job) return;
      
      if (success) {
        job.resolve(result);
      } else {
        job.reject(new Error(error?.message || 'Worker execution failed'));
      }
      
      // Clean up and mark worker as available
      activeJobs.delete(workerInfo.currentJob);
      workerInfo.busy = false;
      workerInfo.currentJob = null;
      availableWorkers.push(workerInfo);
      
      // Process next queued task
      processQueue();
    };
    
    // Handle worker errors
    const handleWorkerError = (workerInfo, error) => {
      const job = activeJobs.get(workerInfo.currentJob);
      if (job) {
        job.reject(error);
        activeJobs.delete(workerInfo.currentJob);
      }
      
      // Restart worker
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
    
    // Handle shim requests from workers (StateManager/Storage access)
    const handleShimRequest = async (workerInfo, request) => {
      const { id, requestType, payload } = request;
      
      try {
        let responseData;
        
        // Route to appropriate handler based on requestType
        // These would need to be injected or accessed from the main thread
        switch (requestType) {
          case 'getArtifactContent':
            responseData = await window.Storage?.getArtifactContent(
              payload.id, 
              payload.cycle, 
              payload.versionId
            );
            break;
          case 'getArtifactMetadata':
            responseData = await window.StateManager?.getArtifactMetadata(
              payload.id,
              payload.versionId
            );
            break;
          case 'getAllArtifactMetadata':
            responseData = await window.StateManager?.getAllArtifactMetadata();
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
    
    // Execute a task in the pool
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
        
        // Check queue size limit
        if (taskQueue.length >= MAX_QUEUE_SIZE) {
          reject(new Error('Task queue is full'));
          return;
        }
        
        // Add to queue
        taskQueue.push(job);
        activeJobs.set(jobId, job);
        
        // Try to process immediately
        processQueue();
      });
    };
    
    // Process queued tasks
    const processQueue = () => {
      while (taskQueue.length > 0 && availableWorkers.length > 0) {
        const job = taskQueue.shift();
        const workerInfo = availableWorkers.shift();
        
        workerInfo.busy = true;
        workerInfo.currentJob = job.id;
        
        // Send job to worker
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
    
    // Execute multiple tasks in parallel
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
    
    // Map operation across worker pool
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
    
    // Reduce operation using worker pool
    const reduce = async (items, reduceFunction, initialValue) => {
      // First, chunk items for parallel processing
      const chunkSize = Math.ceil(items.length / POOL_SIZE);
      const chunks = [];
      
      for (let i = 0; i < items.length; i += chunkSize) {
        chunks.push(items.slice(i, i + chunkSize));
      }
      
      // Parallel reduce within chunks
      const chunkResults = await executeParallel(chunks.map(chunk => ({
        toolCode: `
          const run = async (params) => {
            const fn = ${reduceFunction.toString()};
            return params.chunk.reduce(fn, params.initial);
          };
        `,
        toolArgs: { chunk, initial: initialValue }
      })));
      
      // Final reduce of chunk results
      const validResults = chunkResults
        .filter(r => r.success)
        .map(r => r.value);
      
      return validResults.reduce(reduceFunction, initialValue);
    };
    
    // Get pool statistics
    const getStats = () => {
      return {
        poolSize: POOL_SIZE,
        available: availableWorkers.length,
        busy: workers.filter(w => w.busy).length,
        queueLength: taskQueue.length,
        activeJobs: activeJobs.size
      };
    };
    
    // Terminate all workers
    const terminate = () => {
      logger.info('[WorkerPool] Terminating all workers');
      
      workers.forEach(workerInfo => {
        workerInfo.worker.terminate();
      });
      
      workers = [];
      availableWorkers = [];
      taskQueue = [];
      
      // Reject all pending jobs
      activeJobs.forEach(job => {
        job.reject(new Error('Worker pool terminated'));
      });
      activeJobs.clear();
    };
    
    // Initialize on module load
    initialize();
    
    // Public API
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

// Legacy compatibility wrapper
const WorkerPoolModule = (logger, Utils) => {
  const instance = WorkerPool.factory({ logger, Utils });
  return instance.api;
};

// Export both formats
WorkerPool;
WorkerPoolModule;