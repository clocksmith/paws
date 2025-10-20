#!/usr/bin/env node

/**
 * Validates that all personas in config.json can boot successfully
 * Checks for missing upgrades, blueprints, and dependency issues
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

// Read module-manifest.json
const manifestPath = path.join(REPLOID_ROOT, 'module-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

// Get all available upgrade IDs from config.json
const availableUpgrades = new Set(config.upgrades.map(u => u.id));

// Get all available blueprints from config.json
const availableBlueprints = new Set(config.blueprints.map(b => b.id));

// Get all modules from manifest
const manifestModules = new Set();
for (const group of manifest.loadGroups) {
  for (const module of group.modules) {
    manifestModules.add(module.id);
  }
}

console.log('\n=== REPLOID PERSONA VALIDATION ===\n');
console.log(`Total personas: ${config.personas.length}`);
console.log(`Available upgrades: ${availableUpgrades.size}`);
console.log(`Available blueprints: ${availableBlueprints.size}`);
console.log(`Manifest modules: ${manifestModules.size}\n`);

let allValid = true;
const issues = [];

for (const persona of config.personas) {
  console.log(`\n--- Persona: ${persona.name} (${persona.id}) ---`);
  console.log(`Type: ${persona.type}`);
  console.log(`Upgrades requested: ${persona.upgrades?.length || 0}`);
  console.log(`Blueprints requested: ${persona.blueprints?.length || 0}`);

  const personaIssues = {
    id: persona.id,
    name: persona.name,
    missingUpgrades: [],
    missingBlueprints: [],
    errors: []
  };

  // Check upgrades
  if (persona.upgrades && persona.upgrades.length > 0) {
    for (const upgradeId of persona.upgrades) {
      if (!availableUpgrades.has(upgradeId)) {
        personaIssues.missingUpgrades.push(upgradeId);
        console.log(`  ❌ Missing upgrade: ${upgradeId}`);
        allValid = false;
      }
    }
    if (personaIssues.missingUpgrades.length === 0) {
      console.log(`  ✅ All upgrades available`);
    }
  }

  // Check blueprints
  if (persona.blueprints && persona.blueprints.length > 0) {
    for (const blueprintId of persona.blueprints) {
      if (!availableBlueprints.has(blueprintId)) {
        personaIssues.missingBlueprints.push(blueprintId);
        console.log(`  ❌ Missing blueprint: ${blueprintId}`);
        allValid = false;
      }
    }
    if (personaIssues.missingBlueprints.length === 0) {
      console.log(`  ✅ All blueprints available`);
    }
  }

  // Check for persona file existence
  const personaModuleName = persona.id.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('') + 'Persona';
  const personaPath = path.join(REPLOID_ROOT, 'personas', `${personaModuleName}.js`);

  if (!fs.existsSync(personaPath)) {
    personaIssues.errors.push(`Persona file not found: ${personaPath}`);
    console.log(`  ⚠️  Persona file missing: personas/${personaModuleName}.js`);
    // Not marking as invalid - personas are optional
  } else {
    console.log(`  ✅ Persona file exists: personas/${personaModuleName}.js`);
  }

  if (personaIssues.missingUpgrades.length > 0 || personaIssues.missingBlueprints.length > 0) {
    issues.push(personaIssues);
  }
}

// Check for core modules required by all personas
console.log(`\n\n--- Core Module Availability ---`);
const coreModules = config.minimalRSICore || [];
console.log(`Minimal RSI Core requires: ${coreModules.length} modules`);

const missingCoreModules = [];
for (const moduleId of coreModules) {
  if (!availableUpgrades.has(moduleId)) {
    missingCoreModules.push(moduleId);
    console.log(`  ❌ Missing core module: ${moduleId}`);
    allValid = false;
  }
}

if (missingCoreModules.length === 0) {
  console.log(`  ✅ All core modules available`);
}

// Summary
console.log(`\n\n=== VALIDATION SUMMARY ===\n`);

if (allValid) {
  console.log(`✅ ALL PERSONAS VALID - REPLOID can boot with any persona`);
  console.log(`\nAll ${config.personas.length} personas have their required upgrades and blueprints.`);
} else {
  console.log(`❌ VALIDATION FAILED - Some personas have missing dependencies\n`);

  for (const issue of issues) {
    console.log(`\nPersona: ${issue.name} (${issue.id})`);
    if (issue.missingUpgrades.length > 0) {
      console.log(`  Missing upgrades (${issue.missingUpgrades.length}):`);
      issue.missingUpgrades.forEach(id => console.log(`    - ${id}`));
    }
    if (issue.missingBlueprints.length > 0) {
      console.log(`  Missing blueprints (${issue.missingBlueprints.length}):`);
      issue.missingBlueprints.forEach(id => console.log(`    - ${id}`));
    }
  }

  if (missingCoreModules.length > 0) {
    console.log(`\nMissing core modules (${missingCoreModules.length}):`);
    missingCoreModules.forEach(id => console.log(`  - ${id}`));
  }
}

// Check boot index.html for persona selector
console.log(`\n\n--- Boot UI Check ---`);
const indexPath = path.join(REPLOID_ROOT, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexContent = fs.readFileSync(indexPath, 'utf-8');
  const hasPersonaSelector = indexContent.includes('persona') || indexContent.includes('Persona');

  if (hasPersonaSelector) {
    console.log(`✅ index.html appears to have persona selection UI`);
  } else {
    console.log(`⚠️  index.html may not have persona selection UI`);
  }
} else {
  console.log(`❌ index.html not found at ${indexPath}`);
}

console.log('');

process.exit(allValid ? 0 : 1);
