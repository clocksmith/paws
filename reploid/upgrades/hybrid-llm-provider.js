/**
 * @fileoverview Hybrid LLM Provider for REPLOID
 * Provides unified interface for local WebLLM and cloud API providers.
 * Enables seamless switching between local-first and cloud-based inference.
 *
 * @module HybridLLMProvider
 * @version 1.0.0
 * @category agent
 */

const HybridLLMProvider = {
  metadata: {
    id: 'HybridLLMProvider',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'StateManager', 'LocalLLM'],
    async: true,
    type: 'agent'
  },

  factory: (deps) => {
    const { Utils, EventBus, StateManager, LocalLLM } = deps;
    const { logger } = Utils;

    let useLocal = false; // Default to cloud
    let cloudAPIClient = null;

    /**
     * Initialize hybrid provider
     */
    const init = async (apiClient) => {
      logger.info('[HybridLLM] Initializing hybrid LLM provider');
      cloudAPIClient = apiClient;

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
          if (!cloudAPIClient) {
            throw new Error('Cloud API client not initialized');
          }

          return await completeCloud(messages, options);
        }
      } catch (error) {
        logger.error(`[HybridLLM] ${mode} completion failed:`, error);

        // Auto-fallback: if local fails, try cloud
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
      // Use existing cloud API client
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

      // Extract text from response
      const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Get usage metadata
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

    /**
     * Generate streaming completion (only supported with local for now)
     */
    const stream = async function* (messages, options = {}) {
      if (useLocal && LocalLLM && LocalLLM.isReady()) {
        // Local streaming
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
        // Cloud streaming simulation - chunk the response for progressive display
        const result = await completeCloud(messages, options);

        // Simulate streaming by yielding chunks of the text
        const chunkSize = 50; // Characters per chunk
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

          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        // Final chunk with usage metadata
        yield {
          delta: '',
          text: result.text,
          done: true,
          provider: 'cloud',
          usage: result.usage
        };
      }
    };

    /**
     * Get provider status
     */
    const getStatus = () => {
      return {
        mode: getMode(),
        localAvailable: isLocalAvailable(),
        cloudAvailable: !!cloudAPIClient,
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
        // Expose direct methods for advanced use
        completeLocal,
        completeCloud
      }
    };
  }
};

// Export standardized module
HybridLLMProvider;
