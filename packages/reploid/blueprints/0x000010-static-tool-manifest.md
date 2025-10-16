# Blueprint 0x000010: Static Tool Manifest

**Objective:** To explain the structure and purpose of the JSON artifact that defines the agent's built-in, static toolset.

**Prerequisites:** `0x00000A`

**Affected Artifacts:** `/modules/data-tools-static.json`, `/modules/tool-runner.js`

---

### 1. The Strategic Imperative

The agent must have a formal, machine-readable way to know which tools it possesses. Hardcoding this list into the `ToolRunner` or `agent-cycle.js` is inflexible and prevents the agent from easily reasoning about its own capabilities. A dedicated manifest file serves as this single source of truth. It allows the agent (and its other modules) to discover the available tools and understand their contracts (name, description, and required arguments).

### 2. The Architectural Solution

The `/modules/data-tools-static.json` artifact will be a JSON file containing an array of tool definition objects. Each object represents one static tool and must adhere to a consistent schema.

**Example Schema for a Tool Definition:**
```json
{
  "name": "read_artifact",
  "description": "Reads and returns the full content of a specific artifact.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": {
        "type": "string",
        "description": "The full VFS path of the artifact."
      }
    },
    "required": ["path"]
  }
}
```
This declarative format is crucial for several reasons:
-   **Discovery:** The agent can use its `read_artifact` tool on this file to learn about its own capabilities.
-   **Prompt Injection:** The list of tools can be easily formatted and injected into the system prompt, ensuring the LLM knows which functions it can call.
-   **API Conversion:** The structured `inputSchema` provides all the information needed by the `ToolRunnerPureHelpers` to convert the tool into the specific format required by the Google Gemini API.

### 3. The Implementation Pathway

1.  **Create JSON Artifact:** Create the `/modules/data-tools-static.json` file and populate it with the definitions for the agent's core tools, such as `read_artifact` and `list_artifacts`.
2.  **Modify `ToolRunner`:** The `ToolRunner` module will load and parse this JSON file to get the list of available static tools. Its `switch` statement, which contains the implementation logic, will have a `case` for each `name` defined in the manifest.
3.  **Modify `Agent Cycle`:** The `agent-cycle.js` module will also load this file. It will pass the list of tool definitions to the `ToolRunnerPureHelpers` to generate the schemas for the API call, and to the `AgentLogicPureHelpers` to generate the summary for the system prompt.
4.  **Self-Improvement:** To add a new tool, the agent would need to modify *both* this JSON manifest and the `ToolRunner`'s implementation logic. This blueprint makes the first part of that process clear.