/**
 * Reploid Toast Notifications Widget
 *
 * Non-blocking notification toasts for system events
 * Auto-dismiss with configurable duration
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: number;
  duration: number;
}

export default function createToastNotificationsWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus } = deps;

  class ToastNotificationsWidget extends HTMLElement {
    private toasts: Toast[] = [];
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      // Subscribe to various toast events
      const unsubInfo = EventBus.on('toast:info', (data: any) => {
        this.showToast('info', data.message || data, data.duration);
      });
      this.unsubscribers.push(unsubInfo);

      const unsubSuccess = EventBus.on('toast:success', (data: any) => {
        this.showToast('success', data.message || data, data.duration);
      });
      this.unsubscribers.push(unsubSuccess);

      const unsubWarning = EventBus.on('toast:warning', (data: any) => {
        this.showToast('warning', data.message || data, data.duration);
      });
      this.unsubscribers.push(unsubWarning);

      const unsubError = EventBus.on('toast:error', (data: any) => {
        this.showToast('error', data.message || data, data.duration || 5000);
      });
      this.unsubscribers.push(unsubError);

      // Generic notification event
      const unsubNotification = EventBus.on('notification', (data: any) => {
        this.showToast(data.type || 'info', data.message, data.duration);
      });
      this.unsubscribers.push(unsubNotification);

      // MCP widget errors
      const unsubMCPError = EventBus.on('mcp:widget:error', (data: any) => {
        this.showToast('error', `Widget error: ${data.error?.message || 'Unknown'}`, 5000);
      });
      this.unsubscribers.push(unsubMCPError);
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private showToast(type: Toast['type'], message: string, duration: number = 3000) {
      const toast: Toast = {
        id: `toast-${Date.now()}-${Math.random()}`,
        type,
        message,
        timestamp: Date.now(),
        duration
      };

      this.toasts.push(toast);
      this.render();

      // Auto-dismiss
      setTimeout(() => {
        this.dismissToast(toast.id);
      }, duration);
    }

    private dismissToast(id: string) {
      this.toasts = this.toasts.filter(t => t.id !== id);
      this.render();
    }

    private getToastIcon(type: Toast['type']): string {
      switch (type) {
        case 'info': return 'ℹ';
        case 'success': return '✓';
        case 'warning': return '⚠';
        case 'error': return '✗';
        default: return 'ℹ';
      }
    }

    private getToastColor(type: Toast['type']): string {
      switch (type) {
        case 'info': return '#4dabf7';
        case 'success': return '#51cf66';
        case 'warning': return '#ffd43b';
        case 'error': return '#ff6b6b';
        default: return '#4dabf7';
      }
    }

    private render() {
      if (!this.shadowRoot) return;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            position: fixed;
            top: 1rem;
            right: 1rem;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            max-width: 400px;
            pointer-events: none;
          }

          .toast {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 1rem;
            background: #1a1a1a;
            border: 1px solid;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            animation: slideIn 0.3s ease;
            pointer-events: auto;
            cursor: pointer;
          }

          .toast:hover {
            opacity: 0.9;
          }

          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }

          .toast-icon {
            font-size: 1.25rem;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            flex-shrink: 0;
          }

          .toast-message {
            flex: 1;
            color: #e0e0e0;
            font-size: 0.875rem;
            line-height: 1.5;
          }

          .toast-dismiss {
            color: #666;
            font-size: 1.25rem;
            cursor: pointer;
            padding: 0 0.25rem;
            flex-shrink: 0;
          }

          .toast-dismiss:hover {
            color: #999;
          }
        </style>

        ${this.toasts.map(toast => `
          <div
            class="toast"
            style="border-color: ${this.getToastColor(toast.type)}"
            data-id="${toast.id}"
          >
            <div class="toast-icon" style="color: ${this.getToastColor(toast.type)}">
              ${this.getToastIcon(toast.type)}
            </div>
            <div class="toast-message">${toast.message}</div>
            <div class="toast-dismiss">×</div>
          </div>
        `).join('')}
      `;

      // Add click handlers for dismissal
      const toastEls = this.shadowRoot.querySelectorAll('.toast');
      toastEls.forEach(el => {
        const id = el.getAttribute('data-id');
        if (id) {
          el.addEventListener('click', () => this.dismissToast(id));
        }
      });
    }
  }

  customElements.define('reploid-toast-notifications', ToastNotificationsWidget);

  return {
    factory: () => {
      return new ToastNotificationsWidget();
    }
  };
}
