# MCP Lens Protocol Specification

**Version:** 1.0.0
**Status:** Draft
**Last Updated:** October 2025

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture](#2-architecture)
3. [Widget Factory Contract](#3-widget-factory-contract)
4. [Web Component Contract](#4-web-component-contract)
5. [Dependencies](#5-dependencies)
6. [Event System](#6-event-system)
7. [Security Requirements](#7-security-requirements)
8. [Performance Budgets](#8-performance-budgets)
9. [Protocol Versioning](#9-protocol-versioning)

---

## 1. Overview

### 1.1 Purpose

MCP Lens standardizes how to build protocol-semantic analytics dashboards for Model Context Protocol servers. It provides:

- Real-time monitoring of MCP tool invocations
- User confirmation workflows for dangerous operations
- Audit trails and operational visibility
- Reusable widget ecosystem

### 1.2 Design Principles

**MCPL-1.2.1:** The protocol MUST be client-side only. MCP servers are not aware of MCP Lens and require no modifications.

**MCPL-1.2.2:** Security is mandatory. All tool invocations MUST trigger user confirmation before execution.

**MCPL-1.2.3:** Widgets MUST be Web Components for isolation and reusability.

**MCPL-1.2.4:** The protocol MUST support multiple MCP servers in a single dashboard.

### 1.3 Relationship to MCP Protocol

**MCPL-1.3.1:** MCP Lens does NOT modify or extend the MCP protocol specification.

**MCPL-1.3.2:** MCP Lens widgets communicate with MCP servers using standard MCP JSON-RPC protocol.

**MCPL-1.3.3:** MCP servers MUST NOT require any MCP Lens-specific implementation.

---

## 2. Architecture

### 2.1 Components

**MCPL-2.1.1:** A MCP Lens system consists of three components:

1. **Host Application** - Dashboard that loads and manages widgets
2. **MCP Lens Widgets** - Web Components that visualize MCP operations
3. **MCP Servers** - Standard MCP servers (unchanged)

**MCPL-2.1.2:** The Host Application MUST provide:
- EventBus for pub/sub communication
- MCPBridge for MCP operations
- Configuration for widget settings

**MCPL-2.1.3:** Widgets MUST NOT communicate directly with MCP servers. All communication goes through MCPBridge.

### 2.2 Data Flow

```
User Action → Widget → MCPBridge → EventBus → Host Confirmation → MCP Server
                                       ↓
                                   Audit Log
```

**MCPL-2.2.1:** Tool invocations MUST emit events before execution for confirmation.

**MCPL-2.2.2:** All MCP operations (successful or failed) MUST emit events for observability.

---

## 3. Widget Factory Contract

### 3.1 Factory Function Signature

**MCPL-3.1.1:** Every widget package MUST export a default factory function:

```typescript
export default function createWidget(
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory | Promise<WidgetFactory>
```

**MCPL-3.1.2:** The factory function MUST be synchronous or return a Promise.

**MCPL-3.1.3:** The factory function MUST NOT throw errors. Instead, it should return a widget in error state.

### 3.2 Return Value

**MCPL-3.2.1:** The factory MUST return a WidgetFactory object:

```typescript
interface WidgetFactory {
  api: {
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    refresh(): Promise<void>;
  };
  widget: {
    protocolVersion: string;
    element: string;
    displayName: string;
    description?: string;
    capabilities: {
      tools: boolean;
      resources: boolean;
      prompts: boolean;
    };
  };
}
```

**MCPL-3.2.2:** The `protocolVersion` MUST follow semantic versioning (e.g., "1.0.0").

**MCPL-3.2.3:** The `element` MUST be a valid custom element name (contains hyphen, lowercase).

**MCPL-3.2.4:** The factory MUST register the custom element with `customElements.define()`.

### 3.3 Lifecycle Methods

**MCPL-3.3.1:** `initialize()` MUST be called once after widget creation.

**MCPL-3.3.2:** `destroy()` MUST cleanup all resources (event listeners, timers, subscriptions).

**MCPL-3.3.3:** `refresh()` MUST reload widget data without full re-initialization.

**MCPL-3.3.4:** All lifecycle methods MUST be idempotent (safe to call multiple times).

---

## 4. Web Component Contract

### 4.1 Custom Element Requirements

**MCPL-4.1.1:** Widgets MUST extend HTMLElement.

**MCPL-4.1.2:** Widgets MUST use Shadow DOM (`attachShadow({ mode: 'open' })`).

**MCPL-4.1.3:** Widgets MUST implement `connectedCallback()` for rendering.

**MCPL-4.1.4:** Widgets MUST implement `disconnectedCallback()` for cleanup.

### 4.2 Isolation

**MCPL-4.2.1:** Widgets MUST NOT access parent document DOM.

**MCPL-4.2.2:** Widgets MUST NOT modify global state (window, document).

**MCPL-4.2.3:** Widgets MUST style themselves using Shadow DOM styles only.

**MCPL-4.2.4:** Widgets MAY expose CSS custom properties for theming.

### 4.3 Communication

**MCPL-4.3.1:** Widgets MUST communicate via EventBus, NOT DOM events.

**MCPL-4.3.2:** Widgets MUST NOT directly call other widgets.

**MCPL-4.3.3:** Cross-widget communication MUST use well-defined events.

---

## 5. Dependencies

### 5.1 Required Dependencies

**MCPL-5.1.1:** The Host MUST inject three required dependencies:

```typescript
interface Dependencies {
  EventBus: EventBus;
  MCPBridge: MCPBridge;
  Configuration: Configuration;
}
```

**MCPL-5.1.2:** Widgets MUST NOT assume specific implementations of these interfaces.

**MCPL-5.1.3:** Widgets MUST gracefully handle missing optional dependencies.

### 5.2 EventBus Interface

**MCPL-5.2.1:** EventBus MUST provide:

```typescript
interface EventBus {
  emit(event: string, data: unknown): void;
  on(event: string, handler: EventHandler): UnsubscribeFunction;
  off(event: string, handler: EventHandler): void;
}
```

**MCPL-5.2.2:** Event handlers MUST be called asynchronously.

**MCPL-5.2.3:** Event handlers MUST NOT throw errors.

### 5.3 MCPBridge Interface

**MCPL-5.3.1:** MCPBridge MUST provide:

```typescript
interface MCPBridge {
  callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult>;
  readResource(serverName: string, uri: string): Promise<ResourceContent>;
  getPrompt(serverName: string, promptName: string, args: Record<string, string>): Promise<PromptMessages>;
  listTools(serverName: string): Promise<Tool[]>;
  listResources(serverName: string): Promise<Resource[]>;
  listPrompts(serverName: string): Promise<Prompt[]>;
}
```

**MCPL-5.3.2:** All MCPBridge methods MUST return Promises.

**MCPL-5.3.3:** Failed operations MUST reject with descriptive errors.

### 5.4 Configuration Interface

**MCPL-5.4.1:** Configuration MUST provide:

```typescript
interface Configuration {
  get<T>(key: string, defaultValue?: T): T | undefined;
  set<T>(key: string, value: T): void;
  has(key: string): boolean;
  getAll(prefix?: string): Record<string, unknown>;
}
```

**MCPL-5.4.2:** Configuration keys MUST use dot notation (e.g., `widget.github.token`).

**MCPL-5.4.3:** Widgets MUST NOT store sensitive data in configuration without encryption.

---

## 6. Event System

### 6.1 Event Naming Convention

**MCPL-6.1.1:** Events MUST follow the pattern: `mcp:<category>:<action>`

**MCPL-6.1.2:** Standard event categories:
- `mcp:tool:*` - Tool invocation events
- `mcp:resource:*` - Resource read events
- `mcp:prompt:*` - Prompt events
- `mcp:server:*` - Server connection events
- `mcp:widget:*` - Widget lifecycle events

### 6.2 Tool Events

**MCPL-6.2.1:** Before tool execution, MCPBridge MUST emit:

```typescript
EventBus.emit('mcp:tool:invoke-requested', {
  serverName: string,
  toolName: string,
  arguments: Record<string, unknown>
});
```

**MCPL-6.2.2:** After successful execution, MCPBridge MUST emit:

```typescript
EventBus.emit('mcp:tool:invoked', {
  serverName: string,
  toolName: string,
  result: ToolResult
});
```

**MCPL-6.2.3:** After failed execution, MCPBridge MUST emit:

```typescript
EventBus.emit('mcp:tool:error', {
  serverName: string,
  toolName: string,
  error: { code: string, message: string }
});
```

### 6.3 Resource Events

**MCPL-6.3.1:** Resource reads MUST emit:

```typescript
EventBus.emit('mcp:resource:read', {
  serverName: string,
  uri: string,
  content: ResourceContent
});
```

**MCPL-6.3.2:** Resource subscriptions MUST emit:

```typescript
EventBus.emit('mcp:resource:updated', {
  serverName: string,
  uri: string,
  content: ResourceContent
});
```

### 6.4 Widget Events

**MCPL-6.4.1:** Widget initialization MUST emit:

```typescript
EventBus.emit('mcp:widget:initialized', {
  element: string,
  displayName: string
});
```

**MCPL-6.4.2:** Widget errors MUST emit:

```typescript
EventBus.emit('mcp:widget:error', {
  element: string,
  error: { code: string, message: string }
});
```

---

## 7. Security Requirements

### 7.1 User Confirmation

**MCPL-7.1.1:** All tool invocations MUST trigger user confirmation before execution.

**MCPL-7.1.2:** The Host MUST intercept `mcp:tool:invoke-requested` events.

**MCPL-7.1.3:** The confirmation dialog MUST show:
- Server name
- Tool name
- Tool arguments (sanitized)
- Approval and cancellation options

**MCPL-7.1.4:** On user rejection, MCPBridge MUST reject the Promise with code `USER_REJECTED`.

### 7.2 Read Operations

**MCPL-7.2.1:** The following operations do NOT require confirmation:
- `listTools()`
- `listResources()`
- `readResource()`
- `listPrompts()`
- `getPrompt()`

**MCPL-7.2.2:** Tool invocations ALWAYS require confirmation, even if read-only.

### 7.3 Content Security

**MCPL-7.3.1:** Widgets MUST NOT use `eval()` or `Function()` constructors.

**MCPL-7.3.2:** Widgets MUST sanitize user input before rendering.

**MCPL-7.3.3:** Widgets MUST use `textContent` instead of `innerHTML` for untrusted content.

**MCPL-7.3.4:** Widgets MUST NOT make arbitrary network requests outside MCPBridge.

### 7.4 Permission System

**MCPL-7.4.1:** Widgets MAY declare required permissions:

```typescript
permissions: {
  tools: string[];           // Tool name patterns (e.g., ['create_*', 'delete_*'])
  resources: string[];       // Resource URI patterns
  network: string[];         // Allowed domains (for external resources)
  storage: boolean;          // Local storage access
}
```

**MCPL-7.4.2:** Hosts MUST enforce declared permissions.

**MCPL-7.4.3:** Widgets MUST gracefully handle permission denials.

---

## 8. Performance Budgets

### 8.1 Bundle Size

**MCPL-8.1.1:** Widget bundles MUST be less than 500KB gzipped.

**MCPL-8.1.2:** Widgets SHOULD lazy-load large dependencies.

**MCPL-8.1.3:** Widgets MUST NOT bundle common dependencies (e.g., React, Vue).

### 8.2 Render Performance

**MCPL-8.2.1:** Initial render MUST complete in less than 500ms.

**MCPL-8.2.2:** Re-renders MUST complete in less than 100ms.

**MCPL-8.2.3:** Widgets SHOULD use virtualization for long lists (>100 items).

### 8.3 Memory

**MCPL-8.3.1:** Widgets MUST NOT leak memory.

**MCPL-8.3.2:** Widgets MUST cleanup event listeners in `destroy()`.

**MCPL-8.3.3:** Widgets SHOULD limit DOM node count to <1000.

### 8.4 Resource Usage Reporting

**MCPL-8.4.1:** Widgets MAY implement `getResourceUsage()`:

```typescript
getResourceUsage(): {
  memory: number;       // bytes
  renderTime: number;   // milliseconds
  bundleSize?: number;  // bytes
  domNodes?: number;    // count
}
```

**MCPL-8.4.2:** Hosts MAY use this for performance monitoring.

---

## 9. Protocol Versioning

### 9.1 Semantic Versioning

**MCPL-9.1.1:** The protocol MUST follow semantic versioning:
- **Major** (1.x.x) - Breaking changes to contracts
- **Minor** (x.1.x) - Backward-compatible additions
- **Patch** (x.x.1) - Clarifications and fixes

**MCPL-9.1.2:** Widgets MUST declare their protocol version in metadata.

**MCPL-9.1.3:** Hosts MUST check version compatibility before loading widgets.

### 9.2 Compatibility

**MCPL-9.2.1:** Hosts MUST support widgets with:
- Same major version
- Lower or equal minor version

**MCPL-9.2.2:** Hosts SHOULD log warnings for mismatched versions.

**MCPL-9.2.3:** Widgets SHOULD gracefully degrade for missing features.

### 9.3 Deprecation Policy

**MCPL-9.3.1:** Deprecated features MUST be marked in specification.

**MCPL-9.3.2:** Deprecated features MUST be supported for at least one major version.

**MCPL-9.3.3:** Hosts SHOULD log warnings when deprecated features are used.

---

## Appendix A: Complete Example

See [examples/](./examples/) for complete widget implementations including:

- **GitHub Widget** - Issue/PR management with approval flows
- **Slack Widget** - Message sending with real-time subscriptions
- **Filesystem Widget** - File browser with operation approvals
- **Supabase Widget** - Database operations with schema introspection

---

## Appendix B: TypeScript Schemas

See [schema.ts](./schema.ts) for complete TypeScript type definitions including:

- Widget factory types
- Dependencies interfaces
- Event payload types
- MCP protocol types
- Configuration schemas

---

## Appendix C: Comparison to Similar Protocols

### vs Grafana Dashboard API

**Similarities:**
- Declarative dashboard configuration
- Plugin/widget architecture
- Multiple data source support
- Real-time monitoring focus

**Differences:**
- MCP Lens is MCP-specific, Grafana is infrastructure-generic
- MCP Lens includes approval workflows, Grafana does not
- MCP Lens uses Web Components, Grafana uses React
- MCP Lens is client-side only, Grafana has backend components

### vs mcp-ui

**Similarities:**
- Both extend MCP ecosystem
- Both provide UI for MCP operations
- Both use standard MCP protocol

**Differences:**
- mcp-ui: UI **in** MCP responses (server-provided)
- MCP Lens: UI **about** MCP servers (external dashboards)
- mcp-ui: No approval workflows
- MCP Lens: Approval workflows required

---

## Appendix D: Normative References

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/)
- [Web Components Specification](https://www.w3.org/TR/components-intro/)
- [JSON-RPC 2.0 Specification](https://www.jsonrpc.org/specification)
- [Semantic Versioning 2.0.0](https://semver.org/)

---

**End of Specification**
