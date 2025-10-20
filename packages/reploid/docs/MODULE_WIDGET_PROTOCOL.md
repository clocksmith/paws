# Module Widget Protocol

**Version:** 1.0.0
**Purpose:** Standardize how modules expose their state and controls in the dashboard

---

## Overview

Every module in REPLOID can optionally implement a `.widget` interface to provide:
- Visual status representation in the dashboard
- Real-time metrics and state information
- Interactive controls
- Detailed panel views

This creates:
1. **Consistency** - Every module has a standardized visual presence
2. **Meta-cognitive awareness** - Reploid understands its own state
3. **User visibility** - Users see what's happening in real-time
4. **HITL integration** - Modules integrate with Human-in-the-Loop controls

---

## Basic Widget Interface

```javascript
const MyModule = {
  metadata: {
    id: 'MyModule',
    version: '1.0.0',
    dependencies: ['Utils'],
    type: 'core'
  },

  // Widget interface (OPTIONAL but recommended)
  widget: {
    displayName: 'My Module',
    icon: '⚙️',
    category: 'core', // core, tools, ai, storage, ui, analytics, rsi, communication

    // Required: Get current status
    getStatus: () => ({
      state: 'active',           // active | idle | error | disabled | loading
      primaryMetric: '42 items', // Main metric to display
      secondaryMetric: '1.2s',   // Secondary metric (optional)
      lastActivity: Date.now(),  // Timestamp of last activity
      message: null              // Status message (optional)
    }),

    // Optional: Get available controls
    getControls: () => [
      {
        id: 'pause',
        label: 'Pause',
        icon: '⏸️',
        action: () => {
          // Execute pause action
        }
      }
    ],

    // Optional: Auto-refresh interval in ms
    updateInterval: 1000,

    // Optional: Display order (lower = first)
    order: 10,

    // Optional: Render detailed panel
    renderPanel: (container) => {
      container.innerHTML = '<div>Detailed view</div>';
    }
  },

  factory: (deps) => {
    // Module implementation
  }
};
```

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

## Widget Categories

| Category | Description | Example Modules |
|----------|-------------|-----------------|
| `core` | Core system modules | StateManager, EventBus, DI Container |
| `tools` | Tool execution systems | ToolRunner, DogsParser |
| `ai` | LLM providers, agents | ApiClient, HybridLLMProvider |
| `storage` | Persistence and VFS | Storage, VFSExplorer |
| `ui` | Dashboard components | UIManager, ToastNotifications |
| `analytics` | Monitoring and metrics | PerformanceMonitor, ToolAnalytics |
| `rsi` | Self-improvement systems | GenesisSnapshot, Introspector |
| `communication` | WebRTC, signaling | WebRTCSwarm, SignalingServer |

---

## Example Implementations

### Example 1: StateManager Widget

```javascript
const StateManager = {
  metadata: { id: 'StateManager', /* ... */ },

  widget: {
    displayName: 'State Manager',
    icon: '💾',
    category: 'core',

    getStatus: () => {
      const artifacts = getAllArtifacts();
      const totalSize = calculateTotalSize(artifacts);

      return {
        state: artifacts.length > 0 ? 'active' : 'idle',
        primaryMetric: `${artifacts.length} artifacts`,
        secondaryMetric: `${formatBytes(totalSize)}`,
        lastActivity: getLastModified(),
        message: null
      };
    },

    getControls: () => [
      {
        id: 'clear-cache',
        label: 'Clear Cache',
        icon: '🗑️',
        action: () => clearCache()
      },
      {
        id: 'export',
        label: 'Export',
        icon: '📤',
        action: () => exportState()
      }
    ],

    updateInterval: 2000 // Update every 2 seconds
  },

  factory: (deps) => {
    // StateManager implementation
  }
};
```

### Example 2: ApiClient Widget

```javascript
const ApiClient = {
  metadata: { id: 'ApiClient', /* ... */ },

  widget: {
    displayName: 'API Client',
    icon: '🌐',
    category: 'ai',

    getStatus: () => {
      const stats = getRequestStats();

      return {
        state: stats.pending > 0 ? 'active' : 'idle',
        primaryMetric: `${stats.total} requests`,
        secondaryMetric: `${stats.avgLatency}ms avg`,
        lastActivity: stats.lastRequest,
        message: stats.error ? `Last error: ${stats.error}` : null
      };
    },

    getControls: () => [
      {
        id: 'test-connection',
        label: 'Test Connection',
        icon: '🔌',
        action: () => testConnection()
      }
    ],

    updateInterval: 1000
  },

  factory: (deps) => {
    // ApiClient implementation
  }
};
```

### Example 3: ToolRunner Widget

```javascript
const ToolRunner = {
  metadata: { id: 'ToolRunner', /* ... */ },

  widget: {
    displayName: 'Tool Runner',
    icon: '🛠️',
    category: 'tools',

    getStatus: () => {
      const queue = getToolQueue();
      const stats = getExecutionStats();

      return {
        state: queue.length > 0 ? 'active' : 'idle',
        primaryMetric: `${stats.executed} tools run`,
        secondaryMetric: `${queue.length} queued`,
        lastActivity: stats.lastExecution,
        message: stats.failedLast ? 'Last execution failed' : null
      };
    },

    getControls: () => [
      {
        id: 'clear-queue',
        label: 'Clear Queue',
        icon: '🗑️',
        action: () => clearQueue()
      },
      {
        id: 'pause',
        label: 'Pause',
        icon: '⏸️',
        action: () => pauseExecution()
      }
    ],

    updateInterval: 500 // Fast updates for tool execution
  },

  factory: (deps) => {
    // ToolRunner implementation
  }
};
```

### Example 4: Simple Widget (Minimal)

```javascript
const SimpleModule = {
  metadata: { id: 'SimpleModule', /* ... */ },

  // Minimal widget - just status
  widget: {
    displayName: 'Simple Module',
    icon: '📦',
    category: 'core',

    getStatus: () => ({
      state: 'idle',
      primaryMetric: 'Ready',
      lastActivity: null
    })
  },

  factory: (deps) => {
    // Module implementation
  }
};
```

---

## Integration with HITL Controller

Modules with HITL capabilities should register with `HITLController`:

```javascript
factory: (deps) => {
  const { HITLController, EventBus } = deps;

  // Register HITL capabilities
  if (HITLController) {
    HITLController.registerModule(
      'MyModule',
      [
        HITLController.CAPABILITIES.APPROVE_CODE_CHANGES,
        HITLController.CAPABILITIES.APPROVE_FILE_OPERATIONS
      ],
      'My Module - requires approval for file operations'
    );
  }

  // Widget will automatically show HITL mode badge
  return { api: { /* ... */ } };
}
```

---

## Dashboard Integration

The Module Dashboard automatically:
1. **Discovers** all modules with widget interfaces
2. **Renders** them in a standardized grid
3. **Updates** their state based on `updateInterval`
4. **Categorizes** them by category
5. **Shows HITL mode** if module is registered with HITLController

No additional configuration needed - just implement `.widget` on your module!

---

## Best Practices

### 1. Keep getStatus() Fast

```javascript
// ✅ Good - quick calculation
getStatus: () => {
  return {
    state: queue.length > 0 ? 'active' : 'idle',
    primaryMetric: `${queue.length} items`
  };
}

// ❌ Bad - expensive operation
getStatus: () => {
  // Don't do heavy computations here
  const result = expensiveCalculation();
  return { state: 'active' };
}
```

### 2. Use Appropriate Update Intervals

```javascript
// Fast-changing state (tool execution)
updateInterval: 500

// Moderate updates (API stats)
updateInterval: 2000

// Slow updates (config state)
updateInterval: 5000

// No auto-update (static state)
updateInterval: null
```

### 3. Provide Meaningful Metrics

```javascript
// ✅ Good - specific and useful
primaryMetric: `${count} artifacts (${formatBytes(size)})`,
secondaryMetric: `${changes} changes pending`

// ❌ Bad - vague
primaryMetric: 'OK',
secondaryMetric: 'Running'
```

### 4. Error Handling

```javascript
getStatus: () => {
  try {
    const data = getData();
    return {
      state: 'active',
      primaryMetric: `${data.length} items`
    };
  } catch (error) {
    return {
      state: 'error',
      message: error.message
    };
  }
}
```

---

## Meta-Cognitive Integration

The widget protocol integrates with Reploid's meta-cognitive layer:

```javascript
// Get summary of all module states
const summary = ModuleWidgetProtocol.getMetaCognitiveSummary();

console.log(summary);
// {
//   totalModules: 25,
//   byStatus: {
//     active: 5,
//     idle: 18,
//     error: 2
//   },
//   byCategory: {
//     core: 8,
//     tools: 5,
//     ai: 3,
//     ...
//   },
//   activeModules: [
//     { moduleId: 'ToolRunner', primaryMetric: '3 tools running', ... }
//   ],
//   errorModules: [
//     { moduleId: 'WebRTCSwarm', message: 'Connection failed', ... }
//   ]
// }
```

This enables Reploid to:
- Know which modules are active vs idle
- Detect errors across the system
- Understand its own resource usage
- Make decisions based on module state

---

## Migration Guide

To add widget support to an existing module:

1. **Add widget interface** to module definition
2. **Implement getStatus()** - required
3. **Add controls** if module has user actions
4. **Set update interval** if state changes frequently
5. **Test in dashboard** - module should appear automatically

Example migration:

```javascript
// Before
const MyModule = {
  metadata: { /* ... */ },
  factory: (deps) => { /* ... */ }
};

// After
const MyModule = {
  metadata: { /* ... */ },

  widget: {
    displayName: 'My Module',
    icon: '⚙️',
    category: 'core',
    getStatus: () => ({
      state: 'idle',
      primaryMetric: 'Ready'
    })
  },

  factory: (deps) => { /* ... */ }
};
```

---

## API Reference

### ModuleWidgetProtocol

```javascript
// Register a widget
ModuleWidgetProtocol.registerWidget(moduleId, widgetInterface, metadata);

// Get widget state
const state = ModuleWidgetProtocol.getWidgetState(moduleId);

// Get all widgets
const widgets = ModuleWidgetProtocol.getAllWidgets();

// Get widgets by category
const coreWidgets = ModuleWidgetProtocol.getWidgetsByCategory('core');

// Execute a control
ModuleWidgetProtocol.executeControl(moduleId, controlId);

// Refresh widget
ModuleWidgetProtocol.refreshWidget({ moduleId });

// Get meta-cognitive summary
const summary = ModuleWidgetProtocol.getMetaCognitiveSummary();
```

---

## Conclusion

The Module Widget Protocol provides:
- ✅ **Consistency** - Standardized module representation
- ✅ **Visibility** - Real-time state in dashboard
- ✅ **Control** - Interactive module management
- ✅ **Meta-cognition** - System self-awareness
- ✅ **Simplicity** - Easy to implement

Every module should implement a widget interface for complete system transparency!
