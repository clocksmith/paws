## 10. Host Integration Requirements (Normative)

### 10.1 MCP Server Discovery

**MWP-10.1.1:** The host MUST load MCP server configurations from `Configuration.get('mcp.servers')`.

**MWP-10.1.2:** For each server, the host MUST:

1. Spawn the server process (stdio) or connect to HTTP endpoint
2. Send `initialize` JSON-RPC request
3. Receive server capabilities
4. Call `tools/list`, `resources/list`, `prompts/list`
5. Create MCPServerInfo object
6. Invoke widget factory with dependencies and server info

**MWP-10.1.3:** The host SHOULD support hot-reload when `mcp.servers` configuration changes.

### 10.2 Widget Lifecycle

**MWP-10.2.1:** Widget creation sequence:

1. Connect to MCP server
2. Discover tools/resources/prompts
3. Create widget via factory
4. Call `api.initialize()` if present
5. Render widget to DOM

**MWP-10.2.2:** Widget destruction sequence:

1. Call `api.destroy()` if present
2. Remove widget from DOM (triggers `disconnectedCallback`)
3. Optionally disconnect MCP server if no other widgets use it

### 10.3 Resilience, Telemetry, and Localization Hooks

**MWP-10.3.1:** When an `OfflineCache` is provided, the host **MUST** keep its connectivity status in sync with the widget by emitting `mcp:host:connectivity` notifications.

**MWP-10.3.2:** Hosts **MUST** flush queued operations automatically after reconnect and **MUST** surface failures through `mcp:host:offline-error` events so widgets can update their UI.

**MWP-10.3.3:** If telemetry is enabled, the host **MUST** enrich events with anonymized session identifiers and enforce any user consent toggles before forwarding them outside the runtime.

**MWP-10.3.4:** Hosts **SHOULD** propagate locale changes by emitting `mcp:host:locale-changed` with the new locale identifier; widgets SHOULD update rendered strings when received.

---
