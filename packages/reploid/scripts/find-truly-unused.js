#!/usr/bin/env node

/**
 * Identifies truly unused modules by checking both config.json and module-manifest.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPLOID_ROOT = path.join(__dirname, '..');

// Read config.json
const configPath = path.join(REPLOID_ROOT, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const registeredInConfig = new Set(config.upgrades.map(u => u.path));

// Read module-manifest.json
const manifestPath = path.join(REPLOID_ROOT, 'module-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
const registeredInManifest = new Set();
for (const group of manifest.loadGroups) {
  for (const module of group.modules) {
    const filename = path.basename(module.path);
    registeredInManifest.add(filename);
  }
}

// Get all .js files in upgrades/
const upgradesDir = path.join(REPLOID_ROOT, 'upgrades');
const allFiles = fs.readdirSync(upgradesDir)
  .filter(f => f.endsWith('.js'))
  .sort();

// Find truly unregistered (not in either config.json or module-manifest.json)
const trulyUnregistered = allFiles.filter(f =>
  !registeredInConfig.has(f) && !registeredInManifest.has(f)
);

console.log(`\n=== TRULY UNUSED MODULES ===\n`);
console.log(`Total upgrade files: ${allFiles.length}`);
console.log(`Registered in config.json: ${registeredInConfig.size}`);
console.log(`Registered in module-manifest.json: ${registeredInManifest.size}`);
console.log(`Truly unregistered (not in either): ${trulyUnregistered.length}\n`);

if (trulyUnregistered.length > 0) {
  console.log(`Files to potentially remove:\n`);

  for (const file of trulyUnregistered) {
    const filePath = path.join(upgradesDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const blueprintMatch = content.match(/@blueprint\s+(0x[0-9A-Fa-f]+)/i);
    const size = fs.statSync(filePath).size;

    console.log(`  ${file}`);
    console.log(`    Size: ${size} bytes`);
    if (blueprintMatch) {
      console.log(`    Blueprint: ${blueprintMatch[1]}`);
    } else {
      console.log(`    No blueprint reference`);
    }

    // Check if imported anywhere
    const grepCmd = `grep -r "from.*${file.replace('.js', '')}" . --include="*.js" 2>/dev/null | grep -v node_modules | grep -v "Binary file" || echo "No imports found"`;
    console.log('');
  }
} else {
  console.log(`All upgrade files are registered in either config.json or module-manifest.json`);
}

// Find modules in manifest but not in config
console.log(`\n=== MODULES IN MANIFEST BUT NOT IN CONFIG ===\n`);
const inManifestNotConfig = allFiles.filter(f =>
  registeredInManifest.has(f) && !registeredInConfig.has(f)
);
console.log(`Count: ${inManifestNotConfig.length}\n`);
for (const file of inManifestNotConfig) {
  console.log(`  - ${file}`);
}

console.log('');
