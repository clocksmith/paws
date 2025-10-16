import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import GitVFS from '../../upgrades/git-vfs.js';

describe('GitVFS Module', () => {
  let mockUtils, mockStorage, mockGit, mockFS, mockPFS, mockDeps;
  let vfsInstance;

  beforeEach(() => {
    // Mock Utils
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
      }
    };

    // Mock Storage
    mockStorage = {
      getArtifactContent: vi.fn(),
      setArtifactContent: vi.fn(),
      deleteArtifact: vi.fn(),
      getArtifactMetadata: vi.fn(),
      getAllArtifactMetadata: vi.fn()
    };

    // Mock promise-based file system
    mockPFS = {
      stat: vi.fn(),
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
      unlink: vi.fn()
    };

    // Mock LightningFS
    mockFS = {
      promises: mockPFS
    };

    // Mock isomorphic-git
    mockGit = {
      init: vi.fn(),
      add: vi.fn(),
      commit: vi.fn(),
      remove: vi.fn(),
      readBlob: vi.fn(),
      log: vi.fn(),
      readCommit: vi.fn(),
      readTree: vi.fn(),
      status: vi.fn(),
      resolveRef: vi.fn(),
      tag: vi.fn(),
      checkout: vi.fn(),
      listTags: vi.fn(),
      currentBranch: vi.fn(),
      statusMatrix: vi.fn()
    };

    // Mock window.git and window.LightningFS
    global.window = {
      git: mockGit,
      LightningFS: vi.fn(() => mockFS)
    };

    mockDeps = {
      Utils: mockUtils,
      Storage: mockStorage
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(GitVFS.metadata.id).toBe('GitVFS');
      expect(GitVFS.metadata.version).toBe('1.0.0');
      expect(GitVFS.metadata.type).toBe('service');
    });

    it('should declare required dependencies', () => {
      expect(GitVFS.metadata.dependencies).toContain('Utils');
      expect(GitVFS.metadata.dependencies).toContain('Storage');
    });

    it('should be asynchronous', () => {
      expect(GitVFS.metadata.async).toBe(true);
    });
  });

  describe('Initialization', () => {
    it('should initialize with existing repository', async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);

      await vfsInstance.init();

      expect(vfsInstance.api.isInitialized()).toBe(true);
      expect(mockGit.init).not.toHaveBeenCalled(); // Repo already exists
      expect(mockUtils.logger.info).toHaveBeenCalledWith('[GitVFS] Initialized successfully');
    });

    it('should initialize new repository if not exists', async () => {
      mockPFS.stat.mockRejectedValue(new Error('Not found'));
      mockGit.init.mockResolvedValue(undefined);
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue('abc123');

      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();

      expect(mockPFS.mkdir).toHaveBeenCalledWith('/reploid-vfs', { recursive: true });
      expect(mockGit.init).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        defaultBranch: 'main'
      });
      expect(mockPFS.writeFile).toHaveBeenCalledWith(
        '/reploid-vfs/README.md',
        expect.stringContaining('# REPLOID VFS')
      );
      expect(mockGit.add).toHaveBeenCalled();
      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: 'Initial commit',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.local' }
      });
    });

    it('should skip re-initialization if already initialized', async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);

      await vfsInstance.init();
      await vfsInstance.init(); // Second call

      expect(mockPFS.stat).toHaveBeenCalledTimes(1);
    });

    it('should fallback gracefully when git libraries not available', async () => {
      delete global.window.git;

      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();

      expect(vfsInstance.api.isInitialized()).toBe(false);
      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        '[GitVFS] Git libraries not available, using fallback storage'
      );
    });

    it('should handle initialization errors', async () => {
      mockPFS.stat.mockRejectedValue(new Error('Stat failed'));
      mockPFS.mkdir.mockRejectedValue(new Error('Mkdir failed'));

      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        '[GitVFS] Initialization failed:',
        expect.any(Error)
      );
    });
  });

  describe('File Operations - Initialized', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should write file successfully', async () => {
      mockGit.add.mockResolvedValue(undefined);

      const result = await vfsInstance.api.writeFile('/test.txt', 'Hello World');

      expect(mockPFS.mkdir).toHaveBeenCalledWith('/reploid-vfs', { recursive: true });
      expect(mockPFS.writeFile).toHaveBeenCalledWith(
        '/reploid-vfs/test.txt',
        'Hello World',
        'utf8'
      );
      expect(mockGit.add).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        filepath: '/test.txt'
      });
      expect(result).toBe(true);
    });

    it('should write file with commit message', async () => {
      mockGit.add.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue('abc123');

      await vfsInstance.api.writeFile('/test.txt', 'Hello', 'Add test file');

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: 'Add test file',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.local' }
      });
    });

    it('should create nested directories when writing files', async () => {
      mockGit.add.mockResolvedValue(undefined);

      await vfsInstance.api.writeFile('/foo/bar/test.txt', 'content');

      expect(mockPFS.mkdir).toHaveBeenCalledWith('/reploid-vfs/foo/bar', { recursive: true });
    });

    it('should handle write errors', async () => {
      mockPFS.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect(vfsInstance.api.writeFile('/test.txt', 'content'))
        .rejects.toThrow('Write failed');

      expect(mockUtils.logger.error).toHaveBeenCalledWith(
        '[GitVFS] Error writing file /test.txt:',
        expect.any(Error)
      );
    });

    it('should read file from HEAD', async () => {
      mockPFS.readFile.mockResolvedValue('File content');

      const content = await vfsInstance.api.readFile('/test.txt');

      expect(mockPFS.readFile).toHaveBeenCalledWith('/reploid-vfs/test.txt', 'utf8');
      expect(content).toBe('File content');
    });

    it('should read file from specific commit', async () => {
      const mockBlob = new TextEncoder().encode('Old content');
      mockGit.readBlob.mockResolvedValue({ blob: mockBlob });

      const content = await vfsInstance.api.readFile('/test.txt', 'abc123');

      expect(mockGit.readBlob).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        oid: 'abc123',
        filepath: '/test.txt'
      });
      expect(content).toBe('Old content');
    });

    it('should return null for non-existent files', async () => {
      mockPFS.readFile.mockRejectedValue(new Error('File not found'));

      const content = await vfsInstance.api.readFile('/missing.txt');

      expect(content).toBeNull();
    });

    it('should delete file successfully', async () => {
      mockGit.remove.mockResolvedValue(undefined);

      const result = await vfsInstance.api.deleteFile('/test.txt');

      expect(mockPFS.unlink).toHaveBeenCalledWith('/reploid-vfs/test.txt');
      expect(mockGit.remove).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        filepath: '/test.txt'
      });
      expect(result).toBe(true);
    });

    it('should delete file with commit message', async () => {
      mockGit.remove.mockResolvedValue(undefined);
      mockGit.commit.mockResolvedValue('def456');

      await vfsInstance.api.deleteFile('/test.txt', 'Remove test file');

      expect(mockGit.commit).toHaveBeenCalled();
    });

    it('should handle delete errors', async () => {
      mockPFS.unlink.mockRejectedValue(new Error('Delete failed'));

      await expect(vfsInstance.api.deleteFile('/test.txt'))
        .rejects.toThrow('Delete failed');
    });
  });

  describe('File Operations - Not Initialized', () => {
    beforeEach(() => {
      delete global.window.git;
      vfsInstance = GitVFS.factory(mockDeps);
    });

    it('should fallback to Storage for write', async () => {
      mockStorage.setArtifactContent.mockResolvedValue(true);

      await vfsInstance.api.writeFile('/test.txt', 'content');

      expect(mockStorage.setArtifactContent).toHaveBeenCalledWith('/test.txt', 'content');
    });

    it('should fallback to Storage for read', async () => {
      mockStorage.getArtifactContent.mockResolvedValue('stored content');

      const content = await vfsInstance.api.readFile('/test.txt');

      expect(mockStorage.getArtifactContent).toHaveBeenCalledWith('/test.txt');
      expect(content).toBe('stored content');
    });

    it('should fallback to Storage for delete', async () => {
      mockStorage.deleteArtifact.mockResolvedValue(true);

      await vfsInstance.api.deleteFile('/test.txt');

      expect(mockStorage.deleteArtifact).toHaveBeenCalledWith('/test.txt');
    });
  });

  describe('Commit Operations', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should commit changes with basic message', async () => {
      mockGit.commit.mockResolvedValue('abc123def456');

      const sha = await vfsInstance.api.commitChanges('Update files');

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: 'Update files',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.local' }
      });
      expect(sha).toBe('abc123def456');
    });

    it('should add checkpoint metadata to commit', async () => {
      mockGit.commit.mockResolvedValue('abc123');

      await vfsInstance.api.commitChanges('Checkpoint', {
        checkpoint: 'CP1',
        session: 'S1',
        turn: 5
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: expect.stringContaining('Checkpoint: CP1'),
        author: { name: 'REPLOID Agent', email: 'agent@reploid.local' }
      });

      const callArg = mockGit.commit.mock.calls[0][0];
      expect(callArg.message).toContain('Session: S1');
      expect(callArg.message).toContain('Turn: 5');
    });

    it('should use custom author if provided', async () => {
      mockGit.commit.mockResolvedValue('abc123');

      await vfsInstance.api.commitChanges('Custom commit', {
        author: { name: 'Test User', email: 'test@example.com' }
      });

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: 'Custom commit',
        author: { name: 'Test User', email: 'test@example.com' }
      });
    });

    it('should handle commit errors', async () => {
      mockGit.commit.mockRejectedValue(new Error('Commit failed'));

      await expect(vfsInstance.api.commitChanges('Failed commit'))
        .rejects.toThrow('Commit failed');
    });

    it('should return null when not initialized', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      const result = await uninitInstance.api.commitChanges('Test');

      expect(result).toBeNull();
    });
  });

  describe('History Operations', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should get file history', async () => {
      const mockCommits = [
        {
          oid: 'commit1',
          commit: {
            message: 'Update file',
            author: { name: 'Alice', timestamp: 1700000000 }
          }
        },
        {
          oid: 'commit2',
          commit: {
            message: 'Initial version',
            author: { name: 'Bob', timestamp: 1699000000 }
          }
        }
      ];

      mockGit.log.mockResolvedValue(mockCommits);

      // Mock getCommitChanges by mocking readCommit and readTree
      mockGit.readCommit.mockImplementation(async ({ oid }) => {
        if (oid === 'commit1') {
          return {
            commit: {
              tree: 'tree1',
              parent: ['commit2']
            }
          };
        }
        if (oid === 'commit2') {
          return {
            commit: {
              tree: 'tree2',
              parent: []
            }
          };
        }
      });

      // Return test.txt in both trees so it's detected as a modified file
      mockGit.readTree.mockImplementation(async ({ oid }) => {
        if (oid === 'tree1') {
          return {
            tree: [
              { type: 'blob', path: '/test.txt', oid: 'blob1' }
            ]
          };
        }
        if (oid === 'tree2') {
          return {
            tree: [
              { type: 'blob', path: '/test.txt', oid: 'blob2' }
            ]
          };
        }
        return { tree: [] };
      });

      const history = await vfsInstance.api.getHistory('/test.txt', 10);

      expect(mockGit.log).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        depth: 10
      });
      expect(history).toHaveLength(2);
      expect(history[0].sha).toBe('commit1');
      expect(history[0].message).toBe('Update file');
      expect(history[0].author).toBe('Alice');
    });

    it('should fallback to storage metadata when not initialized', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      mockStorage.getArtifactMetadata.mockResolvedValue({
        lastModified: 1700000000000
      });

      const history = await uninitInstance.api.getHistory('/test.txt');

      expect(history).toEqual([{
        sha: 'current',
        message: 'Current version',
        timestamp: 1700000000000,
        author: 'REPLOID'
      }]);
    });

    it('should return empty array for files with no metadata', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      mockStorage.getArtifactMetadata.mockResolvedValue(null);

      const history = await uninitInstance.api.getHistory('/test.txt');

      expect(history).toEqual([]);
    });

    it('should handle history errors gracefully', async () => {
      mockGit.log.mockRejectedValue(new Error('Log failed'));

      const history = await vfsInstance.api.getHistory('/test.txt');

      expect(history).toEqual([]);
      expect(mockUtils.logger.error).toHaveBeenCalled();
    });
  });

  describe('Diff Operations', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should get diff between versions', async () => {
      // First readFile call with 'HEAD~1' uses git.readBlob
      mockGit.readBlob.mockResolvedValueOnce({
        blob: new TextEncoder().encode('Line 1\nLine 2\nLine 3')
      });

      // Second readFile call with 'HEAD' uses pfs.readFile
      mockPFS.readFile.mockResolvedValueOnce('Line 1\nLine 2 modified\nLine 3\nLine 4');

      const diff = await vfsInstance.api.getDiff('/test.txt', 'HEAD~1', 'HEAD');

      expect(diff.oldContent).toBe('Line 1\nLine 2\nLine 3');
      expect(diff.newContent).toBe('Line 1\nLine 2 modified\nLine 3\nLine 4');
      expect(diff.changes).toHaveLength(2);
      expect(diff.changes[0]).toEqual({
        type: 'modify',
        line: 2,
        old: 'Line 2',
        new: 'Line 2 modified'
      });
      expect(diff.changes[1]).toEqual({
        type: 'add',
        line: 4,
        content: 'Line 4'
      });
    });

    it('should detect deleted lines', async () => {
      mockGit.readBlob
        .mockResolvedValueOnce({
          blob: new TextEncoder().encode('Line 1\nLine 2\nLine 3')
        })
        .mockResolvedValueOnce({
          blob: new TextEncoder().encode('Line 1\nLine 2')
        });

      const diff = await vfsInstance.api.getDiff('/test.txt', 'abc', 'def');

      expect(diff.changes).toContainEqual({
        type: 'delete',
        line: 3,
        content: 'Line 3'
      });
    });

    it('should return empty diff when not initialized', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      const diff = await uninitInstance.api.getDiff('/test.txt');

      expect(diff).toEqual({
        oldContent: '',
        newContent: '',
        changes: []
      });
    });

    it('should handle diff errors', async () => {
      mockGit.readBlob.mockRejectedValue(new Error('Read failed'));

      const diff = await vfsInstance.api.getDiff('/test.txt');

      expect(diff).toEqual({
        oldContent: '',
        newContent: '',
        changes: []
      });
    });
  });

  describe('Checkpoint Operations', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should create checkpoint with pending changes', async () => {
      mockGit.status.mockResolvedValue('modified');
      mockGit.commit.mockResolvedValue('abc123');
      mockGit.tag.mockResolvedValue(undefined);

      const checkpoint = await vfsInstance.api.createCheckpoint('Before major change');

      expect(mockGit.commit).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        message: 'Checkpoint: Before major change',
        author: { name: 'REPLOID Agent', email: 'agent@reploid.local' }
      });
      expect(mockGit.tag).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        ref: expect.stringMatching(/^checkpoint_\d+$/),
        object: 'abc123'
      });
      expect(checkpoint.sha).toBe('abc123');
      expect(checkpoint.description).toBe('Before major change');
    });

    it('should create checkpoint without pending changes', async () => {
      mockGit.status.mockResolvedValue('unmodified');
      mockGit.resolveRef.mockResolvedValue('def456');
      mockGit.tag.mockResolvedValue(undefined);

      const checkpoint = await vfsInstance.api.createCheckpoint('Clean state');

      expect(mockGit.commit).not.toHaveBeenCalled();
      expect(mockGit.resolveRef).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        ref: 'HEAD'
      });
      expect(mockGit.tag).toHaveBeenCalled();
    });

    it('should fallback to storage-based checkpoint', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      mockStorage.setArtifactContent.mockResolvedValue(true);

      const checkpoint = await uninitInstance.api.createCheckpoint('Test checkpoint');

      expect(mockStorage.setArtifactContent).toHaveBeenCalledWith(
        expect.stringMatching(/^\/.checkpoints\/checkpoint_\d+$/),
        expect.stringContaining('Test checkpoint')
      );
      expect(checkpoint.description).toBe('Test checkpoint');
    });

    it('should handle checkpoint creation errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Status failed'));

      await expect(vfsInstance.api.createCheckpoint('Failed'))
        .rejects.toThrow('Status failed');
    });

    it('should restore checkpoint successfully', async () => {
      mockGit.resolveRef.mockResolvedValue('abc123');
      mockGit.checkout.mockResolvedValue(undefined);

      const result = await vfsInstance.api.restoreCheckpoint('checkpoint_1700000000');

      expect(mockGit.resolveRef).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        ref: 'checkpoint_1700000000'
      });
      expect(mockGit.checkout).toHaveBeenCalledWith({
        fs: mockPFS,
        dir: '/reploid-vfs',
        ref: 'checkpoint_1700000000',
        force: true
      });
      expect(result).toBe(true);
    });

    it('should fail to restore non-existent checkpoint', async () => {
      mockGit.resolveRef.mockRejectedValue(new Error('Not found'));

      await expect(vfsInstance.api.restoreCheckpoint('invalid'))
        .rejects.toThrow('Checkpoint not found: invalid');
    });

    it('should return false when restoring without git', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      const result = await uninitInstance.api.restoreCheckpoint('checkpoint_123');

      expect(result).toBe(false);
      expect(mockUtils.logger.warn).toHaveBeenCalledWith(
        '[GitVFS] Cannot restore checkpoint without Git'
      );
    });

    it('should list checkpoints', async () => {
      mockGit.listTags.mockResolvedValue([
        'v1.0.0',
        'checkpoint_1700000000',
        'checkpoint_1699000000'
      ]);
      mockGit.resolveRef
        .mockResolvedValueOnce('abc123')
        .mockResolvedValueOnce('def456');

      const checkpoints = await vfsInstance.api.listCheckpoints();

      expect(checkpoints).toHaveLength(2);
      expect(checkpoints[0].timestamp).toBeGreaterThan(checkpoints[1].timestamp);
      expect(checkpoints[0].id).toBe('checkpoint_1700000000');
      expect(checkpoints[0].sha).toBe('abc123');
    });

    it('should list fallback checkpoints from storage', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      mockStorage.getAllArtifactMetadata.mockResolvedValue({
        '/.checkpoints/checkpoint_1': { size: 100 },
        '/other/file.txt': { size: 50 }
      });
      mockStorage.getArtifactContent.mockResolvedValue(
        JSON.stringify({ id: 'checkpoint_1', description: 'Test', timestamp: 1700000000 })
      );

      const checkpoints = await uninitInstance.api.listCheckpoints();

      expect(checkpoints).toHaveLength(1);
      expect(checkpoints[0].id).toBe('checkpoint_1');
    });

    it('should handle list checkpoints errors', async () => {
      mockGit.listTags.mockRejectedValue(new Error('List failed'));

      const checkpoints = await vfsInstance.api.listCheckpoints();

      expect(checkpoints).toEqual([]);
    });
  });

  describe('Status Operations', () => {
    beforeEach(async () => {
      mockPFS.stat.mockResolvedValue({});
      vfsInstance = GitVFS.factory(mockDeps);
      await vfsInstance.init();
      vi.clearAllMocks();
    });

    it('should get status with modified files', async () => {
      mockGit.currentBranch.mockResolvedValue('main');
      mockGit.statusMatrix.mockResolvedValue([
        ['file1.txt', 1, 1, 1], // Unmodified
        ['file2.txt', 1, 2, 1], // Modified in working dir
        ['file3.txt', 1, 1, 2]  // Staged
      ]);
      mockGit.listTags.mockResolvedValue([]);

      const status = await vfsInstance.api.getStatus();

      expect(status.initialized).toBe(true);
      expect(status.branch).toBe('main');
      expect(status.modified).toContain('file2.txt');
      expect(status.modified).toContain('file3.txt');
      expect(status.modified).not.toContain('file1.txt');
    });

    it('should return uninitialized status', async () => {
      delete global.window.git;
      const uninitInstance = GitVFS.factory(mockDeps);

      const status = await uninitInstance.api.getStatus();

      expect(status).toEqual({
        initialized: false,
        branch: 'none',
        modified: []
      });
    });

    it('should handle status errors', async () => {
      mockGit.currentBranch.mockRejectedValue(new Error('Branch failed'));

      const status = await vfsInstance.api.getStatus();

      expect(status.initialized).toBe(false);
      expect(status.error).toBe('Branch failed');
    });
  });
});
