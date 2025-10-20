#!/usr/bin/env node

/**
 * Scan upgrade modules for Web Component migration status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upgradesDir = path.join(__dirname, '../upgrades');
const files = fs.readdirSync(upgradesDir).filter(f => f.endsWith('.js') && f !== 'scan-migrations.js');

const results = [];

files.forEach(filename => {
  const filepath = path.join(upgradesDir, filename);
  const content = fs.readFileSync(filepath, 'utf8');

  // Check for Web Component patterns
  const hasCustomElement = content.includes('customElements.define');
  const hasWidgetClass = /class \w+Widget extends HTMLElement/.test(content);
  const hasShadowRoot = content.includes('this.shadowRoot');

  // Check for widget element - either literal string or variable pattern
  const hasWidgetElementLiteral = /element:\s*['"`][\w-]+-widget['"`]/.test(content);
  const hasWidgetElementVariable = /element:\s*elementName/.test(content) &&
                                   /const elementName = ['"`][\w-]+-widget['"`]/.test(content);
  const hasWidgetElement = hasWidgetElementLiteral || hasWidgetElementVariable;

  // Check for old widget pattern
  const hasOldGetStatus = /getStatus:\s*\(\)\s*=>/.test(content);
  const hasOldRenderPanel = /renderPanel:\s*\(/.test(content);

  // Check for blueprint
  const blueprintMatch = content.match(/@blueprint\s+(0x[0-9A-Fa-f]+)/);
  const blueprintId = blueprintMatch ? blueprintMatch[1] : null;

  // Determine migration status
  const isWebComponent = hasCustomElement && hasWidgetClass && hasShadowRoot;
  const hasNewWidget = hasWidgetElement;
  const hasOldWidget = hasOldGetStatus || hasOldRenderPanel;

  let status = 'NOT_MIGRATED';
  if (isWebComponent && hasNewWidget) {
    status = 'MIGRATED';
  } else if (hasNewWidget && !isWebComponent) {
    status = 'PARTIAL'; // Has new widget object but no component class
  } else if (hasOldWidget) {
    status = 'OLD_PATTERN';
  }

  results.push({
    filename,
    status,
    hasCustomElement,
    hasWidgetClass,
    hasShadowRoot,
    hasWidgetElement,
    hasOldGetStatus,
    hasOldRenderPanel,
    blueprintId
  });
});

// Sort by status
const statusOrder = { 'MIGRATED': 0, 'PARTIAL': 1, 'OLD_PATTERN': 2, 'NOT_MIGRATED': 3 };
results.sort((a, b) => {
  const orderDiff = statusOrder[a.status] - statusOrder[b.status];
  if (orderDiff !== 0) return orderDiff;
  return a.filename.localeCompare(b.filename);
});

// Output summary
console.log('=== Web Components Migration Status ===\n');
console.log(`Total files scanned: ${files.length}\n`);

const counts = {
  MIGRATED: results.filter(r => r.status === 'MIGRATED').length,
  PARTIAL: results.filter(r => r.status === 'PARTIAL').length,
  OLD_PATTERN: results.filter(r => r.status === 'OLD_PATTERN').length,
  NOT_MIGRATED: results.filter(r => r.status === 'NOT_MIGRATED').length
};

console.log('Status Summary:');
console.log(`  ✅ MIGRATED (Full Web Component): ${counts.MIGRATED}`);
console.log(`  ⚠️  PARTIAL (New widget, no component): ${counts.PARTIAL}`);
console.log(`  📜 OLD_PATTERN (Old widget pattern): ${counts.OLD_PATTERN}`);
console.log(`  ❌ NOT_MIGRATED (No widget): ${counts.NOT_MIGRATED}`);
console.log();

// Output detailed results
console.log('=== Detailed Results ===\n');

['MIGRATED', 'PARTIAL', 'OLD_PATTERN'].forEach(statusType => {
  const filtered = results.filter(r => r.status === statusType);
  if (filtered.length > 0) {
    console.log(`\n${statusType} (${filtered.length}):`);
    filtered.forEach(r => {
      console.log(`  • ${r.filename}${r.blueprintId ? ` (${r.blueprintId})` : ''}`);
    });
  }
});

// Output JSON for programmatic use
fs.writeFileSync(
  path.join(__dirname, '../migration-scan-results.json'),
  JSON.stringify(results, null, 2)
);

console.log('\n✅ Results saved to migration-scan-results.json');
