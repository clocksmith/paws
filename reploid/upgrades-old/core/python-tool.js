/**
 * @fileoverview Python Tool for REPLOID Agent
 * Provides a tool interface for executing Python code via Pyodide.
 * Allows the agent to run Python scripts, install packages, and manage files.
 *
 * @blueprint 0x000031 - Defines the Python tooling interface.
 * @module PythonTool
 * @version 1.0.0
 * @category tool
 */

const PythonTool = {
  metadata: {
    id: 'PythonTool',
    version: '1.0.0',
    dependencies: ['Utils', 'PyodideRuntime'],
    async: true,
    type: 'tool'
  },

  factory: (deps) => {
    const { Utils, PyodideRuntime } = deps;
    const { logger } = Utils;

    // Widget tracking
    let _executionCount = 0;
    let _lastExecutionTime = null;
    let _packageInstalls = 0;

    /**
     * Tool declaration for LLM
     * Defines the function signature and parameters
     */
    const toolDeclaration = {
      name: 'execute_python',
      description: 'Execute Python code in a secure WebAssembly sandbox. ' +
                   'Use this to run data analysis, scientific computing, or any Python code. ' +
                   'The environment includes NumPy, Pandas, and other scientific packages. ' +
                   'Files in the workspace are accessible via the filesystem.',
      parameters: {
        type: 'object',
        properties: {
          code: {
            type: 'string',
            description: 'The Python code to execute'
          },
          install_packages: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional list of packages to install before execution (e.g., ["matplotlib", "scipy"])'
          },
          sync_workspace: {
            type: 'boolean',
            description: 'Whether to sync workspace files to Python environment before execution (default: false)'
          }
        },
        required: ['code']
      }
    };

    /**
     * Execute Python code tool
     */
    const executePython = async (args) => {
      try {
        const { code, install_packages = [], sync_workspace = false } = args;

        logger.info('[PythonTool] Executing Python code', {
          codeLength: code.length,
          packages: install_packages.length,
          syncWorkspace: sync_workspace
        });

        // Check if Pyodide is ready
        if (!PyodideRuntime.isReady()) {
          return {
            success: false,
            error: 'Python runtime not initialized. Please wait for initialization to complete.'
          };
        }

        // Install packages if requested
        for (const pkg of install_packages) {
          logger.info('[PythonTool] Installing package:', pkg);
          const result = await PyodideRuntime.installPackage(pkg);

          if (!result.success) {
            return {
              success: false,
              error: `Failed to install package ${pkg}: ${result.error}`
            };
          }
        }

        // Sync workspace if requested
        if (sync_workspace) {
          logger.info('[PythonTool] Syncing workspace to Python environment');
          await PyodideRuntime.syncWorkspace();
        }

        // Execute the code
        const result = await PyodideRuntime.execute(code);

        // Track execution
        _executionCount++;
        _lastExecutionTime = Date.now();
        _packageInstalls += install_packages.length;

        // Format response
        if (result.success) {
          return {
            success: true,
            result: result.result,
            stdout: result.stdout,
            stderr: result.stderr,
            executionTime: result.executionTime
          };
        } else {
          return {
            success: false,
            error: result.error,
            traceback: result.traceback,
            stderr: result.stderr
          };
        }

      } catch (error) {
        logger.error('[PythonTool] Execution failed:', error);

        return {
          success: false,
          error: error.message,
          stack: error.stack
        };
      }
    };

    /**
     * Install package tool
     */
    const installPackageTool = async (args) => {
      try {
        const { package: packageName } = args;

        logger.info('[PythonTool] Installing package:', packageName);

        if (!PyodideRuntime.isReady()) {
          return {
            success: false,
            error: 'Python runtime not initialized'
          };
        }

        const result = await PyodideRuntime.installPackage(packageName);

        return result;

      } catch (error) {
        logger.error('[PythonTool] Package installation failed:', error);

        return {
          success: false,
          error: error.message
        };
      }
    };

    /**
     * List Python packages tool
     */
    const listPackagesTool = async () => {
      try {
        if (!PyodideRuntime.isReady()) {
          return {
            success: false,
            error: 'Python runtime not initialized'
          };
        }

        const result = await PyodideRuntime.getPackages();

        return result;

      } catch (error) {
        logger.error('[PythonTool] List packages failed:', error);

        return {
          success: false,
          error: error.message
        };
      }
    };

    /**
     * Get all tool declarations
     */
    const getToolDeclarations = () => {
      return [
        toolDeclaration,
        {
          name: 'install_python_package',
          description: 'Install a Python package using micropip. ' +
                       'Use this to add libraries like matplotlib, scipy, requests, etc.',
          parameters: {
            type: 'object',
            properties: {
              package: {
                type: 'string',
                description: 'Package name to install (e.g., "matplotlib", "scipy")'
              }
            },
            required: ['package']
          }
        },
        {
          name: 'list_python_packages',
          description: 'List all installed Python packages in the runtime',
          parameters: {
            type: 'object',
            properties: {}
          }
        }
      ];
    };

    /**
     * Execute tool by name
     */
    const executeTool = async (toolName, args) => {
      switch (toolName) {
        case 'execute_python':
          return await executePython(args);

        case 'install_python_package':
          return await installPackageTool(args);

        case 'list_python_packages':
          return await listPackagesTool();

        default:
          return {
            success: false,
            error: `Unknown tool: ${toolName}`
          };
      }
    };

    // Expose stats for widget
    const getStats = () => ({
      executionCount: _executionCount,
      packageInstalls: _packageInstalls,
      lastExecutionTime: _lastExecutionTime
    });

    const resetStats = () => {
      _executionCount = 0;
      _packageInstalls = 0;
      _lastExecutionTime = null;
    };

    return {
      init: async () => {
        logger.info('[PythonTool] Python tool initialized');
        return true;
      },
      api: {
        getToolDeclarations,
        executeTool,
        executePython,
        installPackage: installPackageTool,
        listPackages: listPackagesTool,
        getStats,
        resetStats
      },

      widget: {
        element: 'python-tool-widget',
        displayName: 'Python Tool',
        icon: '◊',
        category: 'tools',
        updateInterval: 2000
      }
    };
  }
};

// Web Component for Python Tool Widget
class PythonToolWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();

    // Auto-refresh
    if (this.updateInterval) {
      this._interval = setInterval(() => this.render(), this.updateInterval);
    }
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    // Get PyodideRuntime reference
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._pyodideRuntime = window.DIContainer.resolve('PyodideRuntime');
    }
    this.render();
  }

  set updateInterval(interval) {
    this._updateInterval = interval;
  }

  get updateInterval() {
    return this._updateInterval || 2000;
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const stats = this._api.getStats();
    const isReady = this._pyodideRuntime?.isReady?.() || false;

    return {
      state: isReady ? (stats.executionCount > 0 ? 'active' : 'idle') : 'warning',
      primaryMetric: `${stats.executionCount} executions`,
      secondaryMetric: isReady ? 'Ready' : 'Initializing',
      lastActivity: stats.lastExecutionTime
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const stats = this._api.getStats();
    const isReady = this._pyodideRuntime?.isReady?.() || false;
    const pyodideState = this._pyodideRuntime?.getState?.() || {};

    const formatTimeAgo = (timestamp) => {
      if (!timestamp) return 'Never';
      const diff = Date.now() - timestamp;
      if (diff < 1000) return 'Just now';
      if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
      if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
      return `${Math.floor(diff/3600000)}h ago`;
    };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
          color: #4fc3f7;
        }

        .tool-item {
          padding: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
          margin-bottom: 8px;
        }

        .tool-item strong {
          color: #4fc3f7;
        }

        .packages-list {
          max-height: 150px;
          overflow-y: auto;
        }

        .package-item {
          padding: 4px;
          background: rgba(255,255,255,0.05);
          border-radius: 3px;
          margin-bottom: 3px;
          font-size: 0.9em;
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        button {
          background: rgba(100,150,255,0.3);
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 6px 12px;
          font-size: 0.9em;
          margin-top: 12px;
        }

        button:hover {
          background: rgba(100,150,255,0.5);
        }
      </style>

      <div class="python-tool-panel">
        <h4>◊ Python Tool</h4>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Status</div>
            <div class="stat-value" style="color: ${isReady ? '#0c0' : '#f90'};">${isReady ? 'Ready' : 'Loading'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Executions</div>
            <div class="stat-value">${stats.executionCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Packages Installed</div>
            <div class="stat-value">${stats.packageInstalls}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Last Execution</div>
            <div class="stat-value" style="font-size: 0.9em;">${formatTimeAgo(stats.lastExecutionTime)}</div>
          </div>
        </div>

        <h5>Available Tools</h5>
        <div class="tools-list">
          <div class="tool-item">
            <strong>execute_python</strong>
            <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
              Execute Python code in WebAssembly sandbox with NumPy, Pandas support
            </div>
          </div>
          <div class="tool-item">
            <strong>install_python_package</strong>
            <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
              Install Python packages from PyPI
            </div>
          </div>
          <div class="tool-item">
            <strong>list_python_packages</strong>
            <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
              List all installed Python packages
            </div>
          </div>
        </div>

        ${pyodideState.installedPackages && pyodideState.installedPackages.length > 0 ? `
          <h5>Installed Packages (${pyodideState.installedPackages.length})</h5>
          <div class="packages-list">
            ${pyodideState.installedPackages.slice(0, 20).map(pkg => `
              <div class="package-item">${pkg}</div>
            `).join('')}
            ${pyodideState.installedPackages.length > 20 ? `
              <div style="color: #888; font-size: 0.9em; margin-top: 8px;">
                ... and ${pyodideState.installedPackages.length - 20} more
              </div>
            ` : ''}
          </div>
        ` : ''}

        <div class="info-panel">
          <strong>ⓘ Python Tool</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Provides Python execution capabilities via Pyodide WebAssembly runtime.
            Supports scientific computing packages and workspace file access.
          </div>
        </div>

        <button id="reset-stats">↻ Reset Stats</button>
      </div>
    `;

    // Attach event listeners
    const resetBtn = this.shadowRoot.getElementById('reset-stats');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this._api.resetStats();
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        ToastNotifications?.show?.('Python tool stats reset', 'success');
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('python-tool-widget')) {
  customElements.define('python-tool-widget', PythonToolWidget);
}

// Export standardized module
export default PythonTool;
