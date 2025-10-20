/**
 * Unit Tests for Thought Panel
 *
 * Blueprint: 0x000065
 * Module: thought-panel.js
 * CLUSTER 2 Phase 6 Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('ThoughtPanel Module', () => {
  let ThoughtPanel;
  let mockEventBus;
  let mockUtils;

  beforeEach(async () => {
    // Mock DOM
    const mockContainer = { innerHTML: '' };
    global.document = {
      getElementById: vi.fn((id) => id === 'thought-panel-container' ? mockContainer : null),
      createElement: vi.fn(() => ({ id: '', innerHTML: '' })),
      head: { appendChild: vi.fn() }
    };
    global.window = {
      reploidConfig: {
        featureFlags: {
          useModularPanels: {
            ThoughtPanel: true
          }
        }
      }
    };

    // Mock EventBus
    mockEventBus = {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn()
    };

    // Mock Utils
    mockUtils = {
      logger: {
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        warn: vi.fn()
      },
      escapeHtml: vi.fn((text) => text ? text.replace(/</g, '&lt;').replace(/>/g, '&gt;') : '')
    };

    // Import module
    const ThoughtPanelModule = await import('../../upgrades/thought-panel.js');
    ThoughtPanel = ThoughtPanelModule.default.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  afterEach(() => {
    if (ThoughtPanel?.cleanup) {
      ThoughtPanel.cleanup();
    }

    // Clean up globals
    delete global.document;
    delete global.window;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid container', () => {
      ThoughtPanel.init('thought-panel-container');

      expect(mockEventBus.on).toHaveBeenCalledWith('agent:thought', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'ThoughtPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit error event when container not found', () => {
      ThoughtPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'ThoughtPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Thought Streaming', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should append thought chunk when received', () => {
      ThoughtPanel.appendThought('I need to analyze the code...');

      const thoughts = ThoughtPanel.getThoughts();
      expect(thoughts).toHaveLength(1);
      expect(thoughts[0].text).toBe('I need to analyze the code...');
      expect(thoughts[0].timestamp).toBeGreaterThan(0);
    });

    it('should append multiple thought chunks', () => {
      ThoughtPanel.appendThought('First thought');
      ThoughtPanel.appendThought('Second thought');
      ThoughtPanel.appendThought('Third thought');

      const thoughts = ThoughtPanel.getThoughts();
      expect(thoughts).toHaveLength(3);
      expect(thoughts[0].text).toBe('First thought');
      expect(thoughts[1].text).toBe('Second thought');
      expect(thoughts[2].text).toBe('Third thought');
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should auto-trim thoughts when exceeding MAX_THOUGHTS', () => {
      // Add 1050 thoughts (exceeds limit of 1000)
      for (let i = 0; i < 1050; i++) {
        ThoughtPanel.appendThought(`Thought ${i}`);
      }

      const thoughts = ThoughtPanel.getThoughts();
      expect(thoughts).toHaveLength(1000);

      // Verify oldest thoughts were removed
      expect(thoughts[0].text).toBe('Thought 50');  // First 50 trimmed
      expect(thoughts[999].text).toBe('Thought 1049');
    });
  });

  describe('Widget Protocol - getStatus()', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should return idle state when no thoughts', () => {
      const status = ThoughtPanel.getStatus();

      expect(status.state).toBe('idle');
      expect(status.primaryMetric).toBe('0 thoughts');
      expect(status.secondaryMetric).toBe('Active');
      expect(status.lastActivity).toBeNull();
      expect(status.message).toBeNull();
    });

    it('should return streaming state when thoughts present', () => {
      ThoughtPanel.appendThought('Test thought');

      const status = ThoughtPanel.getStatus();

      expect(status.state).toBe('streaming');
      expect(status.primaryMetric).toBe('1 thoughts');
      expect(status.lastActivity).toBeGreaterThan(0);
    });

    it('should show memory limit message when at max', () => {
      for (let i = 0; i < 1000; i++) {
        ThoughtPanel.appendThought(`Thought ${i}`);
      }

      const status = ThoughtPanel.getStatus();

      expect(status.message).toBe('Memory limit reached');
    });
  });

  describe('Widget Protocol - getControls()', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should return 3 controls', () => {
      const controls = ThoughtPanel.getControls();

      expect(controls).toHaveLength(3);
      expect(controls[0].id).toBe('clear-thoughts');
      expect(controls[1].id).toBe('export-thoughts');
      expect(controls[2].id).toBe('pause-thoughts');
    });

    it('should execute clear action successfully', () => {
      ThoughtPanel.appendThought('Test thought');

      const controls = ThoughtPanel.getControls();
      const clearControl = controls.find(c => c.id === 'clear-thoughts');
      const result = clearControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Thoughts cleared');
      expect(ThoughtPanel.getThoughts()).toHaveLength(0);
    });
  });

  describe('Export Functionality', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should export thoughts as markdown', () => {
      ThoughtPanel.appendThought('First thought');
      ThoughtPanel.appendThought('Second thought');

      const markdown = ThoughtPanel.export();

      expect(markdown).toContain('# Agent Thoughts Export');
      expect(markdown).toContain('Total thoughts: 2');
      expect(markdown).toContain('First thought');
      expect(markdown).toContain('Second thought');
    });

    it('should export empty state', () => {
      const markdown = ThoughtPanel.export();

      expect(markdown).toContain('Total thoughts: 0');
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      ThoughtPanel.init('thought-panel-container');
    });

    it('should unsubscribe all event listeners on cleanup', () => {
      ThoughtPanel.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('agent:thought', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
    });
  });

  describe('Communication Contract Compliance', () => {
    it('should emit ui:panel-ready on successful init', () => {
      ThoughtPanel.init('thought-panel-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'ThoughtPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit ui:panel-error on init failure', () => {
      ThoughtPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'ThoughtPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });
  });
});
