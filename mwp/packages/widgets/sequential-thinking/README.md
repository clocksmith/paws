# @mcp-wp/widget-sequential-thinking

**Sequential Thinking Visualization Widget**

A Web Component widget for the Sequential Thinking MCP server, providing visualization of AI reasoning processes, chain-of-thought steps, and decision trees.

## Features

- 🧠 **Thought Visualization** - Display reasoning steps in sequence
- 🌳 **Decision Trees** - Visualize branching thought processes
- 📊 **Step Analysis** - Analyze each thinking step
- 🔍 **Step Navigation** - Browse through reasoning chain
- 📝 **Annotations** - Add notes to reasoning steps
- 💾 **Export Logs** - Export reasoning for analysis
- ⏱️ **Timing** - Track time per thinking step
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mcp-wp/widget-sequential-thinking
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mcp-wp/dashboard';
import createSequentialThinkingWidget from '@mcp-wp/widget-sequential-thinking';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Sequential Thinking widget
await dashboard.addWidget({
  factory: createSequentialThinkingWidget,
  serverName: 'sequential-thinking',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
  },
});
```

### MCP Server Configuration

```json
{
  "mcpServers": {
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    }
  }
}
```

## Widget API

### Available Tools

The widget provides access to Sequential Thinking MCP tools:

#### Thinking Tools

- **`start_thinking`** - Start a new reasoning session
  ```typescript
  { prompt: string, context?: string }
  ```

- **`add_step`** - Add a reasoning step
  ```typescript
  { sessionId: string, thought: string, conclusion?: string }
  ```

- **`get_session`** - Get reasoning session
  ```typescript
  { sessionId: string }
  ```

## Widget Interface

### Thinking Session View

```
┌─────────────────────────────────────────────┐
│ 🧠 Sequential Thinking                      │
├─────────────────────────────────────────────┤
│ Session: session-123                        │
│ Prompt: "How to solve this problem?"       │
├─────────────────────────────────────────────┤
│                                             │
│  Step 1 (0.2s)                             │
│  💭 First, I need to understand...         │
│  ✓ Conclusion: Problem requires analysis   │
│                                             │
│  Step 2 (0.5s)                             │
│  💭 Breaking down into components...       │
│  ✓ Conclusion: 3 main components          │
│                                             │
│  Step 3 (0.3s)                             │
│  💭 Evaluating each component...           │
│  ⏳ In progress...                          │
│                                             │
│  [+ Add Step] [Export] [New Session]       │
└─────────────────────────────────────────────┘
```

## Examples

### Start Thinking Session

```typescript
// Widget provides "New Session" button
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'thinking-widget',
  action: 'start-session',
  data: {
    prompt: 'How can I optimize this algorithm?',
    context: 'Current complexity is O(n²)'
  }
});
```

### Add Reasoning Step

```typescript
eventBus.emit('widget:action', {
  widgetId: 'thinking-widget',
  action: 'add-step',
  data: {
    sessionId: 'session-123',
    thought: 'Consider using a hash map for O(1) lookup',
    conclusion: 'Hash map approach is viable'
  }
});
```

### Export Session

```typescript
// Export reasoning session to JSON
const session = widget.getCurrentSession();

const exported = {
  sessionId: session.id,
  prompt: session.prompt,
  steps: session.steps.map(s => ({
    thought: s.thought,
    conclusion: s.conclusion,
    duration: s.duration,
  })),
};

downloadJSON(exported, 'reasoning-session.json');
```

## Configuration

### Widget Settings

```typescript
await dashboard.addWidget({
  factory: createSequentialThinkingWidget,
  serverName: 'sequential-thinking',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Display options
    showTimings: true,
    showStepNumbers: true,
    compactMode: false,

    // Auto-scroll to new steps
    autoScroll: true,

    // Maximum steps to display
    maxStepsDisplayed: 50,

    // Enable step annotations
    allowAnnotations: true,

    // Color coding
    colorCode: {
      inProgress: '#f59e0b',
      completed: '#10b981',
      error: '#ef4444',
    },

    // Export format
    exportFormat: 'json', // 'json' | 'markdown' | 'text'
  },
});
```

## Permissions

```typescript
permissions: {
  tools: {
    scope: 'allowlist',
    patterns: [
      'start_thinking',
      'add_step',
      'get_session',
      'list_sessions',
      'thinking_*',
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Session started
eventBus.on('thinking:session:started', (data) => {
  console.log('New session:', data.sessionId);
});

// Step added
eventBus.on('thinking:step:added', (data) => {
  console.log('Step:', data.stepNumber, data.thought);
});

// Step completed
eventBus.on('thinking:step:completed', (data) => {
  console.log('Conclusion:', data.conclusion);
});

// Session exported
eventBus.on('thinking:session:exported', (data) => {
  console.log('Exported:', data.format);
});

// Error
eventBus.on('thinking:error', (data) => {
  console.error('Thinking error:', data.error);
});
```

## Styling

```css
sequential-thinking-widget {
  --thinking-primary: #8b5cf6;
  --thinking-secondary: #a78bfa;
  --thinking-surface: #ffffff;
  --thinking-text: #24292f;

  /* Steps */
  --thinking-step-bg: #f9fafb;
  --thinking-step-border: #e5e7eb;
  --thinking-step-hover: #f3f4f6;

  /* Status colors */
  --thinking-inprogress: #f59e0b;
  --thinking-completed: #10b981;
  --thinking-error: #ef4444;

  /* Timeline */
  --thinking-timeline-color: #d1d5db;
  --thinking-timeline-width: 2px;
}
```

## Accessibility

- Screen reader support for step progression
- Keyboard navigation through steps
- ARIA labels for all interactive elements
- Focus indicators
- Semantic HTML structure

### Keyboard Shortcuts

- `↑/↓` - Navigate steps
- `Enter` - Expand/collapse step
- `Ctrl/Cmd + E` - Export session
- `Ctrl/Cmd + N` - New session

## Use Cases

### 1. AI Debugging

Understand how AI reaches conclusions:

```typescript
// Start debugging session
await thinking.startSession({
  prompt: 'Why did the AI choose option A over B?',
  context: 'Decision context...'
});

// Observe reasoning steps in real-time
```

### 2. Learning AI Reasoning

Study AI thought processes:

```typescript
// Compare different reasoning approaches
const session1 = await thinking.getSession('greedy-approach');
const session2 = await thinking.getSession('optimal-approach');

// Analyze differences
```

### 3. Documentation

Document AI decision-making:

```typescript
// Export for documentation
const exported = thinking.exportSession('markdown');

// Include in project docs
```

## Advanced Usage

### Step Annotations

```typescript
// Add annotations to steps
eventBus.on('thinking:step:added', (data) => {
  if (data.thought.includes('optimization')) {
    widget.annotateStep(data.stepId, {
      note: 'Key optimization insight',
      tags: ['performance', 'critical'],
    });
  }
});
```

### Custom Visualization

```typescript
// Custom step renderer
const widget = dashboard.getWidget('thinking-widget');

widget.setStepRenderer((step) => {
  return `
    <div class="custom-step">
      <h4>Step ${step.number}</h4>
      <p>${step.thought}</p>
      ${step.conclusion ? `<strong>${step.conclusion}</strong>` : ''}
      <span class="duration">${step.duration}ms</span>
    </div>
  `;
});
```

### Session Comparison

```typescript
// Compare multiple reasoning sessions
const sessions = [
  await widget.getSession('session-1'),
  await widget.getSession('session-2'),
];

const comparison = {
  totalSteps: sessions.map(s => s.steps.length),
  totalTime: sessions.map(s => s.totalDuration),
  conclusions: sessions.map(s => s.finalConclusion),
};

console.table(comparison);
```

## Performance

- Lazy rendering for large step counts
- Virtual scrolling for 100+ steps
- Step caching
- Debounced updates
- Efficient DOM updates

## TypeScript

```typescript
import type {
  ThinkingWidgetConfig,
  ThinkingSession,
  ThinkingStep,
} from '@mcp-wp/widget-sequential-thinking';

const config: ThinkingWidgetConfig = {
  showTimings: true,
  maxStepsDisplayed: 100,
};
```

## Troubleshooting

### Steps not appearing
- Check MCP server is running
- Verify session ID is correct
- Check console for errors

### Performance issues with many steps
- Reduce `maxStepsDisplayed`
- Enable compact mode
- Disable timings display

## License

MIT

## Related

- [@mcp-wp/core](../core) - Core types and utilities
- [@mcp-wp/dashboard](../dashboard) - Widget host
- [Sequential Thinking MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequential-thinking) - Official server
