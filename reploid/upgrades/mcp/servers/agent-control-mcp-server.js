// @blueprint 0x000078 - Agent Control MCP Server for REPLOID
/**
 * Agent Control MCP Server
 *
 * Exposes high-level agent control operations via MCP
 * Provides control over agent lifecycle, state, and execution context
 *
 * Available Tools:
 * - start_cycle - Start a new agent cycle with a goal
 * - get_cycle_state - Get current cycle state and context
 * - get_state_metrics - Get performance metrics for current state
 * - get_transition_history - Get state transition history with timing
 * - force_transition - Admin: Force state transition (dangerous)
 */

const AgentControlMCPServer = {
  metadata: {
    id: 'AgentControlMCPServer',
    version: '1.0.0',
    description: 'High-level agent control and lifecycle management via MCP',
    dependencies: ['ReploidMCPServerBase', 'CycleLogic', 'EventBus?', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, CycleLogic, EventBus, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[AgentControlMCPServer] Initializing Agent Control MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'agent',
      version: '1.0.0',
      description: 'REPLOID Agent Control - lifecycle, state, and execution management',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // CYCLE CONTROL
        // =================================================================
        {
          name: 'start_cycle',
          schema: {
            description: 'Start a new agent cycle with the specified goal',
            properties: {
              goal: {
                type: 'string',
                description: 'The goal/objective for the agent cycle'
              }
            },
            required: ['goal']
          },
          handler: async (args) => {
            const { goal } = args;

            // Check current state
            const currentState = CycleLogic.getCurrentState();
            if (currentState !== 'IDLE') {
              throw new Error(`Cannot start cycle: agent is in state ${currentState}. Agent must be IDLE.`);
            }

            // Start the cycle
            await CycleLogic.startCycle(goal);

            logger.info(`[AgentControlMCPServer] Started cycle with goal: ${goal}`);

            return {
              success: true,
              goal,
              state: CycleLogic.getCurrentState(),
              message: 'Agent cycle started successfully'
            };
          }
        },

        // =================================================================
        // STATE QUERIES
        // =================================================================
        {
          name: 'get_cycle_state',
          schema: {
            description: 'Get the current agent cycle state and context',
            properties: {}
          },
          handler: async () => {
            const state = CycleLogic.getCurrentState();
            const context = CycleLogic.getCycleContext ? CycleLogic.getCycleContext() : {};

            return {
              success: true,
              state,
              context,
              timestamp: Date.now()
            };
          }
        },

        {
          name: 'get_state_metrics',
          schema: {
            description: 'Get performance metrics for the current state',
            properties: {}
          },
          handler: async () => {
            // Try to get metrics from CycleLogic if available
            const metrics = CycleLogic.getStateMetrics ? CycleLogic.getStateMetrics() : null;

            if (!metrics) {
              return {
                success: true,
                state: CycleLogic.getCurrentState(),
                message: 'State metrics not available'
              };
            }

            return {
              success: true,
              metrics
            };
          }
        },

        {
          name: 'get_transition_history',
          schema: {
            description: 'Get state transition history with timing information',
            properties: {
              limit: {
                type: 'number',
                description: 'Optional: limit number of transitions (default: 50)'
              }
            }
          },
          handler: async (args) => {
            const { limit } = args;

            // Try to get history from CycleLogic
            const history = CycleLogic.getTransitionHistory ? CycleLogic.getTransitionHistory() : [];
            const limited = limit ? history.slice(-limit) : history;

            return {
              success: true,
              count: limited.length,
              total: history.length,
              transitions: limited
            };
          }
        },

        // =================================================================
        // ADMIN/EMERGENCY CONTROLS
        // =================================================================
        {
          name: 'force_transition',
          schema: {
            description: 'ADMIN ONLY: Force a state transition (use with extreme caution)',
            properties: {
              target_state: {
                type: 'string',
                description: 'Target state to transition to',
                enum: ['IDLE', 'CURATING_CONTEXT', 'AWAITING_CONTEXT_APPROVAL', 'PLANNING_WITH_CONTEXT', 'GENERATING_PROPOSAL', 'AWAITING_PROPOSAL_APPROVAL', 'APPLYING_CHANGESET', 'REFLECTING', 'ERROR']
              },
              reason: {
                type: 'string',
                description: 'Reason for forcing transition'
              },
              admin_override: {
                type: 'boolean',
                description: 'Must be true to confirm admin override'
              }
            },
            required: ['target_state', 'reason', 'admin_override']
          },
          handler: async (args) => {
            const { target_state, reason, admin_override } = args;

            if (!admin_override) {
              throw new Error('Admin override confirmation required (set admin_override: true)');
            }

            const currentState = CycleLogic.getCurrentState();

            logger.warn(`[AgentControlMCPServer] FORCE TRANSITION: ${currentState} -> ${target_state}. Reason: ${reason}`);

            // Use EventBus to request transition
            if (EventBus) {
              EventBus.emit('agent:force:transition', {
                from: currentState,
                to: target_state,
                reason,
                timestamp: Date.now(),
                source: 'mcp'
              });
            }

            // If CycleLogic has a direct transition method, use it
            if (CycleLogic.transitionTo) {
              CycleLogic.transitionTo(target_state, { forced: true, reason });
            }

            return {
              success: true,
              action: 'forced_transition',
              from_state: currentState,
              to_state: target_state,
              reason,
              warning: 'Forced transitions may leave the agent in an inconsistent state. Use with caution.'
            };
          }
        },

        {
          name: 'get_cycle_context',
          schema: {
            description: 'Get detailed context information for the current cycle',
            properties: {}
          },
          handler: async () => {
            const context = CycleLogic.getCycleContext ? CycleLogic.getCycleContext() : {};
            const state = CycleLogic.getCurrentState();

            return {
              success: true,
              state,
              context,
              timestamp: Date.now()
            };
          }
        },

        {
          name: 'get_agent_info',
          schema: {
            description: 'Get general information about the agent',
            properties: {}
          },
          handler: async () => {
            return {
              success: true,
              agent: 'REPLOID Sentinel Agent',
              version: '2.0.0',
              current_state: CycleLogic.getCurrentState(),
              uptime: Date.now() - (CycleLogic.getStartTime ? CycleLogic.getStartTime() : Date.now()),
              capabilities: [
                'context_curation',
                'planning',
                'proposal_generation',
                'changeset_application',
                'reflection_learning',
                'approval_workflows'
              ]
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[AgentControlMCPServer] Initialized with ${server.listTools().length} tools`);

    // Listen to cycle events for better tracking
    if (EventBus) {
      EventBus.on('agent:state:change', (data) => {
        logger.debug('[AgentControlMCPServer] Agent state changed:', data);
      });

      EventBus.on('cycle:start', (data) => {
        logger.info('[AgentControlMCPServer] Cycle started:', data);
      });
    }

    // Return server instance
    return server;
  }
};

export default AgentControlMCPServer;
