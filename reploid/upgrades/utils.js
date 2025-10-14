/**
 * @fileoverview Standardized Utils Module for REPLOID
 * Core utilities, error classes, and helper functions used across the system.
 * This is a pure module with no dependencies - safe for any module to import.
 *
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
      constructor(message, details = {}) {
        super(message);
        this.name = this.constructor.name;
        this.details = details;
      }
    }

    /** @class ApiError - LLM API communication errors */
    class ApiError extends ApplicationError {}

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
    const kabobToCamel = (s) => s.replace(/-([a-z])/g, (g) => g[1].toUpperCase());

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
    const trunc = (str, len) =>
      (str.length > len ? str.substring(0, len - 3) + "..." : str);

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
      const subscriptions = new Map(); // moduleId -> Set of unsubscribe functions

      return {
        /**
         * Track a subscription for later cleanup.
         * @param {string} moduleId - Module identifier
         * @param {Function} unsubscribeFn - Function to call to unsubscribe
         */
        track: (moduleId, unsubscribeFn) => {
          if (!subscriptions.has(moduleId)) {
            subscriptions.set(moduleId, new Set());
          }
          subscriptions.get(moduleId).add(unsubscribeFn);
        },

        /**
         * Unsubscribe all tracked subscriptions for a module.
         * @param {string} moduleId - Module identifier
         */
        unsubscribeAll: (moduleId) => {
          const moduleSubs = subscriptions.get(moduleId);
          if (moduleSubs) {
            moduleSubs.forEach(unsub => unsub());
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
          return subscriptions.get(moduleId)?.size || 0;
        },

        /**
         * Get report of all active subscriptions.
         * @returns {Object} Object mapping moduleId to subscription count
         */
        getAllActive: () => {
          const report = {};
          subscriptions.forEach((subs, moduleId) => {
            report[moduleId] = subs.size;
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
     * showButtonSuccess(exportBtn, '💾 Export Report', '✓ Exported!');
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

    // Public API
    return {
      Errors,
      logger,
      kabobToCamel,
      trunc,
      escapeHtml,
      sanitizeLlmJsonRespPure,
      post,
      createSubscriptionTracker,
      showButtonSuccess,
      exportAsMarkdown
    };
  }
};

// Export standardized module
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Utils;
}
Utils;