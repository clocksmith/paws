# create-mwp-widget

Interactive CLI for scaffolding new MWP widgets.

## Usage

### Quick Start

```bash
# With npm
npm create mcp-widget

# With npx
npx create-mwp-widget

# With specific name
npx create-mwp-widget my-awesome-widget
```

### Interactive Mode

The CLI will prompt you for:

1. **Widget name** - Name for your widget package (e.g., `my-widget`)
2. **Display name** - Human-readable name (e.g., "My Awesome Widget")
3. **Description** - Brief description of what your widget does
4. **MCP server** - Which MCP server this widget connects to
5. **Category** - Widget category (data-management, dev-tools, ai-tools, etc.)
6. **Author** - Your name or organization
7. **License** - Package license (MIT, Apache-2.0, etc.)

### What Gets Created

```
my-widget/
├── package.json          # Package configuration
├── README.md             # Widget documentation
├── tsconfig.json         # TypeScript configuration
├── vite.config.ts        # Build configuration
└── src/
    ├── index.ts          # Widget factory export
    ├── types.ts          # TypeScript type definitions
    ├── widget.ts         # Main widget implementation
    └── styles.ts         # Widget styles
```

## Features

- ✅ **Interactive prompts** - Guided widget creation
- ✅ **TypeScript templates** - Full type safety out of the box
- ✅ **Build configuration** - Vite setup for fast development
- ✅ **Best practices** - Follows MWP conventions
- ✅ **Dependency injection** - Pre-configured EventBus, MCPBridge, Configuration
- ✅ **Shadow DOM** - Scoped styles and encapsulation
- ✅ **Examples** - Commented code showing common patterns

## Templates

### Basic Widget

Simple widget template with minimal setup:
- State management
- Event handling
- Basic rendering
- Tool invocation

### Advanced Widget

Feature-rich template with:
- Complex state management
- Multiple views/tabs
- Search and filtering
- Export functionality
- Keyboard shortcuts

### Data Visualization

Specialized for data display:
- Chart integration
- Table rendering
- Real-time updates
- Export to CSV/JSON

## Development Workflow

After creating your widget:

```bash
cd my-widget

# Install dependencies
pnpm install

# Start development
pnpm dev

# Build for production
pnpm build

# Type check
pnpm typecheck
```

## CLI Options

```bash
create-mwp-widget [name] [options]

Options:
  -t, --template <type>    Template to use (basic|advanced|data-viz)
  -d, --directory <path>   Target directory
  --no-install             Skip dependency installation
  --no-git                 Skip git initialization
  -y, --yes                Skip prompts, use defaults
  -h, --help               Display help
```

## Examples

### Create with specific template

```bash
npx create-mwp-widget my-widget --template advanced
```

### Create in specific directory

```bash
npx create-mwp-widget my-widget --directory ./widgets
```

### Skip installation

```bash
npx create-mwp-widget my-widget --no-install
```

### Use all defaults

```bash
npx create-mwp-widget my-widget --yes
```

## Widget Development Guide

### 1. Implement Widget Class

```typescript
export class MyWidget extends HTMLElement {
  private eventBus!: EventBus;
  private mcpBridge!: MCPBridge;

  setDependencies(eventBus: EventBus, mcpBridge: MCPBridge, config: Configuration) {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
  }

  async initialize(): Promise<void> {
    // Setup your widget
  }
}
```

### 2. Add Widget Factory

```typescript
const createMyWidget: WidgetFactoryFunction = (deps, serverInfo) => {
  const widget = document.createElement('my-widget') as MyWidget;
  widget.setDependencies(deps.EventBus, deps.MCPBridge, deps.Configuration);

  return {
    api: { /* widget API */ },
    widget: { /* widget metadata */ }
  };
};
```

### 3. Test Locally

Use the testing utilities:

```typescript
import { mockEventBus, mockMCPBridge } from '@mwp/testing';

const widget = new MyWidget();
widget.setDependencies(mockEventBus(), mockMCPBridge(), mockConfig());
```

### 4. Publish

```bash
# Build
pnpm build

# Publish to npm
npm publish
```

## Troubleshooting

### "Invalid widget name"
- Widget names must be lowercase
- Use hyphens, not spaces or underscores
- Cannot start with a dot or underscore

### "Directory already exists"
- Choose a different name
- Or use `--directory` to specify a different path

### Build errors
- Run `pnpm install` to ensure dependencies are installed
- Check TypeScript version compatibility
- Verify `tsconfig.json` extends from `@mwp/core`

## Contributing

Found a bug or want to add a template? Please open an issue or PR!

## License

MIT
