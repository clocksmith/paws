# AI Researcher Workspace

Combines Brave Search, Fetch, Memory, and Sequential-Thinking to support rapid literature reviews.

## Flow

1. **Search** with Brave for the topic of interest.
2. **Scrape** the selected result via Fetch (auto summary enabled).
3. **Store** the summary plus metadata in Memory `research-notes` collection.
4. **Synthesize** with Sequential-Thinking to produce citations or briefs.

## Tips

- Use Memory tags (`web`, `summary`, custom keywords) to cluster findings.
- Trigger the Sequential-Thinking `research_synthesis` prompt after each Memory write.
- Export Memory collection as JSON/Markdown for collaboration.

## Configuration

See [`../ai-researcher.config.json`](../ai-researcher.config.json).
