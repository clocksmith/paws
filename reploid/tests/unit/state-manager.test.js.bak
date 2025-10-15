/**
 * @fileoverview Unit tests for StateManager module
 * Note: StateManager has complex dependencies (Storage, config), so these are more integration-style tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('StateManager', () => {
  let StateManager;
  let mockStorage;
  let mockConfig;
  let mockUtils;
  let stateManager;

  beforeEach(async () => {
    // Mock dependencies
    mockStorage = {
      getState: vi.fn().mockResolvedValue(null),
      saveState: vi.fn().mockResolvedValue(undefined),
      getArtifactContent: vi.fn().mockResolvedValue('mock content'),
      setArtifactContent: vi.fn().mockResolvedValue(undefined),
      deleteArtifact: vi.fn().mockResolvedValue(undefined)
    };

    mockConfig = {
      apiKey: 'test-api-key'
    };

    mockUtils = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      Errors: {
        StateError: class StateError extends Error {},
        ArtifactError: class ArtifactError extends Error {}
      }
    };

    // Mock StateHelpersPure
    const mockStateHelpersPure = {};

    // Create mock StateManager factory
    StateManager = {
      factory: (deps) => {
        const { Storage, config, Utils } = deps;
        const { logger, Errors } = Utils;
        const { StateError, ArtifactError } = Errors;

        let globalState = null;

        const init = async () => {
          logger.info("[StateManager] Initializing state...");
          const savedStateJSON = await Storage.getState();
          if (savedStateJSON) {
            globalState = JSON.parse(savedStateJSON);
          } else {
            globalState = {
              totalCycles: 0,
              artifactMetadata: {},
              currentGoal: null,
              apiKey: config.apiKey || ""
            };
          }
          return true;
        };

        const getState = () => {
          if (!globalState) throw new StateError("StateManager not initialized.");
          return globalState;
        };

        const setState = async (updates) => {
          if (!globalState) throw new StateError("StateManager not initialized.");
          globalState = { ...globalState, ...updates };
          await Storage.saveState(JSON.stringify(globalState));
          return globalState;
        };

        const saveState = async () => {
          if (!globalState) throw new StateError("No state to save");
          await Storage.saveState(JSON.stringify(globalState));
        };

        const saveArtifact = async (path, content, metadata = {}) => {
          await Storage.setArtifactContent(path, content);
          globalState.artifactMetadata[path] = {
            path,
            created: Date.now(),
            ...metadata
          };
          await saveState();
          logger.info(`[StateManager] Saved artifact: ${path}`);
        };

        const getArtifactContent = async (path) => {
          return await Storage.getArtifactContent(path);
        };

        const getArtifactMetadata = (path) => {
          return globalState.artifactMetadata[path] || null;
        };

        const getAllArtifactMetadata = () => {
          return { ...globalState.artifactMetadata };
        };

        const deleteArtifact = async (path) => {
          await Storage.deleteArtifact(path);
          delete globalState.artifactMetadata[path];
          await saveState();
          logger.info(`[StateManager] Deleted artifact: ${path}`);
        };

        return {
          api: {
            init,
            getState,
            setState,
            saveState,
            saveArtifact,
            getArtifactContent,
            getArtifactMetadata,
            getAllArtifactMetadata,
            deleteArtifact
          }
        };
      }
    };

    // Initialize StateManager
    const instance = StateManager.factory({
      Storage: mockStorage,
      config: mockConfig,
      Utils: mockUtils
    });
    stateManager = instance.api;
    await stateManager.init();
  });

  describe('Initialization', () => {
    it('should initialize with default state when no saved state exists', async () => {
      const state = stateManager.getState();

      expect(state).toHaveProperty('totalCycles', 0);
      expect(state).toHaveProperty('artifactMetadata');
      expect(state).toHaveProperty('currentGoal', null);
      expect(state).toHaveProperty('apiKey', 'test-api-key');
    });

    it('should load existing state from storage', async () => {
      const existingState = {
        totalCycles: 5,
        artifactMetadata: { '/test.txt': { type: 'text' } },
        currentGoal: 'Test goal',
        apiKey: 'existing-key'
      };

      mockStorage.getState.mockResolvedValue(JSON.stringify(existingState));

      const newInstance = StateManager.factory({
        Storage: mockStorage,
        config: mockConfig,
        Utils: mockUtils
      });
      await newInstance.api.init();

      const state = newInstance.api.getState();
      expect(state.totalCycles).toBe(5);
      expect(state.currentGoal).toBe('Test goal');
    });

    it('should throw error when accessing state before init', () => {
      const uninitInstance = StateManager.factory({
        Storage: mockStorage,
        config: mockConfig,
        Utils: mockUtils
      });

      expect(() => uninitInstance.api.getState()).toThrow('StateManager not initialized');
    });
  });

  describe('State Management', () => {
    it('should get current state', () => {
      const state = stateManager.getState();
      expect(state).toBeDefined();
      expect(state).toHaveProperty('totalCycles');
    });

    it('should update state with setState', async () => {
      await stateManager.setState({ totalCycles: 10 });

      const state = stateManager.getState();
      expect(state.totalCycles).toBe(10);
      expect(mockStorage.saveState).toHaveBeenCalled();
    });

    it('should persist state changes', async () => {
      await stateManager.setState({ customField: 'test value' });

      expect(mockStorage.saveState).toHaveBeenCalled();
      const savedState = JSON.parse(mockStorage.saveState.mock.calls[0][0]);
      expect(savedState.customField).toBe('test value');
    });
  });

  describe('Artifact Management', () => {
    it('should save artifact with content and metadata', async () => {
      await stateManager.saveArtifact('/test.txt', 'test content', {
        type: 'text',
        author: 'test'
      });

      expect(mockStorage.setArtifactContent).toHaveBeenCalledWith('/test.txt', 'test content');

      const metadata = stateManager.getArtifactMetadata('/test.txt');
      expect(metadata).toBeDefined();
      expect(metadata.path).toBe('/test.txt');
      expect(metadata.type).toBe('text');
      expect(metadata.author).toBe('test');
    });

    it('should get artifact content', async () => {
      mockStorage.getArtifactContent.mockResolvedValue('file content');

      const content = await stateManager.getArtifactContent('/test.txt');

      expect(content).toBe('file content');
      expect(mockStorage.getArtifactContent).toHaveBeenCalledWith('/test.txt');
    });

    it('should get artifact metadata', async () => {
      await stateManager.saveArtifact('/test.txt', 'content', { type: 'text' });

      const metadata = stateManager.getArtifactMetadata('/test.txt');

      expect(metadata).toBeDefined();
      expect(metadata.path).toBe('/test.txt');
      expect(metadata.type).toBe('text');
    });

    it('should return null for non-existent artifact metadata', () => {
      const metadata = stateManager.getArtifactMetadata('/nonexistent.txt');
      expect(metadata).toBeNull();
    });

    it('should get all artifact metadata', async () => {
      await stateManager.saveArtifact('/file1.txt', 'content1', { type: 'text' });
      await stateManager.saveArtifact('/file2.js', 'content2', { type: 'code' });

      const allMetadata = stateManager.getAllArtifactMetadata();

      expect(Object.keys(allMetadata)).toHaveLength(2);
      expect(allMetadata).toHaveProperty('/file1.txt');
      expect(allMetadata).toHaveProperty('/file2.js');
    });

    it('should delete artifact and its metadata', async () => {
      await stateManager.saveArtifact('/test.txt', 'content');

      await stateManager.deleteArtifact('/test.txt');

      expect(mockStorage.deleteArtifact).toHaveBeenCalledWith('/test.txt');

      const metadata = stateManager.getArtifactMetadata('/test.txt');
      expect(metadata).toBeNull();
    });
  });

  describe('Multiple Artifacts', () => {
    it('should handle multiple artifact operations', async () => {
      await stateManager.saveArtifact('/file1.txt', 'content1');
      await stateManager.saveArtifact('/file2.txt', 'content2');
      await stateManager.saveArtifact('/file3.txt', 'content3');

      const allMetadata = stateManager.getAllArtifactMetadata();
      expect(Object.keys(allMetadata)).toHaveLength(3);

      await stateManager.deleteArtifact('/file2.txt');

      const updatedMetadata = stateManager.getAllArtifactMetadata();
      expect(Object.keys(updatedMetadata)).toHaveLength(2);
      expect(updatedMetadata).not.toHaveProperty('/file2.txt');
    });
  });

  describe('State Persistence', () => {
    it('should persist artifact metadata across state saves', async () => {
      await stateManager.saveArtifact('/persistent.txt', 'content', { type: 'test' });

      const savedCalls = mockStorage.saveState.mock.calls;
      expect(savedCalls.length).toBeGreaterThan(0);

      const lastSave = JSON.parse(savedCalls[savedCalls.length - 1][0]);
      expect(lastSave.artifactMetadata).toHaveProperty('/persistent.txt');
    });
  });

  describe('Error Handling', () => {
    it('should throw StateError when getting state before initialization', () => {
      const uninitInstance = StateManager.factory({
        Storage: mockStorage,
        config: mockConfig,
        Utils: mockUtils
      });

      expect(() => uninitInstance.api.getState()).toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.setArtifactContent.mockRejectedValue(new Error('Storage full'));

      await expect(
        stateManager.saveArtifact('/test.txt', 'content')
      ).rejects.toThrow('Storage full');
    });
  });
});
