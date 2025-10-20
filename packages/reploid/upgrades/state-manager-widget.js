// @blueprint 0x00005C - StateManager Visualization Widget
/**
 * StateManager Widget Implementation
 *
 * This is an EXAMPLE of how to add a widget interface to an existing module
 * that currently has NO visual representation.
 *
 * StateManager is currently invisible - you can't see:
 * - How many artifacts are stored
 * - How many checkpoints exist
 * - When the last save occurred
 * - VFS storage size
 *
 * This widget makes StateManager visible in the dashboard.
 */

// This would be added to the existing state-manager.js file
const StateManagerWidgetExtension = {
  /**
   * Add this to the return statement of StateManager.factory()
   *
   * Before (invisible):
   * return {
   *   api: { getArtifact, setArtifact, ... }
   * };
   *
   * After (visible with widget):
   * return {
   *   api: { getArtifact, setArtifact, ... },
   *   widget: { ... } // <-- Add this
   * };
   */

  widget: (() => {
    class StateManagerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Subscribe to VFS events
        this._eventHandlers = {
          vfsUpdated: () => this.render(),
          checkpointCreated: () => this.render(),
          checkpointRestored: () => this.render(),
          artifactCreated: () => this.render(),
          artifactDeleted: () => this.render()
        };

        const EventBus = window.DIContainer?.resolve('EventBus');
        if (EventBus) {
          EventBus.on?.('vfs:updated', this._eventHandlers.vfsUpdated);
          EventBus.on?.('checkpoint:created', this._eventHandlers.checkpointCreated);
          EventBus.on?.('checkpoint:restored', this._eventHandlers.checkpointRestored);
          EventBus.on?.('artifact:created', this._eventHandlers.artifactCreated);
          EventBus.on?.('artifact:deleted', this._eventHandlers.artifactDeleted);
        }
      }

      disconnectedCallback() {
        const EventBus = window.DIContainer?.resolve('EventBus');
        if (EventBus && this._eventHandlers) {
          EventBus.off?.('vfs:updated', this._eventHandlers.vfsUpdated);
          EventBus.off?.('checkpoint:created', this._eventHandlers.checkpointCreated);
          EventBus.off?.('checkpoint:restored', this._eventHandlers.checkpointRestored);
          EventBus.off?.('artifact:created', this._eventHandlers.artifactCreated);
          EventBus.off?.('artifact:deleted', this._eventHandlers.artifactDeleted);
        }
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      getStatus() {
        const artifactCount = typeof vfs !== 'undefined' ? Object.keys(vfs).length : 0;
        const checkpointCount = typeof checkpoints !== 'undefined' ? checkpoints.length : 0;
        const lastSaveTime = typeof lastCheckpointTime !== 'undefined' ? lastCheckpointTime : null;

        // Determine state based on activity
        let state = 'idle';
        if (typeof pendingOperations !== 'undefined' && pendingOperations > 0) {
          state = 'active';
        }
        if (artifactCount === 0) {
          state = 'warning';
        }

        return {
          state: state,
          primaryMetric: `${artifactCount} artifacts`,
          secondaryMetric: `${checkpointCount} checkpoints`,
          lastActivity: lastSaveTime
        };
      }

      render() {
        const StateManager = window.DIContainer?.resolve('StateManager');
        const vfsStats = StateManager?.getVFSStats ? StateManager.getVFSStats() : {
          artifactCount: 0,
          totalSize: 0,
          checkpointCount: 0,
          uptime: 0,
          recentCheckpoints: [],
          byFolder: {}
        };

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              color: #e0e0e0;
            }
            .state-manager-detail-panel {
              padding: 12px;
              background: #1a1a1a;
              border-radius: 4px;
            }
            h4 {
              margin: 0 0 12px 0;
              font-size: 14px;
              color: #4fc3f7;
            }
            h5 {
              margin: 12px 0 8px 0;
              font-size: 13px;
              color: #aaa;
            }
            .controls {
              margin-bottom: 12px;
              display: flex;
              gap: 8px;
            }
            button {
              padding: 6px 12px;
              background: #333;
              color: #e0e0e0;
              border: 1px solid #555;
              border-radius: 3px;
              cursor: pointer;
              font-family: monospace;
              font-size: 11px;
            }
            button:hover {
              background: #444;
            }
            .stats-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 8px;
              margin-bottom: 12px;
            }
            .stat-card {
              padding: 8px;
              background: #252525;
              border-radius: 3px;
              border: 1px solid #333;
            }
            .stat-label {
              font-size: 11px;
              color: #888;
              margin-bottom: 4px;
            }
            .stat-value {
              font-size: 16px;
              font-weight: bold;
              color: #4fc3f7;
            }
            .checkpoint-list {
              max-height: 200px;
              overflow-y: auto;
              background: #252525;
              border: 1px solid #333;
              border-radius: 3px;
              padding: 4px;
              margin-bottom: 12px;
            }
            .checkpoint-item {
              display: flex;
              align-items: center;
              gap: 8px;
              padding: 6px;
              margin: 2px 0;
              background: #2a2a2a;
              border-radius: 2px;
              font-size: 11px;
            }
            .checkpoint-time {
              color: #888;
              flex-shrink: 0;
            }
            .checkpoint-label {
              color: #e0e0e0;
              flex-grow: 1;
            }
            .checkpoint-restore {
              padding: 3px 8px;
              font-size: 10px;
            }
            .storage-breakdown {
              background: #252525;
              border: 1px solid #333;
              border-radius: 3px;
              padding: 8px;
            }
            .storage-item {
              display: grid;
              grid-template-columns: 1fr 2fr auto;
              gap: 8px;
              align-items: center;
              padding: 6px;
              margin: 4px 0;
              font-size: 11px;
            }
            .folder-name {
              color: #4fc3f7;
            }
            .storage-bar {
              height: 12px;
              background: #1a1a1a;
              border-radius: 6px;
              overflow: hidden;
            }
            .storage-fill {
              height: 100%;
              background: linear-gradient(90deg, #4fc3f7, #6496ff);
              transition: width 0.3s;
            }
            .folder-size {
              color: #888;
              text-align: right;
            }
          </style>
          <div class="state-manager-detail-panel">
            <h4>⛝ Virtual File System</h4>

            <div class="controls">
              <button class="create-checkpoint">⛃ Checkpoint</button>
              <button class="view-vfs">⛁ Explore</button>
            </div>

            <div class="stats-grid">
              <div class="stat-card">
                <div class="stat-label">Artifacts</div>
                <div class="stat-value">${vfsStats.artifactCount}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Total Size</div>
                <div class="stat-value">${formatBytes(vfsStats.totalSize)}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Checkpoints</div>
                <div class="stat-value">${vfsStats.checkpointCount}</div>
              </div>

              <div class="stat-card">
                <div class="stat-label">Uptime</div>
                <div class="stat-value">${formatUptime(vfsStats.uptime)}</div>
              </div>
            </div>

            <h5>Recent Checkpoints</h5>
            <div class="checkpoint-list">
              ${vfsStats.recentCheckpoints.length > 0 ? vfsStats.recentCheckpoints.map(cp => `
                <div class="checkpoint-item">
                  <span class="checkpoint-time">${formatTime(cp.timestamp)}</span>
                  <span class="checkpoint-label">${cp.label}</span>
                  <button class="checkpoint-restore" data-id="${cp.id}">Restore</button>
                </div>
              `).join('') : '<p style="color: #888; padding: 8px;">No checkpoints</p>'}
            </div>

            <h5>Storage Breakdown</h5>
            <div class="storage-breakdown">
              ${Object.keys(vfsStats.byFolder).length > 0 ? Object.entries(vfsStats.byFolder).map(([folder, size]) => `
                <div class="storage-item">
                  <span class="folder-name">${folder}</span>
                  <div class="storage-bar">
                    <div class="storage-fill" style="width: ${vfsStats.totalSize > 0 ? (size/vfsStats.totalSize)*100 : 0}%"></div>
                  </div>
                  <span class="folder-size">${formatBytes(size)}</span>
                </div>
              `).join('') : '<p style="color: #888;">No data</p>'}
            </div>
          </div>
        `;

        // Attach event listeners
        this.shadowRoot.querySelector('.create-checkpoint')?.addEventListener('click', async () => {
          if (StateManager) {
            const checkpoint = await StateManager.createCheckpoint?.('Manual checkpoint');
            window.ToastNotifications?.show?.(`Checkpoint created: ${checkpoint?.id}`, 'success');
          }
        });

        this.shadowRoot.querySelector('.view-vfs')?.addEventListener('click', () => {
          const ModuleDashboard = window.DIContainer?.resolve('ModuleDashboard');
          ModuleDashboard?.expandModule?.('StateManager');
        });

        this.shadowRoot.querySelectorAll('.checkpoint-restore').forEach(btn => {
          btn.addEventListener('click', async () => {
            const checkpointId = btn.dataset.id;
            if (StateManager) {
              await StateManager.restoreCheckpoint?.(checkpointId);
              window.ToastNotifications?.show?.(`Restored checkpoint ${checkpointId}`, 'success');
            }
          });
        });
      }
    }

    if (!customElements.get('state-manager-widget')) {
      customElements.define('state-manager-widget', StateManagerWidget);
    }

    return {
      element: 'state-manager-widget',
      displayName: 'State Manager',
      icon: '⛝',
      category: 'storage',
      order: 15
    };
  })()
};

// Utility functions for the panel
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return date.toLocaleDateString();
}

/**
 * BEFORE vs AFTER Comparison:
 *
 * BEFORE (StateManager is invisible):
 * - No way to see artifact count from UI
 * - No way to see checkpoint history
 * - No way to restore checkpoints from dashboard
 * - Must use console commands: StateManager.createCheckpoint()
 *
 * AFTER (StateManager has widget):
 * - Compact card shows: "47 artifacts | 3 checkpoints"
 * - Status indicator: green (active) when saving
 * - Buttons: "Checkpoint" and "Explore"
 * - Expanded view shows full breakdown and restore options
 * - Auto-updates when VFS changes
 *
 * This makes an INVISIBLE module VISIBLE in the dashboard.
 */
