# Contributing to MWP

Thank you for your interest in contributing to MWP (Model Context Protocol Widget Protocol)! This document provides guidelines and instructions for contributing to the project.

## Our Philosophy

**MWP enhances existing solutions rather than replacing them.**

We're collaborating with [mcp-ui](https://github.com/idosal/mcp-ui) and the broader MCP ecosystem to bring security, observability, and type safety to MCP visualizations. Our goal is to:

- **Collaborate, not compete** - We build on what works (like mcp-ui's simplicity)
- **Security first** - Add user confirmation and audit trails
- **Stay simple** - Avoid over-engineering, ship working code
- **Community driven** - Work with Anthropic, mcp-ui maintainers, and developers

All contributions should align with this philosophy.

## Table of Contents

- [Our Philosophy](#our-philosophy)
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Submitting Changes](#submitting-changes)
- [Widget Development](#widget-development)
- [Community](#community)

## Code of Conduct

This project adheres to a Code of Conduct that all contributors are expected to follow. Please read [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before contributing.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- pnpm 8.x or higher
- Git

### First-Time Setup

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mwp.git
   cd mwp
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/mwp.git
   ```

4. **Install dependencies**:
   ```bash
   pnpm install
   ```

5. **Build all packages**:
   ```bash
   pnpm build
   ```

6. **Run tests** to verify setup:
   ```bash
   pnpm test
   ```

## Development Setup

### Installing pnpm

If you don't have pnpm installed:

```bash
npm install -g pnpm
```

### Development Commands

```bash
# Install all dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Lint code
pnpm lint

# Fix linting issues
pnpm lint:fix

# Type check
pnpm type-check

# Validate widgets
pnpm validate

# Run specific package script
pnpm --filter @mwp/core build
pnpm --filter @mwp/github-widget test
```

## Project Structure

```
mwp/
├── packages/
│   ├── core/              # Core widget protocol
│   ├── bridge/            # MCP bridge implementation
│   ├── eventbus/          # Event bus system
│   ├── dashboard/         # Dashboard orchestrator
│   ├── widgets/           # Widget implementations
│   │   ├── github/
│   │   ├── playwright/
│   │   ├── filesystem/
│   │   └── ...
│   ├── tools/             # Development tools
│   │   ├── create-mwp-widget/
│   │   ├── validator/
│   │   └── testing/
│   ├── examples/          # Example implementations
│   └── mcp-server/        # MCP server package
├── docs/                  # Documentation
├── .github/               # GitHub configuration
└── scripts/               # Build and utility scripts
```

## Development Workflow

### Creating a New Branch

Always create a new branch for your work:

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feat/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

### Branch Naming Convention

- `feat/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or modifications
- `chore/` - Maintenance tasks
- `widget/` - New widget or widget improvements

### Keeping Your Branch Updated

```bash
# Fetch upstream changes
git fetch upstream

# Rebase your branch
git rebase upstream/main

# If there are conflicts, resolve them and continue
git rebase --continue

# Force push to your fork
git push origin your-branch-name --force-with-lease
```

## Coding Standards

### TypeScript

- Use TypeScript for all code
- Enable strict mode in `tsconfig.json`
- Provide explicit types for function parameters and return values
- Use interfaces for object shapes
- Prefer `const` over `let`, avoid `var`

### Code Style

We use ESLint and Prettier for code formatting:

```bash
# Check formatting
pnpm lint

# Auto-fix issues
pnpm lint:fix
```

### Naming Conventions

- **Classes**: PascalCase (`GitHubWidget`, `MCPBridge`)
- **Functions/Methods**: camelCase (`fetchRepositories`, `initialize`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_RETRIES`, `DEFAULT_TIMEOUT`)
- **Interfaces**: PascalCase with 'I' prefix optional (`IWidget` or `Widget`)
- **Type Aliases**: PascalCase (`WidgetConfig`, `EventHandler`)
- **Files**: kebab-case (`github-widget.ts`, `event-bus.ts`)

### Code Organization

```typescript
// 1. Imports - grouped and sorted
import { EventBus } from '@mwp/eventbus';
import { MCPBridge } from '@mwp/bridge';

// 2. Type definitions
interface WidgetConfig {
  name: string;
  version: string;
}

// 3. Constants
const DEFAULT_CONFIG: WidgetConfig = {
  name: 'default',
  version: '1.0.0',
};

// 4. Class or function implementation
export class MyWidget extends HTMLElement {
  // Private fields first
  private config: WidgetConfig;

  // Constructor
  constructor(config?: Partial<WidgetConfig>) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // Public methods
  public initialize(): void {
    // Implementation
  }

  // Private methods
  private render(): void {
    // Implementation
  }
}
```

### Comments and Documentation

- Use JSDoc comments for public APIs
- Add inline comments for complex logic
- Explain **why**, not **what** (the code shows what)

```typescript
/**
 * Fetches repositories from the GitHub API
 * @param username - GitHub username
 * @param options - Optional fetch configuration
 * @returns Promise resolving to repository data
 * @throws {Error} When API request fails
 */
async function fetchRepositories(
  username: string,
  options?: FetchOptions
): Promise<Repository[]> {
  // Use cache if available to reduce API calls
  const cached = this.cache.get(username);
  if (cached && !options?.force) {
    return cached;
  }

  // Implementation...
}
```

## Testing Guidelines

### Test Requirements

- All new features **must** include tests
- Bug fixes **should** include regression tests
- Aim for >80% code coverage
- Tests should be fast and deterministic

### Writing Tests

Use the `@mwp/testing` package for widget testing:

```typescript
import { describe, it, expect } from 'vitest';
import { mountWidget, waitForRender } from '@mwp/testing';
import { MyWidget } from './widget';

describe('MyWidget', () => {
  it('should render successfully', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    await waitForRender(widget);

    expect(widget.shadowRoot).toBeTruthy();
    expect(widget.shadowRoot?.querySelector('.widget-content')).toBeTruthy();
  });

  it('should call MCP tool on button click', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    const button = widget.shadowRoot?.querySelector('button');
    button?.click();

    expect(mocks.mcpBridge.callTool).toHaveBeenCalledWith('tool_name', {
      // Expected params
    });
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter @mwp/core test

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage
```

## Documentation

### Documentation Requirements

When making changes, update documentation:

1. **README.md** - Package-level documentation
2. **API Documentation** - JSDoc comments in code
3. **Examples** - Usage examples for new features
4. **CHANGELOG.md** - Document all changes

### Writing Good Documentation

- Be clear and concise
- Provide code examples
- Include both simple and advanced use cases
- Explain common pitfalls
- Link to related documentation

### Example Documentation Template

```markdown
## Feature Name

Brief description of the feature.

### Usage

\`\`\`typescript
// Basic example
const widget = new MyWidget({
  option: 'value'
});
\`\`\`

### Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| option | string | 'default' | Description |

### Advanced Usage

\`\`\`typescript
// Advanced example with all options
const widget = new MyWidget({
  option: 'value',
  advanced: true
});
\`\`\`

### Common Issues

**Problem**: Description of problem
**Solution**: How to solve it
```

## Submitting Changes

### Before Submitting

1. **Run all checks**:
   ```bash
   pnpm lint
   pnpm type-check
   pnpm test
   pnpm build
   ```

2. **Update CHANGELOG.md**:
   ```markdown
   ## [Unreleased]

   ### Added
   - New feature description

   ### Fixed
   - Bug fix description
   ```

3. **Ensure commits follow convention**:
   ```
   feat: add new widget feature
   fix: resolve issue with event handling
   docs: update README with new examples
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI configuration changes
- `chore`: Other changes (dependencies, etc.)
- `revert`: Revert a previous commit
- `widget`: Widget-specific changes

**Examples:**
```bash
feat(github-widget): add pull request filtering

Added ability to filter pull requests by status and labels.
Includes new UI controls and API integration.

Closes #123

fix(core): resolve memory leak in event handlers

The event listeners were not being properly cleaned up,
causing memory leaks in long-running applications.

Fixes #456

docs(contributing): add testing guidelines

Added comprehensive testing guidelines including examples
and best practices for widget testing.
```

### Creating a Pull Request

1. **Push your changes**:
   ```bash
   git push origin your-branch-name
   ```

2. **Open a Pull Request** on GitHub

3. **Fill out the PR template** completely

4. **Link related issues** using keywords:
   - `Closes #123` - Closes an issue
   - `Fixes #456` - Fixes a bug
   - `Relates to #789` - Related to an issue

5. **Request review** from maintainers

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Comments added for complex logic
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings
- [ ] CHANGELOG.md updated
- [ ] Branch is up-to-date with main
- [ ] Commit messages follow convention

### Review Process

1. **Automated checks** run on your PR
2. **Maintainers review** your code
3. **Address feedback** by pushing new commits
4. **PR is approved** and merged

## Contributing to Ecosystem Compatibility

### Working with mcp-ui

We're actively collaborating with mcp-ui. Here's how you can help:

**1. Test MWP widgets in mcp-ui**
```bash
# Use the mcp-ui adapter
import { adaptMWPForMcpUI } from '@mwp/mcp-ui-adapter';
const html = adaptMWPForMcpUI(createMyWidget, serverInfo);
```

**2. Report compatibility issues**
- Open issues tagged with `mcp-ui-compatibility`
- Include both MWP and mcp-ui versions
- Provide reproduction steps

**3. Contribute to the adapter**
- Improve postMessage protocol translation
- Add support for new mcp-ui features
- Enhance theme compatibility

**4. Submit improvements to mcp-ui**
- Security enhancements (user confirmation UI)
- Governance features (audit logging)
- Theming system improvements

### Working with Anthropic MCP Team

Before adding major features:

1. **Check with MCP team** - Open a discussion about alignment with MCP roadmap
2. **Follow MCP spec** - All widgets must work with standard MCP servers
3. **Contribute back** - Submit security best practices to MCP documentation

## Widget Development

### Creating a New Widget

Use the CLI tool to scaffold a new widget:

```bash
npx create-mwp-widget my-widget
```

### Widget Requirements

All widgets must:

1. **Extend HTMLElement** or use Custom Elements API
2. **Implement widget interface** from `@mwp/core`
3. **Include all required files**:
   - `src/widget.ts` - Widget implementation
   - `src/index.ts` - Entry point
   - `src/types.ts` - Type definitions
   - `src/config.ts` - Configuration
   - `src/styles.ts` - Styles
   - `package.json` - Package configuration
   - `README.md` - Documentation
   - `tsconfig.json` - TypeScript config

4. **Follow naming convention**: `@mwp/[name]-widget`
5. **Include comprehensive tests**
6. **Provide documentation** with examples
7. **Pass validation**: `pnpm validate`

### Widget Implementation Pattern

```typescript
import { EventBus } from '@mwp/eventbus';
import { MCPBridge } from '@mwp/bridge';
import { Configuration } from '@mwp/core';

export class MyWidget extends HTMLElement {
  private eventBus: EventBus;
  private mcpBridge: MCPBridge;
  private config: Configuration;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  setDependencies(
    eventBus: EventBus,
    mcpBridge: MCPBridge,
    config: Configuration
  ): void {
    this.eventBus = eventBus;
    this.mcpBridge = mcpBridge;
    this.config = config;
  }

  async initialize(): Promise<void> {
    await this.loadInitialData();
    this.render();
    this.attachEventListeners();
  }

  private async loadInitialData(): Promise<void> {
    // Load data via MCP bridge
  }

  private render(): void {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>${this.styles}</style>
      <div class="widget">
        <!-- Widget content -->
      </div>
    `;
  }

  private attachEventListeners(): void {
    // Attach listeners
  }

  getHealth(): { status: string; message?: string } {
    return { status: 'healthy' };
  }

  destroy(): void {
    // Cleanup
  }
}
```

### Widget Testing

```typescript
import { describe, it, expect } from 'vitest';
import { mountWidget, testData } from '@mwp/testing';
import { MyWidget } from './widget';

describe('MyWidget', () => {
  it('should initialize with MCP bridge', async () => {
    const { widget, mocks } = await mountWidget(MyWidget);

    expect(widget.getHealth().status).toBe('healthy');
  });

  it('should handle tool responses', async () => {
    const { widget, mocks } = await mountWidget(MyWidget, {
      bridgeResponses: {
        'tool_name': { data: testData.githubRepo() }
      }
    });

    // Test widget behavior
  });
});
```

## Community

### Getting Help

- **GitHub Discussions**: For general questions and ideas - https://github.com/[org]/mwp/discussions
- **GitHub Issues**: For bug reports and feature requests
- **mcp-ui Community**: https://github.com/idosal/mcp-ui - For questions about compatibility
- **MCP Forum**: https://github.com/modelcontextprotocol/mcp/discussions - For MCP spec questions

### Communication Guidelines

- **Be collaborative** - Seek to enhance existing work, not replace it
- **Be respectful and constructive** - Remember we're all learning
- **Search before posting** - Check existing issues/discussions first
- **Provide clear reproduction steps** - Help others help you
- **Credit others' work** - Acknowledge mcp-ui, Anthropic, and community contributors
- **Follow up** - Respond to questions on your issues and PRs

### Priority Areas for Contribution

We especially welcome help in these areas:

1. **mcp-ui Compatibility** - Test widgets in mcp-ui, report issues, improve adapter
2. **Security Enhancements** - Audit confirmation flows, test CSP policies, document best practices
3. **Widget Development** - Build widgets for popular MCP servers (GitHub, Filesystem, etc.)
4. **Documentation** - Examples, tutorials, video demos
5. **Testing** - Integration tests, accessibility tests, performance benchmarks

### Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Project documentation
- mcp-ui collaboration notes (for cross-project contributions)

### Related Projects

We're part of a larger ecosystem:

- **mcp-ui** - https://github.com/idosal/mcp-ui - The original MCP visualization project
- **Model Context Protocol** - https://github.com/modelcontextprotocol/mcp - The underlying protocol
- **Claude Desktop** - Where many users experience MCP

When contributing, consider how your work can benefit the entire ecosystem, not just MWP.

---

Thank you for contributing to MWP! Your efforts help make MCP more secure, observable, and accessible for everyone.
