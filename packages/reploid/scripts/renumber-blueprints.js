#!/usr/bin/env node

/**
 * REPLOID Blueprint Renumbering Script
 *
 * Systematically renumbers all blueprints to eliminate gaps and ensure
 * sequential ordering, then updates all references throughout the codebase.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPLOID_ROOT = path.join(__dirname, '..');
const BLUEPRINTS_DIR = path.join(REPLOID_ROOT, 'blueprints');
const CONFIG_FILE = path.join(REPLOID_ROOT, 'config.json');
const UPGRADES_DIR = path.join(REPLOID_ROOT, 'upgrades');
const README_FILE = path.join(REPLOID_ROOT, 'upgrades', 'README.md');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  log(`\n${'='.repeat(60)}`, 'bright');
  log(title, 'bright');
  log('='.repeat(60), 'bright');
}

/**
 * Extract blueprint ID from filename (e.g., "0x000001" from "0x000001-system-prompt.md")
 */
function extractBlueprintId(filename) {
  const match = filename.match(/^(0x[0-9A-Fa-f]+)/);
  return match ? match[1].toUpperCase() : null;
}

/**
 * Parse blueprint filename to get ID and description
 */
function parseBlueprintFilename(filename) {
  const match = filename.match(/^(0x[0-9A-Fa-f]+)-(.+)\.md$/);
  if (!match) return null;

  return {
    oldId: match[1].toUpperCase(),
    description: match[2],
    filename: filename
  };
}

/**
 * Generate new sequential blueprint ID
 */
function generateNewId(index) {
  return `0x${(index + 1).toString(16).toUpperCase().padStart(6, '0')}`;
}

/**
 * Scan all blueprints and create mapping
 */
function scanBlueprints() {
  logSection('📊 SCANNING BLUEPRINTS');

  const files = fs.readdirSync(BLUEPRINTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort();

  log(`Found ${files.length} blueprint files\n`, 'blue');

  const blueprints = [];
  const mapping = new Map();

  files.forEach((filename, index) => {
    const parsed = parseBlueprintFilename(filename);
    if (!parsed) {
      log(`⚠️  Skipping invalid filename: ${filename}`, 'yellow');
      return;
    }

    const newId = generateNewId(index);
    const oldId = parsed.oldId;

    blueprints.push({
      oldId,
      newId,
      description: parsed.description,
      oldFilename: filename,
      newFilename: `${newId}-${parsed.description}.md`
    });

    mapping.set(oldId, newId);

    if (oldId !== newId) {
      log(`  ${oldId} → ${newId} (${parsed.description})`, 'yellow');
    } else {
      log(`  ${oldId} ✓ (${parsed.description})`, 'green');
    }
  });

  log(`\n📋 Mapping created: ${mapping.size} blueprints`, 'green');

  return { blueprints, mapping };
}

/**
 * Update config.json with new blueprint IDs
 */
function updateConfigJson(mapping) {
  logSection('📝 UPDATING CONFIG.JSON');

  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  let changesCount = 0;

  // Update blueprints array
  if (config.blueprints) {
    config.blueprints.forEach(blueprint => {
      const oldId = blueprint.id.toUpperCase();
      if (mapping.has(oldId)) {
        const newId = mapping.get(oldId);
        if (oldId !== newId) {
          log(`  Blueprint: ${oldId} → ${newId}`, 'yellow');
          blueprint.id = newId;

          // Update path
          const oldPath = blueprint.path;
          const newPath = oldPath.replace(oldId, newId);
          if (oldPath !== newPath) {
            blueprint.path = newPath;
          }

          changesCount++;
        }
      }
    });
  }

  // Update upgrades array (blueprint references)
  if (config.upgrades) {
    config.upgrades.forEach(upgrade => {
      if (upgrade.blueprint) {
        const oldId = upgrade.blueprint.toUpperCase();
        if (mapping.has(oldId)) {
          const newId = mapping.get(oldId);
          if (oldId !== newId) {
            log(`  Upgrade ${upgrade.id}: blueprint ${oldId} → ${newId}`, 'yellow');
            upgrade.blueprint = newId;
            changesCount++;
          }
        }
      }
    });
  }

  // Write updated config
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2) + '\n', 'utf8');

  log(`\n✅ Updated ${changesCount} references in config.json`, 'green');
}

/**
 * Rename blueprint files
 */
function renameBlueprints(blueprints) {
  logSection('📁 RENAMING BLUEPRINT FILES');

  let renamedCount = 0;

  blueprints.forEach(bp => {
    if (bp.oldFilename !== bp.newFilename) {
      const oldPath = path.join(BLUEPRINTS_DIR, bp.oldFilename);
      const newPath = path.join(BLUEPRINTS_DIR, bp.newFilename);

      log(`  ${bp.oldFilename} → ${bp.newFilename}`, 'yellow');
      fs.renameSync(oldPath, newPath);
      renamedCount++;
    }
  });

  if (renamedCount === 0) {
    log('  ✓ No files needed renaming', 'green');
  } else {
    log(`\n✅ Renamed ${renamedCount} blueprint files`, 'green');
  }
}

/**
 * Update @blueprint comments in upgrade modules
 */
function updateModuleComments(mapping) {
  logSection('🔧 UPDATING MODULE @blueprint COMMENTS');

  const upgradeFiles = fs.readdirSync(UPGRADES_DIR)
    .filter(f => f.endsWith('.js'));

  let updatedCount = 0;

  upgradeFiles.forEach(filename => {
    const filepath = path.join(UPGRADES_DIR, filename);
    let content = fs.readFileSync(filepath, 'utf8');
    let modified = false;

    // Match @blueprint 0xNNNNNN comments
    const blueprintRegex = /@blueprint\s+(0x[0-9A-Fa-f]+)/gi;

    content = content.replace(blueprintRegex, (match, oldId) => {
      const oldIdUpper = oldId.toUpperCase();
      if (mapping.has(oldIdUpper)) {
        const newId = mapping.get(oldIdUpper);
        if (oldIdUpper !== newId) {
          log(`  ${filename}: @blueprint ${oldId} → ${newId}`, 'yellow');
          modified = true;
          return `@blueprint ${newId}`;
        }
      }
      return match;
    });

    if (modified) {
      fs.writeFileSync(filepath, content, 'utf8');
      updatedCount++;
    }
  });

  if (updatedCount === 0) {
    log('  ✓ No module comments needed updating', 'green');
  } else {
    log(`\n✅ Updated @blueprint comments in ${updatedCount} modules`, 'green');
  }
}

/**
 * Update blueprint references in README
 */
function updateReadme(mapping) {
  logSection('📖 UPDATING README.md');

  if (!fs.existsSync(README_FILE)) {
    log('  ⚠️  README.md not found, skipping', 'yellow');
    return;
  }

  let content = fs.readFileSync(README_FILE, 'utf8');
  let modified = false;
  let changesCount = 0;

  // Match blueprint references (0xNNNNNN)
  const blueprintRegex = /(0x[0-9A-Fa-f]{6})/g;

  content = content.replace(blueprintRegex, (match, oldId) => {
    const oldIdUpper = oldId.toUpperCase();
    if (mapping.has(oldIdUpper)) {
      const newId = mapping.get(oldIdUpper);
      if (oldIdUpper !== newId) {
        modified = true;
        changesCount++;
        return newId;
      }
    }
    return match;
  });

  if (modified) {
    fs.writeFileSync(README_FILE, content, 'utf8');
    log(`  ✓ Updated ${changesCount} blueprint references`, 'green');
  } else {
    log('  ✓ No README updates needed', 'green');
  }
}

/**
 * Generate summary report
 */
function generateReport(blueprints, mapping) {
  logSection('📊 RENUMBERING SUMMARY');

  const changedBlueprints = blueprints.filter(bp => bp.oldId !== bp.newId);
  const unchangedBlueprints = blueprints.filter(bp => bp.oldId === bp.newId);

  log(`Total blueprints: ${blueprints.length}`, 'blue');
  log(`  Changed: ${changedBlueprints.length}`, 'yellow');
  log(`  Unchanged: ${unchangedBlueprints.length}`, 'green');

  if (changedBlueprints.length > 0) {
    log('\n📋 Changed Blueprints:', 'bright');
    changedBlueprints.forEach(bp => {
      log(`  ${bp.oldId} → ${bp.newId}: ${bp.description}`);
    });
  }

  log('\n✅ Blueprint renumbering complete!', 'green');
  log('\nNext steps:', 'bright');
  log('  1. Review changes: git diff');
  log('  2. Run tests: npm test');
  log('  3. Commit changes: git commit -am "Renumber blueprints sequentially"');
}

/**
 * Main execution
 */
function main() {
  try {
    log('', 'reset');
    log('╔════════════════════════════════════════════════════════╗', 'bright');
    log('║       REPLOID BLUEPRINT RENUMBERING SCRIPT             ║', 'bright');
    log('╚════════════════════════════════════════════════════════╝', 'bright');

    // Step 1: Scan and create mapping
    const { blueprints, mapping } = scanBlueprints();

    if (mapping.size === 0) {
      log('\n⚠️  No blueprints found to renumber', 'yellow');
      return;
    }

    // Check if any changes are needed
    const hasChanges = blueprints.some(bp => bp.oldId !== bp.newId);

    if (!hasChanges) {
      log('\n✅ All blueprints are already sequentially numbered!', 'green');
      return;
    }

    // Step 2: Update config.json
    updateConfigJson(mapping);

    // Step 3: Rename blueprint files
    renameBlueprints(blueprints);

    // Step 4: Update module comments
    updateModuleComments(mapping);

    // Step 5: Update README
    updateReadme(mapping);

    // Step 6: Generate report
    generateReport(blueprints, mapping);

  } catch (error) {
    log(`\n❌ ERROR: ${error.message}`, 'red');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
