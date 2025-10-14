# REPLOID Documentation Index

Complete guide to all documentation in the REPLOID project.

---

## 🚀 Getting Started

Start here if you're new to REPLOID:

1. **[/README.md](../README.md)** - Main project overview, quick start, core concepts
2. **[/test-sentinel-flow.md](../test-sentinel-flow.md)** - Step-by-step testing guide
3. **[docs/PERSONAS.md](./PERSONAS.md)** - Understanding agent personas

---

## 📚 Core Documentation

### System Architecture
- **[docs/SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)** - Complete system design
- **[/blueprints/](../blueprints/)** - 26 architectural specifications (0x000001-0x00001A)
  - Core architecture, storage, agent cognitive cycle, tools, UI, meta-patterns
  - See [blueprints/README.md](../blueprints/README.md) for index

### Development
- **[docs/ROADMAP.md](./ROADMAP.md)** - Prioritized improvement roadmap
- **[/TODO.md](../TODO.md)** - Detailed implementation tasks with code examples
- **[docs/CHANGELOG.md](./CHANGELOG.md)** - Version history and changes
- **[docs/coding-standards.md](./coding-standards.md)** - Code style guide
- **[/STANDARDIZATION.md](../STANDARDIZATION.md)** - Project standards

### RFCs (Proposals)
- **[docs/rfcs/](./rfcs/)** - Request for Change documents
  - RFC-001: Local LLM in Browser (proposed)
  - RFC-002: PAWS CLI Integration (✅ completed)
  - RFC-003: Project Phoenix Refactor (🚧 40% complete)
  - RFC-004: Project Sentinel Agent (✅ completed)
  - See [docs/rfcs/README.md](./rfcs/README.md) for details

### Status Tracking
- **[/RFC-STATUS.md](../RFC-STATUS.md)** - Project-level completion status
- **[/SECURITY-NOTES.md](../SECURITY-NOTES.md)** - Security concerns and mitigations

---

## 🎯 Features & Capabilities

### Agent Personas
- **[docs/PERSONAS.md](./PERSONAS.md)** - Persona development guide
- **[/personas/](../personas/)** - Persona definition files
- **[/config.json](../config.json)** - Persona and module registry

### Local Models
- **[docs/LOCAL_MODELS.md](./LOCAL_MODELS.md)** - Running local LLMs
- **[docs/rfcs/rfc-2025-05-10-local-llm-in-browser.md](./rfcs/rfc-2025-05-10-local-llm-in-browser.md)** - Browser LLM RFC

---

## 🛠️ Implementation Details

### Code Organization

```
/Users/xyz/deco/reploid/
├── bin/                    # CLI executables
│   ├── cats                # Context bundle creator
│   ├── dogs                # Change bundle applier
│   ├── reploid-cli.js      # Agent management CLI
│   └── reploid-config      # Configuration manager
│
├── upgrades/               # Core modules (40+ files)
│   ├── sentinel-fsm.js     # Sentinel Agent FSM
│   ├── sentinel-tools.js   # PAWS tool implementations
│   ├── diff-viewer-ui.js   # Interactive diff viewer
│   ├── git-vfs.js          # Git-based VFS
│   ├── di-container.js     # Dependency injection
│   ├── event-bus.js        # Event system
│   └── ...
│
├── server/                 # Proxy server
│   └── proxy.js
│
├── hermes/                 # Node.js server port
│   └── index.js
│
├── utils/                  # Utility modules
│   ├── config-loader.js    # Configuration system
│   └── ...
│
├── styles/                 # CSS files
│   ├── dashboard.css       # Main dashboard
│   └── vfs-explorer.css    # VFS explorer
│
├── blueprints/             # Architecture specs (26 files)
├── personas/               # Persona configs
├── templates/              # Document templates
└── docs/                   # Documentation hub
    ├── rfcs/               # RFC proposals
    ├── ROADMAP.md          # Development roadmap
    ├── CHANGELOG.md        # Version history
    ├── INDEX.md            # This file
    └── ...
```

### Module System

REPLOID uses a **Dependency Injection (DI) container** pattern. All modules are registered in `/config.json`:

**Core Services:**
- `DIContainer` - Dependency injection
- `EventBus` - Event system
- `Utils` - Logging, error handling
- `Storage` - Persistence layer
- `StateManager` - State management
- `ApiClient` - LLM API communication
- `ToolRunner` - Tool execution engine
- `SentinelFSM` - Sentinel Agent FSM
- `GitVFS` - Git-based virtual filesystem
- `DiffViewerUI` - Interactive diff viewer
- `UIManager` - UI orchestration
- `VFSExplorer` - File browser
- `ConfirmationModal` - Confirmation dialogs

**See `/config.json` for complete module registry.**

### Key Files

| File | Purpose |
|------|---------|
| `/config.json` | Module registry and persona definitions |
| `/package.json` | npm configuration, scripts, dependencies |
| `/.reploidrc.json.example` | Configuration template |
| `/ui-dashboard.html` | Main dashboard UI |
| `/index.html` | Entry point with persona selection |
| `/boot.js` | Persona-based onboarding |

---

## 📖 Reading Guide

### For New Users
1. [README.md](../README.md) - Understand what REPLOID is
2. [test-sentinel-flow.md](../test-sentinel-flow.md) - Try the Sentinel Agent
3. [docs/PERSONAS.md](./PERSONAS.md) - Learn about personas

### For Developers
1. [docs/SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md) - Understand architecture
2. [blueprints/README.md](../blueprints/README.md) - Study core specifications
3. [docs/coding-standards.md](./coding-standards.md) - Follow code style
4. [docs/ROADMAP.md](./ROADMAP.md) - See what needs work
5. [TODO.md](../TODO.md) - Find implementation details

### For Contributors
1. [docs/ROADMAP.md](./ROADMAP.md) - Find tasks to work on
2. [docs/rfcs/README.md](./rfcs/README.md) - Propose new features
3. [blueprints/0x00001A-rfc-authoring.md](../blueprints/0x00001A-rfc-authoring.md) - Learn RFC format
4. [docs/CHANGELOG.md](./CHANGELOG.md) - Document changes

### For RSI Research
1. [README.md](../README.md) - Core RSI thesis
2. [blueprints/0x000012-structured-self-evaluation.md](../blueprints/0x000012-structured-self-evaluation.md) - Self-evaluation framework
3. [blueprints/0x000015-dynamic-tool-creation.md](../blueprints/0x000015-dynamic-tool-creation.md) - Dynamic tool creation
4. [blueprints/0x000016-meta-tool-creation-patterns.md](../blueprints/0x000016-meta-tool-creation-patterns.md) - Meta-tool patterns
5. [blueprints/0x000019-visual-self-improvement.md](../blueprints/0x000019-visual-self-improvement.md) - Visual self-improvement
6. [docs/ROADMAP.md](./ROADMAP.md) - RSI-specific priorities

---

## 🔍 Finding Information

### By Topic

**Architecture & Design:**
- System overview: [docs/SYSTEM_ARCHITECTURE.md](./SYSTEM_ARCHITECTURE.md)
- Core specs: [blueprints/](../blueprints/)
- Module list: [config.json](../config.json)

**Development Tasks:**
- Roadmap: [docs/ROADMAP.md](./ROADMAP.md)
- TODO list: [TODO.md](../TODO.md)
- RFCs: [docs/rfcs/](./rfcs/)

**User Guides:**
- Getting started: [README.md](../README.md)
- Testing: [test-sentinel-flow.md](../test-sentinel-flow.md)
- Personas: [docs/PERSONAS.md](./PERSONAS.md)

**Status & Progress:**
- RFC status: [RFC-STATUS.md](../RFC-STATUS.md)
- Changes: [docs/CHANGELOG.md](./CHANGELOG.md)
- Security: [SECURITY-NOTES.md](../SECURITY-NOTES.md)

### By File Type

**Markdown Documentation:**
- Root: `README.md`, `TODO.md`, `RFC-STATUS.md`, `SECURITY-NOTES.md`, etc.
- `/docs`: Core documentation hub
- `/docs/rfcs`: RFC proposals
- `/blueprints`: Architectural specifications

**Code:**
- `/upgrades`: Core modules
- `/bin`: CLI tools
- `/server`: Proxy server
- `/hermes`: Node.js server
- `/utils`: Utilities

**Configuration:**
- `config.json` - Module and persona registry
- `package.json` - npm configuration
- `.reploidrc.json.example` - User config template

**UI:**
- `index.html` - Entry point
- `ui-dashboard.html` - Main dashboard
- `/styles` - CSS files

---

## 🎯 Quick Reference

**Current Version:** 0.1.0
**Status:** Active development
**Completion:** Core features 100%, Advanced features 20%

**Key Projects:**
- ✅ Project Sentinel (Sentinel Agent) - 100%
- ✅ PAWS CLI - 100%
- 🚧 Project Phoenix (Architecture) - 40%
- 📋 Project Aegis (Security) - Proposed
- 📋 Project Athena (Learning) - Proposed

**Lowest-Hanging Fruit:**
1. cats/dogs validation commands (30 min)
2. Export functionality (45 min)
3. Accessibility ARIA labels (1 hour)

**Next Sprint Focus:**
- RSI-1: Code Introspection
- RSI-2: Reflection Persistence
- RSI-5: Performance Monitoring

---

*This index is maintained automatically. Last updated: 2025-09-30*