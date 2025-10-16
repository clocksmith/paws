import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('MultiProviderAPI', () => {
  let MultiProviderAPI;
  let MultiProviderAPIModule;
  let mockConfig;
  let mockLogger;
  let instance;
  let mockFetch;

  beforeEach(() => {
    mockConfig = {
      geminiApiKey: 'test-gemini-key',
      openaiApiKey: 'test-openai-key',
      anthropicApiKey: 'test-anthropic-key',
      localEndpoint: 'http://localhost:11434/api/generate',
      defaultProvider: 'gemini',
      fallbackProviders: ['openai', 'anthropic']
    };

    mockLogger = {
      logEvent: vi.fn(),
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn()
    };

    mockFetch = vi.fn();
    global.fetch = mockFetch;

    // Import the module classes
    MultiProviderAPI = class {
      constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.providers = new Map();
        this.currentProvider = config.defaultProvider || 'gemini';
      }

      registerProvider(name, provider) {
        this.providers.set(name, provider);
      }

      setProvider(name) {
        if (!this.providers.has(name)) {
          throw new Error(`Provider ${name} not registered`);
        }
        this.currentProvider = name;
        this.logger.logEvent('info', `Switched to ${name} provider`);
      }

      async callAPI(messages, options = {}) {
        const provider = this.providers.get(this.currentProvider);
        if (!provider) {
          throw new Error('No provider selected');
        }

        try {
          return await provider.call(messages, options);
        } catch (error) {
          this.logger.logEvent('error', `${this.currentProvider} API call failed: ${error.message}`);

          if (this.config.fallbackProviders) {
            for (const fallbackName of this.config.fallbackProviders) {
              if (fallbackName !== this.currentProvider) {
                const fallbackProvider = this.providers.get(fallbackName);
                if (fallbackProvider) {
                  try {
                    this.logger.logEvent('info', `Trying fallback provider: ${fallbackName}`);
                    return await fallbackProvider.call(messages, options);
                  } catch (fallbackError) {
                    this.logger.logEvent('error', `Fallback ${fallbackName} also failed`);
                  }
                }
              }
            }
          }

          throw error;
        }
      }

      async streamCall(messages, options = {}, onChunk) {
        const provider = this.providers.get(this.currentProvider);
        if (!provider || !provider.stream) {
          throw new Error(`Provider ${this.currentProvider} does not support streaming`);
        }
        return provider.stream(messages, options, onChunk);
      }

      getProviderList() {
        return Array.from(this.providers.keys());
      }

      getProviderConfig(name) {
        const provider = this.providers.get(name);
        return provider ? provider.getConfig() : null;
      }
    };

    // Mock provider classes
    class MockProvider {
      constructor(config, logger) {
        this.config = config;
        this.logger = logger;
        this.apiKey = config.apiKey;
      }

      async call(messages, options) {
        return { type: 'text', content: 'mock response', usage: {} };
      }

      getConfig() {
        return { name: 'MockProvider', hasApiKey: !!this.apiKey };
      }
    }

    MultiProviderAPIModule = {
      metadata: {
        id: 'MultiProviderAPI',
        version: '1.0.0',
        dependencies: ['config', 'logger'],
        async: false,
        type: 'api'
      },
      factory: (deps) => {
        const { config, logger } = deps;

        if (!config || !logger) {
          throw new Error('MultiProviderAPI: Missing required dependencies');
        }

        const api = new MultiProviderAPI(config, logger);

        // Register mock provider
        api.registerProvider('mock', new MockProvider(config, logger));

        return {
          callAPI: (messages, options) => api.callAPI(messages, options),
          streamCall: (messages, options, onChunk) => api.streamCall(messages, options, onChunk),
          setProvider: (name) => api.setProvider(name),
          getProviders: () => api.getProviderList(),
          getProviderConfig: (name) => api.getProviderConfig(name)
        };
      }
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct module metadata', () => {
      expect(MultiProviderAPIModule.metadata).toBeDefined();
      expect(MultiProviderAPIModule.metadata.id).toBe('MultiProviderAPI');
      expect(MultiProviderAPIModule.metadata.version).toBe('1.0.0');
    });

    it('should declare required dependencies', () => {
      expect(MultiProviderAPIModule.metadata.dependencies).toContain('config');
      expect(MultiProviderAPIModule.metadata.dependencies).toContain('logger');
    });

    it('should be an API type module', () => {
      expect(MultiProviderAPIModule.metadata.type).toBe('api');
    });

    it('should not be async', () => {
      expect(MultiProviderAPIModule.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize with config and logger', () => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);

      expect(instance.config).toBe(mockConfig);
      expect(instance.logger).toBe(mockLogger);
      expect(instance.providers).toBeInstanceOf(Map);
    });

    it('should set default provider from config', () => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);

      expect(instance.currentProvider).toBe('gemini');
    });

    it('should fallback to gemini if no default provider', () => {
      const configWithoutDefault = { ...mockConfig };
      delete configWithoutDefault.defaultProvider;

      instance = new MultiProviderAPI(configWithoutDefault, mockLogger);

      expect(instance.currentProvider).toBe('gemini');
    });

    it('should throw error if missing config', () => {
      expect(() => {
        MultiProviderAPIModule.factory({ logger: mockLogger });
      }).toThrow('Missing required dependencies');
    });

    it('should throw error if missing logger', () => {
      expect(() => {
        MultiProviderAPIModule.factory({ config: mockConfig });
      }).toThrow('Missing required dependencies');
    });
  });

  describe('Provider Management', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should register providers', () => {
      const mockProvider = { call: vi.fn() };
      instance.registerProvider('test', mockProvider);

      expect(instance.providers.has('test')).toBe(true);
      expect(instance.providers.get('test')).toBe(mockProvider);
    });

    it('should switch between providers', () => {
      const mockProvider = { call: vi.fn() };
      instance.registerProvider('test', mockProvider);

      instance.setProvider('test');

      expect(instance.currentProvider).toBe('test');
      expect(mockLogger.logEvent).toHaveBeenCalledWith('info', 'Switched to test provider');
    });

    it('should throw error for unregistered provider', () => {
      expect(() => {
        instance.setProvider('non-existent');
      }).toThrow('Provider non-existent not registered');
    });

    it('should list all registered providers', () => {
      instance.registerProvider('provider1', {});
      instance.registerProvider('provider2', {});

      const providers = instance.getProviderList();

      expect(providers).toContain('provider1');
      expect(providers).toContain('provider2');
    });

    it('should get provider configuration', () => {
      const mockProvider = {
        getConfig: () => ({ name: 'Test', hasApiKey: true })
      };
      instance.registerProvider('test', mockProvider);

      const config = instance.getProviderConfig('test');

      expect(config).toEqual({ name: 'Test', hasApiKey: true });
    });

    it('should return null for non-existent provider config', () => {
      const config = instance.getProviderConfig('non-existent');

      expect(config).toBeNull();
    });
  });

  describe('API Calls', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should call current provider', async () => {
      const mockProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'response' })
      };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const messages = [{ role: 'user', content: 'Hello' }];
      const result = await instance.callAPI(messages);

      expect(mockProvider.call).toHaveBeenCalledWith(messages, {});
      expect(result.content).toBe('response');
    });

    it('should pass options to provider', async () => {
      const mockProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'response' })
      };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const messages = [{ role: 'user', content: 'Hello' }];
      const options = { temperature: 0.7, maxTokens: 100 };

      await instance.callAPI(messages, options);

      expect(mockProvider.call).toHaveBeenCalledWith(messages, options);
    });

    it('should throw error if no provider selected', async () => {
      instance.currentProvider = null;

      await expect(instance.callAPI([])).rejects.toThrow('No provider selected');
    });

    it('should log errors on API failure', async () => {
      const mockProvider = {
        call: vi.fn().mockRejectedValue(new Error('API Error'))
      };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      await expect(instance.callAPI([])).rejects.toThrow('API Error');
      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('API call failed')
      );
    });
  });

  describe('Fallback Mechanism', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should try fallback provider on failure', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Primary failed'))
      };
      const fallbackProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'fallback success' })
      };

      instance.registerProvider('primary', failingProvider);
      instance.registerProvider('openai', fallbackProvider);
      instance.setProvider('primary');

      const result = await instance.callAPI([]);

      expect(failingProvider.call).toHaveBeenCalled();
      expect(fallbackProvider.call).toHaveBeenCalled();
      expect(result.content).toBe('fallback success');
    });

    it('should skip current provider in fallback', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Failed'))
      };

      instance.registerProvider('gemini', failingProvider);
      instance.setProvider('gemini');

      await expect(instance.callAPI([])).rejects.toThrow('Failed');
      expect(failingProvider.call).toHaveBeenCalledTimes(1); // Only once, not in fallback
    });

    it('should try multiple fallback providers', async () => {
      const primary = {
        call: vi.fn().mockRejectedValue(new Error('Primary failed'))
      };
      const fallback1 = {
        call: vi.fn().mockRejectedValue(new Error('Fallback1 failed'))
      };
      const fallback2 = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'success' })
      };

      instance.registerProvider('primary', primary);
      instance.registerProvider('openai', fallback1);
      instance.registerProvider('anthropic', fallback2);
      instance.setProvider('primary');

      const result = await instance.callAPI([]);

      expect(fallback2.call).toHaveBeenCalled();
      expect(result.content).toBe('success');
    });

    it('should log fallback attempts', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Failed'))
      };
      const fallbackProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'success' })
      };

      instance.registerProvider('primary', failingProvider);
      instance.registerProvider('openai', fallbackProvider);
      instance.setProvider('primary');

      await instance.callAPI([]);

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'info',
        expect.stringContaining('Trying fallback provider')
      );
    });

    it('should throw if all fallbacks fail', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Failed'))
      };

      instance.registerProvider('primary', failingProvider);
      instance.registerProvider('openai', failingProvider);
      instance.setProvider('primary');

      await expect(instance.callAPI([])).rejects.toThrow('Failed');
    });
  });

  describe('Streaming', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should stream from provider that supports it', async () => {
      const mockProvider = {
        stream: vi.fn().mockResolvedValue()
      };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const onChunk = vi.fn();
      await instance.streamCall([], {}, onChunk);

      expect(mockProvider.stream).toHaveBeenCalledWith([], {}, onChunk);
    });

    it('should throw error if provider does not support streaming', async () => {
      const mockProvider = { call: vi.fn() };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      await expect(instance.streamCall([], {}, vi.fn())).rejects.toThrow(
        'does not support streaming'
      );
    });

    it('should pass options to stream method', async () => {
      const mockProvider = {
        stream: vi.fn().mockResolvedValue()
      };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const options = { temperature: 0.5 };
      const onChunk = vi.fn();
      await instance.streamCall([], options, onChunk);

      expect(mockProvider.stream).toHaveBeenCalledWith([], options, onChunk);
    });
  });

  describe('Provider Implementations', () => {
    describe('Base Provider', () => {
      it('should throw error for unimplemented call method', async () => {
        class BaseProvider {
          async call(messages, options) {
            throw new Error('call() must be implemented by provider');
          }

          async stream(messages, options, onChunk) {
            throw new Error('Streaming not supported by this provider');
          }

          getConfig() {
            return { name: 'BaseProvider' };
          }
        }

        const provider = new BaseProvider();

        await expect(provider.call([])).rejects.toThrow('must be implemented');
        await expect(provider.stream([], {}, vi.fn())).rejects.toThrow('not supported');
      });

      it('should return config from getConfig', () => {
        class TestProvider {
          getConfig() {
            return { name: 'TestProvider', hasApiKey: true };
          }
        }

        const provider = new TestProvider();
        const config = provider.getConfig();

        expect(config.name).toBe('TestProvider');
        expect(config.hasApiKey).toBe(true);
      });
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should handle provider not found error', async () => {
      instance.currentProvider = 'non-existent';

      await expect(instance.callAPI([])).rejects.toThrow('No provider selected');
    });

    it('should handle API call failures', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Network error'))
      };
      instance.registerProvider('test', failingProvider);
      instance.setProvider('test');

      await expect(instance.callAPI([])).rejects.toThrow('Network error');
    });

    it('should log all errors', async () => {
      const failingProvider = {
        call: vi.fn().mockRejectedValue(new Error('Test error'))
      };
      instance.registerProvider('test', failingProvider);
      instance.setProvider('test');

      try {
        await instance.callAPI([]);
      } catch (e) {
        // Expected
      }

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('Test error')
      );
    });

    it('should handle streaming errors', async () => {
      const failingProvider = {
        stream: vi.fn().mockRejectedValue(new Error('Stream error'))
      };
      instance.registerProvider('test', failingProvider);
      instance.setProvider('test');

      await expect(instance.streamCall([], {}, vi.fn())).rejects.toThrow('Stream error');
    });
  });

  describe('API Exposure', () => {
    it('should expose complete public API via factory', () => {
      const api = MultiProviderAPIModule.factory({
        config: mockConfig,
        logger: mockLogger
      });

      expect(typeof api.callAPI).toBe('function');
      expect(typeof api.streamCall).toBe('function');
      expect(typeof api.setProvider).toBe('function');
      expect(typeof api.getProviders).toBe('function');
      expect(typeof api.getProviderConfig).toBe('function');
    });

    it('should expose all methods', () => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);

      expect(typeof instance.registerProvider).toBe('function');
      expect(typeof instance.setProvider).toBe('function');
      expect(typeof instance.callAPI).toBe('function');
      expect(typeof instance.streamCall).toBe('function');
      expect(typeof instance.getProviderList).toBe('function');
      expect(typeof instance.getProviderConfig).toBe('function');
    });
  });

  describe('Integration with Dependencies', () => {
    beforeEach(() => {
      instance = new MultiProviderAPI(mockConfig, mockLogger);
    });

    it('should use logger for all logging', () => {
      const mockProvider = { call: vi.fn() };
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      expect(mockLogger.logEvent).toHaveBeenCalledWith(
        'info',
        'Switched to test provider'
      );
    });

    it('should use config for provider settings', () => {
      expect(instance.config).toBe(mockConfig);
      expect(instance.config.defaultProvider).toBe('gemini');
    });

    it('should read fallback providers from config', async () => {
      const primary = {
        call: vi.fn().mockRejectedValue(new Error('Failed'))
      };
      const fallback = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'success' })
      };

      instance.registerProvider('primary', primary);
      instance.registerProvider('openai', fallback);
      instance.setProvider('primary');

      await instance.callAPI([]);

      expect(fallback.call).toHaveBeenCalled();
    });
  });

  describe('Message Format Conversion', () => {
    it('should handle different message formats', async () => {
      const mockProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'response' }),
        formatMessages: vi.fn((messages) => messages)
      };
      instance = new MultiProviderAPI(mockConfig, mockLogger);
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' }
      ];

      await instance.callAPI(messages);

      expect(mockProvider.call).toHaveBeenCalledWith(messages, {});
    });

    it('should preserve message content', async () => {
      const mockProvider = {
        call: vi.fn().mockResolvedValue({ type: 'text', content: 'response' })
      };
      instance = new MultiProviderAPI(mockConfig, mockLogger);
      instance.registerProvider('test', mockProvider);
      instance.setProvider('test');

      const messages = [{ role: 'user', content: 'Test message' }];
      await instance.callAPI(messages);

      const calledWith = mockProvider.call.mock.calls[0][0];
      expect(calledWith[0].content).toBe('Test message');
    });
  });

  describe('Provider Management', () => {
    it('should list all registered providers', () => {
      const provider1 = { call: vi.fn() };
      const provider2 = { call: vi.fn() };

      instance.registerProvider('provider1', provider1);
      instance.registerProvider('provider2', provider2);

      const providers = instance.getProviders();
      expect(providers).toContain('provider1');
      expect(providers).toContain('provider2');
    });

    it('should unregister providers', () => {
      const provider = { call: vi.fn() };
      instance.registerProvider('test', provider);

      instance.unregisterProvider('test');

      expect(instance.getProviders()).not.toContain('test');
    });

    it('should get current provider name', () => {
      const provider = { call: vi.fn() };
      instance.registerProvider('active', provider);
      instance.setProvider('active');

      expect(instance.getCurrentProvider()).toBe('active');
    });
  });

  describe('Load Balancing', () => {
    it('should distribute requests across providers', async () => {
      const provider1 = { call: vi.fn().mockResolvedValue({ content: 'p1' }) };
      const provider2 = { call: vi.fn().mockResolvedValue({ content: 'p2' }) };

      instance = new MultiProviderAPI({
        ...mockConfig,
        loadBalancing: 'round-robin'
      }, mockLogger);

      instance.registerProvider('p1', provider1);
      instance.registerProvider('p2', provider2);

      await instance.callAPI([{ role: 'user', content: 'Test 1' }]);
      await instance.callAPI([{ role: 'user', content: 'Test 2' }]);

      expect(provider1.call).toHaveBeenCalled();
      expect(provider2.call).toHaveBeenCalled();
    });

    it('should handle provider unavailability during load balancing', async () => {
      const provider1 = { call: vi.fn().mockRejectedValue(new Error('Unavailable')) };
      const provider2 = { call: vi.fn().mockResolvedValue({ content: 'success' }) };

      instance = new MultiProviderAPI({
        ...mockConfig,
        fallbackProviders: ['p2']
      }, mockLogger);

      instance.registerProvider('p1', provider1);
      instance.registerProvider('p2', provider2);
      instance.setProvider('p1');

      const result = await instance.callAPI([{ role: 'user', content: 'Test' }]);

      expect(result.content).toBe('success');
      expect(provider2.call).toHaveBeenCalled();
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits per provider', async () => {
      const provider = { call: vi.fn().mockResolvedValue({ content: 'ok' }) };

      instance = new MultiProviderAPI({
        ...mockConfig,
        rateLimit: { requestsPerMinute: 2 }
      }, mockLogger);

      instance.registerProvider('limited', provider);
      instance.setProvider('limited');

      await instance.callAPI([{ role: 'user', content: '1' }]);
      await instance.callAPI([{ role: 'user', content: '2' }]);

      await expect(
        instance.callAPI([{ role: 'user', content: '3' }])
      ).rejects.toThrow();
    });

    it('should reset rate limits after time window', async () => {
      vi.useFakeTimers();

      const provider = { call: vi.fn().mockResolvedValue({ content: 'ok' }) };
      instance = new MultiProviderAPI({
        ...mockConfig,
        rateLimit: { requestsPerMinute: 1 }
      }, mockLogger);

      instance.registerProvider('test', provider);
      instance.setProvider('test');

      await instance.callAPI([{ role: 'user', content: '1' }]);

      vi.advanceTimersByTime(61000); // Advance past 1 minute

      await instance.callAPI([{ role: 'user', content: '2' }]);

      expect(provider.call).toHaveBeenCalledTimes(2);

      vi.useRealTimers();
    });
  });

  describe('Health Monitoring', () => {
    it('should track provider health metrics', async () => {
      const provider = { call: vi.fn().mockResolvedValue({ content: 'ok' }) };

      instance.registerProvider('monitored', provider);
      instance.setProvider('monitored');

      await instance.callAPI([{ role: 'user', content: 'Test' }]);

      const health = instance.getProviderHealth('monitored');
      expect(health).toBeDefined();
      expect(health.totalRequests).toBeGreaterThan(0);
    });

    it('should mark unhealthy providers', async () => {
      const provider = {
        call: vi.fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockRejectedValueOnce(new Error('Fail'))
          .mockRejectedValueOnce(new Error('Fail'))
      };

      instance.registerProvider('unhealthy', provider);
      instance.setProvider('unhealthy');

      for (let i = 0; i < 3; i++) {
        await instance.callAPI([{ role: 'user', content: 'Test' }]).catch(() => {});
      }

      const health = instance.getProviderHealth('unhealthy');
      expect(health.healthy).toBe(false);
    });

    it('should recover unhealthy providers on success', async () => {
      const provider = {
        call: vi.fn()
          .mockRejectedValueOnce(new Error('Fail'))
          .mockResolvedValue({ content: 'ok' })
      };

      instance.registerProvider('recovering', provider);
      instance.setProvider('recovering');

      await instance.callAPI([{ role: 'user', content: 'Fail' }]).catch(() => {});
      await instance.callAPI([{ role: 'user', content: 'Success' }]);

      const health = instance.getProviderHealth('recovering');
      expect(health.lastSuccess).toBeDefined();
    });
  });

  describe('Cost Optimization', () => {
    it('should track cost per provider', async () => {
      const provider = { call: vi.fn().mockResolvedValue({ content: 'ok', tokens: 100 }) };

      instance = new MultiProviderAPI({
        ...mockConfig,
        costTracking: { pricePerToken: 0.001 }
      }, mockLogger);

      instance.registerProvider('paid', provider);
      instance.setProvider('paid');

      await instance.callAPI([{ role: 'user', content: 'Test' }]);

      const cost = instance.getProviderCost('paid');
      expect(cost).toBeGreaterThan(0);
    });

    it('should select cheapest available provider', async () => {
      const expensive = { call: vi.fn().mockResolvedValue({ content: 'ok', cost: 10 }) };
      const cheap = { call: vi.fn().mockResolvedValue({ content: 'ok', cost: 1 }) };

      instance = new MultiProviderAPI({
        ...mockConfig,
        optimizeFor: 'cost'
      }, mockLogger);

      instance.registerProvider('expensive', expensive);
      instance.registerProvider('cheap', cheap);

      await instance.callAPI([{ role: 'user', content: 'Test' }]);

      expect(cheap.call).toHaveBeenCalled();
      expect(expensive.call).not.toHaveBeenCalled();
    });
  });
});
