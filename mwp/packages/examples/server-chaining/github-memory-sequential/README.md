# GitHub → Memory → Sequential-Thinking Chain

This scenario demonstrates a review loop where GitHub pull requests are summarised, persisted, and then critiqued by the Sequential-Thinking server.

## Flow Overview

1. **Inspect PR** in the GitHub widget, select _Generate Summary_.
2. **Summary stored**: Memory widget captures the generated synopsis in the `code-review` collection.
3. **Critique run**: Sequential-Thinking widget auto-loads the latest memory entry and executes the `code_critique` prompt.
4. **Result**: Critical feedback and action items appear in the Sequential-Thinking conversation panel.

## Dashboard Layout

| Column | Widget | Purpose |
| ------ | ------ | ------- |
| 0-5 (wide) | GitHub Review | Pull request browsing, diff inspection, summary trigger |
| 6-8 | Memory Archive | Displays stored summaries (synced with GitHub) |
| 9-11 | Sequential-Thinking | Consumes stored summary for critique |

## Error Handling

- **Summary failure**: Retries twice with exponential backoff (1.5s). If failure persists, an entry is appended to Memory with the error payload.
- **Sequential prompt failure**: The widget surfaces the error and keeps the previous analysis so reviewers can retry manually.

## Expected Output

After completing the loop you should see:

- **Memory widget** entry titled `PR <number> summary` with tags `github`, `summary`.
- **Sequential-Thinking transcript** beginning with the summary context followed by critique bullet points.
- **GitHub widget annotation** labelled “Critiqued” thanks to the memory update confirmation.

## Run the Scenario

```bash
pnpm --filter examples:dashboards dev
# Visit http://localhost:5173/multi-widget.html?config=server-chaining/github-memory-sequential/dashboard.config.json
```

> Ensure you have GitHub and Sequential-Thinking MCP servers configured and authenticated via `.mcp-servers.json`.

## Extending

- Swap the prompt to `code_regression` for regression testing.
- Push summaries to multiple memory collections (e.g., `release-notes`).
- Emit additional events to notify chat-based assistants or ticketing systems.
