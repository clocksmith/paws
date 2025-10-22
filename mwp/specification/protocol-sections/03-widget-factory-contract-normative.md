## 3. Widget Factory Contract (Normative)

### 3.1 Export Requirements

MCP-WP-3.1.1: An MCP widget module MUST export a default function (the "widget factory").

MCP-WP-3.1.2: The widget factory MUST accept exactly two arguments:

1. dependencies: Host-provided services object
2. mcpServerInfo: MCP server information object

MCP-WP-3.1.3: The widget factory MAY be declared as async.

MCP-WP-3.1.4: The widget factory MUST return a value conforming to the MCPWidgetInterface schema (Section 3.3).

### 3.2 Widget Factory Signature

```typescript
export default function createMCPWidget(
  dependencies: DependenciesObject,
  mcpServerInfo: MCPServerInfo
): MCPWidgetInterface | Promise<MCPWidgetInterface>;
```

**Where:**

```typescript
interface DependenciesObject {
EventBus: EventBusInterface; // See Section 6.1
MCPBridge: MCPBridgeInterface; // See Section 6.2
Configuration: ConfigurationInterface; // See Section 6.3
}

interface MCPServerInfo {
serverName: string; // Unique server identifier (e.g., "github")
transport: 'stdio' | 'http'; // Communication transport
protocolVersion: string; // MCP protocol version (e.g., "2025-06-18")
capabilities: MCPCapabilities; // Server capabilities
tools: MCPTool[]; // Available tools
resources: MCPResource[]; // Available resources
prompts: MCPPrompt[]; // Available prompts
}

interface MCPCapabilities {
tools?: { listChanged?: boolean };
resources?: { subscribe?: boolean, listChanged?: boolean };
prompts?: { listChanged?: boolean };
sampling?: Record<string, unknown>; // Presence indicates the server can handle sampling/createMessage
}

interface MCPTool {
name: string;
title?: string;
description?: string;
inputSchema: object; // JSON Schema Draft 7
outputSchema?: object;
annotations?: Record<string, unknown>;
}

interface MCPResource {
uri: string;
name?: string;
title?: string;
description?: string;
mimeType?: string;
size?: number;
annotations?: Record<string, unknown>;
}

interface MCPPrompt {
name: string;
title?: string;
description?: string;
arguments?: Array<{
name: string;
description?: string;
required?: boolean;
}>;
}
```

Hosts **SHOULD** validate the `protocolVersion` returned by each server during initialization and gracefully degrade or terminate the session if the negotiated version is not supported.

### 3.3 Widget Interface Schema

```typescript
interface MCPWidgetInterface {
api: WidgetAPI;
widget: MCPWidgetMetadata; // See Section 4
}

interface WidgetAPI {
initialize?: () => Promise<void>;
destroy?: () => Promise<void>;
refresh?: () => Promise<void>; // NEW: Refresh MCP server data
agent?: AgentAPI; // Optional agent collaboration contract
  [key: string]: any;
}
```

### 3.4 Lifecycle Methods

MCP-WP-3.4.1: If api.initialize() is present, it MUST be an async function returning Promise<void>.

MCP-WP-3.4.2: If api.destroy() is present, it MUST perform complete cleanup including:

- Removal of all EventBus listeners
- Cancellation of all timers and intervals
- Cleanup of all MCP server subscriptions

MCP-WP-3.4.3: If api.refresh() is present, it MUST re-fetch MCP server data (tools/resources/prompts) and update the
widget UI.

MCP-WP-3.4.4: api.destroy() MUST complete within 5000 milliseconds.

### 3.5 Agent Collaboration Contract

MCP-WP-3.5.1: Widgets that expose automation hooks **MUST** surface them through the optional `agent` field on `WidgetAPI`.

MCP-WP-3.5.2: If present, the `agent` object **MUST** conform to the following interface:

```typescript
interface AgentAPI {
  /**
   * Return a JSON Schema document describing the actions an agent can perform.
   */
  getCapabilities(): JSONSchema;

  /**
   * Execute a named action with structured parameters.
   */
  executeAction(action: string, params: object): Promise<ActionResult>;

  /**
   * Optional stream of status updates for long-running actions.
   */
  subscribe?: (handler: (update: AgentProgress) => void) => UnsubscribeFunction;
}

interface AgentProgress {
  action: string;
  state: 'queued' | 'running' | 'succeeded' | 'failed';
  message?: string;
  lastUpdated: number;
}

interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: { message: string; code?: string };
}
```

MCP-WP-3.5.3: Hosts **MUST** apply the same confirmation and logging policies to agent-triggered actions as to human-triggered actions.

MCP-WP-3.5.4: Widgets **SHOULD** guard agent actions behind capability flags so hosts can decide whether to expose them in sensitive environments.

---
