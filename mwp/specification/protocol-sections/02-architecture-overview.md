## 2. Architecture Overview

### 2.1 MCP Widget Architecture (Informative)

```
┌─────────────────────────────────────────────────────────────┐
│ Host Dashboard                                              │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ EventBus     │ │ MCPBridge    │ │Configuration │         │
│ │ (Sec. 6.1)   │ │ (Sec. 6.2)   │ │ (Sec. 6.3)   │         │
│ └──────┬───────┘ └──────┬───────┘ └──────┬───────┘         │
│        │                │                │                  │
│        └────────────────┼────────────────┘                  │
│                         │                                   │
│                         ▼                                   │
│        ┌────────────────────────────────┐                   │
│        │ MCP Widget Factory             │                   │
│        │ createMCPWidget(deps, info)    │                   │
│        └────────────┬───────────────────┘                   │
│                     │                                       │
│                     ▼                                       │
│        ┌────────────────────────────────┐                   │
│        │ MCP Widget Instance            │                   │
│        │ ┌──────────┐ ┌────────────┐   │                   │
│        │ │ API      │ │ Component  │   │                   │
│        │ └──────────┘ │ (Renders   │   │                   │
│        │              │ Tools/     │   │                   │
│        │              │ Resources) │   │                   │
│        │              └────────────┘   │                   │
│        └────────────┬───────────────────┘                   │
│                     │                                       │
│                     ▼                                       │
│        ┌────────────────────────────────┐                   │
│        │ MCP Server (External)          │                   │
│        │ ┌──────────────────────┐       │                   │
│        │ │ Tools Resources      │       │                   │
│        │ │ Prompts              │       │                   │
│        │ └──────────────────────┘       │                   │
│        │ JSON-RPC via stdio/http        │                   │
│        └────────────────────────────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 MCP Communication Flow (Informative)

1. Host connects to MCP server via MCPBridge (stdio or HTTP transport)
2. Host sends initialize JSON-RPC request → receives server capabilities
3. Host calls tools/list, resources/list, prompts/list → receives MCP primitives
4. Host creates MCP widget, passing server info and primitives
5. Widget renders UI showing available tools, resources, prompts
6. User interacts with widget (e.g., clicks "Invoke Tool")
7. Widget emits event on EventBus
8. Host handles event, calls MCPBridge to invoke tool via tools/call JSON-RPC
9. Widget displays result

---
