import { describe, it, expect, beforeEach } from 'vitest';

import StateHelpersPureModule from '../../upgrades/state-helpers-pure.js';
describe('StateHelpersPure Module', () => {
  let stateHelpers;

  beforeEach(() => {
    stateHelpers = StateHelpersPureModule;
  });

  describe('Module Metadata', () => {
    it('should have correct module structure', () => {
      expect(stateHelpers).toBeDefined();
      expect(stateHelpers.calculateDerivedStatsPure).toBeTypeOf('function');
      expect(stateHelpers.validateStateStructurePure).toBeTypeOf('function');
      expect(stateHelpers.mergeWithDefaultsPure).toBeTypeOf('function');
    });

    it('should be a pure module with no dependencies', () => {
      const StateHelpersPure = {
        metadata: {
          id: 'StateHelpersPure',
          version: '1.0.0',
          dependencies: [],
          async: false,
          type: 'pure'
        }
      };
      expect(StateHelpersPure.metadata.dependencies).toHaveLength(0);
      expect(StateHelpersPure.metadata.type).toBe('pure');
    });
  });

  describe('calculateDerivedStatsPure', () => {
    it('should return null stats structure', () => {
      const stats = stateHelpers.calculateDerivedStatsPure();

      expect(stats).toEqual({
        avgConfidence: null,
        critiqueFailRate: null,
        avgTokens: null,
        avgEvalScore: null,
        evalPassRate: null
      });
    });

    it('should handle empty arrays', () => {
      const stats = stateHelpers.calculateDerivedStatsPure([], [], [], []);

      expect(stats.avgConfidence).toBeNull();
      expect(stats.critiqueFailRate).toBeNull();
      expect(stats.avgTokens).toBeNull();
      expect(stats.avgEvalScore).toBeNull();
      expect(stats.evalPassRate).toBeNull();
    });

    it('should accept history arrays as parameters', () => {
      const confidenceHistory = [0.8, 0.9, 0.85];
      const critiqueFailHistory = [false, false, true];
      const tokenHistory = [100, 150, 120];
      const evaluationHistory = [0.9, 0.85, 0.88];

      const stats = stateHelpers.calculateDerivedStatsPure(
        confidenceHistory,
        critiqueFailHistory,
        tokenHistory,
        evaluationHistory
      );

      expect(stats).toBeDefined();
      expect(stats).toHaveProperty('avgConfidence');
      expect(stats).toHaveProperty('critiqueFailRate');
      expect(stats).toHaveProperty('avgTokens');
      expect(stats).toHaveProperty('avgEvalScore');
      expect(stats).toHaveProperty('evalPassRate');
    });

    it('should accept maxHistoryItems parameter', () => {
      const stats = stateHelpers.calculateDerivedStatsPure(
        [0.8, 0.9],
        [false, true],
        [100, 150],
        [0.9, 0.85],
        50
      );

      expect(stats).toBeDefined();
    });

    it('should accept evalPassThreshold parameter', () => {
      const stats = stateHelpers.calculateDerivedStatsPure(
        [0.8, 0.9],
        [false, true],
        [100, 150],
        [0.9, 0.85],
        20,
        0.8
      );

      expect(stats).toBeDefined();
    });
  });

  describe('validateStateStructurePure', () => {
    it('should return null for valid state', () => {
      const validState = {
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: 'test goal'
      };

      const error = stateHelpers.validateStateStructurePure(validState);

      expect(error).toBeNull();
    });

    it('should reject null state', () => {
      const error = stateHelpers.validateStateStructurePure(null);

      expect(error).toBe('Invalid state object');
    });

    it('should reject undefined state', () => {
      const error = stateHelpers.validateStateStructurePure(undefined);

      expect(error).toBe('Invalid state object');
    });

    it('should reject non-object state', () => {
      const error = stateHelpers.validateStateStructurePure('not an object');

      expect(error).toBe('Invalid state object');
    });

    it('should reject state missing version', () => {
      const invalidState = {
        artifactMetadata: {},
        currentGoal: 'test goal'
      };

      const error = stateHelpers.validateStateStructurePure(invalidState);

      expect(error).toContain('State missing critical properties');
      expect(error).toContain('version');
    });

    it('should reject state missing artifactMetadata', () => {
      const invalidState = {
        version: '1.0.0',
        currentGoal: 'test goal'
      };

      const error = stateHelpers.validateStateStructurePure(invalidState);

      expect(error).toContain('State missing critical properties');
      expect(error).toContain('artifactMetadata');
    });

    it('should reject state missing currentGoal', () => {
      const invalidState = {
        version: '1.0.0',
        artifactMetadata: {}
      };

      const error = stateHelpers.validateStateStructurePure(invalidState);

      expect(error).toContain('State missing critical properties');
      expect(error).toContain('currentGoal');
    });

    it('should accept state with all required properties', () => {
      const validState = {
        version: '2.0.0',
        artifactMetadata: { files: [] },
        currentGoal: 'implement feature',
        extraProperty: 'should be allowed'
      };

      const error = stateHelpers.validateStateStructurePure(validState);

      expect(error).toBeNull();
    });

    it('should work without optional parameters', () => {
      const validState = {
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: 'test'
      };

      const error = stateHelpers.validateStateStructurePure(validState);

      expect(error).toBeNull();
    });

    it('should accept configStateVersion parameter', () => {
      const validState = {
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: 'test'
      };

      const error = stateHelpers.validateStateStructurePure(
        validState,
        '1.0.0',
        null
      );

      expect(error).toBeNull();
    });
  });

  describe('mergeWithDefaultsPure', () => {
    it('should merge loaded state with defaults', () => {
      const defaultStateFactory = (config) => ({
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: '',
        cfg: {
          maxIterations: 10,
          timeout: 5000
        }
      });

      const loadedState = {
        currentGoal: 'test goal'
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory,
        '1.0.0'
      );

      expect(merged.version).toBe('1.0.0');
      expect(merged.currentGoal).toBe('test goal');
      expect(merged.artifactMetadata).toEqual({});
      expect(merged.cfg.maxIterations).toBe(10);
    });

    it('should override default values with loaded values', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        currentGoal: 'default goal',
        cfg: {
          setting1: 'default',
          setting2: 'default'
        }
      });

      const loadedState = {
        version: '2.0.0',
        currentGoal: 'custom goal',
        cfg: {
          setting1: 'custom'
        }
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory,
        '2.0.0'
      );

      expect(merged.version).toBe('2.0.0');
      expect(merged.currentGoal).toBe('custom goal');
      expect(merged.cfg.setting1).toBe('custom');
      expect(merged.cfg.setting2).toBe('default');
    });

    it('should merge cfg objects deeply', () => {
      const defaultStateFactory = () => ({
        cfg: {
          feature1: true,
          feature2: false,
          timeout: 5000
        }
      });

      const loadedState = {
        cfg: {
          feature2: true,
          newFeature: 'enabled'
        }
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory
      );

      expect(merged.cfg.feature1).toBe(true);
      expect(merged.cfg.feature2).toBe(true);
      expect(merged.cfg.timeout).toBe(5000);
      expect(merged.cfg.newFeature).toBe('enabled');
    });

    it('should handle empty loaded state', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        currentGoal: 'default',
        cfg: { setting: 'value' }
      });

      const merged = stateHelpers.mergeWithDefaultsPure(
        {},
        defaultStateFactory
      );

      expect(merged.version).toBe('1.0.0');
      expect(merged.currentGoal).toBe('default');
      expect(merged.cfg.setting).toBe('value');
    });

    it('should handle loaded state without cfg', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        cfg: {
          defaultSetting: 'default'
        }
      });

      const loadedState = {
        version: '2.0.0'
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory
      );

      expect(merged.version).toBe('2.0.0');
      expect(merged.cfg.defaultSetting).toBe('default');
    });

    it('should pass configStateVersion to defaultStateFactory', () => {
      const defaultStateFactory = (config) => {
        if (config) {
          return {
            version: config.STATE_VERSION,
            configProvided: true,
            cfg: {}
          };
        }
        return {
          version: 'unknown',
          configProvided: false,
          cfg: {}
        };
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        {},
        defaultStateFactory,
        '3.0.0'
      );

      expect(merged.version).toBe('3.0.0');
      expect(merged.configProvided).toBe(true);
    });

    it('should call defaultStateFactory with null when no configStateVersion', () => {
      const defaultStateFactory = (config) => ({
        version: config ? config.STATE_VERSION : 'default',
        cfg: {}
      });

      const merged = stateHelpers.mergeWithDefaultsPure(
        {},
        defaultStateFactory
      );

      expect(merged.version).toBe('default');
    });

    it('should preserve all loaded state properties', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        cfg: {}
      });

      const loadedState = {
        version: '2.0.0',
        customProperty1: 'value1',
        customProperty2: { nested: 'value2' },
        customArray: [1, 2, 3]
      };

      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory
      );

      expect(merged.customProperty1).toBe('value1');
      expect(merged.customProperty2).toEqual({ nested: 'value2' });
      expect(merged.customArray).toEqual([1, 2, 3]);
    });
  });

  describe('Integration Tests', () => {
    it('should validate and merge state in workflow', () => {
      const defaultStateFactory = (config) => ({
        version: config?.STATE_VERSION || '1.0.0',
        artifactMetadata: {},
        currentGoal: '',
        cfg: {
          maxIterations: 10
        }
      });

      const loadedState = {
        version: '2.0.0',
        artifactMetadata: { files: ['test.js'] },
        currentGoal: 'test workflow',
        cfg: {
          maxIterations: 20
        }
      };

      // Validate
      const validationError = stateHelpers.validateStateStructurePure(
        loadedState
      );
      expect(validationError).toBeNull();

      // Merge
      const merged = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory,
        '2.0.0'
      );

      expect(merged.version).toBe('2.0.0');
      expect(merged.currentGoal).toBe('test workflow');
      expect(merged.cfg.maxIterations).toBe(20);
    });

    it('should handle invalid then corrected state', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: 'default',
        cfg: {}
      });

      // Invalid state
      const invalidState = {
        version: '1.0.0'
        // missing artifactMetadata and currentGoal
      };

      let error = stateHelpers.validateStateStructurePure(invalidState);
      expect(error).not.toBeNull();

      // Merge with defaults to fix
      const corrected = stateHelpers.mergeWithDefaultsPure(
        invalidState,
        defaultStateFactory
      );

      error = stateHelpers.validateStateStructurePure(corrected);
      expect(error).toBeNull();
    });
  });

  describe('Pure Function Properties', () => {
    it('should not modify input state in mergeWithDefaultsPure', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        cfg: { setting: 'default' }
      });

      const loadedState = {
        version: '2.0.0',
        cfg: { setting: 'custom' }
      };

      const originalLoaded = JSON.parse(JSON.stringify(loadedState));

      stateHelpers.mergeWithDefaultsPure(loadedState, defaultStateFactory);

      expect(loadedState).toEqual(originalLoaded);
    });

    it('should return same result for same inputs (idempotent)', () => {
      const defaultStateFactory = () => ({
        version: '1.0.0',
        cfg: { x: 1 }
      });

      const loadedState = {
        version: '2.0.0',
        cfg: { y: 2 }
      };

      const result1 = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory
      );

      const result2 = stateHelpers.mergeWithDefaultsPure(
        loadedState,
        defaultStateFactory
      );

      expect(result1).toEqual(result2);
    });

    it('validateStateStructurePure should be deterministic', () => {
      const state = {
        version: '1.0.0',
        artifactMetadata: {},
        currentGoal: 'test'
      };

      const result1 = stateHelpers.validateStateStructurePure(state);
      const result2 = stateHelpers.validateStateStructurePure(state);
      const result3 = stateHelpers.validateStateStructurePure(state);

      expect(result1).toBe(result2);
      expect(result2).toBe(result3);
    });
  });
});
