// @blueprint 0x00002B - Defines the toast notification system.
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

    // Widget tracking
    const _toastHistory = [];
    const MAX_HISTORY = 100;
    let _toastStats = { success: 0, error: 0, warning: 0, info: 0, total: 0 };
    let _lastToastTime = null;

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

      // Track toast
      _lastToastTime = Date.now();
      _toastStats.total++;
      _toastStats[type] = (_toastStats[type] || 0) + 1;
      _toastHistory.push({
        message,
        type,
        timestamp: _lastToastTime
      });
      if (_toastHistory.length > MAX_HISTORY) {
        _toastHistory.shift();
      }

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
      clearAll,

      // Web Component Widget
      widget: (() => {
        class ToastNotificationsWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            this._interval = setInterval(() => this.render(), 1000);
          }

          disconnectedCallback() {
            if (this._interval) clearInterval(this._interval);
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            let state = 'idle';
            if (activeToasts.length > 0) state = 'active';
            if (activeToasts.some(t => t.className.includes('error'))) state = 'error';

            return {
              state,
              primaryMetric: `${activeToasts.length} active`,
              secondaryMetric: `${_toastStats.total} total`,
              lastActivity: _lastToastTime
            };
          }

          render() {
            const formatTime = (timestamp) => {
              if (!timestamp) return 'Never';
              return new Date(timestamp).toLocaleTimeString();
            };

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 16px;
                }
                h4 {
                  margin: 0 0 16px 0;
                  font-size: 1.2em;
                  color: #fff;
                }
                h5 {
                  margin: 16px 0 8px 0;
                  font-size: 1em;
                  color: #aaa;
                }
                .controls {
                  display: flex;
                  gap: 8px;
                  margin-bottom: 16px;
                }
                button {
                  padding: 6px 12px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                }
                button:hover {
                  background: rgba(100,150,255,0.3);
                }
                .stats-grid {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 12px;
                  margin-bottom: 16px;
                }
                .stat-card {
                  background: rgba(255,255,255,0.05);
                  border-radius: 6px;
                  padding: 12px;
                  text-align: center;
                }
                .stat-label {
                  font-size: 0.85em;
                  color: #888;
                  margin-bottom: 4px;
                }
                .stat-value {
                  font-size: 1.5em;
                  font-weight: bold;
                  color: #0ff;
                }
                .toast-stats-breakdown {
                  background: rgba(0,0,0,0.2);
                  border-radius: 6px;
                  padding: 8px;
                  margin-bottom: 16px;
                }
                .toast-stat-row {
                  display: grid;
                  grid-template-columns: 30px 1fr auto auto;
                  gap: 8px;
                  padding: 6px;
                  align-items: center;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .toast-stat-row:last-child {
                  border-bottom: none;
                }
                .toast-type-icon {
                  font-size: 1.2em;
                }
                .toast-type-label {
                  color: #ddd;
                }
                .toast-type-count {
                  color: #0ff;
                  font-weight: bold;
                }
                .toast-type-percent {
                  color: #888;
                  font-size: 0.9em;
                }
                .toast-history-list {
                  max-height: 200px;
                  overflow-y: auto;
                  background: rgba(0,0,0,0.2);
                  border-radius: 6px;
                  padding: 8px;
                }
                .toast-history-item {
                  display: grid;
                  grid-template-columns: auto auto 1fr;
                  gap: 8px;
                  padding: 6px;
                  border-bottom: 1px solid rgba(255,255,255,0.05);
                  font-size: 0.9em;
                }
                .toast-history-item:last-child {
                  border-bottom: none;
                }
                .toast-history-time {
                  color: #888;
                  font-size: 0.85em;
                }
                .toast-history-type {
                  color: #0ff;
                  font-weight: bold;
                  text-transform: uppercase;
                  font-size: 0.8em;
                }
                .toast-history-message {
                  color: #ddd;
                }
                .toast-history-success { border-left: 3px solid #0f0; }
                .toast-history-error { border-left: 3px solid #f00; }
                .toast-history-warning { border-left: 3px solid #ff0; }
                .toast-history-info { border-left: 3px solid #0ff; }
              </style>

              <div class="toast-notifications-panel">
                <h4>⚏ Toast Notifications</h4>

                <div class="controls">
                  <button class="clear-all">⌦ Clear All</button>
                  <button class="clear-history">≡ Clear History</button>
                </div>

                <div class="stats-grid">
                  <div class="stat-card">
                    <div class="stat-label">Active</div>
                    <div class="stat-value">${activeToasts.length}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Total Shown</div>
                    <div class="stat-value">${_toastStats.total}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Errors</div>
                    <div class="stat-value">${_toastStats.error}</div>
                  </div>
                  <div class="stat-card">
                    <div class="stat-label">Success</div>
                    <div class="stat-value">${_toastStats.success}</div>
                  </div>
                </div>

                <h5>Statistics by Type</h5>
                <div class="toast-stats-breakdown">
                  <div class="toast-stat-row">
                    <span class="toast-type-icon">✓</span>
                    <span class="toast-type-label">Success</span>
                    <span class="toast-type-count">${_toastStats.success}</span>
                    <span class="toast-type-percent">${(_toastStats.total > 0 ? (_toastStats.success / _toastStats.total * 100).toFixed(0) : 0)}%</span>
                  </div>
                  <div class="toast-stat-row">
                    <span class="toast-type-icon">✕</span>
                    <span class="toast-type-label">Error</span>
                    <span class="toast-type-count">${_toastStats.error}</span>
                    <span class="toast-type-percent">${(_toastStats.total > 0 ? (_toastStats.error / _toastStats.total * 100).toFixed(0) : 0)}%</span>
                  </div>
                  <div class="toast-stat-row">
                    <span class="toast-type-icon">⚠</span>
                    <span class="toast-type-label">Warning</span>
                    <span class="toast-type-count">${_toastStats.warning}</span>
                    <span class="toast-type-percent">${(_toastStats.total > 0 ? (_toastStats.warning / _toastStats.total * 100).toFixed(0) : 0)}%</span>
                  </div>
                  <div class="toast-stat-row">
                    <span class="toast-type-icon">ℹ</span>
                    <span class="toast-type-label">Info</span>
                    <span class="toast-type-count">${_toastStats.info}</span>
                    <span class="toast-type-percent">${(_toastStats.total > 0 ? (_toastStats.info / _toastStats.total * 100).toFixed(0) : 0)}%</span>
                  </div>
                </div>

                <h5>Recent Toasts</h5>
                <div class="toast-history-list">
                  ${_toastHistory.length > 0 ? _toastHistory.slice(-20).reverse().map(toast => `
                    <div class="toast-history-item toast-history-${toast.type}">
                      <span class="toast-history-time">${formatTime(toast.timestamp)}</span>
                      <span class="toast-history-type">${toast.type}</span>
                      <span class="toast-history-message">${toast.message}</span>
                    </div>
                  `).join('') : '<p style="color: #888; text-align: center;">No toasts shown yet</p>'}
                </div>
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.clear-all')?.addEventListener('click', () => {
              clearAll();
              this.render();
            });

            this.shadowRoot.querySelector('.clear-history')?.addEventListener('click', () => {
              _toastHistory.length = 0;
              _toastStats = { success: 0, error: 0, warning: 0, info: 0, total: 0 };
              this.render();
            });
          }
        }

        if (!customElements.get('toast-notifications-widget')) {
          customElements.define('toast-notifications-widget', ToastNotificationsWidget);
        }

        return {
          element: 'toast-notifications-widget',
          displayName: 'Toast Notifications',
          icon: '⚏',
          category: 'ui',
          updateInterval: 1000
        };
      })()
    };
  }
};

// Register module if running in REPLOID environment
if (typeof window !== 'undefined' && window.ModuleRegistry) {
  window.ModuleRegistry.register(ToastNotifications);
}

export default ToastNotifications;
