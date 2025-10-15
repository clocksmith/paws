# REPLOID - Browser Interface

```
    ╭─────────────────────────────────────────────────────────╮
    │                                                         │
    │       ☥  R E P L O I D  - Browser Interface  ☥       │
    │                                                         │
    ╰─────────────────────────────────────────────────────────╯
```

**R**eflective **E**mbodiment **P**roviding **L**ogical **O**verseeing **I**ntelligent **D**REAMER

---

## Overview

REPLOID is the browser-native visual interface for PAWS, providing interactive multi-agent AI workflows with human-in-the-loop approval gates and recursive self-improvement capabilities.

**Core Features:**
- ⚘ Visual diff viewer with syntax highlighting
- ☰ File tree explorer with search capabilities
- ♲ Live HTML preview for web projects
- ☇ Real-time FSM state visualization
- ⛮ 12 RSI modules for agent self-improvement
- ☼ WebGPU local LLM support (no API keys required)

---

## Context Engineering Alignment

Anthropic’s September 2025 study _“Context Engineering Outperforms Prompt Engineering for AI Agents”_ validates the approach REPLOID has championed since launch. REPLOID leans on the canonical PAWS `cats` and `dogs` engines for curated bundles and auditable application:

- `reploid/bin/cats` and `reploid/bin/dogs` are vendored copies so the browser app can ship standalone.  
- A checksum guard (`npm run check:reploid-sync`) enforces parity with `../js/cats.js` and `../js/dogs.js`.  
- Shared session libraries (`../js/paws-session.js`) keep context synchronized between CLI and browser, preventing the “context rot” highlighted by Anthropic.

---

## Quick Start

### Client-Only Mode (Simplest)

```bash
# Serve with Python
python3 -m http.server 8080

# Or Node.js
npx serve

# Open browser
open http://localhost:8080
```

**Modes Available:**
- **Client-only**: Paste API key directly in browser
- **Client + Server**: Node.js backend handles API calls
- **Local LLM**: WebGPU-accelerated local models (no API key needed)

### With Node.js Server

```bash
# From paws root
npm run reploid:start

# Or from reploid/
cd server
node proxy.js
```

### CLI Integration

REPLOID shares tools with PAWS CLI:

```bash
# Generate solutions with CLI
python ../py/paws_paxos.py "Add auth" context.md

# Review in REPLOID browser
npm run reploid:start
# Visual diff viewer shows all solutions
```

---

## Architecture

```
reploid/
├── index.html              # Main browser interface
├── about.html              # Project information
├── ui-dashboard.html       # Performance dashboard
├── boot.js                 # Bootstrap loader
├── service-worker.js       # PWA support
│
├── blueprints/             # ⛮ RSI Modules (12)
│   ├── introspection/      # Self-analysis
│   ├── meta-learning/      # Learn from interactions
│   └── self-testing/       # Automated validation
│
├── hermes/                 # ☇ Multi-Agent Orchestration
│   ├── index.js            # Hermes server
│   ├── paxos_orchestrator.js  # Paxos consensus
│   └── package.json        # Dependencies
│
├── modules/                # Browser modules
│   └── ...
│
├── server/                 # Node.js proxy
│   ├── proxy.js            # API proxy server
│   └── ...
│
├── styles/                 # CSS
├── tools/                  # Utilities
├── docs/                   # Documentation
└── tests/                  # Test suite
```

---

## Features

### Visual Workflow

**1. Set Goal**
```
User: "Add dark mode toggle to settings"
```

**2. Curate Context** (AI-powered)
```
Agent analyzes codebase → Suggests relevant files
User reviews → Approves file selection
```

**3. Generate Solutions** (Multi-agent competition)
```
Gemini, Claude, GPT-4 compete in parallel
Each solution tested in isolated git worktree
Only passing solutions presented
```

**4. Review Changes** (Visual approval)
```
Side-by-side diff viewer
Approve/reject individual changes
Git checkpoint before applying
```

**5. Apply & Reflect**
```
Changes applied with instant rollback capability
Agent reflects on success/failure
Learning stored for future tasks
```

### Paxos Mode

Multi-agent competition with test-driven consensus:

```
☐ Enable Paxos Mode
☐ Select agents: Gemini, Claude, GPT-4
☐ Set verification: npm test
☐ Generate Solutions

Result:
- 3 agents generate solutions in parallel
- Each tested in isolated worktree
- Only passing solutions shown
- Best solution highlighted
```

### Cognitive Architecture

REPLOID supports H1-H5 cognitive complexity:

- **H1 (Line):** Simple execution
- **H2 (Plane):** Trade-off analysis
- **H3 (Cube):** Multi-perspective critique
- **H4 (Tesseract):** Phased deliberation
- **H5 (Penteract):** 40-face full deliberation

Configure in UI or `config.json`:

```json
{
  "cognitive_architecture": {
    "default_level": "h1",
    "available_levels": ["h1", "h2", "h3", "h4", "h5"],
    "paxos_mode": {
      "enable_persona_deliberation": true,
      "guilds_per_agent": 3
    }
  }
}
```

---

## Configuration

### API Providers

- **Google Gemini** - Recommended (fast, cheap)
- **OpenAI** - GPT-4 Turbo support
- **Anthropic** - Claude 3.5 Sonnet
- **Local Ollama** - Free, runs on your GPU
- **WebGPU Models** - Browser-native (Qwen, Phi, Llama)

### Operational Modes

| Mode | Setup | Use Case |
|------|-------|----------|
| **Client-Only** | Paste API key in UI | Quick start, no server needed |
| **Client + API Keys** | Configure multiple providers | Fallback between providers |
| **Node.js Server** | `.env` file + server | Team collaboration, WebSocket streaming |
| **Local WebGPU** | Load model in UI | Zero cost, privacy, offline |

---

## Hermes Orchestration

The Hermes server orchestrates multi-agent deliberation:

### Starting Hermes

```bash
# From reploid/hermes
npm install
node index.js

# Or from paws root
npm run hermes
```

### Deliberation Modes

**1. Sequential Mode** (Default)
- Personas deliberate in order: AX → VC → MX → SC
- Each phase builds on previous
- Best for architectural decisions

**2. Parallel Mode**
- All personas generate solutions simultaneously
- System synthesizes at end
- Best for exploring solution space

**3. Paxos + Penteract Mode** (Advanced)
- Multiple agents (Gemini, Claude, GPT-4)
- Each uses Penteract deliberation
- Best solutions compete
- Final synthesis from all perspectives

---

## RSI Modules

REPLOID includes 12 recursive self-improvement modules:

### Core RSI Capabilities

**1. Introspection**
- Agent analyzes its own code
- Identifies improvement opportunities
- Proposes refactorings

**2. Meta-Learning**
- Learns from success/failure patterns
- Adapts strategies based on history
- Improves over time

**3. Self-Testing**
- Generates tests for own changes
- Validates modifications automatically
- Prevents regressions

**4. Reflection Storage**
- Stores insights from interactions
- Builds knowledge base
- Shares learnings across sessions

### Enabling RSI

```json
// config.json
{
  "rsi": {
    "enabled": true,
    "modules": [
      "introspection",
      "meta-learning",
      "self-testing",
      "reflection-storage"
    ],
    "approval_required": true
  }
}
```

---

## Local LLM Support

REPLOID supports running models entirely in your browser:

### WebGPU Models

**Supported Models:**
- Qwen2.5-Coder-1.5B (~900MB)
- Phi-3-Mini (~2GB)
- Llama-3.2-1B (~1.2GB)

**Setup:**
1. Click "Local LLM" tab in UI
2. Select model from dropdown
3. Wait for download (one-time)
4. Use agent with zero cost

**Requirements:**
- Chrome/Edge with WebGPU support
- 8GB+ RAM recommended
- GPU acceleration for best performance

---

## Testing

### Unit Tests

```bash
# Run all tests
npm run test:reploid

# Watch mode
npm run test:reploid:watch

# With UI
npm run test:reploid:ui

# Coverage
npm run test:reploid:coverage
```

### E2E Tests (Playwright)

```bash
# Run E2E tests
npm run test:e2e

# Headed mode
npm run test:e2e:headed

# UI mode
npm run test:e2e:ui
```

---

## Documentation

- **[Quick Start Guide](docs/QUICK-START.md)** - Interactive tutorial
- **[Operational Modes](docs/OPERATIONAL_MODES.md)** - Client-only, Server, Local WebGPU
- **[API Reference](docs/API.md)** - Module documentation
- **[Personas Guide](docs/PERSONAS.md)** - Custom agent personalities
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues
- **[Local Models](docs/LOCAL_MODELS.md)** - WebGPU/WebGL setup
- **[Testing](tests/README.md)** - Test suite documentation

---

## Shared Philosophy

REPLOID and PAWS share core principles:

1. **Context is King** - Controlling what AI sees controls what it produces
2. **Reproducibility Matters** - Workflows are version-controlled and re-runnable
3. **Human-in-the-Loop** - AI proposes, humans approve and apply

**Two approval gates:**
- Context selection (what files the AI sees)
- Change review (what modifications get applied)

---

## Integration with PAWS CLI

REPLOID works seamlessly with PAWS command-line tools:

### CLI → Browser Workflow

```bash
# 1. Generate solutions with Python
python ../py/paws_paxos.py "Implement feature" context.md

# 2. Review in REPLOID
npm run reploid:start
# Solutions appear in browser for visual review
```

### Shared Session Management

```bash
# Create session in CLI
paws-session start "feature-payments"

# Continue in REPLOID browser
# Hermes server picks up existing session
```

### Shared Tools

REPLOID uses the same core tools as PAWS:
- `../js/cats.js` - Context bundler
- `../js/dogs.js` - Change applier
- `../js/paws-session.js` - Session manager

---

## Support

- **Issues:** [GitHub Issues](https://github.com/yourusername/paws/issues)
- **Discussions:** [GitHub Discussions](https://github.com/yourusername/paws/discussions)
- **Documentation:** [Main PAWS Docs](../)

---

**Made by developers who believe AI should empower, not replace, human judgment.**

☥ REPLOID Browser × ☇ PAWS CLI × ⛮ Penteract = **Complete Toolkit**
