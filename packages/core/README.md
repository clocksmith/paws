# @paws/core

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**

---

Shared resources for PAWS - personas, system prompts, and configuration files.

## Contents

- **`sys/`** - System prompts that define LLM operational modes
  - `sys_a.md` - Default mode (full content, plan-then-execute)
  - `sys_d.md` - Delta mode (surgical line-based changes)
  - `sys_r.md` - RSI mode (self-modification with RSI-Link markers)

- **`personas/`** - AI persona definitions that layer on top of system prompts
  - `sys_c1.md`, `sys_c2.md` - Code-focused (Streamer, TDD)
  - `sys_h1.md` - `sys_h5.md` - Hyper personas (progressive complexity)
  - `sys_x1.md` - XYZ-Prime (10-minds architecture)
  - `sys_z1.md`, `sys_z2.md` - Ten Minds protocols
  - `p_*.md` - Task-specific (documentation, scaffold, refactor)

- **`configs/`** - Shared configuration files

See `personas/README.md` for detailed persona documentation.

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
- `@paws/core/personas/*` - Direct access to persona/system prompt files
- `@paws/core/configs/*` - Direct access to config files

## License

MIT

---

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[→ CLI-JS](../cli-js/README.md)**
