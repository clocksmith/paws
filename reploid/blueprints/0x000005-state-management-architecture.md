# Blueprint 0x000005: State Management Architecture

**Objective:** To manage the agent's single state object and provide a controlled, transactional interface for modifying it and its associated artifact metadata.

**Target Upgrade:** STMT (`state-manager.js`)


**Prerequisites:** `0x000003`, `0x000004`, **0x00004E** (Module Widget Protocol)

**Affected Artifacts:** `/modules/state-manager.js`

---

### 1. The Strategic Imperative

An autonomous agent's state is its most critical asset. Allowing disparate modules to directly modify a global state object would lead to race conditions, data corruption, and unmaintainable code. To ensure data integrity and predictable behavior, all state modifications must be channeled through a single, authoritative module: the `StateManager`. This module acts as the protector of the agent's memory, ensuring that all changes are valid and properly persisted.

### 2. The Architectural Solution

The StateManager module manages the agent's single source of truth for state with transactional updates, session management, and real-time monitoring through a Web Component widget. It implements a factory pattern with encapsulated state logic and Shadow DOM-based UI for tracking artifacts and sessions.

**Module Architecture:**
```javascript
const StateManager = {
  metadata: {
    id: 'StateManager',
    version: '2.0.0',
    dependencies: ['config', 'Storage', 'StateHelpersPure', 'Utils', 'AuditLogger'],
    async: true,
    type: 'service'
  },
  factory: (deps) => {
    const { config, Storage, StateHelpersPure, Utils, AuditLogger } = deps;
    const { logger, Errors } = Utils;

    // Internal state (accessible to widget via closure)
    let globalState = null;
    const FILE_SIZE_LIMITS = { code: 1024 * 1024, document: 5 * 1024 * 1024, /*...*/ };

    // Session manager
    const sessionManager = new SessionManager();

    // Checkpointing
    let checkpoints = [];

    // Core state management functions
    const init = async () => {
      const savedStateJSON = await Storage.getState();
      globalState = savedStateJSON ? JSON.parse(savedStateJSON) : {
        totalCycles: 0,
        artifactMetadata: {},
        currentGoal: null,
        apiKey: config.apiKey || ""
      };
      return true;
    };

    const getState = () => globalState;

    const updateAndSaveState = async (updaterFn) => {
      const stateCopy = JSON.parse(JSON.stringify(globalState));
      const newState = await updaterFn(stateCopy);
      globalState = newState;
      await Storage.saveState(JSON.stringify(globalState));
      return globalState;
    };

    // Artifact management
    const createArtifact = async (path, type, content, description) => {
      validateFileSize(path, content);
      await Storage.setArtifactContent(path, content);
      if (AuditLogger) await AuditLogger.logVfsCreate(path, type, size, { description });

      return await updateAndSaveState(async state => {
        state.artifactMetadata[path] = { id: path, type, description };
        return state;
      });
    };

    // Web Component Widget (defined inside factory to access closure state)
    class StateManagerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._eventCleanup = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();

        // Subscribe to events for reactive updates
        const EventBus = window.DIContainer?.resolve('EventBus');
        if (EventBus) {
          const handleUpdate = () => this.render();
          EventBus.on('vfs:updated', handleUpdate);
          EventBus.on('checkpoint:created', handleUpdate);
          EventBus.on('artifact:created', handleUpdate);
          // ... more events

          this._eventCleanup = () => {
            EventBus.off('vfs:updated', handleUpdate);
            // ... cleanup all listeners
          };
        }
      }

      disconnectedCallback() {
        if (this._eventCleanup) this._eventCleanup();
      }

      async render() {
        // Access closure variables: globalState, sessionManager, checkpoints
        const sessions = await sessionManager.listSessions();
        const artifactCount = Object.keys(globalState?.artifactMetadata || {}).length;

        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; font-size: 12px; }
            .state-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
            .session { margin: 8px 0; padding: 8px; background: rgba(0, 255, 255, 0.1); }
            .session.active { border-left: 3px solid #0ff; }
            .session.archived { opacity: 0.6; }
          </style>
          <div class="state-panel">
            <h4>🗂 State Manager</h4>
            <div>Artifacts: ${artifactCount}</div>
            <div>Checkpoints: ${checkpoints.length}</div>
            <div class="sessions">
              ${sessions.map(s => `
                <div class="session ${s.status}">
                  <strong>${s.id}</strong> (${s.turns.length} turns)
                  <div style="font-size: 10px; color: #888;">${s.goal}</div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }
    }

    customElements.define('state-manager-widget', StateManagerWidget);

    return {
      init,
      api: {
        getState,
        saveState,
        updateAndSaveState,
        getArtifactMetadata,
        getAllArtifactMetadata,
        getArtifactContent,
        createArtifact,
        updateArtifact,
        deleteArtifact,
        incrementCycle,
        updateGoal,
        createSession,
        listSessions,
        // ... session management methods
        createCheckpoint,
        restoreCheckpoint
      },
      widget: {
        element: 'state-manager-widget',
        displayName: 'State Manager',
        icon: '🗂',
        category: 'core',
        updateInterval: null
      }
    };
  }
};
```

**Core State Management Patterns:**

The StateManager exposes two types of methods:

1. **Read Methods:**
   - `getState()`: Returns current globalState object
   - `getArtifactMetadata(path)`: Returns metadata for specific artifact
   - `getAllArtifactMetadata()`: Returns all artifact metadata
   - `getArtifactContent(path)`: Delegates to Storage for file content
   - `listSessions()`: Returns all session manifests
   - `getSessionInfo(sessionId)`: Returns specific session data

2. **Write Methods (Transactional):**
   - `updateAndSaveState(updaterFn)`: Core transactional pattern - deep copies state, passes to updater function, validates and saves result
   - `createArtifact(path, type, content, description)`: Creates new VFS file with metadata
   - `updateArtifact(path, content)`: Updates existing VFS file
   - `deleteArtifact(path)`: Removes VFS file and metadata
   - `incrementCycle()`: Atomic cycle counter update
   - `updateGoal(newGoal)`: Atomic goal modification
   - `createSession(goal)`: Creates new PAWS-style session
   - `createCheckpoint(note)`: Snapshots current state for rollback

**Key Architectural Features:**

- **Transactional Updates**: The `updateAndSaveState` pattern ensures atomic state modifications - all changes go through this single bottleneck for consistency
- **Delegation Pattern**: StateManager doesn't handle persistence directly - delegates to injected Storage module for clean separation of concerns
- **File Size Validation**: SEC-3 security - validates file sizes before creation/update to prevent resource exhaustion
- **Audit Logging**: SEC-4 security - logs all VFS operations (create/update/delete) when AuditLogger available
- **Session Management**: PAWS-style workflow with sessions and turns for conversation tracking
- **Checkpointing**: State snapshots for rollback capability
- **Event-Driven**: Emits events on state changes for reactive UI updates

**Web Component Widget Features:**

The `StateManagerWidget` provides comprehensive state visualization:
- **Session Dashboard**: Shows active and archived sessions with turn counts
- **Artifact Overview**: Displays total artifacts and recent changes
- **Checkpoint Management**: Create/restore checkpoints from UI
- **Event-Driven Updates**: Automatically refreshes on VFS changes, checkpoint events, artifact operations
- **Session Controls**: Interactive buttons for archiving, deleting, rewinding sessions
- **Turn History**: Expandable turn list for each session with rewind capability
- **Real-time Status**: Dashboard integration via `getStatus()` showing active sessions
- **Visual Feedback**: Color-coded session states (active/archived), turn status indicators

### 3. The Implementation Pathway

**Step 1: Module Registration**
```javascript
// In config.json, ensure StateManager is registered with dependencies
{
  "modules": {
    "StateManager": {
      "dependencies": ["config", "Storage", "StateHelpersPure", "Utils", "AuditLogger"],
      "enabled": true,
      "async": true
    }
  }
}
```

**Step 2: Factory Function Implementation**

The factory receives dependencies and creates state management logic:
```javascript
factory: (deps) => {
  const { config, Storage, StateHelpersPure, Utils, AuditLogger } = deps;
  const { logger, Errors } = Utils;
  const { StateError, ArtifactError } = Errors;

  // Internal state (accessible to widget via closure)
  let globalState = null;
  const FILE_SIZE_LIMITS = { code: 1024 * 1024, document: 5 * 1024 * 1024, /*...*/ };
  const sessionManager = new SessionManager();
  let checkpoints = [];

  // Web Component defined here to access closure variables
  class StateManagerWidget extends HTMLElement { /*...*/ }
  customElements.define('state-manager-widget', StateManagerWidget);

  return { init, api, widget };
}
```

**Step 3: Initialization and State Loading**

Load persisted state from Storage on startup:
```javascript
const init = async () => {
  logger.info("[StateManager] Initializing state...");
  const savedStateJSON = await Storage.getState();

  if (savedStateJSON) {
    globalState = JSON.parse(savedStateJSON);
    logger.info(`[StateManager] Loaded state for cycle ${globalState.totalCycles}`);
  } else {
    logger.warn("[StateManager] No saved state found. Creating minimal state.");
    globalState = {
      totalCycles: 0,
      artifactMetadata: {},
      currentGoal: null,
      apiKey: config.apiKey || ""
    };
  }

  return true;
};
```

**Step 4: Core Transactional Update Pattern**

Implement the atomic update-and-save pattern:
```javascript
const getState = () => {
  if (!globalState) throw new StateError("StateManager not initialized.");
  return globalState;
};

const saveState = async () => {
  if (!globalState) throw new StateError("No state to save");
  await Storage.saveState(JSON.stringify(globalState));
};

const updateAndSaveState = async (updaterFn) => {
  // Deep copy to prevent accidental mutations
  const stateCopy = JSON.parse(JSON.stringify(globalState));

  // Apply updates via user-provided function
  const newState = await updaterFn(stateCopy);

  // Update in-memory state
  globalState = newState;

  // Persist to storage
  await saveState();

  return globalState;
};
```

**Step 5: Artifact Management with File Size Validation**

Implement CRUD operations for VFS artifacts:
```javascript
const validateFileSize = (path, content) => {
  const size = new Blob([content]).size;
  const ext = path.split('.').pop()?.toLowerCase();

  let limit = FILE_SIZE_LIMITS.default;
  if (['js', 'ts', 'jsx', 'tsx'].includes(ext)) limit = FILE_SIZE_LIMITS.code;
  else if (['md', 'txt', 'html'].includes(ext)) limit = FILE_SIZE_LIMITS.document;
  // ... more types

  if (size > limit) {
    throw new ArtifactError(`File size ${(size/1024/1024).toFixed(2)}MB exceeds limit ${(limit/1024/1024).toFixed(1)}MB`);
  }
};

const createArtifact = async (path, type, content, description) => {
  // SEC-3: Validate file size
  validateFileSize(path, content);

  // Write to VFS
  await Storage.setArtifactContent(path, content);

  // SEC-4: Audit log
  if (AuditLogger) {
    await AuditLogger.logVfsCreate(path, type, new Blob([content]).size, { description });
  }

  // Update state metadata
  return await updateAndSaveState(async state => {
    state.artifactMetadata[path] = { id: path, type, description };
    logger.info(`[StateManager] Created artifact: ${path}`);
    return state;
  });
};

const updateArtifact = async (path, content) => {
  const existingMeta = globalState.artifactMetadata[path];
  if (!existingMeta) {
    throw new ArtifactError(`Cannot update non-existent artifact: ${path}`);
  }

  validateFileSize(path, content);
  await Storage.setArtifactContent(path, content);

  if (AuditLogger) {
    await AuditLogger.logVfsUpdate(path, new Blob([content]).size);
  }

  logger.info(`[StateManager] Updated artifact: ${path}`);
};

const deleteArtifact = async (path) => {
  await Storage.deleteArtifact(path);

  if (AuditLogger) {
    await AuditLogger.logVfsDelete(path);
  }

  return await updateAndSaveState(async state => {
    delete state.artifactMetadata[path];
    logger.warn(`[StateManager] Deleted artifact: ${path}`);
    return state;
  });
};
```

**Step 6: Session and Checkpoint Management**

Implement PAWS-style session tracking:
```javascript
class SessionManager {
  constructor() {
    this.activeSessionId = null;
  }

  async createSession(goal) {
    const sessionId = `session_${Date.now()}_${crypto.randomUUID()}`;
    this.activeSessionId = sessionId;

    const manifest = {
      id: sessionId,
      goal,
      status: 'active',
      startTime: new Date().toISOString(),
      turns: []
    };

    await Storage.setArtifactContent(
      `/sessions/${sessionId}/session.json`,
      JSON.stringify(manifest, null, 2)
    );

    logger.info(`[SessionManager] Created session: ${sessionId}`);
    return sessionId;
  }

  async listSessions() {
    // Query VFS for session directories
    // Return array of session manifests
  }

  async archiveSession(sessionId) {
    // Mark session as archived
  }
}

const createCheckpoint = async (note) => {
  const checkpoint = {
    id: `checkpoint_${Date.now()}`,
    state: JSON.parse(JSON.stringify(globalState)),
    note,
    timestamp: new Date().toISOString()
  };

  checkpoints.push(checkpoint);
  if (checkpoints.length > 10) checkpoints.shift(); // Keep last 10

  logger.info(`[StateManager] Checkpoint created: ${checkpoint.id}`);
  return checkpoint;
};

const restoreCheckpoint = async (checkpointId) => {
  const checkpoint = checkpoints.find(cp => cp.id === checkpointId);
  if (!checkpoint) throw new StateError(`Checkpoint not found: ${checkpointId}`);

  globalState = JSON.parse(JSON.stringify(checkpoint.state));
  await saveState();

  logger.warn(`[StateManager] Restored checkpoint: ${checkpointId}`);
  return globalState;
};
```

**Step 7: Web Component Widget**

The widget provides state visualization and control:
```javascript
class StateManagerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._eventCleanup = null;
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  connectedCallback() {
    this.render();

    // Subscribe to events for reactive updates
    const EventBus = window.DIContainer?.resolve('EventBus');
    if (EventBus) {
      const handleUpdate = () => this.render();

      EventBus.on('vfs:updated', handleUpdate);
      EventBus.on('checkpoint:created', handleUpdate);
      EventBus.on('checkpoint:restored', handleUpdate);
      EventBus.on('artifact:created', handleUpdate);
      EventBus.on('artifact:updated', handleUpdate);
      EventBus.on('artifact:deleted', handleUpdate);

      this._eventCleanup = () => {
        EventBus.off('vfs:updated', handleUpdate);
        EventBus.off('checkpoint:created', handleUpdate);
        EventBus.off('checkpoint:restored', handleUpdate);
        EventBus.off('artifact:created', handleUpdate);
        EventBus.off('artifact:updated', handleUpdate);
        EventBus.off('artifact:deleted', handleUpdate);
      };
    }
  }

  disconnectedCallback() {
    if (this._eventCleanup) {
      this._eventCleanup();
      this._eventCleanup = null;
    }
  }

  async getStatus() {
    if (!globalState) {
      return {
        state: 'warning',
        primaryMetric: 'Not initialized',
        secondaryMetric: '',
        lastActivity: null
      };
    }

    const artifactCount = Object.keys(globalState.artifactMetadata || {}).length;
    const sessions = await sessionManager.listSessions();
    const activeSessions = sessions.filter(s => s.status === 'active');

    return {
      state: activeSessions.length > 0 ? 'active' : 'idle',
      primaryMetric: `${activeSessions.length} active`,
      secondaryMetric: `${sessions.length} total sessions`,
      lastActivity: Date.now()
    };
  }

  getControls() {
    return [
      {
        id: 'create-checkpoint',
        label: 'Checkpoint',
        icon: '▼',
        action: async () => {
          const checkpoint = await createCheckpoint('Manual checkpoint from dashboard');
          const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
          ToastNotifications?.show(`Checkpoint created: ${checkpoint.id}`, 'success');
        }
      }
    ];
  }

  async render() {
    // Access closure variables: globalState, sessionManager, checkpoints
    const sessions = await sessionManager.listSessions();
    const artifactCount = Object.keys(globalState?.artifactMetadata || {}).length;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; font-family: monospace; font-size: 12px; }
        .state-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        .session { margin: 8px 0; padding: 8px; background: rgba(0, 255, 255, 0.1); }
        .session.active { border-left: 3px solid #0ff; }
        .session.archived { opacity: 0.6; }
        .checkpoint-list { margin-top: 8px; }
      </style>
      <div class="state-panel">
        <h4>🗂 State Manager</h4>
        <div>Artifacts: ${artifactCount}</div>
        <div>Checkpoints: ${checkpoints.length}</div>
        <div class="sessions">
          ${sessions.map(s => `
            <div class="session ${s.status}">
              <strong>${s.id}</strong> (${s.turns.length} turns)
              <div style="font-size: 10px; color: #888;">${s.goal}</div>
            </div>
          `).join('')}
        </div>
        <div class="checkpoint-list">
          ${checkpoints.map(cp => `
            <div>📌 ${cp.note} (${new Date(cp.timestamp).toLocaleTimeString()})</div>
          `).join('')}
        </div>
      </div>
    `;
  }
}
```

**Step 8: Integration Points**

1. **Agent Cycle Integration**:
   - Calls `incrementCycle()` at start of each cycle
   - Uses `updateGoal()` when goal changes
   - Creates/updates artifacts via `createArtifact()` and `updateArtifact()`

2. **Dashboard Integration**:
   - Widget automatically integrates with module dashboard
   - Provides `getStatus()` for summary view
   - Provides `getControls()` for action buttons
   - Event-driven updates (no polling needed)

3. **Security Features**:
   - File size validation prevents resource exhaustion attacks
   - Audit logging tracks all VFS operations
   - Transactional updates prevent race conditions

4. **Session Workflow**:
   - Create session at conversation start
   - Create turn for each agent cycle
   - Archive sessions when complete
   - Rewind to previous turns for debugging