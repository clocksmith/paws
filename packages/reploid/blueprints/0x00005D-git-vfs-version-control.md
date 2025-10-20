# Blueprint 0x00005D: Git-based Virtual File System

**Objective:** To provide version control, commit history, and rollback capabilities for the REPLOID virtual file system using isomorphic-git.

**Target Upgrade:** GVFS (`git-vfs.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000004 (Default Storage Backend)

**Affected Artifacts:** `/upgrades/git-vfs.js`

---

### 1. The Strategic Imperative

A self-modifying agent system requires robust version control to track evolution, enable rollback to known-good states, and maintain an audit trail of all self-modifications. The Git VFS provides:

- **Version History**: Complete commit history for all file modifications
- **Checkpoints**: Named snapshots for significant system states
- **Rollback**: Ability to revert to any previous commit
- **Audit Trail**: Timestamped record of who (agent/user) changed what and why
- **Branch Support**: Experimental modifications on separate branches

Without version control, self-modification risks are catastrophic - a bad change can destroy the system with no recovery path.

### 2. The Architectural Solution

The `/upgrades/git-vfs.js` implements a **Git-backed VFS** using isomorphic-git and LightningFS for browser-based persistence.

#### Module Structure

```javascript
const GitVFS = {
  metadata: {
    id: 'GitVFS',
    version: '1.0.0',
    dependencies: ['Utils', 'Storage'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, Storage } = deps;
    const { logger } = Utils;

    let git = null;
    let fs = null;
    let pfs = null;
    let isInitialized = false;

    const REPO_DIR = '/reploid-vfs';
    const DEFAULT_AUTHOR = {
      name: 'REPLOID Agent',
      email: 'agent@reploid.local'
    };

    // Core API
    const init = async () => {
      // Initialize isomorphic-git with LightningFS
      // Create repository if not exists
      // Return initialization status
    };

    const writeFile = async (path, content, message) => {
      // Write file to VFS
      // Stage changes
      // Auto-commit with message
    };

    const commit = async (message, metadata = {}) => {
      // Create commit with optional metadata
      // Support checkpoint/session/turn metadata
      // Return commit SHA
    };

    const getHistory = async (path, limit = 10) => {
      // Get commit history for specific file
      // Return array of { sha, message, timestamp, author }
    };

    const createCheckpoint = async (label, metadata = {}) => {
      // Create named checkpoint commit
      // Tag commit with checkpoint label
      // Enable easy rollback to checkpoint
    };

    const rollbackToCheckpoint = async (checkpointId) => {
      // Revert to specific checkpoint
      // Reset working directory
      // Return new commit SHA
    };

    // Web Component Widget (closure access to git state)
    class GitVFSWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
        this._interval = setInterval(() => this.render(), 3000);
      }

      disconnectedCallback() {
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      getStatus() {
        const history = getHistory('', 1); // Get latest commit
        const commitStats = getCommitStats();
        const checkpoints = getAllCheckpoints();

        return {
          state: isInitialized ? 'active' : 'disabled',
          primaryMetric: `${commitStats.totalCommits} commits`,
          secondaryMetric: `${checkpoints.length} checkpoints`,
          lastActivity: history[0]?.timestamp || null,
          message: isInitialized ? 'Git VFS active' : 'Not initialized'
        };
      }

      getControls() {
        return [
          {
            id: 'create-checkpoint',
            label: '⛃ Create Checkpoint',
            action: async () => {
              const label = prompt('Checkpoint label:');
              if (label) {
                await createCheckpoint(label);
                return { success: true, message: `Checkpoint "${label}" created` };
              }
              return { success: false, message: 'Cancelled' };
            }
          },
          {
            id: 'view-history',
            label: '⏱ View History',
            action: () => {
              const history = getHistory('', 20);
              console.table(history);
              return { success: true, message: `${history.length} commits (see console)` };
            }
          }
        ];
      }

      render() {
        const isReady = isInitialized;
        const history = isReady ? getHistory('', 10) : [];
        const commitStats = isReady ? getCommitStats() : { totalCommits: 0 };
        const checkpoints = isReady ? getAllCheckpoints() : [];

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }
            .git-vfs-panel {
              padding: 12px;
              background: #1a1a1a;
              border-radius: 4px;
            }
            .git-stats {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 8px;
              margin-bottom: 12px;
            }
            .stat-card {
              padding: 8px;
              border-radius: 3px;
              text-align: center;
            }
            .commit-item {
              padding: 6px;
              margin: 4px 0;
              background: #2a2a2a;
              border-radius: 2px;
              border-left: 2px solid #0ff;
            }
            .checkpoint-item {
              padding: 4px;
              margin: 2px 0;
              background: #2a2a2a;
              border-radius: 2px;
              border-left: 2px solid #9c27b0;
            }
          </style>
          <div class="git-vfs-panel">
            <h4>⛝ Git VFS</h4>

            ${!isReady ? `
              <div class="empty-state">Git VFS not initialized</div>
            ` : `
              <div class="git-stats">
                <div class="stat-card" style="background: rgba(0,255,255,0.1);">
                  <div>Total Commits</div>
                  <div style="color: #0ff;">${commitStats.totalCommits}</div>
                </div>
                <div class="stat-card" style="background: rgba(156,39,176,0.1);">
                  <div>Checkpoints</div>
                  <div style="color: #9c27b0;">${checkpoints.length}</div>
                </div>
              </div>

              <div class="recent-commits">
                <h5>Recent Commits (${history.length})</h5>
                ${history.slice(0, 5).map(commit => `
                  <div class="commit-item">
                    <div style="font-size: 11px; color: #ccc;">${commit.message}</div>
                    <div style="font-size: 10px; color: #666;">
                      ${commit.author} · ${new Date(commit.timestamp).toLocaleString()}
                    </div>
                  </div>
                `).join('') || '<div class="empty-state">No commits</div>'}
              </div>
            `}
          </div>
        `;
      }
    }

    if (!customElements.get('git-vfs-widget')) {
      customElements.define('git-vfs-widget', GitVFSWidget);
    }

    const widget = {
      element: 'git-vfs-widget',
      displayName: 'Git VFS',
      icon: '⛝',
      category: 'storage'
    };

    return {
      init,
      api: {
        writeFile,
        readFile,
        deleteFile,
        commit,
        getHistory,
        createCheckpoint,
        rollbackToCheckpoint,
        getCommitStats,
        getAllCheckpoints
      },
      widget
    };
  }
};
```

#### Core Responsibilities

1. **Repository Management**: Initialize and maintain Git repository using LightningFS
2. **File Operations**: Write, read, delete files with automatic staging
3. **Commit Management**: Create commits with metadata (checkpoint, session, turn)
4. **History Tracking**: Retrieve commit history for individual files or entire repository
5. **Checkpoint System**: Create named checkpoints for easy rollback
6. **Rollback**: Revert working directory to any previous commit or checkpoint
7. **Visualization**: Widget displays commit history, checkpoints, and stats

### 3. The Implementation Pathway

#### Step 1: Initialize Git Libraries

Check for browser availability of isomorphic-git and LightningFS:

```javascript
const init = async () => {
  if (isInitialized) return;

  if (typeof window !== 'undefined' && window.git && window.LightningFS) {
    git = window.git;
    fs = new window.LightningFS('reploid-git-vfs');
    pfs = fs.promises;

    const exists = await checkRepoExists();
    if (!exists) {
      await initializeRepository();
    }

    isInitialized = true;
    logger.info('[GitVFS] Initialized successfully');
  } else {
    logger.warn('[GitVFS] Git libraries not available, using fallback storage');
  }
};
```

#### Step 2: Initialize Repository

Create new repository with initial commit:

```javascript
const initializeRepository = async () => {
  await pfs.mkdir(REPO_DIR, { recursive: true });

  await git.init({
    fs: pfs,
    dir: REPO_DIR,
    defaultBranch: 'main'
  });

  await pfs.writeFile(`${REPO_DIR}/README.md`, '# REPLOID VFS\n\nGit-backed VFS.');
  await git.add({ fs: pfs, dir: REPO_DIR, filepath: 'README.md' });
  await git.commit({
    fs: pfs,
    dir: REPO_DIR,
    message: 'Initial commit',
    author: DEFAULT_AUTHOR
  });
};
```

#### Step 3: Implement File Operations

Wrap file operations with automatic git staging:

```javascript
const writeFile = async (path, content, message) => {
  const fullPath = `${REPO_DIR}/${path}`;
  await pfs.writeFile(fullPath, content);
  await git.add({ fs: pfs, dir: REPO_DIR, filepath: path });

  if (message) {
    return await commit(message);
  }
};
```

#### Step 4: Implement Commit with Metadata

Support structured metadata in commit messages:

```javascript
const commit = async (message, metadata = {}) => {
  let fullMessage = message;

  if (metadata.checkpoint) {
    fullMessage += `\n\nCheckpoint: ${metadata.checkpoint}`;
  }
  if (metadata.session) {
    fullMessage += `\nSession: ${metadata.session}`;
  }

  const sha = await git.commit({
    fs: pfs,
    dir: REPO_DIR,
    message: fullMessage,
    author: metadata.author || DEFAULT_AUTHOR
  });

  return sha;
};
```

#### Step 5: Implement History Retrieval

Get commit history with optional file filtering:

```javascript
const getHistory = async (path, limit = 10) => {
  const commits = await git.log({ fs: pfs, dir: REPO_DIR, depth: limit });

  const history = [];
  for (const commit of commits) {
    if (!path || await commitAffectsFile(commit.oid, path)) {
      history.push({
        sha: commit.oid,
        message: commit.commit.message,
        timestamp: commit.commit.author.timestamp * 1000,
        author: commit.commit.author.name
      });
    }
  }

  return history;
};
```

#### Step 6: Implement Checkpoint System

Create named checkpoints using Git tags:

```javascript
const createCheckpoint = async (label, metadata = {}) => {
  const sha = await commit(`Checkpoint: ${label}`, {
    ...metadata,
    checkpoint: label
  });

  await git.tag({
    fs: pfs,
    dir: REPO_DIR,
    ref: `checkpoint-${label}`,
    object: sha
  });

  return sha;
};
```

#### Step 7: Implement Web Component Widget

Create widget class inside factory with closure access:

```javascript
class GitVFSWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._interval = setInterval(() => this.render(), 3000);
  }

  disconnectedCallback() {
    if (this._interval) clearInterval(this._interval);
  }

  getStatus() {
    // Access module state via closure
    return {
      state: isInitialized ? 'active' : 'disabled',
      primaryMetric: `${getCommitStats().totalCommits} commits`,
      secondaryMetric: `${getAllCheckpoints().length} checkpoints`,
      lastActivity: getHistory('', 1)[0]?.timestamp || null,
      message: isInitialized ? 'Git VFS active' : 'Not initialized'
    };
  }

  // ... render method with commit history and checkpoint visualization
}
```

#### Step 8: Register Custom Element

```javascript
const elementName = 'git-vfs-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, GitVFSWidget);
}
```

#### Step 9: Return Module Interface

```javascript
return {
  init,
  api: {
    writeFile,
    readFile,
    deleteFile,
    commit,
    getHistory,
    createCheckpoint,
    rollbackToCheckpoint,
    getCommitStats,
    getAllCheckpoints
  },
  widget: {
    element: elementName,
    displayName: 'Git VFS',
    icon: '⛝',
    category: 'storage'
  }
};
```

### 4. Operational Safeguards & Quality Gates

- **Fallback Storage**: Gracefully degrade to non-git storage when libraries unavailable
- **Atomic Commits**: Ensure all file operations result in complete commits
- **Error Recovery**: Handle git operation failures without corrupting repository
- **Memory Management**: Clear widget intervals on disconnection
- **Checkpoint Validation**: Verify checkpoint names are unique before creating tags

### 5. Extension Points

- **Branch Support**: Implement branch creation for experimental modifications
- **Remote Sync**: Add GitHub/GitLab sync for backup and collaboration
- **Diff Visualization**: Enhance widget to show file diffs between commits
- **Conflict Resolution**: Handle merge conflicts during rollback
- **Compression**: Implement git garbage collection for large histories

Use this blueprint whenever modifying Git VFS logic, adding version control features, or implementing rollback mechanisms.
