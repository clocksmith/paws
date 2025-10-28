/**
 * @fileoverview Local LLM Runtime Module for REPLOID
 * Provides in-browser LLM inference via WebLLM with WebGPU acceleration.
 * Enables privacy-preserving, offline-first AI capabilities.
 *
 * Uses WebLLM v0.2.79+ from mlc-ai: https://github.com/mlc-ai/web-llm
 * Model library version: v0_2_48
 * Access full model catalog: window.webllm.prebuiltAppConfig.model_list
 *
 * @blueprint 0x000032 - Documents the local LLM runtime.
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
    // Note: These are fallback models. For the full catalog, use getWebLLMModels()
    // or access window.webllm.prebuiltAppConfig.model_list directly
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
          const msg = `WebGPU unavailable: ${gpuCheck.error}`;
          logger.warn(`[LocalLLM] ${msg}`);
          initError = msg;
          isReady = false;
          return { success: false, error: msg };
        }

        logger.info('[LocalLLM] WebGPU available:', gpuCheck.info);

        // Check if WebLLM is loaded
        if (typeof window.webllm === 'undefined') {
          const msg = 'WebLLM library not loaded - Local LLM mode unavailable';
          logger.warn(`[LocalLLM] ${msg}`);
          initError = msg;
          isReady = false;
          return { success: false, error: msg };
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

        // Don't throw - allow graceful degradation for cloud mode
        return { success: false, error: error.message };
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
     * Query WebLLM's prebuilt model catalog dynamically
     * @returns {Array} List of models from webllm.prebuiltAppConfig.model_list
     */
    const getWebLLMModels = () => {
      if (typeof window.webllm === 'undefined') {
        logger.debug('[LocalLLM] WebLLM not loaded, cannot query model catalog');
        return [];
      }

      try {
        const modelList = window.webllm.prebuiltAppConfig?.model_list;
        if (!modelList || !Array.isArray(modelList)) {
          logger.warn('[LocalLLM] prebuiltAppConfig.model_list not available');
          return [];
        }

        return modelList.map(model => ({
          id: model.model_id,
          vram: model.vram_required_MB ? `${model.vram_required_MB}MB` : 'Unknown',
          context: model.overrides?.context_window_size || model.context_window_size || 'Unknown',
          modelUrl: model.model || 'Unknown'
        }));
      } catch (error) {
        logger.error('[LocalLLM] Error querying WebLLM model catalog:', error);
        return [];
      }
    };

    /**
     * Get available models (prefers dynamic catalog, falls back to hard-coded list)
     */
    const getAvailableModels = () => {
      // Try dynamic model discovery first
      const dynamicModels = getWebLLMModels();
      if (dynamicModels.length > 0) {
        logger.debug(`[LocalLLM] Found ${dynamicModels.length} models in WebLLM catalog`);
        return dynamicModels;
      }

      // Fallback to hard-coded list
      logger.debug('[LocalLLM] Using hard-coded model list (WebLLM catalog unavailable)');
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

    // Track inference statistics
    const inferenceStats = {
      totalInferences: 0,
      totalTokens: 0,
      totalTime: 0,
      lastInferenceTime: null,
      lastTokensPerSecond: 0,
      errors: 0
    };

    let isGenerating = false;

    // Wrap chat to track stats
    const originalChat = chat;
    const trackedChat = async (messages, options = {}) => {
      isGenerating = true;
      const startTime = Date.now();

      try {
        const result = await originalChat(messages, options);
        const elapsed = Date.now() - startTime;

        // Track stats
        inferenceStats.totalInferences++;
        inferenceStats.totalTime += elapsed;
        inferenceStats.lastInferenceTime = elapsed;

        // Extract token info
        if (result.usage) {
          const tokens = result.usage.completion_tokens || result.usage.total_tokens || 0;
          inferenceStats.totalTokens += tokens;
          inferenceStats.lastTokensPerSecond = result.tokensPerSecond || (tokens / (elapsed / 1000));
        }

        isGenerating = false;
        return result;
      } catch (error) {
        inferenceStats.errors++;
        isGenerating = false;
        throw error;
      }
    };

    // Get GPU memory estimate (rough approximation)
    const getGPUMemoryEstimate = () => {
      if (!currentModel || !isReady) return { used: 0, percent: 0 };

      // Estimate VRAM usage based on model name
      let estimatedMB = 0;
      if (currentModel.includes('1.5B')) estimatedMB = 900;
      else if (currentModel.includes('2b')) estimatedMB = 1200;
      else if (currentModel.includes('3.5')) estimatedMB = 2100;
      else estimatedMB = 1500; // Default estimate

      // Assume 8GB total GPU memory (conservative)
      const totalMB = 8000;
      const percent = Math.round((estimatedMB / totalMB) * 100);

      return { used: estimatedMB, percent, total: totalMB };
    };

    // Web Component Widget
    class LocalLLMWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Dynamic update interval based on loading state
        this.startUpdates();
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      startUpdates() {
        if (this._interval) clearInterval(this._interval);

        // Fast updates while loading, slower when idle
        const interval = isLoading ? 500 : 5000;
        this._interval = setInterval(() => {
          this.render();

          // Adjust update speed if loading state changed
          if ((isLoading && interval !== 500) || (!isLoading && interval !== 5000)) {
            this.startUpdates();
          }
        }, interval);
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
          const gpuMem = getGPUMemoryEstimate();
          const avgTokensPerSec = inferenceStats.totalInferences > 0
            ? Math.round((inferenceStats.totalTokens / inferenceStats.totalTime) * 1000)
            : 0;

          let state = 'disabled';
          if (isLoading) state = 'loading';
          else if (isReady && isGenerating) state = 'active';
          else if (isReady) state = 'idle';
          else if (initError) state = 'error';

          return {
            state,
            primaryMetric: currentModel ? currentModel.split('-MLC')[0] : 'Not loaded',
            secondaryMetric: isReady ? `GPU: ${gpuMem.percent}%` :
                            isLoading ? `${Math.round(loadProgress * 100)}% loaded` :
                            'Not ready',
            lastActivity: inferenceStats.totalInferences > 0 ? Date.now() : null,
            message: initError ? `Error: ${initError}` :
                    isLoading ? 'Loading model...' : null
          };
        }

        getControls() {
          const controls = [];

          // Load model button (if not ready)
          if (!isReady && !isLoading) {
            controls.push({
              id: 'load-model',
              label: '⚡ Load Model',
              action: async () => {
                await init();
              }
            });
          }

          // Unload model button (if ready)
          if (isReady && !isGenerating) {
            controls.push({
              id: 'unload-model',
              label: '⛶️ Unload Model',
              action: async () => {
                await unload();
              }
            });
          }

          return controls;
        }

      renderPanel() {
        const gpuMem = getGPUMemoryEstimate();
        const models = getAvailableModels();
        const avgTime = inferenceStats.totalInferences > 0
          ? Math.round(inferenceStats.totalTime / inferenceStats.totalInferences)
          : 0;
        const avgTokensPerSec = inferenceStats.totalInferences > 0 && inferenceStats.totalTime > 0
          ? Math.round((inferenceStats.totalTokens / inferenceStats.totalTime) * 1000)
          : 0;

        return `
            <div class="widget-panel-content">
              <!-- Model Status -->
              <div class="model-status">
                <div class="status-badge ${isReady ? 'ready' : isLoading ? 'loading' : 'not-ready'}">
                  ${isReady ? '✓ Ready' : isLoading ? '⏳ Loading' : '○ Not Loaded'}
                </div>
                ${currentModel ? `
                  <div class="current-model">
                    <strong>Current Model:</strong> ${currentModel}
                  </div>
                ` : ''}
              </div>

              <!-- Loading Progress -->
              ${isLoading ? `
                <div class="loading-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" style="width: ${loadProgress * 100}%"></div>
                  </div>
                  <div class="progress-text">${Math.round(loadProgress * 100)}%</div>
                </div>
              ` : ''}

              <!-- GPU Memory -->
              ${isReady ? `
                <div class="gpu-memory">
                  <h4>GPU Memory Usage</h4>
                  <div class="memory-stats">
                    <div class="memory-bar">
                      <div class="memory-fill" style="width: ${gpuMem.percent}%"></div>
                    </div>
                    <div class="memory-text">
                      ${gpuMem.used}MB / ${gpuMem.total}MB (${gpuMem.percent}%)
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Inference Statistics -->
              ${inferenceStats.totalInferences > 0 ? `
                <div class="inference-stats">
                  <h4>Inference Statistics</h4>
                  <div class="stats-grid">
                    <div class="stat-item">
                      <div class="stat-number">${inferenceStats.totalInferences}</div>
                      <div class="stat-name">Total Inferences</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-number">${inferenceStats.totalTokens.toLocaleString()}</div>
                      <div class="stat-name">Tokens Generated</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-number">${avgTokensPerSec}</div>
                      <div class="stat-name">Avg Tokens/sec</div>
                    </div>
                    <div class="stat-item">
                      <div class="stat-number">${avgTime}ms</div>
                      <div class="stat-name">Avg Time</div>
                    </div>
                  </div>
                </div>
              ` : ''}

              <!-- Available Models -->
              <div class="available-models">
                <h4>Available Models (${models.length})</h4>
                <div class="model-list">
                  ${models.slice(0, 10).map(model => `
                    <div class="model-item ${model.id === currentModel ? 'current' : ''}">
                      <div class="model-name">${model.id || model.name || 'Unknown'}</div>
                      ${model.vram ? `<div class="model-size">VRAM: ${model.vram}</div>` : ''}
                      ${model.id === currentModel ? '<span class="model-badge">Current</span>' : ''}
                      ${!isLoading && model.id !== currentModel ? `
                        <button class="model-switch-btn" data-model-id="${model.id}">Load</button>
                      ` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- Error Display -->
              ${initError ? `
                <div class="error-message">
                  <strong>Error:</strong> ${initError}
                </div>
              ` : ''}
            </div>
        `;
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              background: rgba(255,255,255,0.03);
              border-radius: 8px;
              padding: 16px;
              color: #ccc;
              font-family: system-ui, -apple-system, sans-serif;
            }

            .model-switch-btn {
              padding: 4px 12px;
              background: rgba(100,150,255,0.2);
              border: 1px solid #6496ff;
              color: #6496ff;
              border-radius: 4px;
              cursor: pointer;
              font-size: 0.85em;
            }

            .model-switch-btn:hover {
              opacity: 0.8;
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up model switch buttons
        this.shadowRoot.querySelectorAll('.model-switch-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const modelId = btn.dataset.modelId;
            await switchModel(modelId);
            this.render();
          });
        });
      }
    }

    // Define custom element
    if (!customElements.get('local-llm-widget')) {
      customElements.define('local-llm-widget', LocalLLMWidget);
    }

    // Widget metadata
    const widget = {
      element: 'local-llm-widget',
      displayName: 'Local LLM (WebLLM)',
      icon: '⌨',
      category: 'ai',
      order: 35,
      updateInterval: 5000 // Base interval, widget will self-adjust
    };

    return {
      init,
      api: {
        chat: trackedChat,
        complete,
        switchModel,
        getAvailableModels,
        getWebLLMModels,
        getStatus,
        getRuntimeInfo,
        unload,
        isReady: () => isReady,
        isLoading: () => isLoading,
        getProgress: () => loadProgress,
        getCurrentModel: () => currentModel,
        getError: () => initError,
        checkWebGPU,
        getInferenceStats: () => ({ ...inferenceStats })
      },
      widget
    };
  }
};

// Export standardized module
export default LocalLLM;
