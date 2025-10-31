// @blueprint 0x000006 - Articulates separating deterministic state calculations into a pure helper.
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
    const api = {
      calculateDerivedStatsPure,
      validateStateStructurePure,
      mergeWithDefaultsPure,
    };

    // Web Component widget
    class StateHelpersPureWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // No cleanup needed for static widget
      }

      getStatus() {
        return {
          state: 'idle',
          primaryMetric: 'Pure utilities',
          secondaryMetric: 'Stateless',
          lastActivity: null,
          message: 'Pure helper functions for state operations'
        };
      }

      getControls() {
        return [];
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }

            .widget-panel {
              padding: 12px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            .function-item {
              padding: 8px;
              background: rgba(255,255,255,0.05);
              border-radius: 4px;
              margin-bottom: 8px;
            }

            .function-item strong {
              color: #fff;
              font-size: 0.95em;
            }

            .function-desc {
              color: #888;
              font-size: 0.9em;
              margin-top: 4px;
            }

            .info-box {
              margin-top: 16px;
              padding: 12px;
              background: rgba(100,150,255,0.1);
              border-left: 3px solid #6496ff;
              border-radius: 4px;
            }

            .info-box strong {
              color: #fff;
            }

            .info-box div {
              margin-top: 6px;
              color: #aaa;
              font-size: 0.9em;
            }
          </style>

          <div class="widget-panel">
            <h3>◧ Available Helper Functions</h3>
            <div style="margin-top: 12px;">
              <div class="function-item">
                <strong>calculateDerivedStatsPure()</strong>
                <div class="function-desc">
                  Calculate derived statistics from history arrays
                </div>
              </div>
              <div class="function-item">
                <strong>validateStateStructurePure()</strong>
                <div class="function-desc">
                  Validate state object structure and required properties
                </div>
              </div>
              <div class="function-item">
                <strong>mergeWithDefaultsPure()</strong>
                <div class="function-desc">
                  Merge loaded state with default values
                </div>
              </div>
            </div>
            <div class="info-box">
              <strong>ⓘ Pure Module</strong>
              <div>
                This module contains only pure functions with no internal state.
                All functions are deterministic and side-effect free.
              </div>
            </div>
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('state-helpers-pure-widget')) {
      customElements.define('state-helpers-pure-widget', StateHelpersPureWidget);
    }

    // Widget interface
    const widget = {
      element: 'state-helpers-pure-widget',
      displayName: 'State Helpers (Pure)',
      icon: '⚎',
      category: 'core',
      updateInterval: null
    };

    return { ...api, widget };
  }
};

// Export module definition for DI container
export default StateHelpersPure;
export const StateHelpersPureModule = StateHelpersPure;
