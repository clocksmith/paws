// @blueprint 0x000011 - Outlines upgrading to an asynchronous, high-capacity IndexedDB layer.
// Standardized Storage Module for REPLOID - Git-Powered VFS

const Storage = {
  metadata: {
    id: 'Storage',
    version: '2.0.0',
    dependencies: ['config', 'Utils'],
    async: true,
    type: 'service'
  },
  
  factory: (deps) => {
    const { config, Utils } = deps;
    const { logger, Errors } = Utils;
    const { ArtifactError } = Errors;

    // isomorphic-git uses a virtual filesystem. We'll use a promisified version of LightningFS.
    const fs = new LightningFS('reploid-vfs');
    const pfs = fs.promises;
    const gitdir = '/.git';

    // Widget tracking
    let _writeCount = 0;
    let _readCount = 0;
    let _deleteCount = 0;
    let _commitCount = 0;
    let _lastOperationTime = null;

    const init = async () => {
        logger.info("[Storage-Git] Initializing Git-powered VFS in IndexedDB...");
        try {
            await pfs.stat(gitdir);
            logger.info("[Storage-Git] Existing Git repository found.");
        } catch (e) {
            logger.warn("[Storage-Git] No Git repository found, initializing a new one.");
            await git.init({ fs, dir: '/', defaultBranch: 'main' });
        }
    };

    const _commit = async (message) => {
        const sha = await git.commit({
            fs,
            dir: '/',
            author: { name: 'REPLOID Agent', email: 'agent@reploid.dev' },
            message
        });
        _commitCount++;
        _lastOperationTime = Date.now();
        logger.info(`[Storage-Git] Committed changes: ${message} (SHA: ${sha.slice(0, 7)})`);
        return sha;
    };

    /**
     * Create directory and all parent directories recursively
     */
    const mkdirRecursive = async (dirPath) => {
        if (!dirPath || dirPath === '/') return;

        try {
            await pfs.stat(dirPath);
            // Directory exists
            return;
        } catch (e) {
            // Directory doesn't exist, create parent first
            const lastSlash = dirPath.lastIndexOf('/');
            const parentDir = lastSlash > 0 ? dirPath.substring(0, lastSlash) : '/';

            if (parentDir !== '/') {
                await mkdirRecursive(parentDir);
            }

            try {
                await pfs.mkdir(dirPath);
                logger.debug(`[Storage-Git] Created directory: ${dirPath}`);
            } catch (mkdirError) {
                // Ignore if directory was created by another call
                if (mkdirError.code !== 'EEXIST') {
                    logger.error(`[Storage-Git] Failed to create directory ${dirPath}:`, mkdirError);
                    throw mkdirError;
                }
            }
        }
    };

    const setArtifactContent = async (path, content) => {
        try {
            // Ensure parent directories exist
            const dir = path.substring(0, path.lastIndexOf('/'));
            if (dir && dir !== '/') {
                await mkdirRecursive(dir);
            }

            await pfs.writeFile(path, content, 'utf8');

            // git.add requires relative path (no leading slash)
            const relativePath = path.startsWith('/') ? path.substring(1) : path;
            await git.add({ fs, dir: '/', filepath: relativePath });

            _writeCount++;
            _lastOperationTime = Date.now();

            await _commit(`Agent modified ${path}`);
        } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to write artifact: ${e.message}`);
        }
    };

    const getArtifactContent = async (path) => {
        try {
            const content = await pfs.readFile(path, 'utf8');
            _readCount++;
            _lastOperationTime = Date.now();
            return content;
        } catch (e) {
            // Return null if file doesn't exist, which is the expected behavior
            return null;
        }
    };

    const deleteArtifact = async (path) => {
        try {
            // git.remove requires relative path (no leading slash)
            const relativePath = path.startsWith('/') ? path.substring(1) : path;
            await git.remove({ fs, dir: '/', filepath: relativePath });
            _deleteCount++;
            _lastOperationTime = Date.now();
            await _commit(`Agent deleted ${path}`);
        } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to delete artifact: ${e.message}`);
        }
    };

    // State is stored outside of Git for now, as it's not a user-facing artifact.
    const saveState = async (stateJson) => {
        await pfs.writeFile('/.state', stateJson, 'utf8');
    };

    const getState = async () => {
        try {
            const stateJson = await pfs.readFile('/.state', 'utf8');
            return JSON.parse(stateJson);
        } catch (e) {
            return null;
        }
    };

    // New Git-specific functions
    const getArtifactHistory = async (path) => {
        // git.log requires relative path (no leading slash)
        const relativePath = path.startsWith('/') ? path.substring(1) : path;
        return await git.log({ fs, dir: '/', filepath: relativePath });
    };

    const getArtifactDiff = async (path, refA, refB = 'HEAD') => {
        // git.readBlob requires relative path (no leading slash)
        const relativePath = path.startsWith('/') ? path.substring(1) : path;
        const contentA = await git.readBlob({ fs, dir: '/', oid: refA, filepath: relativePath });
        const contentB = await git.readBlob({ fs, dir: '/', oid: refB, filepath: relativePath });
        // This is a simplified diff. A real implementation would use a diff library.
        return {
            contentA: new TextDecoder().decode(contentA.blob),
            contentB: new TextDecoder().decode(contentB.blob)
        };
    };

    const getAllArtifactMetadata = async () => {
        const metadata = {};
        const walkDir = async (dir) => {
            try {
                const entries = await pfs.readdir(dir);
                for (const entry of entries) {
                    const fullPath = dir === '/' ? `/${entry}` : `${dir}/${entry}`;
                    try {
                        const stat = await pfs.stat(fullPath);
                        if (stat.isDirectory()) {
                            await walkDir(fullPath);
                        } else if (stat.isFile()) {
                            metadata[fullPath] = {
                                path: fullPath,
                                size: stat.size,
                                mtime: stat.mtime
                            };
                        }
                    } catch (e) {
                        // Skip unreadable files
                    }
                }
            } catch (e) {
                // Skip unreadable directories
            }
        };
        await walkDir('/');
        return metadata;
    };

    // Web Component widget - defined inside factory to access closure variables
    class StorageIndexedDBWidget extends HTMLElement {
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
        const totalOps = _writeCount + _readCount + _deleteCount;

        return {
          state: totalOps > 0 ? 'active' : 'idle',
          primaryMetric: `${_commitCount} commits`,
          secondaryMetric: `${totalOps} operations`,
          lastActivity: _lastOperationTime,
          message: 'Git-powered VFS'
        };
      }

      getControls() {
        return [
          {
            id: 'show-stats',
            label: '☱ Show Stats',
            action: () => {
              console.log('[Storage] Stats:', {
                writes: _writeCount,
                reads: _readCount,
                deletes: _deleteCount,
                commits: _commitCount,
                totalOperations: _writeCount + _readCount + _deleteCount
              });
              logger.info('[Storage] Widget: Stats logged to console');
            }
          }
        ];
      }

      render() {
        const totalOps = _writeCount + _readCount + _deleteCount;

        const formatTime = (timestamp) => {
          if (!timestamp) return 'Never';
          const diff = Date.now() - timestamp;
          if (diff < 60000) return `${Math.floor(diff/1000)}s ago`;
          if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
          return `${Math.floor(diff/3600000)}h ago`;
        };

        // Calculate percentages
        const writePercent = totalOps > 0 ? (_writeCount / totalOps * 100) : 0;
        const readPercent = totalOps > 0 ? (_readCount / totalOps * 100) : 0;
        const deletePercent = totalOps > 0 ? (_deleteCount / totalOps * 100) : 0;

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

            h4 {
              margin: 16px 0 0 0;
              font-size: 1em;
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
              background: rgba(100,150,255,0.1);
              border-radius: 4px;
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

            .op-breakdown {
              margin-top: 8px;
            }

            .op-item {
              padding: 8px;
              background: rgba(255,255,255,0.05);
              border-radius: 4px;
              margin-bottom: 6px;
            }

            .op-header {
              display: flex;
              justify-content: space-between;
              align-items: center;
            }

            .op-label {
              font-size: 1em;
            }

            .op-label.writes {
              color: #6496ff;
            }

            .op-label.reads {
              color: #0c0;
            }

            .op-label.deletes {
              color: #ff6b6b;
            }

            .op-count {
              font-size: 1.2em;
              font-weight: bold;
            }

            .op-bar {
              margin-top: 4px;
              height: 4px;
              background: rgba(255,255,255,0.1);
              border-radius: 2px;
              overflow: hidden;
            }

            .op-bar-fill {
              height: 100%;
              transition: width 0.3s ease;
            }

            .op-bar-fill.writes {
              background: #6496ff;
            }

            .op-bar-fill.reads {
              background: #0c0;
            }

            .op-bar-fill.deletes {
              background: #ff6b6b;
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
            <h3>⛃ Git-Powered Storage</h3>

            <div class="stats-grid">
              <div class="stat-box">
                <div class="stat-label">Commits</div>
                <div class="stat-value">${_commitCount}</div>
              </div>
              <div class="stat-box">
                <div class="stat-label">Total Ops</div>
                <div class="stat-value">${totalOps}</div>
              </div>
            </div>

            <h4>☱ Operation Breakdown</h4>
            <div class="op-breakdown">
              <div class="op-item">
                <div class="op-header">
                  <span class="op-label writes">✎ Writes</span>
                  <span class="op-count">${_writeCount}</span>
                </div>
                ${totalOps > 0 ? `
                  <div class="op-bar">
                    <div class="op-bar-fill writes" style="width: ${writePercent}%;"></div>
                  </div>
                ` : ''}
              </div>
              <div class="op-item">
                <div class="op-header">
                  <span class="op-label reads">◩ Reads</span>
                  <span class="op-count">${_readCount}</span>
                </div>
                ${totalOps > 0 ? `
                  <div class="op-bar">
                    <div class="op-bar-fill reads" style="width: ${readPercent}%;"></div>
                  </div>
                ` : ''}
              </div>
              <div class="op-item">
                <div class="op-header">
                  <span class="op-label deletes">⛶️ Deletes</span>
                  <span class="op-count">${_deleteCount}</span>
                </div>
                ${totalOps > 0 ? `
                  <div class="op-bar">
                    <div class="op-bar-fill deletes" style="width: ${deletePercent}%;"></div>
                  </div>
                ` : ''}
              </div>
            </div>

            <div class="info-box">
              <strong>ℹ️ Git VFS Storage</strong>
              <div>
                IndexedDB-backed virtual filesystem with Git version control.<br>
                Last operation: ${formatTime(_lastOperationTime)}
              </div>
            </div>
          </div>
        `;
      }
    }

    // Define custom element
    const elementName = 'storage-indexeddb-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, StorageIndexedDBWidget);
    }

    // Widget interface
    const widget = {
      element: elementName,
      displayName: 'Storage (Git VFS)',
      icon: '⛃',
      category: 'service',
      updateInterval: 5000
    };

    return {
      init,
      api: {
        setArtifactContent,
        getArtifactContent,
        getAllArtifactMetadata,
        deleteArtifact,
        saveState,
        getState,
        // New Git API
        getArtifactHistory,
        getArtifactDiff
      },
      widget
    };
  }
};

export default Storage;