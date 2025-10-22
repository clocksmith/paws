# MCP-WP Widget Roadmap

This document tracks the development of official MCP server widgets for the MCP Widget Protocol.

## Overview

**Goal**: Ship production-ready widgets for the most popular MCP servers, demonstrating MCP-WP capabilities and providing immediate value to users.

**Success Metrics**:
- 50+ widgets in registry by Month 3
- >80% test coverage for all official widgets
- <200ms initial render time
- WCAG 2.1 Level AA compliance

---

## Widget Priority Tiers

### Tier 1: Launch Widgets (Weeks 1-4) 🚀

**Target**: 8 widgets by launch (Week 4)
**Purpose**: Demonstrate core MCP-WP capabilities, cover most popular servers

| Widget | MCP Server | Status | Package | Priority | Notes |
|--------|------------|--------|---------|----------|-------|
| **GitHub** | `@modelcontextprotocol/server-github` | 🔴 Not Started | `@mcp-wp/widget-github` | P0 | Most popular MCP server |
| **Playwright** | `@modelcontextprotocol/server-playwright` | 🔴 Not Started | `@mcp-wp/widget-playwright` | P0 | Browser automation |
| **Sequential Thinking** | `@modelcontextprotocol/server-sequential-thinking` | 🔴 Not Started | `@mcp-wp/widget-sequential-thinking` | P0 | AI reasoning visualization |
| **Brave Search** | `@modelcontextprotocol/server-brave-search` | 🔴 Not Started | `@mcp-wp/widget-brave` | P0 | Web search |
| **Filesystem** | `@modelcontextprotocol/server-filesystem` | 🔴 Not Started | `@mcp-wp/widget-filesystem` | P0 | File operations |
| **Memory** | `@modelcontextprotocol/server-memory` | 🔴 Not Started | `@mcp-wp/widget-memory` | P0 | Knowledge graph (official ref) |
| **Fetch** | `@modelcontextprotocol/server-fetch` | 🔴 Not Started | `@mcp-wp/widget-fetch` | P0 | Web content (official ref) |
| **Everything** | `@modelcontextprotocol/server-everything` | 🟢 Complete | `@mcp-wp/widget-everything` | P1 | Demo all MCP features |

**Tier 1 Requirements**:
- ✅ Full MCP specification compliance
- ✅ <200ms initial render
- ✅ >80% test coverage
- ✅ WCAG 2.1 AA accessibility
- ✅ Comprehensive README with screenshots
- ✅ Example usage in demos

---

### Tier 2: Enterprise Widgets (Weeks 5-8) 💼

**Target**: 6 additional widgets (14 total by Month 2)
**Purpose**: Show enterprise/business use cases, drive adoption

| Widget | MCP Server | Status | Package | Priority | Notes |
|--------|------------|--------|---------|----------|-------|
| **Supabase** | `@modelcontextprotocol/server-supabase` | 🟢 Complete | `@mcp-wp/widget-supabase` | P1 | Database + Auth |
| **Stripe** | Community server | 🟢 Complete | `@mcp-wp/widget-stripe` | P1 | Payments |
| **Notion** | Community server | 🔴 Not Started | `@mcp-wp/widget-notion` | P1 | Productivity |
| **Slack** | `@modelcontextprotocol/server-slack` | 🔴 Not Started | `@mcp-wp/widget-slack` | P1 | Communication |
| **AWS** | `@modelcontextprotocol/server-aws-kb-retrieval` | 🔴 Not Started | `@mcp-wp/widget-aws` | P2 | Cloud infra |
| **Git** | `@modelcontextprotocol/server-git` | 🔴 Not Started | `@mcp-wp/widget-git` | P2 | Version control |

**Tier 2 Requirements**:
- ✅ Same as Tier 1
- ✅ Enterprise documentation (deployment, security, compliance)
- ✅ Integration examples with other widgets

---

### Tier 3: Community & Ecosystem (Months 3-6) 🌍

**Target**: 40+ community widgets
**Purpose**: Ecosystem expansion, long-tail coverage

| Category | Examples | Status | Notes |
|----------|----------|--------|-------|
| **Data & Analytics** | ClickHouse, DuckDB, Neo4j, Milvus | 🔵 Planned | Database widgets |
| **DevOps** | Kubernetes, Docker, Sentry, Grafana | 🔵 Planned | Operations tools |
| **Research** | Tavily, Exa, Perplexity | 🔵 Planned | AI research |
| **Web Scraping** | Firecrawl, Browserbase, Apify | 🔵 Planned | Data extraction |
| **Productivity** | Jira, Trello, Asana, Taskade | 🔵 Planned | Project management |
| **Finance** | PayPal, Ramp, Norman | 🔵 Planned | Financial ops |

**Tier 3 Requirements**:
- ✅ Community-driven development
- ✅ Official certification available
- ✅ Widget marketplace listing

---

## Widget Implementation Guide

### Step 1: Create Widget Package

```bash
cd packages/widgets
pnpm create-mcp-widget <widget-name>

# This creates:
# packages/widgets/<widget-name>/
#   ├── src/
#   │   ├── index.ts        # Widget factory export
#   │   ├── widget.ts       # Web Component implementation
#   │   ├── types.ts        # TypeScript types
#   │   └── styles.css      # Component styles
#   ├── test/
#   │   ├── widget.test.ts  # Unit tests
#   │   └── integration.test.ts
#   ├── package.json
#   ├── README.md
#   ├── tsconfig.json
#   └── vite.config.ts
```

### Step 2: Implement Widget Factory

```typescript
// packages/widgets/<name>/src/index.ts
import type { WidgetFactory, Dependencies, MCPServerInfo } from '@mcp-wp/core';
import { MyMCPWidget } from './widget.js';

export default function createMCPWidget(
  dependencies: Dependencies,
  mcpServerInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = dependencies;

  // Register custom element
  if (!customElements.get('my-mcp-widget')) {
    customElements.define('my-mcp-widget', MyMCPWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('Widget initialized');
      },
      async destroy() {
        console.log('Widget destroyed');
      },
      async refresh() {
        console.log('Widget refreshed');
      }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'my-mcp-widget',
      displayName: 'My MCP Widget',
      description: 'Widget for My MCP Server',
      capabilities: {
        tools: mcpServerInfo.capabilities.tools,
        resources: mcpServerInfo.capabilities.resources,
        prompts: mcpServerInfo.capabilities.prompts
      }
    }
  };
}
```

### Step 3: Implement Web Component

```typescript
// packages/widgets/<name>/src/widget.ts
import { EventBus, MCPBridge } from '@mcp-wp/core';

export class MyMCPWidget extends HTMLElement {
  private eventBus: EventBus;
  private mcpBridge: MCPBridge;
  private shadowRoot: ShadowRoot;

  constructor() {
    super();
    this.shadowRoot = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  disconnectedCallback() {
    // Cleanup
  }

  private render() {
    this.shadowRoot.innerHTML = `
      <style>
        /* Component styles */
      </style>
      <div class="widget">
        <h3>My MCP Widget</h3>
        <button id="invoke-tool">Invoke Tool</button>
      </div>
    `;
  }

  private setupEventListeners() {
    const button = this.shadowRoot.querySelector('#invoke-tool');
    button?.addEventListener('click', () => {
      this.eventBus.emit('mcp:tool:invoke-requested', {
        serverName: 'my-server',
        toolName: 'my_tool',
        args: { /* ... */ }
      });
    });
  }
}
```

### Step 4: Write Tests

```typescript
// packages/widgets/<name>/test/widget.test.ts
import { describe, it, expect } from 'vitest';
import createMCPWidget from '../src/index.js';

describe('MyMCPWidget', () => {
  it('should initialize successfully', async () => {
    const widget = createMCPWidget(mockDependencies, mockServerInfo);
    await widget.api.initialize();
    expect(widget.widget.element).toBe('my-mcp-widget');
  });

  it('should emit tool invocation event', () => {
    // Test event emission
  });

  it('should render within 200ms', async () => {
    // Performance test
  });

  it('should meet WCAG 2.1 AA', async () => {
    // Accessibility test
  });
});
```

### Step 5: Documentation

```markdown
# @mcp-wp/widget-<name>

MCP-WP widget for [MCP Server Name].

## Installation

\`\`\`bash
pnpm add @mcp-wp/widget-<name>
\`\`\`

## Usage

\`\`\`javascript
import createWidget from '@mcp-wp/widget-<name>';

const widget = createWidget(dependencies, serverInfo);
await widget.api.initialize();
\`\`\`

## Features

- Tool invocation with user confirmation
- Resource browsing
- Prompt templates
- Real-time updates

## Screenshots

![Screenshot](./screenshots/main.png)

## Development

See [DEVELOPMENT.md](./DEVELOPMENT.md)
```

---

## Widget Certification Process

### 1. Self-Assessment

Use `@mcp-wp/validator` to check compliance:

```bash
pnpm mcp-wp-validator validate packages/widgets/my-widget
```

**Checks**:
- ✅ Widget factory exports default function
- ✅ Returns correct interface shape
- ✅ Bundle size <500KB gzipped
- ✅ Initial render <500ms
- ✅ Test coverage >80%
- ✅ WCAG 2.1 AA compliance

### 2. Submit for Review

Create PR with:
- [ ] Widget implementation
- [ ] Tests with >80% coverage
- [ ] README with screenshots
- [ ] Example usage in demo
- [ ] CHANGELOG entry

### 3. Certification Levels

- **🟢 Certified** - Passes all requirements, official endorsement
- **🟡 Community** - Passes basic requirements, community-maintained
- **🔴 Experimental** - Early stage, use at own risk

### 4. Certification Badge

Certified widgets receive:
- Badge in README (`[![MCP-WP Certified](https://img.shields.io/badge/MCP--WP-Certified-green)]()`)
- Listing in official widget directory
- Featured in dashboard widget picker

---

## Widget Dependencies

### Required Dependencies

```json
{
  "dependencies": {
    "@mcp-wp/core": "workspace:*"
  },
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  }
}
```

### Optional Dependencies

```json
{
  "dependencies": {
    "@mcp-wp/bridge": "workspace:*",    // If using shared bridge
    "@mcp-wp/eventbus": "workspace:*",  // If using shared eventbus
    "lit": "^3.0.0",                    // If using Lit for components
    "chart.js": "^4.0.0"                // If rendering charts
  }
}
```

---

## Performance Budgets

Per MCP-WP Section 18:

| Metric | Required | Target | Measurement |
|--------|----------|--------|-------------|
| Bundle Size | <500KB gzipped | <100KB | `pnpm build && gzip -c dist/index.js \| wc -c` |
| Initial Render | <500ms | <200ms | Lighthouse performance |
| Memory Usage | <20MB | <10MB | Chrome DevTools Memory Profiler |
| Test Coverage | >80% | >90% | Vitest coverage report |

---

## Accessibility Checklist

Per MCP-WP Section 11.5 (WCAG 2.1 AA):

- [ ] All interactive elements keyboard accessible
- [ ] Focus indicators visible
- [ ] ARIA labels on controls
- [ ] Color contrast ratios meet standards
- [ ] Screen reader tested (NVDA, JAWS, VoiceOver)
- [ ] Form validation provides clear feedback
- [ ] Error messages are descriptive
- [ ] Skip links for navigation

---

## Widget Categories

### Data Visualization
- Charts, graphs, timelines
- Examples: GitHub stats, Stripe analytics

### Form & Input
- Tool invocation forms
- JSON Schema-based forms
- Examples: Create GitHub issue, Send Slack message

### Content Browser
- Resource listings
- File explorers
- Examples: Filesystem browser, Notion pages

### Activity Monitor
- Event logs
- Real-time updates
- Examples: Server activity, Sequential Thinking steps

### Configuration
- Settings panels
- Permission management
- Examples: Server config, Widget settings

---

## Contributing Widgets

### For Official Widgets (Tier 1-2)

1. Check roadmap for open slots
2. Comment on tracking issue
3. Get assigned
4. Implement per guide above
5. Submit PR for review
6. Receive certification

### For Community Widgets (Tier 3)

1. Create widget in own repo
2. Submit to widget registry
3. Request community certification
4. Get listed in marketplace

### Widget Bounties

Selected high-priority widgets have bounties:
- **$500** - Tier 1 widgets
- **$300** - Tier 2 widgets
- **$100** - Tier 3 widgets

See [BOUNTIES.md](./BOUNTIES.md) for details.

---

## Status Legend

- 🔴 **Not Started** - No work begun
- 🟡 **In Progress** - Active development
- 🟢 **Completed** - Implemented and certified
- 🔵 **Planned** - Roadmapped for future
- ⚫ **On Hold** - Blocked or deprioritized

---

## Next Steps

1. **Week 1**: Begin Tier 1 widgets (GitHub, Playwright, Sequential Thinking)
2. **Week 2**: Complete Tier 1 batch 1, begin batch 2 (Brave, Filesystem, Memory)
3. **Week 3**: Complete Tier 1 batch 2, begin Fetch, Everything
4. **Week 4**: Polish and prepare for launch
5. **Weeks 5-8**: Tier 2 enterprise widgets

---

**Last Updated**: 2025-10-21
**Tracking**: See [GitHub Project Board](https://github.com/[org]/mcp-widget-protocol/projects/1)
