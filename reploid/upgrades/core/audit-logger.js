/**
 * @fileoverview Audit Logger Module for REPLOID
 * Provides comprehensive audit logging for security-sensitive operations.
 * Tracks module loads, VFS operations, API calls, and security events.
 *
 * @blueprint 0x00002E - Documents the audit logging policy.
 * @module AuditLogger
 * @version 1.0.0
 * @category security
 */

const AuditLogger = {
  metadata: {
    id: 'AuditLogger',
    version: '1.0.0',
    dependencies: ['Storage', 'Utils'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { Storage, Utils } = deps;
    const { logger } = Utils;

    // Audit log entry types
    const AuditEventType = {
      MODULE_LOAD: 'MODULE_LOAD',
      MODULE_VERIFY: 'MODULE_VERIFY',
      VFS_CREATE: 'VFS_CREATE',
      VFS_UPDATE: 'VFS_UPDATE',
      VFS_DELETE: 'VFS_DELETE',
      API_CALL: 'API_CALL',
      RATE_LIMIT: 'RATE_LIMIT',
      SECURITY_VIOLATION: 'SECURITY_VIOLATION',
      SESSION_START: 'SESSION_START',
      SESSION_END: 'SESSION_END'
    };

    // In-memory buffer for recent logs (last 100 entries)
    const recentLogs = [];
    const MAX_RECENT_LOGS = 100;

    /**
     * Create an audit log entry
     * @param {string} eventType - Type of event from AuditEventType
     * @param {Object} details - Event-specific details
     * @param {string} [severity='info'] - Severity level (info|warn|error)
     * @returns {Object} The created audit entry
     */
    const createAuditEntry = (eventType, details = {}, severity = 'info') => {
      const entry = {
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        eventType,
        severity,
        details,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      };

      // Add to recent logs buffer
      recentLogs.push(entry);
      if (recentLogs.length > MAX_RECENT_LOGS) {
        recentLogs.shift(); // Remove oldest entry
      }

      return entry;
    };

    /**
     * Log an audit event
     * @param {string} eventType - Type of event
     * @param {Object} details - Event details
     * @param {string} [severity='info'] - Severity level
     */
    const logEvent = async (eventType, details = {}, severity = 'info') => {
      const entry = createAuditEntry(eventType, details, severity);

      // Console log for immediate visibility
      const logLevel = severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'info';
      logger[logLevel](`[AuditLogger] ${eventType}`, details);

      // Persist to VFS
      try {
        await persistAuditLog(entry);
      } catch (err) {
        // Don't fail operations if audit logging fails, but warn
        logger.warn('[AuditLogger] Failed to persist audit log:', err);
      }

      return entry;
    };

    /**
     * Persist audit log entry to VFS
     * @param {Object} entry - Audit log entry
     */
    const persistAuditLog = async (entry) => {
      // Store in daily log file
      const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const logPath = `/.audit/${date}.jsonl`;

      try {
        // Read existing log file (JSONL format - one JSON object per line)
        let existingContent = '';
        try {
          existingContent = await Storage.getArtifactContent(logPath) || '';
        } catch (err) {
          // File doesn't exist yet, that's OK
        }

        // Append new entry as JSON line
        const newLine = JSON.stringify(entry) + '\n';
        const updatedContent = existingContent + newLine;

        await Storage.setArtifactContent(logPath, updatedContent);
      } catch (err) {
        logger.error('[AuditLogger] Failed to write to audit log file:', err);
        throw err;
      }
    };

    /**
     * Specific audit logging functions for common operations
     */

    const logModuleLoad = async (moduleId, vfsPath, success, details = {}) => {
      return await logEvent(
        AuditEventType.MODULE_LOAD,
        { moduleId, vfsPath, success, ...details },
        success ? 'info' : 'error'
      );
    };

    const logModuleVerify = async (moduleId, verified, details = {}) => {
      return await logEvent(
        AuditEventType.MODULE_VERIFY,
        { moduleId, verified, ...details },
        verified ? 'info' : 'warn'
      );
    };

    const logVfsCreate = async (path, type, size, details = {}) => {
      return await logEvent(
        AuditEventType.VFS_CREATE,
        { path, type, size, ...details },
        'info'
      );
    };

    const logVfsUpdate = async (path, size, details = {}) => {
      return await logEvent(
        AuditEventType.VFS_UPDATE,
        { path, size, ...details },
        'info'
      );
    };

    const logVfsDelete = async (path, details = {}) => {
      return await logEvent(
        AuditEventType.VFS_DELETE,
        { path, ...details },
        'warn'
      );
    };

    const logApiCall = async (endpoint, success, responseCode, details = {}) => {
      return await logEvent(
        AuditEventType.API_CALL,
        { endpoint, success, responseCode, ...details },
        success ? 'info' : 'error'
      );
    };

    const logRateLimit = async (rateLimitType, exceeded, details = {}) => {
      return await logEvent(
        AuditEventType.RATE_LIMIT,
        { rateLimitType, exceeded, ...details },
        exceeded ? 'warn' : 'info'
      );
    };

    const logSecurityViolation = async (violationType, details = {}) => {
      return await logEvent(
        AuditEventType.SECURITY_VIOLATION,
        { violationType, ...details },
        'error'
      );
    };

    const logSessionStart = async (sessionId, goal, details = {}) => {
      return await logEvent(
        AuditEventType.SESSION_START,
        { sessionId, goal, ...details },
        'info'
      );
    };

    const logSessionEnd = async (sessionId, status, details = {}) => {
      return await logEvent(
        AuditEventType.SESSION_END,
        { sessionId, status, ...details },
        'info'
      );
    };

    /**
     * Query audit logs
     * @param {Object} options - Query options
     * @param {string} [options.date] - Date to query (YYYY-MM-DD)
     * @param {string} [options.eventType] - Filter by event type
     * @param {string} [options.severity] - Filter by severity
     * @param {number} [options.limit] - Max number of results
     * @returns {Array} Matching audit log entries
     */
    const queryLogs = async (options = {}) => {
      const { date, eventType, severity, limit } = options;

      // If no date specified, return from recent logs buffer
      if (!date) {
        let results = [...recentLogs];

        // Apply filters
        if (eventType) {
          results = results.filter(entry => entry.eventType === eventType);
        }
        if (severity) {
          results = results.filter(entry => entry.severity === severity);
        }

        // Apply limit
        if (limit) {
          results = results.slice(-limit);
        }

        return results;
      }

      // Query from VFS
      const logPath = `/.audit/${date}.jsonl`;
      try {
        const content = await Storage.getArtifactContent(logPath);
        if (!content) {
          return [];
        }

        // Parse JSONL (one JSON object per line)
        const lines = content.trim().split('\n');
        let entries = lines
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (err) {
              logger.warn('[AuditLogger] Failed to parse log line:', line);
              return null;
            }
          })
          .filter(entry => entry !== null);

        // Apply filters
        if (eventType) {
          entries = entries.filter(entry => entry.eventType === eventType);
        }
        if (severity) {
          entries = entries.filter(entry => entry.severity === severity);
        }

        // Apply limit
        if (limit) {
          entries = entries.slice(-limit);
        }

        return entries;
      } catch (err) {
        logger.warn(`[AuditLogger] Failed to read audit log for ${date}:`, err);
        return [];
      }
    };

    /**
     * Get audit log statistics
     * @param {string} [date] - Date to analyze (YYYY-MM-DD)
     * @returns {Object} Statistics object
     */
    const getStats = async (date) => {
      const logs = await queryLogs({ date });

      const stats = {
        total: logs.length,
        byEventType: {},
        bySeverity: {},
        securityViolations: 0,
        failedOperations: 0
      };

      logs.forEach(entry => {
        // Count by event type
        stats.byEventType[entry.eventType] = (stats.byEventType[entry.eventType] || 0) + 1;

        // Count by severity
        stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;

        // Count security violations
        if (entry.eventType === AuditEventType.SECURITY_VIOLATION) {
          stats.securityViolations++;
        }

        // Count failed operations
        if (entry.severity === 'error' || entry.details.success === false) {
          stats.failedOperations++;
        }
      });

      return stats;
    };

    /**
     * Export audit logs for a date range
     * @param {string} startDate - Start date (YYYY-MM-DD)
     * @param {string} endDate - End date (YYYY-MM-DD)
     * @returns {string} Combined audit log content
     */
    const exportLogs = async (startDate, endDate) => {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const logs = [];

      // Iterate through dates
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        const dailyLogs = await queryLogs({ date: dateStr });
        logs.push(...dailyLogs);
      }

      // Sort by timestamp
      logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // Return as JSONL
      return logs.map(entry => JSON.stringify(entry)).join('\n');
    };

    // Web Component Widget
    class AuditLoggerWidget extends HTMLElement {
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
        // Auto-refresh every 2 seconds
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const totalEvents = recentLogs.length;
        const securityViolations = recentLogs.filter(e => e.eventType === AuditEventType.SECURITY_VIOLATION).length;
        const errors = recentLogs.filter(e => e.severity === 'error').length;
        const lastEvent = recentLogs.length > 0 ? recentLogs[recentLogs.length - 1].timestamp : null;

        let state = 'idle';
        if (totalEvents > 0 && lastEvent && Date.now() - new Date(lastEvent).getTime() < 5000) state = 'active';
        if (securityViolations > 0) state = 'warning';
        if (errors > 0) state = 'error';

        return {
          state,
          primaryMetric: `${totalEvents} events`,
          secondaryMetric: `${errors} errors`,
          lastActivity: lastEvent ? new Date(lastEvent).getTime() : null
        };
      }

      getControls() {
        return [
          {
            id: 'export-logs',
            label: '↓ Export',
            action: async () => {
              const today = new Date().toISOString().split('T')[0];
              const logs = await exportLogs(today, today);
              const blob = new Blob([logs], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `audit-log-${today}.txt`;
              a.click();
              URL.revokeObjectURL(url);
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Audit log exported', 'success');
            }
          },
          {
            id: 'clear-recent',
            label: '⌦ Clear',
            action: () => {
              recentLogs.length = 0;
              this.render();
              const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
              ToastNotifications?.show?.('Recent logs cleared', 'success');
            }
          }
        ];
      }

      render() {
        const formatTime = (isoString) => {
          if (!isoString) return 'Never';
          return new Date(isoString).toLocaleTimeString();
        };

        // Count by event type
        const eventTypeCounts = {};
        const severityCounts = { info: 0, warn: 0, error: 0 };
        recentLogs.forEach(entry => {
          eventTypeCounts[entry.eventType] = (eventTypeCounts[entry.eventType] || 0) + 1;
          severityCounts[entry.severity] = (severityCounts[entry.severity] || 0) + 1;
        });

        const topEventTypes = Object.entries(eventTypeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
            }
            .audit-logger-panel {
              padding: 12px;
              color: #fff;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 1.1em;
            }
            h5 {
              margin: 16px 0 8px 0;
              font-size: 0.9em;
              color: #aaa;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 10px;
              margin-bottom: 16px;
            }
            .stat-card {
              background: rgba(255, 255, 255, 0.05);
              padding: 12px;
              border-radius: 6px;
            }
            .stat-label {
              font-size: 0.8em;
              color: #888;
              margin-bottom: 4px;
            }
            .stat-value {
              font-size: 1.5em;
              font-weight: bold;
              color: #4fc3f7;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 0.9em;
            }
            th {
              text-align: left;
              padding: 8px;
              border-bottom: 1px solid rgba(255, 255, 255, 0.1);
              color: #888;
            }
            td {
              padding: 6px 8px;
            }
            .event-type-name {
              color: #4fc3f7;
            }
            .event-type-count {
              text-align: right;
              font-weight: bold;
            }
            .audit-event-stream {
              max-height: 400px;
              overflow-y: auto;
              margin-top: 8px;
            }
            .audit-event-entry {
              padding: 8px;
              margin: 4px 0;
              background: rgba(255, 255, 255, 0.05);
              border-radius: 4px;
              display: flex;
              gap: 10px;
              align-items: center;
              font-size: 12px;
            }
            .audit-event-entry.severity-error {
              border-left: 3px solid #f48771;
            }
            .audit-event-entry.severity-warn {
              border-left: 3px solid #ffb74d;
            }
            .event-time {
              font-family: monospace;
              color: #888;
            }
            .event-type {
              font-weight: bold;
              min-width: 120px;
            }
            .event-severity {
              padding: 2px 6px;
              border-radius: 3px;
              font-size: 11px;
            }
            .severity-badge-info {
              background: rgba(79, 195, 247, 0.2);
              color: #4fc3f7;
            }
            .severity-badge-warn {
              background: rgba(255, 183, 77, 0.2);
              color: #ffb74d;
            }
            .severity-badge-error {
              background: rgba(244, 135, 113, 0.2);
              color: #f48771;
            }
            .event-path {
              color: #4fc3f7;
              font-family: monospace;
            }
            .event-message {
              flex: 1;
              color: #aaa;
            }
            .audit-info {
              margin-top: 16px;
              padding: 12px;
              background: rgba(255, 255, 255, 0.03);
              border-radius: 6px;
            }
            .audit-info p {
              margin: 4px 0;
              font-size: 0.85em;
              color: #888;
            }
          </style>
          <div class="audit-logger-panel">
            <h4>⊠ Audit Logger</h4>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Total Events</div>
                <div class="stat-value">${recentLogs.length}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Errors</div>
                <div class="stat-value">${severityCounts.error}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Warnings</div>
                <div class="stat-value">${severityCounts.warn}</div>
              </div>
              <div class="stat-card">
                <div class="stat-label">Security Violations</div>
                <div class="stat-value">${eventTypeCounts[AuditEventType.SECURITY_VIOLATION] || 0}</div>
              </div>
            </div>

            <h5>Events by Type</h5>
            <div class="event-type-breakdown">
              <table>
                <thead>
                  <tr>
                    <th>Event Type</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  ${topEventTypes.map(([type, count]) => `
                    <tr>
                      <td class="event-type-name">${type}</td>
                      <td class="event-type-count">${count}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <h5>Recent Audit Events</h5>
            <div class="audit-event-stream">
              ${recentLogs.length > 0 ? recentLogs.slice(-20).reverse().map(entry => `
                <div class="audit-event-entry severity-${entry.severity}">
                  <span class="event-time">${formatTime(entry.timestamp)}</span>
                  <span class="event-type">${entry.eventType}</span>
                  <span class="event-severity severity-badge-${entry.severity}">${entry.severity}</span>
                  ${entry.details.path ? `<span class="event-path">${entry.details.path}</span>` : ''}
                  ${entry.details.message ? `<span class="event-message">${entry.details.message}</span>` : ''}
                </div>
              `).join('') : '<p>No audit events yet</p>'}
            </div>

            <div class="audit-info">
              <h5>Audit Coverage</h5>
              <p>Logging: Module loads, VFS operations, API calls, security events</p>
              <p>Retention: Last ${MAX_RECENT_LOGS} events in memory, persistent logs in IndexedDB</p>
            </div>
          </div>
        `;
      }
    }

    // Register custom element
    const elementName = 'audit-logger-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, AuditLoggerWidget);
    }

    return {
      init: async () => {
        logger.info('[AuditLogger] Audit logging system initialized');
        return true;
      },
      api: {
        // Event types
        AuditEventType,

        // Generic logging
        logEvent,

        // Specific logging functions
        logModuleLoad,
        logModuleVerify,
        logVfsCreate,
        logVfsUpdate,
        logVfsDelete,
        logApiCall,
        logRateLimit,
        logSecurityViolation,
        logSessionStart,
        logSessionEnd,

        // Query functions
        queryLogs,
        getStats,
        exportLogs,

        // Direct access to recent logs
        getRecentLogs: () => [...recentLogs]
      },

      // Web Component widget
      widget: {
        element: elementName,
        displayName: 'Audit Logger',
        icon: '⊠',
        category: 'security',
        updateInterval: 2000
      }
    };
  }
};

// Export standardized module
export default AuditLogger;
