/**
 * @fileoverview Unit tests for HITLController module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load HITLController module
const HITLController = require(resolve(__dirname, '../../upgrades/hitl-controller.js')).default || require(resolve(__dirname, '../../upgrades/hitl-controller.js'));

// Mock dependencies
const mockEventBus = {
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn()
};

const mockUtils = {
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
};

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();
global.localStorage = localStorageMock;

let controller;

describe('HITLController - Module Registration', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    mockEventBus.on.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  it('should register a module with capabilities', () => {
    controller.api.registerModule('TestModule', ['approve_code_changes'], 'Test module');

    const modules = controller.api.getRegisteredModules();
    expect(modules).toHaveLength(1);
    expect(modules[0].id).toBe('TestModule');
    expect(modules[0].capabilities).toContain('approve_code_changes');
  });

  it('should emit registration event', () => {
    controller.api.registerModule('TestModule', ['approve_code_changes']);

    expect(mockEventBus.emit).toHaveBeenCalledWith('hitl:module-registered',
      expect.objectContaining({ moduleId: 'TestModule' })
    );
  });

  it('should handle array or single capability', () => {
    controller.api.registerModule('Module1', 'approve_code_changes');
    controller.api.registerModule('Module2', ['approve_code_changes', 'approve_tool_execution']);

    const modules = controller.api.getRegisteredModules();
    expect(modules[0].capabilities).toHaveLength(1);
    expect(modules[1].capabilities).toHaveLength(2);
  });
});

describe('HITLController - Master Mode', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  it('should default to HITL mode', () => {
    const config = controller.api.getConfig();
    expect(config.masterMode).toBe('hitl');
  });

  it('should switch to autonomous mode', () => {
    controller.api.setMasterMode('autonomous');

    const config = controller.api.getConfig();
    expect(config.masterMode).toBe('autonomous');
  });

  it('should emit mode change event', () => {
    controller.api.setMasterMode('autonomous');

    expect(mockEventBus.emit).toHaveBeenCalledWith('hitl:master-mode-changed',
      expect.objectContaining({
        oldMode: 'hitl',
        newMode: 'autonomous'
      })
    );
  });

  it('should reject invalid modes', () => {
    controller.api.setMasterMode('invalid');

    const config = controller.api.getConfig();
    expect(config.masterMode).toBe('hitl'); // Should remain unchanged
  });

  it('should persist mode to localStorage', () => {
    controller.api.setMasterMode('autonomous');

    const saved = JSON.parse(localStorage.getItem('REPLOID_HITL_CONFIG'));
    expect(saved.masterMode).toBe('autonomous');
  });
});

describe('HITLController - Module Mode Overrides', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
    controller.api.registerModule('TestModule', ['approve_code_changes']);
  });

  it('should inherit master mode by default', () => {
    const mode = controller.api.getModuleMode('TestModule');
    expect(mode).toBe('hitl');
  });

  it('should respect module override', () => {
    controller.api.setModuleMode({ moduleId: 'TestModule', mode: 'autonomous' });

    const mode = controller.api.getModuleMode('TestModule');
    expect(mode).toBe('autonomous');
  });

  it('should allow inherit mode to use master', () => {
    controller.api.setModuleMode({ moduleId: 'TestModule', mode: 'autonomous' });
    controller.api.setModuleMode({ moduleId: 'TestModule', mode: 'inherit' });
    controller.api.setMasterMode('hitl');

    const mode = controller.api.getModuleMode('TestModule');
    expect(mode).toBe('hitl');
  });

  it('should emit module mode change event', () => {
    controller.api.setModuleMode({ moduleId: 'TestModule', mode: 'autonomous' });

    expect(mockEventBus.emit).toHaveBeenCalledWith('hitl:module-mode-changed',
      expect.objectContaining({
        moduleId: 'TestModule',
        newMode: 'autonomous'
      })
    );
  });
});

describe('HITLController - Approval Requirements', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
    controller.api.registerModule('TestModule', ['approve_code_changes', 'approve_tool_execution']);
  });

  it('should require approval in HITL mode for registered capability', () => {
    controller.api.setMasterMode('hitl');

    const required = controller.api.requiresApproval('TestModule', 'approve_code_changes');
    expect(required).toBe(true);
  });

  it('should not require approval in autonomous mode', () => {
    controller.api.setMasterMode('autonomous');

    const required = controller.api.requiresApproval('TestModule', 'approve_code_changes');
    expect(required).toBe(false);
  });

  it('should not require approval for unregistered capability', () => {
    controller.api.setMasterMode('hitl');

    const required = controller.api.requiresApproval('TestModule', 'some_other_capability');
    expect(required).toBe(false);
  });

  it('should default to not requiring approval for unknown modules', () => {
    const required = controller.api.requiresApproval('UnknownModule', 'approve_code_changes');
    expect(required).toBe(false);
  });
});

describe('HITLController - Approval Flow', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
    controller.api.registerModule('TestModule', ['approve_code_changes']);
    controller.api.setMasterMode('hitl');
  });

  it('should add approval to queue', async () => {
    const onApprove = vi.fn();
    const onReject = vi.fn();

    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Modify file.js',
      data: { path: 'file.js' },
      onApprove,
      onReject
    });

    const queue = controller.api.getApprovalQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0].action).toBe('Modify file.js');
  });

  it('should auto-approve in autonomous mode', async () => {
    controller.api.setMasterMode('autonomous');
    const onApprove = vi.fn();

    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Modify file.js',
      data: { path: 'file.js' },
      onApprove
    });

    expect(onApprove).toHaveBeenCalled();
    const queue = controller.api.getApprovalQueue();
    expect(queue).toHaveLength(0);
  });

  it('should handle approval', async () => {
    const onApprove = vi.fn();

    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Modify file.js',
      data: { path: 'file.js' },
      onApprove
    });

    const queue = controller.api.getApprovalQueue();
    const approvalId = queue[0].id;

    controller.api.approve({ approvalId, data: { path: 'file.js' } });

    expect(onApprove).toHaveBeenCalledWith({ path: 'file.js' });
    expect(controller.api.getApprovalQueue()).toHaveLength(0);
  });

  it('should handle rejection', async () => {
    const onReject = vi.fn();

    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Modify file.js',
      onReject
    });

    const queue = controller.api.getApprovalQueue();
    const approvalId = queue[0].id;

    controller.api.reject({ approvalId, reason: 'User declined' });

    expect(onReject).toHaveBeenCalledWith('User declined');
    expect(controller.api.getApprovalQueue()).toHaveLength(0);
  });

  it('should emit approval events', async () => {
    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Modify file.js'
    });

    expect(mockEventBus.emit).toHaveBeenCalledWith('hitl:approval-pending',
      expect.objectContaining({ action: 'Modify file.js' })
    );
  });
});

describe('HITLController - Approval Statistics', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
    controller.api.registerModule('TestModule', ['approve_code_changes']);
    controller.api.setMasterMode('hitl');
  });

  it('should track approval statistics', async () => {
    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Test'
    });

    const queue = controller.api.getApprovalQueue();
    controller.api.approve({ approvalId: queue[0].id });

    const stats = controller.api.getApprovalStats();
    expect(stats.total).toBe(1);
    expect(stats.approved).toBe(1);
    expect(stats.rejected).toBe(0);
  });

  it('should track rejections', async () => {
    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Test'
    });

    const queue = controller.api.getApprovalQueue();
    controller.api.reject({ approvalId: queue[0].id, reason: 'Test rejection' });

    const stats = controller.api.getApprovalStats();
    expect(stats.rejected).toBe(1);
  });

  it('should maintain approval history', async () => {
    await controller.api.requestApproval({
      moduleId: 'TestModule',
      capability: 'approve_code_changes',
      action: 'Test'
    });

    const queue = controller.api.getApprovalQueue();
    controller.api.approve({ approvalId: queue[0].id });

    const stats = controller.api.getApprovalStats();
    expect(stats.history).toHaveLength(1);
    expect(stats.history[0].outcome).toBe('approved');
  });

  it('should limit history to 50 entries', async () => {
    for (let i = 0; i < 60; i++) {
      await controller.api.requestApproval({
        moduleId: 'TestModule',
        capability: 'approve_code_changes',
        action: `Test ${i}`
      });

      const queue = controller.api.getApprovalQueue();
      controller.api.approve({ approvalId: queue[0].id });
    }

    const stats = controller.api.getApprovalStats();
    expect(stats.history.length).toBeLessThanOrEqual(50);
  });
});

describe('HITLController - Configuration', () => {
  beforeEach(() => {
    mockEventBus.emit.mockClear();
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  it('should reset to defaults', () => {
    controller.api.setMasterMode('autonomous');
    controller.api.resetToDefaults();

    const config = controller.api.getConfig();
    expect(config.masterMode).toBe('hitl');
    expect(config.moduleOverrides).toEqual({});
  });

  it('should emit reset event', () => {
    controller.api.resetToDefaults();

    expect(mockEventBus.emit).toHaveBeenCalledWith('hitl:config-reset');
  });

  it('should get complete configuration', () => {
    controller.api.registerModule('TestModule', ['approve_code_changes']);

    const config = controller.api.getConfig();
    expect(config).toHaveProperty('masterMode');
    expect(config).toHaveProperty('moduleOverrides');
    expect(config).toHaveProperty('registeredModules');
    expect(config).toHaveProperty('pendingApprovals');
  });
});

describe('HITLController - Web Component Widget', () => {
  beforeEach(() => {
    localStorageMock.clear();
    controller = HITLController.factory({ EventBus: mockEventBus, Utils: mockUtils });
  });

  it('should export widget configuration', () => {
    expect(controller.widget).toBeDefined();
    expect(controller.widget.element).toBe('hitl-controller-widget');
    expect(controller.widget.displayName).toBe('HITL Controller');
    expect(controller.widget.icon).toBe('⚙');
    expect(controller.widget.category).toBe('core');
  });

  it('should expose HITL capabilities constants', () => {
    expect(controller.api.CAPABILITIES).toBeDefined();
    expect(controller.api.CAPABILITIES.APPROVE_CODE_CHANGES).toBe('approve_code_changes');
    expect(controller.api.CAPABILITIES.APPROVE_TOOL_EXECUTION).toBe('approve_tool_execution');
  });
});
