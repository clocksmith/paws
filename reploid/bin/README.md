# PAWS CLI Tools

Command-line tools implementing the PAWS philosophy (Prepare Artifacts With SWAP) for context curation and change management.

## Installation

The CLI tools are Node.js scripts that can be run directly:

```bash
# Make scripts executable
chmod +x cats dogs

# Run directly
./cats "*.js" -o context.cats.md
./dogs changes.dogs.md --verify "npm test"
```

## Tools

### cats - Context Bundle Creator

Creates curated context bundles (cats.md) for AI agents by gathering relevant files.

**Usage:**
```bash
cats [options] [patterns...]
```

**Options:**
- `-o, --output <file>` - Output file (default: cats.md)
- `-p, --pattern <glob>` - Include files matching pattern
- `-e, --exclude <dir>` - Exclude directory (default: node_modules, .git)
- `-v, --verbose` - Verbose output
- `-h, --help` - Show help

**Examples:**
```bash
# Include all JavaScript files
cats "*.js"

# TypeScript files in src directory
cats -p "src/**/*.ts" -o context.cats.md

# Multiple patterns, excluding tests
cats "*.json" "*.yml" -e tests

# Common development context
cats "*.js" "*.json" "*.md" -o dev.cats.md
```

### dogs - Change Bundle Applier

Applies change bundles (dogs.md) with verification and rollback support.

**Usage:**
```bash
dogs [options] [bundle.md]
```

**Options:**
- `-i, --input <file>` - Input bundle file (default: dogs.md)
- `-v, --verify <cmd>` - Verification command to run after changes
- `-d, --dry-run` - Preview changes without applying
- `-f, --force` - Skip confirmation prompts
- `--verbose` - Verbose output
- `-h, --help` - Show help

**Examples:**
```bash
# Apply default dogs.md
dogs

# Apply specific bundle
dogs changes.dogs.md

# Dry run with test verification
dogs -v "npm test" -d

# Apply with linting verification
dogs --verify "npm run lint"

# Force apply without prompts
dogs -f changes.dogs.md
```

## Bundle Formats

### cats.md Format

Context bundles contain curated file contents:

```markdown
# Context Bundle (cats.md)
Generated: 2024-12-22T10:00:00.000Z
Files: 5
Purpose: Curated context for AI-assisted development

---

## File: src/index.js

` ` `javascript
// File contents here
` ` `

---
```

### dogs.md Format

Change bundles specify operations and content:

```markdown
# Change Bundle (dogs.md)

` ` `paws-change
operation: CREATE
file_path: src/new-file.js
` ` `
` ` `javascript
// New file content
` ` `

` ` `paws-change
operation: MODIFY
file_path: src/existing.js
` ` `
` ` `javascript
// Modified content
` ` `

` ` `paws-change
operation: DELETE
file_path: src/old-file.js
` ` `
```

## Operations

### CREATE
Creates new files. Fails if file already exists (unless `--force`).

### MODIFY
Replaces existing file content. Creates backup before modification.

### DELETE
Removes files. Creates backup before deletion.

## Safety Features

1. **Backups**: Automatic timestamped backups before modifications
2. **Dry Run**: Preview changes without applying them
3. **Verification**: Run tests or linting after changes
4. **Confirmation**: Interactive prompts before applying changes
5. **Force Mode**: Skip safety checks when needed

## Integration

### With Sentinel Agent

The CLI tools integrate with REPLOID's Sentinel Agent:

```bash
# Agent creates context bundle
cats "src/**/*.js" -o turn-0.cats.md

# Review and approve context
# Agent generates proposal

# Apply approved changes
dogs turn-0.dogs.md --verify "npm test"
```

### With Project Hermes

The Node.js server uses these tools internally:

```javascript
const { createCatsBundle } = require('../bin/cats');
const { applyDogsBundle } = require('../bin/dogs');
```

### In CI/CD Pipelines

```yaml
# GitHub Actions example
- name: Apply changes
  run: |
    bin/dogs changes.dogs.md --verify "npm test"
```

## Error Handling

The tools provide clear error messages:

- File not found errors
- Permission denied errors
- Malformed bundle format errors
- Verification failures trigger automatic rollback

## Best Practices

1. **Always use verification** for production changes
2. **Review dry run output** before applying changes
3. **Keep bundles in version control** for audit trail
4. **Use descriptive bundle names** (e.g., `fix-auth-bug.dogs.md`)
5. **Test verification commands** work before applying

## Testing

The PAWS CLI tools are validated through:

1. **Automated Tests**: GitHub Actions CI/CD tests CLI commands
   ```bash
   npm run test:cli  # Runs --help for cats and dogs
   ```

2. **Manual Testing**: See `test-sentinel-flow.md` for complete workflow tests

3. **Integration Testing**: Tests verify bundle parsing, validation, and security checks

---

*PAWS CLI tools - Safe, controlled file operations with AI assistance.*