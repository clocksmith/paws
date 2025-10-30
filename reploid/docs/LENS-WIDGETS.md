# Lens Widgets for Reploid

**Status:** DRAFT - Being written as implementation progresses

## Overview

Lens widgets provide user interface components for interacting with Reploid's MCP-based agent system. These widgets connect to MCP servers to provide real-time monitoring and approval interfaces.

## Widget Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Lens Widget                          │
│  ┌───────────────────────────────────────────────────┐  │
│  │           UI Components (HTML/CSS/JS)             │  │
│  └───────────────┬───────────────────────────────────┘  │
│                  │                                       │
│  ┌───────────────▼───────────────────────────────────┐  │
│  │         Widget API (widget-api.js)                │  │
│  └───────────────┬───────────────────────────────────┘  │
└──────────────────┼───────────────────────────────────────┘
                   │
                   │ MCP Tool Calls
                   ↓
┌─────────────────────────────────────────────────────────┐
│                    MCP Servers                          │
│       (VFS, Workflow, Analytics, etc.)                  │
└─────────────────────────────────────────────────────────┘
```

## Available Widgets

### Agent Control Widget
**Status:** [PENDING - a3-1]
**Path:** `lens/widgets/reploid/agent-control/`

Main control interface for approving agent operations.

#### Features:
- **Real-time Status Display**: Shows current agent state (IDLE, PLANNING, AWAITING_APPROVAL, etc.)
- **Context Approval Interface**: Preview and approve/reject context curation
- **Proposal Approval Interface**: Review and approve/reject code changes
- **Progress Tracking**: Visual indicators for agent progress
- **Error Handling**: Display errors and allow recovery

#### MCP Tools Used:
- `get_agent_status` - Poll for current state
- `get_context_preview` - Fetch context awaiting approval
- `approve_context` / `reject_context` - Context approval actions
- `get_proposal_preview` - Fetch proposal awaiting approval
- `approve_proposal` / `reject_proposal` - Proposal approval actions

#### UI Components:
```
┌──────────────────────────────────────────┐
│        Agent Control Widget              │
├──────────────────────────────────────────┤
│  Status: AWAITING_CONTEXT_APPROVAL       │
│  ┌────────────────────────────────────┐  │
│  │  Context Preview                   │  │
│  │  ─────────────────                 │  │
│  │  Files: 5                          │  │
│  │  Estimated Tokens: 2,345           │  │
│  │                                    │  │
│  │  • src/main.js                     │  │
│  │  • src/utils.js                    │  │
│  │  • tests/main.test.js              │  │
│  │  ...                               │  │
│  └────────────────────────────────────┘  │
│                                          │
│  [Approve Context]  [Reject & Revise]   │
└──────────────────────────────────────────┘
```

[TODO: Add screenshots once implemented]

#### Usage Example:
```javascript
// Widget initialization
const agentControl = await LensWidget.load('reploid/agent-control');

// Listen for approval requests
agentControl.on('approval-needed', (type, data) => {
  console.log(`Approval needed: ${type}`, data);
});

// Programmatic approval
await agentControl.approveContext();
```

### VFS Explorer Widget
**Status:** [PENDING - a3-2]
**Path:** `lens/widgets/reploid/vfs-explorer/`

Browse and manage artifacts in Reploid's virtual file system.

#### Features:
- **File Tree View**: Navigate VFS hierarchy
- **File Preview**: View file contents
- **Version History**: See previous versions of files
- **Search & Filter**: Find files quickly

#### MCP Tools Used:
- `list_artifacts` - Get file listing
- `read_artifact` - Read file contents
- `get_artifact_history` - View version history
- `diff_artifacts` - Compare versions

[TODO: Add UI mockups and usage examples]

### Diff Viewer Widget
**Status:** [PENDING - a3-3]
**Path:** `lens/widgets/reploid/diff-viewer/`

View and analyze code changes proposed by the agent.

#### Features:
- **Side-by-Side Diff**: Compare old vs new code
- **Unified Diff**: Compact view of changes
- **Syntax Highlighting**: Language-aware highlighting
- **Line-by-Line Navigation**: Jump to specific changes

#### MCP Tools Used:
- `diff_artifacts` - Get diff between versions
- `get_proposal_preview` - Get all changes in proposal

[TODO: Add UI mockups and usage examples]

### Analytics Dashboard Widget
**Status:** [PENDING - a3-4]
**Path:** `lens/widgets/reploid/analytics-dashboard/`

Display metrics and analytics about agent operations.

#### Features:
- **Token Usage Charts**: Visualize token consumption
- **Cost Tracking**: Monitor API costs
- **Session History**: Review past sessions
- **Performance Metrics**: Agent efficiency stats

#### MCP Tools Used:
- `get_session_metrics` - Current session stats
- `get_token_usage` - Token breakdown
- `get_cost_estimate` - Cost calculations
- `export_session_log` - Export audit logs

[TODO: Add UI mockups and usage examples]

## Widget Development Guide

### Creating a New Widget

1. **Create widget directory structure:**
   ```bash
   mkdir -p lens/widgets/reploid/my-widget
   cd lens/widgets/reploid/my-widget
   ```

2. **Create widget manifest (`widget.json`):**
   ```json
   {
     "name": "my-widget",
     "version": "1.0.0",
     "title": "My Widget",
     "description": "Description of what the widget does",
     "entry": "index.html",
     "mcpServers": ["vfs", "workflow"],
     "permissions": ["mcp:call-tools"]
   }
   ```

3. **Create entry HTML (`index.html`):**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>My Widget</title>
     <link rel="stylesheet" href="styles.css">
   </head>
   <body>
     <div id="widget-root">
       <!-- Widget UI goes here -->
     </div>
     <script type="module" src="main.js"></script>
   </body>
   </html>
   ```

4. **Create widget logic (`main.js`):**
   ```javascript
   // Import widget API
   import { LensWidgetAPI } from '../../../core/widget-api.js';

   // Initialize widget
   const widget = new LensWidgetAPI();

   // Call MCP tools
   async function loadData() {
     const result = await widget.callMCPTool('my-tool', {
       param1: 'value1'
     });
     displayData(result);
   }

   // Render UI
   function displayData(data) {
     document.getElementById('widget-root').innerHTML = `
       <pre>${JSON.stringify(data, null, 2)}</pre>
     `;
   }

   // Start widget
   loadData();
   ```

5. **Add styles (`styles.css`):**
   ```css
   #widget-root {
     padding: 1rem;
     font-family: monospace;
   }
   ```

### Widget API Reference

[TODO: Document full Widget API once implemented]

Key methods:
- `widget.callMCPTool(toolName, args)` - Call an MCP tool
- `widget.on(event, handler)` - Listen for events
- `widget.emit(event, data)` - Emit events
- `widget.setState(key, value)` - Persist state
- `widget.getState(key)` - Retrieve state

### Testing Widgets

Create test files in `lens/widgets/reploid/tests/`:

```javascript
// lens/widgets/reploid/tests/my-widget.test.js
import { testWidget } from '../../../core/test-utils.js';

await testWidget('my-widget', {
  mockTools: {
    'my-tool': async (args) => ({ success: true })
  },
  tests: [
    {
      name: 'Widget loads successfully',
      run: async (widget) => {
        const element = widget.querySelector('#widget-root');
        assert(element, 'Root element should exist');
      }
    }
  ]
});
```

Run widget tests:
```bash
# In browser
open http://localhost:8080/lens/widgets/reploid/tests/my-widget.test.html

# Or via command line
node lens/widgets/reploid/tests/my-widget.test.js
```

## Widget Communication

### Widget-to-MCP Communication

Widgets use the Lens Widget API to call MCP tools:

```javascript
// Call a tool
const result = await widget.callMCPTool('read_artifact', {
  path: '/my/file.txt'
});

// Handle errors
try {
  await widget.callMCPTool('invalid-tool', {});
} catch (error) {
  console.error('Tool call failed:', error);
}
```

### Widget-to-Widget Communication

Widgets can communicate via events:

```javascript
// Widget A: Emit event
widgetA.emit('file-selected', { path: '/my/file.txt' });

// Widget B: Listen for event
widgetB.on('file-selected', (data) => {
  console.log('File selected:', data.path);
});
```

## Styling Guidelines

Widgets should use consistent styling:

```css
:root {
  --bg-primary: #1e1e1e;
  --bg-secondary: #2d2d2d;
  --text-primary: #d4d4d4;
  --text-secondary: #808080;
  --accent: #007acc;
  --success: #4ec9b0;
  --warning: #dcdcaa;
  --error: #f44747;
}

.widget-container {
  background: var(--bg-primary);
  color: var(--text-primary);
  border: 1px solid var(--bg-secondary);
  border-radius: 4px;
}

.widget-button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.widget-button:hover {
  opacity: 0.8;
}
```

## Deployment

[TODO: Document widget deployment process]

## Troubleshooting

### Common Issues

**Widget not loading:**
- Check `widget.json` is valid JSON
- Verify entry point file exists
- Check browser console for errors

**MCP tool calls failing:**
- Verify MCP server is running
- Check tool name is correct
- Validate tool arguments match schema

**Widget not updating:**
- Ensure event listeners are registered
- Check for JavaScript errors
- Verify state management is working

[TODO: Add more troubleshooting tips as issues arise]

## Examples

[TODO: Add complete widget examples once implementation is stable]

## References

- [MCP Architecture](./MCP-ARCHITECTURE.md)
- [Reploid Agent Workflow](./AGENT-WORKFLOW.md)
- [Lens Widget Platform Documentation](../../lens/docs/) (TODO)
