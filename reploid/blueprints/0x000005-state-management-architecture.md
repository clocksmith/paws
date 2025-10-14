# Blueprint 0x000005: State Management Architecture

**Objective:** To manage the agent's single state object and provide a controlled, transactional interface for modifying it and its associated artifact metadata.

**Prerequisites:** `0x000003`, `0x000004`

**Affected Artifacts:** `/modules/state-manager.js`

---

### 1. The Strategic Imperative

An autonomous agent's state is its most critical asset. Allowing disparate modules to directly modify a global state object would lead to race conditions, data corruption, and unmaintainable code. To ensure data integrity and predictable behavior, all state modifications must be channeled through a single, authoritative module: the `StateManager`. This module acts as the protector of the agent's memory, ensuring that all changes are valid and properly persisted.

### 2. The Architectural Solution

The `/modules/state-manager.js` artifact will be responsible for holding the `globalState` object in memory. It will not handle persistence directly; instead, it will delegate that task to the injected `Storage` module. This maintains a clean separation of concerns.

The `StateManager` will expose two types of methods:
1.  **Read Methods:** Functions like `getState()` and `getArtifactMetadata(path)` that provide read-only access to the current state.
2.  **Write Methods:** Functions like `updateAndSaveState(updaterFn)` and `createArtifact(...)` that modify the state. The key architectural pattern is the `updateAndSaveState` function, which accepts an "updater function" as an argument. It provides a deep copy of the current state to this function, which performs the modifications and returns the new state. The `StateManager` then validates and saves the result, ensuring an atomic update.

### 3. The Implementation Pathway

1.  **Initialization:** The `init()` method will be responsible for calling `Storage.getState()` to load the persisted state from the VFS into the in-memory `globalState` object on startup.
2.  **State Access:** Implement `getState()` to return a reference to the `globalState` object.
3.  **Atomic Updates:** Implement the `updateAndSaveState(updaterFn)` function. This is the core transactional method. It gets the current state, deep-copies it, passes the copy to `updaterFn`, receives the modified state, updates the `globalState` reference, and then calls `Storage.saveState()` to persist the changes.
4.  **Convenience Wrappers:** Create higher-level methods like `createArtifact`, `updateArtifact`, and `deleteArtifact`. These methods will use `updateAndSaveState`, providing the specific updater logic to modify the `artifactMetadata` object and call the underlying `Storage` methods to change VFS content. This encapsulates the logic for common VFS operations.