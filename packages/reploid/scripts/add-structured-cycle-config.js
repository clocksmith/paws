#!/usr/bin/env node

/**
 * Auto-patcher for config.json
 * Adds Structured Cycle (STCY) upgrade, Multi-Mind Architect persona, and Blueprint 0x000047
 *
 * Usage: node scripts/add-structured-cycle-config.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const BACKUP_PATH = path.join(__dirname, '..', 'config.json.backup');

console.log('🔧 REPLOID Config Patcher: Adding Structured Cycle Support\n');

// Step 1: Backup original config
console.log('[1/5] Creating backup of config.json...');
try {
  const originalConfig = fs.readFileSync(CONFIG_PATH, 'utf-8');
  fs.writeFileSync(BACKUP_PATH, originalConfig, 'utf-8');
  console.log('✅ Backup created: config.json.backup\n');
} catch (error) {
  console.error('❌ Error creating backup:', error.message);
  process.exit(1);
}

// Step 2: Read and parse config
console.log('[2/5] Reading config.json...');
let config;
try {
  const configContent = fs.readFileSync(CONFIG_PATH, 'utf-8');
  config = JSON.parse(configContent);
  console.log('✅ Config loaded successfully\n');
} catch (error) {
  console.error('❌ Error reading config.json:', error.message);
  process.exit(1);
}

// Step 3: Add STCY upgrade
console.log('[3/5] Adding STCY upgrade...');
const stcyUpgrade = {
  id: 'STCY',
  path: 'agent-cycle-structured.js',
  description: '8-step structured agent cycle with explicit deliberation, self-assessment, and confidence scoring',
  category: 'agent',
  blueprint: '0x000047'
};

const stcyExists = config.upgrades.some(u => u.id === 'STCY');
if (stcyExists) {
  console.log('⚠️  STCY upgrade already exists, skipping...');
} else {
  config.upgrades.push(stcyUpgrade);
  console.log('✅ STCY upgrade added');
}

// Step 4: Add Multi-Mind Architect persona
console.log('\n[4/5] Adding Multi-Mind Architect persona...');
const multiMindPersona = {
  id: 'multi_mind_architect',
  name: 'Multi-Mind Architect',
  type: 'lab',
  description: 'Advanced multi-perspective agent synthesizing 50+ expert profiles using structured 8-step cycle with self-assessment and confidence scoring.',
  upgrades: [
    'APPL', 'UTIL', 'STMT', 'IDXB', 'APIC', 'STCY', 'PRMT', 'AGLP', 'STHP',
    'TRUN', 'TLRD', 'TLWR', 'TRHP', 'UIMN', 'STYL', 'BODY', 'EVAL', 'PMON',
    'MDSH', 'AVIS', 'ASTV', 'MGRV', 'INTR', 'REFL', 'REAN', 'RESRCH',
    'TEST', 'BAPI', 'HYBR'
  ],
  blueprints: [
    '0x000001', '0x000008', '0x000009', '0x000012', '0x00001B', '0x000047'
  ],
  persona: 'MultiMindSynthesisPersona',
  lessons: [
    {
      name: 'Multi-Perspective Analysis',
      goal: 'Analyze the agent-cycle.js module from multiple expert perspectives (Scientist, Engineer, Designer, Auditor) and propose improvements.'
    },
    {
      name: 'Self-Assessment Practice',
      goal: 'Execute a structured cycle to refactor state-manager.js. Pay attention to your self-assessment and confidence scoring.'
    },
    {
      name: 'Cross-Domain Synthesis',
      goal: 'Design a new visualization feature that combines insights from Graph Theory, Color Theory, and Browser Performance Optimization.'
    }
  ]
};

const personaExists = config.personas.some(p => p.id === 'multi_mind_architect');
if (personaExists) {
  console.log('⚠️  Multi-Mind Architect persona already exists, skipping...');
} else {
  config.personas.push(multiMindPersona);
  console.log('✅ Multi-Mind Architect persona added');
}

// Step 5: Add Blueprint 0x000047
console.log('\n[5/5] Adding Blueprint 0x000047...');
const blueprint047 = {
  id: '0x000047',
  path: '0x000047-structured-agent-cycle.md',
  description: '8-step structured agent cycle with explicit deliberation, self-assessment, and confidence scoring.'
};

const blueprintExists = config.blueprints.some(b => b.id === '0x000047');
if (blueprintExists) {
  console.log('⚠️  Blueprint 0x000047 already exists, skipping...');
} else {
  config.blueprints.push(blueprint047);
  console.log('✅ Blueprint 0x000047 added');
}

// Step 6: Add structured cycle config section
console.log('\nAdding structured cycle configuration...');
if (!config.structuredCycle) {
  config.structuredCycle = {
    enabled: true,
    defaultPersona: 'MultiMindSynthesisPersona',
    confidenceThresholds: {
      autoApply: 0.85,
      showWarning: 0.50,
      requireApproval: 0.30
    },
    enabledPersonas: ['multi_mind_architect']
  };
  console.log('✅ Structured cycle config added');
} else {
  console.log('⚠️  Structured cycle config already exists, skipping...');
}

// Step 7: Write updated config
console.log('\nWriting updated config.json...');
try {
  const updatedConfig = JSON.stringify(config, null, 2);
  fs.writeFileSync(CONFIG_PATH, updatedConfig, 'utf-8');
  console.log('✅ Config updated successfully\n');
} catch (error) {
  console.error('❌ Error writing config.json:', error.message);
  console.log('Restoring backup...');
  try {
    const backup = fs.readFileSync(BACKUP_PATH, 'utf-8');
    fs.writeFileSync(CONFIG_PATH, backup, 'utf-8');
    console.log('✅ Backup restored');
  } catch (restoreError) {
    console.error('❌ Error restoring backup:', restoreError.message);
  }
  process.exit(1);
}

// Summary
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Configuration Updated Successfully!');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

console.log('Added Components:');
console.log('  1. STCY Upgrade (agent-cycle-structured.js)');
console.log('  2. Multi-Mind Architect Persona');
console.log('  3. Blueprint 0x000047');
console.log('  4. Structured Cycle Config Section\n');

console.log('Next Steps:');
console.log('  1. Restart REPLOID');
console.log('  2. Select "Multi-Mind Architect" persona from UI');
console.log('  3. Execute a cycle to test structured reasoning');
console.log('  4. Check confidence scores in agent output\n');

console.log('Files Created:');
console.log('  ✅ upgrades/agent-cycle-structured.js');
console.log('  ✅ personas/MultiMindSynthesisPersona.js');
console.log('  ✅ blueprints/0x000047-structured-agent-cycle.md');
console.log('  ✅ docs/STRUCTURED_CYCLE_GUIDE.md');
console.log('  ✅ docs/PERSONAS_REFERENCE.md\n');

console.log('Backup: config.json.backup (restore if needed)\n');
