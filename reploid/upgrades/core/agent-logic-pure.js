// @blueprint 0x000009 - Explains isolating prompt assembly into a testable, pure helper.
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
    const api = {
      getArtifactListSummaryPure,
      getToolListSummaryPure,
      assembleCorePromptPure,
    };

    // Web Component Widget
    class AgentLogicPureHelpersWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // No cleanup needed for this simple widget
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        return {
          state: 'idle',
          primaryMetric: 'Pure helpers',
          secondaryMetric: 'Stateless',
          lastActivity: null,
          message: 'Pure functions for agent prompt assembly'
        };
      }

      renderPanel() {
        return `
          <h3>◧ Available Helper Functions</h3>
          <div style="margin-top: 12px;">
            <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px;">
              <strong>getArtifactListSummaryPure()</strong>
              <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
                Generate a formatted summary of all artifacts with cycle information
              </div>
            </div>
            <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px;">
              <strong>getToolListSummaryPure()</strong>
              <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
                Generate a formatted summary of static and dynamic tools with truncation
              </div>
            </div>
            <div style="padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px; margin-bottom: 8px;">
              <strong>assembleCorePromptPure()</strong>
              <div style="color: #888; font-size: 0.9em; margin-top: 4px;">
                Assemble the core system prompt with placeholder replacements
              </div>
            </div>
          </div>
          <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
            <strong>ℹ️ Pure Module</strong>
            <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
              This module contains only pure functions for agent reasoning and prompt assembly.
              All functions are deterministic with no side effects.
            </div>
          </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
              color: #ccc;
              font-family: system-ui, -apple-system, sans-serif;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #0ff;
            }

            strong {
              color: #fff;
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('agent-logic-pure-helpers-widget')) {
      customElements.define('agent-logic-pure-helpers-widget', AgentLogicPureHelpersWidget);
    }

    // Widget metadata (not the widget instance)
    const widget = {
      element: 'agent-logic-pure-helpers-widget',
      displayName: 'Agent Logic Helpers (Pure)',
      icon: '⚛',
      category: 'core',
      updateInterval: null
    };

    return { ...api, widget };
  }
};

// Export standardized module
export default AgentLogicPureHelpers;