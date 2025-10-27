# DevOps Control Room

A dashboard for monitoring CI/CD pipelines, smoke tests, and deployment logs in one place.

## Layout

```
+----------------------+-------------------+-------------+
| GitHub Actions (w=5) | Playwright (w=4)  | Logs (w=3)  |
+----------------------+-------------------+-------------+
```

- **GitHub widget** locked to the Actions tab with automatic refresh every two minutes.
- **Playwright widget** runs smoke suites on demand and streams video/trace results.
- **Filesystem widget** tails deployment and Playwright log directories for quick diagnosis.

## Event Wiring

| Source Widget | Event | Target | Purpose |
|---------------|-------|--------|---------|
| Playwright | `playwright:test:completed` | Filesystem | Append concise log line |
| GitHub | `github:workflow:failed` | Toast notification | Alert operators immediately |

## Suggested Workflow

1. Monitor GitHub workflow list for pending/failed jobs.
2. Trigger smoke tests from Playwright widget before deployment.
3. Watch filesystem logs update in real time (deployment output, smoke logs).
4. When failures occur, use toast notification link to jump to offending job.

## Setup

1. Configure `.mcp-servers.json` with GitHub, Playwright, and Filesystem servers.
2. Export `GITHUB_TOKEN` and `FILESYSTEM_ROOT` (log directory) environment variables.
3. Start dashboard: `pnpm dev` and open with `?config=dashboards/devops.config.json`.

## Extensions

- Add Memory widget to archive incident timeline entries.
- Wire Sequential-Thinking to analyze failed pipelines automatically.
- Enable auto-rollbacks by bridging deployment toolings.
