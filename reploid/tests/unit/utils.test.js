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
  });
});
