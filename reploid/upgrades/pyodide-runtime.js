/**
 * @fileoverview Pyodide Runtime Module for REPLOID
 * Manages Python code execution in a WebAssembly sandbox via Web Worker.
 * Provides secure, isolated Python runtime with VFS integration.
 *
 * @module PyodideRuntime
 * @version 1.0.0
 * @category runtime
 */

const PyodideRuntime = {
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

    /**
     * Create and initialize the Pyodide worker
     */
    const createWorker = () => {
      try {
        // Create worker from the pyodide-worker.js file
        worker = new Worker('upgrades/pyodide-worker.js');

        // Set up message handler
        worker.onmessage = handleWorkerMessage;

        // Set up error handler
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

    /**
     * Handle messages from worker
     */
    const handleWorkerMessage = (event) => {
      const { id, type, data } = event.data;

      // Handle special message types
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

      // Handle response to a specific message
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

    /**
     * Send message to worker and wait for response
     */
    const sendMessage = (type, data = {}) => {
      return new Promise((resolve, reject) => {
        if (!worker) {
          reject(new Error('Worker not initialized'));
          return;
        }

        const id = ++messageId;
        pendingMessages.set(id, { resolve, reject });

        // Set timeout for message
        setTimeout(() => {
          if (pendingMessages.has(id)) {
            pendingMessages.delete(id);
            reject(new Error(`Message timeout: ${type}`));
          }
        }, 30000); // 30 second timeout

        worker.postMessage({ id, type, data });
      });
    };

    /**
     * Initialize Pyodide
     */
    const init = async () => {
      try {
        logger.info('[PyodideRuntime] Initializing Pyodide runtime...');

        // Create worker
        createWorker();

        // Send init message
        await sendMessage('init');

        logger.info('[PyodideRuntime] Pyodide runtime ready');

        // Emit ready event
        EventBus.emit('pyodide:initialized', { ready: true });

        return true;

      } catch (error) {
        logger.error('[PyodideRuntime] Initialization failed:', error);
        initError = error;
        throw error;
      }
    };

    /**
     * Execute Python code
     */
    const execute = async (code, options = {}) => {
      if (!isReady) {
        throw new Error('Pyodide not ready. Call init() first.');
      }

      try {
        logger.debug('[PyodideRuntime] Executing Python code', { length: code.length });

        const result = await sendMessage('execute', {
          code,
          options: {
            async: options.async !== false, // Default to async
            ...options
          }
        });

        if (!result.success) {
          logger.error('[PyodideRuntime] Execution failed', result);
        }

        // Emit execution event
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

    /**
     * Install Python package
     */
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

    /**
     * Sync file from VFS to Pyodide filesystem
     */
    const syncFileToWorker = async (path) => {
      if (!isReady) {
        throw new Error('Pyodide not ready');
      }

      try {
        // Get file content from VFS
        const content = await Storage.getArtifactContent(path);

        if (!content) {
          logger.warn('[PyodideRuntime] File not found in VFS:', path);
          return { success: false, error: 'File not found' };
        }

        // Write to Pyodide FS
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

    /**
     * Sync file from Pyodide filesystem to VFS
     */
    const syncFileFromWorker = async (path) => {
      if (!isReady) {
        throw new Error('Pyodide not ready');
      }

      try {
        // Read from Pyodide FS
        const result = await sendMessage('readFile', { path });

        if (!result.success) {
          return result;
        }

        // Write to VFS
        await Storage.setArtifactContent(path, result.content);

        logger.debug('[PyodideRuntime] File synced from worker:', path);

        return { success: true, path };

      } catch (error) {
        logger.error('[PyodideRuntime] File sync failed:', error);
        throw error;
      }
    };

    /**
     * Sync entire workspace to Pyodide
     */
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

    /**
     * List files in Pyodide filesystem
     */
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

    /**
     * Get installed packages
     */
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

    /**
     * Get runtime status
     */
    const getStatus = async () => {
      if (!worker) {
        return { ready: false, error: 'Worker not created' };
      }

      try {
        const result = await sendMessage('getStatus');
        return result;

      } catch (error) {
        return {
          ready: false,
          error: error.message
        };
      }
    };

    /**
     * Terminate worker
     */
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

// Export standardized module
PyodideRuntime;
