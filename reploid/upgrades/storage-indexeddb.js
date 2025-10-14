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
            // Return null if file doesn't exist, which is the expected behavior
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
        return await git.log({ fs, dir: '/', filepath: path });
    };

    const getArtifactDiff = async (path, refA, refB = 'HEAD') => {
        const contentA = await git.readBlob({ fs, dir: '/', oid: refA, filepath: path });
        const contentB = await git.readBlob({ fs, dir: '/', oid: refB, filepath: path });
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