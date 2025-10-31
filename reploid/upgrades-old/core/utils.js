/**
 * @fileoverview Standardized Utils Module for REPLOID
 * Core utilities, error classes, and helper functions used across the system.
 * This is a pure module with no dependencies - safe for any module to import.
 *
 * @blueprint 0x000003 - Explains the central utils.js module for shared functions and errors.
 * @module Utils
 * @version 1.0.0
 * @category core
 */

const Utils = {
  metadata: {
    id: 'Utils',
    version: '1.0.0',
    dependencies: [],  // No dependencies - pure utility module
    async: false,
    type: 'pure'
  },

  factory: (deps = {}) => {
    // Widget tracking state
    const _loggerStats = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    };
    const _errorStats = {};
    const _recentErrors = [];

    /**
     * Base error class for all REPLOID application errors.
     * Extends Error with additional details object for structured error data.
     *
     * @class ApplicationError
     * @extends Error
     * @param {string} message - Error message
     * @param {Object} [details={}] - Additional error context
     *
     * @example
     * throw new ApplicationError('Operation failed', {
     *   module: 'StateManager',
     *   operation: 'saveArtifact'
     * });
     */
    class ApplicationError extends Error {
      constructor(message, details) {
        super(message);
        this.name = this.constructor.name;
        if (details !== undefined) {
          this.details = details;
        }
        // Track error creation
        _errorStats[this.constructor.name] = (_errorStats[this.constructor.name] || 0) + 1;
        _recentErrors.push({
          type: this.constructor.name,
          message,
          timestamp: Date.now()
        });
        if (_recentErrors.length > 50) _recentErrors.shift();
      }
    }

    /**
     * @class ApiError - LLM API communication errors
     * @param {string} message - Error message
     * @param {number} [status] - HTTP status code
     * @param {string} [code] - Error code
     * @param {Object} [details] - Additional error context
     */
    class ApiError extends ApplicationError {
      constructor(message, status, code, details) {
        super(message, details);
        if (status !== undefined) {
          this.status = status;
          this.statusCode = status; // Alias for compatibility
        }
        if (code !== undefined) {
          this.code = code;
        }
      }
    }

    /** @class ToolError - Tool execution errors */
    class ToolError extends ApplicationError {}

    /** @class StateError - State management errors */
    class StateError extends ApplicationError {}

    /** @class ConfigError - Configuration validation errors */
    class ConfigError extends ApplicationError {}

    /** @class ArtifactError - VFS artifact operation errors */
    class ArtifactError extends ApplicationError {}

    /** @class AbortError - Operation abortion (user or timeout) */
    class AbortError extends ApplicationError {}

    /** @class WebComponentError - Web component initialization errors */
    class WebComponentError extends ApplicationError {}

    const Errors = {
      ApplicationError,
      ApiError,
      ToolError,
      StateError,
      ConfigError,
      ArtifactError,
      AbortError,
      WebComponentError
    };

    /**
     * Structured logging utility with timestamps and severity levels.
     * Logs are formatted as JSON for easy parsing.
     *
     * @namespace logger
     * @property {Function} debug - Debug level logging
     * @property {Function} info - Info level logging
     * @property {Function} warn - Warning level logging
     * @property {Function} error - Error level logging
     *
     * @example
     * logger.info('Module loaded', { module: 'Utils', time: 123 });
     * logger.error('Failed to save', { path: '/test.txt', error: err.message });
     */
    const logger = {
      /**
       * Core logging function - formats and outputs log entries.
       *
       * @param {string} level - Log level (debug|info|warn|error)
       * @param {string} message - Log message
       * @param {Object} [details={}] - Additional structured data
       */
      logEvent: (level, message, details = {}) => {
        // Track logger usage
        if (_loggerStats[level] !== undefined) {
          _loggerStats[level]++;
        }

        const logObject = {
          timestamp: new Date().toISOString(),
          level: level.toUpperCase(),
          message,
          details
        };
        console[level] ? console[level](JSON.stringify(logObject)) : console.log(JSON.stringify(logObject));
      },
      debug: (...args) => logger.logEvent('debug', ...args),
      info: (...args) => logger.logEvent('info', ...args),
      warn: (...args) => logger.logEvent('warn', ...args),
      error: (...args) => logger.logEvent('error', ...args),
    };

    /**
     * Convert kebab-case to camelCase.
     * Used for CSS property name conversions.
     *
     * @param {string} s - String in kebab-case
     * @returns {string} String in camelCase
     *
     * @example
     * kabobToCamel('background-color') // => 'backgroundColor'
     */
    const kabobToCamel = (s) => {
      // Remove leading/trailing hyphens and convert to camelCase
      return s
        .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
        .replace(/-([a-z0-9])/gi, (g) => g[1].toUpperCase()); // Convert after hyphens to uppercase
    };

    /**
     * Truncate string to specified length with ellipsis.
     *
     * @param {string} str - String to truncate
     * @param {number} len - Maximum length (including ellipsis)
     * @returns {string} Truncated string
     *
     * @example
     * trunc('Hello World', 8) // => 'Hello...'
     */
    const trunc = (str, len) => {
      if (str === undefined || str === null) return str;
      if (str.length <= len) return str;

      // Handle unicode/emoji properly by using Array.from when truncating
      const chars = Array.from(str);
      return chars.slice(0, len - 3).join('') + "...";
    };

    /**
     * Escape HTML special characters for safe display.
     * Prevents XSS attacks when rendering user-provided content.
     *
     * @param {string} unsafe - Potentially unsafe HTML string
     * @returns {string} Escaped HTML-safe string
     *
     * @example
     * escapeHtml('<script>alert("XSS")</script>')
     * // => '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
     */
    const escapeHtml = (unsafe) =>
      String(unsafe)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
    
    /**
     * Sanitize LLM JSON responses by extracting valid JSON from various formats.
     * LLMs often wrap JSON in markdown code blocks or include extra text.
     * This function tries multiple extraction strategies.
     *
     * @param {string} rawText - Raw LLM response text
     * @param {Object} [externalLogger] - Optional logger for warnings
     * @returns {{sanitizedJson: string, method: string}} Extracted JSON and method used
     *
     * @example
     * // LLM response: "Here's the JSON:\n```json\n{\"key\":\"value\"}\n```"
     * sanitizeLlmJsonRespPure(response)
     * // => { sanitizedJson: '{"key":"value"}', method: 'code block' }
     */
    const sanitizeLlmJsonRespPure = (rawText, externalLogger) => {
      if (!rawText || typeof rawText !== "string") {
        return { sanitizedJson: "{}", method: "invalid input" };
      }

      let text = rawText.trim();
      let jsonString = null;
      let method = "none";

      // Check for markdown code block
      const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        text = codeBlockMatch[1].trim();
        method = "code block";
      }

      // Try direct parse
      try {
        JSON.parse(text);
        jsonString = text;
        method = method === 'code block' ? 'code block' : 'direct parse';
      } catch (e) {
        // Try heuristic extraction (find first { to last })
        const firstBrace = text.indexOf("{");
        if (firstBrace !== -1) {
          const lastBrace = text.lastIndexOf("}");
          if (lastBrace > firstBrace) {
            text = text.substring(firstBrace, lastBrace + 1);
            method = "heuristic slice";
            try {
              JSON.parse(text);
              jsonString = text;
            } catch (e2) {
              externalLogger?.warn('JSON sanitization failed after heuristic slice', e2.message);
              jsonString = null;
            }
          }
        }
      }

      return { sanitizedJson: jsonString || "{}", method };
    };

    /**
     * HTTP POST request helper with JSON handling.
     *
     * @param {string} url - Target URL
     * @param {Object} body - Request body (will be JSON stringified)
     * @returns {Promise<Object>} Parsed JSON response
     * @throws {ApplicationError} On HTTP errors
     *
     * @example
     * const result = await post('/api/endpoint', { data: 'value' });
     */
    const post = async (url, body) => {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new ApplicationError(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
      } catch (error) {
        logger.error(`POST request to ${url} failed`, error);
        throw error;
      }
    };

    /**
     * Create EventBus subscription tracker for automatic cleanup.
     * Tracks subscriptions per module to prevent memory leaks.
     * Call unsubscribeAll(moduleId) when module unloads.
     *
     * @returns {Object} Tracker with track/unsubscribeAll/getActiveCount/getAllActive methods
     *
     * @example
     * const tracker = createSubscriptionTracker();
     * const unsub = EventBus.on('event', handler, 'MyModule');
     * tracker.track('MyModule', unsub);
     * // Later...
     * tracker.unsubscribeAll('MyModule'); // Cleans up all subscriptions
     */
    const createSubscriptionTracker = () => {
      const subscriptions = new Map(); // moduleId -> Array of unsubscribe functions

      return {
        /**
         * Track a subscription for later cleanup.
         * @param {string} moduleId - Module identifier
         * @param {Function} unsubscribeFn - Function to call to unsubscribe
         */
        track: (moduleId, unsubscribeFn) => {
          if (!subscriptions.has(moduleId)) {
            subscriptions.set(moduleId, []);
          }
          subscriptions.get(moduleId).push(unsubscribeFn);
        },

        /**
         * Unsubscribe all tracked subscriptions for a module.
         * @param {string} moduleId - Module identifier
         */
        unsubscribeAll: (moduleId) => {
          const moduleSubs = subscriptions.get(moduleId);
          if (moduleSubs) {
            moduleSubs.forEach(unsub => {
              if (typeof unsub === 'function') {
                unsub();
              }
            });
            subscriptions.delete(moduleId);
            logger.debug(`[SubscriptionTracker] Unsubscribed all listeners for ${moduleId}`);
          }
        },

        /**
         * Get count of active subscriptions for a module.
         * @param {string} moduleId - Module identifier
         * @returns {number} Number of active subscriptions
         */
        getActiveCount: (moduleId) => {
          return subscriptions.get(moduleId)?.length || 0;
        },

        /**
         * Get report of all active subscriptions.
         * @returns {Object} Object mapping moduleId to subscription count
         */
        getAllActive: () => {
          const report = {};
          subscriptions.forEach((subs, moduleId) => {
            report[moduleId] = subs.length;
          });
          return report;
        }
      };
    };

    /**
     * Show temporary success feedback on a button.
     * Displays success text, disables button, then restores after duration.
     * DRY pattern replacing 8+ duplicate implementations.
     *
     * @param {HTMLElement} button - Button element
     * @param {string} originalText - Text to restore after duration
     * @param {string} [successText='✓'] - Text to show during success
     * @param {number} [duration=2000] - Duration in milliseconds
     *
     * @example
     * showButtonSuccess(exportBtn, '⛃ Export Report', '✓ Exported!');
     * // Button shows "✓ Exported!" for 2 seconds, then restores original text
     */
    const showButtonSuccess = (button, originalText, successText = '✓', duration = 2000) => {
      if (!button) return;
      const original = originalText || button.textContent;
      button.textContent = successText;
      button.disabled = true;
      setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
      }, duration);
    };

    /**
     * Export content as markdown file download.
     * Creates blob, triggers download, and cleans up URL.
     * DRY pattern replacing 6+ duplicate implementations.
     *
     * @param {string} filename - Filename with .md extension
     * @param {string} content - Markdown content
     *
     * @example
     * exportAsMarkdown('report-2025-09-30.md', '# Report\n\nContent here...');
     */
    const exportAsMarkdown = (filename, content) => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    };

    /**
     * Generate a unique ID
     * @param {string} prefix - Optional prefix for the ID
     * @returns {string} Unique ID
     */
    const generateId = (prefix = 'id') => {
      return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    };

    // Public API
    const api = {
      Errors,
      logger,
      kabobToCamel,
      trunc,
      escapeHtml,
      sanitizeLlmJsonRespPure,
      post,
      createSubscriptionTracker,
      showButtonSuccess,
      exportAsMarkdown,
      generateId
    };

    // Web Component widget
    class UtilsWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // No cleanup needed
      }

      getStatus() {
        const totalLogs = _loggerStats.debug + _loggerStats.info + _loggerStats.warn + _loggerStats.error;
        const totalErrors = Object.values(_errorStats).reduce((a, b) => a + b, 0);
        const utilities = ['logger', 'Errors', 'kabobToCamel', 'trunc', 'escapeHtml', 'sanitizeLlmJsonRespPure',
                          'post', 'createSubscriptionTracker', 'showButtonSuccess', 'exportAsMarkdown', 'generateId'];

        return {
          state: totalLogs > 0 ? 'active' : 'idle',
          primaryMetric: `${utilities.length} utilities`,
          secondaryMetric: `${totalLogs} logs`,
          lastActivity: totalLogs > 0 ? Date.now() : null,
          message: `${totalErrors} errors created`
        };
      }

      getControls() {
        return [
          {
            id: 'reset-stats',
            label: '↻ Reset Stats',
            action: () => {
              _loggerStats.debug = 0;
              _loggerStats.info = 0;
              _loggerStats.warn = 0;
              _loggerStats.error = 0;
              Object.keys(_errorStats).forEach(k => delete _errorStats[k]);
              _recentErrors.length = 0;
              this.render();
              logger.info('[Utils] Widget statistics reset');
            }
          }
        ];
      }

      render() {
        const totalLogs = _loggerStats.debug + _loggerStats.info + _loggerStats.warn + _loggerStats.error;
        const totalErrors = Object.values(_errorStats).reduce((a, b) => a + b, 0);

        const utilities = [
          { name: 'logger', desc: 'Structured logging with timestamps and levels' },
          { name: 'Errors', desc: 'Error classes (ApplicationError, ApiError, ToolError, etc.)' },
          { name: 'kabobToCamel', desc: 'Convert kebab-case to camelCase' },
          { name: 'trunc', desc: 'Truncate strings with ellipsis' },
          { name: 'escapeHtml', desc: 'Escape HTML for safe display' },
          { name: 'sanitizeLlmJsonRespPure', desc: 'Extract JSON from LLM responses' },
          { name: 'post', desc: 'HTTP POST helper with JSON handling' },
          { name: 'createSubscriptionTracker', desc: 'EventBus subscription management' },
          { name: 'showButtonSuccess', desc: 'Button success feedback animation' },
          { name: 'exportAsMarkdown', desc: 'Export content as .md file' },
          { name: 'generateId', desc: 'Generate unique IDs' }
        ];

        const recentErrorsHtml = _recentErrors.slice(-10).reverse().map(err => {
          const timeAgo = Math.floor((Date.now() - err.timestamp) / 1000);
          return `
            <div class="error-item">
              <strong>${err.type}</strong>
              <div class="error-msg">${err.message.substring(0, 80)}${err.message.length > 80 ? '...' : ''}</div>
              <div class="error-time">${timeAgo}s ago</div>
            </div>
          `;
        }).join('');

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }

            .widget-panel {
              padding: 12px;
            }

            h3 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
              color: #fff;
            }

            h3.section-header {
              margin-top: 20px;
            }

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-top: 12px;
            }

            .stat-box {
              padding: 8px;
              border-radius: 4px;
            }

            .stat-box.debug { background: rgba(100,150,255,0.1); }
            .stat-box.info { background: rgba(0,200,100,0.1); }
            .stat-box.warn { background: rgba(255,165,0,0.1); }
            .stat-box.error { background: rgba(255,0,0,0.1); }

            .stat-label {
              font-size: 0.85em;
              color: #888;
            }

            .stat-value {
              font-size: 1.2em;
              font-weight: bold;
            }

            .error-stat {
              padding: 6px;
              background: rgba(255,255,255,0.05);
              border-radius: 4px;
              margin-bottom: 4px;
              display: flex;
              justify-content: space-between;
            }

            .error-stat-count {
              color: #ff6b6b;
              font-weight: bold;
            }

            .error-item {
              padding: 6px;
              background: rgba(255,0,0,0.1);
              border-radius: 4px;
              margin-bottom: 4px;
              font-size: 0.85em;
            }

            .error-item strong {
              color: #ff6b6b;
            }

            .error-msg {
              color: #aaa;
              margin-top: 2px;
            }

            .error-time {
              color: #666;
              font-size: 0.85em;
              margin-top: 2px;
            }

            .empty-state {
              color: #888;
              font-style: italic;
            }

            .utility-item {
              padding: 8px;
              background: rgba(255,255,255,0.05);
              border-radius: 4px;
              margin-bottom: 8px;
            }

            .utility-item strong {
              color: #fff;
            }

            .utility-desc {
              color: #888;
              font-size: 0.9em;
              margin-top: 4px;
            }

            .info-box {
              margin-top: 16px;
              padding: 12px;
              background: rgba(100,150,255,0.1);
              border-left: 3px solid #6496ff;
              border-radius: 4px;
            }

            .info-box strong {
              color: #fff;
            }

            .info-text {
              margin-top: 6px;
              color: #aaa;
              font-size: 0.9em;
            }

            .scrollable {
              max-height: 300px;
              overflow-y: auto;
            }
          </style>

          <div class="widget-panel">
            <h3>▤ Logger Statistics</h3>
            <div class="stats-grid">
              <div class="stat-box debug">
                <div class="stat-label">DEBUG</div>
                <div class="stat-value">${_loggerStats.debug}</div>
              </div>
              <div class="stat-box info">
                <div class="stat-label">INFO</div>
                <div class="stat-value">${_loggerStats.info}</div>
              </div>
              <div class="stat-box warn">
                <div class="stat-label">WARN</div>
                <div class="stat-value">${_loggerStats.warn}</div>
              </div>
              <div class="stat-box error">
                <div class="stat-label">ERROR</div>
                <div class="stat-value">${_loggerStats.error}</div>
              </div>
            </div>

            <h3 class="section-header">△ Error Statistics</h3>
            <div style="margin-top: 12px;">
              ${Object.entries(_errorStats).map(([type, count]) => `
                <div class="error-stat">
                  <span>${type}</span>
                  <span class="error-stat-count">${count}</span>
                </div>
              `).join('') || '<div class="empty-state">No errors created yet</div>'}
            </div>

            ${_recentErrors.length > 0 ? `
              <h3 class="section-header">⏲ Recent Errors (Last 10)</h3>
              <div class="scrollable" style="margin-top: 12px;">
                ${recentErrorsHtml}
              </div>
            ` : ''}

            <h3 class="section-header">⚒ Available Utilities (${utilities.length})</h3>
            <div style="margin-top: 12px;">
              ${utilities.map(util => `
                <div class="utility-item">
                  <strong>${util.name}</strong>
                  <div class="utility-desc">${util.desc}</div>
                </div>
              `).join('')}
            </div>

            <div class="info-box">
              <strong>▤ Total Activity</strong>
              <div class="info-text">
                ${totalLogs} total log calls • ${totalErrors} total errors created
              </div>
            </div>
          </div>
        `;
      }
    }

    // Define custom element
    if (!customElements.get('utils-widget')) {
      customElements.define('utils-widget', UtilsWidget);
    }

    // Widget interface
    const widget = {
      element: 'utils-widget',
      displayName: 'Utilities',
      icon: '⚒',
      category: 'core',
      updateInterval: null
    };

    return { ...api, widget };
  }
};

// Export standardized module for ES modules
export default Utils;