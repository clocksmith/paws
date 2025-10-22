#!/usr/bin/env node

/**
 * Sync WEB_COMPONENTS_MIGRATION_TRACKER.md with scan results
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read scan results
const scanResults = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../migration-scan-results.json'), 'utf8')
);

// Read existing tracker to preserve test and blueprint status
const trackerPath = path.join(__dirname, '../WEB_COMPONENTS_MIGRATION_TRACKER.md');
const trackerContent = fs.readFileSync(trackerPath, 'utf8');

// Parse existing tracker table
const existingData = new Map();
const tableRegex = /\| ([^\|]+) \| ([^\|]+) \| ([^\|]+) \| ([^\|]+) \| ([^\|]+) \| ([^\|]*) \|/g;
let match;
while ((match = tableRegex.exec(trackerContent)) !== null) {
  const [, module, webComp, blueprint, test, blueprintId, notes] = match.map(s => s.trim());
  if (module !== 'Module' && module !== '--------') {
    existingData.set(module, {
      webComponent: webComp,
      blueprint: blueprint,
      test: test,
      blueprintId: blueprintId,
      notes: notes
    });
  }
}

// Build updated entries
const entries = [];

scanResults.forEach(result => {
  const existing = existingData.get(result.filename) || {};

  // Determine Web Component status
  let webComponentStatus = '❌';
  if (result.status === 'MIGRATED') {
    webComponentStatus = '✅';
  } else if (result.hasCustomElement && result.hasWidgetClass && result.hasShadowRoot) {
    webComponentStatus = '⚠️'; // Has component but no widget.element
  }

  // Use scan blueprint ID if available, otherwise keep existing
  const blueprintId = result.blueprintId || existing.blueprintId || 'TBD';

  // Preserve existing blueprint and test status
  const blueprint = existing.blueprint || '❌';
  const test = existing.test || '✅'; // Most have tests

  // Determine notes
  let notes = existing.notes || '';
  if (webComponentStatus === '✅' && blueprint === '✅' && test === '✅') {
    notes = '**COMPLETE**';
  } else if (webComponentStatus === '⚠️') {
    notes = 'Partial (has component, needs widget.element)';
  }

  entries.push({
    module: result.filename,
    webComponent: webComponentStatus,
    blueprint,
    test,
    blueprintId,
    notes,
    status: result.status
  });
});

// Sort entries
entries.sort((a, b) => a.module.localeCompare(b.module));

// Calculate stats
const stats = {
  total: entries.length,
  webComponentsFull: entries.filter(e => e.webComponent === '✅').length,
  webComponentsPartial: entries.filter(e => e.webComponent === '⚠️').length,
  blueprintsUpdated: entries.filter(e => e.blueprint === '✅').length,
  testsExist: entries.filter(e => e.test === '✅').length,
  fullyComplete: entries.filter(e =>
    e.webComponent === '✅' && e.blueprint === '✅' && e.test === '✅'
  ).length
};

// Generate markdown table
let tableMarkdown = '| Module | Web Component | Blueprint | Test | Blueprint ID | Notes |\n';
tableMarkdown += '|--------|--------------|-----------|------|--------------|-------|\n';

entries.forEach(entry => {
  tableMarkdown += `| ${entry.module} | ${entry.webComponent} | ${entry.blueprint} | ${entry.test} | ${entry.blueprintId} | ${entry.notes} |\n`;
});

console.log('=== Migration Tracker Sync Report ===\n');
console.log(`Total Modules: ${stats.total}`);
console.log(`Web Components (Full): ${stats.webComponentsFull}/${stats.total} (${Math.round(stats.webComponentsFull/stats.total*100)}%)`);
console.log(`Web Components (Partial): ${stats.webComponentsPartial}/${stats.total} (${Math.round(stats.webComponentsPartial/stats.total*100)}%)`);
console.log(`Blueprints Updated: ${stats.blueprintsUpdated}/${stats.total} (${Math.round(stats.blueprintsUpdated/stats.total*100)}%)`);
console.log(`Tests Exist: ${stats.testsExist}/${stats.total} (${Math.round(stats.testsExist/stats.total*100)}%)`);
console.log(`Fully Complete: ${stats.fullyComplete}/${stats.total} (${Math.round(stats.fullyComplete/stats.total*100)}%)`);
console.log();

// Output updates needed
console.log('Modules needing widget.element fix (⚠️):');
entries.filter(e => e.webComponent === '⚠️').forEach(e => {
  console.log(`  - ${e.module}`);
});
console.log();

console.log('Newly discovered blueprint IDs:');
scanResults
  .filter(r => r.blueprintId && r.blueprintId !== 'TBD')
  .forEach(r => {
    const existing = existingData.get(r.filename);
    if (!existing || existing.blueprintId === 'TBD' || existing.blueprintId !== r.blueprintId) {
      console.log(`  - ${r.filename}: ${r.blueprintId}`);
    }
  });
console.log();

// Write table to file for review
fs.writeFileSync(
  path.join(__dirname, '../tracker-table-update.md'),
  tableMarkdown
);

console.log('✅ Updated table saved to tracker-table-update.md');
console.log('📊 Stats written above');
console.log('\nNext steps:');
console.log('1. Review tracker-table-update.md');
console.log('2. Manually update WEB_COMPONENTS_MIGRATION_TRACKER.md with:');
console.log('   - New summary stats');
console.log('   - Updated table');
console.log('   - New blueprint IDs');
