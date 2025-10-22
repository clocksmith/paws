# Dashboard Examples

Example dashboard applications demonstrating different MWP configurations and use cases.

## Examples

### 1. Basic Dashboard (`basic.html`)

Simple dashboard with one widget.

**Features:**
- Single GitHub widget
- Basic configuration
- Minimal setup

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/basic.html
```

### 2. Multi-Widget Dashboard (`multi-widget.html`)

Dashboard with multiple widgets in a grid layout.

**Features:**
- GitHub, Brave Search, Filesystem widgets
- Grid layout (2 columns)
- Theme switching
- Widget management UI

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/multi-widget.html
```

### 3. Developer Dashboard (`developer.html`)

Full-featured developer dashboard.

**Features:**
- All 4 widgets (GitHub, Playwright, Filesystem, Brave)
- Responsive grid layout
- Dark/light theme toggle
- Performance monitoring
- Search across widgets
- Keyboard shortcuts

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/developer.html
```

### 4. Research Dashboard (`research.html`)

Dashboard optimized for research and documentation.

**Features:**
- Brave Search widget (full width)
- Filesystem widget (for notes)
- Playwright widget (for web scraping)
- Export/import functionality

### 5. Custom Theme Dashboard (`custom-theme.html`)

Dashboard with custom theming.

**Features:**
- Custom color scheme
- Custom layouts
- Style customization examples

### 6. DevOps Control Room (`devops.config.json`)

Full-stack CI/CD cockpit combining GitHub Actions, Playwright smoke tests, and filesystem log tailing.

**Features:**
- GitHub widget pinned to Actions tab with auto-refresh
- Playwright widget for smoke/regression suites with log forwarding
- Filesystem widget tailing deployment and test logs
- Toast notifications for failed workflows/tests

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/multi-widget.html?config=dashboards/devops.config.json
```

### 7. AI Researcher Workspace (`ai-researcher.config.json`)

Search, scrape, store, and synthesise findings with Brave, Fetch, Memory, and Sequential-Thinking widgets.

**Features:**
- Brave search results feed Fetch scraping pipeline
- Summaries archived into Memory with source metadata
- Sequential-Thinking auto-ingests notes for analysis and citation
- Layout optimised for research sprints and note taking

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/multi-widget.html?config=dashboards/ai-researcher.config.json
```

### 8. Business Intelligence Console (`business-intelligence.config.json`)

Supabase analytics combined with Memory notebooks and a themed chart widget for KPI visualisation.

**Features:**
- Supabase widget monitors schema, queries, realtime metrics
- Insights saved to Memory as notebook entries
- Themed chart widget renders KPI rollups from Supabase datasets
- Event bridge logs every query result into Memory with tags

**Run:**
```bash
pnpm dev
# Open http://localhost:5173/multi-widget.html?config=dashboards/business-intelligence.config.json
```

## Configuration

### MCP Server Setup

Create `.mcp-servers.json` in the root directory:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "playwright": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-playwright"]
    },
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/path/to/allowed/directory"
      ]
    },
    "brave-search": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-brave-search"],
      "env": {
        "BRAVE_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Environment Variables

Create `.env` file:

```env
GITHUB_TOKEN=ghp_your_token_here
BRAVE_API_KEY=your_api_key_here
FILESYSTEM_ROOT=/path/to/allowed/directory
```

## Common Patterns

### Adding a Widget

```typescript
import { Dashboard } from '@mwp/dashboard';
import createGitHubWidget from '@mwp/widget-github';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
  theme: { mode: 'light' },
  layout: { type: 'grid', columns: 2 },
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
  layout: { column: 1, row: 1 },
});
```

### Theme Switching

```typescript
let currentTheme = 'light';

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  dashboard.setTheme({
    mode: currentTheme,
    primary: currentTheme === 'light' ? '#0969da' : '#58a6ff',
    surface: currentTheme === 'light' ? '#ffffff' : '#0d1117',
    text: currentTheme === 'light' ? '#24292f' : '#c9d1d9',
  });
}
```

### Widget Events

```typescript
// Listen for all widget events
dashboard.events.on('widget:initialized', (data) => {
  console.log('Widget ready:', data.widgetId);
});

dashboard.events.on('widget:error', (data) => {
  console.error('Widget error:', data.error);
});

// Listen for specific widget events
dashboard.events.on('github:repo:selected', (data) => {
  console.log('Repository selected:', data.repo);
});

dashboard.events.on('brave:search:complete', (data) => {
  console.log('Search results:', data.resultCount);
});
```

### Dynamic Layout

```typescript
// Responsive layout
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

### Save/Load State

```typescript
// Save dashboard state
function saveDashboardState() {
  const state = {
    theme: dashboard.theme,
    layout: dashboard.layout,
    widgets: Array.from(dashboard.widgets.keys()),
  };

  localStorage.setItem('dashboard-state', JSON.stringify(state));
}

// Load dashboard state
function loadDashboardState() {
  const saved = localStorage.getItem('dashboard-state');
  if (saved) {
    const state = JSON.parse(saved);
    dashboard.setTheme(state.theme);
    dashboard.setLayout(state.layout);
  }
}
```

## Keyboard Shortcuts

All dashboards support these shortcuts:

- `Ctrl/Cmd + K` - Focus search
- `Ctrl/Cmd + D` - Toggle theme
- `Ctrl/Cmd + R` - Refresh all widgets
- `Ctrl/Cmd + ,` - Open settings
- `Esc` - Close modals

## Performance Tips

1. **Lazy Load Widgets**
   ```typescript
   const widgets = {
     github: () => import('@mwp/widget-github'),
     brave: () => import('@mwp/widget-brave'),
   };

   // Load on demand
   const module = await widgets.github();
   await dashboard.addWidget({ factory: module.default, ... });
   ```

2. **Limit Widget Count**
   ```typescript
   const dashboard = new Dashboard({
     container,
     settings: { maxWidgets: 6 },
   });
   ```

3. **Enable Monitoring**
   ```typescript
   const dashboard = new Dashboard({
     container,
     settings: { monitoring: true },
   });

   setInterval(() => {
     const metrics = dashboard.getMetrics();
     console.log('Memory:', metrics.dashboard.totalMemory);
   }, 10000);
   ```

## Troubleshooting

### Widgets Not Loading

1. Check MCP server configuration
2. Verify environment variables
3. Check browser console for errors
4. Ensure all dependencies are installed

### Performance Issues

1. Reduce number of widgets
2. Enable lazy loading
3. Disable auto-refresh
4. Check network tab for slow requests

### Styling Issues

1. Check CSS variable names
2. Verify theme configuration
3. Check for CSS conflicts
4. Use browser devtools inspector

## Next Steps

- Customize themes in `custom-theme.html`
- Add more widgets to layouts
- Create your own widget
- Build a production app

## Resources

- [Dashboard API](../../dashboard/README.md)
- [Widget Development](../../widgets/README.md)
- [Core Types](../../core/README.md)
- [MCP Widget Protocol Specification](../../../specification/MWP.md)
