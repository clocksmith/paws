import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('ReflectionAnalyzer Module', () => {
  let ReflectionAnalyzer;
  let mockDeps;
  let analyzerInstance;
  let mockReflectionStore;

  beforeEach(async () => {
    // Mock reflection data
    const mockReflections = [
      {
        id: 1,
        description: 'Failed to parse JSON due to syntax error in configuration file',
        outcome: 'failed',
        tags: ['parsing', 'json', 'error'],
        sessionId: 'session1',
        timestamp: Date.now() - 10000,
        recommendations: ['Use JSON validator', 'Check quotes']
      },
      {
        id: 2,
        description: 'Successfully implemented atomic file write operation with validation',
        outcome: 'successful',
        tags: ['strategy_atomic', 'file-io', 'validation'],
        sessionId: 'session2',
        timestamp: Date.now() - 9000,
        recommendations: ['Always validate inputs', 'Use atomic operations']
      },
      {
        id: 3,
        description: 'Syntax error when parsing user input with unexpected token',
        outcome: 'failed',
        tags: ['parsing', 'syntax', 'error'],
        sessionId: 'session3',
        timestamp: Date.now() - 8000
      },
      {
        id: 4,
        description: 'Implemented incremental testing approach for complex feature',
        outcome: 'successful',
        tags: ['strategy_incremental', 'testing', 'approach_test-driven'],
        sessionId: 'session4',
        timestamp: Date.now() - 7000,
        recommendations: ['Test incrementally', 'Write tests first']
      },
      {
        id: 5,
        description: 'Type error occurred: cannot read property of undefined object',
        outcome: 'failed',
        tags: ['error', 'type'],
        sessionId: 'session5',
        timestamp: Date.now() - 6000
      },
      {
        id: 6,
        description: 'Successfully applied atomic changes with checkpoint validation',
        outcome: 'successful',
        tags: ['strategy_atomic', 'strategy_checkpoint', 'validation'],
        sessionId: 'session6',
        timestamp: Date.now() - 5000,
        recommendations: ['Use checkpoints', 'Validate at each step']
      }
    ];

    // Mock ReflectionStore
    mockReflectionStore = {
      getReflections: vi.fn((filters = {}) => {
        let results = [...mockReflections];

        if (filters.outcome) {
          results = results.filter(r => r.outcome === filters.outcome);
        }

        if (filters.limit) {
          results = results.slice(0, filters.limit);
        }

        return Promise.resolve(results);
      })
    };

    // Mock Utils
    const mockUtils = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      }
    };

    mockDeps = {
      ReflectionStore: mockReflectionStore,
      Utils: mockUtils
    };

    // Define ReflectionAnalyzer module
    ReflectionAnalyzer = {
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

        const getKeywords = (text) => {
          if (!text) return [];
          return text.toLowerCase()
            .split(/\W+/)
            .filter(w => w.length > 3)
            .slice(0, 10);
        };

        const jaccardSimilarity = (keywordsA, keywordsB) => {
          const setA = new Set(keywordsA);
          const setB = new Set(keywordsB);
          const intersection = new Set([...setA].filter(x => setB.has(x)));
          const union = new Set([...setA, ...setB]);
          return union.size > 0 ? intersection.size / union.size : 0;
        };

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

        const extractFailureIndicators = (description) => {
          const indicators = [];
          const text = description.toLowerCase();

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
            ]
          };

          return recommendations[indicator] || ['Review the error details and try a different approach'];
        };

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

          const sortedPatterns = Object.entries(patterns)
            .map(([indicator, data]) => ({ indicator, ...data }))
            .sort((a, b) => b.count - a.count);

          logger.info(`[ReflectionAnalyzer] Found ${sortedPatterns.length} failure patterns`);
          return sortedPatterns;
        };

        const getTopSuccessStrategies = async (limit = 5) => {
          logger.info('[ReflectionAnalyzer] Analyzing success strategies');

          const successful = await ReflectionStore.getReflections({
            outcome: 'successful',
            limit: 100
          });

          if (successful.length === 0) {
            return [];
          }

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

        const recommendSolution = async (currentProblem) => {
          logger.info('[ReflectionAnalyzer] Finding solution recommendations');

          const keywords = getKeywords(currentProblem);
          if (keywords.length === 0) {
            return {
              found: false,
              message: 'Could not extract keywords from problem description'
            };
          }

          const allReflections = await ReflectionStore.getReflections({ limit: 100 });
          const similar = [];

          for (const reflection of allReflections) {
            const reflectionKeywords = getKeywords(reflection.description);
            const similarity = jaccardSimilarity(keywords, reflectionKeywords);

            if (similarity > 0.2) {
              similar.push({ ...reflection, similarity });
            }
          }

          similar.sort((a, b) => b.similarity - a.similarity);

          const successful = similar.filter(r => r.outcome === 'successful');

          if (successful.length === 0) {
            return {
              found: false,
              message: 'No similar successful cases found',
              similarFailures: similar.filter(r => r.outcome === 'failed').length
            };
          }

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
            recommendations: []
          };
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

    const instance = ReflectionAnalyzer.factory(mockDeps);
    await instance.init();
    analyzerInstance = instance.api;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ReflectionAnalyzer.metadata.id).toBe('ReflectionAnalyzer');
      expect(ReflectionAnalyzer.metadata.version).toBe('1.0.0');
      expect(ReflectionAnalyzer.metadata.type).toBe('intelligence');
    });

    it('should declare required dependencies', () => {
      expect(ReflectionAnalyzer.metadata.dependencies).toContain('ReflectionStore');
      expect(ReflectionAnalyzer.metadata.dependencies).toContain('Utils');
    });

    it('should be async', () => {
      expect(ReflectionAnalyzer.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(analyzerInstance).toBeDefined();
      expect(analyzerInstance.clusterReflections).toBeDefined();
      expect(analyzerInstance.detectFailurePatterns).toBeDefined();
      expect(analyzerInstance.getTopSuccessStrategies).toBeDefined();
    });

    it('should log initialization message', () => {
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        '[ReflectionAnalyzer] Initialized'
      );
    });
  });

  describe('Clustering Reflections', () => {
    it('should cluster similar reflections', async () => {
      const clusters = await analyzerInstance.clusterReflections(2);

      expect(clusters).toBeDefined();
      expect(Array.isArray(clusters)).toBe(true);
      expect(clusters.length).toBeGreaterThan(0);
    });

    it('should calculate success rate for clusters', async () => {
      const clusters = await analyzerInstance.clusterReflections(2);

      if (clusters.length > 0) {
        expect(clusters[0]).toHaveProperty('successRate');
        expect(clusters[0]).toHaveProperty('size');
      }
    });

    it('should identify common tags in clusters', async () => {
      const clusters = await analyzerInstance.clusterReflections(2);

      if (clusters.length > 0) {
        expect(clusters[0]).toHaveProperty('commonTags');
        expect(Array.isArray(clusters[0].commonTags)).toBe(true);
      }
    });

    it('should return empty array when not enough reflections', async () => {
      mockReflectionStore.getReflections.mockResolvedValue([]);

      const clusters = await analyzerInstance.clusterReflections(3);

      expect(clusters).toEqual([]);
    });

    it('should sort clusters by size descending', async () => {
      const clusters = await analyzerInstance.clusterReflections(2);

      if (clusters.length > 1) {
        for (let i = 0; i < clusters.length - 1; i++) {
          expect(clusters[i].size).toBeGreaterThanOrEqual(clusters[i + 1].size);
        }
      }
    });
  });

  describe('Failure Pattern Detection', () => {
    it('should detect failure patterns', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      expect(patterns).toBeDefined();
      expect(Array.isArray(patterns)).toBe(true);
    });

    it('should identify syntax errors', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      const syntaxPattern = patterns.find(p => p.indicator === 'syntax-error');
      expect(syntaxPattern).toBeDefined();
      expect(syntaxPattern.count).toBeGreaterThan(0);
    });

    it('should identify type errors', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      const typePattern = patterns.find(p => p.indicator === 'type-error');
      expect(typePattern).toBeDefined();
      expect(typePattern.count).toBe(1);
    });

    it('should provide recommendations for each pattern', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      patterns.forEach(pattern => {
        expect(pattern.recommendations).toBeDefined();
        expect(Array.isArray(pattern.recommendations)).toBe(true);
        expect(pattern.recommendations.length).toBeGreaterThan(0);
      });
    });

    it('should include examples for each pattern', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      patterns.forEach(pattern => {
        expect(pattern.examples).toBeDefined();
        expect(Array.isArray(pattern.examples)).toBe(true);
      });
    });

    it('should sort patterns by frequency', async () => {
      const patterns = await analyzerInstance.detectFailurePatterns();

      if (patterns.length > 1) {
        for (let i = 0; i < patterns.length - 1; i++) {
          expect(patterns[i].count).toBeGreaterThanOrEqual(patterns[i + 1].count);
        }
      }
    });
  });

  describe('Success Strategy Analysis', () => {
    it('should identify top success strategies', async () => {
      const strategies = await analyzerInstance.getTopSuccessStrategies(5);

      expect(strategies).toBeDefined();
      expect(Array.isArray(strategies)).toBe(true);
      expect(strategies.length).toBeGreaterThan(0);
    });

    it('should find atomic strategy', async () => {
      const strategies = await analyzerInstance.getTopSuccessStrategies(5);

      const atomicStrategy = strategies.find(s => s.strategy.includes('atomic'));
      expect(atomicStrategy).toBeDefined();
      expect(atomicStrategy.successCount).toBeGreaterThan(0);
    });

    it('should calculate percentage for each strategy', async () => {
      const strategies = await analyzerInstance.getTopSuccessStrategies(5);

      strategies.forEach(strategy => {
        expect(strategy.percentage).toBeDefined();
        expect(parseFloat(strategy.percentage)).toBeGreaterThan(0);
      });
    });

    it('should return empty array when no successful reflections', async () => {
      mockReflectionStore.getReflections.mockResolvedValue([]);

      const strategies = await analyzerInstance.getTopSuccessStrategies(5);

      expect(strategies).toEqual([]);
    });

    it('should respect limit parameter', async () => {
      const strategies = await analyzerInstance.getTopSuccessStrategies(2);

      expect(strategies.length).toBeLessThanOrEqual(2);
    });
  });

  describe('Solution Recommendation', () => {
    it('should recommend solutions for similar problems', async () => {
      const problem = 'Failed to parse JSON syntax error in config';
      const solution = await analyzerInstance.recommendSolution(problem);

      expect(solution).toBeDefined();
      expect(solution.found).toBeDefined();
    });

    it('should find similar successful cases', async () => {
      const problem = 'Need to implement atomic file operation with validation';
      const solution = await analyzerInstance.recommendSolution(problem);

      expect(solution.found).toBe(true);
      expect(solution.topRecommendations).toBeDefined();
      expect(solution.similarCases).toBeGreaterThan(0);
    });

    it('should return recommendations with confidence scores', async () => {
      const problem = 'implementing atomic changes with validation';
      const solution = await analyzerInstance.recommendSolution(problem);

      if (solution.found) {
        solution.topRecommendations.forEach(rec => {
          expect(rec.recommendation).toBeDefined();
          expect(rec.confidence).toBeDefined();
          expect(rec.frequency).toBeDefined();
        });
      }
    });

    it('should handle empty problem description', async () => {
      const solution = await analyzerInstance.recommendSolution('');

      expect(solution.found).toBe(false);
      expect(solution.message).toContain('Could not extract keywords');
    });

    it('should report similar failures when no successes found', async () => {
      const problem = 'completely unique problem that has never occurred';
      const solution = await analyzerInstance.recommendSolution(problem);

      if (!solution.found) {
        expect(solution.message).toBeDefined();
      }
    });
  });

  describe('Learning Insights', () => {
    it('should generate comprehensive learning insights', async () => {
      const insights = await analyzerInstance.getLearningInsights();

      expect(insights).toBeDefined();
      expect(insights.summary).toBeDefined();
      expect(insights.clusters).toBeDefined();
      expect(insights.failurePatterns).toBeDefined();
      expect(insights.successStrategies).toBeDefined();
    });

    it('should include summary statistics', async () => {
      const insights = await analyzerInstance.getLearningInsights();

      expect(insights.summary.totalReflections).toBeDefined();
      expect(insights.summary.successfulCount).toBeDefined();
      expect(insights.summary.failedCount).toBeDefined();
      expect(insights.summary.overallSuccessRate).toBeDefined();
    });

    it('should calculate correct success rate', async () => {
      const insights = await analyzerInstance.getLearningInsights();

      const expectedRate = (insights.summary.successfulCount / insights.summary.totalReflections * 100).toFixed(1);
      expect(insights.summary.overallSuccessRate).toBe(expectedRate);
    });

    it('should limit clusters to 5', async () => {
      const insights = await analyzerInstance.getLearningInsights();

      expect(insights.clusters.length).toBeLessThanOrEqual(5);
    });

    it('should limit failure patterns to 5', async () => {
      const insights = await analyzerInstance.getLearningInsights();

      expect(insights.failurePatterns.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Keyword Extraction and Similarity', () => {
    it('should use Jaccard similarity for clustering', async () => {
      // Test by creating reflections with known similarity
      const clusters = await analyzerInstance.clusterReflections(2);

      // Reflections with 'error' and 'syntax' should cluster together
      const errorCluster = clusters.find(c =>
        c.keywords.some(k => k.includes('error') || k.includes('syntax'))
      );

      if (errorCluster) {
        expect(errorCluster.size).toBeGreaterThan(1);
      }
    });

    it('should filter short keywords', async () => {
      // Keywords should be longer than 3 characters
      const clusters = await analyzerInstance.clusterReflections(2);

      clusters.forEach(cluster => {
        cluster.keywords.forEach(keyword => {
          expect(keyword.length).toBeGreaterThan(3);
        });
      });
    });
  });
});
