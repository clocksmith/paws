# PAWS Monorepo

**A collection of AI development tools with a shared philosophy: practical multi-agent workflows and recursive self-improvement.**

This monorepo contains separate but complementary projects:
- **PAWS CLI** - Command-line tools for multi-agent code generation (TypeScript)
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
7. **`paws-session`** - Stateful workflow management with git worktrees

**Location:** [`packages/cli-js/`](packages/cli-js/README.md)

**Quick Start:**
```bash
# Install
pnpm install

# Basic workflow
cats src/**/*.ts -o context.md
paws-arena "Refactor auth to use OAuth2" context.md --verify-cmd "npm test"
dogs workspace/competition/winning_solution.md --interactive
```

---

### REPLOID - Browser-Native Agent Environment

**Self-modifying AI agent that runs entirely in your browser.**

**Philosophy:** Agents should be able to introspect and modify their own code, with human oversight.

#### What It Does

- **Modular upgrades** following 1:1:1:1 pattern (Module : Blueprint : Test : Widget)
- **Meta-tool creation** - Tools that create other tools
- **Multi-model mixing** - Gemini, Claude, GPT-4, local models (Ollama), WebGPU inference
- **Virtual File System** - IndexedDB-backed storage
- **Web Component widgets** - Visual dashboard for all modules
- **Recursive Self-Improvement** - Modify own code with checkpoints and test verification
- **WebRTC P2P swarm** - Browser-to-browser agent coordination
- **Python runtime** - Pyodide + WebAssembly for Python execution

**Location:** [`reploid/`](reploid/README.md)

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

**Location:** [`lens/`](lens/README.md)

**Note:** MCP Lens is completely independent. It can analyze any MCP server, including PAWS MCP servers.

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
│   ├── cli-js/          # PAWS CLI (TypeScript)
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

### PAWS CLI

```bash
# Install dependencies
pnpm install

# Create context bundle
cats src/**/*.ts -o context.md

# Or with AI-assisted file selection
cats --ai-curate "refactor authentication" -o context.md

# Apply code changes from LLM response
dogs changes.md --interactive

# Run multi-agent competition (optional)
paws-arena "Refactor auth module" context.md --verify-cmd "npm test"

# Benchmark LLM performance (optional)
paws-benchmark --suite benchmark-suite.json
```

### REPLOID

```bash
cd reploid
npm install
npm start

# Open browser to http://localhost:8080
# Select boot mode and enter goal
```

---

## Installation

```bash
# Install all packages
pnpm install

# Set up API keys (optional, for cloud models)
export GEMINI_API_KEY="your-key"
export ANTHROPIC_API_KEY="your-key"
export OPENAI_API_KEY="your-key"
```

Individual projects can be installed independently - see their respective READMEs.

---

## Documentation

### PAWS CLI
- [CLI README](packages/cli-js/README.md)
- [Shared Core](packages/core/README.md) - Personas and prompts

### REPLOID
- [REPLOID README](reploid/README.md)

### MCP Lens
- [Lens README](lens/README.md)
- [Protocol Specification](lens/specification/README.md)

---

## Contributing

Each project has its own patterns:

**PAWS CLI:**
- TypeScript with strict type checking
- Tests for all CLI commands
- Follow existing code patterns

**REPLOID:**
- **1:1:1:1 pattern** (Module : Blueprint : Test : Widget)
- All upgrades must have Web Components

**MCP Lens:**
- Follow widget protocol specification
- Security-first (user confirmations)

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

- **Issues:** Use GitHub issues for each project (tag with `paws-cli`, `reploid`, or `lens`)
- **Discussions:** For architecture questions and integration ideas

---

**Built with the philosophy: Tools should be composable, not monolithic. Agents should be verifiable, not autonomous.**
