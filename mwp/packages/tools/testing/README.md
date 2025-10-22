# @mcp-wp/testing

Comprehensive testing utilities for MCP-WP widget development. Includes mocks, fixtures, helpers, and test utilities for building robust widget tests.

## Installation

```bash
pnpm add -D @mcp-wp/testing vitest happy-dom
```

## Features

- 🎭 **Mock Dependencies** - Pre-configured mocks for EventBus, MCPBridge, Configuration
- 🏗️ **Test Fixtures** - Ready-to-use widget instances and test data
- 🛠️ **Test Helpers** - Utilities for widget lifecycle, events, and DOM testing
- ⚡ **Fast Setup** - Get testing in seconds with minimal boilerplate
- 📝 **TypeScript** - Full type safety for test assertions
- 🔄 **Async Support** - Helpers for testing async widget operations

## Quick Start

### Basic Widget Test

```typescript
import { describe, it, expect } from 'vitest';
import { createMockDependencies, mountWidget, waitForRender } from '@mcp-wp/testing';
import { MyWidget } from '../src/widget';

describe('MyWidget', () => {
  it('should render successfully', async () => {
    const deps = createMockDependencies();
    const widget = new MyWidget();

    widget.setDependencies(deps.eventBus, deps.mcpBridge, deps.configuration);
    await widget.initialize();

    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot?.querySelector('.widget-header')).toBeTruthy();
  });

  it('should handle tool invocation', async () => {
    const { widget, mocks } = await mountWidget(MyWidget, {
      serverName: 'test-server',
    });

    // Simulate tool result
    mocks.eventBus.emit('mcp:tool:invoked', {
      serverName: 'test-server',
      toolName: 'test_tool',
      result: { success: true },
    });

    await waitForRender(widget);

    expect(widget.shadowRoot?.textContent).toContain('success');
  });
});
```

## API Reference

### Mock Dependencies

#### `createMockDependencies()`

Creates mock instances of all core dependencies:

```typescript
const deps = createMockDependencies();

deps.eventBus.on('event', handler);
deps.eventBus.emit('event', data);

await deps.mcpBridge.callTool('server', 'tool', { args });

deps.configuration.get('key');
deps.configuration.set('key', value);
```

#### `mockEventBus()`

Creates a fully functional mock EventBus:

```typescript
const eventBus = mockEventBus();

// Record emitted events
const events: any[] = [];
eventBus.on('*', (data) => events.push(data));

eventBus.emit('test:event', { foo: 'bar' });

expect(events).toHaveLength(1);
expect(events[0]).toEqual({ foo: 'bar' });
```

#### `mockMCPBridge(options?)`

Creates a mock MCPBridge with customizable responses:

```typescript
const bridge = mockMCPBridge({
  tools: {
    'list_repos': { result: [{ name: 'repo1' }, { name: 'repo2' }] },
    'create_issue': { result: { id: 123, number: 1 } },
  },
  defaultDelay: 10, // Simulate network delay
});

const result = await bridge.callTool('github', 'list_repos', {});
expect(result).toEqual([{ name: 'repo1' }, { name: 'repo2' }]);
```

#### `mockConfiguration(initialData?)`

Creates a mock Configuration store:

```typescript
const config = mockConfiguration({
  widgetTheme: 'dark',
  autoRefresh: true,
});

expect(config.get('widgetTheme')).toBe('dark');

config.set('widgetTheme', 'light');
expect(config.get('widgetTheme')).toBe('light');
```

### Test Helpers

#### `mountWidget(WidgetClass, options?)`

Mounts a widget with mocked dependencies:

```typescript
const { widget, mocks, container } = await mountWidget(MyWidget, {
  serverName: 'test-server',
  serverInfo: {
    serverName: 'test-server',
    protocolVersion: '1.0.0',
    capabilities: { tools: true },
  },
  config: {
    customOption: true,
  },
});

// Widget is initialized and ready to test
expect(widget.shadowRoot).toBeTruthy();

// Access mocks
mocks.eventBus.emit('test', {});
await mocks.mcpBridge.callTool('test', 'tool', {});
```

#### `waitForRender(widget, timeout?)`

Waits for widget to complete rendering:

```typescript
widget.setState({ loading: false });
await waitForRender(widget);

expect(widget.shadowRoot?.querySelector('.content')).toBeTruthy();
```

#### `waitForEvent(eventBus, eventName, timeout?)`

Waits for a specific event to be emitted:

```typescript
const promise = waitForEvent(eventBus, 'widget:loaded');

// Trigger something that emits the event
widget.initialize();

const eventData = await promise;
expect(eventData.widgetId).toBe('test-widget');
```

#### `simulateClick(element)`

Simulates a user click on an element:

```typescript
const button = widget.shadowRoot?.querySelector('button');
simulateClick(button!);

await waitForRender(widget);
expect(widget.state.clicked).toBe(true);
```

#### `simulateInput(element, value)`

Simulates user input in a form field:

```typescript
const input = widget.shadowRoot?.querySelector('input');
simulateInput(input!, 'test value');

expect(widget.state.inputValue).toBe('test value');
```

### Fixtures

#### `createMockServerInfo(overrides?)`

Creates mock MCP server info:

```typescript
const serverInfo = createMockServerInfo({
  serverName: 'github',
  capabilities: {
    tools: true,
    resources: true,
    prompts: false,
  },
});
```

#### `createMockTool(overrides?)`

Creates mock MCP tool metadata:

```typescript
const tool = createMockTool({
  name: 'search',
  description: 'Search for items',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string' },
    },
  },
});
```

#### `createMockResource(overrides?)`

Creates mock MCP resource:

```typescript
const resource = createMockResource({
  uri: 'file:///test.txt',
  name: 'Test File',
  mimeType: 'text/plain',
});
```

### Assertions

#### `expectWidgetToRender(widget)`

Asserts that a widget has rendered successfully:

```typescript
await widget.initialize();
expectWidgetToRender(widget);
```

#### `expectEventEmitted(eventBus, eventName, data?)`

Asserts that an event was emitted:

```typescript
widget.doSomething();
expectEventEmitted(eventBus, 'widget:action', { action: 'something' });
```

#### `expectToolCalled(bridge, serverName, toolName, args?)`

Asserts that a tool was called:

```typescript
await widget.fetchData();
expectToolCalled(bridge, 'github', 'list_repos', { org: 'test' });
```

## Testing Patterns

### Test Widget Lifecycle

```typescript
describe('Widget Lifecycle', () => {
  it('should initialize properly', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    expect(widget.getStatus().status).toBe('healthy');
    expectEventEmitted(mocks.eventBus, 'widget:initialized');
  });

  it('should clean up on destroy', async () => {
    const { widget } = await mountWidget(MyWidget);

    await widget.destroy();

    expect(widget.shadowRoot?.innerHTML).toBe('');
  });

  it('should refresh data', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    await widget.refresh();

    expectToolCalled(mocks.mcpBridge, 'test-server', 'get_data');
  });
});
```

### Test Event Handling

```typescript
describe('Event Handling', () => {
  it('should respond to tool results', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    mocks.eventBus.emit('mcp:tool:invoked', {
      serverName: 'test-server',
      toolName: 'test',
      result: { data: 'test' },
    });

    await waitForRender(widget);
    expect(widget.state.data).toBe('test');
  });

  it('should handle errors', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    mocks.eventBus.emit('mcp:tool:error', {
      serverName: 'test-server',
      error: new Error('Test error'),
    });

    await waitForRender(widget);
    expect(widget.getStatus().status).toBe('error');
  });
});
```

### Test User Interactions

```typescript
describe('User Interactions', () => {
  it('should handle button clicks', async () => {
    const { widget } = await mountWidget(MyWidget);

    const button = widget.shadowRoot?.querySelector('button')!;
    simulateClick(button);

    await waitForRender(widget);
    expect(widget.state.clicked).toBe(true);
  });

  it('should handle form input', async () => {
    const { widget } = await mountWidget(MyWidget);

    const input = widget.shadowRoot?.querySelector('input')!;
    simulateInput(input, 'test query');

    expect(widget.state.query).toBe('test query');
  });
});
```

### Test Async Operations

```typescript
describe('Async Operations', () => {
  it('should show loading state', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    // Mock slow tool
    mocks.mcpBridge.setToolDelay('slow_tool', 1000);

    const promise = widget.fetchData();

    await waitForRender(widget);
    expect(widget.state.loading).toBe(true);

    await promise;
    expect(widget.state.loading).toBe(false);
  });
});
```

## Configuration

### Vitest Setup

Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
});
```

### Test Setup File

Create `test/setup.ts`:

```typescript
import { beforeAll, afterEach } from 'vitest';
import { cleanup } from '@mcp-wp/testing';

beforeAll(() => {
  // Global setup
});

afterEach(() => {
  cleanup();
});
```

## Best Practices

1. **Use mountWidget** - Simplifies setup and ensures consistent initialization
2. **Wait for renders** - Always await `waitForRender()` after state changes
3. **Test user flows** - Test complete interactions, not just individual methods
4. **Mock external calls** - Use `mockMCPBridge` to avoid real server calls
5. **Clean up** - Destroy widgets after each test to prevent memory leaks
6. **Test error cases** - Don't just test the happy path
7. **Use fixtures** - Reuse test data with fixture creators

## TypeScript

Full TypeScript support with proper typings:

```typescript
import type { MockEventBus, MockMCPBridge } from '@mcp-wp/testing';

const eventBus: MockEventBus = mockEventBus();
const bridge: MockMCPBridge = mockMCPBridge();

// Type-safe mock configuration
bridge.registerTool<{ query: string }, { results: string[] }>(
  'search',
  async (args) => {
    return { results: [`Result for: ${args.query}`] };
  }
);
```

## Examples

See the [examples directory](./examples) for complete widget test suites demonstrating all features.

## License

MIT
