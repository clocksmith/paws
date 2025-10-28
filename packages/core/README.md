# @paws/core

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**

---

Shared resources for PAWS - personas, system prompts, and configuration files.

## Contents

- **`personas/`** - AI persona definitions for different roles (Architect, Voice of Code, etc.)
- **`sys/`** - System prompts for AI interactions
- **`configs/`** - Shared configuration files

## Usage

### In TypeScript/Node.js

```typescript
import { getPersonasPath, getSysPath, getConfigsPath } from '@paws/core';

console.log(getPersonasPath());  // /path/to/packages/core/personas
console.log(getSysPath());       // /path/to/packages/core/sys
console.log(getConfigsPath());   // /path/to/packages/core/configs
```

## Package Exports

This package uses `exports` field in package.json to expose:

- `@paws/core` - Helper functions (Node.js only)
- `@paws/core/personas/*` - Direct access to persona files
- `@paws/core/sys/*` - Direct access to system prompts
- `@paws/core/configs/*` - Direct access to config files

## License

MIT

---

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**
