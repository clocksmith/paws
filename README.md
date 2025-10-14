# PAWS + REPLOID

**P**repare **A**rtifacts **W**ith **S**WAP (PAWS)
**R**eflective **E**mbodiment **P**roviding **L**ogical **O**verseeing **I**ntelligent **D**REAMER (REPLOID)

```
    ╭─────────────────────────────────────────────────────────╮
    │                                                         │
    │       ☇  PAWS - Multi-Agent AI Development  ☇        │
    │                                                         │
    │        PAWS (CLI)  +  REPLOID (Browser)              │
    │                                                         │
    ╰─────────────────────────────────────────────────────────╯
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/downloads/)
[![Node.js 16+](https://img.shields.io/badge/node-16+-green.svg)](https://nodejs.org/)

---

## What is PAWS + REPLOID?

**A unified multi-agent AI development toolkit with two interfaces:**

- **PAWS** ☇ Command-line toolkit for automation and CI/CD integration
- **REPLOID** ☥ Browser-native visual interface with recursive self-improvement

Both share a core philosophy: **human-approved, git-backed, multi-agent workflows** that are transparent, reproducible, and safe. Context bundles are versioned, test suites verify changes, and git worktrees provide isolation.

---

## Competitive Edge

### vs. Claude Code

| Claude Code | PAWS + REPLOID |
|-------------|----------------|
| Single-agent inline editing | **Multi-agent competition** with Paxos consensus |
| IDE-specific | **Editor-agnostic** - works with vim, emacs, VSCode, any editor |
| Ephemeral context | **Reproducible context bundles** with version locking |
| No benchmarking | **Built-in performance tracking** across models |
| Plugin marketplace | **Native MCP integration** + plugin-compatible |

**What we do differently:**
- ☇ Run 3-5 LLMs in parallel and let them compete
- ⚘ Massive context handling (500K+ lines via hierarchical chunking)
- ♲ Test-driven consensus - only passing solutions presented
- ☥ Visual browser interface for non-CLI users
- ⛮ Penteract cognitive architecture (40-face deliberation)

**What Claude Code does better:**
- Faster inline editing
- Better IDE integration
- Lower latency for autocomplete

**Use Claude Code for:** Daily development, quick fixes
**Use PAWS/REPLOID for:** Critical refactors, production changes, team workflows needing reproducibility

### vs. Cursor / Windsurf

| Cursor/Windsurf | PAWS + REPLOID |
|-----------------|----------------|
| Real-time inline editing | Git-backed approval workflow |
| Low-latency autocomplete | Deterministic, reproducible results |
| Seamless IDE integration | Works with any editor |
| Better UX for daily coding | Test-driven verification with rollback |
| Single model at a time | Multiple models competing simultaneously |

### vs. GitHub Copilot

| Copilot | PAWS + REPLOID |
|---------|----------------|
| Instant suggestions | Full-file context awareness |
| Trained on more code | Explicit context control |
| Fast autocomplete | Multi-model competition |
| Better IDE integration | Test suite integration + git worktree isolation |

---

## Core Philosophy

**Three principles:**

1. **Context is King** - Controlling what the AI sees controls what it produces
2. **Reproducibility Matters** - Every workflow is version-controlled and re-runnable
3. **Human-in-the-Loop** - AI proposes, humans approve and apply

**Two approval gates:**
- Context selection (what files the AI sees)
- Change review (what modifications get applied)

---

## Quick Start

### PAWS CLI (Command Line)

```bash
# Install
npm install
pip install -r requirements.txt

# Bundle context for AI with smart curation
python py/cats.py --ai-curate "refactor auth to use OAuth2" -o context.md

# Run multi-agent competition with test verification
python py/paws_paxos.py \
  "Refactor auth module to OAuth2" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py"

# Review winning solutions interactively
python py/dogs.py workspace/competition/gemini_solution.dogs.md --interactive
```

### REPLOID Browser (Visual Interface)

```bash
# Serve with Python (client-only)
cd reploid
python3 -m http.server 8080

# Or use Node.js server for WebSocket streaming
npm run reploid:start

# Open browser
open http://localhost:8080
```

**REPLOID features:**
- ⚘ Side-by-side visual diff viewer
- ☰ File tree explorer with search
- ♲ Live HTML preview
- ☇ Real-time FSM state visualization
- ⛮ 12 RSI modules for recursive self-improvement
- ☼ WebGPU local LLM support (no API key needed)

---

## Architecture

```
paws/
├── README.md                    # This file
├── package.json                 # Unified dependencies
│
├── js/                          # ☇ PAWS CLI (JavaScript)
│   ├── cats.js                 # Context bundler
│   ├── dogs.js                 # Change applier
│   └── paws-session.js         # Session manager
│
├── py/                          # ☇ PAWS CLI (Python)
│   ├── cats.py                 # Context bundler
│   ├── dogs.py                 # Change applier
│   ├── paws_paxos.py           # Multi-agent orchestrator
│   ├── paws_swarm.py           # Collaborative swarm
│   ├── paws_benchmark.py       # Performance analyzer
│   └── paws_context_optimizer.py  # Massive codebase handler
│
├── reploid/                     # ☥ REPLOID BROWSER
│   ├── index.html              # Main browser UI
│   ├── boot.js                 # Bootstrap loader
│   ├── blueprints/             # 12 RSI modules
│   ├── hermes/                 # Multi-agent orchestration server
│   ├── modules/                # Browser modules
│   ├── server/                 # Node.js proxy server
│   ├── styles/                 # CSS
│   ├── tools/                  # REPLOID-specific tools
│   └── docs/                   # REPLOID documentation
│
├── personas/                    # Cognitive architecture (H1-H5)
├── sys/                         # System protocols
└── docs/                        # Documentation
```

---

## Core Tools

### Shared by Both (PAWS + REPLOID)

**cats** - Context Artifacts Tool for SWAP
- Bundles source files into LLM-friendly markdown
- AI-powered file curation
- Supports personas and system prompts
- Works in CLI (Python/JS) and browser (REPLOID)

**dogs** - Document Output Generation System
- Extracts file changes from LLM responses
- Visual diffs with selective approval
- Automatic verification and rollback
- Works in CLI (Python/JS) and browser (REPLOID)

**paws-session** - Session Management
- Git worktree-based isolation
- Turn-by-turn change tracking
- Rewind, merge, and archive capabilities
- Works in CLI (Python/JS) and browser (REPLOID via Hermes)

### PAWS-Specific (CLI)

**paws_paxos** - Multi-agent competitive verification
- Runs 3-5 LLMs in parallel on same task
- Isolated git worktrees for each solution
- Test-driven consensus voting
- Python only

**paws_swarm** - Collaborative swarm intelligence
- Agents collaborate with specialized roles
- Hierarchical task decomposition
- Multi-round consensus
- Python only

**paws_benchmark** - Performance comparison
- Compare LLM performance on YOUR codebase
- Track speed, correctness, token efficiency
- Generate comparative reports
- Python only

### REPLOID-Specific (Browser)

**Hermes** - Multi-agent orchestration server
- WebSocket streaming for real-time updates
- Manages Paxos competitions in browser
- Node.js server with Express + WebSocket

**RSI Modules** (12 blueprints)
- Introspection, meta-learning, self-testing
- Agent can modify its own source code
- Reflection storage learns from interactions

**Visual Tools**
- Diff viewer with syntax highlighting
- File tree explorer
- Live HTML preview
- FSM state visualization

---

## Cognitive Architecture

PAWS + REPLOID integrate a **5-level hierarchical cognitive framework** (H1-H5):

### H1: The Line (1D) - Direct Execution
- **1 Persona** (The Artisan)
- Simple, well-defined tasks
- Focus on speed and craftsmanship

### H2: The Plane (2D) - Adversarial Deliberation
- **4 Personas** in adversarial pairs
- Exploring trade-offs
- Explicit priority analysis

### H3: The Cube (3D) - Multi-Perspective Review
- **8 Personas** in cubic structure
- Security, performance, UX, architecture critique
- Orthogonal viewpoints

### H4: The Tesseract (4D) - Deep Analysis
- **29 Faces** (16 Personas + 8 Dyads + 4 Quaternions + 1 System)
- Phased deliberation: Axiom → Vector → Matrix → Scalar
- Complex architectural decisions

### H5: The Penteract (5D) - Full Cognitive Engine
- **40 Faces** (27 Personas + 9 Guilds + 3 Triads + 1 System)
- 3×3×3 cognitive cube
- Mission-critical decisions
- **Triads:** VZN (Vision), FAB (Fabricate), SYN (Synthesis)
- **Guilds:** ID, ST, ET, AR, CR, QY, AD, JG, VO

**Doctrine:** Robust solutions emerge from structured cognitive diversity, not monolithic intellect.

**Read more:** [COGNITIVE_ARCHITECTURE.md](COGNITIVE_ARCHITECTURE.md)

---

## MCP & Claude Code Plugin Integration

**PAWS + REPLOID are designed to integrate with modern AI tooling ecosystems:**

### Model Context Protocol (MCP)
- ☐ MCP-compatible context server (planned)
- ☐ Can be wrapped as MCP tool
- ☐ Hermes server exposes MCP-like interface

### Claude Code Plugins
Both PAWS and REPLOID can be packaged as Claude Code plugins:

**Potential plugin capabilities:**
- `/cats` - Bundle context for current project
- `/dogs` - Apply AI-generated changes
- `/paxos` - Run multi-agent competition
- `/reploid` - Open browser UI for visual review
- Hook integration for code review workflows

**Why PAWS/REPLOID as a plugin:**
- Brings multi-agent competition to Claude Code
- Adds visual review interface
- Provides reproducible workflows
- Test-driven consensus
- Performance benchmarking
- Penteract cognitive architecture

**Example plugin usage:**
```bash
# Install PAWS plugin (hypothetical)
/plugin add paws-multi-agent

# Use in Claude Code
/paxos "Refactor authentication" --verify "npm test"
```

---

## Revolutionary Features

### 1. Multi-Agent Competition (Paxos)

Run 3+ different LLMs in parallel, let them compete, only present solutions that pass your tests:

```bash
# CLI
python py/paws_paxos.py \
  "Refactor auth to OAuth2" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py"

# Browser (REPLOID)
# Enable Paxos mode → 3 agents compete → Best solution wins
```

**Why revolutionary:** Other tools use one model. PAWS runs 3-5 with test-driven consensus.

### 2. Swarm Intelligence

Agents collaborate with specialized roles (Architect, Implementer, Reviewer):

```bash
python py/paws_swarm.py \
  "Implement caching layer with Redis" \
  context.md
```

### 3. Performance Benchmarking

Track which LLM actually performs best on YOUR codebase:

```bash
python py/paws_benchmark.py \
  --task "Fix memory leak" \
  --verify-cmd "pytest tests/test_memory.py"
```

### 4. Massive Context Optimization

Refactor 500K+ line codebases through smart context windowing:

```bash
python py/paws_context_optimizer.py \
  "Migrate from Flask to FastAPI" \
  --scan backend/ \
  --max-tokens 100000
```

### 5. Visual Browser Interface (REPLOID)

All of the above, but with:
- Side-by-side diff viewer
- File tree explorer
- Live previews
- RSI modules for self-improvement
- WebGPU local LLM support

### 6. Penteract Cognitive Architecture

40-face deliberation for mission-critical decisions:
- 27 specialized personas
- 9 guilds (Ideation, Strategy, Ethos, Architecture, Craft, Query, Audit, Judgment, Voice)
- 3 triads (Vision, Fabricate, Synthesis)
- Structured cognitive diversity

---

## Token Efficiency

CATSCAN files dramatically reduce token usage:

- **Full implementation:** ~10,000 tokens
- **CATSCAN summary:** ~500 tokens
- **Savings:** 95% reduction

---

## Installation

### Full Installation (CLI + Browser)

```bash
# Clone repository
git clone https://github.com/yourusername/paws.git
cd paws

# Install all dependencies
npm run setup

# Test CLI
cats --help
dogs --help
python py/cats.py --help

# Start REPLOID browser
npm run reploid:start
open http://localhost:8080
```

### CLI Only

```bash
# Python
pip install -r requirements.txt
python py/cats.py --help

# JavaScript
npm install
./js/cats.js --help
```

### Browser Only (REPLOID)

```bash
# Client-only mode (no server needed)
cd reploid
python3 -m http.server 8080
open http://localhost:8080

# Or with Node.js server
npm run reploid:start
```

---

## Documentation

- **[PAWS CLI (Python)](py/README.md)** - Python CLI guide
- **[PAWS CLI (JavaScript)](js/README.md)** - JavaScript CLI guide
- **[REPLOID Browser](reploid/README.md)** - Browser interface guide
- **[Cognitive Architecture](COGNITIVE_ARCHITECTURE.md)** - H1-H5 Penteract system
- **[Hermes Orchestration](reploid/hermes/README.md)** - Multi-agent server
- **[RSI Modules](reploid/blueprints/README.md)** - Recursive self-improvement
- **[Persona Guide](personas/README.md)** - Creating custom personas
- **[System Protocols](sys/README.md)** - Protocol documentation

---

## Usage Examples

### Example 1: CLI Multi-Agent Refactor

```bash
# Create optimized context
python py/cats.py --ai-curate "refactor auth to OAuth2" -o context.md

# Run competition between GPT-4, Claude, and Gemini
python py/paws_paxos.py \
  "Refactor authentication to use OAuth2" \
  context.md \
  --verify-cmd "pytest tests/test_auth.py"

# Only passing solutions are presented
# Review the best one
python py/dogs.py workspace/competition/claude-sonnet_solution.dogs.md --interactive
```

### Example 2: Browser Visual Workflow (REPLOID)

```bash
# Start REPLOID
npm run reploid:start

# In browser:
# 1. Set goal: "Add dark mode toggle"
# 2. AI curates relevant files
# 3. You review & approve file selection
# 4. AI generates changes
# 5. Visual diff viewer shows changes
# 6. You approve/reject each change
# 7. Applied with git checkpoint
```

### Example 3: Penteract Deliberation

```bash
# Use full 40-face cognitive engine
python py/paws_paxos.py \
  "Overhaul authentication system" \
  context.md \
  --persona personas/sys_h5.md \
  --verify-cmd "pytest --security" \
  --models gemini,claude,gpt4

# Result: 3 agents × 40 personas = 120 perspectives
```

---

## Contributing

Contributions welcome! Areas for help:

- ☇ Bug fixes and improvements
- ☐ Documentation
- ⚗ Tests
- ⚛ UI/UX improvements
- ⚙ New personas or RSI modules
- ⛶ MCP server implementation
- ☥ Claude Code plugin packaging
- ♲ Internationalization

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Roadmap

### Near-term
- ☐ MCP server implementation
- ☐ Claude Code plugin packaging
- ☐ Improved REPLOID UI
- ☐ More RSI modules

### Long-term
- ☐ Plugin marketplace integration
- ☐ Team collaboration features
- ☐ Cloud-hosted Hermes orchestration
- ☐ Advanced swarm strategies

---

## License

MIT License - see [LICENSE](LICENSE) file for details.

---

## Acknowledgments

PAWS + REPLOID build on ideas from:
- **Paxos consensus protocol** - Multi-agent verification
- **Git worktrees** - Isolated workspaces
- **UNIX philosophy** - Composable tools that do one thing well
- **Model Context Protocol** - Standardized AI tool integration
- **Claude Code** - Plugin ecosystem inspiration
- **VCP Penteract** - Structured cognitive diversity

---

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/paws/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/paws/discussions)
- **Documentation:** [Full Docs](docs/)

---

**Made by developers who believe AI should empower, not replace, human judgment.**

☇ CLI + ☥ Browser × ⛮ Penteract = **PAWS + REPLOID**
