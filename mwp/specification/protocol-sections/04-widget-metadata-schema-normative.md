## 4. Widget Metadata Schema (Normative)

### 4.1 Required Fields

**MCP-WP-4.1.1:** The widget object MUST contain the following fields:

```typescript
interface MCPWidgetMetadata {
  // Core MCP-WP fields
  protocolVersion: '1.0.0';  // MCP-WP spec version
  element: string;                      // Custom element tag name
  displayName: string;                  // Human-readable name
  icon: string;                         // Emoji or SVG
  category: 'MCP Servers';              // MUST be exactly "MCP Servers"

  // MCP-specific fields (REQUIRED)
  mcpServerName: string;                // MUST match MCPServerInfo.serverName
  transport: 'stdio' | 'http';          // MUST match MCPServerInfo.transport
  mcpProtocolVersion: string;           // MCP protocol version from server
  capabilities: MCPCapabilitiesSummary;

  // Security & Trust fields 
  permissions?: WidgetPermissions;      // Required permissions
  trustLevel?: TrustLevel;              // Trust tier for sandboxing
  signature?: WidgetSignature;          // Code signature for verified widgets

  // Distribution fields 
  repository?: WidgetRepository;        // Source code and distribution info
  integrity?: string;                   // SHA256 hash of widget bundle

  // Compatibility fields 
  mcpUICompatible?: boolean;            // Can export to mcp-ui format
  mcpUIResourceTypes?: Array<'text/html' | 'text/uri-list' | 'application/vnd.mcp-ui.remote-dom'>;

  // Optional fields
  priority?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  widgetType?: MCPWidgetType;
  metadata?: WidgetMetadata;
}

interface MCPCapabilitiesSummary {
  tools: boolean;                  // Server exposes tools
  resources: boolean;              // Server exposes resources
  prompts: boolean;                // Server exposes prompts
  sampling: boolean;               // Server supports sampling
}

type MCPWidgetType =
  | 'server-status'                // Compact status indicator
  | 'server-panel'                 // Full-featured panel with tabs
  | 'tool-browser'                 // Tool discovery and invocation UI
  | 'resource-explorer'            // Resource browsing UI
  | 'activity-log';                // Call history and debugging

// v1.1.0 Types
interface WidgetPermissions {
  network?: {
    domains: string[];
    protocols?: ('http' | 'https' | 'ws' | 'wss')[];
    maxRequestsPerMinute?: number;
  };
  storage?: 'none' | 'session' | 'persistent';
  clipboard?: boolean;
  notifications?: boolean;
  mcpOperations?: {
    invokeTool?: boolean;
    readResource?: boolean;
    getPrompt?: boolean;
    subscribeToUpdates?: boolean;
  };
  custom?: Record<string, any>;
}

type TrustLevel = 'untrusted' | 'community' | 'verified' | 'enterprise';

interface WidgetSignature {
  algorithm: 'RS256' | 'ES256';
  publicKey: string;
  signature: string;
  signedAt: string;
  publisher: {
    name: string;
    email?: string;
    url?: string;
  };
}

interface WidgetRepository {
  type: 'git' | 'npm' | 'github' | 'custom';
  url: string;
  commit?: string;
  version?: string;
  license?: string;
}
```

### 4.2 Field Constraints

**MCP-WP-4.2.1:** protocolVersion MUST be "1.0.0".

**MCP-WP-4.2.2:** element MUST match pattern `^mcp-[a-z0-9-]+-widget$` (e.g., `mcp-github-widget`).

**MCP-WP-4.2.3:** category MUST be exactly the string "MCP Servers".

**MCP-WP-4.2.4:** mcpServerName MUST match the server name provided in MCPServerInfo.

**MCP-WP-4.2.5:** transport MUST match the transport provided in MCPServerInfo.

**MCP-WP-4.2.6:** mcpProtocolVersion MUST be a valid MCP protocol version string (e.g., "2025-06-18"). Hosts **SHOULD** verify the value returned during initialization matches a version they support before activating the widget.

**MCP-WP-4.2.7:** widgetType if present SHOULD guide the host's layout decisions.

**MCP-WP-4.2.8:** If `permissions` is present, it MUST conform to the `WidgetPermissions` schema.

**MCP-WP-4.2.9:** If `trustLevel` is `'verified'`, the `signature` field MUST be present and valid.

**MCP-WP-4.2.10:** If `integrity` is present, it MUST be a SHA256 hash in the format: `sha256-<base64>`.

**MCP-WP-4.2.11:** If `mcpUICompatible` is `true`, the widget MUST implement the `toMCPUI()` adapter method (see Section 15).

### 4.3 Optional Features

**MCP-WP-4.3.1:** Advanced features (Theme, WidgetMessaging, A11yHelper) are OPTIONAL for hosts. Widgets SHOULD gracefully degrade if:
- `Theme` dependency is undefined → Use fallback CSS
- `WidgetMessaging` is undefined → Disable inter-widget communication
- `A11yHelper` is undefined → Implement basic accessibility manually

**MCP-WP-4.3.2:** If optional features are not provided, widgets MUST still function with core capabilities (EventBus, MCPBridge, Configuration).

---
