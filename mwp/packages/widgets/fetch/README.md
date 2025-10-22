# @mcp-wp/widget-fetch

**Web Content Fetching and Processing Widget**

A Web Component widget for the Fetch MCP server, providing web content fetching, HTML extraction, and processing capabilities for web scraping and content analysis.

## Features

- 🌐 **URL Fetching** - Fetch content from any URL
- 📄 **HTML Extraction** - Extract specific content using selectors
- 🔍 **Content Processing** - Process and format fetched content
- 📊 **Fetch History** - Track and revisit previous fetches
- 🎨 **Syntax Highlighting** - View HTML/text with syntax highlighting
- 💾 **Export Content** - Save fetched content locally
- 🔄 **Auto-refresh** - Optionally auto-refresh content
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mcp-wp/widget-fetch
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createFetchWidget from '@mcp-wp/widget-fetch';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Fetch widget
await dashboard.addWidget({
  factory: createFetchWidget,
  serverName: 'fetch',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-fetch'],
  },
});
```

### MCP Server Configuration

```json
{
  "mcpServers": {
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

## Widget API

### Available Tools

The widget provides access to Fetch MCP tools:

#### Fetch Tools

- **`fetch`** - Fetch content from URL
  ```typescript
  {
    url: string;
    maxLength?: number;
    startIndex?: number;
    raw?: boolean;
  }
  ```

- **`fetch_html`** - Fetch and parse HTML
  ```typescript
  {
    url: string;
    selector?: string;
    maxLength?: number;
  }
  ```

## Widget Interface

### URL Fetch View

```
┌─────────────────────────────────────────────┐
│ 🌐 Fetch Content                            │
├─────────────────────────────────────────────┤
│ URL: [https://example.com           ] [Go] │
│ Options: □ Raw  □ HTML                      │
│ Selector: [.content]                        │
├─────────────────────────────────────────────┤
│                                             │
│  Content Preview:                           │
│  ┌─────────────────────────────────────┐   │
│  │ <!DOCTYPE html>                     │   │
│  │ <html>                              │   │
│  │   <head>                            │   │
│  │     <title>Example Domain</title>   │   │
│  │   </head>                           │   │
│  │   <body>                            │   │
│  │     <h1>Example Domain</h1>         │   │
│  │     <p>This domain is for use in... │   │
│  │   </body>                           │   │
│  │ </html>                             │   │
│  └─────────────────────────────────────┘   │
│                                             │
│  Size: 1.2 KB | Fetched: 2s ago            │
│  [Copy] [Export] [Refresh]                 │
└─────────────────────────────────────────────┘
```

### Fetch History View

```
┌─────────────────────────────────────────────┐
│ 🌐 Fetch Content                [History]   │
├─────────────────────────────────────────────┤
│                                             │
│  📄 https://example.com                     │
│     Fetched 2 minutes ago | 1.2 KB         │
│                                             │
│  📄 https://github.com/user/repo            │
│     Fetched 5 minutes ago | 3.5 KB         │
│     Selector: .markdown-body                │
│                                             │
│  📄 https://docs.example.com/api            │
│     Fetched 10 minutes ago | 8.1 KB        │
│                                             │
└─────────────────────────────────────────────┘
```

## Examples

### Fetch URL

```typescript
// Widget provides URL input and fetch button
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'fetch-widget',
  action: 'fetch',
  data: {
    url: 'https://example.com',
  }
});
```

### Fetch HTML with Selector

```typescript
eventBus.emit('widget:action', {
  widgetId: 'fetch-widget',
  action: 'fetch-html',
  data: {
    url: 'https://github.com/user/repo',
    selector: '.markdown-body',
  }
});
```

### Export Content

```typescript
// Export current content
const content = widget.getCurrentContent();
downloadFile(content, 'fetched-content.html');
```

## Configuration

### Widget Settings

```typescript
await dashboard.addWidget({
  factory: createFetchWidget,
  serverName: 'fetch',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Default fetch options
    defaultRaw: false,
    defaultMaxLength: 50000,

    // Content display
    syntaxHighlight: true,
    wordWrap: true,
    showLineNumbers: true,

    // History
    maxHistoryItems: 50,
    saveHistory: true,

    // Auto-refresh
    autoRefresh: false,
    refreshInterval: 60000, // ms

    // Export
    exportFormat: 'html', // 'html' | 'text' | 'markdown'
  },
});
```

## Permissions

```typescript
permissions: {
  tools: {
    scope: 'allowlist',
    patterns: [
      'fetch',
      'fetch_html',
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Fetch started
eventBus.on('fetch:started', (data) => {
  console.log('Fetching:', data.url);
});

// Fetch completed
eventBus.on('fetch:completed', (data) => {
  console.log('Fetched:', data.url, data.size);
});

// Content extracted
eventBus.on('fetch:extracted', (data) => {
  console.log('Extracted with selector:', data.selector);
});

// Error
eventBus.on('fetch:error', (data) => {
  console.error('Fetch error:', data.error);
});
```

## Styling

```css
fetch-widget {
  --fetch-primary: #10b981;
  --fetch-secondary: #34d399;
  --fetch-surface: #ffffff;
  --fetch-text: #24292f;

  /* Content display */
  --fetch-content-bg: #f9fafb;
  --fetch-content-border: #e5e7eb;
  --fetch-code-bg: #1f2937;
  --fetch-code-text: #f3f4f6;

  /* Syntax highlighting */
  --fetch-syntax-tag: #f59e0b;
  --fetch-syntax-attr: #3b82f6;
  --fetch-syntax-string: #10b981;
  --fetch-syntax-comment: #6b7280;
}
```

## Accessibility

- Screen reader support for content navigation
- Keyboard shortcuts for common actions
- ARIA labels for all interactive elements
- Focus indicators
- Semantic HTML structure

### Keyboard Shortcuts

- `Ctrl/Cmd + Enter` - Fetch URL
- `Ctrl/Cmd + R` - Refresh current
- `Ctrl/Cmd + C` - Copy content
- `Ctrl/Cmd + E` - Export content
- `Ctrl/Cmd + H` - Toggle history

## Use Cases

### 1. Web Scraping

Fetch and extract specific content from websites:

```typescript
// Fetch article content
await fetch.fetchHTML({
  url: 'https://blog.example.com/article',
  selector: 'article.content',
});
```

### 2. API Documentation

Fetch and view API documentation:

```typescript
// Fetch docs
await fetch.fetch({
  url: 'https://api.example.com/docs',
});
```

### 3. Content Monitoring

Monitor website changes:

```typescript
// Auto-refresh every minute
widget.setAutoRefresh(true, 60000);
```

## Advanced Usage

### Custom Content Processing

```typescript
// Process fetched content
eventBus.on('fetch:completed', (data) => {
  const processed = processContent(data.content);
  widget.setContent(processed);
});

function processContent(html: string): string {
  // Custom processing logic
  return html.replace(/<script[^>]*>.*?<\/script>/gi, '');
}
```

### Batch Fetching

```typescript
// Fetch multiple URLs
const urls = [
  'https://example.com/page1',
  'https://example.com/page2',
  'https://example.com/page3',
];

const results = await Promise.all(
  urls.map(url => widget.fetch({ url }))
);
```

### Content Comparison

```typescript
// Compare two versions
const v1 = await widget.fetch({ url: 'https://example.com' });
const v2 = await widget.fetch({ url: 'https://example.com' });

const diff = compareDocs(v1.content, v2.content);
console.log('Changes detected:', diff);
```

## Performance

- Content streaming for large documents
- Lazy rendering for large content
- Request caching
- Debounced auto-refresh
- Efficient DOM updates

## TypeScript

```typescript
import type {
  FetchWidgetConfig,
  FetchRequest,
  FetchResult,
  FetchHistoryItem,
} from '@mcp-wp/widget-fetch';

const config: FetchWidgetConfig = {
  syntaxHighlight: true,
  maxHistoryItems: 100,
};
```

## Troubleshooting

### CORS errors
- Use a CORS proxy
- Configure server CORS headers
- Check browser console

### Timeout errors
- Increase timeout limit
- Check network connection
- Verify URL is accessible

### Content not displaying
- Check selector syntax
- Verify content exists
- Review console errors

## Security

- URL validation before fetching
- Content sanitization
- HTTPS enforcement option
- Rate limiting support

## License

MIT

## Related

- [@mcp-wp/core](../core) - Core types and utilities
- [@mcp-wp/dashboard](../dashboard) - Widget host
- [Fetch MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/fetch) - Official server
