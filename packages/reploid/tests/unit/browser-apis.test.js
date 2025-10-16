import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import BrowserAPIs from '../../upgrades/browser-apis.js';

describe('BrowserAPIs Module', () => {
  let mockDeps;
  let apisInstance;
  let mockEventBus;

  beforeEach(() => {
    mockEventBus = {
      emit: vi.fn()
    };

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      },
      EventBus: mockEventBus,
      StateManager: {
        getArtifactContent: vi.fn()
      }
    };

    // Mock browser APIs
    global.window = {
      showDirectoryPicker: vi.fn()
    };

    global.Notification = vi.fn();
    Notification.permission = 'default';
    Notification.requestPermission = vi.fn();

    global.navigator = {
      clipboard: {
        writeText: vi.fn(),
        readText: vi.fn()
      },
      share: vi.fn(),
      storage: {
        estimate: vi.fn(),
        persist: vi.fn()
      },
      wakeLock: {
        request: vi.fn()
      }
    };

    apisInstance = BrowserAPIs.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
    delete global.Notification;
    delete global.navigator;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(BrowserAPIs.metadata.id).toBe('BrowserAPIs');
      expect(BrowserAPIs.metadata.version).toBe('1.0.0');
      expect(BrowserAPIs.metadata.type).toBe('capability');
    });

    it('should declare required dependencies', () => {
      expect(BrowserAPIs.metadata.dependencies).toContain('Utils');
      expect(BrowserAPIs.metadata.dependencies).toContain('EventBus');
      expect(BrowserAPIs.metadata.dependencies).toContain('StateManager');
    });

    it('should be async type', () => {
      expect(BrowserAPIs.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should detect available APIs', async () => {
      await apisInstance.init();

      const capabilities = apisInstance.getCapabilities();
      expect(capabilities.fileSystemAccess).toBe(true);
      expect(capabilities.clipboard).toBe(true);
      expect(capabilities).toHaveProperty('notifications');
    });

    it('should emit initialized event', async () => {
      await apisInstance.init();

      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'browser-apis:initialized',
        expect.any(Object)
      );
    });

    it('should detect missing APIs', async () => {
      delete window.showDirectoryPicker;

      await apisInstance.init();

      const capabilities = apisInstance.getCapabilities();
      expect(capabilities.fileSystemAccess).toBe(false);
    });
  });

  describe('File System Access', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should request directory access', async () => {
      const mockHandle = {
        name: 'test-directory',
        getFileHandle: vi.fn(),
        getDirectoryHandle: vi.fn()
      };
      window.showDirectoryPicker.mockResolvedValue(mockHandle);

      const result = await apisInstance.requestDirectoryAccess();

      expect(result).toBe(mockHandle);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'browser-apis:filesystem:granted',
        expect.objectContaining({ name: 'test-directory' })
      );
    });

    it('should handle user cancellation', async () => {
      const error = new Error('User cancelled');
      error.name = 'AbortError';
      window.showDirectoryPicker.mockRejectedValue(error);

      const result = await apisInstance.requestDirectoryAccess();

      expect(result).toBeNull();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('User cancelled')
      );
    });

    it('should write file', async () => {
      const mockHandle = {
        name: 'test',
        getFileHandle: vi.fn().mockResolvedValue({
          createWritable: vi.fn().mockResolvedValue({
            write: vi.fn(),
            close: vi.fn()
          })
        }),
        getDirectoryHandle: vi.fn()
      };
      window.showDirectoryPicker.mockResolvedValue(mockHandle);

      await apisInstance.requestDirectoryAccess();
      const result = await apisInstance.writeFile('test.txt', 'content');

      expect(result).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'browser-apis:filesystem:write',
        expect.objectContaining({ path: 'test.txt' })
      );
    });

    it('should return false when no directory handle', async () => {
      const result = await apisInstance.writeFile('test.txt', 'content');

      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });

    it('should read file', async () => {
      const mockHandle = {
        name: 'test',
        getFileHandle: vi.fn().mockResolvedValue({
          getFile: vi.fn().mockResolvedValue({
            text: vi.fn().mockResolvedValue('file content')
          })
        }),
        getDirectoryHandle: vi.fn()
      };
      window.showDirectoryPicker.mockResolvedValue(mockHandle);

      await apisInstance.requestDirectoryAccess();
      const content = await apisInstance.readFile('test.txt');

      expect(content).toBe('file content');
    });
  });

  describe('Notifications', () => {
    beforeEach(async () => {
      global.Notification = function(title, options) {
        this.title = title;
        this.options = options;
      };
      Notification.permission = 'default';
      Notification.requestPermission = vi.fn();
      global.window.Notification = Notification;

      apisInstance = BrowserAPIs.factory(mockDeps);
      await apisInstance.init();
    });

    it('should request permission', async () => {
      Notification.requestPermission.mockResolvedValue('granted');

      const result = await apisInstance.requestNotificationPermission();

      expect(result).toBe('granted');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'browser-apis:notifications:permission',
        'granted'
      );
    });

    it('should show notification when granted', async () => {
      Notification.requestPermission.mockResolvedValue('granted');
      await apisInstance.requestNotificationPermission();

      const result = await apisInstance.showNotification('Test', { body: 'Message' });

      expect(result).toBe(true);
    });

    it('should not show notification without permission', async () => {
      const result = await apisInstance.showNotification('Test');

      expect(result).toBe(false);
    });
  });

  describe('Clipboard', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should write to clipboard', async () => {
      navigator.clipboard.writeText.mockResolvedValue();

      const result = await apisInstance.writeToClipboard('test text');

      expect(result).toBe(true);
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test text');
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        'browser-apis:clipboard:write',
        expect.objectContaining({ length: 9 })
      );
    });

    it('should read from clipboard', async () => {
      navigator.clipboard.readText.mockResolvedValue('clipboard content');

      const result = await apisInstance.readFromClipboard();

      expect(result).toBe('clipboard content');
    });

    it('should handle clipboard errors', async () => {
      navigator.clipboard.writeText.mockRejectedValue(new Error('Permission denied'));

      const result = await apisInstance.writeToClipboard('test');

      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Web Share', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should share content', async () => {
      navigator.share.mockResolvedValue();

      const data = { title: 'Test', text: 'Content', url: 'https://example.com' };
      const result = await apisInstance.share(data);

      expect(result).toBe(true);
      expect(navigator.share).toHaveBeenCalledWith(data);
      expect(mockEventBus.emit).toHaveBeenCalledWith('browser-apis:share:success', data);
    });

    it('should handle share cancellation', async () => {
      const error = new Error('Cancelled');
      error.name = 'AbortError';
      navigator.share.mockRejectedValue(error);

      const result = await apisInstance.share({ title: 'Test' });

      expect(result).toBe(false);
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('User cancelled share')
      );
    });
  });

  describe('Storage Estimation', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should get storage estimate', async () => {
      navigator.storage.estimate.mockResolvedValue({
        usage: 100 * 1024 * 1024,
        quota: 1000 * 1024 * 1024
      });

      const result = await apisInstance.getStorageEstimate();

      expect(result).toHaveProperty('usage');
      expect(result).toHaveProperty('quota');
      expect(result).toHaveProperty('usagePercent');
      expect(result.usageMB).toBe('100.00');
      expect(result.quotaMB).toBe('1000.00');
    });

    it('should request persistent storage', async () => {
      navigator.storage.persist.mockResolvedValue(true);

      const result = await apisInstance.requestPersistentStorage();

      expect(result).toBe(true);
      expect(mockEventBus.emit).toHaveBeenCalledWith('browser-apis:storage:persist', true);
    });
  });

  describe('Wake Lock', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should request wake lock', async () => {
      const mockLock = {
        addEventListener: vi.fn(),
        release: vi.fn()
      };
      navigator.wakeLock.request.mockResolvedValue(mockLock);

      const result = await apisInstance.requestWakeLock();

      expect(result).toBe(true);
      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
      expect(mockEventBus.emit).toHaveBeenCalledWith('browser-apis:wakelock:acquired');
    });

    it('should release wake lock', async () => {
      const mockLock = {
        addEventListener: vi.fn(),
        release: vi.fn().mockResolvedValue()
      };
      navigator.wakeLock.request.mockResolvedValue(mockLock);

      await apisInstance.requestWakeLock();
      const result = await apisInstance.releaseWakeLock();

      expect(result).toBe(true);
      expect(mockLock.release).toHaveBeenCalled();
    });

    it('should return false when no lock to release', async () => {
      const result = await apisInstance.releaseWakeLock();

      expect(result).toBe(false);
    });
  });

  describe('Report Generation', () => {
    beforeEach(async () => {
      await apisInstance.init();
    });

    it('should generate capability report', () => {
      const report = apisInstance.generateReport();

      expect(report).toContain('# Browser API Capabilities Report');
      expect(report).toContain('## Available APIs');
      expect(report).toContain('fileSystemAccess');
      expect(report).toContain('notifications');
    });

    it('should include filesystem status in report', async () => {
      const mockHandle = { name: 'test-dir' };
      window.showDirectoryPicker.mockResolvedValue(mockHandle);

      await apisInstance.requestDirectoryAccess();
      const report = apisInstance.generateReport();

      expect(report).toContain('## File System Access');
      expect(report).toContain('test-dir');
    });

    it('should include notification permission in report', async () => {
      global.Notification = function() {};
      Notification.permission = 'default';
      global.window.Notification = Notification;

      apisInstance = BrowserAPIs.factory(mockDeps);
      await apisInstance.init();

      const report = apisInstance.generateReport();

      expect(report).toContain('Browser API Capabilities Report');
      expect(report).toContain('Available APIs');
    });
  });
});
