// @blueprint 0x00008E - Goal Modifier MCP Server for REPLOID
/**
 * Goal Modifier MCP Server
 *
 * Exposes REPLOID Goal Modifier operations via MCP
 * Enables safe goal evolution and modification
 *
 * Available Tools:
 * - update_goal - Update current goal
 * - get_goal_history - Get goal modification history
 * - refine_goal - Refine existing goal
 * - validate_goal - Validate goal against constraints
 * - get_current_goal - Get current goal state
 */

const GoalModifierMCPServer = {
  metadata: {
    id: 'GoalModifierMCPServer',
    version: '1.0.0',
    description: 'Goal modification operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'GoalModifier', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, GoalModifier, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[GoalModifierMCPServer] Initializing Goal Modifier MCP Server...');

    const server = createMCPServer({
      name: 'goal-modifier',
      version: '1.0.0',
      description: 'REPLOID Goal Modifier - safe goal evolution',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'refine_goal',
          schema: {
            description: 'Refine the current goal',
            properties: {
              refinement: {
                type: 'string',
                description: 'Refinement text to add'
              },
              reason: {
                type: 'string',
                description: 'Reason for refinement'
              }
            },
            required: ['refinement', 'reason']
          },
          handler: async (args) => {
            const { refinement, reason } = args;

            try {
              const updatedGoal = await GoalModifier.refineGoal(refinement, reason);

              return {
                success: true,
                goal: {
                  seed: updatedGoal.seed,
                  cumulative: updatedGoal.cumulative,
                  metadata: updatedGoal.metadata
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'add_subgoal',
          schema: {
            description: 'Add a subgoal to current goal',
            properties: {
              subgoal: {
                type: 'string',
                description: 'Subgoal text'
              },
              parent_index: {
                type: 'number',
                description: 'Parent goal index (default: 0)'
              },
              reason: {
                type: 'string',
                description: 'Reason for adding subgoal'
              }
            },
            required: ['subgoal', 'reason']
          },
          handler: async (args) => {
            const { subgoal, parent_index = 0, reason } = args;

            try {
              const updatedGoal = await GoalModifier.addSubgoal(subgoal, parent_index, reason);

              return {
                success: true,
                goal: {
                  seed: updatedGoal.seed,
                  cumulative: updatedGoal.cumulative,
                  stack: updatedGoal.stack
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'pivot_goal',
          schema: {
            description: 'Pivot to a new goal direction',
            properties: {
              new_direction: {
                type: 'string',
                description: 'New goal direction'
              },
              reason: {
                type: 'string',
                description: 'Reason for pivot'
              }
            },
            required: ['new_direction', 'reason']
          },
          handler: async (args) => {
            const { new_direction, reason } = args;

            try {
              const result = await GoalModifier.pivotGoal(new_direction, reason);

              if (result.error) {
                return {
                  success: false,
                  error: result.error,
                  alignment: result.alignment,
                  required: result.required,
                  suggestion: result.suggestion
                };
              }

              return {
                success: true,
                goal: {
                  seed: result.seed,
                  cumulative: result.cumulative,
                  stack: result.stack
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'validate_goal',
          schema: {
            description: 'Validate a goal against constraints',
            properties: {
              goal: {
                type: 'string',
                description: 'Goal text to validate'
              }
            },
            required: ['goal']
          },
          handler: async (args) => {
            const { goal } = args;

            try {
              const result = GoalModifier.validateGoal(goal);

              return {
                success: true,
                validation: {
                  valid: result.valid,
                  warnings: result.warnings
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_current_goal',
          schema: {
            description: 'Get current goal state',
            properties: {}
          },
          handler: async () => {
            try {
              const goalState = GoalModifier.getCurrentGoalState();

              if (!goalState) {
                return {
                  success: false,
                  error: 'No current goal found'
                };
              }

              return {
                success: true,
                goal_state: {
                  seed: goalState.seed,
                  current: goalState.current,
                  stack: goalState.stack,
                  metadata: goalState.metadata,
                  statistics: goalState.statistics,
                  can_modify: goalState.can_modify
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'get_goal_history',
          schema: {
            description: 'Get goal modification history',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of history entries (default: 10)'
              }
            }
          },
          handler: async (args) => {
            const { limit = 10 } = args;

            try {
              const stats = GoalModifier.getGoalStatistics();

              return {
                success: true,
                statistics: {
                  total_modifications: stats.total_modifications,
                  modifications_by_type: stats.modifications_by_type,
                  average_alignment: stats.average_alignment,
                  pivot_count: stats.pivot_count,
                  refinement_count: stats.refinement_count,
                  subgoal_count: stats.subgoal_count,
                  reset_count: stats.reset_count
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'emergency_reset',
          schema: {
            description: 'Emergency reset to seed goal',
            properties: {
              reason: {
                type: 'string',
                description: 'Reason for emergency reset'
              }
            },
            required: ['reason']
          },
          handler: async (args) => {
            const { reason } = args;

            try {
              const resetGoal = await GoalModifier.emergencyReset(reason);

              return {
                success: true,
                goal: {
                  seed: resetGoal.seed,
                  cumulative: resetGoal.cumulative,
                  metadata: resetGoal.metadata
                },
                message: 'Goal reset to seed'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        {
          name: 'evaluate_alignment',
          schema: {
            description: 'Evaluate alignment between new and seed goal',
            properties: {
              new_goal: {
                type: 'string',
                description: 'New goal to evaluate'
              },
              seed_goal: {
                type: 'string',
                description: 'Seed goal to compare against'
              }
            },
            required: ['new_goal', 'seed_goal']
          },
          handler: async (args) => {
            const { new_goal, seed_goal } = args;

            try {
              const alignment = await GoalModifier.evaluateAlignment(new_goal, seed_goal);

              return {
                success: true,
                alignment: {
                  score: alignment.score,
                  reasoning: alignment.reasoning,
                  method: alignment.method
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        }
      ]
    });

    server.initialize();
    logger.info(`[GoalModifierMCPServer] Initialized with ${server.listTools().length} tools`);

    return server;
  }
};

export default GoalModifierMCPServer;
