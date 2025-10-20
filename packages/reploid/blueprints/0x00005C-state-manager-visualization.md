# Blueprint 0x00005C: State Manager Visualization & VFS Monitoring

**Objective:** Make the StateManager and Virtual File System (VFS) observable by exposing artifact counts, checkpoint history, storage breakdown, and interactive management controls.

**Target Upgrade:** STMGR (`state-manager-widget.js` + `state-manager.js`)

**Prerequisites:** 0x000005 (State Management Architecture), 0x000006 (Pure State Helpers), 0x000004 (Default Storage Backend)

**Affected Artifacts:** `/upgrades/state-manager.js`, `/upgrades/state-manager-widget.js`, `/upgrades/storage-indexeddb.js`

---

### 1. The Strategic Imperative

The StateManager and VFS are the foundation of REPLOID's persistence layer, storing all artifacts, checkpoints, and runtime state. However, they operate invisibly:
- **No visibility** into how many artifacts are stored or their sizes
- **No checkpoint management** from UI (must use console commands)
- **No storage breakdown** showing space usage by folder
- **No real-time monitoring** of VFS operations

Without observability, developers cannot:
- Track VFS growth and identify space bloat
- Restore checkpoints without manual commands
- Monitor save/load activity
- Diagnose state management issues

This blueprint adds **real-time monitoring and interactive controls** to make the state management layer visible and manageable.

### 2. Architectural Overview

The StateManager visualization extension adds introspection capabilities and a monitoring widget.

```javascript
// StateManager now exposes VFS statistics
const StateManager = await ModuleLoader.getModule('StateManager');

// Get VFS statistics
const stats = StateManager.getVFSStats();
// {
//   artifactCount: 42,
//   totalSize: 1024000,
//   checkpointCount: 5,
//   uptime: 3600000,
//   recentCheckpoints: [...],
//   byFolder: { '/sessions': 512000, '/blueprints': 256000, ... }
// }
```

#### Key Components

**1. VFS Statistics Calculation**
- **Artifact Count**: Total number of artifacts in VFS
- **Total Size**: Cumulative size of all artifacts (in bytes)
- **Checkpoint Count**: Number of saved checkpoints
- **Uptime**: Time since StateManager initialization (milliseconds)
- **Recent Checkpoints**: Last N checkpoints with timestamp, label, ID
- **Storage Breakdown**: Size per folder/namespace

**2. Checkpoint Management**
- **Create Checkpoint**: `createCheckpoint(label)` - Saves current VFS state
  - Generates unique checkpoint ID
  - Stores timestamp and label
  - Persists to storage backend
  - Emits `checkpoint:created` event
- **List Checkpoints**: Returns array of checkpoint metadata
  - Sorted by timestamp (newest first)
  - Includes: `{ id, label, timestamp, size }`
- **Restore Checkpoint**: `restoreCheckpoint(checkpointId)` - Loads saved VFS state
  - Validates checkpoint exists
  - Restores all artifacts from checkpoint
  - Emits `checkpoint:restored` event

**3. EventBus Integration**
- **VFS Events**:
  - `vfs:updated` - Any VFS change (artifact created/modified/deleted)
  - `artifact:created` - New artifact added
  - `artifact:deleted` - Artifact removed
  - `checkpoint:created` - Checkpoint saved
  - `checkpoint:restored` - Checkpoint loaded
- **Widget Auto-Updates**: Widget subscribes to all VFS events, re-renders on changes

**4. Storage Breakdown Analysis**
- Categorizes artifacts by folder path (e.g., `/sessions`, `/blueprints`, `/reflections`)
- Calculates cumulative size per folder
- Computes percentage of total storage
- Identifies largest consumers of space

**5. Uptime Tracking**
- Records initialization timestamp
- Calculates uptime as `Date.now() - initTime`
- Formats uptime as human-readable string (Xd Yh, Xh Ym, Xm Ys)

#### Monitoring Widget (Web Component)

The StateManager extension provides a Web Component widget for VFS monitoring and management:

```javascript
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
    // Access VFS state via closure or DIContainer
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
      lastActivity: lastSaveTime,
      message: null
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
        :host { display: block; }
        .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; }
        .stat-card { padding: 8px; background: #252525; }
        .checkpoint-list { max-height: 200px; overflow-y: auto; }
        .checkpoint-item { display: flex; gap: 8px; padding: 6px; }
        .storage-bar { height: 12px; background: #1a1a1a; border-radius: 6px; }
        .storage-fill { height: 100%; background: linear-gradient(90deg, #4fc3f7, #6496ff); }
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
          ${vfsStats.recentCheckpoints.map(cp => `
            <div class="checkpoint-item">
              <span class="checkpoint-time">${formatTime(cp.timestamp)}</span>
              <span class="checkpoint-label">${cp.label}</span>
              <button class="checkpoint-restore" data-id="${cp.id}">Restore</button>
            </div>
          `).join('')}
        </div>

        <h5>Storage Breakdown</h5>
        <div class="storage-breakdown">
          ${Object.entries(vfsStats.byFolder).map(([folder, size]) => `
            <div class="storage-item">
              <span class="folder-name">${folder}</span>
              <div class="storage-bar">
                <div class="storage-fill" style="width: ${(size/vfsStats.totalSize)*100}%"></div>
              </div>
              <span class="folder-size">${formatBytes(size)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;

    // Attach event listeners
    this.shadowRoot.querySelector('.create-checkpoint')?.addEventListener('click', async () => {
      const checkpoint = await StateManager.createCheckpoint?.('Manual checkpoint');
      window.ToastNotifications?.show?.(`Checkpoint created: ${checkpoint?.id}`, 'success');
    });

    this.shadowRoot.querySelector('.view-vfs')?.addEventListener('click', () => {
      const ModuleDashboard = window.DIContainer?.resolve('ModuleDashboard');
      ModuleDashboard?.expandModule?.('StateManager');
    });

    this.shadowRoot.querySelectorAll('.checkpoint-restore').forEach(btn => {
      btn.addEventListener('click', async () => {
        const checkpointId = btn.dataset.id;
        await StateManager.restoreCheckpoint?.(checkpointId);
        window.ToastNotifications?.show?.(`Restored checkpoint ${checkpointId}`, 'success');
      });
    });
  }
}

// Register custom element
if (!customElements.get('state-manager-widget')) {
  customElements.define('state-manager-widget', StateManagerWidget);
}

const widget = {
  element: 'state-manager-widget',
  displayName: 'State Manager',
  icon: '⛝',
  category: 'storage',
  order: 15
};
```

**Widget Features:**
- **DIContainer Access**: Widget resolves StateManager from DIContainer, calls `getVFSStats()`.
- **Status Reporting**: `getStatus()` provides artifact count, checkpoint count, last save time.
- **Stats Grid**: Shows artifacts, total size, checkpoints, uptime (4-quadrant grid).
- **Recent Checkpoints List**: Displays last N checkpoints with timestamp, label, restore button.
- **Storage Breakdown**: Visual bars showing space usage per folder with percentages.
- **Interactive Controls**: Create checkpoint, explore VFS, restore individual checkpoints.
- **EventBus Integration**: Auto-refreshes on VFS events (artifact created/deleted, checkpoint created/restored).
- **Utility Functions**: `formatBytes()`, `formatUptime()`, `formatTime()` for human-readable displays.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core StateManager Extension Implementation

1. **Add VFS Statistics Tracking**
   - Add `initTime = Date.now()` on initialization
   - Add `lastCheckpointTime = null` (updated on checkpoint creation)
   - Add `pendingOperations = 0` counter (increment on save start, decrement on complete)

2. **Implement getVFSStats()**
   - Calculate artifact count: `Object.keys(vfs).length`
   - Calculate total size: Sum of `artifact.content.length` across all artifacts
   - Count checkpoints: `checkpoints.length`
   - Calculate uptime: `Date.now() - initTime`
   - Get recent checkpoints: `checkpoints.slice(-10).reverse()` (last 10, newest first)
   - Calculate storage breakdown:
     - Group artifacts by folder path (extract from artifact ID)
     - Sum sizes per folder
     - Return `{ folderPath: totalSize }`
   - Return comprehensive stats object

3. **Enhance Checkpoint Management**
   - Modify `createCheckpoint(label)`:
     - Generate unique checkpoint ID
     - Create checkpoint object: `{ id, label, timestamp: Date.now(), vfsSnapshot: {...vfs} }`
     - Add to `checkpoints` array
     - Persist to storage backend
     - Update `lastCheckpointTime = Date.now()`
     - Emit `checkpoint:created` event with checkpoint metadata
   - Implement `listCheckpoints()`:
     - Return `checkpoints.map(cp => ({ id: cp.id, label: cp.label, timestamp: cp.timestamp, size: ... }))`
   - Implement `restoreCheckpoint(checkpointId)`:
     - Find checkpoint in `checkpoints` array
     - Validate checkpoint exists
     - Restore VFS: `vfs = { ...checkpoint.vfsSnapshot }`
     - Emit `checkpoint:restored` event
     - Return success status

4. **Add EventBus Notifications**
   - Emit `vfs:updated` on any VFS change (setArtifact, deleteArtifact)
   - Emit `artifact:created` on new artifact
   - Emit `artifact:deleted` on artifact removal
   - Emit `checkpoint:created` with checkpoint metadata
   - Emit `checkpoint:restored` with checkpoint ID

5. **Optimize Storage Breakdown**
   - Implement folder path extraction: `/sessions/session_123/turn_5.md` → `/sessions`
   - Cache folder sizes, invalidate on VFS changes
   - Sort folders by size (descending) for display

6. **Add Pending Operations Tracking**
   - Increment `pendingOperations` on async save start
   - Decrement `pendingOperations` on save completion
   - Use for `getStatus()` active state detection

#### Widget Implementation (Web Component)

7. **Define Web Component Class** in state-manager-widget.js:
   ```javascript
   class StateManagerWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```

8. **Implement Lifecycle Methods**:
   - `connectedCallback()`:
     - Initial render
     - Resolve EventBus from DIContainer
     - Subscribe to 5 VFS events (vfs:updated, checkpoint:created, checkpoint:restored, artifact:created, artifact:deleted)
     - Store event handler references for cleanup
   - `disconnectedCallback()`: Unsubscribe from all 5 EventBus events to prevent memory leaks

9. **Implement getStatus()** as class method:
   - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
   - Access VFS state via closure (if defined inside factory) or DIContainer
   - State logic:
     - `active` if `pendingOperations > 0`
     - `warning` if `artifactCount === 0`
     - `idle` otherwise
   - Primary metric: Artifact count
   - Secondary metric: Checkpoint count
   - Last activity: Last checkpoint time

10. **Implement render()** method:
    - Resolve StateManager from DIContainer
    - Call `StateManager.getVFSStats()` to get current stats
    - Set `this.shadowRoot.innerHTML` with encapsulated styles
    - Render stats grid (4 cards: artifacts, total size, checkpoints, uptime)
    - Render recent checkpoints list (last 10, with restore buttons)
    - Render storage breakdown (folder bars with percentages)
    - Attach event listeners to buttons:
      - Create checkpoint: Call `StateManager.createCheckpoint()`, show toast
      - View VFS: Expand StateManager module in dashboard
      - Restore buttons: Call `StateManager.restoreCheckpoint(id)`, show toast

11. **Implement Utility Functions**:
    - `formatBytes(bytes)`: Convert bytes to human-readable format (B, KB, MB, GB)
    - `formatUptime(ms)`: Convert milliseconds to Xd Yh, Xh Ym, Xm Ys
    - `formatTime(timestamp)`: Convert timestamp to "Just now", "Xm ago", "Xh ago", or date

12. **Register Custom Element**:
    - Use kebab-case naming: `state-manager-widget`
    - Add duplicate check: `if (!customElements.get('state-manager-widget'))`
    - Call `customElements.define('state-manager-widget', StateManagerWidget)`

13. **Integrate into state-manager.js**:
    - Import widget code from state-manager-widget.js
    - Add `widget` property to StateManager API return object
    - Ensure widget has access to VFS state (via DIContainer or closure)

14. **Return Widget Object** with new format:
    - `{ element: 'state-manager-widget', displayName: 'State Manager', icon: '⛝', category: 'storage', order: 15 }`

15. **Test** Shadow DOM rendering, EventBus subscription/cleanup, VFS statistics calculation, checkpoint creation/restoration, storage breakdown accuracy

### 4. Verification Checklist

- [ ] `getVFSStats()` returns accurate artifact count, total size, checkpoint count
- [ ] Uptime calculation is correct (difference from init time)
- [ ] Recent checkpoints list sorted by timestamp (newest first)
- [ ] Storage breakdown groups artifacts by folder correctly
- [ ] `createCheckpoint()` generates unique ID, saves snapshot, emits event
- [ ] `restoreCheckpoint()` restores VFS state from checkpoint
- [ ] EventBus events fire on VFS changes (artifact created/deleted, checkpoint created/restored)
- [ ] Widget displays stats grid with accurate numbers
- [ ] Widget renders recent checkpoints with labels and timestamps
- [ ] Widget storage breakdown bars show correct percentages
- [ ] Create checkpoint button works and shows toast
- [ ] Restore checkpoint buttons work for each checkpoint
- [ ] Widget re-renders on EventBus events
- [ ] Widget cleanup prevents memory leaks
- [ ] Utility functions format bytes, uptime, time correctly

### 5. Extension Opportunities

- Add checkpoint diff viewer (compare two checkpoints)
- Add checkpoint compression (reduce storage size)
- Add automatic checkpointing (schedule periodic saves)
- Add checkpoint tagging/categorization
- Add VFS garbage collection (remove orphaned artifacts)
- Add artifact search/filtering in VFS explorer
- Add artifact version history (track changes to individual artifacts)
- Add VFS export/import (backup/restore entire VFS)
- Add storage quota monitoring (alert when approaching limit)
- Add artifact access statistics (most/least accessed files)

Maintain this blueprint as the StateManager visualization capabilities evolve or new VFS features are introduced.
