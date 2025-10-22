# @mwp/widget-github

GitHub widget for MCP Widget Protocol - interact with GitHub repositories through MCP.

## Overview

This widget provides a UI for interacting with the GitHub MCP server, allowing users to:

- **Browse Repositories** - View repository information and metadata
- **Create Issues** - Create GitHub issues with title, body, and labels
- **Create Pull Requests** - Create PRs from branches
- **Search Code** - Search repositories for code patterns
- **View File Contents** - Read file contents from repositories
- **Manage Branches** - List and create branches

## Installation

```bash
pnpm add @mwp/widget-github
```

## Prerequisites

This widget requires the GitHub MCP server to be configured and running:

```bash
npm install -g @modelcontextprotocol/server-github
```

## Usage

### In Dashboard Configuration

```json
{
  "servers": [
    {
      "name": "github",
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
        }
      }
    }
  ],
  "widgets": [
    {
      "id": "github-1",
      "package": "@mwp/widget-github",
      "serverName": "github",
      "position": { "x": 0, "y": 0 },
      "size": { "w": 6, "h": 4 }
    }
  ]
}
```

### Programmatic Usage

```typescript
import createGitHubWidget from '@mwp/widget-github';
import { EventBus } from '@mwp/eventbus';
import { MCPBridge } from '@mwp/bridge';

const eventBus = new EventBus();
const bridge = new MCPBridge(eventBus, config);

await bridge.connect('github');

const serverInfo = bridge.getServerInfo('github')!;

const widgetFactory = createGitHubWidget(
  {
    EventBus: eventBus,
    MCPBridge: bridge,
    Configuration: configService,
  },
  serverInfo
);

// Initialize widget
await widgetFactory.api.initialize();

// Add widget element to DOM
document.body.appendChild(
  document.createElement(widgetFactory.widget.element)
);
```

## Features

### Repository Browser

Browse and view repository information:

```typescript
// Lists repositories from the authenticated user
// Displays: name, description, stars, forks, language
```

### Issue Creator

Create GitHub issues:

- Title input
- Body (markdown editor)
- Labels (multi-select)
- Assignees (multi-select)
- Milestone selection

### Pull Request Creator

Create pull requests:

- Source and target branch selection
- Title and description
- Reviewers selection
- Draft PR support

### Code Search

Search code across repositories:

- Pattern/keyword search
- Language filter
- Repository filter
- Results with context

### File Viewer

View file contents:

- Syntax highlighting
- Raw/rendered toggle
- Download file
- View history

## Widget API

### Metadata

```typescript
{
  protocolVersion: "1.0.0",
  element: "github-mcp-widget",
  displayName: "GitHub",
  description: "Interact with GitHub repositories",
  capabilities: {
    tools: true,
    resources: true,
    prompts: false
  },
  category: "content-browser",
  tags: ["github", "git", "version-control"]
}
```

### Lifecycle Methods

#### initialize()

Initializes the widget, loads repository list, and sets up event listeners.

```typescript
await widgetFactory.api.initialize();
```

#### destroy()

Cleans up event listeners and removes DOM elements.

```typescript
await widgetFactory.api.destroy();
```

#### refresh()

Refreshes widget data (re-fetches repository list).

```typescript
await widgetFactory.api.refresh();
```

## Configuration

### Widget-Specific Config

```json
{
  "config": {
    "defaultRepo": "owner/repo",
    "defaultBranch": "main",
    "showPrivateRepos": true,
    "maxRecentRepos": 10,
    "refreshInterval": 300000
  }
}
```

### Permissions

Required permissions:

```json
{
  "permissions": {
    "tools": {
      "scope": "allowlist",
      "patterns": [
        "github:create_issue",
        "github:create_pull_request",
        "github:search_code",
        "github:get_file_contents",
        "github:create_branch",
        "github:list_commits"
      ]
    },
    "resources": {
      "scope": "allowlist",
      "patterns": ["github://*"]
    }
  }
}
```

## Available Tools

The widget uses these GitHub MCP server tools:

### Repository Tools
- `create_repository` - Create new repository
- `get_repository` - Get repository info
- `list_repositories` - List user repositories

### Issue Tools
- `create_issue` - Create new issue
- `update_issue` - Update existing issue
- `list_issues` - List repository issues
- `search_issues` - Search issues

### Pull Request Tools
- `create_pull_request` - Create new PR
- `update_pull_request` - Update PR
- `list_pull_requests` - List PRs
- `merge_pull_request` - Merge PR

### File Tools
- `get_file_contents` - Read file
- `create_or_update_file` - Write file
- `search_code` - Search code

### Branch Tools
- `create_branch` - Create branch
- `list_branches` - List branches

## Events

The widget emits and listens to these events:

### Emitted Events

- `mcp:tool:invoke-requested` - Before tool invocation
- `widget:initialized` - After initialization
- `widget:error` - On error

### Listened Events

- `mcp:tool:invoked` - Tool result received
- `mcp:tool:error` - Tool error
- `mcp:resources:list-changed` - Repository list changed
- `widget:refresh-requested` - Refresh requested

## Styling

The widget uses Shadow DOM for style encapsulation. Custom styling via CSS custom properties:

```css
github-mcp-widget {
  --github-primary-color: #0969da;
  --github-success-color: #1a7f37;
  --github-danger-color: #cf222e;
  --github-border-radius: 6px;
  --github-spacing: 16px;
}
```

## Accessibility

- WCAG 2.1 AA compliant
- Keyboard navigation support
- Screen reader friendly
- High contrast mode support
- Focus management

## Performance

- Lazy loading for large repository lists
- Virtualized scrolling for issue/PR lists
- Debounced search inputs
- Request caching (5 minutes TTL)
- Bundle size: ~45KB gzipped

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

```bash
# Install dependencies
pnpm install

# Development mode
pnpm dev

# Build
pnpm build

# Test
pnpm test

# Type check
pnpm typecheck
```

## Examples

### Basic Widget

```typescript
// Minimal setup
const widget = createGitHubWidget(dependencies, serverInfo);
await widget.api.initialize();
```

### With Custom Config

```typescript
// Custom configuration
const widget = createGitHubWidget(dependencies, serverInfo);

// Configure before initialization
widget.config = {
  defaultRepo: 'facebook/react',
  showPrivateRepos: false,
  maxRecentRepos: 5,
};

await widget.api.initialize();
```

### Event Handling

```typescript
// Listen to widget events
eventBus.on('mcp:tool:invoked', ({ serverName, toolName, result }) => {
  if (serverName === 'github' && toolName === 'create_issue') {
    console.log('Issue created:', result);
  }
});
```

## Troubleshooting

### No repositories showing

- Verify GitHub token has correct permissions
- Check network connectivity
- Verify MCP server is running
- Check browser console for errors

### Tool invocation fails

- Verify tool permissions in widget config
- Check GitHub API rate limits
- Verify repository access permissions

### Styling issues

- Check for CSS conflicts with host application
- Verify Shadow DOM support in browser
- Check custom property values

## License

MIT
