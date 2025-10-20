#!/usr/bin/env node

/**
 * Analyzes unregistered modules in the upgrades/ directory
 * Determines if they should be removed, kept, or registered
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPLOID_ROOT = path.join(__dirname, '..');

// Read config.json to get registered modules
const configPath = path.join(REPLOID_ROOT, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const registeredPaths = new Set(config.upgrades.map(u => u.path));

// Get all .js files in upgrades/
const upgradesDir = path.join(REPLOID_ROOT, 'upgrades');
const allFiles = fs.readdirSync(upgradesDir)
  .filter(f => f.endsWith('.js'))
  .sort();

// Identify unregistered modules
const unregistered = allFiles.filter(f => !registeredPaths.has(f));

console.log(`\n=== UNREGISTERED MODULES ANALYSIS ===\n`);
console.log(`Total upgrade files: ${allFiles.length}`);
console.log(`Registered in config.json: ${registeredPaths.size}`);
console.log(`Unregistered: ${unregistered.length}\n`);

// Categorize unregistered modules
const categories = {
  workers: [],          // Worker files (support files, don't need registration)
  ui_panels: [],        // UI panel components
  infrastructure: [],   // Core infrastructure (might be auto-loaded)
  deprecated: [],       // Likely deprecated/unused
  uncertain: []         // Needs manual review
};

for (const file of unregistered) {
  const filePath = path.join(upgradesDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');

  // Check for blueprint reference
  const blueprintMatch = content.match(/@blueprint\s+(0x[0-9A-Fa-f]+)/i);
  const hasWidget = content.includes('defineWidget') || content.includes('createWidget');

  // Categorize
  if (file.includes('worker') && !file.includes('worker-pool')) {
    categories.workers.push({ file, blueprint: blueprintMatch?.[1], hasWidget });
  } else if (file.includes('panel') || file === 'status-bar.js') {
    categories.ui_panels.push({ file, blueprint: blueprintMatch?.[1], hasWidget });
  } else if (['config.js', 'di-container.js', 'event-bus.js', 'hot-reload.js', 'worker-pool.js'].includes(file)) {
    categories.infrastructure.push({ file, blueprint: blueprintMatch?.[1], hasWidget });
  } else if (file.includes('backup') || file.includes('git-vfs')) {
    categories.deprecated.push({ file, blueprint: blueprintMatch?.[1], hasWidget });
  } else {
    categories.uncertain.push({ file, blueprint: blueprintMatch?.[1], hasWidget });
  }
}

// Print categorized results
function printCategory(name, items, recommendation) {
  if (items.length === 0) return;

  console.log(`\n--- ${name} (${items.length}) ---`);
  console.log(`Recommendation: ${recommendation}\n`);

  for (const item of items) {
    const bpInfo = item.blueprint ? `Blueprint: ${item.blueprint}` : 'No blueprint';
    const widgetInfo = item.hasWidget ? 'Has widget' : 'No widget';
    console.log(`  - ${item.file}`);
    console.log(`    ${bpInfo}, ${widgetInfo}`);
  }
}

printCategory(
  'WORKER FILES',
  categories.workers,
  'KEEP - These are supporting worker files, not standalone upgrades'
);

printCategory(
  'UI PANEL COMPONENTS',
  categories.ui_panels,
  'REVIEW - Check if these should be integrated into ui-manager.js or registered'
);

printCategory(
  'INFRASTRUCTURE',
  categories.infrastructure,
  'REVIEW - May be auto-loaded or legacy, needs investigation'
);

printCategory(
  'DEPRECATED/UNUSED',
  categories.deprecated,
  'REMOVE - Appears to be deprecated or superseded functionality'
);

printCategory(
  'UNCERTAIN',
  categories.uncertain,
  'REVIEW - Needs manual inspection to determine status'
);

console.log(`\n=== SUMMARY ===`);
console.log(`Workers (keep): ${categories.workers.length}`);
console.log(`UI Panels (review): ${categories.ui_panels.length}`);
console.log(`Infrastructure (review): ${categories.infrastructure.length}`);
console.log(`Deprecated (remove): ${categories.deprecated.length}`);
console.log(`Uncertain (review): ${categories.uncertain.length}`);
console.log(`\nTotal unregistered: ${unregistered.length}\n`);

// Check for blueprints without module files
console.log(`\n=== CHECKING FOR ORPHANED BLUEPRINTS ===\n`);
const blueprintsDir = path.join(REPLOID_ROOT, 'blueprints');
const blueprintFiles = fs.readdirSync(blueprintsDir)
  .filter(f => f.endsWith('.md') && f !== 'README.md')
  .sort();

// Extract blueprint IDs from all modules
const moduleBlueprintIds = new Set();
for (const file of allFiles) {
  const filePath = path.join(upgradesDir, file);
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/@blueprint\s+(0x[0-9A-Fa-f]+)/i);
  if (match) {
    moduleBlueprintIds.add(match[1].toUpperCase());
  }
}

// Check each blueprint file
const orphanedBlueprints = [];
for (const bpFile of blueprintFiles) {
  const bpId = bpFile.match(/^(0x[0-9A-Fa-f]+)/i)?.[0]?.toUpperCase();
  if (bpId && !moduleBlueprintIds.has(bpId)) {
    orphanedBlueprints.push(bpFile);
  }
}

if (orphanedBlueprints.length > 0) {
  console.log(`Found ${orphanedBlueprints.length} blueprints without corresponding modules:\n`);
  for (const bp of orphanedBlueprints) {
    console.log(`  - ${bp}`);
  }
} else {
  console.log(`All blueprint files have corresponding module implementations.`);
}

console.log('');
