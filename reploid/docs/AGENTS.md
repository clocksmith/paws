# AGENTS.md - AI Agent Documentation for REPLOID

**Purpose:** This document provides essential context for AI agents (like Claude, Gemini, GPT-4) working with the REPLOID codebase.

---

## Quick Reference

**Project Type:** Browser-native AI agent with recursive self-improvement
**Package Manager:** **pnpm** (NOT npm)
**Runtime:** Browser + Node.js proxy server
**Language:** JavaScript (ES Modules)
**Key Technology:** IndexedDB VFS, Web Components, DI Container pattern

---

## Setup Instructions

```bash
# Install dependencies (MUST use pnpm)
pnpm install

# Start proxy server
pnpm start  # http://localhost:8000

# Run tests
pnpm test
pnpm run test:coverage
pnpm run test:e2e
```

**Common Issue:** Running `npm install` instead of `pnpm install` will create broken symlinks and cause `ERR_MODULE_NOT_FOUND` errors. Always use `pnpm`.

---

## Architecture Overview

REPLOID follows the **1:1:1:1 Pattern**:
- **1 Module** - JavaScript file in `upgrades/core/` or `upgrades/ui/`
- **1 Blueprint** - Design doc in `blueprints/0x*.md`
- **1 Test** - Test file in `tests/unit/`
- **1 Widget** - Web Component (defined in same module file)

### Core Concepts

**Virtual File System (VFS)**
- Browser-native storage using IndexedDB
- Located at: `upgrades/core/storage-manager.js`
- All modules stored in VFS, can be modified at runtime
- Checkpoints system for rollback

**Dependency Injection Container**
- Pattern: `register('ModuleName', dependencies, factory)`
- Modules loaded via `ModuleLoader.getModule('ModuleName')`
- See: `upgrades/core/module-loader.js`

**Event Bus**
- Pub/sub for module communication
- Located at: `upgrades/core/event-bus.js`
- Critical events: `fsm:state:changed`, `llm:tokens`, `vfs:write`

**Finite State Machine (FSM)**
- Agent workflow: `upgrades/core/sentinel-fsm.js`
- States: IDLE → CURATING_CONTEXT → AWAITING_CONTEXT_APPROVAL → PLANNING_WITH_CONTEXT → GENERATING_PROPOSAL → AWAITING_PROPOSAL_APPROVAL → APPLYING_CHANGESET → REFLECTING
- See: `docs/AGENT-WORKFLOW.md`

---

## File Organization

```
reploid/
├── upgrades/          # All modules (core logic)
│   ├── core/          # 63 core modules (agent, tools, LLM, VFS)
│   ├── ui/            # 16 UI modules (panels, dashboards)
│   └── archived/      # 11 deprecated modules
├── blueprints/        # 67+ design documents
├── tests/
│   ├── unit/          # Unit tests (mirrors upgrades/)
│   └── e2e/           # Playwright tests
├── server/
│   ├── proxy.js       # Multi-provider LLM proxy
│   └── signaling-server.js  # WebRTC signaling
├── boot/              # Boot screen UI
├── docs/              # Documentation
├── config.json        # Runtime configuration
└── module-manifest.json  # Module loading presets
```

---

## Multi-Provider LLM Support

**Supported Providers:**
- ☁️ **Gemini** (Google) - Fast, default
- ☁️ **Claude** (Anthropic) - Best reasoning
- ☁️ **GPT-4** (OpenAI) - Best code generation
- 🖥️ **Ollama** (Local) - Privacy-focused
- 🖥️ **WebGPU** (Browser) - Experimental in-browser inference

**API Gateway:** `upgrades/core/api-client-multi.js`
**Blueprint:** `blueprints/0x000021-multi-provider-api-gateway.md`

**Proxy Endpoints:**
- `/api/gemini/*` - Gemini proxy
- `/api/openai/*` - OpenAI proxy
- `/api/anthropic/*` - Anthropic proxy
- `/api/local/*` - Ollama/local models
- `/api/health` - Provider status check

**Configuration:**
- API keys set in `config.json` or `.env`
- Provider selection: `config.apiProvider` (gemini/openai/anthropic/local)
- Fallback logic if provider unavailable

---

## Boot Modes

REPLOID has 4 progressive presets (defined in `module-manifest.json`):

1. **Headless** (31 modules) - Minimal, no UI
2. **Minimal-RSI** (35 modules) - Basic UI + RSI
3. **RSI-Core** (46 modules) - **RECOMMENDED** - Full UI + RSI
4. **Experimental** (56 modules) - Everything (Python, WebGPU, WebRTC, visualizations)

---

## Safety Guardrails

REPLOID agents can modify their own code with these safety features:

1. **Checkpoints** - VFS snapshots before changes (`upgrades/core/genesis-snapshot-system.js`)
2. **Test Verification** - Changes must pass tests before commit
3. **Human Approval** - All proposals require user confirmation (cannot be bypassed)
4. **Automatic Rollback** - Revert on test failure
5. **Blueprint Compliance** - Changes validated against design docs

**Critical:** Proposal approval (state `AWAITING_PROPOSAL_APPROVAL`) is **always manual** and cannot be automated.

---

## Common Tasks for AI Agents

### Adding a New Module

1. Create file: `upgrades/core/my-module.js`
2. Follow DI pattern:
   ```javascript
   ModuleLoader.register('MyModule', ['Dependency1', 'Dependency2'],
     (dep1, dep2) => {
       // Module factory
       return {
         // Public API
       };
     }
   );
   ```
3. Add Widget at bottom of same file
4. Create test: `tests/unit/my-module.test.js`
5. Create blueprint: `blueprints/0x0000XX-my-module.md`
6. Update `module-manifest.json` to include in preset

### Debugging Agent Stuck States

- Check browser console for errors
- EventBus logs: `EventBus.emit('debug:log', message)`
- FSM state: `SentinelFSM.getCurrentState()`
- VFS inspection: `VFS.listFiles()`

### Working with VFS

```javascript
// Read from VFS
const content = await VFS.readFile('/upgrades/core/my-module.js');

// Write to VFS
await VFS.writeFile('/upgrades/core/my-module.js', newContent);

// List files
const files = await VFS.listFiles('/upgrades/');
```

### Provider Switching

```javascript
// Check available providers
const status = await fetch('/api/health').then(r => r.json());

// Change provider
const client = await ModuleLoader.getModule('ApiClientMulti');
await client.setProvider('anthropic'); // or 'gemini', 'openai', 'local'
```

---

## Testing Guidelines

**Test Requirements:**
- Every module needs a corresponding test in `tests/unit/`
- Use Vitest framework (`vitest`)
- Mock external dependencies (EventBus, VFS, LLM calls)
- Test both success and error paths

**Running Tests:**
```bash
# All tests
pnpm test

# Specific test
pnpm test tests/unit/my-module.test.js

# Watch mode
pnpm run test:watch

# Coverage
pnpm run test:coverage

# E2E tests
pnpm run test:e2e
```

---

## Key Modules Reference

| Module | Path | Purpose |
|--------|------|---------|
| ApiClientMulti | `upgrades/core/api-client-multi.js` | Multi-provider LLM gateway |
| SentinelFSM | `upgrades/core/sentinel-fsm.js` | Agent workflow state machine |
| SentinelTools | `upgrades/core/sentinel-tools.js` | Agent tool execution |
| StorageManager | `upgrades/core/storage-manager.js` | VFS/IndexedDB interface |
| ModuleLoader | `upgrades/core/module-loader.js` | DI container |
| EventBus | `upgrades/core/event-bus.js` | Pub/sub messaging |
| UIManager | `upgrades/ui/ui-manager.js` | Dashboard coordination |
| SentinelPanel | `upgrades/ui/sentinel-panel.js` | Approval UI |

---

## Environment Variables (.env)

```bash
# LLM API Keys
GEMINI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_key_here

# Server Config
PORT=8000
AUTO_START_OLLAMA=true
LOCAL_MODEL_ENDPOINT=http://localhost:11434

# CORS (optional)
CORS_ORIGINS=http://localhost:8080
```

---

## Common Pitfalls

1. **Using npm instead of pnpm** - Will break dependencies
2. **Modifying modules without checkpoints** - Can't rollback
3. **Bypassing proposal approval** - Not possible, by design
4. **Not following 1:1:1:1 pattern** - Breaks conventions
5. **Hardcoding provider** - Use ApiClientMulti instead
6. **Ignoring EventBus** - Modules won't communicate
7. **Direct DOM manipulation** - Use Web Components/Shadow DOM

---

## Related Documentation

- **AGENT-WORKFLOW.md** - Agent state machine workflow
- **STYLE-GUIDE.md** - Code style conventions
- **blueprints/** - Design documentation for each module
- **README.md** - Project overview

---

**Last Updated:** 2025-10-30
**Maintained for:** Claude, Gemini, GPT-4, and other AI assistants
