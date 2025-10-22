# MWP Protocol Editing Guide

The MWP specification is located in `/specification/` and contains scripts to split and reassemble the MWP.md specification for easier editing.

## Directory Structure

```
mwp/
└── specification/
    ├── MWP.md                      # Assembled protocol specification
    ├── PROTOCOL-EDITING.md         # This file
    ├── protocol-sections/          # Split section files
    │   ├── manifest.json
    │   ├── 00-front-matter.md
    │   ├── 01-terminology.md
    │   └── ...
    └── packaging/                  # Assembly scripts
        ├── assemble-protocol.js
        └── split-protocol.js
```

## Workflow

### Editing Existing Sections

```bash
# Navigate to specification directory
cd specification

# 1. Split protocol
node packaging/split-protocol.js

# 2. Edit specific section
vim protocol-sections/11-security-requirements-normative.md

# 3. Reassemble
node packaging/assemble-protocol.js
```

### Adding New Sections

```bash
cd specification

# 1. Split protocol
node packaging/split-protocol.js

# 2. Create new section file
cat > protocol-sections/19-new-section.md << 'EOF'
## 19. New Feature (Normative)

**MWP-19.1.1:** Description of new requirement.
EOF

# 3. Edit manifest.json to add section metadata
# (or just reassemble - it will auto-detect)

# 4. Reassemble
node packaging/assemble-protocol.js
```

### Removing Sections

```bash
cd specification

# 1. Split protocol
node packaging/split-protocol.js

# 2. Delete section file
rm protocol-sections/12-standard-widget-types-informative.md

# 3. Remove from manifest.json

# 4. Reassemble
node packaging/assemble-protocol.js
```

## Validation

The `--validate` flag checks:

- ✅ All manifest sections have corresponding files
- ✅ File checksums match expected values (detects modifications)
- ✅ Line counts are consistent

**Example:**

```bash
$ cd specification
$ node packaging/assemble-protocol.js --validate

Reading manifest (26 sections)...
Validating section files...
✓ All 26 section files validated

Assembling sections...
  ✓ 00-front-matter.md (6 lines)
  ✓ 01-terminology.md (33 lines)
  ...
✓ Assembled 26 sections
✓ Total lines: 1892
✓ Output: MWP.md
```

## Quick Reference

### Common Commands

```bash
# Split for editing
cd specification && node packaging/split-protocol.js

# Reassemble with validation
cd specification && node packaging/assemble-protocol.js --validate

# Custom output location
cd specification && node packaging/assemble-protocol.js --output ../custom-output.md
```

### File Locations

- **Protocol**: `specification/MWP.md`
- **Sections**: `specification/protocol-sections/`
- **Scripts**: `specification/packaging/`
- **Manifest**: `specification/protocol-sections/manifest.json`
