// @blueprint 0x000077 - Workflow MCP Server for REPLOID
/**
 * Workflow MCP Server
 *
 * Exposes REPLOID Sentinel FSM workflow operations via MCP
 * Enables external LLMs to control agent execution flow with approval workflows
 *
 * Available Tools:
 * - get_agent_status - Get current workflow state and pending approvals
 * - start_workflow - Begin a new agent workflow/cycle with a goal
 * - approve_context - Approve context bundle (files to read)
 * - approve_proposal - Approve proposed changes
 * - reject_with_revision - Reject and provide feedback for revision
 * - pause_workflow - Pause the running workflow
 * - resume_workflow - Resume a paused workflow
 * - get_workflow_history - Get state transition history
 * - get_reflection_insights - Get learnings from previous runs
 */

const WorkflowMCPServer = {
  metadata: {
    id: 'WorkflowMCPServer',
    version: '1.0.0',
    description: 'Agent workflow control and approval workflows via MCP',
    dependencies: ['ReploidMCPServerBase', 'SentinelFSM', 'EventBus', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, SentinelFSM, EventBus, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[WorkflowMCPServer] Initializing Workflow MCP Server...');

    // Track last approval data for contextual responses
    let lastApprovalContext = null;

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'workflow',
      version: '1.0.0',
      description: 'REPLOID Workflow Control - agent execution, approvals, and state management',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // WORKFLOW STATUS
        // =================================================================
        {
          name: 'get_agent_status',
          schema: {
            description: 'Get current agent workflow status, state, and any pending approvals',
            properties: {}
          },
          handler: async () => {
            const status = SentinelFSM.getStatus();

            // Determine if there's a pending approval
            let pendingApproval = null;
            if (status.state === 'AWAITING_CONTEXT_APPROVAL') {
              pendingApproval = {
                type: 'context',
                message: 'Agent is waiting for context approval',
                action_required: 'Use approve_context or reject_with_revision'
              };
            } else if (status.state === 'AWAITING_PROPOSAL_APPROVAL') {
              pendingApproval = {
                type: 'proposal',
                message: 'Agent is waiting for proposal approval',
                action_required: 'Use approve_proposal or reject_with_revision'
              };
            }

            return {
              success: true,
              state: status.state || 'IDLE',
              goal: status.goal || null,
              session_id: status.sessionId || null,
              turn_number: status.turnNumber || null,
              pending_approval: pendingApproval,
              is_paused: status.paused || false,
              uptime_ms: status.uptimeMs || 0
            };
          }
        },

        {
          name: 'get_workflow_history',
          schema: {
            description: 'Get the state transition history for the current workflow',
            properties: {
              limit: {
                type: 'number',
                description: 'Optional: limit number of history entries (default: 50)'
              }
            }
          },
          handler: async (args) => {
            const { limit } = args;

            const history = SentinelFSM.getStateHistory();
            const limited = limit ? history.slice(-limit) : history;

            return {
              success: true,
              count: limited.length,
              total: history.length,
              history: limited
            };
          }
        },

        {
          name: 'get_reflection_insights',
          schema: {
            description: 'Get reflection insights and learnings from previous workflow executions',
            properties: {}
          },
          handler: async () => {
            const insights = SentinelFSM.getReflectionInsights();

            return {
              success: true,
              count: insights.length,
              insights
            };
          }
        },

        // =================================================================
        // WORKFLOW CONTROL
        // =================================================================
        {
          name: 'start_workflow',
          schema: {
            description: 'Start a new agent workflow with a specified goal',
            properties: {
              goal: {
                type: 'string',
                description: 'The objective/goal for the agent to accomplish'
              }
            },
            required: ['goal']
          },
          handler: async (args) => {
            const { goal } = args;

            // Check if already running
            const currentState = SentinelFSM.getCurrentState();
            if (currentState !== 'IDLE') {
              throw new Error(`Cannot start workflow: agent is in state ${currentState}. Use pause_workflow first.`);
            }

            // Start the cycle
            const started = await SentinelFSM.startCycle(goal);

            if (!started) {
              throw new Error('Failed to start workflow');
            }

            logger.info(`[WorkflowMCPServer] Started workflow with goal: ${goal}`);

            return {
              success: true,
              goal,
              state: 'CURATING_CONTEXT',
              message: 'Workflow started successfully. Agent will curate context and wait for approval.'
            };
          }
        },

        {
          name: 'pause_workflow',
          schema: {
            description: 'Pause the currently running workflow',
            properties: {}
          },
          handler: async () => {
            const result = await SentinelFSM.pauseCycle();

            if (!result) {
              throw new Error('Failed to pause workflow');
            }

            logger.info('[WorkflowMCPServer] Workflow paused');

            return {
              success: true,
              action: 'paused',
              message: 'Workflow paused. Use resume_workflow to continue.'
            };
          }
        },

        {
          name: 'resume_workflow',
          schema: {
            description: 'Resume a paused workflow',
            properties: {}
          },
          handler: async () => {
            const result = await SentinelFSM.resumeCycle();

            if (!result) {
              throw new Error('Failed to resume workflow');
            }

            logger.info('[WorkflowMCPServer] Workflow resumed');

            return {
              success: true,
              action: 'resumed',
              message: 'Workflow resumed successfully'
            };
          }
        },

        // =================================================================
        // APPROVAL WORKFLOWS
        // =================================================================
        {
          name: 'approve_context',
          schema: {
            description: 'Approve the context bundle (files that the agent selected to read)',
            properties: {
              session_id: {
                type: 'string',
                description: 'Optional: session identifier for validation'
              }
            }
          },
          handler: async (args) => {
            const { session_id } = args;

            // Verify we're in the right state
            const currentState = SentinelFSM.getCurrentState();
            if (currentState !== 'AWAITING_CONTEXT_APPROVAL') {
              throw new Error(`Cannot approve context: agent is in state ${currentState}. Expected AWAITING_CONTEXT_APPROVAL.`);
            }

            // Get current status for context
            const status = SentinelFSM.getStatus();

            // Validate session if provided
            if (session_id && status.sessionId !== session_id) {
              throw new Error(`Session ID mismatch: expected ${status.sessionId}, got ${session_id}`);
            }

            // Store approval context
            lastApprovalContext = {
              type: 'context',
              session_id: status.sessionId,
              timestamp: Date.now()
            };

            // Emit approval event (SentinelFSM listens for this)
            EventBus.emit('user:approve:context', {
              approved: true,
              timestamp: Date.now(),
              session_id: status.sessionId,
              source: 'mcp'
            });

            logger.info('[WorkflowMCPServer] Context approved via MCP');

            return {
              success: true,
              action: 'context_approved',
              next_state: 'PLANNING_WITH_CONTEXT',
              message: 'Context approved. Agent will now plan changes.'
            };
          }
        },

        {
          name: 'approve_proposal',
          schema: {
            description: 'Approve the proposed changes (dogs.md bundle)',
            properties: {
              session_id: {
                type: 'string',
                description: 'Optional: session identifier for validation'
              }
            }
          },
          handler: async (args) => {
            const { session_id } = args;

            // Verify we're in the right state
            const currentState = SentinelFSM.getCurrentState();
            if (currentState !== 'AWAITING_PROPOSAL_APPROVAL') {
              throw new Error(`Cannot approve proposal: agent is in state ${currentState}. Expected AWAITING_PROPOSAL_APPROVAL.`);
            }

            // Get current status for context
            const status = SentinelFSM.getStatus();

            // Validate session if provided
            if (session_id && status.sessionId !== session_id) {
              throw new Error(`Session ID mismatch: expected ${status.sessionId}, got ${session_id}`);
            }

            // Store approval context
            lastApprovalContext = {
              type: 'proposal',
              session_id: status.sessionId,
              timestamp: Date.now()
            };

            // Emit approval event (SentinelFSM listens for this)
            EventBus.emit('user:approve:proposal', {
              approved: true,
              timestamp: Date.now(),
              session_id: status.sessionId,
              source: 'mcp'
            });

            logger.info('[WorkflowMCPServer] Proposal approved via MCP');

            return {
              success: true,
              action: 'proposal_approved',
              next_state: 'APPLYING_CHANGESET',
              message: 'Proposal approved. Agent will now apply changes.'
            };
          }
        },

        {
          name: 'reject_with_revision',
          schema: {
            description: 'Reject the current proposal and provide feedback for revision',
            properties: {
              feedback: {
                type: 'string',
                description: 'Feedback explaining what needs to be changed'
              },
              session_id: {
                type: 'string',
                description: 'Optional: session identifier for validation'
              }
            },
            required: ['feedback']
          },
          handler: async (args) => {
            const { feedback, session_id } = args;

            // Verify we're in an approval state
            const currentState = SentinelFSM.getCurrentState();
            if (currentState !== 'AWAITING_CONTEXT_APPROVAL' &&
                currentState !== 'AWAITING_PROPOSAL_APPROVAL') {
              throw new Error(`Cannot reject: agent is in state ${currentState}. Expected an AWAITING_*_APPROVAL state.`);
            }

            // Get current status
            const status = SentinelFSM.getStatus();

            // Validate session if provided
            if (session_id && status.sessionId !== session_id) {
              throw new Error(`Session ID mismatch: expected ${status.sessionId}, got ${session_id}`);
            }

            // Determine which rejection event to emit
            const eventName = currentState === 'AWAITING_CONTEXT_APPROVAL'
              ? 'user:reject:context'
              : 'user:reject:proposal';

            // Emit rejection event with feedback
            EventBus.emit(eventName, {
              rejected: true,
              feedback,
              timestamp: Date.now(),
              session_id: status.sessionId,
              source: 'mcp'
            });

            logger.info(`[WorkflowMCPServer] Rejected via MCP with feedback: ${feedback}`);

            // The FSM should transition back to PLANNING or CURATING based on which state we were in
            const nextState = currentState === 'AWAITING_CONTEXT_APPROVAL'
              ? 'CURATING_CONTEXT'
              : 'PLANNING_WITH_CONTEXT';

            return {
              success: true,
              action: 'rejected',
              next_state: nextState,
              feedback,
              message: `Rejected with feedback. Agent will revise and try again.`
            };
          }
        },

        // =================================================================
        // EMERGENCY CONTROLS
        // =================================================================
        {
          name: 'force_idle',
          schema: {
            description: 'Emergency control: Force agent back to IDLE state (use with caution)',
            properties: {
              reason: {
                type: 'string',
                description: 'Reason for forcing IDLE'
              }
            },
            required: ['reason']
          },
          handler: async (args) => {
            const { reason } = args;

            // Emit event to force transition to IDLE
            // This should be handled by SentinelFSM error handling
            EventBus.emit('workflow:force:idle', {
              reason,
              timestamp: Date.now(),
              source: 'mcp'
            });

            logger.warn(`[WorkflowMCPServer] Forced IDLE: ${reason}`);

            return {
              success: true,
              action: 'forced_idle',
              reason,
              message: 'Agent forced to IDLE state. Workflow stopped.'
            };
          }
        }
      ]
    });

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[WorkflowMCPServer] Initialized with ${server.listTools().length} tools`);

    // Listen to FSM events for better tracking
    if (EventBus) {
      EventBus.on('fsm:state:changed', (data) => {
        logger.debug('[WorkflowMCPServer] FSM state changed:', data);
      });
    }

    // Return server instance
    return server;
  }
};

export default WorkflowMCPServer;
