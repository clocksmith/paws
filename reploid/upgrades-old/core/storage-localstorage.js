// @blueprint 0x000004 - Describes the baseline localStorage wrapper for VFS persistence.
// Lightweight Storage Module using browser localStorage
// Provides a minimal persistence layer for rapid boot configurations

const Storage = {
  metadata: {
    id: 'LocalStorage',
    version: '1.0.0',
    dependencies: ['Utils'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils } = deps;
    const { logger } = Utils;

    const STORAGE_PREFIX = 'reploid:vfs';
    const STATE_KEY = `${STORAGE_PREFIX}:state`;
    const HISTORY_STUB = [];

    // Widget tracking state
    const _ioStats = {
      reads: 0,
      writes: 0,
      deletes: 0
    };
    const _recentOperations = [];
    const _artifactPaths = new Set();
    let _lastActivity = null;

    const memoryStorage = () => {
      const data = new Map();
      return {
        getItem: (key) => (data.has(key) ? data.get(key) : null),
        setItem: (key, value) => data.set(key, value),
        removeItem: (key) => data.delete(key)
      };
    };

    const storage =
      typeof window !== 'undefined' && window.localStorage
        ? window.localStorage
        : memoryStorage();

    const encodeKey = (path) => `${STORAGE_PREFIX}:artifact:${path}`;

    const setArtifactContent = async (path, content) => {
      try {
        storage.setItem(encodeKey(path), content);
        _ioStats.writes++;
        _lastActivity = Date.now();
        _artifactPaths.add(path);
        _recentOperations.push({ type: 'write', path, timestamp: Date.now() });
        if (_recentOperations.length > 50) _recentOperations.shift();
        logger.info(`[Storage-LS] Stored artifact: ${path}`);
      } catch (error) {
        logger.error(`[Storage-LS] Failed to store ${path}:`, error);
        throw error;
      }
    };

    const getArtifactContent = async (path) => {
      try {
        const value = storage.getItem(encodeKey(path));
        _ioStats.reads++;
        _lastActivity = Date.now();
        _recentOperations.push({ type: 'read', path, timestamp: Date.now() });
        if (_recentOperations.length > 50) _recentOperations.shift();
        return value === null ? null : value;
      } catch (error) {
        logger.error(`[Storage-LS] Failed to read ${path}:`, error);
        return null;
      }
    };

    const deleteArtifact = async (path) => {
      try {
        storage.removeItem(encodeKey(path));
        _ioStats.deletes++;
        _lastActivity = Date.now();
        _artifactPaths.delete(path);
        _recentOperations.push({ type: 'delete', path, timestamp: Date.now() });
        if (_recentOperations.length > 50) _recentOperations.shift();
        logger.warn(`[Storage-LS] Deleted artifact: ${path}`);
      } catch (error) {
        logger.error(`[Storage-LS] Failed to delete ${path}:`, error);
        throw error;
      }
    };

    const saveState = async (stateJson) => {
      try {
        storage.setItem(STATE_KEY, stateJson);
      } catch (error) {
        logger.error('[Storage-LS] Failed to persist state:', error);
        throw error;
      }
    };

    const getState = async () => {
      try {
        return storage.getItem(STATE_KEY);
      } catch (error) {
        logger.error('[Storage-LS] Failed to load state:', error);
        return null;
      }
    };

    const getArtifactHistory = async () => HISTORY_STUB;

    const getArtifactDiff = async () => ({
      contentA: null,
      contentB: null
    });

    // Calculate storage usage
    const calculateStorageUsage = () => {
      try {
        let totalBytes = 0;
        let artifactBytes = 0;

        // Estimate based on stored keys
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (key && key.startsWith(STORAGE_PREFIX)) {
            const value = storage.getItem(key);
            const bytes = (key.length + (value?.length || 0)) * 2; // UTF-16 = 2 bytes per char
            totalBytes += bytes;
            if (key.includes(':artifact:')) {
              artifactBytes += bytes;
            }
          }
        }

        return {
          totalMB: (totalBytes / 1024 / 1024).toFixed(2),
          artifactMB: (artifactBytes / 1024 / 1024).toFixed(2),
          totalBytes
        };
      } catch (error) {
        return { totalMB: '0.00', artifactMB: '0.00', totalBytes: 0 };
      }
    };

    // Web Component widget - defined inside factory to access closure variables
    class StorageLocalStorageWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        // Auto-refresh every 5 seconds
        this._updateInterval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const usage = calculateStorageUsage();
        const isActive = _lastActivity && (Date.now() - _lastActivity < 2000);

        return {
          state: isActive ? 'active' : 'idle',
          primaryMetric: `${usage.totalMB} MB`,
          secondaryMetric: `${_artifactPaths.size} artifacts`,
          lastActivity: _lastActivity,
          message: `${_ioStats.reads}R ${_ioStats.writes}W ${_ioStats.deletes}D`
        };
      }

      getControls() {
        return [
          {
            id: 'clear-cache',
            label: '⌦ Clear All',
            action: () => {
              if (confirm('Are you sure you want to clear all storage? This cannot be undone.')) {
                const keysToRemove = [];
                for (let i = 0; i < storage.length; i++) {
                  const key = storage.key(i);
                  if (key && key.startsWith(STORAGE_PREFIX)) {
                    keysToRemove.push(key);
                  }
                }
                keysToRemove.forEach(key => storage.removeItem(key));
                _artifactPaths.clear();
                logger.warn('[Storage] All storage cleared');
                this.render();
              }
            }
          },
          {
            id: 'reset-stats',
            label: '↻ Reset Stats',
            action: () => {
              _ioStats.reads = 0;
              _ioStats.writes = 0;
              _ioStats.deletes = 0;
              _recentOperations.length = 0;
              logger.info('[Storage] Widget statistics reset');
              this.render();
            }
          }
        ];
      }

      render() {
        const usage = calculateStorageUsage();
        const recentOps = _recentOperations.slice(-20).reverse();

        const opIcons = { read: '◁', write: '▷', delete: '⌦' };

        // Build operations HTML
        let operationsHTML = '';
        if (recentOps.length > 0) {
          operationsHTML = recentOps.map(op => {
            const timeAgo = Math.floor((Date.now() - op.timestamp) / 1000);
            return `
              <div class="op-item op-${op.type}">
                <div class="op-content">
                  <div>
                    <span class="op-type">${opIcons[op.type]} ${op.type.toUpperCase()}</span>
                    <span class="op-path">${op.path}</span>
                  </div>
                  <div class="op-time">${timeAgo}s ago</div>
                </div>
              </div>
            `;
          }).join('');
        }

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

            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-top: 12px;
            }

            .stat-box {
              padding: 12px;
              border-radius: 4px;
            }

            .stat-box.storage {
              background: rgba(100,150,255,0.1);
            }

            .stat-box.artifacts {
              background: rgba(0,200,100,0.1);
            }

            .stat-label {
              font-size: 0.85em;
              color: #888;
            }

            .stat-value {
              font-size: 1.3em;
              font-weight: bold;
              margin-top: 4px;
            }

            .io-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8px;
              margin-top: 12px;
            }

            .io-box {
              padding: 8px;
              border-radius: 4px;
              text-align: center;
            }

            .io-box.reads {
              background: rgba(100,150,255,0.1);
            }

            .io-box.writes {
              background: rgba(0,200,100,0.1);
            }

            .io-box.deletes {
              background: rgba(255,0,0,0.1);
            }

            .io-label {
              font-size: 0.85em;
              color: #888;
            }

            .io-value {
              font-size: 1.2em;
              font-weight: bold;
              margin-top: 2px;
            }

            .operations-section {
              margin-top: 20px;
            }

            .op-list {
              margin-top: 12px;
              max-height: 300px;
              overflow-y: auto;
            }

            .op-item {
              padding: 6px;
              border-radius: 4px;
              margin-bottom: 4px;
              font-size: 0.85em;
            }

            .op-item.op-read {
              background: rgba(100,150,255,0.1);
            }

            .op-item.op-write {
              background: rgba(0,200,100,0.1);
            }

            .op-item.op-delete {
              background: rgba(255,0,0,0.1);
            }

            .op-content {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .op-type {
              font-weight: bold;
            }

            .op-path {
              color: #aaa;
              margin-left: 8px;
            }

            .op-time {
              color: #666;
              font-size: 0.9em;
            }

            .empty-ops {
              margin-top: 12px;
              color: #888;
              font-style: italic;
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

            .info-box div {
              margin-top: 6px;
              color: #aaa;
              font-size: 0.9em;
            }
          </style>

          <div class="widget-panel">
            <h3>▼ Storage Usage</h3>
            <div class="stats-grid">
              <div class="stat-box storage">
                <div class="stat-label">Total Storage</div>
                <div class="stat-value">${usage.totalMB} MB</div>
              </div>
              <div class="stat-box artifacts">
                <div class="stat-label">Artifacts</div>
                <div class="stat-value">${_artifactPaths.size}</div>
              </div>
            </div>

            <h3 style="margin-top: 20px;">▤ I/O Statistics</h3>
            <div class="io-grid">
              <div class="io-box reads">
                <div class="io-label">Reads</div>
                <div class="io-value">${_ioStats.reads}</div>
              </div>
              <div class="io-box writes">
                <div class="io-label">Writes</div>
                <div class="io-value">${_ioStats.writes}</div>
              </div>
              <div class="io-box deletes">
                <div class="io-label">Deletes</div>
                <div class="io-value">${_ioStats.deletes}</div>
              </div>
            </div>

            ${recentOps.length > 0 ? `
              <div class="operations-section">
                <h3>⌚ Recent Operations (Last 20)</h3>
                <div class="op-list">
                  ${operationsHTML}
                </div>
              </div>
            ` : '<div class="empty-ops">No operations yet</div>'}

            <div class="info-box">
              <strong>ℹ️ Storage Backend</strong>
              <div>
                Using browser localStorage for artifact persistence.<br>
                Typical quota: ~5-10 MB per origin.
              </div>
            </div>
          </div>
        `;
      }
    }

    // Define custom element (use unique ID to avoid conflicts across factory instances)
    const elementName = 'storage-localstorage-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, StorageLocalStorageWidget);
    }

    // Widget interface
    const widget = {
      element: elementName,
      displayName: 'Storage (LocalStorage)',
      icon: '▼',
      category: 'core',
      updateInterval: 5000
    };

    return {
      api: {
        setArtifactContent,
        getArtifactContent,
        deleteArtifact,
        saveState,
        getState,
        getArtifactHistory,
        getArtifactDiff
      },
      widget
    };
  }
};

export default Storage;
