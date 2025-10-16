// Penteract Analytics Aggregator
// Consolidates Paxos telemetry into actionable analytics for visualization

const PenteractAnalytics = {
  metadata: {
    id: 'PenteractAnalytics',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils', 'StateManager'],
    async: true,
    type: 'analytics'
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger } = Utils;

    const HISTORY_PATH = '/analytics/penteract-analytics.json';
    const HISTORY_LIMIT = 20;

    let history = [];
    let latest = null;

    const clone = (value) => JSON.parse(JSON.stringify(value));

    const loadHistory = async () => {
      try {
        const existing = await StateManager.getArtifactContent(HISTORY_PATH);
        if (!existing) return;

        const payload = JSON.parse(existing);
        history = Array.isArray(payload.history) ? payload.history : [];
        latest = payload.latest || null;
        logger.info('[PenteractAnalytics] Loaded analytics history', {
          runs: history.length
        });
      } catch (error) {
        logger.warn('[PenteractAnalytics] Failed to load analytics history:', error);
        history = [];
        latest = null;
      }
    };

    const persistHistory = async () => {
      try {
        const payload = JSON.stringify(
          { history, latest },
          null,
          2
        );
        const exists = !!StateManager.getArtifactMetadata(HISTORY_PATH);
        if (exists) {
          await StateManager.updateArtifact(HISTORY_PATH, payload);
        } else {
          await StateManager.createArtifact(
            HISTORY_PATH,
            'json',
            payload,
            'Penteract analytics history'
          );
        }
      } catch (error) {
        logger.warn('[PenteractAnalytics] Failed to persist analytics history:', error);
      }
    };

    const normaliseAgent = (agent = {}) => {
      const status = String(agent.status || agent.result || 'UNKNOWN').toUpperCase();
      return {
        name: agent.name || agent.id || 'Unknown',
        model: agent.model || agent.model_id || 'Unknown',
        status,
        execution_time: Number(agent.execution_time || agent.duration || 0),
        token_count: Number(agent.token_count || agent.tokens || 0),
        solution_path: agent.solution_path || agent.bundle_path || null,
        error: agent.error || agent.error_message || null
      };
    };

    const analyseAgents = (agents) => {
      const totals = {
        total: agents.length,
        pass: 0,
        fail: 0,
        error: 0
      };

      let totalTokens = 0;
      let totalTime = 0;

      const passes = [];
      const failures = [];
      const errors = [];

      agents.forEach((agent) => {
        totalTokens += agent.token_count || 0;
        totalTime += agent.execution_time || 0;

        switch (agent.status) {
          case 'PASS':
            totals.pass += 1;
            passes.push(agent);
            break;
          case 'FAIL':
            totals.fail += 1;
            failures.push(agent);
            break;
          case 'ERROR':
            totals.error += 1;
            errors.push(agent);
            break;
          default:
            totals.fail += 1;
            failures.push(agent);
        }
      });

      const averageTokens = totals.total ? Math.round(totalTokens / totals.total) : 0;
      const averageTime = totals.total ? Number((totalTime / totals.total).toFixed(3)) : 0;

      const sortedByTime = [...agents].sort(
        (a, b) => (a.execution_time || Infinity) - (b.execution_time || Infinity)
      );
      const fastest = sortedByTime.find((agent) => agent.status === 'PASS') || sortedByTime[0] || null;

      const sortedByTokens = [...agents].sort(
        (a, b) => (b.token_count || 0) - (a.token_count || 0)
      );
      const mostExpensive = sortedByTokens[0] || null;

      return {
        totals,
        averageTokens,
        averageTime,
        fastest,
        mostExpensive,
        passes,
        failures,
        errors
      };
    };

    const buildRecommendations = (summary, consensus) => {
      const recommendations = [];

      if (summary.totals.pass === 0) {
        recommendations.push('Consensus failed — schedule follow-up review or rerun with revised prompts.');
      }

      if (summary.failures.length) {
        recommendations.push(
          `Investigate failing agents: ${summary.failures
            .slice(0, 3)
            .map((agent) => agent.name)
            .join(', ')}`
        );
      }

      if (summary.errors.length) {
        recommendations.push(
          `Errors encountered for: ${summary.errors
            .slice(0, 3)
            .map((agent) => agent.name)
            .join(', ')}`
        );
      }

      if (summary.totals.total > 0 && summary.averageTime > 30) {
        recommendations.push('Average execution time exceeded 30s — consider running agents in parallel or optimising prompts.');
      }

      if (consensus?.status === 'success' && summary.fastest) {
        recommendations.push(`Consider promoting ${summary.fastest.name} (${summary.fastest.model}) as primary implementation candidate.`);
      }

      return recommendations;
    };

    const enrichSnapshot = (snapshot) => {
      const agents = Array.isArray(snapshot.agents)
        ? snapshot.agents.map(normaliseAgent)
        : [];

      const consensus = snapshot.consensus || {};
      const summary = analyseAgents(agents);
      const recommendations = buildRecommendations(summary, consensus);

      return {
        ...snapshot,
        agents,
        consensus: {
          status: (consensus.status || 'unknown').toLowerCase(),
          passing: consensus.passing || [],
          verify: Boolean(snapshot.verify)
        },
        metrics: {
          totals: summary.totals,
          averages: {
            tokens: summary.averageTokens,
            executionTime: summary.averageTime
          },
          fastestAgent: summary.fastest,
          highestTokenAgent: summary.mostExpensive
        },
        recommendations
      };
    };

    const processSnapshot = async (snapshot) => {
      if (!snapshot || typeof snapshot !== 'object') {
        return;
      }

      const processed = enrichSnapshot(snapshot);
      latest = processed;
      history.push(processed);
      history = history.slice(-HISTORY_LIMIT);

      await persistHistory();

      EventBus.emit('paxos:analytics:processed', processed);
    };

    const handleSnapshot = (snapshot) => {
      Promise.resolve(processSnapshot(snapshot)).catch((error) => {
        logger.error('[PenteractAnalytics] Failed to process analytics snapshot:', error);
      });
    };

    const init = async () => {
      await loadHistory();
      EventBus.on('paxos:analytics', handleSnapshot, 'PenteractAnalytics');

      if (latest) {
        EventBus.emit('paxos:analytics:processed', latest);
      }

      logger.info('[PenteractAnalytics] Analytics pipeline initialised');
      return true;
    };

    return {
      init,
      api: {
        getLatest: () => (latest ? clone(latest) : null),
        getHistory: () => history.map(clone),
        getSummary: () => ({
          totalRuns: history.length,
          lastRunAt: latest?.timestamp || null,
          successRate:
            history.length === 0
              ? 0
              : Math.round(
                  (history.filter((entry) => entry.consensus?.status === 'success').length /
                    history.length) *
                    100
                ),
          consensusTrail: history.map((entry) => ({
            timestamp: entry.timestamp,
            status: entry.consensus?.status || 'unknown',
            passing: entry.consensus?.passing || []
          }))
        }),
        ingestSnapshot: (snapshot) => {
          handleSnapshot(snapshot);
        }
      }
    };
  }
};

export default PenteractAnalytics;
