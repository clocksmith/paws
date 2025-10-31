// Multi-Model Coordinator - Unified multi-model execution for REPLOID
// Combines Arena, Consensus, and Swarm patterns into one simple module

const MultiModelCoordinator = {
  metadata: {
    name: 'MultiModelCoordinator',
    version: '1.0.0'
  },

  factory: (deps) => {
    const { llmClient, toolRunner, vfs } = deps;

    // Helper: Estimate token count from text
    const estimateTokens = (text) => {
      if (!text || typeof text !== 'string') return 0;
      const words = text.split(/\s+/).filter(w => w.length > 0).length;
      return Math.ceil(words / 0.7); // 0.7 words per token
    };

    // Helper: Extract code from markdown response
    const extractCode = (content) => {
      if (!content) return '';
      const codeMatch = content.match(/```(?:javascript|js)?\s*([\s\S]*?)```/);
      return codeMatch ? codeMatch[1].trim() : content;
    };

    // Helper: Assess code quality with heuristics
    const assessCodeQuality = (code) => {
      if (!code) return 0;
      let score = 0.5;

      // Positive indicators
      if (code.includes('/**')) score += 0.1;
      if (code.includes('try') && code.includes('catch')) score += 0.1;
      if (code.match(/const |let /g)?.length > 0) score += 0.1;
      if (code.includes('async') || code.includes('await')) score += 0.05;
      if (code.match(/\n/g)?.length > 20) score += 0.05;

      // Negative indicators
      if (code.includes('eval(')) score -= 0.2;
      if (code.includes('TODO') || code.includes('FIXME')) score -= 0.1;
      if (code.length < 100) score -= 0.2;

      return Math.max(0, Math.min(1, score));
    };

    /**
     * ARENA MODE: Models compete, best wins
     * All models get same prompt, generate solutions, best scored solution wins
     */
    const runArena = async (messages, models, onUpdate) => {
      console.log(`[MultiModel] Arena mode: ${models.length} models competing`);

      if (onUpdate) {
        onUpdate({
          mode: 'arena',
          phase: 'generation',
          total: models.length,
          completed: 0
        });
      }

      // Phase 1: Generate solutions in parallel
      const solutions = await Promise.all(
        models.map(async (model, idx) => {
          try {
            const response = await llmClient.chat(messages, model);
            const code = extractCode(response.content);

            if (onUpdate) {
              onUpdate({
                mode: 'arena',
                phase: 'generation',
                total: models.length,
                completed: idx + 1
              });
            }

            return {
              model: model.id,
              content: response.content,
              code,
              quality: assessCodeQuality(code),
              tokens: estimateTokens(response.content),
              failed: false
            };
          } catch (error) {
            console.error(`[MultiModel] Model ${model.id} failed:`, error);
            return {
              model: model.id,
              error: error.message,
              failed: true
            };
          }
        })
      );

      // Phase 2: Score solutions
      if (onUpdate) {
        onUpdate({
          mode: 'arena',
          phase: 'scoring',
          total: solutions.length,
          completed: 0
        });
      }

      const validSolutions = solutions.filter(s => !s.failed);

      if (validSolutions.length === 0) {
        throw new Error('All models failed in arena');
      }

      // Score = quality (60%) + length (20%) + no errors (20%)
      const scoredSolutions = validSolutions.map(sol => {
        let score = sol.quality * 0.6;

        // Length score: prefer substantial solutions
        const lengthScore = Math.min(1, sol.code.length / 500);
        score += lengthScore * 0.2;

        // Error indicators
        const hasErrors = sol.content.toLowerCase().includes('error') ||
                         sol.content.toLowerCase().includes('failed');
        if (!hasErrors) score += 0.2;

        return { ...sol, score };
      });

      // Select winner (highest score)
      const winner = scoredSolutions.sort((a, b) => b.score - a.score)[0];

      console.log(`[MultiModel] Arena winner: ${winner.model} (score: ${winner.score.toFixed(2)})`);

      return {
        mode: 'arena',
        winner,
        solutions: scoredSolutions,
        result: {
          content: winner.content,
          usage: { tokens: winner.tokens }
        }
      };
    };

    /**
     * SWARM MODE: Parallel execution, merge results
     * Models work on same task in parallel, results are merged
     */
    const runSwarm = async (messages, models, onUpdate) => {
      console.log(`[MultiModel] Swarm mode: ${models.length} models in parallel`);

      if (onUpdate) {
        onUpdate({
          mode: 'swarm',
          phase: 'execution',
          total: models.length,
          completed: 0
        });
      }

      // Execute all models in parallel
      const results = await Promise.all(
        models.map(async (model, idx) => {
          try {
            const response = await llmClient.chat(messages, model);

            if (onUpdate) {
              onUpdate({
                mode: 'swarm',
                phase: 'execution',
                total: models.length,
                completed: idx + 1
              });
            }

            return {
              model: model.id,
              content: response.content,
              tokens: estimateTokens(response.content),
              failed: false
            };
          } catch (error) {
            console.error(`[MultiModel] Model ${model.id} failed:`, error);
            return {
              model: model.id,
              error: error.message,
              failed: true
            };
          }
        })
      );

      const validResults = results.filter(r => !r.failed);

      if (validResults.length === 0) {
        throw new Error('All models failed in swarm');
      }

      // Phase 2: Merge results
      if (onUpdate) {
        onUpdate({
          mode: 'swarm',
          phase: 'merging',
          total: 1,
          completed: 0
        });
      }

      // Simple merge: concatenate all responses with headers
      const merged = validResults.map(r =>
        `[${r.model}]\n${r.content}`
      ).join('\n\n---\n\n');

      const totalTokens = validResults.reduce((sum, r) => sum + r.tokens, 0);

      console.log(`[MultiModel] Swarm complete: ${validResults.length} models succeeded`);

      return {
        mode: 'swarm',
        results: validResults,
        merged,
        result: {
          content: merged,
          usage: { tokens: totalTokens }
        }
      };
    };

    /**
     * CONSENSUS MODE: Models vote on decisions
     * Each model generates response, then all models vote on best
     */
    const runConsensus = async (messages, models, onUpdate) => {
      console.log(`[MultiModel] Consensus mode: ${models.length} models voting`);

      if (onUpdate) {
        onUpdate({
          mode: 'consensus',
          phase: 'generation',
          total: models.length,
          completed: 0
        });
      }

      // Phase 1: Generate solutions
      const solutions = await Promise.all(
        models.map(async (model, idx) => {
          try {
            const response = await llmClient.chat(messages, model);

            if (onUpdate) {
              onUpdate({
                mode: 'consensus',
                phase: 'generation',
                total: models.length,
                completed: idx + 1
              });
            }

            return {
              model: model.id,
              content: response.content,
              tokens: estimateTokens(response.content),
              failed: false
            };
          } catch (error) {
            console.error(`[MultiModel] Model ${model.id} failed:`, error);
            return {
              model: model.id,
              error: error.message,
              failed: true
            };
          }
        })
      );

      const validSolutions = solutions.filter(s => !s.failed);

      if (validSolutions.length === 0) {
        throw new Error('All models failed in consensus');
      }

      // Phase 2: Voting round - each model rates all solutions
      if (onUpdate) {
        onUpdate({
          mode: 'consensus',
          phase: 'voting',
          total: validSolutions.length * models.length,
          completed: 0
        });
      }

      const votes = [];
      let voteCount = 0;

      for (const voter of models) {
        for (const solution of validSolutions) {
          try {
            const votePrompt = `Rate this solution on a scale of 0-10 (0=completely wrong, 10=perfect).

Original task: ${messages[messages.length - 1].content}

Solution from ${solution.model}:
${solution.content.substring(0, 500)}...

Respond with ONLY a number from 0-10.
SCORE:`;

            const voteResponse = await llmClient.chat(
              [{ role: 'user', content: votePrompt }],
              voter
            );

            const scoreMatch = voteResponse.content.match(/(\d+(?:\.\d+)?)/);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 5.0;
            const normalizedScore = Math.max(0, Math.min(10, score)) / 10;

            votes.push({
              voter: voter.id,
              solution: solution.model,
              score: normalizedScore
            });

            voteCount++;
            if (onUpdate) {
              onUpdate({
                mode: 'consensus',
                phase: 'voting',
                total: validSolutions.length * models.length,
                completed: voteCount
              });
            }
          } catch (error) {
            console.error(`[MultiModel] Vote failed:`, error);
            // Use neutral score on error
            votes.push({
              voter: voter.id,
              solution: solution.model,
              score: 0.5,
              error: true
            });
          }
        }
      }

      // Phase 3: Tally votes
      const tallies = {};
      validSolutions.forEach(sol => {
        const solVotes = votes.filter(v => v.solution === sol.model);
        const avgScore = solVotes.reduce((sum, v) => sum + v.score, 0) / solVotes.length;
        tallies[sol.model] = { solution: sol, avgScore, votes: solVotes };
      });

      // Select winner by average score
      const winner = Object.values(tallies).sort((a, b) => b.avgScore - a.avgScore)[0];

      console.log(`[MultiModel] Consensus winner: ${winner.solution.model} (score: ${winner.avgScore.toFixed(2)})`);

      return {
        mode: 'consensus',
        winner: winner.solution,
        tallies,
        votes,
        result: {
          content: winner.solution.content,
          usage: { tokens: winner.solution.tokens }
        }
      };
    };

    /**
     * Main execution function
     * Routes to appropriate mode based on config
     */
    const execute = async (messages, config, onUpdate) => {
      const mode = config.mode || 'arena'; // arena, swarm, consensus
      const models = config.models || [];

      if (models.length < 2) {
        throw new Error('Multi-model mode requires at least 2 models');
      }

      console.log(`[MultiModel] Executing in ${mode} mode with ${models.length} models`);

      switch (mode) {
        case 'arena':
          return await runArena(messages, models, onUpdate);
        case 'swarm':
          return await runSwarm(messages, models, onUpdate);
        case 'consensus':
          return await runConsensus(messages, models, onUpdate);
        default:
          throw new Error(`Unknown multi-model mode: ${mode}`);
      }
    };

    return {
      execute,
      // Individual modes exposed for direct use
      runArena,
      runSwarm,
      runConsensus
    };
  }
};

export default MultiModelCoordinator;
