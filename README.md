# PAWS Monorepo

**A collection of AI development tools with a shared philosophy: practical multi-agent workflows and recursive self-improvement.**

This monorepo contains separate but complementary projects:
- **PAWS CLI** - Command-line tools for multi-agent code generation
- **REPLOID** - Browser-native recursive self-improvement agent
- **MCP Lens** - Protocol-semantic analytics for MCP servers

---

## Projects Overview

### PAWS CLI - Multi-Agent Code Generation

**Command-line tools for context-driven AI workflows with competitive verification.**

**Philosophy:** Multiple AI agents generate solutions in parallel. Tests pick the winner. No consensus, just verification.

#### What It Does

1. **`cats`** - Bundle code into AI-consumable context (with AI-assisted file selection)
2. **`dogs`** - Extract and apply code changes from AI responses (with git safety)
3. **`paws-arena`** - Run multiple LLMs in parallel, isolated git worktrees, test-driven selection
4. **`paws-swarm`** - Collaborative multi-agent workflows (Architect → Implementer → Reviewer)
5. **`paws-benchmark`** - Compare LLM performance on your codebase
6. **`paws-context-optimizer`** - Handle large codebases with smart context pruning

**Status:** ✅ Fully implemented in both JavaScript and Python

**Location:** [`packages/cli-js/`](packages/cli-js/README.md), [`packages/cli-py/`](packages/cli-py/README.md)

**Quick Start:**
```bash
# Install
pnpm install
cd packages/cli-py && pip install -e .

# Basic workflow
paws-cats src/**/*.js -o context.md
paws-arena "Refactor auth to use OAuth2" context.md --verify-cmd "npm test"
paws-dogs workspace/competition/winning_solution.md --interactive
```

**See:** [EXAMPLES.md](EXAMPLES.md) for detailed workflows

---

### REPLOID - Browser-Native Agent Environment

**Self-modifying AI agent that runs entirely in your browser.**

**Philosophy:** Agents should be able to introspect and modify their own code, with human oversight.

#### What It Does

- **76 modular upgrades** following 1:1:1:1 pattern (Module : Blueprint : Test : Widget)
- **Meta-tool creation** - Tools that create other tools
- **Multi-model mixing** - Gemini, Claude, GPT-4, local models (Ollama), WebGPU inference
- **Virtual File System** - IndexedDB-backed storage
- **Web Component widgets** - Visual dashboard for all modules
- **Recursive Self-Improvement** - Modify own code with checkpoints and test verification
- **WebRTC P2P swarm** - Browser-to-browser agent coordination
- **Python runtime** - Pyodide + WebAssembly for Python execution

**Status:** ✅ Fully implemented with 4 boot tiers

**Location:** [`reploid/`](reploid/README.md)

**Quick Start:**
```bash
cd reploid
npm install
npm start  # Starts proxy server on http://localhost:8000

# Open browser to http://localhost:8080
# Select boot mode (Essential/Meta/Full/Experimental)
# Enter goal and let agent work
```

**See:** [reploid/README.md](reploid/README.md) for architecture details

---

### MCP Lens - Protocol-Semantic Analytics for MCP

**Analytical-level understanding of Model Context Protocol servers.**

**Philosophy:** Understanding *how* LLMs interact with MCP servers requires protocol-semantic analysis, not just resource metrics.

#### What It Does

- **Protocol-semantic analysis** - Understand why tool calls fail, capability negotiation patterns, schema compliance
- **Cross-server correlation** - Track semantic dependencies across multiple MCP servers
- **Efficiency analysis** - Identify tool patterns that lead to success vs. failure
- **Widget protocol** - Build analytical dashboards as Web Components
- **LLM interaction patterns** - Analyze how LLMs use tools over time

**Status:** ✅ Protocol defined, strategic positioning validated (Oct 2025)

**Location:** [`lens/`](lens/README.md)

**Note:** MCP Lens is completely independent. It can analyze any MCP server, including potential future PAWS/REPLOID MCP servers.

---

## Shared Philosophy

While these projects are independent, they share common values:

**1. Human-in-the-Loop by Default**
- All potentially destructive operations require approval
- Git checkpoints before major changes
- Test verification before accepting solutions

**2. Context Engineering**
- Curating what AI sees is as important as how you prompt
- Smart file selection over dumping entire codebases
- Context bundling for reproducibility

**3. Multi-Model Mixing**
- No single model is best for everything
- Let models compete or collaborate
- Benchmark on your specific codebase

**4. Recursive Self-Improvement**
- Agents should be able to modify themselves
- With guardrails: tests, checkpoints, human approval
- Code should be introspectable and modifiable

**5. No Vendor Lock-in**
- CLI tools work with any LLM provider
- REPLOID supports local models (Ollama, WebGPU)
- Everything uses open standards (MCP, git, markdown)

---

## Package Structure

```
paws/
├── packages/
│   ├── cli-js/          # PAWS CLI in JavaScript
│   ├── cli-py/          # PAWS CLI in Python
│   ├── core/            # Shared resources (personas, prompts)
│   └── parsers/         # Shared CATS/DOGS bundle parsers
├── reploid/             # Browser-native agent environment
├── lens/                # MCP Lens (protocol-semantic analytics)
└── integrations/
    ├── mcp/             # MCP server for PAWS tools
    └── vscode/          # VS Code extension
```

---

## Getting Started

### PAWS CLI Workflows

**Scenario:** Multiple LLMs compete to refactor authentication.

```bash
# 1. Create context bundle with AI-assisted file selection
paws-cats --ai-curate "refactor authentication to OAuth2" -o context.md

# 2. Run multi-agent competition
paws-arena \
  "Refactor auth module to use OAuth2 with token refresh" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py" \
  --config arena_config.json

# 3. Review winning solution
paws-dogs workspace/competition/best_solution.md --interactive

# 4. Apply changes (after approval)
```

**What happens:**
- Gemini, Claude, and GPT-4 generate solutions independently
- Each solution tested in isolated git worktree
- Only passing solutions are presented
- You choose which to apply (or reject all)

---

### REPLOID Self-Improvement

**Scenario:** Agent improves its own error handling.

```bash
# 1. Start REPLOID
cd reploid && npm start

# 2. Open browser to localhost:8080

# 3. Select "Meta-RSI Core" boot mode

# 4. Enter goal:
"Improve error handling in agent-cycle.js based on blueprint 0x000003"

# 5. Agent will:
- Read relevant blueprints
- Analyze current code
- Propose modifications
- Create checkpoint
- Request approval
- Run tests
- Apply changes or rollback
```

**What happens:**
- Agent introspects its own modules
- Uses blueprints as design guides
- Proposes changes with rationale
- Requires human approval
- Tests before applying
- Auto-rollback on test failure

---

## Installation

### Full Monorepo Setup

```bash
# Clone repository
git clone https://github.com/yourusername/paws.git
cd paws

# Install JavaScript dependencies
pnpm install

# Install Python CLI
cd packages/cli-py
pip install -e .
cd ../..

# Install REPLOID dependencies
cd reploid
npm install
cd ..

# Set up API keys (optional, for cloud models)
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
```

### Individual Project Setup

Each project can be installed independently - see their respective READMEs.

---

## Documentation

### PAWS CLI
- [JavaScript CLI README](packages/cli-js/README.md)
- [Python CLI README](packages/cli-py/README.md)
- [EXAMPLES.md](EXAMPLES.md) - Detailed workflows

### REPLOID
- [REPLOID README](reploid/README.md)
- [Architecture Docs](reploid/docs/README.md)
- [Blueprint System](reploid/blueprints/README.md)

### MOP
- [MOP README](mop/README.md)
- [Protocol Specification](mop/specification/README.md)

### General
- [ARCHITECTURE.md](ARCHITECTURE.md) - How projects relate
- [Shared Core](packages/core/README.md) - Personas and prompts

---

## Contributing

Each project has its own patterns:

**PAWS CLI:**
- Standard JavaScript/Python practices
- Tests for all CLI commands
- Documentation for new workflows

**REPLOID:**
- **1:1:1:1 pattern** (Module : Blueprint : Test : Widget)
- All upgrades must have Web Components
- See [reploid/docs/WEB_COMPONENTS_GUIDE.md](reploid/docs/WEB_COMPONENTS_GUIDE.md)

**MOP:**
- Follow MOP widget protocol specification
- Security-first (user confirmations)
- See [mop/CONTRIBUTING.md](mop/CONTRIBUTING.md)

---

## Philosophy: Why a Monorepo?

These projects share:
- **Code** - Personas, system prompts, utilities
- **Philosophy** - Multi-agent, human-in-loop, context engineering
- **Standards** - Markdown bundles, git workflows, MCP protocol

But they're **not a unified system**. They're separate tools that:
- Solve different problems (CLI workflows vs browser agents vs MCP visualization)
- Can be used independently
- Share a vision without forcing integration

**Think:** Unix philosophy applied to AI tooling. Small, focused tools that *could* be combined, but don't *require* it.

---

## License

MIT

---

## Support

- **Issues:** Use GitHub issues for each project (tag with `paws-cli`, `reploid`, or `mop`)
- **Discussions:** For architecture questions and integration ideas
- **Examples:** See [EXAMPLES.md](EXAMPLES.md) for real-world workflows

---

**Built with the philosophy: Tools should be composable, not monolithic. Agents should be verifiable, not autonomous.**
