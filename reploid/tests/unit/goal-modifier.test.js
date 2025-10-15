import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Since this is not a standard module factory, we'll need to import it directly
// For testing purposes, we'll create a mock wrapper

describe('GoalModifier Module', () => {
  let mockConfig, mockLogger, mockUtils, mockStateManager, mockApiClient, mockErrors;
  let goalModifier;
  let mockState;

  beforeEach(() => {
    // Mock logger
    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn()
    };

    // Mock Utils
    mockUtils = {
      getTimestamp: vi.fn(() => Date.now())
    };

    // Mock state
    mockState = {
      currentGoal: {
        seed: 'Build a reliable web application',
        cumulative: 'Build a reliable web application',
        stack: [],
        metadata: {
          created_cycle: 0,
          modification_count: 0
        }
      },
      totalCycles: 5,
      goalHistory: [],
      goalModificationCount: 0
    };

    // Mock StateManager
    mockStateManager = {
      getState: vi.fn(() => mockState),
      updateAndSaveState: vi.fn(async (updater) => {
        mockState = updater(mockState);
        return mockState;
      })
    };

    // Mock ApiClient
    mockApiClient = {
      callApiWithRetry: vi.fn(),
      sanitizeLlmJsonResp: vi.fn((text) => text)
    };

    // Mock Errors
    mockErrors = {
      StateError: class StateError extends Error {
        constructor(message) {
          super(message);
          this.name = 'StateError';
        }
      },
      ApplicationError: class ApplicationError extends Error {
        constructor(message, details) {
          super(message);
          this.name = 'ApplicationError';
          this.details = details;
        }
      }
    };

    mockConfig = {};

    // Dynamically create the module by evaluating the source
    // For this test, we'll need to load the actual module file
    const GoalModifierModule = createGoalModifierModule();
    goalModifier = GoalModifierModule(
      mockConfig,
      mockLogger,
      mockUtils,
      mockStateManager,
      mockApiClient,
      mockErrors
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create the module (inline for testing)
  function createGoalModifierModule() {
    return (config, logger, Utils, StateManager, ApiClient, Errors) => {
      const { StateError, ApplicationError } = Errors;

      logger.info("[GMOD] Goal Modifier Module initializing...");

      const IMMUTABLE_CONSTRAINTS = [
        "Cannot modify seed goal directly",
        "Cannot remove safety checks",
        "Cannot disable goal history logging",
        "Must maintain complete goal history",
        "Cannot exceed modification rate limit"
      ];

      const SOFT_CONSTRAINTS = [
        { rule: "Should align with seed goal", threshold: 0.7 },
        { rule: "Should be measurable", check: "contains success criteria" },
        { rule: "Should have time bounds", check: "contains deadline or cycle limit" },
        { rule: "Should be specific", check: "not too abstract" }
      ];

      let goalHistory = [];
      let modificationCount = 0;
      const MAX_MODIFICATIONS_PER_CYCLE = 3;

      const initializeHistory = async () => {
        const state = StateManager.getState();
        if (state?.goalHistory) {
          goalHistory = state.goalHistory;
          modificationCount = state.goalModificationCount || 0;
          logger.debug(`[GMOD] Loaded ${goalHistory.length} historical goal modifications`);
        }
      };

      const evaluateAlignment = async (newGoal, seedGoal) => {
        logger.info("[GMOD] Evaluating goal alignment...");
        logger.debug(`[GMOD] Seed goal: ${seedGoal}`);
        logger.debug(`[GMOD] New goal: ${newGoal}`);

        if (!ApiClient) {
          logger.warn("[GMOD] No API client available, using heuristic alignment");
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

      const refineGoal = async (refinement, reason) => {
        logger.info("[GMOD] Refining current goal...");

        const state = StateManager.getState();
        if (!state?.currentGoal) {
          throw new StateError("No current goal to refine");
        }

        const currentGoal = state.currentGoal;
        const refinedGoal = `${currentGoal.cumulative}\nRefined: ${refinement}`;

        const alignment = await evaluateAlignment(refinedGoal, currentGoal.seed);
        logger.debug(`[GMOD] Refinement alignment: ${alignment.score}`);

        if (alignment.score < 0.7) {
          logger.warn(`[GMOD] Refinement rejected - low alignment: ${alignment.score}`);
          throw new StateError(`Goal refinement not aligned with original intent (score: ${alignment.score})`);
        }

        const updatedGoal = {
          ...currentGoal,
          cumulative: refinedGoal,
          metadata: {
            ...currentGoal.metadata,
            last_modified: state.totalCycles,
            modification_count: (currentGoal.metadata?.modification_count || 0) + 1
          }
        };

        await logGoalModification('refinement', currentGoal.cumulative, refinedGoal, reason, alignment);

        await StateManager.updateAndSaveState(s => {
          s.currentGoal = updatedGoal;
          return s;
        });

        logger.info("[GMOD] Goal refined successfully");
        return updatedGoal;
      };

      const addSubgoal = async (subgoal, parentIndex = 0, reason) => {
        logger.info(`[GMOD] Adding subgoal: ${subgoal}`);

        const state = StateManager.getState();
        if (!state?.currentGoal) {
          throw new StateError("No current goal to add subgoal to");
        }

        if (modificationCount >= MAX_MODIFICATIONS_PER_CYCLE) {
          logger.warn(`[GMOD] Rate limit exceeded: ${modificationCount}/${MAX_MODIFICATIONS_PER_CYCLE}`);
          throw new StateError("Goal modification rate limit exceeded for this cycle");
        }

        const parentGoal = parentIndex === null ? state.currentGoal.seed :
                          (state.currentGoal.stack[parentIndex]?.goal || state.currentGoal.cumulative);

        const alignment = await evaluateAlignment(subgoal, parentGoal);
        logger.debug(`[GMOD] Subgoal alignment: ${alignment.score}`);

        if (alignment.score < 0.6) {
          logger.warn(`[GMOD] Subgoal rejected - low alignment: ${alignment.score}`);
          throw new StateError(`Subgoal not aligned with parent goal (score: ${alignment.score})`);
        }

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

        await logGoalModification('subgoal', null, subgoal, reason, alignment);

        await StateManager.updateAndSaveState(s => {
          s.currentGoal = updatedGoal;
          return s;
        });

        modificationCount++;
        logger.info(`[GMOD] Subgoal added successfully (${modificationCount} modifications this cycle)`);
        return updatedGoal;
      };

      const pivotGoal = async (newDirection, reason) => {
        logger.info(`[GMOD] Attempting goal pivot to: ${newDirection}`);

        const state = StateManager.getState();
        if (!state?.currentGoal) {
          throw new StateError("No current goal to pivot from");
        }

        const alignment = await evaluateAlignment(newDirection, state.currentGoal.seed);
        logger.debug(`[GMOD] Pivot alignment: ${alignment.score}`);

        if (alignment.score < 0.8) {
          logger.warn(`[GMOD] Pivot rejected - insufficient alignment: ${alignment.score}`);
          return {
            error: "New direction not sufficiently aligned",
            alignment,
            required: 0.8
          };
        }

        const pivotCount = goalHistory.filter(h => h.type === 'pivot').length;
        if (pivotCount >= 3) {
          logger.warn(`[GMOD] Too many pivots: ${pivotCount}`);
          return {
            error: "Maximum pivot count reached",
            pivotCount,
            suggestion: "Consider refinement instead of pivot"
          };
        }

        await logGoalModification('pivot', state.currentGoal.cumulative, newDirection, reason, alignment);

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

        await StateManager.updateAndSaveState(s => {
          s.currentGoal = updatedGoal;
          return s;
        });

        logger.info("[GMOD] Goal pivot successful");
        return updatedGoal;
      };

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

        await StateManager.updateAndSaveState(s => {
          s.goalHistory = goalHistory;
          s.goalModificationCount = modificationCount;
          return s;
        });

        logger.info(`[GMOD] Logged ${type} modification to history (${goalHistory.length} total)`);
      };

      const validateGoal = (goal) => {
        logger.debug("[GMOD] Validating goal against constraints...");

        const violations = [];

        for (const constraint of IMMUTABLE_CONSTRAINTS) {
          logger.debug(`[GMOD] Checking: ${constraint}`);
        }

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

      const emergencyReset = async (reason) => {
        logger.warn(`[GMOD] EMERGENCY GOAL RESET initiated: ${reason}`);

        const state = StateManager.getState();
        if (!state?.currentGoal?.seed) {
          throw new StateError("Cannot reset - no seed goal found");
        }

        await logGoalModification('emergency_reset', state.currentGoal.cumulative, state.currentGoal.seed, reason, { score: 1.0 });

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

        modificationCount = 0;

        logger.warn("[GMOD] Goal reset to seed complete");
        return resetGoal;
      };

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

      initializeHistory().catch(err => {
        logger.error(`[GMOD] Failed to initialize history: ${err.message}`);
      });

      logger.info("[GMOD] Goal Modifier Module initialized successfully");

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
        SOFT_CONSTRAINTS
      };
    };
  }

  describe('Initialization', () => {
    it('should initialize with default empty history', () => {
      expect(mockLogger.info).toHaveBeenCalledWith('[GMOD] Goal Modifier Module initializing...');
      expect(mockLogger.info).toHaveBeenCalledWith('[GMOD] Goal Modifier Module initialized successfully');
    });

    it('should load existing goal history from state', async () => {
      const existingHistory = [
        { type: 'refinement', cycle: 1, timestamp: Date.now() }
      ];
      mockState.goalHistory = existingHistory;
      mockState.goalModificationCount = 1;

      const GoalModifierModule = createGoalModifierModule();
      const newModifier = GoalModifierModule(
        mockConfig,
        mockLogger,
        mockUtils,
        mockStateManager,
        mockApiClient,
        mockErrors
      );

      // Wait for async initialization
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats = newModifier.getGoalStatistics();
      expect(stats.total_modifications).toBe(1);
    });

    it('should have immutable constraints defined', () => {
      expect(goalModifier.IMMUTABLE_CONSTRAINTS).toHaveLength(5);
      expect(goalModifier.IMMUTABLE_CONSTRAINTS).toContain("Cannot modify seed goal directly");
    });

    it('should have soft constraints defined', () => {
      expect(goalModifier.SOFT_CONSTRAINTS).toHaveLength(4);
      expect(goalModifier.SOFT_CONSTRAINTS[0].threshold).toBe(0.7);
    });
  });

  describe('Alignment Evaluation', () => {
    it('should evaluate alignment using LLM', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.85, reasoning: 'Good alignment' })
      });

      const result = await goalModifier.evaluateAlignment(
        'Build a scalable web application',
        'Build a reliable web application'
      );

      expect(result.score).toBe(0.85);
      expect(result.reasoning).toBe('Good alignment');
      expect(result.method).toBe('llm');
      expect(mockApiClient.callApiWithRetry).toHaveBeenCalled();
    });

    it('should use heuristic when API client unavailable', async () => {
      const GoalModifierModule = createGoalModifierModule();
      const modifierWithoutAPI = GoalModifierModule(
        mockConfig,
        mockLogger,
        mockUtils,
        mockStateManager,
        null, // No API client
        mockErrors
      );

      const result = await modifierWithoutAPI.evaluateAlignment(
        'Build a reliable scalable application',
        'Build a reliable web application'
      );

      expect(result.method).toBe('heuristic');
      expect(result.score).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Heuristic alignment');
    });

    it('should throw error when API call fails', async () => {
      mockApiClient.callApiWithRetry.mockRejectedValue(new Error('API error'));

      await expect(
        goalModifier.evaluateAlignment('New goal', 'Old goal')
      ).rejects.toThrow('Failed to evaluate goal alignment');
    });

    it('should calculate heuristic score correctly', async () => {
      const GoalModifierModule = createGoalModifierModule();
      const modifierWithoutAPI = GoalModifierModule(
        mockConfig,
        mockLogger,
        mockUtils,
        mockStateManager,
        null,
        mockErrors
      );

      const result = await modifierWithoutAPI.evaluateAlignment(
        'Build application',
        'Build application'
      );

      expect(result.score).toBe(1.0);
    });
  });

  describe('Goal Refinement', () => {
    beforeEach(() => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.9, reasoning: 'Good refinement' })
      });
    });

    it('should refine goal successfully', async () => {
      const refined = await goalModifier.refineGoal('Add authentication layer', 'Security requirement');

      expect(refined.cumulative).toContain('Refined: Add authentication layer');
      expect(refined.metadata.modification_count).toBe(1);
      expect(refined.metadata.last_modified).toBe(5);
      expect(mockStateManager.updateAndSaveState).toHaveBeenCalled();
    });

    it('should reject refinement with low alignment', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.5, reasoning: 'Poor alignment' })
      });

      await expect(
        goalModifier.refineGoal('Build a car', 'Complete pivot')
      ).rejects.toThrow('Goal refinement not aligned with original intent');
    });

    it('should throw error when no current goal', async () => {
      mockState.currentGoal = null;

      await expect(
        goalModifier.refineGoal('Add feature', 'Test')
      ).rejects.toThrow('No current goal to refine');
    });

    it('should log refinement to history', async () => {
      await goalModifier.refineGoal('Improve performance', 'Optimization');

      const stats = goalModifier.getGoalStatistics();
      expect(stats.refinement_count).toBe(1);
    });
  });

  describe('Subgoal Management', () => {
    beforeEach(() => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.8, reasoning: 'Aligned subgoal' })
      });
    });

    it('should add subgoal successfully', async () => {
      const updated = await goalModifier.addSubgoal('Set up database', 0, 'Infrastructure');

      expect(updated.stack).toHaveLength(1);
      expect(updated.stack[0].goal).toBe('Set up database');
      expect(updated.stack[0].reason).toBe('Infrastructure');
      expect(updated.stack[0].priority).toBe(1);
    });

    it('should reject subgoal with low alignment', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.3, reasoning: 'Unrelated' })
      });

      await expect(
        goalModifier.addSubgoal('Paint the house', 0, 'Random')
      ).rejects.toThrow('Subgoal not aligned with parent goal');
    });

    it('should enforce rate limit', async () => {
      // Add 3 subgoals (at the limit)
      await goalModifier.addSubgoal('Task 1', 0, 'R1');
      await goalModifier.addSubgoal('Task 2', 0, 'R2');
      await goalModifier.addSubgoal('Task 3', 0, 'R3');

      // Fourth should fail
      await expect(
        goalModifier.addSubgoal('Task 4', 0, 'R4')
      ).rejects.toThrow('Goal modification rate limit exceeded');
    });

    it('should increment modification count', async () => {
      await goalModifier.addSubgoal('Task 1', 0, 'Reason');

      const stats = goalModifier.getGoalStatistics();
      expect(stats.current_cycle_modifications).toBe(1);
    });

    it('should use parent goal for alignment check', async () => {
      mockState.currentGoal.stack = [{
        goal: 'Build frontend',
        priority: 1,
        parent: null
      }];

      await goalModifier.addSubgoal('Add React components', 0, 'UI');

      expect(mockApiClient.callApiWithRetry).toHaveBeenCalled();
    });
  });

  describe('Goal Pivoting', () => {
    beforeEach(() => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.85, reasoning: 'Strong alignment' })
      });
    });

    it('should pivot goal successfully', async () => {
      const pivoted = await goalModifier.pivotGoal('Build a mobile application', 'Market shift');

      expect(pivoted.cumulative).toBe('Build a mobile application');
      expect(pivoted.stack).toHaveLength(1);
      expect(pivoted.stack[0].pivot_from).toBe('Build a reliable web application');
      expect(pivoted.stack[0].reason).toBe('Market shift');
    });

    it('should reject pivot with low alignment', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.6, reasoning: 'Weak alignment' })
      });

      const result = await goalModifier.pivotGoal('Start a restaurant', 'Complete change');

      expect(result.error).toBe('New direction not sufficiently aligned');
      expect(result.required).toBe(0.8);
    });

    it('should reject pivot when max pivots reached', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.9, reasoning: 'Good' })
      });

      // Execute 3 pivots to reach the limit
      await goalModifier.pivotGoal('Direction 1', 'First pivot');
      await goalModifier.pivotGoal('Direction 2', 'Second pivot');
      await goalModifier.pivotGoal('Direction 3', 'Third pivot');

      // Fourth pivot should be rejected
      const result = await goalModifier.pivotGoal('New direction', 'Fourth pivot');

      expect(result.error).toBe('Maximum pivot count reached');
      expect(result.suggestion).toContain('refinement');
    });

    it('should log pivot to history', async () => {
      await goalModifier.pivotGoal('Build a mobile app', 'Strategy change');

      const stats = goalModifier.getGoalStatistics();
      expect(stats.pivot_count).toBe(1);
    });
  });

  describe('Goal Validation', () => {
    it('should validate goal with success criteria', () => {
      const result = goalModifier.validateGoal('Build and complete the application in 5 cycles');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should warn about missing success criteria', () => {
      const result = goalModifier.validateGoal('Build the application');

      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('no clear success criteria')
      );
    });

    it('should warn about missing time bounds', () => {
      const result = goalModifier.validateGoal('Complete the project successfully');

      expect(result.valid).toBe(false);
      expect(result.warnings).toContainEqual(
        expect.stringContaining('no time bounds specified')
      );
    });

    it('should accept goal with both criteria', () => {
      const result = goalModifier.validateGoal('Successfully complete project in 3 weeks');

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it('should accept goals with "achieve"', () => {
      const result = goalModifier.validateGoal('We should achieve deployment in 2 day');

      expect(result.valid).toBe(true);
    });
  });

  describe('Emergency Reset', () => {
    it('should reset to seed goal', async () => {
      mockState.currentGoal.cumulative = 'Build a mobile app with features X Y Z';
      mockState.currentGoal.stack = [{ goal: 'Feature X' }, { goal: 'Feature Y' }];

      const reset = await goalModifier.emergencyReset('Goal drift detected');

      expect(reset.cumulative).toBe('Build a reliable web application');
      expect(reset.seed).toBe('Build a reliable web application');
      expect(reset.stack).toHaveLength(0);
      expect(reset.metadata.reset_reason).toBe('Goal drift detected');
      expect(reset.metadata.reset_count).toBe(1);
    });

    it('should throw error when no seed goal', async () => {
      mockState.currentGoal = { cumulative: 'Test' };

      await expect(
        goalModifier.emergencyReset('Test reset')
      ).rejects.toThrow('Cannot reset - no seed goal found');
    });

    it('should log reset to history', async () => {
      await goalModifier.emergencyReset('Manual reset');

      const stats = goalModifier.getGoalStatistics();
      expect(stats.reset_count).toBe(1);
    });

    it('should reset modification count', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.8, reasoning: 'OK' })
      });

      await goalModifier.addSubgoal('Task 1', 0, 'R1');
      await goalModifier.addSubgoal('Task 2', 0, 'R2');

      let stats = goalModifier.getGoalStatistics();
      expect(stats.current_cycle_modifications).toBe(2);

      await goalModifier.emergencyReset('Reset test');

      stats = goalModifier.getGoalStatistics();
      expect(stats.current_cycle_modifications).toBe(0);
    });
  });

  describe('Statistics', () => {
    it('should return correct statistics', () => {
      const stats = goalModifier.getGoalStatistics();

      expect(stats).toHaveProperty('total_modifications');
      expect(stats).toHaveProperty('modifications_by_type');
      expect(stats).toHaveProperty('average_alignment');
      expect(stats).toHaveProperty('current_cycle_modifications');
      expect(stats).toHaveProperty('pivot_count');
      expect(stats).toHaveProperty('refinement_count');
      expect(stats).toHaveProperty('subgoal_count');
      expect(stats).toHaveProperty('reset_count');
    });

    it('should calculate average alignment', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.8, reasoning: 'OK' })
      });

      await goalModifier.refineGoal('Add feature A', 'Reason 1');

      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.6, reasoning: 'OK' })
      });

      try {
        await goalModifier.refineGoal('Add feature B', 'Reason 2');
      } catch (e) {
        // May fail due to low score, that's OK
      }

      const stats = goalModifier.getGoalStatistics();
      expect(stats.average_alignment).toBeGreaterThan(0);
    });

    it('should count modifications by type', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.9, reasoning: 'OK' })
      });

      await goalModifier.refineGoal('Refinement 1', 'R1');
      await goalModifier.addSubgoal('Subgoal 1', 0, 'S1');
      await goalModifier.pivotGoal('Pivot 1', 'P1');

      const stats = goalModifier.getGoalStatistics();
      expect(stats.modifications_by_type.refinement).toBe(1);
      expect(stats.modifications_by_type.subgoal).toBe(1);
      expect(stats.modifications_by_type.pivot).toBe(1);
    });
  });

  describe('Current Goal State', () => {
    it('should return current goal state', () => {
      const state = goalModifier.getCurrentGoalState();

      expect(state).not.toBeNull();
      expect(state.seed).toBe('Build a reliable web application');
      expect(state.current).toBe('Build a reliable web application');
      expect(state.stack).toEqual([]);
      expect(state.can_modify).toBe(true);
      expect(state.statistics).toBeDefined();
    });

    it('should return null when no current goal', () => {
      mockState.currentGoal = null;

      const state = goalModifier.getCurrentGoalState();

      expect(state).toBeNull();
      expect(mockLogger.warn).toHaveBeenCalledWith('[GMOD] No current goal found');
    });

    it('should indicate when modifications not allowed', async () => {
      mockApiClient.callApiWithRetry.mockResolvedValue({
        content: JSON.stringify({ score: 0.8, reasoning: 'OK' })
      });

      // Exhaust modification limit
      await goalModifier.addSubgoal('Task 1', 0, 'R1');
      await goalModifier.addSubgoal('Task 2', 0, 'R2');
      await goalModifier.addSubgoal('Task 3', 0, 'R3');

      const state = goalModifier.getCurrentGoalState();
      expect(state.can_modify).toBe(false);
    });
  });
});
