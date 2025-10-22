/**
 * Unit Tests for Goal Panel
 *
 * Blueprint: 0x000066
 * Module: goal-panel.js
 * CLUSTER 2 Phase 7 Implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('GoalPanel Module', () => {
  let GoalPanel;
  let mockEventBus;
  let mockUtils;

  beforeEach(async () => {
    // Mock DOM
    const mockContainer = { innerHTML: '', prepend: vi.fn() };
    global.document = {
      getElementById: vi.fn((id) => id === 'goal-panel-container' ? mockContainer : null),
      createElement: vi.fn(() => ({ id: '', innerHTML: '', className: '', remove: vi.fn() })),
      head: { appendChild: vi.fn() },
      body: { appendChild: vi.fn() }
    };
    global.window = {
      reploidConfig: {
        featureFlags: {
          useModularPanels: {
            GoalPanel: true
          }
        }
      }
    };
    global.localStorage = {
      getItem: vi.fn(),
      setItem: vi.fn()
    };
    global.confirm = vi.fn(() => true);
    global.URL = {
      createObjectURL: vi.fn(() => 'blob:mock-url'),
      revokeObjectURL: vi.fn()
    };
    global.Blob = vi.fn();

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
    const GoalPanelModule = await import('../../upgrades/goal-panel.js');
    GoalPanel = GoalPanelModule.default.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  afterEach(() => {
    if (GoalPanel?.cleanup) {
      GoalPanel.cleanup();
    }

    // Clean up globals
    delete global.document;
    delete global.window;
    delete global.localStorage;
    delete global.confirm;
    delete global.URL;
    delete global.Blob;
    vi.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize successfully with valid container', () => {
      GoalPanel.init('goal-panel-container');

      expect(mockEventBus.on).toHaveBeenCalledWith('goal:set', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.on).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'GoalPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit error event when container not found', () => {
      GoalPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'GoalPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Goal Management', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should set goal via setGoal method', () => {
      GoalPanel.setGoal('Implement new feature');

      expect(GoalPanel.getGoal()).toBe('Implement new feature');
    });

    it('should handle empty goal', () => {
      GoalPanel.setGoal('');

      expect(GoalPanel.getGoal()).toBe('');
    });

    it('should update goal when receiving goal:set event', () => {
      const goalSetHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'goal:set'
      )[1];

      goalSetHandler('New goal from agent');

      expect(GoalPanel.getGoal()).toBe('New goal from agent');
    });

    it('should ignore goal:set when feature flag disabled', () => {
      global.window.reploidConfig.featureFlags.useModularPanels.GoalPanel = false;

      const goalSetHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'goal:set'
      )[1];

      goalSetHandler('Should be ignored');

      expect(GoalPanel.getGoal()).toBe('');
    });

    it('should emit goal:edit-requested on saveEdit', async () => {
      await GoalPanel.saveEdit('Updated goal');

      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:edit-requested', {
        goal: 'Updated goal',
        source: 'GoalPanel',
        timestamp: expect.any(Number)
      });
    });

    it('should emit goal:edit-requested on clearGoal', () => {
      GoalPanel.clearGoal();

      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:edit-requested', {
        goal: '',
        source: 'GoalPanel',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Goal History', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should track goal history', () => {
      GoalPanel.setGoal('Goal 1');
      GoalPanel.setGoal('Goal 2');
      GoalPanel.setGoal('Goal 3');

      const history = GoalPanel.getHistory();
      expect(history).toHaveLength(3);
      expect(history[0].goal).toBe('Goal 1');
      expect(history[1].goal).toBe('Goal 2');
      expect(history[2].goal).toBe('Goal 3');
    });

    it('should not add duplicate consecutive goals to history', () => {
      GoalPanel.setGoal('Same goal');
      GoalPanel.setGoal('Same goal');
      GoalPanel.setGoal('Same goal');

      const history = GoalPanel.getHistory();
      expect(history).toHaveLength(1);
    });

    it('should auto-trim history at MAX_HISTORY limit', () => {
      // Add 60 goals (exceeds limit of 50)
      for (let i = 0; i < 60; i++) {
        GoalPanel.setGoal(`Goal ${i}`);
      }

      const history = GoalPanel.getHistory();
      expect(history).toHaveLength(50);

      // Verify oldest goals were removed
      expect(history[0].goal).toBe('Goal 10');
      expect(history[49].goal).toBe('Goal 59');
    });

    it('should include timestamps in history', () => {
      GoalPanel.setGoal('Test goal');

      const history = GoalPanel.getHistory();
      expect(history[0].timestamp).toBeGreaterThan(0);
    });

    it('should export history as markdown', () => {
      GoalPanel.setGoal('Goal 1');
      GoalPanel.setGoal('Goal 2');

      const markdown = GoalPanel.export();

      expect(markdown).toContain('# Goal History Export');
      expect(markdown).toContain('Total goals: 2');
      expect(markdown).toContain('Goal 1');
      expect(markdown).toContain('Goal 2');
    });

    it('should export empty history', () => {
      const markdown = GoalPanel.export();

      expect(markdown).toContain('Total goals: 0');
    });
  });

  describe('Widget Protocol - getStatus()', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should return no-goal state when empty', () => {
      const status = GoalPanel.getStatus();

      expect(status.state).toBe('no-goal');
      expect(status.primaryMetric).toBe('No goal set');
      expect(status.secondaryMetric).toBe('0 changes');
      expect(status.lastActivity).toBeNull();
      expect(status.message).toBeNull();
    });

    it('should return goal-set state when goal exists', () => {
      GoalPanel.setGoal('Test goal');

      const status = GoalPanel.getStatus();

      expect(status.state).toBe('goal-set');
      expect(status.primaryMetric).toContain('Test goal');
      expect(status.lastActivity).toBeGreaterThan(0);
    });

    it('should return editing state when in edit mode', () => {
      GoalPanel.setGoal('Test goal');
      GoalPanel.editGoal();

      const status = GoalPanel.getStatus();

      expect(status.state).toBe('editing');
      expect(status.message).toBe('Editing goal...');
    });

    it('should truncate long goals in primaryMetric', () => {
      const longGoal = 'A'.repeat(100);
      GoalPanel.setGoal(longGoal);

      const status = GoalPanel.getStatus();

      expect(status.primaryMetric.length).toBeLessThanOrEqual(54); // 50 + '...'
      expect(status.primaryMetric).toContain('...');
    });

    it('should track history count in secondaryMetric', () => {
      GoalPanel.setGoal('Goal 1');
      GoalPanel.setGoal('Goal 2');
      GoalPanel.setGoal('Goal 3');

      const status = GoalPanel.getStatus();

      expect(status.secondaryMetric).toBe('3 changes');
    });
  });

  describe('Widget Protocol - getControls()', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should return 4 controls', () => {
      const controls = GoalPanel.getControls();

      expect(controls).toHaveLength(4);
      expect(controls[0].id).toBe('edit-goal');
      expect(controls[1].id).toBe('clear-goal');
      expect(controls[2].id).toBe('goal-history');
      expect(controls[3].id).toBe('export-history');
    });

    it('should execute edit action successfully', () => {
      const controls = GoalPanel.getControls();
      const editControl = controls.find(c => c.id === 'edit-goal');
      const result = editControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Edit mode enabled');
    });

    it('should execute clear action successfully', () => {
      GoalPanel.setGoal('Test goal');

      const controls = GoalPanel.getControls();
      const clearControl = controls.find(c => c.id === 'clear-goal');
      const result = clearControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toBe('Goal cleared');
      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:edit-requested', expect.objectContaining({
        goal: ''
      }));
    });

    it('should execute history action successfully', () => {
      GoalPanel.setGoal('Goal 1');
      GoalPanel.setGoal('Goal 2');

      const controls = GoalPanel.getControls();
      const historyControl = controls.find(c => c.id === 'goal-history');
      const result = historyControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toBe('2 past goals');
    });

    it('should execute export action successfully', () => {
      GoalPanel.setGoal('Goal 1');

      const controls = GoalPanel.getControls();
      const exportControl = controls.find(c => c.id === 'export-history');
      const result = exportControl.action();

      expect(result.success).toBe(true);
      expect(result.message).toContain('Exported 1 goals');
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should unsubscribe all event listeners on cleanup', () => {
      GoalPanel.cleanup();

      expect(mockEventBus.off).toHaveBeenCalledWith('goal:set', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-show', expect.any(Function));
      expect(mockEventBus.off).toHaveBeenCalledWith('ui:panel-hide', expect.any(Function));
    });
  });

  describe('Communication Contract Compliance', () => {
    it('should emit ui:panel-ready on successful init', () => {
      GoalPanel.init('goal-panel-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-ready', {
        panel: 'GoalPanel',
        mode: 'modular',
        timestamp: expect.any(Number)
      });
    });

    it('should emit ui:panel-error on init failure', () => {
      GoalPanel.init('nonexistent-container');

      expect(mockEventBus.emit).toHaveBeenCalledWith('ui:panel-error', {
        panel: 'GoalPanel',
        error: 'Container not found',
        timestamp: expect.any(Number)
      });
    });

    it('should follow bidirectional data flow pattern', () => {
      GoalPanel.init('goal-panel-container');

      // 1. Receive goal from agent
      const goalSetHandler = mockEventBus.on.mock.calls.find(
        call => call[0] === 'goal:set'
      )[1];
      goalSetHandler('Agent goal');

      expect(GoalPanel.getGoal()).toBe('Agent goal');

      // 2. User edits goal
      GoalPanel.saveEdit('User-edited goal');

      // 3. Should emit edit request
      expect(mockEventBus.emit).toHaveBeenCalledWith('goal:edit-requested', {
        goal: 'User-edited goal',
        source: 'GoalPanel',
        timestamp: expect.any(Number)
      });
    });
  });

  describe('Edge Cases', () => {
    beforeEach(() => {
      GoalPanel.init('goal-panel-container');
    });

    it('should handle very long goals', () => {
      const longGoal = 'A'.repeat(10000);
      GoalPanel.setGoal(longGoal);

      expect(GoalPanel.getGoal()).toHaveLength(10000);
    });

    it('should handle special characters in goals', () => {
      const specialGoal = '<script>alert("XSS")</script>';
      GoalPanel.setGoal(specialGoal);

      expect(mockUtils.escapeHtml).toHaveBeenCalled();
    });

    it('should handle null goal gracefully', () => {
      GoalPanel.setGoal(null);

      expect(GoalPanel.getGoal()).toBe('');
    });

    it('should handle undefined goal gracefully', () => {
      GoalPanel.setGoal(undefined);

      expect(GoalPanel.getGoal()).toBe('');
    });
  });
});
