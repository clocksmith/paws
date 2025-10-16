# PAWS VS Code Extension

**[↑ Back to Main](../../README.md)** | **[↑ Integrations](../README.md)** | **[← MCP Server](../mcp/README.md)**

---

Visual Studio Code extension that integrates PAWS workflows into your IDE.

## Overview

This extension brings PAWS context bundling and change application directly into VS Code with inline diff preview and keyboard shortcuts.

**Features:**
- Create context bundles from selected files
- Apply change bundles with visual diff review
- Keyboard shortcuts for common workflows
- Status bar integration
- Git-aware file selection

## Installation

### From Source

1. Build the extension:

```bash
# From repository root
pnpm install

# Build extension
cd integrations/vscode
pnpm compile
```

2. Package the extension:

```bash
# Install vsce if needed
npm install -g @vscode/vsce

# Package
pnpm package
```

3. Install in VS Code:
   - Open VS Code
   - Go to Extensions (Cmd+Shift+X)
   - Click "..." menu → "Install from VSIX"
   - Select `paws-vscode-0.1.0.vsix`

## Usage

### Create Context Bundle

1. **Command Palette:** Cmd+Shift+P → "PAWS: Create Context Bundle"
2. Select files to include (or use current workspace)
3. Bundle is created as `cats.md` in workspace root

### Apply Change Bundle

1. **Command Palette:** Cmd+Shift+P → "PAWS: Apply Change Bundle"
2. Select a `.md` file containing changes
3. Review changes in diff view
4. Accept or reject individual changes

### Keyboard Shortcuts

Configure in VS Code settings (File → Preferences → Keyboard Shortcuts):

```json
{
  "key": "ctrl+shift+c",
  "command": "paws.createContextBundle"
},
{
  "key": "ctrl+shift+a",
  "command": "paws.applyChangeBundle"
}
```

## Architecture

```
integrations/vscode/
├── src/
│   └── extension.ts       # Extension entry point
├── dist/                  # Compiled JavaScript
├── package.json          # Extension manifest
├── tsconfig.json         # TypeScript config
└── README.md            # This file
```

## Configuration

Add to VS Code `settings.json`:

```json
{
  "paws.catsPath": "cats",           // Path to cats command
  "paws.dogsPath": "dogs",           // Path to dogs command
  "paws.autoSave": true,             // Save files before bundling
  "paws.defaultPersona": "sys_a.md"  // Default persona file
}
```

## Development

### Building

```bash
# Compile TypeScript
pnpm compile

# Watch mode
pnpm watch
```

### Testing

1. Open this folder in VS Code
2. Press F5 to launch Extension Development Host
3. Test commands in the new window

### Debugging

- Set breakpoints in `src/extension.ts`
- Press F5 to start debugging
- Use Debug Console to inspect variables

## Commands

| Command | Description |
|---------|-------------|
| `paws.createContextBundle` | Create context bundle from selected files |
| `paws.applyChangeBundle` | Apply changes from bundle file |

## Requirements

- VS Code 1.82.0 or higher
- Node.js 16+ (for running PAWS commands)
- `@paws/cli-js` installed in your project

## Troubleshooting

**Commands not appearing:**
- Reload window (Cmd+R)
- Check that extension is enabled in Extensions panel

**Cats/dogs not found:**
- Install `@paws/cli-js`: `pnpm add @paws/cli-js`
- Or set absolute paths in settings
- Ensure Node.js is in PATH

**Changes not applying:**
- Check that files are not read-only
- Verify bundle format is correct (must have DOGS markers)
- Review Output panel (View → Output → PAWS)

## Dependencies

- `@paws/cli-js` - PAWS JavaScript CLI tools
- VS Code APIs - Editor integration
- TypeScript - Development language

---

**[↑ Back to Main](../../README.md)** | **[↑ Integrations](../README.md)** | **[← MCP Server](../mcp/README.md)**
