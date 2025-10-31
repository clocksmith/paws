# PAWS Monorepo

**AI development tools for practical multi-agent workflows and recursive self-improvement.**

This monorepo contains three independent projects:
- **PAWS CLI** (TypeScript + Python) - Multi-agent code generation tools
- **REPLOID** - Browser-native self-improving AI agent
- **MCP Lens** - Protocol analytics for MCP servers

**Current Status:** Beta (v0.9) - Core functionality working, experimental features in progress

---

## Quick Start

### PAWS CLI
```bash
pnpm install
npx cats src/**/*.ts -o context.md
npx dogs changes.md --interactive
```

### REPLOID
```bash
cd reploid
pnpm install
pnpm start
# Open http://localhost:8000
```

---

## PAWS CLI - Multi-Agent Code Generation

**Command-line tools for AI-driven development workflows.**

### Core Tools (Production Ready)

**`cats`** - Bundle code into AI-consumable markdown
```bash
cats src/**/*.ts -o context.md
cats --ai-curate "refactor authentication" -o context.md
```

**`dogs`** - Apply code changes from AI responses
```bash
dogs changes.md --interactive
dogs changes.md --auto-apply
```

### Advanced Tools (Experimental)

**`paws-arena`** - Multi-model competition with test verification
- Runs multiple LLMs in parallel (Gemini, Claude, GPT, Ollama)
- Isolated git worktrees for each model
- Test-driven selection of best solution

**`paws-swarm`** - Collaborative multi-agent workflows
- Task decomposition across models
- Message passing between agents
- Coordinated solution building

**`paws-benchmark`** - LLM performance comparison
- Cost tracking across models
- Success rate analysis
- Your codebase as benchmark

**`paws-context-optimizer`** - Smart context pruning
- AST-based dependency analysis
- Handles large codebases
- Removes unused code from context

**`paws-session`** - Stateful workflow management
- Git worktree isolation
- Multi-turn conversations
- Session history tracking

### Dual Implementation

Both **TypeScript** (`packages/cli-js/`) and **Python** (`packages/cli-py/`) implementations are maintained.

**TypeScript:**
- Better Node.js/npm ecosystem integration
- Native MCP/VS Code extension support
- Install: `pnpm install`

**Python:**
- Simpler deployment (single file)
- Better for AI/ML toolchains
- Install: `pip install -e packages/cli-py`

---

## REPLOID - Browser-Native Self-Improving Agent

**AI agent with Level 2 RSI (meta-improvement) running entirely in your browser.**

### What It Does

**Core Capabilities:**
- **Level 1 RSI:** Agent creates new tools at runtime
- **Level 2 RSI:** Agent improves its own tool creation mechanism
- **Level 2+ RSI:** Agent modifies any of its core modules

**Architecture (7 modules, ~2,500 lines):**
- VFS (IndexedDB storage)
- LLM Client (4 connection types)
- Tool Runner (built-in + dynamic tools)
- Tool Writer (create tools at runtime)
- Meta-Tool-Writer (improve tool writer itself)
- Agent Loop (main cognitive cycle)
- Chat UI (minimal terminal interface)

**Multi-Model Support:**
- Browser → Cloud (Gemini, Claude, GPT with your API key)
- Proxy → Cloud (server handles API calls)
- Browser → Local (WebLLM via WebGPU)
- Proxy → Local (Ollama via server)

### Genesis System

**First Boot:**
1. Copy `/core/*.js` from disk → IndexedDB
2. This is "genesis" state (factory reset)

**Subsequent Boots:**
1. Load evolved code from IndexedDB
2. Agent continues with improvements it made

**Clear Cache Button:**
- Deletes IndexedDB
- Resets to genesis state

### Example Goals

1. "Create tools to make tools to make tools" - Recursive tool generation
2. "Analyze your own inefficiency patterns and improve yourself" - Self-optimization
3. "Build a self-modifying code generation system" - Meta-programming

---

## MCP Lens - Protocol Analytics

**Analytical tools for understanding MCP (Model Context Protocol) servers.**

MCP Lens is completely independent - it can analyze any MCP server.

**What It Does:**
- Protocol-semantic analysis (why tool calls fail)
- Efficiency patterns (success vs failure)
- Widget protocol (analytical dashboards)
- LLM interaction patterns

**Status:** Independent project, see [`lens/`](lens/README.md)

---

## Project Status

**Current Version:** 0.9.0 (Beta)

### What's Working
- ✅ cats/dogs core (TypeScript + Python)
- ✅ REPLOID RSI capabilities
- ✅ Multi-model support (4 connection types)
- ✅ VFS persistence (IndexedDB)
- ✅ Basic chat UI

### Experimental (Implemented but needs testing)
- ⚠️ paws-arena (multi-agent competition)
- ⚠️ paws-swarm (collaborative workflows)
- ⚠️ paws-benchmark (LLM comparison)
- ⚠️ paws-context-optimizer (smart pruning)
- ⚠️ paws-session (stateful workflows)

---

## Installation

### Prerequisites
- Node.js 16+
- pnpm (recommended) or npm
- Python 3.8+ (for Python CLI)

### Full Install
```bash
# Clone repo
cd paws

# Install all packages
pnpm install

# Optional: Install Python CLI
pip install -e packages/cli-py
```

### Install Individual Projects
```bash
# PAWS CLI only
cd packages/cli-js && pnpm install

# REPLOID only
cd reploid && pnpm install

# Python CLI only
cd packages/cli-py && pip install -e .
```

---

## Configuration

### API Keys (Optional - for cloud models)

**For PAWS CLI:**
```bash
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
```

**For REPLOID:**
Create `reploid/.env`:
```bash
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

**Or:** Use browser-direct connection (enter API key in UI)

---

## Usage Examples

### PAWS CLI - Basic Workflow

```bash
# 1. Bundle context
cats src/auth/**/*.ts -o auth-context.md

# 2. Send to LLM (Claude, ChatGPT, Gemini, etc.)
# Copy auth-context.md contents into chat

# 3. Save LLM response to file
# response.md

# 4. Apply changes interactively
dogs response.md --interactive
```

### PAWS Arena - Multi-Model Competition

```bash
# Run 3 models in competition
paws-arena "Add OAuth2 support to auth module" \
  auth-context.md \
  --models gemini-2.5-flash,claude-4-5-sonnet,gpt-5 \
  --verify-cmd "npm test" \
  --output best-solution.md

# Winner selected based on test results
```

### REPLOID - Self-Improvement Session

```bash
# Start REPLOID
cd reploid && pnpm start

# In browser (http://localhost:8000):
# 1. Add model (e.g., Gemini via proxy)
# 2. Enter goal: "Analyze your tool creation speed and optimize it"
# 3. Click "Awaken Agent"

# Agent will:
# - Read /core/tool-writer.js
# - Identify bottlenecks
# - Generate improved version
# - Call improve_tool_writer(newCode)
# - Hot-reload improved module
```

---

## Testing

```bash
# Test all packages
pnpm test

# Test specific packages
pnpm --filter @paws/cli-js test
pnpm --filter @paws/reploid test
cd packages/cli-py && pytest

# REPLOID end-to-end tests
cd reploid && pnpm test:e2e
```

---

## Philosophy

### Why Dual Language Implementation?

**Intentional design choice:**
- TypeScript: Better for Node.js ecosystem, web integrations
- Python: Better for AI/ML toolchains, simpler single-file scripts
- Maintained in parallel for maximum compatibility

### Why RSI in Browser?

**Substrate-independent self-improvement:**
- Agent's "brain" = data in IndexedDB
- Agent can modify this data (its own code)
- Source files on disk = "genesis" (evolutionary starting point)
- Every agent instance can evolve differently

**Analogy:**
- DNA = source code on disk
- Organism = runtime state in IndexedDB
- Mutations = agent self-modifications
- Fitness = agent-measured improvements

---

## License

MIT
