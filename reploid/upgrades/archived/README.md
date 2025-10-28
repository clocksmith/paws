# Archived Modules

This directory contains modules that were developed but are not currently registered in either `config.json` or `module-manifest.json`.

## Why Archived?

These modules were either:
- Experimental features that were never fully integrated
- Prototypes for future capabilities
- Superseded by other implementations
- Part of development exploration

## Archived Modules (as of 2025-10-28)

### Human-in-the-Loop (HITL) System
- **hitl-control-panel.js** (17KB) - Blueprint 0x00004C
- **hitl-controller.js** (26KB) - Blueprint 0x000052

### Hot Reload System
- **hot-reload.js** (20KB) - Blueprint 0x000053

### Module Dashboard & Widgets
- **module-dashboard.js** (17KB) - Blueprint 0x000055
- **module-widget-protocol.js** (20KB) - Blueprint 0x000048

### Visualization & Analysis
- **penteract-visualizer.js** (12KB) - Blueprint 0x000058

### Persona Management
- **persona-manager.js** (18KB) - Blueprint 0x00004B

### Worker Systems
- **pyodide-worker.js** (12KB) - Blueprint 0x000056
- **verification-worker.js** (18KB) - Blueprint 0x000057
- **worker-pool.js** (19KB) - Blueprint 0x000050

### Tool Execution
- **tool-execution-panel.js** (22KB) - Blueprint 0x00004F

## Restoring a Module

To restore any of these modules:

1. Move the file back to `/upgrades/core/` (for functional modules) or `/upgrades/ui/` (for UI modules)
2. Add it to `module-manifest.json` in the appropriate preset and loadGroup
3. Add the corresponding blueprint if needed
4. Test that it loads without errors

## Total Size

~212 KB of archived code (11 modules)

---

**Note**: These modules may still contain valuable code and patterns. Review before permanently deleting.
