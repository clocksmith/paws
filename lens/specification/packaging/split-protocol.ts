#!/usr/bin/env node

/**
 * split-protocol.ts
 *
 * Splits MWP.md into manageable section files.
 * Zero dependencies - uses only Node.js built-ins (fs, path, crypto).
 *
 * Usage:
 *   cd specification
 *   node packaging/split-protocol.js
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SPEC_DIR = join(__dirname, '..');
const INPUT_FILE = join(SPEC_DIR, 'MWP.md');
const OUTPUT_DIR = join(SPEC_DIR, 'protocol-sections');
const MANIFEST_FILE = join(OUTPUT_DIR, 'manifest.json');

type SectionType = 'preamble' | 'section' | 'appendix' | 'other' | 'epilogue';

interface Section {
  title: string;
  startLine: number;
  endLine?: number;
  lines: string[];
  type: SectionType;
}

interface ManifestEntry {
  id: string;
  filename: string;
  title: string;
  startLine: number;
  endLine: number | undefined;
  lineCount: number;
  type: SectionType;
  checksum: string;
}

interface Manifest {
  version: string;
  generated: string;
  source: string;
  totalLines: number;
  sections: ManifestEntry[];
}

/**
 * Calculate SHA-256 checksum of content
 */
function calculateChecksum(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Generate a stable file ID from section title
 * Examples:
 *   "1. Terminology" -> "01-terminology"
 *   "Appendix A: References" -> "appendix-a-references"
 *   "Front Matter" -> "00-front-matter"
 */
function generateSectionId(title: string, index: number, type: SectionType): string {
  if (type === 'preamble') return '00-front-matter';
  if (type === 'epilogue') return '99-end-matter';

  // Extract section number if present (e.g., "1. Terminology" -> "1")
  const numberMatch = title.match(/^(\d+)\./);
  if (numberMatch) {
    const num = numberMatch[1].padStart(2, '0');
    const slug = title
      .replace(/^\d+\.\s*/, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `${num}-${slug}`;
  }

  // Appendix handling
  if (title.startsWith('Appendix')) {
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return slug;
  }

  // Fallback: use index
  return `section-${String(index).padStart(2, '0')}`;
}

/**
 * Categorize section by title
 */
function categorizeSection(title: string): SectionType {
  if (title.startsWith('Appendix')) return 'appendix';
  if (/^\d+\./.test(title)) return 'section';
  return 'other';
}

/**
 * Parse document into sections
 * Sections are delimited by lines matching /^## (.+)$/
 */
function parseDocument(lines: string[]): Section[] {
  const sections: Section[] = [];
  let currentSection: Section = {
    title: 'Front Matter',
    startLine: 1,
    lines: [],
    type: 'preamble'
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // Check for section header (## Title)
    const headerMatch = line.match(/^## (.+)$/);

    if (headerMatch) {
      // Save previous section
      if (currentSection.lines.length > 0) {
        currentSection.endLine = lineNumber - 1;
        sections.push(currentSection);
      }

      // Start new section
      const title = headerMatch[1];
      currentSection = {
        title,
        startLine: lineNumber,
        lines: [line],
        type: categorizeSection(title)
      };
    } else {
      currentSection.lines.push(line);
    }
  }

  // Save final section
  if (currentSection.lines.length > 0) {
    currentSection.endLine = lines.length;
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Main split function
 */
function splitProtocol(): void {
  console.log('Reading MWP.md...');

  // Read input file
  if (!existsSync(INPUT_FILE)) {
    console.error(`Error: ${INPUT_FILE} not found`);
    console.error('Make sure you run this script from the specification/ directory:');
    console.error('  cd specification');
    console.error('  node packaging/split-protocol.js');
    process.exit(1);
  }

  const content = readFileSync(INPUT_FILE, 'utf8');
  const lines = content.split('\n');

  console.log(`Total lines: ${lines.length}`);

  // Parse into sections
  const sections = parseDocument(lines);
  console.log(`Found ${sections.length} sections`);

  // Create output directory
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Process sections
  const manifest: Manifest = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    source: 'MWP.md',
    totalLines: lines.length,
    sections: []
  };

  sections.forEach((section, index) => {
    const sectionId = generateSectionId(section.title, index, section.type);
    const filename = `${sectionId}.md`;
    const filepath = join(OUTPUT_DIR, filename);

    // Join lines back with newlines
    const sectionContent = section.lines.join('\n');

    // Write section file
    writeFileSync(filepath, sectionContent, 'utf8');

    // Add to manifest
    const manifestEntry: ManifestEntry = {
      id: sectionId,
      filename,
      title: section.title,
      startLine: section.startLine,
      endLine: section.endLine,
      lineCount: section.lines.length,
      type: section.type,
      checksum: calculateChecksum(sectionContent)
    };

    manifest.sections.push(manifestEntry);

    console.log(`  ✓ ${filename} (${section.lines.length} lines)`);
  });

  // Write manifest
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\n✓ Created ${sections.length} section files`);
  console.log(`✓ Generated manifest: ${MANIFEST_FILE}`);

  // Check if we have end matter
  const lastSection = sections[sections.length - 1];
  if (lastSection.lines.some(line => line.includes('END OF SPECIFICATION'))) {
    manifest.sections[manifest.sections.length - 1].type = 'epilogue';
  }

  // Re-write manifest with updated type
  writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2), 'utf8');
}

// Run
try {
  splitProtocol();
  process.exit(0);
} catch (error: any) {
  console.error('Error:', error.message);
  process.exit(1);
}
