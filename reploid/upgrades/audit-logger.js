/**
 * @fileoverview Audit Logger Module for REPLOID
 * Provides comprehensive audit logging for security-sensitive operations.
 * Tracks module loads, VFS operations, API calls, and security events.
 *
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
      }
    };
  }
};

// Export standardized module
AuditLogger;
