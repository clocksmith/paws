import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

import ToastNotifications from '../../upgrades/toast-notifications.js';
describe('ToastNotifications Module', () => {
  let mockDeps;
  let toastInstance;

  beforeEach(() => {
    // Mock DOM
    global.document = {
      createElement: vi.fn((tag) => {
        const el = {
          id: '',
          className: '',
          style: { cssText: '' },
          innerHTML: '',
          appendChild: vi.fn(),
          removeChild: vi.fn(),
          contains: vi.fn(() => true),
          addEventListener: vi.fn()
        };
        return el;
      }),
      body: {
        appendChild: vi.fn()
      }
    };

    mockDeps = {
      Utils: { logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }
    };


    toastInstance = ToastNotifications.factory(mockDeps);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Module Metadata', () => {
    it('should have correct metadata', () => {
      expect(ToastNotifications.metadata.id).toBe('ToastNotifications');
      expect(ToastNotifications.metadata.type).toBe('ui');
      expect(ToastNotifications.metadata.async).toBe(false);
    });
  });

  describe('Initialization', () => {
    it('should initialize container', () => {
      toastInstance.init();
      expect(document.createElement).toHaveBeenCalledWith('div');
      expect(document.body.appendChild).toHaveBeenCalled();
    });

    it('should not reinitialize if already initialized', () => {
      toastInstance.init();
      const callCount = document.createElement.mock.calls.length;
      toastInstance.init();
      expect(document.createElement.mock.calls.length).toBe(callCount);
    });
  });

  describe('Toast Display', () => {
    it('should show info toast', () => {
      const toast = toastInstance.show('Test message', 'info');
      expect(toast).toBeDefined();
    });

    it('should show success toast', () => {
      const toast = toastInstance.success('Success!');
      expect(toast).toBeDefined();
      expect(toast.className).toContain('success');
    });

    it('should show error toast', () => {
      const toast = toastInstance.error('Error!');
      expect(toast).toBeDefined();
      expect(toast.className).toContain('error');
    });

    it('should show warning toast', () => {
      const toast = toastInstance.warning('Warning!');
      expect(toast).toBeDefined();
      expect(toast.className).toContain('warning');
    });

    it('should use default type for invalid type', () => {
      const toast = toastInstance.show('Message', 'invalid_type');
      expect(toast).toBeDefined();
    });
  });

  describe('Toast Management', () => {
    it('should clear all toasts', () => {
      toastInstance.show('Toast 1');
      toastInstance.show('Toast 2');
      toastInstance.clearAll();
      expect(mockDeps.Utils.logger.info).toHaveBeenCalled();
    });
  });
});
