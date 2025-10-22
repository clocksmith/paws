# @mwp/widget-brave

**Brave Search Widget**

A Web Component widget for the Brave Search MCP server, providing web search capabilities with privacy-focused results.

## Features

- 🔍 **Web Search** - Search the web with Brave Search
- 📊 **Rich Results** - Display search results with titles, snippets, and URLs
- 🖼️ **Image Search** - Search and display image results
- 📰 **News Search** - Find recent news articles
- 🎯 **Smart Filters** - Filter by date, type, region
- 🔄 **Search History** - Track and revisit searches
- 📑 **Pagination** - Browse through result pages
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mwp/widget-brave
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mwp/dashboard';
import createBraveWidget from '@mwp/widget-brave';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Brave Search widget
await dashboard.addWidget({
  factory: createBraveWidget,
  serverName: 'brave-search',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: {
      BRAVE_API_KEY: process.env.BRAVE_API_KEY,
    },
  },
});
```

### MCP Server Configuration

The widget works with the official Brave Search MCP server:

```json
{
  "mcpServers": {
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Get API Key:** https://brave.com/search/api/

## Widget API

### Available Tools

The widget provides access to these Brave Search MCP tools:

#### Web Search

- **`brave_web_search`** - Search the web
  ```typescript
  {
    query: string,
    count?: number,        // Number of results (default: 10)
    offset?: number,       // Pagination offset
    freshness?: string,    // 'day' | 'week' | 'month' | 'year'
    safesearch?: string,   // 'off' | 'moderate' | 'strict'
  }
  ```

#### Local Search

- **`brave_local_search`** - Search for local businesses
  ```typescript
  {
    query: string,
    count?: number,
  }
  ```

## Widget Interface

### Search Interface

```
┌─────────────────────────────────────────────┐
│ [🔍] Search the web...              [Search]│
├─────────────────────────────────────────────┤
│ Filters: [All] [Images] [News] [Videos]    │
│          Date: [Any time ▼]                 │
├─────────────────────────────────────────────┤
│                                             │
│  1. Example Search Result Title            │
│     www.example.com                         │
│     This is a snippet of the search result │
│     showing relevant content...             │
│                                             │
│  2. Another Search Result                  │
│     www.example2.com                        │
│     More search result content here with   │
│     highlighted keywords...                 │
│                                             │
│  [← Previous] Page 1 of 10 [Next →]        │
└─────────────────────────────────────────────┘
```

### Search Filters

- **Type:** All, Images, News, Videos
- **Date:** Any time, Past day, Week, Month, Year
- **Safe Search:** Off, Moderate, Strict
- **Count:** Results per page (10, 20, 50)

## Examples

### Basic Search

```typescript
// Widget provides search UI
// User enters query and clicks Search
// Results displayed automatically

// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'brave-widget',
  action: 'search',
  data: { query: 'TypeScript tutorials' }
});
```

### Filtered Search

```typescript
// Search with filters via UI
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'brave-widget',
  action: 'search',
  data: {
    query: 'machine learning',
    freshness: 'week',
    count: 20,
  }
});
```

### Image Search

```typescript
// Click "Images" filter in UI
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'brave-widget',
  action: 'search',
  data: {
    query: 'nature photography',
    type: 'images'
  }
});
```

### Search History

```typescript
// Widget automatically maintains search history
// Click history item to re-run search

// Access history programmatically:
const widget = dashboard.getWidget('brave-widget');
const history = widget.getSearchHistory();
```

## Configuration

### Widget Settings

```typescript
await dashboard.addWidget({
  factory: createBraveWidget,
  serverName: 'brave-search',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Default search settings
    defaultCount: 10,
    defaultSafesearch: 'moderate',

    // Result display
    showSnippets: true,
    showThumbnails: true,
    showMetadata: true,

    // History
    maxHistoryItems: 50,
    saveHistory: true,

    // UI
    compactMode: false,
    highlightKeywords: true,

    // Advanced
    openLinksInNewTab: true,
    showRelatedSearches: true,
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
      'brave_web_search',
      'brave_local_search',
      'brave_*',
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Search started
eventBus.on('brave:search:started', (data) => {
  console.log('Searching for:', data.query);
});

// Search completed
eventBus.on('brave:search:complete', (data) => {
  console.log('Found results:', data.resultCount);
});

// Result clicked
eventBus.on('brave:result:clicked', (data) => {
  console.log('Opened:', data.url);
});

// Filter changed
eventBus.on('brave:filter:changed', (data) => {
  console.log('Filter:', data.filter, data.value);
});

// Error
eventBus.on('brave:error', (data) => {
  console.error('Search error:', data.error);
});
```

## Styling

The widget uses CSS variables for theming:

```css
brave-mcp-widget {
  --brave-primary: #fb542b;
  --brave-secondary: #8b949e;
  --brave-surface: #ffffff;
  --brave-text: #24292f;
  --brave-border: #d0d7de;

  /* Search bar */
  --brave-search-bg: #ffffff;
  --brave-search-border: #d0d7de;
  --brave-search-focus: #fb542b;

  /* Results */
  --brave-result-hover: #f6f8fa;
  --brave-result-title: #1a0dab;
  --brave-result-url: #006621;
  --brave-result-snippet: #545454;

  /* Filters */
  --brave-filter-active: #fb542b;
  --brave-filter-inactive: #8b949e;
}
```

## Accessibility

- Keyboard navigation (Tab, Enter, Arrow keys)
- Screen reader support with ARIA labels
- Focus indicators
- High contrast mode
- Semantic HTML structure

### Keyboard Shortcuts

- `Ctrl/Cmd + K` - Focus search box
- `↑/↓` - Navigate results
- `Enter` - Open selected result
- `Esc` - Clear search
- `Ctrl/Cmd + ←/→` - Previous/next page

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires Web Components support.

## Advanced Usage

### Custom Result Renderer

```typescript
// Listen for search results
eventBus.on('brave:search:complete', (data) => {
  console.log('Results:', data.results);

  // Process results
  data.results.forEach(result => {
    console.log(result.title, result.url, result.snippet);
  });
});
```

### Search Suggestions

```typescript
// Debounced search as user types
let searchTimeout;
const searchInput = document.querySelector('#search-input');

searchInput.addEventListener('input', (e) => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    // Trigger search
    eventBus.emit('widget:action', {
      widgetId: 'brave-widget',
      action: 'search',
      data: { query: e.target.value }
    });
  }, 500);
});
```

### Export Results

```typescript
// Export search results to JSON
const widget = dashboard.getWidget('brave-widget');
const results = widget.getCurrentResults();

const exportData = {
  query: results.query,
  timestamp: new Date(),
  results: results.items.map(r => ({
    title: r.title,
    url: r.url,
    snippet: r.snippet,
  })),
};

const blob = new Blob([JSON.stringify(exportData, null, 2)], {
  type: 'application/json',
});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `search-${Date.now()}.json`;
a.click();
```

## Troubleshooting

### Widget not loading
- Ensure Brave API key is set in environment variables
- Check network connectivity
- Verify MCP server is running

### No results showing
- Check search query is not empty
- Verify API key is valid
- Check browser console for errors

### Slow search
- Reduce result count (default is 10)
- Check internet connection
- Verify API rate limits

## Performance

- Debounced search input (500ms)
- Result caching
- Lazy loading of images
- Virtual scrolling for large result sets
- Optimized re-renders

## Privacy

- Brave Search focuses on privacy
- No user tracking
- No personalized results by default
- Transparent data handling
- GDPR compliant

## Rate Limits

Brave Search API has rate limits:
- Free tier: 2,000 queries/month
- Check current limits: https://brave.com/search/api/

The widget displays rate limit warnings when approaching limits.

## TypeScript

Full TypeScript support:

```typescript
import type {
  BraveWidgetConfig,
  SearchResult,
  SearchFilters,
} from '@mwp/widget-brave';

const config: BraveWidgetConfig = {
  defaultCount: 20,
  saveHistory: true,
};
```

## License

MIT

## Related

- [@mwp/core](../core) - Core types and utilities
- [@mwp/dashboard](../dashboard) - Widget host
- [Brave Search API](https://brave.com/search/api/) - API documentation
- [Brave Search MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search) - Official server
