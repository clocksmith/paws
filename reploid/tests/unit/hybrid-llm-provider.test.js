import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('HybridLLMProvider Module', () => {
  let HybridLLMProvider;
  let mockDeps;
  let mockLocalLLM;
  let mockCloudAPIClient;
  let mockEventBus;
  let providerInstance;

  beforeEach(() => {
    // Mock LocalLLM
    mockLocalLLM = {
      isReady: vi.fn().mockReturnValue(false),
      chat: vi.fn(),
      getCurrentModel: vi.fn().mockReturnValue(null)
    };

    // Mock Cloud API Client
    mockCloudAPIClient = {
      generateContent: vi.fn()
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      emit: vi.fn()
    };

    // Mock dependencies
    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          debug: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      EventBus: mockEventBus,
      StateManager: {},
      LocalLLM: mockLocalLLM
    };

    // Create HybridLLMProvider module
    HybridLLMProvider = {
      metadata: {
        id: 'HybridLLMProvider',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager', 'LocalLLM'],
        async: true,
        type: 'agent'
      },
      factory: (deps) => {
        const { Utils, EventBus, LocalLLM } = deps;
        const { logger } = Utils;

        let useLocal = false;
        let cloudAPIClient = null;

        const init = async (apiClient) => {
          logger.info('[HybridLLM] Initializing hybrid LLM provider');
          cloudAPIClient = apiClient;

          if (LocalLLM && LocalLLM.isReady()) {
            logger.info('[HybridLLM] Local LLM is available and ready');
          }

          EventBus.on('local-llm:ready', () => {
            logger.info('[HybridLLM] Local LLM became ready');
          });

          EventBus.on('local-llm:unloaded', () => {
            if (useLocal) {
              logger.warn('[HybridLLM] Local LLM unloaded, falling back to cloud');
              useLocal = false;
            }
          });

          return true;
        };

        const setMode = (mode) => {
          if (mode === 'local') {
            if (!LocalLLM || !LocalLLM.isReady()) {
              logger.warn('[HybridLLM] Cannot switch to local mode: LLM not ready');
              return false;
            }
            useLocal = true;
            logger.info('[HybridLLM] Switched to local inference mode');
            EventBus.emit('hybrid-llm:mode-changed', { mode: 'local' });
            return true;
          } else if (mode === 'cloud') {
            useLocal = false;
            logger.info('[HybridLLM] Switched to cloud inference mode');
            EventBus.emit('hybrid-llm:mode-changed', { mode: 'cloud' });
            return true;
          }

          return false;
        };

        const getMode = () => {
          return useLocal ? 'local' : 'cloud';
        };

        const isLocalAvailable = () => {
          return LocalLLM && LocalLLM.isReady();
        };

        const complete = async (messages, options = {}) => {
          const mode = useLocal ? 'local' : 'cloud';

          logger.debug(`[HybridLLM] Generating completion using ${mode} mode`, {
            messages: messages.length
          });

          try {
            if (useLocal && LocalLLM && LocalLLM.isReady()) {
              return await completeLocal(messages, options);
            } else {
              if (!cloudAPIClient) {
                throw new Error('Cloud API client not initialized');
              }

              return await completeCloud(messages, options);
            }
          } catch (error) {
            logger.error(`[HybridLLM] ${mode} completion failed:`, error);

            if (useLocal && cloudAPIClient) {
              logger.info('[HybridLLM] Local inference failed, falling back to cloud');

              EventBus.emit('hybrid-llm:fallback', {
                from: 'local',
                to: 'cloud',
                error: error.message
              });

              return await completeCloud(messages, options);
            }

            throw error;
          }
        };

        const completeLocal = async (messages, options = {}) => {
          const startTime = Date.now();

          const formattedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
          }));

          const result = await LocalLLM.chat(formattedMessages, {
            temperature: options.temperature || 0.7,
            max_tokens: options.maxOutputTokens || 2048,
            stream: false
          });

          const elapsed = Date.now() - startTime;

          logger.info('[HybridLLM] Local completion generated', {
            tokens: result.usage?.completion_tokens || 0,
            elapsed,
            tokensPerSecond: result.tokensPerSecond
          });

          return {
            text: result.text,
            usage: {
              promptTokens: result.usage?.prompt_tokens || 0,
              completionTokens: result.usage?.completion_tokens || 0,
              totalTokens: result.usage?.total_tokens || 0
            },
            model: result.model,
            provider: 'local',
            elapsed,
            tokensPerSecond: result.tokensPerSecond
          };
        };

        const completeCloud = async (messages, options = {}) => {
          const response = await cloudAPIClient.generateContent({
            contents: messages.map(msg => ({
              role: msg.role,
              parts: [{ text: msg.content }]
            })),
            generationConfig: {
              temperature: options.temperature || 0.7,
              maxOutputTokens: options.maxOutputTokens || 8192
            }
          });

          const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          const usage = response?.usageMetadata || {};

          return {
            text,
            usage: {
              promptTokens: usage.promptTokenCount || 0,
              completionTokens: usage.candidatesTokenCount || 0,
              totalTokens: usage.totalTokenCount || 0
            },
            model: options.model || 'cloud',
            provider: 'cloud'
          };
        };

        const stream = async function* (messages, options = {}) {
          if (useLocal && LocalLLM && LocalLLM.isReady()) {
            const formattedMessages = messages.map(msg => ({
              role: msg.role,
              content: msg.content
            }));

            const generator = await LocalLLM.chat(formattedMessages, {
              temperature: options.temperature || 0.7,
              max_tokens: options.maxOutputTokens || 2048,
              stream: true
            });

            for await (const chunk of generator) {
              yield {
                delta: chunk.delta,
                text: chunk.text,
                done: chunk.done,
                provider: 'local'
              };
            }
          } else {
            const result = await completeCloud(messages, options);

            const chunkSize = 50;
            const text = result.text;
            let yielded = '';

            for (let i = 0; i < text.length; i += chunkSize) {
              const chunk = text.slice(i, i + chunkSize);
              yielded += chunk;

              yield {
                delta: chunk,
                text: yielded,
                done: false,
                provider: 'cloud'
              };

              await new Promise(resolve => setTimeout(resolve, 50));
            }

            yield {
              delta: '',
              text: result.text,
              done: true,
              provider: 'cloud',
              usage: result.usage
            };
          }
        };

        const getStatus = () => {
          return {
            mode: getMode(),
            localAvailable: isLocalAvailable(),
            cloudAvailable: !!cloudAPIClient,
            localModel: LocalLLM?.getCurrentModel?.() || null,
            localReady: LocalLLM?.isReady?.() || false
          };
        };

        const getAutoSwitchConfig = () => {
          return {
            enabled: false,
            fallbackToCloud: true,
            preferLocal: useLocal
          };
        };

        return {
          init,
          api: {
            setMode,
            getMode,
            isLocalAvailable,
            complete,
            stream,
            getStatus,
            getAutoSwitchConfig,
            completeLocal,
            completeCloud
          }
        };
      }
    };

    providerInstance = HybridLLMProvider.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(HybridLLMProvider.metadata.id).toBe('HybridLLMProvider');
      expect(HybridLLMProvider.metadata.version).toBe('1.0.0');
      expect(HybridLLMProvider.metadata.type).toBe('agent');
    });

    it('should declare required dependencies', () => {
      expect(HybridLLMProvider.metadata.dependencies).toContain('Utils');
      expect(HybridLLMProvider.metadata.dependencies).toContain('EventBus');
      expect(HybridLLMProvider.metadata.dependencies).toContain('LocalLLM');
    });

    it('should be async type', () => {
      expect(HybridLLMProvider.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize with cloud client', async () => {
      await providerInstance.init(mockCloudAPIClient);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing hybrid LLM provider')
      );
    });

    it('should detect if local LLM is ready on init', async () => {
      mockLocalLLM.isReady.mockReturnValue(true);

      await providerInstance.init(mockCloudAPIClient);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Local LLM is available and ready')
      );
    });

    it('should register event listeners', async () => {
      await providerInstance.init(mockCloudAPIClient);

      expect(mockEventBus.on).toHaveBeenCalledWith('local-llm:ready', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('local-llm:unloaded', expect.any(Function));
    });

    it('should handle local LLM ready event', async () => {
      await providerInstance.init(mockCloudAPIClient);

      const readyHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'local-llm:ready'
      )[1];

      readyHandler();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Local LLM became ready')
      );
    });

    it('should handle local LLM unloaded event when in local mode', async () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      await providerInstance.init(mockCloudAPIClient);

      // Switch to local mode
      providerInstance.api.setMode('local');

      // Trigger unload event
      const unloadHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'local-llm:unloaded'
      )[1];

      unloadHandler();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Local LLM unloaded, falling back to cloud')
      );
      expect(providerInstance.api.getMode()).toBe('cloud');
    });
  });

  describe('Mode Management', () => {
    beforeEach(async () => {
      await providerInstance.init(mockCloudAPIClient);
    });

    it('should default to cloud mode', () => {
      expect(providerInstance.api.getMode()).toBe('cloud');
    });

    it('should switch to local mode when available', () => {
      mockLocalLLM.isReady.mockReturnValue(true);

      const result = providerInstance.api.setMode('local');

      expect(result).toBe(true);
      expect(providerInstance.api.getMode()).toBe('local');
    });

    it('should emit mode changed event', () => {
      mockLocalLLM.isReady.mockReturnValue(true);

      providerInstance.api.setMode('local');

      expect(mockEventBus.emit).toHaveBeenCalledWith('hybrid-llm:mode-changed', {
        mode: 'local'
      });
    });

    it('should fail to switch to local when not available', () => {
      mockLocalLLM.isReady.mockReturnValue(false);

      const result = providerInstance.api.setMode('local');

      expect(result).toBe(false);
      expect(providerInstance.api.getMode()).toBe('cloud');
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Cannot switch to local mode')
      );
    });

    it('should switch to cloud mode', () => {
      const result = providerInstance.api.setMode('cloud');

      expect(result).toBe(true);
      expect(providerInstance.api.getMode()).toBe('cloud');
    });

    it('should reject invalid mode', () => {
      const result = providerInstance.api.setMode('invalid');

      expect(result).toBe(false);
    });
  });

  describe('Local Availability', () => {
    it('should report local unavailable when LLM not ready', () => {
      mockLocalLLM.isReady.mockReturnValue(false);

      expect(providerInstance.api.isLocalAvailable()).toBe(false);
    });

    it('should report local available when LLM ready', () => {
      mockLocalLLM.isReady.mockReturnValue(true);

      expect(providerInstance.api.isLocalAvailable()).toBe(true);
    });
  });

  describe('Cloud Completions', () => {
    beforeEach(async () => {
      await providerInstance.init(mockCloudAPIClient);
    });

    it('should generate cloud completion', async () => {
      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{
          content: {
            parts: [{ text: 'Cloud response' }]
          }
        }],
        usageMetadata: {
          promptTokenCount: 10,
          candidatesTokenCount: 5,
          totalTokenCount: 15
        }
      });

      const result = await providerInstance.api.complete([
        { role: 'user', content: 'Hello' }
      ]);

      expect(result.text).toBe('Cloud response');
      expect(result.provider).toBe('cloud');
      expect(result.usage.promptTokens).toBe(10);
      expect(result.usage.completionTokens).toBe(5);
    });

    it('should format messages for cloud API', async () => {
      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        usageMetadata: {}
      });

      await providerInstance.api.complete([
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' },
        { role: 'user', content: 'How are you?' }
      ]);

      const callArgs = mockCloudAPIClient.generateContent.mock.calls[0][0];
      expect(callArgs.contents).toHaveLength(3);
      expect(callArgs.contents[0].role).toBe('user');
      expect(callArgs.contents[0].parts[0].text).toBe('Hello');
    });

    it('should use provided temperature', async () => {
      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        usageMetadata: {}
      });

      await providerInstance.api.complete([{ role: 'user', content: 'test' }], {
        temperature: 0.9
      });

      const callArgs = mockCloudAPIClient.generateContent.mock.calls[0][0];
      expect(callArgs.generationConfig.temperature).toBe(0.9);
    });

    it('should use provided maxOutputTokens', async () => {
      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        usageMetadata: {}
      });

      await providerInstance.api.complete([{ role: 'user', content: 'test' }], {
        maxOutputTokens: 4000
      });

      const callArgs = mockCloudAPIClient.generateContent.mock.calls[0][0];
      expect(callArgs.generationConfig.maxOutputTokens).toBe(4000);
    });

    it('should throw if cloud client not initialized', async () => {
      const freshProvider = HybridLLMProvider.factory(mockDeps);

      await expect(freshProvider.api.complete([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('Cloud API client not initialized');
    });
  });

  describe('Local Completions', () => {
    beforeEach(async () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      await providerInstance.init(mockCloudAPIClient);
      providerInstance.api.setMode('local');
    });

    it('should generate local completion', async () => {
      mockLocalLLM.chat.mockResolvedValue({
        text: 'Local response',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15
        },
        model: 'local-model',
        tokensPerSecond: 25
      });

      const result = await providerInstance.api.complete([
        { role: 'user', content: 'Hello' }
      ]);

      expect(result.text).toBe('Local response');
      expect(result.provider).toBe('local');
      expect(result.usage.promptTokens).toBe(10);
    });

    it('should format messages for local LLM', async () => {
      mockLocalLLM.chat.mockResolvedValue({
        text: 'response',
        usage: {},
        model: 'local'
      });

      await providerInstance.api.complete([
        { role: 'user', content: 'Hello' }
      ]);

      const callArgs = mockLocalLLM.chat.mock.calls[0][0];
      expect(callArgs).toEqual([
        { role: 'user', content: 'Hello' }
      ]);
    });

    it('should use provided options for local LLM', async () => {
      mockLocalLLM.chat.mockResolvedValue({
        text: 'response',
        usage: {},
        model: 'local'
      });

      await providerInstance.api.complete([{ role: 'user', content: 'test' }], {
        temperature: 0.8,
        maxOutputTokens: 1024
      });

      const callArgs = mockLocalLLM.chat.mock.calls[0][1];
      expect(callArgs.temperature).toBe(0.8);
      expect(callArgs.max_tokens).toBe(1024);
    });
  });

  describe('Auto-Fallback', () => {
    beforeEach(async () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      await providerInstance.init(mockCloudAPIClient);
      providerInstance.api.setMode('local');
    });

    it('should fallback to cloud on local failure', async () => {
      mockLocalLLM.chat.mockRejectedValue(new Error('Local inference failed'));

      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Cloud fallback response' }] } }],
        usageMetadata: {}
      });

      const result = await providerInstance.api.complete([
        { role: 'user', content: 'Hello' }
      ]);

      expect(result.text).toBe('Cloud fallback response');
      expect(result.provider).toBe('cloud');
    });

    it('should emit fallback event', async () => {
      mockLocalLLM.chat.mockRejectedValue(new Error('Local error'));

      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        usageMetadata: {}
      });

      await providerInstance.api.complete([{ role: 'user', content: 'test' }]);

      expect(mockEventBus.emit).toHaveBeenCalledWith('hybrid-llm:fallback', {
        from: 'local',
        to: 'cloud',
        error: 'Local error'
      });
    });

    it('should log fallback', async () => {
      mockLocalLLM.chat.mockRejectedValue(new Error('Local error'));

      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'response' }] } }],
        usageMetadata: {}
      });

      await providerInstance.api.complete([{ role: 'user', content: 'test' }]);

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Local inference failed, falling back to cloud')
      );
    });

    it('should throw if cloud also unavailable', async () => {
      const freshProvider = HybridLLMProvider.factory(mockDeps);
      mockLocalLLM.isReady.mockReturnValue(true);
      await freshProvider.init(null); // No cloud client

      freshProvider.api.setMode('local');
      mockLocalLLM.chat.mockRejectedValue(new Error('Local error'));

      await expect(freshProvider.api.complete([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('Local error');
    });
  });

  describe('Streaming', () => {
    beforeEach(async () => {
      await providerInstance.init(mockCloudAPIClient);
    });

    it('should stream from local LLM', async () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      providerInstance.api.setMode('local');

      const mockGenerator = {
        async *[Symbol.asyncIterator]() {
          yield { delta: 'Hello', text: 'Hello', done: false };
          yield { delta: ' world', text: 'Hello world', done: true };
        }
      };

      mockLocalLLM.chat.mockResolvedValue(mockGenerator);

      const chunks = [];
      for await (const chunk of providerInstance.api.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0].provider).toBe('local');
      expect(chunks[1].text).toBe('Hello world');
    });

    it('should simulate streaming for cloud', async () => {
      mockCloudAPIClient.generateContent.mockResolvedValue({
        candidates: [{ content: { parts: [{ text: 'Short response' }] } }],
        usageMetadata: {}
      });

      const chunks = [];
      for await (const chunk of providerInstance.api.stream([{ role: 'user', content: 'test' }])) {
        chunks.push(chunk);
      }

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[chunks.length - 1].done).toBe(true);
      expect(chunks[chunks.length - 1].provider).toBe('cloud');
    });
  });

  describe('Status', () => {
    beforeEach(async () => {
      await providerInstance.init(mockCloudAPIClient);
    });

    it('should return correct status', () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      mockLocalLLM.getCurrentModel.mockReturnValue('test-model');

      const status = providerInstance.api.getStatus();

      expect(status.mode).toBe('cloud');
      expect(status.localAvailable).toBe(true);
      expect(status.cloudAvailable).toBe(true);
      expect(status.localModel).toBe('test-model');
      expect(status.localReady).toBe(true);
    });

    it('should show cloud unavailable if not initialized', () => {
      const freshProvider = HybridLLMProvider.factory(mockDeps);

      const status = freshProvider.api.getStatus();

      expect(status.cloudAvailable).toBe(false);
    });
  });

  describe('Auto-Switch Configuration', () => {
    it('should return auto-switch config', () => {
      const config = providerInstance.api.getAutoSwitchConfig();

      expect(config.enabled).toBe(false);
      expect(config.fallbackToCloud).toBe(true);
      expect(config.preferLocal).toBeDefined();
    });

    it('should reflect current mode preference', async () => {
      mockLocalLLM.isReady.mockReturnValue(true);
      await providerInstance.init(mockCloudAPIClient);

      providerInstance.api.setMode('local');

      const config = providerInstance.api.getAutoSwitchConfig();

      expect(config.preferLocal).toBe(true);
    });
  });
});
