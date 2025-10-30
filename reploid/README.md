# REPLOID

**Browser-Native AI Agent with MCP and Lens Architecture**

REPLOID is a browser-based AI agent environment exposing capabilities via Model Context Protocol (MCP) with Lens widget UI. Backend proxy optional. Runs in-browser using IndexedDB and Web Workers.

---

## Core Philosophy

**Modular agent architecture with human oversight via approval workflows.**

1. **MCP Servers** - Expose agent capabilities as tools/resources/prompts via JSON-RPC 2.0
2. **Lens Widgets** - TypeScript web components for human oversight UI
3. **Multi-Model Mixing** - Combine Gemini, Claude, GPT-4, local models
4. **Browser-Native** - Client-side using VFS (LightningFS + isomorphic-git)

---

## Quick Start

```bash
# 1. Install dependencies
cd reploid
pnpm install

# 2. Start the proxy server (handles LLM API calls)
pnpm start  # http://localhost:8000

# 3. Open browser
# Navigate to http://localhost:8080

# 4. Select boot preset
# Choose "CORE" (recommended)

# 5. Enter a goal
"Show me what MCP servers are available"

# 6. Watch the agent work
# - Loads modules from VFS
# - Agent uses MCP tools via approval workflows
# - Streaming responses in real-time
```

---

## How It Works

**Boot process (Genesis Cycle 0):**

1. **Boot Screen** - Select preset (CORE/HEADLESS/COMPLETE) and enter goal
2. **Download Modules** - Load from `/upgrades/` directory, save to VFS (IndexedDB via LightningFS)
3. **Initialize VFS** - Mount isomorphic-git, load module-manifest.json
4. **Load Modules** - DI Container resolves dependencies, MCP servers register tools/resources/prompts
5. **Mount Lens Widgets** - TypeScript UI components connect to MCP servers for approval workflows
6. **Execute Goal** - Agent runs cognitive loop, uses MCP tools, Lens provides oversight

---

## Boot Presets

REPLOID offers 3 module presets:

### CORE (64 modules) **← RECOMMENDED**
**Complete RSI agent with full UI and in-browser MCP protocol servers**

Includes:
- **Core Infrastructure** (25 modules) - Agent cognitive loop, VFS (LightningFS + isomorphic-git), DI container
- **MCP Infrastructure** (5 modules) - Protocol implementation, JSON-RPC 2.0 transport
- **MCP Servers** (24 Tier 1-3 servers) - In-browser protocol servers exposing tools/resources/prompts
- **UI Modules** (6 modules) - Dashboard, status panels, notifications
- **Personas & Utils** (3 modules) - Code refactorer persona, diff generator

**Best for:** Production use, interactive development, full agent capabilities

---

### HEADLESS (45 modules)
**In-browser MCP protocol server, no UI**

Includes only:
- Core infrastructure + MCP infrastructure
- Agent cycle logic
- Tier 1 MCP servers (essential capabilities only)
- No Lens widgets, no UI modules

**Best for:** CI/CD, APIs, embedded systems, server-side deployments

---

### COMPLETE (85 modules) **EXPERIMENTAL**
**Everything including experimental in-browser MCP servers**

Everything in CORE, plus:
- **9 Experimental MCP Servers** (Tier 4) - Advanced capabilities
- **Python Runtime** - Pyodide WebAssembly execution
- **WebRTC P2P** - Browser-to-browser agent coordination
- **Advanced Features** - Goal modification, peer consensus, tutorials

**Best for:** Research, experimentation, bleeding-edge features

---

## Key Features

### 77 Modular Upgrades

**Module Organization:**
- **Core** (62 modules) - Agent logic, MCP servers, tools, LLM providers, VFS
- **UI** (16 modules) - Panels, visualizers, dashboards, notifications, Lens widgets
- **Archived** (11 modules) - Unused/experimental features

MCP server architecture with Lens widget dashboards for approval workflows and real-time monitoring.

Each module is self-contained with:
- DI container pattern for dependency injection
- Web Component widget for visualization
- Blueprint document explaining design decisions
- Unit tests for reliability

### Virtual File System (VFS)

Browser-native storage using IndexedDB:
- Stores all modules, blueprints, and state
- Persists across sessions
- Supports import/export
- Git-like checkpoint system

### Multi-Model Mixing

Use multiple LLMs in a single workflow - mix Gemini for speed, Claude for reasoning, GPT-4 for code, or local models for privacy.

**Supported Providers:**
- ☁️ Cloud: Gemini, Claude (Anthropic), GPT-5 (OpenAI)
- 🖥️ Local: Ollama (via proxy), WebGPU (in-browser)

### Meta-Tool Creation

Agents can create new tools for themselves dynamically. Tools are registered in the runtime and immediately available for use.

### Recursive Self-Improvement (RSI)

Agent can modify its own code with safety:

**Safety Guardrails:**
1. **Checkpoints** - Git-like snapshots before changes
2. **Test Verification** - Changes must pass tests
3. **Human Approval** - All modifications require confirmation
4. **Automatic Rollback** - Revert on test failure
5. **Blueprint Compliance** - Changes must follow design patterns

### Web Component Widgets

Every module has a visual dashboard with real-time status monitoring, interactive controls, scoped styles (Shadow DOM), and event-driven updates.

### Blueprint System

67+ architectural blueprints guide development with design patterns, implementation strategies, trade-off analysis, code examples, and test requirements.

---

## Configuration

Edit `config.json` or use the boot UI to:
- Select boot mode (headless/minimal-rsi/rsi-core/experimental)
- Configure LLM providers (API keys, endpoints)
- Set model preferences
- Adjust module loading
- Configure permissions

**Module Manifest (`module-manifest.json`):**
- Defines 4 presets with specific module lists
- Controls load order via dependency groups
- Maps module paths to IDs

---

## Testing

```bash
# Run unit tests
pnpm test

# Run with coverage
pnpm run test:coverage

# Run end-to-end tests
pnpm run test:e2e

# Run specific test
pnpm test tests/unit/tool-runner.test.js
```

**Test Pattern:**
Every module has a corresponding unit test:
- `upgrades/core/tool-runner.js` → `tests/unit/tool-runner.test.js`
- Tests cover API methods, error handling, edge cases
- Widgets tested separately with DOM mocking

---

## Advanced Features

### Python Runtime (Pyodide)
Execute Python code via WebAssembly (experimental preset).

### Local LLM (WebGPU)
Run models entirely in browser (experimental preset).

### WebRTC P2P Swarm
Browser-to-browser agent coordination (experimental preset).

---

## Relationship to PAWS Monorepo

REPLOID is part of the PAWS monorepo but is a **standalone project**.

**Shared with PAWS:**
- Philosophy (multi-agent, human-in-loop, context engineering)
- Some utilities (personas, system prompts)

**Not shared:**
- Runtime (browser vs CLI)
- Storage (VFS/IndexedDB vs filesystem)
- Primary use case (self-improvement vs multi-agent competition)

**See:** [../README.md](../README.md) for monorepo overview

---

## FAQ

**Q: Which boot mode should I start with?**
A: **RSI-Core** (46 modules). It has the full UI and core RSI features without overwhelming complexity.

**Q: Is this actually running in the browser?**
A: Yes! 100% browser-native. No backend server required (except optional proxy for LLM API calls).

**Q: Can agents modify their own code?**
A: Yes.

**Q: How does this differ from Claude Code?**
A: Claude Code is a CLI tool. REPLOID runs in browser with VFS, can modify itself, supports multi-model mixing, and has P2P swarm capabilities.

**Q: Can I use this offline?**
A: Yes! VFS/modules work offline, but cloud LLM queries need network (unless using local WebGPU models or Ollama).


## License

MIT
