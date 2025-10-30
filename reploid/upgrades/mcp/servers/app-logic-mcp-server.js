// @blueprint 0x000087 - AppLogic MCP Server for REPLOID
/**
 * AppLogic MCP Server
 *
 * Exposes boot orchestration and system state via MCP
 * Provides access to boot statistics and genesis context
 *
 * Available Tools:
 * - get_boot_info - Get boot statistics and module load info
 * - get_boot_timeline - Get module load timeline
 * - get_module_errors - Get module loading errors
 * - get_genesis_state - Get genesis context (birth state)
 * - validate_system - Check if system is operational
 */

const AppLogicMCPServer = {
  metadata: {
    id: 'AppLogicMCPServer',
    version: '1.0.0',
    description: 'Boot orchestration and system state via MCP',
    dependencies: ['ReploidMCPServerBase', 'AppLogic', 'SimpleVFS', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, AppLogic, SimpleVFS, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[AppLogicMCPServer] Initializing AppLogic MCP Server...');

    const server = createMCPServer({
      name: 'app-logic',
      version: '1.0.0',
      description: 'REPLOID AppLogic - boot orchestration and system state',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'get_boot_info',
          schema: {
            description: 'Get boot statistics including duration, modules loaded, and status',
            properties: {}
          },
          handler: async () => {
            try {
              const bootStats = AppLogic.getBootStats();

              return {
                success: true,
                bootInfo: {
                  status: bootStats.status,
                  startTime: bootStats.startTime,
                  endTime: bootStats.endTime,
                  totalDuration: bootStats.totalDuration,
                  totalDurationSec: bootStats.totalDuration ? (bootStats.totalDuration / 1000).toFixed(2) : null,
                  modulesLoadedCount: bootStats.modulesLoaded.length,
                  moduleErrorsCount: bootStats.moduleErrors.length
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get boot info'
              };
            }
          }
        },

        {
          name: 'get_boot_timeline',
          schema: {
            description: 'Get detailed module load timeline with timestamps',
            properties: {
              limit: {
                type: 'number',
                description: 'Optional: limit number of results (default: all)'
              }
            }
          },
          handler: async (args) => {
            const { limit } = args;

            try {
              const bootStats = AppLogic.getBootStats();

              let modulesLoaded = [...bootStats.modulesLoaded];
              if (limit && limit > 0) {
                modulesLoaded = modulesLoaded.slice(0, limit);
              }

              // Calculate relative times
              const timeline = modulesLoaded.map(mod => ({
                id: mod.id,
                path: mod.path,
                loadTime: mod.loadTime,
                timestamp: mod.timestamp,
                relativeTime: bootStats.startTime ? ((mod.timestamp - bootStats.startTime) / 1000).toFixed(2) : null
              }));

              // Calculate average load time
              const avgLoadTime = modulesLoaded.length > 0
                ? (modulesLoaded.reduce((sum, m) => sum + m.loadTime, 0) / modulesLoaded.length).toFixed(2)
                : 0;

              return {
                success: true,
                timeline,
                count: timeline.length,
                totalModules: bootStats.modulesLoaded.length,
                avgLoadTime: parseFloat(avgLoadTime)
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get boot timeline'
              };
            }
          }
        },

        {
          name: 'get_module_errors',
          schema: {
            description: 'Get list of module loading errors',
            properties: {}
          },
          handler: async () => {
            try {
              const bootStats = AppLogic.getBootStats();

              const errors = bootStats.moduleErrors.map(err => ({
                path: err.path,
                error: err.error,
                timestamp: err.timestamp,
                stack: err.stack
              }));

              return {
                success: true,
                errors,
                count: errors.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get module errors'
              };
            }
          }
        },

        {
          name: 'get_genesis_state',
          schema: {
            description: 'Get genesis context (birth state catalog)',
            properties: {
              format: {
                type: 'string',
                description: 'Format: "json" or "markdown" (default: json)',
                default: 'json'
              }
            }
          },
          handler: async (args) => {
            const { format = 'json' } = args;

            try {
              // Determine which genesis file to read
              const genesisPath = format === 'markdown'
                ? '/system/genesis-context.md'
                : '/system/genesis-context.json';

              // Read genesis context from VFS
              const exists = await SimpleVFS.fileExists(genesisPath);
              if (!exists) {
                return {
                  success: false,
                  error: `Genesis file not found: ${genesisPath}`,
                  suggestion: 'Genesis context may not have been created yet during boot'
                };
              }

              const content = await SimpleVFS.readFile(genesisPath);

              if (format === 'json') {
                const genesisData = JSON.parse(content);
                return {
                  success: true,
                  genesis: genesisData,
                  format: 'json'
                };
              } else {
                return {
                  success: true,
                  genesis: content,
                  format: 'markdown'
                };
              }
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get genesis state'
              };
            }
          }
        },

        {
          name: 'validate_system',
          schema: {
            description: 'Validate system is operational and check critical components',
            properties: {}
          },
          handler: async () => {
            try {
              const bootStats = AppLogic.getBootStats();

              // Check boot status
              const isBooted = bootStats.status === 'ready';
              const hasErrors = bootStats.moduleErrors.length > 0;
              const modulesLoaded = bootStats.modulesLoaded.length;

              // Check genesis files
              const genesisJsonExists = await SimpleVFS.fileExists('/system/genesis-context.json');
              const genesisMdExists = await SimpleVFS.fileExists('/system/genesis-context.md');

              // Determine overall system health
              const systemHealthy = isBooted && !hasErrors && modulesLoaded > 0;
              const genesisHealthy = genesisJsonExists && genesisMdExists;

              const warnings = [];
              const errors = [];

              if (!isBooted) {
                errors.push('System not fully booted');
              }

              if (hasErrors) {
                warnings.push(`${bootStats.moduleErrors.length} module loading errors detected`);
              }

              if (!genesisHealthy) {
                warnings.push('Genesis context files incomplete');
              }

              if (modulesLoaded === 0) {
                errors.push('No modules loaded - critical failure');
              }

              return {
                success: true,
                validation: {
                  overall: systemHealthy && genesisHealthy ? 'healthy' : (errors.length > 0 ? 'critical' : 'warning'),
                  boot: {
                    status: bootStats.status,
                    operational: isBooted,
                    modulesLoaded,
                    errors: bootStats.moduleErrors.length
                  },
                  genesis: {
                    jsonExists: genesisJsonExists,
                    markdownExists: genesisMdExists,
                    healthy: genesisHealthy
                  },
                  warnings,
                  errors
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to validate system'
              };
            }
          }
        },

        {
          name: 'get_slowest_modules',
          schema: {
            description: 'Get slowest loading modules sorted by load time',
            properties: {
              limit: {
                type: 'number',
                description: 'Number of modules to return (default: 10)',
                default: 10
              }
            }
          },
          handler: async (args) => {
            const { limit = 10 } = args;

            try {
              const bootStats = AppLogic.getBootStats();

              const sortedModules = [...bootStats.modulesLoaded]
                .sort((a, b) => b.loadTime - a.loadTime)
                .slice(0, limit);

              const slowestModules = sortedModules.map((mod, idx) => ({
                rank: idx + 1,
                id: mod.id,
                path: mod.path,
                loadTime: mod.loadTime,
                severity: mod.loadTime > 100 ? 'critical' : (mod.loadTime > 50 ? 'warning' : 'normal')
              }));

              return {
                success: true,
                slowestModules,
                count: slowestModules.length,
                totalModules: bootStats.modulesLoaded.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message || 'Failed to get slowest modules'
              };
            }
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[AppLogicMCPServer] Initialized with ${server.listTools().length} tools`);
    return server;
  }
};

export default AppLogicMCPServer;
