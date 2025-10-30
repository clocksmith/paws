#!/usr/bin/env node
/**
 * Pre-Integration Verification Script
 *
 * Verifies that all MCP infrastructure, servers, and widgets are ready for testing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '../..');

// Colors for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

const { reset, red, green, yellow, blue } = colors;

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

/**
 * Check if a file exists
 */
function checkFileExists(filePath, description) {
  totalChecks++;
  const fullPath = path.join(BASE_DIR, filePath);
  const exists = fs.existsSync(fullPath);

  if (exists) {
    console.log(`${green}✓${reset} ${description}`);
    console.log(`  ${filePath}`);
    passedChecks++;
    return true;
  } else {
    console.log(`${red}✗${reset} ${description}`);
    console.log(`  ${filePath} (NOT FOUND)`);
    failedChecks++;
    return false;
  }
}

/**
 * Check if directory exists and has files
 */
function checkDirectoryHasFiles(dirPath, description, minFiles = 1) {
  totalChecks++;
  const fullPath = path.join(BASE_DIR, dirPath);

  if (!fs.existsSync(fullPath)) {
    console.log(`${red}✗${reset} ${description}`);
    console.log(`  ${dirPath} (DIRECTORY NOT FOUND)`);
    failedChecks++;
    return false;
  }

  const files = fs.readdirSync(fullPath).filter(f => !f.startsWith('.'));
  if (files.length >= minFiles) {
    console.log(`${green}✓${reset} ${description}`);
    console.log(`  ${dirPath} (${files.length} files)`);
    passedChecks++;
    return true;
  } else {
    console.log(`${red}✗${reset} ${description}`);
    console.log(`  ${dirPath} (Only ${files.length} files, expected ${minFiles}+)`);
    failedChecks++;
    return false;
  }
}

/**
 * Check file contains specific content
 */
function checkFileContains(filePath, searchString, description) {
  totalChecks++;
  const fullPath = path.join(BASE_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    console.log(`${red}✗${reset} ${description}`);
    console.log(`  ${filePath} (FILE NOT FOUND)`);
    failedChecks++;
    return false;
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const contains = content.includes(searchString);

  if (contains) {
    console.log(`${green}✓${reset} ${description}`);
    console.log(`  ${filePath}`);
    passedChecks++;
    return true;
  } else {
    console.log(`${yellow}⚠${reset} ${description}`);
    console.log(`  ${filePath} (Content check failed)`);
    failedChecks++;
    return false;
  }
}

console.log(`${blue}╔════════════════════════════════════════════╗${reset}`);
console.log(`${blue}║  MCP INTEGRATION READINESS VERIFICATION    ║${reset}`);
console.log(`${blue}╚════════════════════════════════════════════╝${reset}`);
console.log('');

// Phase 1: MCP Infrastructure (Agent 1)
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}PHASE 1: MCP Infrastructure (Agent 1)${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');

checkFileExists(
  'reploid/upgrades/mcp/reploid-mcp-server-base.js',
  'MCP Server Base Class'
);

checkFileExists(
  'reploid/upgrades/mcp/reploid-mcp-registry.js',
  'MCP Server Registry'
);

checkFileExists(
  'reploid/upgrades/mcp/reploid-mcp-bridge.js',
  'MCP Bridge Server'
);

checkFileExists(
  'lens/schema-extensions/approval-workflows.ts',
  'Approval Workflow Schema Extensions'
);

checkFileExists(
  'reploid/upgrades/mcp/approval-permission-manager.js',
  'Approval Permission Manager'
);

console.log('');

// Phase 2: MCP Servers (Agent 2)
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}PHASE 2: MCP Servers (Agent 2)${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');

checkFileExists(
  'reploid/upgrades/mcp/servers/vfs-mcp-server.js',
  'VFS MCP Server'
);

checkFileExists(
  'reploid/upgrades/mcp/servers/workflow-mcp-server.js',
  'Workflow MCP Server'
);

checkFileExists(
  'reploid/upgrades/mcp/servers/analytics-mcp-server.js',
  'Analytics MCP Server'
);

checkDirectoryHasFiles(
  'reploid/upgrades/mcp/servers',
  'MCP Servers Directory',
  3
);

console.log('');

// Phase 3: Lens Widgets (Agent 3)
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}PHASE 3: Lens Widgets (Agent 3)${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');

checkFileExists(
  'lens/widgets/reploid/agent-control/index.html',
  'Agent Control Widget'
);

checkFileExists(
  'lens/widgets/reploid/vfs-explorer/index.html',
  'VFS Explorer Widget'
);

checkFileExists(
  'lens/widgets/reploid/diff-viewer/index.html',
  'Diff Viewer Widget'
);

checkDirectoryHasFiles(
  'lens/widgets/reploid',
  'Reploid Widgets Directory',
  3
);

console.log('');

// Phase 4: Test Infrastructure (Agent 4)
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}PHASE 4: Test Infrastructure (Agent 4)${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');

checkFileExists(
  'reploid/tests/mcp-servers/test-harness.js',
  'Test Harness'
);

checkFileExists(
  'reploid/tests/mcp-servers/vfs-server.test.js',
  'VFS Server Tests'
);

checkFileExists(
  'reploid/tests/mcp-servers/workflow-server.test.js',
  'Workflow Server Tests'
);

checkFileExists(
  'reploid/tests/e2e/approval-workflow.test.js',
  'E2E Approval Workflow Test'
);

checkFileExists(
  'reploid/tests/benchmarks/mcp-overhead.bench.js',
  'Performance Benchmarks'
);

console.log('');

// Documentation
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}DOCUMENTATION${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');

checkFileExists(
  'reploid/docs/MCP-ARCHITECTURE.md',
  'MCP Architecture Documentation'
);

checkFileExists(
  'reploid/docs/LENS-WIDGETS.md',
  'Lens Widgets Documentation'
);

checkFileExists(
  'reploid/docs/MIGRATION-GUIDE.md',
  'Migration Guide'
);

console.log('');

// Summary
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log(`${blue}SUMMARY${reset}`);
console.log(`${blue}════════════════════════════════════════════${reset}`);
console.log('');
console.log(`Total checks:   ${totalChecks}`);
console.log(`${green}Passed:${reset}         ${passedChecks}`);
console.log(`${red}Failed:${reset}         ${failedChecks}`);
console.log('');

const successRate = Math.round((passedChecks / totalChecks) * 100);
console.log(`Success rate:   ${successRate}%`);
console.log('');

// Readiness assessment
if (failedChecks === 0) {
  console.log(`${green}✓ ALL CHECKS PASSED${reset}`);
  console.log('System is ready for integration testing!');
  console.log('');
  console.log('Next steps:');
  console.log('  1. Run test suite: ./reploid/tests/run-all-tests.sh');
  console.log('  2. Run benchmarks: ./reploid/tests/run-all-tests.sh --benchmark');
  console.log('  3. Run E2E tests: ./reploid/tests/run-all-tests.sh --e2e-only');
  process.exit(0);
} else if (passedChecks >= totalChecks * 0.7) {
  console.log(`${yellow}⚠ PARTIALLY READY${reset}`);
  console.log(`${failedChecks} checks failed, but core infrastructure may be usable.`);
  console.log('');
  console.log('Review failed checks above and complete missing components.');
  process.exit(1);
} else {
  console.log(`${red}✗ NOT READY${reset}`);
  console.log('Too many components are missing. Complete prerequisite tasks first.');
  console.log('');
  console.log('Check agent progress:');
  console.log('  ./reploid/tests/monitor-agents.sh');
  process.exit(2);
}
