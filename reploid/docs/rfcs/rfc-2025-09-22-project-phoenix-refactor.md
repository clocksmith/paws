# Project Phoenix: A Detailed Refactoring Plan for REPLOID

## Executive Summary

The current REPLOID architecture successfully demonstrates the feasibility of in-browser RSI. However, its experimental nature has resulted in tight coupling between components, a legacy module system, and a developer-centric UI that limits its potential.

Project Phoenix is a strategic refactoring initiative to re-architect REPLOID around four core pillars:

*   **Robust Modularity**: Implementing a true Dependency Injection (DI) container and formalizing the module system to make the agent fully composable and testable.
*   **Predictable Cognition**: Re-architecting the agent's core cognitive loop into a formal, state-driven machine that is more observable, debuggable, and extensible.
*   **Verifiable State & Security**: Upgrading the Virtual File System (VFS) to be version-controlled and enhancing the security model to provide granular, policy-based control over the agent's powerful capabilities.
*   **Enhanced Observability**: Evolving the user interface from a developer console into a rich, interactive dashboard that provides deep insight into the agent's reasoning and actions.

This refactor will transform REPLOID from a fascinating experiment into a stable and powerful framework for building, deploying, and observing a new class of autonomous AI agents.

## Pillar 1: Core Architecture & Modularity

This pillar addresses the foundational structure of the application, focusing on decoupling components and establishing clear, enforceable architectural patterns.

### Feature 1.1: Formalize and Enforce the Standardized Module System

**Problem**: The codebase contains a mix of a new, standardized module format (as described in STANDARDIZATION.md) and a legacy, function-based dependency injection pattern (seen in _archive/v0/ files). This creates inconsistency and maintenance overhead.

**Proposed Solution**:

1.  **Full Migration**: All modules (agent-cycle.js, state-manager.js, etc.) must be refactored to exclusively use the standardized format:
    ```javascript
    const MyModule = {
      metadata: {
        id: 'MyModule',
        version: '1.0.0',
        dependencies: ['DependencyA', 'DependencyB'],
        type: 'service' // 'pure', 'service', 'ui'
      },
      factory: (deps) => {
        const { DependencyA, DependencyB } = deps;
        // Module implementation...
        return {
          publicMethod: () => {}
        };
      }
    };
    ```
2.  **Deprecate Legacy Wrappers**: All legacy compatibility wrappers and `...Module` factory functions should be removed. The `boot-module-loader.js` will become the single source of truth for loading and instantiation.
3.  **Strict Validation**: The `boot-module-loader.js` will be enhanced to perform strict validation on every loaded module, throwing an error at startup if a module does not conform to the standard structure.

**Impact**: A consistent, predictable, and self-documenting module system. This simplifies testing, maintenance, and the agent's own ability to reason about its architecture.

### Feature 1.2: Implement a True Dependency Injection (DI) Container

**Problem**: The current `boot-module-loader.js` is a good start but functions more as a sequential script. A dedicated DI Container would provide more robust lifecycle management, singleton enforcement, and easier testing.

**Proposed Solution**:

1.  Create a new core module: `/upgrades/di-container.js`.
2.  The DI container will manage the lifecycle of all services.
3.  The `app-logic.js` orchestrator will be simplified dramatically. It will only be responsible for registering all module definitions with the container and then resolving the main `AgentCycle` service.
4.  Pseudo-Code for `DIContainer`:
    ```javascript
    // /upgrades/di-container.js
    class DIContainer {
      _services = new Map();
      _singletons = new Map();

      register(module) {
        this._services.set(module.metadata.id, module);
      }

      async resolve(id) {
        if (this._singletons.has(id)) {
          return this._singletons.get(id);
        }

        const module = this._services.get(id);
        if (!module) throw new Error(`Service not found: ${id}`);

        const dependencies = {};
        for (const depId of module.metadata.dependencies) {
          dependencies[depId] = await this.resolve(depId);
        }

        const instance = module.factory(dependencies);
        this._singletons.set(id, instance);
        return instance;
      }
    }
    ```

**Impact**: Decouples module instantiation from orchestration logic. Enables easy mocking of dependencies for unit testing. Centralizes service management into a single, robust system.

### Feature 1.3: Centralize and Type-Guard Configuration

**Problem**: Configuration is currently spread across `config.json` and hard-coded values within modules. This makes it difficult to manage and for the agent to modify its own parameters safely.

**Proposed Solution**:

1.  **Single Source of Truth**: The `config.json` file will become the single, definitive source for all agent configuration. Default values should be removed from individual modules.
2.  **Typed Config Object**: At boot, `app-logic.js` will load `config.json` and validate it against a predefined schema (potentially using a lightweight library or a simple validation function). This creates a `Config` object that is passed through the DI container.
3.  **Read-Only Access**: Modules should treat the injected `Config` object as read-only. To change its own configuration, the agent must use its `write_artifact` tool to modify `config.json` and then trigger a controlled restart or re-initialization of affected services.

**Impact**: A predictable, safe, and centralized configuration system that the agent can reason about and modify as part of its RSI loop.

## Pillar 2: The Agentic Engine & Cognitive Loop

This pillar focuses on refactoring the "brain" of the agent (`agent-cycle.js`) to make its reasoning process more structured, observable, and extensible.

### Feature 2.1: Implement a Finite State Machine (FSM) for the Cognitive Cycle

**Problem**: The current `executeCycle` function in `agent-cycle.js` is a single, long, and complex async function. This monolithic structure is difficult to debug, test, and extend. Pausing and resuming the agent's state is non-trivial.

**Proposed Solution**:

1.  Refactor `agent-cycle.js` to use a formal Finite State Machine (FSM). The agent's state will explicitly transition between defined stages.
2.  **Define States**:
    *   `IDLE`: Waiting for a goal or trigger.
    *   `PLANNING`: The agent is gathering context, reading files, and writing to its scratchpad. No external tools are used yet.
    *   `AWAITING_LLM`: The agent has assembled a prompt and is waiting for the API response.
    *   `EXECUTING_TOOLS`: The agent is running tools based on the LLM's response.
    *   `APPLYING_CHANGES`: The agent is writing modifications to the VFS.
    *   `REFLECTING`: (New Step) The agent analyzes the outcome of the cycle to update its internal knowledge or strategies.
    *   `PAUSED_HITL`: The agent is waiting for Human-in-the-Loop feedback.
3.  **State Transitions**: Each state will be a function that performs its specific logic and then determines the next state. This makes the cognitive loop explicit and easy to follow.

**Impact**: A highly observable and debuggable agent. It becomes possible to "pause" the agent between states, inspect its internal reasoning, and then resume. This also simplifies the addition of new cognitive steps (like the `REFLECTING` state) without rewriting the entire cycle logic.

### Feature 2.2: Introduce a System-Wide Event Bus

**Problem**: The `agent-cycle.js` module is tightly coupled to the `ui-manager.js` module, with direct calls like `UI.logToTimeline(...)`. This violates the principle of separation of concerns and makes it hard to run the agent headlessly.

**Proposed Solution**:

1.  Create a new, simple `EventBus` utility module.
2.  Refactor all modules to communicate status changes via events instead of direct calls.
3.  **Before**: `UI.logToTimeline('Tool executed');`
4.  **After**: `eventBus.emit('tool:executed', { name: 'read_artifact' });`
5.  The `ui-manager.js` will become a listener on the event bus, updating the UI in response to events.
6.  **Define Core Events**: `cycle:start`, `goal:updated`, `agent:thought`, `tool:request`, `tool:response`, `vfs:changed`, `cycle:complete`, `agent:error`.

**Impact**: Complete decoupling of the agent's core logic from its presentation layer. This allows for different "views" to be attached (e.g., a CLI logger, a dashboard UI, a WebSocket server) and enables headless operation for testing and automation.

### Feature 2.3: Elevate Personas to First-Class Objects

**Problem**: Personas in `config.json` are just static configurations. They define what upgrades an agent has, but not how it should behave differently.

**Proposed Solution**:

1.  Create a new `/personas` directory.
2.  Each persona will be defined as a JavaScript object or class that can provide not just configuration, but also behavior.
3.  The `Persona` object will be injected into the `AgentCycle`.
4.  Example `CodeRefactorerPersona.js`:
    ```javascript
    export const CodeRefactorerPersona = {
      id: 'code_refactorer',
      // ... metadata from config.json ...

      // Persona-specific prompt fragments
      getSystemPromptFragment: () => {
        return "You are a senior software engineer specializing in code quality...";
      },

      // Persona-specific tool filtering/prioritization
      filterTools: (availableTools) => {
        // Prioritize linter and analysis tools
        return availableTools.sort(/* custom logic */);
      },

      // Persona-specific logic hooks into the FSM
      onCycleStart: (state) => {
        // e.g., Automatically run a code analysis tool at the start
        console.log("Refactorer Persona: Starting code analysis.");
      }
    };
    ```

**Impact**: Transforms Personas from simple configurations into powerful, extensible plugins that can deeply customize the agent's behavior, making the system far more versatile.

## Pillar 3: Security & State Integrity

This pillar focuses on making the agent's self-modification capabilities safer, more transparent, and auditable.

### Feature 3.1: Implement a Git-Based Virtual File System

**Problem**: The current VFS (backed by IndexedDB) overwrites artifacts. There is no built-in history, diffing, or rollback capability, which is dangerous for an RSI agent.

**Proposed Solution**:

1.  Integrate a browser-compatible Git implementation (e.g., `isomorphic-git`) into the `storage-indexeddb.js` module.
2.  Every `write_artifact` or `delete_artifact` operation will no longer just modify the file; it will perform a `git commit`.
3.  The commit message will be automatically generated with metadata: `[Cycle 42] Agent modified /modules/utils.js via write_artifact.`
4.  New Core Tools:
    *   `vfs_diff(path, commitA, commitB)`: Returns the diff between two versions of a file.
    *   `vfs_log(path)`: Returns the commit history for a file.
    *   `vfs_revert(path, to_commit)`: Reverts a file to a previous state.

**Impact**: A fully auditable and version-controlled VFS. The agent gains a powerful "memory" of its own code's evolution. This enables true time-travel debugging (see Pillar 4) and provides a critical safety net for RSI.

## Pillar 4: User Experience & Observability

This pillar aims to transform the UI from a basic developer console into a powerful dashboard for observing and interacting with the agent.

### Feature 4.1: The REPLOID Dashboard

**Problem**: The current UI is functional but dense and primarily text-based. It's hard to visualize the agent's state and reasoning process.

**Proposed Solution**:

1.  Refactor `ui-manager.js` to render a modern dashboard layout (inspired by `ui-dashboard.html`) using a lightweight virtual DOM library or native Web Components for modularity.
2.  **Dashboard Components**:
    *   **Goal Stack Viewer**: A visual representation of the agent's current goal and sub-goals.
    *   **Live VFS Explorer**: A file tree view of the virtual file system that updates in real-time. Clicking a file shows its content and (using the Git VFS) its history.
    *   **Agent Thought Stream**: A dedicated panel for the agent's real-time "stream of consciousness" from its scratchpad and planning phases.
    *   **Visual Diff Viewer**: When the agent proposes a change, this component shows a side-by-side diff of the proposed modification.
    *   **Live Preview (Factory Personas)**: The existing iframe preview will be a standard component in the dashboard for relevant personas.

**Impact**: Dramatically improves the user's ability to understand what the agent is doing and why. It moves from a "black box" to a "glass box" model of agent interaction.

### Feature 4.2: Structured Logging and Observability

**Problem**: The current logging is simple `console.log` and timeline entries. A production-grade system needs structured, filterable logs.

**Proposed Solution**:

1.  The logger in `utils.js` will be upgraded to produce structured JSON logs.
    ```json
    {
      "timestamp": "...", "level": "INFO", "module": "AgentCycle",
      "message": "Tool executed successfully",
      "data": { "toolName": "read_artifact", "duration_ms": 15 }
    }
    ```
2.  The "Advanced Logs" panel in the new dashboard will be a log viewer that can parse, filter, and color-code these structured logs, allowing the user to isolate logs from a specific module or at a certain level.

**Impact**: Provides powerful debugging and analysis capabilities, essential for understanding the behavior of a complex, autonomous system.

## Implementation Roadmap

This refactor can be executed in phased sprints to ensure stability.

**Phase 1: The Foundation (2 Sprints)**
*Goal*: Establish the core architectural patterns.
*Tasks*:
*   Migrate all modules to the standardized format (Feature 1.1).
*   Implement the DI Container and refactor app-logic.js (Feature 1.2).
*   Centralize all configuration into a single, validated object (Feature 1.3).
*   Implement the system-wide Event Bus (Feature 2.2).

**Phase 2: The Agent Brain (2 Sprints)**
*Goal*: Refactor the agent's cognitive process.
*Tasks*:
*   Re-architect agent-cycle.js into a Finite State Machine (Feature 2.1).
*   Refactor all modules to use the Event Bus for communication.
*   Implement Personas as first-class objects (Feature 2.3).

**Phase 3: State & Security (1 Sprint)**
*Goal*: Enhance the VFS and security model.
*Tasks*:
*   Integrate `isomorphic-git` into `storage-indexeddb.js` (Feature 3.1).
*   Add the new `vfs_*` tools to the tool runner.

**Phase 4: The User Experience (2 Sprints)**
*Goal*: Build the new dashboard UI.
*Tasks*:
*   Refactor `ui-manager.js` to build the new dashboard layout (Feature 4.1).
*   Implement the structured logger and the advanced log viewer panel (Feature 4.2).
*   Build the VFS explorer and visual diff components, powered by the Git VFS.

By following this detailed plan, Project Phoenix will elevate REPLOID from a groundbreaking research prototype into a stable, powerful, and observable framework for the future of agentic software development.
