# REPLOID

**[Browser-Native AI Agent with Recursive Self-Improvement](https://github.com/clocksmith/paws/tree/main/reploid)**

REPLOID is a fully browser-based AI agent environment that can introspect and modify its own code. No backend required - everything runs in your browser using IndexedDB, WebGPU, and Web Workers.

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
# Choose "Meta-RSI Core" (recommended)

# 5. Enter a goal
"Analyze the current module dependencies and suggest optimizations"

# 6. Watch the agent work
# - Loads modules from VFS
# - Introspects code
# - Proposes changes
# - Requests approval
# - Runs tests
# - Applies or rolls back
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
- **1 Module** (`upgrades/tool-runner.js`) - JavaScript with DI container pattern
- **1 Blueprint** (`blueprints/0x00000A-tool-runner.md`) - Design documentation
- **1 Test** (`tests/unit/tool-runner.test.js`) - Unit tests
- **1 Widget** (defined in same file) - Web Component for visualization

---

## Boot Modes

REPLOID offers 4 progressive tiers to match your use case:

### ★ Essential Core (8 modules, ~500ms)
**Perfect for learning REPLOID basics**

The bare minimum to run an agent:
- Agent cognitive loop
- Virtual file system (VFS)
- Tool execution
- Basic UI
- Single LLM provider

**Best for:** First-time users, tutorials, understanding core concepts

---

### ☥ Meta-RSI Core (15 modules, ~1s) **← RECOMMENDED**
**Tools that create tools**

Everything in Essential Core, plus:
- **Meta-tool creator** - Tools that create other tools
- **Multi-model mixing** - Mix Gemini, GPT, Claude, and local models
- **Code introspection** - Agent can examine its own code
- **Streaming responses** - Real-time UI updates
- **Context management** - Smart token pruning

**Best for:**
- Experimenting with meta-tool creation
- Multi-model agent workflows
- Self-improving agents
- Core REPLOID vision

---

### ☇ Full-Featured (28 modules, ~2s)
**Production-ready with monitoring and testing**

Everything in Meta-RSI Core, plus:
- Performance monitoring and metrics
- Browser API integration (File System, Notifications, etc.)
- Reflection storage for learning over time
- Self-testing framework
- Rate limiting and verification
- Enhanced UI with styling

**Best for:**
- Production projects
- Real-world applications
- Performance-critical workflows
- Projects requiring testing/validation

---

### ⛉ Experimental Suite (All 76 modules, ~5s)
**Every feature for research and power users**

Everything in Full-Featured, plus:
- **Visualization suite** - Agent FSM, AST trees, module graphs, canvas
- **Analytics & monitoring** - Metrics, costs, tool usage tracking
- **Python runtime** - Execute Python via Pyodide + WebAssembly
- **Local LLM** - WebGPU-accelerated local inference
- **WebRTC swarm** - P2P browser-to-browser coordination
- **Meta-cognitive layer** - Autonomous self-improvement
- **Documentation tools** - RFC authoring, blueprint generation
- **Security** - Module integrity, audit logging
- And 48+ more specialized modules...

**Best for:**
- Research and experimentation
- Power users who want everything
- Multi-agent systems
- Bleeding-edge features

---

## Key Features

### 76 Modular Upgrades

Each module is self-contained with:
- DI container pattern for dependency injection
- Web Component widget for visualization
- Blueprint document explaining design decisions
- Unit tests for reliability

**Module Categories:**
- **Core** (8) - Agent loop, VFS, tool execution, UI
- **Meta** (7) - Meta-tool creation, multi-model, introspection
- **Full** (13) - Monitoring, browser APIs, reflection, testing
- **Experimental** (48) - Visualization, Python, local LLM, WebRTC, etc.

### Virtual File System (VFS)

Browser-native storage using IndexedDB:
- Stores all modules, blueprints, and state
- Persists across sessions
- Supports import/export
- Git-like checkpoint system

### Multi-Model Mixing

Use multiple LLMs in a single workflow:
```javascript
// Query Gemini for design
const design = await HYBR.query({
  provider: "gemini",
  model: "gemini-2.0-flash-exp",
  prompt: "Design a caching system"
});

// Get Claude to review
const review = await HYBR.query({
  provider: "anthropic",
  model: "claude-3-5-sonnet-20241022",
  prompt: `Review this design: ${design}`
});
```

**Supported Providers:**
- ☁️ Cloud: Gemini, Claude (Anthropic), GPT-4 (OpenAI)
- 🖥️ Local: Ollama (via proxy), WebGPU (in-browser)

### Meta-Tool Creation

Agents can create new tools for themselves:
```javascript
const newTool = {
  name: "analyze_performance",
  description: "Analyze code performance bottlenecks",
  input_schema: {
    type: "object",
    properties: {
      code: { type: "string" }
    }
  },
  handler: (input) => {
    return analyzeCode(input.code);
  }
};

// Agent registers and uses immediately
await MTCP.createTool(newTool);
```

### Recursive Self-Improvement (RSI)

Agent can modify its own code with safety:

**Safety Guardrails:**
1. **Checkpoints** - Git-like snapshots before changes
2. **Test Verification** - Changes must pass tests
3. **Human Approval** - All modifications require confirmation
4. **Automatic Rollback** - Revert on test failure
5. **Blueprint Compliance** - Changes must follow design patterns

**Example RSI Flow:**
```
1. Agent reads blueprint 0x000003 (Error Handling)
2. Analyzes current code in agent-cycle.js
3. Proposes improvements with rationale
4. Creates checkpoint: "before-error-handling-improvements"
5. Requests human approval
6. Applies changes if approved
7. Runs unit tests
8. Rolls back if tests fail
```

### Web Component Widgets

Every module has a visual dashboard:
- Real-time status monitoring
- Interactive controls
- Scoped styles (Shadow DOM)
- Event-driven updates

**Example Widget:**
```javascript
class ToolRunnerWidget extends HTMLElement {
  getStatus() {
    return {
      state: 'active',
      primaryMetric: `${stats.total} executions`,
      secondaryMetric: `${stats.success} success`,
      lastActivity: Date.now()
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <div class="panel">
        <h3>🔧 Tool Runner</h3>
        <div>Total: ${stats.total}</div>
      </div>
    `;
  }
}
```

### Blueprint System

67+ architectural blueprints guide development:
- Design patterns
- Implementation strategies
- Trade-off analysis
- Code examples
- Test requirements

**Blueprint Format:**
```markdown
# Blueprint 0x00000A: Tool Runner Engine

**Objective:** Execute tools in sandboxed environment

**Prerequisites:**
- 0x000003 (Error Handling)
- 0x000008 (Agent Cognitive Cycle)

**Implementation:**
1. Create tool registry
2. Implement sandboxing
3. Add error recovery
4. Create widget interface
```

---

## Architecture

### Boot Architecture

```
index.html
    ↓
boot.js (bootstrapper)
    ↓
DI Container
    ↓
Load Modules (based on tier)
    ↓
Register Widgets
    ↓
Initialize Agent Cognitive Loop
    ↓
Start Execution
```

### Module Architecture

```
Module (upgrades/*.js)
    ├── metadata: { id, version, dependencies, type }
    ├── factory: (deps) => { ... }
    │    ├── api: Public methods
    │    ├── widget: Web Component
    │    └── internal: Private state
    └── export for DI container
```

### DI Container Pattern

```javascript
const MyModule = {
  metadata: {
    id: 'MyModule',
    dependencies: ['Utils', 'EventBus'],
    async: false
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;

    // Private state
    let _state = {};

    // Public API
    const api = {
      doSomething: () => { /* ... */ }
    };

    // Widget
    class MyModuleWidget extends HTMLElement { /* ... */ }

    return {
      api,
      widget: { element: 'my-module-widget', ... }
    };
  }
};
```

---

## File Structure

```
/reploid
  ├── index.html              # Boot UI and entry point
  ├── boot.js                 # Module loader and DI container
  ├── config.json             # Module configuration (4-tier system)
  ├── /upgrades               # All 76 modules (JavaScript)
  ├── /blueprints             # 67+ design documents (Markdown)
  ├── /tests                  # Unit and integration tests
  │   ├── /unit               # Module tests (1:1 with upgrades)
  │   ├── /integration        # Integration tests
  │   └── /e2e                # End-to-end tests (Playwright)
  ├── /server                 # Proxy server for LLM APIs
  │   ├── proxy.js            # Main proxy (stdio → HTTP for Ollama)
  │   └── signaling-server.js # WebRTC signaling
  ├── /docs                   # Documentation
  ├── /styles                 # CSS for UI
  ├── /utils                  # Utility modules
  └── /integrations           # Claude Code, VS Code, etc.
```

---

## Configuration

Edit `config.json` to:
- Select boot tier (Essential/Meta/Full/Experimental)
- Configure LLM providers (API keys, endpoints)
- Set WebRTC signaling server
- Adjust module loading
- Configure permissions

**Example config.json:**
```json
{
  "version": "1.0",
  "bootMode": "meta",
  "api": {
    "provider": "gemini",
    "geminiKey": "your-api-key",
    "timeout": 180000
  },
  "localLLM": {
    "enabled": true,
    "endpoint": "http://localhost:11434"
  },
  "modules": {
    "essential": ["agent-cycle", "vfs", "tool-runner", ...],
    "meta": ["meta-tool-creator", "hybrid-llm", ...],
    "full": ["performance-monitor", "browser-apis", ...],
    "experimental": ["local-llm", "webrtc-swarm", ...]
  }
}
```

---

## Example Workflows

### Workflow 1: Multi-Model Code Review

```javascript
// Use Gemini for initial draft
const code = await HYBR.query({
  provider: "gemini",
  prompt: "Write a caching module with TTL support"
});

// Use Claude for code review
const review = await HYBR.query({
  provider: "anthropic",
  prompt: `Review this code:\n${code}`
});

// Use local model for style check
const styleCheck = await HYBR.query({
  provider: "ollama",
  model: "codellama",
  prompt: `Check style:\n${code}`
});
```

### Workflow 2: Meta-Tool Creation

```javascript
// Agent creates a new tool
const tool = await MTCP.createTool({
  name: "analyze_dependencies",
  description: "Analyze module dependencies",
  input_schema: {
    type: "object",
    properties: {
      moduleName: { type: "string" }
    }
  },
  handler: async (input) => {
    const deps = analyzeDeps(input.moduleName);
    return { dependencies: deps };
  }
});

// Tool is immediately available
const result = await ToolRunner.runTool("analyze_dependencies", {
  moduleName: "agent-cycle"
});
```

### Workflow 3: Self-Improvement

```javascript
// Agent reads its own code
const currentCode = await VFS.readArtifact("/upgrades/agent-cycle.js");

// Analyzes based on blueprint
const blueprint = await VFS.readArtifact("/blueprints/0x000008-agent-cognitive-cycle.md");

// Proposes improvements
const proposal = await LLM.query({
  prompt: `Improve this code based on blueprint:\n${blueprint}\n${currentCode}`
});

// Creates checkpoint
await StateManager.createCheckpoint("before-agent-cycle-improvements");

// Requests approval
const approved = await UI.requestApproval(proposal);

if (approved) {
  // Apply changes
  await VFS.writeArtifact("/upgrades/agent-cycle.js", improvedCode);

  // Run tests
  const testsPassed = await SelfTester.runTests("agent-cycle");

  if (!testsPassed) {
    // Rollback
    await StateManager.restoreCheckpoint("before-agent-cycle-improvements");
  }
}
```

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
- `upgrades/tool-runner.js` → `tests/unit/tool-runner.test.js`
- Tests cover API methods, error handling, edge cases
- Widgets tested separately with DOM mocking

---

## Development

### Adding a New Module

Follow the **1:1:1:1 pattern**:

1. **Create Blueprint** (`blueprints/0xNNNNNN-my-module.md`)
2. **Write Module** (`upgrades/my-module.js`)
   - Implement `metadata` and `factory`
   - Create Web Component widget in same file
   - Add `@blueprint 0xNNNNNN` annotation
3. **Write Test** (`tests/unit/my-module.test.js`)
4. **Register Module** (add to `config.json`)

**See:** [docs/WEB_COMPONENTS_GUIDE.md](docs/WEB_COMPONENTS_GUIDE.md) for complete guide

### Module Widget Protocol

All modules must export a widget interface:

```javascript
return {
  api: {
    // Public methods
  },
  widget: {
    element: 'my-module-widget',      // Custom element name
    displayName: 'My Module',          // Human-readable name
    icon: '🔧',                        // Icon emoji
    category: 'tools',                 // core/tools/ai/storage/ui/analytics/rsi
    updateInterval: 5000               // Auto-refresh interval (optional)
  }
};
```

**Widget Requirements:**
- Must extend `HTMLElement`
- Must use Shadow DOM
- Must implement `getStatus()` method
- Should implement `getControls()` for actions
- Must be defined in same file as module

**See:** [docs/MODULE_WIDGET_PROTOCOL.md](docs/MODULE_WIDGET_PROTOCOL.md)

---

## Advanced Features

### Python Runtime (Pyodide)

Execute Python code via WebAssembly:
```javascript
const result = await PYO.runPython(`
import numpy as np
arr = np.array([1, 2, 3])
result = arr.mean()
`);
```

### Local LLM (WebGPU)

Run models entirely in browser:
```javascript
await LLLM.initialize("Llama-3.2-1B");
const response = await LLLM.complete("Explain recursion");
```

### WebRTC P2P Swarm

Browser-to-browser agent coordination:
```javascript
await SWRM.joinSwarm("my-swarm-id");
await SWRM.broadcastGoal("Analyze distributed system");
const results = await SWRM.collectResults();
```

---

## Comparison to Other Tools

| Feature | REPLOID | Cursor | Claude Code | Devin |
|---------|---------|--------|-------------|-------|
| **Runtime** | Browser | VS Code | CLI | Cloud VM |
| **Self-Modify** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Multi-Model** | ✅ Yes | ❌ No | ❌ No | ❌ No |
| **Local LLM** | ✅ WebGPU | ❌ No | ❌ No | ❌ No |
| **P2P Swarm** | ✅ WebRTC | ❌ No | ❌ No | ❌ No |
| **No Backend** | ✅ Yes | ⚠️ Partial | ❌ No | ❌ No |
| **Meta-Tools** | ✅ Yes | ❌ No | ❌ No | ❌ No |

---

## Relationship to PAWS Monorepo

REPLOID is part of the PAWS monorepo but is a **standalone project**.

**Shared with PAWS:**
- Philosophy (multi-agent, human-in-loop, context engineering)
- Some utilities (personas, system prompts)
- Git workflows and markdown formats

**Not shared:**
- Runtime (browser vs CLI)
- Storage (VFS/IndexedDB vs filesystem)
- Primary use case (self-improvement vs multi-agent competition)

**Potential future integration:**
- Export PAWS CLI solutions as REPLOID modules
- Use REPLOID as MCP server for PAWS tools
- Shared context format across projects

**Current status:** Integration is aspirational, not implemented.

**See:** [../README.md](../README.md) for monorepo overview

---

## FAQ

**Q: Which boot tier should I start with?**
A: **Meta-RSI Core** (15 modules). It has the core vision without overwhelming complexity.

**Q: Can I switch tiers later?**
A: Yes! Just reload with a different boot mode. Your VFS data persists in IndexedDB.

**Q: Is this actually running in the browser?**
A: Yes! 100% browser-native. No backend server required (except optional proxy for LLM API calls).

**Q: Can agents modify their own code?**
A: Yes, with RSI modules (Meta tier+). All changes require human approval and test verification.

**Q: How does this differ from Claude Code?**
A: Claude Code is a CLI tool. REPLOID runs in browser with VFS, can modify itself, supports multi-model mixing, and has P2P swarm capabilities.

**Q: Do I need to know the 76 modules?**
A: No. Start with Essential (8) or Meta (15). The module system is progressive.

**Q: Can I use this offline?**
A: Partially. VFS/modules work offline, but LLM queries need network (unless using local WebGPU models).

**Q: How do I debug modules?**
A: Browser DevTools. All modules run in main thread. Widgets use Shadow DOM for style isolation.

---

## Troubleshooting

**Problem:** "Module failed to load"
**Solution:** Check browser console. Likely missing dependency or syntax error.

**Problem:** "API key invalid"
**Solution:** Update `config.json` with valid API keys for your providers.

**Problem:** "Tests failing after modification"
**Solution:** Automatic rollback should occur. Check checkpoint history.

**Problem:** "WebGPU not available"
**Solution:** Use Chrome/Edge 113+. Safari doesn't fully support WebGPU yet.

**Problem:** "IndexedDB quota exceeded"
**Solution:** Clear VFS or export important data. Browser has storage limits.

**See:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for more

---

## Documentation

- **[Quick Start](docs/QUICK-START.md)** - Get running in 5 minutes
- **[Web Components Guide](docs/WEB_COMPONENTS_GUIDE.md)** - Adding new modules
- **[Blueprint System](docs/BLUEPRINT_UPDATE_GUIDE.md)** - Writing design docs
- **[Module Widget Protocol](docs/MODULE_WIDGET_PROTOCOL.md)** - Widget requirements
- **[MCP Tools vs Upgrades](docs/MCP_TOOLS_VS_UPGRADES.md)** - Critical distinctions
- **[Testing Guide](docs/WEB_COMPONENTS_TESTING_GUIDE.md)** - Testing patterns
- **[Troubleshooting](docs/TROUBLESHOOTING.md)** - Common issues
- **[API Reference](docs/API.md)** - Module documentation
- **[Full Docs Index](docs/README.md)** - All documentation

---

## Contributing

Follow the **1:1:1:1 pattern**:
- 1 Module (`upgrades/*.js`)
- 1 Blueprint (`blueprints/0xNNNNNN-*.md`)
- 1 Test (`tests/unit/*.test.js`)
- 1 Widget (defined in module file)

**See:** [docs/WEB_COMPONENTS_GUIDE.md](docs/WEB_COMPONENTS_GUIDE.md) before creating modules.

---

## License

MIT

---

## Acknowledgments

Built with the vision of **tools that create tools** and **agents that improve themselves**.

Inspired by:
- Recursive Self-Improvement (RSI) research
- Meta-learning and meta-programming
- Browser-native AI capabilities
- Human-in-the-loop AI safety

---

**REPLOID: Because the best agent is one that can modify itself.**
