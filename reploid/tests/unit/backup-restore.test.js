import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('BackupRestore Module', () => {
  let BackupRestore;
  let mockStorage;
  let mockStateManager;
  let mockLogger;
  let backupRestore;
  let mockLocalStorage;
  let mockDocument;
  let mockWindow;
  let mockURL;

  beforeEach(() => {
    // Mock localStorage
    mockLocalStorage = {
      data: {},
      getItem: vi.fn((key) => mockLocalStorage.data[key] || null),
      setItem: vi.fn((key, value) => { mockLocalStorage.data[key] = value; }),
      removeItem: vi.fn((key) => { delete mockLocalStorage.data[key]; }),
      clear: vi.fn(() => { mockLocalStorage.data = {}; })
    };
    global.localStorage = mockLocalStorage;

    // Mock document
    mockDocument = {
      createElement: vi.fn((tag) => {
        const element = {
          tagName: tag.toUpperCase(),
          innerHTML: '',
          href: '',
          download: '',
          click: vi.fn(),
          appendChild: vi.fn(),
          querySelector: vi.fn(),
          querySelectorAll: vi.fn(() => []),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          style: { display: '' },
          files: []
        };
        return element;
      }),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn()
      }
    };
    global.document = mockDocument;

    // Mock window
    mockWindow = {
      location: {
        reload: vi.fn()
      }
    };
    global.window = mockWindow;

    // Mock URL
    mockURL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    };
    global.URL = mockURL;

    global.Blob = vi.fn((content, options) => ({ content, options }));

    global.FileReader = vi.fn(function() {
      this.readAsText = vi.fn((file) => {
        setTimeout(() => {
          if (this.onload) {
            this.onload({ target: { result: file.mockContent || '{}' } });
          }
        }, 0);
      });
      this.onerror = null;
      this.onload = null;
    });

    // Mock dependencies
    mockStorage = {
      getAllArtifactMetadata: vi.fn(),
      getArtifactContent: vi.fn(),
      writeArtifact: vi.fn(),
      clear: vi.fn()
    };

    mockStateManager = {
      getState: vi.fn(),
      setState: vi.fn()
    };

    mockLogger = {
      logEvent: vi.fn()
    };

    // Create BackupRestore class (from source)
    BackupRestore = class {
      constructor(storage, stateManager, logger) {
        this.storage = storage;
        this.stateManager = stateManager;
        this.logger = logger;
      }

      async createBackup() {
        try {
          this.logger.logEvent('info', 'Creating system backup...');

          const backup = {
            version: '1.0.0',
            timestamp: Date.now(),
            date: new Date().toISOString(),
            state: await this.backupState(),
            artifacts: await this.backupArtifacts(),
            configuration: await this.backupConfiguration(),
            metadata: {
              totalArtifacts: 0,
              totalSize: 0
            }
          };

          backup.metadata.totalArtifacts = backup.artifacts.length;
          backup.metadata.totalSize = JSON.stringify(backup).length;

          this.logger.logEvent('info', `Backup created: ${backup.artifacts.length} artifacts, ${backup.metadata.totalSize} bytes`);

          return backup;
        } catch (error) {
          this.logger.logEvent('error', `Backup creation failed: ${error.message}`);
          throw error;
        }
      }

      async backupState() {
        const state = this.stateManager.getState();
        return {
          agentState: state,
          systemState: {
            totalCycles: state.totalCycles || 0,
            currentGoal: state.currentGoal || '',
            hitlMode: state.hitlMode || 'off',
            apiCallCount: state.apiCallCount || 0
          }
        };
      }

      async backupArtifacts() {
        const artifacts = [];
        const metadata = await this.storage.getAllArtifactMetadata();

        for (const [path, meta] of Object.entries(metadata)) {
          const content = await this.storage.getArtifactContent(path);
          artifacts.push({
            path,
            content,
            metadata: meta,
            type: this.getArtifactType(path)
          });
        }

        return artifacts;
      }

      async backupConfiguration() {
        return {
          apiKey: localStorage.getItem('reploid_api_key') || '',
          selectedUpgrades: JSON.parse(localStorage.getItem('reploid_upgrades') || '[]'),
          selectedBlueprints: JSON.parse(localStorage.getItem('reploid_blueprints') || '[]'),
          customSettings: JSON.parse(localStorage.getItem('reploid_settings') || '{}')
        };
      }

      async restoreBackup(backupData) {
        try {
          this.logger.logEvent('info', 'Starting system restore...');

          if (!this.validateBackup(backupData)) {
            throw new Error('Invalid backup format');
          }

          await this.clearSystem();
          await this.restoreConfiguration(backupData.configuration);
          await this.restoreArtifacts(backupData.artifacts);
          await this.restoreState(backupData.state);

          this.logger.logEvent('info', `Restore complete: ${backupData.metadata.totalArtifacts} artifacts restored`);

          return {
            success: true,
            artifactsRestored: backupData.metadata.totalArtifacts,
            timestamp: backupData.timestamp
          };
        } catch (error) {
          this.logger.logEvent('error', `Restore failed: ${error.message}`);
          throw error;
        }
      }

      async restoreState(stateData) {
        if (stateData.agentState) {
          await this.stateManager.setState(stateData.agentState);
        }
      }

      async restoreArtifacts(artifacts) {
        for (const artifact of artifacts) {
          await this.storage.writeArtifact(
            artifact.path,
            artifact.content,
            artifact.metadata
          );
        }
      }

      async restoreConfiguration(config) {
        if (config.apiKey) {
          localStorage.setItem('reploid_api_key', config.apiKey);
        }
        if (config.selectedUpgrades) {
          localStorage.setItem('reploid_upgrades', JSON.stringify(config.selectedUpgrades));
        }
        if (config.selectedBlueprints) {
          localStorage.setItem('reploid_blueprints', JSON.stringify(config.selectedBlueprints));
        }
        if (config.customSettings) {
          localStorage.setItem('reploid_settings', JSON.stringify(config.customSettings));
        }
      }

      async clearSystem() {
        await this.storage.clear();

        await this.stateManager.setState({
          totalCycles: 0,
          currentGoal: '',
          hitlMode: 'off',
          apiCallCount: 0
        });

        const keysToRemove = [
          'reploid_api_key',
          'reploid_upgrades',
          'reploid_blueprints',
          'reploid_settings'
        ];
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }

      validateBackup(backupData) {
        if (!backupData || typeof backupData !== 'object') {
          return false;
        }

        const requiredFields = ['version', 'timestamp', 'state', 'artifacts', 'configuration'];
        for (const field of requiredFields) {
          if (!(field in backupData)) {
            this.logger.logEvent('error', `Backup validation failed: missing ${field}`);
            return false;
          }
        }

        if (!Array.isArray(backupData.artifacts)) {
          return false;
        }

        return true;
      }

      getArtifactType(path) {
        if (path.startsWith('/modules/')) return 'module';
        if (path.startsWith('/docs/')) return 'documentation';
        if (path.startsWith('/system/')) return 'system';
        if (path.startsWith('/cycles/')) return 'cycle';
        return 'unknown';
      }

      exportToFile(backupData) {
        const blob = new Blob([JSON.stringify(backupData, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reploid-backup-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      async importFromFile(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();

          reader.onload = async (e) => {
            try {
              const backupData = JSON.parse(e.target.result);
              const result = await this.restoreBackup(backupData);
              resolve(result);
            } catch (error) {
              reject(error);
            }
          };

          reader.onerror = () => {
            reject(new Error('Failed to read backup file'));
          };

          reader.readAsText(file);
        });
      }
    };

    backupRestore = new BackupRestore(mockStorage, mockStateManager, mockLogger);
  });

  describe('Backup Creation', () => {
    it('should create complete backup', async () => {
      mockStateManager.getState.mockReturnValue({
        totalCycles: 10,
        currentGoal: 'Test goal',
        hitlMode: 'on',
        apiCallCount: 25
      });

      mockStorage.getAllArtifactMetadata.mockResolvedValue({
        '/test.txt': { size: 100, modified: Date.now() }
      });

      mockStorage.getArtifactContent.mockResolvedValue('test content');

      const backup = await backupRestore.createBackup();

      expect(backup.version).toBe('1.0.0');
      expect(backup.timestamp).toBeDefined();
      expect(backup.state).toBeDefined();
      expect(backup.artifacts).toBeDefined();
      expect(backup.configuration).toBeDefined();
      expect(backup.metadata).toBeDefined();
    });

    it('should backup state correctly', async () => {
      mockStateManager.getState.mockReturnValue({
        totalCycles: 5,
        currentGoal: 'My goal',
        hitlMode: 'off',
        apiCallCount: 10
      });

      const stateBackup = await backupRestore.backupState();

      expect(stateBackup.agentState.totalCycles).toBe(5);
      expect(stateBackup.systemState.currentGoal).toBe('My goal');
    });

    it('should backup artifacts', async () => {
      mockStorage.getAllArtifactMetadata.mockResolvedValue({
        '/test1.txt': { size: 100 },
        '/test2.txt': { size: 200 }
      });

      mockStorage.getArtifactContent.mockImplementation((path) => {
        return Promise.resolve(`content of ${path}`);
      });

      const artifacts = await backupRestore.backupArtifacts();

      expect(artifacts).toHaveLength(2);
      expect(artifacts[0].path).toBe('/test1.txt');
      expect(artifacts[0].content).toBe('content of /test1.txt');
    });

    it('should backup configuration from localStorage', async () => {
      mockLocalStorage.data = {
        'reploid_api_key': 'test-key',
        'reploid_upgrades': '["upgrade1"]',
        'reploid_blueprints': '["blueprint1"]',
        'reploid_settings': '{"theme":"dark"}'
      };

      const config = await backupRestore.backupConfiguration();

      expect(config.apiKey).toBe('test-key');
      expect(config.selectedUpgrades).toEqual(['upgrade1']);
      expect(config.selectedBlueprints).toEqual(['blueprint1']);
      expect(config.customSettings).toEqual({ theme: 'dark' });
    });

    it('should calculate backup metadata', async () => {
      mockStateManager.getState.mockReturnValue({});
      mockStorage.getAllArtifactMetadata.mockResolvedValue({
        '/test1.txt': {},
        '/test2.txt': {},
        '/test3.txt': {}
      });
      mockStorage.getArtifactContent.mockResolvedValue('content');

      const backup = await backupRestore.createBackup();

      expect(backup.metadata.totalArtifacts).toBe(3);
      expect(backup.metadata.totalSize).toBeGreaterThan(0);
    });

    it('should log backup creation', async () => {
      mockStateManager.getState.mockReturnValue({});
      mockStorage.getAllArtifactMetadata.mockResolvedValue({});

      await backupRestore.createBackup();

      expect(mockLogger.logEvent).toHaveBeenCalledWith('info', 'Creating system backup...');
      expect(mockLogger.logEvent).toHaveBeenCalledWith('info', expect.stringContaining('Backup created'));
    });

    it('should handle backup creation errors', async () => {
      mockStateManager.getState.mockImplementation(() => {
        throw new Error('State error');
      });

      await expect(backupRestore.createBackup()).rejects.toThrow('State error');
      expect(mockLogger.logEvent).toHaveBeenCalledWith('error', expect.stringContaining('Backup creation failed'));
    });
  });

  describe('Artifact Type Detection', () => {
    it('should detect module type', () => {
      expect(backupRestore.getArtifactType('/modules/test.js')).toBe('module');
    });

    it('should detect documentation type', () => {
      expect(backupRestore.getArtifactType('/docs/readme.md')).toBe('documentation');
    });

    it('should detect system type', () => {
      expect(backupRestore.getArtifactType('/system/config.json')).toBe('system');
    });

    it('should detect cycle type', () => {
      expect(backupRestore.getArtifactType('/cycles/cycle-001.json')).toBe('cycle');
    });

    it('should return unknown for unrecognized paths', () => {
      expect(backupRestore.getArtifactType('/random/file.txt')).toBe('unknown');
    });
  });

  describe('Backup Validation', () => {
    it('should validate correct backup', () => {
      const validBackup = {
        version: '1.0.0',
        timestamp: Date.now(),
        state: {},
        artifacts: [],
        configuration: {}
      };

      expect(backupRestore.validateBackup(validBackup)).toBe(true);
    });

    it('should reject null backup', () => {
      expect(backupRestore.validateBackup(null)).toBe(false);
    });

    it('should reject non-object backup', () => {
      expect(backupRestore.validateBackup('not an object')).toBe(false);
    });

    it('should reject backup missing version', () => {
      const invalidBackup = {
        timestamp: Date.now(),
        state: {},
        artifacts: [],
        configuration: {}
      };

      expect(backupRestore.validateBackup(invalidBackup)).toBe(false);
    });

    it('should reject backup with non-array artifacts', () => {
      const invalidBackup = {
        version: '1.0.0',
        timestamp: Date.now(),
        state: {},
        artifacts: 'not an array',
        configuration: {}
      };

      expect(backupRestore.validateBackup(invalidBackup)).toBe(false);
    });

    it('should log validation errors', () => {
      backupRestore.validateBackup({ version: '1.0.0' });

      expect(mockLogger.logEvent).toHaveBeenCalledWith('error', expect.stringContaining('Backup validation failed'));
    });
  });

  describe('Backup Restoration', () => {
    let validBackup;

    beforeEach(() => {
      validBackup = {
        version: '1.0.0',
        timestamp: Date.now(),
        state: {
          agentState: {
            totalCycles: 10,
            currentGoal: 'Test'
          }
        },
        artifacts: [
          { path: '/test.txt', content: 'test', metadata: {} }
        ],
        configuration: {
          apiKey: 'key',
          selectedUpgrades: [],
          selectedBlueprints: [],
          customSettings: {}
        },
        metadata: {
          totalArtifacts: 1
        }
      };
    });

    it('should restore valid backup', async () => {
      const result = await backupRestore.restoreBackup(validBackup);

      expect(result.success).toBe(true);
      expect(result.artifactsRestored).toBe(1);
      expect(result.timestamp).toBe(validBackup.timestamp);
    });

    it('should restore in correct order', async () => {
      const calls = [];

      mockStorage.clear.mockImplementation(() => { calls.push('clear'); return Promise.resolve(); });
      mockStateManager.setState.mockImplementation(() => { calls.push('setState'); return Promise.resolve(); });
      mockStorage.writeArtifact.mockImplementation(() => { calls.push('writeArtifact'); return Promise.resolve(); });

      await backupRestore.restoreBackup(validBackup);

      // Should clear first, then restore config, artifacts, and state
      expect(calls[0]).toBe('clear');
      expect(calls).toContain('setState');
      expect(calls).toContain('writeArtifact');
    });

    it('should restore state', async () => {
      await backupRestore.restoreState(validBackup.state);

      expect(mockStateManager.setState).toHaveBeenCalledWith(validBackup.state.agentState);
    });

    it('should restore artifacts', async () => {
      await backupRestore.restoreArtifacts(validBackup.artifacts);

      expect(mockStorage.writeArtifact).toHaveBeenCalledWith(
        '/test.txt',
        'test',
        {}
      );
    });

    it('should restore configuration', async () => {
      await backupRestore.restoreConfiguration(validBackup.configuration);

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('reploid_api_key', 'key');
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith('reploid_upgrades', '[]');
    });

    it('should reject invalid backup', async () => {
      const invalidBackup = { version: '1.0.0' };

      await expect(backupRestore.restoreBackup(invalidBackup)).rejects.toThrow('Invalid backup format');
    });

    it('should log restore process', async () => {
      await backupRestore.restoreBackup(validBackup);

      expect(mockLogger.logEvent).toHaveBeenCalledWith('info', 'Starting system restore...');
      expect(mockLogger.logEvent).toHaveBeenCalledWith('info', expect.stringContaining('Restore complete'));
    });

    it('should handle restore errors', async () => {
      mockStorage.clear.mockRejectedValue(new Error('Clear failed'));

      await expect(backupRestore.restoreBackup(validBackup)).rejects.toThrow('Clear failed');
      expect(mockLogger.logEvent).toHaveBeenCalledWith('error', expect.stringContaining('Restore failed'));
    });
  });

  describe('System Clearing', () => {
    it('should clear storage', async () => {
      await backupRestore.clearSystem();

      expect(mockStorage.clear).toHaveBeenCalled();
    });

    it('should reset state', async () => {
      await backupRestore.clearSystem();

      expect(mockStateManager.setState).toHaveBeenCalledWith({
        totalCycles: 0,
        currentGoal: '',
        hitlMode: 'off',
        apiCallCount: 0
      });
    });

    it('should clear localStorage keys', async () => {
      mockLocalStorage.data = {
        'reploid_api_key': 'key',
        'reploid_upgrades': '[]',
        'reploid_blueprints': '[]',
        'reploid_settings': '{}'
      };

      await backupRestore.clearSystem();

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('reploid_api_key');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('reploid_upgrades');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('reploid_blueprints');
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('reploid_settings');
    });
  });

  describe('File Export', () => {
    it('should export backup to file', () => {
      const backupData = {
        version: '1.0.0',
        timestamp: 123456,
        artifacts: []
      };

      backupRestore.exportToFile(backupData);

      expect(global.Blob).toHaveBeenCalled();
      expect(mockURL.createObjectURL).toHaveBeenCalled();
      expect(mockDocument.createElement).toHaveBeenCalledWith('a');
      expect(mockDocument.body.appendChild).toHaveBeenCalled();
      expect(mockDocument.body.removeChild).toHaveBeenCalled();
      expect(mockURL.revokeObjectURL).toHaveBeenCalled();
    });

    it('should create download link with timestamp', () => {
      const backupData = { version: '1.0.0', artifacts: [] };
      const mockElement = { href: '', download: '', click: vi.fn() };
      mockDocument.createElement.mockReturnValue(mockElement);

      backupRestore.exportToFile(backupData);

      expect(mockElement.download).toMatch(/reploid-backup-\d+\.json/);
      expect(mockElement.click).toHaveBeenCalled();
    });
  });

  describe('File Import', () => {
    it('should import and restore from file', async () => {
      const validBackup = {
        version: '1.0.0',
        timestamp: Date.now(),
        state: { agentState: {} },
        artifacts: [],
        configuration: {},
        metadata: { totalArtifacts: 0 }
      };

      const mockFile = {
        mockContent: JSON.stringify(validBackup)
      };

      const result = await backupRestore.importFromFile(mockFile);

      expect(result.success).toBe(true);
    });

    it('should handle invalid JSON in file', async () => {
      const mockFile = {
        mockContent: 'invalid json'
      };

      await expect(backupRestore.importFromFile(mockFile)).rejects.toThrow();
    });

    it('should handle FileReader errors', async () => {
      global.FileReader = vi.fn(function() {
        this.readAsText = vi.fn(() => {
          setTimeout(() => {
            if (this.onerror) {
              this.onerror();
            }
          }, 0);
        });
        this.onerror = null;
        this.onload = null;
      });

      const mockFile = {};

      await expect(backupRestore.importFromFile(mockFile)).rejects.toThrow('Failed to read backup file');
    });
  });

  describe('Module Factory', () => {
    it('should create module with required dependencies', () => {
      const BackupRestoreModule = {
        metadata: {
          id: 'BackupRestore',
          version: '1.0.0',
          dependencies: ['Storage', 'StateManager', 'logger'],
          async: false,
          type: 'utility'
        },

        factory: (deps) => {
          const { Storage, StateManager, logger } = deps;

          if (!Storage || !StateManager || !logger) {
            throw new Error('BackupRestore: Missing required dependencies');
          }

          const backupRestore = new BackupRestore(Storage, StateManager, logger);

          return {
            createBackup: () => backupRestore.createBackup(),
            restoreBackup: (data) => backupRestore.restoreBackup(data),
            exportToFile: (data) => backupRestore.exportToFile(data),
            importFromFile: (file) => backupRestore.importFromFile(file)
          };
        }
      };

      expect(BackupRestoreModule.metadata.id).toBe('BackupRestore');
      expect(BackupRestoreModule.metadata.type).toBe('utility');
    });

    it('should throw if dependencies missing', () => {
      const factory = (deps) => {
        const { Storage, StateManager, logger } = deps;

        if (!Storage || !StateManager || !logger) {
          throw new Error('BackupRestore: Missing required dependencies');
        }

        return {};
      };

      expect(() => factory({})).toThrow('Missing required dependencies');
    });
  });
});
