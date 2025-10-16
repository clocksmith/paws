# @paws/core

Shared resources for PAWS - personas, system prompts, and configuration files.

## Contents

- **`personas/`** - AI persona definitions for different roles (Architect, Voice of Code, etc.)
- **`sys/`** - System prompts for AI interactions
- **`configs/`** - Shared configuration files (Paxos, etc.)

## Usage

### In JavaScript/Node.js

```javascript
const { getPersonasPath, getSysPath, getConfigsPath } = require('@paws/core');

console.log(getPersonasPath());  // /path/to/packages/core/personas
console.log(getSysPath());       // /path/to/packages/core/sys
console.log(getConfigsPath());   // /path/to/packages/core/configs
```

### In Python

```python
from paws import PERSONAS_PATH, SYS_PATH, CONFIGS_PATH

print(PERSONAS_PATH)  # /path/to/packages/core/personas
print(SYS_PATH)       // /path/to/packages/core/sys
print(CONFIGS_PATH)   # /path/to/packages/core/configs
```

## Package Exports

This package uses `exports` field in package.json to expose:

- `@paws/core` - Helper functions (Node.js only)
- `@paws/core/personas/*` - Direct access to persona files
- `@paws/core/sys/*` - Direct access to system prompts
- `@paws/core/configs/*` - Direct access to config files

## License

MIT
