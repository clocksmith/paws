# PAWS Monorepo

**AI development tools for practical multi-agent workflows and recursive self-improvement.**

## What is this?

AI development tools for practical multi-agent workflows and recursive self-improvement. PAWS CLI orchestrates competitive code generation across multiple LLMs with automated testing. REPLOID is a browser-native agent that evolves its own code at runtime. MCP Lens provides protocol-semantic analysis for understanding tool interactions beyond simple metrics.

---

## Projects

Three operationally independent tools, unified by recursive improvement:
- **PAWS CLI** (TypeScript + Python) - Multi-agent code generation
- **REPLOID** - Browser-native RSI agent
- **MCP Lens** - Protocol analytics

---

## PAWS CLI - Multi-Agent Code Generation

**P**repare **A**rtifacts **W**ith **S**WAP (**S**treamlined **W**rite **A**fter **P**AWS)
→ PAWS → SWAP → PAWS → SWAP → ∞

Command-line tools for AI-driven development workflows.

**Core Tools:** `cats` (bundle code) + `dogs` (apply changes)
**Advanced:** Arena (competitive), Swarm (collaborative), Benchmarking, Context optimization

→ [Full CLI Documentation](packages/cli-js/README.md)

## REPLOID - Browser-Native Self-Improving Agent

**R**ecursive **E**volutionary **P**rotocol **L**earning **O**rganism with **I**terative **D**evelopment via **DREAMER**
→ **D**ynamic **R**ecursive **E**volution **A**gent **M**utating **E**ach **R**EPLOID
→ REPLOID ↔ DREAMER ↔ ∞

**AI agent with RSI running entirely in your browser.**

### What It Does

**Core Capabilities:**
- **Level 1 RSI:** Agent creates new tools at runtime
- **Level 2 RSI:** Agent improves its own tool creation mechanism
- **Level 3 RSI:** Agent loads evolved code as living components

**24 Built-in Tools:**
LCRUD-Core
- VFS (Virtual File System) operations (5): read, write, update, delete, list files
- Tool creation (5): read, create, update, delete, list tools
Advanced RSI
- Meta-improvement (3): improve core modules, improve tool writer, rollback
- Substrate manipulation (10): load widgets, create web components, execute code

**Multi-Model Support:** Browser/Proxy → Cloud/Local (Gemini, Claude, GPT, Ollama, WebLLM)

→ [Full REPLOID Documentation](reploid/README.md)

---

## MCP Lens - Protocol Analytics

Protocol-semantic analysis for MCP servers.

**Capabilities:** Tool invocation patterns, failure analysis, efficiency metrics, cross-server causality
**Architecture:** Client-side Web Components, no server modifications required

→ [Full MCP Lens Documentation](lens/README.md)

---

## Quick Start

```bash
# Full monorepo
pnpm install

# Individual projects
cd packages/cli-js && pnpm install  # PAWS CLI
cd reploid && pnpm start            # REPLOID (opens http://localhost:8000)
cd packages/cli-py && pip install -e .  # Python CLI
```

See project-specific READMEs for detailed usage.

---

## PAWS Project Status

### What's Working
- ✅ cats/dogs core (TypeScript + Python)
- ✅ REPLOID RSI capabilities (24 CRUD tools)
- ✅ Multi-model support (4 connection types)
- ✅ VFS persistence (IndexedDB)
- ✅ Agent Execution Monitor + Code Viewer

### Experimental (Implemented but needs testing)
- ⚠️ paws-arena (multi-agent competition)
- ⚠️ paws-swarm (collaborative workflows)
- ⚠️ paws-benchmark (LLM comparison)
- ⚠️ paws-context-optimizer (smart pruning)
- ⚠️ paws-session (stateful workflows)


---

## License

MIT
