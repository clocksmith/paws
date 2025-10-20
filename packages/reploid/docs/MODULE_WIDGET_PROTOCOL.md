# Module Widget Protocol

**Version:** 2.0.0 (Updated for UI Refactoring - Web Components Pattern)
**Purpose:** Standardize how modules expose their state and controls in the dashboard

**Status:** Phase 0.5 - Pre-Migration Foundation Document

**Related Documents:**
- `FEATURE_FLAGS.md` - Feature flags control widget visibility
- `BLUEPRINT_REGISTRY.md` - All modules must comply with this protocol
- `WEB_COMPONENTS_GUIDE.md` - Implementation details for custom elements

---

## Overview

Every module in REPLOID MUST implement a `.widget` interface using **Web Components** (custom elements with Shadow DOM):

**Benefits:**
1. **Consistency** - Standardized visual presence across all modules
2. **Encapsulation** - Shadow DOM prevents style conflicts
3. **Meta-cognitive awareness** - REPLOID understands its own state
4. **Feature flag support** - Visibility control for incremental rollout
5. **Self-contained** - Each widget manages its own lifecycle and rendering

---

## Widget Protocol v2.0 (Web Components Pattern)

### Basic Structure

All REPLOID modules return a `widget` object with these fields:

```javascript
// Factory function pattern
export default function createModule(ModuleLoader, EventBus) {
  // Module state (in closure)
  let isActive = false;
  let requestCount = 0;

  // Define Web Component class
  class MyModuleWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 5000);
    }

    disconnectedCallback() {
      if (this._interval) clearInterval(this._interval);
    }

    getStatus() {
      return {
        state: isActive ? 'active' : 'idle',      // REQUIRED
        primaryMetric: `${requestCount} requests`, // REQUIRED
        secondaryMetric: '12ms avg',               // REQUIRED
        lastActivity: Date.now(),                  // REQUIRED (or null)
        message: null                              // REQUIRED (or error string)
      };
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; font-family: monospace; font-size: 12px; }
          .panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
        </style>
        <div class="panel">
          <h4>⚙️ My Module</h4>
          <div>State: ${isActive ? 'Active' : 'Idle'}</div>
          <div>Requests: ${requestCount}</div>
        </div>
      `;
    }
  }

  // Register custom element (with duplicate check)
  const elementName = 'my-module-widget';
  if (!customElements.get(elementName)) {
    customElements.define(elementName, MyModuleWidget);
  }

  // Return module API and widget metadata
  return {
    api: {
      doSomething: () => {
        isActive = true;
        requestCount++;
      }
    },
    widget: {
      element: 'my-module-widget',   // REQUIRED: Custom element tag
      displayName: 'My Module',       // REQUIRED: Dashboard label
      icon: '⚙️',                     // REQUIRED: Emoji icon
      category: 'Infrastructure',     // REQUIRED: Grouping category
      visible: true,                  // OPTIONAL (v2.0): Feature flag control
      priority: 0,                    // OPTIONAL (v2.0): Render order (higher first)
      collapsible: false,             // OPTIONAL (v2.0): Allow collapse in dashboard
      defaultCollapsed: false         // OPTIONAL (v2.0): Start collapsed
    }
  };
}
```

### v1.0 vs v2.0 Changes

| Aspect | v1.0 (Old) | v2.0 (New) |
|--------|------------|------------|
| **Pattern** | Object with methods | Web Component (custom element) |
| **Status** | `widget.getStatus()` method | `element.getStatus()` class method |
| **Rendering** | `widget.renderPanel(container)` | `element.render()` with Shadow DOM |
| **Controls** | `widget.getControls()` array | Interactive HTML in `render()` |
| **Updates** | `widget.updateInterval` number | `setInterval()` in `connectedCallback()` |
| **Visibility** | Always visible | `widget.visible` boolean (NEW) |
| **Priority** | `widget.order` (lower first) | `widget.priority` (higher first) |
| **Collapse** | Not supported | `widget.collapsible` (NEW) |

**Migration Path:** All new modules use v2.0. Existing modules can stay on v1.0 until refactored.

---

## Status States

| State | Description | Color | Use Case |
|-------|-------------|-------|----------|
| `active` | Module is currently processing | Green | Processing requests, running tasks |
| `idle` | Module is loaded but inactive | Gray | Waiting for work |
| `error` | Module has encountered an error | Red | Failed operations, exceptions |
| `disabled` | Module is disabled | Gray | Manually disabled |
| `loading` | Module is initializing | Yellow | Startup phase |

---

## Widget Protocol v2.0 New Fields

### `visible` (Boolean) - Feature Flag Control

Controls whether the widget appears in the dashboard:

```javascript
widget: {
  element: 'progress-tracker-widget',
  displayName: 'Progress Tracker',
  icon: '📊',
  category: 'UI/Panels',
  visible: isModularPanelEnabled('ProgressTracker')  // Feature flag check
}
```

**Behavior:**
- `visible: true` → Dashboard renders the widget
- `visible: false` → Dashboard skips the widget
- `visible: undefined` → Defaults to `true` (backward compatible)

**Use Case:** During UI refactoring, show only the active implementation (monolithic OR modular panel, never both).

### `priority` (Number) - Render Order

Controls widget placement in dashboard grid (higher values render first):

```javascript
widget: {
  element: 'status-bar-widget',
  displayName: 'Status Bar',
  icon: '📍',
  category: 'UI/Panels',
  priority: 10  // High priority - renders at top
}
```

**Default:** `0` (render in registration order)

### `collapsible` (Boolean) - Allow Collapse

Enables collapse toggle in dashboard:

```javascript
widget: {
  element: 'log-panel-widget',
  displayName: 'Log Panel',
  icon: '📋',
  category: 'UI/Panels',
  collapsible: true,         // Show collapse button
  defaultCollapsed: false    // Start expanded
}
```

**Default:** `false` (always expanded)

---

## Widget Categories (24 Standard Categories)

All widgets MUST use one of these standard categories:

### Core System
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Core/Bootstrap` | Initialization and startup | ModuleLoader, ConfigManager |
| `Core/Pure` | Pure functions, no state | Utils, Validators |
| `Infrastructure` | System-level services | EventBus, StateManager |

### Agent & Cognition
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Agent/Cognition` | Planning, reasoning | AgentCycle, ThoughtGenerator |
| `Agent/FSM` | Finite State Machines | FSM, StateTransitions |
| `Agent/Orchestration` | Multi-agent coordination | AutonomousOrchestrator, SwarmController |

### LLM Integration
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `LLM/Integration` | Cloud API clients | ApiClient, MultiProviderGateway |
| `LLM/Local` | WebLLM local inference | LocalLLM, ModelCache |
| `LLM/Orchestration` | Hybrid/multi-provider routing | HybridLLMProvider |

### User Interface
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `UI/Panels` | Dashboard panels | ProgressTracker, LogPanel, StatusBar, ThoughtPanel |
| `UI/Core` | Base UI framework | UIManager, ToastNotifications |
| `Visualization` | Charts, graphs | AgentVisualizer, PerformanceGraphs |

### Storage & State
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Storage/Persistence` | File system, IndexedDB | Storage, PersistentCache |
| `Storage/Memory` | In-memory caches | MemoryCache, BufferManager |

### Communication
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Communication/Swarm` | Inter-agent messaging | PaxosProtocol, SWIMProtocol, WebRTCSwarm |
| `Communication/EventBus` | Internal pub/sub | EventBus, EventLogger |

### Monitoring & Performance
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Monitoring/Performance` | Telemetry, metrics | PerformanceMonitor, TokenUsageTracker |
| `Monitoring/Health` | System health checks | HealthMonitor, CircuitBreaker |

### Security & Safety
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Security/Safety` | Guardrails, sandboxing | SafetyGuardrails, Sandbox |
| `Security/Auth` | Authentication, authorization | (Reserved for future) |

### Testing & Tools
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Testing/Verification` | Test frameworks | TestRunner, AssertionLibrary |
| `Tools/Meta` | Tool creation | MetaToolCreator, DogsParser |
| `Tools/Filesystem` | File operations | VFSExplorer, FileSearch |

### Runtime & Platform
| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `Runtime/Python` | Python bridge | PythonBridge, PyodideRunner |
| `Runtime/WebLLM` | WebLLM runtime | WebLLMRuntime, ModelLoader |

---

## Example Implementations

### Example 1: Simple Widget (Storage Module)

```javascript
export default function createModule(ModuleLoader, EventBus) {
  let state = {};
  let lastModified = null;

  class StateManagerWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 2000);
    }

    disconnectedCallback() {
      if (this._interval) clearInterval(this._interval);
    }

    getStatus() {
      const keys = Object.keys(state).length;
      const sizeBytes = JSON.stringify(state).length;

      return {
        state: keys > 0 ? 'active' : 'idle',
        primaryMetric: `${keys} keys`,
        secondaryMetric: `${(sizeBytes / 1024).toFixed(1)} KB`,
        lastActivity: lastModified,
        message: null
      };
    }

    render() {
      const keys = Object.keys(state).length;
      const sizeBytes = JSON.stringify(state).length;

      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; font-family: monospace; font-size: 12px; }
          .state-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
          .metric { margin: 4px 0; }
          button { padding: 4px 8px; margin: 4px; background: #0a0; color: #000; border: none; cursor: pointer; }
        </style>
        <div class="state-panel">
          <h4>💾 State Manager</h4>
          <div class="metric">Keys: ${keys}</div>
          <div class="metric">Size: ${(sizeBytes / 1024).toFixed(1)} KB</div>
          <div class="metric">Last Modified: ${lastModified ? new Date(lastModified).toLocaleTimeString() : 'Never'}</div>
          <button id="clear-btn">🗑️ Clear Cache</button>
          <button id="export-btn">📤 Export</button>
        </div>
      `;

      // Wire up interactive buttons
      this.shadowRoot.getElementById('clear-btn').addEventListener('click', () => {
        state = {};
        lastModified = Date.now();
        this.render();
      });

      this.shadowRoot.getElementById('export-btn').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'state-export.json';
        a.click();
      });
    }
  }

  customElements.define('state-manager-widget', StateManagerWidget);

  return {
    api: {
      get: (key) => state[key],
      set: (key, value) => {
        state[key] = value;
        lastModified = Date.now();
      }
    },
    widget: {
      element: 'state-manager-widget',
      displayName: 'State Manager',
      icon: '💾',
      category: 'Storage/Persistence'
    }
  };
}
```

### Example 2: UI Panel Widget (Full v2.0 Protocol)

```javascript
export default function createModule(ModuleLoader, EventBus) {
  let currentState = 'idle';
  let eventCount = 0;
  let lastEventTime = null;
  let events = [];

  class ProgressTrackerWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 1000);
    }

    disconnectedCallback() {
      if (this._interval) clearInterval(this._interval);
    }

    getStatus() {
      return {
        state: currentState,
        primaryMetric: currentState.toUpperCase(),
        secondaryMetric: `${eventCount} events`,
        lastActivity: lastEventTime,
        message: null
      };
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>
          :host { display: block; font-family: monospace; font-size: 12px; }
          .progress-panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
          .state { font-size: 16px; font-weight: bold; margin: 8px 0; }
          .event-list { max-height: 200px; overflow-y: auto; margin-top: 8px; }
          .event-item { padding: 4px; margin: 2px 0; background: rgba(0, 255, 0, 0.1); font-size: 10px; }
        </style>
        <div class="progress-panel">
          <h4>📊 Progress Tracker</h4>
          <div class="state">State: ${currentState}</div>
          <div>Total Events: ${eventCount}</div>
          <div>Last Event: ${lastEventTime ? new Date(lastEventTime).toLocaleTimeString() : 'Never'}</div>
          <div class="event-list">
            ${events.slice(-10).reverse().map(evt => `
              <div class="event-item">
                ${new Date(evt.timestamp).toLocaleTimeString()}: ${evt.type} → ${evt.detail}
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }
  }

  customElements.define('progress-tracker-widget', ProgressTrackerWidget);

  const onStateChange = ({ from, to }) => {
    currentState = to;
    eventCount++;
    lastEventTime = Date.now();
    events.push({ timestamp: Date.now(), type: 'state-change', detail: `${from} → ${to}` });
  };

  const onProgressEvent = (payload) => {
    eventCount++;
    lastEventTime = Date.now();
    events.push({ timestamp: Date.now(), type: 'progress', detail: payload.event });
  };

  return {
    api: {
      onStateChange,
      onProgressEvent
    },
    widget: {
      element: 'progress-tracker-widget',
      displayName: 'Progress Tracker',
      icon: '📊',
      category: 'UI/Panels',
      visible: isModularPanelEnabled('ProgressTracker'),  // v2.0 feature flag
      priority: 5,                                         // v2.0 high priority
      collapsible: true,                                   // v2.0 allow collapse
      defaultCollapsed: false                              // v2.0 start expanded
    }
  };
}
```

---

## Dashboard Integration (v2.0)

### Widget Discovery and Registration

```javascript
// In app-logic.js or dashboard.js
async function loadAllWidgets() {
  const modules = await ModuleLoader.getAllModules();
  const widgets = [];

  for (const [moduleName, moduleInstance] of Object.entries(modules)) {
    if (moduleInstance.widget) {
      const widget = moduleInstance.widget;

      // Apply v2.0 defaults
      widget.visible = widget.visible ?? true;
      widget.priority = widget.priority ?? 0;
      widget.collapsible = widget.collapsible ?? false;
      widget.defaultCollapsed = widget.defaultCollapsed ?? false;

      // Filter by visibility (feature flags)
      if (widget.visible) {
        widgets.push(widget);
      }
    }
  }

  // Sort by priority (high to low), then by displayName
  widgets.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return a.displayName.localeCompare(b.displayName);
  });

  return widgets;
}
```

### Widget Rendering

```javascript
async function renderDashboard() {
  const widgets = await loadAllWidgets();
  const container = document.getElementById('dashboard-grid');

  container.innerHTML = ''; // Clear existing widgets

  for (const widget of widgets) {
    const widgetElement = document.createElement(widget.element);

    // Check if collapsed preference exists
    const isCollapsed = StateManager.get(`dashboard.collapsed.${widget.element}`)
      ?? widget.defaultCollapsed;

    const wrapper = document.createElement('div');
    wrapper.className = 'widget-wrapper';
    wrapper.innerHTML = `
      <div class="widget-header">
        <span class="widget-icon">${widget.icon}</span>
        <span class="widget-title">${widget.displayName}</span>
        ${widget.collapsible ? '<button class="collapse-toggle">▼</button>' : ''}
      </div>
      <div class="widget-body ${isCollapsed ? 'collapsed' : ''}">
      </div>
    `;

    wrapper.querySelector('.widget-body').appendChild(widgetElement);

    if (widget.collapsible) {
      const toggle = wrapper.querySelector('.collapse-toggle');
      toggle.addEventListener('click', () => {
        const body = wrapper.querySelector('.widget-body');
        body.classList.toggle('collapsed');
        const newState = body.classList.contains('collapsed');
        StateManager.set(`dashboard.collapsed.${widget.element}`, newState);
        toggle.textContent = newState ? '▶' : '▼';
      });
    }

    container.appendChild(wrapper);
  }
}
```

### Status Aggregation

```javascript
function getSystemHealthSummary() {
  const widgets = document.querySelectorAll('[data-widget-element]');
  const summary = {
    total: widgets.length,
    active: 0,
    idle: 0,
    error: 0,
    errors: []
  };

  widgets.forEach(widgetEl => {
    if (typeof widgetEl.getStatus === 'function') {
      const status = widgetEl.getStatus();

      if (status.state === 'active') summary.active++;
      else if (status.state === 'idle') summary.idle++;
      else if (status.state === 'error') {
        summary.error++;
        summary.errors.push({
          widget: widgetEl.tagName.toLowerCase(),
          message: status.message
        });
      }
    }
  });

  return summary;
}
```

---

## Best Practices (v2.0)

### 1. Keep getStatus() and render() Fast

```javascript
// ✅ Good - quick calculation in render()
render() {
  this.shadowRoot.innerHTML = `
    <div>State: ${currentState}</div>
    <div>Count: ${eventCount}</div>
  `;
}

// ❌ Bad - expensive operation in render()
render() {
  // Don't do heavy computations on every render
  const result = expensiveCalculation();
  this.shadowRoot.innerHTML = `<div>${result}</div>`;
}
```

**Tip:** Store computed values in module closure, update only when data changes.

### 2. Use Appropriate Render Intervals

```javascript
// Fast-changing state (tool execution, streaming)
this._interval = setInterval(() => this.render(), 500);

// Moderate updates (API stats, progress)
this._interval = setInterval(() => this.render(), 2000);

// Slow updates (config state, module status)
this._interval = setInterval(() => this.render(), 5000);

// Event-driven (no auto-refresh, render on events)
EventBus.on('some-event', () => this.render());
```

### 3. Provide Meaningful Metrics

```javascript
// ✅ Good - specific and useful
getStatus() {
  return {
    state: 'active',
    primaryMetric: `${count} artifacts (${formatBytes(size)})`,
    secondaryMetric: `${changes} changes pending`,
    lastActivity: Date.now(),
    message: null
  };
}

// ❌ Bad - vague
getStatus() {
  return {
    state: 'active',
    primaryMetric: 'OK',
    secondaryMetric: 'Running',
    lastActivity: null,
    message: null
  };
}
```

### 4. Error Handling in getStatus()

```javascript
getStatus() {
  try {
    const data = getData();
    return {
      state: data.length > 0 ? 'active' : 'idle',
      primaryMetric: `${data.length} items`,
      secondaryMetric: formatBytes(calculateSize(data)),
      lastActivity: Date.now(),
      message: null
    };
  } catch (error) {
    return {
      state: 'error',
      primaryMetric: 'Error',
      secondaryMetric: 'N/A',
      lastActivity: null,
      message: error.message
    };
  }
}
```

### 5. Cleanup in disconnectedCallback()

```javascript
disconnectedCallback() {
  // ALWAYS clean up intervals
  if (this._interval) clearInterval(this._interval);

  // Clean up event listeners if any
  if (this._eventHandler) {
    EventBus.off('some-event', this._eventHandler);
  }

  // Release any resources
  this._data = null;
}
```

### 6. Use Shadow DOM Scoped Styles

```javascript
render() {
  this.shadowRoot.innerHTML = `
    <style>
      /* :host selector targets the custom element itself */
      :host {
        display: block;
        font-family: monospace;
        font-size: 12px;
      }

      /* All other selectors are scoped to this widget */
      .panel { background: rgba(255, 255, 255, 0.05); padding: 16px; }
      h4 { margin: 0; color: #0f0; }
    </style>
    <div class="panel">
      <h4>My Widget</h4>
    </div>
  `;
}
```

### 7. Feature Flag Integration for Panels

```javascript
// Always check feature flags for UI panels
widget: {
  element: 'my-panel-widget',
  displayName: 'My Panel',
  icon: '📊',
  category: 'UI/Panels',
  visible: isModularPanelEnabled('MyPanel'),  // Feature flag check
  priority: 5,
  collapsible: true
}
```

### 8. Avoid Re-registering Custom Elements

```javascript
// ✅ Good - check before registering
const elementName = 'my-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, MyWidget);
}

// ❌ Bad - will throw error on hot reload
customElements.define('my-widget', MyWidget);
```

---

## Migration Guide: v1.0 → v2.0

### For New Modules (Start with v2.0)

All new modules should use the Web Components pattern from the start:

1. Define Web Component class extending `HTMLElement`
2. Implement `connectedCallback()`, `disconnectedCallback()`, `getStatus()`, `render()`
3. Register custom element with duplicate check
4. Return widget metadata with v2.0 fields

See Example 2 (Progress Tracker) for complete reference implementation.

### For Existing Modules (v1.0 Compatibility)

**Option 1: Keep v1.0 (No Changes Required)**
- Existing v1.0 widgets continue to work
- Dashboard supports both v1.0 and v2.0 patterns
- No breaking changes

**Option 2: Migrate to v2.0 (Recommended for Panels)**
- Convert `widget.getStatus()` method → `element.getStatus()` class method
- Convert `widget.renderPanel(container)` → `element.render()` with Shadow DOM
- Convert `widget.getControls()` → Interactive HTML in `render()`
- Add `widget.visible` if feature flag control needed
- Add `widget.collapsible` if collapse functionality desired

**Example Migration:**

```javascript
// v1.0 (OLD)
const MyModule = {
  widget: {
    displayName: 'My Module',
    icon: '⚙️',
    category: 'Infrastructure',
    getStatus: () => ({ state: 'idle', primaryMetric: 'Ready' }),
    updateInterval: 2000
  },
  factory: (deps) => { /* ... */ }
};

// v2.0 (NEW)
export default function createModule(ModuleLoader, EventBus) {
  class MyModuleWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
      this._interval = setInterval(() => this.render(), 2000);
    }

    disconnectedCallback() {
      if (this._interval) clearInterval(this._interval);
    }

    getStatus() {
      return {
        state: 'idle',
        primaryMetric: 'Ready',
        secondaryMetric: 'N/A',
        lastActivity: null,
        message: null
      };
    }

    render() {
      this.shadowRoot.innerHTML = `
        <style>:host { display: block; }</style>
        <div>Ready</div>
      `;
    }
  }

  customElements.define('my-module-widget', MyModuleWidget);

  return {
    api: { /* ... */ },
    widget: {
      element: 'my-module-widget',
      displayName: 'My Module',
      icon: '⚙️',
      category: 'Infrastructure'
    }
  };
}
```

---

## Verification Checklist

Before considering Phase 0.5 complete, verify:

- [ ] v2.0 Web Components pattern documented
- [ ] All v2.0 new fields documented (visible, priority, collapsible, defaultCollapsed)
- [ ] 24 standard categories defined and organized by domain
- [ ] getStatus() 5-field contract specified
- [ ] Dashboard integration patterns documented (discovery, rendering, status aggregation)
- [ ] Example implementations provided (simple module + full panel)
- [ ] Best practices documented (8 key practices)
- [ ] Migration guide provided (v1.0 → v2.0)
- [ ] v1.0 backward compatibility confirmed

---

## Cross-References

**Depends On:**
- `FEATURE_FLAGS.md` - `visible` field uses `isModularPanelEnabled()` helper

**Referenced By:**
- Blueprint 0x00006A (ProgressTracker) - Implement full v2.0 protocol with feature flags
- Blueprint 0x00006B (StatusBar) - Implement full v2.0 protocol with feature flags
- Blueprint 0x00006C (LogPanel) - Implement full v2.0 protocol with feature flags
- Blueprint 0x000065 (ThoughtPanel) - Implement full v2.0 protocol with feature flags (CLUSTER 2)
- Blueprint 0x000066 (GoalPanel) - Implement full v2.0 protocol with feature flags (CLUSTER 2)
- Blueprint 0x000069 (SentinelPanel) - Implement full v2.0 protocol with feature flags (CLUSTER 2)
- `WEB_COMPONENTS_GUIDE.md` - Detailed Web Components implementation guide
- All 81 existing modules - Should comply with v1.0 baseline at minimum

**Sync Points:**
- CLUSTER 1 Phase 1-3: New panels implement v2.0 protocol
- CLUSTER 2 Phase 1-3: New panels implement v2.0 protocol
- Phase 5: Audit all modules for protocol compliance

---

## Conclusion

**Module Widget Protocol v2.0** provides:

- ✅ **Web Components** - Standards-based custom elements with Shadow DOM
- ✅ **Encapsulation** - Scoped styles prevent conflicts
- ✅ **Feature Flags** - Visibility control for incremental rollout
- ✅ **Consistency** - Standardized interface across all 81+ modules
- ✅ **Meta-cognition** - System self-awareness through status aggregation
- ✅ **Backward Compatibility** - v1.0 modules continue to work

**All new modules (especially UI panels) MUST use v2.0 pattern.**

*This document defines the contract between modules and the dashboard system.*
