# Blueprint 0x000001: System Prompt Architecture

**Objective:** To define the structure and philosophy of the agent's core identity prompt, enabling dynamic context injection for state-aware reasoning.

**Prerequisites:** None

**Affected Artifacts:** `/modules/prompt-system.md`, `/modules/agent-cycle.js`, `/modules/agent-logic-pure.js`

---

### 1. The Strategic Imperative

An agent's core prompt is its constitution. A static, hardcoded prompt is inflexible and prevents the agent from reasoning about its own current state. To achieve true self-awareness and adapt its plans, the agent's prompt must be a dynamic template, not a fixed string. This allows it to be populated with real-time information about its goals, available tools, VFS contents, and performance history, providing the LLM with the necessary context for intelligent decision-making.

### 2. The Architectural Solution

The solution is to treat the system prompt as a template artifact (`/modules/prompt-system.md`) containing clearly defined placeholders. A dedicated pure helper module (`agent-logic-pure.js`) will be responsible for assembling the final prompt string. This separates the prompt's structure (the template) from the logic required to populate it (the pure helper).

**Example Placeholder in `prompt-system.md`:**

```markdown
**Current State:**
- Cycle: [[CYCLE_COUNT]]
- Active Goal: [[CUMULATIVE_GOAL]]

**Available Tools:**
[[TOOL_LIST]]
```

The `agent-logic-pure.js` module will contain a function like `assembleCorePromptPure` that takes the template string and state data, and returns the final, populated prompt.

### 3. The Implementation Pathway

1.  **Create Template:** Design the `/modules/prompt-system.md` artifact with logical sections and placeholders for all dynamic data (e.g., `[[CYCLE_COUNT]]`, `[[CUMULATIVE_GOAL]]`, `[[ARTIFACT_LIST]]`).
2.  **Implement Pure Assembler:** In `/modules/agent-logic-pure.js`, create the `assembleCorePromptPure` function. This function will accept the template content and the current state object as arguments and perform a series of `.replace()` operations to inject the data into the placeholders.
3.  **Integrate into Cycle:** Modify `/modules/agent-cycle.js`. In the `executeCycle` function, before calling the API, it must:
    a.  Fetch the system prompt template from the VFS using `Storage.getArtifactContent()`.
    b.  Gather all necessary data from the `StateManager`.
    c.  Call the `assembleCorePromptPure` helper function to create the final prompt.
    d.  Use this dynamically generated prompt for the API call.