# MWP Demo Applications

This directory contains complete demo applications showcasing MWP in real-world scenarios.

## 🎯 Demos

### 1. AI Researcher (`ai-researcher/`)
**Status**: Planned

A research assistant dashboard combining multiple MCP servers:
- GitHub (code search, issue tracking)
- Brave Search (web research)
- Filesystem (document management)
- Memory (context persistence)

**Use Case**: Academic researchers and developers investigating codebases and documentation.

### 2. Business Intelligence (`business-intelligence/`)
**Status**: Planned

A data analysis dashboard for business metrics:
- Supabase (database queries)
- Stripe (payment analytics)
- Sequential Thinking (analysis workflows)
- Resource Explorer (data visualization)

**Use Case**: Business analysts and data scientists working with operational metrics.

### 3. Full-Stack DevOps (`full-stack-devops/`)
**Status**: Planned

A comprehensive DevOps dashboard:
- GitHub (repository management, CI/CD)
- Playwright (automated testing)
- Filesystem (configuration management)
- Activity Log (system monitoring)

**Use Case**: DevOps engineers and development teams managing infrastructure.

## 📦 Structure

Each demo will include:

```
demo-name/
├── README.md              # Demo documentation
├── package.json           # Dependencies
├── src/
│   ├── index.html        # Main application
│   ├── main.ts           # Application entry point
│   ├── dashboard.ts      # Dashboard configuration
│   └── widgets/          # Custom widgets (if any)
├── config/
│   └── mcp-servers.json  # MCP server configuration
└── screenshots/          # Demo screenshots
```

## 🚀 Running Demos

```bash
# Navigate to demo
cd demos/ai-researcher

# Install dependencies
pnpm install

# Start demo
pnpm dev
```

## 🛠️ Building Your Own Demo

1. Copy a demo template
2. Configure MCP servers in `config/mcp-servers.json`
3. Customize dashboard layout
4. Add custom widgets if needed
5. Test and iterate

See [GETTING-STARTED.md](../GETTING-STARTED.md) for detailed instructions.

## 📚 Resources

- [MWP Specification](../specification/MWP.md)
- [Widget Development](../WIDGET-ROADMAP.md)
- [Dashboard API](../packages/dashboard/README.md)
- [Example Dashboards](../packages/examples/dashboards/README.md)

## 🤝 Contributing

Have an idea for a demo? See [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines.

**Wanted Demos:**
- Healthcare data dashboard
- E-commerce analytics
- Content management system
- Educational platform
- Financial trading terminal

Submit your demo via pull request!
