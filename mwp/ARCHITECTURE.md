# MCP Widget Protocol - Architecture

This document describes the complete architecture of the MCP Widget Protocol monorepo.

## Table of Contents

1. [Overview](#overview)
2. [Repository Structure](#repository-structure)
3. [Package Dependencies](#package-dependencies)
4. [Development Workflow](#development-workflow)
5. [Build & Release](#build--release)

---

## Overview

The MWP monorepo contains:

1. **Specification** - Protocol documentation and formal verification
2. **Reference Implementation** - Dashboard host and official widgets
3. **MCP Server** - Dashboard-as-a-service via MCP
4. **Tooling** - CLI tools, validators, testing utilities
5. **Examples** - Server chaining, custom widgets, demo apps

---

## Repository Structure

```
mwp/
├── specification/                     # Protocol Specification
│   ├── MWP.md                        # Main protocol specification
│   ├── PROTOCOL-EDITING.md           # How to edit the specification
│   ├── protocol-sections/            # Editable spec sections
│   │   ├── manifest.json
│   │   ├── 00-front-matter.md
│   │   └── ...
│   └── packaging/                    # Assembly/split scripts
│       ├── assemble-protocol.js
│       └── split-protocol.js
│
├── formal-verification/              # TLA+ and Alloy specs
│   ├── README.md
│   └── ...
│
├── research/                         # Research documents & analysis
│   └── ...
│
├── packages/                          # Monorepo packages
│   ├── widgets/                      # Official MCP server widgets
│   │   ├── github/                   # @mwp/widget-github
│   │   ├── playwright/               # @mwp/widget-playwright
│   │   ├── filesystem/               # @mwp/widget-filesystem
│   │   ├── brave/                    # @mwp/widget-brave
│   │   ├── sequential-thinking/      # @mwp/widget-sequential-thinking
│   │   ├── memory/                   # @mwp/widget-memory
│   │   ├── fetch/                    # @mwp/widget-fetch
│   │   ├── everything/               # @mwp/widget-everything
│   │   ├── supabase/                 # @mwp/widget-supabase
│   │   └── stripe/                   # @mwp/widget-stripe
│   │
│   ├── dashboard/                    # Reference dashboard host (web app)
│   │   ├── src/host/                 # Host implementation
│   │   ├── src/ui/                   # Dashboard UI components
│   │   └── src/demo/                 # Pre-configured demos
│   │
│   ├── mcp-server/                   # MCP server for dashboard orchestration
│   │   ├── src/server.ts             # Main MCP server
│   │   ├── src/tools/                # Tools (create_widget, etc.)
│   │   ├── src/resources/            # Resources (dashboard://)
│   │   └── src/prompts/              # Prompts (show activity, etc.)
│   │
│   ├── core/                         # Shared types and utilities
│   │   ├── src/types/                # TypeScript definitions
│   │   ├── src/schemas/              # JSON Schemas
│   │   └── src/utils/                # Shared utilities
│   │
│   ├── bridge/                       # Reusable MCPBridge implementation
│   ├── eventbus/                     # Reusable EventBus implementation
│   │
│   ├── tools/                        # Developer tooling
│   │   ├── create-mwp-widget/        # Widget scaffolding CLI
│   │   ├── validator/                # Conformance validator
│   │   └── testing/                  # Testing utilities
│   │
│   └── examples/                     # Example implementations
│       ├── server-chaining/          # MCP server orchestration
│       ├── dashboards/               # Full dashboard examples
│       └── custom-widgets/           # Custom widget examples
│
├── demos/                            # Complete demo applications
│   ├── full-stack-devops/           # DevOps monitoring dashboard
│   ├── ai-researcher/               # AI-powered research tool
│   └── business-intelligence/       # BI dashboard
│
├── .github/                          # GitHub configuration
│   ├── ISSUE_TEMPLATE/              # Issue templates
│   └── workflows/                   # CI/CD workflows
│
├── split-protocol.js                # Protocol management tools
├── assemble-protocol.js
├── pnpm-workspace.yaml              # Monorepo configuration
└── package.json                     # Root package.json
```

---

## Package Dependencies

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────┐
│                         @mwp/core                        │
│  (Types, Schemas, Utilities - Foundation for everything)   │
└─────────────────────────────────────────────────────────────┘
                             ▲
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
┌─────┴─────┐          ┌─────┴─────┐          ┌─────┴─────┐
│@mwp/   │          │@mwp/   │          │@mwp/   │
│ bridge    │          │ eventbus  │          │ testing   │
└───────────┘          └───────────┘          └───────────┘
      ▲                      ▲                      ▲
      │                      │                      │
      └──────────────────────┼──────────────────────┘
                             │
      ┌──────────────────────┼──────────────────────┐
      │                      │                      │
┌─────┴─────────┐     ┌──────┴───────┐     ┌───────┴────────┐
│  @mwp/     │     │  @mwp/    │     │  @mwp/      │
│  dashboard    │     │  widget-*    │     │  mcp-server    │
│  (Host)       │     │  (Widgets)   │     │  (MCP Server)  │
└───────────────┘     └──────────────┘     └────────────────┘
```

### Package Relationships

| Package | Depends On | Used By | Purpose |
|---------|-----------|---------|---------|
| `@mwp/core` | - | All packages | Foundation types, schemas, utils |
| `@mwp/bridge` | core | dashboard, mcp-server, widgets | MCPBridge implementation |
| `@mwp/eventbus` | core | dashboard, widgets | EventBus implementation |
| `@mwp/testing` | core, bridge, eventbus | widgets, dashboard | Testing utilities |
| `@mwp/dashboard` | core, bridge, eventbus | - | Web dashboard host |
| `@mwp/widget-*` | core, bridge, eventbus | dashboard | Official widgets |
| `@mwp/mcp-server` | core, bridge | - | Dashboard MCP server |
| `@mwp/create-mwp-widget` | core | - | Widget scaffolding CLI |
| `@mwp/validator` | core | CI/CD | Conformance validator |

---

## Development Workflow

### Initial Setup

```bash
# Clone repository
git clone https://github.com/[org]/mcp-widget-protocol
cd mcp-widget-protocol

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test
```

### Working on a Widget

```bash
# Navigate to widget
cd packages/widgets/github

# Install dependencies (if needed)
pnpm install

# Start development mode
pnpm dev

# Run tests
pnpm test

# Build
pnpm build
```

### Working on the Dashboard

```bash
# Navigate to dashboard
cd packages/dashboard

# Start development server
pnpm dev

# Opens browser at http://localhost:3000
# Hot reload enabled
```

### Creating a New Widget

```bash
# Use the scaffolding tool
pnpm create-mwp-widget my-custom-widget

# This creates:
# packages/widgets/my-custom-widget/
#   ├── src/
#   │   ├── index.ts
#   │   ├── widget.ts
#   │   └── types.ts
#   ├── test/
#   ├── package.json
#   └── README.md
```

### Testing Server Chaining

```bash
# Run server chaining examples
cd packages/examples/server-chaining

# Example: GitHub → Memory pipeline
pnpm run example:github-memory

# Example: Fetch → Supabase pipeline
pnpm run example:fetch-supabase
```

### Running Demo Applications

```bash
# Full-stack DevOps dashboard
cd demos/full-stack-devops
pnpm install
pnpm dev

# AI Researcher dashboard
cd demos/ai-researcher
pnpm install
pnpm dev

# Business Intelligence dashboard
cd demos/business-intelligence
pnpm install
pnpm dev
```

---

## Build & Release

### Build Process

```bash
# Build all packages in dependency order
pnpm build

# Build specific package
pnpm --filter @mwp/widget-github build

# Clean and rebuild
pnpm clean && pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test --watch

# Run conformance tests
pnpm --filter @mwp/validator test

# Run integration tests
pnpm test:integration
```

### Release Process

1. **Update Version Numbers**
   ```bash
   # Use changesets for versioning
   pnpm changeset
   pnpm changeset version
   ```

2. **Build & Test**
   ```bash
   pnpm build
   pnpm test
   pnpm typecheck
   ```

3. **Publish to npm**
   ```bash
   # Dry run
   pnpm publish -r --dry-run

   # Actual publish
   pnpm publish -r --access public
   ```

4. **Create Git Tag**
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

### Continuous Integration

GitHub Actions workflows automatically:
- Run tests on every PR
- Build all packages
- Run conformance tests
- Check TypeScript types
- Lint code
- Publish to npm on release tags

---

## Package Purposes

### Widgets (`packages/widgets/`)

Each widget package:
- Implements MWP specification
- Connects to a specific MCP server
- Provides visual interface for MCP primitives (tools, resources, prompts)
- Includes tests with >80% coverage
- Meets performance budget (<200ms render)
- Passes WCAG 2.1 AA accessibility

**Widget Lifecycle:**
```
1. Dashboard loads widget via WidgetFactory
2. Widget registers custom element
3. Widget receives dependencies (EventBus, MCPBridge, Configuration)
4. Widget renders UI in Shadow DOM
5. Widget emits events for tool invocations
6. Host intercepts, shows confirmation, executes via MCP
```

### Dashboard (`packages/dashboard/`)

Reference implementation of MWP host:
- Loads and initializes widgets
- Provides EventBus for inter-widget communication
- Provides MCPBridge for MCP server communication
- Manages permissions and user confirmations
- Implements enhanced theme system (60 design tokens)
- Provides accessibility helpers

**Host Responsibilities:**
- Widget discovery and loading
- MCP server connection management
- Event routing between widgets
- User confirmation for tool invocations
- Security and permission enforcement
- Theme injection and dynamic theming

**Enhanced Theming:**
- **Base tokens** (18): Core colors, spacing, typography, borders
- **Extended tokens** (42): Accent colors, data viz colors, semantic gradients
- **Theme helpers**: `adaptColor()`, `getContrastRatio()`, `generateColorScale()`
- **Scoped theming**: Support for widgets with custom branding
- **Accessibility**: WCAG AA/AAA contrast checking

### MCP Server (`packages/mcp-server/`)

MCP server that orchestrates dashboards:
- **Tools**: create_widget, list_widgets, render_dashboard, chain_servers
- **Resources**: dashboard://widgets/*, dashboard://config
- **Prompts**: Pre-configured dashboard templates

**Use Case:**
```bash
# Claude Desktop connects to MWP Dashboard MCP Server
# User says: "Create a DevOps dashboard for my GitHub repo"
# Server:
#   1. Creates dashboard configuration
#   2. Connects to GitHub MCP server
#   3. Adds GitHub widget
#   4. Returns dashboard URL
```

### Core (`packages/core/`)

Foundation for all packages:
- TypeScript type definitions (ThemeInterface, ColorAdaptationOptions, etc.)
- JSON Schemas for widget metadata
- Shared utilities:
  - `theme-helpers.ts`: Color adaptation, contrast calculation, color scales
  - Validation and parsing utilities
- Protocol constants and enums
- Enhanced theming utilities (ThemeUtils class)

### Bridge & EventBus (`packages/bridge/`, `packages/eventbus/`)

Reusable implementations of host dependencies:
- Can be used by custom dashboard implementations
- Tested and conformant to specification
- Extensible for custom behavior

### Tools (`packages/tools/`)

Developer tooling:
- **create-mwp-widget**: Scaffold new widgets
- **validator**: Validate widget manifests
- **testing**: Testing utilities and fixtures

---

## Technology Stack

### Core Technologies
- **TypeScript 5.3+** - Type safety
- **Node.js 18+** - Runtime
- **pnpm** - Package manager (workspaces)
- **Vite** - Build tool (dashboard)
- **Vitest** - Testing framework

### Widget Technologies
- **Web Components** - Custom Elements API
- **Shadow DOM** - Encapsulation
- **Lit** (optional) - Web component helper library

### Dashboard Technologies
- **React** (optional) - UI framework (or vanilla JS)
- **TypeScript** - Type safety
- **Vite** - Dev server and bundler

### MCP Server Technologies
- **@modelcontextprotocol/sdk** - MCP TypeScript SDK
- **stdio transport** - Communication protocol

---

## Security Considerations

### Widget Sandboxing
- Shadow DOM provides CSS/DOM isolation
- No direct MCP server access (only via MCPBridge)
- Permission model enforces capability restrictions

### Tool Invocation Flow
```
Widget emits event → Host intercepts → User confirmation →
Schema validation → MCP server execution → Result returned
```

### Permission Levels
- **Untrusted**: ReadResource + GetPrompt only
- **Community**: + InvokeTool (with confirmation)
- **Verified**: + Subscribe
- **Enterprise**: Full access (audited)

---

## Performance Requirements

Per MWP Specification Section 18:

- **Bundle Size**: <500KB gzipped (target: 100KB)
- **Initial Render**: <500ms (target: 200ms)
- **Memory Usage**: <20MB per widget (target: 10MB)
- **Test Coverage**: >80%

---

## Accessibility Requirements

Per MWP Specification Section 11.5:

- **WCAG 2.1 Level AA** compliance required
- Keyboard navigation support
- ARIA labels and roles
- Color contrast ratios
- Screen reader compatibility

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Pull request process
- Coding standards
- Testing requirements

---

## License

MIT License - See [LICENSE](./LICENSE) file

---

**Last Updated**: 2025-10-21
**MWP Version**: 1.0.0
