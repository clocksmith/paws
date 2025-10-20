# Tools Directory

**Purpose**: Static tool implementations for the agent's tool execution system.

## Contents

| File | Purpose |
|------|---------|
| `read.js` | File reading tool implementation |
| `write.js` | File writing tool implementation |

## Tool Structure

Each tool file exports a tool definition compatible with the REPLOID tool runner:

```javascript
{
  name: 'tool-name',
  description: 'What the tool does',
  parameters: { /* JSON schema */ },
  execute: async (params) => { /* implementation */ }
}
```

## Tool Manifests

Tools are registered in:
- `/upgrades/tools-read.json` - Read-only tools
- `/upgrades/tools-write.json` - Write tools
- `/upgrades/system-tools-dynamic.json` - Dynamic tools

## Tool Execution

Tools are executed by:
- `/upgrades/tool-runner.js` - Main tool runner
- `/upgrades/tool-worker.js` - Sandboxed worker execution

## Adding New Tools

1. Create tool implementation in this directory
2. Add tool definition to appropriate manifest
3. Document in `/docs/API.md`
4. Add tests in `/tests/unit/`

## See Also

- `/blueprints/0x00000A-tool-runner-engine.md` - Tool runner architecture
- `/blueprints/0x000010-static-tool-manifest.md` - Tool manifest structure
- `/upgrades/tool-runner.js` - Tool execution engine
