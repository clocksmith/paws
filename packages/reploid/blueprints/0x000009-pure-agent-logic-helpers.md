# Blueprint 0x000009: Pure Agent Logic Helpers

**Objective:** To explain how to isolate complex prompt assembly and other deterministic reasoning logic into a testable, pure helper module.

**Target Upgrade:** AGLP (`agent-logic-pure.js`)


**Prerequisites:** `0x000001`, **0x00004E** (Module Widget Protocol)

**Affected Artifacts:** `/modules/agent-logic-pure.js`, `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

The process of assembling the final prompt for the LLM is a complex data transformation task. It involves fetching data from various sources (state, VFS metadata, tool lists), formatting it, truncating it, and injecting it into a template. Placing this complex string manipulation logic directly inside the main `agent-cycle.js` module would clutter it and mix pure data transformation with effectful I/O and state management code. This makes the code harder to test and debug. A dedicated pure helper module provides a clean, isolated, and testable home for this logic.

### 2. The Architectural Solution

The `/modules/agent-logic-pure.js` module will export a collection of pure functions. These functions will take raw data (as strings or simple objects) as input and return a transformed string or object as output. They will have no dependencies on other agent modules and perform no side effects.

**Key Functions:**
-   `getArtifactListSummaryPure(allMetaMap)`: Takes a map of artifact metadata and returns a formatted markdown string listing the artifacts.
-   `getToolListSummaryPure(staticTools, dynamicTools, truncFn)`: Takes tool definitions and returns a formatted markdown string summarizing them.
-   `assembleCorePromptPure(template, state, goal, ...)`: The main function. It takes the prompt template string and all the necessary data components and returns the final, fully-populated prompt string ready for the API.

**Widget Interface (Web Component):**

The module exposes a `AgentLogicPureHelpersWidget` custom element for dashboard visualization:

```javascript
class AgentLogicPureHelpersWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // No auto-refresh needed - pure module has no changing state
  }

  disconnectedCallback() {
    // No cleanup needed
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

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .pure-helpers-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .function-list { margin-top: 8px; }
        .function-item { padding: 4px; margin: 4px 0; background: rgba(0, 255, 0, 0.1); }
        .badge { background: #0a0; color: #000; padding: 2px 6px; border-radius: 4px; font-size: 10px; }
      </style>
      <div class="pure-helpers-panel">
        <h4>🔧 Agent Logic Pure Helpers</h4>
        <div><span class="badge">PURE</span> No side effects, deterministic</div>
        <div class="function-list">
          <div class="function-item">
            <strong>getArtifactListSummaryPure()</strong>
            <div style="font-size: 10px; color: #888;">Formats artifact metadata as markdown</div>
          </div>
          <div class="function-item">
            <strong>getToolListSummaryPure()</strong>
            <div style="font-size: 10px; color: #888;">Summarizes available tools</div>
          </div>
          <div class="function-item">
            <strong>assembleCorePromptPure()</strong>
            <div style="font-size: 10px; color: #888;">Assembles complete LLM prompt</div>
          </div>
        </div>
      </div>
    `;
  }
}

customElements.define('agent-logic-pure-helpers-widget', AgentLogicPureHelpersWidget);
```

This provides a static documentation panel listing:
- Available pure functions (getArtifactListSummaryPure, getToolListSummaryPure, assembleCorePromptPure)
- Function signatures and descriptions
- Pure module badge (no side effects, deterministic)

Since this is a pure module with no internal state, the widget does not need auto-refresh and always displays status as 'idle'.

### 3. The Implementation Pathway

1.  **Create Pure Module:** Implement the `/modules/agent-logic-pure.js` file as a dependency-free module.
2.  **Define Pure Functions:** Implement the prompt-building helper functions. They should perform all necessary string formatting, truncation, and replacement operations.
3.  **Refactor Agent Cycle:** Modify `/modules/agent-cycle.js` to use the new helper.
    a.  Inject `AgentLogicPureHelpers` as a dependency.
    b.  In the `_assembleCorePromptContext` helper function, instead of performing string manipulation itself, it will first gather all the raw data (from `StateManager`, `Storage`, etc.).
    c.  It will then pass this raw data and the prompt template to the `AgentLogicPureHelpers.assembleCorePromptPure` function.
    d.  The return value of this pure function is the final prompt.
    This refactoring makes the `agent-cycle`'s role simpler: it's responsible for *gathering* data, while the pure helper is responsible for *formatting* it.