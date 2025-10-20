// @blueprint 0x000005 - Outlines the StateManager as the single source of truth for agent state.
// Standardized State Manager Module for REPLOID - Git-Aware

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
    const { StateError, ArtifactError } = Errors;

    let globalState = null;

    // SEC-3: File size limits (in bytes)
    const FILE_SIZE_LIMITS = {
      code: 1024 * 1024,        // 1 MB for code files (.js, .ts, etc.)
      document: 5 * 1024 * 1024, // 5 MB for documents (.md, .txt, etc.)
      data: 10 * 1024 * 1024,    // 10 MB for data files (.json, .csv, etc.)
      image: 5 * 1024 * 1024,    // 5 MB for images
      default: 2 * 1024 * 1024   // 2 MB default
    };

    /**
     * SEC-3: Validate file size against limits
     * @param {string} path - File path
     * @param {string} content - File content
     * @throws {ArtifactError} If file exceeds size limit
     */
    const validateFileSize = (path, content) => {
      const size = new Blob([content]).size;

      // Determine file type from extension
      let limit = FILE_SIZE_LIMITS.default;
      const ext = path.split('.').pop()?.toLowerCase();

      if (['js', 'ts', 'jsx', 'tsx', 'mjs'].includes(ext)) {
        limit = FILE_SIZE_LIMITS.code;
      } else if (['md', 'txt', 'html', 'css'].includes(ext)) {
        limit = FILE_SIZE_LIMITS.document;
      } else if (['json', 'csv', 'xml', 'yaml', 'yml'].includes(ext)) {
        limit = FILE_SIZE_LIMITS.data;
      } else if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        limit = FILE_SIZE_LIMITS.image;
      }

      if (size > limit) {
        const limitMB = (limit / 1024 / 1024).toFixed(1);
        const sizeMB = (size / 1024 / 1024).toFixed(2);
        throw new ArtifactError(
          `File size ${sizeMB} MB exceeds limit of ${limitMB} MB for ${path}`,
          { size, limit, path }
        );
      }

      logger.debug(`[StateManager] File size validation passed for ${path}`, {
        size,
        limit,
        percentage: ((size / limit) * 100).toFixed(1) + '%'
      });
    };

    const init = async () => {
      logger.info("[StateManager-Git] Initializing state...");
      const savedStateJSON = await Storage.getState();
      if (savedStateJSON) {
        globalState = JSON.parse(savedStateJSON);
        logger.info(`[StateManager-Git] Loaded state for cycle ${globalState.totalCycles}`);
      } else {
        logger.warn("[StateManager-Git] No saved state found. Creating minimal state.");
        globalState = { totalCycles: 0, artifactMetadata: {}, currentGoal: null, apiKey: config.apiKey || "" };
      }
      return true;
    };

    const getState = () => {
        if (!globalState) throw new StateError("StateManager not initialized.");
        return globalState;
    };

    const saveState = async () => {
        if (!globalState) throw new StateError("No state to save");
        await Storage.saveState(JSON.stringify(globalState));
    };

    const updateAndSaveState = async (updaterFn) => {
        const stateCopy = JSON.parse(JSON.stringify(globalState));
        const newState = await updaterFn(stateCopy);
        globalState = newState;
        await saveState();
        return globalState;
    };

    const createArtifact = async (path, type, content, description) => {
        // SEC-3: Validate file size before creating
        validateFileSize(path, content);
        await Storage.setArtifactContent(path, content);

        // SEC-4: Audit log artifact creation
        if (AuditLogger) {
            await AuditLogger.logVfsCreate(path, type, new Blob([content]).size, { description });
        }

        return await updateAndSaveState(async state => {
            state.artifactMetadata[path] = { id: path, type, description };
            logger.info(`[StateManager-Git] Created artifact: ${path}`);
            return state;
        });
    };

    const updateArtifact = async (path, content) => {
        const existingMeta = globalState.artifactMetadata[path];
        if (!existingMeta) {
            throw new ArtifactError(`Cannot update non-existent artifact: ${path}`);
        }
        // SEC-3: Validate file size before updating
        validateFileSize(path, content);
        await Storage.setArtifactContent(path, content);

        // SEC-4: Audit log artifact update
        if (AuditLogger) {
            await AuditLogger.logVfsUpdate(path, new Blob([content]).size);
        }

        logger.info(`[StateManager-Git] Updated artifact: ${path}`);
    };

    const deleteArtifact = async (path) => {
        await Storage.deleteArtifact(path);

        // SEC-4: Audit log artifact deletion
        if (AuditLogger) {
            await AuditLogger.logVfsDelete(path);
        }

        return await updateAndSaveState(async state => {
            delete state.artifactMetadata[path];
            logger.warn(`[StateManager-Git] Deleted artifact: ${path}`);
            return state;
        });
    };

    const incrementCycle = async () => {
        return await updateAndSaveState(async state => {
            state.totalCycles = (state.totalCycles || 0) + 1;
            return state;
        });
    };

    const updateGoal = async (newGoal) => {
        return await updateAndSaveState(async state => {
            if (!state.currentGoal) {
                state.currentGoal = { seed: newGoal, cumulative: newGoal, stack: [], latestType: "System" };
            } else {
                state.currentGoal.cumulative = newGoal;
                state.currentGoal.stack.push({ cycle: state.totalCycles, goal: newGoal });
            }
            return state;
        });
    };

    // New SessionManager class for PAWS-like workflow
    class SessionManager {
        constructor() {
            this.activeSessionId = null;
        }

        async createSession(goal) {
            // Use crypto.randomBytes for better uniqueness instead of timestamp
            const randomBytes = Array.from(crypto.getRandomValues(new Uint8Array(8)))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
            const sessionId = `session_${Date.now()}_${randomBytes}`;
            this.activeSessionId = sessionId;
            const sessionPath = `/sessions/${sessionId}`;
            const manifest = {
                id: sessionId,
                goal,
                status: 'active',
                startTime: new Date().toISOString(),
                turns: []
            };

            // Create session directory and manifest
            await Storage.setArtifactContent(`${sessionPath}/session.json`, JSON.stringify(manifest, null, 2));
            logger.info(`[SessionManager] Created new session: ${sessionId}`);
            return sessionId;
        }

        async createTurn(sessionId) {
            const sessionPath = `/sessions/${sessionId}`;
            const manifestContent = await Storage.getArtifactContent(`${sessionPath}/session.json`);
            const manifest = JSON.parse(manifestContent);

            const turnNumber = manifest.turns.length;

            // Create checkpoint before starting new turn
            let checkpointId = null;
            try {
                const checkpoint = await createCheckpoint(`Session ${sessionId} - Turn ${turnNumber} start`);
                checkpointId = checkpoint.id;
                logger.info(`[SessionManager] Created turn checkpoint: ${checkpointId}`);
            } catch (err) {
                logger.warn(`[SessionManager] Failed to create turn checkpoint:`, err);
            }

            const turn = {
                turn: turnNumber,
                cats_path: `${sessionPath}/turn-${turnNumber}.cats.md`,
                dogs_path: `${sessionPath}/turn-${turnNumber}.dogs.md`,
                status: 'pending_context',
                checkpointId,
                createdAt: new Date().toISOString()
            };
            manifest.turns.push(turn);

            await Storage.setArtifactContent(`${sessionPath}/session.json`, JSON.stringify(manifest, null, 2));
            logger.info(`[SessionManager] Created turn ${turnNumber} for session ${sessionId}`);
            return turn;
        }

        getActiveSessionId() {
            return this.activeSessionId;
        }

        async listSessions() {
            // Get all session directories from /sessions/
            const artifactMeta = await Storage.getAllArtifactMetadata?.() || globalState.artifactMetadata || {};
            const sessionIds = new Set();

            for (const path in artifactMeta) {
                if (path.startsWith('/sessions/') && path.includes('session.json')) {
                    const sessionId = path.split('/')[2];
                    if (sessionId) sessionIds.add(sessionId);
                }
            }

            const sessions = [];
            for (const sessionId of sessionIds) {
                const info = await this.getSessionInfo(sessionId);
                if (info) sessions.push(info);
            }

            return sessions.sort((a, b) =>
                new Date(b.startTime).getTime() - new Date(a.startTime).getTime()
            );
        }

        async getSessionInfo(sessionId) {
            const sessionPath = `/sessions/${sessionId}`;
            try {
                const manifestContent = await Storage.getArtifactContent(`${sessionPath}/session.json`);
                if (!manifestContent) return null;
                return JSON.parse(manifestContent);
            } catch (err) {
                logger.warn(`[SessionManager] Failed to get session info for ${sessionId}:`, err);
                return null;
            }
        }

        async archiveSession(sessionId) {
            const sessionPath = `/sessions/${sessionId}`;
            const manifestContent = await Storage.getArtifactContent(`${sessionPath}/session.json`);
            if (!manifestContent) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            const manifest = JSON.parse(manifestContent);
            manifest.status = 'archived';
            manifest.endTime = new Date().toISOString();

            await Storage.setArtifactContent(`${sessionPath}/session.json`, JSON.stringify(manifest, null, 2));
            logger.info(`[SessionManager] Archived session: ${sessionId}`);

            if (this.activeSessionId === sessionId) {
                this.activeSessionId = null;
            }

            return manifest;
        }

        async deleteSession(sessionId) {
            const sessionPath = `/sessions/${sessionId}`;
            const manifest = await this.getSessionInfo(sessionId);

            if (!manifest) {
                throw new Error(`Session not found: ${sessionId}`);
            }

            // Delete all session artifacts
            const artifactMeta = await Storage.getAllArtifactMetadata?.() || globalState.artifactMetadata || {};
            for (const path in artifactMeta) {
                if (path.startsWith(sessionPath)) {
                    await Storage.deleteArtifact(path);
                }
            }

            logger.info(`[SessionManager] Deleted session: ${sessionId}`);

            if (this.activeSessionId === sessionId) {
                this.activeSessionId = null;
            }

            return true;
        }

        async listTurns(sessionId) {
            const info = await this.getSessionInfo(sessionId);
            return info?.turns || [];
        }

        async getTurnStatus(sessionId, turnNumber) {
            const turns = await this.listTurns(sessionId);
            return turns.find(t => t.turn === turnNumber) || null;
        }

        async rewindToTurn(sessionId, turnNumber) {
            const turn = await this.getTurnStatus(sessionId, turnNumber);
            if (!turn) {
                throw new Error(`Turn ${turnNumber} not found in session ${sessionId}`);
            }

            // If turn has a checkpoint, restore it
            if (turn.checkpointId) {
                logger.info(`[SessionManager] Rewinding to turn ${turnNumber} checkpoint: ${turn.checkpointId}`);
                await restoreCheckpoint(turn.checkpointId);

                // Update session manifest to mark later turns as invalidated
                const sessionPath = `/sessions/${sessionId}`;
                const manifestContent = await Storage.getArtifactContent(`${sessionPath}/session.json`);
                const manifest = JSON.parse(manifestContent);

                manifest.turns = manifest.turns.filter(t => t.turn <= turnNumber);
                await Storage.setArtifactContent(`${sessionPath}/session.json`, JSON.stringify(manifest, null, 2));

                logger.info(`[SessionManager] Successfully rewound to turn ${turnNumber}`);
                return true;
            } else {
                throw new Error(`Turn ${turnNumber} has no checkpoint to restore`);
            }
        }
    }

    const sessionManager = new SessionManager();

    // Checkpoint management
    const createCheckpoint = async (description) => {
        const checkpointId = `checkpoint_${Date.now()}`;

        // Deep clone state
        const stateCopy = JSON.parse(JSON.stringify(globalState));

        // Actually fetch and store artifact contents
        const artifactsWithContent = {};
        for (const [path, metadata] of Object.entries(globalState.artifactMetadata || {})) {
            try {
                const content = await Storage.getArtifactContent(path);
                artifactsWithContent[path] = {
                    metadata: { ...metadata },
                    content: content || ''
                };
            } catch (err) {
                logger.warn(`[StateManager] Failed to backup content for ${path}:`, err);
                artifactsWithContent[path] = {
                    metadata: { ...metadata },
                    content: ''
                };
            }
        }

        const checkpoint = {
            id: checkpointId,
            description,
            timestamp: Date.now(),
            state: stateCopy,
            artifacts: artifactsWithContent
        };

        // Store checkpoint in VFS
        await Storage.setArtifactContent(
            `/.checkpoints/${checkpointId}.json`,
            JSON.stringify(checkpoint, null, 2)
        );

        logger.info(`[StateManager] Created checkpoint: ${checkpointId} - ${description}`);
        return checkpoint;
    };

    const restoreCheckpoint = async (checkpointId) => {
        const checkpointPath = `/.checkpoints/${checkpointId}.json`;
        const checkpointContent = await Storage.getArtifactContent(checkpointPath);

        if (!checkpointContent) {
            throw new Error(`Checkpoint not found: ${checkpointId}`);
        }

        const checkpoint = JSON.parse(checkpointContent);

        // Restore state
        globalState = checkpoint.state;

        // Restore all artifact contents from checkpoint
        if (checkpoint.artifacts) {
            for (const [path, data] of Object.entries(checkpoint.artifacts)) {
                try {
                    // Restore the actual content
                    if (data.content !== undefined) {
                        await Storage.setArtifactContent(path, data.content);
                    }
                } catch (err) {
                    logger.error(`[StateManager] Failed to restore ${path}:`, err);
                }
            }
        } else {
            logger.warn(`[StateManager] Checkpoint has no artifact contents - old format?`);
        }

        await saveState();
        logger.info(`[StateManager] Restored checkpoint: ${checkpointId}`);
        return true;
    };

    // Web Component widget - defined inside factory to access closure variables
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

          // Subscribe to events
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
            state: activeSessions.length > 0 ? 'active' : (artifactCount > 0 ? 'idle' : 'idle'),
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
          if (!globalState) {
            this.shadowRoot.innerHTML = '<p>StateManager not initialized</p>';
            return;
          }

          const sessions = await sessionManager.listSessions();
          const activeSessions = sessions.filter(s => s.status === 'active');
          const archivedSessions = sessions.filter(s => s.status === 'archived');

          const formatTime = (isoString) => {
            if (!isoString) return 'N/A';
            const date = new Date(isoString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            const diffHours = Math.floor(diffMins / 60);
            if (diffHours < 24) return `${diffHours}h ago`;
            const diffDays = Math.floor(diffHours / 24);
            return `${diffDays}d ago`;
          };

          const renderSession = (session) => {
            const statusColor = session.status === 'active' ? '#0f0' : '#888';
            const turnCount = session.turns?.length || 0;

            return `
              <div class="session-card" style="background: rgba(255,255,255,0.03); padding: 12px; margin-bottom: 10px; border-radius: 6px; border-left: 3px solid ${statusColor};">
                <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                  <div style="flex: 1;">
                    <div style="font-size: 13px; font-weight: bold; color: #ccc; margin-bottom: 4px;">
                      ${session.id.substring(0, 24)}...
                    </div>
                    <div style="font-size: 11px; color: #888;">
                      ${session.goal.substring(0, 60)}${session.goal.length > 60 ? '...' : ''}
                    </div>
                  </div>
                  <div style="font-size: 11px; color: ${statusColor}; font-weight: bold;">
                    ${session.status.toUpperCase()}
                  </div>
                </div>

                <div style="display: flex; gap: 15px; font-size: 11px; color: #666; margin-bottom: 8px;">
                  <span>🕐 ${formatTime(session.startTime)}</span>
                  <span>☱ ${turnCount} turns</span>
                </div>

                ${turnCount > 0 ? `
                  <details style="margin-top: 8px;">
                    <summary style="cursor: pointer; color: #6496ff; font-size: 11px;">View Turns</summary>
                    <div class="turn-list" style="margin-top: 8px; padding-left: 10px; border-left: 2px solid rgba(100,150,255,0.3);">
                      ${session.turns.map((turn, idx) => `
                        <div class="turn-item" style="padding: 6px; background: rgba(100,150,255,0.05); margin-bottom: 4px; border-radius: 3px; display: flex; justify-content: space-between; align-items: center;">
                          <div style="font-size: 11px;">
                            <span style="color: #6496ff; font-weight: bold;">Turn ${turn.turn}</span>
                            <span style="color: #888; margin-left: 8px;">${turn.status || 'pending'}</span>
                            ${turn.checkpointId ? '<span style="color: #0f0; margin-left: 8px;">✓ Checkpoint</span>' : ''}
                          </div>
                          ${turn.checkpointId ? `
                            <button class="turn-rewind-btn" data-session-id="${session.id}" data-turn="${turn.turn}" style="font-size: 10px; padding: 2px 6px; background: rgba(100,150,255,0.2); border: 1px solid #6496ff; color: #6496ff; border-radius: 3px; cursor: pointer;">
                              ⏮ Rewind
                            </button>
                          ` : ''}
                        </div>
                      `).join('')}
                    </div>
                  </details>
                ` : ''}

                <div style="display: flex; gap: 8px; margin-top: 10px;">
                  ${session.status === 'active' ? `
                    <button class="session-archive-btn" data-session-id="${session.id}" style="font-size: 11px; padding: 4px 10px; background: rgba(255,165,0,0.2); border: 1px solid #ffa500; color: #ffa500; border-radius: 3px; cursor: pointer;">
                      ⛝ Archive
                    </button>
                  ` : ''}
                  <button class="session-delete-btn" data-session-id="${session.id}" style="font-size: 11px; padding: 4px 10px; background: rgba(255,100,100,0.2); border: 1px solid #f66; color: #f66; border-radius: 3px; cursor: pointer;">
                    ⛶ Delete
                  </button>
                </div>
              </div>
            `;
          };

          this.shadowRoot.innerHTML = `
            <style>
              :host {
                display: block;
                font-family: monospace;
              }

              .state-manager-panel {
                padding: 12px;
              }

              h3 {
                margin: 0 0 15px 0;
                color: #0ff;
                font-size: 1.1em;
              }

              h4 {
                color: #0f0;
                margin-bottom: 10px;
                font-size: 1em;
              }

              .stats-grid {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 20px;
              }

              .stat-card {
                padding: 12px;
                border-radius: 6px;
                text-align: center;
              }

              .stat-card.active {
                background: rgba(0,255,0,0.1);
              }

              .stat-card.archived {
                background: rgba(136,136,136,0.1);
              }

              .stat-card.total {
                background: rgba(100,150,255,0.1);
              }

              .stat-label {
                font-size: 11px;
                color: #888;
              }

              .stat-value {
                font-size: 24px;
                font-weight: bold;
                margin-top: 4px;
              }

              .stat-value.active {
                color: #0f0;
              }

              .stat-value.archived {
                color: #888;
              }

              .stat-value.total {
                color: #6496ff;
              }

              .session-card {
                background: rgba(255,255,255,0.03);
                padding: 12px;
                margin-bottom: 10px;
                border-radius: 6px;
                border-left: 3px solid #888;
              }

              .session-card.active {
                border-left-color: #0f0;
              }

              .session-header {
                display: flex;
                justify-content: space-between;
                align-items: start;
                margin-bottom: 8px;
              }

              .session-id {
                font-size: 13px;
                font-weight: bold;
                color: #ccc;
                margin-bottom: 4px;
              }

              .session-goal {
                font-size: 11px;
                color: #888;
              }

              .session-status {
                font-size: 11px;
                font-weight: bold;
              }

              .session-status.active {
                color: #0f0;
              }

              .session-status.archived {
                color: #888;
              }

              .session-meta {
                display: flex;
                gap: 15px;
                font-size: 11px;
                color: #666;
                margin-bottom: 8px;
              }

              details {
                margin-top: 8px;
              }

              summary {
                cursor: pointer;
                color: #6496ff;
                font-size: 11px;
              }

              .turn-list {
                margin-top: 8px;
                padding-left: 10px;
                border-left: 2px solid rgba(100,150,255,0.3);
              }

              .turn-item {
                padding: 6px;
                background: rgba(100,150,255,0.05);
                margin-bottom: 4px;
                border-radius: 3px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                font-size: 11px;
              }

              .turn-number {
                color: #6496ff;
                font-weight: bold;
              }

              .turn-status {
                color: #888;
                margin-left: 8px;
              }

              .turn-checkpoint {
                color: #0f0;
                margin-left: 8px;
              }

              button {
                font-size: 11px;
                padding: 4px 10px;
                border-radius: 3px;
                cursor: pointer;
                font-family: monospace;
              }

              .turn-rewind-btn {
                font-size: 10px;
                padding: 2px 6px;
                background: rgba(100,150,255,0.2);
                border: 1px solid #6496ff;
                color: #6496ff;
              }

              .session-buttons {
                display: flex;
                gap: 8px;
                margin-top: 10px;
              }

              .session-archive-btn {
                background: rgba(255,165,0,0.2);
                border: 1px solid #ffa500;
                color: #ffa500;
              }

              .session-delete-btn {
                background: rgba(255,100,100,0.2);
                border: 1px solid #f66;
                color: #f66;
              }

              .empty-state {
                padding: 20px;
                background: rgba(255,255,255,0.02);
                border-radius: 6px;
                text-align: center;
                color: #666;
                margin-bottom: 20px;
              }

              .archived-summary {
                cursor: pointer;
                color: #888;
                font-size: 13px;
                font-weight: bold;
              }
            </style>

            <div class="state-manager-panel">
              <h3>🗂 Session Manager</h3>

              <div class="stats-grid">
                <div class="stat-card active">
                  <div class="stat-label">Active</div>
                  <div class="stat-value active">${activeSessions.length}</div>
                </div>
                <div class="stat-card archived">
                  <div class="stat-label">Archived</div>
                  <div class="stat-value archived">${archivedSessions.length}</div>
                </div>
                <div class="stat-card total">
                  <div class="stat-label">Total</div>
                  <div class="stat-value total">${sessions.length}</div>
                </div>
              </div>

              ${activeSessions.length > 0 ? `
                <div class="active-sessions">
                  <h4>✓ Active Sessions</h4>
                  ${activeSessions.map(renderSession).join('')}
                </div>
              ` : '<div class="empty-state">No active sessions</div>'}

              ${archivedSessions.length > 0 ? `
                <details style="margin-bottom: 15px;">
                  <summary class="archived-summary">⛝ Archived Sessions (${archivedSessions.length})</summary>
                  <div style="margin-top: 10px;">
                    ${archivedSessions.slice(0, 5).map(renderSession).join('')}
                  </div>
                </details>
              ` : ''}
            </div>
          `;

          // Attach event listeners using Shadow DOM
          this.shadowRoot.querySelectorAll('.turn-rewind-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const sessionId = btn.dataset.sessionId;
              const turnNumber = parseInt(btn.dataset.turn);

              if (confirm(`Rewind session to Turn ${turnNumber}? This will discard all later turns.`)) {
                try {
                  await sessionManager.rewindToTurn(sessionId, turnNumber);
                  const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                  ToastNotifications?.show(`Rewound to Turn ${turnNumber}`, 'success');

                  // Refresh panel
                  this.render();
                } catch (error) {
                  alert(`Failed to rewind: ${error.message}`);
                }
              }
            });
          });

          this.shadowRoot.querySelectorAll('.session-archive-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const sessionId = btn.dataset.sessionId;
              try {
                await sessionManager.archiveSession(sessionId);
                const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                ToastNotifications?.show('Session archived', 'success');

                // Refresh panel
                this.render();
              } catch (error) {
                alert(`Failed to archive: ${error.message}`);
              }
            });
          });

          this.shadowRoot.querySelectorAll('.session-delete-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
              const sessionId = btn.dataset.sessionId;

              if (confirm(`Delete session ${sessionId.substring(0, 12)}...? This cannot be undone.`)) {
                try {
                  await sessionManager.deleteSession(sessionId);
                  const ToastNotifications = window.DIContainer?.resolve('ToastNotifications');
                  ToastNotifications?.show('Session deleted', 'success');

                  // Refresh panel
                  this.render();
                } catch (error) {
                  alert(`Failed to delete: ${error.message}`);
                }
              }
            });
          });
        }
      }

      // Define custom element
      const elementName = 'state-manager-widget';
      if (!customElements.get(elementName)) {
        customElements.define(elementName, StateManagerWidget);
      }

      // Widget interface
      const widget = {
        element: elementName,
        displayName: 'State Manager',
        icon: '🗂',
        category: 'core',
        updateInterval: null
      };

      return {
        init,
        api: {
          getState,
          saveState,
          updateAndSaveState,
          getArtifactMetadata: (path) => globalState.artifactMetadata?.[path] || null,
          getAllArtifactMetadata: async () => globalState.artifactMetadata || {},
          getArtifactContent: Storage.getArtifactContent,
          createArtifact,
          updateArtifact,
          deleteArtifact,
          incrementCycle,
          updateGoal,
          getArtifactHistory: Storage.getArtifactHistory,
          getArtifactDiff: Storage.getArtifactDiff,
          createSession: sessionManager.createSession.bind(sessionManager),
          createTurn: sessionManager.createTurn.bind(sessionManager),
          getActiveSessionId: sessionManager.getActiveSessionId.bind(sessionManager),
          listSessions: sessionManager.listSessions.bind(sessionManager),
          getSessionInfo: sessionManager.getSessionInfo.bind(sessionManager),
          archiveSession: sessionManager.archiveSession.bind(sessionManager),
          deleteSession: sessionManager.deleteSession.bind(sessionManager),
          listTurns: sessionManager.listTurns.bind(sessionManager),
          getTurnStatus: sessionManager.getTurnStatus.bind(sessionManager),
          rewindToTurn: sessionManager.rewindToTurn.bind(sessionManager),
          createCheckpoint,
          restoreCheckpoint,
          sessionManager
        },
        widget
      };
    }
  }
}