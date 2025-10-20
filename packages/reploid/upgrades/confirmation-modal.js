// @blueprint 0x000022 - Documents confirmation modal safety and UX patterns.
// Confirmation Modal Component for REPLOID
// Provides user confirmation dialogs for destructive actions

const ConfirmationModal = {
  metadata: {
    id: 'ConfirmationModal',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    let activeModal = null;

    // Create and show confirmation modal
    const confirm = (options = {}) => {
      const {
        title = 'Confirm Action',
        message = 'Are you sure you want to proceed?',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        danger = false,
        details = null
      } = options;

      return new Promise((resolve) => {
        // Close any existing modal
        if (activeModal) {
          closeModal();
        }

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
          <div class="modal-content ${danger ? 'modal-danger' : ''}">
            <div class="modal-header">
              <h3 class="modal-title">${escapeHtml(title)}</h3>
              <button class="modal-close" aria-label="Close">&times;</button>
            </div>
            <div class="modal-body">
              <p class="modal-message">${escapeHtml(message)}</p>
              ${details ? `<div class="modal-details">${escapeHtml(details)}</div>` : ''}
            </div>
            <div class="modal-actions">
              <button class="btn btn-secondary modal-btn-cancel">${escapeHtml(cancelText)}</button>
              <button class="btn ${danger ? 'btn-danger' : 'btn-primary'} modal-btn-confirm">${escapeHtml(confirmText)}</button>
            </div>
          </div>
        `;

        // Store reference
        activeModal = {
          overlay,
          resolve
        };

        // Event handlers
        const handleConfirm = () => {
          closeModal();
          resolve(true);
        };

        const handleCancel = () => {
          closeModal();
          resolve(false);
        };

        const handleEscape = (e) => {
          if (e.key === 'Escape') {
            handleCancel();
          }
        };

        const handleOverlayClick = (e) => {
          if (e.target === overlay) {
            handleCancel();
          }
        };

        // Attach event listeners
        overlay.querySelector('.modal-btn-confirm').addEventListener('click', handleConfirm);
        overlay.querySelector('.modal-btn-cancel').addEventListener('click', handleCancel);
        overlay.querySelector('.modal-close').addEventListener('click', handleCancel);
        document.addEventListener('keydown', handleEscape);
        overlay.addEventListener('click', handleOverlayClick);

        // Store handlers for cleanup
        activeModal.handlers = {
          confirm: handleConfirm,
          cancel: handleCancel,
          escape: handleEscape,
          overlayClick: handleOverlayClick
        };

        // Add to DOM
        document.body.appendChild(overlay);

        // Focus confirm button
        setTimeout(() => {
          overlay.querySelector('.modal-btn-confirm').focus();
        }, 100);

        logger.info('[ConfirmationModal] Modal shown:', title);
      });
    };

    // Close active modal
    const closeModal = () => {
      if (!activeModal) return;

      const { overlay, handlers } = activeModal;

      // Remove event listeners
      if (handlers) {
        document.removeEventListener('keydown', handlers.escape);
      }

      // Remove from DOM
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }

      activeModal = null;
      logger.info('[ConfirmationModal] Modal closed');
    };

    // Escape HTML to prevent XSS
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Inject styles if not already present
    const injectStyles = () => {
      if (document.getElementById('confirmation-modal-styles')) {
        return;
      }

      const styles = document.createElement('style');
      styles.id = 'confirmation-modal-styles';
      styles.textContent = `
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: fadeIn 0.2s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .modal-content {
          background: #1a1a24;
          border: 2px solid rgba(0, 255, 255, 0.3);
          border-radius: 8px;
          min-width: 400px;
          max-width: 600px;
          max-height: 80vh;
          overflow: auto;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-content.modal-danger {
          border-color: rgba(255, 68, 68, 0.5);
        }

        .modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-title {
          color: #0ff;
          margin: 0;
          font-size: 18px;
          font-family: 'Courier New', monospace;
        }

        .modal-danger .modal-title {
          color: #ff4444;
        }

        .modal-close {
          background: none;
          border: none;
          color: #e0e0e0;
          font-size: 28px;
          line-height: 1;
          cursor: pointer;
          padding: 0;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-close:hover {
          color: #fff;
        }

        .modal-body {
          padding: 20px;
        }

        .modal-message {
          color: #e0e0e0;
          font-size: 14px;
          line-height: 1.6;
          margin: 0 0 16px 0;
          font-family: 'Courier New', monospace;
        }

        .modal-details {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 4px;
          padding: 12px;
          color: #aaa;
          font-size: 12px;
          font-family: 'Courier New', monospace;
          white-space: pre-wrap;
          max-height: 200px;
          overflow: auto;
        }

        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          padding: 16px 20px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-actions .btn {
          padding: 8px 20px;
          font-size: 14px;
          font-family: 'Courier New', monospace;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
          border: 1px solid transparent;
        }

        .btn-primary {
          background: #0ff;
          color: #000;
          border-color: #0ff;
        }

        .btn-primary:hover {
          background: #0cc;
          border-color: #0cc;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          color: #e0e0e0;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn-secondary:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .btn-danger {
          background: #ff4444;
          color: #fff;
          border-color: #ff4444;
        }

        .btn-danger:hover {
          background: #ff2222;
          border-color: #ff2222;
        }

        .btn:focus {
          outline: 2px solid rgba(0, 255, 255, 0.5);
          outline-offset: 2px;
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
          .modal-content {
            min-width: auto;
            width: 90%;
            margin: 20px;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }

          .modal-actions .btn {
            width: 100%;
          }
        }
      `;
      document.head.appendChild(styles);
    };

    // Initialize
    const init = () => {
      injectStyles();
      logger.info('[ConfirmationModal] Initialized');
    };

    // Auto-initialize
    init();

    // Modal usage statistics for widget
    const modalStats = {
      totalShown: 0,
      totalConfirmed: 0,
      totalCancelled: 0,
      dangerModalsShown: 0,
      lastModal: null,
      recentModals: []
    };

    // Wrap confirm to track stats
    const wrappedConfirm = (options = {}) => {
      modalStats.totalShown++;
      if (options.danger) {
        modalStats.dangerModalsShown++;
      }

      const modalInfo = {
        title: options.title || 'Confirm Action',
        timestamp: Date.now(),
        danger: options.danger || false
      };

      modalStats.lastModal = modalInfo;
      modalStats.recentModals.unshift(modalInfo);
      if (modalStats.recentModals.length > 10) {
        modalStats.recentModals = modalStats.recentModals.slice(0, 10);
      }

      // Call original confirm and track result
      return confirm(options).then(result => {
        if (result) {
          modalStats.totalConfirmed++;
        } else {
          modalStats.totalCancelled++;
        }
        return result;
      });
    };

    // Export public API
    return {
      confirm: wrappedConfirm,
      closeModal,

      widget: (() => {
        class ConfirmationModalWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
          }

          disconnectedCallback() {
            // No intervals to clear
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const hasActiveModal = activeModal !== null;
            const hasRecentActivity = modalStats.lastModal &&
              (Date.now() - modalStats.lastModal.timestamp < 60000);

            return {
              state: hasActiveModal ? 'active' : (hasRecentActivity ? 'idle' : 'disabled'),
              primaryMetric: modalStats.totalShown > 0
                ? `${modalStats.totalShown} shown`
                : 'No modals',
              secondaryMetric: modalStats.totalConfirmed > 0
                ? `${modalStats.totalConfirmed} confirmed`
                : 'Ready',
              lastActivity: modalStats.lastModal ? modalStats.lastModal.timestamp : null,
              message: hasActiveModal
                ? 'Modal active'
                : (modalStats.dangerModalsShown > 0 ? `${modalStats.dangerModalsShown} danger` : null)
            };
          }

          render() {
            const confirmRate = modalStats.totalShown > 0
              ? ((modalStats.totalConfirmed / modalStats.totalShown) * 100).toFixed(1)
              : 0;
            const rateColor = confirmRate > 50 ? '#0f0' : confirmRate > 25 ? '#ff0' : '#f00';

            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 16px;
                  font-family: monospace;
                  font-size: 12px;
                }
                h4 {
                  margin: 0 0 12px 0;
                  font-size: 1.2em;
                  color: #0ff;
                }
                .controls {
                  display: flex;
                  gap: 8px;
                  margin-bottom: 16px;
                }
                button {
                  padding: 8px 16px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 0.95em;
                }
                button:hover {
                  background: rgba(100,150,255,0.3);
                }
                button.danger {
                  background: rgba(255,100,100,0.2);
                  border-color: rgba(255,100,100,0.4);
                }
                button.danger:hover {
                  background: rgba(255,100,100,0.3);
                }
                .section {
                  margin-bottom: 12px;
                  padding: 8px;
                  background: rgba(0,255,255,0.05);
                  border: 1px solid rgba(0,255,255,0.2);
                  border-radius: 4px;
                }
                .section-title {
                  color: #0ff;
                  font-weight: bold;
                  margin-bottom: 8px;
                }
                .stat-row {
                  color: #e0e0e0;
                  margin: 4px 0;
                }
                .stat-value {
                  font-weight: bold;
                }
                .recent-modals {
                  max-height: 120px;
                  overflow-y: auto;
                  margin-top: 8px;
                }
                .modal-item {
                  padding: 3px 0;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .modal-item:last-child {
                  border-bottom: none;
                }
                .active-indicator {
                  margin-top: 12px;
                  padding: 8px;
                  background: rgba(0,255,0,0.1);
                  border: 1px solid rgba(0,255,0,0.3);
                  border-radius: 4px;
                  color: #0f0;
                  font-weight: bold;
                  text-align: center;
                }
                .empty-state {
                  color: #888;
                  text-align: center;
                  margin-top: 20px;
                }
              </style>

              <div>
                <h4>⁇ Confirmation Modal</h4>

                <div class="controls">
                  <button class="test-modal">⚗ Test Modal</button>
                  <button class="test-danger-modal danger">⚠️ Test Danger Modal</button>
                </div>

                <div class="section">
                  <div class="section-title">Usage Summary</div>
                  <div class="stat-row">Total Shown: <span class="stat-value" style="color: #0ff;">${modalStats.totalShown}</span></div>
                  <div class="stat-row">Confirmed: <span class="stat-value" style="color: #0f0;">${modalStats.totalConfirmed}</span></div>
                  <div class="stat-row">Cancelled: <span class="stat-value" style="color: #f00;">${modalStats.totalCancelled}</span></div>
                  ${modalStats.dangerModalsShown > 0 ? `<div class="stat-row">Danger Modals: <span class="stat-value" style="color: #ff0;">${modalStats.dangerModalsShown}</span></div>` : ''}
                </div>

                ${modalStats.totalShown > 0 ? `
                  <div class="section">
                    <div class="section-title">Confirmation Rate</div>
                    <div style="color: #aaa;">Rate: <span style="color: ${rateColor}; font-weight: bold;">${confirmRate}%</span></div>
                  </div>
                ` : ''}

                ${modalStats.lastModal ? `
                  <div class="section">
                    <div class="section-title">Last Modal</div>
                    <div style="color: #fff; font-weight: bold;">${modalStats.lastModal.title}</div>
                    ${modalStats.lastModal.danger ? '<div style="color: #ff0; font-size: 10px;">⚠️ Danger modal</div>' : ''}
                    <div style="color: #888; font-size: 10px; margin-top: 4px;">${new Date(modalStats.lastModal.timestamp).toLocaleString()}</div>
                  </div>
                ` : ''}

                ${modalStats.recentModals.length > 0 ? `
                  <div class="section">
                    <div class="section-title">Recent Modals</div>
                    <div class="recent-modals">
                      ${modalStats.recentModals.slice(0, 5).map(modal => {
                        const icon = modal.danger ? '⚠️' : '⁇';
                        const color = modal.danger ? '#ff0' : '#0ff';
                        return `
                          <div class="modal-item">
                            <span style="color: ${color};">${icon} ${modal.title}</span>
                            <span style="color: #888; font-size: 10px; margin-left: 8px;">${new Date(modal.timestamp).toLocaleTimeString()}</span>
                          </div>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}

                ${activeModal ? '<div class="active-indicator">⚡ Modal Currently Active</div>' : ''}

                ${modalStats.totalShown === 0 ? '<div class="empty-state">No modals shown yet</div>' : ''}
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.test-modal')?.addEventListener('click', async () => {
              const result = await wrappedConfirm({
                title: 'Test Modal',
                message: 'This is a test modal from the widget.',
                confirmText: 'OK',
                cancelText: 'Cancel',
                danger: false
              });
              this.render();
            });

            this.shadowRoot.querySelector('.test-danger-modal')?.addEventListener('click', async () => {
              const result = await wrappedConfirm({
                title: 'Danger Test',
                message: 'This is a danger modal test.',
                confirmText: 'Proceed',
                cancelText: 'Cancel',
                danger: true
              });
              this.render();
            });
          }
        }

        if (!customElements.get('confirmation-modal-widget')) {
          customElements.define('confirmation-modal-widget', ConfirmationModalWidget);
        }

        return {
          element: 'confirmation-modal-widget',
          displayName: 'Confirmation Modal',
          icon: '⁇',
          category: 'ui',
          order: 65
        };
      })()
    };
  }
};

export default ConfirmationModal;