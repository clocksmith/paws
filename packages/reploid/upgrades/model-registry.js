/**
 * @fileoverview Model Registry for REPLOID
 *
 * Provides runtime discovery and enumeration of available models across
 * all providers (cloud APIs, local Ollama, WebLLM).
 *
 * @module ModelRegistry
 * @version 1.0.0
 * @category core
 * @blueprint 0x000067
 */

const ModelRegistry = {
  metadata: {
    id: 'ModelRegistry',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'Config'],
    async: true,
    type: 'core'
  },

  factory: (deps) => {
    const { Utils, EventBus, Config } = deps;
    const { logger } = Utils;

    // Cached model registry
    let _cachedModels = null;
    let _lastUpdate = 0;
    const CACHE_TTL = 60000; // 1 minute

    /**
     * Static cloud model definitions from config
     */
    const getStaticCloudModels = () => {
      return {
        gemini: [
          {
            id: Config.api.get('api.geminiModelFast') || 'gemini-2.5-flash-lite',
            name: 'Gemini 2.5 Flash Lite',
            provider: 'gemini',
            tier: 'fast',
            contextWindow: 1000000,
            available: true
          },
          {
            id: Config.api.get('api.geminiModelBalanced') || 'gemini-2.5-flash',
            name: 'Gemini 2.5 Flash',
            provider: 'gemini',
            tier: 'balanced',
            contextWindow: 1000000,
            available: true
          }
        ],
        openai: [
          {
            id: Config.api.get('api.openaiModelFast') || 'gpt-5-2025-08-07-mini',
            name: 'GPT-5 Mini',
            provider: 'openai',
            tier: 'fast',
            contextWindow: 128000,
            available: true
          },
          {
            id: Config.api.get('api.openaiModelAdvanced') || 'gpt-5-2025-08-07',
            name: 'GPT-5',
            provider: 'openai',
            tier: 'advanced',
            contextWindow: 128000,
            available: true
          }
        ],
        anthropic: [
          {
            id: Config.api.get('api.anthropicModelFast') || 'claude-4-5-haiku',
            name: 'Claude 4.5 Haiku',
            provider: 'anthropic',
            tier: 'fast',
            contextWindow: 200000,
            available: true
          },
          {
            id: Config.api.get('api.anthropicModelBalanced') || 'claude-4-5-sonnet',
            name: 'Claude 4.5 Sonnet',
            provider: 'anthropic',
            tier: 'balanced',
            contextWindow: 200000,
            available: true
          }
        ]
      };
    };

    /**
     * Check proxy server for available providers
     */
    const checkProxyProviders = async () => {
      try {
        const response = await fetch('/api/proxy-status', {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });

        if (response.ok) {
          const data = await response.json();
          return data.providers || {};
        }
      } catch (error) {
        logger.warn('[ModelRegistry] Proxy check failed:', error.message);
      }

      return {};
    };

    /**
     * Check localStorage for cloud API keys (browser-only mode)
     */
    const checkLocalStorageKeys = () => {
      if (typeof localStorage === 'undefined') return {};

      return {
        gemini: !!localStorage.getItem('GEMINI_API_KEY'),
        openai: !!localStorage.getItem('OPENAI_API_KEY'),
        anthropic: !!localStorage.getItem('ANTHROPIC_API_KEY')
      };
    };

    /**
     * Fetch available Ollama models from proxy
     */
    const fetchOllamaModels = async () => {
      try {
        const response = await fetch('/api/ollama/models', {
          method: 'GET',
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
          const data = await response.json();
          return (data.models || []).map(model => ({
            id: model.name,
            name: model.name,
            provider: 'ollama',
            tier: 'local',
            size: model.size,
            modified: model.modified,
            available: true
          }));
        }
      } catch (error) {
        logger.warn('[ModelRegistry] Ollama check failed:', error.message);
      }

      return [];
    };

    /**
     * Get WebLLM models (browser-only)
     */
    const getWebLLMModels = () => {
      if (typeof window === 'undefined' || !window.webllm) {
        return [];
      }

      const defaultModels = [
        'Qwen2.5-Coder-1.5B-Instruct-q4f16_1-MLC',
        'Phi-3.5-mini-instruct-q4f16_1-MLC',
        'Llama-3.2-1B-Instruct-q4f16_1-MLC',
        'gemma-2-2b-it-q4f16_1-MLC'
      ];

      return defaultModels.map(modelId => ({
        id: modelId,
        name: modelId.replace(/-q4f16_1-MLC$/, ''),
        provider: 'webllm',
        tier: 'browser',
        available: true
      }));
    };

    /**
     * Discover all available models across all providers
     * @param {boolean} forceRefresh - Force cache refresh
     * @returns {Promise<Object>} Model registry organized by provider
     */
    const discoverModels = async (forceRefresh = false) => {
      const now = Date.now();

      // Return cached if still fresh
      if (!forceRefresh && _cachedModels && (now - _lastUpdate) < CACHE_TTL) {
        logger.debug('[ModelRegistry] Returning cached models');
        return _cachedModels;
      }

      logger.info('[ModelRegistry] Discovering available models...');

      const registry = {
        gemini: [],
        openai: [],
        anthropic: [],
        ollama: [],
        webllm: [],
        metadata: {
          timestamp: now,
          providers: []
        }
      };

      // Check which providers are available
      const proxyProviders = await checkProxyProviders();
      const localStorageKeys = checkLocalStorageKeys();
      const availableProviders = {
        gemini: proxyProviders.gemini || localStorageKeys.gemini || false,
        openai: proxyProviders.openai || localStorageKeys.openai || false,
        anthropic: proxyProviders.anthropic || localStorageKeys.anthropic || false,
        ollama: proxyProviders.local || false,
        webllm: typeof window !== 'undefined' && 'gpu' in navigator
      };

      logger.info('[ModelRegistry] Available providers:', availableProviders);

      // Get static cloud models
      const cloudModels = getStaticCloudModels();

      // Add cloud models if providers are available
      if (availableProviders.gemini) {
        registry.gemini = cloudModels.gemini;
        registry.metadata.providers.push('gemini');
      }

      if (availableProviders.openai) {
        registry.openai = cloudModels.openai;
        registry.metadata.providers.push('openai');
      }

      if (availableProviders.anthropic) {
        registry.anthropic = cloudModels.anthropic;
        registry.metadata.providers.push('anthropic');
      }

      // Fetch Ollama models if available
      if (availableProviders.ollama) {
        registry.ollama = await fetchOllamaModels();
        if (registry.ollama.length > 0) {
          registry.metadata.providers.push('ollama');
        }
      }

      // Get WebLLM models if available
      if (availableProviders.webllm) {
        registry.webllm = getWebLLMModels();
        if (registry.webllm.length > 0) {
          registry.metadata.providers.push('webllm');
        }
      }

      // Cache results
      _cachedModels = registry;
      _lastUpdate = now;

      logger.info(`[ModelRegistry] Discovered ${Object.values(registry).flat().length} models across ${registry.metadata.providers.length} providers`);

      EventBus.emit('model-registry:updated', {
        providers: registry.metadata.providers,
        totalModels: Object.keys(registry).reduce((sum, key) => {
          return sum + (Array.isArray(registry[key]) ? registry[key].length : 0);
        }, 0),
        timestamp: now
      });

      return registry;
    };

    /**
     * Get all available models as a flat list
     * @param {Object} options - Filter options
     * @returns {Promise<Array>} Flat list of available models
     */
    const getAllModels = async (options = {}) => {
      const registry = await discoverModels(options.forceRefresh);
      const { provider, tier } = options;

      let models = [];

      // Collect all models
      ['gemini', 'openai', 'anthropic', 'ollama', 'webllm'].forEach(p => {
        if (registry[p] && Array.isArray(registry[p])) {
          models = models.concat(registry[p]);
        }
      });

      // Apply filters
      if (provider) {
        models = models.filter(m => m.provider === provider);
      }

      if (tier) {
        models = models.filter(m => m.tier === tier);
      }

      return models;
    };

    /**
     * Get model IDs only (for dropdowns, etc.)
     * @param {Object} options - Filter options
     * @returns {Promise<Array<string>>} Array of model IDs
     */
    const getModelIds = async (options = {}) => {
      const models = await getAllModels(options);
      return models.map(m => m.id);
    };

    /**
     * Get model by ID
     * @param {string} modelId - Model identifier
     * @returns {Promise<Object|null>} Model object or null
     */
    const getModel = async (modelId) => {
      const models = await getAllModels();
      return models.find(m => m.id === modelId) || null;
    };

    /**
     * Get recommended judge model
     * Prioritizes: Claude Sonnet > GPT-5 > Gemini Flash > First available
     * @returns {Promise<string>} Model ID
     */
    const getRecommendedJudge = async () => {
      const models = await getAllModels();

      // Priority list
      const priorities = [
        'claude-4-5-sonnet',
        'gpt-5-2025-08-07',
        'gemini-2.5-flash',
        'claude-4-5-haiku',
        'gpt-5-2025-08-07-mini'
      ];

      for (const modelId of priorities) {
        if (models.some(m => m.id === modelId)) {
          return modelId;
        }
      }

      // Fallback to first available model
      return models.length > 0 ? models[0].id : 'claude-4-5-sonnet';
    };

    /**
     * Clear cache and force refresh on next request
     */
    const clearCache = () => {
      _cachedModels = null;
      _lastUpdate = 0;
      logger.info('[ModelRegistry] Cache cleared');
    };

    // Module initialization
    const init = async () => {
      logger.info('[ModelRegistry] Initialized');

      // Initial discovery (don't wait)
      discoverModels().catch(error => {
        logger.error('[ModelRegistry] Initial discovery failed:', error);
      });

      return true;
    };

    // Public API
    return {
      metadata: ModelRegistry.metadata,
      api: {
        init,
        discoverModels,
        getAllModels,
        getModelIds,
        getModel,
        getRecommendedJudge,
        clearCache
      }
    };
  }
};

// Register with module registry if available
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ModelRegistry);
}

export default ModelRegistry;
