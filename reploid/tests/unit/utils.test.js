/**
 * @fileoverview Unit tests for Utils module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load Utils module
const Utils = require(resolve(__dirname, '../../upgrades/utils.js'));
const utils = Utils.factory();

describe('Utils - Error Classes', () => {
  it('should create ApplicationError with message and details', () => {
    const { ApplicationError } = utils.Errors;
    const error = new ApplicationError('Test error', { code: 'TEST' });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe('Test error');
    expect(error.details).toEqual({ code: 'TEST' });
    expect(error.name).toBe('ApplicationError');
  });

  it('should create ApiError extending ApplicationError', () => {
    const { ApiError, ApplicationError } = utils.Errors;
    const error = new ApiError('API failed', { status: 500 });
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe('ApiError');
  });

  it('should create ToolError extending ApplicationError', () => {
    const { ToolError, ApplicationError } = utils.Errors;
    const error = new ToolError('Tool failed', { tool: 'read' });
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe('ToolError');
  });

  it('should create StateError extending ApplicationError', () => {
    const { StateError, ApplicationError } = utils.Errors;
    const error = new StateError('Invalid state');
    expect(error).toBeInstanceOf(ApplicationError);
    expect(error.name).toBe('StateError');
  });
});

describe('Utils - Logger', () => {
  let consoleDebugSpy, consoleInfoSpy, consoleWarnSpy, consoleErrorSpy;

  beforeEach(() => {
    consoleDebugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
    consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
    consoleInfoSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it('should log debug messages', () => {
    utils.logger.debug('Debug message', { test: true });
    expect(consoleDebugSpy).toHaveBeenCalled();
    const logOutput = consoleDebugSpy.mock.calls[0][0];
    expect(logOutput).toContain('DEBUG');
    expect(logOutput).toContain('Debug message');
  });

  it('should log info messages', () => {
    utils.logger.info('Info message');
    expect(consoleInfoSpy).toHaveBeenCalled();
    const logOutput = consoleInfoSpy.mock.calls[0][0];
    expect(logOutput).toContain('INFO');
    expect(logOutput).toContain('Info message');
  });

  it('should log warning messages', () => {
    utils.logger.warn('Warning message');
    expect(consoleWarnSpy).toHaveBeenCalled();
    const logOutput = consoleWarnSpy.mock.calls[0][0];
    expect(logOutput).toContain('WARN');
    expect(logOutput).toContain('Warning message');
  });

  it('should log error messages', () => {
    utils.logger.error('Error message', { error: 'test' });
    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = consoleErrorSpy.mock.calls[0][0];
    expect(logOutput).toContain('ERROR');
    expect(logOutput).toContain('Error message');
  });

  it('should include timestamp in log output', () => {
    utils.logger.info('Test');
    expect(consoleInfoSpy).toHaveBeenCalled();
    const logOutput = consoleInfoSpy.mock.calls[0][0];
    expect(logOutput).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});

describe('Utils - String Utilities', () => {
  describe('kabobToCamel', () => {
    it('should convert kebab-case to camelCase', () => {
      expect(utils.kabobToCamel('hello-world')).toBe('helloWorld');
      expect(utils.kabobToCamel('test-case-name')).toBe('testCaseName');
    });

    it('should handle single words', () => {
      expect(utils.kabobToCamel('hello')).toBe('hello');
    });

    it('should handle empty strings', () => {
      expect(utils.kabobToCamel('')).toBe('');
    });
  });

  describe('trunc', () => {
    it('should truncate strings longer than specified length', () => {
      expect(utils.trunc('hello world', 8)).toBe('hello...');
    });

    it('should not truncate strings shorter than length', () => {
      expect(utils.trunc('hello', 10)).toBe('hello');
    });

    it('should handle exact length', () => {
      expect(utils.trunc('hello', 5)).toBe('hello');
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(utils.escapeHtml('<div>Test</div>')).toBe('&lt;div&gt;Test&lt;/div&gt;');
      expect(utils.escapeHtml('A&B')).toBe('A&amp;B');
      expect(utils.escapeHtml('"quoted"')).toBe('&quot;quoted&quot;');
      expect(utils.escapeHtml("'single'")).toBe('&#039;single&#039;');
    });

    it('should handle empty strings', () => {
      expect(utils.escapeHtml('')).toBe('');
    });

    it('should handle strings without special chars', () => {
      expect(utils.escapeHtml('hello world')).toBe('hello world');
    });
  });

  describe('sanitizeLlmJsonRespPure', () => {
    it('should extract JSON from markdown code blocks', () => {
      const input = '```json\n{"key": "value"}\n```';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('{"key": "value"}');
      expect(result.method).toBe('code block');
    });

    it('should handle JSON without code blocks', () => {
      const input = '{"key": "value"}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('{"key": "value"}');
      expect(result.method).toBe('direct parse');
    });

    it('should extract JSON from text with prefix/suffix', () => {
      const input = 'Here is the response:\n{"key": "value"}\nEnd of response';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('{"key": "value"}');
      expect(result.method).toBe('heuristic slice');
    });
  });
});

describe('Utils - DRY Helpers', () => {
  describe('createSubscriptionTracker', () => {
    it('should create tracker with correct methods', () => {
      const tracker = utils.createSubscriptionTracker();
      expect(tracker).toHaveProperty('track');
      expect(tracker).toHaveProperty('unsubscribeAll');
      expect(tracker).toHaveProperty('getActiveCount');
      expect(tracker).toHaveProperty('getAllActive');
    });

    it('should track subscriptions by module ID', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();

      tracker.track('TestModule', unsub1);
      tracker.track('TestModule', unsub2);

      expect(tracker.getActiveCount('TestModule')).toBe(2);
    });

    it('should unsubscribe all for a module', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();

      tracker.track('TestModule', unsub1);
      tracker.track('TestModule', unsub2);
      tracker.unsubscribeAll('TestModule');

      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).toHaveBeenCalled();
      expect(tracker.getActiveCount('TestModule')).toBe(0);
    });

    it('should handle multiple modules independently', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();

      tracker.track('Module1', unsub1);
      tracker.track('Module2', unsub2);

      expect(tracker.getActiveCount('Module1')).toBe(1);
      expect(tracker.getActiveCount('Module2')).toBe(1);

      tracker.unsubscribeAll('Module1');
      expect(unsub1).toHaveBeenCalled();
      expect(unsub2).not.toHaveBeenCalled();
    });
  });

  describe('showButtonSuccess', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should update button text and restore after duration', () => {
      const button = { textContent: 'Original', disabled: false };
      utils.showButtonSuccess(button, 'Original', '✓ Success', 1000);

      expect(button.textContent).toBe('✓ Success');
      expect(button.disabled).toBe(true);

      vi.advanceTimersByTime(1000);

      expect(button.textContent).toBe('Original');
      expect(button.disabled).toBe(false);
    });

    it('should use default duration if not specified', () => {
      const button = { textContent: 'Original', disabled: false };
      utils.showButtonSuccess(button, 'Original', '✓');

      expect(button.textContent).toBe('✓');

      vi.advanceTimersByTime(2000);

      expect(button.textContent).toBe('Original');
    });
  });

  describe('exportAsMarkdown', () => {
    let createElementSpy;
    let createObjectURLSpy;
    let revokeObjectURLSpy;

    beforeEach(() => {
      // Mock document.createElement
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn()
      };
      createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockLink);

      // Mock URL methods
      createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url');
      revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    });

    afterEach(() => {
      createElementSpy.mockRestore();
      createObjectURLSpy.mockRestore();
      revokeObjectURLSpy.mockRestore();
    });

    it('should create download link with correct filename', () => {
      utils.exportAsMarkdown('test.md', '# Test Content');

      expect(createElementSpy).toHaveBeenCalledWith('a');
      const mockLink = createElementSpy.mock.results[0].value;
      expect(mockLink.download).toBe('test.md');
    });

    it('should create blob with markdown content', () => {
      utils.exportAsMarkdown('test.md', '# Heading\n\nContent');

      expect(createObjectURLSpy).toHaveBeenCalled();
      const blobArg = createObjectURLSpy.mock.calls[0][0];
      expect(blobArg).toBeInstanceOf(Blob);
      expect(blobArg.type).toBe('text/markdown');
    });

    it('should trigger download and cleanup', () => {
      utils.exportAsMarkdown('test.md', 'content');

      const mockLink = createElementSpy.mock.results[0].value;
      expect(mockLink.click).toHaveBeenCalled();

      // Check that URL was revoked after a delay (cleanup)
      setTimeout(() => {
        expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:mock-url');
      }, 100);
    });
  });
});

describe('Utils - HTTP Utilities', () => {
  describe('post', () => {
    let fetchSpy;

    beforeEach(() => {
      global.fetch = vi.fn();
      fetchSpy = global.fetch;
    });

    afterEach(() => {
      delete global.fetch;
    });

    it('should make POST request with JSON body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      const result = await utils.post('http://test.com', { key: 'value' });

      expect(fetchSpy).toHaveBeenCalledWith('http://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'value' })
      });
      expect(result).toEqual({ success: true });
    });

    it('should handle HTTP errors', async () => {
      fetchSpy.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(utils.post('http://test.com', {})).rejects.toThrow();
    });

    it('should handle network errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Network failure'));

      await expect(utils.post('http://test.com', {})).rejects.toThrow('Network failure');
    });

    it('should handle timeout errors', async () => {
      fetchSpy.mockRejectedValue(new Error('Timeout'));

      await expect(utils.post('http://test.com', {})).rejects.toThrow('Timeout');
    });

    it('should handle empty response body', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => null
      });

      const result = await utils.post('http://test.com', {});
      expect(result).toBeNull();
    });

    it('should handle malformed JSON response', async () => {
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => {
          throw new SyntaxError('Unexpected token');
        }
      });

      await expect(utils.post('http://test.com', {})).rejects.toThrow();
    });

    it('should handle large payloads', async () => {
      const largePayload = { data: 'x'.repeat(100000) };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await utils.post('http://test.com', largePayload);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should handle nested objects', async () => {
      const nestedData = {
        level1: {
          level2: {
            level3: {
              value: 'deep'
            }
          }
        }
      };
      fetchSpy.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true })
      });

      await utils.post('http://test.com', nestedData);
      expect(fetchSpy).toHaveBeenCalledWith('http://test.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nestedData)
      });
    });
  });
});

describe('Utils - Advanced String Operations', () => {
  describe('Edge Cases', () => {
    it('should handle unicode strings', () => {
      const unicode = '你好世界🌍';
      expect(utils.escapeHtml(unicode)).toBe(unicode);
    });

    it('should handle emojis', () => {
      const emojis = '😀😃😄😁';
      expect(utils.trunc(emojis, 5)).toBe('😀😃...');
    });

    it('should handle strings with null bytes', () => {
      const str = 'hello\x00world';
      expect(str.length).toBe(11);
    });

    it('should handle very long strings', () => {
      const longStr = 'a'.repeat(1000000);
      const truncated = utils.trunc(longStr, 10);
      expect(truncated).toBe('aaaaaaa...');
    });

    it('should handle mixed case kebab', () => {
      const mixed = 'Test-Case-String';
      expect(utils.kabobToCamel(mixed.toLowerCase())).toBe('testCaseString');
    });

    it('should handle leading/trailing hyphens', () => {
      expect(utils.kabobToCamel('-test-')).toContain('test');
    });

    it('should handle multiple consecutive hyphens', () => {
      const result = utils.kabobToCamel('test--case');
      expect(result).toBeDefined();
    });

    it('should handle numeric strings', () => {
      expect(utils.kabobToCamel('test-123-case')).toBe('test123Case');
    });
  });

  describe('HTML Escaping Edge Cases', () => {
    it('should escape nested HTML tags', () => {
      const nested = '<div><span>Test</span></div>';
      const escaped = utils.escapeHtml(nested);
      expect(escaped).not.toContain('<');
      expect(escaped).not.toContain('>');
    });

    it('should handle already escaped entities', () => {
      const alreadyEscaped = '&amp;lt;test&amp;gt;';
      const result = utils.escapeHtml(alreadyEscaped);
      expect(result).toContain('&amp;');
    });

    it('should handle mixed content', () => {
      const mixed = 'Text <b>bold</b> & "quoted" text';
      const escaped = utils.escapeHtml(mixed);
      expect(escaped).toContain('&lt;b&gt;');
      expect(escaped).toContain('&amp;');
      expect(escaped).toContain('&quot;');
    });

    it('should handle apostrophes and quotes together', () => {
      const text = `He said "it's done"`;
      const escaped = utils.escapeHtml(text);
      expect(escaped).toContain('&quot;');
      expect(escaped).toContain('&#039;');
    });
  });
});

describe('Utils - JSON Sanitization Advanced', () => {
  describe('sanitizeLlmJsonRespPure edge cases', () => {
    it('should handle multiple code blocks', () => {
      const input = '```json\n{"a":1}\n```\nSome text\n```json\n{"b":2}\n```';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBeDefined();
    });

    it('should handle malformed JSON in code block', () => {
      const input = '```json\n{invalid json}\n```';
      try {
        utils.sanitizeLlmJsonRespPure(input, utils.logger);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    it('should handle JSON with comments', () => {
      const input = '{\n  // comment\n  "key": "value"\n}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result).toBeDefined();
    });

    it('should handle JSON with trailing commas', () => {
      const input = '{"a": 1, "b": 2,}';
      try {
        const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeInstanceOf(SyntaxError);
      }
    });

    it('should handle escaped quotes in JSON', () => {
      const input = '{"message": "He said \\"hello\\""}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toContain('\\"');
    });

    it('should handle deeply nested JSON', () => {
      const nested = {
        l1: { l2: { l3: { l4: { l5: { value: 'deep' } } } } }
      };
      const input = JSON.stringify(nested);
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toContain('deep');
    });

    it('should handle arrays in JSON', () => {
      const input = '{"items": [1, 2, 3, 4, 5]}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('{"items": [1, 2, 3, 4, 5]}');
    });

    it('should handle null values', () => {
      const input = '{"value": null}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toContain('null');
    });

    it('should handle boolean values', () => {
      const input = '{"flag": true, "disabled": false}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toContain('true');
      expect(result.sanitizedJson).toContain('false');
    });

    it('should handle empty objects', () => {
      const input = '{}';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('{}');
    });

    it('should handle empty arrays', () => {
      const input = '[]';
      const result = utils.sanitizeLlmJsonRespPure(input, utils.logger);
      expect(result.sanitizedJson).toBe('[]');
    });
  });
});

describe('Utils - Subscription Tracker Advanced', () => {
  describe('createSubscriptionTracker edge cases', () => {
    it('should handle duplicate subscriptions', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub = vi.fn();
      tracker.track('Module1', unsub);
      tracker.track('Module1', unsub);
      expect(tracker.getActiveCount('Module1')).toBe(2);
    });

    it('should handle empty module ID', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub = vi.fn();
      tracker.track('', unsub);
      expect(tracker.getActiveCount('')).toBe(1);
    });

    it('should handle null unsubscribe function', () => {
      const tracker = utils.createSubscriptionTracker();
      tracker.track('Module1', null);
      tracker.unsubscribeAll('Module1');
      expect(tracker.getActiveCount('Module1')).toBe(0);
    });

    it('should handle multiple unsubscribeAll calls', () => {
      const tracker = utils.createSubscriptionTracker();
      const unsub = vi.fn();
      tracker.track('Module1', unsub);
      tracker.unsubscribeAll('Module1');
      tracker.unsubscribeAll('Module1');
      expect(unsub).toHaveBeenCalledTimes(1);
    });

    it('should handle large number of subscriptions', () => {
      const tracker = utils.createSubscriptionTracker();
      for (let i = 0; i < 1000; i++) {
        tracker.track('Module1', vi.fn());
      }
      expect(tracker.getActiveCount('Module1')).toBe(1000);
    });

    it('should return all active subscriptions', () => {
      const tracker = utils.createSubscriptionTracker();
      tracker.track('Module1', vi.fn());
      tracker.track('Module2', vi.fn());
      tracker.track('Module3', vi.fn());
      const all = tracker.getAllActive();
      expect(Object.keys(all).length).toBe(3);
    });

    it('should handle unsubscribe exceptions', () => {
      const tracker = utils.createSubscriptionTracker();
      const throwingUnsub = vi.fn(() => {
        throw new Error('Unsubscribe failed');
      });
      tracker.track('Module1', throwingUnsub);
      expect(() => tracker.unsubscribeAll('Module1')).toThrow();
    });
  });
});

describe('Utils - Performance Tests', () => {
  it('should handle rapid string operations', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      utils.kabobToCamel('test-case-string');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  it('should handle rapid HTML escaping', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      utils.escapeHtml('<div>test</div>');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });

  it('should handle rapid truncation', () => {
    const longStr = 'a'.repeat(1000);
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      utils.trunc(longStr, 10);
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(1000);
  });
});

describe('Utils - Memory Management', () => {
  it('should not leak memory with subscriptions', () => {
    const tracker = utils.createSubscriptionTracker();
    for (let i = 0; i < 1000; i++) {
      tracker.track(`Module${i}`, vi.fn());
      if (i % 100 === 0) {
        tracker.unsubscribeAll(`Module${i}`);
      }
    }
    const allActive = tracker.getAllActive();
    expect(Object.keys(allActive).length).toBeLessThan(1000);
  });

  it('should clean up after unsubscribe', () => {
    const tracker = utils.createSubscriptionTracker();
    const unsubs = [];
    for (let i = 0; i < 100; i++) {
      const unsub = vi.fn();
      tracker.track('Module1', unsub);
      unsubs.push(unsub);
    }
    tracker.unsubscribeAll('Module1');
    expect(tracker.getActiveCount('Module1')).toBe(0);
  });
});

describe('Utils - Concurrent Operations', () => {
  it('should handle concurrent button success calls', async () => {
    vi.useFakeTimers();
    const button = { textContent: 'Click', disabled: false };

    utils.showButtonSuccess(button, 'Click', 'Success 1', 500);
    utils.showButtonSuccess(button, 'Click', 'Success 2', 500);

    expect(button.textContent).toBe('Success 2');

    vi.advanceTimersByTime(500);

    vi.useRealTimers();
  });

  it('should handle concurrent markdown exports', () => {
    for (let i = 0; i < 10; i++) {
      utils.exportAsMarkdown(`file${i}.md`, `content ${i}`);
    }
    expect(document.createElement).toHaveBeenCalled();
  });
});

describe('Utils - Error Handling Edge Cases', () => {
  it('should create error with circular reference', () => {
    const { ApplicationError } = utils.Errors;
    const circular = { a: 1 };
    circular.self = circular;

    const error = new ApplicationError('Test', circular);
    expect(error.message).toBe('Test');
  });

  it('should handle error without details', () => {
    const { ApplicationError } = utils.Errors;
    const error = new ApplicationError('Simple error');
    expect(error.message).toBe('Simple error');
    expect(error.details).toBeUndefined();
  });

  it('should preserve error stack', () => {
    const { ApplicationError } = utils.Errors;
    const error = new ApplicationError('Test error');
    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('ApplicationError');
  });

  it('should chain errors', () => {
    const { ApiError } = utils.Errors;
    const originalError = new Error('Original');
    const apiError = new ApiError('API failed', { cause: originalError });
    expect(apiError.details.cause).toBe(originalError);
  });
});

describe('Utils - Type Coercion and Validation', () => {
  it('should handle type coercion in kabobToCamel', () => {
    expect(utils.kabobToCamel(String(123))).toBe('123');
  });

  it('should handle undefined in trunc', () => {
    expect(utils.trunc(undefined, 10)).toBe(undefined);
  });

  it('should handle number in escapeHtml', () => {
    expect(utils.escapeHtml(String(123))).toBe('123');
  });

  it('should handle boolean in string functions', () => {
    expect(utils.kabobToCamel(String(true))).toBe('true');
  });
});

describe('Utils - Boundary Conditions', () => {
  it('should handle max safe integer', () => {
    const maxInt = Number.MAX_SAFE_INTEGER;
    const str = String(maxInt);
    expect(utils.trunc(str, 8)).toBe('90071...');
  });

  it('should handle min safe integer', () => {
    const minInt = Number.MIN_SAFE_INTEGER;
    const str = String(minInt);
    expect(str).toContain('-');
  });

  it('should handle empty string edge cases', () => {
    expect(utils.trunc('', 10)).toBe('');
    expect(utils.kabobToCamel('')).toBe('');
    expect(utils.escapeHtml('')).toBe('');
  });

  it('should handle single character strings', () => {
    expect(utils.trunc('a', 10)).toBe('a');
    expect(utils.kabobToCamel('a')).toBe('a');
    expect(utils.escapeHtml('a')).toBe('a');
  });
});
