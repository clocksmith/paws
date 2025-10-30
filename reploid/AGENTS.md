# AGENTS.md - AI Coding Assistant Guide for REPLOID

**Target Audience:** AI coding tools (Claude Code, Cursor, Windsurf, etc.) helping developers modify REPLOID source code.

---

## Critical Setup Information

### Package Manager: pnpm (NOT npm)

**IMPORTANT:** This project uses **pnpm** in a monorepo structure. Using `npm install` will create broken symlinks.

```bash
# ✅ CORRECT
pnpm install

# ❌ WRONG - Will break dependencies
npm install
```

**If you see `ERR_MODULE_NOT_FOUND` errors:** The user likely ran `npm install`. Solution:
```bash
rm -rf node_modules package-lock.json
pnpm install
```

### Quick Start

```bash
# Install dependencies
pnpm install

# Start proxy server (handles LLM API calls)
pnpm start  # http://localhost:8000

# Run tests
pnpm test
pnpm run test:coverage
pnpm run test:e2e
```

---

## Project Overview

**REPLOID** is a browser-native AI agent that can introspect and modify its own code.

**Key Characteristics:**
- **Runtime:** Browser (IndexedDB, Web Workers, WebGPU) + Node.js proxy server
- **Language:** JavaScript ES Modules (`"type": "module"` in package.json)
- **Architecture:** Dependency Injection (DI) container pattern
- **Storage:** Virtual File System (VFS) backed by IndexedDB
- **UI:** Web Components with Shadow DOM
- **State:** Finite State Machine (FSM) for agent workflow

---

## Architecture Patterns

### 1:1:1:1 Module Pattern

Every module follows this structure:

```
upgrades/core/my-module.js      → Implementation
blueprints/0x0000XX-my-module.md → Design documentation
tests/unit/my-module.test.js     → Unit tests
[Widget defined in same file]    → Web Component
```

### Dependency Injection Container

```javascript
// Module registration
ModuleLoader.register('MyModule', ['Dependency1', 'Dependency2'],
  (dep1, dep2) => {
    // Factory function
    return {
      myMethod() { /* ... */ }
    };
  }
);

// Module loading
const myModule = await ModuleLoader.getModule('MyModule');
```

**Key File:** `upgrades/core/module-loader.js`

### Event Bus Pattern

Modules communicate via pub/sub:

```javascript
// Emit event
EventBus.emit('event:name', { data });

// Listen to event
EventBus.on('event:name', (data) => { /* ... */ });
```

**Key File:** `upgrades/core/event-bus.js`

**Critical Events:**
- `fsm:state:changed` - Agent state transitions
- `llm:tokens` - Token usage updates
- `vfs:write` - VFS file modifications
- `approval:required` - Human approval needed

### Virtual File System (VFS)

Browser-based file system using IndexedDB:

```javascript
// Read file
const content = await VFS.readFile('/upgrades/core/my-module.js');

// Write file
await VFS.writeFile('/upgrades/core/my-module.js', newContent);

// List files
const files = await VFS.listFiles('/upgrades/');
```

**Key File:** `upgrades/core/storage-manager.js`

---

## File Organization

```
reploid/
├── upgrades/               # All executable modules
│   ├── core/              # 63 core modules (agent logic, VFS, LLM)
│   ├── ui/                # 16 UI modules (dashboards, panels)
│   └── archived/          # 11 deprecated modules
├── blueprints/            # 67+ design documents (markdown)
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright E2E tests
├── server/
│   ├── proxy.js          # Multi-provider LLM proxy (Express)
│   └── signaling-server.js  # WebRTC signaling
├── boot/                 # Boot screen UI (HTML/CSS/JS)
├── docs/                 # Documentation
├── personas/             # Agent behavior presets
├── config.json           # Runtime configuration
├── module-manifest.json  # Module loading presets
└── package.json          # pnpm workspace config
```

---

## Agent Workflow (FSM States)

REPLOID's agent follows this state machine:

1. **IDLE** → Waiting for goal
2. **CURATING_CONTEXT** → AI selects relevant files
3. **AWAITING_CONTEXT_APPROVAL** → Human approves file selection
4. **PLANNING_WITH_CONTEXT** → AI plans changes
5. **GENERATING_PROPOSAL** → AI generates code diffs
6. **AWAITING_PROPOSAL_APPROVAL** → Human approves changes (required)
7. **APPLYING_CHANGESET** → Writes changes to VFS
8. **REFLECTING** → AI self-reflection

**Key File:** `upgrades/core/sentinel-fsm.js`
**Documentation:** `docs/AGENT-WORKFLOW.md`

---

## Multi-Provider LLM Support

REPLOID supports multiple LLM providers through a unified API gateway:

**Providers:**
- **Gemini** (Google) - Default, fast
- **Claude** (Anthropic) - Best reasoning
- **GPT-4** (OpenAI) - Code generation
- **Ollama** (Local) - Privacy
- **WebGPU** (Browser) - Experimental

**Proxy Endpoints:**
```
/api/gemini/*      → Gemini proxy
/api/anthropic/*   → Claude proxy
/api/openai/*      → GPT-4 proxy
/api/local/*       → Ollama/local models
/api/health        → Provider availability
```

**Configuration:**
- API keys: `.env` or `config.json`
- Provider selection: `config.apiProvider`
- Automatic fallback if provider unavailable

**Key Files:**
- `server/proxy.js` - Proxy server implementation
- `upgrades/core/api-client-multi.js` - Client-side gateway
- `blueprints/0x000021-multi-provider-api-gateway.md` - Architecture

---

## Boot Modes (Presets)

Defined in `module-manifest.json`:

1. **Headless** (31 modules) - Core agent, no UI
2. **Minimal-RSI** (35 modules) - Basic UI + RSI
3. **RSI-Core** (46 modules) - **RECOMMENDED** - Full UI
4. **Experimental** (56 modules) - Everything (Python, WebGPU, WebRTC)

---

## Common Development Tasks

### Adding a New Module

1. Create `upgrades/core/my-module.js`:
```javascript
ModuleLoader.register('MyModule', ['Dependency1'],
  (dep1) => {
    return {
      myMethod() { /* ... */ }
    };
  }
);
```

2. Create `tests/unit/my-module.test.js`:
```javascript
import { describe, it, expect } from 'vitest';
// Test implementation
```

3. Create `blueprints/0x0000XX-my-module.md` (design doc)

4. Update `module-manifest.json` to include in preset

### Modifying Existing Modules

1. Read the corresponding blueprint first: `blueprints/0x0000XX-*.md`
2. Check dependencies in module registration
3. Ensure tests pass after changes: `pnpm test`
4. Update blueprint if architecture changes

### Working with Web Components

All UI modules define widgets at the bottom of the file:

```javascript
class MyModuleWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Scoped styles */</style>
      <div>/* Shadow DOM content */</div>
    `;
  }
}

customElements.define('my-module-widget', MyModuleWidget);
```

### Testing

```bash
# Run all tests
pnpm test

# Watch mode
pnpm run test:watch

# Coverage report
pnpm run test:coverage

# E2E tests (Playwright)
pnpm run test:e2e

# Specific test file
pnpm test tests/unit/my-module.test.js
```

**Test Framework:** Vitest (unit), Playwright (E2E)

---

## Key Modules Reference

| Module | Path | Purpose |
|--------|------|---------|
| **ApiClientMulti** | `upgrades/core/api-client-multi.js` | LLM provider gateway |
| **SentinelFSM** | `upgrades/core/sentinel-fsm.js` | Agent state machine |
| **SentinelTools** | `upgrades/core/sentinel-tools.js` | Agent tool execution |
| **StorageManager** | `upgrades/core/storage-manager.js` | VFS/IndexedDB |
| **ModuleLoader** | `upgrades/core/module-loader.js` | DI container |
| **EventBus** | `upgrades/core/event-bus.js` | Pub/sub messaging |
| **UIManager** | `upgrades/ui/ui-manager.js` | Dashboard coordination |
| **SentinelPanel** | `upgrades/ui/sentinel-panel.js` | Human approval UI |

---

## Configuration Files

### config.json
Runtime configuration for REPLOID agent:
```json
{
  "apiProvider": "gemini",
  "bootMode": "rsi-core",
  "api": {
    "geminiKey": "...",
    "anthropicKey": "...",
    "openaiKey": "..."
  }
}
```

### module-manifest.json
Defines which modules load in each boot mode:
```json
{
  "presets": {
    "rsi-core": ["ApiClientMulti", "SentinelFSM", ...]
  }
}
```

### .env
Server environment variables:
```bash
GEMINI_API_KEY=your_key
ANTHROPIC_API_KEY=your_key
OPENAI_API_KEY=your_key
PORT=8000
AUTO_START_OLLAMA=true
```

---

## Safety & Self-Improvement

REPLOID agents can modify their own code with guardrails:

1. **Checkpoints** - VFS snapshots before changes
2. **Test Verification** - Changes must pass tests
3. **Human Approval** - All proposals require confirmation (cannot be bypassed)
4. **Automatic Rollback** - Revert on test failure
5. **Blueprint Compliance** - Validate against design docs

**Critical:** `AWAITING_PROPOSAL_APPROVAL` state always requires human approval - this is a safety feature, not a bug.

---

## Common Issues & Solutions

### "ERR_MODULE_NOT_FOUND" when starting server
**Cause:** Used `npm install` instead of `pnpm install`
**Solution:**
```bash
rm -rf node_modules package-lock.json
pnpm install
```

### Agent stuck in CURATING_CONTEXT
**Debug:**
- Check browser console for errors
- Verify LLM provider is available: `curl http://localhost:8000/api/health`
- Check API keys in `.env`

### Tests failing after module changes
**Debug:**
- Check dependencies are registered: `ModuleLoader.register(...)`
- Verify EventBus events are emitted/received
- Mock external dependencies in tests

### VFS changes not persisting
**Debug:**
- Check browser IndexedDB: DevTools → Application → IndexedDB
- Verify `StorageManager` is initialized
- Check for quota exceeded errors in console

---

## Monorepo Context

REPLOID is part of the PAWS monorepo:

```
paws/
├── packages/cli-js/     # PAWS CLI tools (cats, dogs, arena)
├── reploid/             # ← You are here
├── lens/                # MCP analytics
└── integrations/        # VSCode, MCP servers
```

**Workspace:** pnpm workspaces
**Shared:** Build tools, some utilities
**Independent:** Runtime, storage, architecture

---

## Documentation References

- **README.md** - Project overview
- **AGENT-WORKFLOW.md** - FSM state machine details
- **STYLE-GUIDE.md** - Code conventions
- **blueprints/** - Design docs for each module
- **personas/README.md** - Agent behavior system

---

## Best Practices for AI Assistants

1. **Always read blueprints** before modifying modules
2. **Follow 1:1:1:1 pattern** (module, blueprint, test, widget)
3. **Use DI container** - Never bypass ModuleLoader
4. **Emit events** for cross-module communication
5. **Test thoroughly** - Every module needs tests
6. **Respect FSM states** - Don't skip approval states
7. **Use pnpm** - Never npm in this repo
8. **Check VFS first** - Agent state lives in IndexedDB, not filesystem

---

**Last Updated:** 2025-10-30
**Project:** REPLOID - Browser-Native AI Agent with Recursive Self-Improvement
