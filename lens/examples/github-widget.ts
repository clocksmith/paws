/**
 * GitHub Widget
 *
 * Demonstrates tool invocations, error handling, and real-world MCP usage.
 */

import type { Dependencies, MCPServerInfo, WidgetFactory, Tool } from '../schema';

export default function createGitHubWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class GitHubWidget extends HTMLElement {
    private tools: Tool[] = [];
    private recentActivity: Array<{ tool: string; timestamp: Date; status: string }> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    async connectedCallback() {
      await this.loadTools();
      this.render();
      this.attachListeners();
      this.subscribeToEvents();
    }

    disconnectedCallback() {
      // Cleanup: unsubscribe from events would go here
    }

    private async loadTools() {
      try {
        this.tools = await MCPBridge.listTools(serverInfo.serverName);
      } catch (error) {
        console.error('Failed to load tools:', error);
        EventBus.emit('mcp:widget:error', {
          element: 'github-widget',
          error: {
            code: 'TOOL_LIST_FAILED',
            message: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    }

    private subscribeToEvents() {
      // Listen for tool invocations from this server
      EventBus.on('mcp:tool:invoked', (payload: any) => {
        if (payload.serverName === serverInfo.serverName) {
          this.recentActivity.unshift({
            tool: payload.toolName,
            timestamp: new Date(),
            status: 'success'
          });
          // Keep only last 10 items
          this.recentActivity = this.recentActivity.slice(0, 10);
          this.render();
        }
      });

      EventBus.on('mcp:tool:error', (payload: any) => {
        if (payload.serverName === serverInfo.serverName) {
          this.recentActivity.unshift({
            tool: payload.toolName,
            timestamp: new Date(),
            status: 'error'
          });
          this.recentActivity = this.recentActivity.slice(0, 10);
          this.render();
        }
      });
    }

    private async createIssue() {
      const repoInput = this.shadowRoot?.querySelector('#repo') as HTMLInputElement;
      const titleInput = this.shadowRoot?.querySelector('#title') as HTMLInputElement;
      const bodyInput = this.shadowRoot?.querySelector('#body') as HTMLTextAreaElement;

      if (!repoInput?.value || !titleInput?.value) {
        alert('Repository and title are required');
        return;
      }

      try {
        // This will trigger user confirmation dialog
        const result = await MCPBridge.callTool(
          serverInfo.serverName,
          'create_issue',
          {
            repo: repoInput.value,
            title: titleInput.value,
            body: bodyInput?.value || ''
          }
        );

        // Clear form on success
        repoInput.value = '';
        titleInput.value = '';
        if (bodyInput) bodyInput.value = '';

        // Show success message
        const successMsg = this.shadowRoot?.querySelector('#success-message');
        if (successMsg) {
          successMsg.textContent = 'Issue created successfully!';
          setTimeout(() => {
            successMsg.textContent = '';
          }, 3000);
        }
      } catch (error: any) {
        if (error.code === 'USER_REJECTED') {
          // User cancelled - no action needed
          console.log('User cancelled issue creation');
        } else {
          // Show error message
          const errorMsg = this.shadowRoot?.querySelector('#error-message');
          if (errorMsg) {
            errorMsg.textContent = `Error: ${error.message || 'Failed to create issue'}`;
            setTimeout(() => {
              errorMsg.textContent = '';
            }, 5000);
          }
        }
      }
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
          .widget {
            border: 1px solid #e1e4e8;
            border-radius: 8px;
            background: white;
            overflow: hidden;
          }
          .header {
            background: #f6f8fa;
            padding: 16px;
            border-bottom: 1px solid #e1e4e8;
          }
          .header h2 {
            margin: 0;
            font-size: 18px;
            color: #24292e;
          }
          .section {
            padding: 16px;
            border-bottom: 1px solid #e1e4e8;
          }
          .section:last-child {
            border-bottom: none;
          }
          .form-group {
            margin-bottom: 12px;
          }
          label {
            display: block;
            margin-bottom: 4px;
            font-size: 14px;
            font-weight: 500;
            color: #24292e;
          }
          input, textarea {
            width: 100%;
            padding: 8px;
            border: 1px solid #e1e4e8;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          }
          textarea {
            resize: vertical;
            min-height: 80px;
          }
          button {
            padding: 8px 16px;
            background: #2ea44f;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
          }
          button:hover {
            background: #2c974b;
          }
          .message {
            margin-top: 8px;
            padding: 8px;
            border-radius: 4px;
            font-size: 14px;
          }
          .success-message {
            background: #d1f4dd;
            color: #0f5323;
          }
          .error-message {
            background: #ffdce0;
            color: #86181d;
          }
          .activity-list {
            list-style: none;
            padding: 0;
            margin: 0;
          }
          .activity-item {
            padding: 8px;
            border-bottom: 1px solid #e1e4e8;
            font-size: 13px;
          }
          .activity-item:last-child {
            border-bottom: none;
          }
          .activity-item.success {
            color: #0f5323;
          }
          .activity-item.error {
            color: #86181d;
          }
          .timestamp {
            font-size: 11px;
            color: #586069;
          }
        </style>
        <div class="widget">
          <div class="header">
            <h2>GitHub Operations</h2>
          </div>

          <div class="section">
            <h3>Create Issue</h3>
            <div class="form-group">
              <label for="repo">Repository (owner/repo)</label>
              <input type="text" id="repo" placeholder="octocat/Hello-World" />
            </div>
            <div class="form-group">
              <label for="title">Title</label>
              <input type="text" id="title" placeholder="Issue title" />
            </div>
            <div class="form-group">
              <label for="body">Body</label>
              <textarea id="body" placeholder="Issue description"></textarea>
            </div>
            <button id="create-issue">Create Issue</button>
            <div id="success-message" class="message success-message" style="display: none;"></div>
            <div id="error-message" class="message error-message" style="display: none;"></div>
          </div>

          <div class="section">
            <h3>Recent Activity</h3>
            ${this.renderActivity()}
          </div>

          <div class="section">
            <h3>Available Tools</h3>
            <p style="font-size: 13px; color: #586069;">
              ${this.tools.length} tools available
            </p>
          </div>
        </div>
      `;

      // Show messages if they have content
      const successMsg = this.shadowRoot.querySelector('#success-message');
      const errorMsg = this.shadowRoot.querySelector('#error-message');
      if (successMsg && successMsg.textContent) {
        (successMsg as HTMLElement).style.display = 'block';
      }
      if (errorMsg && errorMsg.textContent) {
        (errorMsg as HTMLElement).style.display = 'block';
      }
    }

    private renderActivity(): string {
      if (this.recentActivity.length === 0) {
        return '<p style="font-size: 13px; color: #586069;">No recent activity</p>';
      }

      return `
        <ul class="activity-list">
          ${this.recentActivity.map(item => `
            <li class="activity-item ${item.status}">
              <strong>${item.tool}</strong> - ${item.status}
              <div class="timestamp">${item.timestamp.toLocaleTimeString()}</div>
            </li>
          `).join('')}
        </ul>
      `;
    }

    private attachListeners() {
      this.shadowRoot?.querySelector('#create-issue')?.addEventListener('click', () => this.createIssue());
    }
  }

  // Register custom element
  if (!customElements.get('github-widget')) {
    customElements.define('github-widget', GitHubWidget);
  }

  // Return widget factory
  return {
    api: {
      async initialize() {
        EventBus.emit('mcp:widget:initialized', {
          element: 'github-widget',
          displayName: 'GitHub'
        });
      },

      async destroy() {
        // Cleanup event listeners
      },

      async refresh() {
        const widget = document.querySelector('github-widget') as GitHubWidget;
        if (widget) {
          await widget['loadTools']();
        }
      }
    },

    widget: {
      protocolVersion: '1.0.0',
      element: 'github-widget',
      displayName: 'GitHub',
      description: 'Manage GitHub repositories, issues, and pull requests',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false
      },
      permissions: {
        tools: ['create_issue', 'create_pull_request', 'list_*'],
        resources: ['github://**']
      },
      category: 'content-browser',
      tags: ['github', 'git', 'vcs']
    }
  };
}
