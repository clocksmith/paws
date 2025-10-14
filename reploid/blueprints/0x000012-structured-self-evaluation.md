# Blueprint 0x000012: Structured Self-Evaluation

**Objective:** To propose a framework for a structured, LLM-driven self-evaluation tool and its integration into the agent's cognitive cycle.

**Prerequisites:** `0x00000A`

**Affected Artifacts:** `/upgrades/tool-evaluator.js`, `/modules/data-tools-static.json`, `/modules/agent-cycle.js`

---

### 1. The Strategic Imperative

For an agent to improve, it must be able to measure its own performance. Simply succeeding or failing at a goal is not enough. A structured self-evaluation mechanism allows the agent to perform a meta-cognitive analysis of its own plans and outputs, asking questions like: "Did my proposed change description accurately reflect the code I generated?" or "How well did this plan align with the original goal?" This creates a rich feedback signal that is essential for sophisticated learning.

### 2. The Architectural Solution

The solution is to create a dedicated `run_self_evaluation` tool. This tool will not be a simple JavaScript function but a self-contained "package" that includes both the tool's definition and the specialized prompt required for it to function.

1.  **Packaged Tool (`/upgrades/tool-evaluator.js`):** This artifact will be a JSON file containing two main keys:
    -   `declaration`: The standard tool definition object, with an `inputSchema` that requires the `contentToEvaluate`, the `criteria` for evaluation, and the `goalContext`.
    -   `prompt`: A string containing a "meta-prompt" template. This prompt will instruct an LLM to act as an objective evaluator, taking the provided content, criteria, and context, and returning a structured JSON response with a score and a report (e.g., `{"evaluation_score": 0.9, "evaluation_report": "The plan is well-aligned..."}`).

2.  **`ToolRunner` Implementation:** The `ToolRunner` will need to be upgraded to handle this new type of packaged tool. When `run_self_evaluation` is called, it will read the `prompt` from the package, populate it with the arguments, and make its own call to the `ApiClient` to get the evaluation.

### 3. The Implementation Pathway

1.  **Create Tool Package:** Create the `/upgrades/tool-evaluator.js` artifact as a JSON file containing the `declaration` and `prompt` keys.
2.  **Update Tool Manifest:** Add the `declaration` part of the tool package to the `/modules/data-tools-static.json` manifest so the agent knows the tool exists.
3.  **Upgrade `ToolRunner`:**
    a.  Add a new `case` to the `switch` statement in `runTool` for `run_self_evaluation`.
    b.  This case's logic will read `/upgrades/tool-evaluator.js`, extract the `prompt` template, populate it with the `toolArgs`, and call the `ApiClient`.
    c.  It will then parse the response from the evaluation LLM call and return the final score and report.
4.  **Integrate into Agent Cycle:** `/modules/agent-cycle.js` can be modified to include a new "Self-Evaluation Step" at the end of the cycle. In this step, it would automatically call the `run_self_evaluation` tool, using its own `proposed_changes_description` as the content to evaluate, and save the resulting score to its state for future analysis.