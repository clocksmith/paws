import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('AuditLogger Module', () => {
  let AuditLogger;
  let mockDeps;
  let loggerInstance;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T10:30:00Z'));

    global.navigator = {
      userAgent: 'Test Browser/1.0'
    };

    mockDeps = {
      Storage: {
        getArtifactContent: vi.fn(),
        setArtifactContent: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

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

    AuditLogger = {
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

        const recentLogs = [];
        const MAX_RECENT_LOGS = 100;

        const createAuditEntry = (eventType, details = {}, severity = 'info') => {
          const entry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date().toISOString(),
            eventType,
            severity,
            details,
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
          };

          recentLogs.push(entry);
          if (recentLogs.length > MAX_RECENT_LOGS) {
            recentLogs.shift();
          }

          return entry;
        };

        const persistAuditLog = async (entry) => {
          const date = new Date().toISOString().split('T')[0];
          const logPath = `/.audit/${date}.jsonl`;

          try {
            let existingContent = '';
            try {
              existingContent = await Storage.getArtifactContent(logPath) || '';
            } catch (err) {
              // File doesn't exist yet
            }

            const newLine = JSON.stringify(entry) + '\n';
            const updatedContent = existingContent + newLine;

            await Storage.setArtifactContent(logPath, updatedContent);
          } catch (err) {
            logger.error('[AuditLogger] Failed to write to audit log file:', err);
            throw err;
          }
        };

        const logEvent = async (eventType, details = {}, severity = 'info') => {
          const entry = createAuditEntry(eventType, details, severity);

          const logLevel = severity === 'error' ? 'error' : severity === 'warn' ? 'warn' : 'info';
          logger[logLevel](`[AuditLogger] ${eventType}`, details);

          try {
            await persistAuditLog(entry);
          } catch (err) {
            logger.warn('[AuditLogger] Failed to persist audit log:', err);
          }

          return entry;
        };

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

        const queryLogs = async (options = {}) => {
          const { date, eventType, severity, limit } = options;

          if (!date) {
            let results = [...recentLogs];

            if (eventType) {
              results = results.filter(entry => entry.eventType === eventType);
            }
            if (severity) {
              results = results.filter(entry => entry.severity === severity);
            }

            if (limit) {
              results = results.slice(-limit);
            }

            return results;
          }

          const logPath = `/.audit/${date}.jsonl`;
          try {
            const content = await Storage.getArtifactContent(logPath);
            if (!content) {
              return [];
            }

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

            if (eventType) {
              entries = entries.filter(entry => entry.eventType === eventType);
            }
            if (severity) {
              entries = entries.filter(entry => entry.severity === severity);
            }

            if (limit) {
              entries = entries.slice(-limit);
            }

            return entries;
          } catch (err) {
            logger.warn(`[AuditLogger] Failed to read audit log for ${date}:`, err);
            return [];
          }
        };

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
            stats.byEventType[entry.eventType] = (stats.byEventType[entry.eventType] || 0) + 1;
            stats.bySeverity[entry.severity] = (stats.bySeverity[entry.severity] || 0) + 1;

            if (entry.eventType === AuditEventType.SECURITY_VIOLATION) {
              stats.securityViolations++;
            }

            if (entry.severity === 'error' || entry.details.success === false) {
              stats.failedOperations++;
            }
          });

          return stats;
        };

        const exportLogs = async (startDate, endDate) => {
          const start = new Date(startDate);
          const end = new Date(endDate);
          const logs = [];

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];
            const dailyLogs = await queryLogs({ date: dateStr });
            logs.push(...dailyLogs);
          }

          logs.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

          return logs.map(entry => JSON.stringify(entry)).join('\n');
        };

        return {
          init: async () => {
            logger.info('[AuditLogger] Audit logging system initialized');
            return true;
          },
          api: {
            AuditEventType,
            logEvent,
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
            queryLogs,
            getStats,
            exportLogs,
            getRecentLogs: () => [...recentLogs]
          }
        };
      }
    };

    loggerInstance = AuditLogger.factory(mockDeps);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    delete global.navigator;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(AuditLogger.metadata.id).toBe('AuditLogger');
      expect(AuditLogger.metadata.version).toBe('1.0.0');
      expect(AuditLogger.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(AuditLogger.metadata.dependencies).toContain('Storage');
      expect(AuditLogger.metadata.dependencies).toContain('Utils');
    });

    it('should be async type', () => {
      expect(AuditLogger.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      const result = await loggerInstance.init();

      expect(result).toBe(true);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Audit logging system initialized')
      );
    });
  });

  describe('Audit Entry Creation', () => {
    it('should create audit entry with all fields', async () => {
      const entry = await loggerInstance.api.logEvent('TEST_EVENT', { key: 'value' }, 'info');

      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('timestamp');
      expect(entry.eventType).toBe('TEST_EVENT');
      expect(entry.severity).toBe('info');
      expect(entry.details).toEqual({ key: 'value' });
      expect(entry.userAgent).toBe('Test Browser/1.0');
    });

    it('should generate unique IDs', async () => {
      const entry1 = await loggerInstance.api.logEvent('EVENT1');
      const entry2 = await loggerInstance.api.logEvent('EVENT2');

      expect(entry1.id).not.toBe(entry2.id);
    });

    it('should use ISO timestamp format', async () => {
      const entry = await loggerInstance.api.logEvent('TEST');

      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('Log Persistence', () => {
    it('should persist log to daily file', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('');
      mockDeps.Storage.setArtifactContent.mockResolvedValue(undefined);

      await loggerInstance.api.logEvent('TEST_EVENT', { data: 'test' });

      expect(mockDeps.Storage.setArtifactContent).toHaveBeenCalledWith(
        '/.audit/2025-01-15.jsonl',
        expect.stringContaining('TEST_EVENT')
      );
    });

    it('should append to existing log file', async () => {
      const existingLog = '{"id":"old","eventType":"OLD"}\n';
      mockDeps.Storage.getArtifactContent.mockResolvedValue(existingLog);
      mockDeps.Storage.setArtifactContent.mockResolvedValue(undefined);

      await loggerInstance.api.logEvent('NEW_EVENT');

      const call = mockDeps.Storage.setArtifactContent.mock.calls[0];
      const content = call[1];

      expect(content).toContain('OLD');
      expect(content).toContain('NEW_EVENT');
      expect(content.split('\n').length).toBe(3); // 2 entries + empty line
    });

    it('should handle missing log file gracefully', async () => {
      mockDeps.Storage.getArtifactContent.mockRejectedValue(new Error('Not found'));
      mockDeps.Storage.setArtifactContent.mockResolvedValue(undefined);

      const entry = await loggerInstance.api.logEvent('TEST');

      expect(entry).toBeDefined();
      expect(mockDeps.Storage.setArtifactContent).toHaveBeenCalled();
    });

    it('should continue operation if persistence fails', async () => {
      mockDeps.Storage.setArtifactContent.mockRejectedValue(new Error('Write failed'));

      const entry = await loggerInstance.api.logEvent('TEST');

      expect(entry).toBeDefined();
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist'),
        expect.any(Error)
      );
    });
  });

  describe('Module Load Logging', () => {
    it('should log successful module load', async () => {
      const entry = await loggerInstance.api.logModuleLoad('TestModule', '/modules/test.js', true);

      expect(entry.eventType).toBe('MODULE_LOAD');
      expect(entry.details.moduleId).toBe('TestModule');
      expect(entry.details.success).toBe(true);
      expect(entry.severity).toBe('info');
    });

    it('should log failed module load as error', async () => {
      const entry = await loggerInstance.api.logModuleLoad('TestModule', '/test.js', false, { error: 'Not found' });

      expect(entry.severity).toBe('error');
      expect(entry.details.error).toBe('Not found');
    });
  });

  describe('Module Verification Logging', () => {
    it('should log verified module', async () => {
      const entry = await loggerInstance.api.logModuleVerify('TestModule', true);

      expect(entry.eventType).toBe('MODULE_VERIFY');
      expect(entry.details.verified).toBe(true);
      expect(entry.severity).toBe('info');
    });

    it('should log unverified module as warning', async () => {
      const entry = await loggerInstance.api.logModuleVerify('TestModule', false);

      expect(entry.severity).toBe('warn');
    });
  });

  describe('VFS Operations Logging', () => {
    it('should log file creation', async () => {
      const entry = await loggerInstance.api.logVfsCreate('/test.txt', 'file', 1024);

      expect(entry.eventType).toBe('VFS_CREATE');
      expect(entry.details.path).toBe('/test.txt');
      expect(entry.details.size).toBe(1024);
      expect(entry.severity).toBe('info');
    });

    it('should log file update', async () => {
      const entry = await loggerInstance.api.logVfsUpdate('/test.txt', 2048);

      expect(entry.eventType).toBe('VFS_UPDATE');
      expect(entry.details.size).toBe(2048);
    });

    it('should log file deletion as warning', async () => {
      const entry = await loggerInstance.api.logVfsDelete('/test.txt');

      expect(entry.eventType).toBe('VFS_DELETE');
      expect(entry.severity).toBe('warn');
    });
  });

  describe('API Call Logging', () => {
    it('should log successful API call', async () => {
      const entry = await loggerInstance.api.logApiCall('/api/test', true, 200);

      expect(entry.eventType).toBe('API_CALL');
      expect(entry.details.endpoint).toBe('/api/test');
      expect(entry.details.responseCode).toBe(200);
      expect(entry.severity).toBe('info');
    });

    it('should log failed API call as error', async () => {
      const entry = await loggerInstance.api.logApiCall('/api/test', false, 500);

      expect(entry.severity).toBe('error');
      expect(entry.details.success).toBe(false);
    });
  });

  describe('Rate Limit Logging', () => {
    it('should log rate limit not exceeded', async () => {
      const entry = await loggerInstance.api.logRateLimit('api', false);

      expect(entry.eventType).toBe('RATE_LIMIT');
      expect(entry.details.exceeded).toBe(false);
      expect(entry.severity).toBe('info');
    });

    it('should log rate limit exceeded as warning', async () => {
      const entry = await loggerInstance.api.logRateLimit('api', true);

      expect(entry.severity).toBe('warn');
    });
  });

  describe('Security Violation Logging', () => {
    it('should log security violation as error', async () => {
      const entry = await loggerInstance.api.logSecurityViolation('unauthorized_access', {
        attempted: '/admin',
        ip: '1.2.3.4'
      });

      expect(entry.eventType).toBe('SECURITY_VIOLATION');
      expect(entry.severity).toBe('error');
      expect(entry.details.violationType).toBe('unauthorized_access');
    });
  });

  describe('Session Logging', () => {
    it('should log session start', async () => {
      const entry = await loggerInstance.api.logSessionStart('sess123', 'Complete task');

      expect(entry.eventType).toBe('SESSION_START');
      expect(entry.details.sessionId).toBe('sess123');
      expect(entry.details.goal).toBe('Complete task');
    });

    it('should log session end', async () => {
      const entry = await loggerInstance.api.logSessionEnd('sess123', 'completed');

      expect(entry.eventType).toBe('SESSION_END');
      expect(entry.details.status).toBe('completed');
    });
  });

  describe('Recent Logs Buffer', () => {
    it('should maintain recent logs', async () => {
      await loggerInstance.api.logEvent('EVENT1');
      await loggerInstance.api.logEvent('EVENT2');
      await loggerInstance.api.logEvent('EVENT3');

      const recent = loggerInstance.api.getRecentLogs();

      expect(recent).toHaveLength(3);
      expect(recent[0].eventType).toBe('EVENT1');
      expect(recent[2].eventType).toBe('EVENT3');
    });

    it('should limit recent logs to 100 entries', async () => {
      for (let i = 0; i < 150; i++) {
        await loggerInstance.api.logEvent(`EVENT${i}`);
      }

      const recent = loggerInstance.api.getRecentLogs();

      expect(recent).toHaveLength(100);
      expect(recent[0].eventType).toBe('EVENT50');
      expect(recent[99].eventType).toBe('EVENT149');
    });
  });

  describe('Query Logs', () => {
    beforeEach(async () => {
      await loggerInstance.api.logEvent('MODULE_LOAD', {}, 'info');
      await loggerInstance.api.logEvent('VFS_CREATE', {}, 'info');
      await loggerInstance.api.logEvent('API_CALL', {}, 'error');
      await loggerInstance.api.logEvent('MODULE_LOAD', {}, 'warn');
    });

    it('should query recent logs without date', async () => {
      const logs = await loggerInstance.api.queryLogs();

      expect(logs).toHaveLength(4);
    });

    it('should filter by event type', async () => {
      const logs = await loggerInstance.api.queryLogs({ eventType: 'MODULE_LOAD' });

      expect(logs).toHaveLength(2);
      expect(logs.every(log => log.eventType === 'MODULE_LOAD')).toBe(true);
    });

    it('should filter by severity', async () => {
      const logs = await loggerInstance.api.queryLogs({ severity: 'error' });

      expect(logs).toHaveLength(1);
      expect(logs[0].eventType).toBe('API_CALL');
    });

    it('should apply limit', async () => {
      const logs = await loggerInstance.api.queryLogs({ limit: 2 });

      expect(logs).toHaveLength(2);
    });

    it('should query from VFS by date', async () => {
      const jsonl = '{"eventType":"TEST1"}\n{"eventType":"TEST2"}\n';
      mockDeps.Storage.getArtifactContent.mockResolvedValue(jsonl);

      const logs = await loggerInstance.api.queryLogs({ date: '2025-01-15' });

      expect(logs).toHaveLength(2);
      expect(mockDeps.Storage.getArtifactContent).toHaveBeenCalledWith('/.audit/2025-01-15.jsonl');
    });

    it('should handle missing VFS log file', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue(null);

      const logs = await loggerInstance.api.queryLogs({ date: '2025-01-15' });

      expect(logs).toHaveLength(0);
    });

    it('should skip invalid JSON lines', async () => {
      const jsonl = '{"eventType":"VALID"}\n{invalid json}\n{"eventType":"VALID2"}\n';
      mockDeps.Storage.getArtifactContent.mockResolvedValue(jsonl);

      const logs = await loggerInstance.api.queryLogs({ date: '2025-01-15' });

      expect(logs).toHaveLength(2);
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    beforeEach(async () => {
      await loggerInstance.api.logModuleLoad('Mod1', '/mod1', true);
      await loggerInstance.api.logModuleLoad('Mod2', '/mod2', false);
      await loggerInstance.api.logVfsCreate('/file1', 'file', 100);
      await loggerInstance.api.logSecurityViolation('test');
      await loggerInstance.api.logApiCall('/api', false, 500);
    });

    it('should calculate statistics', async () => {
      const stats = await loggerInstance.api.getStats();

      expect(stats.total).toBe(5);
      expect(stats.byEventType.MODULE_LOAD).toBe(2);
      expect(stats.byEventType.VFS_CREATE).toBe(1);
      expect(stats.byEventType.SECURITY_VIOLATION).toBe(1);
    });

    it('should count security violations', async () => {
      const stats = await loggerInstance.api.getStats();

      expect(stats.securityViolations).toBe(1);
    });

    it('should count failed operations', async () => {
      const stats = await loggerInstance.api.getStats();

      expect(stats.failedOperations).toBeGreaterThan(0);
    });

    it('should count by severity', async () => {
      const stats = await loggerInstance.api.getStats();

      expect(stats.bySeverity.info).toBeGreaterThan(0);
      expect(stats.bySeverity.error).toBeGreaterThan(0);
    });
  });

  describe('Export Logs', () => {
    it('should export logs for date range', async () => {
      const log1 = JSON.stringify({ timestamp: '2025-01-15T10:00:00Z', eventType: 'TEST1' });
      const log2 = JSON.stringify({ timestamp: '2025-01-16T10:00:00Z', eventType: 'TEST2' });

      mockDeps.Storage.getArtifactContent
        .mockResolvedValueOnce(log1 + '\n')
        .mockResolvedValueOnce(log2 + '\n');

      const exported = await loggerInstance.api.exportLogs('2025-01-15', '2025-01-16');

      expect(exported).toContain('TEST1');
      expect(exported).toContain('TEST2');
      expect(mockDeps.Storage.getArtifactContent).toHaveBeenCalledTimes(2);
    });

    it('should sort logs by timestamp', async () => {
      const log1 = JSON.stringify({ timestamp: '2025-01-15T12:00:00Z', eventType: 'LATER' });
      const log2 = JSON.stringify({ timestamp: '2025-01-15T10:00:00Z', eventType: 'EARLIER' });

      mockDeps.Storage.getArtifactContent.mockResolvedValue(log1 + '\n' + log2 + '\n');

      const exported = await loggerInstance.api.exportLogs('2025-01-15', '2025-01-15');
      const lines = exported.split('\n').filter(l => l);

      const first = JSON.parse(lines[0]);
      expect(first.eventType).toBe('EARLIER');
    });

    it('should handle single day export', async () => {
      mockDeps.Storage.getArtifactContent.mockResolvedValue('{"eventType":"TEST"}\n');

      const exported = await loggerInstance.api.exportLogs('2025-01-15', '2025-01-15');

      expect(exported).toContain('TEST');
    });
  });

  describe('Event Type Constants', () => {
    it('should expose all event types', () => {
      const types = loggerInstance.api.AuditEventType;

      expect(types).toHaveProperty('MODULE_LOAD');
      expect(types).toHaveProperty('VFS_CREATE');
      expect(types).toHaveProperty('API_CALL');
      expect(types).toHaveProperty('SECURITY_VIOLATION');
      expect(types).toHaveProperty('SESSION_START');
    });
  });
});
