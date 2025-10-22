/**
 * @fileoverview Peer Review Consensus for REPLOID
 *
 * Implements a peer-review based consensus mechanism where N models:
 * 1. All attempt the same task independently
 * 2. Each model reviews and rates all other models' solutions
 * 3. Final selection based on aggregate peer ratings
 *
 * Supports N=2, N=3, N=4 with different tiebreaker strategies:
 * - N=2: Use quality heuristics as tiebreaker
 * - N=3: Use median rating, quality score as secondary tiebreaker
 * - N=4: Use ranked-choice voting with quality as tiebreaker
 *
 * @module PeerReviewConsensus
 * @version 1.0.0
 * @category consensus
 * @blueprint 0x000066
 */

const PeerReviewConsensus = {
  metadata: {
    id: 'PeerReviewConsensus',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager', 'HybridLLMProvider', 'VerificationManager', 'DIContainer', 'Config'],
    async: true,
    type: 'consensus'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager, HybridLLMProvider, VerificationManager, DIContainer, Config } = deps;
    const { logger } = Utils;

    // Configuration
    const REVIEW_TIMEOUT = 30000; // 30 seconds per review
    const DEFAULT_MODELS = [
      'gemini-2.5-flash',
      'gpt-5-2025-08-07',
      'claude-4-5-sonnet'
    ];

    let _stats = {
      totalReviews: 0,
      consensusReached: 0,
      tiesEncountered: 0,
      pluralityVotingTiebreakers: 0,
      autoRaterTiebreakers: 0,
      averageReviewScore: 0
    };

    /**
     * Assess code quality using heuristics
     * @param {string} code - Code to assess
     * @returns {number} Quality score 0-1
     */
    const assessCodeQuality = (code) => {
      if (!code) return 0;

      let score = 0.5; // Base score

      // Positive indicators
      if (code.includes('/**')) score += 0.1; // JSDoc comments
      if (code.includes('try') && code.includes('catch')) score += 0.1; // Error handling
      if (code.match(/const |let /g)?.length > 0) score += 0.1; // Modern JS
      if (code.includes('async') || code.includes('await')) score += 0.05; // Async handling
      if (code.match(/\n/g)?.length > 20) score += 0.05; // Substantial implementation

      // Negative indicators
      if (code.includes('eval(')) score -= 0.2; // Dangerous patterns
      if (code.includes('TODO') || code.includes('FIXME')) score -= 0.1; // Incomplete
      if (code.length < 100) score -= 0.2; // Too short

      return Math.max(0, Math.min(1, score));
    };

    /**
     * Generate a solution using specific model
     * @param {string} prompt - Task prompt
     * @param {string} model - Model identifier
     * @param {number} modelIndex - Index in the peer group
     * @returns {Promise<Object>} Generated solution
     */
    const generateSolution = async (prompt, model, modelIndex) => {
      const startTime = Date.now();

      try {
        logger.info(`[PeerReview] Model ${modelIndex + 1} (${model}) generating solution`);

        const response = await HybridLLMProvider.api.generateWithModel(prompt, {
          model,
          temperature: 0.7,
          maxTokens: 4000
        });

        // Extract code from response
        const codeMatch = response.content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
        const code = codeMatch ? codeMatch[1].trim() : response.content;

        return {
          modelIndex,
          model,
          code,
          raw: response.content,
          qualityScore: assessCodeQuality(code),
          metadata: {
            duration: Date.now() - startTime,
            tokens: response.usage,
            timestamp: Date.now()
          },
          failed: false
        };
      } catch (error) {
        logger.error(`[PeerReview] Model ${modelIndex + 1} failed:`, error);

        return {
          modelIndex,
          model,
          error: error.message,
          failed: true,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }
    };

    /**
     * Have one model review another model's solution
     * @param {Object} reviewer - Reviewing model info
     * @param {Object} solution - Solution to review
     * @param {string} originalPrompt - Original task prompt
     * @returns {Promise<Object>} Review with score and feedback
     */
    const conductPeerReview = async (reviewer, solution, originalPrompt) => {
      const startTime = Date.now();

      try {
        logger.info(`[PeerReview] Model ${reviewer.index + 1} reviewing Model ${solution.modelIndex + 1}'s solution`);

        const reviewPrompt = `You are a code reviewer. Evaluate the following solution to this task:

TASK: ${originalPrompt}

SOLUTION TO REVIEW:
\`\`\`javascript
${solution.code}
\`\`\`

Provide a review with:
1. A score from 0-10 (0=completely wrong, 10=perfect)
2. Brief feedback on correctness, code quality, and completeness

Format your response as:
SCORE: [0-10]
FEEDBACK: [Your detailed feedback]`;

        const response = await HybridLLMProvider.api.generateWithModel(reviewPrompt, {
          model: reviewer.model,
          temperature: 0.3, // Lower temperature for more consistent reviews
          maxTokens: 500
        });

        // Parse score from response
        const scoreMatch = response.content.match(/SCORE:\s*(\d+(?:\.\d+)?)/i);
        const feedbackMatch = response.content.match(/FEEDBACK:\s*(.+)/is);

        const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5.0; // Default to middle score
        const feedback = feedbackMatch ? feedbackMatch[1].trim() : response.content;

        // Normalize score to 0-1 range
        const normalizedScore = Math.max(0, Math.min(10, score)) / 10;

        return {
          reviewerIndex: reviewer.index,
          reviewerModel: reviewer.model,
          subjectIndex: solution.modelIndex,
          subjectModel: solution.model,
          score: normalizedScore,
          rawScore: score,
          feedback,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      } catch (error) {
        logger.error(`[PeerReview] Review failed:`, error);

        // Return neutral score on failure
        return {
          reviewerIndex: reviewer.index,
          reviewerModel: reviewer.model,
          subjectIndex: solution.modelIndex,
          subjectModel: solution.model,
          score: 0.5,
          rawScore: 5.0,
          feedback: `Review failed: ${error.message}`,
          error: true,
          metadata: {
            duration: Date.now() - startTime,
            timestamp: Date.now()
          }
        };
      }
    };

    /**
     * Tiebreaker for N=2 (two models)
     * Use quality heuristics as primary tiebreaker
     */
    const tiebreakerN2 = (solutions, reviews) => {
      logger.info('[PeerReview] N=2 tiebreaker: Using quality scores');

      const [sol1, sol2] = solutions;

      // Compare quality scores
      if (sol1.qualityScore > sol2.qualityScore) {
        return sol1;
      } else if (sol2.qualityScore > sol1.qualityScore) {
        return sol2;
      } else {
        // Still tied - use code length as final tiebreaker
        return sol1.code.length >= sol2.code.length ? sol1 : sol2;
      }
    };

    /**
     * Tiebreaker for N=3 (three models)
     * Use median rating with quality as secondary tiebreaker
     */
    const tiebreakerN3 = (solutions, reviews) => {
      logger.info('[PeerReview] N=3 tiebreaker: Using median ratings');

      // Calculate median score for each solution
      const medianScores = solutions.map(sol => {
        const scores = reviews
          .filter(r => r.subjectIndex === sol.modelIndex)
          .map(r => r.score)
          .sort((a, b) => a - b);

        const median = scores.length > 0
          ? scores[Math.floor(scores.length / 2)]
          : 0;

        return { solution: sol, median };
      });

      // Sort by median score
      medianScores.sort((a, b) => b.median - a.median);

      // Check if top two have same median
      if (medianScores[0].median === medianScores[1].median) {
        // Use quality score as tiebreaker
        return medianScores[0].solution.qualityScore >= medianScores[1].solution.qualityScore
          ? medianScores[0].solution
          : medianScores[1].solution;
      }

      return medianScores[0].solution;
    };

    /**
     * Tiebreaker for N=4 (four models)
     * Use ranked-choice voting with quality as tiebreaker
     */
    const tiebreakerN4 = (solutions, reviews) => {
      logger.info('[PeerReview] N=4 tiebreaker: Using ranked-choice voting');

      // For each reviewer, rank solutions by score
      const rankings = {};

      solutions.forEach(sol => {
        rankings[sol.modelIndex] = { solution: sol, points: 0 };
      });

      // Assign points: 1st place = 3 points, 2nd = 2 points, 3rd = 1 point, 4th = 0 points
      const reviewerIndices = [...new Set(reviews.map(r => r.reviewerIndex))];

      reviewerIndices.forEach(reviewerIdx => {
        const reviewsByThisReviewer = reviews
          .filter(r => r.reviewerIndex === reviewerIdx)
          .sort((a, b) => b.score - a.score);

        reviewsByThisReviewer.forEach((review, rank) => {
          const points = Math.max(0, 3 - rank);
          rankings[review.subjectIndex].points += points;
        });
      });

      // Sort by total points
      const ranked = Object.values(rankings).sort((a, b) => b.points - a.points);

      // Check for tie at top
      if (ranked.length > 1 && ranked[0].points === ranked[1].points) {
        // Use quality score as tiebreaker
        _stats.tiesEncountered++;
        return ranked[0].solution.qualityScore >= ranked[1].solution.qualityScore
          ? ranked[0].solution
          : ranked[1].solution;
      }

      return ranked[0].solution;
    };

    /**
     * Auto-rater tiebreaker: Use an independent model to rate tied solutions
     * @param {Array<Object>} tiedSolutions - Solutions that are tied
     * @param {string} originalPrompt - Original task prompt
     * @returns {Promise<Object>} Winning solution
     */
    const autoRaterTiebreaker = async (tiedSolutions, originalPrompt) => {
      logger.info('[PeerReview] Advanced tiebreaker: Auto-rater');
      _stats.autoRaterTiebreakers++;

      try {
        // Use a different model as the "judge"
        const judgeModel = 'claude-4-5-sonnet';

        const raterPrompt = `You are an impartial code judge. Rate these ${tiedSolutions.length} solutions to the following task:

TASK: ${originalPrompt}

${tiedSolutions.map((sol, idx) => `
SOLUTION ${idx + 1} (by ${sol.model}):
\`\`\`javascript
${sol.code}
\`\`\`
`).join('\n')}

Which solution is best? Respond with ONLY the number (1-${tiedSolutions.length}) of the best solution.
BEST SOLUTION NUMBER:`;

        const response = await HybridLLMProvider.api.generateWithModel(raterPrompt, {
          model: judgeModel,
          temperature: 0.1,
          maxTokens: 10
        });

        // Parse the chosen solution number
        const match = response.content.match(/(\d+)/);
        if (match) {
          const chosenIndex = parseInt(match[1]) - 1;
          if (chosenIndex >= 0 && chosenIndex < tiedSolutions.length) {
            logger.info(`[PeerReview] Auto-rater selected solution ${chosenIndex + 1}`);
            return tiedSolutions[chosenIndex];
          }
        }

        // Fallback to quality score
        logger.warn('[PeerReview] Auto-rater failed to parse, using quality scores');
        tiedSolutions.sort((a, b) => b.qualityScore - a.qualityScore);
        return tiedSolutions[0];

      } catch (error) {
        logger.error('[PeerReview] Auto-rater failed:', error);
        // Fallback to quality score
        tiedSolutions.sort((a, b) => b.qualityScore - a.qualityScore);
        return tiedSolutions[0];
      }
    };

    /**
     * Plurality voting tiebreaker: Use voting among models to select best solution
     * NOT Paxos consensus - just simple vote counting (majority or plurality wins)
     * @param {Array<Object>} tiedSolutions - Solutions that are tied
     * @param {string} originalPrompt - Original task prompt
     * @returns {Promise<Object>} Winning solution
     */
    const pluralityVotingTiebreaker = async (tiedSolutions, originalPrompt) => {
      logger.info('[PeerReview] Advanced tiebreaker: Plurality voting');
      _stats.pluralityVotingTiebreakers++;

      try {
        // Get 3 voting models (prefer diverse providers)
        const voters = [
          Config.api.get('api.geminiModelBalanced') || 'gemini-2.5-flash',
          Config.api.get('api.openaiModelAdvanced') || 'gpt-5-2025-08-07',
          Config.api.get('api.anthropicModelBalanced') || 'claude-4-5-sonnet'
        ];

        const votingPrompt = `Given these ${tiedSolutions.length} tied solutions, which is the best implementation?

TASK: ${originalPrompt}

${tiedSolutions.map((sol, idx) => `
SOLUTION ${idx + 1}:
\`\`\`javascript
${sol.code}
\`\`\`
`).join('\n')}

Respond with ONLY the number (1-${tiedSolutions.length}) of the best solution.`;

        logger.info('[PeerReview] Collecting votes from 3 models...');

        // Collect votes from all 3 models in parallel
        const votes = await Promise.all(
          voters.map(async (voterModel) => {
            try {
              const response = await HybridLLMProvider.api.generateWithModel(votingPrompt, {
                model: voterModel,
                temperature: 0.1,
                maxTokens: 10
              });

              const match = response.content.match(/(\d+)/);
              if (match) {
                const vote = parseInt(match[1]) - 1;
                logger.info(`[PeerReview] ${voterModel} voted for solution ${vote + 1}`);
                return vote;
              }
              return null;
            } catch (error) {
              logger.warn(`[PeerReview] ${voterModel} failed to vote:`, error.message);
              return null;
            }
          })
        );

        // Count valid votes
        const validVotes = votes.filter(v => v !== null && v >= 0 && v < tiedSolutions.length);

        if (validVotes.length === 0) {
          logger.warn('[PeerReview] No valid votes, falling back to auto-rater');
          return await autoRaterTiebreaker(tiedSolutions, originalPrompt);
        }

        // Tally votes
        const voteCounts = {};
        validVotes.forEach(vote => {
          voteCounts[vote] = (voteCounts[vote] || 0) + 1;
        });

        // Find solution with most votes (majority or plurality)
        const winner = Object.entries(voteCounts)
          .sort((a, b) => b[1] - a[1])[0];

        const winnerIndex = parseInt(winner[0]);
        const voteCount = winner[1];

        logger.info(`[PeerReview] Plurality voting complete: Solution ${winnerIndex + 1} won with ${voteCount}/${validVotes.length} votes`);

        return tiedSolutions[winnerIndex];

      } catch (error) {
        logger.error('[PeerReview] Plurality voting tiebreaker failed:', error);
        // Fallback to auto-rater
        return await autoRaterTiebreaker(tiedSolutions, originalPrompt);
      }
    };

    /**
     * Select winner based on peer reviews
     * @param {Array<Object>} solutions - All solutions
     * @param {Array<Object>} reviews - All peer reviews
     * @param {number} n - Number of models
     * @param {string} originalPrompt - Original task prompt
     * @param {string} tiebreakerMethod - Tiebreaker method ('plurality-voting', 'auto-rater', or 'heuristic')
     * @returns {Promise<Object>} Winning solution
     */
    const selectWinner = async (solutions, reviews, n, originalPrompt, tiebreakerMethod = 'plurality-voting') => {
      logger.info(`[PeerReview] Selecting winner from ${n} solutions based on ${reviews.length} reviews`);

      // Calculate average score for each solution
      const scoredSolutions = solutions.map(sol => {
        const relevantReviews = reviews.filter(r => r.subjectIndex === sol.modelIndex);
        const avgScore = relevantReviews.length > 0
          ? relevantReviews.reduce((sum, r) => sum + r.score, 0) / relevantReviews.length
          : 0;

        return {
          ...sol,
          peerRatingAvg: avgScore,
          peerReviews: relevantReviews
        };
      });

      // Sort by average peer rating
      scoredSolutions.sort((a, b) => b.peerRatingAvg - a.peerRatingAvg);

      // Check for tie at top
      const topScore = scoredSolutions[0].peerRatingAvg;
      const tiedSolutions = scoredSolutions.filter(s => s.peerRatingAvg === topScore);

      if (tiedSolutions.length > 1) {
        logger.warn(`[PeerReview] Tie detected (${tiedSolutions.length} solutions with score ${topScore})`);
        _stats.tiesEncountered++;

        // Apply advanced tiebreaker based on configuration
        // Support 'paxos' for backward compatibility (maps to plurality-voting)
        const normalizedMethod = tiebreakerMethod === 'paxos' ? 'plurality-voting' : tiebreakerMethod;

        if (normalizedMethod === 'plurality-voting') {
          logger.info('[PeerReview] Using plurality voting for tiebreaker');
          return await pluralityVotingTiebreaker(tiedSolutions, originalPrompt);
        } else if (normalizedMethod === 'auto-rater') {
          logger.info('[PeerReview] Using auto-rater for tiebreaker');
          return await autoRaterTiebreaker(tiedSolutions, originalPrompt);
        } else {
          // Heuristic tiebreakers (fast, no additional API calls)
          logger.info('[PeerReview] Using heuristic tiebreaker');
          switch (n) {
            case 2:
              return tiebreakerN2(tiedSolutions, reviews);
            case 3:
              return tiebreakerN3(tiedSolutions, reviews);
            case 4:
              return tiebreakerN4(tiedSolutions, reviews);
            default:
              // Fallback: use quality scores
              tiedSolutions.sort((a, b) => b.qualityScore - a.qualityScore);
              return tiedSolutions[0];
          }
        }
      }

      return scoredSolutions[0];
    };

    /**
     * Run peer review consensus
     * @param {string} prompt - Task prompt
     * @param {Object} options - Options
     * @returns {Promise<Object>} Consensus result
     */
    const runConsensus = async (prompt, options = {}) => {
      const startTime = Date.now();
      const models = options.models || DEFAULT_MODELS;
      const tiebreakerMethod = options.tiebreakerMethod || 'plurality-voting'; // 'plurality-voting', 'auto-rater', or 'heuristic'
      const n = models.length;

      logger.info(`[PeerReview] Starting N=${n} peer review consensus (tiebreaker: ${tiebreakerMethod})`);

      if (n < 2 || n > 4) {
        throw new Error('Peer review consensus requires 2-4 models');
      }

      try {
        _stats.totalReviews++;

        EventBus.emit('peer-review:start', {
          modelCount: n,
          models,
          timestamp: Date.now()
        });

        // PHASE 1: All models generate solutions in parallel
        logger.info('[PeerReview] PHASE 1: Generation');

        const solutions = await Promise.all(
          models.map((model, idx) => generateSolution(prompt, model, idx))
        );

        const validSolutions = solutions.filter(s => !s.failed);

        if (validSolutions.length < 2) {
          throw new Error(`Insufficient valid solutions: ${validSolutions.length}/${n}`);
        }

        EventBus.emit('peer-review:generation_complete', {
          totalSolutions: solutions.length,
          validSolutions: validSolutions.length,
          failedSolutions: solutions.length - validSolutions.length
        });

        // PHASE 2: Each model reviews all OTHER models' solutions
        logger.info('[PeerReview] PHASE 2: Peer Review');

        const reviews = [];

        for (let reviewerIdx = 0; reviewerIdx < validSolutions.length; reviewerIdx++) {
          const reviewer = {
            index: validSolutions[reviewerIdx].modelIndex,
            model: validSolutions[reviewerIdx].model
          };

          // Review all solutions EXCEPT own
          const solutionsToReview = validSolutions.filter(s => s.modelIndex !== reviewer.index);

          const reviewsByThisReviewer = await Promise.all(
            solutionsToReview.map(sol => conductPeerReview(reviewer, sol, prompt))
          );

          reviews.push(...reviewsByThisReviewer);
        }

        logger.info(`[PeerReview] Collected ${reviews.length} peer reviews`);

        EventBus.emit('peer-review:reviews_complete', {
          totalReviews: reviews.length,
          expectedReviews: validSolutions.length * (validSolutions.length - 1)
        });

        // PHASE 3: Select winner based on peer ratings
        logger.info('[PeerReview] PHASE 3: Selection');

        const winner = await selectWinner(validSolutions, reviews, validSolutions.length, prompt, tiebreakerMethod);

        logger.info(`[PeerReview] Winner: Model ${winner.modelIndex + 1} (${winner.model})`);
        logger.info(`[PeerReview] Peer rating: ${(winner.peerRatingAvg * 10).toFixed(2)}/10`);
        logger.info(`[PeerReview] Quality score: ${(winner.qualityScore * 100).toFixed(1)}%`);

        // Update stats
        _stats.consensusReached++;
        const avgReviewScore = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
        _stats.averageReviewScore = (
          (_stats.averageReviewScore * (_stats.totalReviews - 1) + avgReviewScore) /
          _stats.totalReviews
        );

        EventBus.emit('peer-review:consensus_reached', {
          winner: winner.model,
          modelIndex: winner.modelIndex,
          peerRating: winner.peerRatingAvg,
          qualityScore: winner.qualityScore,
          duration: Date.now() - startTime
        });

        return {
          success: true,
          winner,
          solutions: validSolutions,
          reviews,
          n,
          duration: Date.now() - startTime,
          stats: {
            totalReviews: reviews.length,
            averageReviewScore: avgReviewScore,
            consensusMethod: n === 2 ? 'quality-heuristics' : n === 3 ? 'median-rating' : 'ranked-choice'
          }
        };

      } catch (error) {
        logger.error('[PeerReview] Consensus failed:', error);

        EventBus.emit('peer-review:consensus_failed', {
          error: error.message,
          duration: Date.now() - startTime
        });

        throw error;
      }
    };

    /**
     * Get consensus statistics
     */
    const getStats = () => {
      return { ..._stats };
    };

    /**
     * Reset statistics
     */
    const reset = () => {
      _stats = {
        totalReviews: 0,
        consensusReached: 0,
        tiesEncountered: 0,
        pluralityVotingTiebreakers: 0,
        autoRaterTiebreakers: 0,
        averageReviewScore: 0
      };
      logger.info('[PeerReview] Statistics reset');
    };

    // Module initialization
    const init = () => {
      logger.info('[PeerReview] Initialized peer review consensus');

      EventBus.emit('peer-review:ready', {
        supportedN: [2, 3, 4],
        timestamp: Date.now()
      });

      return true;
    };

    // Public API
    return {
      metadata: PeerReviewConsensus.metadata,
      api: {
        init,
        runConsensus,
        getStats,
        reset
      }
    };
  }
};

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(PeerReviewConsensus);
}

export default PeerReviewConsensus;
