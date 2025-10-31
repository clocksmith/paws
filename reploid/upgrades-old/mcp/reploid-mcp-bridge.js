// @blueprint 0x000076 - MCP Bridge for REPLOID (Browser Client)
/**
 * ReploidMCPBridge
 *
 * Browser-side MCP client that implements the Lens MCPBridge interface.
 * Connects Lens widgets to Reploid's in-browser MCP servers.
 *
 * Key Features:
 * - Implements Lens MCPBridge interface
 * - Permission checking (bypass_confirmation)
 * - User approval workflows for tool calls
 * - EventBus integration for observability
 * - Audit logging for all MCP operations
 * - Timeout handling for confirmations
 *
 * Usage:
 *   const bridge = MCPBridge.createBridge(widgetMetadata);
 *   const result = await bridge.callTool('vfs', 'read_artifact', { path: '/foo' });
 *
 * Architecture:
 *   Widget → MCPBridge → (Approval?) → MCPRegistry → MCP Server → Tool Handler
 */

const ReploidMCPBridge = {
  metadata: {
    id: 'ReploidMCPBridge',
    version: '1.0.0',
    description: 'Browser MCP client for Lens widgets',
    dependencies: ['Utils', 'EventBus', 'ReploidMCPRegistry', 'AuditLogger?'],
    async: true,
    type: 'bridge'
  },

  factory: (deps) => {
    const { Utils, EventBus, ReploidMCPRegistry, AuditLogger } = deps;
    const { logger } = Utils;

    logger.info('[MCPBridge] Initializing MCP Bridge...');

    // Pending confirmations: confirmationId -> { resolve, reject, timeout }
    const pendingConfirmations = new Map();

    // Widget registry: widgetId -> { permissions, capabilities }
    const widgetRegistry = new Map();

    // Configuration
    const config = {
      confirmationTimeout: 60000, // 1 minute default
      auditAllOperations: true,
      strictPermissions: true
    };

    /**
     * Generate unique confirmation ID
     */
    const generateConfirmationId = () => {
      return `conf_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    };

    /**
     * Check if widget can bypass confirmation for a tool
     * @param {string} widgetId - Widget identifier
     * @param {string} toolName - Tool name to check
     * @returns {boolean} True if bypass allowed
     */
    const canBypassConfirmation = (widgetId, toolName) => {
      const widget = widgetRegistry.get(widgetId);
      if (!widget) return false;

      // Must have approval_workflows capability
      if (!widget.capabilities?.approval_workflows) {
        return false;
      }

      // Must have bypass_confirmation permission
      const bypassPatterns = widget.permissions?.bypass_confirmation;
      if (!bypassPatterns || bypassPatterns.length === 0) {
        return false;
      }

      // Check if tool matches any bypass patterns
      return bypassPatterns.some(pattern => {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        return regex.test(toolName);
      });
    };

    /**
     * Request user confirmation for tool call
     * @param {string} widgetId - Widget requesting the tool
     * @param {string} serverName - MCP server name
     * @param {string} toolName - Tool to call
     * @param {Object} args - Tool arguments
     * @returns {Promise<boolean>} True if approved
     */
    const requestConfirmation = async (widgetId, serverName, toolName, args) => {
      const confirmationId = generateConfirmationId();

      logger.info(`[MCPBridge] Requesting confirmation: ${serverName}__${toolName}`, {
        confirmationId,
        widgetId
      });

      // Emit confirmation request event
      EventBus.emit('mcp:tool:invoke-requested', {
        confirmationId,
        widgetId,
        serverName,
        toolName,
        arguments: args,
        timestamp: new Date().toISOString()
      });

      // Create confirmation promise
      return new Promise((resolve, reject) => {
        // Set timeout
        const timeout = setTimeout(() => {
          pendingConfirmations.delete(confirmationId);

          EventBus.emit('mcp:tool:confirmation-timeout', {
            confirmationId,
            serverName,
            toolName,
            timeout: config.confirmationTimeout
          });

          reject(new Error(`USER_TIMEOUT: Confirmation timed out after ${config.confirmationTimeout}ms`));
        }, config.confirmationTimeout);

        // Store pending confirmation
        pendingConfirmations.set(confirmationId, {
          resolve,
          reject,
          timeout,
          serverName,
          toolName,
          args
        });
      });
    };

    /**
     * Approve a pending confirmation
     * @param {string} confirmationId - Confirmation ID
     */
    const approveConfirmation = (confirmationId) => {
      const pending = pendingConfirmations.get(confirmationId);
      if (!pending) {
        logger.warn(`[MCPBridge] Unknown confirmation ID: ${confirmationId}`);
        return false;
      }

      clearTimeout(pending.timeout);
      pendingConfirmations.delete(confirmationId);

      logger.info(`[MCPBridge] Confirmation approved: ${confirmationId}`);
      pending.resolve(true);

      EventBus.emit('mcp:tool:confirmation-approved', {
        confirmationId,
        serverName: pending.serverName,
        toolName: pending.toolName
      });

      return true;
    };

    /**
     * Reject a pending confirmation
     * @param {string} confirmationId - Confirmation ID
     * @param {string} reason - Rejection reason
     */
    const rejectConfirmation = (confirmationId, reason = 'User rejected') => {
      const pending = pendingConfirmations.get(confirmationId);
      if (!pending) {
        logger.warn(`[MCPBridge] Unknown confirmation ID: ${confirmationId}`);
        return false;
      }

      clearTimeout(pending.timeout);
      pendingConfirmations.delete(confirmationId);

      logger.info(`[MCPBridge] Confirmation rejected: ${confirmationId}`, { reason });
      pending.reject(new Error(`USER_REJECTED: ${reason}`));

      EventBus.emit('mcp:tool:confirmation-rejected', {
        confirmationId,
        serverName: pending.serverName,
        toolName: pending.toolName,
        reason
      });

      return true;
    };

    /**
     * Register a widget with the bridge
     * @param {string} widgetId - Widget identifier
     * @param {Object} metadata - Widget metadata (permissions, capabilities)
     */
    const registerWidget = (widgetId, metadata) => {
      const { permissions = {}, capabilities = {} } = metadata;

      // Validate approval permissions
      if (permissions.bypass_confirmation && !capabilities.approval_workflows) {
        logger.error(`[MCPBridge] Widget '${widgetId}' requests bypass_confirmation without approval_workflows capability`);
        throw new Error('bypass_confirmation requires approval_workflows capability');
      }

      widgetRegistry.set(widgetId, {
        permissions,
        capabilities,
        registeredAt: Date.now()
      });

      logger.info(`[MCPBridge] Registered widget: ${widgetId}`, {
        canBypass: !!permissions.bypass_confirmation,
        approvalWorkflows: !!capabilities.approval_workflows
      });
    };

    /**
     * Unregister a widget
     * @param {string} widgetId - Widget identifier
     */
    const unregisterWidget = (widgetId) => {
      const removed = widgetRegistry.delete(widgetId);
      if (removed) {
        logger.info(`[MCPBridge] Unregistered widget: ${widgetId}`);
      }
      return removed;
    };

    /**
     * Create a bridge instance for a specific widget
     * @param {Object} widgetMetadata - Widget metadata
     * @returns {Object} MCPBridge interface instance
     */
    const createBridge = (widgetMetadata) => {
      const { element, permissions, capabilities } = widgetMetadata;
      const widgetId = element; // Use element name as ID

      // Register widget
      registerWidget(widgetId, { permissions, capabilities });

      /**
       * Call a tool on an MCP server
       * @param {string} serverName - Server identifier
       * @param {string} toolName - Tool to call
       * @param {Object} args - Tool arguments
       * @returns {Promise<Object>} Tool result
       */
      const callTool = async (serverName, toolName, args = {}) => {
        const startTime = Date.now();

        logger.info(`[MCPBridge] Widget '${widgetId}' calling tool: ${serverName}__${toolName}`);

        // Check if confirmation can be bypassed
        const bypass = canBypassConfirmation(widgetId, toolName);

        // Request confirmation if needed
        if (!bypass) {
          try {
            await requestConfirmation(widgetId, serverName, toolName, args);
          } catch (error) {
            // Confirmation rejected or timed out
            const errorPayload = {
              serverName,
              toolName,
              error: {
                code: error.message.startsWith('USER_REJECTED') ? 'USER_REJECTED' : 'USER_TIMEOUT',
                message: error.message,
                details: { widgetId, args }
              }
            };

            EventBus.emit('mcp:tool:error', errorPayload);

            if (AuditLogger) {
              await AuditLogger.logMCPOperation('tool_call_rejected', {
                serverName,
                toolName,
                widgetId,
                error: error.message,
                timestamp: new Date().toISOString()
              });
            }

            throw error;
          }
        } else {
          logger.info(`[MCPBridge] Bypassing confirmation for: ${toolName} (approval workflow)`);
        }

        // Call the actual tool via MCPRegistry
        try {
          const result = await ReploidMCPRegistry.callTool(serverName, toolName, args);
          const duration = Date.now() - startTime;

          // Emit success event
          EventBus.emit('mcp:tool:invoked', {
            serverName,
            toolName,
            result,
            widgetId,
            duration,
            bypassed: bypass
          });

          // Audit log
          if (AuditLogger) {
            await AuditLogger.logMCPOperation('tool_call_success', {
              serverName,
              toolName,
              widgetId,
              bypassed: bypass,
              duration,
              timestamp: new Date().toISOString()
            });
          }

          return result;
        } catch (error) {
          const duration = Date.now() - startTime;

          // Emit error event
          EventBus.emit('mcp:tool:error', {
            serverName,
            toolName,
            error: {
              code: 'TOOL_ERROR',
              message: error.message,
              details: { widgetId, args }
            },
            duration
          });

          // Audit log
          if (AuditLogger) {
            await AuditLogger.logMCPOperation('tool_call_error', {
              serverName,
              toolName,
              widgetId,
              error: error.message,
              duration,
              timestamp: new Date().toISOString()
            });
          }

          throw error;
        }
      };

      /**
       * List tools available on a server
       * @param {string} serverName - Server identifier
       * @returns {Promise<Array>} List of tools
       */
      const listTools = async (serverName) => {
        const server = ReploidMCPRegistry.getServer(serverName);
        if (!server) {
          throw new Error(`Server '${serverName}' not found in registry`);
        }

        return server.listTools();
      };

      /**
       * Read a resource from a server
       * @param {string} serverName - Server identifier
       * @param {string} uri - Resource URI
       * @returns {Promise<Object>} Resource content
       */
      const readResource = async (serverName, uri) => {
        // Call read_resource tool if available
        try {
          const result = await ReploidMCPRegistry.callTool(serverName, 'read_resource', { uri });

          EventBus.emit('mcp:resource:read', {
            serverName,
            uri,
            content: result
          });

          return result;
        } catch (error) {
          EventBus.emit('mcp:resource:error', {
            serverName,
            uri,
            error: { code: 'RESOURCE_ERROR', message: error.message }
          });

          throw error;
        }
      };

      /**
       * List resources available on a server
       * @param {string} serverName - Server identifier
       * @returns {Promise<Array>} List of resources
       */
      const listResources = async (serverName) => {
        try {
          const result = await ReploidMCPRegistry.callTool(serverName, 'list_resources', {});
          return result.resources || [];
        } catch (error) {
          logger.warn(`[MCPBridge] Server '${serverName}' does not support resources`);
          return [];
        }
      };

      /**
       * Get a prompt from a server
       * @param {string} serverName - Server identifier
       * @param {string} promptName - Prompt name
       * @param {Object} args - Prompt arguments
       * @returns {Promise<Object>} Prompt messages
       */
      const getPrompt = async (serverName, promptName, args = {}) => {
        try {
          const result = await ReploidMCPRegistry.callTool(serverName, 'get_prompt', {
            name: promptName,
            arguments: args
          });

          EventBus.emit('mcp:prompt:got', {
            serverName,
            promptName,
            messages: result
          });

          return result;
        } catch (error) {
          EventBus.emit('mcp:prompt:error', {
            serverName,
            promptName,
            error: { code: 'PROMPT_ERROR', message: error.message }
          });

          throw error;
        }
      };

      /**
       * List prompts available on a server
       * @param {string} serverName - Server identifier
       * @returns {Promise<Array>} List of prompts
       */
      const listPrompts = async (serverName) => {
        try {
          const result = await ReploidMCPRegistry.callTool(serverName, 'list_prompts', {});
          return result.prompts || [];
        } catch (error) {
          logger.warn(`[MCPBridge] Server '${serverName}' does not support prompts`);
          return [];
        }
      };

      /**
       * Cleanup bridge instance
       */
      const cleanup = () => {
        unregisterWidget(widgetId);
      };

      // Return MCPBridge interface
      return {
        // Core MCP operations
        callTool,
        listTools,
        readResource,
        listResources,
        getPrompt,
        listPrompts,

        // Lifecycle
        cleanup,

        // Metadata
        widgetId
      };
    };

    /**
     * Initialize bridge
     */
    const init = async () => {
      logger.info('[MCPBridge] Initialized');

      // Listen for confirmation events from UI
      EventBus.on('mcp:tool:user-approved', (data) => {
        if (data.confirmationId) {
          approveConfirmation(data.confirmationId);
        }
      });

      EventBus.on('mcp:tool:user-rejected', (data) => {
        if (data.confirmationId) {
          rejectConfirmation(data.confirmationId, data.reason);
        }
      });

      return true;
    };

    /**
     * Cleanup bridge
     */
    const cleanup = () => {
      // Clear all pending confirmations
      for (const [confirmationId, pending] of pendingConfirmations.entries()) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Bridge shutting down'));
      }

      pendingConfirmations.clear();
      widgetRegistry.clear();

      logger.info('[MCPBridge] Cleaned up');
    };

    /**
     * Get bridge statistics
     */
    const getStats = () => {
      return {
        pendingConfirmations: pendingConfirmations.size,
        registeredWidgets: widgetRegistry.size,
        config
      };
    };

    // Public API
    return {
      init,
      api: {
        createBridge,
        approveConfirmation,
        rejectConfirmation,
        getStats,
        cleanup
      }
    };
  }
};

export default ReploidMCPBridge;
