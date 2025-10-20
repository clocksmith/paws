import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import GenesisSnapshot from '../../upgrades/genesis-snapshot.js';

describe('GenesisSnapshot', () => {
  let instance;
  let mockDeps;

  beforeEach(() => {
    mockDeps = {
      StateManager: {
        saveArtifact: vi.fn().mockResolvedValue(undefined),
        getArtifactContent: vi.fn().mockResolvedValue('{}'),
        deleteArtifact: vi.fn().mockResolvedValue(undefined),
        getAllArtifacts: vi.fn().mockResolvedValue({})
      },
      EventBus: {
        emit: vi.fn(),
        on: vi.fn(),
        off: vi.fn()
      },
      Utils: {
        logger: {
          info: vi.fn(),
          warn: vi.fn(),
          error: vi.fn()
        }
      }
    };

    instance = GenesisSnapshot.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module API', () => {
    it('should have correct metadata', () => {
      expect(GenesisSnapshot.metadata.id).toBe('GenesisSnapshot');
      expect(GenesisSnapshot.metadata.type).toBe('service');
      expect(GenesisSnapshot.metadata.dependencies).toContain('StateManager');
      expect(GenesisSnapshot.metadata.dependencies).toContain('EventBus');
    });

    it('should return api and widget', () => {
      expect(instance.api).toBeDefined();
      expect(instance.api.saveGenesisSnapshot).toBeDefined();
      expect(instance.api.loadGenesisManifest).toBeDefined();
      expect(instance.api.hasGenesis).toBeDefined();
      expect(instance.widget).toBeDefined();
    });

    it('should save genesis snapshot', async () => {
      const bootData = {
        persona: 'default',
        upgrades: ['utils', 'state-manager'],
        config: { test: true },
        vfs: mockDeps.StateManager,
        timestamp: new Date().toISOString()
      };

      await instance.api.saveGenesisSnapshot(bootData);

      expect(mockDeps.StateManager.saveArtifact).toHaveBeenCalled();
      expect(mockDeps.EventBus.emit).toHaveBeenCalledWith('genesis:snapshot-saved', expect.any(Object));
    });

    it('should check if genesis exists', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        upgrades: []
      }));

      const exists = await instance.api.hasGenesis();

      expect(typeof exists).toBe('boolean');
    });

    it('should load genesis manifest', async () => {
      const mockManifest = {
        timestamp: new Date().toISOString(),
        upgrades: ['utils'],
        persona: 'default'
      };

      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify(mockManifest));

      const manifest = await instance.api.loadGenesisManifest();

      expect(manifest).toBeDefined();
      if (manifest) {
        expect(manifest.timestamp).toBe(mockManifest.timestamp);
      }
    });

    it('should handle missing genesis gracefully', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(new Error('Not found'));

      const exists = await instance.api.hasGenesis();

      expect(exists).toBe(false);
    });
  });

  describe('GenesisSnapshotWidget Web Component', () => {
    let widget;

    beforeEach(() => {
      document.body.innerHTML = '';
      expect(customElements.get('genesis-snapshot-widget')).toBeDefined();
      widget = document.createElement('genesis-snapshot-widget');
    });

    afterEach(() => {
      if (widget.parentNode) {
        widget.parentNode.removeChild(widget);
      }
    });

    it('should create shadow DOM on construction', () => {
      expect(widget.shadowRoot).toBeDefined();
      expect(widget.shadowRoot.mode).toBe('open');
    });

    it('should render when connected', async () => {
      document.body.appendChild(widget);

      // Wait for async render
      await new Promise(resolve => setTimeout(resolve, 50));

      const content = widget.shadowRoot.textContent;
      expect(content).toBeTruthy();
    });

    it('should implement getStatus() correctly', async () => {
      widget.moduleApi = instance.api;

      const status = await widget.getStatus();

      // All 5 required fields
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');
      expect(status).toHaveProperty('message');

      // Validate state value
      const validStates = ['idle', 'active', 'error', 'warning', 'disabled'];
      expect(validStates).toContain(status.state);

      // Validate metric types
      expect(typeof status.primaryMetric).toBe('string');
      expect(typeof status.secondaryMetric).toBe('string');
    });

    it('should show disabled state when no genesis exists', async () => {
      mockDeps.StateManager.getArtifactContent.mockRejectedValue(new Error('Not found'));
      widget.moduleApi = instance.api;

      const status = await widget.getStatus();

      expect(status.state).toBe('disabled');
      expect(status.primaryMetric).toBe('No snapshot');
    });

    it('should show idle state when genesis exists', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        upgrades: ['utils', 'state-manager']
      }));

      widget.moduleApi = instance.api;

      const status = await widget.getStatus();

      expect(status.state).toBe('idle');
      expect(status.primaryMetric).toContain('modules');
    });

    it('should not have auto-refresh interval (manual updates only)', () => {
      widget.moduleApi = instance.api;
      document.body.appendChild(widget);

      expect(widget._interval).toBeUndefined();
    });

    it('should clean up properly on disconnect', () => {
      widget.moduleApi = instance.api;
      document.body.appendChild(widget);

      // Should not throw
      expect(() => {
        document.body.removeChild(widget);
      }).not.toThrow();
    });

    it('should handle async render without errors', async () => {
      mockDeps.StateManager.getArtifactContent.mockResolvedValue(JSON.stringify({
        timestamp: new Date().toISOString(),
        upgrades: []
      }));

      widget.moduleApi = instance.api;
      document.body.appendChild(widget);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(widget.shadowRoot.innerHTML).toBeTruthy();
    });
  });
});
