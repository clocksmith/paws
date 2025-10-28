/**
 * @fileoverview Pyodide Runtime Module for REPLOID
 * Manages Python code execution in a WebAssembly sandbox via Web Worker.
 * Provides secure, isolated Python runtime with VFS integration.
 *
 * @blueprint 0x000030 - Outlines Pyodide runtime orchestration.
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

    // Widget tracking
    let _executionCount = 0;
    let _packageInstallCount = 0;
    let _fileSyncCount = 0;
    let _lastExecutionTime = null;
    let _installedPackages = [];
    let _executionErrors = [];

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

        // Track execution
        _executionCount++;
        _lastExecutionTime = Date.now();

        if (!result.success) {
          _executionErrors.push({
            timestamp: Date.now(),
            error: result.error || 'Unknown error'
          });
          // Keep only last 10 errors
          if (_executionErrors.length > 10) {
            _executionErrors.shift();
          }
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
          _packageInstallCount++;
          if (!_installedPackages.includes(packageName)) {
            _installedPackages.push(packageName);
          }
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
          _fileSyncCount++;
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

    // Web Component Widget
    const widget = (() => {
      class PyodideRuntimeWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          this._interval = setInterval(() => this.render(), 3000);
        }

        disconnectedCallback() {
          if (this._interval) clearInterval(this._interval);
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        getStatus() {
          const hasErrors = _executionErrors.length > 0;
          return {
            state: !isReady ? 'warning' : (hasErrors ? 'error' : (_executionCount > 0 ? 'active' : 'idle')),
            primaryMetric: isReady ? `${_executionCount} executions` : 'Initializing',
            secondaryMetric: `${_installedPackages.length} packages`,
            lastActivity: _lastExecutionTime,
            message: initError ? `Error: ${initError.message}` : (isReady ? 'Ready' : 'Loading...')
          };
        }

        render() {
          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            const diff = Date.now() - timestamp;
            if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
            if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
            return `${Math.floor(diff/3600000)}h ago`;
          };

          const statusColor = isReady ? '#0c0' : (initError ? '#f00' : '#f90');
          const statusText = isReady ? 'Ready' : (initError ? 'Error' : 'Initializing');

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
              }
              h3 {
                margin: 0 0 16px 0;
                font-size: 1.4em;
                color: #fff;
              }
              h4 {
                margin-top: 16px;
                margin-bottom: 8px;
                font-size: 1.1em;
                color: #0ff;
              }
              .controls {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
              }
              button {
                padding: 6px 12px;
                background: rgba(100,150,255,0.2);
                border: 1px solid rgba(100,150,255,0.4);
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 0.9em;
              }
              button:hover {
                background: rgba(100,150,255,0.3);
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-top: 12px;
              }
              .stat-card {
                padding: 12px;
                background: rgba(100,150,255,0.1);
                border-radius: 4px;
              }
              .stat-label {
                font-size: 0.85em;
                color: #888;
              }
              .stat-value {
                font-size: 1.3em;
                font-weight: bold;
              }
              .stat-value.ready { color: #0c0; }
              .stat-value.error { color: #f00; }
              .stat-value.warning { color: #f90; }
              .package-list {
                max-height: 120px;
                overflow-y: auto;
                margin-top: 8px;
              }
              .package-item {
                padding: 4px 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 3px;
                margin-bottom: 4px;
                font-family: monospace;
                font-size: 0.9em;
              }
              .error-list {
                max-height: 100px;
                overflow-y: auto;
                margin-top: 8px;
              }
              .error-item {
                padding: 6px 8px;
                background: rgba(255,0,0,0.1);
                border-left: 3px solid #ff6b6b;
                border-radius: 3px;
                margin-bottom: 4px;
                font-size: 0.85em;
              }
              .error-time {
                color: #ff6b6b;
                font-weight: bold;
              }
              .error-message {
                color: #aaa;
                margin-top: 2px;
              }
              .init-error {
                margin-top: 16px;
                padding: 12px;
                background: rgba(255,0,0,0.1);
                border-left: 3px solid #ff6b6b;
                border-radius: 4px;
              }
              .info-box {
                margin-top: 16px;
                padding: 12px;
                background: rgba(100,150,255,0.1);
                border-left: 3px solid #6496ff;
                border-radius: 4px;
              }
              .info-text {
                margin-top: 6px;
                color: #aaa;
                font-size: 0.9em;
              }
            </style>

            <div class="widget-panel">
              <h3>⚯ Pyodide Runtime</h3>

              <div class="controls">
                <button class="list-packages">⛝ List Packages</button>
                <button class="reset-stats">↻ Reset Stats</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Status</div>
                  <div class="stat-value ${isReady ? 'ready' : (initError ? 'error' : 'warning')}">${statusText}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Executions</div>
                  <div class="stat-value">${_executionCount}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Packages</div>
                  <div class="stat-value">${_installedPackages.length}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">File Syncs</div>
                  <div class="stat-value">${_fileSyncCount}</div>
                </div>
              </div>

              ${_installedPackages.length > 0 ? `
                <h4>⛝ Installed Packages</h4>
                <div class="package-list">
                  ${_installedPackages.map(pkg => `<div class="package-item">${pkg}</div>`).join('')}
                </div>
              ` : ''}

              ${_executionErrors.length > 0 ? `
                <h4>⚠️ Recent Errors (${_executionErrors.length})</h4>
                <div class="error-list">
                  ${_executionErrors.slice().reverse().map(err => `
                    <div class="error-item">
                      <div class="error-time">${formatTime(err.timestamp)}</div>
                      <div class="error-message">${err.error.substring(0, 100)}${err.error.length > 100 ? '...' : ''}</div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              ${initError ? `
                <div class="init-error">
                  <strong style="color: #ff6b6b;">⚠️ Initialization Error</strong>
                  <div class="info-text">${initError.message}</div>
                </div>
              ` : ''}

              <div class="info-box">
                <strong>ℹ️ Python Runtime</strong>
                <div class="info-text">
                  WebAssembly-based Python runtime via Pyodide.<br>
                  Last execution: ${formatTime(_lastExecutionTime)}
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.list-packages')?.addEventListener('click', async () => {
            if (!isReady) return;
            const result = await getPackages();
            console.log('[PyodideRuntime] Installed packages:', result);
            logger.info('[PyodideRuntime] Widget: Package list logged to console');
          });

          this.shadowRoot.querySelector('.reset-stats')?.addEventListener('click', () => {
            _executionCount = 0;
            _packageInstallCount = 0;
            _fileSyncCount = 0;
            _lastExecutionTime = null;
            _executionErrors = [];
            logger.info('[PyodideRuntime] Widget: Stats reset');
            this.render();
          });
        }
      }

      if (!customElements.get('pyodide-runtime-widget')) {
        customElements.define('pyodide-runtime-widget', PyodideRuntimeWidget);
      }

      return {
        element: 'pyodide-runtime-widget',
        displayName: 'Pyodide Runtime',
        icon: '⚯',
        category: 'runtime',
        updateInterval: 3000
      };
    })();

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
      },
      widget
    };
  }
};

// Export standardized module
export default PyodideRuntime;
