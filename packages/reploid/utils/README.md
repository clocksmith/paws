# Utils Directory

**Purpose**: Shared utility functions used across multiple components.

## Contents

| File | Purpose |
|------|---------|
| `config-loader.js` | Configuration file loading and parsing utilities |
| `diff-generator.js` | Generate diffs between code versions |
| `dom-helpers.js` | DOM manipulation and query utilities |
| `error-handler.js` | Centralized error handling and logging |

## Usage

Utility functions are imported by components that need them:

```javascript
import { loadConfig } from './utils/config-loader.js';
import { createDiff } from './utils/diff-generator.js';
import { createElement } from './utils/dom-helpers.js';
import { handleError } from './utils/error-handler.js';
```

## Core vs Utils

**Core utilities** (`/upgrades/utils.js`):
- Part of the bootstrap process
- Available to all modules via DI container
- Include logger, error classes, validation

**Utils directory** (this directory):
- Standalone helper functions
- Not part of DI system
- Imported directly where needed
- More specialized/focused

## Adding New Utilities

1. Create a new `.js` file with focused responsibility
2. Export named functions
3. Add JSDoc documentation
4. Consider if it should be in core `/upgrades/utils.js` instead

## See Also

- `/upgrades/utils.js` - Core utility module
- `/blueprints/0x000003-core-utilities-and-error-handling.md` - Core utils architecture
