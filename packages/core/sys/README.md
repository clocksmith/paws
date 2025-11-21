# PAWS System Prompts

Core system prompts that define LLM operational modes for the PAWS workflow.

## System Prompts

| File | Mode | Description |
|------|------|-------------|
| `sys_a.md` | Default | Full content mode with plan-then-execute workflow |
| `sys_d.md` | Delta | Surgical line-based changes with delta commands |
| `sys_r.md` | RSI | Self-modification mode with RSI-Link markers |

### `sys_a.md` - Default Mode

The standard system prompt used when no `-s` flag is specified.

**Key behaviors:**
- Plan first, then execute on user confirmation
- Full file content only (no delta commands)
- CATSCAN.md as source of truth
- REQUEST_CONTEXT when information is insufficient

### `sys_d.md` - Delta Mode

For surgical, targeted changes to large files.

**Key behaviors:**
- Delta commands: `REPLACE_LINES`, `INSERT_AFTER_LINE`, `DELETE_LINES`
- Line numbers always refer to original file
- Commands must be ordered by line number
- Can mix delta and full-content files

### `sys_r.md` - RSI Mode (Recursive System Invocation)

For modifying PAWS itself.

**Key behaviors:**
- Uses `⛓️ RSI_LINK_` markers instead of `🐕 DOGS_`
- Enforces documentation contract
- Prevents asymmetrical marker modifications

## Usage

```bash
# Default mode (sys_a.md is used automatically)
cats src/**/*.ts -o bundle.md

# Explicit delta mode
cats src/**/*.ts -s sys/sys_d.md -o bundle.md

# RSI mode for self-modification
cats py/*.py sys/*.md -s sys/sys_r.md -o bundle.md
```

## Layering with Personas

System prompts define the operational mode; personas customize behavior:

```bash
# Default mode + Code-Streamer persona
cats src/**/*.ts -p personas/sys_c1.md -o bundle.md

# Delta mode + Refactoring persona
cats src/**/*.ts -s sys/sys_d.md -p personas/p_refactor.md -o bundle.md
```

**Hierarchy:** Persona > System Prompt
