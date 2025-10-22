#!/bin/bash

# REPLOID Cleanup Script
# Removes deprecated .bak files and performs codebase cleanup

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPLOID_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$REPLOID_ROOT"

echo "🧹 REPLOID Cleanup Script"
echo "========================"
echo ""

# Count what we're about to remove
echo "📊 Analysis:"
BAK_COUNT=$(find . -name "*.bak" 2>/dev/null | wc -l)
echo "  - .bak files found: $BAK_COUNT"
echo ""

# Show files to be removed
if [ $BAK_COUNT -gt 0 ]; then
    echo "📋 Files to be removed:"
    find . -name "*.bak" 2>/dev/null | while read file; do
        echo "  - $file"
    done
    echo ""
fi

# Ask for confirmation
read -p "⚠️  Remove all .bak files? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 1
fi

# Remove .bak files
echo ""
echo "🗑️  Removing .bak files..."
find . -name "*.bak" -type f -delete
echo "✅ Removed $BAK_COUNT .bak files"

echo ""
echo "✨ Cleanup complete!"
echo ""
echo "Next steps:"
echo "  1. Run: node scripts/renumber-blueprints.js"
echo "  2. Verify all mappings are correct"
echo "  3. Run tests: npm test"
