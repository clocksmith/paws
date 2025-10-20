# REPLOID Blueprint Registry

**Last Updated**: 2025-10-20
**Total Blueprints**: 98 (92 existing + 6 reserved for UI refactoring)
**Purpose**: Canonical reference for all REPLOID architectural blueprints
**Maintainer**: CLUSTER 1 (Foundation & Low-Risk Panels)

---

## Quick Stats

| Metric | Count |
|--------|-------|
| **Total Blueprints** | 98 |
| **Module Blueprints** | 81 |
| **Meta/Config Blueprints** | 11 |
| **Reserved (UI Refactoring)** | 6 |
| **Categories** | 24 |
| **Coverage** | 100% of modules documented |

---

## Category Legend

### Core System (12 blueprints)
- **Core/Bootstrap** (2): Application lifecycle, utilities
- **Core/Pure** (3): Stateless transformation helpers
- **Infrastructure** (7): DI container, EventBus, module loader, rate limiter, diff utils, hot reload, DOGS parser

### Storage & Persistence (6 blueprints)
- **Storage/Persistence** (6): LocalStorage, IndexedDB, Git VFS, Genesis snapshots, backup/restore

### Agent Architecture (17 blueprints)
- **Agent/Cognition** (5): Cognitive cycle, context manager, self-evaluation
- **Agent/FSM** (1): Sentinel finite state machine
- **Agent/Meta-Cognitive** (3): Introspection, déjà vu detection, meta-cognitive layer
- **Agent/Reflection** (3): Reflection store, analysis, semantic search
- **Agent/Orchestration** (3): Autonomous orchestrator, persona manager, HITL controller
- **Agent/Safety** (1): Goal modification safety
- **Tool/Execution** (5): Tool runner, worker, Python tool, sentinel tools, meta-tool creator

### LLM Integration (5 blueprints)
- **LLM/Integration** (5): API clients, local LLM, hybrid provider, streaming handler

### UI & Visualization (21 blueprints)
- **UI/Panels** (12): UI manager, VFS explorer, HITL panel, tool execution, diff viewer, + 6 RESERVED
- **UI/Dashboard** (1): Module dashboard orchestration
- **UI/Notifications** (1): Toast notifications
- **UI/Tutorial** (1): Interactive tutorial system
- **UI/Safety** (1): Confirmation modal
- **Visualization** (6): D3.js visualizers, Canvas, Chart.js, AST, module graph, Penteract

### Communication & Coordination (4 blueprints)
- **Communication/Swarm** (2): WebRTC coordinator, swarm transport
- **Communication/Coordination** (1): Multi-tab coordination
- **Integration/Browser** (1): Browser API integration

### Monitoring & Analytics (5 blueprints)
- **Monitoring/Performance** (1): Performance monitor
- **Analytics/Monitoring** (2): Tool analytics, cost tracker
- **Analytics/Visualization** (1): Penteract analytics
- **Testing/Verification** (3): Self-tester, verification manager, verification worker

### Security & Safety (2 blueprints)
- **Security/Safety** (2): Module integrity, audit logger

### Runtime Environments (2 blueprints)
- **Runtime/Python** (2): Pyodide runtime, Pyodide worker

### Documentation & Config (14 blueprints)
- **Meta/Documentation** (3): Blueprint creator, RFC author, tool doc generator
- **Meta/Config** (11): System prompt, UI templates, tool manifests, config files

---

## Complete Blueprint Registry

**Note**: Blueprints marked **RESERVED** are allocated for UI refactoring (CLUSTER 1 & 2) but not yet implemented.

| Blueprint | Category | Module/File | Description |
|-----------|----------|-------------|-------------|
| `0x000001` | Meta/Config | *(meta/config)* | System prompt architecture: defines agent core system prompt philosophy |
| `0x000002` | Core/Bootstrap | `app-logic` | Central application boot orchestrator: coordinates initialization lifecycle across modules |
| `0x000003` | Core/Bootstrap | `utils` | Core utilities and error handling: logger configuration validation helper |
| `0x000004` | Storage/Persistence | `storage-localstorage` | LocalStorage persistence backend: synchronous key value storage for state |
| `0x000005` | Storage/Persistence | `state-manager` | State management architecture: single source truth for agent state |
| `0x000006` | Core/Pure | `state-helpers-pure` | Pure state transformation helpers: deterministic stateless calculations for operations |
| `0x000007` | LLM/Integration | `api-client` | API client communication layer: HTTP requests retry logic provider |
| `0x000008` | Agent/Cognition | `agent-cycle` | Agent cognitive cycle engine: primary think act loop autonomous |
| `0x000009` | Core/Pure | `agent-logic-pure` | Pure agent logic helpers: stateless prompt assembly reasoning logic |
| `0x00000A` | Tool/Execution | `tool-runner` | Tool execution engine: coordinates validation execution tracking for tools |
| `0x00000B` | Core/Pure | `tool-runner-pure-helpers` | Pure tool transformation helpers: converts internal definitions to Claude |
| `0x00000C` | Tool/Execution | `tool-worker` | Sandboxed Web Worker execution: isolates dynamic tool execution security |
| `0x00000D` | UI/Panels | `ui-manager` | UI management and rendering: manages developer console DOM panels |
| `0x00000E` | Meta/Config | *(meta/config)* | UI styling CSS: visual design system for developer console |
| `0x00000F` | Meta/Config | *(meta/config)* | UI body template HTML: foundational DOM structure skeleton interface |
| `0x000010` | Meta/Config | *(meta/config)* | Static tool manifest: JSON catalog of read-only inspection tools |
| `0x000011` | Storage/Persistence | `storage-indexeddb` | IndexedDB advanced storage backend: asynchronous large-capacity persistence for data |
| `0x000012` | Agent/Cognition | `tool-evaluator` | Structured self-evaluation framework: LLM-driven assessment using predefined criteria |
| `0x000013` | Meta/Config | *(meta/config)* | System configuration structure: runtime settings for API keys preferences |
| `0x000014` | Meta/Config | *(meta/config)* | Working memory scratchpad: transient markdown workspace for intermediate reasoning |
| `0x000015` | Meta/Config | *(meta/config)* | Dynamic tool creation: enables agent to create register execute |
| `0x000016` | Tool/Execution | `meta-tool-creator` | Meta-tool creation patterns: teaches agent how to design capabilities |
| `0x000017` | Agent/Safety | `goal-modifier` | Safe goal modification logic: mechanisms for agent modify goals |
| `0x000018` | Meta/Documentation | `blueprint-creator` | Blueprint creation meta-system: teaches agent how document design patterns |
| `0x000019` | UI/Panels | `visual-self-improvement` | Visual self-improvement interface: allows agent visualize improve its code |
| `0x00001A` | Meta/Documentation | `rfc-author` | RFC document authoring system: creates formal Request for Change |
| `0x00001B` | Agent/Meta-Cognitive | `introspector` | Code introspection and analysis: enables agent analyze its source |
| `0x000022` | Meta/Config | *(meta/config)* | Write tools manifest: JSON catalog of file modification deletion |
| `0x000023` | Agent/Orchestration | `autonomous-orchestrator` | Autonomous curator orchestrator: manages agent in curator mode tasks |
| `0x000024` | Analytics/Visualization | `penteract-analytics` | Penteract analytics transformation: converts Paxos competition telemetry into visualizations |
| `0x000025` | Infrastructure | `boot-module-loader` | Universal module loader: bootstraps hydrates supervises runtime upgrades injection |
| `0x000026` | Meta/Config | *(meta/config)* | Module manifest governance: defines structure lifecycle review for registry |
| `0x000027` | LLM/Integration | `api-client-multi` | Multi-provider API gateway: routes LLM traffic across Gemini OpenAI |
| `0x000028` | UI/Safety | `confirmation-modal` | Confirmation modal safety: user approval workflow for dangerous operations |
| `0x000029` | UI/Panels | `vfs-explorer` | VFS explorer interaction: file tree navigation diff viewer virtual |
| `0x00002A` | Visualization | `canvas-visualizer` | Canvas 2D visualization engine: renders agent state execution flow |
| `0x00002B` | Visualization | `viz-data-adapter` | Visualization data adapter: transforms state metrics logs into structures |
| `0x00002C` | Monitoring/Performance | `performance-monitor` | Performance monitoring stack: tracks tool execution state transitions latency |
| `0x00002D` | Visualization | `metrics-dashboard` | Chart.js metrics dashboard: visualizes REPLOID performance with interactive charts |
| `0x00002E` | Visualization | `agent-visualizer` | D3.js agent FSM visualizer: renders Sentinel finite state machine |
| `0x00002F` | Visualization | `ast-visualizer` | AST visualization framework: parses transforms renders JavaScript syntax trees |
| `0x000030` | Visualization | `module-graph-visualizer` | D3.js module graph visualizer: shows module dependency graph force-directed |
| `0x000031` | UI/Notifications | `toast-notifications` | Toast notification system: non-blocking temporary messages for user feedback |
| `0x000032` | Infrastructure | `rate-limiter` | Token bucket rate limiter: prevents API overuse with sliding |
| `0x000033` | Security/Safety | `module-integrity` | Module integrity verification: cryptographic signing hashing verification for security |
| `0x000034` | Security/Safety | `audit-logger` | Audit logging policy: persistent tamper-evident log of agent actions |
| `0x000035` | UI/Tutorial | `tutorial-system` | Interactive tutorial system: in-app guided walkthrough engine for onboarding |
| `0x000036` | Runtime/Python | `pyodide-runtime` | Pyodide runtime orchestration: worker-based Python WebAssembly runtime for executing |
| `0x000037` | Tool/Execution | `python-tool` | Python tool interface: exposes Pyodide capabilities to agent through |
| `0x000038` | LLM/Integration | `local-llm` | Local WebLLM runtime: runs quantized language models in browser |
| `0x000039` | LLM/Integration | `hybrid-llm-provider` | Hybrid LLM orchestration: seamlessly switches between local WebLLM cloud |
| `0x00003A` | Communication/Swarm | `webrtc-coordinator` | WebRTC swarm coordination: multi-agent collaboration over peer to peer |
| `0x00003B` | Agent/Reflection | `reflection-store` | Reflection storage architecture: persists queries agent reflections from experiences |
| `0x00003C` | Agent/Reflection | `reflection-analyzer` | Reflection pattern analysis: extracts patterns recommendations insights from reflections |
| `0x00003D` | Agent/Reflection | `reflection-search` | TF-IDF semantic search: surfaces past reflections relevant to context |
| `0x00003E` | Analytics/Monitoring | `tool-analytics` | Tool usage analytics: telemetry for understanding tool performance failures |
| `0x00003F` | Analytics/Monitoring | `cost-tracker` | API cost tracker: tracks token usage estimates spend alerts |
| `0x000040` | Communication/Coordination | `tab-coordinator` | Multi-tab coordination: messaging protocol synchronizes state across REPLOID tabs |
| `0x000041` | Meta/Documentation | `tool-doc-generator` | Tool documentation generator: automatically creates comprehensive markdown reference from |
| `0x000042` | Testing/Verification | `self-tester` | Self-testing framework: runs validation test suites before after modification |
| `0x000043` | Integration/Browser | `browser-apis` | Browser API integration: leverages native browser filesystem notifications clipboard |
| `0x000044` | Communication/Swarm | `webrtc-swarm` | WebRTC swarm transport: signaling connection messaging model for coordination |
| `0x000045` | LLM/Integration | `streaming-response-handler` | Streaming response handler: processes incremental LLM responses as tokens |
| `0x000046` | Agent/Cognition | `context-manager` | Context management system: manages conversation context windows for performance |
| `0x000047` | Agent/Cognition | `agent-cycle-structured` | Structured 8-step cycle: deliberation self-assessment tool-selection execution verification |
| `0x000048` | Infrastructure | `dogs-parser-browser` | DOGS CATS browser parser: parses Claude output streaming protocol |
| `0x000049` | Storage/Persistence | `genesis-snapshot` | Genesis snapshot system: captures initial boot state of REPLOID |
| `0x00004A` | Agent/Meta-Cognitive | `deja-vu-detector` | Déjà vu pattern detection: detects repetitive action patterns identifies opportunities |
| `0x00004B` | Agent/Meta-Cognitive | `meta-cognitive-layer` | Meta-cognitive coordination layer: autonomous decision making enables agent improve |
| `0x00004C` | Infrastructure | `diff-utils` | Browser-native diff utilities: line-based diff comparison without external dependencies |
| `0x00004D` | Testing/Verification | `verification-manager` | Verification manager: safe sandboxed execution of tests linting verification |
| `0x00004E` | Infrastructure | `module-widget-protocol` | Module widget protocol: standardized interface for modules to expose |
| `0x00004F` | Infrastructure | `di-container` | Dependency injection container: manages module lifecycle dependencies initialization order |
| `0x000050` | Infrastructure | `config` | Centralized config management: type-guarded configuration system single source settings |
| `0x000051` | Agent/Orchestration | `persona-manager` | Persona lifecycle management: elevates personas to first class discovery |
| `0x000052` | UI/Panels | `hitl-control-panel` | HITL control panel UI: visual interface for managing human loop |
| `0x000053` | Storage/Persistence | `backup-restore` | Backup and restore system: automatic backups restore capabilities for |
| `0x000055` | Tool/Execution | `sentinel-tools` | Sentinel research-strategy tools: specialized tools for research synthesize implement |
| `0x000056` | UI/Panels | `tool-execution-panel` | Tool execution panel: real-time visual tool execution with cards |
| `0x000057` | Infrastructure | `worker-pool` | Worker pool parallelization: parallel execution of tools computations across |
| `0x000058` | UI/Panels | `diff-viewer-ui` | Prism.js diff viewer: rich visual diff with syntax highlighting |
| `0x00005A` | Agent/Orchestration | `hitl-controller` | HITL controller: centralized control over human in loop execution |
| `0x00005B` | Infrastructure | `hot-reload` | Hot module reload: dynamic code replacement without losing state |
| `0x00005D` | Storage/Persistence | `git-vfs` | Git VFS version control: provides commit history rollback capabilities |
| `0x00005E` | UI/Dashboard | `module-dashboard` | Module dashboard orchestration: unified dashboard auto discovers renders widgets |
| `0x000060` | Runtime/Python | `pyodide-worker` | Pyodide worker visualization: Web Component for monitoring sandboxed runtime |
| `0x000061` | Testing/Verification | `verification-worker` | Verification worker sandboxing: isolated environment for running verification tasks |
| `0x000062` | Visualization | `penteract-visualizer` | Penteract consensus visualizer: real-time visualization of Penteract test results |
| `0x000063` | Infrastructure | `event-bus` | Event bus infrastructure: foundational pub sub system for decoupling |
| `0x000064` | Agent/FSM | `sentinel-fsm` | Sentinel FSM state machine: robust finite state machine managing workflow |
| `0x000065` | UI/Panels | **RESERVED** | Thought stream panel RESERVED displays agent reasoning with export |
| `0x000066` | UI/Panels | **RESERVED** | Goal management panel RESERVED displays edits tracks current goal |
| `0x000067` | Meta/Config | *(meta/config)* | VFS tools manifest: documents version control tools providing operations |
| `0x000068` | Meta/Config | *(meta/config)* | System tools manifest: documents core system operation tools for |
| `0x000069` | UI/Panels | **RESERVED** | Sentinel approval panel RESERVED context proposal approval UI toggle |
| `0x00006A` | UI/Panels | **RESERVED** | Progress tracker RESERVED 8-step progress visualization showing FSM state |
| `0x00006B` | UI/Panels | **RESERVED** | Status bar RESERVED displays agent state progress with buttons |
| `0x00006C` | UI/Panels | **RESERVED** | Log panel RESERVED filterable event log with color coding |

---

## Reserved Blueprint IDs (UI Refactoring)

These IDs are reserved for the UI refactoring initiative (CLUSTER 1 & 2):

| Blueprint | Module | Cluster | Status | Expected Completion |
|-----------|--------|---------|--------|---------------------|
| `0x000065` | `thought-panel.js` | CLUSTER 2 | Planned | Week 2 |
| `0x000066` | `goal-panel.js` | CLUSTER 2 | Planned | Week 3 |
| `0x000069` | `sentinel-panel.js` | CLUSTER 2 | Planned | Week 4 |
| `0x00006A` | `progress-tracker.js` | CLUSTER 1 | Planned | Week 1 |
| `0x00006B` | `status-bar.js` | CLUSTER 1 | Planned | Week 2 |
| `0x00006C` | `log-panel.js` | CLUSTER 1 | Planned | Week 1-2 |

---

## Gap Analysis

### Missing Blueprint IDs

| ID | Status | Notes |
|----|--------|-------|
| `0x000059` | GAP | Intentionally skipped or future expansion |
| `0x00005C` | GAP | Intentionally skipped or future expansion |

**Action**: Document reason for gaps or assign to future modules.

---

## Usage Guide

### Finding a Blueprint

**By Module Name**:
```bash
grep "module-name" docs/BLUEPRINT_REGISTRY.md
```

**By Category**:
```bash
grep "Agent/Cognition" docs/BLUEPRINT_REGISTRY.md
```

**By Blueprint ID**:
```bash
grep "0x00002E" docs/BLUEPRINT_REGISTRY.md
```

### Adding a New Blueprint

1. **Reserve ID**: Check for next available hex ID
2. **Assign Category**: Use existing categories or propose new one
3. **Write Description**: Follow 10-word format
4. **Create Blueprint File**: `/blueprints/0x00XXXX-module-name.md`
5. **Create Module**: `/upgrades/module-name.js` with `@blueprint 0x00XXXX`
6. **Create Test**: `/tests/unit/module-name.test.js`
7. **Update This Registry**: Add row to table
8. **Update Mapping**: Add to `BLUEPRINTS_UPGRADES_MAPPING.md`

---

## Integration with Other Documentation

### Related Documents

- **`EVENTBUS_EVENT_CATALOG.md`**: Event contracts for modules
- **`UIMANAGER_API_MIGRATION.md`**: UI refactoring migration guide
- **`BLUEPRINTS_UPGRADES_MAPPING.md`**: 1:1:1:1 correspondence tracking
- **`WEB_COMPONENTS_MIGRATION_TRACKER.md`**: Widget migration status
- **`WEB_COMPONENTS_GUIDE.md`**: Widget implementation guide

### Cross-References

Each blueprint file should reference related blueprints in **Prerequisites** section:

```markdown
**Prerequisites**:
- 0x00004E (Module Widget Protocol)
- 0x000063 (Event Bus Infrastructure)
- 0x00000D (UI Manager)
```

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-10-20 | Initial registry created with 98 blueprints | CLUSTER 1 |
| 2025-10-20 | Added category taxonomy (24 categories) | CLUSTER 1 |
| 2025-10-20 | Reserved 6 IDs for UI refactoring (0x000065, 0x000066, 0x000069-0x00006C) | CLUSTER 1 |
| 2025-10-20 | Documented gaps (0x000059, 0x00005C) | CLUSTER 1 |

---

## Next Steps

- [ ] Phase 0.4: Create Feature Flag Infrastructure docs
- [ ] Phase 0.5: Extend Module Widget Protocol (widget.visible field)
- [ ] Phase 0.6: Create Panel Communication Contract
- [ ] Investigate gaps: 0x000059, 0x00005C
- [ ] Link this registry from main README.md

---

**Maintained By**: CLUSTER 1 (Foundation & Low-Risk Panels)
**Review Cycle**: Update after each new blueprint addition
**Authoritative Source**: This document is the single source of truth for blueprint allocation
