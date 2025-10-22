# @mwp/widget-memory

**Knowledge Graph and Entity Management Widget**

A Web Component widget for the Memory MCP server, providing visualization and management of entities, relations, and knowledge graphs for persistent memory storage.

## Features

- 🧠 **Entity Management** - Create, read, update entities
- 🔗 **Relation Mapping** - Visualize and manage entity relationships
- 📊 **Knowledge Graph** - Interactive graph visualization
- 🔍 **Entity Search** - Search across all stored entities
- 📝 **Observations** - Add context to entities
- 🏷️ **Entity Types** - Organize entities by type
- 💾 **Persistent Storage** - All data persists across sessions
- ♿ **Accessibility** - WCAG 2.1 AA compliant

## Installation

```bash
pnpm add @mwp/widget-memory
```

## Usage

### Basic Setup

```typescript
import { Dashboard } from '@mwp/dashboard';
import createMemoryWidget from '@mwp/widget-memory';

const dashboard = new Dashboard({
  container: document.getElementById('app')!,
});

await dashboard.initialize();

// Add Memory widget
await dashboard.addWidget({
  factory: createMemoryWidget,
  serverName: 'memory',
  config: {
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
  },
});
```

### MCP Server Configuration

```json
{
  "mcpServers": {
    "memory": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-memory"]
    }
  }
}
```

## Widget API

### Available Tools

The widget provides access to Memory MCP tools:

#### Entity Tools

- **`create_entities`** - Create new entities
  ```typescript
  { entities: Array<{ name: string; entityType: string; observations: string[] }> }
  ```

- **`create_relations`** - Create relations between entities
  ```typescript
  { relations: Array<{ from: string; to: string; relationType: string }> }
  ```

- **`add_observations`** - Add observations to entities
  ```typescript
  { observations: Array<{ entityName: string; contents: string[] }> }
  ```

- **`delete_entities`** - Remove entities
  ```typescript
  { entityNames: string[] }
  ```

- **`delete_observations`** - Remove observations
  ```typescript
  { deletions: Array<{ entityName: string; observations: string[] }> }
  ```

- **`delete_relations`** - Remove relations
  ```typescript
  { relations: Array<{ from: string; to: string; relationType: string }> }
  ```

- **`read_graph`** - Read the entire knowledge graph
  ```typescript
  {}
  ```

- **`search_nodes`** - Search for entities
  ```typescript
  { query: string }
  ```

- **`open_nodes`** - Get details for specific entities
  ```typescript
  { names: string[] }
  ```

## Widget Interface

### Knowledge Graph View

```
┌─────────────────────────────────────────────┐
│ 🧠 Memory & Knowledge Graph                 │
├─────────────────────────────────────────────┤
│ [Search...] [+ Entity] [+ Relation] [Graph] │
├─────────────────────────────────────────────┤
│                                             │
│  ┌─────────┐                                │
│  │  User   │─── knows ───┐                 │
│  │  Alice  │             │                 │
│  └─────────┘             ▼                 │
│      │              ┌─────────┐            │
│      │              │ Project │            │
│  works_on ────────> │   API   │            │
│                     └─────────┘            │
│                          │                  │
│                      uses │                 │
│                          ▼                  │
│                     ┌─────────┐            │
│                     │Language │            │
│                     │TypeScript│            │
│                     └─────────┘            │
│                                             │
│  Entities: 3  Relations: 3                 │
└─────────────────────────────────────────────┘
```

### Entity List View

```
┌─────────────────────────────────────────────┐
│ 🧠 Memory & Knowledge Graph                 │
├─────────────────────────────────────────────┤
│ [List] [Graph]              [+ New Entity]  │
├─────────────────────────────────────────────┤
│                                             │
│  👤 User: Alice                             │
│     • Works at ACME Corp                    │
│     • Expert in TypeScript                  │
│     Relations: knows Bob, works_on API      │
│                                             │
│  📁 Project: API Development                │
│     • Backend REST API                      │
│     • Uses TypeScript                       │
│     Relations: assigned_to Alice            │
│                                             │
│  💻 Language: TypeScript                    │
│     • Strongly typed                        │
│     • Compiled to JavaScript                │
│     Relations: used_in API                  │
│                                             │
└─────────────────────────────────────────────┘
```

## Examples

### Create Entity

```typescript
// Widget provides "New Entity" button
// Or programmatically:
eventBus.emit('widget:action', {
  widgetId: 'memory-widget',
  action: 'create-entity',
  data: {
    entities: [{
      name: 'Alice',
      entityType: 'user',
      observations: [
        'Works at ACME Corp',
        'Expert in TypeScript'
      ]
    }]
  }
});
```

### Create Relation

```typescript
eventBus.emit('widget:action', {
  widgetId: 'memory-widget',
  action: 'create-relation',
  data: {
    relations: [{
      from: 'Alice',
      to: 'Bob',
      relationType: 'knows'
    }]
  }
});
```

### Add Observation

```typescript
eventBus.emit('widget:action', {
  widgetId: 'memory-widget',
  action: 'add-observation',
  data: {
    observations: [{
      entityName: 'Alice',
      contents: ['Completed TypeScript certification']
    }]
  }
});
```

### Search Entities

```typescript
const results = await widget.searchEntities('typescript');
// Returns entities matching the query
```

## Configuration

### Widget Settings

```typescript
await dashboard.addWidget({
  factory: createMemoryWidget,
  serverName: 'memory',
  config: { /* MCP server config */ },
  widgetConfig: {
    // Default view mode
    defaultView: 'graph', // 'graph' | 'list'

    // Graph visualization
    graphLayout: 'force', // 'force' | 'tree' | 'radial'
    showRelationLabels: true,
    animateTransitions: true,

    // Entity display
    groupByType: true,
    showObservations: true,
    maxObservationsDisplay: 5,

    // Colors by entity type
    entityColors: {
      user: '#3b82f6',
      project: '#10b981',
      language: '#f59e0b',
      default: '#6b7280',
    },

    // Search
    searchMinLength: 2,
    searchDebounce: 300,
  },
});
```

## Permissions

```typescript
permissions: {
  tools: {
    scope: 'allowlist',
    patterns: [
      'create_entities',
      'create_relations',
      'add_observations',
      'delete_entities',
      'delete_observations',
      'delete_relations',
      'read_graph',
      'search_nodes',
      'open_nodes',
    ],
  },
}
```

## Events

### Widget Events

```typescript
// Entity created
eventBus.on('memory:entity:created', (data) => {
  console.log('Entity created:', data.entityName);
});

// Relation created
eventBus.on('memory:relation:created', (data) => {
  console.log('Relation:', data.from, data.relationType, data.to);
});

// Observation added
eventBus.on('memory:observation:added', (data) => {
  console.log('Observation added to:', data.entityName);
});

// Graph updated
eventBus.on('memory:graph:updated', (data) => {
  console.log('Graph has', data.entityCount, 'entities');
});

// Search completed
eventBus.on('memory:search:completed', (data) => {
  console.log('Found', data.results.length, 'entities');
});
```

## Styling

```css
memory-widget {
  --memory-primary: #3b82f6;
  --memory-secondary: #60a5fa;
  --memory-surface: #ffffff;
  --memory-text: #24292f;

  /* Graph */
  --memory-node-bg: #ffffff;
  --memory-node-border: #d0d7de;
  --memory-node-selected: #3b82f6;
  --memory-edge-color: #9ca3af;
  --memory-edge-label: #6b7280;

  /* Entity types */
  --memory-user-color: #3b82f6;
  --memory-project-color: #10b981;
  --memory-language-color: #f59e0b;
  --memory-default-color: #6b7280;
}
```

## Accessibility

- Screen reader support for graph navigation
- Keyboard navigation through entities
- ARIA labels for all interactive elements
- Focus indicators
- Semantic HTML structure

### Keyboard Shortcuts

- `↑/↓` - Navigate entities
- `Tab` - Cycle through graph nodes
- `Enter` - Expand/collapse entity details
- `Ctrl/Cmd + F` - Focus search
- `Ctrl/Cmd + N` - New entity
- `Ctrl/Cmd + R` - New relation

## Use Cases

### 1. Personal Knowledge Management

Build a personal knowledge graph:

```typescript
// Create knowledge entities
await memory.createEntities([
  { name: 'React', entityType: 'technology', observations: ['Frontend library'] },
  { name: 'Next.js', entityType: 'framework', observations: ['Built on React'] },
]);

// Create relations
await memory.createRelations([
  { from: 'Next.js', to: 'React', relationType: 'built_on' },
]);
```

### 2. Project Context Memory

Remember project information:

```typescript
// Store project context
await memory.createEntities([
  {
    name: 'API Project',
    entityType: 'project',
    observations: [
      'REST API for mobile app',
      'Uses Express and PostgreSQL',
      'Deployed on AWS'
    ]
  }
]);
```

### 3. Learning Tracker

Track learning progress:

```typescript
// Create learning entities
await memory.createEntities([
  {
    name: 'TypeScript Generics',
    entityType: 'concept',
    observations: [
      'Completed tutorial on 2025-01-15',
      'Key concept: type parameters',
      'Practice project: type-safe API client'
    ]
  }
]);
```

## Advanced Usage

### Custom Graph Layout

```typescript
const widget = dashboard.getWidget('memory-widget');

widget.setGraphLayout({
  layout: 'tree',
  direction: 'TB', // top-to-bottom
  spacing: {
    node: 50,
    rank: 100,
  },
  physics: {
    enabled: true,
    solver: 'forceAtlas2Based',
  },
});
```

### Entity Filtering

```typescript
// Filter entities by type
const projects = widget.filterEntities({ type: 'project' });

// Filter by observation content
const typescript = widget.filterEntities({
  observation: /typescript/i,
});
```

### Export Knowledge Graph

```typescript
// Export entire graph
const graph = await widget.exportGraph('json');

// Export specific entities
const subgraph = await widget.exportGraph('json', {
  entities: ['Alice', 'Bob'],
  includeRelations: true,
});
```

## Performance

- Lazy loading for large graphs (1000+ entities)
- Virtual rendering for entity lists
- Debounced search
- Graph viewport culling
- Efficient relation lookups

## TypeScript

```typescript
import type {
  MemoryWidgetConfig,
  Entity,
  Relation,
  Observation,
  KnowledgeGraph,
} from '@mwp/widget-memory';

const config: MemoryWidgetConfig = {
  defaultView: 'graph',
  graphLayout: 'force',
};
```

## Troubleshooting

### Graph not rendering
- Check MCP server is running
- Verify entities exist via `read_graph`
- Check console for errors

### Performance issues with large graphs
- Enable viewport culling
- Reduce physics simulation quality
- Use list view for large datasets

### Entities not persisting
- Verify MCP server storage location
- Check write permissions
- Review server logs

## License

MIT

## Related

- [@mwp/core](../core) - Core types and utilities
- [@mwp/dashboard](../dashboard) - Widget host
- [Memory MCP Server](https://github.com/modelcontextprotocol/servers/tree/main/src/memory) - Official server
