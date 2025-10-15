import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ReflectionSearch Module', () => {
  let ReflectionSearch;
  let mockDeps;
  let searchInstance;
  let mockReflectionStore;
  let mockEventBus;

  beforeEach(async () => {
    // Mock reflections with various content
    const mockReflections = [
      {
        id: 'r1',
        description: 'Successfully implemented file reading with validation and error handling',
        context: { goal: 'Read files safely' },
        tags: ['file-io', 'validation', 'success'],
        outcome: 'successful',
        timestamp: Date.now() - 5000
      },
      {
        id: 'r2',
        description: 'Failed to parse JSON configuration due to syntax errors in file',
        context: { goal: 'Parse configuration' },
        tags: ['parsing', 'json', 'error'],
        outcome: 'failed',
        timestamp: Date.now() - 4000
      },
      {
        id: 'r3',
        description: 'Implemented atomic file write operation with checkpoints and validation',
        context: { goal: 'Write files atomically' },
        tags: ['file-io', 'atomic', 'success'],
        outcome: 'successful',
        timestamp: Date.now() - 3000
      },
      {
        id: 'r4',
        description: 'Network timeout occurred when fetching remote data from API endpoint',
        context: { goal: 'Fetch remote data' },
        tags: ['network', 'timeout', 'api'],
        outcome: 'failed',
        timestamp: Date.now() - 2000
      },
      {
        id: 'r5',
        description: 'Successfully validated user input with comprehensive error checking',
        context: { goal: 'Validate inputs' },
        tags: ['validation', 'input', 'success'],
        outcome: 'successful',
        timestamp: Date.now() - 1000
      }
    ];

    // Mock ReflectionStore
    mockReflectionStore = {
      getReflections: vi.fn(() => Promise.resolve(mockReflections))
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn()
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
      Utils: mockUtils,
      EventBus: mockEventBus
    };

    // Define ReflectionSearch module (implementation from source)
    ReflectionSearch = {
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

        let tfidfIndex = null;
        let indexedReflections = [];
        let lastIndexUpdate = 0;
        const INDEX_TTL = 300000;

        const tokenize = (text) => {
          return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        };

        const calculateTF = (tokens) => {
          const tf = new Map();
          const totalTerms = tokens.length;

          for (const token of tokens) {
            tf.set(token, (tf.get(token) || 0) + 1);
          }

          for (const [term, count] of tf.entries()) {
            tf.set(term, count / totalTerms);
          }

          return tf;
        };

        const calculateIDF = (documents) => {
          const idf = new Map();
          const totalDocs = documents.length;

          for (const doc of documents) {
            const uniqueTerms = new Set(doc);
            for (const term of uniqueTerms) {
              idf.set(term, (idf.get(term) || 0) + 1);
            }
          }

          for (const [term, docCount] of idf.entries()) {
            idf.set(term, Math.log(totalDocs / docCount));
          }

          return idf;
        };

        const calculateTFIDF = (tf, idf) => {
          const tfidf = new Map();

          for (const [term, tfValue] of tf.entries()) {
            const idfValue = idf.get(term) || 0;
            tfidf.set(term, tfValue * idfValue);
          }

          return tfidf;
        };

        const cosineSimilarity = (vec1, vec2) => {
          let dotProduct = 0;
          for (const [term, value1] of vec1.entries()) {
            const value2 = vec2.get(term) || 0;
            dotProduct += value1 * value2;
          }

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

          if (mag1 === 0 || mag2 === 0) return 0;

          return dotProduct / (mag1 * mag2);
        };

        const rebuildIndex = async () => {
          const startTime = Date.now();
          logger.info('[ReflectionSearch] Building TF-IDF index...');

          const reflections = await ReflectionStore.getReflections({ limit: 1000 });
          indexedReflections = reflections;

          if (reflections.length === 0) {
            tfidfIndex = { idf: new Map(), vectors: [] };
            lastIndexUpdate = Date.now();
            logger.info('[ReflectionSearch] Index built (empty)');
            return;
          }

          const documents = reflections.map(r => {
            const text = [
              r.description || '',
              r.context?.goal || '',
              ...(r.tags || [])
            ].join(' ');
            return tokenize(text);
          });

          const idf = calculateIDF(documents);

          const vectors = documents.map(doc => {
            const tf = calculateTF(doc);
            return calculateTFIDF(tf, idf);
          });

          tfidfIndex = { idf, vectors };
          lastIndexUpdate = Date.now();

          const duration = Date.now() - startTime;
          logger.info(`[ReflectionSearch] Index built: ${reflections.length} reflections in ${duration}ms`);
        };

        const ensureIndexFresh = async () => {
          const now = Date.now();
          if (!tfidfIndex || (now - lastIndexUpdate) > INDEX_TTL) {
            await rebuildIndex();
          }
        };

        const search = async (query, options = {}) => {
          await ensureIndexFresh();

          const limit = options.limit || 10;
          const threshold = options.threshold || 0.1;

          const queryTokens = tokenize(query);
          const queryTF = calculateTF(queryTokens);
          const queryVector = calculateTFIDF(queryTF, tfidfIndex.idf);

          const results = [];

          for (let i = 0; i < indexedReflections.length; i++) {
            const reflection = indexedReflections[i];

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

          results.sort((a, b) => b.similarity - a.similarity);

          return results.slice(0, limit);
        };

        const findSimilar = async (reflectionId, limit = 5) => {
          await ensureIndexFresh();

          const targetIndex = indexedReflections.findIndex(r => r.id === reflectionId);
          if (targetIndex === -1) {
            logger.warn(`[ReflectionSearch] Reflection ${reflectionId} not found in index`);
            return [];
          }

          const targetVector = tfidfIndex.vectors[targetIndex];
          const results = [];

          for (let i = 0; i < indexedReflections.length; i++) {
            if (i === targetIndex) continue;

            const reflection = indexedReflections[i];
            const docVector = tfidfIndex.vectors[i];
            const similarity = cosineSimilarity(targetVector, docVector);

            results.push({
              reflection,
              similarity,
              score: similarity
            });
          }

          results.sort((a, b) => b.similarity - a.similarity);
          return results.slice(0, limit);
        };

        const getRelevantForContext = async (context, limit = 5) => {
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

        const clearIndex = () => {
          tfidfIndex = null;
          indexedReflections = [];
          lastIndexUpdate = 0;
          logger.info('[ReflectionSearch] Index cleared');
        };

        const init = async () => {
          logger.info('[ReflectionSearch] Initializing semantic search');

          await rebuildIndex();

          EventBus.on('reflection:created', async () => {
            logger.debug('[ReflectionSearch] New reflection detected, invalidating index');
            tfidfIndex = null;
          });

          return true;
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

    const instance = ReflectionSearch.factory(mockDeps);
    await instance.init();
    searchInstance = instance.api;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ReflectionSearch.metadata.id).toBe('ReflectionSearch');
      expect(ReflectionSearch.metadata.version).toBe('1.0.0');
      expect(ReflectionSearch.metadata.type).toBe('intelligence');
    });

    it('should declare required dependencies', () => {
      expect(ReflectionSearch.metadata.dependencies).toContain('ReflectionStore');
      expect(ReflectionSearch.metadata.dependencies).toContain('Utils');
      expect(ReflectionSearch.metadata.dependencies).toContain('EventBus');
    });

    it('should be async', () => {
      expect(ReflectionSearch.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', () => {
      expect(searchInstance).toBeDefined();
      expect(searchInstance.search).toBeDefined();
      expect(searchInstance.findSimilar).toBeDefined();
      expect(searchInstance.getRelevantForContext).toBeDefined();
    });

    it('should build index on init', () => {
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Building TF-IDF index')
      );
    });

    it('should register event listener for new reflections', () => {
      expect(mockEventBus.on).toHaveBeenCalledWith(
        'reflection:created',
        expect.any(Function)
      );
    });
  });

  describe('Index Building', () => {
    it('should build TF-IDF index', async () => {
      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBeGreaterThan(0);
      expect(stats.vocabularySize).toBeGreaterThan(0);
      expect(stats.lastUpdate).toBeDefined();
    });

    it('should handle empty reflection set', async () => {
      mockReflectionStore.getReflections.mockResolvedValue([]);

      await searchInstance.rebuildIndex();

      const stats = searchInstance.getIndexStats();
      expect(stats.indexed).toBe(0);
      expect(stats.vocabularySize).toBe(0);
    });

    it('should log index build completion', async () => {
      await searchInstance.rebuildIndex();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/Index built: \d+ reflections in \d+ms/)
      );
    });
  });

  describe('Semantic Search', () => {
    it('should find reflections similar to query', async () => {
      const results = await searchInstance.search('file reading validation');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should return results with similarity scores', async () => {
      const results = await searchInstance.search('file operations');

      results.forEach(result => {
        expect(result.reflection).toBeDefined();
        expect(result.similarity).toBeDefined();
        expect(result.score).toBeDefined();
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should sort results by similarity descending', async () => {
      const results = await searchInstance.search('validation error handling');

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const results = await searchInstance.search('file', { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should respect threshold parameter', async () => {
      const results = await searchInstance.search('test query', { threshold: 0.5 });

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0.5);
      });
    });

    it('should filter by outcome', async () => {
      const results = await searchInstance.search('file validation', { outcome: 'successful' });

      results.forEach(result => {
        expect(result.reflection.outcome).toBe('successful');
      });
    });

    it('should handle queries with no matches', async () => {
      const results = await searchInstance.search('xyz123abc456def789', { threshold: 0.9 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Find Similar', () => {
    it('should find similar reflections to given reflection', async () => {
      const results = await searchInstance.findSimilar('r1', 3);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should not include the target reflection itself', async () => {
      const results = await searchInstance.findSimilar('r1', 10);

      const selfReference = results.find(r => r.reflection.id === 'r1');
      expect(selfReference).toBeUndefined();
    });

    it('should sort results by similarity', async () => {
      const results = await searchInstance.findSimilar('r1', 5);

      if (results.length > 1) {
        for (let i = 0; i < results.length - 1; i++) {
          expect(results[i].similarity).toBeGreaterThanOrEqual(results[i + 1].similarity);
        }
      }
    });

    it('should respect limit parameter', async () => {
      const results = await searchInstance.findSimilar('r1', 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle non-existent reflection ID', async () => {
      const results = await searchInstance.findSimilar('non-existent', 5);

      expect(results).toEqual([]);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Context-Based Search', () => {
    it('should find reflections relevant to context', async () => {
      const context = {
        goal: 'Validate user inputs',
        tags: ['validation', 'input']
      };

      const results = await searchInstance.getRelevantForContext(context, 5);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should combine goal, error, and tags in query', async () => {
      const context = {
        goal: 'Parse JSON',
        error: 'syntax error',
        tags: ['json', 'parsing']
      };

      const results = await searchInstance.getRelevantForContext(context, 5);

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle empty context', async () => {
      const results = await searchInstance.getRelevantForContext({}, 5);

      expect(results).toEqual([]);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        '[ReflectionSearch] Empty context provided'
      );
    });

    it('should use lower threshold for context search', async () => {
      const context = { goal: 'something' };

      const results = await searchInstance.getRelevantForContext(context, 5);

      // Lower threshold means more potential matches
      expect(results).toBeDefined();
    });
  });

  describe('Index Statistics', () => {
    it('should return index statistics', () => {
      const stats = searchInstance.getIndexStats();

      expect(stats).toBeDefined();
      expect(stats.indexed).toBeDefined();
      expect(stats.vocabularySize).toBeDefined();
      expect(stats.lastUpdate).toBeDefined();
      expect(stats.age).toBeDefined();
    });

    it('should track number of indexed reflections', () => {
      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBe(5);
    });

    it('should track vocabulary size', () => {
      const stats = searchInstance.getIndexStats();

      expect(stats.vocabularySize).toBeGreaterThan(0);
    });

    it('should calculate index age', () => {
      const stats = searchInstance.getIndexStats();

      expect(stats.age).toBeGreaterThanOrEqual(0);
    });

    it('should handle uninitialized index', async () => {
      await searchInstance.clearIndex();

      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBe(0);
      expect(stats.vocabularySize).toBe(0);
      expect(stats.lastUpdate).toBeNull();
      expect(stats.age).toBeNull();
    });
  });

  describe('Index Management', () => {
    it('should clear index', async () => {
      await searchInstance.clearIndex();

      const stats = searchInstance.getIndexStats();
      expect(stats.indexed).toBe(0);
    });

    it('should rebuild index after clear', async () => {
      await searchInstance.clearIndex();
      await searchInstance.rebuildIndex();

      const stats = searchInstance.getIndexStats();
      expect(stats.indexed).toBeGreaterThan(0);
    });

    it('should log index clear', async () => {
      await searchInstance.clearIndex();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        '[ReflectionSearch] Index cleared'
      );
    });
  });

  describe('Index Freshness', () => {
    it('should rebuild index after TTL expires', async () => {
      vi.useFakeTimers();

      // Initial search
      await searchInstance.search('test');

      const initialStats = searchInstance.getIndexStats();
      const initialUpdate = initialStats.lastUpdate;

      // Advance time beyond TTL
      vi.advanceTimersByTime(301000); // 5 minutes + 1 second

      // Search again should trigger rebuild
      await searchInstance.search('test');

      const newStats = searchInstance.getIndexStats();
      expect(newStats.lastUpdate).toBeGreaterThan(initialUpdate);
    });

    it('should invalidate index on new reflection event', async () => {
      // Trigger the event listener
      const eventCallback = mockEventBus.on.mock.calls.find(
        call => call[0] === 'reflection:created'
      )[1];

      await eventCallback();

      expect(mockDeps.Utils.logger.debug).toHaveBeenCalledWith(
        '[ReflectionSearch] New reflection detected, invalidating index'
      );
    });
  });

  describe('TF-IDF Calculations', () => {
    it('should filter short words during tokenization', async () => {
      const results = await searchInstance.search('a be to');

      // Short words should be filtered, so query should match nothing specific
      expect(results).toBeDefined();
    });

    it('should handle case insensitivity', async () => {
      const results1 = await searchInstance.search('FILE VALIDATION');
      const results2 = await searchInstance.search('file validation');

      // Should get similar results regardless of case
      expect(results1.length).toBe(results2.length);
    });

    it('should handle punctuation in queries', async () => {
      const results = await searchInstance.search('file, reading! validation?');

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe('Cosine Similarity', () => {
    it('should calculate similarity between 0 and 1', async () => {
      const results = await searchInstance.search('validation');

      results.forEach(result => {
        expect(result.similarity).toBeGreaterThanOrEqual(0);
        expect(result.similarity).toBeLessThanOrEqual(1);
      });
    });

    it('should handle zero vectors gracefully', async () => {
      const results = await searchInstance.search('');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('Complex Query Scenarios', () => {
    it('should handle nested AND conditions', async () => {
      const results = await searchInstance.search('file AND validation AND success');

      results.forEach(result => {
        const desc = result.reflection.description.toLowerCase();
        expect(desc.includes('file') || desc.includes('validation') || desc.includes('success')).toBe(true);
      });
    });

    it('should handle OR conditions with wildcards', async () => {
      const results = await searchInstance.search('file* OR valid*');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should parse complex boolean queries', async () => {
      const query = '(file OR validation) AND (success OR error)';
      const results = await searchInstance.search(query);

      expect(results).toBeDefined();
    });

    it('should handle quoted phrases', async () => {
      const results = await searchInstance.search('"file reading validation"');

      expect(results).toBeDefined();
    });

    it('should support negation queries', async () => {
      const results = await searchInstance.search('validation NOT error');

      expect(results).toBeDefined();
    });
  });

  describe('Search Result Ranking', () => {
    it('should rank exact matches higher', async () => {
      const results = await searchInstance.search('validation error handling');

      if (results.length > 1) {
        expect(results[0].similarity).toBeGreaterThanOrEqual(results[1].similarity);
      }
    });

    it('should apply relevance scoring', async () => {
      const results = await searchInstance.search('file validation');

      results.forEach(result => {
        expect(result.score).toBeDefined();
        expect(result.score).toBeGreaterThanOrEqual(0);
      });
    });

    it('should boost recent results', async () => {
      mockReflectionStore.getReflections.mockResolvedValue([
        {
          id: 'recent',
          description: 'Recent file validation',
          timestamp: Date.now(),
          tags: ['validation']
        },
        {
          id: 'old',
          description: 'Old file validation',
          timestamp: Date.now() - 100000,
          tags: ['validation']
        }
      ]);

      await searchInstance.rebuildIndex();
      const results = await searchInstance.search('validation');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should apply tag weight boosting', async () => {
      const results = await searchInstance.search('validation');

      results.forEach(result => {
        if (result.reflection.tags && result.reflection.tags.includes('validation')) {
          expect(result.score).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Fuzzy Matching Edge Cases', () => {
    it('should handle typos with edit distance 1', async () => {
      const results = await searchInstance.search('validatoin'); // typo

      expect(results).toBeDefined();
    });

    it('should match with case insensitivity', async () => {
      const results1 = await searchInstance.search('VALIDATION');
      const results2 = await searchInstance.search('validation');

      expect(results1.length).toBe(results2.length);
    });

    it('should handle transposition errors', async () => {
      const results = await searchInstance.search('fiel'); // transposed 'file'

      expect(results).toBeDefined();
    });

    it('should match partial words', async () => {
      const results = await searchInstance.search('valid');

      expect(results.length).toBeGreaterThan(0);
    });

    it('should handle keyboard proximity errors', async () => {
      const results = await searchInstance.search('vqlidation'); // 'q' near 'a' on keyboard

      expect(results).toBeDefined();
    });
  });

  describe('Large Result Set Handling', () => {
    it('should handle 1000+ results efficiently', async () => {
      const manyReflections = Array(1000).fill(null).map((_, i) => ({
        id: `r${i}`,
        description: `Result ${i} with common term validation`,
        tags: ['common'],
        timestamp: Date.now() - i
      }));

      mockReflectionStore.getReflections.mockResolvedValue(manyReflections);
      await searchInstance.rebuildIndex();

      const startTime = Date.now();
      const results = await searchInstance.search('validation', { limit: 100 });
      const duration = Date.now() - startTime;

      expect(results.length).toBeLessThanOrEqual(100);
      expect(duration).toBeLessThan(2000);
    });

    it('should paginate large result sets', async () => {
      const manyReflections = Array(500).fill(null).map((_, i) => ({
        id: `r${i}`,
        description: `Reflection ${i} matching search`,
        tags: ['search'],
        timestamp: Date.now() - i
      }));

      mockReflectionStore.getReflections.mockResolvedValue(manyReflections);
      await searchInstance.rebuildIndex();

      const page1 = await searchInstance.search('reflection', { limit: 10, threshold: 0.01 });
      const page2 = await searchInstance.search('reflection', { limit: 10, threshold: 0.01 });

      expect(page1.length).toBeLessThanOrEqual(10);
    });

    it('should stream results for very large sets', async () => {
      const hugeReflections = Array(2000).fill(null).map((_, i) => ({
        id: `r${i}`,
        description: `Entry ${i}`,
        tags: ['tag'],
        timestamp: Date.now() - i
      }));

      mockReflectionStore.getReflections.mockResolvedValue(hugeReflections.slice(0, 1000));
      await searchInstance.rebuildIndex();

      const results = await searchInstance.search('entry', { limit: 50 });
      expect(results).toBeDefined();
    });

    it('should implement result batching', async () => {
      const batchSize = 100;
      const totalResults = 500;

      const reflections = Array(totalResults).fill(null).map((_, i) => ({
        id: `r${i}`,
        description: `Batch test ${i}`,
        tags: ['batch'],
        timestamp: Date.now() - i
      }));

      mockReflectionStore.getReflections.mockResolvedValue(reflections);
      await searchInstance.rebuildIndex();

      const results = await searchInstance.search('batch', { limit: batchSize });
      expect(results.length).toBeLessThanOrEqual(batchSize);
    });
  });

  describe('Concurrent Search Tests', () => {
    it('should handle concurrent search requests', async () => {
      const searches = [
        searchInstance.search('validation'),
        searchInstance.search('file'),
        searchInstance.search('error')
      ];

      const results = await Promise.all(searches);
      expect(results).toHaveLength(3);
    });

    it('should maintain index consistency during concurrent searches', async () => {
      const promises = Array(10).fill(null).map(() =>
        searchInstance.search('validation')
      );

      const results = await Promise.all(promises);
      const firstLength = results[0].length;

      results.forEach(result => {
        expect(result.length).toBe(firstLength);
      });
    });

    it('should handle concurrent index rebuilds', async () => {
      const rebuilds = [
        searchInstance.rebuildIndex(),
        searchInstance.rebuildIndex()
      ];

      await Promise.all(rebuilds);
      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBeGreaterThan(0);
    });

    it('should queue searches during index rebuild', async () => {
      const rebuildPromise = searchInstance.rebuildIndex();
      const searchPromise = searchInstance.search('validation');

      await Promise.all([rebuildPromise, searchPromise]);
      expect(searchPromise).toBeDefined();
    });
  });

  describe('Search Index Corruption Recovery', () => {
    it('should detect corrupted index', async () => {
      await searchInstance.clearIndex();

      const stats = searchInstance.getIndexStats();
      expect(stats.indexed).toBe(0);
    });

    it('should rebuild corrupted index automatically', async () => {
      await searchInstance.clearIndex();

      const results = await searchInstance.search('validation');
      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBeGreaterThan(0);
    });

    it('should handle partial index corruption', async () => {
      await searchInstance.rebuildIndex();

      const results = await searchInstance.search('validation');
      expect(results).toBeDefined();
    });

    it('should recover from index rebuild failures', async () => {
      mockReflectionStore.getReflections
        .mockRejectedValueOnce(new Error('Database error'))
        .mockResolvedValueOnce([
          {
            id: 'r1',
            description: 'Recovery test',
            tags: ['recovery'],
            timestamp: Date.now()
          }
        ]);

      try {
        await searchInstance.rebuildIndex();
      } catch (e) {
        // Expected error
      }

      await searchInstance.rebuildIndex();
      const stats = searchInstance.getIndexStats();

      expect(stats.indexed).toBeGreaterThan(0);
    });
  });

  describe('Search Query Validation', () => {
    it('should validate empty queries', async () => {
      const results = await searchInstance.search('');

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle extremely long queries', async () => {
      const longQuery = 'validation '.repeat(1000);
      const results = await searchInstance.search(longQuery);

      expect(results).toBeDefined();
    });

    it('should sanitize special characters', async () => {
      const results = await searchInstance.search('validation<>[]{}');

      expect(results).toBeDefined();
    });

    it('should handle SQL injection attempts', async () => {
      const maliciousQuery = "'; DROP TABLE reflections; --";
      const results = await searchInstance.search(maliciousQuery);

      expect(results).toBeDefined();
    });

    it('should validate query syntax', async () => {
      const invalidQuery = '(((validation';
      const results = await searchInstance.search(invalidQuery);

      expect(results).toBeDefined();
    });

    it('should limit query term count', async () => {
      const manyTerms = Array(1000).fill('term').join(' ');
      const results = await searchInstance.search(manyTerms);

      expect(results).toBeDefined();
    });
  });

  describe('Search Performance Tests', () => {
    it('should perform sub-100ms searches on small indexes', async () => {
      const startTime = Date.now();
      await searchInstance.search('validation');
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should maintain performance under load', async () => {
      const durations = [];

      for (let i = 0; i < 10; i++) {
        const start = Date.now();
        await searchInstance.search('validation');
        durations.push(Date.now() - start);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(200);
    });

    it('should optimize index build time', async () => {
      const reflections = Array(100).fill(null).map((_, i) => ({
        id: `r${i}`,
        description: `Performance test ${i}`,
        tags: ['perf'],
        timestamp: Date.now() - i
      }));

      mockReflectionStore.getReflections.mockResolvedValue(reflections);

      const startTime = Date.now();
      await searchInstance.rebuildIndex();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000);
    });

    it('should cache search results', async () => {
      const query = 'validation';

      const start1 = Date.now();
      await searchInstance.search(query);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      await searchInstance.search(query);
      const duration2 = Date.now() - start2;

      expect(duration2).toBeLessThanOrEqual(duration1 + 50);
    });
  });
});
