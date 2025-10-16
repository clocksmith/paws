# REPLOID RFCs (Requests for Change)

This directory contains **proposals for major changes** to REPLOID. RFCs are formal proposals that go through review before implementation.

## RFC Status

| RFC | Title | Status | Completion |
|-----|-------|--------|------------|
| [RFC-001](./rfc-2025-05-10-local-llm-in-browser.md) | Local LLM in Browser | 📋 Proposed | 0% |
| [RFC-002](./rfc-2025-09-07-2025-paws-cli.md) | PAWS CLI Integration | ✅ Completed | 100% |
| [RFC-003](./rfc-2025-09-22-project-phoenix-refactor.md) | Project Phoenix (Architecture) | 🚧 In Progress | 40% |
| [RFC-004](./rfc-2025-09-22-project-sentinel.md) | Project Sentinel (Sentinel Agent) | ✅ Completed | 100% |

## RFC Template

When creating a new RFC, use this structure:

```markdown
# RFC-XXX: Title

**Status:** Proposed | In Progress | Completed | Rejected
**Author:** Name
**Date:** YYYY-MM-DD
**Completion:** X%

## Summary
Brief 2-3 sentence description.

## Motivation
Why is this change needed? What problem does it solve?

## Proposal
Detailed technical proposal.

## Implementation
Step-by-step implementation plan.

## Risks & Considerations
Potential issues and mitigation strategies.

## Alternatives Considered
What other approaches were evaluated and why were they rejected?

## Success Criteria
How do we know when this is successfully implemented?
```

## RFC Process

1. **Draft:** Create RFC document in this directory
2. **Review:** Discussion and feedback
3. **Approval:** Human approval to proceed
4. **Implementation:** Sentinel Agent implements with human oversight
5. **Completion:** Mark as completed, update status tracking

## Note on Blueprints vs RFCs

**Blueprints** (`/blueprints/*.md`) are implemented architectural specifications that define how the system works. They're the agent's knowledge base.

**RFCs** (this directory) are proposals for NEW features or major changes that haven't been implemented yet.

## Related Documents

- [/blueprints](../../blueprints/README.md) - Core system architecture (implemented)
- [/docs/ROADMAP.md](../ROADMAP.md) - Development roadmap
- [/RFC-STATUS.md](../../RFC-STATUS.md) - Project-level status tracking