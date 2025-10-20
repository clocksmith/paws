#!/bin/bash

# Archive unused modules instead of deleting them
# This allows recovery if needed later

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPLOID_ROOT="$(dirname "$SCRIPT_DIR")"
ARCHIVE_DIR="$REPLOID_ROOT/.archived-modules-$(date +%Y%m%d-%H%M%S)"

echo "=== REPLOID Module Archival Tool ==="
echo ""
echo "This script will archive truly unused modules to:"
echo "$ARCHIVE_DIR"
echo ""

# List of truly unused modules (not in config.json or module-manifest.json, not imported elsewhere)
UNUSED_MODULES=(
  "backup-restore.js"
  "config.js"
  "goal-panel.js"
  "hitl-control-panel.js"
  "hitl-controller.js"
  "hot-reload.js"
  "module-dashboard.js"
  "module-widget-protocol.js"
  "penteract-visualizer.js"
  "persona-manager.js"
  "pyodide-worker.js"
  "sentinel-panel.js"
  "thought-panel.js"
  "tool-execution-panel.js"
  "verification-worker.js"
  "worker-pool.js"
)

# Corresponding blueprint files
UNUSED_BLUEPRINTS=(
  "0x00004D-backup-restore-system.md"
  "0x00004A-config-system.md"
  "0x00005C-goal-panel.md"
  "0x00004C-hitl-control-panel.md"
  "0x000052-hitl-controller.md"
  "0x000053-hot-reload.md"
  "0x000055-module-dashboard.md"
  "0x000048-module-widget-protocol.md"
  "0x000058-penteract-visualizer.md"
  "0x00004B-persona-manager.md"
  "0x000056-pyodide-worker.md"
  "0x00005F-sentinel-panel.md"
  "0x00005B-thought-panel.md"
  "0x00004F-tool-execution-panel.md"
  "0x000057-verification-worker.md"
  "0x000050-worker-pool.md"
)

# Orphaned blueprints (no corresponding module implementation)
# Note: Most "orphaned" blueprints are for non-.js files (md, json, html, css)
# and are actually in use. Only including truly orphaned ones here.
ORPHANED_BLUEPRINTS=(
  "0x000064-browser-native-paxos.md"
)

echo "Modules to archive: ${#UNUSED_MODULES[@]}"
echo "Blueprint files to archive: ${#UNUSED_BLUEPRINTS[@]}"
echo "Orphaned blueprints to archive: ${#ORPHANED_BLUEPRINTS[@]}"
echo ""
echo "Total items to archive:"
echo "  - ${#UNUSED_MODULES[@]} modules"
echo "  - ${#UNUSED_BLUEPRINTS[@]} associated blueprints"
echo "  - ${#ORPHANED_BLUEPRINTS[@]} orphaned blueprints"
echo "  = $((${#UNUSED_MODULES[@]} + ${#UNUSED_BLUEPRINTS[@]} + ${#ORPHANED_BLUEPRINTS[@]})) total files"
echo ""

# Show what will be archived
echo "Preview of files to be archived:"
echo ""
echo "--- Modules ---"
for module in "${UNUSED_MODULES[@]}"; do
  if [ -f "$REPLOID_ROOT/upgrades/$module" ]; then
    echo "  ✓ upgrades/$module"
  else
    echo "  ✗ upgrades/$module (not found)"
  fi
done

echo ""
echo "--- Blueprint files ---"
for bp in "${UNUSED_BLUEPRINTS[@]}"; do
  if [ -f "$REPLOID_ROOT/blueprints/$bp" ]; then
    echo "  ✓ blueprints/$bp"
  else
    echo "  ✗ blueprints/$bp (not found)"
  fi
done

echo ""
echo "--- Orphaned blueprints ---"
for bp in "${ORPHANED_BLUEPRINTS[@]}"; do
  if [ -f "$REPLOID_ROOT/blueprints/$bp" ]; then
    echo "  ✓ blueprints/$bp"
  else
    echo "  ✗ blueprints/$bp (not found)"
  fi
done

echo ""
read -p "Proceed with archival? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Archival cancelled."
  exit 0
fi

# Create archive directory structure
mkdir -p "$ARCHIVE_DIR/upgrades"
mkdir -p "$ARCHIVE_DIR/blueprints"
mkdir -p "$ARCHIVE_DIR/tests"

# Archive modules
echo ""
echo "Archiving modules..."
for module in "${UNUSED_MODULES[@]}"; do
  if [ -f "$REPLOID_ROOT/upgrades/$module" ]; then
    mv "$REPLOID_ROOT/upgrades/$module" "$ARCHIVE_DIR/upgrades/"
    echo "  Archived: $module"

    # Also archive corresponding test file if it exists
    test_file="${module%.js}.test.js"
    if [ -f "$REPLOID_ROOT/tests/unit/$test_file" ]; then
      mv "$REPLOID_ROOT/tests/unit/$test_file" "$ARCHIVE_DIR/tests/"
      echo "    + test file: $test_file"
    fi
  fi
done

# Archive blueprints
echo ""
echo "Archiving blueprint files..."
for bp in "${UNUSED_BLUEPRINTS[@]}"; do
  if [ -f "$REPLOID_ROOT/blueprints/$bp" ]; then
    mv "$REPLOID_ROOT/blueprints/$bp" "$ARCHIVE_DIR/blueprints/"
    echo "  Archived: $bp"
  fi
done

# Archive orphaned blueprints
echo ""
echo "Archiving orphaned blueprints..."
for bp in "${ORPHANED_BLUEPRINTS[@]}"; do
  if [ -f "$REPLOID_ROOT/blueprints/$bp" ]; then
    mv "$REPLOID_ROOT/blueprints/$bp" "$ARCHIVE_DIR/blueprints/"
    echo "  Archived: $bp"
  fi
done

# Create manifest
echo ""
echo "Creating archive manifest..."
cat > "$ARCHIVE_DIR/MANIFEST.md" << EOF
# Archived REPLOID Modules

**Date:** $(date)
**Reason:** Cleanup of unused/deprecated modules

## Modules Archived

The following modules were not registered in either \`config.json\` or \`module-manifest.json\`,
and had no active imports in the codebase:

EOF

for module in "${UNUSED_MODULES[@]}"; do
  echo "- \`$module\`" >> "$ARCHIVE_DIR/MANIFEST.md"
done

cat >> "$ARCHIVE_DIR/MANIFEST.md" << EOF

## Blueprints Archived

### Associated Blueprints
EOF

for bp in "${UNUSED_BLUEPRINTS[@]}"; do
  echo "- \`$bp\`" >> "$ARCHIVE_DIR/MANIFEST.md"
done

cat >> "$ARCHIVE_DIR/MANIFEST.md" << EOF

### Orphaned Blueprints (no corresponding module)
EOF

for bp in "${ORPHANED_BLUEPRINTS[@]}"; do
  echo "- \`$bp\`" >> "$ARCHIVE_DIR/MANIFEST.md"
done

cat >> "$ARCHIVE_DIR/MANIFEST.md" << EOF

## Recovery

To restore a module:
\`\`\`bash
mv $ARCHIVE_DIR/upgrades/[module-name].js ./upgrades/
mv $ARCHIVE_DIR/blueprints/[blueprint-name].md ./blueprints/
\`\`\`

Then register it in \`config.json\` or \`module-manifest.json\` as appropriate.
EOF

echo ""
echo "=== ARCHIVAL COMPLETE ==="
echo "Archive location: $ARCHIVE_DIR"
echo ""
echo "To view the manifest: cat $ARCHIVE_DIR/MANIFEST.md"
echo "To restore everything: mv $ARCHIVE_DIR/* ./"
echo ""
