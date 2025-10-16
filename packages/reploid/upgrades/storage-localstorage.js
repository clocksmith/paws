// Lightweight Storage Module using browser localStorage
// Provides a minimal persistence layer for rapid boot configurations

const Storage = {
  metadata: {
    id: 'Storage',
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
        logger.info(`[Storage-LS] Stored artifact: ${path}`);
      } catch (error) {
        logger.error(`[Storage-LS] Failed to store ${path}:`, error);
        throw error;
      }
    };

    const getArtifactContent = async (path) => {
      try {
        const value = storage.getItem(encodeKey(path));
        return value === null ? null : value;
      } catch (error) {
        logger.error(`[Storage-LS] Failed to read ${path}:`, error);
        return null;
      }
    };

    const deleteArtifact = async (path) => {
      try {
        storage.removeItem(encodeKey(path));
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

    return {
      api: {
        setArtifactContent,
        getArtifactContent,
        deleteArtifact,
        saveState,
        getState,
        getArtifactHistory,
        getArtifactDiff
      }
    };
  }
};

export default Storage;
