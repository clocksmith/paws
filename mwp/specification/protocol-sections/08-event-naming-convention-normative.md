## 8. Event Naming Convention (Normative)

### 8.1 Event Pattern

**MWP-8.1.1:** All MCP widget events MUST use the `mcp:` domain prefix.

**MWP-8.1.2:** Event format: `mcp:<subject>:<action>`

### 8.2 Standard MCP Events

**MWP-8.2.1:** The following events are REQUIRED for MCP operations:

| Event Name                  | Data Schema                                                                   | Emitted By | Description                     |
| --------------------------- | ----------------------------------------------------------------------------- | ---------- | ------------------------------- |
| `mcp:server:connected`      | `{ serverName: string }`                                                      | Host       | Server connection established   |
| `mcp:server:disconnected`   | `{ serverName: string, reason?: string }`                                     | Host       | Server connection lost          |
| `mcp:server:error`          | `{ serverName: string, error: Error }`                                        | Host       | Server error occurred           |
| `mcp:tool:invoke-requested` | `{ serverName: string, toolName: string, args: object }`                      | Widget     | User requested tool invocation  |
| `mcp:tool:calling`          | `{ serverName: string, toolName: string, args: object }`                      | Host       | Tool invocation started         |
| `mcp:tool:result`           | `{ serverName: string, toolName: string, result: ToolResult, latency: number }` | Host     | Tool invocation completed       |
| `mcp:tool:error`            | `{ serverName: string, toolName: string, error: Error }`                      | Host       | Tool invocation failed          |
| `mcp:resource:read-requested` | `{ serverName: string, uri: string }`                                       | Widget     | User requested resource read    |
| `mcp:resource:read`         | `{ serverName: string, uri: string, contents: ResourceContents }`             | Host       | Resource read completed         |
| `mcp:prompt:invoke-requested` | `{ serverName: string, promptName: string, args: object }`                  | Widget     | User requested prompt           |
| `mcp:prompt:result`         | `{ serverName: string, promptName: string, messages: PromptMessages }`        | Host       | Prompt generated                |

---
