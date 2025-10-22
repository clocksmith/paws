## 17. Agent Collaboration Protocol (Normative)

**MCP-WP-17.1.1:** Hosts that enable automated control **MUST** mediate all agent requests through the `AgentAPI` surface described in Section 3.5.

**MCP-WP-17.1.2:** Hosts **MUST** authenticate and authorize the agent prior to delegating to `executeAction` and **MUST** log every invocation for auditability.

**MCP-WP-17.1.3:** Widgets implementing `AgentAPI` **MUST** return deterministic JSON Schema documents so hosts can validate and sanitize agent payloads before execution.

**MCP-WP-17.1.4:** Agent-triggered invocations **MUST** emit the same EventBus events as human-triggered invocations, with an additional metadata hint `{ source: 'agent' }`.

**MCP-WP-17.1.5:** Widgets **SHOULD** default agent access to read-only or idempotent actions and require explicit host permissions for destructive operations.

**MCP-WP-17.1.6:** When an agent requires language model assistance, widgets MAY delegate to `MCPBridge.createMessage()` (Section 6.2) using the same human-in-the-loop approval applied to direct user requests. Agent-authored prompts MUST be validated against the `SamplingRequest` schema before execution.

**MCP-WP-17.1.7:** Hosts **SHOULD** log the resolved `SamplingResult` (including the selected model and `stopReason`) alongside the originating agent action so auditors can trace automated decisions.
