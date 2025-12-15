# PAWS

> **STATUS: Archived (November 2025)**
>
> PAWS was built for 1M+ context windows: bundle your codebase, paste it in,
> get changes back. The concept works, but the ecosystem evolved differently:
>
> ### Why archived?
>
> 1. **Agentic tools absorbed the workflow** — Claude Code, Cursor, and
>    Antigravity bundle context automatically as part of their agent loops.
>    The manual CATS→LLM→DOGS pipeline became a single command.
>
> 2. **MCP became the standard** — Even with large contexts, the industry
>    chose dynamic fetching over static bundling. 10,000+ MCP servers exist.
>
> 3. **The middle got squeezed**:
>    - Small projects → just paste files, no tooling needed
>    - Large projects → agents with smart selection win
>    - Medium projects → agents work fine and are more flexible
>
> ### Why not delete it?
>
> Bundling still has value that agents don't provide:
>
> - **Portable artifacts**: Share context via PRs, issues, handoffs
> - **Reproducibility**: Frozen snapshot of exactly what the LLM saw
> - **Web UI workflows**: Works without MCP integration
> - **Determinism**: Same input every time, easier debugging
>
> If context windows reach 10M+ with efficient retrieval, "bundle everything"
> may outperform multi-turn agent tool-calling on latency and cost.

---

**P**repare **A**rtifacts **W**ith **S**WAP (**S**treamlined **W**rite **A**fter **P**AWS)

Multi-agent code generation with competitive LLM workflows. Core tools bundle and apply changes (`cats`/`dogs`), while arena mode enables model competition with automated testing.

→ [Full CLI Documentation](packages/cli-js/README.md)

---

## License

MIT
