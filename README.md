# PAWS (Prepare Artifacts With SWAP (Selected Write Apply PAWS))

Multi-agent AI development toolkit built around **context engineering**. The core idea is that curating what information an AI sees is as important as how you prompt it.

## What is PAWS?

**Goal:** Generate robust solutions through structured cognitive diversity. Rather than relying on a single AI perspective, PAWS orchestrates multiple specialized agents that compete, collaborate, and verify solutions through testing.

**How it works:**
1. **`cats`** - Curate context bundles by scoring files, pruning irrelevant code, and using AI-assisted selection to create focused input.
2. **`dogs`** - Apply changes with interactive approval and git-native safety. Every change is auditable and reversible.
3. **Multi-agent Arena** - Run competing agents in parallel to generate solutions. The best solution is selected through test-driven verification (not Paxos consensus - it's competitive testing where tests determine the winner).
4. **Session state** - Maintain state outside the model to prevent context degradation across multiple turns.

This approach provides streamlined workflows for multi-agent coordination and test-driven solution selection. **PAWS is optimized for CLI-based multi-agent code generation with loose, file-based coordination. It's like Unix pipes for AI agents.**

## REPLOID: Browser-Native AI Agent Environment

**[REPLOID](reploid/README.md)** is a browser-native AI agent framework with a focus on **meta-tool creation** (tools that create tools) and **multi-model mixing**. It runs entirely in the browser with no backend required.

**Core Philosophy:**
1. **Meta-Tool Creation** - Agents that can create new tools for themselves
2. **Multi-Model Mixing** - Combining different LLMs (Gemini, GPT, Claude, local) for hybrid intelligence
3. **Browser-Native** - 100% browser runtime using IndexedDB, WebGPU, and Web Workers
4. **Recursive Self-Improvement (RSI)** - Agents can improve their own code with human oversight

**4-Tier Progressive Architecture:**
- ★ **Essential Core** (8 modules, ~500ms) - Basic agent runtime
- ☥ **Meta-RSI Core** (15 modules, ~1s) - **RECOMMENDED** - Meta-tools + multi-model mixing
- ☇ **Full-Featured** (28 modules, ~2s) - Production ready with monitoring and testing
- ⛉ **Experimental Suite** (76 modules, ~5s) - All features (visualization, Python, local LLM, WebRTC)

**Key Features:**
- **76 modular upgrades** - Each tagged by tier (essential/meta/full/experimental)
- **67+ architectural blueprints** - Design docs teaching implementation patterns
- **Human-supervised safety** - Approval gates, git checkpoints, automatic rollback on test failures
- **Multi-provider support** - Cloud APIs (Gemini, Claude, GPT-4), local Ollama, and WebGPU models

**REPLOID is optimized for browser-native agent environments with modular architecture. Start simple (8 modules), scale to production (28 modules), or use everything (76 modules).** REPLOID is independently capable but shares the DOGS/CATS bundle format with PAWS CLI tools for optional interoperability.

## Packages

- **[@paws/core](packages/core/README.md)** - Shared resources (personas, system prompts, configs)
- **[@paws/cli-js](packages/cli-js/README.md)** - JavaScript CLI tools (cats, dogs, paws-session)
- **[@paws/cli-py](packages/cli-py/README.md)** - Python CLI tools (paws-cats, paws-dogs, paws-arena, paws-swarm)
- **[@paws/reploid](reploid/README.md)** - Browser-native recursive self-improvement framework

## Integrations

- **[MCP Server](integrations/mcp/README.md)** - Model Context Protocol integration for Claude Desktop
- **[VS Code Extension](integrations/vscode/README.md)** - IDE integration with inline diff review

## Getting Started

```bash
# Install
pnpm install
cd packages/cli-py && pip install -e .

# Basic workflow
pnpm --filter @paws/cli-js cats src/**/*.js -o context.md  # Curate context
pnpm --filter @paws/cli-js dogs changes.md                 # Apply changes

# Start browser UI
pnpm --filter @paws/reploid start  # http://localhost:8080
```

See package READMEs for detailed documentation and examples.

## Related Projects

### MCP Widget Protocol (mwp/)

The **[MCP Widget Protocol](mwp/README.md)** is a separate project in this repository that standardizes visual dashboards for Model Context Protocol servers.

**What it does:**
- Provides a protocol for building interactive Web Component widgets for MCP servers
- Enables visual representation of MCP primitives (tools, resources, prompts)
- Includes reference dashboard implementation and official widgets
- Enforces security controls with user confirmation flows

**Relationship to PAWS:**
- Complementary but independent project
- MWP focuses on visual dashboards for **external MCP servers**, PAWS/REPLOID focuses on multi-agent workflows
- **Important:** REPLOID has its own internal "Module Widget Protocol" for visualizing internal modules (76 upgrades like ToolRunner, StateManager, EventBus) - this is separate from MCP Widget Protocol
- **Integration Potential**: REPLOID modules can be converted to MCP servers and visualized with MWP widgets
  - Visual VFS browser with syntax highlighting
  - Blueprint gallery instead of text search
  - Side-by-side diff viewer for proposed modifications
  - Test results dashboard with visual pass/fail indicators
  - Interactive checkpoint timeline
  - Visual approval UI for destructive operations
- **Hybrid Architecture**: REPLOID dashboard can show both internal widgets (Module Widget Protocol) and external widgets (MCP Widget Protocol) side-by-side
- Complete integration guide: `reploid/docs/MWP_INTEGRATION_GUIDE.md`
- Shares monorepo for convenience but maintains separate package ecosystems

See [mwp/README.md](mwp/README.md) for full documentation.

## License

MIT

