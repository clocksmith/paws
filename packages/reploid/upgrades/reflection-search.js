/**
 * @fileoverview Semantic Search Over Reflections for REPLOID
 * Provides semantic similarity search over reflection history using TF-IDF embeddings.
 * Enables finding relevant past experiences by meaning, not just keywords.
 *
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

    return {
      init,
      api: {
        search,
        findSimilar,
        getRelevantForContext,
        rebuildIndex,
        clearIndex,
        getIndexStats
      }
    };
  }
};

// Export
ReflectionSearch;
