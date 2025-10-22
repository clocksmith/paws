/**
 * Utility Function Tests
 *
 * Tests for validation, parsing, and type guard utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  // Validation
  validateCustomElementName,
  validateSemver,
  validateResourceURI,
  validateServerName,
  validateHttpUrl,
  validateEmail,
  matchesPattern,
  matchesAnyPattern,
  validateRange,
  isPlainObject,
  deepMerge,
  deepClone,
  // Parsing
  parseResourceURI,
  buildURI,
  parseEventName,
  buildEventName,
  parsePackageName,
  parseDuration,
  formatDuration,
  parseByteSize,
  formatByteSize,
  getNestedValue,
  setNestedValue,
  // Type guards
  isToolResult,
  isResourceContent,
  isMCPTool,
  isPlainObject as isPlainObjectGuard,
  isValidURL,
  isValidJSON,
  isDefined,
  isEmpty,
  // Event names
  matchesEventPattern,
  getToolEvents,
  isRequestEvent,
  isErrorEvent,
  getCompletionEvent,
  getEventDescription,
} from '../src/index.js';

describe('Validation Utilities', () => {
  describe('validateCustomElementName', () => {
    it('should accept valid custom element names', () => {
      expect(validateCustomElementName('my-widget')).toBe(true);
      expect(validateCustomElementName('github-mcp-widget')).toBe(true);
      expect(validateCustomElementName('x-foo-bar-baz')).toBe(true);
    });

    it('should reject invalid custom element names', () => {
      expect(validateCustomElementName('mywidget')).toBe(false); // No hyphen
      expect(validateCustomElementName('My-Widget')).toBe(false); // Uppercase
      expect(validateCustomElementName('1-widget')).toBe(false); // Starts with number
      expect(validateCustomElementName('-widget')).toBe(false); // Starts with hyphen
    });
  });

  describe('validateSemver', () => {
    it('should accept valid semantic versions', () => {
      expect(validateSemver('1.0.0')).toBe(true);
      expect(validateSemver('0.1.0')).toBe(true);
      expect(validateSemver('1.2.3')).toBe(true);
      expect(validateSemver('1.0.0-alpha')).toBe(true);
      expect(validateSemver('1.0.0+build.123')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(validateSemver('1.0')).toBe(false);
      expect(validateSemver('v1.0.0')).toBe(false);
      expect(validateSemver('1')).toBe(false);
    });
  });

  describe('validateResourceURI', () => {
    it('should accept valid URIs', () => {
      expect(validateResourceURI('file:///path/to/file')).toBe(true);
      expect(validateResourceURI('github://user/repo')).toBe(true);
      expect(validateResourceURI('http://example.com')).toBe(true);
    });

    it('should reject invalid URIs', () => {
      expect(validateResourceURI('not a uri')).toBe(false);
      expect(validateResourceURI('/just/a/path')).toBe(false);
    });
  });

  describe('validateServerName', () => {
    it('should accept valid server names', () => {
      expect(validateServerName('github')).toBe(true);
      expect(validateServerName('my-server')).toBe(true);
      expect(validateServerName('server_123')).toBe(true);
    });

    it('should reject invalid server names', () => {
      expect(validateServerName('My-Server')).toBe(false); // Uppercase
      expect(validateServerName('server name')).toBe(false); // Space
      expect(validateServerName('1server')).toBe(false); // Starts with number
    });
  });

  describe('matchesPattern', () => {
    it('should match simple patterns', () => {
      expect(matchesPattern('github:*', 'github:create_issue')).toBe(true);
      expect(matchesPattern('*:read_*', 'filesystem:read_file')).toBe(true);
    });

    it('should match wildcard patterns', () => {
      expect(matchesPattern('**', 'anything/at/all')).toBe(true);
      expect(matchesPattern('github:**', 'github:repo:issues')).toBe(true);
    });

    it('should not match incorrect patterns', () => {
      expect(matchesPattern('github:*', 'gitlab:create_issue')).toBe(false);
      expect(matchesPattern('*:read_*', 'filesystem:write_file')).toBe(false);
    });
  });

  describe('validateRange', () => {
    it('should validate numeric ranges', () => {
      expect(validateRange(50, 0, 100)).toBe(true);
      expect(validateRange(0, 0, 100)).toBe(true);
      expect(validateRange(100, 0, 100)).toBe(true);
    });

    it('should reject out of range values', () => {
      expect(validateRange(-1, 0, 100)).toBe(false);
      expect(validateRange(101, 0, 100)).toBe(false);
    });
  });

  describe('deepMerge', () => {
    it('should merge objects deeply', () => {
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { d: 4, e: 5 }, f: 6 };
      const result = deepMerge(target, source);

      expect(result).toEqual({ a: 1, b: { c: 2, d: 4, e: 5 }, f: 6 });
    });

    it('should not mutate original objects', () => {
      const target = { a: 1, b: { c: 2 } };
      const source = { b: { d: 3 } };
      const result = deepMerge(target, source);

      expect(target).toEqual({ a: 1, b: { c: 2 } });
      expect(result).not.toBe(target);
    });
  });

  describe('deepClone', () => {
    it('should clone objects deeply', () => {
      const obj = { a: 1, b: { c: 2, d: [3, 4] } };
      const cloned = deepClone(obj);

      expect(cloned).toEqual(obj);
      expect(cloned).not.toBe(obj);
      expect(cloned.b).not.toBe(obj.b);
      expect(cloned.b.d).not.toBe(obj.b.d);
    });

    it('should clone Date objects', () => {
      const date = new Date();
      const cloned = deepClone(date);

      expect(cloned).toEqual(date);
      expect(cloned).not.toBe(date);
    });
  });
});

describe('Parsing Utilities', () => {
  describe('parseResourceURI', () => {
    it('should parse basic URIs', () => {
      const uri = parseResourceURI('file:///path/to/file');

      expect(uri.scheme).toBe('file');
      expect(uri.path).toBe('/path/to/file');
    });

    it('should parse URIs with query parameters', () => {
      const uri = parseResourceURI('github://repo?branch=main&path=src');

      expect(uri.scheme).toBe('github');
      expect(uri.path).toBe('repo');
      expect(uri.query).toEqual({ branch: 'main', path: 'src' });
    });

    it('should parse URIs with fragments', () => {
      const uri = parseResourceURI('file:///doc.md#section-1');

      expect(uri.scheme).toBe('file');
      expect(uri.path).toBe('/doc.md');
      expect(uri.fragment).toBe('section-1');
    });
  });

  describe('buildURI', () => {
    it('should build URIs from components', () => {
      const uri = buildURI({
        scheme: 'file',
        path: '/path/to/file',
      });

      expect(uri).toBe('file://%2Fpath%2Fto%2Ffile');
    });

    it('should build URIs with query parameters', () => {
      const uri = buildURI({
        scheme: 'github',
        path: 'repo',
        query: { branch: 'main' },
      });

      expect(uri).toContain('?branch=main');
    });
  });

  describe('parseEventName', () => {
    it('should parse event names correctly', () => {
      const event = parseEventName('mcp:tool:invoked');

      expect(event.namespace).toBe('mcp');
      expect(event.category).toBe('tool');
      expect(event.action).toBe('invoked');
    });

    it('should throw on invalid event names', () => {
      expect(() => parseEventName('invalid')).toThrow();
      expect(() => parseEventName('mcp:tool')).toThrow();
    });
  });

  describe('buildEventName', () => {
    it('should build event names from components', () => {
      const eventName = buildEventName({
        namespace: 'mcp',
        category: 'tool',
        action: 'invoked',
      });

      expect(eventName).toBe('mcp:tool:invoked');
    });
  });

  describe('parsePackageName', () => {
    it('should parse scoped package names', () => {
      const pkg = parsePackageName('@mcp-wp/widget-github');

      expect(pkg.scope).toBe('mcp-wp');
      expect(pkg.name).toBe('widget-github');
    });

    it('should parse unscoped package names', () => {
      const pkg = parsePackageName('my-package');

      expect(pkg.scope).toBeUndefined();
      expect(pkg.name).toBe('my-package');
    });
  });

  describe('parseDuration / formatDuration', () => {
    it('should parse duration strings', () => {
      expect(parseDuration('5s')).toBe(5000);
      expect(parseDuration('10m')).toBe(600000);
      expect(parseDuration('1h')).toBe(3600000);
    });

    it('should format durations', () => {
      expect(formatDuration(500)).toBe('500ms');
      expect(formatDuration(5000)).toBe('5.0s');
      expect(formatDuration(60000)).toBe('1.0m');
    });

    it('should round-trip correctly', () => {
      const durations = ['5s', '10m', '1h'];
      for (const duration of durations) {
        const ms = parseDuration(duration);
        const formatted = formatDuration(ms);
        expect(parseDuration(formatted)).toBe(ms);
      }
    });
  });

  describe('parseByteSize / formatByteSize', () => {
    it('should parse byte size strings', () => {
      expect(parseByteSize('1KB')).toBe(1024);
      expect(parseByteSize('5MB')).toBe(5 * 1024 * 1024);
      expect(parseByteSize('1GB')).toBe(1024 * 1024 * 1024);
    });

    it('should format byte sizes', () => {
      expect(formatByteSize(512)).toBe('512B');
      expect(formatByteSize(1024)).toBe('1.0KB');
      expect(formatByteSize(1024 * 1024)).toBe('1.0MB');
    });
  });

  describe('getNestedValue / setNestedValue', () => {
    it('should get nested values', () => {
      const obj = { a: { b: { c: 123 } } };

      expect(getNestedValue(obj, 'a.b.c')).toBe(123);
      expect(getNestedValue(obj, 'a.b')).toEqual({ c: 123 });
    });

    it('should return undefined for missing paths', () => {
      const obj = { a: { b: 123 } };

      expect(getNestedValue(obj, 'a.c')).toBeUndefined();
      expect(getNestedValue(obj, 'x.y.z')).toBeUndefined();
    });

    it('should set nested values', () => {
      const obj = {};

      setNestedValue(obj, 'a.b.c', 123);

      expect(obj).toEqual({ a: { b: { c: 123 } } });
    });
  });
});

describe('Type Guards', () => {
  describe('isToolResult', () => {
    it('should identify valid tool results', () => {
      expect(isToolResult({ content: [] })).toBe(true);
      expect(isToolResult({ content: [], isError: false })).toBe(true);
    });

    it('should reject invalid tool results', () => {
      expect(isToolResult(null)).toBe(false);
      expect(isToolResult({ content: 'not an array' })).toBe(false);
      expect(isToolResult({})).toBe(false);
    });
  });

  describe('isResourceContent', () => {
    it('should identify valid resource content', () => {
      expect(isResourceContent({ uri: 'file:///test' })).toBe(true);
      expect(isResourceContent({ uri: 'file:///test', text: 'content' })).toBe(true);
    });

    it('should reject invalid resource content', () => {
      expect(isResourceContent({})).toBe(false);
      expect(isResourceContent({ uri: 123 })).toBe(false);
    });
  });

  describe('isMCPTool', () => {
    it('should identify valid MCP tools', () => {
      expect(isMCPTool({
        name: 'create_issue',
        inputSchema: { type: 'object' },
      })).toBe(true);
    });

    it('should reject invalid tools', () => {
      expect(isMCPTool({ name: 'test' })).toBe(false);
      expect(isMCPTool({ inputSchema: {} })).toBe(false);
    });
  });

  describe('isPlainObject', () => {
    it('should identify plain objects', () => {
      expect(isPlainObjectGuard({})).toBe(true);
      expect(isPlainObjectGuard({ a: 1 })).toBe(true);
    });

    it('should reject non-plain objects', () => {
      expect(isPlainObjectGuard(null)).toBe(false);
      expect(isPlainObjectGuard([])).toBe(false);
      expect(isPlainObjectGuard(new Date())).toBe(false);
    });
  });

  describe('isEmpty', () => {
    it('should identify empty values', () => {
      expect(isEmpty(null)).toBe(true);
      expect(isEmpty(undefined)).toBe(true);
      expect(isEmpty('')).toBe(true);
      expect(isEmpty([])).toBe(true);
      expect(isEmpty({})).toBe(true);
    });

    it('should reject non-empty values', () => {
      expect(isEmpty('text')).toBe(false);
      expect(isEmpty([1])).toBe(false);
      expect(isEmpty({ a: 1 })).toBe(false);
      expect(isEmpty(0)).toBe(false);
    });
  });

  describe('isDefined', () => {
    it('should identify defined values', () => {
      expect(isDefined(0)).toBe(true);
      expect(isDefined('')).toBe(true);
      expect(isDefined(false)).toBe(true);
    });

    it('should reject null and undefined', () => {
      expect(isDefined(null)).toBe(false);
      expect(isDefined(undefined)).toBe(false);
    });
  });
});

describe('Event Name Utilities', () => {
  describe('matchesEventPattern', () => {
    it('should match exact event names', () => {
      expect(matchesEventPattern('mcp:tool:invoked', 'mcp:tool:invoked')).toBe(true);
    });

    it('should match wildcard patterns', () => {
      expect(matchesEventPattern('mcp:tool:invoked', 'mcp:tool:*')).toBe(true);
      expect(matchesEventPattern('mcp:tool:invoked', 'mcp:*:*')).toBe(true);
      expect(matchesEventPattern('mcp:tool:invoked', '*:*:*')).toBe(true);
    });

    it('should not match incorrect patterns', () => {
      expect(matchesEventPattern('mcp:tool:invoked', 'widget:*:*')).toBe(false);
      expect(matchesEventPattern('mcp:tool:invoked', 'mcp:resource:*')).toBe(false);
    });
  });

  describe('getToolEvents', () => {
    it('should return all tool events', () => {
      const events = getToolEvents();

      expect(events).toContain('mcp:tool:invoked');
      expect(events).toContain('mcp:tool:error');
      expect(events.length).toBeGreaterThan(0);
    });
  });

  describe('isRequestEvent', () => {
    it('should identify request events', () => {
      expect(isRequestEvent('mcp:tool:invoke-requested')).toBe(true);
      expect(isRequestEvent('mcp:resource:read-requested')).toBe(true);
    });

    it('should reject non-request events', () => {
      expect(isRequestEvent('mcp:tool:invoked')).toBe(false);
      expect(isRequestEvent('mcp:tool:error')).toBe(false);
    });
  });

  describe('isErrorEvent', () => {
    it('should identify error events', () => {
      expect(isErrorEvent('mcp:tool:error')).toBe(true);
      expect(isErrorEvent('widget:error')).toBe(true);
    });

    it('should reject non-error events', () => {
      expect(isErrorEvent('mcp:tool:invoked')).toBe(false);
    });
  });

  describe('getCompletionEvent', () => {
    it('should return completion events for requests', () => {
      expect(getCompletionEvent('mcp:tool:invoke-requested')).toBe('mcp:tool:invoked');
      expect(getCompletionEvent('mcp:resource:read-requested')).toBe('mcp:resource:read');
    });

    it('should return undefined for non-request events', () => {
      expect(getCompletionEvent('mcp:tool:invoked')).toBeUndefined();
    });
  });

  describe('getEventDescription', () => {
    it('should return descriptions for known events', () => {
      const description = getEventDescription('mcp:tool:invoked');

      expect(description).toBeTruthy();
      expect(description).not.toBe('Unknown event');
    });
  });
});
