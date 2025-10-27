# @mwp/widget-filesystem

**Filesystem Operations Widget**

A Web Component widget for the Filesystem MCP server, providing file browsing, reading, writing, and directory management capabilities.

## Features

- 📁 **File Browser** - Navigate directory tree
- 📄 **File Operations** - Read, write, create, delete files
- 🔍 **Search** - Search files and content
- 📝 **Editor** - Inline file editing
- 📊 **File Info** - Size, permissions, timestamps
- 🗂️ **Directory Management** - Create, delete, move directories
- 🎨 **Syntax Highlighting** - Code preview with highlighting
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mwp/widget-filesystem
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mwp/dashboard';
import createFilesystemWidget from '@mwp/widget-filesystem';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Filesystem widget
await dashboard.addWidget({
  factory: createFilesystemWidget,
  serverName: 'filesystem',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/directory'],
  },
});
```

### MCP Server Configuration

The widget works with the official Filesystem MCP server:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-filesystem",
        "/Users/username/projects"
      ]
    }
  }
}
```

## Widget API

### Available Tools

The widget provides access to these Filesystem MCP tools:

#### File Reading

- **`read_file`** - Read file contents
  ```typescript
  { path: string }
  ```

- **`read_multiple_files`** - Read multiple files
  ```typescript
  { paths: string[] }
  ```

#### File Writing

- **`write_file`** - Write file contents
  ```typescript
  { path: string, content: string }
  ```

- **`edit_file`** - Edit file with diff
  ```typescript
  {
    path: string,
    edits: Array<{
      oldText: string,
      newText: string
    }>
  }
  ```

#### Directory Operations

- **`list_directory`** - List directory contents
  ```typescript
  { path: string }
  ```

- **`create_directory`** - Create directory
  ```typescript
  { path: string }
  ```

- **`move_file`** - Move/rename file
  ```typescript
  { source: string, destination: string }
  ```

#### File Information

- **`get_file_info`** - Get file metadata
  ```typescript
  { path: string }
  ```

- **`list_allowed_directories`** - Get allowed directories
  ```typescript
  {}
  ```

#### Search

- **`search_files`** - Search for files
  ```typescript
  { path: string, pattern: string, excludePatterns?: string[] }
  ```

## Widget Interface

### File Browser Panel

```
┌─────────────────────────────────────────────┐
│ 📁 /Users/username/projects                 │
├─────────────────────────────────────────────┤
│ 📁 src/                                     │
│   📄 index.ts                    2.5 KB    │
│   📄 app.ts                      5.1 KB    │
│ 📁 tests/                                   │
│   📄 app.test.ts                 3.2 KB    │
│ 📄 package.json                  1.8 KB    │
│ 📄 README.md                     4.5 KB    │
└─────────────────────────────────────────────┘
```

### File Editor

```typescript
// Click file to open inline editor
// - Syntax highlighting based on file extension
// - Save button
// - Revert changes button
// - Line numbers
```

### Context Menu

```typescript
// Right-click on file/folder for:
// - Open
// - Rename
// - Delete
// - Copy path
// - Show info
```

## Examples

### Browse Files

```typescript
// Widget automatically displays root directory
// Click folders to navigate
// Click files to view/edit
```

### Read File

```typescript
// Programmatically read file
eventBus.emit('widget:action', {
  widgetId: 'filesystem-widget',
  action: 'read',
  data: { path: '/path/to/file.txt' }
});

// Listen for file content
eventBus.on('filesystem:file:read', (data) => {
  console.log('File content:', data.content);
});
```

### Write File

```typescript
// UI provides editor interface
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'filesystem-widget',
  action: 'write',
  data: {
    path: '/path/to/file.txt',
    content: 'New content'
  }
});
```

### Search Files

```typescript
// Search in UI:
// 1. Click search icon
// 2. Enter pattern (e.g., "*.ts")
// 3. View results

// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'filesystem-widget',
  action: 'search',
  data: {
    path: '/base/path',
    pattern: '*.json'
  }
});
```

### Create Directory

```typescript
// UI provides "New Folder" button
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'filesystem-widget',
  action: 'create-dir',
  data: { path: '/path/to/new-dir' }
});
```

## Configuration

### Widget Settings

```typescript
await dashboard.addWidget({
  factory: createFilesystemWidget,
  serverName: 'filesystem',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Initial directory
    initialPath: '/Users/username/projects',

    // Show hidden files
    showHidden: false,

    // File size format
    fileSizeFormat: 'human', // 'human' | 'bytes'

    // Editor settings
    editor: {
      tabSize: 2,
      insertSpaces: true,
      lineNumbers: true,
      syntaxHighlighting: true,
    },

    // File type icons
    fileIcons: {
      '.ts': '📘',
      '.js': '📙',
      '.json': '📋',
      '.md': '📝',
    },

    // Confirm before delete
    confirmDelete: true,

    // Max file size to open (bytes)
    maxFileSize: 1024 * 1024, // 1MB
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
      'read_file',
      'read_multiple_files',
      'write_file',
      'edit_file',
      'list_directory',
      'create_directory',
      'move_file',
      'get_file_info',
      'list_allowed_directories',
      'search_files',
      'filesystem_*',
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Directory changed
eventBus.on('filesystem:directory:changed', (data) => {
  console.log('Current directory:', data.path);
});

// File opened
eventBus.on('filesystem:file:opened', (data) => {
  console.log('Opened file:', data.path, data.size);
});

// File saved
eventBus.on('filesystem:file:saved', (data) => {
  console.log('Saved file:', data.path);
});

// File deleted
eventBus.on('filesystem:file:deleted', (data) => {
  console.log('Deleted:', data.path);
});

// Search completed
eventBus.on('filesystem:search:complete', (data) => {
  console.log('Found files:', data.results.length);
});

// Error
eventBus.on('filesystem:error', (data) => {
  console.error('Filesystem error:', data.error);
});
```

## Styling

The widget uses CSS variables for theming:

```css
filesystem-mcp-widget {
  --filesystem-primary: #0969da;
  --filesystem-secondary: #8b949e;
  --filesystem-surface: #ffffff;
  --filesystem-text: #24292f;
  --filesystem-border: #d0d7de;

  /* File browser */
  --filesystem-folder-color: #54aeff;
  --filesystem-file-color: #24292f;
  --filesystem-hover-bg: #f6f8fa;
  --filesystem-selected-bg: #ddf4ff;

  /* Editor */
  --filesystem-editor-bg: #ffffff;
  --filesystem-editor-line-number: #8b949e;
  --filesystem-editor-gutter: #f6f8fa;

  /* Syntax highlighting */
  --filesystem-syntax-keyword: #cf222e;
  --filesystem-syntax-string: #0a3069;
  --filesystem-syntax-number: #0550ae;
  --filesystem-syntax-comment: #6e7781;
}
```

## Accessibility

- Keyboard navigation (Arrow keys, Enter, Backspace)
- Screen reader support
- ARIA labels for all elements
- Focus indicators
- High contrast mode
- Semantic HTML

### Keyboard Shortcuts

- `↑/↓` - Navigate files/folders
- `Enter` - Open file/folder
- `Backspace` - Go to parent directory
- `Ctrl/Cmd + S` - Save file
- `Ctrl/Cmd + F` - Search
- `Del` - Delete selected
- `F2` - Rename

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

Requires Web Components support.

## Advanced Usage

### File Watchers

```typescript
// Watch for file changes
const widget = dashboard.getWidget('filesystem-widget');

eventBus.on('filesystem:file:changed', (data) => {
  console.log('File changed:', data.path);
  // Reload file
  widget.refresh();
});
```

### Batch Operations

```typescript
// Read multiple files
eventBus.emit('widget:action', {
  widgetId: 'filesystem-widget',
  action: 'read-multiple',
  data: {
    paths: [
      '/path/to/file1.txt',
      '/path/to/file2.txt',
    ]
  }
});
```

### Custom File Icons

```typescript
const widget = dashboard.addWidget({
  factory: createFilesystemWidget,
  widgetConfig: {
    fileIcons: {
      '.tsx': '⚛️',
      '.vue': '💚',
      '.rs': '🦀',
      '.go': '🐹',
      '.py': '🐍',
    },
  },
});
```

## Troubleshooting

### Widget not loading
- Ensure Filesystem MCP server is configured with allowed directories
- Check server has read/write permissions
- Verify path exists

### Cannot write files
- Check directory permissions
- Verify path is within allowed directories
- Check disk space

### Large files not opening
- Increase `maxFileSize` in widget config
- Use external editor for very large files

## Performance

- Lazy loading of directory contents
- Virtual scrolling for large directories
- Debounced search
- File content caching
- Efficient diff-based editing

## TypeScript

Full TypeScript support:

```typescript
import type {
  FilesystemWidgetConfig,
  FileEntry,
  DirectoryEntry,
} from '@mwp/widget-filesystem';

const config: FilesystemWidgetConfig = {
  initialPath: '/project',
  showHidden: false,
};
```

## Security

- Respects MCP server allowed directories
- No arbitrary code execution
- Path traversal protection
- File size limits
- Confirm dangerous operations

## License

MIT

## Related

- [@mwp/core](../core) - Core types and utilities
- [@mwp/dashboard](../dashboard) - Widget host
- [Filesystem MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem) - Official server
