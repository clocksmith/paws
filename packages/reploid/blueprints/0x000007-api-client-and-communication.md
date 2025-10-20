# Blueprint 0x000007: API Client and Communication

**Objective:** To detail the architecture for a robust API client module responsible for all communication with the external Large Language Model.

**Target Upgrade:** APIC (`api-client.js`)


**Prerequisites:** `0x000003`, **0x00004E** (Module Widget Protocol)

**Affected Artifacts:** `/modules/api-client.js`

---

### 1. The Strategic Imperative

Directly using the `fetch` API throughout the codebase for LLM calls is brittle and leads to duplicated logic. A dedicated `ApiClient` module is essential to encapsulate the specifics of communicating with the LLM provider (e.g., Google's Gemini API). This abstraction allows the agent to have a single, reliable point for making requests, handling errors, managing abort signals, and processing responses, making the rest of the codebase cleaner and independent of the specific API endpoint details.

### 2. The Architectural Solution

The ApiClient module provides robust LLM communication with retry logic, abort handling, and real-time monitoring through a Web Component widget. It implements a factory pattern with encapsulated API logic and Shadow DOM-based UI for tracking requests.

**Module Architecture:**
```javascript
const ApiClient = {
  metadata: {
    id: 'ApiClient',
    version: '2.0.0',
    dependencies: ['config', 'Utils', 'StateManager', 'RateLimiter'],
    async: false,
    type: 'service'
  },
  factory: (deps) => {
    const { config, Utils, StateManager, RateLimiter } = deps;
    const { logger, Errors } = Utils;

    // Internal state (accessible to widget via closure)
    let currentAbortController = null;
    let useProxy = false;
    const _callHistory = [];
    let _callStats = { total: 0, success: 0, error: 0, aborted: 0 };
    let _lastCallTime = null;
    let _totalTokensUsed = 0;

    // Core API functions
    const callApiWithRetry = async (history, apiKey, funcDecls = []) => {
      // Rate limiting check
      // Abort existing calls
      // Build request to Gemini API or proxy
      // Handle response and errors
      // Track in _callHistory and _callStats
      return { type, content, rawResp };
    };

    const abortCurrentCall = (reason = "User requested abort") => {
      if (currentAbortController) {
        currentAbortController.abort(reason);
        currentAbortController = null;
      }
    };

    // Web Component Widget (defined inside factory to access closure state)
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
        if (this._updateInterval) clearInterval(this._updateInterval);
      }

      render() {
        // Access closure variables: _callStats, _callHistory, useProxy, currentAbortController
        const successRate = _callStats.total > 0
          ? ((_callStats.success / _callStats.total) * 100).toFixed(0)
          : 0;

        const recentCalls = _callHistory.slice(-10).reverse();

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; font-size: 12px; }
            .api-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
            .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
            .stat { padding: 8px; background: rgba(255, 255, 255, 0.08); }
            .call-item { padding: 4px; border-left: 2px solid #0a0; margin: 4px 0; }
            .call-item.error { border-left-color: #a00; }
            .active-indicator { color: #0f0; animation: blink 1s infinite; }
          </style>
          <div class="api-panel">
            <h4>◉ API Client</h4>
            <div class="stats-grid">
              <div class="stat">Total: ${_callStats.total}</div>
              <div class="stat">Success: ${_callStats.success}</div>
              <div class="stat">Errors: ${_callStats.error}</div>
              <div class="stat">Rate: ${successRate}%</div>
            </div>
            <div style="margin-top: 8px;">
              Connection: ${useProxy ? 'Proxy' : 'Direct'}
              ${currentAbortController ? '<span class="active-indicator">●</span>' : ''}
            </div>
            <div style="margin-top: 8px; max-height: 200px; overflow-y: auto;">
              ${recentCalls.map(call => `
                <div class="call-item ${call.success ? '' : 'error'}">
                  ${call.success ? '✓' : '✗'} ${call.duration}ms
                  ${call.error ? `- ${call.error}` : ''}
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    customElements.define('api-client-widget', ApiClientWidget);

    return {
      api: {
        callApiWithRetry,
        abortCurrentCall,
        sanitizeLlmJsonResp
      },
      widget: {
        element: 'api-client-widget',
        displayName: 'API Client',
        icon: '◉',
        category: 'core',
        updateInterval: 1000
      }
    };
  }
};
```

**Core Communication Features:**

- **Request Formatting**
  - Constructs correct JSON body with conversation history, safety settings, generation config
  - Supports function declarations for tool calling
  - Handles both direct API and proxy server endpoints

- **Retry Logic & Rate Limiting**
  - Integrates with RateLimiter module (10 calls/min, burst of 5)
  - Automatic retries on transient server errors (5xx) with exponential backoff
  - Handles rate limit errors (429) with appropriate delays
  - Graceful degradation if RateLimiter not available

- **Abort Handling**
  - Uses AbortController to cancel in-flight requests
  - Aborts existing call when new request initiated
  - User-triggered abort via dashboard widget
  - Proper cleanup and error propagation

- **Response Processing**
  - Parses JSON responses from Gemini API
  - Identifies response type (text vs. function call)
  - Returns standardized format: `{ type, content, rawResp }`
  - Uses sanitizeLlmJsonResp helper for malformed JSON cleanup
  - Validates response structure and handles edge cases

- **Proxy Support**
  - Auto-detects proxy availability on first call
  - Uses local proxy endpoint if available (avoids CORS, server-side API key)
  - Falls back to direct API if proxy unavailable
  - Logs proxy status for debugging

**Web Component Widget Features:**

The `ApiClientWidget` provides real-time API monitoring and control:
- **Statistics Dashboard**: 2×2 grid showing total requests, success count, errors, and success rate
- **Connection Info**: Displays connection type (Proxy/Direct), active call status, total tokens used, last call time
- **Recent API Calls**: Scrollable list of last 10 calls with timestamps, status (✓/✗), duration, and error messages
- **Rate Limit Indicator**: Shows when rate limiting is active
- **Interactive Controls**: "Abort" button to cancel current request, "Clear Stats" to reset counters
- **Auto-refresh**: Updates every 1 second to show real-time request progress
- **Visual Feedback**: Color-coded status (green for success, red for errors)

### 3. The Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure ApiClient is registered with dependencies
{
  "modules": {
    "ApiClient": {
      "dependencies": ["config", "Utils", "StateManager", "RateLimiter"],
      "enabled": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates API communication logic:
```javascript
factory: (deps) => {
  const { config, Utils, StateManager, RateLimiter } = deps;
  const { logger, Errors } = Utils;
  const { ApiError, AbortError } = Errors;

  // Internal state (accessible to widget via closure)
  let currentAbortController = null;
  let useProxy = false;
  let proxyChecked = false;
  const _callHistory = [];
  const MAX_HISTORY = 50;
  let _callStats = { total: 0, success: 0, error: 0, aborted: 0 };
  let _lastCallTime = null;
  let _totalTokensUsed = 0;

  // Web Component defined here to access closure variables
  class ApiClientWidget extends HTMLElement { /*...*/ }
  customElements.define('api-client-widget', ApiClientWidget);

  return { api, widget };
}
```

**Step 3: Proxy Detection**

Check for proxy availability before first API call:
```javascript
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
    useProxy = false;
  }
  proxyChecked = true;
  return useProxy;
};
```

**Step 4: Core API Call Implementation**

Implement `callApiWithRetry` with rate limiting, abort handling, and error management:
```javascript
const callApiWithRetry = async (history, apiKey, funcDecls = []) => {
  // Rate limiting check
  if (rateLimiter) {
    const allowed = await RateLimiter.waitForToken(rateLimiter, 5000);
    if (!allowed) {
      throw new ApiError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED');
    }
  }

  // Check proxy availability
  if (!proxyChecked) await checkProxyAvailability();

  // Abort any existing call
  if (currentAbortController) {
    currentAbortController.abort("New call initiated");
  }
  currentAbortController = new AbortController();

  const modelName = "gemini-2.5-flash";

  // Build endpoint and fetch options
  let apiEndpoint, fetchOptions;
  if (useProxy) {
    apiEndpoint = `/api/gemini/models/${modelName}:generateContent`;
    fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: currentAbortController.signal
    };
  } else {
    apiEndpoint = `${API_ENDPOINT_BASE}${modelName}:generateContent?key=${apiKey}`;
    fetchOptions = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: currentAbortController.signal
    };
  }

  // Build request body
  const reqBody = {
    contents: history,
    safetySettings: [/*...*/],
    generationConfig: { temperature: 0.8, maxOutputTokens: 8192 }
  };

  if (funcDecls && funcDecls.length > 0) {
    reqBody.tools = [{ functionDeclarations: funcDecls }];
    reqBody.tool_config = { function_calling_config: { mode: "AUTO" } };
  }

  try {
    const response = await fetch(apiEndpoint, {
      ...fetchOptions,
      body: JSON.stringify(reqBody)
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new ApiError(`API Error (${response.status}): ${errBody}`, response.status);
    }

    const data = await response.json();

    // Validate and extract response
    if (!data.candidates || data.candidates.length === 0) {
      throw new ApiError("API returned no candidates", 500, "NO_CANDIDATES");
    }

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

    // Track successful call
    _callStats.total++;
    _callStats.success++;
    _lastCallTime = Date.now();
    _callHistory.push({
      timestamp: Date.now(),
      success: true,
      duration: Date.now() - startTime
    });

    return { type: resultType, content: resultContent, rawResp: data };

  } catch (error) {
    // Track failed call
    _callStats.total++;
    _callStats.error++;
    _lastCallTime = Date.now();
    _callHistory.push({
      timestamp: Date.now(),
      success: false,
      error: error.message,
      duration: Date.now() - startTime
    });

    if (error.name === 'AbortError') {
      throw new AbortError("API call was cancelled");
    }

    // Provide helpful error messages
    if (!navigator.onLine) {
      throw new ApiError("No internet connection", 0, "NETWORK_OFFLINE");
    }

    if (error.statusCode === 401 || error.statusCode === 403) {
      throw new ApiError("Authentication failed", error.statusCode, "AUTH_FAILED");
    }

    if (error.statusCode === 429) {
      throw new ApiError("Rate limit exceeded", 429, "RATE_LIMIT");
    }

    if (error.statusCode >= 500) {
      throw new ApiError(`Server error (${error.statusCode})`, error.statusCode, "SERVER_ERROR");
    }

    throw error;
  } finally {
    currentAbortController = null;
  }
};
```

**Step 5: Abort Functionality**

Simple abort implementation:
```javascript
const abortCurrentCall = (reason = "User requested abort") => {
  if (currentAbortController) {
    currentAbortController.abort(reason);
    currentAbortController = null;
  }
};
```

**Step 6: Web Component Widget**

The widget provides real-time API monitoring:
```javascript
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

    return {
      state: isActive ? 'active' : (_callStats.error > _callStats.success ? 'error' : 'idle'),
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
          this.render();
        }
      }
    ];
  }

  render() {
    // Access closure variables: _callStats, _callHistory, useProxy, currentAbortController
    const successRate = _callStats.total > 0
      ? ((_callStats.success / _callStats.total) * 100).toFixed(0)
      : 0;

    const recentCalls = _callHistory.slice(-10).reverse();

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .api-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .stat { padding: 8px; background: rgba(255, 255, 255, 0.08); }
        .call-item { padding: 4px; border-left: 2px solid #0a0; margin: 4px 0; }
        .call-item.error { border-left-color: #a00; }
        .active-indicator { color: #0f0; animation: blink 1s infinite; }
      </style>
      <div class="api-panel">
        <h4>◉ API Client</h4>
        <div class="stats-grid">
          <div class="stat">Total: ${_callStats.total}</div>
          <div class="stat">Success: ${_callStats.success}</div>
          <div class="stat">Errors: ${_callStats.error}</div>
          <div class="stat">Rate: ${successRate}%</div>
        </div>
        <div style="margin-top: 8px;">
          Connection: ${useProxy ? 'Proxy' : 'Direct'}
          ${currentAbortController ? '<span class="active-indicator">●</span>' : ''}
        </div>
        <div style="margin-top: 8px; max-height: 200px; overflow-y: auto;">
          ${recentCalls.map(call => `
            <div class="call-item ${call.success ? '' : 'error'}">
              ${call.success ? '✓' : '✗'} ${call.duration}ms
              ${call.error ? `- ${call.error}` : ''}
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
```

**Step 7: Integration Points**

1. **Agent Cycle Integration**:
   - Primary consumer of ApiClient
   - Awaits `callApiWithRetry` for LLM responses
   - Uses `abortCurrentCall` when user cancels

2. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard
   - Provides `getStatus()` for summary view
   - Provides `getControls()` for action buttons
   - Updates every 1 second via `updateInterval: 1000`

3. **Error Handling**:
   - Throws specific error types (ApiError, AbortError)
   - Provides user-friendly error messages
   - Tracks errors in call history for debugging

4. **Rate Limiting**:
   - Integrates with RateLimiter module when available
   - 10 calls/minute with burst of 5
   - Gracefully degrades if RateLimiter unavailable