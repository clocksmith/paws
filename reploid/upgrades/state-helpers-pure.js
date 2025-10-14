// Standardized State Helpers Pure Module for REPLOID
// Pure functions for state validation and manipulation

const StateHelpersPure = {
  metadata: {
    id: 'StateHelpersPure',
    version: '1.0.0',
    dependencies: [],  // No dependencies - pure module
    async: false,
    type: 'pure'
  },
  
  factory: (deps = {}) => {
    const calculateDerivedStatsPure = (
      confidenceHistory = [],
      critiqueFailHistory = [],
      tokenHistory = [],
      evaluationHistory = [],
      maxHistoryItems = 20,
      evalPassThreshold = 0.75
    ) => {
      // This function can be kept for future upgrades, but is not used by the primordial agent.
      const stats = {
        avgConfidence: null,
        critiqueFailRate: null,
        avgTokens: null,
        avgEvalScore: null,
        evalPassRate: null,
      };
      return stats;
    };

    const validateStateStructurePure = (
      stateObj,
      configStateVersion,
      defaultStateFactory
    ) => {
      if (!stateObj || typeof stateObj !== "object")
        return "Invalid state object";
      if (!stateObj.version || !stateObj.artifactMetadata || !stateObj.currentGoal) {
        return "State missing critical properties: version, artifactMetadata, or currentGoal."
      }
      return null;
    };

    const mergeWithDefaultsPure = (
      loadedState,
      defaultStateFactory,
      configStateVersion
    ) => {
      const defaultState = defaultStateFactory(
        configStateVersion
          ? { STATE_VERSION: configStateVersion, DEFAULT_CFG: {} }
          : null
      );
      const mergedState = {
        ...defaultState,
        ...loadedState,
        cfg: { ...defaultState.cfg, ...(loadedState.cfg || {}) },
      };
      return mergedState;
    };

    // Public API
    return {
      calculateDerivedStatsPure,
      validateStateStructurePure,
      mergeWithDefaultsPure,
    };
  }
};

// Legacy compatibility wrapper
const StateHelpersPureModule = (() => {
  return StateHelpersPure.factory({});
})();

// Export both formats
StateHelpersPure;
StateHelpersPureModule;