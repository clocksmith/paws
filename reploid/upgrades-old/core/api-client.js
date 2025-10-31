// @blueprint 0x000007 - Details a robust API client with retry logic and abort handling.
// Standardized API Client Module for REPLOID
// Handles all communication with the Gemini API

const ApiClient = {
  metadata: {
    id: 'ApiClient',
    version: '2.0.0',
    dependencies: ['config', 'Utils', 'Storage', 'RateLimiter'],
    async: false,
    type: 'service'
  },
  
  factory: (deps) => {
    // Validate dependencies
    const { config, Utils, Storage, RateLimiter } = deps;
    const { logger, Errors } = Utils;

    if (!config || !logger || !Errors || !Utils || !Storage) {
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

    // API call tracking for widget
    const _callHistory = [];
    const MAX_HISTORY = 50;
    let _callStats = { total: 0, success: 0, error: 0, aborted: 0 };
    let _lastCallTime = null;
    let _totalTokensUsed = 0;
    
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

      const modelName = "gemini-2.5-flash";
      
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
          maxOutputTokens: 8192
          // Note: responseMimeType not supported in v1 API
        },
      };

      // Add function declarations if provided
      if (funcDecls && funcDecls.length > 0) {
        reqBody.tools = [{ functionDeclarations: funcDecls }];
        reqBody.tool_config = { function_calling_config: { mode: "AUTO" } };
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
          logger.error('[ApiClient] API response has no candidates:', JSON.stringify(data, null, 2));
          throw new ApiError("API returned no candidates.", 500, "NO_CANDIDATES");
        }

        // Extract result
        const candidate = data.candidates[0];

        // Validate candidate structure
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
          logger.error('[ApiClient] Invalid candidate structure:', JSON.stringify(candidate, null, 2));

          // Check for finish reason
          if (candidate.finishReason === 'SAFETY' || candidate.finishReason === 'RECITATION') {
            throw new ApiError(
              `Response blocked by ${candidate.finishReason} filter`,
              400,
              `BLOCKED_${candidate.finishReason}`
            );
          }

          throw new ApiError(
            `Invalid response structure: candidate missing content.parts. Finish reason: ${candidate.finishReason || 'unknown'}`,
            500,
            "INVALID_STRUCTURE"
          );
        }

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

        // Use statusCode for compatibility with both real and mocked ApiError
        const status = error.statusCode || error.status;

        if (status === 401 || status === 403) {
          const authError = new ApiError(
            "Authentication failed. Please check your API key in settings or .env file.",
            status,
            "AUTH_FAILED"
          );
          logger.error("API Call Failed - Authentication", error);
          throw authError;
        }

        if (status === 429) {
          const rateLimitError = new ApiError(
            "Rate limit exceeded. Please wait a moment before trying again.",
            429,
            "RATE_LIMIT"
          );
          logger.error("API Call Failed - Rate Limit", error);
          throw rateLimitError;
        }

        if (status >= 500) {
          const serverError = new ApiError(
            `The AI service is temporarily unavailable (${status}). Please try again in a few moments.`,
            status,
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
    
    const callApiWithStreaming = async (history, apiKey, funcDecls = []) => {
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

      const modelName = "gemini-2.5-flash";

      // Use proxy if available, otherwise direct API
      let apiEndpoint;
      let fetchOptions;

      if (useProxy) {
        // Use local proxy endpoint with streaming
        apiEndpoint = `/api/gemini/models/${modelName}:streamGenerateContent`;
        fetchOptions = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: currentAbortController.signal,
        };
      } else {
        // Use direct Gemini API with streaming endpoint
        apiEndpoint = `${API_ENDPOINT_BASE}${modelName}:streamGenerateContent`;
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
          maxOutputTokens: 8192
        },
      };

      // Add function declarations if provided
      if (funcDecls && funcDecls.length > 0) {
        reqBody.tools = [{ functionDeclarations: funcDecls }];
        reqBody.tool_config = { function_calling_config: { mode: "AUTO" } };
      }

      try {
        // Build URL - proxy doesn't need key in URL
        const url = useProxy ? apiEndpoint : `${apiEndpoint}?key=${apiKey}&alt=sse`;

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

        // Return the response object for streaming
        // StreamingResponseHandler will read response.body.getReader()
        return response;

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

        const status = error.statusCode || error.status;

        if (status === 401 || status === 403) {
          const authError = new ApiError(
            "Authentication failed. Please check your API key in settings or .env file.",
            status,
            "AUTH_FAILED"
          );
          logger.error("API Call Failed - Authentication", error);
          throw authError;
        }

        if (status === 429) {
          const rateLimitError = new ApiError(
            "Rate limit exceeded. Please wait a moment before trying again.",
            429,
            "RATE_LIMIT"
          );
          logger.error("API Call Failed - Rate Limit", error);
          throw rateLimitError;
        }

        if (status >= 500) {
          const serverError = new ApiError(
            `The AI service is temporarily unavailable (${status}). Please try again in a few moments.`,
            status,
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
    
    // Web Component widget
    class ApiClientWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._updateInterval = setInterval(() => this.render(), 1000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const isActive = currentAbortController !== null;
        const provider = useProxy ? 'Proxy' : 'Direct';

        let state = 'idle';
        if (isActive) state = 'active';
        if (_callStats.error > _callStats.success) state = 'error';

        return {
          state,
          primaryMetric: `${_callStats.total} requests`,
          secondaryMetric: provider,
          lastActivity: _lastCallTime
        };
      }

      getControls() {
        return [
          {
            id: 'abort-call',
            label: 'Abort',
            icon: '■',
            action: () => {
              abortCurrentCall('User requested abort from dashboard');
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show('API call aborted', 'info');
            }
          },
          {
            id: 'clear-stats',
            label: 'Clear Stats',
            icon: '⌦',
            action: () => {
              _callHistory.length = 0;
              _callStats = { total: 0, success: 0, error: 0, aborted: 0 };
              _totalTokensUsed = 0;
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show('API stats cleared', 'success');
              this.render();
            }
          }
        ];
      }

      render() {
          const successRate = _callStats.total > 0
            ? ((_callStats.success / _callStats.total) * 100).toFixed(0)
            : 0;

        const formatTime = (timestamp) => {
          if (!timestamp) return 'Never';
          return new Date(timestamp).toLocaleTimeString();
        };

        const formatTimeAgo = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 1000) return 'Just now';
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; }
            .api-client-panel { padding: 12px; }
            h4 { margin: 0 0 12px 0; color: #fff; }
            h5 { margin: 16px 0 8px 0; color: #888; font-size: 0.95em; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 16px; }
            .stat-card { padding: 12px; background: rgba(100,150,255,0.1); border-radius: 4px; text-align: center; }
            .stat-label { font-size: 0.85em; color: #888; }
            .stat-value { font-size: 1.3em; font-weight: bold; margin-top: 4px; }
            .api-info { margin-bottom: 16px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 4px; }
            .info-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.9em; }
            .info-label { color: #888; }
            .info-value { color: #fff; }
            .call-history { max-height: 200px; overflow-y: auto; }
            .call-entry { padding: 6px; background: rgba(255,255,255,0.03); margin-bottom: 4px; border-radius: 3px; display: flex; gap: 12px; align-items: center; font-size: 0.85em; }
            .call-entry.call-error { background: rgba(255,0,0,0.1); }
            .call-time { color: #888; }
            .call-status { font-weight: bold; }
            .call-duration { color: #6496ff; }
            .call-error-msg { color: #ff6b6b; flex: 1; }
            .rate-limit-info { margin-top: 16px; padding: 12px; background: rgba(255,165,0,0.1); border-radius: 4px; color: #ffa500; font-size: 0.9em; }
          </style>
          <div class="api-client-panel">
              <h4>◉ API Client</h4>

              <div class="stats-grid">
                <div class="stat-card">
                  <div class="stat-label">Total Requests</div>
                  <div class="stat-value">${_callStats.total}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Success</div>
                  <div class="stat-value">${_callStats.success}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Errors</div>
                  <div class="stat-value">${_callStats.error}</div>
                </div>
                <div class="stat-card">
                  <div class="stat-label">Success Rate</div>
                  <div class="stat-value">${successRate}%</div>
                </div>
              </div>

              <div class="api-info">
                <div class="info-row">
                  <span class="info-label">Connection:</span>
                  <span class="info-value">${useProxy ? 'Proxy Server' : 'Direct API'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Active Call:</span>
                  <span class="info-value">${currentAbortController ? 'Yes' : 'No'}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Total Tokens:</span>
                  <span class="info-value">${_totalTokensUsed.toLocaleString()}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Last Call:</span>
                  <span class="info-value">${formatTimeAgo(_lastCallTime)}</span>
                </div>
              </div>

              <h5>Recent API Calls</h5>
              <div class="call-history">
                ${_callHistory.length > 0 ? _callHistory.slice(-10).reverse().map((call, idx) => `
                  <div class="call-entry ${call.success ? '' : 'call-error'}">
                    <span class="call-time">${formatTime(call.timestamp)}</span>
                    <span class="call-status">${call.success ? '✓' : '✗'}</span>
                    <span class="call-duration">${call.duration || 0}ms</span>
                    ${call.error ? `<span class="call-error-msg">${call.error}</span>` : ''}
                  </div>
                `).join('') : '<p>No API calls yet</p>'}
              </div>

              ${rateLimiter ? `
                <div class="rate-limit-info">
                  <strong>Rate Limiting:</strong> Active (10 calls/min)
                </div>
              ` : ''}
            </div>
        `;
      }
    }

    // Define custom element
    const elementName = 'api-client-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, ApiClientWidget);
    }

    // Public API
    return {
      api: {
        callApiWithRetry,
        callApiWithStreaming,
        abortCurrentCall,
        sanitizeLlmJsonResp
      },
      widget: {
        element: elementName,
        displayName: 'API Client',
        icon: '◉',
        category: 'core',
        updateInterval: 1000
      }
    };
  }
};

// Export standardized module
export default ApiClient;