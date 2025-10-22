import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('BrowserAPIs Module', () => {
  let BrowserAPIs;
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

    BrowserAPIs = {
      metadata: {
        id: 'BrowserAPIs',
        version: '1.0.0',
        dependencies: ['Utils', 'EventBus', 'StateManager'],
        async: true,
        type: 'capability'
      },
      factory: (deps) => {
        const { Utils, EventBus, StateManager } = deps;
        const { logger } = Utils;

        let fileSystemHandle = null;
        let notificationPermission = 'default';
        let capabilities = {
          fileSystemAccess: false,
          notifications: false,
          clipboard: false,
          webShare: false,
          storageEstimation: false,
          wakeLock: false
        };

        const init = async () => {
          logger.info('[BrowserAPIs] Initializing web API integration...');

          capabilities.fileSystemAccess = 'showDirectoryPicker' in window;
          capabilities.notifications = 'Notification' in window;
          if (capabilities.notifications) {
            notificationPermission = Notification.permission;
          }
          capabilities.clipboard = 'clipboard' in navigator && 'writeText' in navigator.clipboard;
          capabilities.webShare = 'share' in navigator;
          capabilities.storageEstimation = 'storage' in navigator && 'estimate' in navigator.storage;
          capabilities.wakeLock = 'wakeLock' in navigator;

          logger.info('[BrowserAPIs] Capabilities detected:', capabilities);
          EventBus.emit('browser-apis:initialized', capabilities);
        };

        const getCapabilities = () => {
          return { ...capabilities };
        };

        const requestDirectoryAccess = async (mode = 'readwrite') => {
          if (!capabilities.fileSystemAccess) {
            logger.error('[BrowserAPIs] File System Access API not available');
            return null;
          }

          try {
            logger.info('[BrowserAPIs] Requesting directory access...');
            const handle = await window.showDirectoryPicker({ mode });
            fileSystemHandle = handle;

            logger.info(`[BrowserAPIs] Directory access granted: ${handle.name}`);
            EventBus.emit('browser-apis:filesystem:granted', { name: handle.name, mode });

            return handle;
          } catch (error) {
            if (error.name === 'AbortError') {
              logger.info('[BrowserAPIs] User cancelled directory picker');
            } else {
              logger.error('[BrowserAPIs] Failed to get directory access:', error);
            }
            return null;
          }
        };

        const getDirectoryHandle = () => {
          return fileSystemHandle;
        };

        const writeFile = async (path, content) => {
          if (!fileSystemHandle) {
            logger.error('[BrowserAPIs] No directory handle available. Call requestDirectoryAccess() first.');
            return false;
          }

          try {
            const segments = path.split('/').filter(s => s);
            const fileName = segments.pop();
            let currentHandle = fileSystemHandle;

            for (const segment of segments) {
              currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
            }

            const fileHandle = await currentHandle.getFileHandle(fileName, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(content);
            await writable.close();

            logger.info(`[BrowserAPIs] File written: ${path}`);
            EventBus.emit('browser-apis:filesystem:write', { path, size: content.length });

            return true;
          } catch (error) {
            logger.error(`[BrowserAPIs] Failed to write file ${path}:`, error);
            return false;
          }
        };

        const readFile = async (path) => {
          if (!fileSystemHandle) {
            logger.error('[BrowserAPIs] No directory handle available.');
            return null;
          }

          try {
            const segments = path.split('/').filter(s => s);
            const fileName = segments.pop();
            let currentHandle = fileSystemHandle;

            for (const segment of segments) {
              currentHandle = await currentHandle.getDirectoryHandle(segment);
            }

            const fileHandle = await currentHandle.getFileHandle(fileName);
            const file = await fileHandle.getFile();
            const content = await file.text();

            logger.info(`[BrowserAPIs] File read: ${path} (${content.length} bytes)`);
            return content;
          } catch (error) {
            logger.error(`[BrowserAPIs] Failed to read file ${path}:`, error);
            return null;
          }
        };

        const syncArtifactToFilesystem = async (artifactPath) => {
          if (!fileSystemHandle) {
            logger.error('[BrowserAPIs] No directory handle available.');
            return false;
          }

          try {
            const content = await StateManager.getArtifactContent(artifactPath);
            if (!content) {
              logger.error(`[BrowserAPIs] Artifact not found: ${artifactPath}`);
              return false;
            }

            const relativePath = artifactPath.startsWith('/') ? artifactPath.slice(1) : artifactPath;
            return await writeFile(relativePath, content);
          } catch (error) {
            logger.error(`[BrowserAPIs] Failed to sync artifact ${artifactPath}:`, error);
            return false;
          }
        };

        const requestNotificationPermission = async () => {
          if (!capabilities.notifications) {
            logger.error('[BrowserAPIs] Notifications API not available');
            return 'denied';
          }

          try {
            notificationPermission = await Notification.requestPermission();
            logger.info(`[BrowserAPIs] Notification permission: ${notificationPermission}`);
            EventBus.emit('browser-apis:notifications:permission', notificationPermission);
            return notificationPermission;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to request notification permission:', error);
            return 'denied';
          }
        };

        const showNotification = async (title, options = {}) => {
          if (!capabilities.notifications) {
            logger.error('[BrowserAPIs] Notifications API not available');
            return false;
          }

          if (notificationPermission !== 'granted') {
            logger.warn('[BrowserAPIs] Notification permission not granted');
            return false;
          }

          try {
            const notification = new Notification(title, {
              icon: '/favicon.ico',
              badge: '/favicon.ico',
              ...options
            });

            logger.info(`[BrowserAPIs] Notification shown: ${title}`);
            EventBus.emit('browser-apis:notifications:shown', { title, options });

            return true;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to show notification:', error);
            return false;
          }
        };

        const writeToClipboard = async (text) => {
          if (!capabilities.clipboard) {
            logger.error('[BrowserAPIs] Clipboard API not available');
            return false;
          }

          try {
            await navigator.clipboard.writeText(text);
            logger.info(`[BrowserAPIs] Copied to clipboard: ${text.length} characters`);
            EventBus.emit('browser-apis:clipboard:write', { length: text.length });
            return true;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to write to clipboard:', error);
            return false;
          }
        };

        const readFromClipboard = async () => {
          if (!capabilities.clipboard) {
            logger.error('[BrowserAPIs] Clipboard API not available');
            return null;
          }

          try {
            const text = await navigator.clipboard.readText();
            logger.info(`[BrowserAPIs] Read from clipboard: ${text.length} characters`);
            return text;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to read from clipboard:', error);
            return null;
          }
        };

        const share = async (data) => {
          if (!capabilities.webShare) {
            logger.error('[BrowserAPIs] Web Share API not available');
            return false;
          }

          try {
            await navigator.share(data);
            logger.info('[BrowserAPIs] Content shared:', data);
            EventBus.emit('browser-apis:share:success', data);
            return true;
          } catch (error) {
            if (error.name === 'AbortError') {
              logger.info('[BrowserAPIs] User cancelled share');
            } else {
              logger.error('[BrowserAPIs] Failed to share:', error);
            }
            return false;
          }
        };

        const getStorageEstimate = async () => {
          if (!capabilities.storageEstimation) {
            logger.error('[BrowserAPIs] Storage Estimation API not available');
            return null;
          }

          try {
            const estimate = await navigator.storage.estimate();
            const usagePercent = (estimate.usage / estimate.quota) * 100;

            const result = {
              usage: estimate.usage,
              quota: estimate.quota,
              usagePercent,
              usageMB: (estimate.usage / 1024 / 1024).toFixed(2),
              quotaMB: (estimate.quota / 1024 / 1024).toFixed(2),
              available: estimate.quota - estimate.usage,
              availableMB: ((estimate.quota - estimate.usage) / 1024 / 1024).toFixed(2)
            };

            logger.info(`[BrowserAPIs] Storage: ${result.usageMB}MB / ${result.quotaMB}MB (${usagePercent.toFixed(1)}%)`);
            EventBus.emit('browser-apis:storage:estimate', result);

            return result;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to get storage estimate:', error);
            return null;
          }
        };

        const requestPersistentStorage = async () => {
          if (!capabilities.storageEstimation || !navigator.storage.persist) {
            logger.error('[BrowserAPIs] Persistent storage not available');
            return false;
          }

          try {
            const isPersisted = await navigator.storage.persist();
            logger.info(`[BrowserAPIs] Persistent storage: ${isPersisted}`);
            EventBus.emit('browser-apis:storage:persist', isPersisted);
            return isPersisted;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to request persistent storage:', error);
            return false;
          }
        };

        let wakeLock = null;

        const requestWakeLock = async () => {
          if (!capabilities.wakeLock) {
            logger.error('[BrowserAPIs] Wake Lock API not available');
            return false;
          }

          try {
            wakeLock = await navigator.wakeLock.request('screen');
            logger.info('[BrowserAPIs] Wake lock acquired');
            EventBus.emit('browser-apis:wakelock:acquired');

            wakeLock.addEventListener('release', () => {
              logger.info('[BrowserAPIs] Wake lock released');
              EventBus.emit('browser-apis:wakelock:released');
            });

            return true;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to acquire wake lock:', error);
            return false;
          }
        };

        const releaseWakeLock = async () => {
          if (!wakeLock) {
            return false;
          }

          try {
            await wakeLock.release();
            wakeLock = null;
            return true;
          } catch (error) {
            logger.error('[BrowserAPIs] Failed to release wake lock:', error);
            return false;
          }
        };

        const generateReport = () => {
          let md = '# Browser API Capabilities Report\n\n';
          md += `**Generated:** ${new Date().toISOString()}\n\n`;

          md += '## Available APIs\n\n';
          for (const [api, available] of Object.entries(capabilities)) {
            const icon = available ? '✅' : '❌';
            md += `- ${icon} **${api}**: ${available ? 'Available' : 'Not Available'}\n`;
          }
          md += '\n';

          if (capabilities.fileSystemAccess) {
            md += '## File System Access\n\n';
            md += `- **Directory Handle:** ${fileSystemHandle ? `✅ ${fileSystemHandle.name}` : '❌ Not granted'}\n`;
            md += '- **Mode:** Read/Write\n\n';
          }

          if (capabilities.notifications) {
            md += '## Notifications\n\n';
            md += `- **Permission:** ${notificationPermission}\n\n`;
          }

          md += '---\n\n*Generated by REPLOID Browser APIs Module*\n';
          return md;
        };

        return {
          init,
          getCapabilities,
          requestDirectoryAccess,
          getDirectoryHandle,
          writeFile,
          readFile,
          syncArtifactToFilesystem,
          requestNotificationPermission,
          showNotification,
          writeToClipboard,
          readFromClipboard,
          share,
          getStorageEstimate,
          requestPersistentStorage,
          requestWakeLock,
          releaseWakeLock,
          generateReport
        };
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
