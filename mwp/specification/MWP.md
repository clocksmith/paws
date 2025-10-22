# MCP Widget Protocol (MCP-WP)

**Specification Version 1.0.0**

---

## Document Metadata

| Field   | Value                                  |
| ------- | -------------------------------------- |
| Status  | Final                                  |
| Date    | 2025-10-20                             |
| Version | 1.0.0                                  |
| Editors | [Your Organization]                    |
| License | MIT                                    |
| Target  | Anthropic Model Context Protocol (MCP) |

---

## Abstract

This specification defines the MCP Widget Protocol (MCP-WP), a contract-based system for creating visual dashboard widgets that represent Model Context Protocol servers. MCP-WP establishes strict interfaces for widget lifecycle, MCP server communication, and visual rendering of MCP primitives (tools, resources, prompts). Widgets are implemented as Web Components with Shadow DOM encapsulation and integrate with host-provided services via dependency injection.

---

## Status of This Document

This is a **Final Specification**. Implementations conforming to this specification MUST adhere to all normative requirements identified by RFC 2119 keywords.

---

## Conformance Requirements

The key words "MUST", "MUST NOT", "REQUIRED", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", "RECOMMENDED", "MAY", and "OPTIONAL" in this document are to be interpreted as described in [RFC 2119](https://www.ietf.org/rfc/rfc2119.txt).

A conforming MCP widget MUST implement all requirements marked as REQUIRED or MUST in Sections 3-5.

A conforming host MUST implement all requirements marked as REQUIRED or MUST in Sections 6, 9, and 10.

---

## Table of Contents

1. [Terminology](#1-terminology)
2. [Architecture Overview](#2-architecture-overview)
3. [Widget Factory Contract (Normative)](#3-widget-factory-contract-normative)
4. [Widget Metadata Schema (Normative)](#4-widget-metadata-schema-normative)
5. [Web Component Contract (Normative)](#5-web-component-contract-normative)
   - 5.5 [Theme Contract](#55-theme-contract)
6. [Host-Provided Dependencies (Normative)](#6-host-provided-dependencies-normative)
   - 6.4 [Inter-Widget Communication Bus](#64-inter-widget-communication-bus)
   - 6.5 [Offline Capability Contract](#65-offline-capability-contract)
   - 6.6 [Telemetry Interface](#66-telemetry-interface)
   - 6.7 [Internationalization Interface](#67-internationalization-interface)
7. [MCP Primitives Rendering (Normative)](#7-mcp-primitives-rendering-normative)
8. [Event Naming Convention (Normative)](#8-event-naming-convention-normative)
9. [Error Handling Requirements (Normative)](#9-error-handling-requirements-normative)
10. [Host Integration Requirements (Normative)](#10-host-integration-requirements-normative)
11. [Security Requirements (Normative)](#11-security-requirements-normative)
    - 11.5 [Accessibility Requirements](#115-accessibility-requirements-wcag-21-level-aa)
12. [Standard Widget Types (Informative)](#12-standard-widget-types-informative)
13. [Example Implementation (Informative)](#13-example-implementation-informative)
14. [Widget Registry Protocol (Normative)](#14-widget-registry-protocol-normative)
15. [mcp-ui Interoperability Contract (Normative)](#15-mcp-ui-interoperability-contract-normative)
16. [Conformance Test Suite & Quality Assurance (Normative)](#16-conformance-test-suite--quality-assurance-normative)
17. [Agent Collaboration Protocol (Normative)](#17-agent-collaboration-protocol-normative)
18. [Performance & Resource Budgets (Normative)](#18-performance--resource-budgets-normative)

---

## 1. Terminology

### 1.1 Definitions

**Model Context Protocol (MCP)**
An open protocol by Anthropic that standardizes how applications provide context to Large Language Models through servers exposing tools, resources, and prompts via JSON-RPC 2.0.

**MCP Server**
A process implementing the MCP specification that exposes tools, resources, and/or prompts. Examples: GitHub MCP server, Slack MCP server, Supabase MCP server.

**MCP Widget**
A Web Component that provides visual representation and interaction controls for a specific MCP server.

**MCP Tool**
A function exposed by an MCP server that can be invoked by AI agents. Defined by name, description, and JSON Schema for parameters.

**MCP Resource**
Read-only data exposed by an MCP server via URIs. Examples: file contents, API responses, database records.

**MCP Prompt**
Pre-defined prompt templates with arguments, exposed by MCP servers for reusable AI interactions.

**Widget Factory**
A JavaScript function that creates an MCP widget instance for a specific MCP server.

**Host Application**
The dashboard or UI application that loads, initializes, and renders MCP widgets.

**Transport**
The communication mechanism for MCP JSON-RPC messages. Either stdio (standard input/output) or http (HTTP POST).

---

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

## 5. Web Component Contract (Normative)

### 5.1 Component Registration

**MCP-WP-5.1.1:** The widget MUST register a custom element with tag name matching widget.element.

**MCP-WP-5.1.2:** The tag name MUST start with `mcp-` prefix to indicate MCP widget.

**MCP-WP-5.1.3:** Registration MUST be idempotent using `customElements.get()` check.

### 5.2 getStatus() Method

**MCP-WP-5.2.1:** The custom element MUST implement `getStatus()` returning:

```typescript
interface MCPWidgetStatus {
  state: 'active' | 'idle' | 'error' | 'loading' | 'disabled';
  primaryMetric: string;           // e.g., "12 tools available"
  secondaryMetric: string;         // e.g., "stdio transport"
  lastActivity: number | null;     // Last tool call timestamp
  message: string | null;          // Error details if state === 'error'
}
```

**MCP-WP-5.2.2:** State semantics for MCP widgets:

| State    | Meaning                                     | Visual        |
| -------- | ------------------------------------------- | ------------- |
| active   | Server connected, recent tool calls         | Green         |
| idle     | Server connected, no recent activity        | Gray          |
| error    | Server disconnected or JSON-RPC error       | Red           |
| loading  | Server initializing or performing handshake | Yellow        |
| disabled | Server disabled in configuration            | Gray (dotted) |

**MCP-WP-5.2.3:** primaryMetric SHOULD display the count of available primitives (e.g., "5 tools, 3 resources").

**MCP-WP-5.2.4:** secondaryMetric SHOULD display connection info (e.g., "stdio" or "http://localhost:3000").

**MCP-WP-5.2.5:** lastActivity SHOULD reflect the timestamp of the last tool call, resource read, or prompt invocation.

### 5.3 getMCPInfo() Method (NEW)

**MCP-WP-5.3.1:** The custom element SHOULD implement a public method `getMCPInfo()` returning:

```typescript
interface MCPInfo {
  serverName: string;
  availableTools: number;
  availableResources: number;
  availablePrompts: number;
  connectionState: 'connected' | 'disconnected' | 'error';
  lastError: string | null;
}
```

This allows the host to query MCP-specific details without parsing status strings.

### 5.4 Rendering Requirements

**MCP-WP-5.4.1:** Widgets MUST use safe rendering patterns (`textContent` or manual DOM construction).

**MCP-WP-5.4.2:** When rendering tool names, resource URIs, or prompt arguments received from MCP servers, widgets MUST treat them as untrusted data and apply XSS prevention (see Section 11.1).

**MCP-WP-5.4.3:** Widgets SHOULD provide visual distinction between different MCP primitive types (tools, resources, prompts).

### 5.5 Theme Contract

**MCP-WP-5.5.1:** Hosts SHOULD provide a `Theme` dependency for design system integration.

**MCP-WP-5.5.2:** Widgets SHOULD use CSS custom properties (design tokens) for styling:

```typescript
interface Theme {
  // CSS custom properties as design tokens
  tokens: Record<string, string>;

  // Apply tokens to widget element
  applyToElement(element: HTMLElement): void;

  // Listen for theme changes
  onThemeChange(callback: ThemeChangeCallback): UnsubscribeFunction;

  // Get current theme mode
  getMode(): 'light' | 'dark' | 'high-contrast' | 'custom';

  // Get current color scheme (optional)
  getColorScheme?(): 'vibrant' | 'muted' | 'accessible';

  // Calculate contrast ratio between colors (optional)
  getContrastRatio?(color1: string, color2: string): number;

  // Adapt custom color to theme mode (optional)
  adaptColor?(color: string, options?: ColorAdaptationOptions): string;

  // Generate color scale from base color (optional)
  generateColorScale?(baseColor: string, steps?: number): string[];
}

type ThemeChangeCallback = (newTokens: Record<string, string>, mode: string) => void;

interface ColorAdaptationOptions {
  respectMode?: boolean;        // Adjust for light/dark mode
  preserveHue?: boolean;         // Keep original hue
  targetContrast?: number;       // Target WCAG contrast ratio
  intensity?: number;            // Brightness adjustment (-1 to 1)
}
```

**MCP-WP-5.5.3:** Standard design tokens (18 base + 42 extended = 60 total):

#### Base Tokens (Required)

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-primary-color` | Primary brand color | `#0066cc`, `#ff6b35` |
| `--mcp-secondary-color` | Secondary brand color | `#6c757d` |
| `--mcp-background` | Widget background | `#ffffff`, `#1e1e1e` |
| `--mcp-surface` | Panel/card background | `#f8f9fa`, `#2d2d2d` |
| `--mcp-text-primary` | Main text color | `#212529`, `#e0e0e0` |
| `--mcp-text-secondary` | Secondary text color | `#6c757d`, `#9e9e9e` |
| `--mcp-border` | Border color | `#dee2e6`, `#404040` |
| `--mcp-spacing-sm` | Small spacing | `4px` |
| `--mcp-spacing-md` | Medium spacing | `8px` |
| `--mcp-spacing-lg` | Large spacing | `16px` |
| `--mcp-spacing-xl` | Extra large spacing | `24px` |
| `--mcp-font-family` | Typography | `system-ui, -apple-system` |
| `--mcp-font-size-sm` | Small text | `12px` |
| `--mcp-font-size-md` | Medium text | `14px` |
| `--mcp-font-size-lg` | Large text | `16px` |
| `--mcp-radius-sm` | Small border radius | `2px` |
| `--mcp-radius-md` | Medium border radius | `4px` |
| `--mcp-radius-lg` | Large border radius | `8px` |

#### Extended Tokens (Optional - for complex widgets)

**Accent Colors** (for multi-color visualizations):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-accent-1` | First accent color | `#6366f1` (Indigo) |
| `--mcp-accent-2` | Second accent color | `#8b5cf6` (Purple) |
| `--mcp-accent-3` | Third accent color | `#ec4899` (Pink) |
| `--mcp-accent-4` | Fourth accent color | `#f59e0b` (Amber) |
| `--mcp-accent-5` | Fifth accent color | `#10b981` (Emerald) |

**Data Visualization Colors** (for charts and graphs):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-data-1` through `--mcp-data-10` | Chart/graph colors | `#3b82f6`, `#ef4444`, etc. |

**Semantic Color Gradients** (light/medium/dark variants):

| Token | Purpose | Example Values |
|-------|---------|----------------|
| `--mcp-success-light` | Success state (light) | `#d1fae5` |
| `--mcp-success-medium` | Success state (medium) | `#10b981` |
| `--mcp-success-dark` | Success state (dark) | `#065f46` |
| `--mcp-warning-light` | Warning state (light) | `#fef3c7` |
| `--mcp-warning-medium` | Warning state (medium) | `#f59e0b` |
| `--mcp-warning-dark` | Warning state (dark) | `#92400e` |
| `--mcp-error-light` | Error state (light) | `#fee2e2` |
| `--mcp-error-medium` | Error state (medium) | `#ef4444` |
| `--mcp-error-dark` | Error state (dark) | `#991b1b` |
| `--mcp-info-light` | Info state (light) | `#dbeafe` |
| `--mcp-info-medium` | Info state (medium) | `#3b82f6` |
| `--mcp-info-dark` | Info state (dark) | `#1e40af` |

**MCP-WP-5.5.4:** Widgets SHOULD apply tokens in shadow DOM:

```css
:host {
  font-family: var(--mcp-font-family);
  color: var(--mcp-text-primary);
  background: var(--mcp-background);
}

.panel {
  background: var(--mcp-surface);
  border: 1px solid var(--mcp-border);
  border-radius: var(--mcp-radius-md);
  padding: var(--mcp-spacing-md);
}

button {
  background: var(--mcp-primary-color);
  color: white;
  padding: var(--mcp-spacing-sm) var(--mcp-spacing-md);
  border-radius: var(--mcp-radius-sm);
}

/* Using extended tokens for data visualization */
.chart-bar:nth-child(1) { background: var(--mcp-data-1); }
.chart-bar:nth-child(2) { background: var(--mcp-data-2); }
.chart-bar:nth-child(3) { background: var(--mcp-data-3); }

/* Using semantic gradients */
.status-success {
  background: var(--mcp-success-light);
  border-left: 3px solid var(--mcp-success-dark);
  color: var(--mcp-success-dark);
}
```

**MCP-WP-5.5.5:** Dynamic theme switching:

```javascript
// Widget reacts to theme changes
const unsubscribe = Theme.onThemeChange((newTokens, mode) => {
  // Tokens automatically update via CSS custom properties
  // Optionally update UI based on mode
  if (mode === 'high-contrast') {
    // Enhance visual accessibility
  }
});
```

**MCP-WP-5.5.6:** Scoped Theming (for widgets with custom color requirements):

Widgets MAY use scoped theming to separate chrome styling from content styling:

```typescript
// Widget metadata declares scoped theming
interface WidgetMetadata {
  scopedTheming?: {
    chrome: 'host' | 'custom';      // Widget borders, headers, controls
    content: 'host' | 'custom';     // Data visualizations, custom UI
    customTokens?: Record<string, string>;
  };
}
```

```css
/* Chrome uses host theme */
.widget-header {
  background: var(--mcp-surface);
  border-bottom: 1px solid var(--mcp-border);
  color: var(--mcp-text-primary);
}

/* Content uses custom brand colors */
.chart-container {
  --brand-color-1: #ff6b35;
  --brand-color-2: #004e89;
  --brand-color-3: #f7931e;
}

.logo {
  /* Preserve brand identity */
  color: var(--brand-color-1);
}
```

**MCP-WP-5.5.7:** Color Adaptation Helpers (for custom widget colors):

Widgets with custom colors MAY use Theme helper methods to adapt colors to current mode:

```javascript
// Adapt custom brand color to dark mode
const brandColor = '#ff6b35';
const adaptedColor = Theme.adaptColor?.(brandColor, {
  respectMode: true,
  targetContrast: 4.5  // WCAG AA
});

// Check contrast ratio
const ratio = Theme.getContrastRatio?.(adaptedColor, backgroundColor);
if (ratio < 4.5) {
  console.warn('Insufficient contrast for WCAG AA');
}

// Generate color scale for gradients
const colorScale = Theme.generateColorScale?.(brandColor, 5);
// Returns: ['#lightest', '#lighter', '#base', '#darker', '#darkest']
```

**MCP-WP-5.5.8:** Hosts implementing theming MUST:
- Inject CSS custom properties into widget shadow roots
- Provide at least `light` and `dark` themes
- Update tokens dynamically when user changes theme
- Persist theme preference across sessions
- Provide all 18 base tokens

**MCP-WP-5.5.9:** Hosts implementing theming SHOULD:
- Provide extended tokens (accent, data, semantic gradients)
- Implement Theme helper methods (getContrastRatio, adaptColor, etc.)
- Support scoped theming configuration
- Respect system-level theme preferences

**MCP-WP-5.5.10:** Widget theming benefits:
- **Visual consistency:** Widgets match host application design
- **White-label support:** Hosts can rebrand dashboards
- **Accessibility:** High-contrast themes for visual impairments
- **User preference:** Respect system-level theme settings
- **Brand preservation:** Custom widgets maintain identity with scoped theming
- **Data visualization:** Rich color palettes for complex widgets

---

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

## 7. MCP Primitives Rendering (Normative)

### 7.1 Tool Rendering

**MCP-WP-7.1.1:** Widgets that display MCP tools MUST show:

- Tool name (or `title` when provided)
- Tool description (if provided)
- Input schema summary (e.g., "Requires: owner, repo")

**MCP-WP-7.1.2:** Widgets that provide tool invocation UI MUST:

- Generate forms from the tool's inputSchema (JSON Schema)
- Validate user input against the schema before invocation
- Display validation errors inline

**MCP-WP-7.1.2a:** Widgets SHOULD expose any declared `outputSchema` and `annotations` (e.g., `readOnlyHint`, `idempotentHint`) to help users and agents understand tool behaviour.

**MCP-WP-7.1.3:** Tool invocation MUST emit events rather than calling MCPBridge directly:

```javascript
// CORRECT: Emit event for host to handle
EventBus.emit('mcp:tool:invoke-requested', {
  serverName: 'github',
  toolName: 'create_issue',
  args: { owner: 'anthropics', repo: 'mcp', title: '...' }
});

// INCORRECT: Direct call bypasses security
await MCPBridge.callTool('github', 'create_issue', args); // ❌
```

### 7.2 Resource Rendering

**MCP-WP-7.2.1:** Widgets that display MCP resources MUST show:

- Resource URI
- A human-friendly label, preferring `title` when present and falling back to `name`
- MIME type (if available)

**MCP-WP-7.2.1a:** Widgets SHOULD surface additional metadata when provided, such as `annotations` (`audience`, `priority`, `lastModified`) and `size`.

**MCP-WP-7.2.2:** Widgets SHOULD provide preview for common MIME types:

- `text/*`: Show text content
- `image/*`: Show thumbnail
- `application/json`: Pretty-print JSON

**MCP-WP-7.2.3:** Resource URIs with templates (e.g., `file:///{path}`) SHOULD render as interactive forms.

### 7.3 Prompt Rendering

**MCP-WP-7.3.1:** Widgets that display MCP prompts MUST show:

- Prompt name (and `title` when provided)
- Prompt description (if provided)
- Required vs optional arguments

**MCP-WP-7.3.2:** Prompt invocation SHOULD generate forms for arguments.

**MCP-WP-7.3.3:** Prompt results SHOULD display the generated messages in a readable format.

---

## 8. Event Naming Convention (Normative)

### 8.1 Event Pattern

**MCP-WP-8.1.1:** All MCP widget events MUST use the `mcp:` domain prefix.

**MCP-WP-8.1.2:** Event format: `mcp:<subject>:<action>`

### 8.2 Standard MCP Events

**MCP-WP-8.2.1:** The following events are REQUIRED for MCP operations:

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

## 10. Host Integration Requirements (Normative)

### 10.1 MCP Server Discovery

**MCP-WP-10.1.1:** The host MUST load MCP server configurations from `Configuration.get('mcp.servers')`.

**MCP-WP-10.1.2:** For each server, the host MUST:

1. Spawn the server process (stdio) or connect to HTTP endpoint
2. Send `initialize` JSON-RPC request
3. Receive server capabilities
4. Call `tools/list`, `resources/list`, `prompts/list`
5. Create MCPServerInfo object
6. Invoke widget factory with dependencies and server info

**MCP-WP-10.1.3:** The host SHOULD support hot-reload when `mcp.servers` configuration changes.

### 10.2 Widget Lifecycle

**MCP-WP-10.2.1:** Widget creation sequence:

1. Connect to MCP server
2. Discover tools/resources/prompts
3. Create widget via factory
4. Call `api.initialize()` if present
5. Render widget to DOM

**MCP-WP-10.2.2:** Widget destruction sequence:

1. Call `api.destroy()` if present
2. Remove widget from DOM (triggers `disconnectedCallback`)
3. Optionally disconnect MCP server if no other widgets use it

### 10.3 Resilience, Telemetry, and Localization Hooks

**MCP-WP-10.3.1:** When an `OfflineCache` is provided, the host **MUST** keep its connectivity status in sync with the widget by emitting `mcp:host:connectivity` notifications.

**MCP-WP-10.3.2:** Hosts **MUST** flush queued operations automatically after reconnect and **MUST** surface failures through `mcp:host:offline-error` events so widgets can update their UI.

**MCP-WP-10.3.3:** If telemetry is enabled, the host **MUST** enrich events with anonymized session identifiers and enforce any user consent toggles before forwarding them outside the runtime.

**MCP-WP-10.3.4:** Hosts **SHOULD** propagate locale changes by emitting `mcp:host:locale-changed` with the new locale identifier; widgets SHOULD update rendered strings when received.

---

## 11. Security Requirements (Normative)

### 11.1 XSS Prevention

**MCP-WP-11.1.1:** MCP tool names, resource URIs, and prompt arguments received from servers MUST be treated as untrusted.

**MCP-WP-11.1.2:** Widgets MUST use `textContent` when rendering MCP server data.

**MCP-WP-11.1.3:** Tool result content of type `text` MUST be sanitized before rendering as HTML.

### 11.2 Tool Invocation Security

**MCP-WP-11.2.1:** The host MUST require user confirmation before executing any tool.

**MCP-WP-11.2.2:** Confirmation dialog MUST display:

```
Invoke tool: github:create_issue

Server: github (MCP Server)
Arguments:
{
  "owner": "anthropics",
  "repo": "mcp",
  "title": "Bug report"
}

⚠️ This action will be performed on your behalf.
[Cancel] [Confirm]
```

**MCP-WP-11.2.3:** The host MUST validate arguments against `inputSchema` before sending to MCP server.

**MCP-WP-11.2.4:** Widgets MUST NOT bypass confirmation by calling `MCPBridge.callTool()` directly.

### 11.3 Resource URI Validation

**MCP-WP-11.3.1:** Before reading a resource, the host SHOULD validate the URI scheme against an allowlist.

**MCP-WP-11.3.2:** URIs with `file://` scheme SHOULD be restricted to server-declared paths.

### 11.4 Widget Permission Model 

**MCP-WP-11.4.1:** Widgets MAY declare required permissions in the `permissions` field of widget metadata.

**MCP-WP-11.4.2:** If `permissions` is undefined, the widget MUST be treated as having no permissions (maximum restriction).

**MCP-WP-11.4.3:** Hosts MUST enforce permissions via:
- Content Security Policy (CSP) headers
- API gate enforcement on `MCPBridge`, storage, clipboard, and network APIs
- Runtime validation before sensitive operations

**MCP-WP-11.4.4:** Permission enforcement by trust level:

| Trust Level | Network | Storage | MCP Operations | Confirmation Required |
|-------------|---------|---------|----------------|----------------------|
| untrusted   | None    | None    | None (blocked) | Always               |
| community   | Declared domains only | Session only | With confirmation | First-time only |
| verified    | Declared domains | Persistent allowed | With confirmation | First-time only |
| enterprise  | Full (within declared) | Full | No confirmation | Never |

**MCP-WP-11.4.5:** Before widget installation, hosts MUST display requested permissions to user for consent.

**MCP-WP-11.4.6:** Hosts SHOULD maintain audit logs of permission grants, revocations, and violations for compliance purposes (SOC2, ISO 27001, GDPR).

**MCP-WP-11.4.7:** Widgets requiring additional permissions in updates MUST trigger re-consent flow.

**MCP-WP-11.4.8:** For verified widgets (`trustLevel: 'verified'`), hosts MUST validate code signatures before granting elevated permissions.

### 11.5 Accessibility Requirements (WCAG 2.1 Level AA)

**MCP-WP-11.5.1:** All MCP-WP widgets MUST conform to WCAG 2.1 Level AA accessibility standards.

**MCP-WP-11.5.2:** Widgets MUST provide keyboard navigation for all interactive elements:
- **Tab:** Focus next element
- **Shift+Tab:** Focus previous element
- **Enter/Space:** Activate focused element
- **Escape:** Close modals/dialogs

**MCP-WP-11.5.3:** Widgets MUST include appropriate ARIA labels and roles:

```html
<button aria-label="Invoke create_issue tool" role="button">
  Create Issue
</button>

<div role="alert" aria-live="polite">
  Tool execution completed successfully
</div>
```

**MCP-WP-11.5.4:** Dynamic content changes MUST be announced to screen readers via ARIA live regions (`aria-live="polite"` or `aria-live="assertive"`).

**MCP-WP-11.5.5:** Hosts SHOULD provide an `A11yHelper` dependency for accessibility utilities:

```typescript
interface A11yHelper {
  // Announce message to screen readers
  announce(message: string, politeness: 'polite' | 'assertive'): void;

  // Create focus trap for modal dialogs
  setFocusTrap(element: HTMLElement): ReleaseTrapFunction;

  // Validate color contrast ratio (WCAG AA: 4.5:1 for normal text)
  validateContrast(fgColor: string, bgColor: string): boolean;

  // Get user's accessibility preferences
  getPreferences(): A11yPreferences;
}

interface A11yPreferences {
  reducedMotion: boolean;       // prefers-reduced-motion
  highContrast: boolean;         // prefers-contrast: high
  fontSize: 'small' | 'medium' | 'large' | 'x-large';
  screenReaderActive: boolean;
}

type ReleaseTrapFunction = () => void;
```

**MCP-WP-11.5.6:** Widgets MUST respect user accessibility preferences:
- Honor `prefers-reduced-motion` (disable animations)
- Honor `prefers-contrast` (adjust colors)
- Support browser zoom (use relative units like `rem`, `em`)

**MCP-WP-11.5.7:** Color MUST NOT be the only means of conveying information:
- Use icons + color for status indicators
- Provide text labels in addition to color coding
- Example: Error state = red color + "✗" icon + "Error" text

**MCP-WP-11.5.8:** Widgets MUST maintain minimum color contrast ratios:
- Normal text: 4.5:1
- Large text (18pt+): 3:1
- UI components and graphics: 3:1

**MCP-WP-11.5.9:** Form inputs MUST have associated labels:

```html
<label for="tool-arg-repo">Repository Name</label>
<input id="tool-arg-repo" type="text" aria-required="true" />
```

**MCP-WP-11.5.10:** Error messages MUST be programmatically associated with form fields:

```html
<input id="repo" aria-invalid="true" aria-describedby="repo-error" />
<span id="repo-error" role="alert">Repository name is required</span>
```

**MCP-WP-11.5.11:** Widgets SHOULD integrate automated accessibility testing:
- Use `axe-core` library for runtime validation
- Include accessibility tests in conformance test suite (Section 17)
- Report violations to host for debugging

**MCP-WP-11.5.12:** Host confirmation dialogs (e.g., tool invocation) MUST be accessible:
- Focus trap within dialog
- Announce dialog opening to screen readers
- Escape key to dismiss
- Focus returns to trigger element on close

---

### 11.6 HTTP Authorization (Informative)

The MCP 2025-06-18 specification introduces an HTTP authorization framework that hosts **MAY** adopt when communicating with servers over HTTP transports. MCP-WP does not mandate a specific authentication scheme, but hosts that implement OAuth 2.0 or similar mechanisms SHOULD:

- Store credentials securely and scope tokens to the minimum permissions required by each server.
- Inject authorization headers only for transports that require them; STDIO transports SHOULD source credentials from the process environment per the MCP spec.
- Expose revocation and credential rotation controls to users or administrators.
- Ensure widgets never receive raw credentials—authorization flows terminate at the host layer.

This subsection is informative: implementations can choose alternative authentication strategies so long as they maintain the consent and least-privilege principles described throughout Section 11.

---

## 12. Standard Widget Types (Informative)

### 13.1 Recommended Standard Widgets

Implementations SHOULD provide these standard widget types:

**mcp-server-status-widget**

- Compact status badge
- Shows server name, connection state, tool/resource counts
- Minimal interaction

**mcp-server-panel-widget (Recommended default)**

- Tabbed interface: Overview | Tools | Resources | Prompts | Activity
- Full-featured server dashboard
- Tool invocation forms, resource browser, activity log

**mcp-tool-browser-widget**

- Dedicated tool discovery and invocation UI
- Searchable tool list
- Auto-generated forms from JSON Schema

**mcp-resource-explorer-widget**

- File-browser-style UI for resources
- Preview pane for common MIME types
- URI template support

**mcp-activity-log-widget**

- Chronological timeline of tool calls
- Request/response inspection
- Performance metrics (latency)

---

## 13. Example Implementation (Informative)

### 14.1 GitHub MCP Widget Example

```javascript
// widgets/github-mcp-widget/index.js

export default function createMCPWidget(
  { EventBus, MCPBridge, Configuration },
  mcpServerInfo
) {
  const { serverName, tools, resources } = mcpServerInfo;

  class GitHubMCPWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._tools = tools;
      this._selectedTool = null;
    }

    connectedCallback() {
      this.render();
      this._boundRefresh = () => this.refresh();
      EventBus.on(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    disconnectedCallback() {
      EventBus.off(`mcp:server:${serverName}:updated`, this._boundRefresh);
    }

    async refresh() {
      this._tools = await MCPBridge.listTools(serverName);
      this.render();
    }

    getStatus() {
      const isConnected = MCPBridge.isConnected(serverName);
      return {
        state: isConnected ? 'active' : 'error',
        primaryMetric: `${this._tools.length} tools`,
        secondaryMetric: mcpServerInfo.transport,
        lastActivity: null,
        message: isConnected ? null : 'Server disconnected'
      };
    }

    getMCPInfo() {
      return {
        serverName,
        availableTools: this._tools.length,
        availableResources: resources.length,
        availablePrompts: 0,
        connectionState: MCPBridge.isConnected(serverName) ? 'connected' : 'disconnected',
        lastError: null
      };
    }

    render() {
      this.shadowRoot.innerHTML = '';

      const style = document.createElement('style');
      style.textContent = `
        :host { display: block; font-family: monospace; }
        .panel { padding: 16px; background: #1e1e1e; color: #d4d4d4; border-radius: 4px; }
        .tool { padding: 8px; margin: 4px 0; background: #2d2d2d; cursor: pointer; }
        .tool:hover { background: #3d3d3d; }
        button { padding: 8px 16px; margin-top: 8px; }
      `;

      const panel = document.createElement('div');
      panel.className = 'panel';

      const title = document.createElement('h3');
      title.textContent = `🔧 ${serverName} MCP Server`;
      panel.appendChild(title);

      const toolList = document.createElement('div');
      for (const tool of this._tools) {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'tool';

        const toolName = document.createElement('strong');
        toolName.textContent = tool.name;

        const toolDesc = document.createElement('p');
        toolDesc.textContent = tool.description;

        toolDiv.appendChild(toolName);
        toolDiv.appendChild(toolDesc);

        toolDiv.onclick = () => {
          this._selectedTool = tool;
          this.showToolForm(tool);
        };

        toolList.appendChild(toolDiv);
      }
      panel.appendChild(toolList);

      this.shadowRoot.appendChild(style);
      this.shadowRoot.appendChild(panel);
    }

    showToolForm(tool) {
      // Generate form from tool.inputSchema (JSON Schema)
      // For brevity, simplified example
      const form = document.createElement('div');

      const formTitle = document.createElement('h4');
      formTitle.textContent = `Invoke: ${tool.name}`;
      form.appendChild(formTitle);

      const invokeBtn = document.createElement('button');
      invokeBtn.textContent = 'Invoke Tool';
      invokeBtn.onclick = () => {
        // Emit event for host to handle (with confirmation dialog)
        EventBus.emit('mcp:tool:invoke-requested', {
          serverName,
          toolName: tool.name,
          args: {} // Extract from form inputs
        });
      };
      form.appendChild(invokeBtn);

      this.shadowRoot.querySelector('.panel').appendChild(form);
    }
  }

  const elementName = `mcp-${serverName}-widget`;
  if (!customElements.get(elementName)) {
    customElements.define(elementName, GitHubMCPWidget);
  }

  return {
    api: {
      async initialize() {
        // Setup subscriptions if needed
      },
      async destroy() {
        // Cleanup
      },
      async refresh() {
        const element = document.querySelector(elementName);
        if (element) await element.refresh();
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: elementName,
      displayName: `${serverName} Server`,
      icon: '🔧',
      category: 'MCP Servers',
      mcpServerName: serverName,
      transport: mcpServerInfo.transport,
      mcpProtocolVersion: mcpServerInfo.protocolVersion,
      capabilities: {
        tools: tools.length > 0,
        resources: resources.length > 0,
        prompts: false,
        sampling: false
      },
      widgetType: 'server-panel',
      priority: 0
    }
  };
}
```

---

## 14. Widget Registry Protocol (Normative)

### 15.1 Purpose and Scope

**MCP-WP-16.1.1:** This section defines the protocol for discovering, distributing, installing, and updating MCP-WP widgets across host applications.

**MCP-WP-16.1.2:** The registry protocol enables npm-style widget distribution: `mcpwp install @org/github-widget`

**MCP-WP-16.1.3:** Registries MAY be centralized (npm, official registry) or decentralized (GitHub releases, self-hosted).

### 15.2 Widget Package Manifest

**MCP-WP-16.2.1:** Every widget package MUST include a `widget.json` manifest:

```json
{
  "name": "@mcpwp/github-widget",
  "version": "1.2.3",
  "description": "Visual dashboard for GitHub MCP server",
  "bundle": "https://cdn.example.com/github-widget-1.2.3.js",
  "integrity": "sha256-abc123def456...",
  "mcpwpVersion": "1.2.0",
  "dependencies": {
    "@mcpwp/base-components": "^2.0.0"
  },
  "repository": {
    "type": "github",
    "url": "https://github.com/org/github-widget",
    "commit": "a1b2c3d4"
  },
  "license": "MIT",
  "author": {
    "name": "Widget Author",
    "email": "author@example.com",
    "url": "https://example.com"
  },
  "keywords": ["mcp", "github", "widget"],
  "mcpServers": ["github", "github-enterprise"]
}
```

**MCP-WP-16.2.2:** Manifest fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name (npm-style scoping) |
| `version` | string | Yes | Semantic version |
| `bundle` | string | Yes | HTTPS URL to widget JavaScript bundle |
| `integrity` | string | Yes | SHA256 hash for integrity verification |
| `mcpwpVersion` | string | Yes | Minimum MCP-WP protocol version |
| `dependencies` | object | No | Other widget dependencies |
| `repository` | object | No | Source code location |
| `mcpServers` | string[] | No | Compatible MCP server names |

### 15.3 Registry Discovery

**MCP-WP-16.3.1:** Hosts SHOULD support multiple registry sources:

1. **Official Registry**: `https://registry.mcpwidgets.dev`
2. **npm Registry**: `https://registry.npmjs.org` (packages with `mcp-widget` keyword)
3. **GitHub Releases**: Direct from GitHub releases API
4. **Custom Registry**: User-configured registry URL

**MCP-WP-16.3.2:** Registry API endpoint: `GET /widgets/{name}` returns widget manifest.

**MCP-WP-16.3.3:** Search endpoint: `GET /widgets?q={query}&server={mcpServer}` returns matching widgets.

### 15.4 Installation Process

**MCP-WP-16.4.1:** Widget installation sequence:

```bash
mcpwp install @mcpwp/github-widget
```

1. Resolve widget name to registry source
2. Fetch `widget.json` manifest
3. Verify `mcpwpVersion` compatibility
4. Resolve dependencies recursively
5. Download bundle from `bundle` URL
6. Verify integrity (SHA256 hash matches `integrity` field)
7. Store bundle in local cache (`~/.mcpwp/widgets/`)
8. Register widget in host configuration

**MCP-WP-16.4.2:** Dependency resolution MUST use semantic versioning ranges.

**MCP-WP-16.4.3:** Circular dependencies MUST be detected and rejected.

**MCP-WP-16.4.4:** If integrity verification fails, installation MUST abort with error.

### 15.5 Update Mechanism

**MCP-WP-16.5.1:** Hosts SHOULD check for widget updates periodically (default: daily).

**MCP-WP-16.5.2:** Update check: Compare local version with latest registry version.

**MCP-WP-16.5.3:** Widget updates MAY be:
- **Automatic** (patch versions: 1.2.3 → 1.2.4)
- **Notify User** (minor versions: 1.2.0 → 1.3.0)
- **Manual Approval** (major versions: 1.0.0 → 2.0.0)

**MCP-WP-16.5.4:** Breaking changes (major version bumps) MUST NOT auto-update.

### 15.6 Integrity Verification

**MCP-WP-16.6.1:** The `integrity` field MUST contain a SHA256 hash:

```
sha256-<base64-encoded-hash>
```

**MCP-WP-16.6.2:** Hosts MUST verify downloaded bundle matches hash before execution.

**MCP-WP-16.6.3:** Verification failure MUST prevent widget loading and log security event.

### 15.7 Caching and Offline Support

**MCP-WP-16.7.1:** Hosts SHOULD cache downloaded widgets locally in:

```
~/.mcpwp/widgets/{name}/{version}/bundle.js
~/.mcpwp/widgets/{name}/{version}/widget.json
```

**MCP-WP-16.7.2:** Cached widgets MUST remain available offline.

**MCP-WP-16.7.3:** Cache invalidation: Remove versions older than 90 days if not actively used.

### 15.8 Uninstallation

**MCP-WP-16.8.1:** Widget removal:

```bash
mcpwp uninstall @mcpwp/github-widget
```

1. Remove from host configuration
2. Call widget's `api.destroy()` for all active instances
3. Remove from DOM
4. Optionally delete cached files (with `--purge` flag)

---

## 15. mcp-ui Interoperability Contract (Normative)

### 16.1 Purpose and Scope

**MCP-WP-16.1.1:** This section defines bidirectional compatibility between MCP-WP and the community-driven mcp-ui protocol.

**MCP-WP-16.1.2:** Strategic positioning: MCP-WP aims to formalize the concepts pioneered by mcp-ui, not replace it. This interoperability enables gradual migration while preserving ecosystem investments.

**MCP-WP-16.1.3:** This interoperability is OPTIONAL. Hosts MAY choose to support only MCP-WP native format.

### 15.2 mcp-ui Protocol Overview

**MCP-WP-16.2.1:** The mcp-ui protocol defines a `UIResource` payload format:

```typescript
interface UIResource {
  uri: string;                        // Resource identifier
  mimeType: string;                   // Content type
  content: string;                    // Resource content or URL
}
```

**MCP-WP-16.2.2:** Supported MIME types:

| MIME Type | Rendering Method |
|-----------|------------------|
| `text/html` | Sandboxed iframe with `srcdoc` |
| `text/uri-list` | Sandboxed iframe loading external URL |
| `application/vnd.mcp-ui.remote-dom` | Shopify remote-dom execution in sandbox |

### 15.3 Converting mcp-ui to MCP-WP

**MCP-WP-16.3.1:** Hosts supporting mcp-ui compatibility SHOULD implement a `UIResourceAdapter`:

```typescript
interface UIResourceAdapter {
  fromMCPUI(resource: UIResource, mcpServerInfo: MCPServerInfo): MCPWidgetInterface;
  toMCPUI(widget: MCPWidgetInterface): UIResource;
  isMCPUICompatible(widget: MCPWidgetInterface): boolean;
}
```

**MCP-WP-16.3.2:** When converting `text/html` UIResource:
- Create custom element extending `HTMLElement`
- Render content in sandboxed `<iframe>` with `srcdoc` attribute
- Apply CSP: `default-src 'self'; script-src 'unsafe-inline';`
- Set `mcpUICompatible: true` in widget metadata

**MCP-WP-16.3.3:** When converting `text/uri-list` UIResource:
- Validate URL is HTTPS (reject `http://` URLs)
- Load URL in sandboxed `<iframe>` with `src` attribute
- Apply same sandbox restrictions as `text/html`

**MCP-WP-16.3.4:** When converting `application/vnd.mcp-ui.remote-dom`:
- Execute script in sandboxed environment
- Use Shopify's `@remote-dom/core` library for message-passing
- Render UI changes via host's native components
- Requires `permissions.network` due to message-passing requirements

### 15.4 Converting MCP-WP to mcp-ui

**MCP-WP-16.4.1:** Widgets MAY export to mcp-ui format by setting `mcpUICompatible: true` in metadata.

**MCP-WP-16.4.2:** Export options:
- **As `text/html`**: Serialize widget's rendered shadow DOM to static HTML
- **As `text/uri-list`**: Provide hosted URL if widget has `repository.url` field
- **As remote-dom**: Implement full remote-dom protocol (advanced, optional)

**MCP-WP-16.4.3:** Limitations of mcp-ui export:
- Static HTML export loses interactivity and event handlers
- No access to MCP-WP host dependencies (EventBus, MCPBridge)
- Widget updates require re-export and re-distribution

### 15.5 Discovery and Negotiation

**MCP-WP-16.5.1:** When connecting to an MCP server, hosts SHOULD:
1. Check if server provides mcp-ui resources via `resources/list`
2. If found and host supports mcp-ui, use `UIResourceAdapter.fromMCPUI()`
3. Otherwise, fall back to generic MCP-WP widget

**MCP-WP-16.5.2:** This allows MCP-WP hosts to consume existing mcp-ui widgets without modification.

### 15.6 Security Considerations

**MCP-WP-16.6.1:** mcp-ui widgets MUST be treated with `trustLevel: 'untrusted'` unless explicitly verified.

**MCP-WP-16.6.2:** Sandboxed iframes MUST include these attributes:
- `sandbox="allow-scripts allow-same-origin"`
- Content Security Policy enforcement
- No access to host DOM or storage

**MCP-WP-16.6.3:** Remote DOM scripts MUST execute in isolated contexts with message-passing validation.

### 15.7 Migration Path

**MCP-WP-16.7.1:** Recommended migration strategy (3 phases):

**Phase 1: Compatibility Layer**
- Deploy MCP-WP host with `UIResourceAdapter` support
- Existing mcp-ui widgets work without changes
- No ecosystem disruption

**Phase 2: Hybrid Enhancement**
- Add MCP-WP features to widgets: permissions, `getStatus()`, `getMCPInfo()`
- Maintain backward compatibility via `toMCPUI()` export
- Widgets support both protocols

**Phase 3: Full MCP-WP Native**
- Rewrite using MCP-WP APIs (EventBus, MCPBridge)
- Leverage advanced features (trust levels, audit logs, widget composition)
- Optionally maintain mcp-ui export for backward compatibility

---

## 16. Conformance Test Suite & Quality Assurance (Normative)

### 17.1 Purpose and Scope

**MCP-WP-17.1.1:** This section defines requirements for widget conformance testing and quality assurance.

**MCP-WP-17.1.2:** Widgets MAY use the official `@mcpwp/test-kit` package for automated validation.

**MCP-WP-17.1.3:** Passing conformance tests is REQUIRED for "MCP-WP Certified" marketplace badge.

### 17.2 Test Kit Interface

**MCP-WP-17.2.1:** The official test kit MUST provide the following test categories:

```typescript
interface ConformanceTestSuite {
  // Lifecycle contract validation
  testLifecycle(widget: MCPWidgetInterface): Promise<TestResult>;

  // Event emission contract validation
  testEventContracts(widget: MCPWidgetInterface): Promise<TestResult>;

  // Accessibility compliance (WCAG 2.1 AA)
  testAccessibility(widget: MCPWidgetInterface): Promise<TestResult>;

  // Performance budget validation
  testPerformance(widget: MCPWidgetInterface): Promise<TestResult>;

  // Security requirements validation
  testSecurity(widget: MCPWidgetInterface): Promise<TestResult>;

  // Metadata schema validation
  testMetadata(widget: MCPWidgetInterface): Promise<TestResult>;

  // Run all tests
  runAll(widget: MCPWidgetInterface): Promise<ConformanceReport>;
}

interface TestResult {
  category: string;
  passed: boolean;
  failures: TestFailure[];
  warnings: TestWarning[];
  executionTime: number;       // milliseconds
}

interface TestFailure {
  rule: string;                // e.g., "MCP-WP-3.4.2"
  description: string;
  severity: 'critical' | 'error';
  location?: string;           // Code location if available
}

interface TestWarning {
  rule: string;
  description: string;
  recommendation: string;
}

interface ConformanceReport {
  version: string;             // Test kit version
  timestamp: string;
  widgetName: string;
  passed: boolean;
  results: TestResult[];
  overallScore: number;        // 0-100
  certificationEligible: boolean;
}
```

### 17.3 Lifecycle Correctness Tests

**MCP-WP-17.3.1:** Test that `api.initialize()` completes successfully within 5000ms.

**MCP-WP-17.3.2:** Test that `api.destroy()` removes all EventBus listeners.

**MCP-WP-17.3.3:** Test that `api.destroy()` completes within 5000ms.

**MCP-WP-17.3.4:** Test that `api.refresh()` updates widget UI with new data.

**MCP-WP-17.3.5:** Test that widget custom element defines `getStatus()` method.

**MCP-WP-17.3.6:** Test that `getStatus()` returns valid `MCPWidgetStatus` schema.

### 17.4 Event Contract Tests

**MCP-WP-17.4.1:** Test that widgets emit events with correct naming (`mcp:<subject>:<action>`).

**MCP-WP-17.4.2:** Test that `mcp:tool:invoke-requested` events include required fields (`serverName`, `toolName`, `args`).

**MCP-WP-17.4.3:** Test that widgets listen for appropriate response events (`mcp:tool:result`, `mcp:tool:error`).

**MCP-WP-17.4.4:** Test that widgets do NOT call `MCPBridge.callTool()` directly (security violation).

### 17.5 Accessibility Tests

**MCP-WP-17.5.1:** Run `axe-core` automated accessibility audit on widget DOM.

**MCP-WP-17.5.2:** Test keyboard navigation:
- All interactive elements reachable via Tab
- Enter/Space activates focused element
- Escape dismisses modals

**MCP-WP-17.5.3:** Test ARIA labels presence on all buttons and form inputs.

**MCP-WP-17.5.4:** Test color contrast ratios meet WCAG AA standards (4.5:1 for text).

**MCP-WP-17.5.5:** Test focus indicators are visible (outline or alternative styling).

**MCP-WP-17.5.6:** Test that error messages are associated with form fields via `aria-describedby`.

### 17.6 Performance Tests

**MCP-WP-17.6.1:** Measure widget bundle size (gzipped):
- **MUST** be ≤ 500KB including all assets
- **SHOULD** be ≤ 100KB for core logic
- **Warn** if > 200KB

**MCP-WP-17.6.2:** Measure initial render time:
- **MUST** be ≤ 500ms from `connectedCallback()` to first paint
- **SHOULD** be ≤ 200ms
- **Warn** if > 300ms

**MCP-WP-17.6.3:** Measure memory usage after initialization:
- **MUST** be ≤ 20MB
- **SHOULD** be ≤ 10MB
- **Warn** if > 15MB

**MCP-WP-17.6.4:** Test for memory leaks:
- Create widget → destroy → measure memory
- Repeat 10 times
- Memory MUST NOT increase by more than 10% over baseline

**MCP-WP-17.6.5:** Measure `getResourceUsage()` if implemented:

```typescript
interface WidgetResourceUsage {
  memoryUsed: number;          // bytes
  bundleSize: number;          // bytes (gzipped)
  renderTime: number;          // milliseconds (last render)
}
```

### 17.7 Security Tests

**MCP-WP-17.7.1:** Test that widgets use `textContent` for untrusted data (not `innerHTML`).

**MCP-WP-17.7.2:** Test that widgets do not execute `eval()` or `new Function()`.

**MCP-WP-17.7.3:** Test Content Security Policy compliance (no inline scripts in production).

**MCP-WP-17.7.4:** Test that widgets declare permissions in metadata if accessing restricted APIs.

**MCP-WP-17.7.5:** Test that code signature is valid if `trustLevel: 'verified'`.

### 17.8 Visual Regression Testing

**MCP-WP-17.8.1:** Hosts MAY implement visual regression testing via screenshot comparison.

**MCP-WP-17.8.2:** Test kit SHOULD provide utilities for capturing widget screenshots:

```typescript
interface VisualTesting {
  captureScreenshot(widget: HTMLElement): Promise<ImageData>;
  compareScreenshots(baseline: ImageData, current: ImageData): VisualDiff;
}

interface VisualDiff {
  pixelDifference: number;     // Number of pixels changed
  percentDifference: number;   // 0-100
  diffImage: ImageData;        // Highlighted differences
}
```

**MCP-WP-17.8.3:** Visual diffs > 5% SHOULD trigger review.

### 17.9 Integration Test Utilities

**MCP-WP-17.9.1:** Test kit MUST provide mock implementations:

```typescript
interface MockDependencies {
  EventBus: MockEventBus;
  MCPBridge: MockMCPBridge;
  Configuration: MockConfiguration;
}

// Mock EventBus records all events
class MockEventBus implements EventBusInterface {
  events: Array<{ name: string; data: any; timestamp: number }>;
  on(event: string, handler: Function): UnsubscribeFunction;
  emit(event: string, data: any): void;
  getEmittedEvents(pattern: RegExp): Array<any>;
}

// Mock MCPBridge simulates MCP server responses
class MockMCPBridge implements MCPBridgeInterface {
  setToolResult(toolName: string, result: ToolResult): void;
  setResourceContents(uri: string, contents: ResourceContents): void;
  getCallHistory(): Array<{ method: string; args: any[] }>;
}
```

### 17.10 Certification Badge Requirements

**MCP-WP-17.10.1:** To qualify for "MCP-WP Certified v1.2.0" badge, widgets MUST:
- Pass all lifecycle tests (100%)
- Pass all event contract tests (100%)
- Pass all security tests (100%)
- Pass ≥ 90% of accessibility tests
- Pass ≥ 80% of performance tests
- Overall conformance score ≥ 85/100

**MCP-WP-17.10.2:** Certification is version-specific. Widget updates require re-certification.

**MCP-WP-17.10.3:** Hosts MAY display certification badges in widget marketplace UI.

### 17.11 Continuous Testing

**MCP-WP-17.11.1:** Widget authors SHOULD integrate conformance tests into CI/CD pipelines.

**MCP-WP-17.11.2:** Example GitHub Actions workflow:

```yaml
name: MCP-WP Conformance Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run build
      - run: npx @mcpwp/test-kit test --widget ./dist/widget.js
      - run: npx @mcpwp/test-kit certify --report ./conformance-report.json
```

**MCP-WP-17.11.3:** Failed conformance tests SHOULD block widget releases.

---

## 17. Agent Collaboration Protocol (Normative)

**MCP-WP-17.1.1:** Hosts that enable automated control **MUST** mediate all agent requests through the `AgentAPI` surface described in Section 3.5.

**MCP-WP-17.1.2:** Hosts **MUST** authenticate and authorize the agent prior to delegating to `executeAction` and **MUST** log every invocation for auditability.

**MCP-WP-17.1.3:** Widgets implementing `AgentAPI` **MUST** return deterministic JSON Schema documents so hosts can validate and sanitize agent payloads before execution.

**MCP-WP-17.1.4:** Agent-triggered invocations **MUST** emit the same EventBus events as human-triggered invocations, with an additional metadata hint `{ source: 'agent' }`.

**MCP-WP-17.1.5:** Widgets **SHOULD** default agent access to read-only or idempotent actions and require explicit host permissions for destructive operations.

**MCP-WP-17.1.6:** When an agent requires language model assistance, widgets MAY delegate to `MCPBridge.createMessage()` (Section 6.2) using the same human-in-the-loop approval applied to direct user requests. Agent-authored prompts MUST be validated against the `SamplingRequest` schema before execution.

**MCP-WP-17.1.7:** Hosts **SHOULD** log the resolved `SamplingResult` (including the selected model and `stopReason`) alongside the originating agent action so auditors can trace automated decisions.

## 18. Performance & Resource Budgets (Normative)

**MCP-WP-18.1.1:** Widget bundles **MUST NOT** exceed 500KB gzipped; widgets **SHOULD** stay within 100KB for core logic.

**MCP-WP-18.1.2:** Initial render time **MUST NOT** exceed 500ms on reference hardware (2 vCPU, 4GB RAM, slow 3G network throttling); widgets **SHOULD** render within 200ms.

**MCP-WP-18.1.3:** Steady-state memory usage per widget **MUST NOT** exceed 20MB; implementations **SHOULD** target ≤10MB to leave headroom for multiple concurrent widgets.

**MCP-WP-18.1.4:** Widgets that implement `getResourceUsage()` **MUST** report metrics in bytes and milliseconds as defined in Section 17.6.5.

**MCP-WP-18.1.5:** Hosts **MUST** enforce these budgets before distributing widgets through marketplaces or enterprise catalogs and **MAY** refuse activation if any limit is breached.

---

## Appendix A: References (Informative)

- https://spec.modelcontextprotocol.io/
- https://github.com/modelcontextprotocol
- https://www.jsonrpc.org/specification
- https://www.ietf.org/rfc/rfc2119.txt
- https://json-schema.org/draft-07/schema
- https://www.w3.org/TR/components-intro/

---

## Appendix B: Goal Statement

The MCP Widget Protocol (MCP-WP) standardizes visual representation of Anthropic's Model Context Protocol servers in dashboard applications. It defines contracts for creating Web Components that display MCP tools, resources, and prompts with safe rendering, dependency injection for host services (EventBus, MCPBridge, Theme, A11yHelper), and lifecycle management.

Through strict interfaces, MCP-WP ensures security via declarative permission models, user confirmation for tool invocations, XSS prevention for server data, and JSON Schema validation for tool arguments. The protocol includes enterprise-grade features: WCAG 2.1 Level AA accessibility requirements, widget registry protocol for distribution, conformance testing framework for quality assurance, and inter-widget communication for composite workflows.

The protocol formalizes interoperability with the community-driven mcp-ui standard, positioning MCP-WP as a collaborative formalization rather than a competitive replacement. It enables developers to build consistent, reusable widgets for any MCP server (GitHub, Slack, Supabase) that integrate seamlessly with host dashboards while maintaining visual consistency, security, and predictable behavior across the MCP ecosystem.

---

**END OF SPECIFICATION**
