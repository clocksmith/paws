# Blueprint 0x000006: Pure State Helpers

**Objective:** To articulate the principle of separating deterministic state calculations (such as validation and statistical analysis) into a dedicated, pure helper module.

**Prerequisites:** `0x000005`

**Affected Artifacts:** `/modules/state-helpers-pure.js`, `/modules/state-manager.js`

---

### 1. The Strategic Imperative

The `StateManager` module has complex responsibilities, including I/O and managing the in-memory state object. Intermingling complex, deterministic logic (like validating the structure of a state object or calculating statistics from its history arrays) with state-modifying, effectful code makes the module harder to test, reason about, and maintain. By extracting this pure logic into a separate helper module, we adhere to the "functional core, imperative shell" principle, resulting in a more robust and testable system.

### 2. The Architectural Solution

A new `/modules/state-helpers-pure.js` artifact will be created. This module will be "pure" in the sense that it has zero dependencies on other agent modules and its functions' outputs depend solely on their inputs. It will export a collection of functions designed to operate on state-related data structures.

**Example Functions:**
-   `validateStateStructurePure(stateObj, ...)`: Takes a state object and returns `null` if valid or an error string if not.
-   `calculateDerivedStatsPure(historyArrays, ...)`: Takes arrays (e.g., `confidenceHistory`) and returns an object of calculated statistics (e.g., `{ avgConfidence: 0.85 }`).
-   `mergeWithDefaultsPure(loadedState, ...)`: Takes a potentially incomplete state object loaded from storage and merges it with a default state structure to ensure all necessary keys exist.

### 3. The Implementation Pathway

1.  **Create Pure Module:** Implement the `/modules/state-helpers-pure.js` file, ensuring it has no `import` or `require` statements for other agent modules.
2.  **Define Helper Functions:** Create the necessary pure functions for validation, statistics, and merging, as described above. These functions will be thoroughly testable in isolation.
3.  **Refactor `StateManager`:**
    a.  Modify `/modules/state-manager.js` to receive `StateHelpersPure` as an injected dependency.
    b.  In the `init()` method, call `StateHelpersPure.validateStateStructurePure()` and `StateHelpersPure.mergeWithDefaultsPure()` to handle the loading of persisted state robustly.
    c.  In the `updateAndSaveState()` method, after a state update, call `StateHelpersPure.calculateDerivedStatsPure()` to re-calculate and attach statistics to the state object before it is saved.