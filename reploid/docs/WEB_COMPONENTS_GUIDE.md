# Web Components Migration Guide

> **📊 Back to Source of Truth:** [WEB_COMPONENTS_MIGRATION_TRACKER.md](./WEB_COMPONENTS_MIGRATION_TRACKER.md)

This guide explains **how to convert a module** from HTML string widgets to Web Components with Shadow DOM.

**⚠️ CRITICAL: This guide must be followed exactly. All conversions will be verified against this pattern.**

---

## Migration Strategy: Hybrid Approach

**Keep factory pattern for module logic** + **Use Web Components for widget rendering**

### Benefits
- ✓ Testable business logic (no DOM coupling)
- ✓ Shadow DOM encapsulation for widgets
- ✓ Server-side compatibility maintained
- ✓ Clean dependency injection preserved
- ✓ Incremental migration path

---

## Standard Pattern (MUST FOLLOW)

Each module MUST follow this exact structure:

```javascript
// Example: my-module.js

const MyModule = {
  metadata: {
    id: 'MyModule',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'service'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;

    // ✅ Module state (accessible via closure)
    let moduleState = {
      count: 0,
      isActive: false
    };

    // ✅ Business logic API
    const api = {
      increment: () => moduleState.count++,
      getCount: () => moduleState.count,
      setActive: (active) => moduleState.isActive = active
    };

    // ✅ Web Component Widget Class
    class MyModuleWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();

        // Auto-refresh if needed (with proper cleanup)
        this._interval = setInterval(() => this.render(), 2000);
      }

      disconnectedCallback() {
        // ✅ CRITICAL: Clean up to prevent memory leaks
        if (this._interval) {
          clearInterval(this._interval);
          this._interval = null;
        }
      }

      // ✅ REQUIRED: getStatus() accesses module state via closure
      getStatus() {
        return {
          state: moduleState.isActive ? 'active' : 'idle',  // Required
          primaryMetric: `${moduleState.count} items`,      // Required
          secondaryMetric: 'Ready',                         // Required
          lastActivity: Date.now(),                         // Required (or null)
          message: null                                     // Required (or string)
        };
      }

      // ✅ REQUIRED: getControls() returns interactive buttons
      getControls() {
        return [
          {
            id: 'increment',           // Required: unique ID
            label: '+ Increment',      // Required: button text
            icon: '➕',                // Optional: emoji/icon
            action: () => {            // Required: function
              api.increment();
              return { success: true, message: 'Incremented' };
            }
          },
          {
            id: 'reset',
            label: 'Reset',
            action: () => {
              moduleState.count = 0;
              this.render();
              return { success: true, message: 'Reset complete' };
            }
          }
        ];
      }

      // ✅ Single render method - ALL HTML here
      render() {
        const status = this.getStatus();

        this.shadowRoot.innerHTML = `
          <style>
            :host {
              display: block;
              font-family: monospace;
              font-size: 12px;
              color: #e0e0e0;
            }

            .panel {
              background: rgba(255, 255, 255, 0.05);
              padding: 16px;
              border-radius: 8px;
            }

            .metric {
              color: #0ff;
              font-weight: bold;
            }

            .value-success { color: #0f0; }
            .value-error { color: #f00; }
            .value-warning { color: #ff0; }
          </style>

          <div class="panel">
            <h3>My Module</h3>
            <div class="metric">${status.primaryMetric}</div>
            <div>State: <span class="value-${status.state}">${status.state}</span></div>
          </div>
        `;
      }
    }

    // ✅ CRITICAL: Check before registering to avoid duplicates
    const elementName = 'my-module-widget';  // MUST be kebab-case
    if (!customElements.get(elementName)) {
      customElements.define(elementName, MyModuleWidget);
    }

    // ✅ NEW widget return format
    const widget = {
      element: elementName,           // Required: custom element tag
      displayName: 'My Module',       // Required: human-readable name
      icon: '⚙️',                     // Required: emoji icon
      category: 'service'             // Required: category for grouping
      // Note: NO updateInterval, getStatus, getControls, renderPanel
    };

    return { api, widget };
  }
};

export default MyModule;
```

---

## Required Elements

### 1. Element Naming Convention

**MUST use kebab-case**: `module-name-widget`

Examples:
- ✅ `audit-logger-widget`
- ✅ `backup-restore-widget`
- ✅ `tutorial-system-widget`
- ❌ `auditLoggerWidget` (camelCase not allowed)
- ❌ `AuditLogger` (PascalCase not allowed)

### 2. getStatus() Method (REQUIRED)

All widgets MUST implement `getStatus()` with these exact fields:

```javascript
getStatus() {
  return {
    state: 'idle',              // REQUIRED: 'idle' | 'active' | 'error' | 'warning' | 'disabled'
    primaryMetric: '0 items',   // REQUIRED: Main display metric (string)
    secondaryMetric: 'Ready',   // REQUIRED: Secondary metric (string)
    lastActivity: null,         // REQUIRED: Timestamp (number) or null
    message: null               // REQUIRED: Status message (string) or null
  };
}
```

### 3. getControls() Method (REQUIRED IF INTERACTIVE)

If your widget has buttons/actions, MUST implement `getControls()`:

```javascript
getControls() {
  return [
    {
      id: 'action-id',          // REQUIRED: Unique identifier
      label: 'Button Text',     // REQUIRED: Display text
      icon: '⚙️',              // OPTIONAL: Emoji or icon
      action: () => {           // REQUIRED: Sync or async function
        // Perform action
        return {                // RECOMMENDED: Return result object
          success: true,
          message: 'Action completed'
        };
      }
    }
  ];
}
```

### 4. Closure Access Pattern (CRITICAL)

Widget classes are defined INSIDE the factory function, giving them closure access to module state:

```javascript
factory: (deps) => {
  // ✅ Module state (private, in closure)
  let privateState = { count: 0 };

  // ✅ Widget class can access privateState via closure
  class Widget extends HTMLElement {
    getStatus() {
      // ✅ Direct access - no injection needed!
      return {
        state: 'idle',
        primaryMetric: `${privateState.count} items`,
        // ...
      };
    }

    getControls() {
      return [
        {
          id: 'reset',
          label: 'Reset',
          action: () => {
            // ✅ Can modify module state directly
            privateState.count = 0;
            this.render();
            return { success: true };
          }
        }
      ];
    }
  }

  return { api, widget };
};
```

**Why this matters**: No need for `.moduleApi` property injection - widgets access state naturally through closure scope.

### 5. Auto-Refresh Pattern

If widget needs periodic updates:

```javascript
class Widget extends HTMLElement {
  connectedCallback() {
    this.render();
    // ✅ Start auto-refresh (typically 1000-5000ms)
    this._interval = setInterval(() => this.render(), 2000);
  }

  disconnectedCallback() {
    // ✅ CRITICAL: Clean up to prevent memory leaks
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }
}
```

### 6. Shadow DOM Styles

**Best practices**:

```css
:host {
  /* Element-level defaults */
  display: block;
  font-family: monospace;
  font-size: 12px;
  color: #e0e0e0;
}

/* Use semantic class names */
.panel { ... }
.metric { ... }

/* Standard color classes */
.value-success { color: #0f0; }
.value-error { color: #f00; }
.value-warning { color: #ff0; }
.value-cyan { color: #0ff; }
.value-muted { color: #888; }
```

---

## Migration Checklist

When converting a module to Web Components:

- [ ] Read module file to understand current widget implementation
- [ ] Create Web Component class extending `HTMLElement`
- [ ] Add Shadow DOM: `this.attachShadow({ mode: 'open' })`
- [ ] Implement `connectedCallback()` with render call
- [ ] Implement `disconnectedCallback()` with cleanup
- [ ] Move `getStatus()` to class method with closure access
- [ ] Move `getControls()` to class method (if applicable)
- [ ] Consolidate ALL HTML into single `render()` method
- [ ] Move ALL styles to Shadow DOM `<style>` tag
- [ ] Use `:host` selector for component-level styles
- [ ] Add duplicate registration check: `if (!customElements.get(...))`
- [ ] Use kebab-case element naming: `module-name-widget`
- [ ] Update widget return to `{ element, displayName, icon, category }`
- [ ] Remove `updateInterval` from widget object (handle in `connectedCallback`)
- [ ] Remove `renderPanel`, `getStatus`, `getControls` from widget object
- [ ] Test closure access to module state works correctly
- [ ] Verify auto-refresh cleanup in `disconnectedCallback()`
- [ ] Run tests to verify functionality preserved

---

## Common Mistakes

### ❌ Mistake 1: Separate renderPanel() method

```javascript
// ❌ DON'T do this
render() {
  this.shadowRoot.innerHTML = `
    <div>${this.renderPanel()}</div>
  `;
}

renderPanel() {
  return `<div>Content</div>`;
}
```

```javascript
// ✅ DO this - everything in render()
render() {
  this.shadowRoot.innerHTML = `
    <style>...</style>
    <div>Content</div>
  `;
}
```

### ❌ Mistake 2: Property injection instead of closure

```javascript
// ❌ DON'T do this - unnecessary complexity
class Widget extends HTMLElement {
  set moduleApi(api) {
    this._api = api;
  }

  render() {
    const data = this._api.getData();
  }
}
```

```javascript
// ✅ DO this - use closure
factory: (deps) => {
  let moduleData = getData();

  class Widget extends HTMLElement {
    render() {
      // Direct access via closure
      const data = moduleData;
    }
  }
}
```

### ❌ Mistake 3: Forgetting cleanup

```javascript
// ❌ DON'T do this - memory leak!
connectedCallback() {
  setInterval(() => this.render(), 2000);
}
```

```javascript
// ✅ DO this - proper cleanup
connectedCallback() {
  this._interval = setInterval(() => this.render(), 2000);
}

disconnectedCallback() {
  if (this._interval) clearInterval(this._interval);
}
```

### ❌ Mistake 4: Incomplete getStatus()

```javascript
// ❌ DON'T do this - missing fields
getStatus() {
  return {
    state: 'idle',
    primaryMetric: '0'
    // Missing: secondaryMetric, lastActivity, message
  };
}
```

```javascript
// ✅ DO this - all 5 required fields
getStatus() {
  return {
    state: 'idle',
    primaryMetric: '0 items',
    secondaryMetric: 'Ready',
    lastActivity: null,
    message: null
  };
}
```

---

## Verification

After conversion, verify:

1. ✅ No `renderPanel:` in widget object
2. ✅ No `updateInterval` in widget object
3. ✅ No `getStatus` in widget object (moved to class)
4. ✅ No `getControls` in widget object (moved to class)
5. ✅ `customElements.define()` call exists
6. ✅ Duplicate registration check exists
7. ✅ Element name is kebab-case
8. ✅ `getStatus()` returns all 5 required fields
9. ✅ `getControls()` exists if widget is interactive
10. ✅ `disconnectedCallback()` cleans up intervals

Run verification: `grep -l "renderPanel:" upgrades/module-name.js` should return no results.

---

**Last Updated**: 2025-10-19
**Migration Approach**: Hybrid (Factory + Web Components)
**Status**: AUTHORITATIVE - Must be followed for all conversions
