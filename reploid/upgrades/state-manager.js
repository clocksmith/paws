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
            const turn = {
                turn: turnNumber,
                cats_path: `${sessionPath}/turn-${turnNumber}.cats.md`,
                dogs_path: `${sessionPath}/turn-${turnNumber}.dogs.md`,
                status: 'pending_context'
            };
            manifest.turns.push(turn);

            await Storage.setArtifactContent(`${sessionPath}/session.json`, JSON.stringify(manifest, null, 2));
            logger.info(`[SessionManager] Created turn ${turnNumber} for session ${sessionId}`);
            return turn;
        }

        getActiveSessionId() {
            return this.activeSessionId;
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
        // Exposing new Git capabilities
        getArtifactHistory: Storage.getArtifactHistory,
        getArtifactDiff: Storage.getArtifactDiff,
        // Exposing new Session capabilities
        createSession: sessionManager.createSession.bind(sessionManager),
        createTurn: sessionManager.createTurn.bind(sessionManager),
        getActiveSessionId: sessionManager.getActiveSessionId.bind(sessionManager),
        // Checkpoint capabilities
        createCheckpoint,
        restoreCheckpoint,
        sessionManager
      }
    };
  }
};

// Export standardized module
StateManager;