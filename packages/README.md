# PAWS Packages

**[↑ Back to Main](../README.md)** | **[→ Integrations](../integrations/README.md)**

---

This directory contains the core PAWS packages organized as a pnpm workspace.

## Packages

### [@paws/core](core/README.md)
Shared resources for PAWS including personas, system prompts, and configuration files. Written in TypeScript.

**Key contents:**
- `personas/` - AI persona definitions
- `sys/` - System prompts
- `configs/` - Configuration files
- Path helper utilities

### [@paws/parsers](parsers/)
Shared parsing logic for PAWS bundle formats (CATS/DOGS). Written in TypeScript.

**Key features:**
- DOGS bundle parser with delta command support
- File operation detection (CREATE, MODIFY, DELETE)
- Binary content handling
- Browser and Node.js compatible

### [@paws/cli-js](cli-js/README.md)
TypeScript CLI tools for PAWS multi-agent workflows.

**Commands:**
- `cats` - Context bundler with AI-assisted file selection
- `dogs` - Change applier with interactive review
- `paws-arena` - Multi-agent competitive verification
- `paws-swarm` - Collaborative multi-agent workflows
- `paws-benchmark` - LLM performance comparison
- `paws-context-optimizer` - Smart context pruning for large codebases
- `paws-session` - Stateful workflow management with git worktrees

**Key features:**
- AI-powered file curation
- Interactive change review
- Git worktree session management
- Multi-model support (Gemini, Claude, OpenAI)
- Test-driven verification

## Installation

From the repository root:

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm -r run build
```

## Development

```bash
# Build all packages
pnpm -r run build

# Run tests
cd packages/cli-js
pnpm test
```

## Package Dependencies

```
@paws/core              # No dependencies (provides resources)
    ↓
@paws/parsers           # No dependencies (standalone parser)
    ↓
@paws/cli-js            # Depends on @paws/core
```

---

**[↑ Back to Main](../README.md)** | **[→ Integrations](../integrations/README.md)**
