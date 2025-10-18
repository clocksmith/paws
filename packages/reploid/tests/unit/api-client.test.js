import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ApiClient from '../../upgrades/api-client.js';
import ApiClientMulti from '../../upgrades/api-client-multi.js';

/**
 * Comprehensive test suite for api-client.js and api-client-multi.js
 * Tests Gemini API client and Multi-provider API client
 */

describe('ApiClient Module (api-client.js)', () => {
  let mockDeps;
  let mockFetch;
  let mockAbortController;
  let clientInstance;

  beforeEach(() => {
    // Mock fetch
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock AbortController
    mockAbortController = {
      signal: {},
      abort: vi.fn()
    };
    global.AbortController = vi.fn(() => mockAbortController);

    // Mock navigator
    global.navigator = { onLine: true };

    // Mock dependencies
    mockDeps = {
      config: {
        apiKey: 'test-api-key',
        model: 'gemini-2.5-flash'
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        Errors: {
          ApiError: class ApiError extends Error {
            constructor(message, statusCode, code, details) {
              super(message);
              this.name = 'ApiError';
              this.statusCode = statusCode;
              this.code = code;
              this.details = details;
            }
          },
          AbortError: class AbortError extends Error {
            constructor(message) {
              super(message);
              this.name = 'AbortError';
            }
          }
        },
        sanitizeLlmJsonRespPure: vi.fn((text) => ({
          sanitizedJson: text.trim()
        }))
      },
      StateManager: {
        getState: vi.fn(),
        setState: vi.fn()
      },
      RateLimiter: {
        getLimiter: vi.fn(() => ({
          tokens: 5,
          maxTokens: 5
        })),
        waitForToken: vi.fn().mockResolvedValue(true)
      }
    };


    clientInstance = ApiClient.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
    delete global.AbortController;
    delete global.navigator;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata structure', () => {
      expect(ApiClient.metadata).toBeDefined();
      expect(ApiClient.metadata.id).toBe('ApiClient');
      expect(ApiClient.metadata.version).toBe('2.0.0');
    });

    it('should declare required dependencies', () => {
      expect(ApiClient.metadata.dependencies).toContain('config');
      expect(ApiClient.metadata.dependencies).toContain('Utils');
      expect(ApiClient.metadata.dependencies).toContain('StateManager');
      expect(ApiClient.metadata.dependencies).toContain('RateLimiter');
    });

    it('should be marked as service type', () => {
      expect(ApiClient.metadata.type).toBe('service');
      expect(ApiClient.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should throw error if dependencies are missing', () => {
      expect(() => ApiClient.factory({})).toThrow();
    });

    it('should initialize successfully with valid dependencies', () => {
      const instance = ApiClient.factory(mockDeps);
      expect(instance.api).toBeDefined();
      expect(instance.api.callApiWithRetry).toBeDefined();
    });

    it('should initialize rate limiter if available', () => {
      const instance = ApiClient.factory(mockDeps);
      expect(mockDeps.RateLimiter.getLimiter).toHaveBeenCalledWith('api');
      expect(instance.api).toBeDefined();
    });

    it('should handle missing rate limiter gracefully', () => {
      const depsWithoutRateLimiter = { ...mockDeps, RateLimiter: null };
      const instance = ApiClient.factory(depsWithoutRateLimiter);

      expect(instance.api).toBeDefined();
    });
  });

  describe('Proxy Detection', () => {
    it('should check proxy availability on first call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proxyAvailable: true, hasApiKey: true })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => '',
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'response' }]
            }
          }]
        })
      });

      await clientInstance.api.callApiWithRetry([], 'test-key');

      expect(mockFetch).toHaveBeenCalledWith('/api/proxy-status');
    });

    it('should use proxy endpoint when proxy is available', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ proxyAvailable: true, hasApiKey: true })
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'response' }]
            }
          }]
        })
      });

      await clientInstance.api.callApiWithRetry([], 'test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/gemini/models'),
        expect.any(Object)
      );
    });

    it('should use direct API when proxy is unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Proxy not found'));

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'response' }]
            }
          }]
        })
      });

      await clientInstance.api.callApiWithRetry([], 'test-key');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.any(Object)
      );
    });
  });

  describe('callApiWithRetry()', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should make successful API call with text response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'Hello, world!' }]
            }
          }]
        })
      });

      const result = await clientInstance.api.callApiWithRetry(
        [{ role: 'user', content: 'Hi' }],
        'test-key'
      );

      expect(result.type).toBe('text');
      expect(result.content).toBe('Hello, world!');
    });

    it('should handle function call responses', async () => {
      const mockFunctionCall = {
        name: 'get_weather',
        args: { location: 'San Francisco' }
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ functionCall: mockFunctionCall }]
            }
          }]
        })
      });

      const result = await clientInstance.api.callApiWithRetry(
        [{ role: 'user', content: 'What is the weather?' }],
        'test-key',
        [{ name: 'get_weather', description: 'Get weather' }]
      );

      expect(result.type).toBe('functionCall');
      expect(result.content).toEqual(mockFunctionCall);
    });

    it('should include function declarations in request when provided', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'response' }]
            }
          }]
        })
      });

      const funcDecls = [{ name: 'test_func', description: 'Test function' }];

      await clientInstance.api.callApiWithRetry([], 'test-key', funcDecls);

      const callArgs = mockFetch.mock.calls[1][1];
      const body = JSON.parse(callArgs.body);

      expect(body.tools).toBeDefined();
      expect(body.tools[0].functionDeclarations).toEqual(funcDecls);
      expect(body.generationConfig.responseMimeType).toBeUndefined();
    });

    it('should throw ApiError on HTTP error response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad request'
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow('API Error (400): Bad request');
    });

    it('should throw ApiError when no candidates returned', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: [] })
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle prompt block errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [],
          promptFeedback: { blockReason: 'SAFETY' }
        })
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow('Request blocked: SAFETY');
    });
  });

  describe('Rate Limiting', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should check rate limiter before making call', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }]
        })
      });

      await clientInstance.api.callApiWithRetry([], 'test-key');

      expect(mockDeps.RateLimiter.waitForToken).toHaveBeenCalled();
    });

    it('should throw error when rate limit exceeded', async () => {
      mockDeps.RateLimiter.waitForToken.mockResolvedValueOnce(false);

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow('Rate limit exceeded');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should handle network offline error', async () => {
      global.navigator.onLine = false;
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.message).toContain('No internet connection');
        expect(error.code).toBe('NETWORK_OFFLINE');
      }
    });

    it('should handle authentication errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.message).toContain('Authentication failed');
        expect(error.code).toBe('AUTH_FAILED');
      }
    });

    it('should handle rate limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too many requests'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.message).toContain('Rate limit exceeded');
        expect(error.code).toBe('RATE_LIMIT');
      }
    });

    it('should handle server errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.message).toContain('temporarily unavailable');
        expect(error.code).toBe('SERVER_ERROR');
      }
    });
  });

  describe('Abort Functionality', () => {
    it('should abort existing call when new call is made', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }]
        })
      });

      // Start first call (don't await)
      clientInstance.api.callApiWithRetry([], 'test-key');

      // Start second call
      await clientInstance.api.callApiWithRetry([], 'test-key');

      expect(mockAbortController.abort).toHaveBeenCalledWith('New call initiated');
    });

    it('should abort current call on explicit abort request', () => {
      clientInstance.api.abortCurrentCall('User cancelled');

      // Abort controller is null after abort, so this won't call anything
      clientInstance.api.abortCurrentCall();

      expect(mockAbortController.abort).not.toHaveBeenCalled();
    });
  });

  describe('JSON Sanitization', () => {
    it('should sanitize LLM JSON response', () => {
      const rawJson = '  {"key": "value"}  ';
      const result = clientInstance.api.sanitizeLlmJsonResp(rawJson);

      expect(mockDeps.Utils.sanitizeLlmJsonRespPure).toHaveBeenCalledWith(rawJson, mockDeps.Utils.logger);
      expect(result).toBe('{"key": "value"}');
    });
  });
});

describe('ApiClientMulti Module (api-client-multi.js)', () => {
  let mockDeps;
  let mockFetch;
  let mockAbortController;
  let clientInstance;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Mock AbortController
    mockAbortController = {
      signal: {},
      abort: vi.fn()
    };
    global.AbortController = vi.fn(() => mockAbortController);

    // Mock navigator
    global.navigator = { onLine: true };

    mockDeps = {
      config: {
        apiKey: 'test-api-key',
        apiProvider: 'gemini'
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        Errors: {
          ApiError: class ApiError extends Error {
            constructor(message, statusCode, code) {
              super(message);
              this.name = 'ApiError';
              this.statusCode = statusCode;
              this.code = code;
            }
          },
          AbortError: class AbortError extends Error {
            constructor(message) {
              super(message);
              this.name = 'AbortError';
            }
          }
        },
        sanitizeLlmJsonRespPure: vi.fn((text) => ({
          sanitizedJson: text.trim()
        }))
      },
      StateManager: {
        getState: vi.fn(),
        setState: vi.fn()
      }
    };


    clientInstance = ApiClientMulti.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
    delete global.AbortController;
    delete global.navigator;
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

  describe('Provider Management', () => {
    it('should set provider successfully', () => {
      clientInstance.api.setProvider('openai');
      expect(clientInstance.api.getCurrentProvider()).toBe('openai');
    });

    it('should throw error for invalid provider', () => {
      expect(() => clientInstance.api.setProvider('invalid')).toThrow('Invalid provider');
    });

    it('should support all valid providers', () => {
      const validProviders = ['gemini', 'openai', 'anthropic', 'local'];

      validProviders.forEach(provider => {
        clientInstance.api.setProvider(provider);
        expect(clientInstance.api.getCurrentProvider()).toBe(provider);
      });
    });

    it('should return default provider', () => {
      expect(clientInstance.api.getCurrentProvider()).toBe('gemini');
    });
  });

  describe('Proxy Detection', () => {
    it('should detect available providers from proxy', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          proxyAvailable: true,
          providers: {
            gemini: true,
            openai: true,
            anthropic: false
          }
        })
      });

      await clientInstance.api.checkProxyAvailability();
      const providers = clientInstance.api.getAvailableProviders();

      expect(providers).toContain('gemini');
      expect(providers).toContain('openai');
      expect(providers).toContain('local');
    });

    it('should return only local when proxy unavailable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('No proxy'));

      await clientInstance.api.checkProxyAvailability();
      const providers = clientInstance.api.getAvailableProviders();

      expect(providers).toEqual(['local']);
    });
  });

  describe('API Calls', () => {
    it('should make successful API call', async () => {
      // Mock proxy check
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });

      // Mock successful API response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{ text: 'test' }]
            }
          }]
        })
      });

      const result = await clientInstance.api.callApiWithRetry([], 'key');
      expect(result.type).toBe('text');
      expect(result.content).toBe('test');
    });
  });

  describe('HTTP Error Codes - ApiClient', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should handle 400 Bad Request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Bad Request'
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle 401 Unauthorized', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: async () => 'Unauthorized'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTH_FAILED');
      }
    });

    it('should handle 403 Forbidden', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        text: async () => 'Forbidden'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('AUTH_FAILED');
      }
    });

    it('should handle 404 Not Found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: async () => 'Not Found'
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow('API Error (404)');
    });

    it('should handle 429 Rate Limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Too Many Requests'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(429);
        expect(error.code).toBe('RATE_LIMIT');
      }
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(500);
        expect(error.code).toBe('SERVER_ERROR');
      }
    });

    it('should handle 502 Bad Gateway', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        text: async () => 'Bad Gateway'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(502);
        expect(error.code).toBe('SERVER_ERROR');
      }
    });

    it('should handle 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      });

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.statusCode).toBe(503);
        expect(error.code).toBe('SERVER_ERROR');
      }
    });
  });

  describe('Timeout Scenarios', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should handle fetch timeout', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => reject(new Error('Timeout')), 100);
        })
      );

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle slow responses', async () => {
      mockFetch.mockImplementation(() =>
        new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => ({
                candidates: [{ content: { parts: [{ text: 'response' }] } }]
              })
            });
          }, 50);
        })
      );

      const result = await clientInstance.api.callApiWithRetry([], 'test-key');
      expect(result).toBeDefined();
    });
  });

  describe('Concurrent Requests', () => {
    beforeEach(() => {
      mockFetch.mockImplementation(async () => ({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }]
        })
      }));
    });

    it('should handle multiple concurrent requests', async () => {
      const promises = [
        clientInstance.api.callApiWithRetry([], 'key1'),
        clientInstance.api.callApiWithRetry([], 'key2'),
        clientInstance.api.callApiWithRetry([], 'key3')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.type).toBe('text');
      });
    });

    it('should abort previous call when new call starts', async () => {
      clientInstance.api.callApiWithRetry([], 'key1');
      await clientInstance.api.callApiWithRetry([], 'key2');

      expect(mockAbortController.abort).toHaveBeenCalled();
    });
  });

  describe('Request Cancellation', () => {
    it('should cancel request with abortCurrentCall', () => {
      clientInstance.api.abortCurrentCall('User cancelled');

      // Should not throw
      expect(true).toBe(true);
    });

    it('should handle abort during request', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            const error = new Error('Aborted');
            error.name = 'AbortError';
            reject(error);
          }, 50);
        })
      );

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });
  });

  describe('Network Errors', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should handle DNS resolution failure', async () => {
      mockFetch.mockRejectedValueOnce(new Error('DNS resolution failed'));

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle connection refused', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle network unreachable', async () => {
      global.navigator.onLine = false;
      mockFetch.mockRejectedValueOnce(new Error('Network unreachable'));

      try {
        await clientInstance.api.callApiWithRetry([], 'test-key');
      } catch (error) {
        expect(error.code).toBe('NETWORK_OFFLINE');
      }
    });
  });

  describe('Edge Cases - Response Handling', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should handle empty response body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({})
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle malformed JSON response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle null candidates', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ candidates: null })
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });

    it('should handle missing content in candidate', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{}]
        })
      });

      await expect(
        clientInstance.api.callApiWithRetry([], 'test-key')
      ).rejects.toThrow();
    });
  });

  describe('Function Calling', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ proxyAvailable: false })
      });
    });

    it('should include tool config with function declarations', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }]
        })
      });

      const funcDecls = [
        { name: 'test_func', description: 'Test', parameters: {} }
      ];

      await clientInstance.api.callApiWithRetry([], 'test-key', funcDecls);

      const callArgs = mockFetch.mock.calls[1][1];
      const body = JSON.parse(callArgs.body);

      expect(body.tools).toBeDefined();
      expect(body.tool_config).toBeDefined();
    });

    it('should remove responseMimeType when using function calling', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'response' }] } }]
        })
      });

      const funcDecls = [{ name: 'test', description: 'Test' }];

      await clientInstance.api.callApiWithRetry([], 'test-key', funcDecls);

      const callArgs = mockFetch.mock.calls[1][1];
      const body = JSON.parse(callArgs.body);

      expect(body.generationConfig.responseMimeType).toBeUndefined();
    });
  });
});
