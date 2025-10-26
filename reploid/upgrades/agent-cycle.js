// @blueprint 0x000008 - Provides the model for the agent's primary 'think-act' loop.
const CycleLogic = {
  metadata: {
    id: 'CycleLogic',
    version: '3.1.0', // Sentinel FSM + Curator Mode
    dependencies: ['config', 'Utils', 'Storage', 'StateManager', 'ApiClient', 'HybridLLMProvider', 'ToolRunner', 'AgentLogicPureHelpers', 'EventBus', 'Persona?', 'AutonomousOrchestrator?'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { config, Utils, Storage, StateManager, ApiClient, HybridLLMProvider, ToolRunner, AgentLogicPureHelpers, EventBus, Persona, AutonomousOrchestrator } = deps;
    const { logger, Errors } = Utils;
    const { ApplicationError, AbortError } = Errors;

    let currentState = 'IDLE';
    let cycleContext = {};

    // Widget tracking state
    const _stateTransitionHistory = [];
    let _stateStartTime = Date.now();
    let _currentStateMetrics = {
      state: 'IDLE',
      enterTime: Date.now(),
      duration: 0
    };

    // Check if Curator Mode is active
    const isCuratorMode = () => AutonomousOrchestrator && AutonomousOrchestrator.isRunning();

    const transitionTo = (newState, contextUpdate = {}) => {
        logger.info(`[FSM] Transitioning from ${currentState} to ${newState}`);

        // Track state transition
        const now = Date.now();
        const duration = now - _stateStartTime;

        _stateTransitionHistory.push({
          from: currentState,
          to: newState,
          timestamp: now,
          duration,
          context: { ...cycleContext, ...contextUpdate }
        });
        if (_stateTransitionHistory.length > 50) _stateTransitionHistory.shift();

        // Update current state metrics
        _currentStateMetrics = {
          state: newState,
          enterTime: now,
          duration: 0
        };
        _stateStartTime = now;

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

    // Web Component Widget
    class AgentCycleFSMWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Auto-refresh every 3 seconds
        this._interval = setInterval(() => this.render(), 3000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        // Update current state duration
        _currentStateMetrics.duration = Date.now() - _currentStateMetrics.enterTime;

        const goalText = cycleContext.goal ? cycleContext.goal.substring(0, 30) + '...' : 'No goal';

        return {
          state: currentState === 'IDLE' ? 'idle' : 'active',
          primaryMetric: currentState,
          secondaryMetric: goalText,
          lastActivity: _currentStateMetrics.enterTime,
          message: `${(_currentStateMetrics.duration / 1000).toFixed(1)}s in state`
        };
      }

      renderPanel() {
        // Update duration
        _currentStateMetrics.duration = Date.now() - _currentStateMetrics.enterTime;
        const durationSec = (_currentStateMetrics.duration / 1000).toFixed(1);

        const stateColors = {
          'IDLE': 'rgba(150,150,150,0.1)',
          'CURATING_CONTEXT': 'rgba(255,165,0,0.1)',
          'AWAITING_CONTEXT_APPROVAL': 'rgba(100,150,255,0.1)',
          'PLANNING_WITH_CONTEXT': 'rgba(255,165,0,0.1)',
          'AWAITING_PROPOSAL_APPROVAL': 'rgba(100,150,255,0.1)',
          'APPLYING_CHANGESET': 'rgba(0,200,100,0.1)'
        };

        const stateColor = stateColors[currentState] || stateColors.IDLE;

        const recentTransitions = _stateTransitionHistory.slice(-20).reverse();

        return `
          <h3>↻ Current FSM State</h3>
          <div style="margin-top: 12px; padding: 16px; background: ${stateColor}; border-radius: 4px; border-left: 4px solid #6496ff;">
            <div style="font-size: 0.9em; color: #888;">State</div>
            <div style="font-size: 1.6em; font-weight: bold; margin-top: 4px;">${currentState}</div>
            <div style="font-size: 0.85em; color: #aaa; margin-top: 8px;">Duration: ${durationSec}s</div>
          </div>

          ${cycleContext.goal ? `
            <h3 style="margin-top: 20px;">⊙ Current Goal</h3>
            <div style="margin-top: 12px; padding: 12px; background: rgba(255,255,255,0.05); border-radius: 4px;">
              <div style="font-size: 0.95em;">${cycleContext.goal}</div>
            </div>
          ` : ''}

          ${cycleContext.sessionId ? `
            <h3 style="margin-top: 20px;">☷ Context Details</h3>
            <div style="margin-top: 12px; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 4px; font-size: 0.85em;">
              <div style="margin-bottom: 4px;"><strong>Session ID:</strong> ${cycleContext.sessionId}</div>
              ${cycleContext.turn ? `<div><strong>Turn:</strong> ${JSON.stringify(cycleContext.turn).substring(0, 60)}...</div>` : ''}
            </div>
          ` : ''}

          <h3 style="margin-top: 20px;">☱ FSM State Diagram</h3>
          <div style="margin-top: 12px; padding: 12px; background: rgba(0,0,0,0.2); border-radius: 4px; font-family: monospace; font-size: 0.8em; line-height: 1.8;">
            <div style="${currentState === 'IDLE' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● IDLE</div>
            <div style="margin-left: 12px; color: #666;">↓</div>
            <div style="${currentState === 'CURATING_CONTEXT' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● CURATING_CONTEXT</div>
            <div style="margin-left: 12px; color: #666;">↓</div>
            <div style="${currentState === 'AWAITING_CONTEXT_APPROVAL' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● AWAITING_CONTEXT_APPROVAL</div>
            <div style="margin-left: 12px; color: #666;">↓</div>
            <div style="${currentState === 'PLANNING_WITH_CONTEXT' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● PLANNING_WITH_CONTEXT</div>
            <div style="margin-left: 12px; color: #666;">↓</div>
            <div style="${currentState === 'AWAITING_PROPOSAL_APPROVAL' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● AWAITING_PROPOSAL_APPROVAL</div>
            <div style="margin-left: 12px; color: #666;">↓</div>
            <div style="${currentState === 'APPLYING_CHANGESET' ? 'color: #0c0; font-weight: bold;' : 'color: #666;'}">● APPLYING_CHANGESET</div>
            <div style="margin-left: 12px; color: #666;">↓ (back to IDLE)</div>
          </div>

          ${recentTransitions.length > 0 ? `
            <h3 style="margin-top: 20px;">⌚ Recent Transitions (Last 20)</h3>
            <div style="margin-top: 12px; max-height: 300px; overflow-y: auto;">
              ${recentTransitions.map(trans => {
                const timeAgo = Math.floor((Date.now() - trans.timestamp) / 1000);
                const durationMs = trans.duration;

                return `
                  <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 6px; font-size: 0.85em;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                      <div style="flex: 1;">
                        <div style="font-weight: bold;">
                          <span style="color: #888;">${trans.from}</span>
                          <span style="margin: 0 8px; color: #6496ff;">→</span>
                          <span style="color: #0c0;">${trans.to}</span>
                        </div>
                        ${trans.context?.goal ? `<div style="color: #666; font-size: 0.9em; margin-top: 2px;">${trans.context.goal.substring(0, 50)}...</div>` : ''}
                      </div>
                      <div style="text-align: right; margin-left: 12px;">
                        <div style="color: #aaa;">${(durationMs / 1000).toFixed(1)}s</div>
                        <div style="color: #666; font-size: 0.85em;">${timeAgo}s ago</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          ` : '<div style="margin-top: 12px; color: #888; font-style: italic;">No transitions yet</div>'}

          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ FSM Agent Cycle</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              Event-driven state machine for agent reasoning cycles.<br>
              ${isCuratorMode() ? '⛮ Curator Mode ACTIVE - Auto-approval enabled for context' : 'Manual approval required at each stage'}
            </div>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
              color: #ccc;
              font-family: system-ui, -apple-system, sans-serif;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }

            strong {
              color: #fff;
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('agent-cycle-fsm-widget')) {
      customElements.define('agent-cycle-fsm-widget', AgentCycleFSMWidget);
    }

    // Widget metadata
    const widget = {
      element: 'agent-cycle-fsm-widget',
      displayName: 'Agent Cycle (FSM)',
      icon: '↻',
      category: 'agent',
      updateInterval: 3000
    };

    return {
      api: {
        // The public API is now minimal, driven by events.
        getCurrentState: () => currentState,
      },
      widget
    };
  }
};

// Export standardized module
export default CycleLogic;
