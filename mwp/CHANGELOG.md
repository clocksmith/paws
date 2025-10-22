# Changelog

All notable changes to the MCP Widget Protocol will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial monorepo structure with pnpm workspaces
- Core packages:
  - `@mwp/core` - Core widget protocol interfaces
  - `@mwp/bridge` - MCP bridge implementation
  - `@mwp/eventbus` - Event bus system
  - `@mwp/dashboard` - Dashboard orchestrator
  - `@mwp/server` - MCP server implementation
- Widget packages:
  - `@mwp/github-widget` - GitHub integration
  - `@mwp/playwright-widget` - Browser automation
  - `@mwp/filesystem-widget` - File system access
  - `@mwp/brave-widget` - Brave Search integration
  - `@mwp/sequential-thinking-widget` - Reasoning chains
  - `@mwp/memory-widget` - Context persistence
  - `@mwp/fetch-widget` - HTTP requests
- Development tools:
  - `@mwp/create-mwp-widget` - Widget scaffolding CLI
  - `@mwp/validator` - Protocol conformance validator
  - `@mwp/testing` - Testing utilities package
- GitHub infrastructure:
  - Issue templates (bug reports, feature requests, widget proposals, documentation)
  - Pull request template
  - CI/CD workflows (testing, linting, building, releasing)
  - Dependabot auto-merge workflow
  - CodeQL security scanning
  - Stale issue management
- Documentation:
  - Complete protocol specification (`specification/MWP.md`)
  - Protocol editing tools (split/assemble scripts)
  - Architecture documentation
  - Getting started guide
  - Contributing guidelines
  - Code of conduct
- Formal verification:
  - TLA+ specifications for protocol safety
  - Alloy models for structural properties
- Research:
  - Competitive analysis of MCP UI solutions
  - Market intelligence data

### Changed
- Reorganized repository into monorepo structure
- Moved protocol specification to `specification/` directory
- Updated all documentation links to reflect new structure

### Fixed
- Protocol assembly/split scripts now use correct paths
- Package.json scripts updated for new directory structure

## [1.0.0] - 2025-01-XX

### Added
- Initial protocol specification version 1.0.0
- Core widget factory contract
- Event bus specification
- MCP bridge interface
- Security requirements
- Protocol versioning scheme

---

## Release Notes Format

### Major Releases (x.0.0)
Breaking changes to protocol contracts. Widgets may need updates.

### Minor Releases (1.x.0)
Backward-compatible additions. New optional features.

### Patch Releases (1.0.x)
Clarifications, bug fixes, documentation improvements.

---

For detailed commit history, see [Git commit log](https://github.com/your-org/mwp/commits/).
