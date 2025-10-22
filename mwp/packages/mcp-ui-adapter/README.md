# @mwp/mcp-ui-adapter

Adapter to run MWP widgets in mcp-ui's iframe environment.

## Overview

This package enables MWP widgets to work seamlessly with the existing [mcp-ui](https://github.com/idosal/mcp-ui) ecosystem. It translates between MWP's Web Component architecture and mcp-ui's iframe model.

## Why?

MWP aims to **enhance** mcp-ui, not replace it. This adapter demonstrates that commitment by ensuring MWP widgets can run in both environments:

- **Native MWP**: Full Web Components with Shadow DOM
- **mcp-ui Compatible**: Adapted to iframe model via this package

## Installation

```bash
npm install @mwp/mcp-ui-adapter
```

## Usage

### Convert MWP Widget to mcp-ui HTML

```typescript
import createGitHubWidget from '@mwp/widget-github';
import { adaptMWPForMcpUI } from '@mwp/mcp-ui-adapter';

const html = adaptMWPForMcpUI(
  createGitHubWidget,
  {
    serverName: 'github',
    capabilities: { tools: true }
  },
  {
    injectTheme: true,
    theme: {
      '--mwp-accent': '#ff6b6b'
    }
  }
);

// Serve html to mcp-ui's iframe
```

### Create Data URL for Direct Embedding

```typescript
import { createIframeDataURL } from '@mwp/mcp-ui-adapter';

const dataUrl = createIframeDataURL(createGitHubWidget, serverInfo);

// Use in iframe
const iframe = document.createElement('iframe');
iframe.src = dataUrl;
document.body.appendChild(iframe);
```

## How It Works

The adapter creates a bridge between MWP's APIs and mcp-ui's postMessage protocol:

1. **EventBus → postMessage**: MWP events translate to parent postMessage
2. **MCPBridge → postMessage**: Tool calls go through parent confirmation
3. **Configuration → localStorage**: Widget settings persist locally
4. **Theme → CSS Variables**: Consistent styling across both environments

## API

### `adaptMWPForMcpUI(widgetFactory, serverInfo, config?)`

Converts an MWP widget factory to standalone HTML.

**Parameters:**
- `widgetFactory` - MWP widget factory function
- `serverInfo` - MCP server metadata
- `config` - Optional configuration:
  - `baseUrl` - Base URL for loading bundles
  - `injectTheme` - Whether to inject theme CSS (default: true)
  - `theme` - CSS custom property overrides

**Returns:** HTML string

### `createIframeDataURL(widgetFactory, serverInfo, config?)`

Creates a data URL for direct iframe embedding.

**Returns:** Data URL string

## Compatibility Matrix

| Feature | MWP Native | mcp-ui Adapted |
|---------|-----------|----------------|
| Tool Execution | ✅ | ✅ |
| User Confirmation | ✅ | ✅ (via postMessage) |
| Event System | ✅ | ✅ (translated) |
| Shadow DOM | ✅ | ❌ (iframe isolation) |
| Theming | ✅ | ✅ (CSS vars) |
| TypeScript | ✅ | ✅ |

## Example: GitHub Widget in mcp-ui

```typescript
import express from 'express';
import createGitHubWidget from '@mwp/widget-github';
import { adaptMWPForMcpUI } from '@mwp/mcp-ui-adapter';

const app = express();

app.get('/widgets/github', (req, res) => {
  const html = adaptMWPForMcpUI(
    createGitHubWidget,
    { serverName: 'github', capabilities: { tools: true } }
  );

  res.setHeader('Content-Type', 'text/html');
  res.send(html);
});

app.listen(3000);
```

Then in mcp-ui configuration:

```json
{
  "servers": {
    "github": {
      "widgetUrl": "http://localhost:3000/widgets/github"
    }
  }
}
```

## Contributing

We welcome contributions! See our collaboration plan with mcp-ui maintainers.

## License

MIT
