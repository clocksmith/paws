# MCP Widget Protocol Specification

This directory contains the complete MCP Widget Protocol (MWP) specification and tooling for editing it.

## 📄 Files

### Main Specification

- **[MWP.md](./MWP.md)** - The complete, assembled protocol specification
  - This is the canonical reference document
  - Generated from `protocol-sections/` using `packaging/assemble-protocol.js`
  - Read this for the complete protocol definition

### Editing Tools

- **[PROTOCOL-EDITING.md](./PROTOCOL-EDITING.md)** - Guide for editing the specification
  - Explains how to split, edit, and reassemble the protocol
  - Includes validation instructions
  - Required reading before modifying the spec

### Directory Structure

```
specification/
├── MWP.md                          # Assembled specification (read this!)
├── PROTOCOL-EDITING.md             # How to edit the spec
├── README.md                       # This file
├── protocol-sections/              # Individual section files
│   ├── manifest.json               # Section metadata and checksums
│   ├── 00-front-matter.md          # Title, version, copyright
│   ├── 01-terminology.md           # Definitions
│   ├── 02-architecture.md          # System overview
│   ├── 03-widget-factory.md        # Factory contract
│   └── ...                         # Additional sections
├── packaging/                      # Assembly scripts
│   ├── assemble-protocol.js        # Combine sections → MWP.md
│   └── split-protocol.js           # Split MWP.md → sections
└── schemas/                        # JSON Schema definitions (generated)
    ├── README.md                   # Schema documentation
    ├── *.schema.json               # Generated JSON Schemas
    └── index.json                  # Schema index
```

## 🚀 Quick Start

### Reading the Specification

Simply open **[MWP.md](./MWP.md)** - this is the complete protocol document.

### Editing the Specification

```bash
# Navigate to specification directory
cd specification

# 1. Split into editable sections
node packaging/split-protocol.js

# 2. Edit sections in protocol-sections/
vim protocol-sections/03-widget-factory.md

# 3. Reassemble with validation
node packaging/assemble-protocol.js --validate
```

See [PROTOCOL-EDITING.md](./PROTOCOL-EDITING.md) for detailed instructions.

## 📚 Links from Other Documentation

The specification is referenced throughout the repository:

### Root Documentation
- [README.md](../README.md) → `./specification/MWP.md`
- [SPEC.md](../SPEC.md) → Main protocol specification
- [POSITIONING.md](../POSITIONING.md) → Strategic positioning

### Package Documentation
- [packages/examples/dashboards/README.md](../packages/examples/dashboards/README.md) → `../../../specification/MWP.md`

### Other Documentation
- [formal-verification/README.md](../formal-verification/README.md) → `../specification/MWP.md`

## 🔧 Assembly Scripts

### assemble-protocol.js

Combines section files into the complete specification.

```bash
# Basic assembly
node packaging/assemble-protocol.js

# With validation
node packaging/assemble-protocol.js --validate

# Custom output location
node packaging/assemble-protocol.js --output ../custom.md

# Help
node packaging/assemble-protocol.js --help
```

**Features:**
- Reads section files from `protocol-sections/`
- Uses `manifest.json` for ordering and metadata
- Validates checksums to detect modifications
- Outputs to `MWP.md` by default

### split-protocol.js

Splits the complete specification into editable sections.

```bash
# Split specification
node packaging/split-protocol.js
```

**Features:**
- Parses `MWP.md` into logical sections
- Creates files in `protocol-sections/`
- Generates `manifest.json` with checksums
- Auto-detects section boundaries (headers starting with `##`)
- Stable filename generation (e.g., `03-widget-factory.md`)

## 📋 Workflow Examples

### Fix a Typo

```bash
cd specification

# Split
node packaging/split-protocol.js

# Edit
vim protocol-sections/01-terminology.md

# Reassemble
node packaging/assemble-protocol.js --validate
```

### Add a New Section

```bash
cd specification

# Split
node packaging/split-protocol.js

# Create new section
cat > protocol-sections/19-new-feature.md << 'EOF'
## 19. New Feature (Normative)

**MWP-19.1.1:** Requirements for the new feature...
EOF

# Reassemble (auto-detects new section)
node packaging/assemble-protocol.js
```

### Validate Without Reassembling

```bash
cd specification

# Just check integrity
node packaging/assemble-protocol.js --validate --output /tmp/test.md
```

## 🔍 Validation

The `--validate` flag checks:

- ✅ All sections in manifest exist as files
- ✅ File checksums match expected values
- ✅ No sections have been modified unexpectedly
- ✅ Line counts are consistent

This prevents accidental data loss when editing sections.

## 🏗️ Protocol Versioning

The specification includes semantic versioning:

- **Major version** (1.x.x) - Breaking changes to protocol contracts
- **Minor version** (x.1.x) - Backward-compatible additions
- **Patch version** (x.x.1) - Clarifications and typo fixes

See section 1 of [MWP.md](./MWP.md) for the current version.

## 🤝 Contributing

When proposing changes to the protocol:

1. **Read** [PROTOCOL-EDITING.md](./PROTOCOL-EDITING.md)
2. **Split** the specification into sections
3. **Edit** relevant section files
4. **Validate** your changes
5. **Commit** both section files and assembled `MWP.md`
6. **Document** the rationale in your PR

## 📖 Related Documentation

- **[formal-verification/](../formal-verification/)** - TLA+ and Alloy specs
- **[research/](../research/)** - Research and competitive analysis
- **[SPEC.md](../SPEC.md)** - Main protocol specification

---

**Questions?** Open an issue or discussion in the main repository.
