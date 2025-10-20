# Blueprint 0x000053: Tool Execution Visual Panel

**Target Upgrade:** TEXP (`tool-execution-panel.js`)

**Objective:** Provide real-time visual representation of tool executions with interactive cards showing status, progress, and results for enhanced observability during agent operations.

**Prerequisites:** 0x00000D (UI Manager), 0x00000A (Tool Runner Engine), 0x000022 (Event Bus)

**Affected Artifacts:** `/upgrades/tool-execution-panel.js`, `/upgrades/ui-manager.js`, `/boot/style.css`

---

## Section 1: The Strategic Imperative

When the agent executes tools, operators need visibility into:
- **What tools are running** - Real-time execution tracking
- **Tool progress** - Visual progress indicators for long operations
- **Execution results** - Success/failure status with error details
- **Tool history** - Recent execution timeline for debugging

Without visual feedback:
- Operators can't tell if the agent is stuck or working
- Tool failures go unnoticed until logs are checked
- Concurrent tool executions are confusing
- Performance bottlenecks are invisible

The Tool Execution Panel solves this by providing a real-time dashboard of all tool activity.

---

## Section 2: The Architectural Solution

### 2.1 Event-Driven Architecture

The panel listens for tool lifecycle events from the EventBus:

```javascript
EventBus.on('tool:start', handleToolStart);
EventBus.on('tool:complete', handleToolComplete);
EventBus.on('tool:error', handleToolError);
EventBus.on('tool:progress', handleToolProgress);
```

### 2.2 Execution Tracking

Each tool execution is tracked with metadata:

```javascript
const execution = {
  id: 'exec_uuid',
  toolName: 'apply_dogs_bundle',
  args: { dogs_path: '/turn/changes.dogs.md' },
  status: 'running', // pending | running | completed | failed
  startTime: Date.now(),
  endTime: null,
  duration: null,
  progress: 45, // 0-100
  result: null,
  error: null
};

toolExecutions.set(execution.id, execution);
```

### 2.3 Visual Representation

Tool cards show real-time status with color coding:

```javascript
const STATUS_COLORS = {
  'pending': '#ffa500',   // Orange
  'running': '#4fc3f7',   // Blue
  'completed': '#4caf50', // Green
  'failed': '#f44336'     // Red
};

const TOOL_ICONS = {
  'create_cats_bundle': 'ψ',
  'apply_dogs_bundle': '⚡',
  'verify_dogs_bundle': '✓',
  'read_artifact': '◉️',
  'introspect': '⌕',
  'default': '⚙️'
};
```

### 2.4 History Management

To prevent memory bloat, only recent executions are kept:

```javascript
const MAX_HISTORY = 20;

// Remove oldest when exceeding limit
if (toolExecutions.size > MAX_HISTORY) {
  const oldest = Array.from(toolExecutions.keys())[0];
  toolExecutions.delete(oldest);
}
```

### 2.5 Web Component Widget

The widget uses a Web Component with Shadow DOM for encapsulated rendering:

```javascript
class ToolExecutionPanelWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 2 seconds
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const executions = Array.from(toolExecutions.values());
    const running = executions.filter(e => e.status === 'running').length;
    const completed = executions.filter(e => e.status === 'completed').length;
    const failed = executions.filter(e => e.status === 'failed').length;

    return {
      state: running > 0 ? 'active' : 'idle',
      primaryMetric: `${executions.length} tools`,
      secondaryMetric: running > 0 ? `${running} running` : 'Idle',
      lastActivity: executions.length > 0 ? Math.max(...executions.map(e => e.startTime)) : null,
      message: failed > 0 ? `${failed} failed` : `${completed} completed`
    };
  }

  getControls() {
    return [
      {
        id: 'clear-history',
        label: 'Clear History',
        action: () => {
          const completed = Array.from(toolExecutions.entries())
            .filter(([_, e]) => e.status === 'completed' || e.status === 'failed');
          completed.forEach(([id, _]) => toolExecutions.delete(id));
          this.render();
          return { success: true, message: 'Execution history cleared' };
        }
      }
    ];
  }

  render() {
    const executions = Array.from(toolExecutions.values()).reverse();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .tool-exec-panel {
          padding: 12px;
          color: #fff;
          max-height: 600px;
          overflow-y: auto;
        }
        .exec-card {
          background: rgba(255,255,255,0.05);
          border-left: 4px solid;
          padding: 12px;
          margin-bottom: 10px;
          border-radius: 5px;
        }
        .exec-card.running { border-color: #4fc3f7; }
        .exec-card.completed { border-color: #4caf50; }
        .exec-card.failed { border-color: #f44336; }
        .exec-card.pending { border-color: #ffa500; }
        .exec-header {
          display: flex;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        .tool-name {
          font-weight: bold;
          font-size: 14px;
        }
        .tool-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 3px;
          text-transform: uppercase;
        }
        .progress-bar {
          height: 4px;
          background: rgba(255,255,255,0.1);
          border-radius: 2px;
          overflow: hidden;
          margin: 8px 0;
        }
        .progress-fill {
          height: 100%;
          background: #4fc3f7;
          transition: width 0.3s ease;
        }
      </style>
      <div class="tool-exec-panel">
        <h4>⚙️ Tool Executions</h4>
        ${executions.length === 0 ? `
          <div style="text-align: center; color: #888; padding: 40px;">
            No tool executions yet
          </div>
        ` : executions.map(exec => `
          <div class="exec-card ${exec.status}">
            <div class="exec-header">
              <div class="tool-name">
                ${TOOL_ICONS[exec.toolName] || TOOL_ICONS.default} ${exec.toolName}
              </div>
              <div class="tool-status" style="background: ${STATUS_COLORS[exec.status]}">
                ${exec.status}
              </div>
            </div>
            ${exec.status === 'running' && exec.progress ? `
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${exec.progress}%"></div>
              </div>
            ` : ''}
            <div style="font-size: 11px; color: #888;">
              ${exec.duration ? `Duration: ${exec.duration}ms` :
                `Started: ${new Date(exec.startTime).toLocaleTimeString()}`}
            </div>
            ${exec.error ? `
              <div style="color: #f44336; font-size: 11px; margin-top: 5px;">
                Error: ${exec.error}
              </div>
            ` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Register custom element
const elementName = 'tool-execution-panel-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, ToolExecutionPanelWidget);
}

const widget = {
  element: elementName,
  displayName: 'Tool Executions',
  icon: '⚙️',
  category: 'ui'
};
```

**Key features:**
- Real-time display of all tool executions
- Color-coded status indicators (running/completed/failed)
- Progress bars for long-running operations
- Tool-specific icons for visual identification
- Execution history with timestamps and durations
- Auto-refresh every 2 seconds
- Control to clear completed executions
- Uses closure access to module state (toolExecutions)
- Shadow DOM encapsulation for styling

---

## Section 3: The Implementation Pathway

### Step 1: Set Up Event Listeners
1. Subscribe to EventBus tool events
2. Create handlers for start, complete, error, progress
3. Initialize execution tracking Map

### Step 2: Implement Execution Tracking
1. Create execution record on tool:start
2. Update progress on tool:progress events
3. Mark completed/failed on tool:complete/error
4. Calculate duration on completion

### Step 3: Implement History Management
1. Add new executions to Map
2. Remove oldest when exceeding MAX_HISTORY
3. Provide clear history function

### Step 4: Create Visual Rendering
1. Define tool icon mappings
2. Create status color scheme
3. Build execution card HTML
4. Add progress bar visualization

### Step 5: Add Interactivity
1. Make cards clickable for details
2. Add expand/collapse for arguments
3. Provide clear history control
4. Add filter by status

### Step 6: Create Web Component Widget
1. Define widget class extending HTMLElement
2. Add Shadow DOM in constructor
3. Implement lifecycle methods
4. Implement getStatus() with execution counts
5. Implement getControls() for clear history
6. Implement render() with execution cards
7. Register custom element
8. Return widget object

### Step 7: Testing
1. Test with multiple concurrent tool executions
2. Verify progress updates appear correctly
3. Test error display for failed tools
4. Verify history limit enforcement
5. Test clear history functionality

---

## Success Criteria

- ✅ All tool executions appear in real-time
- ✅ Status updates reflect current execution state
- ✅ Progress bars show accurate progress
- ✅ Failed tools display error messages
- ✅ History limited to MAX_HISTORY executions
- ✅ Cards are visually distinct by status
- ✅ Performance remains smooth with many tools
- ✅ Widget updates without full page refresh

---

**Last Updated**: 2025-10-19
**Status**: COMPLETE - Production ready
