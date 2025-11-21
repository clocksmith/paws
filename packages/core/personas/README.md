# PAWS Personas

Persona definitions that layer on top of system prompts to customize LLM behavior for specific tasks.

> **Note:** System prompts (`sys_a.md`, `sys_d.md`, `sys_r.md`) are in the `../sys/` directory. Personas are layered on top of system prompts via the `-p` flag.

## Quick Reference

| Use Case | Recommended Persona | Description |
|----------|-------------------|-------------|
| Raw code generation | `sys_c1.md` | Code1-Streamer - no explanations, just code |
| Test-driven development | `sys_c2.md` | Code2-TDD - enforces Red/Green/Refactor |
| Simple implementation | `sys_h1.md` | Hyper-1 - single "Artisan" persona |
| Complex deliberation | `sys_h5.md` | Hyper-5 - 27-persona architecture |
| Generate module docs | `p_documentation.md` | Librarian - creates CATSCAN.md files |
| Bootstrap projects | `p_scaffold.md` | Architect - creates project skeletons |
| Code cleanup | `p_refactor.md` | Entropy - refactoring specialist |

## Persona Files

### Code-Focused (sys_c*)

- **`sys_c1.md`** - Code1-Streamer
  - High-velocity raw code production
  - No summaries, confirmations, or explanations
  - Outputs complete files in DOGS format

- **`sys_c2.md`** - Code2-TDD
  - Test-Driven Development specialist
  - Enforces Red/Green/Refactor cycle
  - Always writes failing test first

### Hyper Personas (sys_h*)

Progressive complexity from single-focus to multi-mind architectures:

- **`sys_h1.md`** - Hyper-1 "The Line Protocol"
  - Single persona: "The Artisan"
  - Direct flow from directive to result

- **`sys_h2.md`** - Hyper-2 "The Plane Protocol"
  - Dyad: "Catalyst" (velocity) vs "Anchor" (quality)

- **`sys_h3.md`** - Hyper-3 "The Cube Protocol"
  - 8 personas across Inquiry/Debate/Output vectors

- **`sys_h4.md`** - Hyper-4 "The Tesseract Protocol"
  - 16 personas across Axiom/Vector/Matrix/Scalar

- **`sys_h5.md`** - Hyper-5 "The Penteract Protocol"
  - 27 personas across Vision/Fabricate/Synthesis triads

### Specialized (sys_x*, sys_z*)

- **`sys_x1.md`** - XYZ-Prime
  - Project-specific 10-minds architecture
  - Includes Empath, Ethicist, Architect, Craftsman, Auditor, etc.
  - Designed for CATSCAN.md protocol

- **`sys_z1.md`** - System Z "Ten Minds"
  - YEG/FAB/CDX triads

- **`sys_z2.md`** - Pantheon Protocol "Nine Minds"
  - Strategic/Execution/Synthesis triads

### Task-Specific (p_*)

- **`p_documentation.md`** - Librarian
  - Generates CATSCAN.md from source code
  - Documents public APIs and dependencies

- **`p_scaffold.md`** - Architect
  - Creates complete project skeletons
  - Generates Dockerfile, tests, .gitignore, README

- **`p_refactor.md`** - Entropy
  - Refactoring and complexity reduction
  - Uses delta commands for surgical changes

## Usage

```bash
# Use persona with default system prompt (sys_a.md)
cats src/**/*.ts -p personas/sys_c1.md -o bundle.md

# Use persona with delta mode system prompt
cats src/**/*.ts -s sys/sys_d.md -p personas/p_refactor.md -o bundle.md
```

**Hierarchy:** Persona instructions override system prompt when they conflict.
