# Blueprint 0x000062: Penteract Multi-Agent Analytics Visualizer

**Objective:** Provide real-time visualization of Penteract consensus test results with agent performance analytics and metrics dashboard.

**Target Upgrade:** PenteractVisualizer (`penteract-visualizer.js`)

**Prerequisites:** 0x000024 (Penteract Analytics), 0x00001C (EventBus)

**Affected Artifacts:** `/upgrades/penteract-visualizer.js`

---

### 1. The Strategic Imperative

Multi-agent consensus testing (Penteract / H5 deliberation) requires comprehensive visualization:

- **Consensus Monitoring**: Real-time display of consensus test status (success/failure)
- **Agent Performance**: Individual agent metrics (tokens, execution time, status)
- **Pass Rate Analysis**: Aggregate statistics across all participating agents
- **Event-Driven Updates**: Automatic refresh when new analytics data arrives
- **Dashboard Integration**: Embeddable widget for the module dashboard
- **Historical Context**: Timestamp tracking for consensus run history

The Penteract Visualizer provides a visual scaffold for monitoring multi-agent deliberation results, helping developers understand consensus behavior and agent performance.

### 2. The Architectural Solution

The `/upgrades/penteract-visualizer.js` implements an **event-driven visualizer** that listens for analytics snapshots and renders them in both a standalone UI panel and a widget component.

#### Module Architecture

```javascript
const PenteractVisualizer = {
  metadata: {
    id: 'PenteractVisualizer',
    version: '0.1.0',
    description: 'Visual scaffold for Penteract (H5) deliberation analytics',
    dependencies: ['EventBus', 'Utils', 'PenteractAnalytics'],
    async: false,
    type: 'visualizer'
  },

  factory: (deps) => {
    const { EventBus, Utils, PenteractAnalytics } = deps;
    const { logger } = Utils;

    let container = null;
    let latestSnapshot = null;

    const handleAnalytics = (snapshot) => {
      latestSnapshot = snapshot;
      render();
    };

    const refreshFromStore = () => {
      const snapshot = PenteractAnalytics.getLatest();
      if (snapshot) {
        latestSnapshot = snapshot;
        render();
      }
    };

    const init = (containerId = 'penteract-visualizer') => {
      container = document.getElementById(containerId);
      ensureStyles();
      refreshFromStore();
      render();
    };

    // Event subscriptions
    const unsubscribeProcessed = EventBus.on('paxos:analytics:processed', handleAnalytics, 'PenteractVisualizer');
    const unsubscribeRaw = EventBus.on('paxos:analytics', () => refreshFromStore(), 'PenteractVisualizer');

    return {
      init,
      dispose,
      getLatestSnapshot: () => latestSnapshot,
      widget: createWidget()
    };
  }
};
```

#### Snapshot Data Structure

```javascript
// Expected analytics snapshot format
const snapshot = {
  consensus: {
    status: 'success' | 'failure',
    // ... other consensus data
  },
  agents: [
    {
      name: 'Agent1',
      model: 'claude-3-5-sonnet',
      status: 'PASS' | 'FAIL' | 'ERROR',
      token_count: 1234,
      execution_time: '2.45s'
    },
    // ... more agents
  ],
  metrics: {
    totals: {
      total: 5,
      pass: 4,
      fail: 1,
      error: 0
    }
  },
  task: 'Implement feature X',
  timestamp: 1234567890
};
```

#### Rendering Logic

```javascript
const render = () => {
  if (!container) {
    return;
  }

  if (!latestSnapshot) {
    container.innerHTML = `
      <section class="penteract-panel">
        <header>
          <h3>Penteract Analytics</h3>
          <p>Awaiting Paxos runs...</p>
        </header>
      </section>
    `;
    return;
  }

  const { consensus, agents, task, timestamp } = latestSnapshot;
  const statusClass = consensus.status === 'success' ? 'status-success' : 'status-failure';

  const agentRows = agents.map(agent => `
    <tr>
      <td>${agent.name}</td>
      <td>${agent.model}</td>
      <td class="${agent.status.toLowerCase()}">${agent.status}</td>
      <td>${agent.token_count}</td>
      <td>${agent.execution_time}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <section class="penteract-panel">
      <header>
        <h3>Penteract Analytics</h3>
        <p class="${statusClass}">${consensus.status.toUpperCase()} • ${new Date(timestamp).toLocaleString()}</p>
        <p class="task">${task}</p>
      </header>
      <div class="penteract-body">
        <table class="agent-summary">
          <thead>
            <tr>
              <th>Agent</th>
              <th>Model</th>
              <th>Status</th>
              <th>Tokens</th>
              <th>Time (s)</th>
            </tr>
          </thead>
          <tbody>
            ${agentRows}
          </tbody>
        </table>
      </div>
    </section>
  `;
};
```

#### Widget Component

```javascript
class PenteractVisualizerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this._updateListener = () => this.render();
    EventBus.on('paxos:analytics:processed', this._updateListener, 'PenteractVisualizerWidget');
  }

  disconnectedCallback() {
    if (this._updateListener) {
      EventBus.off('paxos:analytics:processed', this._updateListener);
    }
  }

  getStatus() {
    const hasData = !!latestSnapshot;
    const isSuccess = latestSnapshot?.consensus?.status === 'success';

    return {
      state: hasData ? (isSuccess ? 'active' : 'warning') : 'idle',
      primaryMetric: hasData ? 'Visualizing' : 'No data',
      secondaryMetric: latestSnapshot ? `${latestSnapshot.metrics?.totals?.total || 0} agents` : 'Waiting',
      lastActivity: latestSnapshot?.timestamp || null
    };
  }

  render() {
    // Shadow DOM rendering with metrics, agent status, pass rate
    this.shadowRoot.innerHTML = `
      <style>
        /* Styling for widget panel */
      </style>
      <div class="penteract-visualizer-panel">
        <h4>◎ Penteract Visualizer</h4>
        <div class="controls">
          <button class="refresh-viz">↻ Refresh</button>
        </div>
        ${latestSnapshot ? `
          <div class="viz-info">
            <div class="viz-stat">
              <span class="stat-label">Last Updated:</span>
              <span class="stat-value">${formatTime(latestSnapshot.timestamp)}</span>
            </div>
            <div class="viz-stat">
              <span class="stat-label">Status:</span>
              <span class="stat-value">${latestSnapshot.consensus?.status}</span>
            </div>
            <div class="viz-stat">
              <span class="stat-label">Pass Rate:</span>
              <span class="stat-value">
                ${latestSnapshot.metrics?.totals?.pass}/${latestSnapshot.metrics?.totals?.total}
              </span>
            </div>
          </div>
        ` : `
          <p>No visualization data available</p>
        `}
      </div>
    `;
  }
}

customElements.define('penteract-visualizer-widget', PenteractVisualizerWidget);
```

### 3. Core Responsibilities

1. **Event Subscription**: Listen for `paxos:analytics:processed` events
2. **Data Storage**: Maintain `latestSnapshot` for current consensus run
3. **Standalone Rendering**: Render full analytics panel in designated container
4. **Widget Rendering**: Provide compact widget view for dashboard
5. **Style Management**: Inject CSS styles for panel and table formatting
6. **Metric Calculation**: Display pass rate, agent count, execution times
7. **Refresh API**: Manual refresh from PenteractAnalytics store

### 4. The Implementation Pathway

#### Step 1: Event Subscription Setup

```javascript
const handleAnalytics = (snapshot) => {
  latestSnapshot = snapshot;
  render();
};

const refreshFromStore = () => {
  if (!PenteractAnalytics || typeof PenteractAnalytics.getLatest !== 'function') {
    return;
  }
  const snapshot = PenteractAnalytics.getLatest();
  if (snapshot) {
    latestSnapshot = snapshot;
    render();
  }
};

// Subscribe to analytics events
const unsubscribeProcessed = EventBus.on('paxos:analytics:processed', handleAnalytics, 'PenteractVisualizer');
const unsubscribeRaw = EventBus.on('paxos:analytics', () => refreshFromStore(), 'PenteractVisualizer');
```

#### Step 2: Style Injection

```javascript
const STYLE_ID = 'penteract-visualizer-styles';

const ensureStyles = () => {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const styles = document.createElement('style');
  styles.id = STYLE_ID;
  styles.textContent = `
    .penteract-panel {
      background: #1b1b1d;
      border: 1px solid #333;
      border-radius: 8px;
      padding: 16px;
      color: #e0e0e0;
      font-family: 'Monaco', 'Menlo', monospace;
    }

    .penteract-panel table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }

    .penteract-panel td.pass { color: #4ec9b0; }
    .penteract-panel td.fail { color: #ffd700; }
    .penteract-panel td.error { color: #f48771; }

    .penteract-panel .status-success { color: #4ec9b0; }
    .penteract-panel .status-failure { color: #f48771; }
  `;

  document.head.appendChild(styles);
};
```

#### Step 3: Agent Table Rendering

```javascript
const renderAgentTable = (agents) => {
  const agentRows = agents.map(agent => `
    <tr>
      <td>${agent.name}</td>
      <td>${agent.model}</td>
      <td class="${agent.status.toLowerCase()}">${agent.status}</td>
      <td>${agent.token_count}</td>
      <td>${agent.execution_time}</td>
    </tr>
  `).join('');

  return `
    <table class="agent-summary">
      <thead>
        <tr>
          <th>Agent</th>
          <th>Model</th>
          <th>Status</th>
          <th>Tokens</th>
          <th>Time (s)</th>
        </tr>
      </thead>
      <tbody>
        ${agentRows}
      </tbody>
    </table>
  `;
};
```

#### Step 4: Widget Status Implementation

```javascript
class PenteractVisualizerWidget extends HTMLElement {
  getStatus() {
    const hasData = !!latestSnapshot;
    const isSuccess = latestSnapshot?.consensus?.status === 'success';

    return {
      state: hasData ? (isSuccess ? 'active' : 'warning') : 'idle',
      primaryMetric: hasData ? 'Visualizing' : 'No data',
      secondaryMetric: latestSnapshot
        ? `${latestSnapshot.metrics?.totals?.total || 0} agents`
        : 'Waiting',
      lastActivity: latestSnapshot?.timestamp
        ? new Date(latestSnapshot.timestamp).getTime()
        : null
    };
  }

  connectedCallback() {
    this.render();
    this._updateListener = () => this.render();
    EventBus.on('paxos:analytics:processed', this._updateListener, 'PenteractVisualizerWidget');
  }

  disconnectedCallback() {
    if (this._updateListener) {
      EventBus.off('paxos:analytics:processed', this._updateListener);
    }
  }
}
```

#### Step 5: Metrics Dashboard

```javascript
const renderMetrics = (snapshot) => {
  const { metrics, consensus, timestamp } = snapshot;
  const totals = metrics?.totals || { total: 0, pass: 0, fail: 0, error: 0 };
  const passRate = totals.total > 0
    ? Math.round((totals.pass / totals.total) * 100)
    : 0;

  return `
    <div class="viz-info">
      <div class="viz-stat">
        <span class="stat-label">Last Updated:</span>
        <span class="stat-value">${new Date(timestamp).toLocaleString()}</span>
      </div>

      <div class="viz-stat">
        <span class="stat-label">Status:</span>
        <span class="stat-value" style="color: ${consensus.status === 'success' ? '#0c0' : '#f66'};">
          ${consensus.status}
        </span>
      </div>

      <div class="viz-stat">
        <span class="stat-label">Agents Visualized:</span>
        <span class="stat-value">${totals.total}</span>
      </div>

      <div class="viz-stat">
        <span class="stat-label">Pass Rate:</span>
        <span class="stat-value">
          ${totals.pass}/${totals.total} (${passRate}%)
        </span>
      </div>
    </div>
  `;
};
```

#### Step 6: Module Cleanup

```javascript
const dispose = () => {
  unsubscribeProcessed?.();
  unsubscribeRaw?.();
};

return {
  init,
  dispose,
  getLatestSnapshot: () => latestSnapshot,
  widget: createWidget()
};
```

### 5. Operational Safeguards & Quality Gates

- **Null Safety**: Check for `latestSnapshot` before rendering
- **Event Cleanup**: Unsubscribe from EventBus on disposal
- **Style Deduplication**: Only inject styles once (check `STYLE_ID`)
- **Container Validation**: Verify container exists before rendering
- **Data Validation**: Handle missing or malformed analytics snapshots
- **Timestamp Formatting**: Use `toLocaleString()` for readable dates

### 6. Widget Protocol Compliance

**Required `getStatus()` Method:**

```javascript
getStatus() {
  return {
    state: 'idle' | 'active' | 'warning',
    primaryMetric: 'Visualizing' | 'No data',
    secondaryMetric: `${agentCount} agents` | 'Waiting',
    lastActivity: timestamp | null
  };
}
```

**Widget Registration:**

```javascript
return {
  element: 'penteract-visualizer-widget',
  displayName: 'Penteract Visualizer',
  icon: '◎',
  category: 'paxos',
  order: 90
};
```

### 7. Extension Points

- **Historical Trends**: Show graphs of pass rate over time
- **Agent Comparison**: Highlight performance differences between agents
- **Filter Controls**: Filter by agent, model, or status
- **Export Reports**: Generate CSV or JSON exports of analytics data
- **Real-Time Streaming**: Live updates during consensus execution
- **Chart Visualizations**: Add D3.js or Chart.js for graphical analytics

Use this blueprint when implementing multi-agent testing, debugging Penteract consensus, or analyzing agent performance in distributed deliberation scenarios.
