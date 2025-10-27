# @mwp/eventbus

Production-ready EventBus implementation for MCP Widget Protocol.

## Overview

This package provides a robust, type-safe event bus with:

- **Type Safety** - Full TypeScript support with typed events
- **Memory Leak Prevention** - Automatic cleanup and unsubscribe functions
- **Priority Handlers** - Control handler execution order
- **Event Filtering** - Conditional event handling
- **Event History** - Debug mode with event history
- **Promise Support** - Wait for events with `waitFor()`
- **Wildcard Support** - Subscribe to event patterns
- **Performance** - Optimized for high-frequency events

## Installation

```bash
pnpm add @mwp/eventbus
```

## Usage

### Basic Usage

```typescript
import { EventBus } from '@mwp/eventbus';

// Create EventBus instance
const eventBus = new EventBus();

// Subscribe to events
const unsubscribe = eventBus.on('mcp:tool:invoked', (data) => {
  console.log('Tool invoked:', data);
});

// Emit events
eventBus.emit('mcp:tool:invoked', {
  serverName: 'github',
  toolName: 'create_issue',
  result: { /* ... */ },
});

// Unsubscribe when done
unsubscribe();
```

### Typed Events

```typescript
import type { MCPEvent, EventPayload } from '@mwp/core';

// Type-safe event handling
eventBus.on('mcp:tool:invoked', (data: EventPayload<'mcp:tool:invoked'>) => {
  console.log('Server:', data.serverName);
  console.log('Tool:', data.toolName);
  console.log('Result:', data.result);
});
```

### One-Time Subscriptions

```typescript
// Handler called once then automatically unsubscribed
eventBus.once('mcp:server:connected', (data) => {
  console.log('Server connected:', data);
});
```

### Priority Handlers

```typescript
// Higher priority handlers called first
eventBus.on('mcp:tool:error', handler1, { priority: 10 });
eventBus.on('mcp:tool:error', handler2, { priority: 5 });
eventBus.on('mcp:tool:error', handler3); // priority: 0 (default)

// Execution order: handler1 → handler2 → handler3
```

### Event Filtering

```typescript
// Only handle events matching filter
eventBus.on(
  'mcp:tool:invoked',
  (data) => {
    console.log('GitHub tool invoked:', data);
  },
  {
    filter: (data) => data.serverName === 'github',
  }
);
```

### Async Handlers

```typescript
// Async handlers supported
eventBus.on('mcp:resource:read', async (data) => {
  await processResource(data.content);
});

// Errors in async handlers are caught and logged
```

### Wait for Events

```typescript
// Wait for event with timeout
try {
  const data = await eventBus.waitFor('mcp:server:connected', 5000);
  console.log('Server connected:', data);
} catch (error) {
  console.error('Timeout waiting for connection');
}
```

### Event History (Debug Mode)

```typescript
// Enable event history
const eventBus = new EventBus({
  maxHistorySize: 100,
  logEvents: true,
});

// Get event history
const history = eventBus.getHistory();
console.log('Last 100 events:', history);

// Filter history
const toolEvents = eventBus.getHistory(
  (entry) => entry.event.startsWith('mcp:tool:')
);

// Clear history
eventBus.clearHistory();
```

## API

### Class: EventBus

#### Constructor

```typescript
new EventBus(options?: EventBusOptions)
```

**Options:**
- `maxHistorySize` - Maximum event history size (default: 100, 0 to disable)
- `logEvents` - Log events to console (default: false)
- `validatePayloads` - Validate event payloads (default: false)

#### Methods

##### emit(event, data, metadata?)

Emit an event.

```typescript
eventBus.emit('mcp:tool:invoked', {
  serverName: 'github',
  toolName: 'create_issue',
  result: { /* ... */ },
});
```

##### on(event, handler, options?): UnsubscribeFunction

Subscribe to an event.

```typescript
const unsubscribe = eventBus.on(
  'mcp:tool:invoked',
  (data) => console.log(data),
  {
    filter: (data) => data.serverName === 'github',
    priority: 10,
    once: false,
  }
);
```

**Options:**
- `filter` - Filter function (event only fires if filter returns true)
- `priority` - Handler priority (higher = earlier execution)
- `once` - Call handler once then unsubscribe

##### off(event, handler)

Unsubscribe from an event.

```typescript
eventBus.off('mcp:tool:invoked', handler);
```

##### once(event, handler): UnsubscribeFunction

Subscribe to an event (one-time).

```typescript
eventBus.once('mcp:server:connected', (data) => {
  console.log('Connected:', data);
});
```

##### removeAllListeners(event?)

Remove all handlers for an event (or all events).

```typescript
// Remove all handlers for specific event
eventBus.removeAllListeners('mcp:tool:invoked');

// Remove all handlers for all events
eventBus.removeAllListeners();
```

##### listenerCount(event): number

Get number of listeners for an event.

```typescript
const count = eventBus.listenerCount('mcp:tool:invoked');
console.log(`${count} listeners`);
```

##### eventNames(): string[]

Get all event names with listeners.

```typescript
const events = eventBus.eventNames();
console.log('Events with listeners:', events);
```

##### waitFor<T>(event, timeout?): Promise<T>

Wait for event (returns promise).

```typescript
const data = await eventBus.waitFor('mcp:server:connected', 5000);
```

##### getHistory(filter?): EventHistoryEntry[]

Get event history.

```typescript
const history = eventBus.getHistory();

// With filter
const errorEvents = eventBus.getHistory(
  (entry) => entry.event.includes(':error')
);
```

##### clearHistory()

Clear event history.

```typescript
eventBus.clearHistory();
```

##### getStats()

Get EventBus statistics.

```typescript
const stats = eventBus.getStats();
console.log('Total handlers:', stats.totalHandlers);
console.log('Total events:', stats.totalEvents);
console.log('History size:', stats.historySize);
```

## Memory Management

The EventBus is designed to prevent memory leaks:

### Always Unsubscribe

```typescript
class MyWidget {
  private unsubscribers: UnsubscribeFunction[] = [];

  initialize() {
    this.unsubscribers.push(
      eventBus.on('mcp:tool:invoked', this.handleToolInvoked)
    );
  }

  destroy() {
    // Unsubscribe all
    this.unsubscribers.forEach(unsub => unsub());
    this.unsubscribers = [];
  }
}
```

### Use `once()` for One-Time Events

```typescript
// Automatically unsubscribes after first call
eventBus.once('mcp:server:connected', handler);
```

### Remove All Listeners on Cleanup

```typescript
// Component cleanup
eventBus.removeAllListeners('my-widget:*');
```

## Performance

The EventBus is optimized for high-frequency events:

- **O(1) event emission** - Constant time lookup
- **Lazy handler sorting** - Only sorts when priority handlers exist
- **No memory allocation** - Reuses handler sets
- **Async error handling** - Doesn't block on async handlers

## Best Practices

### 1. Type Your Handlers

```typescript
import type { EventPayload } from '@mwp/core';

eventBus.on('mcp:tool:invoked', (data: EventPayload<'mcp:tool:invoked'>) => {
  // Fully typed!
});
```

### 2. Always Clean Up

```typescript
const unsubscribe = eventBus.on('event', handler);

// Later
unsubscribe();
```

### 3. Use Priority for Critical Handlers

```typescript
// Error handlers should run first
eventBus.on('mcp:tool:error', errorHandler, { priority: 100 });
```

### 4. Filter at Subscription

```typescript
// More efficient than filtering in handler
eventBus.on('mcp:tool:invoked', handler, {
  filter: (data) => data.serverName === 'github',
});
```

### 5. Use `once()` for Init Events

```typescript
eventBus.once('dashboard:ready', () => {
  // Initialize widget
});
```

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage
```

## License

MIT
