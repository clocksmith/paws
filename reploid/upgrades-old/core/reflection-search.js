/**
 * @fileoverview Semantic Search Over Reflections for REPLOID
 * Provides semantic similarity search over reflection history using TF-IDF embeddings.
 * Enables finding relevant past experiences by meaning, not just keywords.
 *
 * @blueprint 0x000037 - Defines semantic reflection search.
 * @module ReflectionSearch
 * @version 1.0.0
 * @category intelligence
 */

const ReflectionSearch = {
  metadata: {
    id: 'ReflectionSearch',
    version: '1.0.0',
    dependencies: ['ReflectionStore', 'Utils', 'EventBus'],
    async: true,
    type: 'intelligence'
  },

  factory: (deps) => {
    const { ReflectionStore, Utils, EventBus } = deps;
    const { logger } = Utils;

    // TF-IDF index cache
    let tfidfIndex = null;
    let indexedReflections = [];
    let lastIndexUpdate = 0;
    const INDEX_TTL = 300000; // 5 minutes

    // Widget tracking
    let _searchCount = 0;
    let _lastSearchTime = null;
    let _indexRebuildCount = 0;
    let _recentSearches = [];

    /**
     * Initialize semantic search system
     */
    const init = async () => {
      logger.info('[ReflectionSearch] Initializing semantic search');

      // Build initial index
      await rebuildIndex();

      // Listen for new reflections to update index
      EventBus.on('reflection:created', async () => {
        logger.debug('[ReflectionSearch] New reflection detected, invalidating index');
        tfidfIndex = null;
      });

      return true;
    };

    /**
     * Tokenize text into words
     * @param {string} text - Text to tokenize
     * @returns {Array<string>} Array of lowercase tokens
     */
    const tokenize = (text) => {
      return text
        .toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2); // Filter out short words
    };

    /**
     * Calculate term frequency for a document
     * @param {Array<string>} tokens - Document tokens
     * @returns {Map<string, number>} Term frequency map
     */
    const calculateTF = (tokens) => {
      const tf = new Map();
      const totalTerms = tokens.length;

      for (const token of tokens) {
        tf.set(token, (tf.get(token) || 0) + 1);
      }

      // Normalize by document length
      for (const [term, count] of tf.entries()) {
        tf.set(term, count / totalTerms);
      }

      return tf;
    };

    /**
     * Calculate inverse document frequency for corpus
     * @param {Array<Array<string>>} documents - Array of tokenized documents
     * @returns {Map<string, number>} IDF map
     */
    const calculateIDF = (documents) => {
      const idf = new Map();
      const totalDocs = documents.length;

      // Count documents containing each term
      for (const doc of documents) {
        const uniqueTerms = new Set(doc);
        for (const term of uniqueTerms) {
          idf.set(term, (idf.get(term) || 0) + 1);
        }
      }

      // Calculate IDF: log(total docs / docs containing term)
      for (const [term, docCount] of idf.entries()) {
        idf.set(term, Math.log(totalDocs / docCount));
      }

      return idf;
    };

    /**
     * Calculate TF-IDF vector for a document
     * @param {Map<string, number>} tf - Term frequency map
     * @param {Map<string, number>} idf - Inverse document frequency map
     * @returns {Map<string, number>} TF-IDF vector
     */
    const calculateTFIDF = (tf, idf) => {
      const tfidf = new Map();

      for (const [term, tfValue] of tf.entries()) {
        const idfValue = idf.get(term) || 0;
        tfidf.set(term, tfValue * idfValue);
      }

      return tfidf;
    };

    /**
     * Calculate cosine similarity between two vectors
     * @param {Map<string, number>} vec1 - First vector
     * @param {Map<string, number>} vec2 - Second vector
     * @returns {number} Similarity score (0-1)
     */
    const cosineSimilarity = (vec1, vec2) => {
      // Calculate dot product
      let dotProduct = 0;
      for (const [term, value1] of vec1.entries()) {
        const value2 = vec2.get(term) || 0;
        dotProduct += value1 * value2;
      }

      // Calculate magnitudes
      let mag1 = 0;
      for (const value of vec1.values()) {
        mag1 += value * value;
      }
      mag1 = Math.sqrt(mag1);

      let mag2 = 0;
      for (const value of vec2.values()) {
        mag2 += value * value;
      }
      mag2 = Math.sqrt(mag2);

      // Avoid division by zero
      if (mag1 === 0 || mag2 === 0) return 0;

      return dotProduct / (mag1 * mag2);
    };

    /**
     * Rebuild TF-IDF index from all reflections
     */
    const rebuildIndex = async () => {
      const startTime = Date.now();
      logger.info('[ReflectionSearch] Building TF-IDF index...');

      // Fetch all reflections
      const reflections = await ReflectionStore.getReflections({ limit: 1000 });
      indexedReflections = reflections;

      if (reflections.length === 0) {
        tfidfIndex = { idf: new Map(), vectors: [] };
        lastIndexUpdate = Date.now();
        logger.info('[ReflectionSearch] Index built (empty)');
        return;
      }

      // Tokenize all documents
      const documents = reflections.map(r => {
        const text = [
          r.description || '',
          r.context?.goal || '',
          ...(r.tags || [])
        ].join(' ');
        return tokenize(text);
      });

      // Calculate IDF for corpus
      const idf = calculateIDF(documents);

      // Calculate TF-IDF vectors for each document
      const vectors = documents.map(doc => {
        const tf = calculateTF(doc);
        return calculateTFIDF(tf, idf);
      });

      tfidfIndex = { idf, vectors };
      lastIndexUpdate = Date.now();
      _indexRebuildCount++;

      const duration = Date.now() - startTime;
      logger.info(`[ReflectionSearch] Index built: ${reflections.length} reflections in ${duration}ms`);
    };

    /**
     * Ensure index is fresh
     */
    const ensureIndexFresh = async () => {
      const now = Date.now();
      if (!tfidfIndex || (now - lastIndexUpdate) > INDEX_TTL) {
        await rebuildIndex();
      }
    };

    /**
     * Search reflections by semantic similarity
     * @param {string} query - Search query
     * @param {Object} options - Search options
     * @param {number} options.limit - Maximum results (default: 10)
     * @param {number} options.threshold - Minimum similarity (default: 0.1)
     * @param {string} options.outcome - Filter by outcome (successful/failed/inconclusive)
     * @returns {Promise<Array>} Ranked search results
     */
    const search = async (query, options = {}) => {
      await ensureIndexFresh();

      const limit = options.limit || 10;
      const threshold = options.threshold || 0.1;

      // Tokenize query
      const queryTokens = tokenize(query);
      const queryTF = calculateTF(queryTokens);
      const queryVector = calculateTFIDF(queryTF, tfidfIndex.idf);

      // Calculate similarity with each reflection
      const results = [];

      for (let i = 0; i < indexedReflections.length; i++) {
        const reflection = indexedReflections[i];

        // Apply outcome filter if specified
        if (options.outcome && reflection.outcome !== options.outcome) {
          continue;
        }

        const docVector = tfidfIndex.vectors[i];
        const similarity = cosineSimilarity(queryVector, docVector);

        if (similarity >= threshold) {
          results.push({
            reflection,
            similarity,
            score: similarity
          });
        }
      }

      // Sort by similarity descending
      results.sort((a, b) => b.similarity - a.similarity);

      // Track search
      _searchCount++;
      _lastSearchTime = Date.now();
      _recentSearches.push({
        query: query.substring(0, 50),
        results: results.length,
        timestamp: Date.now()
      });
      // Keep only last 10 searches
      if (_recentSearches.length > 10) {
        _recentSearches.shift();
      }

      // Apply limit
      return results.slice(0, limit);
    };

    /**
     * Find similar reflections to a given reflection
     * @param {string} reflectionId - ID of reflection to compare
     * @param {number} limit - Maximum results (default: 5)
     * @returns {Promise<Array>} Similar reflections
     */
    const findSimilar = async (reflectionId, limit = 5) => {
      await ensureIndexFresh();

      // Find the target reflection's index
      const targetIndex = indexedReflections.findIndex(r => r.id === reflectionId);
      if (targetIndex === -1) {
        logger.warn(`[ReflectionSearch] Reflection ${reflectionId} not found in index`);
        return [];
      }

      const targetVector = tfidfIndex.vectors[targetIndex];
      const results = [];

      // Calculate similarity with all other reflections
      for (let i = 0; i < indexedReflections.length; i++) {
        if (i === targetIndex) continue; // Skip self

        const reflection = indexedReflections[i];
        const docVector = tfidfIndex.vectors[i];
        const similarity = cosineSimilarity(targetVector, docVector);

        results.push({
          reflection,
          similarity,
          score: similarity
        });
      }

      // Sort and limit
      results.sort((a, b) => b.similarity - a.similarity);
      return results.slice(0, limit);
    };

    /**
     * Get relevant reflections for current context
     * @param {Object} context - Current context
     * @param {string} context.goal - Current goal
     * @param {string} context.error - Current error message
     * @param {Array<string>} context.tags - Context tags
     * @param {number} limit - Maximum results (default: 5)
     * @returns {Promise<Array>} Relevant reflections
     */
    const getRelevantForContext = async (context, limit = 5) => {
      // Build query from context
      const queryParts = [
        context.goal || '',
        context.error || '',
        ...(context.tags || [])
      ];

      const query = queryParts.filter(p => p).join(' ');

      if (!query) {
        logger.warn('[ReflectionSearch] Empty context provided');
        return [];
      }

      return await search(query, { limit, threshold: 0.05 });
    };

    /**
     * Get index statistics
     * @returns {Object} Index statistics
     */
    const getIndexStats = () => {
      if (!tfidfIndex) {
        return {
          indexed: 0,
          vocabularySize: 0,
          lastUpdate: null,
          age: null
        };
      }

      return {
        indexed: indexedReflections.length,
        vocabularySize: tfidfIndex.idf.size,
        lastUpdate: lastIndexUpdate,
        age: Date.now() - lastIndexUpdate
      };
    };

    /**
     * Clear index and force rebuild
     */
    const clearIndex = () => {
      tfidfIndex = null;
      indexedReflections = [];
      lastIndexUpdate = 0;
      logger.info('[ReflectionSearch] Index cleared');
    };

    // Web Component Widget
    const widget = (() => {
      class ReflectionSearchWidget extends HTMLElement {
        constructor() {
          super();
          this.attachShadow({ mode: 'open' });
        }

        connectedCallback() {
          this.render();
          this._interval = setInterval(() => this.render(), 5000);
        }

        disconnectedCallback() {
          if (this._interval) clearInterval(this._interval);
        }

        set moduleApi(api) {
          this._api = api;
          this.render();
        }

        getStatus() {
          const stats = getIndexStats();
          const indexAge = stats.age ? Math.floor(stats.age / 1000) : 0;
          const isStale = indexAge > (INDEX_TTL / 1000);

          return {
            state: !tfidfIndex ? 'warning' : (isStale ? 'idle' : (_searchCount > 0 ? 'active' : 'idle')),
            primaryMetric: `${stats.indexed} reflections`,
            secondaryMetric: `${_searchCount} searches`,
            lastActivity: _lastSearchTime,
            message: !tfidfIndex ? 'No index' : (isStale ? 'Index stale' : 'Ready')
          };
        }

        render() {
          const stats = getIndexStats();
          const indexAge = stats.age ? Math.floor(stats.age / 1000) : 0;
          const indexAgeMin = Math.floor(indexAge / 60);
          const isStale = indexAge > (INDEX_TTL / 1000);

          const formatTime = (timestamp) => {
            if (!timestamp) return 'Never';
            const diff = Date.now() - timestamp;
            if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
            if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
            return `${Math.floor(diff/3600000)}h ago`;
          };

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                background: rgba(255,255,255,0.05);
                border-radius: 8px;
                padding: 16px;
              }
              h3 {
                margin: 0 0 16px 0;
                font-size: 1.4em;
                color: #fff;
              }
              h4 {
                margin: 16px 0 8px 0;
                font-size: 1.1em;
                color: #aaa;
              }
              .controls {
                display: flex;
                gap: 8px;
                margin-bottom: 16px;
              }
              button {
                padding: 6px 12px;
                background: rgba(100,150,255,0.2);
                border: 1px solid rgba(100,150,255,0.4);
                border-radius: 4px;
                color: #fff;
                cursor: pointer;
                font-size: 0.9em;
              }
              button:hover {
                background: rgba(100,150,255,0.3);
              }
              .stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 8px;
                margin-top: 12px;
              }
              .stat-card {
                padding: 12px;
                background: rgba(100,150,255,0.1);
                border-radius: 4px;
              }
              .stat-card.stale {
                background: rgba(255,150,0,0.1);
              }
              .stat-label {
                font-size: 0.85em;
                color: #888;
              }
              .stat-value {
                font-size: 1.3em;
                font-weight: bold;
              }
              .stat-value.warning {
                color: #f90;
              }
              .index-stats {
                margin-top: 8px;
                padding: 12px;
                background: rgba(255,255,255,0.05);
                border-radius: 4px;
              }
              .stats-row {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
                font-size: 0.9em;
              }
              .stats-row > div {
                display: flex;
                justify-content: space-between;
              }
              .stats-label {
                color: #888;
              }
              .status-fresh {
                color: #0c0;
              }
              .status-stale {
                color: #f90;
              }
              .recent-searches {
                max-height: 120px;
                overflow-y: auto;
                margin-top: 8px;
              }
              .search-item {
                padding: 6px 8px;
                background: rgba(255,255,255,0.05);
                border-radius: 3px;
                margin-bottom: 4px;
                font-size: 0.85em;
              }
              .search-header {
                display: flex;
                justify-content: space-between;
              }
              .search-query {
                font-style: italic;
                color: #aaa;
              }
              .search-results {
                color: #888;
              }
              .search-time {
                color: #666;
                font-size: 0.85em;
                margin-top: 2px;
              }
              .info-box {
                margin-top: 16px;
                padding: 12px;
                background: rgba(100,150,255,0.1);
                border-left: 3px solid #6496ff;
                border-radius: 4px;
              }
              .info-text {
                margin-top: 6px;
                color: #aaa;
                font-size: 0.9em;
              }
            </style>

            <div class="widget-panel">
              <h3>⌕ Reflection Search</h3>

              <div class="controls">
                <button class="rebuild-index">↻ Rebuild Index</button>
                <button class="clear-index">⛶ Clear Index</button>
              </div>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Indexed</div>
                  <div class="stat-value">${stats.indexed}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Vocabulary</div>
                  <div class="stat-value">${stats.vocabularySize}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Searches</div>
                  <div class="stat-value">${_searchCount}</div>
                </div>
                <div class="stat-card ${isStale ? 'stale' : ''}">
                  <div class="stat-label">Index Age</div>
                  <div class="stat-value ${isStale ? 'warning' : ''}">${indexAgeMin}m</div>
                </div>
              </div>

              <h4>☱ Index Statistics</h4>
              <div class="index-stats">
                <div class="stats-row">
                  <div>
                    <span class="stats-label">Last update:</span>
                    <span>${stats.lastUpdate ? formatTime(stats.lastUpdate) : 'Never'}</span>
                  </div>
                  <div>
                    <span class="stats-label">Rebuilds:</span>
                    <span>${_indexRebuildCount}</span>
                  </div>
                  <div>
                    <span class="stats-label">TTL:</span>
                    <span>${INDEX_TTL / 60000}min</span>
                  </div>
                  <div>
                    <span class="stats-label">Status:</span>
                    <span class="${isStale ? 'status-stale' : 'status-fresh'}">${isStale ? 'Stale' : 'Fresh'}</span>
                  </div>
                </div>
              </div>

              ${_recentSearches.length > 0 ? `
                <h4>⌕ Recent Searches</h4>
                <div class="recent-searches">
                  ${_recentSearches.slice().reverse().map(search => `
                    <div class="search-item">
                      <div class="search-header">
                        <span class="search-query">"${search.query}${search.query.length >= 50 ? '...' : ''}"</span>
                        <span class="search-results">${search.results} results</span>
                      </div>
                      <div class="search-time">${formatTime(search.timestamp)}</div>
                    </div>
                  `).join('')}
                </div>
              ` : ''}

              <div class="info-box">
                <strong>ℹ️ Semantic Search</strong>
                <div class="info-text">
                  TF-IDF based semantic similarity search over reflection history.<br>
                  Last search: ${formatTime(_lastSearchTime)}
                </div>
              </div>
            </div>
          `;

          // Attach event listeners
          this.shadowRoot.querySelector('.rebuild-index')?.addEventListener('click', async () => {
            await rebuildIndex();
            logger.info('[ReflectionSearch] Widget: Index rebuilt');
            this.render();
          });

          this.shadowRoot.querySelector('.clear-index')?.addEventListener('click', () => {
            clearIndex();
            logger.info('[ReflectionSearch] Widget: Index cleared');
            this.render();
          });
        }
      }

      if (!customElements.get('reflection-search-widget')) {
        customElements.define('reflection-search-widget', ReflectionSearchWidget);
      }

      return {
        element: 'reflection-search-widget',
        displayName: 'Reflection Search',
        icon: '⌕',
        category: 'intelligence',
        updateInterval: 5000
      };
    })();

    return {
      init,
      api: {
        search,
        findSimilar,
        getRelevantForContext,
        rebuildIndex,
        clearIndex,
        getIndexStats
      },
      widget
    };
  }
};

// Export
export default ReflectionSearch;
