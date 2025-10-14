// Git-based Virtual File System for REPLOID
// Provides version control, history, and rollback capabilities

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

    // Initialize the Git VFS
    const init = async () => {
      if (isInitialized) return;

      try {
        // Check if isomorphic-git and LightningFS are available
        if (typeof window !== 'undefined' && window.git && window.LightningFS) {
          git = window.git;
          fs = new window.LightningFS('reploid-git-vfs');
          pfs = fs.promises;

          // Initialize git repository if not exists
          const exists = await checkRepoExists();
          if (!exists) {
            await initializeRepository();
          }

          isInitialized = true;
          logger.info('[GitVFS] Initialized successfully');
        } else {
          logger.warn('[GitVFS] Git libraries not available, using fallback storage');
        }
      } catch (error) {
        logger.error('[GitVFS] Initialization failed:', error);
      }
    };

    // Check if repository exists
    const checkRepoExists = async () => {
      try {
        await pfs.stat(`${REPO_DIR}/.git`);
        return true;
      } catch {
        return false;
      }
    };

    // Initialize a new repository
    const initializeRepository = async () => {
      logger.info('[GitVFS] Initializing new repository');

      // Create repository directory
      await pfs.mkdir(REPO_DIR, { recursive: true });

      // Initialize git
      await git.init({
        fs: pfs,
        dir: REPO_DIR,
        defaultBranch: 'main'
      });

      // Create initial commit
      await pfs.writeFile(`${REPO_DIR}/README.md`,
        '# REPLOID VFS\n\nGit-backed virtual file system for REPLOID agent.');

      await git.add({
        fs: pfs,
        dir: REPO_DIR,
        filepath: 'README.md'
      });

      await git.commit({
        fs: pfs,
        dir: REPO_DIR,
        message: 'Initial commit',
        author: DEFAULT_AUTHOR
      });

      logger.info('[GitVFS] Repository initialized');
    };

    // Write a file and commit changes
    const writeFile = async (path, content, message) => {
      if (!isInitialized) {
        // Fallback to regular storage
        return Storage.setArtifactContent(path, content);
      }

      const fullPath = `${REPO_DIR}${path}`;
      const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));

      try {
        // Ensure directory exists
        await pfs.mkdir(dir, { recursive: true });

        // Write file
        await pfs.writeFile(fullPath, content, 'utf8');

        // Stage the file
        await git.add({
          fs: pfs,
          dir: REPO_DIR,
          filepath: path
        });

        // Commit if message provided
        if (message) {
          await commitChanges(message, { path });
        }

        logger.debug(`[GitVFS] Wrote file: ${path}`);
        return true;

      } catch (error) {
        logger.error(`[GitVFS] Error writing file ${path}:`, error);
        throw error;
      }
    };

    // Read a file at a specific version
    const readFile = async (path, ref = 'HEAD') => {
      if (!isInitialized) {
        // Fallback to regular storage
        return Storage.getArtifactContent(path);
      }

      try {
        if (ref === 'HEAD' || !ref) {
          // Read from working directory
          const content = await pfs.readFile(`${REPO_DIR}${path}`, 'utf8');
          return content;
        } else {
          // Read from specific commit
          const { blob } = await git.readBlob({
            fs: pfs,
            dir: REPO_DIR,
            oid: ref,
            filepath: path
          });
          return new TextDecoder().decode(blob);
        }
      } catch (error) {
        logger.debug(`[GitVFS] File not found: ${path} at ${ref}`);
        return null;
      }
    };

    // Delete a file and commit
    const deleteFile = async (path, message) => {
      if (!isInitialized) {
        return Storage.deleteArtifact(path);
      }

      try {
        // Remove file from filesystem
        await pfs.unlink(`${REPO_DIR}${path}`);

        // Stage deletion
        await git.remove({
          fs: pfs,
          dir: REPO_DIR,
          filepath: path
        });

        // Commit if message provided
        if (message) {
          await commitChanges(message, { path, operation: 'delete' });
        }

        logger.debug(`[GitVFS] Deleted file: ${path}`);
        return true;

      } catch (error) {
        logger.error(`[GitVFS] Error deleting file ${path}:`, error);
        throw error;
      }
    };

    // Commit staged changes
    const commitChanges = async (message, metadata = {}) => {
      if (!isInitialized) return null;

      try {
        // Add metadata to commit message
        let fullMessage = message;
        if (metadata.checkpoint) {
          fullMessage += `\n\nCheckpoint: ${metadata.checkpoint}`;
        }
        if (metadata.session) {
          fullMessage += `\nSession: ${metadata.session}`;
        }
        if (metadata.turn) {
          fullMessage += `\nTurn: ${metadata.turn}`;
        }

        const sha = await git.commit({
          fs: pfs,
          dir: REPO_DIR,
          message: fullMessage,
          author: metadata.author || DEFAULT_AUTHOR
        });

        logger.info(`[GitVFS] Committed: ${sha.substring(0, 7)} - ${message}`);
        return sha;

      } catch (error) {
        logger.error('[GitVFS] Commit failed:', error);
        throw error;
      }
    };

    // Get file history
    const getHistory = async (path, limit = 10) => {
      if (!isInitialized) {
        // Return basic history from storage metadata
        const meta = await Storage.getArtifactMetadata(path);
        if (!meta) return [];
        return [{
          sha: 'current',
          message: 'Current version',
          timestamp: meta.lastModified,
          author: 'REPLOID'
        }];
      }

      try {
        const commits = await git.log({
          fs: pfs,
          dir: REPO_DIR,
          depth: limit
        });

        // Filter commits that affected this file
        const history = [];
        for (const commit of commits) {
          const changes = await getCommitChanges(commit.oid);
          if (changes.some(c => c.path === path)) {
            history.push({
              sha: commit.oid,
              message: commit.commit.message,
              timestamp: commit.commit.author.timestamp * 1000,
              author: commit.commit.author.name
            });
          }
        }

        return history;

      } catch (error) {
        logger.error(`[GitVFS] Error getting history for ${path}:`, error);
        return [];
      }
    };

    // Get changes in a commit
    const getCommitChanges = async (sha) => {
      if (!isInitialized) return [];

      try {
        // Get the commit object
        const commit = await git.readCommit({ fs: pfs, dir: REPO_DIR, oid: sha });
        const tree = commit.commit.tree;

        // Get parent commit for comparison
        const parents = commit.commit.parent;
        if (parents.length === 0) {
          // Initial commit - all files are additions
          const allFiles = await getAllFilesInTree(tree);
          return allFiles.map(path => ({ type: 'add', path }));
        }

        // Compare with first parent (for simplicity)
        const parentCommit = await git.readCommit({ fs: pfs, dir: REPO_DIR, oid: parents[0] });
        const parentTree = parentCommit.commit.tree;

        // Get file lists from both trees
        const oldFiles = await getTreeFiles(parentTree);
        const newFiles = await getTreeFiles(tree);

        const changes = [];

        // Find added and modified files
        for (const [path, newOid] of Object.entries(newFiles)) {
          if (!oldFiles[path]) {
            changes.push({ type: 'add', path });
          } else if (oldFiles[path] !== newOid) {
            changes.push({ type: 'modify', path });
          }
        }

        // Find deleted files
        for (const path of Object.keys(oldFiles)) {
          if (!newFiles[path]) {
            changes.push({ type: 'delete', path });
          }
        }

        return changes;
      } catch (error) {
        logger.error(`[GitVFS] Error getting commit changes:`, error);
        return [];
      }
    };

    // Helper: Get all files in a tree (for initial commit)
    const getAllFilesInTree = async (treeOid, prefix = '') => {
      const files = [];
      try {
        const { tree } = await git.readTree({ fs: pfs, dir: REPO_DIR, oid: treeOid });

        for (const entry of tree) {
          const fullPath = prefix + entry.path;
          if (entry.type === 'blob') {
            files.push(fullPath);
          } else if (entry.type === 'tree') {
            const subFiles = await getAllFilesInTree(entry.oid, fullPath + '/');
            files.push(...subFiles);
          }
        }
      } catch (error) {
        logger.error(`[GitVFS] Error reading tree:`, error);
      }
      return files;
    };

    // Helper: Get all files with their OIDs from a tree
    const getTreeFiles = async (treeOid, prefix = '') => {
      const files = {};
      try {
        const { tree } = await git.readTree({ fs: pfs, dir: REPO_DIR, oid: treeOid });

        for (const entry of tree) {
          const fullPath = prefix + entry.path;
          if (entry.type === 'blob') {
            files[fullPath] = entry.oid;
          } else if (entry.type === 'tree') {
            const subFiles = await getTreeFiles(entry.oid, fullPath + '/');
            Object.assign(files, subFiles);
          }
        }
      } catch (error) {
        logger.error(`[GitVFS] Error reading tree:`, error);
      }
      return files;
    };

    // Get diff between two versions
    const getDiff = async (path, refA = 'HEAD~1', refB = 'HEAD') => {
      if (!isInitialized) {
        return { oldContent: '', newContent: '', changes: [] };
      }

      try {
        const contentA = await readFile(path, refA);
        const contentB = await readFile(path, refB);

        // Simple line-based diff
        const linesA = (contentA || '').split('\n');
        const linesB = (contentB || '').split('\n');

        const changes = [];
        const maxLines = Math.max(linesA.length, linesB.length);

        for (let i = 0; i < maxLines; i++) {
          const lineA = linesA[i] || '';
          const lineB = linesB[i] || '';

          if (lineA !== lineB) {
            if (i >= linesA.length) {
              changes.push({ type: 'add', line: i + 1, content: lineB });
            } else if (i >= linesB.length) {
              changes.push({ type: 'delete', line: i + 1, content: lineA });
            } else {
              changes.push({ type: 'modify', line: i + 1, old: lineA, new: lineB });
            }
          }
        }

        return {
          oldContent: contentA || '',
          newContent: contentB || '',
          changes
        };

      } catch (error) {
        logger.error(`[GitVFS] Error getting diff for ${path}:`, error);
        return { oldContent: '', newContent: '', changes: [] };
      }
    };

    // Create a checkpoint (tagged commit)
    const createCheckpoint = async (description) => {
      if (!isInitialized) {
        // Fallback checkpoint using storage
        const id = `checkpoint_${Date.now()}`;
        await Storage.setArtifactContent(`/.checkpoints/${id}`, JSON.stringify({
          id,
          description,
          timestamp: Date.now()
        }));
        return { id, description };
      }

      try {
        // Commit any pending changes
        const status = await git.status({
          fs: pfs,
          dir: REPO_DIR,
          filepath: '.'
        });

        let sha;
        if (status !== 'unmodified') {
          sha = await commitChanges(`Checkpoint: ${description}`);
        } else {
          // Get current HEAD
          sha = await git.resolveRef({
            fs: pfs,
            dir: REPO_DIR,
            ref: 'HEAD'
          });
        }

        // Create a tag for easy reference
        const tagName = `checkpoint_${Date.now()}`;
        await git.tag({
          fs: pfs,
          dir: REPO_DIR,
          ref: tagName,
          object: sha
        });

        logger.info(`[GitVFS] Created checkpoint: ${tagName} at ${sha.substring(0, 7)}`);
        return { id: tagName, sha, description };

      } catch (error) {
        logger.error('[GitVFS] Error creating checkpoint:', error);
        throw error;
      }
    };

    // Restore to a checkpoint
    const restoreCheckpoint = async (checkpointId) => {
      if (!isInitialized) {
        logger.warn('[GitVFS] Cannot restore checkpoint without Git');
        return false;
      }

      try {
        // Check if checkpoint exists
        const ref = await git.resolveRef({
          fs: pfs,
          dir: REPO_DIR,
          ref: checkpointId
        }).catch(() => null);

        if (!ref) {
          throw new Error(`Checkpoint not found: ${checkpointId}`);
        }

        // Reset to checkpoint
        await git.checkout({
          fs: pfs,
          dir: REPO_DIR,
          ref: checkpointId,
          force: true
        });

        logger.info(`[GitVFS] Restored to checkpoint: ${checkpointId}`);
        return true;

      } catch (error) {
        logger.error(`[GitVFS] Error restoring checkpoint ${checkpointId}:`, error);
        throw error;
      }
    };

    // List all checkpoints
    const listCheckpoints = async () => {
      if (!isInitialized) {
        // List fallback checkpoints
        const checkpoints = [];
        const allMeta = await Storage.getAllArtifactMetadata();
        for (const path in allMeta) {
          if (path.startsWith('/.checkpoints/')) {
            const content = await Storage.getArtifactContent(path);
            if (content) {
              checkpoints.push(JSON.parse(content));
            }
          }
        }
        return checkpoints;
      }

      try {
        const tags = await git.listTags({
          fs: pfs,
          dir: REPO_DIR
        });

        const checkpoints = [];
        for (const tag of tags) {
          if (tag.startsWith('checkpoint_')) {
            const sha = await git.resolveRef({
              fs: pfs,
              dir: REPO_DIR,
              ref: tag
            });

            checkpoints.push({
              id: tag,
              sha: sha.substring(0, 7),
              timestamp: parseInt(tag.split('_')[1])
            });
          }
        }

        return checkpoints.sort((a, b) => b.timestamp - a.timestamp);

      } catch (error) {
        logger.error('[GitVFS] Error listing checkpoints:', error);
        return [];
      }
    };

    // Get current status
    const getStatus = async () => {
      if (!isInitialized) {
        return { initialized: false, branch: 'none', modified: [] };
      }

      try {
        const branch = await git.currentBranch({
          fs: pfs,
          dir: REPO_DIR
        });

        const statusMatrix = await git.statusMatrix({
          fs: pfs,
          dir: REPO_DIR
        });

        const modified = statusMatrix
          .filter(([file, head, work, stage]) => head !== work || work !== stage)
          .map(([file]) => file);

        return {
          initialized: true,
          branch,
          modified,
          checkpoints: await listCheckpoints()
        };

      } catch (error) {
        logger.error('[GitVFS] Error getting status:', error);
        return { initialized: false, error: error.message };
      }
    };

    return {
      init,
      api: {
        writeFile,
        readFile,
        deleteFile,
        commitChanges,
        getHistory,
        getDiff,
        createCheckpoint,
        restoreCheckpoint,
        listCheckpoints,
        getStatus,
        isInitialized: () => isInitialized
      }
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(GitVFS);
}

export default GitVFS;