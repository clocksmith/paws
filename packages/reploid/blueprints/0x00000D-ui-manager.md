# Blueprint 0x00000D: UI Management

**Objective:** To detail the architecture for managing the agent's developer console UI, including rendering, event handling, and state display.

**Target Upgrade:** UIMN (`ui-manager.js`)


**Prerequisites:** `0x00000E`, `0x00000F`

**Affected Artifacts:** `/modules/ui-manager.js`

---

### 1. The Strategic Imperative

The agent needs an interface to communicate with its human operator. A dedicated `UIManager` module is required to encapsulate all the logic for manipulating the DOM. This separation is critical: the agent's core cognitive logic (`agent-cycle.js`) should not contain any direct DOM manipulation code. The `UIManager` provides a clean, declarative API (e.g., `UI.logToTimeline(...)`, `UI.displayCycleArtifact(...)`) that the core logic can call, keeping the concerns of "thinking" and "displaying" separate.

### 2. The Architectural Solution

The `/upgrades/ui-manager.js` is a comprehensive UI orchestration module that manages the agent's browser-based developer console. It coordinates multiple visualization panels, handles WebSocket-based progress streaming, and provides a real-time activity monitoring widget.

#### Module Structure

```javascript
const UI = {
  metadata: {
    id: 'UI',
    version: '4.0.0',
    description: 'Central UI management with browser-native visualizer integration',
    dependencies: [
      'config', 'Utils', 'StateManager', 'DiffGenerator', 'EventBus',
      'VFSExplorer', 'PerformanceMonitor', 'MetricsDashboard', 'Introspector',
      'ReflectionStore', 'SelfTester', 'BrowserAPIs', 'AgentVisualizer',
      'ASTVisualizer', 'ModuleGraphVisualizer', 'ToastNotifications',
      'TutorialSystem', 'PyodideRuntime', 'LocalLLM'
    ],
    async: true,
    type: 'ui'
  },

  factory: (deps) => {
    // Internal UI activity statistics
    const uiStats = {
      sessionStart: Date.now(),
      thoughtUpdates: 0,
      goalUpdates: 0,
      statusBarUpdates: 0,
      panelSwitches: 0,
      progressEventsReceived: 0,
      currentPanel: null,
      lastActivity: null,
      panelUsage: {}  // { panelName: count }
    };

    // WebSocket connection for progress streaming
    let progressSocket = null;

    // Web Component Widget (closure access to uiStats)
    class UIManagerWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this._updateInterval = null;
      }

      set moduleApi(api) {
        this._api = api;
        this.render();
      }

      connectedCallback() {
        this.render();
        this._updateInterval = setInterval(() => this.render(), 5000);
      }

      disconnectedCallback() {
        if (this._updateInterval) {
          clearInterval(this._updateInterval);
          this._updateInterval = null;
        }
      }

      getStatus() {
        const hasRecentActivity = uiStats.lastActivity &&
          (Date.now() - uiStats.lastActivity < 30000);
        const totalUpdates = uiStats.thoughtUpdates +
          uiStats.goalUpdates +
          uiStats.statusBarUpdates;

        return {
          state: hasRecentActivity ? 'active'
            : (totalUpdates > 0 ? 'idle' : 'disabled'),
          primaryMetric: uiStats.currentPanel
            ? `Panel: ${uiStats.currentPanel}`
            : `${totalUpdates} updates`,
          secondaryMetric: `${uiStats.progressEventsReceived} events`,
          lastActivity: uiStats.lastActivity,
          message: hasRecentActivity ? 'Active' : null
        };
      }

      getControls() {
        return [
          { id: 'panel-thoughts', label: '☁ Thoughts Panel', action: () => { /* ... */ } },
          { id: 'panel-performance', label: '☱ Performance Panel', action: () => { /* ... */ } },
          { id: 'panel-logs', label: '✎ Logs Panel', action: () => { /* ... */ } }
        ];
      }

      renderPanel() {
        // Returns HTML with:
        // - Total updates, panel switches, progress events
        // - Update breakdown (thoughts, goals, status bar)
        // - Current active panel
        // - Panel usage statistics (top 5 with percentages)
        // - WebSocket connection status
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>/* Shadow DOM styles */</style>
          ${this.renderPanel()}
        `;
      }
    }

    const elementName = 'ui-manager-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, UIManagerWidget);
    }

    return {
      init,
      updateGoal,
      api: {
        updateGoal,
        streamThought,
        updateStatusBar
      },
      widget: {
        element: elementName,
        displayName: 'UI Manager',
        icon: '⌨️',
        category: 'ui',
        order: 5,
        updateInterval: 5000
      }
    };
  }
};
```

#### Core Responsibilities

1.  **Panel Management**: Orchestrates multiple visualization panels (thoughts, performance, logs, introspection, reflection, testing, API docs, AST viewer, Python REPL, Local LLM)
2.  **Progress Streaming**: Establishes WebSocket connection to receive real-time progress events from agent execution
3.  **Event Processing**: Handles progress events and dispatches them via EventBus for reactive UI updates
4.  **Activity Tracking**: Maintains comprehensive statistics on UI interactions, panel usage, and update frequency
5.  **DOM Initialization**: Injects UI template and styles on startup, caches element references
6.  **State Synchronization**: Provides `updateGoal()`, `streamThought()`, and `updateStatusBar()` methods for agent-driven UI updates

#### Progress Event Handling

The UIManager connects to a WebSocket endpoint for streaming progress events:

```javascript
const handleProgressMessage = (event) => {
  const payload = JSON.parse(event.data);

  // Emit via EventBus for reactive subscribers
  EventBus.emit('progress:event', payload);

  // Log to advanced timeline
  logProgressEvent(payload);

  // Update diff viewer if applicable
  updateDiffFromProgress(payload);

  // Track statistics
  uiStats.progressEventsReceived++;
  uiStats.lastActivity = Date.now();
};
```

#### UI Activity Statistics

Widget tracks comprehensive UI metrics:

- **Update Counts**: Thought updates, goal updates, status bar updates
- **Panel Metrics**: Switch count, current active panel, usage distribution
- **Event Tracking**: Progress events received
- **Connection Status**: WebSocket state (connected/disconnected)
- **Session Uptime**: Time since UI initialization

### 3. The Implementation Pathway

#### Step 1: Initialize UI Statistics Tracking

Create a closure-scoped `uiStats` object to track UI activity:

```javascript
const uiStats = {
  sessionStart: Date.now(),
  thoughtUpdates: 0,
  goalUpdates: 0,
  statusBarUpdates: 0,
  panelSwitches: 0,
  progressEventsReceived: 0,
  currentPanel: null,
  lastActivity: null,
  panelUsage: {}
};
```

#### Step 2: Implement DOM Initialization (`init`)

The `init()` function performs the following:

```javascript
const init = async (bootConfig = {}) => {
  // 1. Fetch UI template and styles from VFS
  const templateHtml = await vfs.read('/upgrades/ui-body-template.html');
  const templateCss = await vfs.read('/upgrades/ui-style.css');

  // 2. Inject into DOM
  const styleEl = document.createElement('style');
  styleEl.textContent = templateCss;
  document.head.appendChild(styleEl);
  document.body.innerHTML = templateHtml;

  // 3. Cache element references
  uiRefs = {
    goalInput: document.getElementById('goal-input'),
    thoughtStream: document.getElementById('thought-stream'),
    statusBar: document.getElementById('status-bar'),
    // ... cache all panel containers
  };

  // 4. Set up event listeners
  setupEventListeners();

  // 5. Initialize WebSocket for progress streaming
  connectProgressWebSocket();

  // 6. Restore last active panel
  const lastPanel = localStorage.getItem(STORAGE_KEY_PANEL);
  if (lastPanel) switchToPanel(lastPanel);
};
```

#### Step 3: Establish Progress WebSocket Connection

Connect to WebSocket endpoint for real-time progress events:

```javascript
const connectProgressWebSocket = () => {
  const wsUrl = resolveProgressUrl(); // From config
  progressSocket = new WebSocket(wsUrl);

  progressSocket.onopen = () => {
    logger.info('[UI] Progress WebSocket connected');
  };

  progressSocket.onmessage = (event) => {
    handleProgressMessage(event);
  };

  progressSocket.onerror = (error) => {
    logger.error('[UI] WebSocket error:', error);
  };

  progressSocket.onclose = () => {
    logger.warn('[UI] WebSocket closed, reconnecting...');
    setTimeout(connectProgressWebSocket, 5000);
  };
};
```

#### Step 4: Implement Progress Event Handling

Process incoming progress events and dispatch via EventBus:

```javascript
const handleProgressMessage = (event) => {
  const payload = JSON.parse(event.data);

  // Emit for reactive subscribers
  EventBus.emit('progress:event', payload);

  // Log to timeline
  logProgressEvent(payload);

  // Update diff viewer if applicable
  if (payload.source === 'dogs') {
    updateDiffFromProgress(payload);
  }

  // Track statistics
  uiStats.progressEventsReceived++;
  uiStats.lastActivity = Date.now();
};
```

#### Step 5: Implement Panel Management

Create panel switching logic with state persistence:

```javascript
const switchToPanel = (panelName) => {
  // Hide all panels
  Object.values(uiRefs.panels).forEach(panel => {
    panel.style.display = 'none';
  });

  // Show selected panel
  uiRefs.panels[panelName].style.display = 'block';

  // Update statistics
  uiStats.currentPanel = panelName;
  uiStats.panelSwitches++;
  uiStats.panelUsage[panelName] = (uiStats.panelUsage[panelName] || 0) + 1;
  uiStats.lastActivity = Date.now();

  // Persist to localStorage
  localStorage.setItem(STORAGE_KEY_PANEL, panelName);

  // Emit event
  EventBus.emit('panel:changed', { panel: panelName });
};
```

#### Step 6: Implement UI Update API

Create public methods for agent-driven UI updates:

```javascript
const updateGoal = (goalText) => {
  if (uiRefs.goalInput) {
    uiRefs.goalInput.value = goalText;
  }
  uiStats.goalUpdates++;
  uiStats.lastActivity = Date.now();
};

const streamThought = (thoughtText, append = true) => {
  if (uiRefs.thoughtStream) {
    if (append) {
      uiRefs.thoughtStream.textContent += thoughtText;
    } else {
      uiRefs.thoughtStream.textContent = thoughtText;
    }
  }
  uiStats.thoughtUpdates++;
  uiStats.lastActivity = Date.now();
};

const updateStatusBar = (statusText) => {
  if (uiRefs.statusBar) {
    uiRefs.statusBar.textContent = statusText;
  }
  uiStats.statusBarUpdates++;
  uiStats.lastActivity = Date.now();
};
```

#### Step 7: Create UIManager Widget

Define the Web Component widget inside the factory:

```javascript
class UIManagerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._updateInterval = null;
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  connectedCallback() {
    this.render();
    this._updateInterval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    if (this._updateInterval) {
      clearInterval(this._updateInterval);
      this._updateInterval = null;
    }
  }

  getStatus() {
    const hasRecentActivity = uiStats.lastActivity &&
      (Date.now() - uiStats.lastActivity < 30000);
    const totalUpdates = uiStats.thoughtUpdates +
      uiStats.goalUpdates +
      uiStats.statusBarUpdates;

    return {
      state: hasRecentActivity ? 'active' : (totalUpdates > 0 ? 'idle' : 'disabled'),
      primaryMetric: uiStats.currentPanel || `${totalUpdates} updates`,
      secondaryMetric: `${uiStats.progressEventsReceived} events`,
      lastActivity: uiStats.lastActivity,
      message: hasRecentActivity ? 'Active' : null
    };
  }

  renderPanel() {
    // Render comprehensive UI statistics:
    // - Update counts (thoughts, goals, status bar)
    // - Panel metrics (current, usage distribution)
    // - Progress events
    // - WebSocket connection status
    // - Session uptime
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styles */</style>
      ${this.renderPanel()}
    `;
  }
}

const elementName = 'ui-manager-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, UIManagerWidget);
}
```

#### Step 8: Return Module Interface

Return both public API and widget:

```javascript
return {
  init,
  updateGoal,
  api: {
    updateGoal,
    streamThought,
    updateStatusBar
  },
  widget: {
    element: elementName,
    displayName: 'UI Manager',
    icon: '⌨️',
    category: 'ui',
    order: 5,
    updateInterval: 5000
  }
};
```

#### Step 9: Set Up EventBus Listeners

Subscribe to relevant events for reactive UI updates:

```javascript
EventBus.on('panel:switch', ({ panel }) => {
  switchToPanel(panel);
});

EventBus.on('state:updated', () => {
  updateStateDisplay();
});

EventBus.on('progress:event', (payload) => {
  // Handle specialized progress events
});
```

This architecture separates UI concerns from core agent logic while providing comprehensive activity tracking and real-time progress visualization.