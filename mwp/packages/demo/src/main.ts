/**
 * MWP Demo Application
 *
 * This demo showcases the GitHub widget with:
 * - User confirmation before tool execution
 * - Event logging for observability
 * - Mock MCP server for demonstration
 */

import { EventBus } from '@mwp/eventbus';
import { MCPBridge } from '@mwp/bridge';
import type { types } from '@mwp/core';
import createGitHubWidget from '@mwp/widget-github';

// Configuration stub
const Configuration = {
  get(key: string): string | null {
    return localStorage.getItem(`mwp:${key}`);
  },
  set(key: string, value: string): void {
    localStorage.setItem(`mwp:${key}`, value);
  }
};

// Mock MCP server info
const mockServerInfo: types.MCPServerInfo = {
  serverName: 'github',
  capabilities: {
    tools: true,
    resources: true,
    prompts: false
  },
  tools: [
    {
      name: 'list_repositories',
      description: 'List GitHub repositories',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'create_issue',
      description: 'Create a new GitHub issue',
      inputSchema: {
        type: 'object',
        properties: {
          repo: { type: 'string', description: 'Repository (owner/repo)' },
          title: { type: 'string', description: 'Issue title' },
          body: { type: 'string', description: 'Issue description' }
        },
        required: ['repo', 'title']
      }
    }
  ],
  resources: [
    {
      uri: 'repo://octocat/hello-world',
      name: 'octocat/hello-world',
      description: 'Sample repository',
      mimeType: 'application/json'
    }
  ]
};

// Event log utilities
let eventCounter = 0;
function logEvent(type: string, message: string, details?: any) {
  eventCounter++;
  const eventLog = document.getElementById('event-log');
  if (!eventLog) return;

  const time = new Date().toLocaleTimeString();
  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `
    <span class="event-time">${time}</span>
    <span class="event-type">${type}</span>
    ${message}
  `;

  // Keep only last 20 events
  if (eventLog.children.length > 20) {
    eventLog.removeChild(eventLog.firstChild!);
  }

  eventLog.appendChild(item);
  eventLog.scrollTop = eventLog.scrollHeight;

  console.log(`[${type}]`, message, details);
}

// Confirmation modal
let pendingConfirmation: {
  resolve: (value: boolean) => void;
  toolName: string;
  args: any;
} | null = null;

function showConfirmationModal(toolName: string, args: any): Promise<boolean> {
  const modal = document.getElementById('confirmation-modal');
  const details = document.getElementById('modal-details');

  if (!modal || !details) return Promise.resolve(true);

  return new Promise((resolve) => {
    pendingConfirmation = { resolve, toolName, args };

    details.innerHTML = `
      <strong>Tool:</strong> ${toolName}<br>
      <strong>Arguments:</strong><br>
      <pre style="margin-top: 8px;">${JSON.stringify(args, null, 2)}</pre>
    `;

    modal.classList.add('active');
  });
}

function hideConfirmationModal() {
  const modal = document.getElementById('confirmation-modal');
  modal?.classList.remove('active');
}

// Initialize demo
async function initDemo() {
  logEvent('System', 'Initializing MWP demo...');

  try {
    // Create event bus with logging
    const eventBus = new EventBus();

    // Log all events
    eventBus.on('mcp:tool:invoke-requested', (payload: any) => {
      logEvent('Tool Request', `${payload.toolName} requested`, payload);
    });

    eventBus.on('mcp:tool:invoked', (payload: any) => {
      logEvent('Tool Success', `${payload.toolName} completed`, payload);
    });

    eventBus.on('mcp:tool:error', (payload: any) => {
      logEvent('Tool Error', `${payload.toolName} failed: ${payload.error?.message}`, payload);
    });

    // Create MCP bridge with mock server
    const bridge = new MCPBridge({
      serverName: 'github',
      eventBus,
      // Mock transport for demo
      transport: {
        async start() {
          logEvent('Connection', 'Connected to mock GitHub server');
        },
        async close() {
          logEvent('Connection', 'Disconnected from server');
        },
        async send(request: any) {
          logEvent('Request', `Sending: ${request.method}`, request);

          // Simulate user confirmation for tool execution
          if (request.method === 'tools/call') {
            const approved = await showConfirmationModal(
              request.params.name,
              request.params.arguments
            );

            hideConfirmationModal();

            if (!approved) {
              throw new Error('User cancelled operation');
            }
          }

          // Mock responses
          await new Promise(resolve => setTimeout(resolve, 500));

          if (request.method === 'tools/list') {
            return {
              tools: mockServerInfo.tools
            };
          }

          if (request.method === 'tools/call') {
            if (request.params.name === 'list_repositories') {
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify([
                      {
                        id: 1,
                        name: 'hello-world',
                        full_name: 'octocat/hello-world',
                        description: 'My first repository',
                        html_url: 'https://github.com/octocat/hello-world',
                        language: 'JavaScript',
                        stargazers_count: 42,
                        forks_count: 7,
                        default_branch: 'main'
                      },
                      {
                        id: 2,
                        name: 'awesome-project',
                        full_name: 'octocat/awesome-project',
                        description: 'An awesome project',
                        html_url: 'https://github.com/octocat/awesome-project',
                        language: 'TypeScript',
                        stargazers_count: 128,
                        forks_count: 23,
                        default_branch: 'main'
                      }
                    ])
                  }
                ]
              };
            }

            if (request.params.name === 'create_issue') {
              logEvent('Success', 'Issue created successfully');
              return {
                content: [
                  {
                    type: 'text',
                    text: JSON.stringify({
                      number: Math.floor(Math.random() * 1000),
                      html_url: 'https://github.com/octocat/hello-world/issues/42',
                      state: 'open'
                    })
                  }
                ]
              };
            }
          }

          if (request.method === 'resources/list') {
            return {
              resources: mockServerInfo.resources
            };
          }

          if (request.method === 'resources/read') {
            return {
              contents: [
                {
                  uri: request.params.uri,
                  text: '# Sample Repository\n\nThis is a mock repository for demo purposes.'
                }
              ]
            };
          }

          return {};
        },
        onmessage: null,
        onerror: null,
        onclose: null
      } as any
    });

    // Create dependencies
    const dependencies: types.Dependencies = {
      EventBus: EventBus as any,
      MCPBridge: MCPBridge as any,
      Configuration: Configuration as any
    };

    // Initialize GitHub widget
    const widgetFactory = createGitHubWidget(dependencies, mockServerInfo);

    // Get widget element
    const widgetElement = document.getElementById('github-widget') as any;
    if (widgetElement) {
      widgetElement.setDependencies(eventBus, bridge, Configuration);
      widgetElement.setServerInfo(mockServerInfo);
    }

    // Initialize widget
    await widgetFactory.api.initialize();

    logEvent('System', 'Widget initialized successfully');

    // Update status badge
    const statusBadge = document.getElementById('status');
    if (statusBadge) {
      statusBadge.textContent = 'Connected';
    }

  } catch (error) {
    logEvent('Error', `Initialization failed: ${error}`);
    console.error('Demo initialization failed:', error);
  }
}

// Setup modal handlers
function setupModalHandlers() {
  const cancelBtn = document.getElementById('modal-cancel');
  const approveBtn = document.getElementById('modal-approve');

  cancelBtn?.addEventListener('click', () => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(false);
      pendingConfirmation = null;
    }
    hideConfirmationModal();
  });

  approveBtn?.addEventListener('click', () => {
    if (pendingConfirmation) {
      pendingConfirmation.resolve(true);
      pendingConfirmation = null;
    }
    hideConfirmationModal();
  });
}

// Start demo
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    setupModalHandlers();
    initDemo();
  });
} else {
  setupModalHandlers();
  initDemo();
}
