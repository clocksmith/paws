/**
 * Reploid Lens Dashboard Host
 *
 * Loads and manages all Reploid Lens widgets
 * Provides dependency injection and event coordination
 */

// Production mode - use real Reploid modules
const USE_MOCK_DATA = false;

// Event Bus Implementation
class SimpleEventBus {
  constructor() {
    this.listeners = new Map();
  }

  emit(event, data) {
    console.log(`[EventBus] Emit: ${event}`, data);
    const handlers = this.listeners.get(event) || [];
    handlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error(`[EventBus] Error in handler for ${event}:`, error);
      }
    });
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);

    // Return unsubscribe function
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }
}

// MCP Bridge Implementation (Mock)
class MockMCPBridge {
  constructor(serverName) {
    this.serverName = serverName;
  }

  async callTool(serverName, toolName, args) {
    console.log(`[MCPBridge] callTool: ${serverName}.${toolName}`, args);

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      content: [{ text: JSON.stringify({ success: true }) }],
      isError: false
    };
  }

  async readResource(serverName, uri) {
    console.log(`[MCPBridge] readResource: ${serverName} ${uri}`);
    return {
      uri,
      mimeType: 'text/plain',
      text: 'Mock resource content'
    };
  }

  async getPrompt(serverName, promptName, args) {
    console.log(`[MCPBridge] getPrompt: ${serverName}.${promptName}`, args);
    return {
      messages: []
    };
  }

  async listTools(serverName) {
    console.log(`[MCPBridge] listTools: ${serverName}`);
    return [
      { name: 'get_agent_status', description: 'Get current agent status' },
      { name: 'approve_context', description: 'Approve context selection' },
      { name: 'reject_context', description: 'Reject context selection' },
      { name: 'approve_proposal', description: 'Approve code proposal' },
      { name: 'reject_proposal', description: 'Reject code proposal' },
      { name: 'get_proposal_diff', description: 'Get proposal diff' },
      { name: 'get_vfs_tree', description: 'Get VFS tree structure' },
      { name: 'read_file', description: 'Read file content' }
    ];
  }

  async listResources(serverName) {
    console.log(`[MCPBridge] listResources: ${serverName}`);
    return [];
  }

  async listPrompts(serverName) {
    console.log(`[MCPBridge] listPrompts: ${serverName}`);
    return [];
  }
}

// Configuration Implementation
class SimpleConfiguration {
  constructor() {
    this.config = new Map();
  }

  get(key, defaultValue) {
    return this.config.has(key) ? this.config.get(key) : defaultValue;
  }

  set(key, value) {
    this.config.set(key, value);
  }

  has(key) {
    return this.config.has(key);
  }

  getAll(prefix) {
    const result = {};
    for (const [key, value] of this.config.entries()) {
      if (!prefix || key.startsWith(prefix)) {
        result[key] = value;
      }
    }
    return result;
  }
}

// Dashboard Manager
class DashboardManager {
  constructor() {
    this.eventBus = null;
    this.mcpBridge = null;
    this.configuration = null;
    this.widgets = new Map();
    this.widgetFactories = new Map();
    this.modules = null;
  }

  // Initialize dashboard
  async initialize() {
    console.log('[Dashboard] Initializing...');
    this.showToast('Initializing Reploid Lens Dashboard...', 'info');

    try {
      // Load Reploid modules first
      await this.loadReploidModules();

      // Load widgets
      await this.loadWidgets();

      // Subscribe to global events
      this.subscribeToEvents();

      console.log('[Dashboard] Initialized successfully');
      this.showToast('Dashboard ready', 'success');

      // Update connection status
      this.updateConnectionStatus('CONNECTED');
    } catch (error) {
      console.error('[Dashboard] Initialization failed:', error);
      this.showToast(`Initialization failed: ${error.message}`, 'error');
      this.updateConnectionStatus('ERROR');
    }
  }

  // Load Reploid modules using the boot loader
  async loadReploidModules() {
    console.log('[Dashboard] Loading Reploid modules...');

    try {
      // Import module loader
      const { loadModulePreset } = await import('./upgrades/core/boot-module-loader.js');

      // Load minimal-rsi preset (includes all MCP servers)
      this.modules = await loadModulePreset('minimal-rsi');

      console.log(`[Dashboard] Loaded ${Object.keys(this.modules).length} Reploid modules`);

      // Use real Reploid dependencies
      this.eventBus = this.modules.EventBus;
      this.configuration = this.modules.StateManager || new SimpleConfiguration();

      // Create real MCP bridge using ReploidMCPBridge
      if (this.modules.ReploidMCPBridge) {
        this.mcpBridge = this.modules.ReploidMCPBridge;
      } else {
        // Fallback to mock if not available
        console.warn('[Dashboard] ReploidMCPBridge not available, using mock');
        this.eventBus = new SimpleEventBus();
        this.mcpBridge = new MockMCPBridge('reploid-workflow');
        this.configuration = new SimpleConfiguration();
      }

      this.showToast(`Loaded ${Object.keys(this.modules).length} modules`, 'success');
    } catch (error) {
      console.error('[Dashboard] Failed to load Reploid modules:', error);
      this.showToast('Using mock dependencies (modules not loaded)', 'warn');

      // Fallback to mock dependencies
      this.eventBus = new SimpleEventBus();
      this.mcpBridge = new MockMCPBridge('reploid-workflow');
      this.configuration = new SimpleConfiguration();
    }
  }

  // Load all widgets
  async loadWidgets() {
    const serverInfo = {
      serverName: 'reploid-workflow',
      capabilities: { tools: true, resources: false, prompts: false }
    };

    const deps = {
      EventBus: this.eventBus,
      MCPBridge: this.mcpBridge,
      Configuration: this.configuration
    };

    try {
      // Load Agent Control Widget
      await this.loadWidget(
        'agent-control',
        '../lens/widgets/reploid/agent-control-widget.ts',
        deps,
        serverInfo,
        'agent-control-panel'
      );

      // Load Metrics Dashboard Widget
      await this.loadWidget(
        'metrics',
        '../lens/widgets/reploid/metrics-widget.ts',
        deps,
        serverInfo,
        'metrics-panel'
      );

      // Load Agent Visualizer Widget
      await this.loadWidget(
        'agent-viz',
        '../lens/widgets/reploid/agent-viz-widget.ts',
        deps,
        serverInfo,
        'agent-viz-panel'
      );

      // Load VFS Explorer Widget
      await this.loadWidget(
        'vfs-explorer',
        '../lens/widgets/reploid/vfs-explorer-widget.ts',
        deps,
        serverInfo,
        'vfs-explorer-panel'
      );

      // Load Diff Viewer Widget
      await this.loadWidget(
        'diff-viewer',
        '../lens/widgets/reploid/diff-viewer-widget.ts',
        deps,
        serverInfo,
        'diff-viewer-panel'
      );

      // Load Sentinel Panel Widget (CRITICAL - approval workflows)
      await this.loadWidget(
        'sentinel-panel',
        '../lens/widgets/reploid/sentinel-panel-widget.ts',
        deps,
        serverInfo,
        'sentinel-panel-panel'
      );

      // Load Status Bar Widget
      await this.loadWidget(
        'status-bar',
        '../lens/widgets/reploid/status-bar-widget.ts',
        deps,
        serverInfo,
        'status-bar-panel'
      );

      // Load Log Panel Widget
      await this.loadWidget(
        'log-panel',
        '../lens/widgets/reploid/log-panel-widget.ts',
        deps,
        serverInfo,
        'log-panel-panel'
      );

      // Load Thought Panel Widget
      await this.loadWidget(
        'thought-panel',
        '../lens/widgets/reploid/thought-panel-widget.ts',
        deps,
        serverInfo,
        'thought-panel-panel'
      );

      // Load Progress Tracker Widget
      await this.loadWidget(
        'progress-tracker',
        '../lens/widgets/reploid/progress-tracker-widget.ts',
        deps,
        serverInfo,
        'progress-tracker-panel'
      );

      // Load Toast Notifications Widget
      await this.loadWidget(
        'toast-notifications',
        '../lens/widgets/reploid/toast-notifications-widget.ts',
        deps,
        serverInfo,
        'toast-notifications-panel'
      );

      // Load AST Visualizer Widget
      await this.loadWidget(
        'ast-visualizer',
        '../lens/widgets/reploid/ast-visualizer-widget.ts',
        deps,
        serverInfo,
        'ast-visualizer-panel'
      );

      console.log(`[Dashboard] Loaded ${this.widgets.size} widgets`);
      document.getElementById('widget-count').textContent = `${this.widgets.size}/12`;
    } catch (error) {
      console.error('[Dashboard] Failed to load widgets:', error);
      throw error;
    }
  }

  // Load individual widget
  async loadWidget(widgetId, modulePath, deps, serverInfo, containerId) {
    console.log(`[Dashboard] Loading widget: ${widgetId}`);

    try {
      // Import widget module
      const module = await import(modulePath);
      const createWidget = module.default;

      if (typeof createWidget !== 'function') {
        throw new Error(`Widget ${widgetId} does not export a factory function`);
      }

      // Create widget
      const widgetFactory = createWidget(deps, serverInfo);
      this.widgetFactories.set(widgetId, widgetFactory);

      // Initialize widget
      await widgetFactory.api.initialize();

      // Create widget element
      const widgetElement = document.createElement(widgetFactory.widget.element);
      this.widgets.set(widgetId, widgetElement);

      // Mount widget
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = '';
        container.appendChild(widgetElement);
      } else {
        throw new Error(`Container ${containerId} not found`);
      }

      console.log(`[Dashboard] Widget ${widgetId} loaded successfully`);
    } catch (error) {
      console.error(`[Dashboard] Failed to load widget ${widgetId}:`, error);

      // Show error in container
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = `
          <div class="error">
            <div class="error-icon">⚠️</div>
            <div>Failed to load widget: ${widgetId}</div>
            <div style="font-size: 11px; color: #888; margin-top: 8px;">
              ${error.message}
            </div>
          </div>
        `;
      }

      throw error;
    }
  }

  // Subscribe to global events
  subscribeToEvents() {
    // Widget lifecycle events
    this.eventBus.on('mcp:widget:initialized', (data) => {
      console.log('[Dashboard] Widget initialized:', data);
      this.logEvent(`Widget initialized: ${data.element || 'unknown'}`, 'success');
    });

    this.eventBus.on('mcp:widget:error', (data) => {
      console.error('[Dashboard] Widget error:', data);
      this.showToast(`Widget error: ${data.error.message}`, 'error');
      this.logEvent(`Widget error: ${data.error.message}`, 'error');
    });

    // FSM events
    this.eventBus.on('fsm:state:changed', (data) => {
      console.log('[Dashboard] FSM state changed:', data);
      this.logEvent(`State: ${data.oldState} → ${data.newState}`, 'info');
      this.updateWorkflowStatus(data.newState, 'success');
    });

    this.eventBus.on('status:updated', (data) => {
      console.log('[Dashboard] Status update:', data);
      this.logEvent(`${data.state}: ${data.detail}`, 'info');
    });

    // Workflow events
    this.eventBus.on('agent:idle', () => {
      this.logEvent('Agent is idle', 'info');
      this.updateWorkflowStatus('IDLE', 'info');
      // Show start button, hide stop button
      document.getElementById('start-workflow-btn').style.display = 'inline-block';
      document.getElementById('stop-workflow-btn').style.display = 'none';
    });

    this.eventBus.on('agent:curating', (data) => {
      this.logEvent(`Curating context for: ${data.goal}`, 'info');
    });

    this.eventBus.on('agent:awaiting:context', () => {
      this.logEvent('Waiting for context approval', 'warn');
      this.showToast('Context approval required', 'warn');
    });

    this.eventBus.on('agent:planning', () => {
      this.logEvent('Planning with approved context', 'info');
    });

    this.eventBus.on('agent:generating', () => {
      this.logEvent('Generating proposal', 'info');
    });

    this.eventBus.on('agent:applying', () => {
      this.logEvent('Applying changeset', 'info');
    });

    this.eventBus.on('agent:reflecting', () => {
      this.logEvent('Reflecting on cycle', 'info');
    });

    this.eventBus.on('agent:error', (data) => {
      this.logEvent(`Error: ${data.message}`, 'error');
      this.showToast(`Agent error: ${data.message}`, 'error');
    });

    this.eventBus.on('cycle:complete', (data) => {
      this.logEvent(`Cycle complete! (${data.cycleNumber} cycles)`, 'success');
      this.showToast('Workflow cycle completed', 'success');
    });

    // Diff events
    this.eventBus.on('diff:show', (data) => {
      this.logEvent('Proposal diff ready for review', 'info');
    });

    // Reploid-specific events
    this.eventBus.on('reploid:changes:applied', (data) => {
      this.showToast(`Applied ${data.count} changes`, 'success');
      this.logEvent(`Applied ${data.count} changes`, 'success');
    });

    this.eventBus.on('reploid:vfs:file-selected', (data) => {
      console.log('[Dashboard] File selected:', data.path);
      this.logEvent(`Selected: ${data.path}`, 'info');
    });

    this.eventBus.on('reploid:vfs:file-opened', (data) => {
      console.log('[Dashboard] File opened:', data.path);
      this.showToast(`Opened: ${data.path}`, 'info');
      this.logEvent(`Opened: ${data.path}`, 'info');
    });
  }

  // Refresh specific widget
  async refreshWidget(widgetId) {
    console.log(`[Dashboard] Refreshing widget: ${widgetId}`);

    const factory = this.widgetFactories.get(widgetId);
    if (factory) {
      try {
        await factory.api.refresh();
        this.showToast(`Refreshed: ${widgetId}`, 'success');
      } catch (error) {
        console.error(`[Dashboard] Failed to refresh widget ${widgetId}:`, error);
        this.showToast(`Failed to refresh: ${widgetId}`, 'error');
      }
    }
  }

  // Refresh all widgets
  async refreshAll() {
    console.log('[Dashboard] Refreshing all widgets...');
    this.showToast('Refreshing all widgets...', 'info');

    const refreshPromises = Array.from(this.widgetFactories.keys()).map(
      widgetId => this.refreshWidget(widgetId)
    );

    await Promise.all(refreshPromises);
  }

  // Toggle fullscreen
  toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  // Update connection status
  updateConnectionStatus(status) {
    const statusEl = document.getElementById('connection-status');
    if (statusEl) {
      statusEl.textContent = status;
    }

    const modeEl = document.getElementById('mode');
    if (modeEl) {
      modeEl.textContent = USE_MOCK_DATA ? 'DEVELOPMENT' : 'PRODUCTION';
    }
  }

  // Show toast notification
  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Auto-remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideIn 0.3s ease-out reverse';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Start workflow
  async startWorkflow() {
    const goalInput = document.getElementById('workflow-goal-input');
    const goal = goalInput.value.trim();

    if (!goal) {
      this.showToast('Please enter a goal', 'warn');
      return;
    }

    if (!this.modules || !this.modules.SentinelFSM) {
      this.showToast('SentinelFSM not loaded', 'error');
      return;
    }

    try {
      console.log(`[Dashboard] Starting workflow with goal: "${goal}"`);
      this.logEvent(`Starting workflow: ${goal}`, 'info');
      this.updateWorkflowStatus('Starting...', 'info');

      const result = await this.modules.SentinelFSM.startCycle(goal);

      if (result) {
        this.showToast('Workflow started successfully', 'success');
        this.updateWorkflowStatus('Running', 'success');

        // Toggle buttons
        document.getElementById('start-workflow-btn').style.display = 'none';
        document.getElementById('stop-workflow-btn').style.display = 'inline-block';
      } else {
        this.showToast('Failed to start workflow', 'error');
        this.updateWorkflowStatus('Error', 'error');
      }
    } catch (error) {
      console.error('[Dashboard] Error starting workflow:', error);
      this.showToast(`Error: ${error.message}`, 'error');
      this.updateWorkflowStatus('Error', 'error');
      this.logEvent(`Error: ${error.message}`, 'error');
    }
  }

  // Stop workflow
  async stopWorkflow() {
    if (!this.modules || !this.modules.SentinelFSM) {
      this.showToast('SentinelFSM not loaded', 'error');
      return;
    }

    try {
      console.log('[Dashboard] Stopping workflow...');
      this.logEvent('Stopping workflow', 'warn');

      // Reset FSM state (if there's a stop method)
      // For now, just update UI
      this.showToast('Workflow stopped', 'warn');
      this.updateWorkflowStatus('Stopped', 'warn');

      // Toggle buttons
      document.getElementById('start-workflow-btn').style.display = 'inline-block';
      document.getElementById('stop-workflow-btn').style.display = 'none';
    } catch (error) {
      console.error('[Dashboard] Error stopping workflow:', error);
      this.showToast(`Error: ${error.message}`, 'error');
    }
  }

  // Update workflow status
  updateWorkflowStatus(status, type = 'info') {
    const statusEl = document.getElementById('workflow-status');
    if (statusEl) {
      statusEl.textContent = status;
      statusEl.style.borderColor = type === 'error' ? '#ff4444' :
                                   type === 'warn' ? '#ffc107' :
                                   type === 'success' ? '#4ec9b0' :
                                   'rgba(78, 201, 176, 0.3)';
    }
  }

  // Log event to event log panel
  logEvent(message, level = 'info') {
    const logPanel = document.getElementById('event-log-panel');
    if (!logPanel) return;

    const timestamp = new Date().toLocaleTimeString();
    const color = level === 'error' ? '#ff4444' :
                  level === 'warn' ? '#ffc107' :
                  level === 'success' ? '#4ec9b0' :
                  '#888';

    const entry = document.createElement('div');
    entry.style.marginBottom = '4px';
    entry.innerHTML = `<span style="color: ${color}">[${timestamp}]</span> ${message}`;

    // Remove "Waiting for events..." message if it exists
    if (logPanel.querySelector('[style*="color: #888"]')?.textContent.includes('Waiting')) {
      logPanel.innerHTML = '';
    }

    logPanel.appendChild(entry);
    logPanel.scrollTop = logPanel.scrollHeight;

    // Keep only last 100 entries
    while (logPanel.children.length > 100) {
      logPanel.removeChild(logPanel.firstChild);
    }
  }

  // Clear event log
  clearEventLog() {
    const logPanel = document.getElementById('event-log-panel');
    if (logPanel) {
      logPanel.innerHTML = '<div style="color: #888;">Event log cleared</div>';
      this.showToast('Event log cleared', 'info');
    }
  }
}

// Create global dashboard instance
const dashboard = new DashboardManager();
window.dashboard = dashboard;

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
  console.log('[Dashboard] DOM loaded, initializing...');
  dashboard.initialize().catch(error => {
    console.error('[Dashboard] Fatal initialization error:', error);
  });
});

// Handle errors
window.addEventListener('error', (event) => {
  console.error('[Dashboard] Uncaught error:', event.error);
  dashboard.showToast(`Error: ${event.error?.message || 'Unknown error'}`, 'error');
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Dashboard] Unhandled promise rejection:', event.reason);
  dashboard.showToast(`Promise rejection: ${event.reason?.message || 'Unknown'}`, 'error');
});

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  console.log('[Dashboard] Cleaning up...');
  dashboard.widgetFactories.forEach(async (factory, widgetId) => {
    try {
      await factory.api.destroy();
    } catch (error) {
      console.error(`[Dashboard] Failed to destroy widget ${widgetId}:`, error);
    }
  });
});

console.log('[Dashboard] Host script loaded');
