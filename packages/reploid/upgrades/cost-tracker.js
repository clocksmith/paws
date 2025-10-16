/**
 * @fileoverview API Cost Tracker and Rate Limiter for REPLOID
 * Tracks API usage costs across providers and enforces rate limits.
 * Displays spending metrics in dashboard and warns on budget overruns.
 *
 * @module CostTracker
 * @version 1.0.0
 * @category analytics
 */

const CostTracker = {
  metadata: {
    id: 'CostTracker',
    version: '1.0.0',
    dependencies: ['EventBus', 'Utils', 'StateManager'],
    async: true,
    type: 'analytics'
  },

  factory: (deps) => {
    const { EventBus, Utils, StateManager } = deps;
    const { logger } = Utils;

    // Pricing per 1M tokens (input/output) in USD
    const PRICING = {
      'gemini': { input: 0.075, output: 0.30, name: 'Gemini 1.5 Flash' },
      'gemini-pro': { input: 0.35, output: 1.05, name: 'Gemini 1.5 Pro' },
      'openai': { input: 10.00, output: 30.00, name: 'GPT-4 Turbo' },
      'anthropic': { input: 3.00, output: 15.00, name: 'Claude 3 Opus' },
      'local': { input: 0, output: 0, name: 'Local LLM' }
    };

    // Rate limits (requests per minute)
    const RATE_LIMITS = {
      'gemini': 15,
      'gemini-pro': 2,
      'openai': 10,
      'anthropic': 5,
      'local': null // No limit for local
    };

    // Session state
    let sessionStart = Date.now();
    let apiCalls = [];
    let rateLimitBuckets = {}; // provider -> [timestamps]

    /**
     * Initialize cost tracker
     */
    const init = async () => {
      logger.info('[CostTracker] Initializing API cost tracking');

      // Listen for API completion events
      EventBus.on('api:complete', handleApiComplete);
      EventBus.on('hybrid-llm:complete', handleHybridComplete);
      EventBus.on('local-llm:complete', handleLocalComplete);

      // Restore session data if available
      const state = await StateManager.getState();
      if (state.costTracking) {
        apiCalls = state.costTracking.apiCalls || [];
        sessionStart = state.costTracking.sessionStart || Date.now();
        logger.info(`[CostTracker] Restored ${apiCalls.length} API calls from state`);
      }

      return true;
    };

    /**
     * Handle API completion event
     */
    const handleApiComplete = (data) => {
      const { provider, usage, timestamp } = data;

      if (!usage) return;

      const call = {
        timestamp: timestamp || Date.now(),
        provider: provider || 'gemini',
        inputTokens: usage.promptTokenCount || usage.prompt_tokens || 0,
        outputTokens: usage.candidatesTokenCount || usage.completion_tokens || 0,
        totalTokens: usage.totalTokenCount || usage.total_tokens || 0
      };

      call.cost = calculateCost(call);
      apiCalls.push(call);

      logger.debug(`[CostTracker] Logged API call: $${call.cost.toFixed(4)} (${call.provider})`);

      // Persist to state
      persistState();

      // Emit cost update event
      EventBus.emit('cost:updated', {
        totalCost: getTotalCost(),
        sessionCost: getSessionCost(),
        apiCalls: apiCalls.length
      });
    };

    /**
     * Handle hybrid LLM completion event
     */
    const handleHybridComplete = (data) => {
      if (data.provider === 'cloud' && data.usage) {
        handleApiComplete({
          provider: 'gemini',
          usage: data.usage,
          timestamp: Date.now()
        });
      } else if (data.provider === 'local') {
        handleLocalComplete(data);
      }
    };

    /**
     * Handle local LLM completion event
     */
    const handleLocalComplete = (data) => {
      const call = {
        timestamp: Date.now(),
        provider: 'local',
        inputTokens: data.usage?.promptTokens || 0,
        outputTokens: data.usage?.completionTokens || 0,
        totalTokens: data.usage?.totalTokens || 0,
        cost: 0 // Local is free
      };

      apiCalls.push(call);
      persistState();
    };

    /**
     * Calculate cost for an API call
     */
    const calculateCost = (call) => {
      const pricing = PRICING[call.provider] || PRICING['gemini'];

      const inputCost = (call.inputTokens / 1000000) * pricing.input;
      const outputCost = (call.outputTokens / 1000000) * pricing.output;

      return inputCost + outputCost;
    };

    /**
     * Check rate limit before making request
     * @returns {boolean} True if request is allowed, false if rate limited
     */
    const checkRateLimit = (provider) => {
      const limit = RATE_LIMITS[provider];

      // No limit for local
      if (limit === null) return true;

      // Initialize bucket if needed
      if (!rateLimitBuckets[provider]) {
        rateLimitBuckets[provider] = [];
      }

      const now = Date.now();
      const oneMinuteAgo = now - 60000;

      // Remove timestamps older than 1 minute
      rateLimitBuckets[provider] = rateLimitBuckets[provider].filter(
        ts => ts > oneMinuteAgo
      );

      // Check if under limit
      if (rateLimitBuckets[provider].length >= limit) {
        const oldestRequest = rateLimitBuckets[provider][0];
        const waitTime = Math.ceil((oldestRequest + 60000 - now) / 1000);

        logger.warn(`[CostTracker] Rate limit exceeded for ${provider}. Wait ${waitTime}s`);

        EventBus.emit('rate-limit:exceeded', {
          provider,
          limit,
          waitTime
        });

        return false;
      }

      // Add current request
      rateLimitBuckets[provider].push(now);
      return true;
    };

    /**
     * Get total cost across all time
     */
    const getTotalCost = () => {
      return apiCalls.reduce((sum, call) => sum + (call.cost || 0), 0);
    };

    /**
     * Get cost for current session
     */
    const getSessionCost = () => {
      return apiCalls
        .filter(call => call.timestamp >= sessionStart)
        .reduce((sum, call) => sum + (call.cost || 0), 0);
    };

    /**
     * Get cost breakdown by provider
     */
    const getCostByProvider = () => {
      const breakdown = {};

      for (const call of apiCalls) {
        if (!breakdown[call.provider]) {
          breakdown[call.provider] = {
            count: 0,
            totalCost: 0,
            inputTokens: 0,
            outputTokens: 0,
            name: PRICING[call.provider]?.name || call.provider
          };
        }

        breakdown[call.provider].count++;
        breakdown[call.provider].totalCost += call.cost || 0;
        breakdown[call.provider].inputTokens += call.inputTokens || 0;
        breakdown[call.provider].outputTokens += call.outputTokens || 0;
      }

      return breakdown;
    };

    /**
     * Get cost statistics for time period
     */
    const getCostStats = (periodMs = 86400000) => {
      const now = Date.now();
      const periodStart = now - periodMs;

      const periodCalls = apiCalls.filter(call => call.timestamp >= periodStart);

      return {
        period: periodMs,
        callCount: periodCalls.length,
        totalCost: periodCalls.reduce((sum, call) => sum + (call.cost || 0), 0),
        avgCostPerCall: periodCalls.length > 0
          ? periodCalls.reduce((sum, call) => sum + (call.cost || 0), 0) / periodCalls.length
          : 0,
        inputTokens: periodCalls.reduce((sum, call) => sum + (call.inputTokens || 0), 0),
        outputTokens: periodCalls.reduce((sum, call) => sum + (call.outputTokens || 0), 0)
      };
    };

    /**
     * Get rate limit status for all providers
     */
    const getRateLimitStatus = () => {
      const status = {};

      for (const provider in RATE_LIMITS) {
        const limit = RATE_LIMITS[provider];
        if (limit === null) {
          status[provider] = { limit: null, used: 0, available: Infinity };
          continue;
        }

        const bucket = rateLimitBuckets[provider] || [];
        const now = Date.now();
        const oneMinuteAgo = now - 60000;

        const used = bucket.filter(ts => ts > oneMinuteAgo).length;

        status[provider] = {
          limit,
          used,
          available: limit - used,
          resetIn: bucket.length > 0 ? Math.ceil((bucket[0] + 60000 - now) / 1000) : 0
        };
      }

      return status;
    };

    /**
     * Generate cost report
     */
    const generateReport = () => {
      const breakdown = getCostByProvider();
      const stats24h = getCostStats(86400000);
      const rateLimits = getRateLimitStatus();

      let report = '# API Cost & Usage Report\n\n';

      // Session overview
      report += `**Session Duration:** ${((Date.now() - sessionStart) / 1000 / 60).toFixed(1)} minutes\n`;
      report += `**Total API Calls:** ${apiCalls.length}\n`;
      report += `**Session Cost:** $${getSessionCost().toFixed(4)}\n`;
      report += `**All-Time Cost:** $${getTotalCost().toFixed(4)}\n\n`;

      // 24h stats
      report += '## Last 24 Hours\n\n';
      report += `**Calls:** ${stats24h.callCount}\n`;
      report += `**Cost:** $${stats24h.totalCost.toFixed(4)}\n`;
      report += `**Avg Cost/Call:** $${stats24h.avgCostPerCall.toFixed(4)}\n`;
      report += `**Input Tokens:** ${stats24h.inputTokens.toLocaleString()}\n`;
      report += `**Output Tokens:** ${stats24h.outputTokens.toLocaleString()}\n\n`;

      // Provider breakdown
      report += '## Cost by Provider\n\n';
      report += '| Provider | Calls | Cost | Input Tokens | Output Tokens |\n';
      report += '|----------|-------|------|--------------|---------------|\n';

      for (const [provider, data] of Object.entries(breakdown)) {
        report += `| ${data.name} | ${data.count} | $${data.totalCost.toFixed(4)} | ${data.inputTokens.toLocaleString()} | ${data.outputTokens.toLocaleString()} |\n`;
      }
      report += '\n';

      // Rate limits
      report += '## Rate Limit Status\n\n';
      report += '| Provider | Used | Available | Limit | Reset In |\n';
      report += '|----------|------|-----------|-------|----------|\n';

      for (const [provider, status] of Object.entries(rateLimits)) {
        const limitStr = status.limit === null ? '∞' : status.limit;
        const availableStr = status.available === Infinity ? '∞' : status.available;
        const resetStr = status.resetIn > 0 ? `${status.resetIn}s` : '-';

        report += `| ${provider} | ${status.used} | ${availableStr} | ${limitStr} | ${resetStr} |\n`;
      }

      return report;
    };

    /**
     * Persist state to storage
     */
    const persistState = async () => {
      await StateManager.updateState(state => {
        state.costTracking = {
          apiCalls,
          sessionStart,
          lastUpdated: Date.now()
        };
        return state;
      });
    };

    /**
     * Reset session tracking
     */
    const resetSession = () => {
      sessionStart = Date.now();
      apiCalls = apiCalls.filter(call => call.timestamp < sessionStart);
      rateLimitBuckets = {};
      persistState();
      logger.info('[CostTracker] Session reset');
    };

    /**
     * Clear all tracking data
     */
    const clearAll = () => {
      apiCalls = [];
      rateLimitBuckets = {};
      sessionStart = Date.now();
      persistState();
      logger.info('[CostTracker] All tracking data cleared');
    };

    return {
      init,
      api: {
        checkRateLimit,
        getTotalCost,
        getSessionCost,
        getCostByProvider,
        getCostStats,
        getRateLimitStatus,
        generateReport,
        resetSession,
        clearAll,
        // Read-only data access
        getApiCalls: () => [...apiCalls],
        getPricing: () => ({ ...PRICING }),
        getRateLimits: () => ({ ...RATE_LIMITS })
      }
    };
  }
};

// Export
CostTracker;
