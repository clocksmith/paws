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

**Philosophy:** Multiple AI agents generate solutions in parallel. Tests pick the winner.

#### What It Does

1. **`cats`** - Bundle code into AI-consumable context
2. **`dogs`** - Extract and apply code changes from AI responses
3. **`paws-arena`** - Run multiple LLMs in parallel, isolated git worktrees, test-driven selection
4. **`paws-swarm`** - Collaborative multi-agent workflows
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

**Self-modifying AI agent that runs in your browser.**

**Philosophy:** Agents should be able to introspect and modify their own code, with human oversight.

#### What It Does

- **Meta-tool creation** - Tools that create other tools, that are used to create more tools
- **Multi-model mixing** - Gemini, Claude, GPT, local models (Ollama), WebGPU inference
- **Virtual File System** - IndexedDB-backed storage
- **Web Component widgets** - Visual dashboards for agent execution
- **Recursive Self-Improvement** - Modify own code with checkpoints and test verification
- **EXPERIMENTAL WebRTC P2P swarm** - Browser-to-browser agent coordination
- **EXPERIMENTAL Python runtime** - Pyodide + WebAssembly for Python execution

**Location:** [`reploid/`](reploid/README.md)

---

### MCP Lens - Protocol-Semantic Analytics for MCP

**Analytical-level understanding of Model Context Protocol servers.**

**Philosophy:** Understanding *how* LLMs interact with MCP servers requires protocol-semantic analysis.

#### What It Does

- **Protocol-semantic analysis** - Understand why tool calls fail, capability negotiation patterns, schema compliance
- **Efficiency analysis** - Identify tool patterns that lead to success vs. failure
- **Widget protocol** - Build analytical dashboards as Web Components
- **LLM interaction patterns** - Analyze how LLMs use tools over time

**Location:** [`lens/`](lens/README.md)

**Note:** MCP Lens is completely independent. It can analyze any MCP server, including PAWS MCP servers.

---

## Shared Philosophy

While these projects are independent, they share common values:

**1. Context Engineering**
- Curating what AI sees is as important as how you prompt
- Smart file selection over dumping entire codebases
- Context bundling for reproducibility

**2. Multi-Model Mixing**
- No single model is best for everything
- Let models compete or collaborate
- Benchmark on your specific codebase

**3. Recursive Self-Improvement**
- Agents should be able to modify themselves
- With guardrails: tests, checkpoints, human approval
- Code should be introspectable and modifiable

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

## License

MIT

