# REPLOID Upgrade Library

**[Back to Harness README](../README.md)**

---

> **Note for Contributors:** As of the new consumer-focused architecture, Upgrades are no longer presented directly to the end-user. Instead, they are bundled into **Personas**, which are defined in `config.json`. This directory remains the source of truth for the agent's functional capabilities, but it is now an abstraction used to build the user-facing personas. See `docs/PERSONAS.md` for more details.

This directory contains the REPLOID's library of pre-built, functional code modules, referred to as **"upgrades."** Each file or self-contained set of files in this directory represents a discrete capability that can be composed into a REPLOID agent at the moment of its creation. The `boot.js` harness uses the master `config.json` manifest to identify these modules by a short, memorable ID.

During the interactive boot sequence, an operator can select a specific combination of these upgrades to construct a custom agent tailored for a particular task. This compositionality is central to the REPLOID philosophy, allowing for rapid experimentation and a clear separation between the agent's innate capabilities (defined by its composed upgrades) and its learned behaviors (developed through self-modification).

The default storage mechanism is the asynchronous `storage-indexeddb.js` (`idb`) module for improved performance and capacity.

## Catalog of Upgrades

The following is a high-level catalog of the core upgrades available for composition. Each upgrade uses a 4-character ID in config.json. All modules now follow a standardized format - see **[STANDARDIZATION.md](../STANDARDIZATION.md)** for details.

### Core Engine & Logic
*   **`APPL`** (`app-logic.js`): The main application orchestrator with module loader support
*   **`CYCL`** (`agent-cycle.js`): The agent's core cognitive cycle logic  
*   **`STMT`** (`state-manager.js`): The state manager and VFS interface
*   **`APIC`** (`api-client.js`): The client for communicating with the Gemini API
*   **`TRUN`** (`tool-runner.js`): The tool execution engine
*   **`UTIL`** (`utils.js`): Essential shared utilities and custom `Error` classes

### Pure Helper Modules (No Dependencies)
*   **`AGLP`** (`agent-logic-pure.js`): Pure functions for agent prompt assembly
*   **`STHP`** (`state-helpers-pure.js`): Pure functions for state validation and statistics
*   **`TRHP`** (`tool-runner-pure-helpers.js`): Pure functions for converting tool schemas

### Persistence Layer
*   **`IDXB`** (`storage-indexeddb.js`): The default `IndexedDB` asynchronous storage backend

### User Interface
*   **`UIMN`** (`ui-manager.js`): Manages the rendering and event handling for the dev console
*   **`BODY`** (`ui-body-template.html`): The HTML skeleton for the dev console UI
*   **`STYL`** (`ui-style.css`): The CSS styles for the dev console

### Tools & Capabilities
*   **`PRMT`** (`prompt-system.md`): The agent's core system prompt and identity
*   **`TLRD`** (`tools-read.json`): Read-only tools for safe introspection
*   **`TLWR`** (`tools-write.json`): Write tools that enable RSI capabilities
*   **`WRKR`** (`tool-worker.js`): The sandboxed Web Worker for dynamic tool execution
*   **`EVAL`** (`tool-evaluator.js`): An optional, packaged self-evaluation tool

### System Configuration
*   **`SCFG`** (`system-config.json`): The agent's mutable runtime configuration
*   **`SCRT`** (`system-scratchpad.md`): A volatile working memory artifact
*   **`STLD`** (`system-tools-dynamic.json`): The manifest for agent-created dynamic tools

### RSI Meta-Modules
*   **`MTCP`** (`meta-tool-creator.js`): Meta-tool creation patterns and utilities
*   **`GMOD`** (`goal-modifier.js`): Safe goal modification and evolution mechanisms
*   **`BLPR`** (`blueprint-creator.js`): Blueprint generation and management system

### Module System (New)
*   **`MLDR`** (`boot-module-loader.js`): Standardized module loader with dependency injection
*   **`MMNF`** (`module-manifest.json`): Module dependency manifest and load order
*   **`DICN`** (`di-container.js`): Dependency injection container for module composition
*   **`EVTB`** (`event-bus.js`): Event pub/sub system for loose coupling

### RSI Core Modules (12/12 Complete - ✅ 100% RSI Capability)
*   **`INTR`** (`introspector.js`): Self-analysis - architecture, dependencies, complexity metrics
*   **`REFL`** (`reflection-store.js`): Meta-learning - persistent learning across sessions
*   **`REAN`** (`reflection-analyzer.js`): Pattern recognition - learning from reflection history
*   **`RESRCH`** (`reflection-search.js`): Semantic search - TF-IDF similarity search over reflections
*   **`TEST`** (`self-tester.js`): Self-testing - automated validation with 80% threshold
*   **`PERF`** (`performance-monitor.js`): Self-optimization - metrics collection and analysis
*   **`POPT`** (`performance-optimizer.js`): Auto-optimization - memoization, throttling, retry wrappers
*   **`BAPI`** (`browser-apis.js`): Browser-native - File System Access, Notifications, Storage
*   **`COST`** (`cost-tracker.js`): Cost tracking - API usage monitoring and rate limiting
*   **`TOAN`** (`tool-analytics.js`): Tool analytics - usage patterns and performance tracking
*   **`SWRM`** (`swarm-orchestrator.js`): Multi-agent - distributed task delegation and coordination
*   **`TDOC`** (`tool-doc-generator.js`): Auto-docs - automatic markdown documentation generator

---

## Testing

All core modules are tested with Vitest. See `tests/README.md` for details.

**Test Coverage:**
- `utils.js`: 98.85% lines, 85.36% functions ✅
- `event-bus.js`: 100% coverage ✅
- `state-manager.js`: Full mocked coverage ✅

**Run tests:**
```bash
npm test              # Run all tests
npm run test:watch   # Watch mode
npm run test:coverage # Coverage report
```

**85 passing tests** across unit and integration suites, with CI/CD via GitHub Actions.

---

## Documentation

- **API Reference:** `docs/API.md` - Complete module API documentation with examples
- **Testing Guide:** `tests/README.md` - Testing best practices and guidelines
- **Roadmap:** `docs/ROADMAP.md` - Development priorities (53/53 complete ✅)
- **Enhancements:** `docs/TODO-ENHANCEMENTS.md` - Post-roadmap enhancements (18/18 complete ✅)
- **Completion Summary:** `docs/FINAL-COMPLETION.md` - Final 100% completion report

---

*For module development guidelines, see `docs/PERSONAS.md` and the standardized module format in `STANDARDIZATION.md`.*