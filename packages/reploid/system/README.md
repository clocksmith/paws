# System Directory

**Purpose**: System-level configuration and command definitions for the AI agent.

## Contents

| File | Purpose |
|------|---------|
| `sys_c2.md` | System C2 (Command and Control) prompts and instructions |
| `tools-dynamic.json` | Dynamic tool definitions loaded at runtime |

## System C2

**File**: `sys_c2.md`

Contains:
- System-level prompts
- Agent behavior directives
- Command and control instructions
- Operational guidelines

## Dynamic Tools

**File**: `tools-dynamic.json`

Defines tools that are:
- Loaded at runtime
- Generated dynamically
- Extended by the agent
- Not part of static tool manifests

## See Also

- `/upgrades/system-tools-dynamic.json` - Alternative dynamic tools location
- `/blueprints/0x000015-dynamic-tool-creation.md` - Dynamic tool creation
- `/blueprints/0x000013-system-configuration-structure.md` - System config architecture
