/**
 * @fileoverview Local LLM Runtime Module for REPLOID
 * Provides in-browser LLM inference via WebLLM with WebGPU acceleration.
 * Enables privacy-preserving, offline-first AI capabilities.
 *
 * @module LocalLLM
 * @version 1.0.0
 * @category runtime
 */

const LocalLLM = {
  metadata: {
    id: 'LocalLLM',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager'],
    async: true,
    type: 'runtime'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager } = deps;
    const { logger } = Utils;

    let engine = null;
    let currentModel = null;
    let isReady = false;
    let isLoading = false;
    let initError = null;
    let loadProgress = 0;

    // Default model configuration
    const DEFAULT_MODEL = 'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC';
    const ALTERNATIVE_MODELS = [
      'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
      'Phi-3.5-mini-instruct-q4f16_1-MLC',
      'Llama-3.2-1B-Instruct-q4f16_1-MLC',
      'gemma-2-2b-it-q4f16_1-MLC'
    ];

    /**
     * Check if WebGPU is available
     */
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

    /**
     * Initialize WebLLM engine
     */
    const init = async (modelId = DEFAULT_MODEL) => {
      try {
        logger.info('[LocalLLM] Initializing WebLLM runtime...');

        // Check WebGPU availability
        const gpuCheck = await checkWebGPU();
        if (!gpuCheck.available) {
          throw new Error(`WebGPU unavailable: ${gpuCheck.error}`);
        }

        logger.info('[LocalLLM] WebGPU available:', gpuCheck.info);

        // Check if WebLLM is loaded
        if (typeof window.webllm === 'undefined') {
          throw new Error('WebLLM library not loaded. Add script tag: https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm');
        }

        isLoading = true;
        loadProgress = 0;
        EventBus.emit('local-llm:loading', { model: modelId, progress: 0 });

        // Create engine with progress callback
        const initProgressCallback = (report) => {
          loadProgress = report.progress || 0;
          logger.info(`[LocalLLM] Loading: ${(loadProgress * 100).toFixed(1)}% - ${report.text}`);

          EventBus.emit('local-llm:progress', {
            progress: loadProgress,
            text: report.text
          });
        };

        // Create engine instance
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

    /**
     * Generate completion (streaming, supports vision models with images)
     */
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

        // Format messages - support vision models with image inputs
        const formattedMessages = messages.map(msg => {
          // Check if message has images (for vision models)
          if (msg.images && Array.isArray(msg.images) && msg.images.length > 0) {
            // Multi-modal message format
            const content = [];

            // Add text part
            if (msg.content) {
              content.push({ type: 'text', text: msg.content });
            }

            // Add image parts
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
            // Text-only message
            return {
              role: msg.role,
              content: msg.content
            };
          }
        });

        // Generate with streaming
        const completion = await engine.chat.completions.create({
          messages: formattedMessages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 2048,
          stream: options.stream !== false, // Default to streaming
          stream_options: options.stream ? { include_usage: true } : undefined
        });

        if (options.stream) {
          // Return async generator for streaming
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

                // Check for final chunk with usage
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
          // Non-streaming response
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

    /**
     * Generate completion compatible with OpenAI API format
     */
    const complete = async (prompt, options = {}) => {
      const messages = [
        { role: 'user', content: prompt }
      ];

      return await chat(messages, options);
    };

    /**
     * Switch to a different model
     */
    const switchModel = async (modelId) => {
      logger.info('[LocalLLM] Switching model to:', modelId);

      // Unload current model
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

      // Load new model
      await init(modelId);
    };

    /**
     * Get available models
     */
    const getAvailableModels = () => {
      return ALTERNATIVE_MODELS.map(id => ({
        id,
        name: id.split('-MLC')[0],
        size: id.includes('1.5B') ? '~900MB' :
              id.includes('2b') ? '~1.2GB' :
              id.includes('3.5') ? '~2.1GB' : 'Unknown'
      }));
    };

    /**
     * Get current status
     */
    const getStatus = () => {
      return {
        ready: isReady,
        loading: isLoading,
        progress: loadProgress,
        model: currentModel,
        error: initError ? initError.message : null
      };
    };

    /**
     * Reset/unload engine
     */
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

    /**
     * Get runtime information
     */
    const getRuntimeInfo = async () => {
      const gpuCheck = await checkWebGPU();

      return {
        webgpu: gpuCheck,
        weblllm: typeof window.webllm !== 'undefined',
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

// Export standardized module
LocalLLM;
