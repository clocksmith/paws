// @blueprint 0x000040 - Intelligent context window management and pruning for optimal LLM performance.
// Context Manager Module
// Intelligent context window management and pruning for optimal LLM performance

const ContextManager = {
  metadata: {
    id: 'ContextManager',
    version: '1.0.0',
    dependencies: ['Utils', 'Storage', 'EventBus'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, Storage, EventBus } = deps;
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

    // Context operation tracking for widget
    let contextOperations = [];
    let contextStats = {
      totalPrunes: 0,
      totalSummarizations: 0,
      tokensSaved: 0,
      itemsRemoved: 0
    };

    // Wrap functions to track operations
    const trackedPruneContext = (history, maxTokens, modelName) => {
      const result = pruneContext(history, maxTokens, modelName);

      contextStats.totalPrunes++;
      contextStats.tokensSaved += (result.stats.original - result.stats.final);
      contextStats.itemsRemoved += result.removed.length;

      contextOperations.push({
        type: 'prune',
        timestamp: Date.now(),
        itemsRemoved: result.removed.length,
        tokensSaved: result.stats.original - result.stats.final,
        modelName: modelName || 'default'
      });

      if (contextOperations.length > 50) {
        contextOperations = contextOperations.slice(-50);
      }

      return result;
    };

    const trackedSummarizeContext = async (history, maxItems) => {
      const result = await summarizeContext(history, maxItems);

      contextStats.totalSummarizations++;
      if (result.stats) {
        contextStats.itemsRemoved += result.stats.summarizedItems;
      }

      contextOperations.push({
        type: 'summarize',
        timestamp: Date.now(),
        itemsSummarized: result.stats?.summarizedItems || 0,
        itemsKept: result.stats?.keptItems || 0
      });

      if (contextOperations.length > 50) {
        contextOperations = contextOperations.slice(-50);
      }

      return result;
    };

    logger.info('[ContextManager] Module initialized successfully');

    // Clear stats function for widget
    const clearStats = () => {
      contextOperations = [];
      contextStats = {
        totalPrunes: 0,
        totalSummarizations: 0,
        tokensSaved: 0,
        itemsRemoved: 0
      };
      EventBus.emit('toast:success', { message: 'Context stats cleared' });
    };

    // Expose state for widget
    const getState = () => ({
      contextOperations,
      contextStats,
      modelLimits: MODEL_LIMITS
    });

    return {
      api: {
        pruneContext: trackedPruneContext,
        summarizeContext: trackedSummarizeContext,
        getContextStats,
        autoManageContext,
        estimateTokens,
        MODEL_LIMITS,
        clearStats,
        getState
      },

      widget: {
        element: 'context-manager-widget',
        displayName: 'Context Manager',
        icon: '✎',
        category: 'ai',
        updateInterval: null
      }
    };
  }
};

// Web Component for Context Manager Widget
if (typeof HTMLElement !== 'undefined') {
class ContextManagerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventBus = null;
  }

  connectedCallback() {
    // Resolve EventBus from DI container
    if (typeof window !== 'undefined' && window.DIContainer) {
      this._eventBus = window.DIContainer.resolve('EventBus');
    }

    this.render();

    // Set up EventBus listeners for real-time updates
    if (this._eventBus) {
      this._updateHandler = () => this.render();
      this._eventBus.on('context:pruned', this._updateHandler, 'ContextManagerWidget');
      this._eventBus.on('context:summarized', this._updateHandler, 'ContextManagerWidget');
    }
  }

  disconnectedCallback() {
    // Clean up EventBus listeners
    if (this._eventBus && this._updateHandler) {
      this._eventBus.off('context:pruned', this._updateHandler);
      this._eventBus.off('context:summarized', this._updateHandler);
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const state = this._api.getState();
    const recentOp = state.contextOperations.length > 0
      ? state.contextOperations[state.contextOperations.length - 1]
      : null;

    const isActive = recentOp && (Date.now() - recentOp.timestamp) < 30000;

    return {
      state: isActive ? 'active' : 'idle',
      primaryMetric: `${state.contextStats.totalPrunes} prunes`,
      secondaryMetric: `${Math.round(state.contextStats.tokensSaved / 1000)}K tokens saved`,
      lastActivity: recentOp?.timestamp || null,
      message: recentOp ? `Last: ${recentOp.type}` : null
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { contextOperations, contextStats, modelLimits } = state;

    const recentOps = contextOperations.slice(-20).reverse();

    // Calculate model limit info
    const modelList = Object.entries(modelLimits).map(([name, limit]) => ({
      name,
      limit,
      limitFormatted: (limit / 1000).toFixed(0) + 'K'
    }));

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #4fc3f7;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #aaa;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
          gap: 12px;
          margin-bottom: 16px;
        }

        .stat-card {
          background: rgba(255,255,255,0.05);
          border-radius: 6px;
          padding: 12px;
        }

        .stat-card.prune {
          background: rgba(0,255,255,0.1);
          border-left: 3px solid #0ff;
        }

        .stat-card.summarize {
          background: rgba(156,39,176,0.1);
          border-left: 3px solid #9c27b0;
        }

        .stat-card.saved {
          background: rgba(76,175,80,0.1);
          border-left: 3px solid #4caf50;
        }

        .stat-label {
          font-size: 0.85em;
          color: #888;
          margin-bottom: 4px;
        }

        .stat-value {
          font-size: 1.5em;
          font-weight: bold;
        }

        .stat-value.cyan { color: #0ff; }
        .stat-value.purple { color: #9c27b0; }
        .stat-value.green { color: #4caf50; }

        .model-limits {
          margin-bottom: 16px;
        }

        .model-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: 8px;
        }

        .model-item {
          padding: 8px;
          background: rgba(255,255,255,0.05);
          border-radius: 4px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .model-name {
          font-size: 0.85em;
          color: #ccc;
        }

        .model-limit {
          font-weight: bold;
          color: #4fc3f7;
          font-size: 0.9em;
        }

        .operations-list {
          max-height: 300px;
          overflow-y: auto;
        }

        .operation-item {
          padding: 10px;
          margin-bottom: 8px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
        }

        .operation-item.prune {
          border-left: 3px solid #0ff;
        }

        .operation-item.summarize {
          border-left: 3px solid #9c27b0;
        }

        .operation-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }

        .operation-type {
          font-weight: bold;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .operation-time {
          font-size: 0.85em;
          color: #888;
        }

        .operation-details {
          font-size: 0.85em;
          color: #aaa;
        }

        .operation-model {
          font-size: 0.8em;
          color: #666;
          margin-top: 2px;
        }

        .no-operations {
          color: #888;
          padding: 20px;
          text-align: center;
        }

        button {
          background: rgba(79, 195, 247, 0.3);
          border: 1px solid #4fc3f7;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 8px 12px;
          font-size: 0.9em;
          font-weight: bold;
          transition: background 0.2s;
          margin-top: 12px;
        }

        button:hover {
          background: rgba(79, 195, 247, 0.5);
        }

        .info-panel {
          margin-top: 16px;
          padding: 12px;
          background: rgba(100,150,255,0.1);
          border-left: 3px solid #6496ff;
          border-radius: 4px;
        }

        .info-panel strong {
          display: block;
          margin-bottom: 6px;
        }

        .scrollable {
          scrollbar-width: thin;
          scrollbar-color: rgba(79, 195, 247, 0.5) rgba(255,255,255,0.1);
        }

        .scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .scrollable::-webkit-scrollbar-track {
          background: rgba(255,255,255,0.1);
          border-radius: 3px;
        }

        .scrollable::-webkit-scrollbar-thumb {
          background: rgba(79, 195, 247, 0.5);
          border-radius: 3px;
        }
      </style>

      <div class="context-manager-panel">
        <h4>✎ Context Manager</h4>

        <div class="stats-grid">
          <div class="stat-card prune">
            <div class="stat-label">Prune Operations</div>
            <div class="stat-value cyan">${contextStats.totalPrunes}</div>
          </div>
          <div class="stat-card summarize">
            <div class="stat-label">Summarizations</div>
            <div class="stat-value purple">${contextStats.totalSummarizations}</div>
          </div>
          <div class="stat-card saved">
            <div class="stat-label">Tokens Saved</div>
            <div class="stat-value green">${Math.round(contextStats.tokensSaved / 1000)}K</div>
          </div>
        </div>

        <div class="model-limits">
          <h5>Model Context Limits</h5>
          <div class="model-grid">
            ${modelList.filter(m => m.name !== 'default').map(model => `
              <div class="model-item">
                <div class="model-name">${model.name.replace('gemini-', '').replace('claude-', '').replace('gpt-', '')}</div>
                <div class="model-limit">${model.limitFormatted}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <h5>Recent Operations (${recentOps.length})</h5>
        <div class="operations-list scrollable">
          ${recentOps.length > 0 ? recentOps.map(op => {
            const time = new Date(op.timestamp).toLocaleTimeString();
            const typeClass = op.type;
            const typeIcon = op.type === 'prune' ? '✂' : '⛿';

            return `
              <div class="operation-item ${typeClass}">
                <div class="operation-header">
                  <div class="operation-type">
                    ${typeIcon} ${op.type.charAt(0).toUpperCase() + op.type.slice(1)}
                  </div>
                  <div class="operation-time">${time}</div>
                </div>
                ${op.type === 'prune' ? `
                  <div class="operation-details">
                    Removed ${op.itemsRemoved} items · Saved ${Math.round(op.tokensSaved / 1000)}K tokens
                  </div>
                  <div class="operation-model">Model: ${op.modelName}</div>
                ` : ''}
                ${op.type === 'summarize' ? `
                  <div class="operation-details">
                    Summarized ${op.itemsSummarized} items · Kept ${op.itemsKept} items
                  </div>
                ` : ''}
              </div>
            `;
          }).join('') : '<div class="no-operations">No operations yet</div>'}
        </div>

        <button id="clear-stats">⛶ Clear Stats</button>

        <div class="info-panel">
          <strong>ⓘ Context Manager</strong>
          <div style="color: #aaa; font-size: 0.9em;">
            Intelligent context window management and pruning for optimal LLM performance.<br>
            Automatically manages context limits for different models and tracks optimization operations.
          </div>
        </div>
      </div>
    `;

    // Attach event listeners
    const clearBtn = this.shadowRoot.getElementById('clear-stats');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this._api.clearStats();
        this.render();
      });
    }
  }
}

// Define the custom element
if (!customElements.get('context-manager-widget')) {
  customElements.define('context-manager-widget', ContextManagerWidget);
}
}

// Export standardized module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContextManager;
}
export default ContextManager;
