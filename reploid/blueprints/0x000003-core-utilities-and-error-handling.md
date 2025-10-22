# Blueprint 0x000003: Core Utilities and Error Handling

**Objective:** To centralize common helper functions and custom error classes into a single, foundational utility module.

**Target Upgrade:** UTIL (`utils.js`)


**Prerequisites:** None

**Affected Artifacts:** `/modules/utils.js`

---

### 1. The Strategic Imperative

A robust software system avoids code duplication and provides clear, specific error handling. Repeating common logic (like string truncation or DOM selectors) across multiple modules leads to inconsistencies and maintenance burdens. Similarly, relying on generic `Error` objects makes it difficult to distinguish between different types of failures (e.g., an API failure vs. a tool failure). A central utility artifact is essential for code reuse and creating a precise error-handling taxonomy.

### 2. The Architectural Solution

The `/upgrades/utils.js` module is structured as a standardized REPLOID module with three main components:

1.  **Helper Functions:** A collection of simple, pure functions for common tasks (e.g., `trunc`, `escapeHtml`, `kabobToCamel`, `sanitizeLlmJsonRespPure`).
2.  **`Errors` Object:** A container for custom error classes that inherit from the base `Error` object. This allows the system to `throw new Errors.ApiError(...)` or `throw new Errors.ToolError(...)`, enabling specific `catch` blocks and more intelligent failure response logic throughout the application.
3.  **Web Component Widget:** A `UtilsWidget` custom element that provides dashboard visualization of utility usage, logger statistics, and error tracking.

**Module Structure:**
```javascript
const Utils = {
  metadata: {
    id: 'Utils',
    version: '1.0.0',
    dependencies: [],
    type: 'utility'
  },

  factory: (deps) => {
    // Error tracking state
    const _errorStats = {};
    const _recentErrors = [];
    const _loggerStats = { debug: 0, info: 0, warn: 0, error: 0 };

    // Custom Error class definitions
    class ApplicationError extends Error { /* ... */ }
    class ApiError extends ApplicationError { /* ... */ }
    class ToolError extends ApplicationError { /* ... */ }
    class StateError extends ApplicationError { /* ... */ }

    // Helper function implementations
    const trunc = (str, len) => { /* ... */ };
    const kabobToCamel = (str) => { /* ... */ };

    // Logger with statistics tracking
    const logger = {
      debug: (msg) => { _loggerStats.debug++; console.log(msg); },
      info: (msg) => { _loggerStats.info++; console.log(msg); },
      warn: (msg) => { _loggerStats.warn++; console.warn(msg); },
      error: (msg) => { _loggerStats.error++; console.error(msg); }
    };

    // Web Component Widget
    class UtilsWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
      }

      getStatus() {
        const totalLogs = _loggerStats.debug + _loggerStats.info +
                         _loggerStats.warn + _loggerStats.error;
        const totalErrors = Object.values(_errorStats).reduce((a, b) => a + b, 0);

        return {
          state: totalLogs > 0 ? 'active' : 'idle',
          primaryMetric: `11 utilities`,
          secondaryMetric: `${totalLogs} logs`,
          message: `${totalErrors} errors created`
        };
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>/* Styling for utility stats, error list */</style>
          <div class="widget-panel">
            <h3>⚡ Core Utilities</h3>
            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-value">${totalLogs}</div>
                <div class="stat-label">Total Logs</div>
              </div>
              <!-- More stats... -->
            </div>
            <h3>Recent Errors</h3>
            <!-- Error list... -->
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'utils-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, UtilsWidget);
    }

    return {
      api: {
        Errors: { ApplicationError, ApiError, ToolError, ... },
        logger,
        trunc,
        kabobToCamel,
        // ... other utilities
      },
      widget: {
        element: elementName,
        displayName: 'Utilities',
        icon: '⚡',
        category: 'core'
      }
    };
  }
};

export default Utils;
```

**Key Features:**
- **Dependency-free:** No external dependencies required
- **Error Tracking:** Automatically tracks error creation by type
- **Logger Statistics:** Counts log calls by level (debug/info/warn/error)
- **Web Component Dashboard:** Real-time visualization of utility usage
- **Shadow DOM:** Encapsulated styling for the widget

### 3. The Implementation Pathway

1.  **Define Error Taxonomy:** Create a hierarchy of custom error classes within `/upgrades/utils.js`, starting with a base `ApplicationError` and extending it for specific domains like `ApiError`, `ToolError`, `StateError`, and `ArtifactError`.
2.  **Implement Helper Functions:** Add common, pure helper functions to the module (trunc, escapeHtml, kabobToCamel, sanitizeLlmJsonRespPure, etc.).
3.  **Implement Logger with Statistics:** Include a `logger` object with methods (debug, info, warn, error) that track call counts in `_loggerStats`.
4.  **Track Error Creation:** Maintain `_errorStats` and `_recentErrors` to track error instantiation for widget display.
5.  **Create Web Component Widget:**
   - Define `UtilsWidget` class extending `HTMLElement`
   - Implement Shadow DOM in constructor with `attachShadow({ mode: 'open' })`
   - Implement `connectedCallback()` to trigger initial render
   - Implement `getStatus()` returning state, primaryMetric, secondaryMetric, message
   - Implement `render()` to display utility list, logger stats, and recent errors
   - Add reset statistics control button
6.  **Register Custom Element:** Use `customElements.define('utils-widget', UtilsWidget)`
7.  **Return Standardized API:** Return object with:
   - `api` property containing Errors, logger, and utility functions
   - `widget` property with element, displayName, icon, category
8.  **Export Module:** Use ES6 `export default Utils`
9.  **Dependency Injection:** The DIContainer will load `utils.js` first (no dependencies) and make it available to all other modules