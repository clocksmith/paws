/**
 * @fileoverview Enhanced Sentinel FSM with REFLECTING state for REPLOID
 * Implements the complete Sentinel Agent cognitive cycle with automatic checkpoints.
 * Manages state transitions, user approvals, self-testing, and reflection learning.
 *
 * @blueprint 0x00005A
 * @module SentinelFSM
 * @version 2.3.0
 * @category agent
 */

const SentinelFSM = {
  metadata: {
    id: 'SentinelFSM',
    version: '2.2.0',
    dependencies: ['StateManager', 'ToolRunner', 'ApiClient', 'HybridLLMProvider', 'EventBus', 'Utils', 'SentinelTools', 'GitVFS', 'ReflectionStore?', 'SelfTester', 'WebRTCCoordinator?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, ToolRunner, ApiClient, HybridLLMProvider, EventBus, Utils, SentinelTools, GitVFS, ReflectionStore, SelfTester, WebRTCCoordinator } = deps;
    const { logger } = Utils;

    let currentState = 'IDLE';
    let cycleContext = null;
    let stateHistory = [];
    let reflectionInsights = [];

    // Define valid state transitions
    const validTransitions = {
      'IDLE': ['CURATING_CONTEXT'],
      'CURATING_CONTEXT': ['AWAITING_CONTEXT_APPROVAL', 'ERROR'],
      'AWAITING_CONTEXT_APPROVAL': ['PLANNING_WITH_CONTEXT', 'CURATING_CONTEXT', 'IDLE'],
      'PLANNING_WITH_CONTEXT': ['GENERATING_PROPOSAL', 'ERROR'],
      'GENERATING_PROPOSAL': ['AWAITING_PROPOSAL_APPROVAL', 'ERROR'],
      'AWAITING_PROPOSAL_APPROVAL': ['APPLYING_CHANGESET', 'PLANNING_WITH_CONTEXT', 'IDLE'],
      'APPLYING_CHANGESET': ['REFLECTING', 'ERROR'],
      'REFLECTING': ['IDLE', 'CURATING_CONTEXT'],
      'ERROR': ['IDLE']
    };

    // Update status UI
    const updateStatusUI = (state, detail = '', progress = null) => {
      const icons = {
        IDLE: '○',
        CURATING_CONTEXT: '⚙',
        AWAITING_CONTEXT_APPROVAL: '⏸',
        PLANNING_WITH_CONTEXT: '◐',
        GENERATING_PROPOSAL: '✎',
        AWAITING_PROPOSAL_APPROVAL: '⏸',
        APPLYING_CHANGESET: '▶',
        REFLECTING: '◐',
        ERROR: '⚠'
      };

      const descriptions = {
        IDLE: 'Waiting for goal',
        CURATING_CONTEXT: 'Selecting relevant files',
        AWAITING_CONTEXT_APPROVAL: 'Review context bundle',
        PLANNING_WITH_CONTEXT: 'Analyzing and planning changes',
        GENERATING_PROPOSAL: 'Creating change proposal',
        AWAITING_PROPOSAL_APPROVAL: 'Review proposed changes',
        APPLYING_CHANGESET: 'Applying approved changes',
        REFLECTING: 'Learning from outcome',
        ERROR: 'Error occurred'
      };

      const statusIcon = document.getElementById('status-icon');
      const statusState = document.getElementById('status-state');
      const statusDetail = document.getElementById('status-detail');
      const statusProgress = document.getElementById('status-progress');
      const progressFill = document.getElementById('progress-fill');

      if (statusIcon) statusIcon.textContent = icons[state] || '○';
      if (statusState) statusState.textContent = state;
      if (statusDetail) statusDetail.textContent = detail || descriptions[state];

      if (statusProgress && progressFill) {
        if (progress !== null && progress !== undefined) {
          statusProgress.style.display = 'block';
          progressFill.style.width = `${progress}%`;
        } else {
          statusProgress.style.display = 'none';
        }
      }

      // Emit event for other components to react
      EventBus.emit('status:updated', { state, detail, progress });
    };

    // Transition to a new state
    const transitionTo = (newState) => {
      const oldState = currentState;

      // Validate transition
      if (!validTransitions[currentState]?.includes(newState)) {
        logger.error(`[SentinelFSM] Invalid transition: ${currentState} -> ${newState}`);
        return false;
      }

      currentState = newState;
      stateHistory.push({
        from: oldState,
        to: newState,
        timestamp: Date.now(),
        context: { ...cycleContext }
      });

      // Update status UI
      updateStatusUI(newState);

      logger.info(`[SentinelFSM] State transition: ${oldState} -> ${newState}`);

      EventBus.emit('fsm:state:changed', {
        oldState,
        newState,
        context: cycleContext
      });

      return true;
    };

    // Start a new cycle with a goal
    const startCycle = async (goal) => {
      if (currentState !== 'IDLE') {
        logger.warn(`[SentinelFSM] Cannot start cycle in state: ${currentState}`);
        return false;
      }

      // Create new session
      const sessionId = await StateManager.sessionManager.createSession(goal);
      const turn = await StateManager.sessionManager.createTurn(sessionId);

      cycleContext = {
        goal,
        sessionId,
        turn,
        startTime: Date.now(),
        iterations: 0,
        maxIterations: 10
      };

      transitionTo('CURATING_CONTEXT');
      await executeState();

      return true;
    };

    // Execute the current state
    const executeState = async () => {
      logger.info(`[SentinelFSM] Executing state: ${currentState}`);

      try {
        switch (currentState) {
          case 'IDLE':
            await executeIdle();
            break;

          case 'CURATING_CONTEXT':
            await executeCuratingContext();
            break;

          case 'AWAITING_CONTEXT_APPROVAL':
            await executeAwaitingContextApproval();
            break;

          case 'PLANNING_WITH_CONTEXT':
            await executePlanningWithContext();
            break;

          case 'GENERATING_PROPOSAL':
            await executeGeneratingProposal();
            break;

          case 'AWAITING_PROPOSAL_APPROVAL':
            await executeAwaitingProposalApproval();
            break;

          case 'APPLYING_CHANGESET':
            await executeApplyingChangeset();
            break;

          case 'REFLECTING':
            await executeReflecting();
            break;

          case 'ERROR':
            await executeError();
            break;

          default:
            logger.error(`[SentinelFSM] Unknown state: ${currentState}`);
        }
      } catch (error) {
        logger.error(`[SentinelFSM] Error in state ${currentState}:`, {
          message: error.message,
          stack: error.stack,
          error: error.toString()
        });
        transitionTo('ERROR');
        await executeState();
      }
    };

    // State: IDLE
    const executeIdle = async () => {
      EventBus.emit('agent:idle');
      // Wait for a new goal
    };

    // State: CURATING_CONTEXT
    const executeCuratingContext = async () => {
      EventBus.emit('agent:curating', { goal: cycleContext.goal });
      updateStatusUI('CURATING_CONTEXT', 'Analyzing project files...');

      // Use AI to curate relevant files
      const relevantFiles = await SentinelTools.curateFilesWithAI(cycleContext.goal);
      updateStatusUI('CURATING_CONTEXT', `Found ${relevantFiles.length} relevant files`, 50);

      // Create cats bundle
      const result = await SentinelTools.createCatsBundle({
        file_paths: relevantFiles,
        reason: `Context for goal: ${cycleContext.goal}`,
        turn_path: cycleContext.turn.context_path,
        ai_curate: true
      });

      if (result.success) {
        cycleContext.catsPath = result.path;
        transitionTo('AWAITING_CONTEXT_APPROVAL');
        await executeState();
      } else {
        throw new Error('Failed to create context bundle');
      }
    };

    // State: AWAITING_CONTEXT_APPROVAL
    const executeAwaitingContextApproval = async () => {
      // Emit full context object so UI can read the file
      EventBus.emit('agent:awaiting:context', cycleContext);

      // Check if auto-approve is enabled (session-level only for now)
      const sessionAutoApprove = typeof localStorage !== 'undefined' && localStorage.getItem('SESSION_AUTO_APPROVE') === 'true';
      const globalAutoApprove = typeof localStorage !== 'undefined' && localStorage.getItem('GLOBAL_AUTO_APPROVE') === 'true';

      if (globalAutoApprove || sessionAutoApprove) {
        logger.info('[SentinelFSM] Auto-approving context (auto-approve enabled)');
        // Auto-approve immediately to avoid async issues
        transitionTo('PLANNING_WITH_CONTEXT');
        executeState();
        return;
      }

      // Store listener references for cleanup
      const listeners = {
        approval: null,
        rejection: null,
        revision: null,
        timeout: null
      };

      const cleanupListeners = () => {
        if (listeners.approval) EventBus.off('user:approve:context', listeners.approval);
        if (listeners.rejection) EventBus.off('user:reject:context', listeners.rejection);
        if (listeners.revision) EventBus.off('user:revise:context', listeners.revision);
        if (listeners.timeout) clearTimeout(listeners.timeout);
        listeners.approval = null;
        listeners.rejection = null;
        listeners.revision = null;
        listeners.timeout = null;
      };

      // Set up approval handlers
      listeners.approval = () => {
        cleanupListeners();
        transitionTo('PLANNING_WITH_CONTEXT');
        executeState();
      };

      listeners.rejection = () => {
        cleanupListeners();
        transitionTo('IDLE');
        executeState();
      };

      listeners.revision = (data) => {
        cleanupListeners();
        cycleContext.revisionRequest = data.feedback;
        transitionTo('CURATING_CONTEXT');
        executeState();
      };

      EventBus.on('user:approve:context', listeners.approval);
      EventBus.on('user:reject:context', listeners.rejection);
      EventBus.on('user:revise:context', listeners.revision);

      // Timeout after 5 minutes
      listeners.timeout = setTimeout(() => {
        if (currentState === 'AWAITING_CONTEXT_APPROVAL') {
          logger.warn('[SentinelFSM] Context approval timeout');
          cleanupListeners();
          transitionTo('IDLE');
          executeState();
        }
      }, 300000);
    };

    // State: PLANNING_WITH_CONTEXT
    const executePlanningWithContext = async () => {
      EventBus.emit('agent:planning');

      // Load approved context
      const catsContent = await StateManager.getArtifactContent(cycleContext.catsPath);

      // Add reflection insights to prompt if available
      let reflectionContext = '';
      if (reflectionInsights.length > 0) {
        reflectionContext = '\n\nPrevious insights from reflection:\n' +
          reflectionInsights.slice(-3).map(i => `- ${i}`).join('\n');
      }

      // Generate prompt with context
      const prompt = `Your goal is to: ${cycleContext.goal}

Context Bundle (existing files that may be relevant):
${catsContent}
${reflectionContext}

Instructions:
1. Analyze the context to understand what already exists
2. Determine what files need to be CREATED, MODIFIED, or DELETED to achieve the goal
3. Generate COMPLETE, working code for each file
4. If creating something new (like 3D graphics), create ALL necessary files with full implementations
5. Don't reference external libraries unless they're already in the context
6. Make sure your code is production-ready and fully functional

Now generate your complete implementation to achieve this goal.`;

      cycleContext.planPrompt = prompt;
      transitionTo('GENERATING_PROPOSAL');
      await executeState();
    };

    // State: GENERATING_PROPOSAL
    const executeGeneratingProposal = async () => {
      EventBus.emit('agent:generating');

      // Send prompt to LLM using HybridLLMProvider for local/cloud inference
      const response = await HybridLLMProvider.complete([{
        role: 'system',
        content: `You are a Sentinel Agent that generates structured code change proposals.

CRITICAL: You MUST output your changes in the following exact markdown format:

## CREATE: /vfs/path/to/newfile.js
\`\`\`javascript
// Full content of the new file
console.log('This is the complete file content');
\`\`\`

## MODIFY: /vfs/path/to/existing.js
\`\`\`javascript
// Full updated content of the file
// Include ALL lines, not just what changed
\`\`\`

## DELETE: /vfs/path/to/oldfile.js

IMPORTANT RULES:
1. Start each change with ## followed by CREATE, MODIFY, or DELETE
2. Use /vfs/ prefix for all file paths
3. For CREATE and MODIFY, include the COMPLETE file content in code blocks
4. Use appropriate language identifiers (javascript, html, css, etc.) after \`\`\`
5. You can include a brief explanation before the changes, but changes MUST be in this format
6. Generate COMPLETE, working code - don't use placeholders or "..." to skip sections

ADVANCED CAPABILITY - TOOL CREATION:
You can create custom tools using the create_dynamic_tool function. Example:

## CREATE: /vfs/tools/log_tool.js
\`\`\`javascript
create_dynamic_tool({
  name: 'log_message',
  description: 'Logs a message to the agent console',
  inputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'The message to log' }
    },
    required: ['message']
  },
  implementation: {
    type: 'javascript',
    code: 'console.log(\`AGENT: \${args.message}\`); return "Message logged";'
  }
});
\`\`\`

Implementation types: javascript (simple logic), composite (chain tools), workflow (complex automation).
Create tools only when existing ones are insufficient for your goal.

Now generate your proposal:`
      }, {
        role: 'user',
        content: cycleContext.planPrompt
      }], {
        temperature: 0.7,
        maxOutputTokens: 32768  // Increased from 16384 to prevent MAX_TOKENS errors
      });

      // Parse response for proposed changes
      const changes = parseProposedChanges(response.text);

      // Create dogs bundle
      const result = await SentinelTools.createDogsBundle({
        changes,
        turn_path: cycleContext.turn.dogs_path,
        summary: `Proposal for: ${cycleContext.goal}`
      });

      if (result.success) {
        cycleContext.dogsPath = result.path;
        cycleContext.proposedChanges = changes;
        transitionTo('AWAITING_PROPOSAL_APPROVAL');
        await executeState();
      } else {
        throw new Error('Failed to create proposal bundle');
      }
    };

    // State: AWAITING_PROPOSAL_APPROVAL
    const executeAwaitingProposalApproval = async () => {
      // Show diff viewer
      EventBus.emit('diff:show', {
        dogs_path: cycleContext.dogsPath,
        session_id: cycleContext.sessionId,
        turn: cycleContext.turn
      });

      // Set up approval handlers
      // Store listener references for cleanup
      const listeners = {
        approval: null,
        cancellation: null,
        edit: null,
        timeout: null
      };

      const cleanupListeners = () => {
        if (listeners.approval) EventBus.off('proposal:approved', listeners.approval);
        if (listeners.cancellation) EventBus.off('proposal:cancelled', listeners.cancellation);
        if (listeners.edit) EventBus.off('proposal:edit', listeners.edit);
        if (listeners.timeout) clearTimeout(listeners.timeout);
        listeners.approval = null;
        listeners.cancellation = null;
        listeners.edit = null;
        listeners.timeout = null;
      };

      listeners.approval = (data) => {
        cleanupListeners();
        cycleContext.approvedChanges = data.approved_changes;
        cycleContext.filteredDogsPath = data.filtered_dogs_path;
        transitionTo('APPLYING_CHANGESET');
        executeState();
      };

      listeners.cancellation = () => {
        cleanupListeners();
        transitionTo('IDLE');
        executeState();
      };

      listeners.edit = (data) => {
        cleanupListeners();
        cycleContext.editRequest = data;
        transitionTo('PLANNING_WITH_CONTEXT');
        executeState();
      };

      EventBus.on('proposal:approved', listeners.approval);
      EventBus.on('proposal:cancelled', listeners.cancellation);
      EventBus.on('proposal:edit', listeners.edit);

      // Timeout after 10 minutes
      listeners.timeout = setTimeout(() => {
        if (currentState === 'AWAITING_PROPOSAL_APPROVAL') {
          logger.warn('[SentinelFSM] Proposal approval timeout');
          cleanupListeners();
          transitionTo('IDLE');
          executeState();
        }
      }, 600000);
    };

    // State: APPLYING_CHANGESET
    const executeApplyingChangeset = async () => {
      EventBus.emit('agent:applying');

      const dogsPath = cycleContext.filteredDogsPath || cycleContext.dogsPath;

      // Create checkpoint before applying changes (Auto-save milestone)
      if (GitVFS && GitVFS.isInitialized()) {
        try {
          logger.info('[SentinelFSM] Creating pre-apply checkpoint...');
          updateStatusUI('APPLYING_CHANGESET', 'Creating safety checkpoint...', null);

          const checkpoint = await GitVFS.createCheckpoint(
            `Pre-apply: ${cycleContext.goal.substring(0, 100)}`
          );
          cycleContext.preApplyCheckpoint = checkpoint;

          logger.info(`[SentinelFSM] Pre-apply checkpoint created: ${checkpoint.id}`);
        } catch (err) {
          logger.warn('[SentinelFSM] Failed to create pre-apply checkpoint:', err);
          // Don't block on checkpoint failure
        }
      }

      // Run self-tests before applying changes (Safe RSI)
      if (SelfTester) {
        try {
          logger.info('[SentinelFSM] Running pre-apply validation tests...');
          updateStatusUI('APPLYING_CHANGESET', 'Running validation tests...', null);

          const testResults = await SelfTester.runAllTests();

          // Check if tests pass (success rate >= 80%)
          if (testResults.summary.successRate < 80) {
            logger.error('[SentinelFSM] Pre-apply tests failed:', testResults.summary);
            updateStatusUI('ERROR', `Validation failed: ${testResults.summary.successRate.toFixed(1)}% pass rate`, null);

            // Store failed validation in cycle context
            cycleContext.validationFailed = true;
            cycleContext.testResults = testResults;

            // Emit event for UI update
            EventBus.emit('agent:validation:failed', testResults);

            transitionTo('ERROR');
            await executeState();
            return;
          }

          logger.info(`[SentinelFSM] Pre-apply validation passed: ${testResults.summary.successRate.toFixed(1)}%`);
          cycleContext.testResults = testResults;

        } catch (err) {
          logger.warn('[SentinelFSM] Self-test failed with error (proceeding anyway):', err);
          // Don't block on test errors, just log them
        }
      }

      // Apply the approved changes
      updateStatusUI('APPLYING_CHANGESET', 'Applying changes...', null);
      const result = await SentinelTools.applyDogsBundle({
        dogs_path: dogsPath,
        session_id: cycleContext.sessionId,
        verify_command: cycleContext.verifyCommand
      });

      cycleContext.applyResult = result;

      if (result.success) {
        // Commit to Git VFS
        if (GitVFS && GitVFS.isInitialized()) {
          await GitVFS.commitChanges(
            `Applied ${result.changes_applied.length} changes for: ${cycleContext.goal}`,
            {
              session: cycleContext.sessionId,
              turn: cycleContext.turn.turn,
              checkpoint: result.checkpoint
            }
          );

          // Create post-apply checkpoint on successful cycle (Auto-save milestone)
          try {
            logger.info('[SentinelFSM] Creating post-apply checkpoint...');
            const postCheckpoint = await GitVFS.createCheckpoint(
              `Success: Applied ${result.changes_applied.length} changes - ${cycleContext.goal.substring(0, 80)}`
            );
            cycleContext.postApplyCheckpoint = postCheckpoint;
            logger.info(`[SentinelFSM] Post-apply checkpoint created: ${postCheckpoint.id}`);
          } catch (err) {
            logger.warn('[SentinelFSM] Failed to create post-apply checkpoint:', err);
          }
        }

        transitionTo('REFLECTING');
      } else {
        logger.error('[SentinelFSM] Failed to apply changes:', result.message);
        transitionTo('ERROR');
      }

      await executeState();
    };

    // State: REFLECTING
    const executeReflecting = async () => {
      EventBus.emit('agent:reflecting');

      // Analyze the outcome of this cycle
      const reflection = await performReflection();

      // Store insights for future cycles
      reflectionInsights.push(reflection.insight);

      // Log reflection
      logger.info(`[SentinelFSM] Reflection: ${reflection.insight}`);

      // Save reflection to persistent store (IndexedDB)
      if (ReflectionStore) {
        try {
          const reflectionData = {
            outcome: reflection.outcome,
            category: 'cycle_completion',
            description: reflection.insight,
            sessionId: cycleContext.sessionId,
            turn: cycleContext.turn.turn,
            goal: cycleContext.goal,
            metrics: {
              duration: reflection.metrics.duration,
              changesApplied: reflection.metrics.changesApplied,
              totalProposed: reflection.metrics.totalProposed,
              successRate: reflection.metrics.successRate
            },
            recommendations: reflection.recommendations,
            tags: [
              reflection.outcome,
              `turn_${cycleContext.turn.turn}`,
              reflection.metrics.successRate >= 80 ? 'high_success' :
              reflection.metrics.successRate >= 50 ? 'medium_success' : 'low_success'
            ]
          };

          if (ReflectionStore) {
            const reflectionId = await ReflectionStore.addReflection(reflectionData);
            logger.info(`[SentinelFSM] Reflection stored with ID: ${reflectionId}`);
          }

          // Share successful reflections with swarm
          if (WebRTCCoordinator && reflectionData.outcome === 'successful') {
            try {
              const peersShared = await WebRTCCoordinator.shareSuccessPattern(reflectionData);
              if (peersShared > 0) {
                logger.info(`[SentinelFSM] Shared successful pattern with ${peersShared} peers`);
              }
            } catch (swarmErr) {
              logger.debug('[SentinelFSM] Could not share with swarm:', swarmErr.message);
            }
          }
        } catch (err) {
          logger.error('[SentinelFSM] Failed to store reflection:', err);
        }
      }

      // Save reflection to session (markdown file)
      const reflectionPath = `/sessions/${cycleContext.sessionId}/reflection-${cycleContext.turn.turn}.md`;
      await StateManager.createArtifact(reflectionPath, 'markdown',
        `# Reflection for Turn ${cycleContext.turn.turn}\n\n` +
        `**Goal:** ${cycleContext.goal}\n\n` +
        `**Outcome:** ${reflection.outcome}\n\n` +
        `**Insight:** ${reflection.insight}\n\n` +
        `**Recommendations:**\n${reflection.recommendations.map(r => `- ${r}`).join('\n')}\n\n` +
        `**Metrics:**\n` +
        `- Duration: ${reflection.metrics.duration}ms\n` +
        `- Changes Applied: ${reflection.metrics.changesApplied}\n` +
        `- Success Rate: ${reflection.metrics.successRate}%\n`,
        'Cycle reflection'
      );

      // Determine next action based on reflection
      if (reflection.shouldContinue && cycleContext.iterations < cycleContext.maxIterations) {
        // Continue with refined goal
        cycleContext.goal = reflection.refinedGoal || cycleContext.goal;
        cycleContext.iterations++;

        // Create new turn
        cycleContext.turn = await StateManager.sessionManager.createTurn(cycleContext.sessionId);

        transitionTo('CURATING_CONTEXT');
        await executeState();
      } else {
        // Cycle complete
        EventBus.emit('cycle:complete', {
          session_id: cycleContext.sessionId,
          iterations: cycleContext.iterations,
          reflection
        });

        transitionTo('IDLE');
        await executeState();
      }
    };

    // State: ERROR
    const executeError = async () => {
      EventBus.emit('agent:error', {
        state: stateHistory[stateHistory.length - 1],
        context: cycleContext
      });

      // Log error details
      logger.error('[SentinelFSM] Error state reached', {
        previous_state: stateHistory[stateHistory.length - 2],
        context: cycleContext
      });

      // Clean up and return to IDLE
      cycleContext = null;
      transitionTo('IDLE');
    };

    // Perform reflection analysis
    const performReflection = async () => {
      const duration = Date.now() - cycleContext.startTime;
      const applyResult = cycleContext.applyResult || {};

      // Analyze the results
      const changesApplied = applyResult.changes_applied?.length || 0;
      const totalProposed = cycleContext.proposedChanges?.length || 0;
      const successRate = totalProposed > 0 ? (changesApplied / totalProposed * 100) : 0;

      // Generate insight using patterns from history
      const patterns = analyzePatterns();

      // Determine if we should continue
      const shouldContinue = successRate > 50 && cycleContext.iterations < 3;

      // Generate recommendations
      const recommendations = generateRecommendations(patterns, successRate);

      // Build reflection object
      const reflection = {
        outcome: applyResult.success ? 'successful' : 'failed',
        insight: generateInsight(patterns, successRate),
        recommendations,
        shouldContinue,
        refinedGoal: shouldContinue ? refineGoal(cycleContext.goal, patterns) : null,
        metrics: {
          duration,
          changesApplied,
          totalProposed,
          successRate
        }
      };

      // Learn from this experience
      await updateLearningModel(reflection);

      return reflection;
    };

    // Analyze patterns from state history
    const analyzePatterns = () => {
      const patterns = {
        averageContextSize: 0,
        commonFailurePoints: [],
        successfulStrategies: [],
        timeSpentInStates: {}
      };

      // Analyze state durations
      for (let i = 1; i < stateHistory.length; i++) {
        const duration = stateHistory[i].timestamp - stateHistory[i - 1].timestamp;
        const state = stateHistory[i - 1].to;
        patterns.timeSpentInStates[state] = (patterns.timeSpentInStates[state] || 0) + duration;
      }

      // Identify bottlenecks
      const totalTime = Date.now() - cycleContext.startTime;
      for (const [state, time] of Object.entries(patterns.timeSpentInStates)) {
        if (time / totalTime > 0.3) {
          patterns.commonFailurePoints.push(`Bottleneck in ${state}`);
        }
      }

      return patterns;
    };

    // Generate insight from patterns
    const generateInsight = (patterns, successRate) => {
      if (successRate === 100) {
        return 'All proposed changes were successfully applied. The context curation was highly effective.';
      } else if (successRate > 75) {
        return 'Most changes were applied successfully. Minor adjustments to the proposal process could improve results.';
      } else if (successRate > 50) {
        return 'Moderate success rate. Consider refining the context selection or breaking down complex changes.';
      } else if (successRate > 0) {
        return 'Low success rate indicates misalignment between goal and approach. Significant strategy revision needed.';
      } else {
        return 'No changes were applied. The approach needs fundamental reconsideration.';
      }
    };

    // Generate recommendations based on patterns
    const generateRecommendations = (patterns, successRate) => {
      const recommendations = [];

      if (patterns.commonFailurePoints.length > 0) {
        recommendations.push(`Address identified bottlenecks: ${patterns.commonFailurePoints.join(', ')}`);
      }

      if (successRate < 50) {
        recommendations.push('Break down complex changes into smaller, atomic operations');
        recommendations.push('Improve context curation to include more relevant files');
      }

      if (patterns.timeSpentInStates['AWAITING_CONTEXT_APPROVAL'] > 60000) {
        recommendations.push('Optimize context bundle size for faster review');
      }

      if (patterns.timeSpentInStates['AWAITING_PROPOSAL_APPROVAL'] > 120000) {
        recommendations.push('Generate more concise, focused proposals');
      }

      return recommendations;
    };

    // Refine goal based on learnings
    const refineGoal = (originalGoal, patterns) => {
      // This would use more sophisticated NLP in production
      if (patterns.commonFailurePoints.length > 0) {
        return `${originalGoal} (focusing on addressing ${patterns.commonFailurePoints[0]})`;
      }
      return originalGoal;
    };

    // Update learning model (placeholder for ML integration)
    const updateLearningModel = async (reflection) => {
      // Store learning data for future analysis
      const learningPath = `/sessions/${cycleContext.sessionId}/learning.json`;
      const existingData = await StateManager.getArtifactContent(learningPath);
      const learningData = existingData ? JSON.parse(existingData) : { episodes: [] };

      learningData.episodes.push({
        timestamp: Date.now(),
        goal: cycleContext.goal,
        outcome: reflection.outcome,
        metrics: reflection.metrics,
        insight: reflection.insight
      });

      await StateManager.updateArtifact(learningPath, JSON.stringify(learningData, null, 2));
    };

    // Parse proposed changes from LLM response
    const parseProposedChanges = (content) => {
      const changes = [];

      // Expected format:
      // ## CREATE: /path/to/file.js
      // ```javascript
      // file content here
      // ```
      //
      // ## MODIFY: /path/to/file.js
      // ```javascript
      // updated content
      // ```
      //
      // ## DELETE: /path/to/file.js

      const regex = /##\s+(CREATE|MODIFY|DELETE):\s+([^\n]+)(?:\n```[\w]*\n([\s\S]*?)```)?/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        const [, operation, filePath, fileContent] = match;

        const change = {
          operation: operation.trim(),
          file_path: filePath.trim(),
          new_content: operation === 'DELETE' ? null : (fileContent || '').trim()
        };

        // Validate the change
        if (change.file_path) {
          // Ensure path starts with /vfs/ or convert it
          if (!change.file_path.startsWith('/vfs/')) {
            change.file_path = '/vfs/' + change.file_path.replace(/^\/+/, '');
          }

          changes.push(change);
        } else {
          logger.warn('[SentinelFSM] Skipping change with invalid file path:', operation);
        }
      }

      if (changes.length === 0) {
        logger.warn('[SentinelFSM] No changes parsed from proposal. Content:', content.substring(0, 200));
      } else {
        logger.info(`[SentinelFSM] Parsed ${changes.length} changes from proposal`);
      }

      return changes;
    };

    // Get current FSM status
    const getStatus = () => {
      return {
        currentState,
        cycleContext,
        stateHistory: stateHistory.slice(-10),
        reflectionInsights: reflectionInsights.slice(-5)
      };
    };

    // Pause the current cycle
    const pauseCycle = () => {
      if (currentState !== 'IDLE' && currentState !== 'ERROR') {
        logger.info('[SentinelFSM] Cycle paused');
        EventBus.emit('cycle:paused', { state: currentState, context: cycleContext });
        return true;
      }
      return false;
    };

    // Resume a paused cycle
    const resumeCycle = async () => {
      if (currentState !== 'IDLE' && cycleContext) {
        logger.info('[SentinelFSM] Resuming cycle');
        EventBus.emit('cycle:resumed', { state: currentState, context: cycleContext });
        await executeState();
        return true;
      }
      return false;
    };

    // Web Component Widget
    class SentinelFSMWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every second when active
        this._interval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const isActive = currentState !== 'IDLE' && currentState !== 'ERROR';
        const cycleNum = stateHistory.length > 0 ? Math.floor(stateHistory.length / 9) + 1 : 0;

        return {
          state: isActive ? 'active' : (currentState === 'ERROR' ? 'error' : 'idle'),
          primaryMetric: `State: ${currentState}`,
          secondaryMetric: cycleContext ? `Cycle: ${cycleNum}` : 'No active cycle',
          lastActivity: stateHistory.length > 0 ? stateHistory[stateHistory.length - 1].timestamp : null,
          message: currentState === 'ERROR' ? 'FSM encountered an error' : null
        };
      }

      getControls() {
        const controls = [];

        if (currentState === 'IDLE') {
          controls.push({
            id: 'test-cycle',
            label: '▶ Test Cycle',
            action: () => {
              startCycle('Test goal: Verify FSM functionality');
              this.render();
              return { success: true, message: 'Test cycle started' };
            }
          });
        } else if (currentState !== 'ERROR') {
          controls.push({
            id: 'pause',
            label: '⏸ Pause',
            action: () => {
              pauseCycle();
              this.render();
              return { success: true, message: 'Cycle paused' };
            }
          });
        }

        controls.push({
          id: 'reset',
          label: '↻ Reset History',
          action: () => {
            stateHistory = [];
            reflectionInsights = [];
            this.render();
            return { success: true, message: 'History cleared' };
          }
        });

        return controls;
      }

      render() {
        const cycleNum = stateHistory.length > 0 ? Math.floor(stateHistory.length / 9) + 1 : 0;
        const recentTransitions = stateHistory.slice(-20).reverse();

        // State icons mapping
        const stateIcons = {
          IDLE: '○',
          CURATING_CONTEXT: '⚙',
          AWAITING_CONTEXT_APPROVAL: '⏸',
          PLANNING_WITH_CONTEXT: '◐',
          GENERATING_PROPOSAL: '✎',
          AWAITING_PROPOSAL_APPROVAL: '⏸',
          APPLYING_CHANGESET: '▶',
          REFLECTING: '◐',
          ERROR: '⚠'
        };

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }
            .sentinel-fsm-panel {
              padding: 12px;
              color: #fff;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }
            .fsm-current-state {
              margin-bottom: 20px;
            }
            .fsm-state-icon {
              font-size: 48px;
              text-align: center;
              margin: 20px 0;
            }
            .fsm-state-name {
              text-align: center;
              font-size: 20px;
              font-weight: bold;
              margin-bottom: 10px;
            }
            .fsm-cycle-info {
              text-align: center;
              color: #888;
              margin-bottom: 20px;
            }
            .no-cycle {
              text-align: center;
              color: #888;
              margin-bottom: 20px;
            }
            .fsm-statistics {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 10px;
              margin-bottom: 20px;
            }
            .stat-card {
              background: rgba(255,255,255,0.05);
              padding: 10px;
              border-radius: 5px;
            }
            .stat-label {
              color: #888;
              font-size: 12px;
            }
            .stat-value {
              font-size: 24px;
              font-weight: bold;
            }
            .fsm-transitions {
              margin-top: 20px;
            }
            .transition-list {
              max-height: 300px;
              overflow-y: auto;
            }
            .transition-item {
              padding: 8px;
              border-left: 3px solid #0ff;
              margin-bottom: 8px;
              background: rgba(0,255,255,0.05);
            }
            .transition-item-header {
              font-weight: bold;
            }
            .transition-item-time {
              font-size: 12px;
              color: #888;
            }
            .no-transitions {
              color: #888;
              padding: 20px;
              text-align: center;
            }
            .fsm-insights {
              margin-top: 20px;
            }
            .insights-list {
              max-height: 200px;
              overflow-y: auto;
            }
            .insight-item {
              padding: 8px;
              border-left: 3px solid #ba68c8;
              margin-bottom: 8px;
              background: rgba(186,104,200,0.05);
            }
          </style>
          <div class="sentinel-fsm-panel">
            <div class="fsm-current-state">
              <div class="fsm-state-icon">${stateIcons[currentState] || '○'}</div>
              <div class="fsm-state-name">${currentState}</div>
              ${cycleContext ? `
                <div class="fsm-cycle-info">
                  <div><strong>Goal:</strong> ${cycleContext.goal}</div>
                  <div><strong>Cycle:</strong> ${cycleNum}</div>
                  <div><strong>Iterations:</strong> ${cycleContext.iterations} / ${cycleContext.maxIterations}</div>
                </div>
              ` : '<div class="no-cycle">No active cycle</div>'}
            </div>

            <div class="fsm-statistics">
              <div class="stat-card">
                <div class="stat-label">Total Transitions</div>
                <div class="stat-value">${stateHistory.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Insights Learned</div>
                <div class="stat-value">${reflectionInsights.length}</div>
              </div>
            </div>

            <div class="fsm-transitions">
              <h4>Recent Transitions (${recentTransitions.length})</h4>
              <div class="transition-list">
                ${recentTransitions.length > 0 ? recentTransitions.map(t => {
                  const time = new Date(t.timestamp).toLocaleTimeString();
                  return `
                    <div class="transition-item">
                      <div class="transition-item-header">${t.from} → ${t.to}</div>
                      <div class="transition-item-time">${time}</div>
                    </div>
                  `;
                }).join('') : '<div class="no-transitions">No transitions yet</div>'}
              </div>
            </div>

            ${reflectionInsights.length > 0 ? `
              <div class="fsm-insights">
                <h4>Recent Insights</h4>
                <div class="insights-list">
                  ${reflectionInsights.slice(-5).reverse().map(insight => `
                    <div class="insight-item">${insight}</div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'sentinel-fsm-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, SentinelFSMWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'Sentinel FSM',
      icon: '⚙',
      category: 'agent'
    };

    // Export public API
    return {
      api: {
        startCycle,
        getStatus,
        pauseCycle,
        resumeCycle,
        getCurrentState: () => currentState,
        getStateHistory: () => stateHistory,
        getReflectionInsights: () => reflectionInsights
      },
      widget
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(SentinelFSM);
}

export default SentinelFSM;
