// Simple Virtual File System - Direct IndexedDB implementation
// Replaces isomorphic-git + LightningFS with a lightweight alternative
// @blueprint 0x000054 (updated for SimpleVFS)

const SimpleVFS = {
  metadata: {
    id: 'SimpleVFS',
    version: '2.0.0',
    dependencies: ['Utils', 'Storage'],
    async: true,
    type: 'service',
    description: 'Lightweight VFS using IndexedDB directly (no git dependencies)'
  },

  factory: (deps) => {
    // Simplified dependencies - just need logger
    const logger = deps.logger || console;

    const DB_NAME = 'reploid-simple-vfs';
    const DB_VERSION = 1;
    let db = null;
    let isInitialized = false;

    // Initialize IndexedDB
    const init = async () => {
      if (isInitialized) return;

      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
          logger.error('[SimpleVFS] Failed to open IndexedDB:', request.error);
          reject(request.error);
        };

        request.onsuccess = () => {
          db = request.result;
          isInitialized = true;
          logger.info('[SimpleVFS] Initialized successfully');
          resolve();
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;

          // Files store: path → {path, content, timestamp, size}
          if (!db.objectStoreNames.contains('files')) {
            const filesStore = db.createObjectStore('files', { keyPath: 'path' });
            filesStore.createIndex('timestamp', 'timestamp', { unique: false });
          }

          // Snapshots store: id → {id, label, timestamp, files}
          if (!db.objectStoreNames.contains('snapshots')) {
            const snapshotsStore = db.createObjectStore('snapshots', { keyPath: 'id', autoIncrement: true });
            snapshotsStore.createIndex('timestamp', 'timestamp', { unique: false });
            snapshotsStore.createIndex('label', 'label', { unique: false });
          }

          logger.info('[SimpleVFS] Database schema created');
        };
      });
    };

    // Read a file
    const readFile = async (path) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(path);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result.content);
          } else {
            reject(new Error(`File not found: ${path}`));
          }
        };

        request.onerror = () => {
          reject(new Error(`Failed to read file: ${path}`));
        };
      });
    };

    // Write a file
    const writeFile = async (path, content) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');

        const fileEntry = {
          path,
          content,
          timestamp: Date.now(),
          size: content.length
        };

        const request = store.put(fileEntry);

        request.onsuccess = () => {
          logger.debug(`[SimpleVFS] Wrote: ${path} (${content.length} bytes)`);
          resolve();
        };

        request.onerror = () => {
          logger.error(`[SimpleVFS] Failed to write: ${path}`, request.error);
          reject(request.error);
        };
      });
    };

    // Delete a file
    const deleteFile = async (path) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        const request = store.delete(path);

        request.onsuccess = () => {
          logger.debug(`[SimpleVFS] Deleted: ${path}`);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // List files in a directory
    const listFiles = async (directory) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAll();

        request.onsuccess = () => {
          const allFiles = request.result || [];
          // Filter files by directory prefix
          const filtered = allFiles
            .filter(file => file.path.startsWith(directory))
            .map(file => file.path);
          resolve(filtered);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // Get all files (for snapshots)
    const getAllFiles = async () => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // Create a snapshot
    const createSnapshot = async (label = null) => {
      if (!isInitialized) await init();

      const allFiles = await getAllFiles();
      const timestamp = Date.now();

      const snapshot = {
        label: label || `Snapshot ${new Date(timestamp).toISOString()}`,
        timestamp,
        files: allFiles.reduce((acc, file) => {
          acc[file.path] = {
            content: file.content,
            size: file.size
          };
          return acc;
        }, {}),
        fileCount: allFiles.length
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['snapshots'], 'readwrite');
        const store = transaction.objectStore('snapshots');
        const request = store.add(snapshot);

        request.onsuccess = () => {
          const snapshotId = request.result;
          logger.info(`[SimpleVFS] Created snapshot #${snapshotId}: ${snapshot.label} (${allFiles.length} files)`);
          resolve({ id: snapshotId, ...snapshot });
        };

        request.onerror = () => {
          logger.error('[SimpleVFS] Failed to create snapshot:', request.error);
          reject(request.error);
        };
      });
    };

    // Restore a snapshot
    const restoreSnapshot = async (snapshotId) => {
      if (!isInitialized) await init();

      // Get snapshot
      const snapshot = await new Promise((resolve, reject) => {
        const transaction = db.transaction(['snapshots'], 'readonly');
        const store = transaction.objectStore('snapshots');
        const request = store.get(snapshotId);

        request.onsuccess = () => {
          if (request.result) {
            resolve(request.result);
          } else {
            reject(new Error(`Snapshot not found: ${snapshotId}`));
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });

      // Clear current files and restore snapshot
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');

      // Clear existing files
      await new Promise((resolve, reject) => {
        const clearRequest = store.clear();
        clearRequest.onsuccess = resolve;
        clearRequest.onerror = () => reject(clearRequest.error);
      });

      // Restore files from snapshot
      const restorePromises = Object.entries(snapshot.files).map(([path, fileData]) => {
        return writeFile(path, fileData.content);
      });

      await Promise.all(restorePromises);

      logger.info(`[SimpleVFS] Restored snapshot #${snapshotId}: ${snapshot.label}`);
      return snapshot;
    };

    // Get all snapshots
    const getSnapshots = async () => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['snapshots'], 'readonly');
        const store = transaction.objectStore('snapshots');
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // Delete a snapshot
    const deleteSnapshot = async (snapshotId) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['snapshots'], 'readwrite');
        const store = transaction.objectStore('snapshots');
        const request = store.delete(snapshotId);

        request.onsuccess = () => {
          logger.info(`[SimpleVFS] Deleted snapshot #${snapshotId}`);
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // Check if file exists
    const fileExists = async (path) => {
      try {
        await readFile(path);
        return true;
      } catch {
        return false;
      }
    };

    // Check if VFS is empty (for Genesis detection)
    const isEmpty = async () => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.count();

        request.onsuccess = () => {
          resolve(request.result === 0);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // Clear all files (factory reset)
    const clear = async () => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files', 'snapshots'], 'readwrite');
        const filesStore = transaction.objectStore('files');
        const snapshotsStore = transaction.objectStore('snapshots');

        const clearFiles = filesStore.clear();
        const clearSnapshots = snapshotsStore.clear();

        transaction.oncomplete = () => {
          logger.info('[SimpleVFS] Cleared all files and snapshots');
          resolve();
        };

        transaction.onerror = () => {
          reject(transaction.error);
        };
      });
    };

    // Get file metadata
    const getFileInfo = async (path) => {
      if (!isInitialized) await init();

      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(path);

        request.onsuccess = () => {
          if (request.result) {
            const { path, timestamp, size } = request.result;
            resolve({ path, timestamp, size });
          } else {
            reject(new Error(`File not found: ${path}`));
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    };

    // API
    return {
      init,
      readFile,
      writeFile,
      deleteFile,
      listFiles,
      getAllFiles,
      fileExists,
      getFileInfo,
      createSnapshot,
      restoreSnapshot,
      getSnapshots,
      deleteSnapshot,
      isEmpty,
      clear,

      // Compatibility aliases for existing code
      read: readFile,
      write: writeFile,
      delete: deleteFile,
      list: listFiles,
      exists: fileExists,
      getInfo: getFileInfo
    };
  }
};

export default SimpleVFS;
