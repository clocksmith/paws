const CycleLogic = {
  metadata: {
    id: 'CycleLogic',
    version: '3.1.0', // Sentinel FSM + Curator Mode
    dependencies: ['config', 'Utils', 'Storage', 'StateManager', 'ApiClient', 'HybridLLMProvider', 'ToolRunner', 'AgentLogicPureHelpers', 'EventBus', 'Persona', 'AutonomousOrchestrator?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { config, Utils, Storage, StateManager, ApiClient, HybridLLMProvider, ToolRunner, AgentLogicPureHelpers, EventBus, Persona, AutonomousOrchestrator } = deps;
    const { logger, Errors } = Utils;
    const { ApplicationError, AbortError } = Errors;

    let currentState = 'IDLE';
    let cycleContext = {};

    // Check if Curator Mode is active
    const isCuratorMode = () => AutonomousOrchestrator && AutonomousOrchestrator.isRunning();

    const transitionTo = (newState, contextUpdate = {}) => {
        logger.info(`[FSM] Transitioning from ${currentState} to ${newState}`);
        currentState = newState;
        cycleContext = { ...cycleContext, ...contextUpdate };
        EventBus.emit('agent:state:change', { newState, context: cycleContext });
        // The cycle is now driven by external events (UI clicks) or agent tool calls, not an auto-running loop.
    };

    const startCycle = async (goal) => {
        if (currentState !== 'IDLE') return;
        
        const sessionId = await StateManager.createSession(goal);
        const turn = await StateManager.createTurn(sessionId);

        cycleContext = { goal, sessionId, turn };
        EventBus.emit('cycle:start', { goal, sessionId });
        transitionTo('CURATING_CONTEXT');
        
        // Agent's first action is to determine context.
        await agentActionCurateContext();
    };

    const agentActionCurateContext = async () => {
        // This is a simplified version of the `cats --ai-curate` logic.
        // A real implementation would use the LLM to rank files.
        EventBus.emit('agent:thought', 'I need to determine the context for this task. I will look for relevant files.');
        const allFiles = await StateManager.getAllArtifactMetadata();
        const relevantFiles = Object.keys(allFiles).filter(path => path.includes('ui') || path.includes('agent'));

        await ToolRunner.runTool('create_cats_bundle', {
            file_paths: relevantFiles,
            reason: "Initial scan for relevant UI and agent logic files.",
            turn_path: cycleContext.turn.cats_path
        });

        // Auto-approve context if in Curator Mode
        if (isCuratorMode()) {
            logger.info('[Curator] Auto-approving context');
            transitionTo('PLANNING_WITH_CONTEXT');
            await agentActionPlanWithContext();
        } else {
            transitionTo('AWAITING_CONTEXT_APPROVAL');
        }
    };

    const userApprovedContext = async () => {
        if (currentState !== 'AWAITING_CONTEXT_APPROVAL') return;
        transitionTo('PLANNING_WITH_CONTEXT');
        await agentActionPlanWithContext();
    };

    const agentActionPlanWithContext = async () => {
        EventBus.emit('agent:thought', 'The context has been approved. I will now formulate a plan to achieve the goal.');
        const catsContent = await StateManager.getArtifactContent(cycleContext.turn.cats_path);
        const prompt = `Based on the following context, your goal is: ${cycleContext.goal}.\n\n${catsContent}\n\nPropose a set of changes using the create_dogs_bundle tool.`;

        // Use HybridLLMProvider for local/cloud inference
        const response = await HybridLLMProvider.complete([{
            role: 'system',
            content: 'You are a Sentinel Agent. Generate structured change proposals.'
        }, {
            role: 'user',
            content: prompt
        }], {
            temperature: 0.7,
            maxOutputTokens: 8192
        });

        // Parse LLM response for changes (simplified - real implementation would parse response.text)
        const fakeLlmResponse = {
            changes: [
                { file_path: '/upgrades/ui-style.css', operation: 'MODIFY', new_content: '/* Dark mode styles */' },
                { file_path: '/upgrades/ui-dashboard.html', operation: 'MODIFY', new_content: '<button id="dark-mode-toggle">Toggle Dark Mode</button>' }
            ]
        };

        await ToolRunner.runTool('create_dogs_bundle', {
            changes: fakeLlmResponse.changes,
            turn_path: cycleContext.turn.dogs_path
        });

        // In Curator Mode, NEVER auto-approve proposals (safety)
        // Always wait for human review
        transitionTo('AWAITING_PROPOSAL_APPROVAL');
    };

    const userApprovedProposal = async () => {
        if (currentState !== 'AWAITING_PROPOSAL_APPROVAL') return;
        transitionTo('APPLYING_CHANGESET');
        await agentActionApplyChanges();
    };

    const agentActionApplyChanges = async () => {
        EventBus.emit('agent:thought', 'The proposal has been approved. I will now apply the changes.');
        const result = await ToolRunner.runTool('apply_dogs_bundle', {
            dogs_path: cycleContext.turn.dogs_path
        });

        if (result.success) {
            EventBus.emit('cycle:complete');
            transitionTo('IDLE');
        } else {
            // In a real scenario, we'd get the verification failure log.
            EventBus.emit('agent:error', { message: 'Verification failed. Returning to planning.' });
            transitionTo('PLANNING_WITH_CONTEXT');
            await agentActionPlanWithContext(); // Retry planning
        }
    };

    // External triggers
    EventBus.on('goal:set', startCycle);
    EventBus.on('user:approve:context', userApprovedContext);
    EventBus.on('user:approve:proposal', userApprovedProposal);

    return {
      api: {
        // The public API is now minimal, driven by events.
        getCurrentState: () => currentState,
      }
    };
  }
};
