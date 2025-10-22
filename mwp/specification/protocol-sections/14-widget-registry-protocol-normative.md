## 14. Widget Registry Protocol (Normative)

### 15.1 Purpose and Scope

**MCP-WP-16.1.1:** This section defines the protocol for discovering, distributing, installing, and updating MCP-WP widgets across host applications.

**MCP-WP-16.1.2:** The registry protocol enables npm-style widget distribution: `mcpwp install @org/github-widget`

**MCP-WP-16.1.3:** Registries MAY be centralized (npm, official registry) or decentralized (GitHub releases, self-hosted).

### 15.2 Widget Package Manifest

**MCP-WP-16.2.1:** Every widget package MUST include a `widget.json` manifest:

```json
{
  "name": "@mcpwp/github-widget",
  "version": "1.2.3",
  "description": "Visual dashboard for GitHub MCP server",
  "bundle": "https://cdn.example.com/github-widget-1.2.3.js",
  "integrity": "sha256-abc123def456...",
  "mcpwpVersion": "1.2.0",
  "dependencies": {
    "@mcpwp/base-components": "^2.0.0"
  },
  "repository": {
    "type": "github",
    "url": "https://github.com/org/github-widget",
    "commit": "a1b2c3d4"
  },
  "license": "MIT",
  "author": {
    "name": "Widget Author",
    "email": "author@example.com",
    "url": "https://example.com"
  },
  "keywords": ["mcp", "github", "widget"],
  "mcpServers": ["github", "github-enterprise"]
}
```

**MCP-WP-16.2.2:** Manifest fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Package name (npm-style scoping) |
| `version` | string | Yes | Semantic version |
| `bundle` | string | Yes | HTTPS URL to widget JavaScript bundle |
| `integrity` | string | Yes | SHA256 hash for integrity verification |
| `mcpwpVersion` | string | Yes | Minimum MCP-WP protocol version |
| `dependencies` | object | No | Other widget dependencies |
| `repository` | object | No | Source code location |
| `mcpServers` | string[] | No | Compatible MCP server names |

### 15.3 Registry Discovery

**MCP-WP-16.3.1:** Hosts SHOULD support multiple registry sources:

1. **Official Registry**: `https://registry.mcpwidgets.dev`
2. **npm Registry**: `https://registry.npmjs.org` (packages with `mcp-widget` keyword)
3. **GitHub Releases**: Direct from GitHub releases API
4. **Custom Registry**: User-configured registry URL

**MCP-WP-16.3.2:** Registry API endpoint: `GET /widgets/{name}` returns widget manifest.

**MCP-WP-16.3.3:** Search endpoint: `GET /widgets?q={query}&server={mcpServer}` returns matching widgets.

### 15.4 Installation Process

**MCP-WP-16.4.1:** Widget installation sequence:

```bash
mcpwp install @mcpwp/github-widget
```

1. Resolve widget name to registry source
2. Fetch `widget.json` manifest
3. Verify `mcpwpVersion` compatibility
4. Resolve dependencies recursively
5. Download bundle from `bundle` URL
6. Verify integrity (SHA256 hash matches `integrity` field)
7. Store bundle in local cache (`~/.mcpwp/widgets/`)
8. Register widget in host configuration

**MCP-WP-16.4.2:** Dependency resolution MUST use semantic versioning ranges.

**MCP-WP-16.4.3:** Circular dependencies MUST be detected and rejected.

**MCP-WP-16.4.4:** If integrity verification fails, installation MUST abort with error.

### 15.5 Update Mechanism

**MCP-WP-16.5.1:** Hosts SHOULD check for widget updates periodically (default: daily).

**MCP-WP-16.5.2:** Update check: Compare local version with latest registry version.

**MCP-WP-16.5.3:** Widget updates MAY be:
- **Automatic** (patch versions: 1.2.3 → 1.2.4)
- **Notify User** (minor versions: 1.2.0 → 1.3.0)
- **Manual Approval** (major versions: 1.0.0 → 2.0.0)

**MCP-WP-16.5.4:** Breaking changes (major version bumps) MUST NOT auto-update.

### 15.6 Integrity Verification

**MCP-WP-16.6.1:** The `integrity` field MUST contain a SHA256 hash:

```
sha256-<base64-encoded-hash>
```

**MCP-WP-16.6.2:** Hosts MUST verify downloaded bundle matches hash before execution.

**MCP-WP-16.6.3:** Verification failure MUST prevent widget loading and log security event.

### 15.7 Caching and Offline Support

**MCP-WP-16.7.1:** Hosts SHOULD cache downloaded widgets locally in:

```
~/.mcpwp/widgets/{name}/{version}/bundle.js
~/.mcpwp/widgets/{name}/{version}/widget.json
```

**MCP-WP-16.7.2:** Cached widgets MUST remain available offline.

**MCP-WP-16.7.3:** Cache invalidation: Remove versions older than 90 days if not actively used.

### 15.8 Uninstallation

**MCP-WP-16.8.1:** Widget removal:

```bash
mcpwp uninstall @mcpwp/github-widget
```

1. Remove from host configuration
2. Call widget's `api.destroy()` for all active instances
3. Remove from DOM
4. Optionally delete cached files (with `--purge` flag)

---
