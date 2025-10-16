# PAWS 4.0 Monorepo Migration Guide

This guide helps users migrate from PAWS 3.x to the new 4.0 monorepo structure.

## What Changed in 4.0?

PAWS 4.0 reorganizes the codebase into a clean monorepo with separate packages:

**Before (3.x):**
```
paws/
├── js/              # JavaScript CLI
├── py/              # Python CLI
├── reploid/         # Browser interface
├── personas/        # Shared resources
└── sys/             # Shared resources
```

**After (4.0):**
```
paws/
└── packages/
    ├── core/        # @paws/core - Shared resources
    ├── cli-js/      # @paws/cli-js - JavaScript CLI
    ├── cli-py/      # @paws/cli-py - Python CLI
    └── reploid/     # @paws/reploid - Browser interface
```

## Installation Changes

### JavaScript CLI

**Before (3.x):**
```bash
npm install -g paws
cats --help
```

**After (4.0):**
```bash
npm install -g @paws/cli-js
cats --help
```

### Python CLI

**Before (3.x):**
```bash
pip install -r requirements.txt
python py/cats.py --help
```

**After (4.0):**
```bash
pip install -e packages/cli-py
paws-cats --help
```

### REPLOID

**Before (3.x):**
```bash
cd reploid && npm install && node server/proxy.js
```

**After (4.0):**
```bash
pnpm install
pnpm --filter @paws/reploid start
```

## Import Path Changes

### JavaScript/Node.js

**Before (3.x):**
```javascript
const { createBundle } = require('./js/cats.js');
const { extractBundle } = require('./js/dogs.js');
```

**After (4.0):**
```javascript
const { createBundle } = require('@paws/cli-js/src/cats');
const { extractBundle } = require('@paws/cli-js/src/dogs');
```

### Python

**Before (3.x):**
```python
from py.cats import create_bundle
from py.dogs import extract_bundle
```

**After (4.0):**
```python
from paws.cats import create_bundle
from paws.dogs import extract_bundle
```

## File Path Changes

Personas and system prompts now live in `@paws/core`:

**Before (3.x):**
```bash
cats -s sys/sys_a.md -p personas/persona_ax.md
```

**After (4.0):**
```bash
# Paths are resolved automatically from core package
cats -s sys_a.md -p persona_ax.md
```

## Development Workflow Changes

### Running Tests

**Before (3.x):**
```bash
npm test                    # JS tests
python -m pytest py/tests/  # Python tests
cd reploid && vitest run    # REPLOID tests
```

**After (4.0):**
```bash
pnpm test:cli-js      # JS CLI tests
pnpm test:cli-py      # Python CLI tests
pnpm test:reploid     # REPLOID tests
pnpm test             # All tests
```

### Building Packages

**After (4.0):**
```bash
pnpm install              # Install all dependencies
pnpm --filter @paws/cli-js build  # Build specific package
pnpm -r build             # Build all packages
```

## Breaking Changes

1. **Removed global bins from root** - Install packages individually
2. **Changed Python module structure** - Use `paws.*` imports instead of `py.*`
3. **Personas/sys paths** - Now resolved from `@paws/core` automatically
4. **Workspace dependencies** - Use `workspace:*` protocol in package.json

## Migration Checklist

- [ ] Update npm/pip install commands
- [ ] Update import statements in custom scripts
- [ ] Update file paths for personas/sys prompts
- [ ] Update test commands in CI/CD
- [ ] Update documentation references

## Need Help?

- [Main README](../README.md) - Updated getting started guide
- [GitHub Issues](https://github.com/yourusername/paws/issues) - Report problems
- [Changelog](../CHANGELOG.md) - See all changes in 4.0
