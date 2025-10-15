#!/usr/bin/env node

/**
 * Ensures that vendored REPLOID binaries stay in lockstep with the canonical JS implementations.
 * The canonical files (js/cats.js, js/dogs.js) declare a @sync-checksum comment whose value is the
 * SHA-256 hash of the file content with that line removed. REPLOID binaries must carry the same
 * checksum to assert that they were updated after any canonical change.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const repoRoot = path.resolve(__dirname, '..');

const pairs = [
  {
    canonical: 'js/cats.js',
    vendored: 'reploid/bin/cats',
    label: 'cats',
  },
  {
    canonical: 'js/dogs.js',
    vendored: 'reploid/bin/dogs',
    label: 'dogs',
  },
];

function load(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8');
}

function extractChecksum(content, filePath) {
  const match = content.match(/@sync-checksum:\s*([a-f0-9]+)/i);
  if (!match) {
    throw new Error(`${filePath} is missing a @sync-checksum declaration`);
  }
  return match[1];
}

function computeChecksum(content) {
  const sanitized = content
    .split('\n')
    .filter((line) => !line.includes('@sync-checksum'))
    .join('\n');
  return crypto.createHash('sha256').update(sanitized).digest('hex');
}

let failures = 0;

for (const { canonical, vendored, label } of pairs) {
  try {
    const canonicalContent = load(canonical);
    const canonicalDeclared = extractChecksum(canonicalContent, canonical);
    const canonicalActual = computeChecksum(canonicalContent);

    if (canonicalDeclared !== canonicalActual) {
      throw new Error(
        `${canonical} declares checksum ${canonicalDeclared} but actual checksum is ${canonicalActual}`,
      );
    }

    const vendoredContent = load(vendored);
    const vendoredDeclared = extractChecksum(vendoredContent, vendored);

    if (vendoredDeclared !== canonicalDeclared) {
      throw new Error(
        `${vendored} declares checksum ${vendoredDeclared} but canonical ${canonical} declares ${canonicalDeclared}`,
      );
    }
  } catch (err) {
    failures += 1;
    console.error(`✖ ${label} sync check failed: ${err.message}`);
  }
}

if (failures > 0) {
  console.error(`\nSync verification failed for ${failures} file pair(s).`);
  process.exit(1);
}

console.log('✓ REPLOID binaries are synchronized with canonical PAWS scripts.');
