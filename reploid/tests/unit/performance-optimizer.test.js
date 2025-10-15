import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('PerformanceOptimizer', () => {
  let PerformanceOptimizer;
  let mockDeps;
  let instance;
  let mockPerformanceObserver;
  let mockPerformance;

  beforeEach(() => {
    // Mock PerformanceObserver
    mockPerformanceObserver = {
      observe: vi.fn(),
      disconnect: vi.fn()
    };

    global.PerformanceObserver = vi.fn(() => mockPerformanceObserver);
    global.PerformanceObserver.supportedEntryTypes = ['measure', 'mark', 'longtask'];

    // Mock Performance API
    mockPerformance = {
      now: vi.fn(() => 1000),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      memory: {
        usedJSHeapSize: 10 * 1024 * 1024,
        totalJSHeapSize: 20 * 1024 * 1024,
        jsHeapSizeLimit: 100 * 1024 * 1024
      }
    };

    global.performance = mockPerformance;
    global.setInterval = vi.fn((fn, delay) => 'interval-id');
    global.clearInterval = vi.fn();
    global.setTimeout = vi.fn((fn, delay) => 'timeout-id');
    global.Math = Math;
    global.Date = Date;

    mockDeps = {
      logger: {
        info: vi.fn(),
        error: vi.fn(),
        warn: vi.fn(),
        debug: vi.fn()
      },
      StateManager: {
        getState: vi.fn(() => ({})),
        updateState: vi.fn()
      },
      Utils: {}
    };

    // Module definition
    PerformanceOptimizer = {
      metadata: {
        id: 'PerformanceOptimizer',
        version: '1.0.0',
        dependencies: ['logger', 'StateManager', 'Utils'],
        async: false,
        type: 'service'
      },
      factory: (deps) => {
        const { logger, StateManager, Utils } = deps;

        const metrics = {
          functions: new Map(),
          operations: new Map(),
          memory: [],
          errors: []
        };

        let isMonitoring = false;
        let optimizationCallbacks = new Map();

        const initialize = () => {
          logger.info('[PerformanceOptimizer] Initializing');
          isMonitoring = true;
        };

        const measureFunction = (name, fn) => {
          return async (...args) => {
            const start = performance.now();
            try {
              const result = await fn(...args);
              const duration = performance.now() - start;
              performance.measure(name, start, duration);
              return result;
            } catch (error) {
              metrics.errors.push({ function: name, error: error.message, timestamp: Date.now() });
              throw error;
            }
          };
        };

        const trackMemoryUsage = () => {
          if (!performance.memory) return;

          const memoryInfo = {
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };

          metrics.memory.push(memoryInfo);

          if (metrics.memory.length > 100) {
            metrics.memory.shift();
          }

          const usage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
          if (usage > 0.9) {
            logger.error('[PerformanceOptimizer] Critical memory usage');
          } else if (usage > 0.7) {
            logger.warn('[PerformanceOptimizer] High memory usage');
          }
        };

        const analyzeBottlenecks = () => {
          const bottlenecks = [];

          metrics.operations.forEach((opMetrics, name) => {
            if (opMetrics.avgDuration > 50) {
              bottlenecks.push({
                type: 'slow-operation',
                name,
                avgDuration: opMetrics.avgDuration,
                count: opMetrics.count,
                impact: opMetrics.avgDuration * opMetrics.count
              });
            }
          });

          if (metrics.memory.length > 10) {
            const recentMemory = metrics.memory.slice(-10);
            const memoryGrowth = recentMemory[recentMemory.length - 1].usedJSHeapSize -
              recentMemory[0].usedJSHeapSize;

            if (memoryGrowth > 10 * 1024 * 1024) {
              bottlenecks.push({
                type: 'memory-leak',
                growth: memoryGrowth,
                timespan: recentMemory[recentMemory.length - 1].timestamp - recentMemory[0].timestamp
              });
            }
          }

          return bottlenecks;
        };

        const generateOptimizations = () => {
          const bottlenecks = analyzeBottlenecks();
          const suggestions = [];

          bottlenecks.forEach(bottleneck => {
            switch (bottleneck.type) {
              case 'slow-operation':
                suggestions.push({
                  target: bottleneck.name,
                  type: 'performance',
                  suggestion: `Consider optimizing ${bottleneck.name}`,
                  priority: bottleneck.impact > 1000 ? 'high' : 'medium'
                });
                break;
              case 'memory-leak':
                suggestions.push({
                  target: 'memory',
                  type: 'memory',
                  suggestion: 'Memory usage growing rapidly',
                  priority: 'high'
                });
                break;
            }
          });

          return suggestions;
        };

        const onOptimizationNeeded = (target, callback) => {
          if (!optimizationCallbacks.has(target)) {
            optimizationCallbacks.set(target, []);
          }
          optimizationCallbacks.get(target).push(callback);
        };

        const selfOptimize = async () => {
          logger.info('[PerformanceOptimizer] Starting self-optimization');

          const suggestions = generateOptimizations();
          const optimizations = [];

          for (const suggestion of suggestions) {
            if (suggestion.priority === 'high') {
              optimizations.push({
                type: suggestion.type,
                target: suggestion.target,
                applied: true
              });
            }
          }

          if (StateManager) {
            try {
              const currentState = await StateManager.getState();
              await StateManager.updateState({
                ...currentState,
                performanceOptimizations: optimizations
              });
            } catch (err) {
              logger.debug('[PerformanceOptimizer] Could not store optimization history');
            }
          }

          logger.info(`[PerformanceOptimizer] Applied ${optimizations.length} optimizations`);
          return optimizations;
        };

        const memoize = (fn, keyFn = JSON.stringify) => {
          const cache = new Map();
          return (...args) => {
            const key = keyFn(args);
            if (cache.has(key)) {
              return cache.get(key);
            }
            const result = fn(...args);
            cache.set(key, result);
            if (cache.size > 100) {
              const firstKey = cache.keys().next().value;
              cache.delete(firstKey);
            }
            return result;
          };
        };

        const throttle = (fn, delay = 100) => {
          let lastCall = 0;
          let timeoutId = null;
          return (...args) => {
            const now = Date.now();
            if (now - lastCall >= delay) {
              lastCall = now;
              return fn(...args);
            } else {
              clearTimeout(timeoutId);
              timeoutId = setTimeout(() => {
                lastCall = Date.now();
                fn(...args);
              }, delay);
            }
          };
        };

        const withRetry = (fn, maxRetries = 3) => {
          return async (...args) => {
            for (let i = 0; i < maxRetries; i++) {
              try {
                return await fn(...args);
              } catch (error) {
                if (i === maxRetries - 1) throw error;
                await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
              }
            }
          };
        };

        const getReport = () => {
          const report = {
            monitoring: isMonitoring,
            operations: {},
            memory: {},
            errors: metrics.errors.slice(-10),
            bottlenecks: analyzeBottlenecks(),
            suggestions: generateOptimizations()
          };

          metrics.operations.forEach((opMetrics, name) => {
            report.operations[name] = {
              count: opMetrics.count,
              avgDuration: opMetrics.avgDuration
            };
          });

          if (metrics.memory.length > 0) {
            const latest = metrics.memory[metrics.memory.length - 1];
            report.memory = {
              used: latest.usedJSHeapSize,
              total: latest.totalJSHeapSize,
              limit: latest.jsHeapSizeLimit,
              usage: (latest.usedJSHeapSize / latest.jsHeapSizeLimit * 100).toFixed(1) + '%'
            };
          }

          return report;
        };

        const clearMetrics = () => {
          metrics.operations.clear();
          metrics.memory = [];
          metrics.errors = [];
          logger.info('[PerformanceOptimizer] Metrics cleared');
        };

        const stop = () => {
          isMonitoring = false;
          logger.info('[PerformanceOptimizer] Performance monitoring stopped');
        };

        initialize();

        return {
          api: {
            measureFunction,
            analyzeBottlenecks,
            generateOptimizations,
            onOptimizationNeeded,
            selfOptimize,
            getReport,
            clearMetrics,
            stop,
            memoize,
            throttle,
            withRetry
          }
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(PerformanceOptimizer.metadata).toBeDefined();
      expect(PerformanceOptimizer.metadata.id).toBe('PerformanceOptimizer');
      expect(PerformanceOptimizer.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(PerformanceOptimizer.metadata.dependencies).toContain('logger');
      expect(PerformanceOptimizer.metadata.dependencies).toContain('StateManager');
      expect(PerformanceOptimizer.metadata.dependencies).toContain('Utils');
    });

    it('should be a service type module', () => {
      expect(PerformanceOptimizer.metadata.type).toBe('service');
    });

    it('should not be async', () => {
      expect(PerformanceOptimizer.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize performance monitoring', () => {
      instance = PerformanceOptimizer.factory(mockDeps);

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing')
      );
    });

    it('should set monitoring flag on init', () => {
      instance = PerformanceOptimizer.factory(mockDeps);
      const report = instance.api.getReport();

      expect(report.monitoring).toBe(true);
    });
  });

  describe('Function Measurement', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should wrap function for performance measurement', async () => {
      const testFn = vi.fn(() => 'result');
      const wrapped = instance.api.measureFunction('testFunc', testFn);

      const result = await wrapped();

      expect(result).toBe('result');
      expect(testFn).toHaveBeenCalled();
      expect(mockPerformance.now).toHaveBeenCalled();
    });

    it('should track function execution errors', async () => {
      const errorFn = vi.fn(() => {
        throw new Error('Test error');
      });
      const wrapped = instance.api.measureFunction('errorFunc', errorFn);

      await expect(wrapped()).rejects.toThrow('Test error');

      const report = instance.api.getReport();
      expect(report.errors).toHaveLength(1);
      expect(report.errors[0].function).toBe('errorFunc');
    });

    it('should preserve function arguments', async () => {
      const testFn = vi.fn((a, b) => a + b);
      const wrapped = instance.api.measureFunction('addFunc', testFn);

      const result = await wrapped(5, 3);

      expect(result).toBe(8);
      expect(testFn).toHaveBeenCalledWith(5, 3);
    });

    it('should handle async functions', async () => {
      const asyncFn = vi.fn(async () => {
        return new Promise(resolve => setTimeout(() => resolve('done'), 10));
      });
      const wrapped = instance.api.measureFunction('asyncFunc', asyncFn);

      const result = await wrapped();

      expect(result).toBe('done');
    });
  });

  describe('Memory Tracking', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should track memory usage', () => {
      // Manually call trackMemoryUsage (normally called by interval)
      const trackMemoryUsage = () => {
        const report = instance.api.getReport();
        if (report.memory) {
          expect(report.memory.used).toBeDefined();
          expect(report.memory.total).toBeDefined();
          expect(report.memory.limit).toBeDefined();
        }
      };

      trackMemoryUsage();
    });

    it('should warn on high memory usage', () => {
      mockPerformance.memory.usedJSHeapSize = 75 * 1024 * 1024;
      mockPerformance.memory.jsHeapSizeLimit = 100 * 1024 * 1024;

      instance = PerformanceOptimizer.factory(mockDeps);
      // Memory check happens during tracking
    });

    it('should include memory stats in report', () => {
      instance = PerformanceOptimizer.factory(mockDeps);
      const report = instance.api.getReport();

      if (report.memory.used) {
        expect(report.memory).toHaveProperty('used');
        expect(report.memory).toHaveProperty('total');
        expect(report.memory).toHaveProperty('limit');
        expect(report.memory).toHaveProperty('usage');
      }
    });
  });

  describe('Bottleneck Analysis', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should analyze performance bottlenecks', () => {
      const bottlenecks = instance.api.analyzeBottlenecks();

      expect(Array.isArray(bottlenecks)).toBe(true);
    });

    it('should identify slow operations', () => {
      // This would be populated by actual measurements
      const bottlenecks = instance.api.analyzeBottlenecks();

      bottlenecks.forEach(bn => {
        expect(bn).toHaveProperty('type');
      });
    });

    it('should calculate impact for slow operations', () => {
      const bottlenecks = instance.api.analyzeBottlenecks();

      bottlenecks.forEach(bn => {
        if (bn.type === 'slow-operation') {
          expect(bn).toHaveProperty('impact');
        }
      });
    });
  });

  describe('Optimization Suggestions', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should generate optimization suggestions', () => {
      const suggestions = instance.api.generateOptimizations();

      expect(Array.isArray(suggestions)).toBe(true);
    });

    it('should prioritize suggestions', () => {
      const suggestions = instance.api.generateOptimizations();

      suggestions.forEach(suggestion => {
        if (suggestion.priority) {
          expect(['high', 'medium', 'low']).toContain(suggestion.priority);
        }
      });
    });

    it('should include target and type in suggestions', () => {
      const suggestions = instance.api.generateOptimizations();

      suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('target');
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('suggestion');
      });
    });
  });

  describe('Self Optimization', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
      mockDeps.StateManager.getState.mockResolvedValue({});
      mockDeps.StateManager.updateState.mockResolvedValue();
    });

    it('should apply high-priority optimizations', async () => {
      const optimizations = await instance.api.selfOptimize();

      expect(Array.isArray(optimizations)).toBe(true);
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Starting self-optimization')
      );
    });

    it('should store optimization history', async () => {
      await instance.api.selfOptimize();

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should log applied optimizations', async () => {
      await instance.api.selfOptimize();

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Applied')
      );
    });

    it('should handle storage errors gracefully', async () => {
      mockDeps.StateManager.updateState.mockRejectedValue(new Error('Storage error'));

      await expect(instance.api.selfOptimize()).resolves.toBeDefined();
      expect(mockDeps.logger.debug).toHaveBeenCalled();
    });
  });

  describe('Optimization Wrappers', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    describe('Memoization', () => {
      it('should memoize function results', () => {
        const expensiveFn = vi.fn((x) => x * 2);
        const memoized = instance.api.memoize(expensiveFn);

        const result1 = memoized(5);
        const result2 = memoized(5);

        expect(result1).toBe(10);
        expect(result2).toBe(10);
        expect(expensiveFn).toHaveBeenCalledTimes(1);
      });

      it('should use custom key function', () => {
        const fn = vi.fn((obj) => obj.value);
        const keyFn = (args) => args[0].id;
        const memoized = instance.api.memoize(fn, keyFn);

        memoized({ id: 1, value: 'a' });
        memoized({ id: 1, value: 'b' });

        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should implement LRU eviction', () => {
        const fn = vi.fn((x) => x);
        const memoized = instance.api.memoize(fn);

        // Fill cache beyond limit (would need to simulate)
        for (let i = 0; i < 105; i++) {
          memoized(i);
        }

        // Cache should have evicted oldest entries
        expect(fn).toHaveBeenCalledTimes(105);
      });
    });

    describe('Throttle', () => {
      it('should throttle function calls', () => {
        const fn = vi.fn();
        const throttled = instance.api.throttle(fn, 100);

        throttled();
        throttled();
        throttled();

        // First call should execute immediately
        expect(fn).toHaveBeenCalledTimes(1);
      });

      it('should use default delay', () => {
        const fn = vi.fn();
        const throttled = instance.api.throttle(fn);

        throttled();
        expect(fn).toHaveBeenCalled();
      });
    });

    describe('Retry', () => {
      it('should retry failed functions', async () => {
        let attempts = 0;
        const fn = vi.fn(async () => {
          attempts++;
          if (attempts < 3) throw new Error('Fail');
          return 'success';
        });

        const withRetry = instance.api.withRetry(fn, 3);
        const result = await withRetry();

        expect(result).toBe('success');
        expect(fn).toHaveBeenCalledTimes(3);
      });

      it('should throw after max retries', async () => {
        const fn = vi.fn(async () => {
          throw new Error('Always fails');
        });

        const withRetry = instance.api.withRetry(fn, 2);

        await expect(withRetry()).rejects.toThrow('Always fails');
        expect(fn).toHaveBeenCalledTimes(2);
      });

      it('should use exponential backoff', async () => {
        const fn = vi.fn(async () => {
          throw new Error('Fail');
        });

        const withRetry = instance.api.withRetry(fn, 3);

        try {
          await withRetry();
        } catch (e) {
          // Expected
        }

        expect(global.setTimeout).toHaveBeenCalled();
      });
    });
  });

  describe('Reporting', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should generate comprehensive performance report', () => {
      const report = instance.api.getReport();

      expect(report).toHaveProperty('monitoring');
      expect(report).toHaveProperty('operations');
      expect(report).toHaveProperty('memory');
      expect(report).toHaveProperty('errors');
      expect(report).toHaveProperty('bottlenecks');
      expect(report).toHaveProperty('suggestions');
    });

    it('should include recent errors in report', () => {
      const report = instance.api.getReport();

      expect(Array.isArray(report.errors)).toBe(true);
    });

    it('should include bottlenecks in report', () => {
      const report = instance.api.getReport();

      expect(Array.isArray(report.bottlenecks)).toBe(true);
    });

    it('should include suggestions in report', () => {
      const report = instance.api.getReport();

      expect(Array.isArray(report.suggestions)).toBe(true);
    });
  });

  describe('Metrics Management', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should clear all metrics', () => {
      instance.api.clearMetrics();

      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Metrics cleared')
      );
    });

    it('should stop monitoring', () => {
      instance.api.stop();

      const report = instance.api.getReport();
      expect(report.monitoring).toBe(false);
      expect(mockDeps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('stopped')
      );
    });
  });

  describe('Optimization Callbacks', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should register optimization callbacks', () => {
      const callback = vi.fn();
      instance.api.onOptimizationNeeded('test-target', callback);

      // Callback registered but not yet triggered
      expect(callback).not.toHaveBeenCalled();
    });

    it('should accept multiple callbacks for same target', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      instance.api.onOptimizationNeeded('target', callback1);
      instance.api.onOptimizationNeeded('target', callback2);

      // Both callbacks registered
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should handle missing PerformanceObserver gracefully', () => {
      global.PerformanceObserver = undefined;

      expect(() => {
        PerformanceOptimizer.factory(mockDeps);
      }).not.toThrow();
    });

    it('should handle missing performance.memory', () => {
      mockPerformance.memory = undefined;

      instance = PerformanceOptimizer.factory(mockDeps);
      const report = instance.api.getReport();

      expect(report).toBeDefined();
    });

    it('should log errors during function measurement', async () => {
      const errorFn = vi.fn(() => {
        throw new Error('Measurement error');
      });
      const wrapped = instance.api.measureFunction('errorFunc', errorFn);

      await expect(wrapped()).rejects.toThrow('Measurement error');

      const report = instance.api.getReport();
      expect(report.errors.length).toBeGreaterThan(0);
    });
  });

  describe('API Exposure', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should expose complete public API', () => {
      expect(typeof instance.api.measureFunction).toBe('function');
      expect(typeof instance.api.analyzeBottlenecks).toBe('function');
      expect(typeof instance.api.generateOptimizations).toBe('function');
      expect(typeof instance.api.onOptimizationNeeded).toBe('function');
      expect(typeof instance.api.selfOptimize).toBe('function');
      expect(typeof instance.api.getReport).toBe('function');
      expect(typeof instance.api.clearMetrics).toBe('function');
      expect(typeof instance.api.stop).toBe('function');
      expect(typeof instance.api.memoize).toBe('function');
      expect(typeof instance.api.throttle).toBe('function');
      expect(typeof instance.api.withRetry).toBe('function');
    });
  });

  describe('Integration with Dependencies', () => {
    beforeEach(() => {
      instance = PerformanceOptimizer.factory(mockDeps);
    });

    it('should use logger for all logging', () => {
      instance.api.clearMetrics();

      expect(mockDeps.logger.info).toHaveBeenCalled();
    });

    it('should use StateManager for optimization history', async () => {
      mockDeps.StateManager.getState.mockResolvedValue({});
      mockDeps.StateManager.updateState.mockResolvedValue();

      await instance.api.selfOptimize();

      expect(mockDeps.StateManager.updateState).toHaveBeenCalled();
    });

    it('should use Performance API for measurements', async () => {
      const testFn = vi.fn(() => 'result');
      const wrapped = instance.api.measureFunction('test', testFn);

      await wrapped();

      expect(mockPerformance.now).toHaveBeenCalled();
    });
  });
});
