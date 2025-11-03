#!/usr/bin/env node

/**
 * Agent Bridge Server
 *
 * Enables coordination between AI agents on the same machine
 * using WebSocket-based JSON-RPC 2.0 protocol.
 *
 * Features:
 * - Agent registration and discovery
 * - Message broadcasting and direct messaging
 * - Task delegation and status tracking
 * - Shared context and state management
 */

import { WebSocketServer, WebSocket } from 'ws';
import { EventEmitter } from 'events';

class AgentBridge extends EventEmitter {
  constructor(server, options = {}) {
    super();

    this.options = {
      path: options.path || '/claude-bridge',
      heartbeatInterval: options.heartbeatInterval || 30000,
      agentTimeout: options.agentTimeout || 120000,
      ...options
    };

    // WebSocket server
    this.wss = new WebSocketServer({
      server,
      path: this.options.path
    });

    // Agent management
    this.agents = new Map(); // agentId -> { ws, metadata, lastSeen, capabilities }
    this.tasks = new Map();   // taskId -> { assignedTo, status, created, updated }
    this.sharedContext = new Map(); // contextKey -> value

    // Setup WebSocket handlers
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

    // Setup heartbeat monitoring
    this.startHeartbeatMonitor();

    console.log(`[AgentBridge] Agent coordination server started on ${this.options.path}`);
  }

  handleConnection(ws, req) {
    console.log('[AgentBridge] New connection from:', req.socket.remoteAddress);

    let agentId = null;

    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());

        // JSON-RPC 2.0 validation
        if (!message.jsonrpc || message.jsonrpc !== '2.0') {
          this.sendError(ws, null, -32600, 'Invalid Request: missing or invalid jsonrpc field');
          return;
        }

        if (!message.method) {
          this.sendError(ws, message.id, -32600, 'Invalid Request: missing method field');
          return;
        }

        // Handle the request
        const result = await this.handleMethod(message.method, message.params || {}, agentId, ws);

        // If this was a registration, update agentId
        if (message.method === 'register' && result.agentId) {
          agentId = result.agentId;
        }

        // Send response (only if message has an id, per JSON-RPC 2.0)
        if (message.id !== undefined) {
          this.sendResponse(ws, message.id, result);
        }

      } catch (error) {
        console.error('[AgentBridge] Error handling message:', error);
        this.sendError(ws, null, -32603, `Internal error: ${error.message}`);
      }
    });

    ws.on('close', () => {
      if (agentId) {
        console.log(`[AgentBridge] Agent ${agentId} disconnected`);
        this.agents.delete(agentId);
        this.emit('agent-left', { agentId });
      }
    });

    ws.on('error', (error) => {
      console.error('[AgentBridge] WebSocket error:', error);
    });
  }

  async handleMethod(method, params, agentId, ws) {
    switch (method) {
      case 'register':
        return this.handleRegister(params, ws);

      case 'broadcast':
        return this.handleBroadcast(params, agentId);

      case 'send_to':
        return this.handleSendTo(params, agentId);

      case 'query_agents':
        return this.handleQueryAgents(params);

      case 'delegate_task':
        return this.handleDelegateTask(params, agentId);

      case 'update_task_status':
        return this.handleUpdateTaskStatus(params, agentId);

      case 'get_shared_context':
        return this.handleGetSharedContext(params);

      case 'set_shared_context':
        return this.handleSetSharedContext(params, agentId);

      case 'heartbeat':
        return this.handleHeartbeat(agentId);

      default:
        throw new Error(`Method not found: ${method}`);
    }
  }

  handleRegister(params, ws) {
    const { name, capabilities, metadata } = params;

    if (!name) {
      throw new Error('Agent name is required');
    }

    // Generate unique agent ID
    const agentId = `claude-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Store agent info
    this.agents.set(agentId, {
      ws,
      name,
      capabilities: capabilities || [],
      metadata: metadata || {},
      lastSeen: Date.now(),
      registered: Date.now()
    });

    console.log(`[AgentBridge] Agent registered: ${agentId} (${name})`);
    this.emit('agent-joined', { agentId, name, capabilities });

    // Notify other agents
    this.broadcastToOthers(agentId, {
      jsonrpc: '2.0',
      method: 'agent_joined',
      params: { agentId, name, capabilities, metadata }
    });

    return {
      agentId,
      message: 'Registered successfully',
      activeAgents: Array.from(this.agents.entries()).map(([id, agent]) => ({
        agentId: id,
        name: agent.name,
        capabilities: agent.capabilities,
        metadata: agent.metadata
      }))
    };
  }

  handleBroadcast(params, agentId) {
    const { message, type } = params;

    if (!agentId) {
      throw new Error('Agent must be registered to broadcast');
    }

    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }

    // Broadcast to all other agents
    this.broadcastToOthers(agentId, {
      jsonrpc: '2.0',
      method: 'broadcast_received',
      params: {
        from: agentId,
        fromName: agent.name,
        message,
        type,
        timestamp: Date.now()
      }
    });

    return { success: true, recipientCount: this.agents.size - 1 };
  }

  handleSendTo(params, agentId) {
    const { targetAgentId, message, type } = params;

    if (!agentId) {
      throw new Error('Agent must be registered to send messages');
    }

    const sender = this.agents.get(agentId);
    if (!sender) {
      throw new Error('Sender agent not found');
    }

    const recipient = this.agents.get(targetAgentId);
    if (!recipient) {
      throw new Error('Target agent not found');
    }

    // Send message to target agent
    this.sendNotification(recipient.ws, 'message_received', {
      from: agentId,
      fromName: sender.name,
      message,
      type,
      timestamp: Date.now()
    });

    return { success: true, delivered: true };
  }

  handleQueryAgents(params) {
    const { capability } = params;

    let agents = Array.from(this.agents.entries()).map(([id, agent]) => ({
      agentId: id,
      name: agent.name,
      capabilities: agent.capabilities,
      metadata: agent.metadata,
      registered: agent.registered,
      lastSeen: agent.lastSeen
    }));

    // Filter by capability if specified
    if (capability) {
      agents = agents.filter(agent =>
        agent.capabilities.includes(capability)
      );
    }

    return { agents, total: agents.length };
  }

  handleDelegateTask(params, agentId) {
    const { task, targetAgentId, priority } = params;

    if (!agentId) {
      throw new Error('Agent must be registered to delegate tasks');
    }

    const delegator = this.agents.get(agentId);
    if (!delegator) {
      throw new Error('Delegator agent not found');
    }

    const target = targetAgentId ? this.agents.get(targetAgentId) : null;

    // If no target specified, find available agent
    const assignedAgent = target || this.findAvailableAgent(task.requiredCapabilities);

    if (!assignedAgent) {
      throw new Error('No available agent found for task');
    }

    // Create task
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.tasks.set(taskId, {
      taskId,
      task,
      assignedTo: targetAgentId || Array.from(this.agents.keys()).find(id => this.agents.get(id) === assignedAgent),
      delegatedBy: agentId,
      status: 'assigned',
      priority: priority || 'normal',
      created: Date.now(),
      updated: Date.now()
    });

    // Notify assigned agent
    this.sendNotification(assignedAgent.ws || assignedAgent, 'task_assigned', {
      taskId,
      task,
      delegatedBy: agentId,
      delegatorName: delegator.name,
      priority
    });

    return { taskId, assignedTo: this.tasks.get(taskId).assignedTo, status: 'assigned' };
  }

  handleUpdateTaskStatus(params, agentId) {
    const { taskId, status, result, error } = params;

    if (!agentId) {
      throw new Error('Agent must be registered to update tasks');
    }

    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (task.assignedTo !== agentId) {
      throw new Error('Only assigned agent can update task status');
    }

    // Update task
    task.status = status;
    task.updated = Date.now();
    if (result !== undefined) task.result = result;
    if (error !== undefined) task.error = error;

    // Notify delegator
    const delegator = this.agents.get(task.delegatedBy);
    if (delegator) {
      this.sendNotification(delegator.ws, 'task_updated', {
        taskId,
        status,
        result,
        error,
        updatedBy: agentId
      });
    }

    return { success: true, task };
  }

  handleGetSharedContext(params) {
    const { key } = params;

    if (key) {
      return { key, value: this.sharedContext.get(key) };
    }

    // Return all context
    return { context: Object.fromEntries(this.sharedContext) };
  }

  handleSetSharedContext(params, agentId) {
    const { key, value } = params;

    if (!key) {
      throw new Error('Context key is required');
    }

    if (!agentId) {
      throw new Error('Agent must be registered to set context');
    }

    this.sharedContext.set(key, {
      value,
      setBy: agentId,
      timestamp: Date.now()
    });

    // Notify other agents of context change
    this.broadcastToOthers(agentId, {
      jsonrpc: '2.0',
      method: 'context_updated',
      params: { key, value, setBy: agentId, timestamp: Date.now() }
    });

    return { success: true, key };
  }

  handleHeartbeat(agentId) {
    if (!agentId) {
      throw new Error('Agent must be registered for heartbeat');
    }

    const agent = this.agents.get(agentId);
    if (agent) {
      agent.lastSeen = Date.now();
      return { success: true, timestamp: agent.lastSeen };
    }

    throw new Error('Agent not found');
  }

  findAvailableAgent(requiredCapabilities) {
    for (const [id, agent] of this.agents) {
      if (!requiredCapabilities || requiredCapabilities.length === 0) {
        return agent;
      }

      const hasAllCapabilities = requiredCapabilities.every(cap =>
        agent.capabilities.includes(cap)
      );

      if (hasAllCapabilities) {
        return agent;
      }
    }
    return null;
  }

  broadcastToOthers(excludeAgentId, message) {
    for (const [id, agent] of this.agents) {
      if (id !== excludeAgentId && agent.ws.readyState === WebSocket.OPEN) {
        agent.ws.send(JSON.stringify(message));
      }
    }
  }

  sendResponse(ws, id, result) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      result
    }));
  }

  sendError(ws, id, code, message) {
    ws.send(JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: { code, message }
    }));
  }

  sendNotification(ws, method, params) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        method,
        params
      }));
    }
  }

  startHeartbeatMonitor() {
    setInterval(() => {
      const now = Date.now();
      for (const [agentId, agent] of this.agents) {
        if (now - agent.lastSeen > this.options.agentTimeout) {
          console.log(`[AgentBridge] Agent ${agentId} timed out`);
          agent.ws.close();
          this.agents.delete(agentId);
          this.emit('agent-timeout', { agentId });
        }
      }
    }, this.options.heartbeatInterval);
  }

  getStats() {
    return {
      activeAgents: this.agents.size,
      activeTasks: this.tasks.size,
      sharedContextSize: this.sharedContext.size,
      agents: Array.from(this.agents.entries()).map(([id, agent]) => ({
        agentId: id,
        name: agent.name,
        capabilities: agent.capabilities,
        lastSeen: agent.lastSeen
      })),
      tasks: Array.from(this.tasks.values())
    };
  }

  close() {
    this.wss.close();
    this.agents.clear();
    this.tasks.clear();
    this.sharedContext.clear();
  }
}

export default AgentBridge;
