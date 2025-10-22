/**
 * Unit tests for Config Module
 * Tests configuration loading, validation, and Web Component widget
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Config from '../../upgrades/config.js';

describe('Config Module', () => {
  let instance;
  let mockUtils;

  beforeEach(() => {
    // Mock dependencies
    mockUtils = {
      logger: {
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn()
      },
      ConfigError: class extends Error {
        constructor(message) {
          super(message);
          this.name = 'ConfigError';
        }
      }
    };

    // Mock global fetch for config loading
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          personas: [],
          minimalRSICore: [],
          defaultCore: [],
          upgrades: [],
          blueprints: [],
          providers: { default: 'anthropic' },
          curatorMode: {},
          webrtc: {},
          structuredCycle: {}
        })
      })
    );
  });

  afterEach(() => {
    vi.clearAllMocks();
    delete global.fetch;
  });

  describe('Module API', () => {
    beforeEach(() => {
      instance = Config.factory({ Utils: mockUtils });
    });

    it('should provide init() method', () => {
      expect(instance.api).toHaveProperty('init');
      expect(typeof instance.api.init).toBe('function');
    });

    it('should provide get() method', () => {
      expect(instance.api).toHaveProperty('get');
      expect(typeof instance.api.get).toBe('function');
    });

    it('should provide getMetadata() method', () => {
      expect(instance.api).toHaveProperty('getMetadata');
      expect(typeof instance.api.getMetadata).toBe('function');
    });

    it('should initialize and load config', async () => {
      await instance.api.init();

      expect(global.fetch).toHaveBeenCalledWith('config.json');
      expect(mockUtils.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Config loaded successfully')
      );
    });

    it('should validate config structure', async () => {
      const invalidConfig = {
        personas: 'not-an-array' // Should be array
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(invalidConfig)
        })
      );

      await expect(instance.api.init()).rejects.toThrow();
    });

    it('should get config value by path', async () => {
      const mockConfig = {
        personas: [],
        providers: {
          default: 'anthropic',
          anthropic: { model: 'claude-3-sonnet-20240229' }
        },
        minimalRSICore: [],
        defaultCore: [],
        upgrades: [],
        blueprints: [],
        curatorMode: {},
        webrtc: {},
        structuredCycle: {}
      };

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockConfig)
        })
      );

      await instance.api.init();

      const defaultProvider = instance.api.get('providers.default');
      expect(defaultProvider).toBe('anthropic');
    });
  });

  describe('ConfigWidget Web Component', () => {
    let widget;
    let mockApi;

    beforeEach(() => {
      // Reset DOM
      document.body.innerHTML = '';

      // Create instance
      instance = Config.factory({ Utils: mockUtils });

      // Verify custom element is defined
      expect(customElements.get('config-widget')).toBeDefined();

      // Create widget
      widget = document.createElement('config-widget');

      // Mock API
      mockApi = {
        getMetadata: vi.fn(() => ({
          loaded: true,
          loadTime: Date.now(),
          personaCount: 3,
          upgradeCount: 42,
          blueprintCount: 35
        })),
        get: vi.fn(),
        reload: vi.fn(() => Promise.resolve())
      };
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

    it('should render loading state without API', () => {
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Configuration');
    });

    it('should render content when API injected', () => {
      widget.moduleApi = mockApi;
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('Configuration');
      expect(content).toContain('3'); // persona count
      expect(content).toContain('42'); // upgrade count
    });

    it('should implement getStatus() correctly', () => {
      widget.moduleApi = mockApi;

      const status = widget.getStatus();

      // All 5 required fields
      expect(status).toHaveProperty('state');
      expect(status).toHaveProperty('primaryMetric');
      expect(status).toHaveProperty('secondaryMetric');
      expect(status).toHaveProperty('lastActivity');

      // Validate state value
      const validStates = ['idle', 'active', 'error', 'warning', 'disabled'];
      expect(validStates).toContain(status.state);

      // Validate metric types
      expect(typeof status.primaryMetric).toBe('string');
      expect(typeof status.secondaryMetric).toBe('string');
    });

    it('should show loaded state when config is loaded', () => {
      mockApi.getMetadata.mockReturnValue({
        loaded: true,
        loadTime: Date.now(),
        personaCount: 3,
        upgradeCount: 42,
        blueprintCount: 35
      });

      widget.moduleApi = mockApi;

      const status = widget.getStatus();
      expect(status.state).toBe('active');
      expect(status.primaryMetric).toContain('Loaded');
    });

    it('should show warning state when config not loaded', () => {
      mockApi.getMetadata.mockReturnValue({
        loaded: false,
        loadTime: null,
        personaCount: 0,
        upgradeCount: 0,
        blueprintCount: 0
      });

      widget.moduleApi = mockApi;

      const status = widget.getStatus();
      expect(status.state).toBe('warning');
      expect(status.primaryMetric).toContain('Not loaded');
    });

    it('should clean up interval on disconnect', () => {
      widget.moduleApi = mockApi;
      document.body.appendChild(widget);

      expect(widget._interval).toBeDefined();

      document.body.removeChild(widget);

      expect(widget._interval).toBeUndefined();
    });

    it('should auto-refresh with update interval', async () => {
      vi.useFakeTimers();

      widget.moduleApi = mockApi;
      document.body.appendChild(widget);

      // Initial call
      const initialCalls = mockApi.getMetadata.mock.calls.length;

      // Wait for auto-refresh (5000ms interval)
      vi.advanceTimersByTime(5100);

      // Should have been called again
      expect(mockApi.getMetadata.mock.calls.length).toBeGreaterThan(initialCalls);

      vi.useRealTimers();
    });

    it('should display config metadata', () => {
      mockApi.getMetadata.mockReturnValue({
        loaded: true,
        loadTime: Date.now(),
        personaCount: 5,
        upgradeCount: 100,
        blueprintCount: 50
      });

      widget.moduleApi = mockApi;
      document.body.appendChild(widget);

      const content = widget.shadowRoot.textContent;
      expect(content).toContain('5'); // personas
      expect(content).toContain('100'); // upgrades
      expect(content).toContain('50'); // blueprints
    });

    it('should update when moduleApi changes', () => {
      const initialApi = {
        getMetadata: vi.fn(() => ({
          loaded: true,
          loadTime: Date.now(),
          personaCount: 1,
          upgradeCount: 10,
          blueprintCount: 10
        }))
      };

      widget.moduleApi = initialApi;
      document.body.appendChild(widget);

      const firstContent = widget.shadowRoot.textContent;
      expect(firstContent).toContain('10');

      // Update API
      const newApi = {
        getMetadata: vi.fn(() => ({
          loaded: true,
          loadTime: Date.now(),
          personaCount: 2,
          upgradeCount: 20,
          blueprintCount: 20
        }))
      };

      widget.moduleApi = newApi;

      const updatedContent = widget.shadowRoot.textContent;
      expect(updatedContent).toContain('20');
    });
  });
});
