# REPLOID

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[← CLI-PY](../cli-py/README.md)** | **[← CLI-JS](../cli-js/README.md)** | **[← Core](../core/README.md)**

---

```
    ╭─────────────────────────────────────────────────────────╮
    │                                                         │
    │           ☥  R E P L O I D  Framework  ☥             │
    │                                                         │
    │    Recursive Self-Improvement in the Browser          │
    │                                                         │
    ╰─────────────────────────────────────────────────────────╯
```

**R**eflective **E**mbodiment **P**roviding **L**ogical **O**verseeing **I**ntelligent **D**REAMER
(**D**eep **R**ecursive **E**xploration **A**round **M**ultimodal **E**mbodying **R**EPLOID)

---

## Vision

**REPLOID** is an experimental framework designed to explore **LLM-driven recursive self-improvement (RSI)** by uniquely leveraging the **web browser as a comprehensive development and execution ecosystem**. The long-term vision is to cultivate **self-contained, browser-native agentic systems** capable of sophisticated evolution towards AGI.

Unlike traditional AI frameworks that treat the browser as a mere interface, REPLOID embraces it as the *complete runtime environment* where agents can:

- **Introspect** their own source code through a virtual filesystem
- **Modify** their architecture by editing modules in real-time
- **Test** proposed changes in isolated environments
- **Learn** from outcomes through reflection and knowledge synthesis
- **Evolve** capabilities by studying 70+ architectural blueprints
- **Collaborate** with humans through approval gates and visual debugging

The system implements a **Sentinel Agent** architecture with human-in-the-loop oversight, ensuring safe, auditable self-modification while maintaining the autonomy needed for genuine recursive improvement.

---

## Core RSI Architecture

REPLOID's self-improvement cycle operates through five key mechanisms:

### 1. Blueprint Knowledge Base (67 Architectural Guides)

Located in `/blueprints/`, these are pedagogical documents the agent can read to learn implementation patterns:

- **0x000001-0x000049**: Core architecture, storage, cognitive cycles, tool systems, self-contained parsers, genesis tracking
- Each blueprint contains: Strategic Imperative → Architectural Solution → Implementation Pathway
- Agent uses blueprints as context when proposing self-modifications
- Human-approved changes become part of the agent's evolved codebase

### 2. Modular Component System (72 Upgrades)

Located in `/upgrades/`, these JavaScript modules define the agent's capabilities:

- **Core**: `app-logic.js`, `di-container.js`, `utils.js`, `state-manager.js`
- **Cognition**: `agent-cycle.js`, `agent-cycle-structured.js`, `tool-runner.js`
- **Self-Contained**: `dogs-parser-browser.js`, `genesis-snapshot.js`, `diff-utils.js`, `verification-manager.js`
- **RSI**: `introspector.js`, `reflection-store.js`, `self-tester.js`, `blueprint-creator.js`
- **UI**: `ui-manager.js`, `diff-viewer-ui.js`, `vfs-explorer.js`
- **Integration**: `api-client-multi.js`, `hybrid-llm-provider.js`, `git-vfs.js`
- **Advanced**: `webrtc-coordinator.js`, `pyodide-runtime.js`, `local-llm.js`

Modules follow a dependency-injection pattern, allowing the agent to swap implementations or add new capabilities without breaking existing functionality.

### 3. Sentinel FSM (Human-Supervised Modification)

The agent operates through a finite state machine with approval gates:

```
IDLE → CURATING_CONTEXT → AWAITING_CONTEXT_APPROVAL
  → PLANNING_WITH_CONTEXT → GENERATING_PROPOSAL
  → AWAITING_PROPOSAL_APPROVAL → APPLYING_CHANGESET
  → REFLECTING → IDLE
```

**Safety guarantees:**
- Git checkpoints before every modification
- Visual diff review for all proposed changes
- Rollback capability if changes fail validation
- Self-testing framework validates system integrity (80% pass threshold)
- Audit logging of all modifications

### 4. Reflection & Learning System

After each modification cycle, the agent:

1. **Analyzes** outcome (success/failure, performance impact)
2. **Extracts** insights about what worked and what didn't
3. **Stores** learnings in `ReflectionStore` (indexed by context)
4. **Applies** learned patterns to future decisions
5. **Generates** new blueprints for novel patterns discovered

This creates a positive feedback loop where the agent becomes more effective at self-modification over time.

### 5. Multi-Provider Intelligence

REPLOID supports diverse inference backends:

- **Cloud APIs**: Gemini, OpenAI, Anthropic (with automatic failover)
- **Local Ollama**: GPU-accelerated models on your machine
- **WebGPU**: Browser-native inference (Qwen, Phi, Llama)
- **Hybrid**: Auto-switch between local/cloud based on task complexity

This allows the agent to optimize for cost, privacy, performance, or capability depending on the modification being proposed.

---

## Browser as Development Ecosystem

REPLOID demonstrates that the browser provides everything needed for AGI development:

**Computation:**
- JavaScript execution (V8/SpiderMonkey JIT compilation)
- WebAssembly for performance-critical code
- WebGPU for ML inference and training
- Web Workers for parallel processing

**Storage:**
- Virtual filesystem in memory
- IndexedDB for persistence (gigabytes of storage)
- LocalStorage for configuration
- Git integration for version control

**Networking:**
- Fetch API for HTTP/REST
- WebSocket for real-time communication
- WebRTC for P2P swarm coordination
- Service Workers for offline operation

**Visualization:**
- Canvas 2D/WebGL for data visualization
- DOM manipulation for interactive UIs
- Syntax highlighting for code review
- Real-time FSM state diagrams

**Security:**
- Same-origin policy for isolation
- Web Workers for sandboxing
- Content Security Policy
- Cryptographic APIs for integrity verification

---

## Self-Contained Architecture

REPLOID is **100% self-contained** and runs entirely in the browser with **zero external dependencies**:

- **Browser-Native DOGS/CATS Parser** (`DGPR` module) - No dependency on `@paws/parsers`
- **Genesis Snapshot System** (`GENS` module) - Tracks RSI evolution from boot state
- **Diff Utilities** (`DIFF` module) - Line-based file comparison without external libraries
- **Verification Manager** (`VRFY` module) - Web Worker-based safe command execution
- **Complete VFS** - All file operations in IndexedDB, no filesystem required
- **No Node.js Dependencies** - Pure browser implementation

### PAWS Compatibility (Optional)

While fully self-contained, REPLOID **can optionally** interoperate with PAWS CLI tools:

- **Bundle Format Compatibility**: REPLOID's DOGS/CATS format matches PAWS specification
- **Workflow Integration**: Bundles created by PAWS CLI can be loaded in REPLOID browser
- **Multi-Agent Support**: Compatible with PAWS Paxos (competitive) and Swarm (collaborative) orchestration
- **No Dependency**: PAWS CLI tools are **not required** - REPLOID implements all functionality natively

**Design Philosophy**: REPLOID implements PAWS-like features (context bundling, change application) but as browser-native modules, enabling operation without any external tooling.

---

## Quick Start

### Monorepo Installation

```bash
# From paws root
pnpm install

# Start REPLOID server
pnpm --filter @paws/reploid start

# Or navigate to package
cd packages/reploid
node server/proxy.js
```

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

## Self-Improvement Workflow

### Typical RSI Cycle

**1. Goal Setting**
```
Human: "Improve the context curation algorithm to better rank files by relevance"
or
Agent: "I noticed my file selection often misses key dependencies"
```

**2. Blueprint Study** (Agent introspects knowledge base)
```
Agent reads blueprints/0x000008-agent-cognitive-cycle.md
Identifies relevant patterns and implementation strategies
Proposes which modules to modify
```

**3. Context Curation** (Agent analyzes own codebase)
```
Agent scans /upgrades/ directory
Ranks files by relevance to goal
Suggests: agent-cycle.js, agent-logic-pure.js, state-manager.js
→ Human reviews and approves file selection
```

**4. Solution Generation** (Agent proposes modifications)
```
Agent studies current implementation
Generates proposal for enhanced algorithm
Creates structured changeset (additions, deletions, modifications)
→ Human reviews visual diff and approves/rejects
```

**5. Safe Application** (Git-backed modification)
```
Git checkpoint created automatically
Changes applied to VFS
Self-testing framework validates integrity
If tests fail → automatic rollback
If tests pass → changes committed
```

**6. Reflection & Learning**
```
Agent analyzes outcome:
- Did file selection improve?
- What patterns worked well?
- What edge cases were discovered?

Insights stored in ReflectionStore for future cycles
New blueprint created if novel pattern discovered
```

### Example: Agent Self-Modifying Its UI

```
Goal: "Add a module dependency graph visualizer to the UI"

Context (agent selects):
  ✓ upgrades/ui-manager.js (renders UI)
  ✓ upgrades/di-container.js (tracks dependencies)
  ✓ blueprints/0x000030-module-graph-visualizer.md (blueprint for this feature)
  ✓ upgrades/canvas-visualizer.js (existing visualization code to learn from)

Proposal (agent generates):
  CREATE upgrades/module-graph-visualizer.js
    → Implements D3-like force-directed graph
    → Reads module metadata from DI container
    → Renders to canvas with zoom/pan

  MODIFY upgrades/ui-manager.js
    → Add "Dependencies" tab to UI
    → Integrate new visualizer component
    → Add event handlers for node clicks

Human Review:
  → Inspects side-by-side diff
  → Verifies no breaking changes
  → Checks security (no eval, no XSS vectors)
  → Approves

Application:
  ✓ Git checkpoint created
  ✓ New module loaded into DI container
  ✓ UI updated with new tab
  ✓ Self-tests pass (80%+ threshold)
  ✓ Changes committed to agent's codebase

Reflection:
  Agent stores: "Canvas-based visualizations work well for graph data.
  Force-directed layout from blueprint 0x000030 was effective.
  Integration pattern: Create module → Add to UI manager → Register with DI."
```

---

## Practical Features

### Visual Interface

- **Diff Viewer**: Side-by-side syntax-highlighted comparison of proposed changes
- **File Tree**: Interactive VFS explorer with search and filtering
- **FSM Visualizer**: Real-time state diagram showing agent's cognitive flow
- **Performance Dashboard**: Metrics for tool execution, API calls, and agent cycles
- **Chat Log**: Transparent view of agent's reasoning and tool invocations

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

## Multi-Agent Workflows

Browser-native multi-agent coordination via WebRTC swarm orchestration:

```javascript
// P2P multi-agent collaboration runs entirely in browser
// See upgrades/webrtc-coordinator.js for implementation
// No server needed - agents coordinate via WebRTC data channels
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

## RSI Capabilities Deep Dive

REPLOID's self-improvement system consists of **67 blueprints** mapped to **72 modular upgrades**:

### Core RSI Modules

**Introspection & Analysis:**
- `introspector.js` - Agent analyzes its own source code, identifies patterns
- `reflection-analyzer.js` - Extracts insights from interaction history
- `reflection-search.js` - Semantic search over learned knowledge
- `performance-monitor.js` - Tracks execution metrics for optimization
- `tool-analytics.js` - Analyzes tool usage patterns

**Knowledge & Learning:**
- `reflection-store.js` - Persistent storage of learned insights (indexed by context)
- `blueprint-creator.js` - Generates new architectural blueprints from novel patterns
- `rfc-author.js` - Creates formal RFC documents for proposed changes
- `autonomous-orchestrator.js` - Curator mode for automated improvement cycles

**Testing & Validation:**
- `self-tester.js` - Validates system integrity (80%+ pass threshold required)
- `verification-manager.js` - Coordinates testing across modules
- `module-integrity.js` - Cryptographic verification of module authenticity
- `audit-logger.js` - Comprehensive audit trail of all modifications

**Meta-Programming:**
- `meta-tool-creator.js` - Creates new tools at runtime
- `goal-modifier.js` - Safe patterns for agent goal evolution
- `visual-self-improvement.js` - 2D canvas pattern recognition for optimization

### Blueprint Categories

**Foundation (0x000001-0x000012):**
System architecture, state management, storage, UI, tool systems

**Advanced Features (0x000013-0x000022):**
Configuration, dynamic tools, meta-tool patterns, safety mechanisms

**Autonomous Capabilities (0x000023-0x000032):**
Curator mode, analytics, module loading, multi-provider orchestration

**Monitoring & Visualization (0x00002C-0x000031):**
Performance tracking, metrics dashboards, graph visualizers

**Analysis & Intelligence (0x000032-0x00003F):**
Rate limiting, integrity verification, reflection systems, cost tracking

**Integration & Collaboration (0x000040-0x000046):**
Tab coordination, testing frameworks, browser APIs, WebRTC swarms

### Enabling RSI

```json
// config.json
{
  "rsi": {
    "enabled": true,
    "approval_required": true,  // Human review for safety
    "curator_mode": {
      "enabled": false,  // Auto-approve for advanced use
      "auto_approve_context": false,
      "auto_approve_proposals": false
    },
    "blueprints": {
      "path": "/blueprints/",
      "auto_load": true,
      "max_per_context": 5  // Limit blueprints in context window
    },
    "reflection": {
      "enabled": true,
      "store_backend": "indexeddb",
      "semantic_search": true
    },
    "self_testing": {
      "enabled": true,
      "min_pass_threshold": 0.80,
      "auto_rollback_on_failure": true
    }
  }
}
```

### RSI Safety Mechanisms

REPLOID implements multiple safety layers for responsible self-modification:

1. **Human Approval Gates**: All modifications require explicit approval
2. **Git Checkpointing**: Automatic commits before every change
3. **Rollback on Failure**: If self-tests fail, changes are reverted automatically
4. **Integrity Verification**: Cryptographic checks ensure modules haven't been corrupted
5. **Audit Logging**: Complete history of modifications with reasoning
6. **Sandboxed Execution**: Dynamic code runs in Web Workers
7. **Blueprint Governance**: Architectural changes follow documented patterns only

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
- Chrome 113+ or Edge 113+ ([WebGPU support](https://caniuse.com/webgpu))
- 8GB+ RAM recommended
- GPU acceleration enabled (check `chrome://gpu`)
- HTTPS or localhost (WebGPU requires secure context)

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

### Getting Started
- **[Quick Start Guide](docs/QUICK-START.md)** - Interactive tutorial
- **[WebRTC Quick Start](docs/WEBRTC_QUICKSTART.md)** - P2P swarm setup in 5 minutes
- **[Deployment Modes](docs/DEPLOYMENT_MODES.md)** - Browser-only, Node.js server, Docker

### Configuration & Setup
- **[Operational Modes](docs/OPERATIONAL_MODES.md)** - Client-only, Server, Local WebGPU
- **[Local Models](docs/LOCAL_MODELS.md)** - WebGPU/WebGL setup
- **[WebRTC Setup Guide](docs/WEBRTC_SETUP.md)** - Cross-origin P2P swarm configuration

### Development
- **[API Reference](docs/API.md)** - Module documentation
- **[Personas Guide](docs/PERSONAS.md)** - Custom agent personalities
- **[Testing](tests/README.md)** - Test suite documentation
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues
- **[Web Components Guide](docs/WEB_COMPONENTS_GUIDE.md)** - Adding new modules with Web Components
- **[Web Components Testing Guide](docs/WEB_COMPONENTS_TESTING_GUIDE.md)** - Testing patterns for widgets
- **[Blueprint Update Guide](docs/BLUEPRINT_UPDATE_GUIDE.md)** - Updating architectural blueprints

### Architecture & Implementation
- **[Blueprint System](docs/BLUEPRINTS_UPGRADES_MAPPING.md)** - Complete module-blueprint-test mapping
- **[Web Components Migration Tracker](docs/WEB_COMPONENTS_MIGRATION_TRACKER.md)** - Migration status
- **[Structured Cycle Implementation](docs/STRUCTURED_CYCLE_IMPLEMENTATION.md)** - 8-step cognitive cycle
- **[Meta-Cognitive RSI Implementation](docs/META_COGNITIVE_RSI_IMPLEMENTATION.md)** - Self-improvement system
- **[Upgrade Necessity Analysis](docs/UPGRADE_NECESSITY_ANALYSIS.md)** - Module criticality analysis

### Complete Index
- **[Documentation Index](docs/INDEX.md)** - Complete guide to all documentation
- **[References & Citations](docs/REFERENCES.md)** - External sources and research papers

---

## Research Philosophy & AGI Vision

### Core Principles

REPLOID is built on several key insights about recursive self-improvement and AGI development:

**1. Context is King**
- Controlling what the agent reads controls what it can learn
- Blueprint selection determines the space of possible improvements
- Curated context windows enable focused, incremental evolution

**2. Transparency Enables Trust**
- All agent reasoning visible through chat logs and FSM visualizations
- Visual diff review makes changes auditable
- Git history provides complete modification timeline

**3. Human-in-the-Loop is a Feature, Not a Limitation**
- Humans provide the value judgments needed for alignment
- Approval gates create natural checkpoints for safety validation
- Collaboration accelerates development beyond pure automation

**4. The Browser is a Complete AGI Substrate**
- Computation (JS, WASM, WebGPU)
- Storage (VFS, IndexedDB, Git)
- Networking (HTTP, WebSocket, WebRTC)
- Visualization (Canvas, WebGL, DOM)
- Security (sandboxing, CSP, crypto)

**5. Modular Architecture Enables Evolution**
- Dependency injection allows swapping implementations
- Blueprint-guided changes maintain architectural coherence
- Self-testing framework prevents regressions

**6. Reflection Creates Compound Learning**
- Each modification cycle generates insights
- Knowledge accumulates across sessions
- Agent becomes more effective at self-improvement over time

### Long-Term Vision

REPLOID is designed to explore several open questions in AGI research:

**Can self-contained browser agents achieve recursive improvement?**
- Current state: Agent can modify its own modules with human oversight
- Next milestone: Agent proposes architectural improvements from first principles
- Ultimate goal: Sustained improvement without human guidance in safe domains

**How far can blueprint-guided evolution scale?**
- Current: 70+ blueprints cover core capabilities
- Future: Agent generates new blueprints for novel patterns
- Question: Is there a theoretical limit to blueprint complexity?

**What role should humans play in AGI development?**
- Current: Humans approve all modifications
- Exploration: Which decisions can be safely automated?
- Goal: Find the optimal human-AI collaboration model

**Can distributed agent swarms accelerate evolution?**
- Current: WebRTC enables P2P agent coordination
- Future: Swarms share learned patterns and compete on improvements
- Question: Do evolutionary dynamics emerge in agent populations?

### Relationship to PAWS

REPLOID is **independently capable** with optional PAWS interoperability:

- **REPLOID provides**: Browser-native DOGS/CATS parsing, visual interface, RSI architecture, complete runtime
- **PAWS provides** (optional): CLI-based workflows, Git worktree integration, multi-agent orchestration
- **Shared philosophy**: Auditable AI workflows with human approval gates, DOGS/CATS bundle format

**Key Difference**: REPLOID runs 100% in the browser without requiring PAWS installation. The two projects share format compatibility but REPLOID is fully self-contained.

**Example**: REPLOID's `DogsParserBrowser` module (~336 LOC) implements the same DOGS/CATS functionality as PAWS parsers, but browser-native with zero Node.js dependencies.

---

## Optional PAWS CLI Interoperability

REPLOID can **optionally** work with PAWS CLI tools through bundle format compatibility:

### CLI → Browser Workflow (Optional)

```bash
# 1. Generate DOGS bundles with PAWS CLI (optional)
python ../py/paws_paxos.py "Implement feature" context.md

# 2. Load in REPLOID browser
npm run reploid:start
# Import DOGS bundle → REPLOID's DogsParserBrowser parses and applies
```

### Self-Contained Alternative

```javascript
// REPLOID's native browser-only workflow (no CLI needed)
const DogsParser = window.DIContainer.resolve('DogsParserBrowser');
const ToolRunner = window.DIContainer.resolve('ToolRunner');

// Create DOGS bundle in browser
const changes = [{ operation: 'CREATE', file_path: '/new.js', new_content: '...' }];
const dogsBundle = DogsParser.createDogsBundle(changes);

// Apply changes in browser
await ToolRunner.runTool('apply_dogs_bundle', { dogs_path: '/changes.dogs.md' });
```

### Native Modules (No External Dependencies)

REPLOID implements these browser-natively:
- **`DogsParserBrowser`** (DGPR) - DOGS/CATS parsing without `@paws/parsers`
- **`DiffUtils`** (DIFF) - File comparison without external libraries
- **`VerificationManager`** (VRFY) - Test execution in Web Workers
- **`GenesisSnapshot`** (GENS) - RSI evolution tracking

**No PAWS installation required** - all functionality available in browser.

---

## Subfolders

- **[Blueprints](blueprints/README.md)** - RSI modules for recursive self-improvement
- **[WebRTC Coordinator](upgrades/webrtc-coordinator.js)** - Browser P2P multi-agent coordination
- **[Tests](tests/README.md)** - Test suite documentation
- **[Docs](docs/rfcs/README.md)** - RFCs and design documents

---

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[← CLI-PY](../cli-py/README.md)** | **[← CLI-JS](../cli-js/README.md)** | **[← Core](../core/README.md)**
