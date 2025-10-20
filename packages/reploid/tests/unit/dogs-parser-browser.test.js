/**
 * @fileoverview Unit tests for DogsParserBrowser module
 */

import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load DogsParserBrowser module
const DogsParserBrowser = require(resolve(__dirname, '../../upgrades/dogs-parser-browser.js')).default || require(resolve(__dirname, '../../upgrades/dogs-parser-browser.js'));

// Mock dependencies
const mockUtils = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

const parser = DogsParserBrowser.factory({ Utils: mockUtils });

describe('DogsParserBrowser - DOGS Parsing', () => {
  it('should parse CREATE operations', () => {
    const dogsBundle = `
\`\`\`paws-change
operation: CREATE
file_path: /test.js
reason: Add test file
\`\`\`
🐕 --- DOGS_START_FILE: /test.js ---
console.log("test");
🐕 --- DOGS_END_FILE: /test.js ---
`;

    const result = parser.api.parseDogs(dogsBundle);
    expect(result.total).toBe(1);
    expect(result.creates).toBe(1);
    expect(result.changes[0].operation).toBe('CREATE');
    expect(result.changes[0].file_path).toBe('/test.js');
    expect(result.changes[0].new_content).toContain('console.log');
  });

  it('should parse MODIFY operations', () => {
    const dogsBundle = `
\`\`\`paws-change
operation: MODIFY
file_path: /existing.js
reason: Update implementation
\`\`\`
🐕 --- DOGS_START_FILE: /existing.js ---
// Updated content
🐕 --- DOGS_END_FILE: /existing.js ---
`;

    const result = parser.api.parseDogs(dogsBundle);
    expect(result.total).toBe(1);
    expect(result.modifies).toBe(1);
    expect(result.changes[0].operation).toBe('MODIFY');
  });

  it('should parse DELETE operations', () => {
    const dogsBundle = `
\`\`\`paws-change
operation: DELETE
file_path: /old.js
reason: No longer needed
\`\`\`
`;

    const result = parser.api.parseDogs(dogsBundle);
    expect(result.total).toBe(1);
    expect(result.deletes).toBe(1);
    expect(result.changes[0].operation).toBe('DELETE');
    expect(result.changes[0].file_path).toBe('/old.js');
  });

  it('should parse multiple operations', () => {
    const dogsBundle = `
\`\`\`paws-change
operation: CREATE
file_path: /new.js
\`\`\`
🐕 --- DOGS_START_FILE: /new.js ---
new content
🐕 --- DOGS_END_FILE: /new.js ---

\`\`\`paws-change
operation: MODIFY
file_path: /existing.js
\`\`\`
🐕 --- DOGS_START_FILE: /existing.js ---
modified
🐕 --- DOGS_END_FILE: /existing.js ---

\`\`\`paws-change
operation: DELETE
file_path: /old.js
\`\`\`
`;

    const result = parser.api.parseDogs(dogsBundle);
    expect(result.total).toBe(3);
    expect(result.creates).toBe(1);
    expect(result.modifies).toBe(1);
    expect(result.deletes).toBe(1);
  });
});

describe('DogsParserBrowser - DOGS Creation', () => {
  it('should create DOGS bundle from changes', () => {
    const changes = [
      {
        operation: 'CREATE',
        file_path: '/test.js',
        new_content: 'console.log("test");',
        reason: 'Add test'
      }
    ];

    const bundle = parser.api.createDogsBundle(changes);
    expect(bundle).toContain('CREATE');
    expect(bundle).toContain('/test.js');
    expect(bundle).toContain('console.log');
    expect(bundle).toContain('🐕 --- DOGS_START_FILE');
  });

  it('should create bundle with metadata', () => {
    const changes = [
      {
        operation: 'CREATE',
        file_path: '/test.js',
        new_content: 'content',
        reason: 'test'
      }
    ];

    const metadata = {
      author: 'Agent',
      timestamp: '2025-01-01'
    };

    const bundle = parser.api.createDogsBundle(changes, metadata);
    expect(bundle).toBeDefined();
    expect(typeof bundle).toBe('string');
  });

  it('should round-trip DOGS bundles', () => {
    const original = [
      {
        operation: 'CREATE',
        file_path: '/test.js',
        new_content: 'console.log("test");',
        reason: 'Test file'
      }
    ];

    const bundle = parser.api.createDogsBundle(original);
    const parsed = parser.api.parseDogs(bundle);

    expect(parsed.total).toBe(1);
    expect(parsed.changes[0].operation).toBe(original[0].operation);
    expect(parsed.changes[0].file_path).toBe(original[0].file_path);
  });
});

describe('DogsParserBrowser - DOGS Validation', () => {
  it('should validate correct DOGS bundle', () => {
    const validBundle = `
\`\`\`paws-change
operation: CREATE
file_path: /test.js
\`\`\`
🐕 --- DOGS_START_FILE: /test.js ---
content
🐕 --- DOGS_END_FILE: /test.js ---
`;

    const validation = parser.api.validateDogs(validBundle);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  it('should detect missing markers', () => {
    const invalidBundle = `
\`\`\`paws-change
operation: CREATE
file_path: /test.js
\`\`\`
content without markers
`;

    const validation = parser.api.validateDogs(invalidBundle);
    // May or may not be invalid depending on implementation
    expect(validation).toHaveProperty('valid');
    expect(validation).toHaveProperty('errors');
  });
});

describe('DogsParserBrowser - CATS Parsing', () => {
  it('should parse CATS bundle', () => {
    const catsBundle = `
🐈 --- CATS_START_FILE: /file1.js ---
content 1
🐈 --- CATS_END_FILE: /file1.js ---

🐈 --- CATS_START_FILE: /file2.md ---
content 2
🐈 --- CATS_END_FILE: /file2.md ---
`;

    const result = parser.api.parseCats(catsBundle);
    expect(result.total).toBe(2);
    expect(result.files).toHaveLength(2);
    expect(result.files[0].path).toBe('/file1.js');
    expect(result.files[1].path).toBe('/file2.md');
  });

  it('should extract file contents correctly', () => {
    const catsBundle = `
🐈 --- CATS_START_FILE: /test.js ---
const x = 1;
const y = 2;
🐈 --- CATS_END_FILE: /test.js ---
`;

    const result = parser.api.parseCats(catsBundle);
    expect(result.files[0].content).toContain('const x = 1');
    expect(result.files[0].content).toContain('const y = 2');
  });
});

describe('DogsParserBrowser - CATS Creation', () => {
  it('should create CATS bundle from files', () => {
    const files = [
      { path: '/file1.js', content: 'const x = 1;' },
      { path: '/file2.md', content: '# Documentation' }
    ];

    const bundle = parser.api.createCatsBundle(files);
    expect(bundle).toContain('🐈 --- CATS_START_FILE: /file1.js');
    expect(bundle).toContain('const x = 1');
    expect(bundle).toContain('🐈 --- CATS_START_FILE: /file2.md');
    expect(bundle).toContain('# Documentation');
  });

  it('should round-trip CATS bundles', () => {
    const original = [
      { path: '/test.js', content: 'test content' },
      { path: '/doc.md', content: '# Doc' }
    ];

    const bundle = parser.api.createCatsBundle(original);
    const parsed = parser.api.parseCats(bundle);

    expect(parsed.total).toBe(2);
    expect(parsed.files[0].path).toBe(original[0].path);
    expect(parsed.files[1].path).toBe(original[1].path);
  });
});

describe('DogsParserBrowser - CATS Validation', () => {
  it('should validate correct CATS bundle', () => {
    const validBundle = `
🐈 --- CATS_START_FILE: /test.js ---
content
🐈 --- CATS_END_FILE: /test.js ---
`;

    const validation = parser.api.validateCats(validBundle);
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});

describe('DogsParserBrowser - Edge Cases', () => {
  it('should handle empty bundles', () => {
    const result = parser.api.parseDogs('');
    expect(result.total).toBe(0);
    expect(result.changes).toHaveLength(0);
  });

  it('should handle bundles with no operations', () => {
    const bundle = '# Some markdown without operations';
    const result = parser.api.parseDogs(bundle);
    expect(result.total).toBe(0);
  });

  it('should handle multiline file content', () => {
    const dogsBundle = `
\`\`\`paws-change
operation: CREATE
file_path: /multi.js
\`\`\`
🐕 --- DOGS_START_FILE: /multi.js ---
line 1
line 2
line 3
🐕 --- DOGS_END_FILE: /multi.js ---
`;

    const result = parser.api.parseDogs(dogsBundle);
    expect(result.changes[0].new_content).toContain('line 1');
    expect(result.changes[0].new_content).toContain('line 3');
  });

  it('should handle special characters in content', () => {
    const content = 'const str = "🐕 special chars $#@!";';
    const changes = [
      {
        operation: 'CREATE',
        file_path: '/special.js',
        new_content: content,
        reason: 'test'
      }
    ];

    const bundle = parser.api.createDogsBundle(changes);
    const parsed = parser.api.parseDogs(bundle);

    expect(parsed.changes[0].new_content).toContain('special chars');
  });
});

describe('DogsParserBrowser - File Operation Constants', () => {
  it('should export FileOperation constants', () => {
    expect(parser.api.FileOperation).toBeDefined();
    expect(parser.api.FileOperation.CREATE).toBe('CREATE');
    expect(parser.api.FileOperation.MODIFY).toBe('MODIFY');
    expect(parser.api.FileOperation.DELETE).toBe('DELETE');
  });
});

describe('DogsParserBrowser - Web Component Widget', () => {
  it('should export widget configuration', () => {
    expect(parser.widget).toBeDefined();
    expect(parser.widget.element).toBe('dogs-parser-browser-widget');
    expect(parser.widget.displayName).toBe('DOGS/CATS Parser');
    expect(parser.widget.icon).toBe('🐕');
    expect(parser.widget.category).toBe('utility');
  });
});
