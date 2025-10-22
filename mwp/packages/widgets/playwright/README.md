# @mcp-wp/widget-playwright

**Playwright Browser Automation Widget**

A Web Component widget for the Playwright MCP server, providing browser automation capabilities including navigation, screenshots, console logs, and interactive testing.

## Features

- 🌐 **Browser Navigation** - Navigate to URLs, follow links
- 📸 **Screenshots** - Capture full page or element screenshots
- 🖱️ **Interactions** - Click, type, fill forms
- 📝 **Console Logs** - View browser console output
- 🔍 **Element Selection** - Query and interact with DOM elements
- 🎭 **Multi-Browser** - Chrome, Firefox, WebKit support
- 📊 **Session Management** - Track browser sessions
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mcp-wp/widget-playwright
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createPlaywrightWidget from '@mcp-wp/widget-playwright';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Playwright widget
await dashboard.addWidget({
  factory: createPlaywrightWidget,
  serverName: 'playwright',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-playwright'],
  },
});
```

### MCP Server Configuration

The widget works with the official Playwright MCP server:

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    }
  }
}
```

## Widget API

### Available Tools

The widget provides access to these Playwright MCP tools:

#### Navigation Tools

- **`playwright_navigate`** - Navigate to URL
  ```typescript
  { url: string }
  ```

- **`playwright_click`** - Click element
  ```typescript
  { selector: string }
  ```

#### Screenshot Tools

- **`playwright_screenshot`** - Take screenshot
  ```typescript
  {
    name: string,
    selector?: string,  // Optional: screenshot specific element
    width?: number,
    height?: number
  }
  ```

#### Interaction Tools

- **`playwright_fill`** - Fill form field
  ```typescript
  { selector: string, value: string }
  ```

- **`playwright_select`** - Select dropdown option
  ```typescript
  { selector: string, value: string }
  ```

- **`playwright_hover`** - Hover over element
  ```typescript
  { selector: string }
  ```

#### Evaluation Tools

- **`playwright_evaluate`** - Execute JavaScript in browser
  ```typescript
  { script: string }
  ```

## Widget Interface

### Navigation Panel

The widget provides a browser-like navigation interface:

```
┌─────────────────────────────────────────────┐
│ [←] [→] [⟳] https://example.com        [🔍] │
├─────────────────────────────────────────────┤
│                                             │
│  Current URL: https://example.com          │
│  Status: Loaded                             │
│  Session: chrome-session-123                │
│                                             │
│  [📸 Screenshot] [🖱️ Click] [⌨️ Type]      │
│                                             │
├─────────────────────────────────────────────┤
│  Console Output:                            │
│  > Page loaded successfully                 │
│  > 3 network requests                       │
│                                             │
└─────────────────────────────────────────────┘
```

### Screenshot Gallery

View and manage captured screenshots:

```typescript
// Screenshots are displayed in a gallery
// - Thumbnail view
// - Click to enlarge
// - Download option
// - Delete option
```

### Console Panel

Real-time browser console output:

```typescript
// Console messages categorized by:
// - Logs (info)
// - Warnings
// - Errors
// - Network requests
```

## Examples

### Navigate and Screenshot

```typescript
// Widget automatically provides UI for:
// 1. Enter URL in navigation bar
// 2. Click "Go" or press Enter
// 3. Click "Screenshot" button
// 4. View screenshot in gallery

// Or programmatically via EventBus:
eventBus.emit('widget:action', {
  widgetId: 'playwright-widget',
  action: 'navigate',
  data: { url: 'https://example.com' }
});

eventBus.emit('widget:action', {
  widgetId: 'playwright-widget',
  action: 'screenshot',
  data: { name: 'homepage' }
});
```

### Form Automation

```typescript
// UI provides form builder:
// 1. Add "Fill" action
// 2. Enter selector: input[name="email"]
// 3. Enter value: user@example.com
// 4. Add "Click" action
// 5. Enter selector: button[type="submit"]
// 6. Run sequence
```

### Console Monitoring

```typescript
// Widget automatically displays console output
// Listen to console events:
eventBus.on('widget:console', (data) => {
  console.log('Browser console:', data.message);
});
```

### Multi-Step Workflow

The widget supports creating and running multi-step workflows:

```typescript
// Create workflow in UI:
const workflow = [
  { action: 'navigate', url: 'https://example.com' },
  { action: 'fill', selector: '#search', value: 'MCP widgets' },
  { action: 'click', selector: 'button[type="submit"]' },
  { action: 'screenshot', name: 'search-results' },
];

// Run workflow button executes all steps
```

## Configuration

### Browser Settings

```typescript
await dashboard.addWidget({
  factory: createPlaywrightWidget,
  serverName: 'playwright',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Default browser
    browser: 'chromium', // 'chromium' | 'firefox' | 'webkit'

    // Viewport size
    viewport: {
      width: 1280,
      height: 720,
    },

    // Screenshot settings
    screenshots: {
      quality: 90,
      format: 'png', // 'png' | 'jpeg'
      fullPage: true,
    },

    // Console settings
    console: {
      maxMessages: 100,
      showTimestamps: true,
      filterLevels: ['log', 'warn', 'error'],
    },
  },
});
```

## Permissions

The widget requires these tool permissions:

```typescript
permissions: {
  tools: {
    scope: 'allowlist',
    patterns: [
      'playwright_navigate',
      'playwright_screenshot',
      'playwright_click',
      'playwright_fill',
      'playwright_select',
      'playwright_hover',
      'playwright_evaluate',
      'playwright_*',  // Allow all Playwright tools
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Navigation started
eventBus.on('playwright:navigate:start', (data) => {
  console.log('Navigating to:', data.url);
});

// Navigation completed
eventBus.on('playwright:navigate:complete', (data) => {
  console.log('Page loaded:', data.url, data.duration);
});

// Screenshot captured
eventBus.on('playwright:screenshot:captured', (data) => {
  console.log('Screenshot:', data.name, data.size);
});

// Console message
eventBus.on('playwright:console', (data) => {
  console.log('Browser console:', data.level, data.message);
});

// Action completed
eventBus.on('playwright:action:complete', (data) => {
  console.log('Action:', data.action, data.result);
});

// Error
eventBus.on('playwright:error', (data) => {
  console.error('Playwright error:', data.error);
});
```

## Styling

The widget uses CSS variables for theming:

```css
playwright-mcp-widget {
  --playwright-primary: #45ba4b;
  --playwright-secondary: #2d7a31;
  --playwright-surface: #ffffff;
  --playwright-text: #24292f;
  --playwright-border: #d0d7de;

  /* Screenshot gallery */
  --playwright-screenshot-border: #e1e4e8;
  --playwright-screenshot-hover: #f6f8fa;

  /* Console colors */
  --playwright-console-log: #24292f;
  --playwright-console-warn: #d29922;
  --playwright-console-error: #cf222e;
  --playwright-console-network: #0969da;
}
```

## Accessibility

- Keyboard navigation support
- Screen reader friendly
- ARIA labels for all interactive elements
- High contrast mode support
- Focus indicators
- Semantic HTML structure

### Keyboard Shortcuts

- `Ctrl/Cmd + L` - Focus URL bar
- `Ctrl/Cmd + R` - Refresh/reload
- `Ctrl/Cmd + S` - Take screenshot
- `Esc` - Close modals/dialogs

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires Web Components (Custom Elements, Shadow DOM) support.

## Advanced Usage

### Custom Actions

```typescript
// Add custom action to widget
const widget = dashboard.getWidget('playwright-widget');

// Listen for custom events
eventBus.on('widget:custom-action', async (data) => {
  if (data.action === 'scroll-to-bottom') {
    await mcpBridge.callTool('playwright', 'playwright_evaluate', {
      script: 'window.scrollTo(0, document.body.scrollHeight)',
    });
  }
});
```

### Workflow Automation

```typescript
// Save workflows
const workflow = widget.getWorkflow();
localStorage.setItem('my-workflow', JSON.stringify(workflow));

// Load and run workflow
const savedWorkflow = JSON.parse(localStorage.getItem('my-workflow'));
widget.runWorkflow(savedWorkflow);
```

### Screenshot Management

```typescript
// Export all screenshots
const screenshots = widget.getScreenshots();
screenshots.forEach(screenshot => {
  const link = document.createElement('a');
  link.href = screenshot.dataUrl;
  link.download = screenshot.name;
  link.click();
});
```

## Troubleshooting

### Widget not loading
- Ensure Playwright MCP server is installed: `npx -y @modelcontextprotocol/server-playwright`
- Check server configuration in dashboard
- Verify network connectivity

### Screenshots not appearing
- Check browser permissions
- Verify screenshot directory is writable
- Check console for errors

### Actions failing
- Verify selectors are correct
- Check if page has loaded completely
- Ensure element is visible and interactive

## Performance

- Screenshot caching
- Lazy loading of screenshot gallery
- Debounced console updates
- Efficient DOM updates
- Resource cleanup on destroy

## TypeScript

Full TypeScript support with complete type definitions.

```typescript
import type { PlaywrightWidgetConfig } from '@mcp-wp/widget-playwright';

const config: PlaywrightWidgetConfig = {
  browser: 'chromium',
  viewport: { width: 1920, height: 1080 },
};
```

## License

MIT

## Related

- [@mcp-wp/core](../core) - Core types and utilities
- [@mcp-wp/dashboard](../dashboard) - Widget host
- [Playwright MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/playwright) - Official server
