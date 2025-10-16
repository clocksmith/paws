# REPLOID Changelog

All notable changes to REPLOID are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added (2025-10-01) - Post-Roadmap Enhancements

- **HybridLLMProvider Integration** ✅
  - Wired local LLM inference into agent execution loops (sentinel-fsm.js, agent-cycle.js)
  - Agent can now use WebGPU-accelerated local models for zero-cost completions
  - Automatic fallback to cloud when local inference unavailable
  - Files: `upgrades/sentinel-fsm.js`, `upgrades/agent-cycle.js`

- **Python Tool Registration** ✅
  - Added `execute_python` tool to agent's tool catalog
  - Agent can now execute Python code with NumPy, SciPy, pandas support
  - Package installation and workspace sync capabilities
  - Files: `upgrades/tools-write.json`, `upgrades/tool-runner.js`

- **Git VFS Bug Fixes** ✅
  - Fixed undefined variable errors (fs → pfs, repoDir → REPO_DIR)
  - History, diff, and commit tracking now stable
  - Files: `upgrades/git-vfs.js` (lines 278, 290, 326, 346)

- **Multi-Agent Swarm Intelligence** ✅
  - Created SwarmOrchestrator module for distributed coordination
  - Task delegation across browser tabs with WebRTC
  - Knowledge sharing and reflection synchronization
  - Consensus mechanism for risky modifications
  - Files: `upgrades/swarm-orchestrator.js`, `upgrades/sentinel-fsm.js`, `config.json`

- **Cloud Streaming Support** ✅
  - Implemented progressive chunked streaming for cloud completions
  - Consistent streaming UX for both local and cloud modes
  - 50ms chunk delays for responsive feedback
  - Files: `upgrades/hybrid-llm-provider.js` (lines 235-266)

- **Reflection Pattern Recognition** ✅
  - Created ReflectionAnalyzer module for learning from experience
  - Clustering similar reflections via Jaccard similarity
  - Failure pattern detection with recommendations
  - Success strategy identification and ranking
  - Solution recommendations based on past cases
  - Files: `upgrades/reflection-analyzer.js`, `config.json`

- **Vision Model Support** ✅
  - Extended LocalLLM to support multi-modal inputs
  - Added Phi-3.5-vision and LLaVA model options
  - Image upload UI with preview
  - Format messages with image_url for vision models
  - Files: `upgrades/local-llm.js`, `ui-dashboard.html`

- **Auto-Apply Performance Optimizations** ✅
  - Enhanced PerformanceOptimizer with memoization, throttling, retry wrappers
  - Automatic optimization application on high-priority suggestions
  - Optimization history tracking in state
  - Public API for memoize, throttle, withRetry helpers
  - Files: `upgrades/performance-optimizer.js`

### Added (Previous)
- **cats/dogs validation commands** (QW-1) ✅
  - `cats validate <bundle>` - Validate cats.md bundle format
  - `dogs validate <bundle>` - Validate dogs.md bundle format
  - `dogs diff <bundle>` - Show detailed diff of proposed changes
  - Comprehensive format validation with helpful error messages
  - Security checks for path traversal (..) in bundles
  - Bundle statistics (file count, size, operation breakdown)
  - Files: `bin/cats`, `bin/dogs`
- **Export functionality** (QW-2) ✅
  - Copy diff to clipboard with visual feedback
  - Export diff as markdown file
  - Share diff using Web Share API
  - Export session report with full history
  - Copy file contents from VFS Explorer
  - All export buttons have visual feedback
  - Files: `upgrades/diff-viewer-ui.js`, `upgrades/vfs-explorer.js`, `upgrades/ui-manager.js`, `ui-dashboard.html`, `styles/dashboard.css`
- **Accessibility improvements** (QW-3) ✅
  - ARIA labels for all panels and interactive elements
  - ARIA live regions for dynamic content (status bar, thought stream, logs)
  - ARIA roles (main, region, tree, treeitem, toolbar, progressbar)
  - Focus indicators with high contrast cyan outline
  - aria-pressed state for toggle buttons
  - aria-expanded state for collapsible content
  - Keyboard navigation support with visible focus
  - Screen reader friendly labels throughout UI
  - Files: `ui-dashboard.html`, `styles/dashboard.css`, `upgrades/ui-manager.js`, `upgrades/vfs-explorer.js`, `upgrades/diff-viewer-ui.js`
- **Performance monitoring** (RSI-5) ✅
  - Real-time metrics collection for tools, states, LLM API, and memory
  - EventBus integration for automatic tracking
  - Tool execution timing (calls, average time, errors)
  - State transition tracking (entries, duration)
  - LLM API metrics (calls, tokens, latency, error rate)
  - Memory usage sampling (current, peak, usage percentage)
  - Interactive performance panel in UI with 4-way toggle
  - Export performance reports as markdown
  - Statistical analysis (avg, median, P95 latency)
  - Files: `upgrades/performance-monitor.js`, `upgrades/ui-manager.js`, `ui-dashboard.html`, `styles/dashboard.css`, `config.json`
- **Code introspection** (RSI-1) ✅
  - Module dependency graph analysis with statistics
  - Tool catalog discovery (read/write tools)
  - Code complexity analysis (functions, classes, conditionals, loops)
  - Pattern detection (TODOs, FIXMEs, errors, warnings)
  - Browser capability detection (WebGPU, WebAssembly, WebWorker, etc.)
  - Self-analysis report generation
  - Interactive introspection panel in UI with 4-way toggle
  - Export self-analysis reports as markdown
  - Module graph visualization (placeholder for future D3.js implementation)
  - Files: `upgrades/introspector.js`, `upgrades/ui-manager.js`, `ui-dashboard.html`, `styles/dashboard.css`, `config.json`
- Comprehensive RSI-focused documentation in README.md
- New RSI-specific priorities in TODO.md (introspection, reflection, self-testing, web APIs, performance monitoring)
- Unified docs/ROADMAP.md consolidating all improvement tasks
- docs/rfcs/ directory for RFC proposals
- docs/CHANGELOG.md for tracking changes
- docs/INDEX.md master navigation document

### Changed
- Moved RFC files from root to docs/rfcs/
- Updated README.md to emphasize browser-native RSI thesis
- Updated cats CLI help text with validate command
- Updated dogs CLI help text with validate and diff commands

## [0.1.0] - 2025-09-30

### Added

#### Core Features
1. **Sentinel Agent FSM (Project Sentinel)** - Complete human-in-the-loop approval system
   - 9-state FSM (IDLE, CURATING_CONTEXT, AWAITING_CONTEXT_APPROVAL, etc.)
   - Interactive diff viewer with selective approval
   - Checkpoint/rollback system
   - REFLECTING state for continuous learning
   - Files: `upgrades/sentinel-fsm.js`, `upgrades/sentinel-tools.js`

2. **PAWS CLI Tools** - Context and change bundle management
   - `bin/cats` - Context bundle creator with glob patterns
   - `bin/dogs` - Change bundle applier with verification
   - CLI command system (`bin/reploid-cli.js`) for agent management
   - Files: `bin/cats`, `bin/dogs`, `bin/reploid-cli.js`

3. **Unified Configuration System**
   - `.reploidrc.json` support with environment variable expansion
   - Multi-path search (local, home, /etc)
   - Configuration CLI (`bin/reploid-config`)
   - Files: `utils/config-loader.js`, `bin/reploid-config`, `.reploidrc.json.example`

4. **VFS Explorer** - Interactive file browser
   - Tree view with expand/collapse
   - Search functionality
   - File viewer modal with syntax highlighting
   - Files: `upgrades/vfs-explorer.js`, `styles/vfs-explorer.css`

5. **Mobile Responsive Design**
   - 4 breakpoints (1024px, 768px, 480px, touch devices)
   - Touch optimizations (44px tap targets, smooth scrolling)
   - Landscape orientation handling
   - Files: `styles/dashboard.css`, `styles/vfs-explorer.css`

#### UI Improvements
6. **Status Bar** - Real-time FSM state visualization
   - Shows current state (IDLE, CURATING, APPLYING, etc.)
   - Animated pulse indicator
   - Progress bar
   - Files: `ui-dashboard.html`, `styles/dashboard.css`, `upgrades/sentinel-fsm.js`

7. **Confirmation Dialogs**
   - Modal confirmation for destructive actions
   - Danger mode styling
   - Keyboard shortcuts (Escape, Enter)
   - Focus management
   - Files: `upgrades/confirmation-modal.js`

#### Developer Experience
8. **Enhanced Error Messages**
   - Network status detection
   - Helpful troubleshooting hints
   - Available tools/services suggestions
   - Files: `upgrades/api-client.js`, `upgrades/tool-runner.js`, `upgrades/di-container.js`, `bin/cats`, `bin/dogs`

9. **npm Package Configuration**
   - Global CLI commands (`reploid`, `cats`, `dogs`, `reploid-config`)
   - Development scripts
   - Test scripts
   - Files: `package.json`

#### Security
10. **Security Improvements**
    - Fixed iframe sandbox (removed allow-same-origin)
    - Shell injection mitigation in cats CLI
    - Security documentation
    - Files: `ui-dashboard.html`, `bin/cats`, `SECURITY-NOTES.md`

### Fixed

#### Critical Bug Fixes
1. **Diff Viewer Async Race Condition**
   - Made `parseDogsBundle()` async
   - Proper await for `StateManager.getArtifactContent()`
   - File: `upgrades/diff-viewer-ui.js:68, 98-105`

2. **Diff Viewer Global State Bug**
   - Changed to single shared instance pattern
   - Fixed onclick handlers referencing stale state
   - File: `upgrades/diff-viewer-ui.js:638-722`

3. **Memory Leaks in Event Listeners**
   - Added listener tracking and cleanup
   - Cleanup on state transitions
   - Files: `upgrades/sentinel-fsm.js:172-230, 304-356`, `upgrades/diff-viewer-ui.js:21-65`

4. **Checkpoint Data Persistence**
   - Fixed checkpoint creation to store actual artifact contents
   - Fixed restoration to properly load artifacts
   - File: `upgrades/state-manager.js:147-221`

### Implemented

#### Core Functionality
1. **parseProposedChanges in Sentinel FSM**
   - Regex parsing of CREATE/MODIFY/DELETE operations
   - File path validation
   - File: `upgrades/sentinel-fsm.js:574-622`

2. **Verification Runner**
   - Integration with VerificationManager (Web Worker)
   - Fallback patterns for common commands
   - File: `upgrades/sentinel-tools.js:334-401`

3. **Git VFS Integration**
   - Implemented `getCommitChanges()` with tree comparison
   - Tree traversal helpers
   - File: `upgrades/git-vfs.js:273-362`

## Architecture

### Current Structure

```
/Users/xyz/deco/reploid/
├── bin/                    # CLI executables
│   ├── cats                # Context bundle creator
│   ├── dogs                # Change bundle applier
│   ├── reploid-cli.js      # Agent management CLI
│   └── reploid-config      # Configuration manager
├── blueprints/             # Core architecture specs (26 blueprints)
├── docs/                   # Documentation
│   ├── rfcs/               # RFC proposals
│   ├── ROADMAP.md          # Development roadmap
│   ├── CHANGELOG.md        # This file
│   ├── PERSONAS.md         # Persona development guide
│   ├── SYSTEM_ARCHITECTURE.md
│   └── ...
├── hermes/                 # Node.js server port
├── personas/               # Agent persona configs
├── server/                 # Proxy server
├── styles/                 # CSS files
├── templates/              # Document templates
├── upgrades/               # Core modules (57 files)
├── utils/                  # Utility modules
├── config.json             # Module registry
├── package.json            # npm configuration
├── README.md               # Main documentation
├── TODO.md                 # Improvement roadmap
├── RFC-STATUS.md           # Project status
└── SECURITY-NOTES.md       # Security tracking
```

### Module Architecture

REPLOID uses a Dependency Injection (DI) container pattern with 40+ modules:

**Core Systems:**
- DIContainer, EventBus, Utils, StateManager, Storage
- ApiClient, ToolRunner, SentinelFSM
- GitVFS, DiffViewerUI, UIManager

**Full list:** See `config.json` module registry

### Data Flow

1. User sets goal → Sentinel FSM enters CURATING_CONTEXT
2. Agent selects files → Creates cats.md context bundle
3. User approves context → FSM enters PLANNING_WITH_CONTEXT
4. Agent generates proposal → Creates dogs.md change bundle
5. User reviews diff → Selective file approval in DiffViewerUI
6. FSM creates checkpoint → Applies approved changes
7. FSM enters REFLECTING → Agent learns from outcome

## Links

- **Repository:** [anthropics/reploid](https://github.com/anthropics/reploid) (hypothetical)
- **Documentation:** [/docs](./docs)
- **Blueprints:** [/blueprints](../blueprints)
- **RFCs:** [/docs/rfcs](./rfcs)
- **Roadmap:** [/docs/ROADMAP.md](./ROADMAP.md)

## Credits

REPLOID implements the PAWS philosophy (Prepare Artifacts With SWAP) for safe AI-assisted development with human-in-the-loop approvals.