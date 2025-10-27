#!/usr/bin/env tsx

/**
 * Copy generated JSON Schemas to specification/schemas/
 *
 * This script copies the generated JSON Schema files from dist/schemas/
 * to the specification directory for publication and documentation.
 */

import { copyFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_DIR = join(__dirname, '..', 'dist', 'schemas');
const TARGET_DIR = join(__dirname, '..', '..', '..', 'specification', 'schemas');

function main() {
  console.log('Copying JSON Schemas to specification directory...\n');

  if (!existsSync(SOURCE_DIR)) {
    console.error(`Error: Source directory does not exist: ${SOURCE_DIR}`);
    console.error('Run "pnpm schemas:generate" first.');
    process.exit(1);
  }

  if (!existsSync(TARGET_DIR)) {
    console.error(`Error: Target directory does not exist: ${TARGET_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(SOURCE_DIR).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.error('No JSON Schema files found in source directory.');
    process.exit(1);
  }

  let copied = 0;

  for (const file of files) {
    const sourcePath = join(SOURCE_DIR, file);
    const targetPath = join(TARGET_DIR, file);

    try {
      copyFileSync(sourcePath, targetPath);
      console.log(`✓ Copied ${file}`);
      copied++;
    } catch (error: any) {
      console.error(`✗ Failed to copy ${file}:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n✓ Copied ${copied} schema files to specification/schemas/`);
}

main();
