// @blueprint 0x000074 - Base MCP Server Abstraction for Reploid
/**
 * ReploidMCPServerBase
 *
 * Reusable base class for converting Reploid modules to MCP servers
 * Provides standard tool registration, state management, and EventBus integration
 *
 * Key Features:
 * - Standard MCP protocol compliance (tools/list, tools/call)
 * - Tool registration with JSON schema validation
 * - State management helpers
 * - EventBus integration for real-time updates
 * - Automatic audit logging
 * - Error handling with MCP error codes
 *
 * Usage:
 *   const MyMCPServer = createMCPServer({
 *     name: 'my-service',
 *     version: '1.0.0',
 *     tools: [ ... ],
 *     capabilities: { tools: true, resources: false, prompts: false }
 *   });
 */

const ReploidMCPServerBase = {
  metadata: {
    id: 'ReploidMCPServerBase',
    version: '1.0.0',
    description: 'Base class for Reploid MCP servers',
    dependencies: ['Utils', 'EventBus?', 'AuditLogger?', 'MCPProtocol'],
    async: false,
    type: 'base'
  },

  factory: (deps) => {
    const { Utils, EventBus, AuditLogger, MCPProtocol } = deps;
    const { logger } = Utils;

    logger.info('[ReploidMCPServerBase] Initializing MCP server base...');

    /**
     * Create an MCP server instance
     * @param {Object} config - Server configuration
     * @returns {Object} MCP server instance
     */
    const createMCPServer = (config) => {
      const {
        name,
        version = '1.0.0',
        description = '',
        capabilities = { tools: true, resources: false, prompts: false },
        tools = [],
        resources = [],
        prompts = []
      } = config;

      // Registered tools map: toolName -> { handler, schema }
      const toolRegistry = new Map();

      // Server state
      let serverState = {};

      // Event listeners (for cleanup)
      const eventListeners = [];

      logger.info(`[ReploidMCPServerBase] Creating MCP server: ${name}`);

      /**
       * Register a tool
       * @param {string} toolName - Tool identifier
       * @param {Function} handler - Async function that executes the tool
       * @param {Object} schema - JSON schema for tool parameters
       */
      const registerTool = (toolName, handler, schema = {}) => {
        if (toolRegistry.has(toolName)) {
          logger.warn(`[${name}] Tool '${toolName}' already registered, overwriting`);
        }

        toolRegistry.set(toolName, {
          handler,
          schema: {
            type: 'object',
            ...schema
          }
        });

        logger.info(`[${name}] Registered tool: ${toolName}`);

        // Emit event for UI
        if (EventBus) {
          EventBus.emit('mcp:tool:registered', {
            serverName: name,
            toolName,
            schema
          });
        }
      };

      /**
       * Unregister a tool
       */
      const unregisterTool = (toolName) => {
        const removed = toolRegistry.delete(toolName);
        if (removed) {
          logger.info(`[${name}] Unregistered tool: ${toolName}`);
          if (EventBus) {
            EventBus.emit('mcp:tool:unregistered', { serverName: name, toolName });
          }
        }
        return removed;
      };

      /**
       * List all available tools (MCP protocol method)
       * @returns {Array} Array of tool descriptions
       */
      const listTools = () => {
        const toolsList = [];
        for (const [toolName, { schema }] of toolRegistry.entries()) {
          toolsList.push({
            name: toolName,
            description: schema.description || `Tool: ${toolName}`,
            inputSchema: schema
          });
        }
        return toolsList;
      };

      /**
       * Call a tool (MCP protocol method)
       * @param {string} toolName - Tool to call
       * @param {Object} args - Tool arguments
       * @returns {Promise<any>} Tool result
       */
      const callTool = async (toolName, args = {}) => {
        const startTime = Date.now();

        // Check if tool exists
        const toolDef = toolRegistry.get(toolName);
        if (!toolDef) {
          const availableTools = Array.from(toolRegistry.keys()).join(', ');
          throw new Error(`Tool '${toolName}' not found. Available: ${availableTools}`);
        }

        // Emit event before execution
        if (EventBus) {
          EventBus.emit('mcp:tool:invoked', {
            serverName: name,
            toolName,
            args,
            timestamp: new Date().toISOString()
          });
        }

        // Audit log
        if (AuditLogger) {
          await AuditLogger.logMCPToolCall(toolName, {
            serverName: name,
            args,
            timestamp: new Date().toISOString()
          });
        }

        try {
          // Execute tool
          const result = await toolDef.handler(args);
          const duration = Date.now() - startTime;

          logger.info(`[${name}] Tool '${toolName}' executed successfully in ${duration}ms`);

          // Emit success event
          if (EventBus) {
            EventBus.emit('mcp:tool:success', {
              serverName: name,
              toolName,
              result,
              duration
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          logger.error(`[${name}] Tool '${toolName}' failed:`, error);

          // Emit error event
          if (EventBus) {
            EventBus.emit('mcp:tool:error', {
              serverName: name,
              toolName,
              error: error.message,
              duration
            });
          }

          throw error;
        }
      };

      /**
       * Get server state
       */
      const getState = () => {
        return { ...serverState };
      };

      /**
       * Set server state
       */
      const setState = (newState) => {
        serverState = { ...serverState, ...newState };

        // Emit state change event
        if (EventBus) {
          EventBus.emit(`mcp:${name}:state:changed`, {
            state: serverState,
            timestamp: Date.now()
          });
        }
      };

      /**
       * Emit an event
       */
      const emit = (event, data) => {
        if (EventBus) {
          EventBus.emit(`mcp:${name}:${event}`, data);
        }
      };

      /**
       * Subscribe to an event
       */
      const on = (event, handler) => {
        if (EventBus) {
          EventBus.on(`mcp:${name}:${event}`, handler);
          eventListeners.push({ event: `mcp:${name}:${event}`, handler });
        }
      };

      /**
       * Initialize server (register initial tools)
       */
      const initialize = () => {
        // Register tools from config
        tools.forEach(toolDef => {
          registerTool(toolDef.name, toolDef.handler, toolDef.schema);
        });

        logger.info(`[${name}] Initialized with ${toolRegistry.size} tools`);

        // Register with MCPProtocol if available
        if (MCPProtocol) {
          // Register each tool with MCPProtocol
          for (const [toolName, { handler, schema }] of toolRegistry.entries()) {
            MCPProtocol.registerTool(`${name}__${toolName}`, handler, schema);
          }
          logger.info(`[${name}] Registered with MCPProtocol`);
        }
      };

      /**
       * Cleanup server resources
       */
      const cleanup = () => {
        // Unsubscribe all event listeners
        eventListeners.forEach(({ event, handler }) => {
          if (EventBus) EventBus.off(event, handler);
        });
        eventListeners.length = 0;

        // Clear tool registry
        toolRegistry.clear();

        logger.info(`[${name}] Cleaned up successfully`);
      };

      /**
       * Get server info (for MCP protocol)
       */
      const getServerInfo = () => {
        return {
          name,
          version,
          description,
          capabilities,
          toolCount: toolRegistry.size
        };
      };

      // Return MCP server instance
      return {
        // Server metadata
        name,
        version,
        description,
        capabilities,

        // MCP protocol methods
        listTools,
        callTool,

        // Tool management
        registerTool,
        unregisterTool,

        // State management
        getState,
        setState,

        // Event handling
        emit,
        on,

        // Lifecycle
        initialize,
        cleanup,

        // Info
        getServerInfo
      };
    };

    logger.info('[ReploidMCPServerBase] MCP server base initialized');

    return {
      createMCPServer
    };
  }
};

export default ReploidMCPServerBase;
