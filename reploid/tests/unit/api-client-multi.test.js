import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApiClientMulti from '../../upgrades/api-client-multi.js';

describe('ApiClientMulti Module', () => {
  let mockConfig, mockUtils, mockStateManager, mockDeps;
  let client;

  beforeEach(() => {
    global.fetch = vi.fn();

    mockConfig = {
      apiProvider: null,
      apiKey: 'test-key'
    };

    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      },
      Errors: {
        ApiError: class ApiError extends Error {
          constructor(message, statusCode) {
            super(message);
            this.statusCode = statusCode;
          }
        },
        AbortError: class AbortError extends Error {}
      },
      sanitizeLlmJsonRespPure: vi.fn((text) => ({ sanitizedJson: text }))
    };

    mockStateManager = {
      getState: vi.fn(() => ({})),
      updateState: vi.fn()
    };

    mockDeps = {
      config: mockConfig,
      Utils: mockUtils,
      StateManager: mockStateManager
    };

    client = ApiClientMulti.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ApiClientMulti.metadata.id).toBe('ApiClientMulti');
      expect(ApiClientMulti.metadata.version).toBe('2.0.0');
      expect(ApiClientMulti.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(ApiClientMulti.metadata.dependencies).toContain('config');
      expect(ApiClientMulti.metadata.dependencies).toContain('Utils');
      expect(ApiClientMulti.metadata.dependencies).toContain('StateManager');
    });
  });

  describe('Initialization', () => {
    it('should throw error if dependencies missing', () => {
      expect(() => {
        ApiClientMulti.factory({ config: null, Utils: mockUtils, StateManager: mockStateManager });
      }).toThrow('Missing required dependencies');
    });

    it('should initialize with default provider', () => {
      expect(client.api.getCurrentProvider()).toBe('gemini');
    });
  });

  describe('Provider Management', () => {
    it('should set provider', () => {
      client.api.setProvider('openai');
      expect(client.api.getCurrentProvider()).toBe('openai');
    });

    it('should get current provider', () => {
      const provider = client.api.getCurrentProvider();
      expect(typeof provider).toBe('string');
    });

    it('should check proxy availability', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          providers: {
            gemini: true,
            openai: true
          }
        })
      });

      const status = await client.api.checkProxyAvailability();

      expect(status).toBeDefined();
      expect(status.providers).toBeDefined();
    });

    it('should handle proxy unavailable', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const status = await client.api.checkProxyAvailability();

      expect(status).toBeNull();
      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Proxy not available')
      );
    });

    it('should auto-select provider when proxy available', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          providers: {
            openai: true,
            anthropic: true
          }
        })
      });

      await client.api.checkProxyAvailability();

      // Should auto-select first available
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Auto-selected provider')
      );
    });

    it('should get available providers', async () => {
      const providers = await client.api.getAvailableProviders();

      expect(Array.isArray(providers)).toBe(true);
    });
  });

  describe('API Calls', () => {
    beforeEach(() => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Response text' }]
            }
          }],
          usageMetadata: {
            promptTokenCount: 10,
            candidatesTokenCount: 20
          }
        })
      });
    });

    it('should call API successfully', async () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ];

      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(response).toBeDefined();
      expect(response.content).toBeDefined();
    });

    it('should retry on 429 rate limit', async () => {
      global.fetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          json: async () => ({ error: { message: 'Rate limit' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{
              content: { parts: [{ text: 'Success' }] }
            }],
            usageMetadata: {}
          })
        });

      const messages = [{ role: 'user', content: 'Test' }];

      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(response.content).toBeDefined();
    });

    it('should throw after max retries', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { message: 'Server error' } })
      });

      const messages = [{ role: 'user', content: 'Test' }];

      await expect(
        client.api.callApiWithRetry(messages, 'test-key', [], { maxRetries: 1 })
      ).rejects.toThrow();
    });

    it('should abort current call', () => {
      client.api.abortCurrentCall();

      // Should not throw
      expect(mockUtils.logger.info).toHaveBeenCalled();
    });

    it('should sanitize JSON response', () => {
      const result = client.api.sanitizeLlmJsonResp('{"key": "value"}');

      expect(mockUtils.sanitizeLlmJsonRespPure).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('Multi-Provider Support', () => {
    it('should handle Gemini format', async () => {
      client.api.setProvider('gemini');

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Gemini response' }]
            }
          }],
          usageMetadata: {}
        })
      });

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(response).toBeDefined();
    });

    it('should handle OpenAI format', async () => {
      client.api.setProvider('openai');

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: { content: 'OpenAI response' }
          }],
          usage: {
            prompt_tokens: 10,
            completion_tokens: 20
          }
        })
      });

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(response).toBeDefined();
    });

    it('should handle Anthropic format', async () => {
      client.api.setProvider('anthropic');

      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: [{ text: 'Anthropic response' }],
          usage: {
            input_tokens: 10,
            output_tokens: 20
          }
        })
      });

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(response).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      global.fetch.mockRejectedValue(new Error('Network error'));

      const messages = [{ role: 'user', content: 'Test' }];

      await expect(
        client.api.callApiWithRetry(messages, 'test-key', [], { maxRetries: 0 })
      ).rejects.toThrow();
    });

    it('should handle API errors', async () => {
      global.fetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: 'Bad request' }
        })
      });

      const messages = [{ role: 'user', content: 'Test' }];

      await expect(
        client.api.callApiWithRetry(messages, 'test-key', [], { maxRetries: 0 })
      ).rejects.toThrow();
    });

    it('should handle missing API key', async () => {
      const messages = [{ role: 'user', content: 'Test' }];

      await expect(
        client.api.callApiWithRetry(messages, null)
      ).rejects.toThrow();
    });
  });

  describe('Function Calling', () => {
    it('should handle function declarations', async () => {
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                functionCall: {
                  name: 'test_function',
                  args: { param: 'value' }
                }
              }]
            }
          }],
          usageMetadata: {}
        })
      });

      const messages = [{ role: 'user', content: 'Call function' }];
      const funcDecls = [{
        name: 'test_function',
        description: 'Test function',
        parameters: {}
      }];

      const response = await client.api.callApiWithRetry(messages, 'test-key', funcDecls);

      expect(response).toBeDefined();
    });
  });

  describe('Retry Logic', () => {
    it('should use exponential backoff', async () => {
      let attempts = 0;
      global.fetch.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ error: { message: 'Error' } })
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [{ content: { parts: [{ text: 'Success' }] } }],
            usageMetadata: {}
          })
        });
      });

      const messages = [{ role: 'user', content: 'Test' }];
      const response = await client.api.callApiWithRetry(messages, 'test-key');

      expect(attempts).toBeGreaterThan(1);
      expect(response).toBeDefined();
    });
  });
});
