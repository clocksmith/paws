/**
 * @fileoverview Reflection Analyzer for REPLOID
 * Analyzes patterns in reflections to enable learning from past experiences.
 * Provides clustering, failure pattern detection, and success strategy identification.
 *
 * @module ReflectionAnalyzer
 * @version 1.0.0
 * @category intelligence
 */

const ReflectionAnalyzer = {
  metadata: {
    id: 'ReflectionAnalyzer',
    version: '1.0.0',
    dependencies: ['ReflectionStore', 'Utils'],
    async: true,
    type: 'intelligence'
  },

  factory: (deps) => {
    const { ReflectionStore, Utils } = deps;
    const { logger } = Utils;

    /**
     * Extract keywords from text
     */
    const getKeywords = (text) => {
      if (!text) return [];
      return text.toLowerCase()
        .split(/\W+/)
        .filter(w => w.length > 3)
        .slice(0, 10);
    };

    /**
     * Calculate Jaccard similarity between two keyword sets
     */
    const jaccardSimilarity = (keywordsA, keywordsB) => {
      const setA = new Set(keywordsA);
      const setB = new Set(keywordsB);
      const intersection = new Set([...setA].filter(x => setB.has(x)));
      const union = new Set([...setA, ...setB]);
      return union.size > 0 ? intersection.size / union.size : 0;
    };

    /**
     * Find common tags across a set of reflections
     */
    const findCommonTags = (reflections) => {
      const tagCounts = {};
      reflections.forEach(r => {
        (r.tags || []).forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return Object.entries(tagCounts)
        .filter(([tag, count]) => count >= reflections.length * 0.5)
        .map(([tag]) => tag);
    };

    /**
     * Cluster reflections by similarity
     * Uses Jaccard similarity on description keywords
     */
    const clusterReflections = async (minClusterSize = 3) => {
      logger.info('[ReflectionAnalyzer] Clustering reflections');

      const allReflections = await ReflectionStore.getReflections({ limit: 100 });
      if (allReflections.length < minClusterSize) {
        return [];
      }

      const clusters = [];
      const used = new Set();

      for (let i = 0; i < allReflections.length; i++) {
        if (used.has(i)) continue;

        const cluster = [allReflections[i]];
        const keywordsI = getKeywords(allReflections[i].description);

        for (let j = i + 1; j < allReflections.length; j++) {
          if (used.has(j)) continue;

          const keywordsJ = getKeywords(allReflections[j].description);
          const similarity = jaccardSimilarity(keywordsI, keywordsJ);

          if (similarity > 0.3) {
            cluster.push(allReflections[j]);
            used.add(j);
          }
        }

        if (cluster.length >= minClusterSize) {
          const successCount = cluster.filter(r => r.outcome === 'successful').length;
          clusters.push({
            size: cluster.length,
            reflections: cluster,
            commonTags: findCommonTags(cluster),
            successRate: (successCount / cluster.length * 100).toFixed(1),
            keywords: keywordsI.slice(0, 5)
          });
        }

        used.add(i);
      }

      clusters.sort((a, b) => b.size - a.size);
      logger.info(`[ReflectionAnalyzer] Found ${clusters.length} clusters`);
      return clusters;
    };

    /**
     * Extract failure indicators from reflection description
     */
    const extractFailureIndicators = (description) => {
      const indicators = [];
      const text = description.toLowerCase();

      // Common failure patterns
      const patterns = {
        'syntax-error': /syntax error|unexpected token|parse error/,
        'type-error': /type error|cannot read property|undefined is not/,
        'reference-error': /reference error|is not defined/,
        'timeout': /timeout|timed out|exceeded/,
        'network-error': /network error|fetch failed|connection/,
        'permission-denied': /permission denied|access denied|unauthorized/,
        'file-not-found': /file not found|enoent|no such file/,
        'memory-error': /out of memory|memory limit|allocation failed/,
        'validation-error': /validation failed|invalid input|bad request/
      };

      for (const [indicator, pattern] of Object.entries(patterns)) {
        if (pattern.test(text)) {
          indicators.push(indicator);
        }
      }

      return indicators;
    };

    /**
     * Generate recommendations for a failure indicator
     */
    const generateRecommendations = (indicator) => {
      const recommendations = {
        'syntax-error': [
          'Use a linter or syntax checker before applying changes',
          'Validate code structure with AST parsing',
          'Test code in isolation before integration'
        ],
        'type-error': [
          'Add null/undefined checks before property access',
          'Use optional chaining (?.) for safe property access',
          'Validate input types at function boundaries'
        ],
        'reference-error': [
          'Check variable declarations and scope',
          'Verify imports and module dependencies',
          'Use "use strict" to catch undeclared variables'
        ],
        'timeout': [
          'Add timeout configuration with reasonable limits',
          'Implement retry logic with exponential backoff',
          'Optimize slow operations or add caching'
        ],
        'network-error': [
          'Implement retry logic for transient failures',
          'Add fallback mechanisms for network requests',
          'Check connectivity before making requests'
        ],
        'permission-denied': [
          'Verify required permissions are granted',
          'Request permissions before attempting operations',
          'Provide fallback for denied permissions'
        ],
        'file-not-found': [
          'Check file paths are correct and absolute',
          'Verify files exist before attempting to read',
          'Handle missing files gracefully with defaults'
        ],
        'memory-error': [
          'Process large datasets in chunks',
          'Implement pagination for large collections',
          'Clear caches and release unused resources'
        ],
        'validation-error': [
          'Add input validation with clear error messages',
          'Use JSON schema or type checking for validation',
          'Provide examples of valid input formats'
        ]
      };

      return recommendations[indicator] || ['Review the error details and try a different approach'];
    };

    /**
     * Detect recurring failure patterns
     */
    const detectFailurePatterns = async () => {
      logger.info('[ReflectionAnalyzer] Detecting failure patterns');

      const failed = await ReflectionStore.getReflections({
        outcome: 'failed',
        limit: 100
      });

      const patterns = {};

      for (const reflection of failed) {
        const indicators = extractFailureIndicators(reflection.description);

        for (const indicator of indicators) {
          if (!patterns[indicator]) {
            patterns[indicator] = {
              count: 0,
              examples: [],
              recommendations: generateRecommendations(indicator)
            };
          }
          patterns[indicator].count++;
          if (patterns[indicator].examples.length < 3) {
            patterns[indicator].examples.push({
              sessionId: reflection.sessionId,
              description: reflection.description.slice(0, 100),
              timestamp: reflection.timestamp
            });
          }
        }
      }

      // Sort by frequency
      const sortedPatterns = Object.entries(patterns)
        .map(([indicator, data]) => ({ indicator, ...data }))
        .sort((a, b) => b.count - a.count);

      logger.info(`[ReflectionAnalyzer] Found ${sortedPatterns.length} failure patterns`);
      return sortedPatterns;
    };

    /**
     * Get top success strategies from reflections
     */
    const getTopSuccessStrategies = async (limit = 5) => {
      logger.info('[ReflectionAnalyzer] Analyzing success strategies');

      const successful = await ReflectionStore.getReflections({
        outcome: 'successful',
        limit: 100
      });

      if (successful.length === 0) {
        return [];
      }

      // Extract strategy-related tags
      const strategies = {};
      for (const reflection of successful) {
        const tags = reflection.tags || [];
        const strategyTags = tags.filter(t =>
          t.includes('strategy_') ||
          t.includes('approach_') ||
          t.includes('method_')
        );

        for (const strategy of strategyTags) {
          strategies[strategy] = (strategies[strategy] || 0) + 1;
        }

        // Also extract from description
        const keywords = getKeywords(reflection.description);
        const strategyKeywords = keywords.filter(k =>
          k.includes('atomic') ||
          k.includes('incremental') ||
          k.includes('test') ||
          k.includes('validate') ||
          k.includes('checkpoint')
        );

        for (const keyword of strategyKeywords) {
          const strategyName = `strategy_${keyword}`;
          strategies[strategyName] = (strategies[strategyName] || 0) + 1;
        }
      }

      const topStrategies = Object.entries(strategies)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([strategy, count]) => ({
          strategy: strategy.replace(/^strategy_/, '').replace(/_/g, ' '),
          successCount: count,
          percentage: (count / successful.length * 100).toFixed(1)
        }));

      logger.info(`[ReflectionAnalyzer] Found ${topStrategies.length} success strategies`);
      return topStrategies;
    };

    /**
     * Recommend solution based on similar past reflections
     */
    const recommendSolution = async (currentProblem) => {
      logger.info('[ReflectionAnalyzer] Finding solution recommendations');

      const keywords = getKeywords(currentProblem);
      if (keywords.length === 0) {
        return {
          found: false,
          message: 'Could not extract keywords from problem description'
        };
      }

      // Get all reflections and find similar ones
      const allReflections = await ReflectionStore.getReflections({ limit: 100 });
      const similar = [];

      for (const reflection of allReflections) {
        const reflectionKeywords = getKeywords(reflection.description);
        const similarity = jaccardSimilarity(keywords, reflectionKeywords);

        if (similarity > 0.2) {
          similar.push({ ...reflection, similarity });
        }
      }

      // Sort by similarity
      similar.sort((a, b) => b.similarity - a.similarity);

      // Filter for successful cases
      const successful = similar.filter(r => r.outcome === 'successful');

      if (successful.length === 0) {
        return {
          found: false,
          message: 'No similar successful cases found',
          similarFailures: similar.filter(r => r.outcome === 'failed').length
        };
      }

      // Extract recommendations
      const recommendations = {};
      for (const reflection of successful) {
        const recs = reflection.recommendations || [];
        for (const rec of recs) {
          recommendations[rec] = (recommendations[rec] || 0) + 1;
        }
      }

      const topRecommendations = Object.entries(recommendations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([rec, count]) => ({
          recommendation: rec,
          frequency: count,
          confidence: (count / successful.length * 100).toFixed(0) + '%'
        }));

      return {
        found: true,
        topRecommendations,
        similarCases: successful.length,
        averageSimilarity: (successful.reduce((sum, r) => sum + r.similarity, 0) / successful.length).toFixed(2)
      };
    };

    /**
     * Get learning insights - comprehensive analysis
     */
    const getLearningInsights = async () => {
      logger.info('[ReflectionAnalyzer] Generating learning insights');

      const [clusters, failurePatterns, successStrategies] = await Promise.all([
        clusterReflections(3),
        detectFailurePatterns(),
        getTopSuccessStrategies(5)
      ]);

      const allReflections = await ReflectionStore.getReflections({ limit: 1000 });
      const successfulCount = allReflections.filter(r => r.outcome === 'successful').length;
      const failedCount = allReflections.filter(r => r.outcome === 'failed').length;

      return {
        summary: {
          totalReflections: allReflections.length,
          successfulCount,
          failedCount,
          overallSuccessRate: allReflections.length > 0
            ? (successfulCount / allReflections.length * 100).toFixed(1)
            : 0
        },
        clusters: clusters.slice(0, 5),
        failurePatterns: failurePatterns.slice(0, 5),
        successStrategies,
        recommendations: generateGeneralRecommendations(failurePatterns, successStrategies)
      };
    };

    /**
     * Generate general recommendations based on patterns
     */
    const generateGeneralRecommendations = (failurePatterns, successStrategies) => {
      const recommendations = [];

      // Based on failure patterns
      if (failurePatterns.length > 0) {
        const topFailure = failurePatterns[0];
        recommendations.push({
          type: 'reduce-failures',
          priority: 'high',
          message: `Address recurring ${topFailure.indicator} (${topFailure.count} occurrences)`,
          actions: topFailure.recommendations.slice(0, 2)
        });
      }

      // Based on success strategies
      if (successStrategies.length > 0) {
        const topStrategy = successStrategies[0];
        recommendations.push({
          type: 'amplify-success',
          priority: 'medium',
          message: `Continue using '${topStrategy.strategy}' strategy (${topStrategy.percentage}% success rate)`,
          actions: [`Apply this strategy to similar tasks`]
        });
      }

      // General best practices
      recommendations.push({
        type: 'best-practice',
        priority: 'low',
        message: 'Maintain consistent reflection documentation',
        actions: [
          'Tag reflections with relevant categories',
          'Include specific error messages in descriptions',
          'Document what worked and what didn\'t'
        ]
      });

      return recommendations;
    };

    return {
      init: async () => {
        logger.info('[ReflectionAnalyzer] Initialized');
        return true;
      },
      api: {
        clusterReflections,
        detectFailurePatterns,
        getTopSuccessStrategies,
        recommendSolution,
        getLearningInsights
      }
    };
  }
};

// Export
ReflectionAnalyzer;
