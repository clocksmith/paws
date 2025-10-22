## 6. Host-Provided Dependencies (Normative)

Hosts MUST supply the core dependencies described in Sections 6.1–6.3. Sections 6.4–6.7 define optional extensions that MAY be provided when the host supports the associated capabilities. Widgets MUST detect the presence of optional services at runtime and degrade gracefully when they are absent.

### 6.1 EventBus Interface

**MCP-WP-6.1.1:** Same as generic spec (Section 6.1 from MWP).

### 6.2 MCPBridge Interface (NEW)

**MCP-WP-6.2.1:** The host MUST provide an MCPBridge instance conforming to:

Widgets rely on the bridge to access every MCP primitive advertised in `MCPServerInfo.capabilities`. When a server exposes the `sampling` capability declared in Section 3, the bridge MUST surface the sampling helpers defined below.

```typescript
interface MCPBridgeInterface {
  // Server connection management
  getServer(serverName: string): MCPServerConnection | undefined;
  listServers(): string[];
  isConnected(serverName: string): boolean;

  // MCP JSON-RPC operations
  callTool(serverName: string, toolName: string, args: object): Promise<ToolResult>;
  readResource(serverName: string, uri: string): Promise<ResourceContents>;
  getPrompt(serverName: string, promptName: string, args: object): Promise<PromptMessages>;
  createMessage(serverName: string, request: SamplingRequest): Promise<SamplingResult>;

  // Discovery (refresh operations)
  listTools(serverName: string): Promise<MCPTool[]>;
  listResources(serverName: string): Promise<MCPResource[]>;
  listPrompts(serverName: string): Promise<MCPPrompt[]>;

  // Subscriptions (if server supports)
  subscribeToResource(serverName: string, uri: string, callback: Function): UnsubscribeFunction;
}

interface ToolResult {
  content: Array<{
    type: 'text' | 'image' | 'audio' | 'resource';
    text?: string;
    data?: string;                 // base64 for images or audio payloads
    uri?: string;                  // for resource references
    mimeType?: string;
  }>;
  isError?: boolean;
}

interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string;                   // base64
}

interface PromptMessages {
  messages: Array<{
    role: 'user' | 'assistant';
    content: { type: 'text' | 'image' | 'audio' | 'resource'; text?: string; data?: string; mimeType?: string; uri?: string };
  }>;
}

interface SamplingRequest {
  messages: SamplingMessage[];
  modelPreferences?: ModelPreferences;
  systemPrompt?: string;
  includeContext?: 'none' | 'thisServer' | 'allServers';
  temperature?: number;
  maxTokens: number;
  stopSequences?: string[];
  metadata?: object;
}

interface SamplingResult {
  role: 'assistant';
  content: SamplingContent;
  model: string;
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens' | string;
}

interface SamplingMessage {
  role: 'user' | 'assistant';
  content: SamplingContent;
}

interface SamplingContent {
  type: 'text' | 'image' | 'audio';
  text?: string;
  data?: string; // base64 for binary payloads
  mimeType?: string;
}

interface ModelPreferences {
  hints?: ModelHint[];
  costPriority?: number;
  speedPriority?: number;
  intelligencePriority?: number;
}

interface ModelHint {
  name?: string;
}

interface MCPError extends Error {
  jsonrpcCode: number;
  data?: unknown;
}
```

**MCP-WP-6.2.2:** `callTool()` MUST send a `tools/call` JSON-RPC request to the specified MCP server.

**MCP-WP-6.2.3:** `readResource()` MUST send a `resources/read` JSON-RPC request.

**MCP-WP-6.2.4:** `getPrompt()` MUST send a `prompts/get` JSON-RPC request.

**MCP-WP-6.2.5:** All MCP operations MUST handle JSON-RPC errors and translate them to JavaScript exceptions.

**MCP-WP-6.2.6:** MCPBridge MUST emit events on the EventBus for all MCP operations (see Section 8.2).

**MCP-WP-6.2.7:** `createMessage()` MUST send a `sampling/createMessage` JSON-RPC request as defined in the MCP specification and resolve with the content that the user (or host policy) approves.

**MCP-WP-6.2.8:** Hosts **SHOULD** reuse human-in-the-loop workflows for agent or widget initiated sampling actions (see Section 17) before forwarding responses to servers.

**MCP-WP-6.2.9:** The `SamplingRequest` and `SamplingResult` interfaces mirror the MCP 2025-06-18 schema. Widgets MUST treat unknown fields as opaque and pass them through unchanged so hosts can adopt future MCP extensions.

| JSON-RPC Code | Name              | Recommended Host Behaviour                                  |
| ------------- | ----------------- | ------------------------------------------------------------ |
| -32700        | Parse error       | Surface error to user; retry only after correcting payload  |
| -32600        | Invalid request   | Log as widget/host defect; block repeat submissions         |
| -32601        | Method not found  | Trigger capability refresh and notify user                  |
| -32602        | Invalid params    | Highlight invalid inputs and prompt the user for correction |
| -32603        | Internal error    | Allow manual retry or escalate to server operator           |
| -32000..-32099| Server error      | Inspect `error.data` and apply backoff before retrying      |

**MCP-WP-6.2.10:** Hosts MAY wrap raw JSON-RPC errors in an `MCPError` so widgets can display consistent messaging while preserving the original `jsonrpcCode` and any attached data.

<Note>
Batch JSON-RPC operations remain out of scope for MCP-WP v1.0. Hosts SHOULD dispatch one request at a time so consent, auditing, and UI state stay predictable.
</Note>

### 6.3 Configuration Interface

**MCP-WP-6.3.1:** Same as generic spec, with MCP-specific keys:

**MCP-WP-6.3.2:** Standard configuration keys:

| Key                  | Type    | Description                            |
| -------------------- | ------- | -------------------------------------- |
| mcp.servers          | object  | MCP server definitions (name → config) |
| mcp.defaultTransport | string  | Default transport ('stdio' or 'http')  |
| mcp.pollingInterval  | number  | Status polling interval (ms)           |
| mcp.confirmToolCalls | boolean | Require confirmation before tool calls |

### 6.4 Theme Interface (Optional)

**MCP-WP-6.4.1:** Hosts implementing theming **SHOULD** provide a `Theme` dependency with the following interface:

```typescript
interface Theme {
  // Current theme mode
  mode: 'light' | 'dark' | 'auto';

  // Color scheme intensity
  colorScheme?: 'vibrant' | 'muted' | 'accessible';

  // Base theme colors
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    error: string;
    warning: string;
    info: string;
    success: string;
    text: string;
    textSecondary: string;
    border: string;
    [key: string]: string;
  };

  // Extended color palettes (optional)
  accentColors?: {
    accent1: string;
    accent2: string;
    accent3: string;
    accent4: string;
    accent5: string;
    [key: string]: string;
  };

  dataColors?: {
    data1: string;
    data2: string;
    data3: string;
    data4: string;
    data5: string;
    data6: string;
    data7: string;
    data8: string;
    data9: string;
    data10: string;
    [key: string]: string;
  };

  semanticColors?: {
    successLight: string;
    successMedium: string;
    successDark: string;
    warningLight: string;
    warningMedium: string;
    warningDark: string;
    errorLight: string;
    errorMedium: string;
    errorDark: string;
    infoLight: string;
    infoMedium: string;
    infoDark: string;
    [key: string]: string;
  };

  // Spacing and typography
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
    [key: string]: string;
  };

  typography: {
    fontFamily: string;
    fontSize: string;
    lineHeight: string;
    [key: string]: string;
  };

  // Core methods
  getCSSVar(property: string): string;

  // Optional helper methods
  getColorScheme?(): 'vibrant' | 'muted' | 'accessible';
  getContrastRatio?(color1: string, color2: string): number;
  adaptColor?(color: string, options?: ColorAdaptationOptions): string;
  generateColorScale?(baseColor: string, steps?: number): string[];
  onChange?(callback: (theme: Theme) => void): UnsubscribeFunction;
}

interface ColorAdaptationOptions {
  respectMode?: boolean;        // Adjust for light/dark mode
  preserveHue?: boolean;         // Keep original hue
  targetContrast?: number;       // Target WCAG contrast ratio
  intensity?: number;            // Brightness adjustment (-1 to 1)
}
```

**MCP-WP-6.4.2:** Hosts providing `Theme` **MUST**:
- Inject all 18 base CSS custom properties (as defined in Section 5.5.3) into widget shadow roots
- Provide at least `light` and `dark` theme modes
- Update theme tokens dynamically when user changes theme preferences
- Persist theme preference across sessions

**MCP-WP-6.4.3:** Hosts providing `Theme` **SHOULD**:
- Provide extended color palettes (`accentColors`, `dataColors`, `semanticColors`)
- Implement optional helper methods (`getContrastRatio`, `adaptColor`, `generateColorScale`)
- Support scoped theming configuration for widgets with custom branding requirements
- Respect system-level theme preferences (e.g., `prefers-color-scheme`)

**MCP-WP-6.4.4:** Widgets using `Theme` **MUST**:
- Detect the presence of the `Theme` dependency at runtime
- Gracefully degrade to fallback styling if `Theme` is undefined
- Use CSS custom properties for all themeable elements
- Subscribe to theme changes via `onChange` if real-time updates are needed

**MCP-WP-6.4.5:** Extended theming for complex widgets:

Widgets with extensive custom styling (e.g., data visualizations, branded components) **MAY** use:

1. **Extended color tokens** for multi-color visualizations:
   ```css
   .chart-bar:nth-child(1) { background: var(--mcp-data-1); }
   .chart-bar:nth-child(2) { background: var(--mcp-data-2); }
   ```

2. **Semantic gradients** for state indicators:
   ```css
   .status-success {
     background: var(--mcp-success-light);
     border-left: 3px solid var(--mcp-success-dark);
   }
   ```

3. **Color adaptation helpers** for custom brand colors:
   ```javascript
   const adaptedBrand = Theme.adaptColor?.('#ff6b35', {
     respectMode: true,
     targetContrast: 4.5
   });
   ```

4. **Scoped theming** to separate chrome from content styling:
   ```css
   /* Widget chrome uses host theme */
   .widget-header {
     background: var(--mcp-surface);
     color: var(--mcp-text-primary);
   }

   /* Content preserves brand colors */
   .custom-logo {
     color: #ff6b35; /* Brand color */
   }
   ```

**MCP-WP-6.4.6:** Accessibility requirements for theming:

Hosts implementing `Theme` with `getContrastRatio` **SHOULD**:
- Ensure all theme color combinations meet WCAG 2.1 Level AA (4.5:1 for normal text, 3:1 for large text)
- Provide `accessible` color scheme option with enhanced contrast ratios (7:1 for AAA compliance)
- Support high-contrast mode detection via `mode: 'high-contrast'`

**MCP-WP-6.4.7:** Theme configuration example:

```typescript
// Dashboard configuration with extended theming
const themeConfig = {
  mode: 'dark',
  colorScheme: 'vibrant',
  accentColors: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
  dataColors: ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
               '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#06b6d4'],
  semanticGradients: {
    success: ['#d1fae5', '#10b981', '#065f46'],
    warning: ['#fef3c7', '#f59e0b', '#92400e'],
    error: ['#fee2e2', '#ef4444', '#991b1b'],
    info: ['#dbeafe', '#3b82f6', '#1e40af']
  },
  scopedTheming: {
    enabled: true,
    defaultScope: 'host'
  }
};
```

### 6.5 Inter-Widget Communication Bus

**MCP-WP-6.5.1:** Hosts MAY extend the EventBus to support widget-to-widget communication.

**MCP-WP-6.5.2:** Widget communication uses dedicated event channels: `mcp:widget:<targetWidget>:message`

**MCP-WP-6.5.3:** Inter-widget communication interface:

```typescript
interface WidgetMessaging {
  // Send message to specific widget
  sendToWidget(targetWidget: string, message: WidgetMessage): void;

  // Subscribe to messages from specific widget
  subscribeToWidget(sourceWidget: string, handler: MessageHandler): UnsubscribeFunction;

  // Broadcast to all widgets (use sparingly)
  broadcastToWidgets(message: WidgetMessage): void;
}

interface WidgetMessage {
  type: string;                // Message type (e.g., "data-updated", "action-requested")
  payload: any;                // Message-specific data
  source: string;              // Sending widget's element name
  timestamp: number;
}

type MessageHandler = (message: WidgetMessage) => void;
```

**MCP-WP-6.5.4:** Hosts implementing widget messaging MUST:
- Validate message schema before delivery
- Enforce rate limits (default: 10 messages/second per widget)
- Provide sender verification (prevent spoofing)
- Log all inter-widget messages for debugging

**MCP-WP-6.5.5:** Example composite workflow:

```javascript
// GitHub widget emits PR created event
EventBus.emit('mcp:widget:slack-widget:message', {
  type: 'notify',
  payload: {
    message: `PR #123 created: ${prTitle}`,
    channel: '#dev'
  },
  source: 'mcp-github-widget',
  timestamp: Date.now()
});

// Slack widget listens and sends notification
EventBus.on('mcp:widget:slack-widget:message', (event) => {
  if (event.data.type === 'notify') {
    // Trigger Slack notification via MCP tool
  }
});
```

**MCP-WP-6.5.6:** Security considerations:
- Widgets MUST declare `widgetCommunication` permission to send messages
- Recipients MAY implement allowlists for trusted senders
- Hosts SHOULD sanitize all message payloads to prevent XSS

**MCP-WP-6.5.7:** Message schema validation:

```typescript
interface WidgetCommunicationPermission {
  canSend: boolean;
  canReceive: boolean;
  allowedTargets?: string[];   // Specific widgets this widget can message
  allowedSources?: string[];   // Specific widgets this widget accepts messages from
}
```

### 6.6 Offline Capability Contract

**MCP-WP-6.6.1:** Hosts that advertise offline support **MUST** provide an `OfflineCache` dependency.

**MCP-WP-6.6.2:** Widgets **MAY** inspect the dependency list to detect offline availability and **MUST** degrade gracefully if it is absent.

```typescript
interface OfflineCache {
  storeToolResult(key: string, result: ToolResult, ttl: number): Promise<void>;
  queueOperation(operation: QueuedOperation): Promise<void>;
  flushQueue(): Promise<void>;
  isOnline(): boolean;
}

interface QueuedOperation {
  id: string;
  timestamp: number;
  request: {
    type: 'tool' | 'resource' | 'prompt';
    serverName: string;
    payload: object;
  };
}
```

**MCP-WP-6.6.3:** Hosts providing `OfflineCache` **MUST** ensure queued operations are executed in order once connectivity returns and **MUST** present conflicts to the user if execution fails.

### 6.7 Telemetry Interface

**MCP-WP-6.7.1:** Hosts collecting usage analytics **MUST** expose a `Telemetry` dependency and obtain user consent before forwarding any events.

```typescript
interface Telemetry {
  trackEvent(category: string, action: string, label?: string, value?: number): void;
  trackError(error: Error, context?: Record<string, unknown>): void;
  trackPerformance(metric: string, duration: number): void;
}
```

**MCP-WP-6.7.2:** Widgets **MUST NOT** send personally identifiable information through `Telemetry` unless explicitly required permissions are granted.

**MCP-WP-6.7.3:** Hosts **SHOULD** provide no-op implementations when telemetry collection is disabled.

### 6.8 Internationalization Interface

**MCP-WP-6.8.1:** Hosts targeting multiple locales **SHOULD** provide an `I18n` dependency.

```typescript
interface I18n {
  currentLocale: string; // e.g., 'en-US'
  t(key: string, variables?: Record<string, unknown>): string;
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
}
```

**MCP-WP-6.8.2:** Widgets using `I18n` **MUST** fall back to built-in strings when the dependency is not present.

**MCP-WP-6.8.3:** Hosts **MUST** keep locale data and user preference storage in sync so widgets receive timely updates via configuration change notifications.

---
