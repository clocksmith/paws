# Fetch → Brave → Memory Research Pipeline

A research dashboard that chains Brave Search, Fetch content extraction, and Memory archiving.

## Steps

1. Enter a research topic in the Brave widget.
2. Select a promising result – the Fetch widget automatically retrieves the page.
3. Fetch summarizes the content and emits a `memory.write` request.
4. The Memory widget displays the saved summary along with the source URL.

## Error & Retry Logic

- Fetch failures retry once and then trigger a Brave re-search with narrower filters.
- Memory writes are confirmed via `memory:write:succeeded`; failures surface a toast notification.
- All summaries are tagged with the topic, enabling fast lookup in Memory.

## Expected Artifacts

- Memory entry with bullet summary and `sourceUrl` metadata.
- Fetch widget shows the extracted article with highlighted key passages.
- Brave widget annotates visited results for the active session.

## Run

```bash
pnpm --filter examples:dashboards dev
# http://localhost:5173/multi-widget.html?config=server-chaining/fetch-brave-memory/dashboard.config.json
```

Define `BRAVE_API_KEY` and optionally configure Fetch to route through your proxy (`FETCH_HTTP_PROXY`).
