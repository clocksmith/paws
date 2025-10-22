# MCP Widget Protocol (Simplified)

**Version**: 1.0.0
**Status**: Draft
**Last Updated**: October 2025

## Table of Contents

1. [Overview](#overview)
2. [Core Concepts](#core-concepts)
3. [Widget Interface](#widget-interface)
4. [Security Model](#security-model)
5. [Example Implementation](#example-implementation)
6. [Integration with mcp-ui](#integration-with-mcp-ui)

---

## Overview

### What is MWP?

MCP Widget Protocol (MWP) provides a standardized way to build secure, observable user interfaces for Model Context Protocol (MCP) servers. It extends the MCP ecosystem with:

- **Security**: User confirmation before tool execution
- **Observability**: Event-driven architecture for auditing
- **Compatibility**: Works alongside existing solutions like mcp-ui
- **Type Safety**: Full TypeScript integration

### Why MWP?

MCP servers expose powerful tools (filesystem access, GitHub operations, database queries), but most implementations lack:

1. **Visual confirmation** - Users can't see what tools will be executed
2. **Audit trails** - No visibility into what happened
3. **Security boundaries** - Direct tool execution without confirmation
4. **Consistent UX** - Every MCP server needs custom UI

MWP solves these problems with a lightweight protocol that enhances existing solutions rather than replacing them.

### How It Works

```
User Interaction → Widget → MCPBridge → EventBus → User Confirmation → MCP Server
                     ↓                        ↓
               (Web Component)          (Audit Log)
```

1. User interacts with widget (Web Component)
2. Widget requests tool execution via MCPBridge
3. MCPBridge emits event for user confirmation
4. Host application shows confirmation dialog
5. On approval, tool executes and result returns
6. All events logged for auditing

---

## Core Concepts

### Three Building Blocks

**1. Widget Factory**
A function that creates and configures a widget instance.

**2. MCPBridge**
Centralized interface for MCP operations (tools, resources, prompts) with built-in event emission.

**3. EventBus**
Pub/sub system for inter-widget communication and security events.

### Architecture Diagram

```
┌─────────────────────────────────────────┐
│         Host Application                │
│  (Claude Desktop, VS Code, Browser)     │
└────────────┬────────────────────────────┘
             │
             ├─► EventBus (global)
             │   • mcp:tool:invoke-requested
             │   • mcp:tool:invoked
             │   • mcp:tool:error
             │
             ├─► MCPBridge (per server)
             │   • callTool()
             │   • readResource()
             │   • getPrompt()
             │
             └─► Widget Instances
                 • GitHub Widget
                 • Filesystem Widget
                 • Custom Widgets
```

---

## Widget Interface

### Widget Factory Signature

```typescript
import type { Dependencies, MCPServerInfo, WidgetFactory } from '@mwp/core';

export default function createWidget(
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element
  if (!customElements.get('my-widget')) {
    customElements.define('my-widget', MyWidget);
  }

  return {
    api: {
      async initialize(): Promise<void> {
        // Setup logic
      },
      async destroy(): Promise<void> {
        // Cleanup logic
      },
      async refresh(): Promise<void> {
        // Reload data
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'my-widget',
      displayName: 'My Widget',
      description: 'Widget for My MCP Server',
      capabilities: serverInfo.capabilities
    }
  };
}
```

### Required Types

```typescript
// Dependencies injected by host
interface Dependencies {
  EventBus: EventBusConstructor;
  MCPBridge: MCPBridgeConstructor;
  Configuration: Configuration;
}

// MCP server information
interface MCPServerInfo {
  serverName: string;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
  tools?: ToolDefinition[];
  resources?: Resource[];
  prompts?: Prompt[];
}

// Widget factory return type
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
    description: string;
    capabilities: MCPServerInfo['capabilities'];
  };
}
```

### Web Component Implementation

Your widget must be a Web Component (Custom Element):

```typescript
export class MyWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private config!: Configuration;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  // Called by host after construction
  setDependencies(
    eventBus: EventBus,
    bridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
    this.config = config;
  }

  // Called by host to set server metadata
  setServerInfo(info: MCPServerInfo): void {
    // Store server info
  }

  // Standard Web Component lifecycle
  connectedCallback(): void {
    this.render();
  }

  disconnectedCallback(): void {
    // Cleanup listeners
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        /* Widget styles */
      </style>
      <div class="widget">
        <h3>My Widget</h3>
        <button id="action">Execute Tool</button>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners(): void {
    const button = this.shadowRoot?.querySelector('#action');
    button?.addEventListener('click', () => {
      this.executeTool();
    });
  }

  private async executeTool(): Promise<void> {
    try {
      const result = await this.bridge.callTool(
        'my-server',
        'my_tool',
        { param: 'value' }
      );
      console.log('Tool result:', result);
    } catch (error) {
      console.error('Tool execution failed:', error);
    }
  }
}
```

---

## Security Model

### User Confirmation Flow

**Core Principle**: Users MUST explicitly approve any tool execution that can modify state or access sensitive data.

### Event Flow

```typescript
// 1. Widget requests tool execution
await bridge.callTool('github-server', 'create_issue', {
  repo: 'myorg/myrepo',
  title: 'Bug report',
  body: 'Description...'
});

// 2. MCPBridge emits event (internal)
eventBus.emit('mcp:tool:invoke-requested', {
  serverName: 'github-server',
  toolName: 'create_issue',
  arguments: { repo: 'myorg/myrepo', title: 'Bug report', body: '...' }
});

// 3. Host application shows confirmation dialog
// "GitHub Server wants to create_issue with arguments: ..."
// [Cancel] [Approve]

// 4a. On approval: Tool executes
eventBus.emit('mcp:tool:invoked', {
  serverName: 'github-server',
  toolName: 'create_issue',
  result: { issueNumber: 42, url: '...' }
});

// 4b. On rejection: Error thrown
eventBus.emit('mcp:tool:error', {
  serverName: 'github-server',
  toolName: 'create_issue',
  error: { code: 'USER_REJECTED', message: 'User cancelled operation' }
});
```

### Security Events

Widgets can listen for security events:

```typescript
eventBus.on('mcp:tool:invoked', (payload) => {
  if (payload.serverName === 'my-server') {
    // Update UI with successful execution
    console.log(`Tool ${payload.toolName} succeeded`);
  }
});

eventBus.on('mcp:tool:error', (payload) => {
  if (payload.serverName === 'my-server') {
    // Show error in UI
    console.error(`Tool ${payload.toolName} failed:`, payload.error);
  }
});
```

### Read vs Write Operations

**Read operations** (no confirmation needed):
- `bridge.listTools()`
- `bridge.listResources()`
- `bridge.readResource()`
- `bridge.listPrompts()`
- `bridge.getPrompt()`

**Write operations** (confirmation required):
- `bridge.callTool()` - ALL tool invocations

### Content Security Policy

Widgets run in Shadow DOM with restricted privileges:

```html
<meta http-equiv="Content-Security-Policy"
      content="default-src 'self';
               script-src 'self' 'unsafe-inline';
               style-src 'self' 'unsafe-inline';
               connect-src https:;">
```

Widgets MUST NOT:
- Access parent document DOM
- Make arbitrary network requests
- Execute eval() or Function()
- Access localStorage/cookies directly (use Configuration API)

---

## Example Implementation

### Complete GitHub Widget (Simplified)

```typescript
import type { Dependencies, MCPServerInfo, WidgetFactory } from '@mwp/core';

export default function createGitHubWidget(
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  if (!customElements.get('github-widget')) {
    customElements.define('github-widget', GitHubWidget);
  }

  return {
    api: {
      async initialize() {
        const widget = document.querySelector('github-widget') as GitHubWidget;
        if (widget) {
          widget.setDependencies(
            new EventBus(),
            new MCPBridge({ serverName: serverInfo.serverName }),
            Configuration
          );
          widget.setServerInfo(serverInfo);
          await widget.initialize();
        }
      },
      async destroy() {
        const widget = document.querySelector('github-widget');
        if (widget) await (widget as any).destroy();
      },
      async refresh() {
        const widget = document.querySelector('github-widget');
        if (widget) await (widget as any).refresh();
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'github-widget',
      displayName: 'GitHub',
      description: 'Manage GitHub repositories, issues, and pull requests',
      capabilities: serverInfo.capabilities
    }
  };
}

class GitHubWidget extends HTMLElement {
  private eventBus!: EventBus;
  private bridge!: MCPBridge;
  private repositories: any[] = [];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setDependencies(eventBus: any, bridge: any, config: any): void {
    this.eventBus = eventBus;
    this.bridge = bridge;
  }

  setServerInfo(info: MCPServerInfo): void {
    // Store server info
  }

  async initialize(): Promise<void> {
    await this.loadRepositories();
    this.render();
  }

  async destroy(): Promise<void> {
    if (this.shadowRoot) this.shadowRoot.innerHTML = '';
  }

  async refresh(): Promise<void> {
    await this.loadRepositories();
    this.render();
  }

  private async loadRepositories(): Promise<void> {
    try {
      const result = await this.bridge.callTool(
        'github',
        'list_repositories',
        {}
      );
      this.repositories = JSON.parse(result.content);
    } catch (error) {
      console.error('Failed to load repositories:', error);
    }
  }

  private async createIssue(repo: string, title: string, body: string): Promise<void> {
    try {
      // This triggers user confirmation dialog
      await this.bridge.callTool('github', 'create_issue', {
        repo,
        title,
        body
      });
      alert('Issue created successfully!');
    } catch (error) {
      alert('Failed to create issue: ' + error);
    }
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; padding: 16px; }
        .repo { border: 1px solid #ccc; padding: 8px; margin: 8px 0; }
        button { padding: 8px 16px; cursor: pointer; }
      </style>
      <div class="github-widget">
        <h2>GitHub Repositories</h2>
        <div id="repos"></div>
        <h3>Create Issue</h3>
        <form id="issue-form">
          <input type="text" id="repo" placeholder="owner/repo" required />
          <input type="text" id="title" placeholder="Issue title" required />
          <textarea id="body" placeholder="Description"></textarea>
          <button type="submit">Create Issue</button>
        </form>
      </div>
    `;

    // Render repositories
    const reposDiv = this.shadowRoot.querySelector('#repos');
    if (reposDiv) {
      reposDiv.innerHTML = this.repositories
        .map(repo => `<div class="repo">${repo.full_name}</div>`)
        .join('');
    }

    // Attach form handler
    const form = this.shadowRoot.querySelector('#issue-form');
    form?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const repo = (this.shadowRoot?.querySelector('#repo') as HTMLInputElement).value;
      const title = (this.shadowRoot?.querySelector('#title') as HTMLInputElement).value;
      const body = (this.shadowRoot?.querySelector('#body') as HTMLTextAreaElement).value;
      await this.createIssue(repo, title, body);
    });
  }
}
```

### Key Features Demonstrated

1. **Type-safe API**: Full TypeScript integration
2. **Security**: `create_issue` triggers user confirmation
3. **Observability**: All operations go through EventBus
4. **Encapsulation**: Shadow DOM prevents style conflicts
5. **Lifecycle**: Proper initialize/destroy/refresh pattern

---

## Integration with mcp-ui

### Compatibility Adapter

MWP widgets can render in mcp-ui's iframe model using an adapter:

```typescript
// packages/mcp-ui-adapter/src/index.ts
export function adaptMWPForMcpUI(widgetFactory: WidgetFactory): string {
  // Generate standalone HTML that mcp-ui can load in iframe
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <script type="module">
          import createWidget from '${widgetFactory.widget.element}';

          // Mock dependencies for mcp-ui environment
          const eventBus = window.parent.mcpUIEventBus;
          const bridge = window.parent.mcpUIBridge;

          const widget = createWidget({ EventBus: eventBus, MCPBridge: bridge }, {
            serverName: window.parent.serverName,
            capabilities: {}
          });

          document.body.appendChild(document.createElement(widget.widget.element));
          await widget.api.initialize();
        </script>
      </head>
      <body></body>
    </html>
  `;
}
```

### Feature Comparison

| Feature | mcp-ui (iframe) | MWP (Web Components) |
|---------|----------------|----------------------|
| Isolation | ✅ iframe sandbox | ✅ Shadow DOM |
| Styling | ❌ No theming | ✅ CSS custom properties |
| Security | ❌ No confirmation | ✅ User confirmation |
| Events | ❌ postMessage only | ✅ EventBus system |
| Type Safety | ❌ Plain HTML | ✅ TypeScript |
| Compatibility | ✅ Works everywhere | ✅ Modern browsers |

### Migration Path

**Phase 1: mcp-ui Enhancement**
- Contribute security confirmation UI to mcp-ui
- Add EventBus layer to mcp-ui's backend
- Maintain backward compatibility

**Phase 2: Optional MWP Widgets**
- Host can choose: iframe HTML OR MWP Web Component
- MWP adapter translates to iframe when needed
- Gradual migration, not forced replacement

**Phase 3: Ecosystem Convergence**
- mcp-ui adopts MWP patterns (if beneficial)
- MWP simplifies to match mcp-ui's simplicity
- Single community, multiple implementation options

---

## Getting Started

### 1. Install Dependencies

```bash
npm install @mwp/core @mwp/bridge @mwp/eventbus
```

### 2. Create Widget

```bash
npx create-mwp-widget my-widget
cd my-widget
npm install
npm run build
```

### 3. Test Widget

```bash
npm run demo
```

Opens dashboard with your widget loaded against a mock MCP server.

### 4. Publish Widget

```bash
npm publish
```

### 5. Use in Application

```typescript
import createMyWidget from 'my-widget';
import { EventBus } from '@mwp/eventbus';
import { MCPBridge } from '@mwp/bridge';

const widget = createMyWidget(
  { EventBus, MCPBridge, Configuration },
  { serverName: 'my-server', capabilities: { tools: true } }
);

document.body.appendChild(document.createElement(widget.widget.element));
await widget.api.initialize();
```

---

## Best Practices

### Performance

- **Bundle size**: Keep widgets <500KB gzipped
- **Initial render**: Target <500ms first paint
- **Memory**: Avoid memory leaks, cleanup listeners in destroy()

### Accessibility

- Use semantic HTML elements
- Provide ARIA labels for interactive elements
- Ensure keyboard navigation works
- Test with screen readers

### Error Handling

- Always catch errors from bridge.callTool()
- Show user-friendly error messages
- Log errors for debugging
- Gracefully degrade if tools unavailable

### Testing

```typescript
import { describe, it, expect } from 'vitest';
import createMyWidget from './index';

describe('MyWidget', () => {
  it('should initialize successfully', async () => {
    const widget = createMyWidget(mockDependencies, mockServerInfo);
    await widget.api.initialize();
    expect(widget.widget.element).toBe('my-widget');
  });
});
```

---

## FAQ

### Why not just use mcp-ui?

We love mcp-ui! MWP adds:
- Type safety for widget authors
- User confirmation for security
- Event system for observability
- Optional enhancement, not replacement

### Do I need to use Web Components?

Yes, for shadow DOM isolation. But we provide helpers to minimize boilerplate.

### Can MWP widgets run in Claude Desktop?

With a browser extension that injects MWP runtime, yes. See `@mwp/extension`.

### How does this relate to Anthropic's MCP spec?

MWP is a client-side visualization layer. It doesn't change MCP protocol at all - just provides standardized UI patterns on top.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Testing guidelines
- Pull request process

Join the community:
- GitHub Discussions: https://github.com/[org]/mwp/discussions
- Discord: https://discord.gg/mwp

---

## License

MIT License - see [LICENSE](../LICENSE)

---

**MWP = Security + Observability for MCP**

Build widgets that users can trust.
