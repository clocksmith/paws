# Blueprint 0x000068: System Tools Manifest

**Objective:** Documents the system tools manifest that provides core system operations for backup, RFC creation, and project export.

**Target Upgrade:** System Tools (`tools-system.json`)

**Prerequisites:** None (Tool manifest)

**Affected Artifacts:** `/upgrades/tools-system.json`

---

### 1. The Strategic Imperative

The agent needs system-level tools to manage its state, create documentation, and export its work. The `tools-system.json` manifest defines essential system operation tools.

### 2. The Architectural Solution

The `/upgrades/tools-system.json` artifact is a JSON file containing an array of system tool definitions:

- **`system.backup`**: Saves the current state of the agent's entire VFS to the server for persistence
- **`create_rfc`**: Creates a new RFC (Request for Comments) document from a template
- **`export_project_zip`**: Exports the entire VFS project as a downloadable ZIP file

### 3. Tool Definitions

Each tool in the manifest includes:
- `name`: The tool's identifier
- `description`: Human-readable description of what the tool does
- `parameters`: JSON Schema describing the tool's input parameters

### 4. Integration

These tools are loaded by the tool runner and made available to the agent's cognitive cycle. They enable the agent to persist its state, create structured documentation, and export its work for distribution.
