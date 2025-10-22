# Server Chaining Examples

This examples suite shows how to orchestrate multiple MCP servers together with MWP dashboards. Each scenario includes:

- **Dashboard configuration** wiring the required servers and widgets
- **Execution flow** describing how events move between widgets and servers
- **Error handling patterns** showing retries, fallbacks, and auditing hooks
- **Expected outputs** so you can validate the chain end-to-end

## Scenarios

### 1. GitHub → Memory → Sequential-Thinking (Code Intelligence Loop)
- **Goal:** Review a GitHub pull request, summarize it, and store highlights in the Memory server before handing off to Sequential-Thinking for analysis.
- **Widgets:** `@mwp/widget-github`, `@mwp/widget-memory`, `@mwp/widget-sequential-thinking`
- **Servers:** `server-github`, `server-memory`, `server-sequential-thinking`
- **Key flow:**
  1. GitHub widget emits `mcp:tool:invoke-requested` for `pull_request.diff`
  2. Memory widget ingests the summary via `memory.write`
  3. Sequential-Thinking widget triggers the “Critique” prompt using stored memory URIs

See [`github-memory-sequential/`](./github-memory-sequential) for configuration and walkthrough.

### 2. Fetch → Brave → Memory (Research Pipeline)
- **Goal:** Gather web results for a topic, scrape the most relevant page, and archive structured findings into Memory.
- **Widgets:** `@mwp/widget-brave`, `@mwp/widget-fetch`, `@mwp/widget-memory`
- **Servers:** `server-brave-search`, `server-fetch`, `server-memory`
- **Key flow:**
  1. Brave widget searches for topic (`search.query`)
  2. Selected result triggers Fetch widget (`fetch.url`) to download content
  3. Extracted summary saved into Memory (`memory.write`) and surfaced as resource cards

See [`fetch-brave-memory/`](./fetch-brave-memory) for full setup.

## Error Handling & Retry Patterns

All examples include:
- **Dashboard-level retry logic** using EventBus listeners (`mcp:tool:error` → requeue)
- **Progress notifications** surfaced via `widget:status` messages
- **Audit logging** to the Memory server (`memory.appendLog` tool) for compliance checks

## Running the Examples

1. Install dependencies:
   ```bash
   pnpm install
   ```
2. Start the example dashboard:
   ```bash
   pnpm --filter examples:dashboards dev
   # open with ?config=server-chaining/github-memory-sequential/dashboard.config.json
   ```
3. Follow the scenario instructions in each sub-directory.

## Extending the Patterns

- Add guardrails: gate sensitive tool invocations with confirmation modals
- Multi-branch orchestration: split flows based on brave search result relevance score
- Persistence: log all chained outputs into long-term Memory collections
- Automation: trigger chains via Sequential-Thinking agent hooks instead of manual clicks

Contributions welcome—add new chains or tighten the existing ones with additional tests!
