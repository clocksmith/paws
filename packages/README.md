# PAWS Packages

**[↑ Back to Main](../README.md)** | **[→ Integrations](../integrations/README.md)**

---

This directory contains the core PAWS packages organized as a pnpm workspace.

## Packages

### [@paws/core](core/README.md)
Shared resources for PAWS including personas, system prompts, and configuration files. This package provides path helpers for accessing these resources from both JavaScript and Python.

**Key contents:**
- `personas/` - AI persona definitions
- `sys/` - System prompts
- `configs/` - Configuration files

### [@paws/cli-js](cli-js/README.md)
JavaScript CLI tools for PAWS. Provides the `cats` (context bundler), `dogs` (change applier), and `paws-session` (session manager) commands.

**Key features:**
- AI-powered file curation
- Interactive change review
- Git worktree session management
- API for programmatic usage

### [@paws/cli-py](cli-py/README.md)
Python CLI tools for PAWS. Includes `paws-cats`, `paws-dogs`, `paws-paxos` (multi-agent orchestrator), and `paws-session`.

**Key features:**
- Python API for bundling and applying changes
- Multi-agent Paxos consensus workflow
- Session management
- Verification and rollback support

### [@paws/reploid](reploid/README.md)
Browser-native visual interface for PAWS providing interactive multi-agent AI workflows with visual diff review and approval gates.

**Key features:**
- Visual diff viewer with syntax highlighting
- File tree explorer
- Multi-agent competition (Paxos mode)
- WebGPU local LLM support
- Recursive self-improvement (RSI) modules

## Installation

From the repository root:

```bash
# Install all dependencies
pnpm install

# Install Python package
cd packages/cli-py
pip install -e .
```

## Development

```bash
# Run tests for all packages
pnpm test

# Run tests for specific package
pnpm --filter @paws/cli-js test
pnpm --filter @paws/reploid test

# Python tests
cd packages/cli-py
pytest
```

## Package Dependencies

```
@paws/core              # No dependencies (provides resources)
    ↓
@paws/cli-js            # Depends on @paws/core
    ↓
@paws/reploid           # Depends on @paws/cli-js and @paws/core
```

Python package `@paws/cli-py` accesses `@paws/core` resources via filesystem paths.

---

**[↑ Back to Main](../README.md)** | **[→ Integrations](../integrations/README.md)**
