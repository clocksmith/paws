/**
 * @fileoverview Unit tests for DiffUtils module
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load DiffUtils module
const DiffUtils = require(resolve(__dirname, '../../upgrades/diff-utils.js')).default || require(resolve(__dirname, '../../upgrades/diff-utils.js'));

// Mock dependencies
const mockUtils = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

const diffUtils = DiffUtils.factory({ Utils: mockUtils });

describe('DiffUtils - Basic Diff Operations', () => {
  it('should detect identical files', () => {
    const content = 'line 1\nline 2\nline 3';
    const result = diffUtils.api.diff(content, content);

    expect(result.identical).toBe(true);
    expect(result.stats.additions).toBe(0);
    expect(result.stats.deletions).toBe(0);
  });

  it('should detect additions', () => {
    const contentA = 'line 1\nline 2';
    const contentB = 'line 1\nline 2\nline 3';
    const result = diffUtils.api.diff(contentA, contentB);

    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(0);
    expect(result.changes.some(c => c.type === 'addition' && c.line === 'line 3')).toBe(true);
  });

  it('should detect deletions', () => {
    const contentA = 'line 1\nline 2\nline 3';
    const contentB = 'line 1\nline 2';
    const result = diffUtils.api.diff(contentA, contentB);

    expect(result.stats.deletions).toBe(1);
    expect(result.stats.additions).toBe(0);
    expect(result.changes.some(c => c.type === 'deletion' && c.line === 'line 3')).toBe(true);
  });

  it('should detect modifications as deletion + addition', () => {
    const contentA = 'line 1\nOLD LINE\nline 3';
    const contentB = 'line 1\nNEW LINE\nline 3';
    const result = diffUtils.api.diff(contentA, contentB);

    expect(result.stats.deletions).toBeGreaterThanOrEqual(1);
    expect(result.stats.additions).toBeGreaterThanOrEqual(1);
  });
});

describe('DiffUtils - Edge Cases', () => {
  it('should handle empty strings', () => {
    const result = diffUtils.api.diff('', '');
    expect(result.identical).toBe(true);
    expect(result.stats.additions).toBe(0);
  });

  it('should handle empty vs non-empty', () => {
    const result = diffUtils.api.diff('', 'new content');
    expect(result.stats.additions).toBe(1);
    expect(result.stats.deletions).toBe(0);
  });

  it('should handle non-empty vs empty', () => {
    const result = diffUtils.api.diff('old content', '');
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.additions).toBe(0);
  });

  it('should handle single line files', () => {
    const result = diffUtils.api.diff('single line', 'different line');
    expect(result.stats.deletions).toBe(1);
    expect(result.stats.additions).toBe(1);
  });

  it('should handle files with trailing newlines', () => {
    const contentA = 'line 1\nline 2\n';
    const contentB = 'line 1\nline 2';
    const result = diffUtils.api.diff(contentA, contentB);
    // Should handle gracefully
    expect(result).toBeDefined();
  });
});

describe('DiffUtils - LCS Algorithm', () => {
  it('should find longest common subsequence', () => {
    const linesA = ['a', 'b', 'c', 'd'];
    const linesB = ['a', 'c', 'd', 'e'];
    const result = diffUtils.api.diff(linesA.join('\n'), linesB.join('\n'));

    // Should detect 'b' deleted and 'e' added
    expect(result.changes.some(c => c.type === 'deletion' && c.line === 'b')).toBe(true);
    expect(result.changes.some(c => c.type === 'addition' && c.line === 'e')).toBe(true);
  });

  it('should preserve unchanged lines', () => {
    const contentA = 'unchanged 1\nchanged old\nunchanged 2';
    const contentB = 'unchanged 1\nchanged new\nunchanged 2';
    const result = diffUtils.api.diff(contentA, contentB);

    expect(result.stats.unchanged).toBe(2); // Two unchanged lines
  });
});

describe('DiffUtils - Output Formats', () => {
  it('should generate unified diff format', () => {
    const contentA = 'line 1\nline 2\nline 3';
    const contentB = 'line 1\nmodified 2\nline 3';
    const result = diffUtils.api.diff(contentA, contentB, { format: 'unified' });

    expect(result.formatted).toBeDefined();
    expect(typeof result.formatted).toBe('string');
    // Unified diff should contain '+' and '-' markers
    expect(result.formatted.includes('+')).toBe(true);
    expect(result.formatted.includes('-')).toBe(true);
  });

  it('should generate side-by-side format', () => {
    const contentA = 'line 1';
    const contentB = 'line 2';
    const result = diffUtils.api.diff(contentA, contentB, { format: 'sideBySide' });

    expect(result.formatted).toBeDefined();
    expect(typeof result.formatted).toBe('string');
  });

  it('should generate JSON format', () => {
    const contentA = 'line 1';
    const contentB = 'line 2';
    const result = diffUtils.api.diff(contentA, contentB, { format: 'json' });

    expect(result.formatted).toBeDefined();
    expect(result.changes).toBeInstanceOf(Array);
  });
});

describe('DiffUtils - Context Lines', () => {
  it('should respect context lines option', () => {
    const contentA = 'line 1\nline 2\nline 3\nline 4\nline 5';
    const contentB = 'line 1\nline 2\nCHANGED\nline 4\nline 5';

    const result = diffUtils.api.diff(contentA, contentB, {
      format: 'unified',
      contextLines: 1
    });

    expect(result.formatted).toBeDefined();
  });
});

describe('DiffUtils - Large Files', () => {
  it('should handle moderately large files', () => {
    const linesA = Array(500).fill('line').map((l, i) => `${l} ${i}`);
    const linesB = [...linesA];
    linesB[250] = 'modified line 250';

    const result = diffUtils.api.diff(linesA.join('\n'), linesB.join('\n'));

    expect(result.stats.deletions).toBe(1);
    expect(result.stats.additions).toBe(1);
    expect(result.stats.unchanged).toBe(499);
  });

  it('should complete diff in reasonable time', () => {
    const linesA = Array(100).fill('line').map((l, i) => `${l} ${i}`);
    const linesB = Array(100).fill('line').map((l, i) => `${l} ${i + 1}`);

    const start = Date.now();
    const result = diffUtils.api.diff(linesA.join('\n'), linesB.join('\n'));
    const duration = Date.now() - start;

    expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    expect(result).toBeDefined();
  });
});

describe('DiffUtils - Statistics', () => {
  it('should provide accurate statistics', () => {
    const contentA = 'a\nb\nc\nd';
    const contentB = 'a\nX\nc\nY';
    const result = diffUtils.api.diff(contentA, contentB);

    expect(result.stats.additions).toBe(2); // X and Y added
    expect(result.stats.deletions).toBe(2); // b and d deleted
    expect(result.stats.unchanged).toBe(2); // a and c unchanged
  });

  it('should count total changes correctly', () => {
    const contentA = 'line 1\nline 2\nline 3';
    const contentB = 'line 1\nNEW\nline 3\nANOTHER';
    const result = diffUtils.api.diff(contentA, contentB);

    const totalChanges = result.stats.additions + result.stats.deletions;
    expect(totalChanges).toBeGreaterThan(0);
  });
});

describe('DiffUtils - Line Numbers', () => {
  it('should include correct line numbers', () => {
    const contentA = 'line 1\nline 2\nline 3';
    const contentB = 'line 1\nline 3';
    const result = diffUtils.api.diff(contentA, contentB);

    const deletion = result.changes.find(c => c.type === 'deletion' && c.line === 'line 2');
    expect(deletion).toBeDefined();
    expect(deletion.lineNumber).toBe(2);
  });
});

describe('DiffUtils - Web Component Widget', () => {
  it('should export widget configuration', () => {
    expect(diffUtils.widget).toBeDefined();
    expect(diffUtils.widget.element).toBe('diff-utils-widget');
    expect(diffUtils.widget.displayName).toBe('Diff Utilities');
    expect(diffUtils.widget.icon).toBe('📊');
    expect(diffUtils.widget.category).toBe('utility');
  });
});
