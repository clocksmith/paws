import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import StorageModule from '../../upgrades/storage-localstorage.js';

describe('Storage Module (storage-localstorage.js)', () => {
  let mockDeps;
  let storage;
  let localStorageMock;

  const createLocalStorageMock = () => {
    const store = new Map();
    return {
      getItem: vi.fn((key) => (store.has(key) ? store.get(key) : null)),
      setItem: vi.fn((key, value) => {
        store.set(key, value);
        return null;
      }),
      removeItem: vi.fn((key) => {
        store.delete(key);
        return null;
      })
    };
  };

  const createModule = () => StorageModule.factory(mockDeps).api;

  beforeEach(() => {
    localStorageMock = createLocalStorageMock();
    global.window = { localStorage: localStorageMock };

    mockDeps = {
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    storage = createModule();
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.window;
  });

  describe('metadata', () => {
    it('should expose correct metadata', () => {
      expect(StorageModule.metadata.id).toBe('Storage');
      expect(StorageModule.metadata.version).toBe('1.0.0');
      expect(StorageModule.metadata.dependencies).toEqual(['Utils']);
      expect(StorageModule.metadata.async).toBe(false);
      expect(StorageModule.metadata.type).toBe('service');
    });
  });

  describe('artifact operations', () => {
    it('stores and retrieves artifacts via localStorage', async () => {
      await storage.setArtifactContent('/docs/test.md', '# hello');

      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'reploid:vfs:artifact:/docs/test.md',
        '# hello'
      );

      const content = await storage.getArtifactContent('/docs/test.md');
      expect(content).toBe('# hello');
      expect(localStorageMock.getItem).toHaveBeenCalledWith('reploid:vfs:artifact:/docs/test.md');
    });

    it('removes artifacts', async () => {
      await storage.setArtifactContent('/foo.txt', 'data');
      await storage.deleteArtifact('/foo.txt');

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('reploid:vfs:artifact:/foo.txt');
    });
  });

  describe('state management', () => {
    it('saves and loads agent state', async () => {
      await storage.saveState(JSON.stringify({ cycles: 3 }));
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'reploid:vfs:state',
        JSON.stringify({ cycles: 3 })
      );

      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify({ cycles: 3 }));
      const loaded = await storage.getState();
      expect(loaded).toEqual(JSON.stringify({ cycles: 3 }));
    });
  });

  describe('history helpers', () => {
    it('returns stub history/diff data', async () => {
      const history = await storage.getArtifactHistory('/foo');
      const diff = await storage.getArtifactDiff('/foo', 'A', 'B');

      expect(history).toEqual([]);
      expect(diff).toEqual({ contentA: null, contentB: null });
    });
  });

  describe('fallback behaviour', () => {
    it('uses in-memory storage when localStorage unavailable', async () => {
      delete global.window;
      const memoryDeps = {
        Utils: mockDeps.Utils
      };
      const memoryStorage = StorageModule.factory(memoryDeps).api;

      await memoryStorage.setArtifactContent('/memory.txt', 'cached');
      const result = await memoryStorage.getArtifactContent('/memory.txt');

      expect(result).toBe('cached');
    });
  });
});
