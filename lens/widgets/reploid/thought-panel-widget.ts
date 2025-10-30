/**
 * Reploid Thought Panel Widget
 *
 * Real-time agent thought streaming with circular buffer management
 * Displays LLM reasoning and decision-making process
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

// PRODUCTION MODE: Connect to real MCP server
const USE_MOCK_DATA = false;

let mockThoughts: any;
if (USE_MOCK_DATA) {
  mockThoughts = [
    { timestamp: Date.now() - 10000, text: "User wants to add authentication. Let me analyze the current codebase..." },
    { timestamp: Date.now() - 8000, text: "I can see there's no auth system yet. I'll need to create login, session management, and middleware." },
    { timestamp: Date.now() - 6000, text: "Let me select the relevant files to read: src/server.js, src/routes/*.js, package.json" },
    { timestamp: Date.now() - 4000, text: "Now I'll design the authentication flow: JWT-based with bcrypt for passwords" },
    { timestamp: Date.now() - 2000, text: "Planning to create: auth/login.js, auth/middleware.js, models/User.js" }
  ];
}

export default function createThoughtPanelWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge } = deps;

  class ThoughtPanelWidget extends HTMLElement {
    private thoughts: any[] = [];
    private currentStreamingThought: any = null;
    private autoScroll: boolean = true;
    private isPaused: boolean = false;
    private unsubscribers: Array<() => void> = [];
    private readonly MAX_THOUGHTS = 1000;

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();

      if (USE_MOCK_DATA) {
        this.thoughts = mockThoughts;
        this.render();
      } else {
        // Subscribe to agent thought events
        const unsubThought = EventBus.on('agent:thought', (data: any) => {
          if (!this.isPaused) {
            this.addThought(data.text || data);
          }
        });
        this.unsubscribers.push(unsubThought);

        // Subscribe to streaming chunks
        const unsubStreamChunk = EventBus.on('hybrid-llm:stream-chunk', (data: any) => {
          if (!this.isPaused) {
            this.handleStreamChunk(data);
          }
        });
        this.unsubscribers.push(unsubStreamChunk);

        // Subscribe to stream complete
        const unsubStreamComplete = EventBus.on('hybrid-llm:stream-complete', () => {
          if (this.currentStreamingThought) {
            this.currentStreamingThought = null;
            this.render();
          }
        });
        this.unsubscribers.push(unsubStreamComplete);
      }
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private addThought(text: string) {
      this.thoughts.push({
        timestamp: Date.now(),
        text: text
      });

      // Circular buffer: trim to max
      if (this.thoughts.length > this.MAX_THOUGHTS) {
        this.thoughts = this.thoughts.slice(-this.MAX_THOUGHTS);
      }

      this.render();
    }

    private handleStreamChunk(data: any) {
      const chunk = data.chunk || data.text || data;

      if (!this.currentStreamingThought) {
        this.currentStreamingThought = {
          timestamp: Date.now(),
          text: chunk,
          isStreaming: true
        };
      } else {
        this.currentStreamingThought.text += chunk;
      }

      this.render();
    }

    private formatTimestamp(timestamp: number): string {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    }

    private async clearThoughts() {
      this.thoughts = [];
      this.currentStreamingThought = null;
      this.render();
    }

    private async exportThoughts() {
      const markdown = this.thoughts.map(thought => {
        const time = new Date(thought.timestamp).toLocaleString();
        return `### ${time}\n\n${thought.text}\n`;
      }).join('\n---\n\n');

      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reploid-thoughts-${Date.now()}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }

    private togglePause() {
      this.isPaused = !this.isPaused;
      this.render();
    }

    private render() {
      if (!this.shadowRoot) return;

      const allThoughts = [...this.thoughts];
      if (this.currentStreamingThought) {
        allThoughts.push(this.currentStreamingThought);
      }

      this.shadowRoot.innerHTML = `
        <style>
          :host {
            display: block;
            height: 100%;
            background: #1a1a1a;
            border: 1px solid #333;
            border-radius: 4px;
          }

          .thought-panel {
            display: flex;
            flex-direction: column;
            height: 100%;
          }

          .toolbar {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 1rem;
            background: #222;
            border-bottom: 1px solid #333;
          }

          .toolbar button {
            background: #333;
            border: 1px solid #444;
            color: #e0e0e0;
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.875rem;
          }

          .toolbar button:hover {
            background: #444;
          }

          .toolbar button.pause-btn.paused {
            background: #dc3545;
          }

          .toolbar .count {
            color: #888;
            font-size: 0.875rem;
            margin-left: auto;
          }

          .thought-content {
            flex: 1;
            overflow-y: auto;
            padding: 1rem;
          }

          .thought-entry {
            margin-bottom: 1.5rem;
            padding: 1rem;
            background: #222;
            border-left: 3px solid #4dabf7;
            border-radius: 4px;
          }

          .thought-entry.streaming {
            border-left-color: #51cf66;
            animation: pulse 1.5s infinite;
          }

          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }

          .thought-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.5rem;
            font-size: 0.75rem;
            color: #666;
          }

          .thought-timestamp {
            font-weight: 600;
          }

          .streaming-indicator {
            color: #51cf66;
          }

          .thought-text {
            color: #e0e0e0;
            line-height: 1.6;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .empty {
            text-align: center;
            padding: 2rem;
            color: #666;
          }

          .paused-overlay {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(220, 53, 69, 0.9);
            color: white;
            padding: 1rem 2rem;
            border-radius: 4px;
            font-weight: 600;
          }
        </style>

        <div class="thought-panel" style="position: relative">
          <div class="toolbar">
            <button class="pause-btn ${this.isPaused ? 'paused' : ''}" id="pause-btn">
              ${this.isPaused ? 'Resume' : 'Pause'}
            </button>
            <button id="clear-btn">Clear</button>
            <button id="export-btn">Export MD</button>

            <span class="count">${allThoughts.length} thoughts</span>
          </div>

          <div class="thought-content" id="thought-content">
            ${allThoughts.length > 0 ? allThoughts.map(thought => `
              <div class="thought-entry ${thought.isStreaming ? 'streaming' : ''}">
                <div class="thought-header">
                  <span class="thought-timestamp">${this.formatTimestamp(thought.timestamp)}</span>
                  ${thought.isStreaming ? '<span class="streaming-indicator">● Streaming...</span>' : ''}
                </div>
                <div class="thought-text">${thought.text}</div>
              </div>
            `).join('') : `
              <div class="empty">No thoughts yet. Agent will share reasoning here when active.</div>
            `}
          </div>

          ${this.isPaused ? `
            <div class="paused-overlay">PAUSED</div>
          ` : ''}
        </div>
      `;

      // Event handlers
      const pauseBtn = this.shadowRoot.querySelector('#pause-btn');
      pauseBtn?.addEventListener('click', () => this.togglePause());

      const clearBtn = this.shadowRoot.querySelector('#clear-btn');
      clearBtn?.addEventListener('click', () => this.clearThoughts());

      const exportBtn = this.shadowRoot.querySelector('#export-btn');
      exportBtn?.addEventListener('click', () => this.exportThoughts());

      // Auto-scroll to bottom
      if (this.autoScroll && allThoughts.length > 0) {
        const thoughtContent = this.shadowRoot.querySelector('#thought-content');
        if (thoughtContent) {
          thoughtContent.scrollTop = thoughtContent.scrollHeight;
        }
      }
    }
  }

  customElements.define('reploid-thought-panel', ThoughtPanelWidget);

  return {
    factory: () => {
      return new ThoughtPanelWidget();
    }
  };
}
