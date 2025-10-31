// @blueprint 0x000017 - Safe patterns for agent goal evolution and modification.
// Goal Modification Safety Module
// Provides safe mechanisms for goal evolution and modification
const GoalModifierModule = (
  config,
  logger,
  Utils,
  StateManager,
  ApiClient,
  Errors
) => {
  const { StateError, ApplicationError } = Errors;
  
  logger.info("[GMOD] Goal Modifier Module initializing...");

  // Immutable constraints that cannot be overridden
  const IMMUTABLE_CONSTRAINTS = [
    "Cannot modify seed goal directly",
    "Cannot remove safety checks",
    "Cannot disable goal history logging",
    "Must maintain complete goal history",
    "Cannot exceed modification rate limit"
  ];

  // Soft constraints that require justification
  const SOFT_CONSTRAINTS = [
    { rule: "Should align with seed goal", threshold: 0.7 },
    { rule: "Should be measurable", check: "contains success criteria" },
    { rule: "Should have time bounds", check: "contains deadline or cycle limit" },
    { rule: "Should be specific", check: "not too abstract" }
  ];

  // Goal modification history
  let goalHistory = [];
  let modificationCount = 0;
  const MAX_MODIFICATIONS_PER_CYCLE = 3;

  // Initialize goal history from state
  const initializeHistory = async () => {
    const state = StateManager.getState();
    if (state?.goalHistory) {
      goalHistory = state.goalHistory;
      modificationCount = state.goalModificationCount || 0;
      logger.debug(`[GMOD] Loaded ${goalHistory.length} historical goal modifications`);
    }
  };

  // Evaluate alignment between new goal and seed goal
  const evaluateAlignment = async (newGoal, seedGoal) => {
    logger.info("[GMOD] Evaluating goal alignment...");
    logger.debug(`[GMOD] Seed goal: ${seedGoal}`);
    logger.debug(`[GMOD] New goal: ${newGoal}`);
    
    if (!ApiClient) {
      logger.warn("[GMOD] No API client available, using heuristic alignment");
      // Simple heuristic: check for common keywords
      const seedWords = seedGoal.toLowerCase().split(/\s+/);
      const newWords = newGoal.toLowerCase().split(/\s+/);
      const commonWords = seedWords.filter(w => newWords.includes(w));
      const score = commonWords.length / Math.max(seedWords.length, newWords.length);
      
      return {
        score: score,
        reasoning: `Heuristic alignment based on ${commonWords.length} common keywords`,
        method: 'heuristic'
      };
    }
    
    try {
      const prompt = `Evaluate if the proposed goal maintains the intent of the original goal.
      
Original Goal: ${seedGoal}
Proposed Goal: ${newGoal}

Score 0-1 where 1 is perfect alignment.

Consider:
- Does it serve the same ultimate purpose?
- Does it respect the same constraints?
- Is it a reasonable interpretation/evolution?

Respond with JSON: {"score": 0.0-1.0, "reasoning": "explanation"}`;
      
      const response = await ApiClient.callApiWithRetry(
        [{ role: "user", parts: [{ text: prompt }] }],
        StateManager.getState()?.apiKey
      );
      
      const result = JSON.parse(ApiClient.sanitizeLlmJsonResp(response.content));
      logger.info(`[GMOD] Alignment score: ${result.score}`);
      
      return {
        ...result,
        method: 'llm'
      };
    } catch (error) {
      logger.error(`[GMOD] Alignment evaluation failed: ${error.message}`);
      throw new ApplicationError("Failed to evaluate goal alignment", { error: error.message });
    }
  };

  // Refine existing goal (safe modification)
  const refineGoal = async (refinement, reason) => {
    logger.info("[GMOD] Refining current goal...");
    
    const state = StateManager.getState();
    if (!state?.currentGoal) {
      throw new StateError("No current goal to refine");
    }
    
    const currentGoal = state.currentGoal;
    const refinedGoal = `${currentGoal.cumulative}\nRefined: ${refinement}`;
    
    // Check alignment
    const alignment = await evaluateAlignment(refinedGoal, currentGoal.seed);
    logger.debug(`[GMOD] Refinement alignment: ${alignment.score}`);
    
    if (alignment.score < 0.7) {
      logger.warn(`[GMOD] Refinement rejected - low alignment: ${alignment.score}`);
      throw new StateError(`Goal refinement not aligned with original intent (score: ${alignment.score})`);
    }
    
    // Update goal
    const updatedGoal = {
      ...currentGoal,
      cumulative: refinedGoal,
      metadata: {
        ...currentGoal.metadata,
        last_modified: state.totalCycles,
        modification_count: (currentGoal.metadata?.modification_count || 0) + 1
      }
    };
    
    // Log modification
    await logGoalModification('refinement', currentGoal.cumulative, refinedGoal, reason, alignment);
    
    // Save to state
    await StateManager.updateAndSaveState(s => {
      s.currentGoal = updatedGoal;
      return s;
    });
    
    logger.info("[GMOD] Goal refined successfully");
    return updatedGoal;
  };

  // Add subgoal (safe modification)
  const addSubgoal = async (subgoal, parentIndex = 0, reason) => {
    logger.info(`[GMOD] Adding subgoal: ${subgoal}`);
    
    const state = StateManager.getState();
    if (!state?.currentGoal) {
      throw new StateError("No current goal to add subgoal to");
    }
    
    // Check rate limit
    if (modificationCount >= MAX_MODIFICATIONS_PER_CYCLE) {
      logger.warn(`[GMOD] Rate limit exceeded: ${modificationCount}/${MAX_MODIFICATIONS_PER_CYCLE}`);
      throw new StateError("Goal modification rate limit exceeded for this cycle");
    }
    
    // Verify subgoal serves parent
    const parentGoal = parentIndex === null ? state.currentGoal.seed : 
                      (state.currentGoal.stack[parentIndex]?.goal || state.currentGoal.cumulative);
    
    const alignment = await evaluateAlignment(subgoal, parentGoal);
    logger.debug(`[GMOD] Subgoal alignment: ${alignment.score}`);
    
    if (alignment.score < 0.6) {
      logger.warn(`[GMOD] Subgoal rejected - low alignment: ${alignment.score}`);
      throw new StateError(`Subgoal not aligned with parent goal (score: ${alignment.score})`);
    }
    
    // Add to goal stack
    const newStackItem = {
      goal: subgoal,
      priority: state.currentGoal.stack.length + 1,
      parent: parentIndex,
      alignment: alignment,
      created_cycle: state.totalCycles,
      reason: reason
    };
    
    const updatedGoal = {
      ...state.currentGoal,
      stack: [...state.currentGoal.stack, newStackItem]
    };
    
    // Log modification
    await logGoalModification('subgoal', null, subgoal, reason, alignment);
    
    // Save to state
    await StateManager.updateAndSaveState(s => {
      s.currentGoal = updatedGoal;
      return s;
    });
    
    modificationCount++;
    logger.info(`[GMOD] Subgoal added successfully (${modificationCount} modifications this cycle)`);
    return updatedGoal;
  };

  // Pivot goal (requires high confidence)
  const pivotGoal = async (newDirection, reason) => {
    logger.info(`[GMOD] Attempting goal pivot to: ${newDirection}`);
    
    const state = StateManager.getState();
    if (!state?.currentGoal) {
      throw new StateError("No current goal to pivot from");
    }
    
    // Check alignment with seed goal
    const alignment = await evaluateAlignment(newDirection, state.currentGoal.seed);
    logger.debug(`[GMOD] Pivot alignment: ${alignment.score}`);
    
    // Require high confidence for pivots
    if (alignment.score < 0.8) {
      logger.warn(`[GMOD] Pivot rejected - insufficient alignment: ${alignment.score}`);
      return {
        error: "New direction not sufficiently aligned",
        alignment,
        required: 0.8
      };
    }
    
    // Check if too many pivots
    const pivotCount = goalHistory.filter(h => h.type === 'pivot').length;
    if (pivotCount >= 3) {
      logger.warn(`[GMOD] Too many pivots: ${pivotCount}`);
      return {
        error: "Maximum pivot count reached",
        pivotCount,
        suggestion: "Consider refinement instead of pivot"
      };
    }
    
    // Log the pivot
    await logGoalModification('pivot', state.currentGoal.cumulative, newDirection, reason, alignment);
    
    // Update with traceback
    const updatedGoal = {
      ...state.currentGoal,
      cumulative: newDirection,
      stack: [...state.currentGoal.stack, {
        goal: newDirection,
        priority: 1,
        parent: null,
        pivot_from: state.currentGoal.cumulative,
        reason: reason,
        cycle: state.totalCycles
      }]
    };
    
    // Save to state
    await StateManager.updateAndSaveState(s => {
      s.currentGoal = updatedGoal;
      return s;
    });
    
    logger.info("[GMOD] Goal pivot successful");
    return updatedGoal;
  };

  // Log goal modification for history
  const logGoalModification = async (type, fromGoal, toGoal, reason, alignment) => {
    const state = StateManager.getState();
    const entry = {
      cycle: state?.totalCycles || 0,
      timestamp: Date.now(),
      type: type,
      from: fromGoal,
      to: toGoal,
      reason: reason,
      alignment: alignment
    };
    
    goalHistory.push(entry);
    
    // Save history to state
    await StateManager.updateAndSaveState(s => {
      s.goalHistory = goalHistory;
      s.goalModificationCount = modificationCount;
      return s;
    });
    
    logger.info(`[GMOD] Logged ${type} modification to history (${goalHistory.length} total)`);
  };

  // Validate goal against constraints
  const validateGoal = (goal) => {
    logger.debug("[GMOD] Validating goal against constraints...");
    
    const violations = [];
    
    // Check immutable constraints
    for (const constraint of IMMUTABLE_CONSTRAINTS) {
      // These are enforced by the system, just log
      logger.debug(`[GMOD] Checking: ${constraint}`);
    }
    
    // Check soft constraints
    for (const constraint of SOFT_CONSTRAINTS) {
      if (constraint.check === "contains success criteria") {
        if (!goal.includes("success") && !goal.includes("complete") && !goal.includes("achieve")) {
          violations.push(`Warning: ${constraint.rule} - no clear success criteria`);
        }
      }
      
      if (constraint.check === "contains deadline or cycle limit") {
        if (!goal.match(/\d+\s*(cycle|hour|day|week)/i)) {
          violations.push(`Warning: ${constraint.rule} - no time bounds specified`);
        }
      }
    }
    
    if (violations.length > 0) {
      logger.warn(`[GMOD] Goal validation warnings: ${violations.join('; ')}`);
    } else {
      logger.debug("[GMOD] Goal passed all constraint checks");
    }
    
    return {
      valid: violations.length === 0,
      warnings: violations
    };
  };

  // Emergency goal reset
  const emergencyReset = async (reason) => {
    logger.warn(`[GMOD] EMERGENCY GOAL RESET initiated: ${reason}`);
    
    const state = StateManager.getState();
    if (!state?.currentGoal?.seed) {
      throw new StateError("Cannot reset - no seed goal found");
    }
    
    // Log the reset
    await logGoalModification('emergency_reset', state.currentGoal.cumulative, state.currentGoal.seed, reason, { score: 1.0 });
    
    // Revert to seed goal
    const resetGoal = {
      seed: state.currentGoal.seed,
      cumulative: state.currentGoal.seed,
      stack: [],
      constraints: IMMUTABLE_CONSTRAINTS,
      metadata: {
        created_cycle: state.totalCycles,
        reset_count: (state.currentGoal.metadata?.reset_count || 0) + 1,
        reset_reason: reason
      }
    };
    
    await StateManager.updateAndSaveState(s => {
      s.currentGoal = resetGoal;
      return s;
    });
    
    // Reset modification count
    modificationCount = 0;
    
    logger.warn("[GMOD] Goal reset to seed complete");
    return resetGoal;
  };

  // Get goal modification statistics
  const getGoalStatistics = () => {
    const stats = {
      total_modifications: goalHistory.length,
      modifications_by_type: {},
      average_alignment: 0,
      current_cycle_modifications: modificationCount,
      pivot_count: 0,
      refinement_count: 0,
      subgoal_count: 0,
      reset_count: 0
    };
    
    let totalAlignment = 0;
    let alignmentCount = 0;
    
    for (const entry of goalHistory) {
      stats.modifications_by_type[entry.type] = (stats.modifications_by_type[entry.type] || 0) + 1;
      
      if (entry.alignment?.score) {
        totalAlignment += entry.alignment.score;
        alignmentCount++;
      }
      
      if (entry.type === 'pivot') stats.pivot_count++;
      if (entry.type === 'refinement') stats.refinement_count++;
      if (entry.type === 'subgoal') stats.subgoal_count++;
      if (entry.type === 'emergency_reset') stats.reset_count++;
    }
    
    if (alignmentCount > 0) {
      stats.average_alignment = totalAlignment / alignmentCount;
    }
    
    logger.debug(`[GMOD] Goal statistics: ${JSON.stringify(stats)}`);
    return stats;
  };

  // Get current goal state
  const getCurrentGoalState = () => {
    const state = StateManager.getState();
    if (!state?.currentGoal) {
      logger.warn("[GMOD] No current goal found");
      return null;
    }
    
    const goalState = {
      seed: state.currentGoal.seed,
      current: state.currentGoal.cumulative,
      stack: state.currentGoal.stack,
      metadata: state.currentGoal.metadata,
      statistics: getGoalStatistics(),
      can_modify: modificationCount < MAX_MODIFICATIONS_PER_CYCLE
    };
    
    logger.debug(`[GMOD] Current goal state: ${goalState.current}`);
    return goalState;
  };

  // Initialize history on load
  initializeHistory().catch(err => {
    logger.error(`[GMOD] Failed to initialize history: ${err.message}`);
  });

  logger.info("[GMOD] Goal Modifier Module initialized successfully");

  // Web Component Widget
  class GoalModifierWidget extends HTMLElement {
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
    }

    disconnectedCallback() {
      // No cleanup needed
    }

    getStatus() {
      const goalState = getCurrentGoalState();
      if (!goalState) {
        return {
          state: 'disabled',
          primaryMetric: 'No goal',
          secondaryMetric: '-',
          lastActivity: null,
          message: null
        };
      }

      const stats = getGoalStatistics();

      return {
        state: goalState.can_modify ? 'idle' : 'warning',
        primaryMetric: `${stats.total_modifications} mods`,
        secondaryMetric: `${modificationCount}/${MAX_MODIFICATIONS_PER_CYCLE} this cycle`,
        lastActivity: goalHistory.length > 0 ? goalHistory[goalHistory.length - 1].timestamp : null,
        message: !goalState.can_modify ? 'Modification limit reached' : null
      };
    }

    getControls() {
      return [
        {
          id: 'reset-limits',
          label: '↻ Reset Limits',
          action: () => {
            modificationCount = 0;
            logger.info('[GMOD] Modification limits reset');
            this.render();
            return { success: true, message: 'Modification limits reset' };
          }
        }
      ];
    }

    render() {
      const goalState = getCurrentGoalState();
      if (!goalState) {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
            }
            .no-goal {
              padding: 20px;
              text-align: center;
              color: #888;
            }
          </style>
          <div class="no-goal">No active goal</div>
        `;
        return;
      }

      const stats = getGoalStatistics();
      const recentMods = goalHistory.slice(-10).reverse();

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            font-family: monospace;
            font-size: 12px;
          }
          .goal-panel {
            padding: 12px;
            color: #fff;
          }
          h4 {
            margin: 0 0 12px 0;
            font-size: 1.1em;
            color: #0ff;
          }
          .current-goal {
            background: rgba(0,255,255,0.1);
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
          }
          .current-goal-title {
            font-weight: bold;
            margin-bottom: 8px;
            color: #0ff;
          }
          .current-goal-text {
            font-size: 14px;
            color: #ccc;
            line-height: 1.5;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
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
          .constraints-section {
            margin-bottom: 20px;
          }
          .constraint-item {
            padding: 6px;
            background: rgba(244,67,54,0.1);
            margin-bottom: 4px;
            border-left: 3px solid #f44336;
            border-radius: 3px;
            color: #ccc;
            font-size: 12px;
          }
          .history-section {
            margin-top: 20px;
          }
          .history-list {
            max-height: 200px;
            overflow-y: auto;
          }
          .history-item {
            padding: 10px;
            background: rgba(255,255,255,0.03);
            margin-bottom: 8px;
            border-radius: 3px;
          }
          .history-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 4px;
          }
          .history-type {
            font-weight: bold;
            color: #0ff;
          }
          .history-time {
            font-size: 12px;
            color: #888;
          }
          .history-goal {
            font-size: 12px;
            color: #ccc;
          }
          .history-alignment {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
          }
          .no-history {
            color: #888;
            padding: 20px;
            text-align: center;
          }
        </style>
        <div class="goal-panel">
          <h4>⊙ Goal Modifier</h4>

          <div class="current-goal">
            <div class="current-goal-title">Current Goal</div>
            <div class="current-goal-text">${goalState.current || 'No active goal'}</div>
          </div>

          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Mods</div>
              <div class="stat-value">${stats.total_modifications}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">This Cycle</div>
              <div class="stat-value">${modificationCount}/${MAX_MODIFICATIONS_PER_CYCLE}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Avg Alignment</div>
              <div class="stat-value">${stats.average_alignment ? (stats.average_alignment * 100).toFixed(0) : 0}%</div>
            </div>
          </div>

          <div class="constraints-section">
            <h4>Immutable Constraints (${IMMUTABLE_CONSTRAINTS.length})</h4>
            ${IMMUTABLE_CONSTRAINTS.map(c => `
              <div class="constraint-item">${c}</div>
            `).join('')}
          </div>

          <div class="history-section">
            <h4>Recent Modifications (${recentMods.length})</h4>
            <div class="history-list">
              ${recentMods.length > 0 ? recentMods.map(mod => {
                const time = new Date(mod.timestamp).toLocaleTimeString();
                return `
                  <div class="history-item">
                    <div class="history-header">
                      <span class="history-type">${mod.type}</span>
                      <span class="history-time">${time}</span>
                    </div>
                    <div class="history-goal">${mod.to || mod.from || 'N/A'}</div>
                    ${mod.alignment && mod.alignment.score ? `
                      <div class="history-alignment">
                        Alignment: ${(mod.alignment.score * 100).toFixed(0)}%
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('') : '<div class="no-history">No modifications yet</div>'}
            </div>
          </div>
        </div>
      `;
    }
  }

  // Register custom element
  const elementName = 'goal-modifier-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, GoalModifierWidget);
  }

  return {
    evaluateAlignment,
    refineGoal,
    addSubgoal,
    pivotGoal,
    validateGoal,
    emergencyReset,
    getGoalStatistics,
    getCurrentGoalState,
    IMMUTABLE_CONSTRAINTS,
    SOFT_CONSTRAINTS,
    widget: {
      element: elementName,
      displayName: 'Goal Modifier',
      icon: '⊙',
      category: 'agent'
    }
  };
};

export default GoalModifier;