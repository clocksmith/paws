# Blueprint 0x000003: Core Utilities and Error Handling

**Objective:** To centralize common helper functions and custom error classes into a single, foundational utility module.

**Prerequisites:** None

**Affected Artifacts:** `/modules/utils.js`

---

### 1. The Strategic Imperative

A robust software system avoids code duplication and provides clear, specific error handling. Repeating common logic (like string truncation or DOM selectors) across multiple modules leads to inconsistencies and maintenance burdens. Similarly, relying on generic `Error` objects makes it difficult to distinguish between different types of failures (e.g., an API failure vs. a tool failure). A central utility artifact is essential for code reuse and creating a precise error-handling taxonomy.

### 2. The Architectural Solution

The `/modules/utils.js` artifact will be designed as a dependency-free, self-contained library. It will be structured as a self-executing anonymous function that returns a single object containing two primary properties:

1.  **Helper Functions:** A collection of simple, pure functions for common tasks (e.g., `trunc`, `escapeHtml`, `kabobToCamel`, `sanitizeLlmJsonRespPure`).
2.  **`Errors` Object:** A container for custom error classes that inherit from the base `Error` object. This allows the system to `throw new Errors.ApiError(...)` or `throw new Errors.ToolError(...)`, enabling specific `catch` blocks and more intelligent failure response logic throughout the application.

**Example Structure:**
```javascript
const UtilsModule = (() => {
  // Custom Error class definitions
  class ApplicationError extends Error { /* ... */ }
  class ApiError extends ApplicationError { /* ... */ }

  // Helper function definitions
  const trunc = (str, len) => { /* ... */ };

  return {
    Errors: { ApplicationError, ApiError, ... },
    logger: { /* ... */ },
    trunc,
    // ... other helpers
  };
})();
```

### 3. The Implementation Pathway

1.  **Define Error Taxonomy:** Create a hierarchy of custom error classes within `/modules/utils.js`, starting with a base `ApplicationError` and extending it for specific domains like `ApiError`, `ToolError`, `StateError`, and `ArtifactError`.
2.  **Implement Helper Functions:** Add common, pure helper functions to the module.
3.  **Implement Logger:** Include a simple `logger` object within the module to standardize console output formatting across the entire agent.
4.  **Dependency Injection:** The `/modules/app-logic.js` orchestrator will load `utils.js` first, as it has no dependencies. It will then inject the returned `Utils` object and its `Errors` property into all other modules that require them.