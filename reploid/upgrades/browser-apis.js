// Browser-Native Web API Integration for REPLOID
// Validates thesis that browser environment is superior to CLI for RSI

const BrowserAPIs = {
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

    // Track granted permissions and handles
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

    /**
     * Initialize - detect available APIs
     */
    const init = async () => {
      logger.info('[BrowserAPIs] Initializing web API integration...');

      // Detect File System Access API
      capabilities.fileSystemAccess = 'showDirectoryPicker' in window;

      // Detect Notification API
      capabilities.notifications = 'Notification' in window;
      if (capabilities.notifications) {
        notificationPermission = Notification.permission;
      }

      // Detect Clipboard API
      capabilities.clipboard = 'clipboard' in navigator && 'writeText' in navigator.clipboard;

      // Detect Web Share API
      capabilities.webShare = 'share' in navigator;

      // Detect Storage Estimation API
      capabilities.storageEstimation = 'storage' in navigator && 'estimate' in navigator.storage;

      // Detect Wake Lock API
      capabilities.wakeLock = 'wakeLock' in navigator;

      logger.info('[BrowserAPIs] Capabilities detected:', capabilities);
      EventBus.emit('browser-apis:initialized', capabilities);
    };

    /**
     * Get all detected capabilities
     * @returns {Object} Capability flags
     */
    const getCapabilities = () => {
      return { ...capabilities };
    };

    // ===== FILE SYSTEM ACCESS API =====

    /**
     * Request directory access from user
     * @param {string} mode - 'read' or 'readwrite'
     * @returns {Promise<FileSystemDirectoryHandle|null>}
     */
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

    /**
     * Get current directory handle
     * @returns {FileSystemDirectoryHandle|null}
     */
    const getDirectoryHandle = () => {
      return fileSystemHandle;
    };

    /**
     * Write file to filesystem
     * @param {string} path - Relative path from directory root
     * @param {string} content - File content
     * @returns {Promise<boolean>} Success status
     */
    const writeFile = async (path, content) => {
      if (!fileSystemHandle) {
        logger.error('[BrowserAPIs] No directory handle available. Call requestDirectoryAccess() first.');
        return false;
      }

      try {
        // Navigate path segments
        const segments = path.split('/').filter(s => s);
        const fileName = segments.pop();
        let currentHandle = fileSystemHandle;

        // Create/navigate directories
        for (const segment of segments) {
          currentHandle = await currentHandle.getDirectoryHandle(segment, { create: true });
        }

        // Create/get file
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

    /**
     * Read file from filesystem
     * @param {string} path - Relative path from directory root
     * @returns {Promise<string|null>} File content or null
     */
    const readFile = async (path) => {
      if (!fileSystemHandle) {
        logger.error('[BrowserAPIs] No directory handle available.');
        return null;
      }

      try {
        const segments = path.split('/').filter(s => s);
        const fileName = segments.pop();
        let currentHandle = fileSystemHandle;

        // Navigate directories
        for (const segment of segments) {
          currentHandle = await currentHandle.getDirectoryHandle(segment);
        }

        // Read file
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

    /**
     * Sync VFS artifact to real filesystem
     * @param {string} artifactPath - VFS path
     * @returns {Promise<boolean>} Success status
     */
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

        // Remove leading slash for relative path
        const relativePath = artifactPath.startsWith('/') ? artifactPath.slice(1) : artifactPath;
        return await writeFile(relativePath, content);
      } catch (error) {
        logger.error(`[BrowserAPIs] Failed to sync artifact ${artifactPath}:`, error);
        return false;
      }
    };

    // ===== NOTIFICATIONS API =====

    /**
     * Request notification permission
     * @returns {Promise<string>} Permission state: 'granted', 'denied', or 'default'
     */
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

    /**
     * Show notification to user
     * @param {string} title - Notification title
     * @param {Object} options - Notification options
     * @returns {Promise<boolean>} Success status
     */
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

    // ===== CLIPBOARD API =====

    /**
     * Write text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<boolean>} Success status
     */
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

    /**
     * Read text from clipboard
     * @returns {Promise<string|null>} Clipboard text or null
     */
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

    // ===== WEB SHARE API =====

    /**
     * Share content using Web Share API
     * @param {Object} data - Share data (title, text, url)
     * @returns {Promise<boolean>} Success status
     */
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

    // ===== STORAGE ESTIMATION API =====

    /**
     * Get storage quota and usage
     * @returns {Promise<Object|null>} Storage estimate or null
     */
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

    /**
     * Request persistent storage
     * @returns {Promise<boolean>} Whether persistent storage is granted
     */
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

    // ===== WAKE LOCK API =====

    let wakeLock = null;

    /**
     * Request wake lock to keep screen awake during long operations
     * @returns {Promise<boolean>} Success status
     */
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

    /**
     * Release wake lock
     * @returns {Promise<boolean>} Success status
     */
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

    /**
     * Generate capability report
     * @returns {string} Markdown report
     */
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
      // File System Access
      requestDirectoryAccess,
      getDirectoryHandle,
      writeFile,
      readFile,
      syncArtifactToFilesystem,
      // Notifications
      requestNotificationPermission,
      showNotification,
      // Clipboard
      writeToClipboard,
      readFromClipboard,
      // Web Share
      share,
      // Storage
      getStorageEstimate,
      requestPersistentStorage,
      // Wake Lock
      requestWakeLock,
      releaseWakeLock,
      // Reporting
      generateReport
    };
  }
};

// Export
BrowserAPIs;
