// @blueprint 0x00003D - Integrates browser-native APIs for capabilities.
// Browser-Native Web API Integration for REPLOID
// Validates thesis that browser environment is superior to CLI for RSI

const BrowserAPIs = {
  metadata: {
    id: 'BrowserAPIs',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'Storage'],
    async: true,
    type: 'capability'
  },

  factory: (deps) => {
    const { Utils, EventBus, Storage } = deps;
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
        const content = await Storage.getArtifactContent(artifactPath);
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
        const icon = available ? '✓' : '✗';
        md += `- ${icon} **${api}**: ${available ? 'Available' : 'Not Available'}\n`;
      }
      md += '\n';

      if (capabilities.fileSystemAccess) {
        md += '## File System Access\n\n';
        md += `- **Directory Handle:** ${fileSystemHandle ? `✓ ${fileSystemHandle.name}` : '✗ Not granted'}\n`;
        md += '- **Mode:** Read/Write\n\n';
      }

      if (capabilities.notifications) {
        md += '## Notifications\n\n';
        md += `- **Permission:** ${notificationPermission}\n\n`;
      }

      md += '---\n\n*Generated by REPLOID Browser APIs Module*\n';
      return md;
    };

    // Operation tracking for widget
    const operationStats = {
      fileWrites: 0,
      fileReads: 0,
      notificationsShown: 0,
      clipboardWrites: 0,
      shares: 0,
      lastOperation: null
    };

    // Wrap writeFile to track stats
    const wrappedWriteFile = async (path, content) => {
      const result = await writeFile(path, content);
      if (result) {
        operationStats.fileWrites++;
        operationStats.lastOperation = { type: 'file-write', timestamp: Date.now(), path };
      }
      return result;
    };

    // Wrap readFile to track stats
    const wrappedReadFile = async (path) => {
      const result = await readFile(path);
      if (result) {
        operationStats.fileReads++;
        operationStats.lastOperation = { type: 'file-read', timestamp: Date.now(), path };
      }
      return result;
    };

    // Wrap showNotification to track stats
    const wrappedShowNotification = async (title, options) => {
      const result = await showNotification(title, options);
      if (result) {
        operationStats.notificationsShown++;
        operationStats.lastOperation = { type: 'notification', timestamp: Date.now(), title };
      }
      return result;
    };

    // Wrap writeToClipboard to track stats
    const wrappedWriteToClipboard = async (text) => {
      const result = await writeToClipboard(text);
      if (result) {
        operationStats.clipboardWrites++;
        operationStats.lastOperation = { type: 'clipboard', timestamp: Date.now(), length: text.length };
      }
      return result;
    };

    // Wrap share to track stats
    const wrappedShare = async (data) => {
      const result = await share(data);
      if (result) {
        operationStats.shares++;
        operationStats.lastOperation = { type: 'share', timestamp: Date.now() };
      }
      return result;
    };

    // Expose state for widget
    const getState = () => ({
      capabilities,
      fileSystemHandle,
      notificationPermission,
      operationStats
    });

    return {
      init,
      api: {
        getCapabilities,
        getState,
        // File System Access
        requestDirectoryAccess,
        getDirectoryHandle,
        writeFile: wrappedWriteFile,
        readFile: wrappedReadFile,
        syncArtifactToFilesystem,
        // Notifications
        requestNotificationPermission,
        showNotification: wrappedShowNotification,
        // Clipboard
        writeToClipboard: wrappedWriteToClipboard,
        readFromClipboard,
        // Web Share
        share: wrappedShare,
        // Storage
        getStorageEstimate,
        requestPersistentStorage,
        // Wake Lock
        requestWakeLock,
        releaseWakeLock,
        // Reporting
        generateReport
      },

      widget: {
        element: 'browser-apis-widget',
        displayName: 'Browser APIs',
        icon: '♁',
        category: 'core',
        updateInterval: null
      }
    };
  }
};

// Web Component for Browser APIs Widget
class BrowserAPIsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    if (!this._api) return { state: 'idle', primaryMetric: 'Loading...', secondaryMetric: '' };

    const state = this._api.getState();
    const availableCount = Object.values(state.capabilities).filter(Boolean).length;
    const totalCount = Object.keys(state.capabilities).length;
    const hasRecentOp = state.operationStats.lastOperation &&
      (Date.now() - state.operationStats.lastOperation.timestamp < 60000);

    return {
      state: availableCount > 0 ? (hasRecentOp ? 'active' : 'idle') : 'disabled',
      primaryMetric: `${availableCount}/${totalCount} APIs`,
      secondaryMetric: state.fileSystemHandle ? `⛁ ${state.fileSystemHandle.name}` : 'No FS access',
      lastActivity: state.operationStats.lastOperation ? state.operationStats.lastOperation.timestamp : null,
      message: hasRecentOp ? `Last: ${state.operationStats.lastOperation.type}` : null
    };
  }

  render() {
    if (!this._api) {
      this.shadowRoot.innerHTML = '<div>Loading...</div>';
      return;
    }

    const state = this._api.getState();
    const { capabilities, fileSystemHandle, notificationPermission, operationStats } = state;

    const totalOps = operationStats.fileWrites + operationStats.fileReads +
                    operationStats.notificationsShown + operationStats.clipboardWrites +
                    operationStats.shares;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          color: #fff;
          font-family: monospace;
          font-size: 12px;
        }

        h4 {
          margin: 0 0 16px 0;
          font-size: 1.2em;
          color: #0ff;
        }

        h5 {
          margin: 16px 0 8px 0;
          font-size: 1em;
          color: #0ff;
          font-weight: bold;
        }

        .api-item {
          padding: 2px 0;
        }

        .api-item.available {
          color: #0f0;
        }

        .api-item.unavailable {
          color: #666;
        }

        .stats-box {
          margin-bottom: 12px;
          padding: 8px;
          background: rgba(0,255,255,0.05);
          border: 1px solid rgba(0,255,255,0.2);
          border-radius: 4px;
        }

        .fs-box {
          margin-bottom: 12px;
          padding: 8px;
          border-radius: 4px;
        }

        .fs-box.granted {
          background: rgba(0,255,0,0.05);
          border: 1px solid rgba(0,255,0,0.2);
        }

        .fs-box.pending {
          background: rgba(255,255,0,0.05);
          border: 1px solid rgba(255,255,0,0.2);
        }

        .notification-box {
          margin-bottom: 12px;
          padding: 8px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
        }

        .last-op-box {
          margin-top: 12px;
          padding: 8px;
          background: rgba(0,0,0,0.3);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 4px;
        }

        .stat-label {
          color: #aaa;
        }

        .stat-value {
          color: #0ff;
        }

        button {
          background: rgba(100,150,255,0.3);
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 6px 12px;
          font-size: 0.9em;
          margin: 4px 4px 4px 0;
        }

        button:hover {
          background: rgba(100,150,255,0.5);
        }
      </style>

      <div class="browser-apis-panel">
        <h4>♁ Browser APIs</h4>

        <div>
          <h5>API Availability</h5>
          ${Object.entries(capabilities).map(([api, available]) => {
            const icon = available ? '✓' : '✗';
            const className = available ? 'available' : 'unavailable';
            return `<div class="api-item ${className}">${icon} ${api.replace(/([A-Z])/g, ' $1').trim()}</div>`;
          }).join('')}
        </div>

        ${totalOps > 0 ? `
          <div class="stats-box">
            <h5 style="margin-top: 0;">Operation Stats</h5>
            ${operationStats.fileWrites > 0 ? `<div class="stat-label">File Writes: <span class="stat-value">${operationStats.fileWrites}</span></div>` : ''}
            ${operationStats.fileReads > 0 ? `<div class="stat-label">File Reads: <span class="stat-value">${operationStats.fileReads}</span></div>` : ''}
            ${operationStats.notificationsShown > 0 ? `<div class="stat-label">Notifications: <span class="stat-value">${operationStats.notificationsShown}</span></div>` : ''}
            ${operationStats.clipboardWrites > 0 ? `<div class="stat-label">Clipboard Writes: <span class="stat-value">${operationStats.clipboardWrites}</span></div>` : ''}
            ${operationStats.shares > 0 ? `<div class="stat-label">Shares: <span class="stat-value">${operationStats.shares}</span></div>` : ''}
          </div>
        ` : ''}

        ${fileSystemHandle ? `
          <div class="fs-box granted">
            <h5 style="margin-top: 0; color: #0f0;">File System Access</h5>
            <div style="color: #aaa;">Directory: <span style="color: #fff;">${fileSystemHandle.name}</span></div>
            <div style="color: #888; font-size: 10px;">✓ Read/Write access granted</div>
          </div>
        ` : capabilities.fileSystemAccess ? `
          <div class="fs-box pending">
            <h5 style="margin-top: 0; color: #ff0;">File System Access</h5>
            <div style="color: #888; font-size: 11px;">Available but not granted. Use "Request Directory Access" button.</div>
          </div>
        ` : ''}

        ${capabilities.notifications ? `
          <div class="notification-box">
            <div style="color: #888; font-weight: bold; margin-bottom: 4px; font-size: 10px;">Notifications</div>
            <div style="color: ${notificationPermission === 'granted' ? '#0f0' : notificationPermission === 'denied' ? '#f00' : '#ff0'}; font-size: 11px;">
              Permission: ${notificationPermission}
            </div>
          </div>
        ` : ''}

        ${operationStats.lastOperation ? `
          <div class="last-op-box">
            <div style="color: #888; font-weight: bold; margin-bottom: 4px; font-size: 10px;">Last Operation</div>
            <div style="color: #aaa; font-size: 11px;">
              ${operationStats.lastOperation.type} - ${new Date(operationStats.lastOperation.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ` : ''}

        <div style="margin-top: 16px;">
          ${capabilities.fileSystemAccess ? '<button id="request-fs">⛁ Request Directory Access</button>' : ''}
          ${capabilities.storageEstimation ? '<button id="check-storage">⛃ Check Storage</button>' : ''}
          ${capabilities.notifications ? '<button id="request-notif">⚏ Request Notifications</button>' : ''}
          <button id="generate-report">☱ Generate Report</button>
        </div>
      </div>
    `;

    // Attach event listeners
    const requestFsBtn = this.shadowRoot.getElementById('request-fs');
    if (requestFsBtn) {
      requestFsBtn.addEventListener('click', async () => {
        const handle = await this._api.requestDirectoryAccess();
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        if (handle) {
          ToastNotifications?.show?.(`Access granted: ${handle.name}`, 'success');
        } else {
          ToastNotifications?.show?.('Access denied or cancelled', 'warning');
        }
        this.render();
      });
    }

    const checkStorageBtn = this.shadowRoot.getElementById('check-storage');
    if (checkStorageBtn) {
      checkStorageBtn.addEventListener('click', async () => {
        const estimate = await this._api.getStorageEstimate();
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        if (estimate) {
          ToastNotifications?.show?.(`${estimate.usageMB}MB / ${estimate.quotaMB}MB (${estimate.usagePercent.toFixed(1)}%)`, 'info');
        } else {
          ToastNotifications?.show?.('Failed to get storage estimate', 'error');
        }
      });
    }

    const requestNotifBtn = this.shadowRoot.getElementById('request-notif');
    if (requestNotifBtn) {
      requestNotifBtn.addEventListener('click', async () => {
        const permission = await this._api.requestNotificationPermission();
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        ToastNotifications?.show?.(`Permission: ${permission}`, permission === 'granted' ? 'success' : 'warning');
        this.render();
      });
    }

    const reportBtn = this.shadowRoot.getElementById('generate-report');
    if (reportBtn) {
      reportBtn.addEventListener('click', () => {
        const report = this._api.generateReport();
        console.log(report);
        const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
        ToastNotifications?.show?.('Report generated (check console)', 'success');
      });
    }
  }
}

// Define the custom element
if (!customElements.get('browser-apis-widget')) {
  customElements.define('browser-apis-widget', BrowserAPIsWidget);
}

// Export
export default BrowserAPIs;
