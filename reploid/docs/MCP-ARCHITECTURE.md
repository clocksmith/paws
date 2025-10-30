# MCP Architecture for Reploid

**Status:** DRAFT - Being written as implementation progresses

## Overview

Reploid has been refactored to use MCP (Model Context Protocol) servers internally, with Lens widgets providing the UI layer.

This architecture separates concerns:
- **MCP Servers** provide tool-based APIs for agent operations
- **Lens Widgets** provide user interface for approvals and monitoring
- **MCP Bridge** connects external MCP clients to internal servers

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    External MCP Client                  │
│              (Claude Desktop, other clients)            │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ WebSocket/SSE
                        ↓
┌─────────────────────────────────────────────────────────┐
│                      MCP Bridge                         │
│           (Protocol translation & routing)              │
└───────────────────────┬─────────────────────────────────┘
                        │
         ┌──────────────┼──────────────┐
         ↓              ↓              ↓
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ VFS Server  │  │ Workflow    │  │ Analytics   │
│             │  │ Server      │  │ Server      │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ↓
┌─────────────────────────────────────────────────────────┐
│                   Reploid Core                          │
│         (SentinelFSM, StateManager, etc.)               │
└─────────────────────────────────────────────────────────┘
                        ↑
                        │
┌─────────────────────────────────────────────────────────┐
│                    Lens Widgets                         │
│      (Agent Control, VFS Explorer, Diff Viewer)         │
└─────────────────────────────────────────────────────────┘
```

[TODO: Add detailed architecture diagram once implementation is complete]

## MCP Servers

### VFS MCP Server
**Status:** [PENDING - a2-1]
**File:** `reploid/upgrades/mcp/servers/vfs-mcp-server.js`

Provides virtual file system operations for Reploid's artifact storage.

**Tools:**
- `read_artifact` - Read file from VFS
  - Input: `{ path: string, version?: string }`
  - Output: `{ content: string, metadata: object }`

- `write_artifact` - Write file to VFS
  - Input: `{ path: string, content: string }`
  - Output: `{ success: boolean, path: string }`

- `list_artifacts` - List all files
  - Input: `{ path?: string }`
  - Output: `{ artifacts: Array<{ path, size, modified }> }`

- `delete_artifact` - Delete file
  - Input: `{ path: string }`
  - Output: `{ success: boolean }`

- `diff_artifacts` - Compare file versions
  - Input: `{ path: string, version1: string, version2: string }`
  - Output: `{ diff: string }`

- `get_artifact_history` - Get version history
  - Input: `{ path: string }`
  - Output: `{ versions: Array<{ version, timestamp, author }> }`

### Workflow MCP Server
**Status:** [PENDING - a2-3]
**File:** `reploid/upgrades/mcp/servers/workflow-mcp-server.js`

Manages agent workflow and approval processes.

**Tools:**
- `start_goal` - Start working on a goal
  - Input: `{ goal: string }`
  - Output: `{ success: boolean, agentId: string }`

- `get_agent_status` - Get current agent state
  - Input: `{}`
  - Output: `{ state: string, currentTask: string, progress: number }`

- `get_context_preview` - Get context awaiting approval
  - Input: `{}`
  - Output: `{ files: Array, estimatedTokens: number }`

- `approve_context` - Approve context curation
  - Input: `{}`
  - Output: `{ success: boolean }`

- `reject_context` - Reject and revise context
  - Input: `{ feedback?: string }`
  - Output: `{ success: boolean }`

- `get_proposal_preview` - Get proposal awaiting approval
  - Input: `{}`
  - Output: `{ changes: Array, summary: string }`

- `approve_proposal` - Approve code changes
  - Input: `{}`
  - Output: `{ success: boolean }`

- `reject_proposal` - Reject proposal
  - Input: `{ feedback?: string }`
  - Output: `{ success: boolean }`

### Analytics MCP Server
**Status:** [PENDING - a2-2]
**File:** `reploid/upgrades/mcp/servers/analytics-mcp-server.js`

Provides metrics and analytics about agent operations.

**Tools:**
- `get_session_metrics` - Get current session statistics
- `get_token_usage` - Get token usage breakdown
- `get_cost_estimate` - Calculate cost estimates
- `export_session_log` - Export session audit log

[TODO: Complete documentation as servers are implemented]

## MCP Bridge

**Status:** [PENDING - a1-4]
**File:** `reploid/upgrades/core/mcp-bridge-server.js`

Connects external MCP clients to internal servers via WebSocket or SSE transport.

[TODO: Document bridge API once implemented]

## Lens Widgets

**Status:** [PENDING - a3-*]

### Agent Control Widget
**Status:** [PENDING - a3-1]
**Path:** `lens/widgets/reploid/agent-control/`

Main control interface for approving agent operations.

**Features:**
- Shows current agent state
- Context approval interface
- Proposal approval interface
- Real-time status updates

[TODO: Add screenshots and usage examples]

### VFS Explorer Widget
**Status:** [PENDING - a3-2]
**Path:** `lens/widgets/reploid/vfs-explorer/`

[TODO: Document when available]

### Diff Viewer Widget
**Status:** [PENDING - a3-3]
**Path:** `lens/widgets/reploid/diff-viewer/`

[TODO: Document when available]

## Integration Points

### How MCP Servers Connect to Reploid Core

[TODO: Document integration patterns once implemented]

### How Widgets Call MCP Tools

[TODO: Document widget-to-MCP communication once implemented]

## Performance Considerations

[TODO: Add performance benchmarks and optimization notes]

## Security Model

[TODO: Document security boundaries and authentication]

## Migration Guide

**Status:** DRAFT

[TODO: Write migration guide once implementation is stable]

### Before Migration

Reploid used direct function calls between components.

### After Migration

Reploid uses MCP tool calls, allowing external clients to control the agent.

## Development Guide

[TODO: Write guide for developing new MCP servers]

## Testing

See `reploid/tests/mcp-servers/` for test suites.

Run tests:
```bash
node reploid/tests/mcp-servers/vfs-server.test.js
node reploid/tests/mcp-servers/workflow-server.test.js
```

Run benchmarks:
```bash
node reploid/tests/benchmarks/mcp-overhead.bench.js
```

## Troubleshooting

[TODO: Add common issues and solutions]

## References

- [MCP Specification](https://modelcontextprotocol.io/docs)
- [Reploid Agent Workflow](./AGENT-WORKFLOW.md)
