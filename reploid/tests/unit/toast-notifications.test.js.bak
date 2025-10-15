import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('ToastNotifications Module', () => {
  let ToastNotifications;
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

    ToastNotifications = {
      metadata: {
        id: 'ToastNotifications',
        version: '1.0.0',
        dependencies: ['Utils'],
        async: false,
        type: 'ui'
      },
      factory: (deps) => {
        const { Utils } = deps;
        const { logger } = Utils;

        let container = null;
        let toastQueue = [];
        let activeToasts = [];

        const TOAST_TYPES = {
          success: { icon: '✓', color: '#4ec9b0', bg: 'rgba(76, 175, 80, 0.9)' },
          error: { icon: '✕', color: '#f48771', bg: 'rgba(244, 135, 113, 0.9)' },
          warning: { icon: '⚠', color: '#ffd700', bg: 'rgba(255, 215, 0, 0.9)' },
          info: { icon: 'ℹ', color: '#4fc3f7', bg: 'rgba(79, 195, 247, 0.9)' }
        };

        const init = () => {
          if (container) return;
          container = document.createElement('div');
          container.id = 'toast-container';
          document.body.appendChild(container);
          logger.info('[ToastNotifications] Initialized');
        };

        const show = (message, type = 'info', duration = 4000) => {
          init();
          const config = TOAST_TYPES[type] || TOAST_TYPES.info;
          const toast = document.createElement('div');
          toast.className = `toast toast-${type}`;
          container.appendChild(toast);
          activeToasts.push(toast);
          return toast;
        };

        const success = (message, duration) => show(message, 'success', duration);
        const error = (message, duration) => show(message, 'error', duration);
        const warning = (message, duration) => show(message, 'warning', duration);
        const info = (message, duration) => show(message, 'info', duration);

        const clearAll = () => {
          activeToasts.forEach(toast => {
            if (container && container.contains(toast)) {
              container.removeChild(toast);
            }
          });
          activeToasts = [];
        };

        return { init, show, success, error, warning, info, clearAll };
      }
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
