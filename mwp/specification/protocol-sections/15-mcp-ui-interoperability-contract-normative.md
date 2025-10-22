## 15. mcp-ui Interoperability Contract (Normative)

### 16.1 Purpose and Scope

**MCP-WP-16.1.1:** This section defines bidirectional compatibility between MCP-WP and the community-driven mcp-ui protocol.

**MCP-WP-16.1.2:** Strategic positioning: MCP-WP aims to formalize the concepts pioneered by mcp-ui, not replace it. This interoperability enables gradual migration while preserving ecosystem investments.

**MCP-WP-16.1.3:** This interoperability is OPTIONAL. Hosts MAY choose to support only MCP-WP native format.

### 15.2 mcp-ui Protocol Overview

**MCP-WP-16.2.1:** The mcp-ui protocol defines a `UIResource` payload format:

```typescript
interface UIResource {
  uri: string;                        // Resource identifier
  mimeType: string;                   // Content type
  content: string;                    // Resource content or URL
}
```

**MCP-WP-16.2.2:** Supported MIME types:

| MIME Type | Rendering Method |
|-----------|------------------|
| `text/html` | Sandboxed iframe with `srcdoc` |
| `text/uri-list` | Sandboxed iframe loading external URL |
| `application/vnd.mcp-ui.remote-dom` | Shopify remote-dom execution in sandbox |

### 15.3 Converting mcp-ui to MCP-WP

**MCP-WP-16.3.1:** Hosts supporting mcp-ui compatibility SHOULD implement a `UIResourceAdapter`:

```typescript
interface UIResourceAdapter {
  fromMCPUI(resource: UIResource, mcpServerInfo: MCPServerInfo): MCPWidgetInterface;
  toMCPUI(widget: MCPWidgetInterface): UIResource;
  isMCPUICompatible(widget: MCPWidgetInterface): boolean;
}
```

**MCP-WP-16.3.2:** When converting `text/html` UIResource:
- Create custom element extending `HTMLElement`
- Render content in sandboxed `<iframe>` with `srcdoc` attribute
- Apply CSP: `default-src 'self'; script-src 'unsafe-inline';`
- Set `mcpUICompatible: true` in widget metadata

**MCP-WP-16.3.3:** When converting `text/uri-list` UIResource:
- Validate URL is HTTPS (reject `http://` URLs)
- Load URL in sandboxed `<iframe>` with `src` attribute
- Apply same sandbox restrictions as `text/html`

**MCP-WP-16.3.4:** When converting `application/vnd.mcp-ui.remote-dom`:
- Execute script in sandboxed environment
- Use Shopify's `@remote-dom/core` library for message-passing
- Render UI changes via host's native components
- Requires `permissions.network` due to message-passing requirements

### 15.4 Converting MCP-WP to mcp-ui

**MCP-WP-16.4.1:** Widgets MAY export to mcp-ui format by setting `mcpUICompatible: true` in metadata.

**MCP-WP-16.4.2:** Export options:
- **As `text/html`**: Serialize widget's rendered shadow DOM to static HTML
- **As `text/uri-list`**: Provide hosted URL if widget has `repository.url` field
- **As remote-dom**: Implement full remote-dom protocol (advanced, optional)

**MCP-WP-16.4.3:** Limitations of mcp-ui export:
- Static HTML export loses interactivity and event handlers
- No access to MCP-WP host dependencies (EventBus, MCPBridge)
- Widget updates require re-export and re-distribution

### 15.5 Discovery and Negotiation

**MCP-WP-16.5.1:** When connecting to an MCP server, hosts SHOULD:
1. Check if server provides mcp-ui resources via `resources/list`
2. If found and host supports mcp-ui, use `UIResourceAdapter.fromMCPUI()`
3. Otherwise, fall back to generic MCP-WP widget

**MCP-WP-16.5.2:** This allows MCP-WP hosts to consume existing mcp-ui widgets without modification.

### 15.6 Security Considerations

**MCP-WP-16.6.1:** mcp-ui widgets MUST be treated with `trustLevel: 'untrusted'` unless explicitly verified.

**MCP-WP-16.6.2:** Sandboxed iframes MUST include these attributes:
- `sandbox="allow-scripts allow-same-origin"`
- Content Security Policy enforcement
- No access to host DOM or storage

**MCP-WP-16.6.3:** Remote DOM scripts MUST execute in isolated contexts with message-passing validation.

### 15.7 Migration Path

**MCP-WP-16.7.1:** Recommended migration strategy (3 phases):

**Phase 1: Compatibility Layer**
- Deploy MCP-WP host with `UIResourceAdapter` support
- Existing mcp-ui widgets work without changes
- No ecosystem disruption

**Phase 2: Hybrid Enhancement**
- Add MCP-WP features to widgets: permissions, `getStatus()`, `getMCPInfo()`
- Maintain backward compatibility via `toMCPUI()` export
- Widgets support both protocols

**Phase 3: Full MCP-WP Native**
- Rewrite using MCP-WP APIs (EventBus, MCPBridge)
- Leverage advanced features (trust levels, audit logs, widget composition)
- Optionally maintain mcp-ui export for backward compatibility

---
