## 7. MCP Primitives Rendering (Normative)

### 7.1 Tool Rendering

**MCP-WP-7.1.1:** Widgets that display MCP tools MUST show:

- Tool name (or `title` when provided)
- Tool description (if provided)
- Input schema summary (e.g., "Requires: owner, repo")

**MCP-WP-7.1.2:** Widgets that provide tool invocation UI MUST:

- Generate forms from the tool's inputSchema (JSON Schema)
- Validate user input against the schema before invocation
- Display validation errors inline

**MCP-WP-7.1.2a:** Widgets SHOULD expose any declared `outputSchema` and `annotations` (e.g., `readOnlyHint`, `idempotentHint`) to help users and agents understand tool behaviour.

**MCP-WP-7.1.3:** Tool invocation MUST emit events rather than calling MCPBridge directly:

```javascript
// CORRECT: Emit event for host to handle
EventBus.emit('mcp:tool:invoke-requested', {
  serverName: 'github',
  toolName: 'create_issue',
  args: { owner: 'anthropics', repo: 'mcp', title: '...' }
});

// INCORRECT: Direct call bypasses security
await MCPBridge.callTool('github', 'create_issue', args); // ❌
```

### 7.2 Resource Rendering

**MCP-WP-7.2.1:** Widgets that display MCP resources MUST show:

- Resource URI
- A human-friendly label, preferring `title` when present and falling back to `name`
- MIME type (if available)

**MCP-WP-7.2.1a:** Widgets SHOULD surface additional metadata when provided, such as `annotations` (`audience`, `priority`, `lastModified`) and `size`.

**MCP-WP-7.2.2:** Widgets SHOULD provide preview for common MIME types:

- `text/*`: Show text content
- `image/*`: Show thumbnail
- `application/json`: Pretty-print JSON

**MCP-WP-7.2.3:** Resource URIs with templates (e.g., `file:///{path}`) SHOULD render as interactive forms.

### 7.3 Prompt Rendering

**MCP-WP-7.3.1:** Widgets that display MCP prompts MUST show:

- Prompt name (and `title` when provided)
- Prompt description (if provided)
- Required vs optional arguments

**MCP-WP-7.3.2:** Prompt invocation SHOULD generate forms for arguments.

**MCP-WP-7.3.3:** Prompt results SHOULD display the generated messages in a readable format.

---
