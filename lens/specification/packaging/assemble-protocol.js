#!/usr/bin/env node

/**
 * assemble-protocol.js
 *
 * Reassembles section files into MWP-PROTOCOL.md.
 * Zero dependencies - uses only Node.js built-ins (fs, path, crypto).
 *
 * Usage:
 *   node assemble-protocol.js
 *   node assemble-protocol.js --validate
 *   node assemble-protocol.js --output custom.md
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SPEC_DIR = join(__dirname, '..');
const SECTIONS_DIR = join(SPEC_DIR, 'protocol-sections');
const MANIFEST_FILE = join(SECTIONS_DIR, 'manifest.json');
const DEFAULT_OUTPUT = join(SPEC_DIR, 'MWP.md');

/**
 * Calculate SHA-256 checksum of content
 */
function calculateChecksum(content) {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Parse command-line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    validate: false,
    output: DEFAULT_OUTPUT
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--validate') {
      options.validate = true;
    } else if (args[i] === '--output' && args[i + 1]) {
      options.output = args[i + 1];
      i++; // Skip next arg
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Usage: node packaging/assemble-protocol.js [options]

Run from the specification/ directory.

Options:
  --validate        Validate section checksums before assembling
  --output <file>   Custom output file path (default: MWP.md)
  --help, -h        Show this help message

Example:
  cd specification
  node packaging/assemble-protocol.js --validate
      `);
      process.exit(0);
    }
  }

  return options;
}

/**
 * Validate section files against manifest
 */
function validateSections(manifest) {
  console.log('Validating section files...');

  const errors = [];

  for (const section of manifest.sections) {
    const filepath = join(SECTIONS_DIR, section.filename);

    // Check if file exists
    if (!existsSync(filepath)) {
      errors.push(`Missing file: ${section.filename}`);
      continue;
    }

    // Check checksum
    const content = readFileSync(filepath, 'utf8');
    const checksum = calculateChecksum(content);

    if (checksum !== section.checksum) {
      errors.push(
        `Modified file: ${section.filename} (checksum mismatch)\n` +
        `  Expected: ${section.checksum}\n` +
        `  Got:      ${checksum}`
      );
    }
  }

  if (errors.length > 0) {
    console.error('\nValidation errors:');
    errors.forEach(err => console.error(`  ✗ ${err}`));
    return false;
  }

  console.log(`✓ All ${manifest.sections.length} section files validated`);
  return true;
}

/**
 * Assemble sections into single document
 */
function assembleSections(manifest, outputFile) {
  console.log('Assembling sections...');

  const lines = [];

  for (const section of manifest.sections) {
    const filepath = join(SECTIONS_DIR, section.filename);

    if (!existsSync(filepath)) {
      console.error(`Error: Missing section file: ${section.filename}`);
      process.exit(1);
    }

    const content = readFileSync(filepath, 'utf8');
    const sectionLines = content.split('\n');

    // Add section lines
    lines.push(...sectionLines);

    console.log(`  ✓ ${section.filename} (${sectionLines.length} lines)`);
  }

  // Join with newlines
  const output = lines.join('\n');

  // Write output file
  writeFileSync(outputFile, output, 'utf8');

  console.log(`\n✓ Assembled ${manifest.sections.length} sections`);
  console.log(`✓ Total lines: ${lines.length}`);
  console.log(`✓ Output: ${outputFile}`);

  // Validate line count
  if (lines.length !== manifest.totalLines) {
    console.warn(
      `\nWarning: Line count mismatch!\n` +
      `  Expected: ${manifest.totalLines}\n` +
      `  Got:      ${lines.length}`
    );
  }

  return lines.length;
}

/**
 * Main assembly function
 */
function assembleProtocol(options) {
  // Check manifest exists
  if (!existsSync(MANIFEST_FILE)) {
    console.error(`Error: Manifest not found: ${MANIFEST_FILE}`);
    console.error('Run split-protocol.js first to generate section files.');
    process.exit(1);
  }

  // Read manifest
  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'));

  console.log(`Reading manifest (${manifest.sections.length} sections)...`);

  // Validate if requested
  if (options.validate) {
    const valid = validateSections(manifest);
    if (!valid) {
      console.error('\nValidation failed. Fix errors before assembling.');
      process.exit(1);
    }
    console.log();
  }

  // Assemble sections
  const lineCount = assembleSections(manifest, options.output);

  // Success
  console.log('\n✓ Assembly complete!');
  return lineCount;
}

// Run
try {
  const options = parseArgs();
  assembleProtocol(options);
  process.exit(0);
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
  process.exit(1);
}
