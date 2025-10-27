/**
 * Simple Counter Widget - MCP Lens Example
 *
 * Demonstrates basic MCP Lens widget structure and lifecycle:
 * - Widget factory pattern (SPEC §3.1)
 * - Web Component with Shadow DOM (SPEC §4.1)
 * - Event emission (SPEC §6.4)
 * - Configuration usage (SPEC §5.4)
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../schema';

export default function createCounterWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, Configuration } = deps;

  class CounterWidget extends HTMLElement {
    private count: number = 0;
    private eventBus?: typeof EventBus;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      // Get initial count from configuration
      this.count = Configuration.get<number>('counter.initial', 0) || 0;
      this.render();
      this.attachListeners();
    }

    disconnectedCallback() {
      // Cleanup: Save current count
      Configuration.set('counter.current', this.count);
    }

    private increment() {
      this.count++;
      this.render();

      // Emit event for observability
      EventBus.emit('mcp:widget:refreshed', {
        element: 'counter-widget',
        data: { count: this.count }
      });
    }

    private decrement() {
      this.count--;
      this.render();

      EventBus.emit('mcp:widget:refreshed', {
        element: 'counter-widget',
        data: { count: this.count }
      });
    }

    private reset() {
      this.count = 0;
      this.render();
    }

    private render() {
      if (!this.shadowRoot) return;

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            padding: 16px;
            font-family: system-ui, sans-serif;
          }
          .counter {
            border: 1px solid #ccc;
            border-radius: 8px;
            padding: 24px;
            text-align: center;
            background: white;
          }
          .count {
            font-size: 48px;
            font-weight: bold;
            margin: 16px 0;
            color: #333;
          }
          .buttons {
            display: flex;
            gap: 8px;
            justify-content: center;
          }
          button {
            padding: 8px 16px;
            font-size: 14px;
            border: 1px solid #ccc;
            border-radius: 4px;
            background: white;
            cursor: pointer;
            transition: all 0.2s;
          }
          button:hover {
            background: #f0f0f0;
          }
          button:active {
            transform: translateY(1px);
          }
        </style>
        <div class="counter">
          <h2>Counter Widget</h2>
          <div class="count">${this.count}</div>
          <div class="buttons">
            <button id="decrement">-</button>
            <button id="reset">Reset</button>
            <button id="increment">+</button>
          </div>
        </div>
      `;
    }

    private attachListeners() {
      this.shadowRoot?.querySelector('#increment')?.addEventListener('click', () => this.increment());
      this.shadowRoot?.querySelector('#decrement')?.addEventListener('click', () => this.decrement());
      this.shadowRoot?.querySelector('#reset')?.addEventListener('click', () => this.reset());
    }
  }

  // Register custom element (check if already registered)
  if (!customElements.get('counter-widget')) {
    customElements.define('counter-widget', CounterWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        EventBus.emit('mcp:widget:initialized', {
          element: 'counter-widget',
          displayName: 'Counter'
        });
      },

      async destroy() {
        // Cleanup logic (if needed)
      },

      async refresh() {
        // Reload widget data - in this case, reset counter
        const widget = document.querySelector('counter-widget');
        if (widget && widget.shadowRoot) {
          const resetButton = widget.shadowRoot.querySelector('#reset') as HTMLButtonElement;
          resetButton?.click();
        }
      }
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'counter-widget',
      displayName: 'Counter',
      description: 'Simple counter widget demonstrating MCP Lens basics',
      capabilities: {
        tools: false,
        resources: false,
        prompts: false
      },
      category: 'other',
      tags: ['demo', 'simple', 'counter']
    }
  };
}
