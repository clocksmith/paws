# PAWS (Prepare Artifacts With SWAP)

PAWS is a multi-agent AI development toolkit that combines deterministic CLI workflows with a rich browser interface (REPLOID). It focuses on **context engineering** - curating what information an AI sees rather than just how you prompt it.

## Core Philosophy: Structured Cognitive Diversity

PAWS operates on the principle that robust solutions emerge from managed conflict, synthesis, and resolution of multiple expert, specialized viewpoints.

**Key approach:**
- `cats` bundles curated context by scoring and pruning files
- `dogs` applies changes with interactive approval
- Session state lives outside the model, preventing context degradation
- `.pawsignore` and AI-assisted curation (`cats --ai-curate`) control what the model sees

## Features

- **Multi-agent Paxos** - Multiple specialized agents compete, with consensus-driven selection
- **Git-native safety** - Changes are auditable, replayable, and easy to roll back
- **REPLOID UI** - Visual diff reviews, WebGPU local LLM support, and multi-agent workflows
- **Context curation** - AI-powered file selection keeps context focused and relevant

## Architecture

```
paws/
├── packages/
│   ├── core/          # Shared resources (personas, system prompts, configs)
│   ├── cli-js/        # JavaScript CLI tools (cats, dogs, paws-session)
│   ├── cli-py/        # Python CLI tools (paws-cats, paws-dogs, paws-paxos)
│   └── reploid/       # Browser interface with visual workflows
├── integrations/
│   ├── mcp/           # Model Context Protocol server
│   └── vscode/        # VS Code extension
└── pnpm-workspace.yaml
```

## Packages

- **[@paws/core](packages/core/README.md)** - Shared resources (personas, system prompts, configs)
- **[@paws/cli-js](packages/cli-js/README.md)** - JavaScript CLI tools (cats, dogs, paws-session)
- **[@paws/cli-py](packages/cli-py/README.md)** - Python CLI tools (paws-cats, paws-dogs, paws-paxos)
- **[@paws/reploid](packages/reploid/README.md)** - Browser interface with visual workflows

## Integrations

- **[MCP Server](integrations/mcp/README.md)** - Model Context Protocol integration for Claude Desktop
- **[VS Code Extension](integrations/vscode/README.md)** - IDE integration with inline diff review

## Getting Started

### Installation

```bash
# Install dependencies
pnpm install

# Install Python package
cd packages/cli-py
pip install -e .
```

### Quick Start

```bash
# Create a context bundle (JavaScript)
pnpm --filter @paws/cli-js cats src/**/*.js -o context.md

# Or with Python
pnpm --filter @paws/cli-py paws-cats src/**/*.py -o context.md

# Apply changes from AI-generated bundle
pnpm --filter @paws/cli-js dogs changes.md

# Start REPLOID browser interface
pnpm --filter @paws/reploid start
# Open http://localhost:8080
```

### Testing

```bash
# Run all tests
pnpm test

# Test specific package
pnpm --filter @paws/cli-js test
pnpm --filter @paws/reploid test

# Python tests
cd packages/cli-py
pytest
```

## Documentation

Each package contains detailed documentation:

- [Core Resources](packages/core/README.md) - Personas, system prompts, and configurations
- [JavaScript CLI](packages/cli-js/README.md) - cats, dogs, and session management
- [Python CLI](packages/cli-py/README.md) - Python implementation with Paxos orchestration
- [REPLOID Browser](packages/reploid/README.md) - Visual interface and multi-agent workflows
- [MCP Integration](integrations/mcp/README.md) - Claude Desktop integration
- [VS Code Extension](integrations/vscode/README.md) - IDE integration

## License

MIT

