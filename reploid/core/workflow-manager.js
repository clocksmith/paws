// Workflow Manager - Manages multi-step agent tasks with context compaction
// Ensures agent takes one atomic action per iteration

const WorkflowManager = {
  metadata: {
    name: 'WorkflowManager',
    version: '1.0.0',
    dependencies: [],
    type: 'core'
  },

  factory: (deps) => {
    const MAX_CONTEXT_TOKENS = 8000; // ~32k chars
    const COMPACT_TO_TOKENS = 1000; // ~4k chars

    // Workflow states
    const WORKFLOW_STATES = {
      PLANNING: 'planning',
      EXECUTING: 'executing',
      VALIDATING: 'validating',
      COMPLETE: 'complete'
    };

    let currentWorkflow = null;
    let workflowHistory = [];

    // Create a new workflow from goal
    const createWorkflow = (goal) => {
      currentWorkflow = {
        goal,
        state: WORKFLOW_STATES.PLANNING,
        steps: [],
        currentStep: 0,
        contextSize: 0,
        createdAt: Date.now()
      };
      return currentWorkflow;
    };

    // Add a step to current workflow
    const addStep = (step) => {
      if (!currentWorkflow) {
        throw new Error('No active workflow');
      }

      currentWorkflow.steps.push({
        description: step.description,
        action: step.action, // 'read', 'write', 'tool', 'validate'
        params: step.params,
        status: 'pending',
        result: null
      });
    };

    // Get next step to execute
    const getNextStep = () => {
      if (!currentWorkflow) return null;

      if (currentWorkflow.currentStep >= currentWorkflow.steps.length) {
        return null; // Workflow complete
      }

      return currentWorkflow.steps[currentWorkflow.currentStep];
    };

    // Mark current step as complete
    const completeStep = (result) => {
      if (!currentWorkflow) return;

      const step = currentWorkflow.steps[currentWorkflow.currentStep];
      if (step) {
        step.status = 'completed';
        step.result = result;
        step.completedAt = Date.now();
      }

      currentWorkflow.currentStep++;
    };

    // Compact context when it gets too large
    const compactContext = (context) => {
      const totalTokens = estimateTokens(context);

      if (totalTokens < MAX_CONTEXT_TOKENS) {
        return { context, compacted: false };
      }

      console.log(`[WorkflowManager] Context too large (${totalTokens} tokens), compacting...`);

      // Create summary
      const summary = {
        goal: currentWorkflow?.goal || 'Unknown',
        completedSteps: currentWorkflow?.steps.filter(s => s.status === 'completed').length || 0,
        totalSteps: currentWorkflow?.steps.length || 0,
        keyDecisions: extractKeyDecisions(context),
        nextActions: extractNextActions(context),
        timestamp: Date.now()
      };

      // Create compacted context
      const compactedContext = [
        {
          role: 'system',
          content: `Context Summary (compacted from ${totalTokens} tokens):
Goal: ${summary.goal}
Progress: ${summary.completedSteps}/${summary.totalSteps} steps complete

Key Decisions Made:
${summary.keyDecisions.join('\n')}

Next Actions:
${summary.nextActions.join('\n')}

Continue from current step.`
        },
        // Keep last few messages for immediate context
        ...context.slice(-3)
      ];

      console.log(`[WorkflowManager] Compacted to ${estimateTokens(compactedContext)} tokens`);

      return { context: compactedContext, compacted: true, summary };
    };

    // Estimate token count
    const estimateTokens = (context) => {
      if (!context) return 0;
      const text = context.map(m => m.content).join(' ');
      return Math.ceil(text.length / 4);
    };

    // Extract key decisions from context
    const extractKeyDecisions = (context) => {
      const decisions = [];
      context.forEach(msg => {
        if (msg.role === 'assistant' && msg.content) {
          // Look for tool calls or important statements
          if (msg.content.includes('TOOL_CALL:')) {
            const match = msg.content.match(/TOOL_CALL: (\w+)/);
            if (match) {
              decisions.push(`- Called tool: ${match[1]}`);
            }
          }
          if (msg.content.includes('DONE:')) {
            decisions.push(`- Completed: ${msg.content.substring(0, 100)}`);
          }
        }
      });
      return decisions.slice(-5); // Last 5 decisions
    };

    // Extract next actions from context
    const extractNextActions = (context) => {
      const actions = [];
      const lastMsg = context[context.length - 1];

      if (lastMsg && lastMsg.content) {
        // Extract incomplete steps or next steps
        if (lastMsg.content.includes('next')) {
          actions.push('Continue with next planned step');
        }
      }

      // Add pending workflow steps
      if (currentWorkflow) {
        const pending = currentWorkflow.steps.slice(currentWorkflow.currentStep);
        pending.slice(0, 3).forEach(step => {
          actions.push(`- ${step.action}: ${step.description}`);
        });
      }

      return actions;
    };

    // Get workflow status
    const getStatus = () => {
      if (!currentWorkflow) {
        return { active: false };
      }

      return {
        active: true,
        goal: currentWorkflow.goal,
        state: currentWorkflow.state,
        progress: `${currentWorkflow.currentStep}/${currentWorkflow.steps.length}`,
        currentStep: getNextStep()
      };
    };

    return {
      createWorkflow,
      addStep,
      getNextStep,
      completeStep,
      compactContext,
      getStatus,
      estimateTokens
    };
  }
};

export default WorkflowManager;
