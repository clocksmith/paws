// Standardized API Client Module for REPLOID
// Handles all communication with the Gemini API

const ApiClient = {
  metadata: {
    id: 'ApiClient',
    version: '2.0.0',
    dependencies: ['config', 'Utils', 'StateManager', 'RateLimiter'],
    async: false,
    type: 'service'
  },
  
  factory: (deps) => {
    // Validate dependencies
    const { config, Utils, StateManager, RateLimiter } = deps;
    const { logger, Errors } = Utils;

    if (!config || !logger || !Errors || !Utils || !StateManager) {
      throw new Error('ApiClient: Missing required dependencies');
    }

    // Rate limiter (optional - graceful degradation if not available)
    const rateLimiter = RateLimiter ? RateLimiter.getLimiter('api') : null;
    if (rateLimiter) {
      logger.info('[ApiClient] Rate limiting enabled (10 calls/min, burst of 5)');
    } else {
      logger.warn('[ApiClient] Rate limiting not available - requests unlimited');
    }
    
    // Extract error classes
    const { ApiError, AbortError } = Errors;
    
    // Module state
    let currentAbortController = null;
    let useProxy = false;
    let proxyChecked = false;
    const API_ENDPOINT_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
    
    // Check if proxy is available
    const checkProxyAvailability = async () => {
      if (proxyChecked) return useProxy;
      
      try {
        const response = await fetch('/api/proxy-status');
        if (response.ok) {
          const data = await response.json();
          useProxy = data.proxyAvailable && data.hasApiKey;
          logger.info(`Proxy status: ${useProxy ? 'Available' : 'Not available'}`);
        }
      } catch (e) {
        // Proxy not available, use direct API
        useProxy = false;
      }
      proxyChecked = true;
      return useProxy;
    };
    
    // Private functions
    const sanitizeLlmJsonResp = (rawText) => {
      return Utils.sanitizeLlmJsonRespPure(rawText, logger).sanitizedJson;
    };
    
    const callApiWithRetry = async (history, apiKey, funcDecls = []) => {
      // Rate limiting check
      if (rateLimiter) {
        const allowed = await RateLimiter.waitForToken(rateLimiter, 5000);
        if (!allowed) {
          throw new ApiError(
            'Rate limit exceeded. Please wait before making another request.',
            429,
            'RATE_LIMIT_EXCEEDED'
          );
        }
      }

      // Check proxy availability on first call
      if (!proxyChecked) {
        await checkProxyAvailability();
      }

      // Abort any existing call
      if (currentAbortController) {
        currentAbortController.abort("New call initiated");
      }
      currentAbortController = new AbortController();
      
      const modelName = "gemini-1.5-flash-latest";
      
      // Use proxy if available, otherwise direct API
      let apiEndpoint;
      let fetchOptions;
      
      if (useProxy) {
        // Use local proxy endpoint
        apiEndpoint = `/api/gemini/models/${modelName}:generateContent`;
        fetchOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: currentAbortController.signal,
        };
      } else {
        // Use direct Gemini API
        apiEndpoint = `${API_ENDPOINT_BASE}${modelName}:generateContent`;
        fetchOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: currentAbortController.signal,
        };
      }
      
      const reqBody = {
        contents: history,
        safetySettings: [
          "HARASSMENT", "HATE_SPEECH", "SEXUALLY_EXPLICIT", "DANGEROUS_CONTENT"
        ].map(cat => ({ 
          category: `HARM_CATEGORY_${cat}`, 
          threshold: "BLOCK_ONLY_HIGH" 
        })),
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 8192,
          responseMimeType: "application/json"
        },
      };
      
      // Add function declarations if provided
      if (funcDecls && funcDecls.length > 0) {
        reqBody.tools = [{ functionDeclarations: funcDecls }];
        reqBody.tool_config = { function_calling_config: { mode: "AUTO" } };
        delete reqBody.generationConfig.responseMimeType;
      }
      
      try {
        // Build URL - proxy doesn't need key in URL
        const url = useProxy ? apiEndpoint : `${apiEndpoint}?key=${apiKey}`;
        
        const response = await fetch(url, {
          ...fetchOptions,
          body: JSON.stringify(reqBody),
        });
        
        if (!response.ok) {
          const errBody = await response.text();
          throw new ApiError(
            `API Error (${response.status}): ${errBody}`, 
            response.status
          );
        }
        
        const data = await response.json();
        
        // Validate response
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
        
        // Extract result
        const candidate = data.candidates[0];
        const part = candidate.content.parts[0];
        
        let resultType = "empty";
        let resultContent = "";
        
        if (part.text) {
          resultType = "text";
          resultContent = part.text;
        } else if (part.functionCall) {
          resultType = "functionCall";
          resultContent = part.functionCall;
        }
        
        return {
          type: resultType,
          content: resultContent,
          rawResp: data,
        };
        
      } catch (error) {
        if (error.name === 'AbortError') {
          throw new AbortError("API call was cancelled. You can start a new request.");
        }

        // Provide helpful error messages based on error type
        if (!navigator.onLine) {
          const offlineError = new ApiError(
            "No internet connection detected. Please check your network and try again.",
            0,
            "NETWORK_OFFLINE"
          );
          logger.error("API Call Failed - Offline", error);
          throw offlineError;
        }

        if (error.status === 401 || error.status === 403) {
          const authError = new ApiError(
            "Authentication failed. Please check your API key in settings or .env file.",
            error.status,
            "AUTH_FAILED"
          );
          logger.error("API Call Failed - Authentication", error);
          throw authError;
        }

        if (error.status === 429) {
          const rateLimitError = new ApiError(
            "Rate limit exceeded. Please wait a moment before trying again.",
            429,
            "RATE_LIMIT"
          );
          logger.error("API Call Failed - Rate Limit", error);
          throw rateLimitError;
        }

        if (error.status >= 500) {
          const serverError = new ApiError(
            `The AI service is temporarily unavailable (${error.status}). Please try again in a few moments.`,
            error.status,
            "SERVER_ERROR"
          );
          logger.error("API Call Failed - Server Error", error);
          throw serverError;
        }

        logger.error("API Call Failed", error);
        throw error;
      } finally {
        currentAbortController = null;
      }
    };
    
    const abortCurrentCall = (reason = "User requested abort") => {
      if (currentAbortController) {
        currentAbortController.abort(reason);
        currentAbortController = null;
      }
    };
    
    // Public API
    return {
      api: {
        callApiWithRetry,
        abortCurrentCall,
        sanitizeLlmJsonResp
      }
    };
  }
};

// Export standardized module
ApiClient;