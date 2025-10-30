// @blueprint 0x000077 - Config MCP Server for REPLOID
/**
 * Config MCP Server
 *
 * Exposes REPLOID Configuration operations via MCP
 * Enables agents to query configuration values, personas, upgrades, and permissions
 *
 * Available Tools:
 * - get_config - Get configuration value by path
 * - get_all_config - Get entire configuration object
 * - get_metadata - Get configuration metadata
 * - get_persona - Get persona configuration by ID
 * - get_upgrade - Get upgrade configuration by ID
 * - get_blueprint - Get blueprint configuration by ID
 * - check_tool_permission - Check permission rule for a tool
 * - get_server_config - Get server configuration
 * - get_api_config - Get API configuration
 * - get_ollama_config - Get Ollama configuration
 */

const ConfigMCPServer = {
  metadata: {
    id: 'ConfigMCPServer',
    version: '1.0.0',
    description: 'Configuration management operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'Config', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, Config, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ConfigMCPServer] Initializing Config MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'config',
      version: '1.0.0',
      description: 'REPLOID Configuration - query settings, personas, upgrades, and permissions',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // CONFIGURATION ACCESS
        // =================================================================
        {
          name: 'get_config',
          schema: {
            description: 'Get a configuration value by dot-separated path',
            properties: {
              path: {
                type: 'string',
                description: 'Dot-separated path (e.g., "providers.default", "curatorMode.enabled")'
              },
              default_value: {
                description: 'Optional default value if path not found'
              }
            },
            required: ['path']
          },
          handler: async (args) => {
            const { path, default_value } = args;

            const value = Config.get(path, default_value);

            if (value === undefined) {
              return {
                success: false,
                error: `Configuration path not found: ${path}`
              };
            }

            return {
              success: true,
              path,
              value
            };
          }
        },

        {
          name: 'get_all_config',
          schema: {
            description: 'Get the entire configuration object (read-only)',
            properties: {}
          },
          handler: async () => {
            const config = Config.getAll();

            if (!config) {
              return {
                success: false,
                error: 'Configuration not yet loaded'
              };
            }

            return {
              success: true,
              config
            };
          }
        },

        {
          name: 'get_metadata',
          schema: {
            description: 'Get configuration metadata (status, counts, load time)',
            properties: {}
          },
          handler: async () => {
            const metadata = Config.getMetadata();

            return {
              success: true,
              metadata
            };
          }
        },

        // =================================================================
        // PERSONA/UPGRADE/BLUEPRINT QUERIES
        // =================================================================
        {
          name: 'get_persona',
          schema: {
            description: 'Get persona configuration by ID',
            properties: {
              persona_id: {
                type: 'string',
                description: 'Persona identifier (e.g., "SENTINEL", "CURATOR")'
              }
            },
            required: ['persona_id']
          },
          handler: async (args) => {
            const { persona_id } = args;

            const persona = Config.getPersona(persona_id);

            if (!persona) {
              return {
                success: false,
                error: `Persona not found: ${persona_id}`
              };
            }

            return {
              success: true,
              persona
            };
          }
        },

        {
          name: 'get_upgrade',
          schema: {
            description: 'Get upgrade configuration by ID',
            properties: {
              upgrade_id: {
                type: 'string',
                description: 'Upgrade identifier (e.g., "APPL", "UTIL", "VISU")'
              }
            },
            required: ['upgrade_id']
          },
          handler: async (args) => {
            const { upgrade_id } = args;

            const upgrade = Config.getUpgrade(upgrade_id);

            if (!upgrade) {
              return {
                success: false,
                error: `Upgrade not found: ${upgrade_id}`
              };
            }

            return {
              success: true,
              upgrade
            };
          }
        },

        {
          name: 'get_blueprint',
          schema: {
            description: 'Get blueprint configuration by ID',
            properties: {
              blueprint_id: {
                type: 'string',
                description: 'Blueprint identifier (e.g., "0x000001", "0x00004A")'
              }
            },
            required: ['blueprint_id']
          },
          handler: async (args) => {
            const { blueprint_id } = args;

            const blueprint = Config.getBlueprint(blueprint_id);

            if (!blueprint) {
              return {
                success: false,
                error: `Blueprint not found: ${blueprint_id}`
              };
            }

            return {
              success: true,
              blueprint
            };
          }
        },

        // =================================================================
        // PERMISSION CHECKING
        // =================================================================
        {
          name: 'check_tool_permission',
          schema: {
            description: 'Check permission rule for a specific tool',
            properties: {
              tool_name: {
                type: 'string',
                description: 'Tool name (e.g., "read", "write", "bash")'
              }
            },
            required: ['tool_name']
          },
          handler: async (args) => {
            const { tool_name } = args;

            const permission = Config.getPermission(tool_name);

            if (!permission) {
              return {
                success: true,
                tool_name,
                rule: 'not_configured',
                allowed: false,
                requires_confirmation: true,
                denied: false
              };
            }

            return {
              success: true,
              tool_name,
              rule: permission.rule,
              allowed: Config.isToolAllowed(tool_name),
              requires_confirmation: Config.isToolAsk(tool_name),
              denied: Config.isToolDenied(tool_name),
              permission
            };
          }
        },

        // =================================================================
        // SECTION GETTERS
        // =================================================================
        {
          name: 'get_server_config',
          schema: {
            description: 'Get server configuration (port, host, CORS origins)',
            properties: {}
          },
          handler: async () => {
            const serverConfig = Config.getServer();

            return {
              success: true,
              server: serverConfig
            };
          }
        },

        {
          name: 'get_api_config',
          schema: {
            description: 'Get API configuration (provider, timeout, retries)',
            properties: {}
          },
          handler: async () => {
            const apiConfig = Config.getApi();

            return {
              success: true,
              api: apiConfig
            };
          }
        },

        {
          name: 'get_ollama_config',
          schema: {
            description: 'Get Ollama configuration (autoStart, defaultModel, temperature)',
            properties: {}
          },
          handler: async () => {
            const ollamaConfig = Config.getOllama();

            return {
              success: true,
              ollama: ollamaConfig
            };
          }
        },

        {
          name: 'get_ui_config',
          schema: {
            description: 'Get UI configuration (theme, advanced logs, update interval)',
            properties: {}
          },
          handler: async () => {
            const uiConfig = Config.getUi();

            return {
              success: true,
              ui: uiConfig
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[ConfigMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default ConfigMCPServer;
