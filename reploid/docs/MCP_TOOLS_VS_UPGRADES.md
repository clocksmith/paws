# MCP Tools vs REPLOID Upgrades: Clear Distinctions

**Last Updated:** 2025-10-20
**Critical Documentation for REPLOID Self-Modification**

---

## Executive Summary

**MCP Tools** and **REPLOID Upgrades** are fundamentally different mechanisms for extending REPLOID's capabilities. Understanding this distinction is **critical** when the agent modifies itself or creates new capabilities.

| Aspect | MCP Tools | REPLOID Upgrades |
|--------|-----------|------------------|
| **What** | External tools via Model Context Protocol | Internal JavaScript modules |
| **Where** | Provided by MCP servers (external processes) | In `upgrades/` directory (internal) |
| **How** | Accessed via Claude Desktop/API | Loaded by `boot.js` into VFS |
| **Lifespan** | Session-based (MCP server runs) | Persistent (stored in codebase) |
| **Widget** | ❌ No web component | ✅ **REQUIRED** web component |
| **Blueprint** | ❌ Not required | ✅ **REQUIRED** blueprint |
| **Test** | ❌ Not required | ✅ **REQUIRED** unit test |
| **Control** | Managed by MCP server | Fully under REPLOID control |

---

## 1. MCP Tools (Model Context Protocol)

### What Are MCP Tools?

MCP tools are **external capabilities** provided by MCP servers. They are:
- Defined by external processes (not part of REPLOID codebase)
- Accessible via the Claude Desktop app or API
- Ephemeral (only available when MCP server is running)
- Managed outside of REPLOID's VFS

### Examples of MCP Tools

```javascript
// Provided by @modelcontextprotocol/server-filesystem
{
  "name": "read_file",
  "description": "Read file from host filesystem",
  "inputSchema": { /* ... */ }
}

// Provided by @modelcontextprotocol/server-github
{
  "name": "create_issue",
  "description": "Create GitHub issue",
  "inputSchema": { /* ... */ }
}
```

### When to Use MCP Tools

- Accessing host filesystem
- Interacting with external APIs (GitHub, Slack, etc.)
- Database operations
- Operating system operations
- Any capability provided by an external MCP server

### How to Create/Modify MCP Tools

**YOU CANNOT CREATE MCP TOOLS FROM WITHIN REPLOID!**

MCP tools are managed by:
1. Installing MCP servers externally
2. Configuring Claude Desktop/API to use them
3. The MCP protocol specification

To add MCP tools, the **human operator** must:
- Install the MCP server package
- Update MCP configuration
- Restart Claude Desktop/API

---

## 2. REPLOID Upgrades (Internal Modules)

### What Are REPLOID Upgrades?

REPLOID upgrades are **internal JavaScript modules** that extend REPLOID's capabilities. They are:
- Part of the REPLOID codebase (`upgrades/` directory)
- Loaded into the Virtual File System (VFS)
- Persistent across sessions
- Fully under REPLOID's control for self-modification

### Anatomy of a REPLOID Upgrade

Every upgrade **MUST** have the **1:1:1:1 pattern**:

1. **Module file** (`upgrades/module-name.js`)
2. **Blueprint** (`blueprints/0xNNNNNN-module-name.md`) with `@blueprint 0xNNNNNN` annotation
3. **Unit test** (`tests/unit/module-name.test.js`)
4. **Web Component** (widget defined **in the same file**)

### Required Structure for New Upgrades

```javascript
// upgrades/my-new-module.js
// @blueprint 0xNNNNNN

const MyNewModule = {
  metadata: {
    id: 'MyNewModule',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus'],
    async: false,
    type: 'service' // or 'utility', 'integration'
  },

  factory: (deps) => {
    const { Utils, EventBus } = deps;
    const { logger } = Utils;

    logger.info('[MyNewModule] Initializing...');

    // ==========================================
    // MODULE IMPLEMENTATION
    // ==========================================

    const api = {
      doSomething: () => { /* ... */ }
    };

    // ==========================================
    // WEB COMPONENT WIDGET (REQUIRED!)
    // ==========================================
    // See module-widget-protocol (Blueprint 0x00004E)

    class MyNewModuleWidget extends HTMLElement {
      constructor() {
        super();
        this.attachShadow({ mode: 'open' });
      }

      connectedCallback() {
        this.render();
      }

      disconnectedCallback() {
        // Clean up intervals/listeners
      }

      // REQUIRED: Status protocol
      getStatus() {
        return {
          state: 'idle', // 'active' | 'idle' | 'error' | 'loading'
          primaryMetric: '0 items',
          secondaryMetric: 'Ready',
          lastActivity: null,
          message: null
        };
      }

      // OPTIONAL: Controls
      getControls() {
        return [
          {
            id: 'my-action',
            label: '▶ Do Something',
            action: async () => {
              // Perform action
              return { success: true, message: 'Done!' };
            }
          }
        ];
      }

      render() {
        this.shadowRoot.innerHTML = `
          <style>
            :host { display: block; font-family: monospace; }
            /* Scoped styles */
          </style>
          <div class="my-module-panel">
            <h4>My New Module</h4>
            <!-- Widget UI -->
          </div>
        `;
      }
    }

    // Register widget
    const elementName = 'my-new-module-widget';
    if (!customElements.get(elementName)) {
      customElements.define(elementName, MyNewModuleWidget);
    }

    const widget = {
      element: elementName,
      displayName: 'My New Module',
      icon: '🔧',
      category: 'tools', // core, tools, ai, storage, ui, analytics, rsi, communication
      updateInterval: null // or number (ms) for auto-refresh
    };

    // ==========================================
    // MODULE EXPORT
    // ==========================================

    return {
      api,       // Public API
      widget,    // Widget interface (REQUIRED!)
      metadata: MyNewModule.metadata
    };
  }
};

// Module export for DI container
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MyNewModule;
}
```

### Blueprint for New Upgrade

```markdown
# Blueprint 0xNNNNNN: My New Module

**Objective:** To [what this module does]

**Target Upgrade:** MNEW (`my-new-module.js`)

**Prerequisites:**
- 0x000003 (Core Utilities & Error Handling)
- 0x00004E (Module Widget Protocol) ⚠️ **REQUIRED REFERENCE**

**Affected Artifacts:** `/upgrades/my-new-module.js`, `/tests/unit/my-new-module.test.js`

---

### 1. The Strategic Imperative

[Why this module is needed]

### 2. The Architectural Solution

[How the module works]

### 3. The Implementation Pathway

1. Create module structure following module-widget-protocol
2. Implement core API
3. **Create web component widget** (see 0x00004E)
4. Register with DI container
5. Write unit tests

### 4. Web Component Widget

**REQUIRED**: Every upgrade must have a widget. See Blueprint 0x00004E for the widget protocol.

The widget must:
- Extend `HTMLElement`
- Use Shadow DOM (`attachShadow`)
- Implement `getStatus()` returning widget status
- Be registered as custom element
- Be defined **in the same file** as the module

[Widget implementation details]
```

### Unit Test for New Upgrade

```javascript
// tests/unit/my-new-module.test.js

const { describe, it, expect, beforeEach } = require('@jest/globals');

describe('MyNewModule', () => {
  let module;

  beforeEach(() => {
    // Setup
  });

  it('should initialize correctly', () => {
    expect(module).toBeDefined();
  });

  it('should have required API methods', () => {
    expect(module.api.doSomething).toBeDefined();
  });

  it('should have widget interface', () => {
    expect(module.widget).toBeDefined();
    expect(module.widget.element).toBe('my-new-module-widget');
    expect(module.widget.category).toBeDefined();
  });

  it('should register custom element', () => {
    expect(customElements.get('my-new-module-widget')).toBeDefined();
  });
});
```

---

## 3. Key Decision Matrix

### When to Create an MCP Tool?

**NEVER FROM WITHIN REPLOID!** MCP tools are external.

Instead, REPLOID should:
- Use existing MCP tools if available
- Request the human operator to install MCP servers
- Document the need in a blueprint/RFC

### When to Create a REPLOID Upgrade?

✅ When you need to:
- Extend REPLOID's internal capabilities
- Add new modules to the agent system
- Create reusable utilities or services
- Implement new agent behaviors
- Add visualization/monitoring capabilities

✅ Requirements checklist:
- [ ] Create blueprint (`blueprints/0xNNNNNN-module-name.md`)
- [ ] Reference module-widget-protocol (Blueprint 0x00004E)
- [ ] Implement module following DI container pattern
- [ ] **Create web component widget IN SAME FILE**
- [ ] Implement widget status protocol
- [ ] Add @blueprint annotation
- [ ] Write unit test
- [ ] Register with boot system

---

## 4. Common Mistakes

### ❌ WRONG: Creating MCP Tool from REPLOID

```javascript
// This will NOT create an MCP tool!
await StateManager.createArtifact(
  '/modules/read_file.js',
  'javascript',
  'function read_file() { ... }'
);
```

**Why wrong:** MCP tools are external, not internal modules.

### ✅ CORRECT: Creating REPLOID Upgrade

```javascript
// This creates a proper internal upgrade
await StateManager.createArtifact(
  '/modules/file-analyzer.js',
  'javascript',
  `// @blueprint 0x000069

  const FileAnalyzer = {
    metadata: { /* ... */ },
    factory: (deps) => {
      // ... implementation ...

      // Widget (REQUIRED!)
      class FileAnalyzerWidget extends HTMLElement { /* ... */ }

      return {
        api: { /* ... */ },
        widget: { element: 'file-analyzer-widget', /* ... */ }
      };
    }
  };`
);
```

### ❌ WRONG: Upgrade Without Widget

```javascript
// Missing widget interface!
return {
  api: { doSomething: () => {} }
  // ❌ No widget!
};
```

**Why wrong:** Violates 1:1:1:1 pattern. All upgrades need widgets.

### ✅ CORRECT: Upgrade With Widget

```javascript
return {
  api: { doSomething: () => {} },
  widget: {
    element: 'my-module-widget',
    displayName: 'My Module',
    icon: '🔧',
    category: 'tools'
  }
};
```

---

## 5. Self-Modification Guidelines

### Creating New Upgrades (Modules)

1. **Read Blueprint 0x00004E** (Module Widget Protocol) FIRST
2. Create blueprint following 0x000018 (Blueprint Creator)
3. Reference 0x00004E in prerequisites
4. Implement module with widget IN SAME FILE
5. Write unit test
6. Add @blueprint annotation
7. Test locally before committing

### DO NOT Attempt to Create MCP Tools

MCP tools are **external**. If you need external capabilities:
1. Document the need in a blueprint/RFC
2. List required MCP servers
3. Inform the human operator
4. Use existing MCP tools if available

---

## 6. Quick Reference

**I need to interact with external systems** → Use existing MCP tools or request new MCP server installation

**I need to extend REPLOID's internal capabilities** → Create REPLOID upgrade (module)

**I'm creating a new module** → Follow 1:1:1:1 pattern + read Blueprint 0x00004E

**I'm modifying an existing module** → Preserve widget interface, update blueprint, update test

**I need a UI for my module** → Widget is REQUIRED, defined in same file, follows 0x00004E protocol

---

## 7. References

- **Blueprint 0x00004E**: Module Widget Protocol (REQUIRED for all upgrades)
- **Blueprint 0x000016**: Meta-Tool Creation Patterns (for dynamic tools, NOT upgrades)
- **Blueprint 0x000018**: Blueprint Creator (for creating blueprints)
- **Blueprint 0x000026**: Module Manifest Governance (for module dependencies)

---

## Conclusion

**Remember:**
- **MCP Tools** = External, not modifiable from REPLOID
- **REPLOID Upgrades** = Internal, fully modifiable, REQUIRE widgets
- **Always reference Blueprint 0x00004E** when creating new upgrades
- **1:1:1:1 pattern is mandatory**: Module : Blueprint : Test : Widget

When in doubt, ask: "Is this part of REPLOID's internal codebase?"
- YES → It's an upgrade (needs widget)
- NO → It's an MCP tool (external)
