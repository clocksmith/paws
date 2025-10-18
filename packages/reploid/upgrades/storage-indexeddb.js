// Standardized Storage Module for REPLOID - Git-Powered VFS

const Storage = {
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

    // isomorphic-git uses a virtual filesystem. We'll use a promisified version of LightningFS.
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

    /**
     * Create directory and all parent directories recursively
     */
    const mkdirRecursive = async (dirPath) => {
        if (!dirPath || dirPath === '/') return;

        try {
            await pfs.stat(dirPath);
            // Directory exists
            return;
        } catch (e) {
            // Directory doesn't exist, create parent first
            const lastSlash = dirPath.lastIndexOf('/');
            const parentDir = lastSlash > 0 ? dirPath.substring(0, lastSlash) : '/';

            if (parentDir !== '/') {
                await mkdirRecursive(parentDir);
            }

            try {
                await pfs.mkdir(dirPath);
                logger.debug(`[Storage-Git] Created directory: ${dirPath}`);
            } catch (mkdirError) {
                // Ignore if directory was created by another call
                if (mkdirError.code !== 'EEXIST') {
                    logger.error(`[Storage-Git] Failed to create directory ${dirPath}:`, mkdirError);
                    throw mkdirError;
                }
            }
        }
    };

    const setArtifactContent = async (path, content) => {
        try {
            // Ensure parent directories exist
            const dir = path.substring(0, path.lastIndexOf('/'));
            if (dir && dir !== '/') {
                await mkdirRecursive(dir);
            }

            await pfs.writeFile(path, content, 'utf8');

            // git.add requires relative path (no leading slash)
            const relativePath = path.startsWith('/') ? path.substring(1) : path;
            await git.add({ fs, dir: '/', filepath: relativePath });

            await _commit(`Agent modified ${path}`);
        } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to write artifact: ${e.message}`);
        }
    };

    const getArtifactContent = async (path) => {
        try {
            return await pfs.readFile(path, 'utf8');
        } catch (e) {
            // Return null if file doesn't exist, which is the expected behavior
            return null;
        }
    };

    const deleteArtifact = async (path) => {
        try {
            // git.remove requires relative path (no leading slash)
            const relativePath = path.startsWith('/') ? path.substring(1) : path;
            await git.remove({ fs, dir: '/', filepath: relativePath });
            await _commit(`Agent deleted ${path}`);
        } catch (e) {
            throw new ArtifactError(`[Storage-Git] Failed to delete artifact: ${e.message}`);
        }
    };

    // State is stored outside of Git for now, as it's not a user-facing artifact.
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

    // New Git-specific functions
    const getArtifactHistory = async (path) => {
        // git.log requires relative path (no leading slash)
        const relativePath = path.startsWith('/') ? path.substring(1) : path;
        return await git.log({ fs, dir: '/', filepath: relativePath });
    };

    const getArtifactDiff = async (path, refA, refB = 'HEAD') => {
        // git.readBlob requires relative path (no leading slash)
        const relativePath = path.startsWith('/') ? path.substring(1) : path;
        const contentA = await git.readBlob({ fs, dir: '/', oid: refA, filepath: relativePath });
        const contentB = await git.readBlob({ fs, dir: '/', oid: refB, filepath: relativePath });
        // This is a simplified diff. A real implementation would use a diff library.
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
        // New Git API
        getArtifactHistory,
        getArtifactDiff
      }
    };
  }
};

export default Storage;