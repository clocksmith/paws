// @blueprint 0x000078 - Introspector MCP Server for REPLOID
/**
 * Introspector MCP Server
 *
 * Exposes REPLOID self-analysis and introspection capabilities via MCP
 * Enables agents to understand their own architecture, dependencies, and capabilities
 *
 * Available Tools:
 * - get_module_graph - Get module dependency graph with statistics
 * - get_tool_catalog - List all available read/write tools
 * - analyze_module - Analyze code complexity and patterns for a specific module
 * - get_capabilities - Detect browser and runtime capabilities
 * - generate_self_report - Generate comprehensive self-analysis markdown report
 * - clear_cache - Clear introspection caches
 */

const IntrospectorMCPServer = {
  metadata: {
    id: 'IntrospectorMCPServer',
    version: '1.0.0',
    description: 'Self-analysis and introspection operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'Introspector', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, Introspector, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[IntrospectorMCPServer] Initializing Introspector MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'introspector',
      version: '1.0.0',
      description: 'REPLOID Self-Analysis - understand module architecture, dependencies, tools, and capabilities',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // MODULE ARCHITECTURE
        // =================================================================
        {
          name: 'get_module_graph',
          schema: {
            description: 'Get the complete module dependency graph with statistics',
            properties: {}
          },
          handler: async () => {
            const graph = await Introspector.getModuleGraph();

            if (graph.error) {
              return {
                success: false,
                error: graph.error
              };
            }

            return {
              success: true,
              graph: {
                modules: graph.modules,
                edges: graph.edges,
                statistics: graph.statistics
              }
            };
          }
        },

        {
          name: 'list_modules',
          schema: {
            description: 'List all loaded modules with basic information',
            properties: {
              category: {
                type: 'string',
                description: 'Optional: filter by category (e.g., "core", "ui", "llm")'
              }
            }
          },
          handler: async (args) => {
            const { category } = args;

            const graph = await Introspector.getModuleGraph();

            if (graph.error) {
              return {
                success: false,
                error: graph.error
              };
            }

            let modules = graph.modules;

            // Filter by category if specified
            if (category) {
              modules = modules.filter(m => m.category === category);
            }

            return {
              success: true,
              modules: modules.map(m => ({
                id: m.id,
                path: m.path,
                description: m.description,
                category: m.category,
                version: m.version,
                type: m.type,
                dependencyCount: m.dependencies.length
              })),
              totalCount: modules.length
            };
          }
        },

        {
          name: 'get_module_dependencies',
          schema: {
            description: 'Get dependency information for a specific module',
            properties: {
              module_id: {
                type: 'string',
                description: 'Module identifier (e.g., "Config", "StateManager")'
              }
            },
            required: ['module_id']
          },
          handler: async (args) => {
            const { module_id } = args;

            const graph = await Introspector.getModuleGraph();

            if (graph.error) {
              return {
                success: false,
                error: graph.error
              };
            }

            const module = graph.modules.find(m => m.id === module_id);

            if (!module) {
              return {
                success: false,
                error: `Module not found: ${module_id}`
              };
            }

            // Find modules that depend on this module (reverse dependencies)
            const dependents = graph.edges
              .filter(e => e.to === module_id)
              .map(e => e.from);

            return {
              success: true,
              module: {
                id: module.id,
                path: module.path,
                dependencies: module.dependencies,
                dependents: dependents,
                dependencyCount: module.dependencies.length,
                dependentCount: dependents.length
              }
            };
          }
        },

        // =================================================================
        // CODE ANALYSIS
        // =================================================================
        {
          name: 'analyze_module',
          schema: {
            description: 'Analyze code complexity, patterns, TODOs, and metrics for a specific file',
            properties: {
              file_path: {
                type: 'string',
                description: 'File path to analyze (e.g., "/upgrades/core/config.js")'
              }
            },
            required: ['file_path']
          },
          handler: async (args) => {
            const { file_path } = args;

            const analysis = await Introspector.analyzeOwnCode(file_path);

            if (analysis.error) {
              return {
                success: false,
                error: analysis.error
              };
            }

            return {
              success: true,
              analysis
            };
          }
        },

        // =================================================================
        // TOOL CATALOG
        // =================================================================
        {
          name: 'get_tool_catalog',
          schema: {
            description: 'Get catalog of all available read and write tools',
            properties: {
              category: {
                type: 'string',
                description: 'Optional: filter by category ("read" or "write")',
                enum: ['read', 'write']
              }
            }
          },
          handler: async (args) => {
            const { category } = args;

            const catalog = await Introspector.getToolCatalog();

            let result = {
              success: true,
              statistics: catalog.statistics
            };

            if (!category || category === 'read') {
              result.readTools = catalog.readTools;
            }

            if (!category || category === 'write') {
              result.writeTools = catalog.writeTools;
            }

            return result;
          }
        },

        // =================================================================
        // CAPABILITIES
        // =================================================================
        {
          name: 'get_capabilities',
          schema: {
            description: 'Detect browser and runtime capabilities (WebGPU, WebAssembly, IndexedDB, etc.)',
            properties: {}
          },
          handler: async () => {
            const capabilities = Introspector.getCapabilities();

            return {
              success: true,
              capabilities
            };
          }
        },

        // =================================================================
        // SELF-REPORT
        // =================================================================
        {
          name: 'generate_self_report',
          schema: {
            description: 'Generate a comprehensive self-analysis markdown report',
            properties: {}
          },
          handler: async () => {
            const report = await Introspector.generateSelfReport();

            return {
              success: true,
              report,
              format: 'markdown'
            };
          }
        },

        // =================================================================
        // CACHE MANAGEMENT
        // =================================================================
        {
          name: 'clear_cache',
          schema: {
            description: 'Clear all introspection caches (module graph, tool catalog, capabilities)',
            properties: {}
          },
          handler: async () => {
            Introspector.clearCache();

            return {
              success: true,
              message: 'All introspection caches cleared'
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[IntrospectorMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default IntrospectorMCPServer;
