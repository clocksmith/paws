/**
 * @fileoverview Hybrid LLM Provider for REPLOID
 * Provides unified interface for local WebLLM and cloud API providers.
 * Enables seamless switching between local-first and cloud-based inference.
 *
 * @blueprint 0x000033 - Explains hybrid LLM orchestration.
 * @module HybridLLMProvider
 * @version 1.0.0
 * @category agent
 */

const HybridLLMProvider = {
  metadata: {
    id: 'HybridLLMProvider',
    version: '1.0.0',
    dependencies: ['config', 'Utils', 'EventBus', 'Storage', 'LocalLLM?', 'ApiClient', 'StreamingResponseHandler?'],
    async: true,
    type: 'agent'
  },

  factory: (deps) => {
    const { config, Utils, EventBus, Storage, LocalLLM, ApiClient, StreamingResponseHandler } = deps;
    const { logger } = Utils;

    let useLocal = false; // Default to cloud

    /**
     * Initialize hybrid provider
     */
    const init = async () => {
      logger.info('[HybridLLM] Initializing hybrid LLM provider');

      // Check if local LLM is available and ready
      if (LocalLLM && LocalLLM.isReady()) {
        logger.info('[HybridLLM] Local LLM is available and ready');
      }

      // Listen for local LLM readiness changes
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

    /**
     * Set inference mode (local or cloud)
     */
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

    /**
     * Get current mode
     */
    const getMode = () => {
      return useLocal ? 'local' : 'cloud';
    };

    /**
     * Check if local mode is available
     */
    const isLocalAvailable = () => {
      return LocalLLM && LocalLLM.isReady();
    };

    /**
     * Generate completion using current mode
     */
    const complete = async (messages, options = {}) => {
      const mode = useLocal ? 'local' : 'cloud';

      logger.debug(`[HybridLLM] Generating completion using ${mode} mode`, {
        messages: messages.length
      });

      try {
        if (useLocal && LocalLLM && LocalLLM.isReady()) {
          // Use local LLM
          return await completeLocal(messages, options);
        } else {
          // Use cloud API
          if (!ApiClient) {
            throw new Error('Cloud API client not available');
          }

          return await completeCloud(messages, options);
        }
      } catch (error) {
        logger.error(`[HybridLLM] ${mode} completion failed:`, {
          name: error.name,
          message: error.message,
          code: error.code,
          stack: error.stack
        });

        // Auto-fallback: if local fails, try cloud
        if (useLocal && ApiClient) {
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

    /**
     * Generate completion using local LLM
     */
    const completeLocal = async (messages, options = {}) => {
      const startTime = Date.now();

      // Format messages for WebLLM
      const formattedMessages = messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Generate with local LLM
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

      // Convert to standard format
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

    /**
     * Generate completion using cloud API
     */
    const completeCloud = async (messages, options = {}) => {
      // Format messages for Gemini API (needs 'parts' array with 'text' property)
      const history = messages.map(msg => ({
        role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't support 'system' role
        parts: [{ text: msg.content }]
      }));

      logger.info('[HybridLLM] Calling Gemini API via ApiClient (proxy mode)');

      // Call ApiClient - it will automatically use proxy if available
      // The proxy server has the API key from environment variables
      const response = await ApiClient.callApiWithRetry(history, null);

      // Extract text from response
      const text = response.content || '';

      logger.info('[HybridLLM] Cloud completion generated', {
        type: response.type,
        length: text.length
      });

      return {
        text,
        usage: {
          promptTokens: 0,  // Gemini doesn't always return usage in our current setup
          completionTokens: 0,
          totalTokens: 0
        },
        model: options.model || 'gemini-2.5-flash',
        provider: 'cloud'
      };
    };

    /**
     * Generate streaming completion
     * Supports real HTTP/2 streaming for both local and cloud providers
     */
    const stream = async function* (messages, options = {}) {
      if (useLocal && LocalLLM && LocalLLM.isReady()) {
        // Local streaming via WebLLM
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
        // Cloud streaming via HTTP/2 + Server-Sent Events
        if (!StreamingResponseHandler) {
          // Fallback to simulation if StreamingResponseHandler not available
          logger.warn('[HybridLLM] StreamingResponseHandler not available, falling back to simulated streaming');
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
        } else {
          // Real HTTP/2 streaming
          const history = messages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role,
            parts: [{ text: msg.content }]
          }));

          logger.info('[HybridLLM] Starting cloud streaming via HTTP/2 + SSE');

          let fullText = '';
          let chunkCount = 0;

          try {
            // Call ApiClient.callApiWithStreaming to get Response object
            const response = await ApiClient.callApiWithStreaming(history, null);

            // Read the stream directly
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
              const { done, value } = await reader.read();

              if (done) {
                logger.info('[HybridLLM] Cloud streaming completed', {
                  totalLength: fullText.length,
                  chunks: chunkCount
                });
                break;
              }

              // Decode the chunk
              buffer += decoder.decode(value, { stream: true });

              // Process SSE format (data: prefix)
              const lines = buffer.split('\n');
              buffer = lines.pop() || ''; // Keep incomplete line in buffer

              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  const jsonStr = line.slice(6).trim();
                  if (jsonStr === '[DONE]') continue;

                  try {
                    const parsed = JSON.parse(jsonStr);
                    // Extract text from Gemini streaming format
                    const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';

                    if (text) {
                      fullText += text;
                      chunkCount++;

                      // Emit event for UI updates
                      EventBus.emit('hybrid-llm:stream-chunk', {
                        chunk: text,
                        total: fullText,
                        chunkCount,
                        provider: 'cloud'
                      });

                      // Yield the chunk
                      yield {
                        delta: text,
                        text: fullText,
                        done: false,
                        provider: 'cloud'
                      };
                    }
                  } catch (parseError) {
                    logger.warn('[HybridLLM] Failed to parse SSE chunk', { jsonStr });
                  }
                }
              }
            }

            // Emit completion event
            EventBus.emit('hybrid-llm:stream-complete', {
              text: fullText,
              chunkCount,
              provider: 'cloud'
            });

            // Final yield with complete result
            yield {
              delta: '',
              text: fullText,
              done: true,
              provider: 'cloud',
              usage: {
                promptTokens: 0,
                completionTokens: 0,
                totalTokens: 0
              }
            };
          } catch (error) {
            logger.error('[HybridLLM] Cloud streaming failed', error);

            // Emit error event
            EventBus.emit('hybrid-llm:stream-error', {
              error: error.message,
              provider: 'cloud'
            });

            throw error;
          }
        }
      }
    };

    /**
     * Get provider status
     */
    const getStatus = () => {
      return {
        mode: getMode(),
        localAvailable: isLocalAvailable(),
        cloudAvailable: !!ApiClient && !!config?.api?.gemini?.apiKey,
        localModel: LocalLLM?.getCurrentModel?.() || null,
        localReady: LocalLLM?.isReady?.() || false
      };
    };

    /**
     * Get configuration for auto-switching
     */
    const getAutoSwitchConfig = () => {
      return {
        enabled: false, // User must manually switch for now
        fallbackToCloud: true, // Always fallback if local fails
        preferLocal: useLocal
      };
    };

    // Track usage statistics
    const usageStats = {
      local: { requests: 0, tokens: 0, errors: 0, totalTime: 0 },
      cloud: { requests: 0, tokens: 0, errors: 0, totalTime: 0 },
      fallbacks: [],
      switchHistory: []
    };

    let isGenerating = false;

    // Wrap complete to track stats
    const originalComplete = complete;
    const trackedComplete = async (messages, options) => {
      isGenerating = true;
      const mode = getMode();
      const startTime = Date.now();

      try {
        const result = await originalComplete(messages, options);
        const elapsed = Date.now() - startTime;

        // Track successful completion
        usageStats[mode].requests++;
        usageStats[mode].tokens += (result.usage?.totalTokens || 0);
        usageStats[mode].totalTime += elapsed;

        isGenerating = false;
        return result;
      } catch (error) {
        usageStats[mode].errors++;
        isGenerating = false;
        throw error;
      }
    };

    // Wrap setMode to track switches
    const originalSetMode = setMode;
    const trackedSetMode = (mode) => {
      const oldMode = getMode();
      const result = originalSetMode(mode);

      if (result && oldMode !== mode) {
        usageStats.switchHistory.unshift({
          from: oldMode,
          to: mode,
          timestamp: Date.now(),
          manual: true
        });

        // Keep last 20 switches
        if (usageStats.switchHistory.length > 20) {
          usageStats.switchHistory = usageStats.switchHistory.slice(0, 20);
        }
      }

      return result;
    };

    // Track fallbacks
    EventBus.on('hybrid-llm:fallback', ({ from, to, error }) => {
      usageStats.fallbacks.unshift({
        from,
        to,
        error,
        timestamp: Date.now()
      });

      usageStats.switchHistory.unshift({
        from,
        to,
        timestamp: Date.now(),
        manual: false
      });

      // Keep last 20
      if (usageStats.fallbacks.length > 20) {
        usageStats.fallbacks = usageStats.fallbacks.slice(0, 20);
      }
      if (usageStats.switchHistory.length > 20) {
        usageStats.switchHistory = usageStats.switchHistory.slice(0, 20);
      }
    });

    // Web Component Widget
    class HybridLLMProviderWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Auto-refresh every 5 seconds
        this._interval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        if (seconds < 60) return `${seconds}s ago`;
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        return new Date(timestamp).toLocaleDateString();
      }

      getStatus() {
        const mode = getMode();
        const status = getStatus();
        const stats = usageStats;
        const totalTokens = stats.local.tokens + stats.cloud.tokens;

        return {
          state: isGenerating ? 'active' : 'idle',
          primaryMetric: mode === 'local' ? '⌨ Local' : '☁️ Cloud',
          secondaryMetric: `${totalTokens.toLocaleString()} tokens`,
          lastActivity: stats.switchHistory.length > 0 ? stats.switchHistory[0].timestamp : null,
          message: !status.localAvailable && mode === 'local' ? 'Local LLM not ready' : null
        };
      }

      renderPanel() {
        const mode = getMode();
        const status = getStatus();
        const stats = usageStats;
        const localAvg = stats.local.requests > 0
          ? Math.round(stats.local.totalTime / stats.local.requests)
          : 0;
        const cloudAvg = stats.cloud.requests > 0
          ? Math.round(stats.cloud.totalTime / stats.cloud.requests)
          : 0;

        return `
          <!-- Current Provider -->
          <div style="margin-bottom: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-radius: 6px;">
            <div style="font-size: 1.2em; font-weight: bold; margin-bottom: 8px;">
              ${mode === 'local' ? '⌨ Local Mode' : '☁️ Cloud Mode'}
            </div>
            <div style="font-size: 0.9em; color: #888;">
              ${status.localModel ? `Model: ${status.localModel}` : 'Cloud: Gemini'}
            </div>

            <!-- Switch Buttons -->
            <div style="margin-top: 12px; display: flex; gap: 8px;">
              ${mode === 'cloud' && status.localAvailable ? `
                <button class="switch-btn" data-mode="local" style="flex: 1; padding: 8px; background: rgba(0,255,0,0.2); border: 1px solid #0f0; color: #0f0; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
                  ⌨ Switch to Local
                </button>
              ` : ''}
              ${mode === 'local' ? `
                <button class="switch-btn" data-mode="cloud" style="flex: 1; padding: 8px; background: rgba(100,150,255,0.2); border: 1px solid #6496ff; color: #6496ff; border-radius: 4px; cursor: pointer; font-size: 0.9em;">
                  ☁️ Switch to Cloud
                </button>
              ` : ''}
            </div>
          </div>

          <!-- Provider Comparison -->
          <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 1em; color: #0ff;">Provider Statistics</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 0.9em;">
              <thead>
                <tr style="background: rgba(255,255,255,0.1);">
                  <th style="text-align: left; padding: 8px; color: #aaa;">Provider</th>
                  <th style="text-align: right; padding: 8px; color: #aaa;">Requests</th>
                  <th style="text-align: right; padding: 8px; color: #aaa;">Tokens</th>
                  <th style="text-align: right; padding: 8px; color: #aaa;">Avg Time</th>
                  <th style="text-align: right; padding: 8px; color: #aaa;">Errors</th>
                </tr>
              </thead>
              <tbody>
                <tr style="${mode === 'local' ? 'background: rgba(0,255,0,0.1);' : ''}">
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1);">⌨ Local</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${stats.local.requests}</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${stats.local.tokens.toLocaleString()}</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${localAvg}ms</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right; color: ${stats.local.errors > 0 ? '#f66' : '#0f0'};">${stats.local.errors}</td>
                </tr>
                <tr style="${mode === 'cloud' ? 'background: rgba(100,150,255,0.1);' : ''}">
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1);">☁️ Cloud</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${stats.cloud.requests}</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${stats.cloud.tokens.toLocaleString()}</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right;">${cloudAvg}ms</td>
                  <td style="padding: 8px; border-top: 1px solid rgba(255,255,255,0.1); text-align: right; color: ${stats.cloud.errors > 0 ? '#f66' : '#0f0'};">${stats.cloud.errors}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Availability Status -->
          <div style="margin-bottom: 16px;">
            <h4 style="margin: 0 0 12px 0; font-size: 1em; color: #0ff;">Provider Availability</h4>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <div style="display: flex; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <span style="margin-right: 8px; color: ${status.localReady ? '#0f0' : '#f66'};">${status.localReady ? '✓' : '✗'}</span>
                <span style="flex: 1;">Local LLM</span>
                ${status.localModel ? `<span style="color: #888; font-size: 0.85em;">${status.localModel}</span>` : ''}
              </div>
              <div style="display: flex; align-items: center; padding: 8px; background: rgba(255,255,255,0.05); border-radius: 4px;">
                <span style="margin-right: 8px; color: ${status.cloudAvailable ? '#0f0' : '#f66'};">${status.cloudAvailable ? '✓' : '✗'}</span>
                <span style="flex: 1;">Cloud API</span>
                <span style="color: #888; font-size: 0.85em;">Gemini</span>
              </div>
            </div>
          </div>

          <!-- Fallback History -->
          ${stats.fallbacks.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <h4 style="margin: 0 0 12px 0; font-size: 1em; color: #0ff;">Recent Fallbacks</h4>
              <div style="max-height: 150px; overflow-y: auto;">
                ${stats.fallbacks.slice(0, 5).map(fb => `
                  <div style="padding: 6px 8px; background: rgba(255,100,100,0.1); border-radius: 4px; margin-bottom: 4px; font-size: 0.85em;">
                    <div style="color: #ffa500;">${fb.from} → ${fb.to}</div>
                    <div style="color: #888; margin-top: 2px;">${this.formatTime(fb.timestamp)}: ${fb.error}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Switch History -->
          ${stats.switchHistory.length > 0 ? `
            <div style="margin-bottom: 16px;">
              <h4 style="margin: 0 0 12px 0; font-size: 1em; color: #0ff;">Mode Switch History</h4>
              <div style="max-height: 150px; overflow-y: auto;">
                ${stats.switchHistory.slice(0, 5).map(sw => `
                  <div style="padding: 6px 8px; background: rgba(255,255,255,0.03); border-radius: 4px; margin-bottom: 4px; font-size: 0.85em; display: flex; justify-content: space-between;">
                    <span>${sw.from} → ${sw.to}</span>
                    <span style="color: #888;">${this.formatTime(sw.timestamp)}</span>
                    <span style="color: ${sw.manual ? '#6496ff' : '#ffa500'};">${sw.manual ? 'Manual' : 'Auto'}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
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

            h4 {
              margin: 0 0 12px 0;
              font-size: 1em;
              color: #0ff;
            }

            .switch-btn:hover {
              opacity: 0.8;
            }
          </style>

          <div class="widget-content">
            ${this.renderPanel()}
          </div>
        `;

        // Wire up switch buttons
        this.shadowRoot.querySelectorAll('.switch-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const targetMode = btn.dataset.mode;
            trackedSetMode(targetMode);
            this.render(); // Re-render after mode switch
          });
        });
      }
    }

    // Define custom element
    if (!customElements.get('hybrid-llm-provider-widget')) {
      customElements.define('hybrid-llm-provider-widget', HybridLLMProviderWidget);
    }

    // Widget metadata
    const widget = {
      element: 'hybrid-llm-provider-widget',
      displayName: 'Hybrid LLM Provider',
      icon: '⚌',
      category: 'ai',
      order: 30,
      updateInterval: 5000
    };

    return {
      init,
      api: {
        setMode: trackedSetMode,
        getMode,
        isLocalAvailable,
        complete: trackedComplete,
        stream,
        getStatus,
        getAutoSwitchConfig,
        getUsageStats: () => ({ ...usageStats }),
        // Expose direct methods for advanced use
        completeLocal,
        completeCloud
      },
      widget
    };
  }
};

// Export standardized module
export default HybridLLMProvider;
