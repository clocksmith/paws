// Context Manager Module
// Intelligent context window management and pruning for optimal LLM performance

const ContextManager = {
  metadata: {
    id: 'ContextManager',
    version: '1.0.0',
    dependencies: ['Utils', 'StateManager', 'EventBus'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, StateManager, EventBus } = deps;
    const { logger } = Utils;

    logger.info('[ContextManager] Initializing context management system...');

    // Context limits for different models (tokens)
    const MODEL_LIMITS = {
      'gemini-2.5-flash': 1000000,
      'gemini-2.5-flash-lite': 1000000,
      'claude-4-5-sonnet': 200000,
      'claude-4-5-haiku': 200000,
      'gpt-5-2025-08-07': 128000,
      'gpt-5-2025-08-07-mini': 128000,
      'default': 100000
    };

    // Context importance scoring
    const scoreContextImportance = (item, index, totalItems) => {
      let score = 0;

      // Recency bias (newer = more important)
      const recencyScore = (index / totalItems) * 40;
      score += recencyScore;

      // Role importance
      if (item.role === 'system') score += 30;
      if (item.role === 'user') score += 20;
      if (item.role === 'model') score += 10;

      // Content significance
      const content = JSON.stringify(item.parts || item.content || '');

      // Keyword importance
      if (content.includes('error') || content.includes('failed')) score += 15;
      if (content.includes('success') || content.includes('completed')) score += 10;
      if (content.includes('tool') || content.includes('function')) score += 10;
      if (content.includes('CREATE:') || content.includes('UPDATE:')) score += 20;

      // Length consideration (very long = might be important)
      if (content.length > 1000) score += 5;
      if (content.length > 5000) score += 10;

      return score;
    };

    // Estimate token count (rough approximation)
    const estimateTokens = (content) => {
      const text = typeof content === 'string' ? content : JSON.stringify(content);
      // Rough estimate: ~4 chars per token for English text
      return Math.ceil(text.length / 4);
    };

    // Prune context history intelligently
    const pruneContext = (history, maxTokens, modelName = 'default') => {
      logger.info(`[ContextManager] Pruning context for model: ${modelName}`);

      const limit = MODEL_LIMITS[modelName] || MODEL_LIMITS.default;
      const targetTokens = maxTokens || Math.floor(limit * 0.8); // Use 80% of limit

      // Calculate current token count
      let totalTokens = 0;
      const itemTokens = history.map(item => {
        const tokens = estimateTokens(item);
        totalTokens += tokens;
        return tokens;
      });

      logger.debug(`[ContextManager] Current tokens: ${totalTokens}, Target: ${targetTokens}`);

      // If under limit, no pruning needed
      if (totalTokens <= targetTokens) {
        logger.info('[ContextManager] Context within limits, no pruning needed');
        return { pruned: history, removed: [], stats: { original: totalTokens, final: totalTokens } };
      }

      // Score all items
      const scoredItems = history.map((item, index) => ({
        item,
        tokens: itemTokens[index],
        score: scoreContextImportance(item, index, history.length),
        index
      }));

      // Always keep system prompts and most recent message
      const systemItems = scoredItems.filter(x => x.item.role === 'system');
      const lastItem = scoredItems[scoredItems.length - 1];
      const middleItems = scoredItems.slice(0, -1).filter(x => x.item.role !== 'system');

      // Sort middle items by importance score
      middleItems.sort((a, b) => b.score - a.score);

      // Rebuild context: system + important middle + last
      const pruned = [...systemItems];
      let currentTokens = systemItems.reduce((sum, x) => sum + x.tokens, 0) + lastItem.tokens;

      for (const scored of middleItems) {
        if (currentTokens + scored.tokens <= targetTokens) {
          pruned.push(scored);
          currentTokens += scored.tokens;
        }
      }

      // Add last item
      pruned.push(lastItem);

      // Sort back to original chronological order
      pruned.sort((a, b) => a.index - b.index);

      const removed = scoredItems.filter(x => !pruned.includes(x));

      logger.info(`[ContextManager] Pruned ${removed.length} items, kept ${pruned.length}`);
      logger.debug(`[ContextManager] Token reduction: ${totalTokens} → ${currentTokens}`);

      EventBus.emit('context:pruned', {
        original: history.length,
        final: pruned.length,
        removed: removed.length,
        tokenReduction: totalTokens - currentTokens
      });

      return {
        pruned: pruned.map(x => x.item),
        removed: removed.map(x => x.item),
        stats: {
          original: totalTokens,
          final: currentTokens,
          itemsRemoved: removed.length,
          itemsKept: pruned.length
        }
      };
    };

    // Summarize old context
    const summarizeContext = async (history, maxItems = 10) => {
      logger.info(`[ContextManager] Summarizing context (keeping last ${maxItems} items)`);

      if (history.length <= maxItems) {
        return { summarized: history, summary: null };
      }

      const toSummarize = history.slice(0, -maxItems);
      const toKeep = history.slice(-maxItems);

      // Create summary text
      const summaryParts = [];
      let toolCalls = 0;
      let userMessages = 0;
      let modelResponses = 0;

      for (const item of toSummarize) {
        if (item.role === 'user') userMessages++;
        if (item.role === 'model') modelResponses++;
        if (item.parts?.some(p => p.functionCall)) toolCalls++;
      }

      const summary = {
        role: 'system',
        parts: [{
          text: `[Previous conversation summary: ${userMessages} user messages, ${modelResponses} model responses, ${toolCalls} tool calls over ${toSummarize.length} turns]`
        }]
      };

      logger.info(`[ContextManager] Created summary for ${toSummarize.length} items`);

      EventBus.emit('context:summarized', {
        summarized: toSummarize.length,
        kept: toKeep.length,
        summary: summary.parts[0].text
      });

      return {
        summarized: [summary, ...toKeep],
        summary: summary,
        stats: {
          summarizedItems: toSummarize.length,
          keptItems: toKeep.length
        }
      };
    };

    // Get context statistics
    const getContextStats = (history, modelName = 'default') => {
      const tokens = history.reduce((sum, item) => sum + estimateTokens(item), 0);
      const limit = MODEL_LIMITS[modelName] || MODEL_LIMITS.default;

      return {
        items: history.length,
        tokens: tokens,
        limit: limit,
        utilizationPercent: Math.round((tokens / limit) * 100),
        needsPruning: tokens > limit * 0.8
      };
    };

    // Auto-manage context (prune if needed)
    const autoManageContext = (history, modelName = 'default') => {
      const stats = getContextStats(history, modelName);

      if (stats.needsPruning) {
        logger.info('[ContextManager] Auto-pruning triggered');
        return pruneContext(history, undefined, modelName);
      }

      logger.debug('[ContextManager] Context healthy, no action needed');
      return { pruned: history, removed: [], stats: { original: stats.tokens, final: stats.tokens } };
    };

    logger.info('[ContextManager] Module initialized successfully');

    return {
      pruneContext,
      summarizeContext,
      getContextStats,
      autoManageContext,
      estimateTokens,
      MODEL_LIMITS
    };
  }
};

// Export standardized module
export default ContextManager;
