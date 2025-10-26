#!/usr/bin/env node
/**
 * Module Dependency Validator & Auto-Fixer
 *
 * Scans all modules in /upgrades and /personas, extracts their dependencies,
 * and validates that all presets in module-manifest.json include required deps.
 *
 * Usage:
 *   node tools/validate-deps.js                    # Validate only
 *   node tools/validate-deps.js --fix              # Auto-fix presets
 *   node tools/validate-deps.js --preset meta      # Validate specific preset
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT, 'module-manifest.json');
const UPGRADES_DIR = path.join(ROOT, 'upgrades');
const PERSONAS_DIR = path.join(ROOT, 'personas');
const UTILS_DIR = path.join(ROOT, 'utils');

// Parse command-line args
const args = process.argv.slice(2);
const AUTO_FIX = args.includes('--fix');
const SPECIFIC_PRESET = args.find(arg => arg.startsWith('--preset='))?.split('=')[1];

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m'
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

/**
 * Extract metadata from a module file
 */
function extractMetadata(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Match the metadata object
    const metadataMatch = content.match(/metadata:\s*\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/s);
    if (!metadataMatch) {
      return null;
    }

    // Extract id
    const idMatch = content.match(/id:\s*['"]([^'"]+)['"]/);
    const id = idMatch ? idMatch[1] : null;

    // Extract dependencies array
    const depsMatch = content.match(/dependencies:\s*\[(.*?)\]/s);
    const dependencies = depsMatch
      ? depsMatch[1]
          .split(',')
          .map(dep => dep.trim().replace(/['"]/g, ''))
          .filter(dep => dep.length > 0)
      : [];

    return {
      id,
      dependencies,
      path: filePath
    };
  } catch (error) {
    log(`Error reading ${filePath}: ${error.message}`, 'red');
    return null;
  }
}

/**
 * Scan a directory for all .js modules
 */
function scanModules(dir) {
  const modules = [];

  if (!fs.existsSync(dir)) {
    log(`Directory not found: ${dir}`, 'yellow');
    return modules;
  }

  const files = fs.readdirSync(dir);

  for (const file of files) {
    if (!file.endsWith('.js')) continue;

    const filePath = path.join(dir, file);
    const metadata = extractMetadata(filePath);

    if (metadata && metadata.id) {
      modules.push({
        ...metadata,
        relativePath: path.relative(ROOT, filePath)
      });
    }
  }

  return modules;
}

/**
 * Build a map of module ID -> module info
 */
function buildModuleMap() {
  const upgrades = scanModules(UPGRADES_DIR);
  const personas = scanModules(PERSONAS_DIR);
  const utils = scanModules(UTILS_DIR);
  const allModules = [...upgrades, ...personas, ...utils];

  const map = {};
  for (const module of allModules) {
    map[module.id] = module;
  }

  return map;
}

/**
 * Validate a preset's dependency chain
 */
function validatePreset(presetName, modulePaths, moduleMap) {
  const errors = [];
  const warnings = [];

  // Build set of included module IDs
  const includedIds = new Set();
  const pathToId = {};

  for (const modulePath of modulePaths) {
    // Find module by path
    const module = Object.values(moduleMap).find(m =>
      modulePath.includes(m.relativePath)
    );

    if (module) {
      includedIds.add(module.id);
      pathToId[modulePath] = module.id;
    } else {
      warnings.push({
        type: 'unknown_module',
        path: modulePath,
        message: `Module not found in registry: ${modulePath}`
      });
    }
  }

  // Check each module's dependencies
  for (let i = 0; i < modulePaths.length; i++) {
    const modulePath = modulePaths[i];
    const moduleId = pathToId[modulePath];

    if (!moduleId) continue;

    const module = moduleMap[moduleId];
    if (!module) continue;

    // Check if all dependencies are included
    for (const depId of module.dependencies) {
      // Handle optional dependencies (marked with ?)
      const isOptional = depId.endsWith('?');
      const actualDepId = isOptional ? depId.slice(0, -1) : depId;

      if (!includedIds.has(actualDepId)) {
        if (isOptional) {
          // Optional dependency missing - just log as warning
          warnings.push({
            type: 'optional_dependency_missing',
            module: moduleId,
            dependency: actualDepId,
            message: `${moduleId} optionally uses ${actualDepId}, but it's not in preset (OK)`
          });
        } else {
          // Required dependency missing - error
          errors.push({
            type: 'missing_dependency',
            module: moduleId,
            dependency: actualDepId,
            message: `${moduleId} requires ${actualDepId}, but ${actualDepId} is not in preset`
          });
        }
      } else {
        // Check if dependency comes before dependent
        const depModule = moduleMap[actualDepId];
        if (depModule) {
          const depPath = modulePaths.find(p => p.includes(depModule.relativePath));
          const depIndex = modulePaths.indexOf(depPath);

          if (depIndex > i) {
            errors.push({
              type: 'wrong_order',
              module: moduleId,
              dependency: actualDepId,
              message: `${moduleId} (index ${i}) depends on ${actualDepId} (index ${depIndex}), but ${actualDepId} loads AFTER ${moduleId}`
            });
          }
        }
      }
    }
  }

  return { errors, warnings };
}

/**
 * Auto-fix a preset by adding missing dependencies
 */
function fixPreset(presetName, modulePaths, moduleMap) {
  const fixed = [...modulePaths];
  const added = [];

  // Build dependency graph
  const graph = {};
  for (const moduleId in moduleMap) {
    graph[moduleId] = moduleMap[moduleId].dependencies;
  }

  // For each module in preset, ensure all transitive deps are included
  const toProcess = [...fixed];
  const processed = new Set();

  while (toProcess.length > 0) {
    const modulePath = toProcess.shift();

    const module = Object.values(moduleMap).find(m =>
      modulePath.includes(m.relativePath)
    );

    if (!module || processed.has(module.id)) continue;
    processed.add(module.id);

    // Add missing dependencies
    for (const depId of module.dependencies) {
      // Handle optional dependencies (marked with ?)
      const isOptional = depId.endsWith('?');
      const actualDepId = isOptional ? depId.slice(0, -1) : depId;

      const depModule = moduleMap[actualDepId];
      if (!depModule) {
        if (!isOptional) {
          log(`  Warning: ${module.id} depends on ${actualDepId}, but ${actualDepId} not found`, 'yellow');
        }
        continue;
      }

      const depPath = '/' + depModule.relativePath;

      if (!fixed.includes(depPath)) {
        // Find position to insert (before dependent)
        const moduleIndex = fixed.findIndex(p => p.includes(module.relativePath));

        if (moduleIndex >= 0) {
          fixed.splice(moduleIndex, 0, depPath);
          added.push(actualDepId);
          toProcess.push(depPath);
        }
      }
    }
  }

  return { fixed, added };
}

/**
 * Main validation logic
 */
function main() {
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('  Module Dependency Validator', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  // Load module manifest
  if (!fs.existsSync(MANIFEST_PATH)) {
    log(`Error: module-manifest.json not found at ${MANIFEST_PATH}`, 'red');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  // Build module map
  log('Scanning modules...', 'blue');
  const moduleMap = buildModuleMap();
  const moduleCount = Object.keys(moduleMap).length;
  log(`  Found ${moduleCount} modules\n`, 'gray');

  // Get presets to validate
  const presetsToCheck = SPECIFIC_PRESET
    ? [SPECIFIC_PRESET]
    : Object.keys(manifest.presets);

  let totalErrors = 0;
  let totalWarnings = 0;
  const fixes = {};

  for (const presetName of presetsToCheck) {
    const modulePaths = manifest.presets[presetName];

    if (!modulePaths) {
      log(`Preset "${presetName}" not found`, 'red');
      continue;
    }

    log(`Validating preset: ${presetName} (${modulePaths.length} modules)`, 'blue');

    const { errors, warnings } = validatePreset(presetName, modulePaths, moduleMap);

    totalErrors += errors.length;
    totalWarnings += warnings.length;

    // Display errors
    if (errors.length > 0) {
      log(`  ✗ ${errors.length} error(s) found:`, 'red');
      for (const error of errors) {
        log(`    • ${error.message}`, 'red');
      }
    } else {
      log(`  ✓ No dependency errors`, 'green');
    }

    // Display warnings
    if (warnings.length > 0) {
      log(`  ⚠ ${warnings.length} warning(s):`, 'yellow');
      for (const warning of warnings) {
        log(`    • ${warning.message}`, 'yellow');
      }
    }

    // Auto-fix if requested
    if (AUTO_FIX && errors.some(e => e.type === 'missing_dependency')) {
      log(`\n  Attempting auto-fix...`, 'blue');
      const { fixed, added } = fixPreset(presetName, modulePaths, moduleMap);

      if (added.length > 0) {
        log(`  Added ${added.length} missing dependencies:`, 'green');
        for (const depId of added) {
          log(`    + ${depId}`, 'green');
        }
        fixes[presetName] = fixed;
      } else {
        log(`  No dependencies to add`, 'gray');
      }
    }

    log(''); // blank line
  }

  // Apply fixes if any
  if (AUTO_FIX && Object.keys(fixes).length > 0) {
    log('\nApplying fixes to module-manifest.json...', 'blue');

    // Create backup
    const backupPath = MANIFEST_PATH + '.backup';
    fs.copyFileSync(MANIFEST_PATH, backupPath);
    log(`  Backup created: ${backupPath}`, 'gray');

    // Update manifest
    for (const presetName in fixes) {
      manifest.presets[presetName] = fixes[presetName];
    }

    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
    log('  ✓ module-manifest.json updated', 'green');
  }

  // Summary
  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━', 'cyan');
  log('  Summary', 'cyan');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n', 'cyan');

  if (totalErrors === 0 && totalWarnings === 0) {
    log('  ✓ All presets valid!', 'green');
  } else {
    if (totalErrors > 0) {
      log(`  ✗ ${totalErrors} error(s) found`, 'red');
    }
    if (totalWarnings > 0) {
      log(`  ⚠ ${totalWarnings} warning(s) found`, 'yellow');
    }
  }

  if (AUTO_FIX) {
    log(`\n  Auto-fix ${Object.keys(fixes).length > 0 ? 'applied' : 'not needed'}`, 'blue');
  } else if (totalErrors > 0) {
    log(`\n  Run with --fix to auto-fix missing dependencies`, 'gray');
  }

  log('');

  process.exit(totalErrors > 0 ? 1 : 0);
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { buildModuleMap, validatePreset, fixPreset };
