# MCP Widget Protocol (MWP)

**Make Model Context Protocol servers visual, interactive, and safe**

Version 1.0.0 | [Full Specification](./specification/MWP.md)

---

## What & Why

MWP standardizes how to build **visual dashboards** for Anthropic's [Model Context Protocol](https://modelcontextprotocol.io/) servers. It transforms MCP's headless backend into an interactive, observable UI layer while enforcing security controls.

**The Problem:** MCP servers expose powerful tools (GitHub issue creation, Slack messaging, database queries) but have no standard visual interface.

**The Solution:** A protocol for building secure Web Component widgets that render MCP primitives (tools, resources, prompts) in any dashboard application.

---

## How It Works

```javascript
// 30-second demo: GitHub MCP widget
export default function createGitHubWidget({ EventBus, MCPBridge }, mcpServerInfo) {
  class GitHubWidget extends HTMLElement {
    connectedCallback() {
      this.shadowRoot.innerHTML = `
        <h3>GitHub Tools</h3>
        <button id="create-issue">Create Issue</button>
      `;
      this.shadowRoot.querySelector('#create-issue').onclick = () => {
        EventBus.emit('mcp:tool:invoke-requested', {
          serverName: 'github',
          toolName: 'create_issue',
          args: { repo: 'anthropics/mcp', title: 'Bug report' }
        });
        // Host intercepts → shows confirmation → executes if approved
      };
    }
  }
  customElements.define('github-mcp-widget', GitHubWidget);
  return { api: { initialize, destroy, refresh }, widget: { element: 'github-mcp-widget', ... } };
}
```

**Architecture:**
```
Dashboard Host → Injects EventBus, MCPBridge, Configuration
    ↓
Widget (Web Component) → Emits tool invocation requests
    ↓
Host → Shows confirmation dialog → Validates → Executes via MCP server
```

---

## Core Goals

1. **Standardize visual representation** of MCP servers through strict Web Component contracts for consistent rendering.
2. **Enable safe interaction** with user confirmation for tool invocations, XSS prevention, and JSON Schema validation.
3. **Provide dependency injection** where hosts supply EventBus/MCPBridge/Configuration to decouple widgets from implementations.
4. **Establish lifecycle management** with initialize/destroy contracts and event-driven refresh to prevent resource leaks.
5. **Create reusable widget ecosystem** where developers build visual interfaces for any MCP server (GitHub, Slack, Supabase) that auto-integrate with host dashboards.

---

**Widget Factory Contract:**
```javascript
export default function createWidget({ EventBus, MCPBridge, Configuration }, mcpServerInfo) {
  class Widget extends HTMLElement { /* ... */ }
  customElements.define('mcp-widget', Widget);
  return {
    api: { initialize, destroy, refresh },
    widget: { protocolVersion: '1.0.0', element: 'mcp-widget', displayName, capabilities, ... }
  };
}
```

**Security by Design:**
- All tool invocations require user confirmation (host intercepts `mcp:tool:invoke-requested` events)
- XSS prevention via safe rendering (`textContent`, not `innerHTML`)
- JSON Schema validation before execution
- No direct MCP server access from widgets

---

## Relationship to REPLOID's Internal Module Widget Protocol

**Important Distinction:** MCP Widget Protocol (MWP) is for **external MCP servers**. REPLOID has a separate **internal "Module Widget Protocol"** for its own modules:

| Aspect | MCP Widget Protocol (MWP) | REPLOID Module Widget Protocol |
|--------|------------------------------|--------------------------------|
| **Purpose** | Visualize external MCP servers | Visualize internal REPLOID modules |
| **Audience** | GitHub, Slack, Supabase servers | ToolRunner, StateManager, 75+ upgrades |
| **Communication** | JSON-RPC via MCPBridge | Direct closure access |
| **Security** | User confirmation required | Trusted (same origin) |
| **Documentation** | This repository | `reploid/docs/MODULE_WIDGET_PROTOCOL.md` |

**Integration:** REPLOID can show both widget types in the same dashboard using a hybrid approach. See `reploid/docs/MWP_INTEGRATION_GUIDE.md` for the complete integration guide showing how to:
- Add MCP Bridge to connect external MCP servers
- Create MWP widgets for those servers
- Display them alongside internal REPLOID module widgets

**Conversion Path:** Internal REPLOID modules can be converted to MCP servers (making them reusable outside REPLOID) and then visualized with MWP widgets. The integration guide includes examples.

---

## Documentation

📄 **[Full Specification](./specification/MWP.md)** - Complete protocol definition with normative contracts

📋 **[Strategy Document](./STRATEGY.md)** - Adoption roadmap and implementation strategies

**Key Sections:**
- Widget Factory Contract, Metadata Schema, Web Component Contract
- Host-Provided Dependencies (EventBus, MCPBridge, Configuration)
- Event Naming Convention, Security Requirements, Protocol Versioning
- Standard Widget Types (server-status, server-panel, tool-browser, resource-explorer, activity-log)

---

## Use Cases

**GitHub Widget:** Create issues/PRs, browse repositories, view activity logs with auto-generated forms from JSON Schema

**Slack Widget:** Send messages, manage channels, display users/channels as resources with real-time subscriptions

**Supabase Widget:** Execute database queries, CRUD operations on tables/rows, schema introspection

**REPLOID Widget (Potential):** Visual interface for [PAWS REPLOID MCP server](../reploid/mcp-server/README.md)
- Interactive VFS browser with syntax highlighting
- Blueprint gallery with search and filtering
- Side-by-side visual diff viewer for code modifications
- Test results dashboard with pass/fail charts
- Git checkpoint timeline visualization
- Visual approval flows for self-modification operations

---

## Contributing

1. Review the [full specification](./specification/MWP.md)
2. Submit protocol improvements or widget implementations
3. Report security vulnerabilities responsibly

See [CONTRIBUTING.md](./CONTRIBUTING.md) for detailed development guidelines.

---

## License & Links

MIT License | [Model Context Protocol](https://modelcontextprotocol.io/) | [MCP Specification](https://spec.modelcontextprotocol.io/) | [MCP GitHub](https://github.com/modelcontextprotocol)

---

*Making Model Context Protocol Interactive and Observable*
