# @mcp-wp/dashboard

**Reference MCP Widget Dashboard Implementation**

A production-ready widget host for loading and displaying MCP widgets. This package provides a complete dashboard implementation that demonstrates best practices for widget orchestration, layout management, and user interaction.

## Features

- 🎨 **Flexible Layouts** - Grid, flex, and custom layouts
- 🔄 **Widget Lifecycle** - Initialize, refresh, destroy
- 📊 **Resource Monitoring** - Memory, performance, health checks
- 🎛️ **Configuration UI** - Dynamic widget configuration
- 🌓 **Theme Support** - Light/dark mode with custom themes
- ♿ **Accessibility** - WCAG 2.1 AA compliant
- 📱 **Responsive** - Mobile, tablet, desktop layouts
- 🔌 **Hot Reload** - Add/remove widgets dynamically

## Installation

```bash
pnpm add @mcp-wp/dashboard
```

## Quick Start

### HTML

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MCP Dashboard</title>
  <link rel="stylesheet" href="node_modules/@mcp-wp/dashboard/dist/styles.css">
</head>
<body>
  <div id="dashboard"></div>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

### JavaScript

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createGitHubWidget from '@mcp-wp/widget-github';

// Create dashboard instance
const dashboard = new Dashboard({
  container: document.getElementById('dashboard')!,
  theme: {
    mode: 'light',
    primary: '#0969da',
    surface: '#ffffff',
    text: '#24292f',
  },
  layout: {
    type: 'grid',
    columns: 3,
    gap: 16,
  },
});

// Initialize dashboard
await dashboard.initialize();

// Add widget
await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-github'],
    env: {
      GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
    },
  },
  layout: {
    column: 1,
    row: 1,
    width: 2,
    height: 2,
  },
});
```

## API Reference

### Dashboard Class

#### Constructor

```typescript
constructor(options: DashboardOptions)
```

**DashboardOptions:**

```typescript
interface DashboardOptions {
  // Container element
  container: HTMLElement;

  // Theme configuration
  theme?: ThemeConfiguration;

  // Layout configuration
  layout?: LayoutConfiguration;

  // Global settings
  settings?: {
    // Auto-refresh interval (ms)
    autoRefresh?: number;

    // Enable performance monitoring
    monitoring?: boolean;

    // Enable widget devtools
    devtools?: boolean;

    // Maximum widgets
    maxWidgets?: number;
  };
}
```

#### Methods

##### `initialize(): Promise<void>`

Initialize the dashboard and set up event listeners.

```typescript
await dashboard.initialize();
```

##### `addWidget(options: AddWidgetOptions): Promise<string>`

Add a widget to the dashboard.

```typescript
const widgetId = await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: serverConfig,
  layout: { column: 1, row: 1 },
});
```

**AddWidgetOptions:**

```typescript
interface AddWidgetOptions {
  // Widget factory function
  factory: WidgetFactoryFunction;

  // MCP server name
  serverName: string;

  // MCP server configuration
  config: ServerConfiguration;

  // Widget layout
  layout?: WidgetLayout;

  // Widget-specific config
  widgetConfig?: Record<string, unknown>;
}
```

##### `removeWidget(widgetId: string): Promise<void>`

Remove a widget from the dashboard.

```typescript
await dashboard.removeWidget('widget-123');
```

##### `refreshWidget(widgetId: string): Promise<void>`

Refresh a specific widget.

```typescript
await dashboard.refreshWidget('widget-123');
```

##### `refreshAll(): Promise<void>`

Refresh all widgets.

```typescript
await dashboard.refreshAll();
```

##### `getWidgetStatus(widgetId: string): WidgetStatus`

Get the status of a widget.

```typescript
const status = dashboard.getWidgetStatus('widget-123');
console.log(status.status); // 'healthy' | 'initializing' | 'error'
```

##### `setTheme(theme: Partial<ThemeConfiguration>): void`

Update the dashboard theme.

```typescript
dashboard.setTheme({
  mode: 'dark',
  primary: '#58a6ff',
  surface: '#0d1117',
});
```

##### `setLayout(layout: LayoutConfiguration): void`

Update the dashboard layout.

```typescript
dashboard.setLayout({
  type: 'flex',
  direction: 'column',
  gap: 24,
});
```

##### `destroy(): Promise<void>`

Destroy the dashboard and clean up resources.

```typescript
await dashboard.destroy();
```

## Layout System

### Grid Layout

```typescript
dashboard.setLayout({
  type: 'grid',
  columns: 3,
  rows: 'auto',
  gap: 16,
  columnTemplate: '1fr 1fr 1fr',
  rowTemplate: 'auto',
});

// Widget positions
await dashboard.addWidget({
  // ...
  layout: {
    column: 1,      // Grid column (1-indexed)
    row: 1,         // Grid row (1-indexed)
    width: 2,       // Span 2 columns
    height: 1,      // Span 1 row
  },
});
```

### Flex Layout

```typescript
dashboard.setLayout({
  type: 'flex',
  direction: 'row',
  wrap: true,
  gap: 16,
  alignItems: 'stretch',
  justifyContent: 'flex-start',
});

// Widget sizing
await dashboard.addWidget({
  // ...
  layout: {
    flex: '1 1 300px',  // Flex-grow, flex-shrink, flex-basis
    minWidth: 200,
    maxWidth: 600,
  },
});
```

### Custom Layout

```typescript
dashboard.setLayout({
  type: 'custom',
  customStyles: `
    .dashboard-container {
      display: flex;
      flex-direction: column;
    }
    .widget-slot {
      margin-bottom: 16px;
    }
  `,
});
```

## Theme System

### Built-in Themes

```typescript
import { Dashboard, themes } from '@mcp-wp/dashboard';

const dashboard = new Dashboard({
  container,
  theme: themes.github,  // 'github' | 'vscode' | 'notion' | 'linear'
});
```

### Custom Theme

```typescript
const dashboard = new Dashboard({
  container,
  theme: {
    mode: 'dark',
    primary: '#58a6ff',
    secondary: '#8b949e',
    surface: '#0d1117',
    background: '#010409',
    text: '#c9d1d9',
    border: '#30363d',
    error: '#f85149',
    warning: '#d29922',
    success: '#3fb950',
    info: '#58a6ff',

    // Typography
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    fontSize: 14,

    // Spacing
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },

    // Border radius
    borderRadius: 6,

    // Shadows
    shadow: '0 1px 3px rgba(0, 0, 0, 0.12)',
  },
});
```

### Dynamic Theme Updates

```typescript
// Toggle dark mode
dashboard.setTheme({
  mode: dashboard.theme.mode === 'light' ? 'dark' : 'light',
});

// Update specific colors
dashboard.setTheme({
  primary: '#ff6b6b',
  secondary: '#4ecdc4',
});
```

## Event System

The dashboard emits events through the EventBus for monitoring and debugging.

### Dashboard Events

```typescript
// Dashboard initialized
eventBus.on('dashboard:initialized', (data) => {
  console.log('Dashboard ready');
});

// Widget added
eventBus.on('dashboard:widget:added', (data) => {
  console.log(`Widget ${data.widgetId} added`);
});

// Widget removed
eventBus.on('dashboard:widget:removed', (data) => {
  console.log(`Widget ${data.widgetId} removed`);
});

// Layout changed
eventBus.on('dashboard:layout:changed', (data) => {
  console.log('Layout updated:', data.layout);
});

// Theme changed
eventBus.on('dashboard:theme:changed', (data) => {
  console.log('Theme updated:', data.theme);
});

// Error
eventBus.on('dashboard:error', (data) => {
  console.error('Dashboard error:', data.error);
});
```

## Performance Monitoring

### Enable Monitoring

```typescript
const dashboard = new Dashboard({
  container,
  settings: {
    monitoring: true,
  },
});

// Get performance metrics
const metrics = dashboard.getMetrics();
console.log(metrics);
```

**Metrics Output:**

```typescript
{
  widgets: [
    {
      widgetId: 'widget-123',
      status: 'healthy',
      resourceUsage: {
        memory: 1024000,      // bytes
        renderTime: 45,       // ms
        domNodes: 256,
      },
      lastUpdate: new Date(),
    },
  ],
  dashboard: {
    totalMemory: 5120000,
    totalDomNodes: 1024,
    widgetCount: 4,
    uptime: 3600000,        // ms
  },
}
```

## Devtools

Enable developer tools for debugging widgets.

```typescript
const dashboard = new Dashboard({
  container,
  settings: {
    devtools: true,
  },
});
```

**Features:**
- Widget inspector
- Event log
- Performance profiler
- Network activity
- State viewer

## Examples

### Multi-Widget Dashboard

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createGitHubWidget from '@mcp-wp/widget-github';
import createFilesystemWidget from '@mcp-wp/widget-filesystem';
import createBraveWidget from '@mcp-wp/widget-brave';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
  theme: themes.github,
  layout: { type: 'grid', columns: 2, gap: 16 },
});

await dashboard.initialize();

// GitHub widget
await dashboard.addWidget({
  factory: createGitHubWidget,
  serverName: 'github',
  config: { /* ... */ },
  layout: { column: 1, row: 1, width: 1, height: 2 },
});

// Filesystem widget
await dashboard.addWidget({
  factory: createFilesystemWidget,
  serverName: 'filesystem',
  config: { /* ... */ },
  layout: { column: 2, row: 1 },
});

// Brave search widget
await dashboard.addWidget({
  factory: createBraveWidget,
  serverName: 'brave',
  config: { /* ... */ },
  layout: { column: 2, row: 2 },
});
```

### Auto-Refresh Dashboard

```typescript
const dashboard = new Dashboard({
  container,
  settings: {
    autoRefresh: 60000,  // Refresh every minute
  },
});

await dashboard.initialize();

// Auto-refresh will call refreshAll() every 60 seconds
```

### Responsive Dashboard

```typescript
const dashboard = new Dashboard({
  container,
  layout: {
    type: 'grid',
    columns: 3,
    gap: 16,
  },
});

// Update layout based on screen size
window.addEventListener('resize', () => {
  const width = window.innerWidth;

  if (width < 768) {
    dashboard.setLayout({ type: 'flex', direction: 'column' });
  } else if (width < 1200) {
    dashboard.setLayout({ type: 'grid', columns: 2 });
  } else {
    dashboard.setLayout({ type: 'grid', columns: 3 });
  }
});
```

## Best Practices

### 1. Widget Organization

```typescript
// Group related widgets
const dataWidgets = [
  { factory: createGitHubWidget, serverName: 'github' },
  { factory: createDatabaseWidget, serverName: 'postgres' },
];

for (const widget of dataWidgets) {
  await dashboard.addWidget(widget);
}
```

### 2. Error Handling

```typescript
try {
  await dashboard.addWidget({
    factory: createGitHubWidget,
    serverName: 'github',
    config: serverConfig,
  });
} catch (error) {
  console.error('Failed to add widget:', error);
  // Show user notification
}
```

### 3. Resource Cleanup

```typescript
// Clean up on navigation
window.addEventListener('beforeunload', async () => {
  await dashboard.destroy();
});
```

### 4. Performance Optimization

```typescript
// Lazy load widgets
const widgets = [
  { factory: () => import('@mcp-wp/widget-github'), serverName: 'github' },
  { factory: () => import('@mcp-wp/widget-brave'), serverName: 'brave' },
];

for (const { factory, serverName } of widgets) {
  const module = await factory();
  await dashboard.addWidget({
    factory: module.default,
    serverName,
    config: configs[serverName],
  });
}
```

## TypeScript

Full TypeScript support with complete type definitions.

```typescript
import type {
  Dashboard,
  DashboardOptions,
  AddWidgetOptions,
  LayoutConfiguration,
  ThemeConfiguration,
  WidgetMetrics,
} from '@mcp-wp/dashboard';
```

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires Web Components (Custom Elements, Shadow DOM) support.

## License

MIT

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for development setup and guidelines.

## Related Packages

- [@mcp-wp/core](../core) - Core types and utilities
- [@mcp-wp/bridge](../bridge) - MCP server bridge
- [@mcp-wp/eventbus](../eventbus) - Event system
- [@mcp-wp/widget-*](../widgets) - Widget implementations
