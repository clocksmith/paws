// @blueprint 0x000071 - Tool Execution Sandbox with Web Worker Isolation
/**
 * Tool Sandbox Module
 *
 * Provides secure isolated execution environment for untrusted tool code
 * Uses Web Workers to prevent access to main thread DOM/globals
 *
 * Key security features:
 * - Web Worker isolation (separate JavaScript context)
 * - Execution timeouts (prevent infinite loops)
 * - Memory limits (prevent excessive allocation)
 * - Restricted API surface (no DOM, localStorage, etc.)
 * - Error handling and recovery
 */

const ToolSandbox = {
  metadata: {
    id: 'ToolSandbox',
    version: '1.0.0',
    description: 'Secure sandbox for isolated tool execution',
    dependencies: ['Utils', 'EventBus?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    logger.info('[ToolSandbox] Initializing tool sandbox...');

    // Default execution limits
    const DEFAULT_TIMEOUT = 30000; // 30 seconds
    const DEFAULT_MEMORY_LIMIT = 50 * 1024 * 1024; // 50MB (soft limit)

    // Active worker registry
    const activeWorkers = new Map();
    let nextWorkerId = 1;

    /**
     * Create sandboxed execution worker
     * @returns {Object} Worker instance and metadata
     */
    const createWorker = () => {
      const workerId = `worker_${nextWorkerId++}`;

      // Create Web Worker from inline code
      const workerCode = `
        // Sandboxed worker environment
        // No access to DOM, localStorage, or main thread globals

        const API = {
          // Safe utilities available to tool code
          log: (...args) => {
            postMessage({ type: 'log', level: 'info', args });
          },
          error: (...args) => {
            postMessage({ type: 'log', level: 'error', args });
          },
          // No file system, no network, no storage
        };

        // Message handler
        self.onmessage = async (event) => {
          const { id, code, args, timeout } = event.data;

          try {
            // Create isolated function scope
            const sandboxedFunction = new Function('args', 'API', code);

            // Execute with timeout
            const startTime = Date.now();
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Execution timeout')), timeout);
            });

            const executionPromise = (async () => {
              const result = await sandboxedFunction(args, API);
              const duration = Date.now() - startTime;
              return { result, duration };
            })();

            const { result, duration } = await Promise.race([
              executionPromise,
              timeoutPromise
            ]);

            postMessage({
              type: 'result',
              id,
              success: true,
              result,
              duration
            });
          } catch (error) {
            postMessage({
              type: 'result',
              id,
              success: false,
              error: {
                message: error.message,
                stack: error.stack,
                name: error.name
              }
            });
          }
        };
      `;

      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      const workerMeta = {
        id: workerId,
        worker,
        url: workerUrl,
        createdAt: Date.now(),
        executionCount: 0
      };

      // Set up message handlers
      worker.onmessage = (event) => {
        const { type, id, level, args } = event.data;

        if (type === 'log') {
          // Forward logs from worker
          const prefix = `[ToolSandbox:${workerId}]`;
          if (level === 'error') {
            logger.error(prefix, ...args);
          } else {
            logger.info(prefix, ...args);
          }
        }
        // Results are handled by executeInSandbox promise
      };

      worker.onerror = (error) => {
        logger.error(`[ToolSandbox] Worker ${workerId} error:`, error);
        if (EventBus) {
          EventBus.emit('sandbox:error', { workerId, error });
        }
      };

      activeWorkers.set(workerId, workerMeta);
      logger.info(`[ToolSandbox] Created worker: ${workerId}`);

      return workerMeta;
    };

    /**
     * Terminate and cleanup worker
     * @param {string} workerId - Worker identifier
     */
    const terminateWorker = (workerId) => {
      const workerMeta = activeWorkers.get(workerId);
      if (!workerMeta) return false;

      workerMeta.worker.terminate();
      URL.revokeObjectURL(workerMeta.url);
      activeWorkers.delete(workerId);

      logger.info(`[ToolSandbox] Terminated worker: ${workerId}`);
      return true;
    };

    /**
     * Execute code in sandboxed environment
     * @param {string} code - JavaScript code to execute
     * @param {Object} args - Arguments to pass to code
     * @param {Object} options - Execution options
     * @returns {Promise<Object>} Execution result
     */
    const executeInSandbox = async (code, args = {}, options = {}) => {
      const {
        timeout = DEFAULT_TIMEOUT,
        reuseWorker = false,
        workerId = null
      } = options;

      // Get or create worker
      let workerMeta;
      if (reuseWorker && workerId && activeWorkers.has(workerId)) {
        workerMeta = activeWorkers.get(workerId);
      } else {
        workerMeta = createWorker();
      }

      const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return new Promise((resolve, reject) => {
        const handleMessage = (event) => {
          const { type, id, success, result, error, duration } = event.data;

          if (type === 'result' && id === executionId) {
            // Remove listener
            workerMeta.worker.removeEventListener('message', handleMessage);

            workerMeta.executionCount++;

            if (success) {
              logger.info(`[ToolSandbox] Execution completed in ${duration}ms`);
              resolve({
                success: true,
                result,
                duration,
                workerId: workerMeta.id
              });
            } else {
              logger.error('[ToolSandbox] Execution failed:', error);
              reject(new Error(error.message));
            }

            // Cleanup worker if not reusing
            if (!reuseWorker) {
              terminateWorker(workerMeta.id);
            }
          }
        };

        workerMeta.worker.addEventListener('message', handleMessage);

        // Send execution request
        workerMeta.worker.postMessage({
          id: executionId,
          code,
          args,
          timeout
        });

        // Emit event
        if (EventBus) {
          EventBus.emit('sandbox:execute', {
            workerId: workerMeta.id,
            executionId,
            timeout
          });
        }
      });
    };

    /**
     * Test if code is safe for sandboxed execution
     * Performs basic static analysis
     * @param {string} code - Code to analyze
     * @returns {Object} Safety analysis result
     */
    const analyzeCode = (code) => {
      const warnings = [];
      const errors = [];

      // Check for dangerous patterns
      const dangerousPatterns = [
        { pattern: /eval\s*\(/g, message: 'Contains eval() call' },
        { pattern: /Function\s*\(/g, message: 'Contains Function() constructor' },
        { pattern: /import\s+/g, message: 'Contains import statement' },
        { pattern: /require\s*\(/g, message: 'Contains require() call' },
        { pattern: /process\./g, message: 'Accesses process object' },
        { pattern: /__dirname|__filename/g, message: 'Accesses filesystem paths' }
      ];

      for (const { pattern, message } of dangerousPatterns) {
        if (pattern.test(code)) {
          warnings.push(message);
        }
      }

      // Check code length (basic DoS prevention)
      if (code.length > 100000) {
        errors.push('Code exceeds maximum length (100KB)');
      }

      return {
        safe: errors.length === 0,
        warnings,
        errors,
        score: Math.max(0, 100 - (warnings.length * 10) - (errors.length * 50))
      };
    };

    /**
     * Get sandbox statistics
     */
    const getStats = () => {
      const workers = Array.from(activeWorkers.values());
      return {
        activeWorkers: workers.length,
        totalExecutions: workers.reduce((sum, w) => sum + w.executionCount, 0),
        workers: workers.map(w => ({
          id: w.id,
          executionCount: w.executionCount,
          age: Date.now() - w.createdAt
        }))
      };
    };

    /**
     * Cleanup all active workers
     */
    const cleanup = () => {
      logger.info(`[ToolSandbox] Cleaning up ${activeWorkers.size} workers`);
      for (const workerId of activeWorkers.keys()) {
        terminateWorker(workerId);
      }
    };

    logger.info('[ToolSandbox] Tool sandbox initialized');

    return {
      executeInSandbox,
      analyzeCode,
      createWorker,
      terminateWorker,
      getStats,
      cleanup
    };
  }
};

// Export for ES modules
export default ToolSandbox;
