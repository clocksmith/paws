# Blueprint 0x000008: Agent Cognitive Cycle

**Objective:** To provide the architectural model for the agent's primary "think-act" loop, which orchestrates the entire process of receiving a goal, reasoning, and executing a plan.

**Target Upgrade:** CYCL (`agent-cycle.js`)


**Prerequisites:** `0x000001`, `0x000005`, `0x000007`, `0x00000A`

**Affected Artifacts:** `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

The agent's "mind" is not a single function but a structured, cyclical process. This process must be clearly defined to ensure predictable, repeatable, and logical behavior. The `agent-cycle.js` module serves as the implementation of this cognitive cycle. It acts as the central conductor, invoking all other services (State, API, Tools) in the correct order to move from a high-level goal to a concrete set of actions.

### 2. The Architectural Solution

The agent-cycle module implements a finite state machine (FSM) with human-in-the-loop approval gates. The cycle follows these states:

**FSM States:**
```
IDLE → CURATING_CONTEXT → AWAITING_CONTEXT_APPROVAL
  → PLANNING_WITH_CONTEXT → AWAITING_PROPOSAL_APPROVAL
  → APPLYING_CHANGESET → (back to IDLE)
```

**Core Implementation:**

1.  **Event-Driven Transitions:** State transitions are triggered by EventBus events (`user:approve:context`, `user:approve:proposal`, etc.)
2.  **Context Assembly:** Gathers VFS artifacts and blueprints relevant to the goal
3.  **LLM Interaction:** Uses `ApiClient` with tool-loop support for multi-turn reasoning
4.  **Changeset Application:** Applies approved changes via `StateManager`
5.  **Reflection:** Stores cycle outcomes in `ReflectionStore` for learning

**Widget Interface (Web Component):**

The module exposes a `AgentCycleFSMWidget` custom element for dashboard visualization:

```javascript
class AgentCycleFSMWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      <div>/* FSM state, transitions, context */</div>
    `;
  }
}

customElements.define('agent-cycle-fsm-widget', AgentCycleFSMWidget);
```

This provides real-time FSM state visualization, transition history, and current goal context.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `CycleLogicModule` factory function in `/modules/agent-cycle.js`.
2.  **Implement `executeCycle`:** Build out the core `executeCycle` function, ensuring it follows the logical steps outlined above. It must be an `async` function to handle `await`ing results from the `ApiClient` and `ToolRunner`.
3.  **Implement Helper Functions:** Create private helper functions within the module to encapsulate specific logic, such as `_assembleCorePromptContext`, `_handleToolExecution`, and `_applyLLMChanges`.
4.  **Error and Abort Handling:** Wrap the entire `executeCycle` logic in a `try...catch...finally` block. The `catch` block should handle any errors thrown by sub-modules (like `ApiError` or `ToolError`) and log them appropriately. The `finally` block must ensure the agent's state is always set back to "not running." The logic must also check an `_abortRequested` flag periodically to allow for clean user-initiated cancellation.