/**
 * Unit Tests for Log Panel
 *
 * Blueprint: 0x00006C
 * Module: log-panel.js
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('LogPanel Module', () => {
  let LogPanel;
  let mockEventBus;
  let mockModuleLoader;

  beforeEach(async () => {
    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock ModuleLoader
    mockModuleLoader = {
      getModule: vi.fn()
    };

    // Mock feature flag
    global.isModularPanelEnabled = vi.fn(() => true);
    global.config = {
      featureFlags: {
        useModularPanels: {
          LogPanel: true
        }
      }
    };

    // Import module factory
    const factory = (await import('../../upgrades/log-panel.js')).default;
    LogPanel = factory(mockModuleLoader, mockEventBus);
  });

  afterEach(() => {
    if (LogPanel?.api?.cleanup) {
      LogPanel.api.cleanup();
    }

    delete global.isModularPanelEnabled;
    delete global.config;
  });

  describe('Initialization', () => {
    it('should export api and widget objects', () => {
      expect(LogPanel).toHaveProperty('api');
      expect(LogPanel).toHaveProperty('widget');
    });

    it('should subscribe to log:message and log:clear', () => {
      LogPanel.api.init();

      expect(mockEventBus.on).toHaveBeenCalledWith('log:message', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('log:clear', expect.any(Function));
    });

    it('should emit ui:panel-ready on successful init', () => {
      LogPanel.api.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'LogPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Logging API', () => {
    beforeEach(() => {
      LogPanel.api.init();
    });

    it('should provide log() method', () => {
      LogPanel.api.log('INFO', 'Test message', 'test-source');

      const logs = LogPanel.api.getLogs();
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[logs.length - 1].message).toBe('Test message');
    });

    it('should provide debug() convenience method', () => {
      LogPanel.api.debug('Debug message', 'test-source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('DEBUG');
    });

    it('should provide info() convenience method', () => {
      LogPanel.api.info('Info message', 'test-source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('INFO');
    });

    it('should provide warn() convenience method', () => {
      LogPanel.api.warn('Warning message', 'test-source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('WARN');
    });

    it('should provide error() convenience method', () => {
      LogPanel.api.error('Error message', 'test-source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('ERROR');
    });

    it('should default source to "unknown" if not provided', () => {
      LogPanel.api.info('Message without source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].source).toBe('unknown');
    });

    it('should normalize log levels to uppercase', () => {
      LogPanel.api.log('info', 'Test', 'source');

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('INFO');
    });
  });

  describe('Circular Buffer', () => {
    beforeEach(() => {
      LogPanel.api.init();
      LogPanel.api.clear();
    });

    it('should limit logs to MAX_LOGS (1000)', () => {
      // Add 1500 logs
      for (let i = 0; i < 1500; i++) {
        LogPanel.api.info(`Log ${i}`, 'test');
      }

      const logs = LogPanel.api.getLogs();
      expect(logs.length).toBe(1000);
    });

    it('should keep most recent logs when buffer is full', () => {
      // Add 1500 logs
      for (let i = 0; i < 1500; i++) {
        LogPanel.api.info(`Log ${i}`, 'test');
      }

      const logs = LogPanel.api.getLogs();

      // Should contain Log 500 through Log 1499
      expect(logs[0].message).toContain('Log 500');
      expect(logs[999].message).toContain('Log 1499');
    });
  });

  describe('Event Handling', () => {
    let logMessageHandler;
    let logClearHandler;

    beforeEach(() => {
      LogPanel.api.init();

      logMessageHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'log:message'
      )[1];

      logClearHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'log:clear'
      )[1];
    });

    it('should handle log:message events', () => {
      logMessageHandler({
        level: 'INFO',
        message: 'Event log message',
        source: 'event-source'
      });

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].message).toBe('Event log message');
    });

    it('should handle log:clear events', () => {
      LogPanel.api.info('Test');
      expect(LogPanel.api.getLogs().length).toBeGreaterThan(0);

      logClearHandler();

      expect(LogPanel.api.getLogs().length).toBe(0);
    });

    it('should default to INFO level if not specified in event', () => {
      logMessageHandler({ message: 'No level specified', source: 'test' });

      const logs = LogPanel.api.getLogs();
      expect(logs[logs.length - 1].level).toBe('INFO');
    });

    it('should not process events when feature flag disabled', () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.LogPanel = false;

      const initialCount = LogPanel.api.getLogs().length;

      logMessageHandler({ level: 'INFO', message: 'Test', source: 'test' });

      expect(LogPanel.api.getLogs().length).toBe(initialCount);
    });
  });

  describe('Filtering', () => {
    beforeEach(() => {
      LogPanel.api.init();
      LogPanel.api.clear();

      // Add test logs
      LogPanel.api.debug('Debug message', 'module-a');
      LogPanel.api.info('Info message', 'module-a');
      LogPanel.api.warn('Warning message', 'module-b');
      LogPanel.api.error('Error message', 'module-b');
    });

    it('should filter by level', () => {
      const filters = {
        levels: { DEBUG: false, INFO: true, WARN: true, ERROR: true },
        source: null,
        text: ''
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(3);  // INFO, WARN, ERROR
      expect(filtered.find(log => log.level === 'DEBUG')).toBeUndefined();
    });

    it('should filter by source', () => {
      const filters = {
        levels: { DEBUG: true, INFO: true, WARN: true, ERROR: true },
        source: 'module-a',
        text: ''
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(2);  // DEBUG and INFO from module-a
      expect(filtered.every(log => log.source === 'module-a')).toBe(true);
    });

    it('should filter by text (message)', () => {
      const filters = {
        levels: { DEBUG: true, INFO: true, WARN: true, ERROR: true },
        source: null,
        text: 'error'
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe('ERROR');
    });

    it('should filter by text (source)', () => {
      const filters = {
        levels: { DEBUG: true, INFO: true, WARN: true, ERROR: true },
        source: null,
        text: 'module-b'
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(2);  // WARN and ERROR from module-b
    });

    it('should be case-insensitive for text filter', () => {
      const filters = {
        levels: { DEBUG: true, INFO: true, WARN: true, ERROR: true },
        source: null,
        text: 'ERROR'
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(1);
    });

    it('should combine multiple filters (AND logic)', () => {
      const filters = {
        levels: { DEBUG: false, INFO: false, WARN: true, ERROR: true },
        source: 'module-b',
        text: 'warning'
      };

      const filtered = LogPanel.api.getFilteredLogs(filters);

      expect(filtered.length).toBe(1);
      expect(filtered[0].level).toBe('WARN');
      expect(filtered[0].source).toBe('module-b');
    });

    it('should return all logs if no filters provided', () => {
      const filtered = LogPanel.api.getFilteredLogs();

      expect(filtered.length).toBe(LogPanel.api.getLogs().length);
    });
  });

  describe('Cleanup', () => {
    it('should unsubscribe all event listeners', () => {
      LogPanel.api.init();
      LogPanel.api.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('log:message', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('log:clear', expect.any(Function));
    });

    it('should be idempotent', () => {
      LogPanel.api.init();
      LogPanel.api.cleanup();
      LogPanel.api.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledTimes(2);
    });
  });

  describe('Clear Functionality', () => {
    it('should clear all logs', () => {
      LogPanel.api.init();
      LogPanel.api.info('Test 1');
      LogPanel.api.info('Test 2');

      expect(LogPanel.api.getLogs().length).toBe(2);

      LogPanel.api.clear();

      expect(LogPanel.api.getLogs().length).toBe(0);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      LogPanel.api.init();
      LogPanel.api.clear();
      LogPanel.api.info('Test log 1', 'source-1');
      LogPanel.api.warn('Test log 2', 'source-2');

      // Mock DOM APIs for export
      global.Blob = vi.fn((parts, options) => ({ parts, options }));
      global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = vi.fn();
      document.createElement = vi.fn((tag) => {
        if (tag === 'a') {
          return { href: '', download: '', click: vi.fn() };
        }
        return document.createElement.wrappedMethod(tag);
      });
      document.createElement.wrappedMethod = document.createElement;
    });

    afterEach(() => {
      delete global.Blob;
    });

    it('should export logs as JSON', () => {
      LogPanel.api.export('json');

      expect(global.Blob).toHaveBeenCalled();
      const blobArgs = global.Blob.mock.calls[0];
      expect(blobArgs[1].type).toBe('application/json');
    });

    it('should export logs as TXT', () => {
      LogPanel.api.export('txt');

      expect(global.Blob).toHaveBeenCalled();
      const blobArgs = global.Blob.mock.calls[0];
      expect(blobArgs[1].type).toBe('text/plain');
    });

    it('should handle invalid export format gracefully', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      LogPanel.api.export('invalid');

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Widget Protocol v2.0', () => {
    it('should include all required widget fields', () => {
      const widget = LogPanel.widget;

      expect(widget.element).toBe('log-panel-widget');
      expect(widget.displayName).toBe('Log Panel');
      expect(widget.icon).toBe('📋');
      expect(widget.category).toBe('UI/Panels');
    });

    it('should include v2.0 fields', () => {
      const widget = LogPanel.widget;

      expect(widget).toHaveProperty('visible');
      expect(widget).toHaveProperty('priority');
      expect(widget).toHaveProperty('collapsible');
      expect(widget).toHaveProperty('defaultCollapsed');
    });

    it('should respect feature flag for visibility', () => {
      expect(LogPanel.widget.visible).toBe(true);

      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.LogPanel = false;

      const factory = require('../../upgrades/log-panel.js').default;
      const LP = factory(mockModuleLoader, mockEventBus);

      expect(LP.widget.visible).toBe(false);
    });
  });

  describe('Web Component', () => {
    it('should register custom element', () => {
      const elementName = 'log-panel-widget';
      const element = customElements.get(elementName);

      expect(element).toBeDefined();
    });

    it('should implement getStatus() with 5 required fields', () => {
      LogPanel.api.init();

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      document.body.removeChild(widgetEl);
    });

    it('should show error state when errors present', () => {
      LogPanel.api.init();
      LogPanel.api.error('Test error', 'test');

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      const status = widgetEl.getStatus();

      expect(status.state).toBe('error');
      expect(status.message).toContain('error');

      document.body.removeChild(widgetEl);
    });

    it('should clean up interval on disconnect', () => {
      vi.useFakeTimers();

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      document.body.removeChild(widgetEl);

      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
      vi.useRealTimers();
    });

    it('should not render when feature flag disabled', () => {
      global.isModularPanelEnabled = vi.fn(() => false);
      global.config.featureFlags.useModularPanels.LogPanel = false;

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      expect(widgetEl.shadowRoot.innerHTML.trim()).toBe('');

      document.body.removeChild(widgetEl);
    });
  });

  describe('Security (HTML Escaping)', () => {
    it('should escape HTML in log messages', () => {
      LogPanel.api.init();
      LogPanel.api.info('<script>alert("xss")</script>', 'test');

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      const shadowContent = widgetEl.shadowRoot.innerHTML;

      // Should not contain actual script tag
      expect(shadowContent).not.toContain('<script>');
      // Should contain escaped version
      expect(shadowContent).toContain('&lt;script&gt;');

      document.body.removeChild(widgetEl);
    });

    it('should escape HTML in source names', () => {
      LogPanel.api.init();
      LogPanel.api.info('Message', '<img src=x onerror=alert(1)>');

      const widgetEl = document.createElement('log-panel-widget');
      document.body.appendChild(widgetEl);

      const shadowContent = widgetEl.shadowRoot.innerHTML;

      expect(shadowContent).not.toContain('<img');
      expect(shadowContent).toContain('&lt;img');

      document.body.removeChild(widgetEl);
    });
  });
});
