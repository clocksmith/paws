## 12. Standard Widget Types (Informative)

### 13.1 Recommended Standard Widgets

Implementations SHOULD provide these standard widget types:

**mcp-server-status-widget**

- Compact status badge
- Shows server name, connection state, tool/resource counts
- Minimal interaction

**mcp-server-panel-widget (Recommended default)**

- Tabbed interface: Overview | Tools | Resources | Prompts | Activity
- Full-featured server dashboard
- Tool invocation forms, resource browser, activity log

**mcp-tool-browser-widget**

- Dedicated tool discovery and invocation UI
- Searchable tool list
- Auto-generated forms from JSON Schema

**mcp-resource-explorer-widget**

- File-browser-style UI for resources
- Preview pane for common MIME types
- URI template support

**mcp-activity-log-widget**

- Chronological timeline of tool calls
- Request/response inspection
- Performance metrics (latency)

---
