## 9. Error Handling Requirements (Normative)

**MCP-WP-9.1.1:** Widgets MUST handle MCP JSON-RPC errors gracefully.

**MCP-WP-9.1.2:** When a tool call fails, widgets SHOULD display:

- Error code (if JSON-RPC error)
- Error message
- Failed arguments (for debugging)

**MCP-WP-9.1.3:** Widgets MUST NOT crash when MCP server returns unexpected response formats.

**MCP-WP-9.1.4:** Widgets listening for `mcp:*:error` events SHOULD update their UI to reflect the error state.

**MCP-WP-9.1.5:** Widgets SHOULD map JSON-RPC error codes to actionable guidance for users using the lookup in Section 6.2. Examples include prompting the user to adjust invalid parameters (`-32602`) or retrying transient server errors (`-32000` through `-32099`) after a short backoff.

**MCP-WP-9.1.6:** When retries are appropriate, widgets MUST cap attempts and surface the final error with troubleshooting information rather than looping indefinitely.

**MCP-WP-9.1.7:** Widgets SHOULD log structured error details (including `jsonrpcCode` and any `error.data`) through the Telemetry or logging facilities so hosts can monitor stability without exposing sensitive payloads to end users.

---
