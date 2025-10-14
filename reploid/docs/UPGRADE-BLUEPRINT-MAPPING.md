# Upgrade-Blueprint Mapping Reference

**Last Updated:** 2025-10-04

This document provides a comprehensive 1:1 mapping between REPLOID upgrades (modules) and blueprints (knowledge documents), identifying gaps and recommending additions for complete RSI capability.

---

## 📊 Summary Statistics

- **Total Upgrades:** 57
- **Total Blueprints:** 25
- **Mapped (with blueprint):** 19 (33%)
- **Missing Blueprints:** 38 (67%)
- **Critical RSI Gaps:** 8 blueprints needed

---

## ✅ Fully Mapped Upgrades → Blueprints

These upgrades have corresponding blueprint documentation:

| Upgrade | Module | Blueprint | Document | Status |
|---------|--------|-----------|----------|--------|
| **PRMT** | prompt-system.md | **0x000001** | system-prompt-architecture.md | ✅ |
| **APPL** | app-logic.js | **0x000002** | application-orchestration.md | ✅ |
| **UTIL** | utils.js | **0x000003** | core-utilities-and-error-handling.md | ✅ |
| **STMT** | state-manager.js | **0x000005** | state-management-architecture.md | ✅ |
| **STHP** | state-helpers-pure.js | **0x000006** | pure-state-helpers.md | ✅ |
| **APIC** | api-client.js | **0x000007** | api-client-and-communication.md | ✅ |
| **CYCL** | agent-cycle.js | **0x000008** | agent-cognitive-cycle.md | ✅ |
| **AGLP** | agent-logic-pure.js | **0x000009** | pure-agent-logic-helpers.md | ✅ |
| **TRUN** | tool-runner.js | **0x00000A** | tool-runner-engine.md | ✅ |
| **TRHP** | tool-runner-pure-helpers.js | **0x00000B** | pure-tool-logic-helpers.md | ✅ |
| **WRKR** | tool-worker.js | **0x00000C** | sandboxed-tool-worker.md | ✅ |
| **UIMN** | ui-manager.js | **0x00000D** | ui-manager.md | ✅ |
| **STYL** | ui-style.css | **0x00000E** | ui-styling-css.md | ✅ |
| **BODY** | ui-body-template.html | **0x00000F** | ui-body-template-html.md | ✅ |
| **TLRD** | tools-read.json | **0x000010** | static-tool-manifest.md | ✅ |
| **IDXB** | storage-indexeddb.js | **0x000011** | advanced-storage-backend-indexeddb.md | ✅ |
| **EVAL** | tool-evaluator.js | **0x000012** | structured-self-evaluation.md | ✅ |
| **SCFG** | system-config.json | **0x000013** | system-configuration-structure.md | ✅ |
| **SCRT** | system-scratchpad.md | **0x000014** | working-memory-scratchpad.md | ✅ |
| **STLD** | system-tools-dynamic.json | **0x000015** | dynamic-tool-creation.md | ✅ |

---

## ⚠️ Missing Blueprints (Critical RSI Modules)

These RSI-critical upgrades lack blueprint documentation:

### Priority 1: Core RSI Capabilities

| Upgrade | Module | Missing Blueprint | Recommended ID | Priority |
|---------|--------|------------------|----------------|----------|
| **INTR** | introspector.js | Code Introspection & Self-Analysis | **0x00001B** | 🔴 Critical |
| **REFL** | reflection-store.js | Persistent Reflection Storage | **0x00001C** | 🔴 Critical |
| **TEST** | self-tester.js | Self-Testing Framework | **0x00001D** | 🔴 Critical |
| **BAPI** | browser-apis.js | Browser API Integration for RSI | **0x00001E** | 🔴 Critical |
| **REAN** | reflection-analyzer.js | Pattern Recognition & Learning | **0x00001F** | 🔴 Critical |
| **RESRCH** | reflection-search.js | Semantic Search Over Reflections | **0x000020** | 🔴 Critical |
| **PMON** | performance-monitor.js | Performance Monitoring for RSI | **0x000021** | 🟡 High |
| **TLWR** | tools-write.json | Write Tools (Self-Modification) | **0x000022** | 🔴 Critical |

### Priority 2: Advanced Capabilities

| Upgrade | Module | Missing Blueprint | Recommended ID | Priority |
|---------|--------|------------------|----------------|----------|
| **LLMR** | local-llm.js | Local LLM with WebGPU | **0x000023** | 🟡 High |
| **HYBR** | hybrid-llm-provider.js | Hybrid Local/Cloud LLM Switching | **0x000024** | 🟡 High |
| **PYOD** | pyodide-runtime.js | Python Execution via Pyodide | **0x000025** | 🟡 High |
| **PYTH** | python-tool.js | Python Tool Interface | **0x000026** | 🟢 Medium |
| **SWRM** | swarm-orchestrator.js | Multi-Agent Swarm Intelligence | **0x000027** | 🟡 High |
| **COST** | cost-tracker.js | API Cost Tracking & Budget Management | **0x000028** | 🟢 Medium |
| **TDOC** | tool-doc-generator.js | Auto-Generated Tool Documentation | **0x000029** | 🟢 Medium |

### Priority 3: Supporting Infrastructure

| Upgrade | Module | Missing Blueprint | Recommended ID | Priority |
|---------|--------|------------------|----------------|----------|
| **MLDR** | boot-module-loader.js | Standardized Module Loader | **0x00002A** | 🟢 Medium |
| **MMNF** | module-manifest.json | Module Dependency Manifest | **0x00002B** | 🟢 Medium |
| **APMC** | api-client-multi.js | Multi-Provider API Client | **0x00002C** | 🟢 Medium |
| **CFMD** | confirmation-modal.js | Confirmation Dialog UI | **0x00002D** | ⚪ Low |
| **VFSX** | vfs-explorer.js | Enhanced VFS File Explorer | **0x00002E** | ⚪ Low |
| **CNVS** | canvas-visualizer.js | 2D Canvas Visualization | **0x00002F** | 🟢 Medium |
| **VDAT** | viz-data-adapter.js | Visualization Data Adapter | **0x000030** | 🟢 Medium |
| **MDSH** | metrics-dashboard.js | Visual Metrics Dashboard | **0x000031** | 🟢 Medium |
| **AVIS** | agent-visualizer.js | FSM State Machine Visualization | **0x000032** | 🟢 Medium |
| **ASTV** | ast-visualizer.js | JavaScript AST Visualization | **0x000033** | 🟢 Medium |
| **MGRV** | module-graph-visualizer.js | Module Dependency Graph | **0x000034** | 🟢 Medium |
| **TSTN** | toast-notifications.js | Toast Notification System | **0x000035** | ⚪ Low |
| **RATE** | rate-limiter.js | API Rate Limiting | **0x000036** | 🟢 Medium |
| **MINT** | module-integrity.js | Module Signing & Verification | **0x000037** | 🟡 High |
| **AUDT** | audit-logger.js | Security Audit Logging | **0x000038** | 🟡 High |
| **TUTR** | tutorial-system.js | Interactive Tutorial System | **0x000039** | ⚪ Low |
| **TOAN** | tool-analytics.js | Tool Usage Analytics | **0x00003A** | 🟢 Medium |
| **TABC** | tab-coordinator.js | Inter-Tab Coordination | **0x00003B** | 🟢 Medium |

---

## 📚 Existing Meta-Blueprints (No Direct Upgrade)

These blueprints provide meta-knowledge rather than implementation docs:

| Blueprint | Document | Purpose | Status |
|-----------|----------|---------|--------|
| **0x000016** | meta-tool-creation-patterns.md | How to design new tools | ✅ Meta |
| **0x000017** | goal-modification-safety.md | Safe goal evolution patterns (GMOD) | ✅ Meta |
| **0x000018** | blueprint-creation-meta.md | How to create blueprints (BLPR) | ✅ Meta |
| **0x000019** | visual-self-improvement.md | Visual RSI patterns (CNVS) | ✅ Meta |
| **0x00001A** | rfc-authoring.md | How to write RFCs | ✅ Meta |

**Note:** Blueprints 0x000017-0x000019 have partial upgrade associations:
- 0x000017 → GMOD (goal-modifier.js)
- 0x000018 → BLPR (blueprint-creator.js)
- 0x000019 → CNVS (canvas-visualizer.js)

---

## 🎯 Minimal RSI Core (8 Modules)

The new `minimalRSICore` configuration includes only essential modules for self-evolution:

| Upgrade | Module | Has Blueprint? | Blueprint ID |
|---------|--------|----------------|--------------|
| **APPL** | app-logic.js | ✅ Yes | 0x000002 |
| **UTIL** | utils.js | ✅ Yes | 0x000003 |
| **STMT** | state-manager.js | ✅ Yes | 0x000005 |
| **IDXB** | storage-indexeddb.js | ✅ Yes | 0x000011 |
| **APIC** | api-client.js | ✅ Yes | 0x000007 |
| **CYCL** | agent-cycle.js | ✅ Yes | 0x000008 |
| **TLRD** | tools-read.json | ✅ Yes | 0x000010 |
| **TLWR** | tools-write.json | ❌ **MISSING** | 0x000022 (proposed) |

**Critical Gap:** TLWR (write tools) lacks blueprint despite being essential for self-modification!

---

## 🔄 Recommended Next Steps

### Phase 1: Critical RSI Blueprints (Top Priority)
Create these 8 blueprints to document core RSI capabilities:

1. **0x00001B** - Code Introspection & Self-Analysis (INTR)
2. **0x00001C** - Persistent Reflection Storage (REFL)
3. **0x00001D** - Self-Testing Framework (TEST)
4. **0x00001E** - Browser API Integration (BAPI)
5. **0x00001F** - Pattern Recognition & Learning (REAN)
6. **0x000020** - Semantic Search Over Reflections (RESRCH)
7. **0x000021** - Performance Monitoring (PMON)
8. **0x000022** - Write Tools for Self-Modification (TLWR) ← **Most Critical**

### Phase 2: Advanced Capabilities
Document these 7 advanced features:

9. **0x000023** - Local LLM with WebGPU (LLMR)
10. **0x000024** - Hybrid LLM Switching (HYBR)
11. **0x000025** - Python Execution via Pyodide (PYOD)
12. **0x000026** - Python Tool Interface (PYTH)
13. **0x000027** - Multi-Agent Swarm (SWRM)
14. **0x000028** - Cost Tracking (COST)
15. **0x000029** - Tool Doc Generator (TDOC)

### Phase 3: Infrastructure & Polish
Complete remaining 23 blueprints for full coverage (0x00002A - 0x00003B).

---

## 🔗 Updated Config Structure

Add `blueprint` field to each upgrade in `config.json`:

```json
{
  "id": "INTR",
  "path": "introspector.js",
  "description": "Code introspection and self-analysis for RSI",
  "category": "introspection",
  "blueprint": "0x00001B"  ← NEW FIELD
}
```

This enables:
- Runtime lookup of blueprints for any upgrade
- Agent can self-educate by reading blueprints
- Clearer 1:1 mapping for maintainability

---

## 📈 Coverage Progress

| Category | Upgrades | Blueprints | Coverage |
|----------|----------|------------|----------|
| **Core** | 7 | 6 | 86% |
| **Agent** | 6 | 5 | 83% |
| **Tools** | 7 | 3 | 43% |
| **UI** | 7 | 5 | 71% |
| **RSI/Learning** | 6 | 0 | 0% ← **Critical Gap!** |
| **Visualization** | 6 | 1 | 17% |
| **Security** | 4 | 0 | 0% |
| **Runtime** | 4 | 0 | 0% |
| **Service** | 4 | 0 | 0% |
| **Storage** | 3 | 2 | 67% |
| **Experimental** | 3 | 3 | 100% |
| **TOTAL** | **57** | **25** | **44%** |

**RSI/Learning modules have ZERO blueprint coverage despite being central to the project's mission!**

---

## 🎓 Blueprint Template

When creating new blueprints, follow this structure:

```markdown
# Blueprint 0x00001B: Code Introspection & Self-Analysis

**Objective:** To enable the agent to analyze its own source code, dependencies, and architecture for self-improvement.

**Target Upgrade:** INTR (introspector.js)

**Prerequisites:** UTIL, STMT, TLRD

**Affected Artifacts:** `/upgrades/introspector.js`, `/vfs/modules/`

---

### 1. The Strategic Imperative
[Why this capability is essential for RSI]

### 2. The Architectural Solution
[How the module is designed and structured]

### 3. The Implementation Pathway
[Step-by-step guide to building or modifying this module]

### 4. Self-Improvement Opportunities
[How the agent can use this to evolve itself]

### 5. Testing & Validation
[How to verify the module works correctly]
```

---

*This mapping will be updated as new blueprints are created and the system evolves.*
