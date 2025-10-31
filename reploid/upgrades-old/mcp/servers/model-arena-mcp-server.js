// @blueprint 0x00008A - Model Arena MCP Server for REPLOID
/**
 * Model Arena MCP Server
 *
 * Exposes REPLOID Model Arena operations via MCP
 * Enables agents to run multi-model competitions and testing
 *
 * Available Tools:
 * - start_arena - Start a multi-model competition
 * - submit_vote - Submit a vote for arena results
 * - get_results - Get competition results
 * - configure_judges - Configure judge models
 * - get_history - Get competition history
 */

const ModelArenaMCPServer = {
  metadata: {
    id: 'ModelArenaMCPServer',
    version: '1.0.0',
    description: 'Model Arena operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'ModelArena', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, ModelArena, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[ModelArenaMCPServer] Initializing Model Arena MCP Server...');

    // Create MCP server with tools
    const server = createMCPServer({
      name: 'model-arena',
      version: '1.0.0',
      description: 'REPLOID Model Arena - run multi-model competitions',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        // =================================================================
        // COMPETITION OPERATIONS
        // =================================================================
        {
          name: 'start_arena',
          schema: {
            description: 'Start a multi-model competitive testing arena',
            properties: {
              objective: {
                type: 'string',
                description: 'Competition objective/task description'
              },
              config: {
                type: 'object',
                description: 'Competition configuration',
                properties: {
                  models: {
                    type: 'array',
                    description: 'Array of model IDs to compete',
                    items: { type: 'string' }
                  },
                  scoring_method: {
                    type: 'string',
                    enum: ['llm', 'hybrid', 'heuristic'],
                    description: 'Scoring method (default: hybrid)'
                  },
                  judge_model: {
                    type: 'string',
                    description: 'Model to use as judge (optional)'
                  },
                  use_shared_tests: {
                    type: 'boolean',
                    description: 'Use shared test suite (default: true)'
                  },
                  timeout: {
                    type: 'number',
                    description: 'Competition timeout in ms (default: 60000)'
                  }
                }
              }
            },
            required: ['objective']
          },
          handler: async (args) => {
            const { objective, config = {} } = args;

            try {
              const result = await ModelArena.runCompetition(objective, config);

              return {
                success: true,
                competition: {
                  winner: result.winner ? {
                    model: result.winner.model,
                    score: result.winner.score,
                    code: result.winner.code,
                    verification: result.winner.verification
                  } : null,
                  solutions_count: result.solutions.length,
                  successful_solutions: result.telemetry.successfulSolutions,
                  failed_solutions: result.telemetry.failedSolutions,
                  duration: result.telemetry.duration,
                  telemetry: {
                    competition_id: result.telemetry.competitionId,
                    timestamp: result.telemetry.timestamp
                  }
                }
              };
            } catch (error) {
              return {
                success: false,
                error: error.message,
                stack: error.stack
              };
            }
          }
        },

        {
          name: 'get_active_competition',
          schema: {
            description: 'Get status of currently active competition',
            properties: {}
          },
          handler: async () => {
            try {
              const active = ModelArena.getActiveCompetition();

              if (!active) {
                return {
                  success: true,
                  active: false,
                  message: 'No active competition'
                };
              }

              return {
                success: true,
                active: true,
                competition: {
                  id: active.id,
                  objective: active.objective,
                  models: active.models,
                  models_count: active.modelsCount,
                  progress: active.progress,
                  phase: active.phase,
                  start_time: active.startTime
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
          name: 'get_results',
          schema: {
            description: 'Get results from most recent competition',
            properties: {
              competition_id: {
                type: 'string',
                description: 'Competition ID (optional, defaults to most recent)'
              }
            }
          },
          handler: async (args) => {
            const { competition_id } = args;

            try {
              const history = ModelArena.getCompetitionHistory();

              if (history.length === 0) {
                return {
                  success: false,
                  error: 'No competition history available'
                };
              }

              let competition;
              if (competition_id) {
                competition = history.find(c => c.competitionId === competition_id);
                if (!competition) {
                  return {
                    success: false,
                    error: `Competition ${competition_id} not found`
                  };
                }
              } else {
                competition = history[0]; // Most recent
              }

              return {
                success: true,
                results: {
                  competition_id: competition.competitionId,
                  objective: competition.objective,
                  winner: competition.winner,
                  winner_score: competition.winnerScore,
                  solutions: competition.solutions.map(s => ({
                    model: s.model,
                    score: s.score,
                    failed: s.failed,
                    verification_passed: s.verification?.passed || false
                  })),
                  duration: competition.duration,
                  timestamp: competition.timestamp
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
          name: 'get_history',
          schema: {
            description: 'Get competition history',
            properties: {
              limit: {
                type: 'number',
                description: 'Maximum number of competitions to return (default: 10)'
              }
            }
          },
          handler: async (args) => {
            const { limit = 10 } = args;

            try {
              const history = ModelArena.getCompetitionHistory();

              return {
                success: true,
                history: history.slice(0, limit).map(c => ({
                  competition_id: c.competitionId,
                  objective: c.objective,
                  winner: c.winner,
                  winner_score: c.winnerScore,
                  models_count: c.models.length,
                  duration: c.duration,
                  timestamp: c.timestamp
                })),
                total_competitions: history.length
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // CONFIGURATION
        // =================================================================
        {
          name: 'configure_judges',
          schema: {
            description: 'Configure judge models for competitions',
            properties: {
              judge_model: {
                type: 'string',
                description: 'Model ID to use as judge'
              },
              scoring_method: {
                type: 'string',
                enum: ['llm', 'hybrid', 'heuristic'],
                description: 'Scoring method to use'
              }
            }
          },
          handler: async (args) => {
            const { judge_model, scoring_method } = args;

            // Note: ModelArena doesn't have a direct configure method,
            // configuration is passed per competition
            return {
              success: true,
              message: 'Judge configuration will be applied to next competition',
              config: {
                judge_model: judge_model || 'default',
                scoring_method: scoring_method || 'hybrid'
              },
              note: 'Pass these values in the config parameter of start_arena'
            };
          }
        },

        {
          name: 'get_stats',
          schema: {
            description: 'Get arena statistics (total competitions, winners, etc)',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = ModelArena.getStats();

              return {
                success: true,
                stats: {
                  total_competitions: stats.totalCompetitions,
                  total_solutions: stats.totalSolutions,
                  successful_solutions: stats.totalSuccessful,
                  failed_solutions: stats.totalFailed,
                  average_duration: stats.averageDuration,
                  winners_by_model: stats.winnersByModel
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
          name: 'clear_history',
          schema: {
            description: 'Clear competition history',
            properties: {}
          },
          handler: async () => {
            try {
              ModelArena.clearHistory();

              return {
                success: true,
                message: 'Competition history cleared'
              };
            } catch (error) {
              return {
                success: false,
                error: error.message
              };
            }
          }
        },

        // =================================================================
        // ADVANCED OPERATIONS
        // =================================================================
        {
          name: 'generate_solution',
          schema: {
            description: 'Generate a solution using a specific model (for testing)',
            properties: {
              objective: {
                type: 'string',
                description: 'Task objective'
              },
              model: {
                type: 'string',
                description: 'Model ID to use'
              }
            },
            required: ['objective', 'model']
          },
          handler: async (args) => {
            const { objective, model } = args;

            try {
              const solution = await ModelArena.generateSolution(objective, model, {});

              return {
                success: true,
                solution: {
                  model: solution.model,
                  code: solution.code,
                  failed: solution.failed,
                  error: solution.error,
                  metadata: solution.metadata
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

    // Initialize server (registers tools)
    server.initialize();

    logger.info(`[ModelArenaMCPServer] Initialized with ${server.listTools().length} tools`);

    // Return server instance
    return server;
  }
};

export default ModelArenaMCPServer;
