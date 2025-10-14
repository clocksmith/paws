// Standardized Agent Logic Pure Helpers Module for REPLOID
// Pure functions for agent reasoning and prompt assembly

const AgentLogicPureHelpers = {
  metadata: {
    id: 'AgentLogicPureHelpers',
    version: '1.0.0',
    dependencies: [],  // No dependencies - pure module
    async: false,
    type: 'pure'
  },
  
  factory: (deps = {}) => {
    const getArtifactListSummaryPure = (allMetaMap) => {
      if (!allMetaMap) return "Error: Artifact metadata map not available.";
      return (
        Object.keys(allMetaMap)
          .map(
            (path) => {
              const meta = allMetaMap[path][0] || {}; // Get first version
              return `* ${path} (Cycle ${meta.latestCycle || 0})`
            }
          )
          .join("\n") || "None"
      );
    };

    const getToolListSummaryPure = (staticTools, dynamicTools, truncFn) => {
      if (!staticTools || !dynamicTools || !truncFn)
        return "Error: Tool lists or truncFn not available.";
      
      const staticToolSummary = staticTools
        .map((t) => `* [S] ${t.name}: ${truncFn(t.description, 60)}`)
        .join("\n");
        
      // Dynamic tools not supported in primordial version, but keeping the arg for future
      const dynamicToolSummary = (dynamicTools || [])
        .map(
          (t) =>
            `* [D] ${t.declaration.name}: ${truncFn(
              t.declaration.description,
              60
            )}`
        )
        .join("\n");
        
      return (
        [staticToolSummary, dynamicToolSummary].filter((s) => s).join("\n") ||
        "None"
      );
    };

    const assembleCorePromptPure = (
      corePromptTemplate,
      state,
      goalInfo,
      artifactListSummary,
      toolListSummary
    ) => {
      if (!corePromptTemplate) return { error: "Core prompt template missing." };
      
      let prompt = corePromptTemplate
        .replace(/\[\[CYCLE_COUNT\]\]/g, String(state.totalCycles))
        .replace(/\[\[TOOL_LIST\]\]/g, toolListSummary)
        .replace(/\[\[ARTIFACT_LIST\]\]/g, artifactListSummary)
        .replace(/\[\[CUMULATIVE_GOAL\]\]/g, goalInfo.latestGoal || "No goal set.");
        
      return { prompt };
    };

    // Public API
    return {
      getArtifactListSummaryPure,
      getToolListSummaryPure,
      assembleCorePromptPure,
    };
  }
};

// Legacy compatibility wrapper
const AgentLogicPureHelpersModule = (() => {
  return AgentLogicPureHelpers.factory({});
})();

// Export both formats
AgentLogicPureHelpers;
AgentLogicPureHelpersModule;