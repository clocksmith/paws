/**
 * @fileoverview Python Tool for REPLOID Agent
 * Provides a tool interface for executing Python code via Pyodide.
 * Allows the agent to run Python scripts, install packages, and manage files.
 *
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
        listPackages: listPackagesTool
      }
    };
  }
};

// Export standardized module
PythonTool;
