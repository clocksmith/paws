# Blueprint 0x00000A: Tool Runner Engine

**Objective:** To describe the architecture of the engine responsible for executing the agent's static and dynamic tools, providing a bridge between the LLM's intent and tangible actions.

**Prerequisites:** `0x000003`, `0x000004`, `0x000005`, `0x00000B`, `0x00000C`

**Affected Artifacts:** `/modules/tool-runner.js`

---

### 1. The Strategic Imperative

An LLM's output is just text. To affect its environment, an agent needs a mechanism to interpret the LLM's desire to perform an action and translate that into actual function execution. The `ToolRunner` module serves as this critical bridge. It is a secure dispatcher that takes a tool name and arguments (as specified by the LLM) and executes the corresponding code, returning the result to the agent's cognitive cycle.

### 2. The Architectural Solution

The `/modules/tool-runner.js` will export a primary `runTool` function. This function acts as a central dispatcher.

1.  **Tool Identification:** It first checks if the requested `toolName` corresponds to a "static" tool. Static tools are built-in, trusted functions whose definitions are loaded from the `/modules/data-tools-static.json` artifact.
2.  **Static Tool Execution:** If a static tool is found, a `switch` statement is used to execute the corresponding hardcoded logic. This logic often involves calls to core services like `Storage` or `StateManager` (e.g., the `read_artifact` tool calls `Storage.getArtifactContent`).
3.  **Dynamic Tool Execution (Future):** The architecture will be designed to be extensible. It will include a path for handling "dynamic" tools, which are tools the agent creates for itself. This logic will involve using the Sandboxed Tool Worker (`/modules/tool-worker.js`) to execute untrusted, agent-generated code securely.
4.  **Error Handling:** The `runTool` function must be robust. If a tool is not found, or if its execution fails, it must throw a specific `ToolError` with detailed context, which can be caught by the `agent-cycle`.

### 3. The Implementation Pathway

1.  **Create Module:** Implement the `ToolRunnerModule` factory function in `/modules/tool-runner.js`.
2.  **Implement `runTool`:**
    a.  The function will accept `toolName` and `toolArgs` as arguments.
    b.  It will load the static tool definitions from the JSON manifest.
    c.  It will use a `switch (toolName)` block to handle the execution of each known static tool.
    d.  The default case for the switch will throw a `ToolError` indicating the tool was not found.
3.  **Implement Gemini Conversion:** Include a `convertToGeminiFunctionDeclaration` function. This function will delegate directly to the `ToolRunnerPureHelpers` module to translate the agent's internal tool format into the schema required by the Google Gemini API's function-calling feature.
4.  **Integration:** The `agent-cycle.js` module will call `ToolRunner.runTool` whenever it receives a `functionCall` response from the `ApiClient`.