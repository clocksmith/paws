# Contributing to MCP-WP

Thank you for your interest in contributing to MCP-WP (Model Context Protocol Widget Protocol)! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

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
   git clone https://github.com/YOUR_USERNAME/mcp-wp.git
   cd mcp-wp
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/mcp-wp.git
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
pnpm --filter @mcp-wp/core build
pnpm --filter @mcp-wp/github-widget test
```

## Project Structure

```
mcp-wp/
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
│   │   ├── create-mcp-widget/
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
import { EventBus } from '@mcp-wp/eventbus';
import { MCPBridge } from '@mcp-wp/bridge';

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

Use the `@mcp-wp/testing` package for widget testing:

```typescript
import { describe, it, expect } from 'vitest';
import { mountWidget, waitForRender } from '@mcp-wp/testing';
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
pnpm --filter @mcp-wp/core test

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

## Widget Development

### Creating a New Widget

Use the CLI tool to scaffold a new widget:

```bash
npx create-mcp-widget my-widget
```

### Widget Requirements

All widgets must:

1. **Extend HTMLElement** or use Custom Elements API
2. **Implement widget interface** from `@mcp-wp/core`
3. **Include all required files**:
   - `src/widget.ts` - Widget implementation
   - `src/index.ts` - Entry point
   - `src/types.ts` - Type definitions
   - `src/config.ts` - Configuration
   - `src/styles.ts` - Styles
   - `package.json` - Package configuration
   - `README.md` - Documentation
   - `tsconfig.json` - TypeScript config

4. **Follow naming convention**: `@mcp-wp/[name]-widget`
5. **Include comprehensive tests**
6. **Provide documentation** with examples
7. **Pass validation**: `pnpm validate`

### Widget Implementation Pattern

```typescript
import { EventBus } from '@mcp-wp/eventbus';
import { MCPBridge } from '@mcp-wp/bridge';
import { Configuration } from '@mcp-wp/core';

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
import { mountWidget, testData } from '@mcp-wp/testing';
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

- **Discord**: Join our [Discord community](https://discord.gg/mcp-wp)
- **Stack Overflow**: Tag questions with `mcp-wp`
- **GitHub Discussions**: For general questions and ideas
- **GitHub Issues**: For bug reports and feature requests

### Communication Guidelines

- Be respectful and constructive
- Search existing issues/discussions before posting
- Provide clear reproduction steps for bugs
- Include relevant code and error messages
- Follow up on your issues and PRs

### Recognition

Contributors are recognized in:
- README.md contributors section
- Release notes
- Project documentation

Thank you for contributing to MCP-WP! Your efforts help make this project better for everyone.
