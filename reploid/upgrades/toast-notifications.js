// Toast Notification System - Non-blocking user feedback
// Replaces alert() calls with elegant toast notifications

const ToastNotifications = {
  metadata: {
    id: 'ToastNotifications',
    version: '1.0.0',
    description: 'Non-blocking toast notification system for user feedback',
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

    // Toast types
    const TOAST_TYPES = {
      success: { icon: '✓', color: '#4ec9b0', bg: 'rgba(76, 175, 80, 0.9)' },
      error: { icon: '✕', color: '#f48771', bg: 'rgba(244, 135, 113, 0.9)' },
      warning: { icon: '⚠', color: '#ffd700', bg: 'rgba(255, 215, 0, 0.9)' },
      info: { icon: 'ℹ', color: '#4fc3f7', bg: 'rgba(79, 195, 247, 0.9)' }
    };

    // Initialize toast container
    const init = () => {
      if (container) return;

      container = document.createElement('div');
      container.id = 'toast-container';
      container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10001;
        display: flex;
        flex-direction: column;
        gap: 12px;
        pointer-events: none;
      `;
      document.body.appendChild(container);
      logger.info('[ToastNotifications] Initialized');
    };

    // Show toast notification
    const show = (message, type = 'info', duration = 4000) => {
      init(); // Ensure container exists

      const config = TOAST_TYPES[type] || TOAST_TYPES.info;

      // Create toast element
      const toast = document.createElement('div');
      toast.className = `toast toast-${type}`;
      toast.style.cssText = `
        background: ${config.bg};
        color: white;
        padding: 12px 16px;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        display: flex;
        align-items: center;
        gap: 12px;
        min-width: 280px;
        max-width: 400px;
        font-size: 14px;
        opacity: 0;
        transform: translateX(400px);
        transition: all 0.3s ease-out;
        pointer-events: auto;
        cursor: pointer;
        border-left: 4px solid ${config.color};
      `;

      toast.innerHTML = `
        <span style="font-size: 18px; font-weight: bold;">${config.icon}</span>
        <span style="flex: 1;">${message}</span>
        <span style="font-size: 12px; color: rgba(255, 255, 255, 0.7); cursor: pointer;">✕</span>
      `;

      // Add to container
      container.appendChild(toast);
      activeToasts.push(toast);

      // Animate in
      setTimeout(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(0)';
      }, 10);

      // Auto-remove after duration
      const removeToast = () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(400px)';
        setTimeout(() => {
          if (container && container.contains(toast)) {
            container.removeChild(toast);
          }
          activeToasts = activeToasts.filter(t => t !== toast);
        }, 300);
      };

      // Click to dismiss
      toast.addEventListener('click', removeToast);

      // Auto-dismiss
      if (duration > 0) {
        setTimeout(removeToast, duration);
      }

      return toast;
    };

    // Convenience methods
    const success = (message, duration) => show(message, 'success', duration);
    const error = (message, duration) => show(message, 'error', duration);
    const warning = (message, duration) => show(message, 'warning', duration);
    const info = (message, duration) => show(message, 'info', duration);

    // Clear all toasts
    const clearAll = () => {
      activeToasts.forEach(toast => {
        if (container && container.contains(toast)) {
          container.removeChild(toast);
        }
      });
      activeToasts = [];
    };

    return {
      init,
      show,
      success,
      error,
      warning,
      info,
      clearAll
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ToastNotifications);
}

export default ToastNotifications;
