// Browser-compatible Agent Bridge Client
// Allows Reploid browser agent to connect to Agent Bridge

const AgentBridgeClient = {
  metadata: {
    name: 'AgentBridgeClient',
    version: '1.0.0',
    description: 'Connect Reploid agent to Agent Bridge for multi-agent coordination',
    dependencies: [],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    let ws = null;
    let agentId = null;
    let requestId = 0;
    let pendingRequests = new Map();
    let connected = false;
    let eventHandlers = new Map();
    let heartbeatInterval = null;

    // Get bridge URL dynamically (same origin)
    const getBridgeUrl = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      return `${protocol}//${host}/claude-bridge`;
    };

    /**
     * Connect to Agent Bridge
     */
    const connect = async (options = {}) => {
      const { name = 'Reploid-Agent', capabilities = [], metadata = {} } = options;

      return new Promise((resolve, reject) => {
        const url = getBridgeUrl();
        console.log(`[AgentBridge] Connecting to ${url}...`);

        ws = new WebSocket(url);

        ws.onopen = async () => {
          console.log('[AgentBridge] Connected to bridge');

          try {
            // Register with the bridge
            const result = await sendRequest('register', {
              name,
              capabilities,
              metadata: {
                ...metadata,
                type: 'reploid-browser-agent',
                vfs: true, // Indicate this agent has VFS
                location: window.location.href
              }
            });

            agentId = result.agentId;
            connected = true;

            console.log(`[AgentBridge] Registered as ${name} (${agentId})`);
            console.log(`[AgentBridge] Active agents:`, result.activeAgents.length);

            // Trigger event
            trigger('connected', { agentId, activeAgents: result.activeAgents });

            resolve(result);

          } catch (error) {
            reject(error);
          }
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            handleMessage(message);
          } catch (error) {
            console.error('[AgentBridge] Error parsing message:', error);
          }
        };

        ws.onclose = () => {
          console.log('[AgentBridge] Disconnected from bridge');
          connected = false;
          trigger('disconnected');
        };

        ws.onerror = (error) => {
          console.error('[AgentBridge] WebSocket error:', error);
          trigger('error', error);
          reject(error);
        };
      });
    };

    /**
     * Handle incoming messages
     */
    const handleMessage = (message) => {
      // Response to a request
      if (message.id !== undefined) {
        const pending = pendingRequests.get(message.id);
        if (pending) {
          pendingRequests.delete(message.id);

          if (message.error) {
            pending.reject(new Error(`${message.error.code}: ${message.error.message}`));
          } else {
            pending.resolve(message.result);
          }
        }
        return;
      }

      // Notification (method without id)
      if (message.method) {
        trigger(message.method, message.params);
      }
    };

    /**
     * Send a JSON-RPC request
     */
    const sendRequest = (method, params = {}) => {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return Promise.reject(new Error('Not connected to bridge'));
      }

      const id = ++requestId;

      return new Promise((resolve, reject) => {
        // Store pending request
        pendingRequests.set(id, { resolve, reject, timestamp: Date.now() });

        // Send request
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          id,
          method,
          params
        }));

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`Request timeout: ${method}`));
          }
        }, 30000);
      });
    };

    /**
     * Event system
     */
    const on = (event, handler) => {
      if (!eventHandlers.has(event)) {
        eventHandlers.set(event, []);
      }
      eventHandlers.get(event).push(handler);
    };

    const off = (event, handler) => {
      if (eventHandlers.has(event)) {
        const handlers = eventHandlers.get(event);
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };

    const trigger = (event, data) => {
      if (eventHandlers.has(event)) {
        for (const handler of eventHandlers.get(event)) {
          try {
            handler(data);
          } catch (error) {
            console.error(`[AgentBridge] Error in ${event} handler:`, error);
          }
        }
      }
    };

    /**
     * API Methods
     */
    const broadcast = async (message, type = 'message') => {
      return sendRequest('broadcast', { message, type });
    };

    const sendTo = async (targetAgentId, message, type = 'message') => {
      return sendRequest('send_to', { targetAgentId, message, type });
    };

    const queryAgents = async (capability = null) => {
      return sendRequest('query_agents', { capability });
    };

    const delegateTask = async (task, targetAgentId = null, priority = 'normal') => {
      return sendRequest('delegate_task', {
        task,
        targetAgentId,
        priority
      });
    };

    const updateTaskStatus = async (taskId, status, result = null, error = null) => {
      return sendRequest('update_task_status', {
        taskId,
        status,
        result,
        error
      });
    };

    const getSharedContext = async (key = null) => {
      return sendRequest('get_shared_context', { key });
    };

    const setSharedContext = async (key, value) => {
      return sendRequest('set_shared_context', { key, value });
    };

    const heartbeat = async () => {
      return sendRequest('heartbeat');
    };

    const startHeartbeat = (interval = 30000) => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      heartbeatInterval = setInterval(() => {
        if (connected) {
          heartbeat().catch(err => {
            console.error('[AgentBridge] Heartbeat failed:', err.message);
          });
        }
      }, interval);
    };

    const stopHeartbeat = () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
    };

    const disconnect = () => {
      stopHeartbeat();
      if (ws) {
        ws.close();
        ws = null;
      }
      connected = false;
      agentId = null;
    };

    // Return public API
    return {
      connect,
      disconnect,
      on,
      off,
      broadcast,
      sendTo,
      queryAgents,
      delegateTask,
      updateTaskStatus,
      getSharedContext,
      setSharedContext,
      heartbeat,
      startHeartbeat,
      stopHeartbeat,
      getAgentId: () => agentId,
      isConnected: () => connected
    };
  }
};

// Export for module system
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AgentBridgeClient;
}
