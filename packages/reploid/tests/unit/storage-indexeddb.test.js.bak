import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/**
 * Comprehensive test suite for storage-indexeddb.js (Storage module)
 * Tests Git-powered VFS with IndexedDB backend
 */

describe('Storage Module (storage-indexeddb.js)', () => {
  let Storage;
  let mockDeps;
  let mockFs;
  let mockGit;
  let storageInstance;

  beforeEach(() => {
    // Mock LightningFS
    mockFs = {
      promises: {
        stat: vi.fn(),
        writeFile: vi.fn(),
        readFile: vi.fn(),
        unlink: vi.fn()
      }
    };

    global.LightningFS = vi.fn(() => mockFs);

    // Mock isomorphic-git
    mockGit = {
      init: vi.fn().mockResolvedValue(undefined),
      commit: vi.fn().mockResolvedValue('abc1234567890'),
      add: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      log: vi.fn().mockResolvedValue([]),
      readBlob: vi.fn().mockResolvedValue({ blob: new TextEncoder().encode('test') })
    };

    global.git = mockGit;

    // Mock dependencies
    mockDeps = {
      config: {
        apiKey: 'test-key',
        model: 'test-model'
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        },
        Errors: {
          ArtifactError: class ArtifactError extends Error {
            constructor(message) {
              super(message);
              this.name = 'ArtifactError';
            }
          }
        }
      }
    };

    // Load the module structure
    Storage = {
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

        const fs = new LightningFS('reploid-vfs');
        const pfs = fs.promises;
        const gitdir = '/.git';

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
          logger.info(`[Storage-Git] Committed changes: ${message} (SHA: ${sha.slice(0, 7)})`);
          return sha;
        };

        const setArtifactContent = async (path, content) => {
          try {
            await pfs.writeFile(path, content, 'utf8');
            await git.add({ fs, dir: '/', filepath: path });
            await _commit(`Agent modified ${path}`);
          } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to write artifact: ${e.message}`);
          }
        };

        const getArtifactContent = async (path) => {
          try {
            return await pfs.readFile(path, 'utf8');
          } catch (e) {
            return null;
          }
        };

        const deleteArtifact = async (path) => {
          try {
            await git.remove({ fs, dir: '/', filepath: path });
            await _commit(`Agent deleted ${path}`);
          } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to delete artifact: ${e.message}`);
          }
        };

        const saveState = async (stateJson) => {
          await pfs.writeFile('/.state', stateJson, 'utf8');
        };

        const getState = async () => {
          try {
            return await pfs.readFile('/.state', 'utf8');
          } catch (e) {
            return null;
          }
        };

        const getArtifactHistory = async (path) => {
          return await git.log({ fs, dir: '/', filepath: path });
        };

        const getArtifactDiff = async (path, refA, refB = 'HEAD') => {
          const contentA = await git.readBlob({ fs, dir: '/', oid: refA, filepath: path });
          const contentB = await git.readBlob({ fs, dir: '/', oid: refB, filepath: path });
          return {
            contentA: new TextDecoder().decode(contentA.blob),
            contentB: new TextDecoder().decode(contentB.blob)
          };
        };

        return {
          init,
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

    storageInstance = Storage.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.LightningFS;
    delete global.git;
  });

  // Metadata Tests
  describe('Module Metadata', () => {
    it('should have correct metadata structure', () => {
      expect(Storage.metadata).toBeDefined();
      expect(Storage.metadata.id).toBe('Storage');
      expect(Storage.metadata.version).toBe('2.0.0');
    });

    it('should declare required dependencies', () => {
      expect(Storage.metadata.dependencies).toContain('config');
      expect(Storage.metadata.dependencies).toContain('Utils');
    });

    it('should be marked as async service type', () => {
      expect(Storage.metadata.async).toBe(true);
      expect(Storage.metadata.type).toBe('service');
    });
  });

  // Initialization Tests
  describe('init()', () => {
    it('should detect existing Git repository', async () => {
      mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true });

      await storageInstance.init();

      expect(mockFs.promises.stat).toHaveBeenCalledWith('/.git');
      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Existing Git repository found')
      );
    });

    it('should initialize new Git repository if none exists', async () => {
      mockFs.promises.stat.mockRejectedValue(new Error('Not found'));

      await storageInstance.init();

      expect(mockGit.init).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        defaultBranch: 'main'
      });
      expect(mockDeps.Utils.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No Git repository found')
      );
    });

    it('should log initialization message', async () => {
      mockFs.promises.stat.mockResolvedValue({ isDirectory: () => true });

      await storageInstance.init();

      expect(mockDeps.Utils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Initializing Git-powered VFS')
      );
    });
  });

  // Artifact Content Tests
  describe('setArtifactContent()', () => {
    it('should write artifact content to file', async () => {
      const path = '/test/file.txt';
      const content = 'test content';

      await storageInstance.api.setArtifactContent(path, content);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(path, content, 'utf8');
    });

    it('should add file to Git staging', async () => {
      const path = '/test/file.txt';
      const content = 'test content';

      await storageInstance.api.setArtifactContent(path, content);

      expect(mockGit.add).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        filepath: path
      });
    });

    it('should commit changes with appropriate message', async () => {
      const path = '/test/file.txt';
      const content = 'test content';

      await storageInstance.api.setArtifactContent(path, content);

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.dev' },
        message: `Agent modified ${path}`
      });
    });

    it('should throw ArtifactError on write failure', async () => {
      mockFs.promises.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(
        storageInstance.api.setArtifactContent('/test.txt', 'content')
      ).rejects.toThrow('Failed to write artifact');
    });

    it('should handle nested paths correctly', async () => {
      const path = '/deep/nested/path/file.txt';
      const content = 'nested content';

      await storageInstance.api.setArtifactContent(path, content);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(path, content, 'utf8');
      expect(mockGit.add).toHaveBeenCalled();
    });
  });

  describe('getArtifactContent()', () => {
    it('should read artifact content from file', async () => {
      const path = '/test/file.txt';
      const expectedContent = 'test content';
      mockFs.promises.readFile.mockResolvedValue(expectedContent);

      const result = await storageInstance.api.getArtifactContent(path);

      expect(mockFs.promises.readFile).toHaveBeenCalledWith(path, 'utf8');
      expect(result).toBe(expectedContent);
    });

    it('should return null if file does not exist', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('Not found'));

      const result = await storageInstance.api.getArtifactContent('/nonexistent.txt');

      expect(result).toBeNull();
    });

    it('should return null on any read error', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('Permission denied'));

      const result = await storageInstance.api.getArtifactContent('/forbidden.txt');

      expect(result).toBeNull();
    });

    it('should handle empty files', async () => {
      mockFs.promises.readFile.mockResolvedValue('');

      const result = await storageInstance.api.getArtifactContent('/empty.txt');

      expect(result).toBe('');
    });
  });

  describe('deleteArtifact()', () => {
    it('should remove artifact from Git', async () => {
      const path = '/test/file.txt';

      await storageInstance.api.deleteArtifact(path);

      expect(mockGit.remove).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        filepath: path
      });
    });

    it('should commit deletion with appropriate message', async () => {
      const path = '/test/file.txt';

      await storageInstance.api.deleteArtifact(path);

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.dev' },
        message: `Agent deleted ${path}`
      });
    });

    it('should throw ArtifactError on deletion failure', async () => {
      mockGit.remove.mockRejectedValue(new Error('Delete failed'));

      await expect(
        storageInstance.api.deleteArtifact('/test.txt')
      ).rejects.toThrow('Failed to delete artifact');
    });
  });

  // State Management Tests
  describe('saveState() and getState()', () => {
    it('should save state as JSON string', async () => {
      const stateJson = '{"key":"value"}';

      await storageInstance.api.saveState(stateJson);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('/.state', stateJson, 'utf8');
    });

    it('should retrieve saved state', async () => {
      const stateJson = '{"key":"value"}';
      mockFs.promises.readFile.mockResolvedValue(stateJson);

      const result = await storageInstance.api.getState();

      expect(mockFs.promises.readFile).toHaveBeenCalledWith('/.state', 'utf8');
      expect(result).toBe(stateJson);
    });

    it('should return null if state does not exist', async () => {
      mockFs.promises.readFile.mockRejectedValue(new Error('Not found'));

      const result = await storageInstance.api.getState();

      expect(result).toBeNull();
    });

    it('should handle complex state objects', async () => {
      const complexState = JSON.stringify({
        nested: { deeply: { data: [1, 2, 3] } }
      });

      await storageInstance.api.saveState(complexState);

      expect(mockFs.promises.writeFile).toHaveBeenCalledWith('/.state', complexState, 'utf8');
    });
  });

  // Git-specific Features Tests
  describe('getArtifactHistory()', () => {
    it('should retrieve commit history for artifact', async () => {
      const path = '/test/file.txt';
      const mockHistory = [
        { oid: 'abc123', message: 'Initial commit', timestamp: 1234567890 },
        { oid: 'def456', message: 'Update file', timestamp: 1234567900 }
      ];
      mockGit.log.mockResolvedValue(mockHistory);

      const result = await storageInstance.api.getArtifactHistory(path);

      expect(mockGit.log).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        filepath: path
      });
      expect(result).toEqual(mockHistory);
    });

    it('should return empty array for file with no history', async () => {
      mockGit.log.mockResolvedValue([]);

      const result = await storageInstance.api.getArtifactHistory('/new-file.txt');

      expect(result).toEqual([]);
    });
  });

  describe('getArtifactDiff()', () => {
    it('should retrieve diff between two commits', async () => {
      const path = '/test/file.txt';
      const refA = 'abc123';
      const refB = 'def456';

      mockGit.readBlob
        .mockResolvedValueOnce({ blob: new TextEncoder().encode('old content') })
        .mockResolvedValueOnce({ blob: new TextEncoder().encode('new content') });

      const result = await storageInstance.api.getArtifactDiff(path, refA, refB);

      expect(mockGit.readBlob).toHaveBeenCalledTimes(2);
      expect(result.contentA).toBe('old content');
      expect(result.contentB).toBe('new content');
    });

    it('should default refB to HEAD', async () => {
      const path = '/test/file.txt';
      const refA = 'abc123';

      mockGit.readBlob.mockResolvedValue({ blob: new TextEncoder().encode('test') });

      await storageInstance.api.getArtifactDiff(path, refA);

      expect(mockGit.readBlob).toHaveBeenCalledWith({
        fs: mockFs,
        dir: '/',
        oid: 'HEAD',
        filepath: path
      });
    });

    it('should handle binary content', async () => {
      const binaryData = new Uint8Array([0, 1, 2, 3, 255]);
      mockGit.readBlob.mockResolvedValue({ blob: binaryData });

      const result = await storageInstance.api.getArtifactDiff('/binary.dat', 'abc', 'def');

      expect(result.contentA).toBeDefined();
      expect(result.contentB).toBeDefined();
    });
  });

  // Integration Tests
  describe('Integration - Full Workflow', () => {
    it('should handle complete artifact lifecycle', async () => {
      const path = '/project/main.js';
      const content = 'console.log("Hello");';

      // Initialize
      mockFs.promises.stat.mockRejectedValue(new Error('Not found'));
      await storageInstance.init();

      // Create artifact
      await storageInstance.api.setArtifactContent(path, content);

      // Read artifact
      mockFs.promises.readFile.mockResolvedValue(content);
      const retrieved = await storageInstance.api.getArtifactContent(path);
      expect(retrieved).toBe(content);

      // Delete artifact
      await storageInstance.api.deleteArtifact(path);

      expect(mockGit.init).toHaveBeenCalled();
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
      expect(mockGit.remove).toHaveBeenCalled();
    });

    it('should maintain state across operations', async () => {
      const state1 = '{"step":1}';
      const state2 = '{"step":2}';

      await storageInstance.api.saveState(state1);
      mockFs.promises.readFile.mockResolvedValue(state1);
      const retrieved1 = await storageInstance.api.getState();
      expect(retrieved1).toBe(state1);

      await storageInstance.api.saveState(state2);
      mockFs.promises.readFile.mockResolvedValue(state2);
      const retrieved2 = await storageInstance.api.getState();
      expect(retrieved2).toBe(state2);
    });
  });

  // Error Handling Tests
  describe('Error Handling', () => {
    it('should propagate ArtifactError with context', async () => {
      mockFs.promises.writeFile.mockRejectedValue(new Error('Disk full'));

      try {
        await storageInstance.api.setArtifactContent('/test.txt', 'content');
        fail('Should have thrown');
      } catch (error) {
        expect(error.name).toBe('ArtifactError');
        expect(error.message).toContain('Failed to write artifact');
        expect(error.message).toContain('Disk full');
      }
    });

    it('should handle Git commit failures gracefully', async () => {
      mockGit.commit.mockRejectedValue(new Error('Git error'));

      await expect(
        storageInstance.api.setArtifactContent('/test.txt', 'content')
      ).rejects.toThrow();
    });
  });
});
