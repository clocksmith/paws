# MCP Lens Widget Examples

**Beautiful, production-ready widgets demonstrating protocol-semantic analytics.**

These examples show how MCP Lens provides insights that infrastructure monitoring (Grafana) and LLM quality tools (Langfuse) cannot - answering the *why* behind MCP operations at the protocol level.

---

## 🎯 Quick Start

### Prerequisites

```bash
# Ensure you have Node.js 18+ installed
node --version

# Navigate to examples directory
cd lens/examples
```

### Run an Example

```typescript
import createCapabilityAnalyzerWidget from './capability-analyzer-widget';
import { EventBus, MCPBridge, Configuration } from '@mcpl/core';

// Create widget instance
const widget = createCapabilityAnalyzerWidget(
  { EventBus, MCPBridge, Configuration },
  {
    serverName: 'github',
    capabilities: { tools: true, resources: true, prompts: false }
  }
);

// Add to page
document.body.appendChild(document.createElement(widget.widget.element));

// Initialize
await widget.api.initialize();
```

---

## 📊 Examples Overview

### 1. **Capability Analyzer Widget** ⭐ *Recommended Start*

**File:** `capability-analyzer-widget.ts`

**What it demonstrates:**
- **Protocol-semantic analysis** - MCP Lens's unique value proposition
- Detects wasted capabilities (negotiated but never used)
- Real-time protocol health monitoring
- Efficiency recommendations at protocol level

**Why this matters:**
- **Grafana can't tell you this:** "Server X has tools capability but never uses it"
- **Langfuse can't tell you this:** "40% of capability negotiations are wasted"
- **MCP Lens tells you:** "Remove `prompts` capability from server advertisement - it's never used and wastes 12% of initialization time"

**SPEC Compliance:**
- ✅ Widget factory pattern (SPEC §3.1)
- ✅ Event subscription for monitoring (SPEC §6.2)
- ✅ Shadow DOM styling (SPEC §4.2)
- ✅ Lifecycle management (SPEC §3.3)

**Screenshot:**
```
┌─────────────────────────────────────┐
│ 🔍 Capability Analysis              │
│ github                              │
│                                     │
│ Negotiated Capabilities             │
│ ┌─────────┐  ┌─────────┐           │
│ │🛠️ Tools  │  │📁 Resources│         │
│ │ Enabled │  │ Enabled │           │
│ │   142   │  │    78   │           │
│ └─────────┘  └─────────┘           │
│                                     │
│ Protocol Health                     │
│ ⚠️ wasted-capability: prompts       │
│ Prompts capability negotiated but   │
│ never used                          │
│ 💡 Remove prompts capability from   │
│    server advertisement             │
│                                     │
│ Total Protocol Operations: 220      │
└─────────────────────────────────────┘
```

---

### 2. **Simple Counter Widget**

**File:** `counter-widget.ts`

**What it demonstrates:**
- Basic widget structure for learning
- Configuration persistence
- Event emission
- Shadow DOM styling

**Best for:** First-time widget developers learning the pattern

**SPEC Compliance:**
- ✅ Factory function signature (SPEC §3.1)
- ✅ Lifecycle methods (SPEC §3.3)
- ✅ Web Component contract (SPEC §4.1)
- ✅ Configuration interface (SPEC §5.4)

---

### 3. **GitHub Widget** *(Coming Soon)*

**File:** `github-widget.ts`

**What it will demonstrate:**
- Tool invocation efficiency analysis
- Why do `create_pull_request` calls fail?
- Schema compliance checking
- Permission model analysis

**Protocol-semantic insights:**
- "Tool X fails because write_access permission not granted at invocation time, even though capability negotiation succeeded"
- "Schema validation errors account for 40% of failures"

---

### 4. **Cross-Server Correlation Widget** *(Coming Soon)*

**What it will demonstrate:**
- Semantic dependency tracking across multiple MCP servers
- GitHub issue → Slack notification → Jira ticket causality chains
- Different from timing correlation (distributed tracing)

**Why this matters:**
- Grafana shows: "GitHub call at 14:23:01, Slack call at 14:23:03 (2s later)"
- MCP Lens shows: "GitHub issue #123 triggered Slack message which created Jira ticket PROJ-456 - semantic causality chain with shared entities"

---

## 🎨 Design Principles

### 1. **Protocol-Semantic Focus**

MCP Lens widgets should analyze MCP protocol operations, not just display data:

❌ **Generic monitoring:**
```typescript
// Just counting operations
<div>Total calls: {count}</div>
```

✅ **Protocol-semantic analytics:**
```typescript
// Analyzing WHY operations fail
<div>
  Tool failures: 40%
  Root cause: Capability negotiation succeeded, but
  write_access permission denied at invocation

  Recommendation: Add permission validation during
  capability negotiation phase
</div>
```

### 2. **Visual Hierarchy**

Make insights immediately visible:

- **Most important** (top): Protocol health issues, recommendations
- **Supporting data** (middle): Capability breakdown, usage patterns
- **Raw metrics** (bottom): Operation counts, timing

### 3. **Actionable Recommendations**

Every insight should include:
- **What:** Issue detected
- **Why:** Root cause at protocol level
- **How to fix:** Concrete recommendation

Example:
```
⚠️ wasted-capability: prompts
├─ Issue: Prompts capability negotiated but never used
├─ Impact: 12% wasted initialization time
└─ Fix: Remove `prompts: true` from server advertisement
```

---

## 🏗️ Widget Architecture

### Factory Pattern (SPEC §3.1)

Every widget follows this structure:

```typescript
export default function createMyWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  // 1. Define Web Component class
  class MyWidget extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      this.render();
    }

    private render() {
      this.shadowRoot!.innerHTML = `
        <style>
          /* Shadow DOM styles */
        </style>
        <div>
          /* Widget content */
        </div>
      `;
    }
  }

  // 2. Register custom element
  if (!customElements.get('my-widget')) {
    customElements.define('my-widget', MyWidget);
  }

  // 3. Return factory object
  return {
    api: {
      async initialize() { /* Setup */ },
      async destroy() { /* Cleanup */ },
      async refresh() { /* Reload data */ }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'my-widget',
      displayName: 'My Widget',
      description: 'Widget description',
      capabilities: {
        tools: false,
        resources: false,
        prompts: false
      }
    }
  };
}
```

### Event Monitoring (SPEC §6)

Subscribe to MCP events to track protocol operations:

```typescript
// Monitor tool invocations
EventBus.on('mcp:tool:invoked', (data) => {
  // Analyze tool success patterns
});

EventBus.on('mcp:tool:error', (data) => {
  // Analyze failure reasons at protocol level
});

// Monitor capability changes
EventBus.on('mcp:server:capabilities-changed', (data) => {
  // Detect capability negotiation issues
});
```

---

## 📏 SPEC Compliance Checklist

When building widgets, ensure compliance with [SPEC.md](../SPEC.md):

### Required (SPEC §3-5)

- [ ] **Factory function** exports default with correct signature
- [ ] **Returns WidgetFactory** with `api` and `widget` properties
- [ ] **Lifecycle methods** implement `initialize()`, `destroy()`, `refresh()`
- [ ] **Web Component** extends HTMLElement with Shadow DOM
- [ ] **Custom element** registered with hyphenated name
- [ ] **Protocol version** declared in metadata
- [ ] **Dependencies** used correctly (EventBus, MCPBridge, Configuration)

### Security (SPEC §7)

- [ ] **No eval()** or Function() constructors
- [ ] **Sanitize input** before rendering
- [ ] **Use textContent** for untrusted content (not innerHTML)
- [ ] **MCPBridge only** for MCP operations (no direct server access)
- [ ] **Permissions declared** in metadata if needed

### Performance (SPEC §8)

- [ ] **Bundle size** < 500KB gzipped
- [ ] **Initial render** < 500ms
- [ ] **Re-renders** < 100ms
- [ ] **Cleanup listeners** in destroy()
- [ ] **Virtualize** long lists (>100 items)

---

## 🧪 Testing Your Widget

### Unit Tests

Test widget lifecycle:

```typescript
import { test } from 'vitest';
import createMyWidget from './my-widget';

test('widget initializes correctly', async () => {
  const mockDeps = {
    EventBus: mockEventBus(),
    MCPBridge: mockBridge(),
    Configuration: mockConfig()
  };

  const widget = createMyWidget(mockDeps, mockServerInfo);

  await widget.api.initialize();

  // Verify initialization event emitted
  expect(mockDeps.EventBus.emit).toHaveBeenCalledWith(
    'mcp:widget:initialized',
    expect.objectContaining({ element: 'my-widget' })
  );
});
```

### Integration Tests

Test against real MCP servers (see [demos/](../demos/)):

```bash
cd demos
npm start  # Starts real MCP servers
# Test your widget against live servers
```

---

## 🚀 Publishing Your Widget

### 1. Package Structure

```
my-mcp-lens-widget/
├── package.json
├── src/
│   └── index.ts        # Widget factory
├── README.md
└── LICENSE
```

### 2. package.json

```json
{
  "name": "@myorg/mcp-lens-widget-github-analytics",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "keywords": ["mcp-lens", "mcp", "widget", "analytics"],
  "peerDependencies": {
    "@mcpl/core": "^1.0.0"
  }
}
```

### 3. Publish

```bash
npm publish --access public
```

---

## 💡 Best Practices

### 1. **Start with Protocol Questions**

Before building, ask:
- What protocol-level insight does this widget provide?
- How is this different from resource metrics (Grafana)?
- What actionable recommendations can it give?

### 2. **Use Real MCP Events**

Don't poll or guess - subscribe to actual MCP protocol events:

```typescript
// ❌ Polling
setInterval(() => checkServerStatus(), 1000);

// ✅ Event-driven
EventBus.on('mcp:server:disconnected', handleDisconnect);
```

### 3. **Make It Beautiful**

Good design makes insights clear:
- Use color to show health (green = good, yellow = warning, red = error)
- Group related information visually
- Make recommendations stand out
- Use icons/emoji for quick scanning

### 4. **Stay Protocol-Focused**

Remember MCP Lens's unique value:

| Layer | Example Insight |
|-------|----------------|
| Infrastructure (Grafana) | "Server took 500ms" |
| LLM Quality (Langfuse) | "Output was 85% accurate" |
| **Protocol-Semantic (MCP Lens)** | **"Tool failed because capability negotiation succeeded but write permission denied at invocation"** |

Your widget should provide protocol-semantic insights!

---

## 📚 Additional Resources

- **[SPEC.md](../SPEC.md)** - Complete protocol specification
- **[schema.ts](../schema.ts)** - TypeScript type definitions
- **[POSITIONING.md](../POSITIONING.md)** - Strategic differentiation vs. competitors
- **[demos/](../demos/)** - Working dashboard with real MCP servers
- **[MCP Documentation](https://modelcontextprotocol.io/)** - Learn about Model Context Protocol

---

## 🎯 Next Steps

1. **Start simple:** Copy `counter-widget.ts` and modify
2. **Add protocol analytics:** Use `capability-analyzer-widget.ts` as reference
3. **Test with demo:** Run `cd demo && npm start` to test against real servers
4. **Follow SPEC:** Check SPEC.md compliance before publishing
5. **Share your widget:** Publish to npm with `@mcpl-widget-*` naming

Happy building! 🚀
