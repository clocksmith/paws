/**
 * Unit tests for MultiModelPaxos module
 * @blueprint 0x000064
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MultiModelPaxos Module', () => {
  let MultiModelPaxos;
  let mockDeps;
  let moduleInstance;

  beforeEach(async () => {
    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        createError: (name, message) => new Error(`${name}: ${message}`)
      },
      EventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      },
      StateManager: {
        api: {
          createSnapshot: vi.fn().mockResolvedValue({
            clone: vi.fn().mockReturnThis(),
            solutionCode: null
          })
        }
      },
      HybridLLMProvider: {
        api: {
          generateWithModel: vi.fn()
        }
      },
      VerificationManager: {
        api: {
          verify: vi.fn()
        }
      },
      DIContainer: {
        resolve: vi.fn()
      }
    };

    // Load module dynamically
    const module = await import('../../upgrades/multi-model-paxos.js');
    MultiModelPaxos = module.default;

    // Create instance
    moduleInstance = MultiModelPaxos.factory(mockDeps);
  });

  afterEach(() => {
    if (moduleInstance.api.cleanup) {
      moduleInstance.api.cleanup();
    }
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(MultiModelPaxos.metadata).toBeDefined();
      expect(MultiModelPaxos.metadata.id).toBe('MultiModelPaxos');
      expect(MultiModelPaxos.metadata.version).toBe('1.0.0');
      expect(MultiModelPaxos.metadata.type).toBe('rsi');
      expect(MultiModelPaxos.metadata.async).toBe(true);
    });

    it('should declare all required dependencies', () => {
      const deps = MultiModelPaxos.metadata.dependencies;
      expect(deps).toContain('Utils');
      expect(deps).toContain('EventBus');
      expect(deps).toContain('StateManager');
      expect(deps).toContain('HybridLLMProvider');
      expect(deps).toContain('VerificationManager');
      expect(deps).toContain('DIContainer');
    });
  });

  describe('Module Initialization', () => {
    it('should initialize successfully', () => {
      expect(() => moduleInstance.init()).not.toThrow();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initialized successfully')
      );
    });

    it('should emit ready event on initialization', () => {
      moduleInstance.init();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:ready',
        expect.objectContaining({ timestamp: expect.any(Number) })
      );
    });
  });

  describe('API Surface', () => {
    it('should expose required API methods', () => {
      expect(moduleInstance.api).toBeDefined();
      expect(typeof moduleInstance.api.runCompetition).toBe('function');
      expect(typeof moduleInstance.api.generateSolution).toBe('function');
      expect(typeof moduleInstance.api.verifySolution).toBe('function');
      expect(typeof moduleInstance.api.scoreSolution).toBe('function');
      expect(typeof moduleInstance.api.selectWinner).toBe('function');
      expect(typeof moduleInstance.api.getActiveCompetition).toBe('function');
      expect(typeof moduleInstance.api.getCompetitionHistory).toBe('function');
      expect(typeof moduleInstance.api.getStats).toBe('function');
      expect(typeof moduleInstance.api.clearHistory).toBe('function');
      expect(typeof moduleInstance.api.emitTelemetry).toBe('function');
    });
  });

  describe('Solution Generation', () => {
    it('should generate solution with HybridLLMProvider', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '## Implementation\n```javascript\nconst test = 42;\n```\n## Tests\n```javascript\nassert(test === 42);\n```',
        usage: { tokens: 100 }
      });

      const solution = await moduleInstance.api.generateSolution(
        'Test objective',
        'gemini-2.0-flash-exp',
        {}
      );

      expect(solution).toBeDefined();
      expect(solution.model).toBe('gemini-2.0-flash-exp');
      expect(solution.code).toContain('const test = 42');
      expect(solution.tests).toContain('assert');
      expect(solution.failed).toBe(false);
      expect(solution.metadata).toBeDefined();
      expect(solution.metadata.duration).toBeGreaterThan(0);
    });

    it('should handle generation errors gracefully', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockRejectedValue(
        new Error('API error')
      );

      const solution = await moduleInstance.api.generateSolution(
        'Test objective',
        'test-model',
        {}
      );

      expect(solution.failed).toBe(true);
      expect(solution.error).toBe('API error');
      expect(solution.model).toBe('test-model');
    });

    it('should extract code from markdown sections', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '## Implementation\n```javascript\nfunction foo() { return "bar"; }\n```',
        usage: { tokens: 50 }
      });

      const solution = await moduleInstance.api.generateSolution(
        'Test',
        'test-model',
        {}
      );

      expect(solution.code).toBe('function foo() { return "bar"; }');
    });

    it('should extract tests from markdown sections', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '## Tests\n```javascript\nexpect(foo()).toBe("bar");\n```',
        usage: { tokens: 50 }
      });

      const solution = await moduleInstance.api.generateSolution(
        'Test',
        'test-model',
        {}
      );

      expect(solution.tests).toBe('expect(foo()).toBe("bar");');
    });
  });

  describe('Solution Verification', () => {
    it('should verify solution using VerificationManager', async () => {
      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [{ test: 'test1', passed: true }],
        errors: [],
        duration: 100
      });

      const solution = {
        model: 'test-model',
        code: 'const x = 1;',
        tests: 'expect(x).toBe(1);',
        failed: false
      };

      const result = await moduleInstance.api.verifySolution(
        solution,
        'test function',
        {}
      );

      expect(result.passed).toBe(true);
      expect(result.testResults).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
      expect(result.duration).toBe(100);
    });

    it('should handle verification errors', async () => {
      mockDeps.VerificationManager.api.verify.mockRejectedValue(
        new Error('Verification failed')
      );

      const solution = {
        model: 'test-model',
        code: 'invalid code',
        failed: false
      };

      const result = await moduleInstance.api.verifySolution(
        solution,
        'test',
        {}
      );

      expect(result.passed).toBe(false);
      expect(result.errors).toContain('Verification failed');
    });
  });

  describe('Solution Scoring', () => {
    it('should score passing solution highly', () => {
      const solution = {
        model: 'test',
        code: 'const test = 42; // Good code with comments',
        verification: { passed: true },
        metadata: { duration: 1000 },
        failed: false
      };

      const score = moduleInstance.api.scoreSolution(solution);

      expect(score).toBeGreaterThan(0.6); // At least 60% for passing
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should score failed solution as 0', () => {
      const solution = {
        failed: true
      };

      const score = moduleInstance.api.scoreSolution(solution);
      expect(score).toBe(0);
    });

    it('should score failing tests lower', () => {
      const solution = {
        model: 'test',
        code: 'const x = 1;',
        verification: { passed: false },
        metadata: { duration: 1000 },
        failed: false
      };

      const score = moduleInstance.api.scoreSolution(solution);
      expect(score).toBeLessThan(0.6); // Less than 60% if tests fail
    });

    it('should consider code quality in scoring', () => {
      const goodSolution = {
        model: 'test',
        code: '/** JSDoc comment */\nconst test = async () => {\n  try {\n    // Good code\n  } catch (e) {\n    // Error handling\n  }\n};',
        verification: { passed: true },
        metadata: { duration: 1000 },
        failed: false
      };

      const poorSolution = {
        model: 'test',
        code: 'x=1',
        verification: { passed: true },
        metadata: { duration: 1000 },
        failed: false
      };

      const goodScore = moduleInstance.api.scoreSolution(goodSolution);
      const poorScore = moduleInstance.api.scoreSolution(poorSolution);

      expect(goodScore).toBeGreaterThan(poorScore);
    });
  });

  describe('Winner Selection', () => {
    it('should select highest scoring solution', () => {
      const solutions = [
        { model: 'model1', score: 0.7, failed: false },
        { model: 'model2', score: 0.9, failed: false },
        { model: 'model3', score: 0.5, failed: false }
      ];

      const winner = moduleInstance.api.selectWinner(solutions);

      expect(winner).toBeDefined();
      expect(winner.model).toBe('model2');
      expect(winner.score).toBe(0.9);
    });

    it('should filter out failed solutions', () => {
      const solutions = [
        { model: 'model1', score: 0.7, failed: false },
        { model: 'model2', score: 0.9, failed: true },
        { model: 'model3', score: 0.5, failed: false }
      ];

      const winner = moduleInstance.api.selectWinner(solutions);

      expect(winner.model).toBe('model1');
    });

    it('should return null if no valid solutions', () => {
      const solutions = [
        { model: 'model1', score: 0, failed: true },
        { model: 'model2', score: 0, failed: true }
      ];

      const winner = moduleInstance.api.selectWinner(solutions);

      expect(winner).toBeNull();
    });
  });

  describe('Competition Flow', () => {
    beforeEach(() => {
      // Mock successful generation
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '## Implementation\n```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });

      // Mock successful verification
      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });
    });

    it('should run complete competition successfully', async () => {
      const result = await moduleInstance.api.runCompetition(
        'Test objective',
        {
          models: ['model1', 'model2'],
          timeout: 5000
        }
      );

      expect(result).toBeDefined();
      expect(result.solutions).toHaveLength(2);
      expect(result.winner).toBeDefined();
      expect(result.telemetry).toBeDefined();
    });

    it('should emit progress events during competition', async () => {
      await moduleInstance.api.runCompetition('Test', {
        models: ['model1', 'model2']
      });

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:competition_start',
        expect.any(Object)
      );

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:progress',
        expect.objectContaining({
          progress: expect.any(Number)
        })
      );

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:competition_complete',
        expect.any(Object)
      );
    });

    it('should create VFS snapshot before competition', async () => {
      await moduleInstance.api.runCompetition('Test', {
        models: ['model1']
      });

      expect(mockDeps.StateManager.api.createSnapshot).toHaveBeenCalled();
    });

    it('should update statistics after competition', async () => {
      const statsBefore = moduleInstance.api.getStats();

      await moduleInstance.api.runCompetition('Test', {
        models: ['model1']
      });

      const statsAfter = moduleInstance.api.getStats();

      expect(statsAfter.totalCompetitions).toBe(statsBefore.totalCompetitions + 1);
      expect(statsAfter.totalSolutions).toBeGreaterThan(statsBefore.totalSolutions);
    });

    it('should add competition to history', async () => {
      const historyBefore = moduleInstance.api.getCompetitionHistory();

      await moduleInstance.api.runCompetition('Test', {
        models: ['model1']
      });

      const historyAfter = moduleInstance.api.getCompetitionHistory();

      expect(historyAfter.length).toBe(historyBefore.length + 1);
      expect(historyAfter[0].objective).toBe('Test');
    });

    it('should handle competition errors gracefully', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockRejectedValue(
        new Error('Generation failed')
      );

      await expect(
        moduleInstance.api.runCompetition('Test', { models: ['model1'] })
      ).rejects.toThrow();

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:competition_error',
        expect.objectContaining({ error: expect.any(String) })
      );
    });

    it('should use default models if not specified', async () => {
      await moduleInstance.api.runCompetition('Test');

      // Should call generateWithModel at least once
      expect(mockDeps.HybridLLMProvider.api.generateWithModel).toHaveBeenCalled();
    });
  });

  describe('History Management', () => {
    it('should clear competition history', async () => {
      // Run a competition to create history
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });
      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });

      await moduleInstance.api.runCompetition('Test', { models: ['model1'] });

      expect(moduleInstance.api.getCompetitionHistory().length).toBeGreaterThan(0);

      moduleInstance.api.clearHistory();

      expect(moduleInstance.api.getCompetitionHistory().length).toBe(0);
    });

    it('should limit history to 50 entries', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });
      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });

      // Run 60 competitions
      for (let i = 0; i < 60; i++) {
        await moduleInstance.api.runCompetition(`Test ${i}`, { models: ['model1'] });
      }

      const history = moduleInstance.api.getCompetitionHistory();
      expect(history.length).toBe(50);
    });
  });

  describe('Telemetry', () => {
    it('should emit telemetry to EventBus', () => {
      moduleInstance.api.emitTelemetry('test_event', { data: 'test' });

      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
        'paxos:test_event',
        expect.objectContaining({ data: 'test' })
      );
    });

    it('should emit to PAXA if available', () => {
      const mockPAXA = {
        api: {
          trackEvent: vi.fn()
        }
      };

      mockDeps.DIContainer.resolve.mockReturnValue(mockPAXA);

      moduleInstance.api.emitTelemetry('test_event', { data: 'test' });

      expect(mockPAXA.api.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          category: 'paxos',
          action: 'test_event',
          data: 'test'
        })
      );
    });

    it('should handle PAXA not being available', () => {
      mockDeps.DIContainer.resolve.mockReturnValue(null);

      expect(() => {
        moduleInstance.api.emitTelemetry('test_event', { data: 'test' });
      }).not.toThrow();
    });
  });

  describe('Widget Protocol', () => {
    it('should provide widget configuration', () => {
      expect(moduleInstance.widget).toBeDefined();
      expect(moduleInstance.widget.element).toBe('multi-model-paxos-widget');
      expect(moduleInstance.widget.displayName).toBe('Multi-Model Paxos');
      expect(moduleInstance.widget.icon).toBe('⚔');
      expect(moduleInstance.widget.category).toBe('rsi');
      expect(moduleInstance.widget.visible).toBe(true);
    });

    it('should register custom element', () => {
      // Check that custom element is defined
      expect(customElements.get('multi-model-paxos-widget')).toBeDefined();
    });

    it('should implement getStatus() with required fields', () => {
      // Create widget element
      const widget = document.createElement('multi-model-paxos-widget');
      document.body.appendChild(widget);

      const status = widget.getStatus();

      expect(status).toBeDefined();
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      document.body.removeChild(widget);
    });

    it('should show active state during competition', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              content: '```javascript\nconst x = 1;\n```',
              usage: { tokens: 100 }
            });
          }, 100);
        });
      });

      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });

      const widget = document.createElement('multi-model-paxos-widget');
      document.body.appendChild(widget);

      // Start competition (don't await)
      const competitionPromise = moduleInstance.api.runCompetition('Test', {
        models: ['model1']
      });

      // Check status during competition
      await new Promise(resolve => setTimeout(resolve, 10));
      const status = widget.getStatus();

      expect(status.state).toBe('active');

      await competitionPromise;
      document.body.removeChild(widget);
    });
  });

  describe('Statistics', () => {
    it('should track competition statistics', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });

      mockDeps.VerificationManager.api.verify.mockResolvedValueOnce({
        success: true,
        results: [],
        errors: [],
        duration: 100
      }).mockResolvedValueOnce({
        success: false,
        results: [],
        errors: ['Test failed'],
        duration: 100
      });

      await moduleInstance.api.runCompetition('Test', {
        models: ['model1', 'model2']
      });

      const stats = moduleInstance.api.getStats();

      expect(stats.totalCompetitions).toBe(1);
      expect(stats.totalSolutions).toBe(2);
      expect(stats.totalSuccessful).toBeGreaterThanOrEqual(1);
      expect(stats.winnersByModel).toBeDefined();
    });

    it('should track average duration', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });

      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });

      await moduleInstance.api.runCompetition('Test1', { models: ['model1'] });
      await moduleInstance.api.runCompetition('Test2', { models: ['model1'] });

      const stats = moduleInstance.api.getStats();

      expect(stats.averageDuration).toBeGreaterThan(0);
    });

    it('should track winners by model', async () => {
      mockDeps.HybridLLMProvider.api.generateWithModel.mockResolvedValue({
        content: '```javascript\nconst x = 1;\n```',
        usage: { tokens: 100 }
      });

      mockDeps.VerificationManager.api.verify.mockResolvedValue({
        success: true,
        results: [],
        errors: [],
        duration: 100
      });

      await moduleInstance.api.runCompetition('Test', { models: ['test-model'] });

      const stats = moduleInstance.api.getStats();

      expect(stats.winnersByModel['test-model']).toBeGreaterThan(0);
    });
  });
});
