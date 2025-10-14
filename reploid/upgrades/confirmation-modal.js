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

    // Export public API
    return {
      confirm,
      closeModal
    };
  }
};

export default ConfirmationModal;