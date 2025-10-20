// @blueprint 0x000050 - WebWorker Pool for parallel execution
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

    // Job tracking for stats
    let jobStats = {
      completed: 0,
      failed: 0
    };

    // Wrap handleWorkerMessage to track job completion
    const originalHandleWorkerMessage = handleWorkerMessage;
    handleWorkerMessage = (workerInfo, event) => {
      const { success } = event.data;
      const job = activeJobs.get(workerInfo.currentJob);

      if (job) {
        if (success) {
          jobStats.completed++;
        } else {
          jobStats.failed++;
        }
      }

      originalHandleWorkerMessage(workerInfo, event);
    };

    // Web Component Widget
    class WorkerPoolWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 1 second to track worker status
        this._interval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const stats = getStats();
        const busyWorkers = stats.busy;

        return {
          state: busyWorkers > 0 ? 'active' : 'idle',
          primaryMetric: `${busyWorkers}/${POOL_SIZE} busy`,
          secondaryMetric: `${jobStats.completed} jobs`,
          lastActivity: jobStats.completed > 0 ? Date.now() : null,
          message: stats.queueLength > 0 ? `${stats.queueLength} queued` : null
        };
      }

      getControls() {
        return [
          {
            id: 'clear-queue',
            label: 'Clear Queue',
            icon: '⛶️',
            action: () => {
              taskQueue.length = 0;
              if (typeof EventBus !== 'undefined') {
                EventBus.emit('toast:success', { message: 'Task queue cleared' });
              }
              return { success: true, message: 'Task queue cleared' };
            }
          },
          {
            id: 'terminate-pool',
            label: 'Terminate',
            icon: '⏹',
            action: () => {
              if (confirm('Terminate all workers? Active jobs will fail.')) {
                terminate();
                if (typeof EventBus !== 'undefined') {
                  EventBus.emit('toast:warning', { message: 'Worker pool terminated' });
                }
                return { success: true, message: 'Worker pool terminated' };
              }
              return { success: false, message: 'Cancelled' };
            }
          }
        ];
      }

      render() {
        const stats = getStats();
        const busyWorkers = stats.busy;
        const utilizationPercent = Math.round((busyWorkers / POOL_SIZE) * 100);
        const totalJobs = jobStats.completed + jobStats.failed;
        const successRate = totalJobs > 0
          ? Math.round((jobStats.completed / totalJobs) * 100)
          : 100;

        const workersHtml = workers.map((worker, i) => {
          const statusColor = worker.busy ? '#ffc107' : '#4caf50';
          const statusIcon = worker.busy ? '⚙️' : '○';
          return `
            <div class="worker-item ${worker.busy ? 'busy' : 'idle'}" style="border-color: ${statusColor};">
              <div class="worker-icon">${statusIcon}</div>
              <div class="worker-label">Worker ${i}</div>
              <div class="worker-status" style="color: ${statusColor};">
                ${worker.busy ? 'Busy' : 'Idle'}
              </div>
            </div>
          `;
        }).join('');

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }

            .worker-pool-panel {
              color: #e0e0e0;
            }

            .pool-stats {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }

            .stat-card {
              padding: 10px;
              border-radius: 5px;
            }

            .stat-card.pool-size {
              background: rgba(0, 255, 255, 0.1);
            }

            .stat-card.utilization {
              background: rgba(255, 193, 7, 0.1);
            }

            .stat-card.success-rate {
              background: rgba(76, 175, 80, 0.1);
            }

            .stat-label {
              color: #888;
              font-size: 12px;
            }

            .stat-value {
              font-size: 24px;
              font-weight: bold;
              margin-top: 4px;
            }

            .stat-value.cyan { color: #0ff; }
            .stat-value.yellow { color: #ffc107; }
            .stat-value.green { color: #4caf50; }

            .job-stats {
              display: grid;
              grid-template-columns: 1fr 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }

            .job-stat-item {
              padding: 8px;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 5px;
              text-align: center;
            }

            .job-stat-label {
              color: #888;
              font-size: 12px;
            }

            .job-stat-value {
              font-size: 20px;
              font-weight: bold;
              margin-top: 4px;
            }

            .job-stat-value.green { color: #4caf50; }
            .job-stat-value.red { color: #f44336; }
            .job-stat-value.yellow { color: #ffc107; }

            .workers-list h4 {
              color: #0ff;
              margin: 0 0 10px 0;
              font-size: 14px;
            }

            .worker-grid {
              display: grid;
              grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
              gap: 8px;
            }

            .worker-item {
              padding: 12px;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 5px;
              text-align: center;
              border: 2px solid;
            }

            .worker-icon {
              font-size: 24px;
              margin-bottom: 4px;
            }

            .worker-label {
              font-size: 11px;
              color: #888;
            }

            .worker-status {
              font-size: 10px;
              margin-top: 4px;
            }

            .queue-warning {
              margin-top: 20px;
              padding: 12px;
              background: rgba(255, 193, 7, 0.1);
              border-radius: 5px;
              border-left: 3px solid #ffc107;
            }

            .queue-warning-title {
              font-weight: bold;
              color: #ffc107;
              margin-bottom: 4px;
            }

            .queue-warning-text {
              font-size: 13px;
              color: #ccc;
            }

            .pool-info {
              background: rgba(255, 255, 255, 0.05);
              padding: 12px;
              border-radius: 5px;
              margin-top: 20px;
            }

            .pool-info h4 {
              color: #0ff;
              margin: 0 0 8px 0;
              font-size: 14px;
            }

            .pool-info-content {
              font-size: 13px;
              color: #ccc;
              line-height: 1.8;
            }
          </style>
          <div class="worker-pool-panel">
            <div class="pool-stats">
              <div class="stat-card pool-size">
                <div class="stat-label">Pool Size</div>
                <div class="stat-value cyan">${POOL_SIZE}</div>
              </div>
              <div class="stat-card utilization">
                <div class="stat-label">Utilization</div>
                <div class="stat-value yellow">${utilizationPercent}%</div>
              </div>
              <div class="stat-card success-rate">
                <div class="stat-label">Success Rate</div>
                <div class="stat-value green">${successRate}%</div>
              </div>
            </div>

            <div class="job-stats">
              <div class="job-stat-item">
                <div class="job-stat-label">Completed</div>
                <div class="job-stat-value green">${jobStats.completed}</div>
              </div>
              <div class="job-stat-item">
                <div class="job-stat-label">Failed</div>
                <div class="job-stat-value red">${jobStats.failed}</div>
              </div>
              <div class="job-stat-item">
                <div class="job-stat-label">Queued</div>
                <div class="job-stat-value yellow">${stats.queueLength}</div>
              </div>
            </div>

            <div class="workers-list">
              <h4>Workers (${POOL_SIZE})</h4>
              <div class="worker-grid">
                ${workersHtml}
              </div>
            </div>

            ${stats.queueLength > 0 ? `
              <div class="queue-warning">
                <div class="queue-warning-title">⚠️ Queue Active</div>
                <div class="queue-warning-text">
                  ${stats.queueLength} task${stats.queueLength > 1 ? 's' : ''} waiting for available workers
                </div>
              </div>
            ` : ''}

            <div class="pool-info">
              <h4>Pool Configuration</h4>
              <div class="pool-info-content">
                <div>Hardware Concurrency: ${navigator.hardwareConcurrency || 'Unknown'}</div>
                <div>Max Queue Size: ${MAX_QUEUE_SIZE}</div>
                <div>Active Jobs: ${activeJobs.size}</div>
              </div>
            </div>
          </div>
        `;
      }
    }

    const elementName = 'worker-pool-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, WorkerPoolWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Worker Pool',
      icon: '⚡',
      category: 'core'
    };

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
      },
      widget
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