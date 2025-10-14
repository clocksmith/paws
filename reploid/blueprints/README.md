# REPLOID Knowledge Base

**[Back to Harness README](../README.md)**

---

> **Architecture Note:** Blueprints form the knowledge foundation for REPLOID's Sentinel Agent capabilities. They are technical specifications bundled into user-facing **Personas** defined in `config.json`. This directory contains the architectural patterns and implementation guides that enable the agent's self-improvement and evolution. See `docs/PERSONAS.md` for persona development details.

This directory contains REPLOID's conceptual knowledge base. The files herein are instructional markdown documents, or **"blueprints,"** designed to be discovered and studied by the agent itself. Each blueprint provides a high-level guide to potential self-improvements, outlining architectural principles, strategic goals, and implementation pathways for major capabilities.

The knowledge base serves as a catalyst for the agent's Recursive Self-Improvement (RSI) cycles. These blueprints provide structured, expert-level knowledge that accelerates development through the Sentinel Agent's human-in-the-loop approval flow.

## Blueprint Style Guide

### 1. Philosophy

This guide ensures every blueprint in the REPLOID knowledge base is consistent, machine-readable, and pedagogically sound. Blueprints are the agent's textbooks; their structure and clarity are paramount for facilitating autonomous learning and evolution. Adherence to this guide is mandatory for all new blueprint artifacts.

### 2. File Naming Convention

Blueprint files MUST follow a strict naming convention:

`0x{HEX_ID}-{kebab-case-title}.md`

-   `0x{HEX_ID}`: A zero-padded, 6-digit hexadecimal identifier (e.g., `0x000001`, `0x00000A`, `0x000012`).
-   `kebab-case-title`: A short, descriptive title in lowercase, with words separated by hyphens.

**Example:** `0x000008-agent-cognitive-cycle.md`

### 3. Core Blueprint Structure

Every blueprint artifact MUST contain the following sections, in this precise order, using the specified Markdown formatting.

```
# Blueprint 0x{HEX_ID}: [Title Case Title]

**Objective:** A single, concise sentence articulating the primary goal or purpose of the concept described in this blueprint.

**Prerequisites:** A list of other blueprint IDs that should be understood before tackling this one. Use "None" if it is a foundational concept.
- *Example: `Prerequisites: 0x000004, 0x000005`*

**Affected Artifacts:** A list of the primary VFS artifacts that will likely be created, modified, or deleted if the agent acts on this blueprint.
- *Example: `/modules/agent-cycle.js`, `/modules/prompt-system.md`*

---

### 1. The Strategic Imperative
*(This section explains the "Why." It provides the high-level strategic reasoning behind the concept. It should be focused and concise, ideally between 50-150 words).*

### 2. The Architectural Solution
*(This section explains the "How." It describes the technical design and architectural pattern that solves the strategic challenge. It may include small code snippets using Markdown code fences to illustrate key ideas).*

### 3. The Implementation Pathway
*(This section provides the "What." It is a clear, step-by-step list of actions the agent could take to implement the solution. This serves as a guide for the agent's own planning process).*
```

### 4. Content and Formatting Rules

-   **Headings:** Use a single H1 for the title and H3 for the three core sections.
-   **Keywords:** Use `**bold**` for critical terms, file paths, and artifact IDs.
-   **Code:** Use `backticks` for inline code and fenced code blocks (e.g., ````javascript`) for multi-line examples.
-   **Tone:** The language MUST be objective, technical, and pedagogical. The blueprint is a formal technical document.
-   **Conciseness:** Each section should be focused and to the point. The goal is clarity and efficient machine-parsing by the agent.

---

## Catalog of Active Blueprints

This catalog provides a comprehensive index of the agent's potential evolutionary pathways, mapping directly to its composable `upgrades`.

### Core Architecture Blueprints

- **`0x000001`**: **System Prompt Architecture**
  - **Path**: `/blueprints/0x000001-system-prompt-architecture.md`
  - **Summary**: Defines the structure and philosophy of the agent's core identity prompt, enabling dynamic context injection.

- **`0x000002`**: **Application Orchestration**
  - **Path**: `/blueprints/0x000002-application-orchestration.md`
  - **Summary**: Details the `app-logic.js` module's role in loading all other modules and managing dependency injection upon agent awakening.

- **`0x000003`**: **Core Utilities and Error Handling**
  - **Path**: `/blueprints/0x000003-core-utilities-and-error-handling.md`
  - **Summary**: Explains the necessity of a central `utils.js` module for shared functions and custom `Error` classes.

### Storage and State Blueprints

- **`0x000004`**: **Default Storage Backend (localStorage)**
  - **Path**: `/blueprints/0x000004-default-storage-backend-localstorage.md`
  - **Summary**: Describes the baseline `localStorage` wrapper, providing a simple, synchronous persistence layer for the VFS.

- **`0x000005`**: **State Management Architecture**
  - **Path**: `/blueprints/0x000005-state-management-architecture.md`
  - **Summary**: Outlines the role of the `StateManager` as the single source of truth for the agent's state and VFS metadata.

- **`0x000006`**: **Pure State Helpers**
  - **Path**: `/blueprints/0x000006-pure-state-helpers.md`
  - **Summary**: Articulates the principle of separating deterministic state calculations into a pure helper module.

### Agent Cognitive Blueprints

- **`0x000007`**: **API Client and Communication**
  - **Path**: `/blueprints/0x000007-api-client-and-communication.md`
  - **Summary**: Details the architecture for a robust API client with retry logic, abort handling, and response sanitization.

- **`0x000008`**: **Agent Cognitive Cycle**
  - **Path**: `/blueprints/0x000008-agent-cognitive-cycle.md`
  - **Summary**: Provides the architectural model for the agent's primary "think-act" loop within `agent-cycle.js`.

- **`0x000009`**: **Pure Agent Logic Helpers**
  - **Path**: `/blueprints/0x000009-pure-agent-logic-helpers.md`
  - **Summary**: Explains how to isolate complex prompt assembly and reasoning logic into testable, pure helper modules.

### Tool System Blueprints

- **`0x00000A`**: **Tool Runner Engine**
  - **Path**: `/blueprints/0x00000A-tool-runner-engine.md`
  - **Summary**: Describes the engine responsible for executing the agent's static and dynamic tools.

- **`0x00000B`**: **Pure Tool Logic Helpers**
  - **Path**: `/blueprints/0x00000B-pure-tool-logic-helpers.md`
  - **Summary**: Outlines the conversion of internal tool definitions into formats required by external LLM APIs.

- **`0x00000C`**: **Sandboxed Tool Worker**
  - **Path**: `/blueprints/0x00000C-sandboxed-tool-worker.md`
  - **Summary**: Explains security and concurrency benefits of executing dynamic tools in sandboxed Web Workers.

### UI System Blueprints

- **`0x00000D`**: **UI Management**
  - **Path**: `/blueprints/0x00000D-ui-manager.md`
  - **Summary**: Details the architecture for managing the agent's developer console UI, rendering, and event handling.

- **`0x00000E`**: **UI Styling (CSS)**
  - **Path**: `/blueprints/0x00000E-ui-styling-css.md`
  - **Summary**: Covers the role of the `ui-style.css` artifact in defining the visual appearance.

- **`0x00000F`**: **UI Body Template (HTML)**
  - **Path**: `/blueprints/0x00000F-ui-body-template-html.md`
  - **Summary**: Describes the foundational HTML skeleton artifact that structures the user interface.

### Advanced Feature Blueprints

- **`0x000010`**: **Static Tool Manifest**
  - **Path**: `/blueprints/0x000010-static-tool-manifest.md`
  - **Summary**: Explains the structure of the JSON artifact defining the agent's built-in, static toolset.

- **`0x000011`**: **Advanced Storage Backend (IndexedDB)**
  - **Path**: `/blueprints/0x000011-advanced-storage-backend-indexeddb.md`
  - **Summary**: Outlines the architectural upgrade to an asynchronous, high-capacity `IndexedDB` storage layer.

- **`0x000012`**: **Structured Self-Evaluation**
  - **Path**: `/blueprints/0x000012-structured-self-evaluation.md`
  - **Summary**: Proposes a framework for structured, LLM-driven self-evaluation and improvement.

### Meta and Safety Blueprints

- **`0x000013`**: **System Configuration Structure**
  - **Path**: `/blueprints/0x000013-system-configuration-structure.md`
  - **Summary**: Defines runtime behavior control through system configuration.

- **`0x000014`**: **Working Memory Scratchpad**
  - **Path**: `/blueprints/0x000014-working-memory-scratchpad.md`
  - **Summary**: Agent's transient working memory system for temporary computations.

- **`0x000015`**: **Dynamic Tool Creation**
  - **Path**: `/blueprints/0x000015-dynamic-tool-creation.md`
  - **Summary**: Framework for creating and managing dynamic tools at runtime.

- **`0x000016`**: **Meta-Tool Creation Patterns**
  - **Path**: `/blueprints/0x000016-meta-tool-creation-patterns.md`
  - **Summary**: Meta-patterns and principles for designing new tools systematically.

- **`0x000017`**: **Goal Modification Safety**
  - **Path**: `/blueprints/0x000017-goal-modification-safety.md`
  - **Summary**: Safe patterns for agent goal evolution and modification.

- **`0x000018`**: **Blueprint Creation Meta**
  - **Path**: `/blueprints/0x000018-blueprint-creation-meta.md`
  - **Summary**: Meta-blueprint for creating new blueprints and knowledge transfer.

- **`0x000019`**: **Visual Self-Improvement**
  - **Path**: `/blueprints/0x000019-visual-self-improvement.md`
  - **Summary**: Using 2D canvas visualization for pattern recognition and self-optimization.

- **`0x00001A`**: **RFC Authoring**
  - **Path**: `/blueprints/0x00001A-rfc-authoring.md`
  - **Summary**: Structure, tone, and components for creating Request for Change documents.

---

## Integration with Sentinel Agent

All blueprints integrate with the Sentinel Agent system (Project Sentinel), which implements:

1. **Context Curation**: Agent selects relevant blueprints for goals
2. **Human Approval**: Review and approve proposed implementations
3. **Safe Application**: Changes applied with checkpoint/rollback capability
4. **Learning**: Agent reflects on outcomes to improve future blueprint usage

## RFC Implementation Status

See `/RFC-STATUS.md` for the current implementation status of major architectural initiatives:

- **Project Sentinel** (Sentinel Agent): ☑ 100% Complete
- **PAWS CLI Integration**: ☑ 100% Complete
- **Project Phoenix** (Architecture): ⚬ 40% Implemented
- **Project Aegis** (Security): ☆ Proposed
- **Project Athena** (Learning): ☆ Proposed
- **Project Chronos** (Time Travel): ☆ Proposed

## Testing & Validation

Blueprint implementations are validated through:

1. **Self-Testing Framework**: `self-tester.js` validates system integrity (80% pass threshold)
2. **Automated Test Suite**: 85 passing tests with Vitest (see `tests/README.md`)
3. **CI/CD Pipeline**: GitHub Actions validates all changes on push/PR
4. **Manual Testing**: See `test-sentinel-flow.md` for Sentinel Agent workflow tests

**RSI Safety**: All 5 RSI core modules (Introspection, Reflection, Self-Testing, Performance, Browser APIs) are complete and tested, enabling safe self-modification.

---

*Blueprints power the Sentinel Agent's evolution through structured knowledge and human-approved implementation.*