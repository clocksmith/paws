// @blueprint 0x00008B - Peer Review Consensus MCP Server for REPLOID
/**
 * Peer Review Consensus MCP Server
 *
 * Exposes REPLOID Peer Review Consensus operations via MCP
 * Enables N-model peer review and consensus mechanisms
 *
 * Available Tools:
 * - start_review - Start peer review process
 * - submit_critique - Submit critique (for manual review)
 * - get_consensus - Get consensus results
 * - configure_reviewers - Configure reviewer models
 * - get_report - Get detailed review report
 */

const PeerReviewConsensusMCPServer = {
  metadata: {
    id: 'PeerReviewConsensusMCPServer',
    version: '1.0.0',
    description: 'Peer review consensus operations via MCP',
    dependencies: ['ReploidMCPServerBase', 'PeerReviewConsensus', 'Utils'],
    async: false,
    type: 'mcp-server'
  },

  factory: (deps) => {
    const { ReploidMCPServerBase, PeerReviewConsensus, Utils } = deps;
    const { createMCPServer } = ReploidMCPServerBase;
    const { logger } = Utils;

    logger.info('[PeerReviewConsensusMCPServer] Initializing Peer Review Consensus MCP Server...');

    const server = createMCPServer({
      name: 'peer-review-consensus',
      version: '1.0.0',
      description: 'REPLOID Peer Review Consensus - N-model peer review',
      capabilities: { tools: true, resources: false, prompts: false },
      tools: [
        {
          name: 'start_review',
          schema: {
            description: 'Start N-model peer review consensus process',
            properties: {
              prompt: {
                type: 'string',
                description: 'Task prompt for peer review'
              },
              options: {
                type: 'object',
                properties: {
                  models: {
                    type: 'array',
                    description: 'Array of model IDs (2-4 models)',
                    items: { type: 'string' }
                  },
                  tiebreaker_method: {
                    type: 'string',
                    enum: ['plurality-voting', 'auto-rater', 'heuristic'],
                    description: 'Tiebreaker method (default: plurality-voting)'
                  }
                }
              }
            },
            required: ['prompt']
          },
          handler: async (args) => {
            const { prompt, options = {} } = args;

            try {
              const result = await PeerReviewConsensus.runConsensus(prompt, options);

              return {
                success: true,
                consensus: {
                  winner: result.winner ? {
                    model: result.winner.model,
                    code: result.winner.code,
                    peer_rating_avg: result.winner.peerRatingAvg,
                    quality_score: result.winner.qualityScore
                  } : null,
                  solutions_count: result.solutions.length,
                  reviews_count: result.reviews.length,
                  n: result.n,
                  duration: result.duration,
                  stats: result.stats
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
          name: 'get_consensus',
          schema: {
            description: 'Get consensus statistics and history',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = PeerReviewConsensus.getStats();

              return {
                success: true,
                stats: {
                  total_reviews: stats.totalReviews,
                  consensus_reached: stats.consensusReached,
                  ties_encountered: stats.tiesEncountered,
                  plurality_voting_tiebreakers: stats.pluralityVotingTiebreakers,
                  auto_rater_tiebreakers: stats.autoRaterTiebreakers,
                  average_review_score: stats.averageReviewScore
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
          name: 'configure_reviewers',
          schema: {
            description: 'Configure reviewer models for consensus',
            properties: {
              models: {
                type: 'array',
                description: 'Array of model IDs to use as reviewers (2-4 models)',
                items: { type: 'string' }
              },
              tiebreaker_method: {
                type: 'string',
                enum: ['plurality-voting', 'auto-rater', 'heuristic']
              }
            },
            required: ['models']
          },
          handler: async (args) => {
            const { models, tiebreaker_method } = args;

            if (models.length < 2 || models.length > 4) {
              return {
                success: false,
                error: 'Peer review requires 2-4 models'
              };
            }

            return {
              success: true,
              message: 'Reviewer configuration will be applied to next review',
              config: {
                models: models,
                tiebreaker_method: tiebreaker_method || 'plurality-voting'
              },
              note: 'Pass these values in the options parameter of start_review'
            };
          }
        },

        {
          name: 'get_report',
          schema: {
            description: 'Get detailed review report (last consensus)',
            properties: {}
          },
          handler: async () => {
            try {
              const stats = PeerReviewConsensus.getStats();

              return {
                success: true,
                report: {
                  summary: stats,
                  message: 'Full review results available in last start_review response'
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
          name: 'reset_stats',
          schema: {
            description: 'Reset consensus statistics',
            properties: {}
          },
          handler: async () => {
            try {
              PeerReviewConsensus.reset();

              return {
                success: true,
                message: 'Consensus statistics reset'
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
    logger.info(`[PeerReviewConsensusMCPServer] Initialized with ${server.listTools().length} tools`);

    return server;
  }
};

export default PeerReviewConsensusMCPServer;
