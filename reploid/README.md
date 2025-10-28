# REPLOID

**[Browser-Native AI Agent with Recursive Self-Improvement](https://github.com/clocksmith/paws/tree/main/reploid)**

REPLOID is a fully browser-based AI agent environment that can introspect and modify its own code. Backend proxy is optional. Everything runs in your browser using IndexedDB, WebGPU, and Web Workers.

---

## Core Philosophy

**Agents should be able to improve themselves, with human oversight.**

1. **Meta-Tool Creation** - Tools that create other tools
2. **Multi-Model Mixing** - Combine Gemini, Claude, GPT-4, local models, WebGPU
3. **Browser-Native** - 100% client-side using modern web APIs
4. **Recursive Self-Improvement** - Modify own code with safety guardrails

---

## Quick Start

```bash
# 1. Install dependencies
cd reploid
npm install

# 2. Start the proxy server (handles LLM API calls)
npm start  # http://localhost:8000

# 3. Open browser
# Navigate to http://localhost:8080

# 4. Select boot mode
# Choose "RSI-Core" (recommended)

# 5. Enter a goal
"Analyze the current module dependencies and suggest optimizations"

# 6. Watch the agent work
# - Loads modules from VFS
# - Introspects code
# - Proposes changes
# - Requests approval
```

---

## How It Works

**Simple 5-step boot process:**

1. **Boot Screen** → Select modules to load and enter your goal
2. **Download Modules** → Upgrades downloaded from server, saved to VFS (IndexedDB)
3. **Load Dependencies** → DI Container resolves and loads modules in dependency order
4. **Initialize Agent** → Cognitive loop starts with optional persona
5. **Execute Goal** → Agent uses available tools, streaming responses in real-time

**The 1:1:1:1 Pattern:**

Every module follows this pattern:
- **1 Module** (`upgrades/core/tool-runner.js`) - JavaScript with DI container pattern
- **1 Blueprint** (`blueprints/0x00000A-tool-runner.md`) - Design documentation that can substitute a module (experimetnal)
- **1 Test** (`tests/unit/tool-runner.test.js`) - Unit tests
- **1 Widget** (defined in same file) - Web Component for visualization

---

## Boot Modes

REPLOID offers 4 progressive tiers to match your use case:

### Headless (31 modules, ~15K lines)
**Perfect for headless/server operation**

Pure functional modules without UI:
- Agent cognitive loop
- Virtual file system (VFS)
- Tool execution
- State management
- Multi-model LLM support

**Best for:** Headless agents, server deployments, CI/CD, automated workflows

---

### Minimal-RSI (35 modules, ~18K lines)
**Core RSI features with basic UI**

Everything in Headless, plus:
- Basic UI panels (VFS explorer, diff viewer, sentinel control)
- Visual feedback for agent operations
- Interactive approval workflows

**Best for:** Learning REPLOID, interactive development, tutorials

---

### RSI-Core (46 modules, ~23K lines) **← RECOMMENDED**
**Full RSI with comprehensive UI**

Everything in Minimal-RSI, plus:
- Complete UI dashboard (goals, thoughts, logs, status, metrics)
- Performance monitoring and analytics
- Progress tracking and notifications
- Agent state visualization

**Best for:**
- Production projects
- Self-improving agents
- Interactive development
- Core REPLOID vision

---

### Experimental (56 modules, ~35K lines)
**Every feature for research and power users**

Everything in RSI-Core, plus:
- **Visualization suite** - AST trees, module graphs, canvas rendering
- **Python runtime** - Execute Python via Pyodide + WebAssembly
- **Local LLM** - WebGPU-accelerated local inference
- **WebRTC swarm** - P2P browser-to-browser coordination
- **Advanced tools** - Tutorial system, confirmation modals, app logic helpers
- And 10+ more specialized modules...

**Best for:**
- Research and experimentation
- Power users who want everything
- Multi-agent systems
- Bleeding-edge features

---

## Key Features

### 79 Modular Upgrades

**Module Organization:**
- **Core** (63 modules) - Agent logic, state management, tools, LLM providers, VFS
- **UI** (16 modules) - Panels, visualizers, dashboards, notifications
- **Archived** (11 modules) - Unused/experimental features

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
npm test

# Run with coverage
npm run test:coverage

# Run end-to-end tests
npm run test:e2e

# Run specific test
npm test tests/unit/tool-runner.test.js
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
