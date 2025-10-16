# Blueprint 0x00000B: Pure Tool Logic Helpers

**Objective:** To outline the process of converting internal tool definitions into the specific JSON schema required by external LLM APIs using a pure helper module.

**Prerequisites:** `0x00000A`

**Affected Artifacts:** `/modules/tool-runner-pure-helpers.js`, `/modules/tool-runner.js`

---

### 1. The Strategic Imperative

The agent defines its tools using its own internal format (as seen in `/modules/data-tools-static.json`). However, to use the function-calling capabilities of an external LLM like Google Gemini, these tools must be described to the API in a very specific, and potentially verbose, JSON schema. Hardcoding this conversion logic within the main `ToolRunner` or `ApiClient` would be messy and difficult to maintain. A pure helper module provides the ideal, testable location for this complex data transformation logic.

### 2. The Architectural Solution

The `/modules/tool-runner-pure-helpers.js` module will provide a `convertToGeminiFunctionDeclarationPure` function. This function will take a single tool definition object (in the agent's internal format) and return a new object that perfectly matches the structure required by the Gemini API's `functionDeclarations` field.

This involves several layers of pure data mapping:
-   Mapping the tool's `name` and `description`.
-   Recursively converting the `inputSchema` properties from the agent's simple type system (e.g., "string", "integer") to the Gemini API's enum-based type system (e.g., "STRING", "INTEGER").
-   Correctly handling nested objects, arrays, and required fields.

Because this function is pure (its output depends only on its input tool definition object), it can be easily unit-tested to ensure it produces valid schemas for any given tool.

### 3. The Implementation Pathway

1.  **Create Pure Module:** Implement the `/modules/tool-runner-pure-helpers.js` file. It will have no dependencies.
2.  **Implement Conversion Functions:**
    a.  Create a small, internal helper function `mapMcpTypeToGeminiPure` to handle the type string conversion (e.g., "string" -> "STRING").
    b.  Create a recursive function `convertMcpPropertiesToGeminiPure` that iterates through the `properties` of an input schema and builds the corresponding Gemini properties object.
    c.  Create the main exported function `convertToGeminiFunctionDeclarationPure` which orchestrates the process, calling the helper functions to build the final, valid Gemini Function Declaration object.
3.  **Refactor `ToolRunner`:** Modify `/modules/tool-runner.js` to use the new helper. It will inject `ToolRunnerPureHelpers` as a dependency and will have its own `convertToGeminiFunctionDeclaration` method that simply calls the pure version from the helper module. This keeps the `ToolRunner` focused on execution, not schema formatting.