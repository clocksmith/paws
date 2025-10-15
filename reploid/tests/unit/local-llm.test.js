import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('LocalLLM Module', () => {
  let LocalLLM;
  let mockDeps;
  let mockNavigator;
  let mockWindow;
  let mockEngine;
  let mockEventBus;
  let localLLMInstance;

  beforeEach(() => {
    // Mock WebGPU
    const mockAdapter = {
      info: {
        vendor: 'Test GPU',
        architecture: 'Test Arch'
      }
    };

    mockNavigator = {
      gpu: {
        requestAdapter: vi.fn().mockResolvedValue(mockAdapter)
      }
    };
    global.navigator = mockNavigator;

    // Mock WebLLM engine
    mockEngine = {
      chat: {
        completions: {
          create: vi.fn()
        }
      },
      unload: vi.fn().mockResolvedValue(undefined)
    };

    // Mock window.webllm
    mockWindow = {
      webllm: {
        CreateMLCEngine: vi.fn().mockResolvedValue(mockEngine)
      }
    };
    global.window = mockWindow;

    // Mock EventBus
    mockEventBus = {
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
      StateManager: {}
    };

    // Create LocalLLM module
    LocalLLM = {
      metadata: {
        id: 'LocalLLM',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager'],
        async: true,
        type: 'runtime'
      },
      factory: (deps) => {
        const { Utils, EventBus } = deps;
        const { logger } = Utils;

        let engine = null;
        let currentModel = null;
        let isReady = false;
        let isLoading = false;
        let initError = null;
        let loadProgress = 0;

        const DEFAULT_MODEL = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';
        const ALTERNATIVE_MODELS = [
          'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
          'Phi-3.5-mini-instruct-q4f16_1-MLC',
          'Llama-3.2-1B-Instruct-q4f16_1-MLC',
          'gemma-2-2b-it-q4f16_1-MLC'
        ];

        const checkWebGPU = async () => {
          if (!navigator.gpu) {
            return {
              available: false,
              error: 'WebGPU not supported in this browser'
            };
          }

          try {
            const adapter = await navigator.gpu.requestAdapter();
            if (!adapter) {
              return {
                available: false,
                error: 'No WebGPU adapter found'
              };
            }

            return {
              available: true,
              adapter,
              info: {
                vendor: adapter.info?.vendor || 'Unknown',
                architecture: adapter.info?.architecture || 'Unknown'
              }
            };
          } catch (error) {
            return {
              available: false,
              error: error.message
            };
          }
        };

        const init = async (modelId = DEFAULT_MODEL) => {
          try {
            logger.info('[LocalLLM] Initializing WebLLM runtime...');

            const gpuCheck = await checkWebGPU();
            if (!gpuCheck.available) {
              throw new Error(`WebGPU unavailable: ${gpuCheck.error}`);
            }

            logger.info('[LocalLLM] WebGPU available:', gpuCheck.info);

            if (typeof window.webllm === 'undefined') {
              throw new Error('WebLLM library not loaded');
            }

            isLoading = true;
            loadProgress = 0;
            EventBus.emit('local-llm:loading', { model: modelId, progress: 0 });

            const initProgressCallback = (report) => {
              loadProgress = report.progress || 0;
              logger.info(`[LocalLLM] Loading: ${(loadProgress * 100).toFixed(1)}% - ${report.text}`);

              EventBus.emit('local-llm:progress', {
                progress: loadProgress,
                text: report.text
              });
            };

            engine = await window.webllm.CreateMLCEngine(
              modelId,
              {
                initProgressCallback,
                logLevel: 'INFO'
              }
            );

            currentModel = modelId;
            isReady = true;
            isLoading = false;
            initError = null;
            loadProgress = 1;

            logger.info('[LocalLLM] Model loaded successfully:', modelId);

            EventBus.emit('local-llm:ready', {
              model: modelId,
              gpu: gpuCheck.info
            });

            return true;
          } catch (error) {
            logger.error('[LocalLLM] Initialization failed:', error);
            initError = error;
            isReady = false;
            isLoading = false;

            EventBus.emit('local-llm:error', { error: error.message });

            throw error;
          }
        };

        const chat = async (messages, options = {}) => {
          if (!isReady || !engine) {
            throw new Error('LocalLLM not ready. Call init() first.');
          }

          try {
            logger.debug('[LocalLLM] Generating completion...', {
              messages: messages.length,
              model: currentModel
            });

            const startTime = Date.now();

            const formattedMessages = messages.map(msg => {
              if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
                const content = [];

                if (msg.content) {
                  content.push({ type: 'text', text: msg.content });
                }

                for (const image of msg.images) {
                  if (typeof image === 'string') {
                    content.push({
                      type: 'image_url',
                      image_url: { url: image }
                    });
                  }
                }

                return {
                  role: msg.role,
                  content
                };
              } else {
                return {
                  role: msg.role,
                  content: msg.content
                };
              }
            });

            const completion = await engine.chat.completions.create({
              messages: formattedMessages,
              temperature: options.temperature || 0.7,
              max_tokens: options.max_tokens || 2048,
              stream: options.stream !== false,
              stream_options: options.stream ? { include_usage: true } : undefined
            });

            if (options.stream) {
              return {
                async *[Symbol.asyncIterator]() {
                  let fullText = '';
                  let tokenCount = 0;

                  for await (const chunk of completion) {
                    const delta = chunk.choices[0]?.delta?.content || '';
                    if (delta) {
                      fullText += delta;
                      tokenCount++;

                      yield {
                        delta,
                        text: fullText,
                        tokenCount,
                        done: false
                      };
                    }

                    if (chunk.usage) {
                      const elapsed = Date.now() - startTime;
                      yield {
                        delta: '',
                        text: fullText,
                        tokenCount,
                        done: true,
                        usage: chunk.usage,
                        elapsed,
                        tokensPerSecond: tokenCount / (elapsed / 1000)
                      };
                    }
                  }
                }
              };
            } else {
              const response = completion;
              const elapsed = Date.now() - startTime;

              return {
                text: response.choices[0]?.message?.content || '',
                usage: response.usage,
                elapsed,
                model: currentModel,
                tokensPerSecond: response.usage?.completion_tokens / (elapsed / 1000) || 0
              };
            }
          } catch (error) {
            logger.error('[LocalLLM] Generation failed:', error);
            throw error;
          }
        };

        const complete = async (prompt, options = {}) => {
          const messages = [
            { role: 'user', content: prompt }
          ];

          return await chat(messages, options);
        };

        const switchModel = async (modelId) => {
          logger.info('[LocalLLM] Switching model to:', modelId);

          if (engine) {
            try {
              await engine.unload();
              engine = null;
            } catch (error) {
              logger.warn('[LocalLLM] Error unloading model:', error);
            }
          }

          isReady = false;
          currentModel = null;

          await init(modelId);
        };

        const getAvailableModels = () => {
          return ALTERNATIVE_MODELS.map(id => ({
            id,
            name: id.split('-MLC')[0],
            size: id.includes('1.5B') ? '~900MB' :
                  id.includes('2b') ? '~1.2GB' :
                  id.includes('3.5') ? '~2.1GB' : 'Unknown'
          }));
        };

        const getStatus = () => {
          return {
            ready: isReady,
            loading: isLoading,
            progress: loadProgress,
            model: currentModel,
            error: initError ? initError.message : null
          };
        };

        const unload = async () => {
          if (engine) {
            try {
              await engine.unload();
              logger.info('[LocalLLM] Engine unloaded');
            } catch (error) {
              logger.warn('[LocalLLM] Error unloading engine:', error);
            }
          }

          engine = null;
          isReady = false;
          currentModel = null;
          loadProgress = 0;

          EventBus.emit('local-llm:unloaded');
        };

        const getRuntimeInfo = async () => {
          const gpuCheck = await checkWebGPU();

          return {
            webgpu: gpuCheck,
            webllm: typeof window.webllm !== 'undefined',
            currentModel,
            ready: isReady,
            loading: isLoading,
            availableModels: ALTERNATIVE_MODELS.length
          };
        };

        return {
          init,
          api: {
            chat,
            complete,
            switchModel,
            getAvailableModels,
            getStatus,
            getRuntimeInfo,
            unload,
            isReady: () => isReady,
            isLoading: () => isLoading,
            getProgress: () => loadProgress,
            getCurrentModel: () => currentModel,
            getError: () => initError,
            checkWebGPU
          }
        };
      }
    };

    localLLMInstance = LocalLLM.factory(mockDeps);
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(LocalLLM.metadata.id).toBe('LocalLLM');
      expect(LocalLLM.metadata.version).toBe('1.0.0');
      expect(LocalLLM.metadata.type).toBe('runtime');
    });

    it('should declare required dependencies', () => {
      expect(LocalLLM.metadata.dependencies).toContain('Utils');
      expect(LocalLLM.metadata.dependencies).toContain('EventBus');
      expect(LocalLLM.metadata.dependencies).toContain('StateManager');
    });

    it('should be async type', () => {
      expect(LocalLLM.metadata.async).toBe(true);
    });
  });

  describe('WebGPU Detection', () => {
    it('should detect WebGPU support', async () => {
      const result = await localLLMInstance.api.checkWebGPU();

      expect(result.available).toBe(true);
      expect(result.info.vendor).toBe('Test GPU');
      expect(result.info.architecture).toBe('Test Arch');
    });

    it('should handle missing navigator.gpu', async () => {
      delete global.navigator.gpu;

      const result = await localLLMInstance.api.checkWebGPU();

      expect(result.available).toBe(false);
      expect(result.error).toContain('WebGPU not supported');
    });

    it('should handle missing adapter', async () => {
      mockNavigator.gpu.requestAdapter.mockResolvedValue(null);

      const result = await localLLMInstance.api.checkWebGPU();

      expect(result.available).toBe(false);
      expect(result.error).toContain('No WebGPU adapter found');
    });

    it('should handle adapter request errors', async () => {
      mockNavigator.gpu.requestAdapter.mockRejectedValue(new Error('GPU error'));

      const result = await localLLMInstance.api.checkWebGPU();

      expect(result.available).toBe(false);
      expect(result.error).toBe('GPU error');
    });
  });

  describe('Initialization', () => {
    it('should initialize with default model', async () => {
      await localLLMInstance.init();

      expect(localLLMInstance.api.isReady()).toBe(true);
      expect(localLLMInstance.api.getCurrentModel()).toContain('Qwen2.5-Coder');
    });

    it('should emit loading event', async () => {
      await localLLMInstance.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('local-llm:loading', expect.objectContaining({
        model: expect.any(String),
        progress: 0
      }));
    });

    it('should emit ready event after initialization', async () => {
      await localLLMInstance.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('local-llm:ready', expect.objectContaining({
        model: expect.any(String),
        gpu: expect.any(Object)
      }));
    });

    it('should handle WebGPU unavailable', async () => {
      delete global.navigator.gpu;

      await expect(localLLMInstance.init()).rejects.toThrow('WebGPU unavailable');
      expect(localLLMInstance.api.isReady()).toBe(false);
    });

    it('should handle WebLLM library not loaded', async () => {
      delete global.window.webllm;

      await expect(localLLMInstance.init()).rejects.toThrow('WebLLM library not loaded');
    });

    it('should emit error event on failure', async () => {
      delete global.window.webllm;

      try {
        await localLLMInstance.init();
      } catch (e) {
        // Expected
      }

      expect(mockEventBus.emit).toHaveBeenCalledWith('local-llm:error', expect.objectContaining({
        error: expect.any(String)
      }));
    });

    it('should handle initialization errors gracefully', async () => {
      mockWindow.webllm.CreateMLCEngine.mockRejectedValue(new Error('Init failed'));

      await expect(localLLMInstance.init()).rejects.toThrow('Init failed');
      expect(localLLMInstance.api.getError()).toBeTruthy();
    });
  });

  describe('Chat Completions', () => {
    beforeEach(async () => {
      await localLLMInstance.init();
    });

    it('should generate completion for text messages', async () => {
      mockEngine.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Test response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 }
      });

      const result = await localLLMInstance.api.chat([
        { role: 'user', content: 'Hello' }
      ], { stream: false });

      expect(result.text).toBe('Test response');
      expect(result.model).toBeDefined();
    });

    it('should format messages with images for vision models', async () => {
      mockEngine.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'Image described' } }],
        usage: {}
      });

      await localLLMInstance.api.chat([
        {
          role: 'user',
          content: 'What is in this image?',
          images: ['data:image/png;base64,...']
        }
      ], { stream: false });

      const callArgs = mockEngine.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages[0].content).toBeInstanceOf(Array);
      expect(callArgs.messages[0].content).toContainEqual({
        type: 'text',
        text: 'What is in this image?'
      });
      expect(callArgs.messages[0].content).toContainEqual({
        type: 'image_url',
        image_url: { url: 'data:image/png;base64,...' }
      });
    });

    it('should throw if not ready', async () => {
      const freshInstance = LocalLLM.factory(mockDeps);

      await expect(freshInstance.api.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('LocalLLM not ready');
    });

    it('should support temperature option', async () => {
      mockEngine.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
        usage: {}
      });

      await localLLMInstance.api.chat([{ role: 'user', content: 'test' }], {
        temperature: 0.9,
        stream: false
      });

      const callArgs = mockEngine.chat.completions.create.mock.calls[0][0];
      expect(callArgs.temperature).toBe(0.9);
    });

    it('should support max_tokens option', async () => {
      mockEngine.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
        usage: {}
      });

      await localLLMInstance.api.chat([{ role: 'user', content: 'test' }], {
        max_tokens: 1000,
        stream: false
      });

      const callArgs = mockEngine.chat.completions.create.mock.calls[0][0];
      expect(callArgs.max_tokens).toBe(1000);
    });

    it('should handle generation errors', async () => {
      mockEngine.chat.completions.create.mockRejectedValue(new Error('Generation failed'));

      await expect(localLLMInstance.api.chat([{ role: 'user', content: 'test' }]))
        .rejects.toThrow('Generation failed');
    });
  });

  describe('Simple Completion', () => {
    beforeEach(async () => {
      await localLLMInstance.init();
    });

    it('should convert prompt to chat format', async () => {
      mockEngine.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: 'response' } }],
        usage: {}
      });

      await localLLMInstance.api.complete('Test prompt', { stream: false });

      const callArgs = mockEngine.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages).toEqual([
        { role: 'user', content: 'Test prompt' }
      ]);
    });
  });

  describe('Model Switching', () => {
    beforeEach(async () => {
      await localLLMInstance.init();
    });

    it('should switch to different model', async () => {
      const newModel = 'Phi-3.5-mini-instruct-q4f16_1-MLC';

      await localLLMInstance.api.switchModel(newModel);

      expect(localLLMInstance.api.getCurrentModel()).toBe(newModel);
      expect(mockEngine.unload).toHaveBeenCalled();
    });

    it('should handle unload errors during switch', async () => {
      mockEngine.unload.mockRejectedValue(new Error('Unload failed'));

      // Should still proceed with loading new model
      await localLLMInstance.api.switchModel('Phi-3.5-mini-instruct-q4f16_1-MLC');

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error unloading model'),
        expect.any(Error)
      );
    });
  });

  describe('Available Models', () => {
    it('should return list of available models', () => {
      const models = localLLMInstance.api.getAvailableModels();

      expect(models).toBeInstanceOf(Array);
      expect(models.length).toBeGreaterThan(0);
      expect(models[0]).toHaveProperty('id');
      expect(models[0]).toHaveProperty('name');
      expect(models[0]).toHaveProperty('size');
    });

    it('should include model sizes', () => {
      const models = localLLMInstance.api.getAvailableModels();

      const smallModel = models.find(m => m.id.includes('1.5B'));
      expect(smallModel.size).toBe('~900MB');

      const mediumModel = models.find(m => m.id.includes('2b'));
      expect(mediumModel?.size).toBe('~1.2GB');
    });
  });

  describe('Status', () => {
    it('should return status before initialization', () => {
      const status = localLLMInstance.api.getStatus();

      expect(status.ready).toBe(false);
      expect(status.loading).toBe(false);
      expect(status.model).toBeNull();
    });

    it('should return status after initialization', async () => {
      await localLLMInstance.init();

      const status = localLLMInstance.api.getStatus();

      expect(status.ready).toBe(true);
      expect(status.loading).toBe(false);
      expect(status.model).toBeDefined();
      expect(status.progress).toBe(1);
    });

    it('should include error in status', async () => {
      delete global.window.webllm;

      try {
        await localLLMInstance.init();
      } catch (e) {
        // Expected
      }

      const status = localLLMInstance.api.getStatus();

      expect(status.ready).toBe(false);
      expect(status.error).toBeTruthy();
    });
  });

  describe('Runtime Info', () => {
    it('should return runtime information', async () => {
      const info = await localLLMInstance.api.getRuntimeInfo();

      expect(info).toHaveProperty('webgpu');
      expect(info).toHaveProperty('webllm');
      expect(info).toHaveProperty('ready');
      expect(info).toHaveProperty('loading');
      expect(info).toHaveProperty('availableModels');
    });

    it('should show WebLLM availability', async () => {
      const info = await localLLMInstance.api.getRuntimeInfo();

      expect(info.webllm).toBe(true);
    });

    it('should show model count', async () => {
      const info = await localLLMInstance.api.getRuntimeInfo();

      expect(info.availableModels).toBe(4);
    });
  });

  describe('Unload', () => {
    beforeEach(async () => {
      await localLLMInstance.init();
    });

    it('should unload engine', async () => {
      await localLLMInstance.api.unload();

      expect(mockEngine.unload).toHaveBeenCalled();
      expect(localLLMInstance.api.isReady()).toBe(false);
      expect(localLLMInstance.api.getCurrentModel()).toBeNull();
    });

    it('should emit unloaded event', async () => {
      await localLLMInstance.api.unload();

      expect(mockEventBus.emit).toHaveBeenCalledWith('local-llm:unloaded');
    });

    it('should handle unload errors', async () => {
      mockEngine.unload.mockRejectedValue(new Error('Unload error'));

      await localLLMInstance.api.unload();

      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error unloading engine'),
        expect.any(Error)
      );
    });

    it('should reset state after unload', async () => {
      await localLLMInstance.api.unload();

      const status = localLLMInstance.api.getStatus();

      expect(status.ready).toBe(false);
      expect(status.model).toBeNull();
      expect(status.progress).toBe(0);
    });
  });
});
