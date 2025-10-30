// @blueprint 0x000072 - WebSocket Transport for External MCP Access
/**
 * MCP WebSocket Transport Module
 *
 * Provides WebSocket-based transport for external MCP client access
 * Enables external tools/clients to connect and use MCP protocol
 *
 * Architecture:
 * - Browser-side: Connects to external WebSocket bridge server
 * - Or: Provides postMessage API for same-origin communication
 * - Frames JSON-RPC messages over WebSocket
 * - Routes to MCPProtocol for processing
 *
 * Key features:
 * - Connection management (connect, reconnect, disconnect)
 * - Message framing and parsing
 * - Request/response correlation
 * - Error handling and recovery
 * - Multiple client support (via bridge server)
 */

const MCPTransportWS = {
  metadata: {
    id: 'MCPTransportWS',
    version: '1.0.0',
    description: 'WebSocket transport layer for external MCP access',
    dependencies: ['Utils', 'EventBus?', 'MCPProtocol'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus, MCPProtocol } = deps;
    const { logger } = Utils;

    logger.info('[MCPTransportWS] Initializing MCP WebSocket transport...');

    // Connection state
    let wsConnection = null;
    let isConnected = false;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const RECONNECT_DELAY = 2000; // 2 seconds

    // Message correlation (for tracking request/response pairs)
    const pendingRequests = new Map(); // messageId -> { resolve, reject, timeout }

    /**
     * Connect to WebSocket bridge server
     * @param {string} url - WebSocket server URL (e.g., ws://localhost:8001)
     * @returns {Promise<void>}
     */
    const connect = async (url) => {
      if (wsConnection && isConnected) {
        logger.warn('[MCPTransportWS] Already connected');
        return;
      }

      logger.info(`[MCPTransportWS] Connecting to: ${url}`);

      return new Promise((resolve, reject) => {
        try {
          wsConnection = new WebSocket(url);

          wsConnection.onopen = () => {
            isConnected = true;
            reconnectAttempts = 0;
            logger.info('[MCPTransportWS] Connected to WebSocket bridge');

            if (EventBus) {
              EventBus.emit('mcp:transport:connected', { url });
            }

            resolve();
          };

          wsConnection.onmessage = async (event) => {
            try {
              const message = JSON.parse(event.data);
              await handleIncomingMessage(message);
            } catch (error) {
              logger.error('[MCPTransportWS] Failed to parse message:', error);
            }
          };

          wsConnection.onerror = (error) => {
            logger.error('[MCPTransportWS] WebSocket error:', error);

            if (EventBus) {
              EventBus.emit('mcp:transport:error', { error });
            }
          };

          wsConnection.onclose = () => {
            isConnected = false;
            logger.info('[MCPTransportWS] Connection closed');

            if (EventBus) {
              EventBus.emit('mcp:transport:disconnected');
            }

            // Attempt reconnect
            if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
              reconnectAttempts++;
              logger.info(`[MCPTransportWS] Attempting reconnect (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
              setTimeout(() => connect(url), RECONNECT_DELAY);
            }
          };

          // Timeout if connection takes too long
          setTimeout(() => {
            if (!isConnected) {
              reject(new Error('Connection timeout'));
            }
          }, 10000);

        } catch (error) {
          logger.error('[MCPTransportWS] Failed to create WebSocket:', error);
          reject(error);
        }
      });
    };

    /**
     * Disconnect from WebSocket bridge
     */
    const disconnect = () => {
      if (wsConnection) {
        reconnectAttempts = MAX_RECONNECT_ATTEMPTS; // Prevent auto-reconnect
        wsConnection.close();
        wsConnection = null;
        isConnected = false;
        logger.info('[MCPTransportWS] Disconnected');
      }
    };

    /**
     * Handle incoming message from WebSocket
     * Routes to MCPProtocol for processing
     * @param {Object} message - Parsed JSON-RPC message
     */
    const handleIncomingMessage = async (message) => {
      logger.info('[MCPTransportWS] Received message:', message);

      try {
        // Check if this is a response to our request
        if (message.id && pendingRequests.has(message.id)) {
          const { resolve, reject, timeout } = pendingRequests.get(message.id);
          clearTimeout(timeout);
          pendingRequests.delete(message.id);

          if (message.error) {
            reject(new Error(message.error.message));
          } else {
            resolve(message.result);
          }
          return;
        }

        // Otherwise, treat as incoming request
        const response = await MCPProtocol.processRequest(message);

        // Send response back
        if (wsConnection && isConnected) {
          wsConnection.send(JSON.stringify(response));
          logger.info('[MCPTransportWS] Sent response:', response);

          if (EventBus) {
            EventBus.emit('mcp:transport:response', { request: message, response });
          }
        }
      } catch (error) {
        logger.error('[MCPTransportWS] Error processing message:', error);

        // Send error response
        const errorResponse = MCPProtocol.createErrorResponse(
          message?.id || null,
          MCPProtocol.ErrorCodes.INTERNAL_ERROR,
          'Transport processing error',
          { details: error.message }
        );

        if (wsConnection && isConnected) {
          wsConnection.send(JSON.stringify(errorResponse));
        }
      }
    };

    /**
     * Send message to WebSocket bridge
     * @param {Object} message - JSON-RPC message
     * @returns {Promise<any>} Response from bridge
     */
    const sendMessage = async (message) => {
      if (!wsConnection || !isConnected) {
        throw new Error('Not connected to WebSocket bridge');
      }

      return new Promise((resolve, reject) => {
        const messageId = message.id || `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const messageWithId = { ...message, id: messageId };

        // Set up timeout
        const timeout = setTimeout(() => {
          pendingRequests.delete(messageId);
          reject(new Error('Request timeout'));
        }, 30000); // 30 second timeout

        // Store pending request
        pendingRequests.set(messageId, { resolve, reject, timeout });

        // Send message
        wsConnection.send(JSON.stringify(messageWithId));
        logger.info('[MCPTransportWS] Sent message:', messageWithId);

        if (EventBus) {
          EventBus.emit('mcp:transport:request', { message: messageWithId });
        }
      });
    };

    /**
     * Call remote MCP tool via WebSocket
     * @param {string} toolName - Tool name
     * @param {Object} args - Tool arguments
     * @returns {Promise<any>} Tool result
     */
    const callRemoteTool = async (toolName, args) => {
      const request = MCPProtocol.createToolCallRequest(toolName, args);
      const response = await sendMessage(request);
      return response;
    };

    /**
     * List tools available via WebSocket bridge
     * @returns {Promise<Array>} List of available tools
     */
    const listRemoteTools = async () => {
      const request = {
        jsonrpc: '2.0',
        method: 'tools/list',
        id: `list_${Date.now()}`
      };
      const response = await sendMessage(request);
      return response.tools || [];
    };

    /**
     * Get transport statistics
     */
    const getStats = () => {
      return {
        isConnected,
        reconnectAttempts,
        pendingRequests: pendingRequests.size,
        maxReconnectAttempts: MAX_RECONNECT_ATTEMPTS
      };
    };

    /**
     * Alternative: PostMessage-based transport for same-origin communication
     * Useful for iframe-based isolation or testing without WebSocket server
     */
    const setupPostMessageTransport = () => {
      logger.info('[MCPTransportWS] Setting up postMessage transport');

      window.addEventListener('message', async (event) => {
        // Validate origin if needed
        // if (event.origin !== expectedOrigin) return;

        const message = event.data;
        if (message.type === 'mcp-request') {
          try {
            const response = await MCPProtocol.processRequest(message.payload);

            // Send response back
            event.source.postMessage({
              type: 'mcp-response',
              payload: response
            }, event.origin);

            logger.info('[MCPTransportWS] Sent postMessage response');
          } catch (error) {
            logger.error('[MCPTransportWS] Error processing postMessage:', error);
          }
        }
      });

      logger.info('[MCPTransportWS] postMessage transport ready');
    };

    logger.info('[MCPTransportWS] MCP WebSocket transport initialized');

    return {
      // WebSocket transport
      connect,
      disconnect,
      sendMessage,
      callRemoteTool,
      listRemoteTools,

      // Alternative transport
      setupPostMessageTransport,

      // Status
      getStats,
      isConnected: () => isConnected
    };
  }
};

export default MCPTransportWS;
