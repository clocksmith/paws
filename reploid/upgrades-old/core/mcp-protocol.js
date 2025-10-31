// @blueprint 0x000070 - MCP Protocol Layer for In-Browser Tool Execution
/**
 * MCP Protocol Layer Module
 *
 * Implements JSON-RPC 2.0 protocol for Model Context Protocol (MCP) compliance
 * Provides security isolation, audit logging, and external access capabilities
 *
 * Key features:
 * - JSON-RPC 2.0 message handling
 * - Tool discovery and execution
 * - Request/response formatting per MCP spec
 * - Error handling with proper error codes
 * - Audit trail integration
 */

const MCPProtocol = {
  metadata: {
    id: 'MCPProtocol',
    version: '1.0.0',
    description: 'JSON-RPC 2.0 protocol layer for MCP-compliant tool execution',
    dependencies: ['Utils', 'EventBus?', 'AuditLogger?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus, AuditLogger } = deps;
    const { logger } = Utils;

    logger.info('[MCPProtocol] Initializing MCP protocol layer...');

    // JSON-RPC 2.0 Error codes per spec
    const ErrorCodes = {
      PARSE_ERROR: -32700,
      INVALID_REQUEST: -32600,
      METHOD_NOT_FOUND: -32601,
      INVALID_PARAMS: -32602,
      INTERNAL_ERROR: -32603,
      // MCP-specific error codes
      TOOL_NOT_FOUND: -32001,
      TOOL_EXECUTION_ERROR: -32002,
      SANDBOX_VIOLATION: -32003,
      AUDIT_FAILURE: -32004
    };

    // Active tool handlers registry
    const toolHandlers = new Map();
    let toolRunnerRef = null; // Lazy-loaded ToolRunner reference

    /**
     * Set ToolRunner reference for execution
     * Called by ToolRunner during initialization to avoid circular dependency
     */
    const setToolRunner = (toolRunner) => {
      toolRunnerRef = toolRunner;
      logger.info('[MCPProtocol] ToolRunner reference registered');
    };

    /**
     * Register a tool handler
     * @param {string} toolName - Tool identifier
     * @param {Function} handler - Async function that executes the tool
     * @param {Object} schema - JSON schema for tool parameters
     */
    const registerTool = (toolName, handler, schema = {}) => {
      toolHandlers.set(toolName, { handler, schema });
      logger.info(`[MCPProtocol] Registered tool: ${toolName}`);

      // Emit event for UI
      if (EventBus) {
        EventBus.emit('mcp:tool:registered', { toolName, schema });
      }
    };

    /**
     * Unregister a tool handler
     */
    const unregisterTool = (toolName) => {
      const removed = toolHandlers.delete(toolName);
      if (removed) {
        logger.info(`[MCPProtocol] Unregistered tool: ${toolName}`);
        if (EventBus) {
          EventBus.emit('mcp:tool:unregistered', { toolName });
        }
      }
      return removed;
    };

    /**
     * Get list of available tools (for discovery)
     */
    const listTools = () => {
      const tools = [];
      for (const [name, { schema }] of toolHandlers.entries()) {
        tools.push({
          name,
          description: schema.description || `Tool: ${name}`,
          inputSchema: schema
        });
      }
      return tools;
    };

    /**
     * Create JSON-RPC 2.0 success response
     */
    const createSuccessResponse = (id, result) => {
      return {
        jsonrpc: '2.0',
        id,
        result
      };
    };

    /**
     * Create JSON-RPC 2.0 error response
     */
    const createErrorResponse = (id, code, message, data = null) => {
      const error = {
        code,
        message
      };
      if (data !== null) {
        error.data = data;
      }
      return {
        jsonrpc: '2.0',
        id,
        error
      };
    };

    /**
     * Validate JSON-RPC 2.0 request structure
     */
    const validateRequest = (request) => {
      if (!request || typeof request !== 'object') {
        return { valid: false, error: 'Request must be an object' };
      }
      if (request.jsonrpc !== '2.0') {
        return { valid: false, error: 'Invalid jsonrpc version (must be "2.0")' };
      }
      if (typeof request.method !== 'string') {
        return { valid: false, error: 'Method must be a string' };
      }
      if (request.id !== undefined && typeof request.id !== 'string' && typeof request.id !== 'number' && request.id !== null) {
        return { valid: false, error: 'Invalid request id' };
      }
      return { valid: true };
    };

    /**
     * Process JSON-RPC 2.0 request
     * @param {Object} request - JSON-RPC request object
     * @returns {Promise<Object>} JSON-RPC response object
     */
    const processRequest = async (request) => {
      const startTime = Date.now();
      let auditLogId = null;

      try {
        // Parse if string
        if (typeof request === 'string') {
          try {
            request = JSON.parse(request);
          } catch (parseError) {
            return createErrorResponse(null, ErrorCodes.PARSE_ERROR, 'Parse error', {
              details: parseError.message
            });
          }
        }

        // Validate request structure
        const validation = validateRequest(request);
        if (!validation.valid) {
          return createErrorResponse(
            request.id || null,
            ErrorCodes.INVALID_REQUEST,
            'Invalid request',
            { details: validation.error }
          );
        }

        const { method, params = {}, id } = request;

        // Log to audit trail (start)
        if (AuditLogger) {
          auditLogId = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          await AuditLogger.logMCPRequest(auditLogId, {
            method,
            params,
            requestId: id,
            timestamp: new Date().toISOString()
          });
        }

        // Handle MCP-specific methods
        switch (method) {
          case 'tools/list':
            // MCP tool discovery
            const tools = listTools();
            const result = { tools };

            if (AuditLogger) {
              await AuditLogger.logMCPResponse(auditLogId, {
                success: true,
                result,
                duration: Date.now() - startTime
              });
            }

            return createSuccessResponse(id, result);

          case 'tools/call':
            // MCP tool execution
            const toolName = params.name;
            const toolArgs = params.arguments || {};

            if (!toolName) {
              return createErrorResponse(id, ErrorCodes.INVALID_PARAMS, 'Missing tool name');
            }

            // Check if tool is registered
            const toolHandler = toolHandlers.get(toolName);
            if (!toolHandler) {
              // Fall back to ToolRunner if available
              if (!toolRunnerRef) {
                return createErrorResponse(
                  id,
                  ErrorCodes.TOOL_NOT_FOUND,
                  `Tool not found: ${toolName}`,
                  { availableTools: Array.from(toolHandlers.keys()) }
                );
              }

              // Execute via ToolRunner
              try {
                logger.info(`[MCPProtocol] Executing tool via ToolRunner: ${toolName}`);
                const toolResult = await toolRunnerRef.executeTool(toolName, toolArgs);

                if (AuditLogger) {
                  await AuditLogger.logMCPResponse(auditLogId, {
                    success: true,
                    result: toolResult,
                    duration: Date.now() - startTime
                  });
                }

                return createSuccessResponse(id, {
                  content: [{ type: 'text', text: JSON.stringify(toolResult, null, 2) }],
                  isError: false
                });
              } catch (execError) {
                logger.error(`[MCPProtocol] Tool execution error:`, execError);

                if (AuditLogger) {
                  await AuditLogger.logMCPResponse(auditLogId, {
                    success: false,
                    error: execError.message,
                    duration: Date.now() - startTime
                  });
                }

                return createErrorResponse(
                  id,
                  ErrorCodes.TOOL_EXECUTION_ERROR,
                  `Tool execution failed: ${execError.message}`,
                  { stack: execError.stack }
                );
              }
            }

            // Execute registered handler
            try {
              logger.info(`[MCPProtocol] Executing registered tool: ${toolName}`);
              const handlerResult = await toolHandler.handler(toolArgs);

              if (AuditLogger) {
                await AuditLogger.logMCPResponse(auditLogId, {
                  success: true,
                  result: handlerResult,
                  duration: Date.now() - startTime
                });
              }

              return createSuccessResponse(id, {
                content: [{ type: 'text', text: JSON.stringify(handlerResult, null, 2) }],
                isError: false
              });
            } catch (handlerError) {
              logger.error(`[MCPProtocol] Handler error:`, handlerError);

              if (AuditLogger) {
                await AuditLogger.logMCPResponse(auditLogId, {
                  success: false,
                  error: handlerError.message,
                  duration: Date.now() - startTime
                });
              }

              return createErrorResponse(
                id,
                ErrorCodes.TOOL_EXECUTION_ERROR,
                `Tool execution failed: ${handlerError.message}`,
                { stack: handlerError.stack }
              );
            }

          default:
            return createErrorResponse(
              id,
              ErrorCodes.METHOD_NOT_FOUND,
              `Method not found: ${method}`,
              { supportedMethods: ['tools/list', 'tools/call'] }
            );
        }
      } catch (error) {
        logger.error('[MCPProtocol] Internal error:', error);

        if (AuditLogger && auditLogId) {
          await AuditLogger.logMCPResponse(auditLogId, {
            success: false,
            error: error.message,
            duration: Date.now() - startTime
          });
        }

        return createErrorResponse(
          request?.id || null,
          ErrorCodes.INTERNAL_ERROR,
          'Internal error',
          { details: error.message, stack: error.stack }
        );
      }
    };

    /**
     * Process batch of JSON-RPC 2.0 requests
     * @param {Array} requests - Array of JSON-RPC request objects
     * @returns {Promise<Array>} Array of JSON-RPC response objects
     */
    const processBatch = async (requests) => {
      if (!Array.isArray(requests)) {
        return createErrorResponse(null, ErrorCodes.INVALID_REQUEST, 'Batch request must be an array');
      }

      logger.info(`[MCPProtocol] Processing batch of ${requests.length} requests`);

      const responses = await Promise.all(
        requests.map(req => processRequest(req))
      );

      return responses;
    };

    /**
     * Create a tool call request (helper for testing/internal use)
     */
    const createToolCallRequest = (toolName, args, id = Date.now()) => {
      return {
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id
      };
    };

    logger.info('[MCPProtocol] MCP protocol layer initialized');

    return {
      // Core protocol methods
      processRequest,
      processBatch,

      // Tool management
      registerTool,
      unregisterTool,
      listTools,
      setToolRunner,

      // Helpers
      createToolCallRequest,
      createSuccessResponse,
      createErrorResponse,

      // Error codes for external use
      ErrorCodes
    };
  }
};

// Export for ES modules
export default MCPProtocol;
