/**
 * @fileoverview Enhanced API Client Module with Multi-Provider Support
 * Handles communication with Gemini, OpenAI, Anthropic, and Local models.
 * Includes automatic retry logic with exponential backoff for reliability.
 *
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
              temperature: options.temperature || 0.8,
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
            model: options.model || 'gpt-4-turbo-preview',
            messages: formattedMessages,
            temperature: options.temperature || 0.8,
            max_tokens: options.maxTokens || 4096
          };
        
        case 'anthropic':
          const systemMessage = formattedMessages.find(m => m.role === 'system');
          const otherMessages = formattedMessages.filter(m => m.role !== 'system');
          
          return {
            model: options.model || 'claude-3-opus-20240229',
            system: systemMessage?.content || '',
            messages: otherMessages,
            max_tokens: options.maxTokens || 4096,
            temperature: options.temperature || 0.8
          };
        
        case 'local':
          // Ollama format
          return {
            model: options.model || 'llama2',
            messages: formattedMessages,
            stream: false,
            options: {
              temperature: options.temperature || 0.8,
              num_predict: options.maxTokens || 2048
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

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          return await performApiCall(history, apiKey, funcDecls, options, attempt);
        } catch (error) {
          const isLastAttempt = attempt === maxRetries;
          const isRetriable = isRetriableError(error);

          if (isLastAttempt || !isRetriable) {
            throw error;
          }

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
            apiEndpoint = `/api/gemini/models/gemini-1.5-flash-latest:generateContent`;
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
            apiEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
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
    
    // Public API
    return {
      api: {
        callApiWithRetry,
        abortCurrentCall,
        sanitizeLlmJsonResp,
        setProvider,
        getAvailableProviders,
        getCurrentProvider: () => currentProvider,
        checkProxyAvailability
      }
    };
  }
};

// Legacy compatibility wrapper
const ApiClientMultiModule = (config, logger, Errors, Utils, StateManager) => {
  const instance = ApiClientMulti.factory({ config, logger, Errors, Utils, StateManager });
  return instance.api;
};

// Export both formats for compatibility
ApiClientMulti;
ApiClientMultiModule;