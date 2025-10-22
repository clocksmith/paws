# Getting Started with MCP-WP

Complete guide to building dashboard applications with MCP widgets.

## Quick Start (5 minutes)

### 1. Installation

```bash
# Clone repository
git clone https://github.com/your-org/mcp-wp.git
cd mcp-wp

# Install dependencies
pnpm install

# Build all packages
pnpm build
```

### 2. Run Example Dashboard

```bash
# Navigate to examples
cd packages/examples/dashboards

# Set environment variables
export GITHUB_TOKEN=ghp_your_token_here
export BRAVE_API_KEY=your_api_key_here

# Start development server
pnpm dev

# Open http://localhost:5173/multi-widget.html
```

### 3. Add Your First Widget

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createGitHubWidget from '@mcp-wp/widget-github';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN },
  },
});
```

That's it! You now have a working MCP widget dashboard.

## Core Concepts

### 1. Dashboard

The **Dashboard** is the host application that manages widgets:

```typescript
import { Dashboard } from '@mcp-wp/dashboard';

const dashboard = new Dashboard({
  container: HTMLElement,      // Where to render
  theme: ThemeConfiguration,   // Colors and styling
  layout: LayoutConfiguration, // Grid/flex layout
  settings: DashboardSettings, // Monitoring, limits
});
```

**Key Features:**
- Widget lifecycle management
- Theme system
- Layout engine (grid, flex, custom)
- Event bus
- Performance monitoring

### 2. Widgets

**Widgets** are Web Components that interact with MCP servers:

```typescript
import createGitHubWidget from '@mcp-wp/widget-github';

const widgetId = await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: ServerConfiguration,
  layout: WidgetLayout,
});
```

**Available Widgets:**
- `@mcp-wp/widget-github` - GitHub repositories, issues, PRs
- `@mcp-wp/widget-playwright` - Browser automation
- `@mcp-wp/widget-filesystem` - File browsing and editing
- `@mcp-wp/widget-brave` - Web search

### 3. MCP Servers

**MCP Servers** provide tools, resources, and prompts:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_..."
      }
    }
  }
}
```

### 4. Event System

**Events** enable communication between widgets and dashboard:

```typescript
// Listen for events
dashboard.events.on('widget:initialized', (data) => {
  console.log('Widget ready:', data.widgetId);
});

// Emit custom events
dashboard.events.emit('custom:event', { data: 'value' });
```

## Step-by-Step Tutorial

### Tutorial 1: Basic Dashboard

Create a simple dashboard with one widget.

**1. Create HTML file:**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My Dashboard</title>
</head>
<body>
  <div id="app"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

**2. Create `main.js`:**

```javascript
import { Dashboard } from '@mcp-wp/dashboard';
import createGitHubWidget from '@mcp-wp/widget-github';

const dashboard = new Dashboard({
  container: document.getElementById('app'),
});

await dashboard.initialize();

await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: 'ghp_...',
    },
  },
});
```

**3. Run:**

```bash
npx vite
```

### Tutorial 2: Multi-Widget Dashboard

Add multiple widgets with different layouts.

```javascript
const dashboard = new Dashboard({
  container: document.getElementById('app'),
  layout: {
    type: 'grid',
    columns: 2,
    gap: 16,
  },
});

await dashboard.initialize();

// Add GitHub widget (column 1, row 1)
await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: { /* ... */ },
  layout: { column: 1, row: 1, width: 1, height: 2 },
});

// Add Brave Search widget (column 2, row 1)
await dashboard.addWidget({
  factory: createBraveWidget,
  serverName: 'brave-search',
  config: { /* ... */ },
  layout: { column: 2, row: 1 },
});

// Add Filesystem widget (column 2, row 2)
await dashboard.addWidget({
  factory: createFilesystemWidget,
  serverName: 'filesystem',
  config: { /* ... */ },
  layout: { column: 2, row: 2 },
});
```

### Tutorial 3: Theme Customization

Create a custom theme.

```javascript
const dashboard = new Dashboard({
  container: document.getElementById('app'),
  theme: {
    mode: 'dark',
    primary: '#58a6ff',
    secondary: '#8b949e',
    surface: '#0d1117',
    background: '#010409',
    text: '#c9d1d9',
    border: '#30363d',
    fontFamily: '"Inter", sans-serif',
    fontSize: 14,
    borderRadius: 8,
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
  },
});

// Toggle theme dynamically
function toggleTheme() {
  const isDark = dashboard.theme.mode === 'dark';
  dashboard.setTheme({
    mode: isDark ? 'light' : 'dark',
    primary: isDark ? '#0969da' : '#58a6ff',
    surface: isDark ? '#ffffff' : '#0d1117',
    text: isDark ? '#24292f' : '#c9d1d9',
  });
}
```

### Tutorial 4: Event Handling

Handle widget events.

```javascript
// Dashboard events
dashboard.events.on('dashboard:initialized', (data) => {
  console.log('Dashboard ready');
});

dashboard.events.on('dashboard:widget:added', (data) => {
  console.log('Widget added:', data.displayName);
});

dashboard.events.on('dashboard:error', (data) => {
  console.error('Error:', data.error);
});

// Widget-specific events
dashboard.events.on('github:repo:selected', (data) => {
  console.log('Repository:', data.repo);
});

dashboard.events.on('brave:search:complete', (data) => {
  console.log('Search results:', data.resultCount);
});

dashboard.events.on('filesystem:file:saved', (data) => {
  console.log('File saved:', data.path);
});

dashboard.events.on('playwright:screenshot:captured', (data) => {
  console.log('Screenshot:', data.name);
});
```

### Tutorial 5: Performance Monitoring

Monitor dashboard performance.

```javascript
const dashboard = new Dashboard({
  container: document.getElementById('app'),
  settings: {
    monitoring: true,  // Enable monitoring
  },
});

await dashboard.initialize();

// Get metrics
setInterval(() => {
  const metrics = dashboard.getMetrics();

  console.log('Widgets:', metrics.dashboard.widgetCount);
  console.log('Memory:', metrics.dashboard.totalMemory, 'bytes');
  console.log('DOM Nodes:', metrics.dashboard.totalDomNodes);
  console.log('Uptime:', metrics.dashboard.uptime, 'ms');

  // Per-widget metrics
  metrics.widgets.forEach(widget => {
    console.log(`${widget.displayName}:`, {
      status: widget.status.status,
      memory: widget.resourceUsage.memory,
      renderTime: widget.resourceUsage.renderTime,
    });
  });
}, 10000);
```

## API Reference

### Dashboard

#### Constructor

```typescript
new Dashboard(options: DashboardOptions)
```

#### Methods

- `initialize(): Promise<void>` - Initialize dashboard
- `addWidget(options): Promise<string>` - Add widget, returns widgetId
- `removeWidget(widgetId): Promise<void>` - Remove widget
- `refreshWidget(widgetId): Promise<void>` - Refresh specific widget
- `refreshAll(): Promise<void>` - Refresh all widgets
- `setTheme(theme): void` - Update theme
- `setLayout(layout): void` - Update layout
- `getMetrics(): DashboardMetrics` - Get performance metrics
- `destroy(): Promise<void>` - Cleanup and destroy

#### Properties

- `theme: ThemeConfiguration` - Current theme
- `layout: LayoutConfiguration` - Current layout
- `events: EventBus` - Event bus instance

### Widgets

Each widget exports a factory function:

```typescript
const createWidget: WidgetFactoryFunction = (
  dependencies: Dependencies,
  serverInfo: MCPServerInfo
) => WidgetFactory;
```

**Widget Factory Returns:**

```typescript
{
  api: {
    initialize(): Promise<void>;
    destroy(): Promise<void>;
    refresh(): Promise<void>;
    getStatus(): WidgetStatus;
    getResourceUsage(): ResourceUsage;
  },
  widget: {
    protocolVersion: string;
    element: string;
    displayName: string;
    description: string;
    capabilities: Capabilities;
    permissions: Permissions;
  }
}
```

## Configuration

### Environment Variables

Create `.env` file:

```env
# GitHub
GITHUB_TOKEN=ghp_your_token_here

# Brave Search
BRAVE_API_KEY=your_api_key_here

# Filesystem
FILESYSTEM_ROOT=/path/to/allowed/directory
```

### MCP Server Configuration

Create `.mcp-servers.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "${BRAVE_API_KEY}"
      }
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "${FILESYSTEM_ROOT}"
      ]
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

## Best Practices

### 1. Widget Lifecycle

Always initialize and cleanup:

```typescript
// Initialize
await dashboard.initialize();
await dashboard.addWidget({ /* ... */ });

// Cleanup on page unload
window.addEventListener('beforeunload', async () => {
  await dashboard.destroy();
});
```

### 2. Error Handling

Handle errors gracefully:

```typescript
try {
  await dashboard.addWidget({ /* ... */ });
} catch (error) {
  console.error('Failed to add widget:', error);
  // Show user notification
}

dashboard.events.on('dashboard:error', (data) => {
  // Log error
  console.error(data.error);
  // Show user notification
});
```

### 3. Performance

Optimize for performance:

```typescript
// Limit widget count
const dashboard = new Dashboard({
  settings: { maxWidgets: 6 },
});

// Lazy load widgets
const widgets = {
  github: () => import('@mcp-wp/widget-github'),
};

const module = await widgets.github();
await dashboard.addWidget({ factory: module.default });

// Disable auto-refresh if not needed
const dashboard = new Dashboard({
  settings: { autoRefresh: 0 },
});
```

### 4. Responsive Design

Support all screen sizes:

```typescript
function updateLayout() {
  const width = window.innerWidth;

  if (width < 768) {
    dashboard.setLayout({ type: 'flex', direction: 'column' });
  } else if (width < 1200) {
    dashboard.setLayout({ type: 'grid', columns: 2 });
  } else {
    dashboard.setLayout({ type: 'grid', columns: 3 });
  }
}

window.addEventListener('resize', updateLayout);
updateLayout();
```

## Troubleshooting

### Widgets not loading

1. Check MCP server configuration
2. Verify API keys/tokens in environment
3. Check browser console for errors
4. Ensure all packages are built: `pnpm build`

### Performance issues

1. Reduce widget count
2. Disable auto-refresh
3. Enable monitoring to identify bottlenecks
4. Check network tab for slow requests

### Styling issues

1. Check CSS variables in theme
2. Use browser devtools inspector
3. Verify widget CSS encapsulation (Shadow DOM)

## Next Steps

- [Examples](./packages/examples/dashboards/README.md) - Working examples
- [Widget Development](./WIDGET-ROADMAP.md) - Create custom widgets
- [Architecture](./ARCHITECTURE.md) - System design
- [Protocol Specification](./specification/MWP.md) - Complete MCP Widget Protocol spec
- [Contributing](./CONTRIBUTING.md) - Development guidelines

## Support

- Issues: https://github.com/your-org/mcp-wp/issues
- Discussions: https://github.com/your-org/mcp-wp/discussions
- Documentation: https://docs.mcp-wp.dev
