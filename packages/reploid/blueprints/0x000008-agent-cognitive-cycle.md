# Blueprint 0x000008: Agent Cognitive Cycle

**Objective:** To provide the architectural model for the agent's primary "think-act" loop, which orchestrates the entire process of receiving a goal, reasoning, and executing a plan.

**Prerequisites:** `0x000001`, `0x000005`, `0x000007`, `0x00000A`

**Affected Artifacts:** `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

The agent's "mind" is not a single function but a structured, cyclical process. This process must be clearly defined to ensure predictable, repeatable, and logical behavior. The `agent-cycle.js` module serves as the implementation of this cognitive cycle. It acts as the central conductor, invoking all other services (State, API, Tools) in the correct order to move from a high-level goal to a concrete set of actions.

### 2. The Architectural Solution

The `executeCycle` function within `/modules/agent-cycle.js` will implement a clear, multi-step cognitive process. While future blueprints will add more steps, the primordial version includes:

1.  **Goal Ingestion:** The cycle begins by getting the current goal from the `StateManager`.
2.  **Context Assembly (Think):** It gathers all necessary information to form a coherent prompt. This involves calling `AgentLogicPureHelpers.assembleCorePromptPure` with the goal, a list of VFS artifacts, and a list of available tools.
3.  **LLM Interaction (Reason):** It passes the assembled prompt to the `ApiClient` to get a plan from the LLM. This phase may involve multiple back-and-forth calls if the LLM decides to use tools. The cycle is responsible for managing this "tool loop," calling the `ToolRunner` and feeding the results back to the LLM.
4.  **Plan Execution (Act):** Once the LLM returns a final plan containing `artifact_changes`, the cycle passes these changes to the `StateManager` to be applied to the VFS. This is the step that makes the agent's self-modification tangible.
5.  **State Finalization:** The cycle concludes by incrementing the cycle count in the `StateManager` and updating the UI to reflect the new state.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `CycleLogicModule` factory function in `/modules/agent-cycle.js`.
2.  **Implement `executeCycle`:** Build out the core `executeCycle` function, ensuring it follows the logical steps outlined above. It must be an `async` function to handle `await`ing results from the `ApiClient` and `ToolRunner`.
3.  **Implement Helper Functions:** Create private helper functions within the module to encapsulate specific logic, such as `_assembleCorePromptContext`, `_handleToolExecution`, and `_applyLLMChanges`.
4.  **Error and Abort Handling:** Wrap the entire `executeCycle` logic in a `try...catch...finally` block. The `catch` block should handle any errors thrown by sub-modules (like `ApiError` or `ToolError`) and log them appropriately. The `finally` block must ensure the agent's state is always set back to "not running." The logic must also check an `_abortRequested` flag periodically to allow for clean user-initiated cancellation.