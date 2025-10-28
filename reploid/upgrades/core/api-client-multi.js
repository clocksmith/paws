/**
 * @fileoverview Enhanced API Client Module with Multi-Provider Support
 * Handles communication with Gemini, OpenAI, Anthropic, and Local models.
 * Includes automatic retry logic with exponential backoff for reliability.
 *
 * @blueprint 0x000021 - Describes the multi-provider API gateway for LLM traffic.
 * @module ApiClientMulti
 * @version 2.1.0
 * @category service
 */

const ApiClientMulti = {
  metadata: {
    id: 'ApiClientMulti',
    version: '2.0.0',
    dependencies: ['config', 'Utils', 'StateManager'],
    async: false,
    type: 'service'
  },
  
  factory: (deps) => {
    // Validate dependencies
    const { config, Utils, StateManager } = deps;
    const { logger, Errors } = Utils;
    
    if (!config || !logger || !Errors || !Utils || !StateManager) {
      throw new Error('ApiClientMulti: Missing required dependencies');
    }
    
    // Extract error classes
    const { ApiError, AbortError } = Errors;
    
    // Module state
    let currentAbortController = null;
    let proxyStatus = null;
    let proxyChecked = false;
    let currentProvider = 'gemini'; // Default provider

    // Widget tracking state
    const _apiCallHistory = [];
    const _providerStats = {
      gemini: { calls: 0, successes: 0, failures: 0, retries: 0 },
      openai: { calls: 0, successes: 0, failures: 0, retries: 0 },
      anthropic: { calls: 0, successes: 0, failures: 0, retries: 0 },
      local: { calls: 0, successes: 0, failures: 0, retries: 0 }
    };
    let _lastActivity = null;
    
    /**
     * Check proxy server availability and supported providers
     * @returns {Promise<Object|null>} Proxy status object or null if unavailable
     */
    const checkProxyAvailability = async () => {
      if (proxyChecked) return proxyStatus;
      
      try {
        const response = await fetch('/api/proxy-status');
        if (response.ok) {
          proxyStatus = await response.json();
          logger.info(`Proxy detected with providers: ${JSON.stringify(proxyStatus.providers)}`);
          
          // Auto-select best available provider
          if (!config.apiProvider) {
            if (proxyStatus.providers.gemini) {
              currentProvider = 'gemini';
            } else if (proxyStatus.providers.openai) {
              currentProvider = 'openai';
            } else if (proxyStatus.providers.anthropic) {
              currentProvider = 'anthropic';
            } else {
              currentProvider = 'local';
            }
            logger.info(`Auto-selected provider: ${currentProvider}`);
          }
        }
      } catch (e) {
        // Proxy not available, use direct API if configured
        proxyStatus = null;
        logger.warn('Proxy not available, will use direct API if configured');
      }
      proxyChecked = true;
      return proxyStatus;
    };
    
    // Convert messages to provider-specific format
    const formatMessagesForProvider = (messages, provider) => {
      switch (provider) {
        case 'gemini':
          return messages.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role,
            parts: [{ text: msg.content || '' }]
          }));
        
        case 'openai':
        case 'anthropic':
          return messages;
        
        case 'local':
          // Format for Ollama-style API
          return messages.map(msg => ({
            role: msg.role,
            content: msg.content || ''
          }));
        
        default:
          return messages;
      }
    };
    
    // Build request body for each provider
    const buildRequestBody = (messages, provider, options = {}) => {
      const formattedMessages = formatMessagesForProvider(messages, provider);
      
      switch (provider) {
        case 'gemini':
          const geminiBody = {
            contents: formattedMessages,
            safetySettings: [
              "HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"
            ].map(cat => ({ 
              category: `HARM_CATEGORY_${cat}`, 
              threshold: "BLOCK_ONLY_HIGH" 
            })),
            generationConfig: {
              temperature: options.temperature || 1.0,
              maxOutputTokens: options.maxTokens || 8192,
              responseMimeType: options.expectJson ? "application/json" : "text/plain"
            }
          };
          
          if (options.tools && options.tools.length > 0) {
            geminiBody.tools = [{ functionDeclarations: options.tools }];
            geminiBody.tool_config = { function_calling_config: { mode: "AUTO" } };
            delete geminiBody.generationConfig.responseMimeType;
          }
          
          return geminiBody;
        
        case 'openai':
          return {
            model: options.model || 'gpt-5-2025-08-07',
            messages: formattedMessages,
            temperature: options.temperature || 1.0,
            max_tokens: options.maxTokens || 8192
          };
        
        case 'anthropic':
          const systemMessage = formattedMessages.find(m => m.role === 'system');
          const otherMessages = formattedMessages.filter(m => m.role !== 'system');
          
          return {
            model: options.model || 'claude-4-5-sonnet',
            system: systemMessage?.content || '',
            messages: otherMessages,
            max_tokens: options.maxTokens || 8192,
            temperature: options.temperature || 1.0
          };
        
        case 'local':
          // Ollama format
          const defaultModel = config?.ollama?.defaultModel || process.env.DEFAULT_LOCAL_MODEL || 'gpt-oss:120b';
          return {
            model: options.model || defaultModel,
            messages: formattedMessages,
            stream: options.stream !== undefined ? options.stream : true,
            options: {
              temperature: options.temperature || config?.ollama?.temperature || 1.0,
              num_predict: options.maxTokens || config?.ollama?.maxTokens || 8192
            }
          };
        
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    };
    
    // Parse response from each provider
    const parseProviderResponse = (data, provider) => {
      switch (provider) {
        case 'gemini':
          if (!data.candidates || data.candidates.length === 0) {
            if (data.promptFeedback && data.promptFeedback.blockReason) {
              throw new ApiError(
                `Request blocked: ${data.promptFeedback.blockReason}`, 
                400, 
                "PROMPT_BLOCK", 
                data.promptFeedback
              );
            }
            throw new ApiError("API returned no candidates.", 500, "NO_CANDIDATES");
          }
          
          const candidate = data.candidates[0];
          const part = candidate.content.parts[0];
          
          if (part.text) {
            return {
              type: "text",
              content: part.text,
              rawResp: data
            };
          } else if (part.functionCall) {
            return {
              type: "functionCall",
              content: part.functionCall,
              rawResp: data
            };
          }
          
          return {
            type: "empty",
            content: "",
            rawResp: data
          };
        
        case 'openai':
          const choice = data.choices?.[0];
          if (!choice) {
            throw new ApiError('No response from OpenAI', 500);
          }
          
          return {
            type: choice.message?.tool_calls ? "functionCall" : "text",
            content: choice.message?.tool_calls?.[0]?.function || choice.message?.content || "",
            rawResp: data
          };
        
        case 'anthropic':
          if (data.content?.[0]?.text) {
            return {
              type: "text",
              content: data.content[0].text,
              rawResp: data
            };
          }
          throw new ApiError('Unexpected response format from Anthropic', 500);
        
        case 'local':
          if (data.message?.content || data.response) {
            return {
              type: "text",
              content: data.message?.content || data.response || "",
              rawResp: data
            };
          }
          throw new ApiError('Unexpected response format from local model', 500);
        
        default:
          throw new Error(`Unknown provider: ${provider}`);
      }
    };
    
    /**
     * Main API call function with exponential backoff retry
     * Automatically retries on retriable errors (429, 500-504) with increasing delays
     * @param {Array} history - Message history array
     * @param {string} apiKey - API key for authentication
     * @param {Array} funcDecls - Function declarations for tool calling
     * @param {Object} options - Configuration options
     * @param {number} options.maxRetries - Maximum retry attempts (default: 3)
     * @param {number} options.baseDelay - Base delay in ms (default: 1000)
     * @param {string} options.provider - Provider to use (gemini/openai/anthropic/local)
     * @param {boolean} options.allowFallback - Allow fallback to other providers
     * @returns {Promise<Object>} Response object with type and content
     */
    const callApiWithRetry = async (history, apiKey, funcDecls = [], options = {}) => {
      const maxRetries = options.maxRetries || 3;
      const baseDelay = options.baseDelay || 1000; // 1 second
      let firstMeaningfulError = null;
      const provider = options.provider || currentProvider;
      const callStartTime = Date.now();
      let totalRetries = 0;

      // Track call start
      _providerStats[provider].calls++;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const result = await performApiCall(history, apiKey, funcDecls, options, attempt);

          // Track success
          _providerStats[provider].successes++;
          _lastActivity = Date.now();

          // Record call history
          _apiCallHistory.push({
            provider,
            timestamp: Date.now(),
            duration: Date.now() - callStartTime,
            retries: totalRetries,
            success: true
          });
          if (_apiCallHistory.length > 50) _apiCallHistory.shift();

          return result;
        } catch (error) {
          const isLastAttempt = attempt === maxRetries;
          const isRetriable = isRetriableError(error);

          // Preserve the first error with meaningful status/code for better error reporting
          if (!firstMeaningfulError && error instanceof ApiError && error.statusCode) {
            firstMeaningfulError = error;
          }

          if (isLastAttempt || !isRetriable) {
            // Track failure
            _providerStats[provider].failures++;
            _providerStats[provider].retries += totalRetries;
            _lastActivity = Date.now();

            // Record failed call
            _apiCallHistory.push({
              provider,
              timestamp: Date.now(),
              duration: Date.now() - callStartTime,
              retries: totalRetries,
              success: false,
              error: error.message
            });
            if (_apiCallHistory.length > 50) _apiCallHistory.shift();

            // Throw the first meaningful error if we have one, otherwise throw current error
            throw firstMeaningfulError || error;
          }

          // Track retry
          totalRetries++;

          // Exponential backoff: 1s, 2s, 4s
          const delay = baseDelay * Math.pow(2, attempt);
          logger.info(`[ApiClient] Retry ${attempt + 1}/${maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    };

    /**
     * Determine if an error should trigger a retry attempt
     * @param {Error} error - The error to check
     * @returns {boolean} True if error is retriable
     */
    const isRetriableError = (error) => {
      if (error instanceof AbortError) return false;

      // Retry on network errors, rate limits, and server errors
      if (error instanceof ApiError) {
        const status = error.statusCode;
        return status === 429 || // Rate limit
               status === 500 || // Internal server error
               status === 502 || // Bad gateway
               status === 503 || // Service unavailable
               status === 504;   // Gateway timeout
      }

      // Retry on network errors
      return error.name === 'TypeError' || error.message?.includes('fetch');
    };

    // Perform the actual API call
    const performApiCall = async (history, apiKey, funcDecls = [], options = {}, attempt = 0) => {
      // Check proxy availability on first call
      if (!proxyChecked) {
        await checkProxyAvailability();
      }

      // Abort any existing call
      if (currentAbortController) {
        currentAbortController.abort("New call initiated");
      }
      currentAbortController = new AbortController();
      
      // Use provider from options or current default
      const provider = options.provider || currentProvider;
      
      // Determine endpoint and fetch options
      let apiEndpoint;
      let fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentAbortController.signal,
      };
      
      // Build request body with provider-specific format
      const requestBody = buildRequestBody(history, provider, {
        ...options,
        tools: funcDecls,
        expectJson: !funcDecls || funcDecls.length === 0
      });
      
      // Route through proxy if available, otherwise direct
      if (proxyStatus && proxyStatus.proxyAvailable) {
        // Use proxy endpoints
        switch (provider) {
          case 'gemini':
            apiEndpoint = `/api/gemini/models/gemini-2.5-flash:generateContent`;
            break;
          case 'openai':
            apiEndpoint = `/api/openai/chat/completions`;
            break;
          case 'anthropic':
            apiEndpoint = `/api/anthropic/messages`;
            break;
          case 'local':
            apiEndpoint = `/api/local/api/chat`;
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      } else {
        // Direct API calls (requires API keys in browser)
        if (!apiKey && provider !== 'local') {
          throw new ApiError(`No API key provided for ${provider}`, 401);
        }
        
        switch (provider) {
          case 'gemini':
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
            break;
          case 'openai':
            apiEndpoint = `https://api.openai.com/v1/chat/completions`;
            fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'anthropic':
            apiEndpoint = `https://api.anthropic.com/v1/messages`;
            fetchOptions.headers['X-API-Key'] = apiKey;
            fetchOptions.headers['anthropic-version'] = '2023-06-01';
            break;
          case 'local':
            apiEndpoint = `${config.localEndpoint || 'http://localhost:11434'}/api/chat`;
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      }
      
      try {
        logger.info(`Calling ${provider} API via ${proxyStatus ? 'proxy' : 'direct'}`);
        
        const response = await fetch(apiEndpoint, {
          ...fetchOptions,
          body: JSON.stringify(requestBody),
        });
        
        if (!response.ok) {
          const errBody = await response.text();
          throw new ApiError(
            `${provider} API Error (${response.status}): ${errBody}`, 
            response.status
          );
        }
        
        const data = await response.json();
        return parseProviderResponse(data, provider);
        
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new AbortError("API call aborted.");
        }

        // Enhance error with better messages and codes before logging or fallback
        if (error instanceof ApiError && error.statusCode) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            error.code = 'AUTH_FAILED';
            error.message = "Authentication failed. Please check your API key in settings or .env file.";
          } else if (error.statusCode === 429) {
            error.code = 'RATE_LIMIT';
            error.message = "Rate limit exceeded. Please wait a moment before trying again.";
          } else if (error.statusCode >= 500) {
            error.code = 'SERVER_ERROR';
            error.message = `The AI service is temporarily unavailable (${error.statusCode}). Please try again in a few moments.`;
          }
        }

        // Check for offline status
        if (!navigator.onLine) {
          throw new ApiError(
            "No internet connection detected. Please check your network and try again.",
            0,
            "NETWORK_OFFLINE"
          );
        }

        logger.error(`${provider} API Call Failed`, error);

        // Try fallback providers if configured
        if (options.allowFallback && config.fallbackProviders) {
          for (const fallbackProvider of config.fallbackProviders) {
            if (fallbackProvider !== provider) {
              logger.info(`Trying fallback provider: ${fallbackProvider}`);
              try {
                return await callApiWithRetry(history, apiKey, funcDecls, {
                  ...options,
                  provider: fallbackProvider,
                  allowFallback: false // Prevent infinite recursion
                });
              } catch (fallbackError) {
                logger.error(`Fallback ${fallbackProvider} also failed`, fallbackError);
              }
            }
          }
        }
        
        throw error;
      } finally {
        currentAbortController = null;
      }
    };
    
    /**
     * Streaming API call function that returns a Response object for streaming
     * To be used with StreamingResponseHandler for token-by-token streaming
     * @param {Array} history - Message history array
     * @param {string} apiKey - API key for authentication
     * @param {Array} funcDecls - Function declarations for tool calling
     * @param {Object} options - Configuration options
     * @returns {Promise<Response>} Fetch Response object with readable stream
     */
    const callApiWithStreaming = async (history, apiKey, funcDecls = [], options = {}) => {
      const provider = options.provider || currentProvider;
      const callStartTime = Date.now();

      // Track call start
      _providerStats[provider].calls++;

      try {
        const response = await performApiCallStreaming(history, apiKey, funcDecls, options);

        // Track success
        _providerStats[provider].successes++;
        _lastActivity = Date.now();

        // Record call history
        _apiCallHistory.push({
          provider,
          timestamp: Date.now(),
          duration: Date.now() - callStartTime,
          retries: 0,
          success: true,
          streaming: true
        });
        if (_apiCallHistory.length > 50) _apiCallHistory.shift();

        return response;
      } catch (error) {
        // Track failure
        _providerStats[provider].failures++;
        _lastActivity = Date.now();

        // Record failed call
        _apiCallHistory.push({
          provider,
          timestamp: Date.now(),
          duration: Date.now() - callStartTime,
          retries: 0,
          success: false,
          error: error.message,
          streaming: true
        });
        if (_apiCallHistory.length > 50) _apiCallHistory.shift();

        throw error;
      }
    };

    // Perform streaming API call
    const performApiCallStreaming = async (history, apiKey, funcDecls = [], options = {}) => {
      // Check proxy availability on first call
      if (!proxyChecked) {
        await checkProxyAvailability();
      }

      // Abort any existing call
      if (currentAbortController) {
        currentAbortController.abort("New call initiated");
      }
      currentAbortController = new AbortController();

      // Use provider from options or current default
      const provider = options.provider || currentProvider;

      // Determine endpoint and fetch options
      let apiEndpoint;
      let fetchOptions = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: currentAbortController.signal,
      };

      // Build request body with streaming enabled
      const requestBody = buildRequestBody(history, provider, {
        ...options,
        tools: funcDecls,
        expectJson: !funcDecls || funcDecls.length === 0,
        streaming: true
      });

      // Add streaming flag to request body for providers that support it
      if (provider === 'openai' || provider === 'anthropic' || provider === 'local') {
        requestBody.stream = true;
      }

      // Route through proxy if available, otherwise direct
      if (proxyStatus && proxyStatus.proxyAvailable) {
        // Use proxy endpoints with streaming
        switch (provider) {
          case 'gemini':
            apiEndpoint = `/api/gemini/models/gemini-2.5-flash:streamGenerateContent`;
            break;
          case 'openai':
            apiEndpoint = `/api/openai/chat/completions`;
            break;
          case 'anthropic':
            apiEndpoint = `/api/anthropic/messages`;
            break;
          case 'local':
            apiEndpoint = `/api/local/api/chat`;
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      } else {
        // Direct API calls (requires API keys in browser)
        if (!apiKey && provider !== 'local') {
          throw new ApiError(`No API key provided for ${provider}`, 401);
        }

        switch (provider) {
          case 'gemini':
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`;
            break;
          case 'openai':
            apiEndpoint = `https://api.openai.com/v1/chat/completions`;
            fetchOptions.headers['Authorization'] = `Bearer ${apiKey}`;
            break;
          case 'anthropic':
            apiEndpoint = `https://api.anthropic.com/v1/messages`;
            fetchOptions.headers['X-API-Key'] = apiKey;
            fetchOptions.headers['anthropic-version'] = '2023-06-01';
            break;
          case 'local':
            apiEndpoint = `${config.localEndpoint || 'http://localhost:11434'}/api/chat`;
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }
      }

      try {
        logger.info(`Calling ${provider} API with streaming via ${proxyStatus ? 'proxy' : 'direct'}`);

        const response = await fetch(apiEndpoint, {
          ...fetchOptions,
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errBody = await response.text();
          throw new ApiError(
            `${provider} API Error (${response.status}): ${errBody}`,
            response.status
          );
        }

        // Return the response object for streaming
        // StreamingResponseHandler will read response.body.getReader()
        return response;

      } catch (error) {
        if (error.name === 'AbortError') {
          throw new AbortError("API call aborted.");
        }

        // Enhance error with better messages and codes
        if (error instanceof ApiError && error.statusCode) {
          if (error.statusCode === 401 || error.statusCode === 403) {
            error.code = 'AUTH_FAILED';
            error.message = "Authentication failed. Please check your API key in settings or .env file.";
          } else if (error.statusCode === 429) {
            error.code = 'RATE_LIMIT';
            error.message = "Rate limit exceeded. Please wait a moment before trying again.";
          } else if (error.statusCode >= 500) {
            error.code = 'SERVER_ERROR';
            error.message = `The AI service is temporarily unavailable (${error.statusCode}). Please try again in a few moments.`;
          }
        }

        // Check for offline status
        if (!navigator.onLine) {
          throw new ApiError(
            "No internet connection detected. Please check your network and try again.",
            0,
            "NETWORK_OFFLINE"
          );
        }

        logger.error(`${provider} API Call Failed`, error);
        throw error;
      } finally {
        currentAbortController = null;
      }
    };

    /**
     * Set the active provider for API calls
     * @param {string} provider - Provider name: gemini, openai, anthropic, or local
     * @throws {Error} If provider is invalid
     */
    const setProvider = (provider) => {
      const validProviders = ['gemini', 'openai', 'anthropic', 'local'];
      if (!validProviders.includes(provider)) {
        throw new Error(`Invalid provider: ${provider}. Must be one of: ${validProviders.join(', ')}`);
      }
      currentProvider = provider;
      logger.info(`Provider set to: ${provider}`);
    };
    
    /**
     * Get list of currently available providers
     * @returns {Array<string>} Array of provider names
     */
    const getAvailableProviders = () => {
      if (!proxyStatus) {
        return ['local']; // Only local is available without proxy
      }
      
      const available = [];
      if (proxyStatus.providers.gemini) available.push('gemini');
      if (proxyStatus.providers.openai) available.push('openai');
      if (proxyStatus.providers.anthropic) available.push('anthropic');
      available.push('local'); // Local is always available
      
      return available;
    };
    
    /**
     * Abort the current API call in progress
     * @param {string} reason - Reason for aborting (default: "User requested abort")
     */
    const abortCurrentCall = (reason = "User requested abort") => {
      if (currentAbortController) {
        currentAbortController.abort(reason);
        currentAbortController = null;
      }
    };
    
    const sanitizeLlmJsonResp = (rawText) => {
      return Utils.sanitizeLlmJsonRespPure(rawText, logger).sanitizedJson;
    };

    // Web Component Widget
    class ApiClientMultiWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        if (this.updateInterval) {
          this._interval = setInterval(() => this.render(), this.updateInterval);
        }
      }

      disconnectedCallback() {
        if (this._interval) clearInterval(this._interval);
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const totalCalls = Object.values(_providerStats).reduce((sum, stat) => sum + stat.calls, 0);
        const totalSuccess = Object.values(_providerStats).reduce((sum, stat) => sum + stat.successes, 0);
        const isActive = _lastActivity && (Date.now() - _lastActivity < 2000);

        return {
          state: isActive ? 'active' : 'idle',
          primaryMetric: currentProvider,
          secondaryMetric: `${totalCalls} calls`,
          lastActivity: _lastActivity,
          message: `${totalSuccess}/${totalCalls} successful`
        };
      }

      renderControls() {
        const available = getAvailableProviders();
        const controls = [
          ...available.map(provider => `
            <button
              data-provider="${provider}"
              class="provider-switch"
              ${provider === currentProvider ? 'disabled' : ''}>
              Switch to ${provider}
            </button>
          `),
          `<button class="check-proxy">↻ Check Proxy</button>`
        ].join('');

        return `<div class="controls">${controls}</div>`;
      }

      render() {
        const totalCalls = Object.values(_providerStats).reduce((sum, stat) => sum + stat.calls, 0);
        const recentCalls = _apiCallHistory.slice(-20).reverse();

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              background: rgba(255,255,255,0.05);
              border-radius: 8px;
              padding: 16px;
            }
            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }
            .widget-panel {
              color: #ddd;
            }
            .controls {
              margin-top: 12px;
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            button {
              padding: 6px 12px;
              background: rgba(100,150,255,0.2);
              border: 1px solid rgba(100,150,255,0.4);
              border-radius: 4px;
              color: #fff;
              cursor: pointer;
              font-size: 0.9em;
            }
            button:hover:not(:disabled) {
              background: rgba(100,150,255,0.3);
            }
            button:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          </style>

          <div class="widget-panel">
            <h3>♁ Provider Status</h3>
            <div style="margin-top: 12px; padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px; border-left: 3px solid #6496ff;">
              <div style="font-size: 0.9em; color: #888;">Active Provider</div>
              <div style="font-size: 1.4em; font-weight: bold; margin-top: 4px;">${currentProvider.toUpperCase()}</div>
              ${proxyStatus ? `
                <div style="margin-top: 8px; font-size: 0.85em; color: #aaa;">
                  Proxy: ${proxyStatus.proxyAvailable ? '✓ Available' : '✗ Unavailable'}
                </div>
              ` : ''}
            </div>

            ${this.renderControls()}

            <h3 style="margin-top: 20px;">☱ Provider Statistics</h3>
            <div style="margin-top: 12px;">
              ${['gemini', 'openai', 'anthropic', 'local'].map(provider => {
                const stats = _providerStats[provider];
                const successRate = stats.calls > 0 ? ((stats.successes / stats.calls) * 100).toFixed(1) : '0.0';
                const avgRetries = stats.successes > 0 ? (stats.retries / stats.successes).toFixed(2) : '0.00';
                const isActive = provider === currentProvider;

                return `
                  <div style="padding: 10px; background: ${isActive ? 'rgba(100,150,255,0.1)' : 'rgba(255,255,255,0.05)'}; border-radius: 4px; margin-bottom: 8px; ${isActive ? 'border-left: 3px solid #6496ff;' : ''}">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                      <div style="font-size: 1.1em; font-weight: bold;">${provider.toUpperCase()}${isActive ? ' ⚡' : ''}</div>
                      <div style="font-size: 0.85em; color: ${stats.calls > 0 ? '#0c0' : '#666'};">${stats.calls} calls</div>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; font-size: 0.85em;">
                      <div>
                        <div style="color: #888;">Success Rate</div>
                        <div style="font-weight: bold; color: ${parseFloat(successRate) > 90 ? '#0c0' : parseFloat(successRate) > 50 ? '#ffa500' : '#ff6b6b'};">${successRate}%</div>
                      </div>
                      <div>
                        <div style="color: #888;">Failures</div>
                        <div style="font-weight: bold; color: ${stats.failures > 0 ? '#ff6b6b' : '#666'};">${stats.failures}</div>
                      </div>
                      <div>
                        <div style="color: #888;">Avg Retries</div>
                        <div style="font-weight: bold;">${avgRetries}</div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

            ${recentCalls.length > 0 ? `
              <h3 style="margin-top: 20px;">⌚ Recent API Calls (Last 20)</h3>
              <div style="margin-top: 12px; max-height: 300px; overflow-y: auto;">
                ${recentCalls.map(call => {
                  const timeAgo = Math.floor((Date.now() - call.timestamp) / 1000);
                  const durationSec = (call.duration / 1000).toFixed(2);

                  return `
                    <div style="padding: 6px 8px; background: ${call.success ? 'rgba(0,200,100,0.05)' : 'rgba(255,0,0,0.1)'}; border-radius: 4px; margin-bottom: 4px; font-size: 0.85em; border-left: 3px solid ${call.success ? '#0c0' : '#ff6b6b'};">
                      <div style="display: flex; justify-content: space-between; align-items: center;">
                        <div style="flex: 1;">
                          <span style="font-weight: bold; text-transform: uppercase;">${call.provider}</span>
                          ${call.retries > 0 ? `<span style="margin-left: 8px; color: #ffa500;">↻ ${call.retries} retries</span>` : ''}
                          ${call.error ? `<div style="color: #ff6b6b; font-size: 0.9em; margin-top: 2px;">${call.error.substring(0, 60)}${call.error.length > 60 ? '...' : ''}</div>` : ''}
                        </div>
                        <div style="text-align: right; margin-left: 12px;">
                          <div style="color: ${call.success ? '#0c0' : '#ff6b6b'}; font-weight: bold;">${call.success ? '✓' : '✗'}</div>
                          <div style="color: #666; font-size: 0.85em;">${durationSec}s</div>
                          <div style="color: #666; font-size: 0.8em;">${timeAgo}s ago</div>
                        </div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : '<div style="margin-top: 12px; color: #888; font-style: italic;">No API calls yet</div>'}

            <div style="margin-top: 16px; padding: 12px; background: rgba(100,150,255,0.1); border-left: 3px solid #6496ff; border-radius: 4px;">
              <strong>☱ Total Statistics</strong>
              <div style="margin-top: 6px; color: #aaa; font-size: 0.9em;">
                ${totalCalls} total calls across all providers<br>
                Current provider: ${currentProvider}<br>
                Proxy status: ${proxyStatus ? (proxyStatus.proxyAvailable ? 'Available' : 'Unavailable') : 'Not checked'}
              </div>
            </div>
          </div>
        `;

        // Attach event listeners
        this.shadowRoot.querySelectorAll('.provider-switch').forEach(btn => {
          btn.addEventListener('click', () => {
            const provider = btn.dataset.provider;
            setProvider(provider);
            logger.info(`[ApiClientMulti] Widget: Switched to ${provider}`);
            this.render();
          });
        });

        this.shadowRoot.querySelector('.check-proxy')?.addEventListener('click', async () => {
          proxyChecked = false;
          await checkProxyAvailability();
          logger.info('[ApiClientMulti] Widget: Proxy status refreshed');
          this.render();
        });
      }
    }

    // Register custom element
    if (!customElements.get('api-client-multi-widget')) {
      customElements.define('api-client-multi-widget', ApiClientMultiWidget);
    }

    const widget = {
      element: 'api-client-multi-widget',
      displayName: 'API Client (Multi-Provider)',
      icon: '♁',
      category: 'ai',
      updateInterval: 5000
    };

    // Public API
    return {
      api: {
        callApiWithRetry,
        callApiWithStreaming,
        abortCurrentCall,
        sanitizeLlmJsonResp,
        setProvider,
        getAvailableProviders,
        getCurrentProvider: () => currentProvider,
        checkProxyAvailability
      },
      widget
    };
  }
};

// Legacy compatibility wrapper
const ApiClientMultiModule = (config, logger, Errors, Utils, StateManager) => {
  const instance = ApiClientMulti.factory({ config, logger, Errors, Utils, StateManager });
  return instance.api;
};

// Export both formats for compatibility
export default ApiClientMulti;
export { ApiClientMultiModule };