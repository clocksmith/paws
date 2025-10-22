# Outreach to mcp-ui Maintainers

## Contact Information

**Primary Maintainer**: Ido Salomon
- **GitHub**: https://github.com/idosal
- **Project**: https://github.com/idosal/mcp-ui
- **Contact Method**: GitHub issue or email (if available from profile)

## Outreach Timeline

- **Week 1**: Initial contact via GitHub issue
- **Week 1-2**: Follow-up on GitHub Discussions
- **Week 2**: Email if no response
- **Week 3**: Decision point - proceed with or without formal collaboration

## Message Template: GitHub Issue

**Title**: Collaboration Proposal: MWP Security & Governance Extensions for mcp-ui

---

### Message Body

Hi @idosal,

First, thank you for building mcp-ui! It's been incredibly valuable for the MCP community, and we love how simple and practical your approach is (the iframe model is brilliant for its simplicity).

We've been working on **MCP Widget Protocol (MWP)**, which started as a separate project but has evolved into something we think could be better positioned as **enhancements to mcp-ui** rather than a competing solution.

### What We've Built

We've implemented three things that might be useful for mcp-ui:

1. **Security Layer** - User confirmation before tool execution with visual dialogs
2. **Event System** - Audit logging for all MCP operations (helpful for enterprise use cases)
3. **Type-Safe SDK** - TypeScript widget development with full type safety

All of these work _on top of_ your iframe model - we're not proposing to replace anything that works.

### Demo

We have a working GitHub widget demo that shows:
- User confirmation before `create_issue` tool execution
- Event logging for observability
- Full TypeScript integration

You can see it here: [link to demo]

### What We're Proposing

**Option 1: Contribute directly to mcp-ui**
- We submit PRs to mcp-ui adding security/governance features
- Position as "mcp-ui 2.0" with production-ready security
- We help maintain these features long-term

**Option 2: mcp-ui + MWP as optional extension**
- mcp-ui stays simple (iframe HTML)
- MWP provides optional security layer for enterprise users
- Compatible via adapter we've built

**Option 3: Keep as separate projects**
- We document compatibility story clearly
- Cross-link in both projects' READMEs
- Share learnings and avoid fragmentation

### Why Collaborate?

We believe the MCP ecosystem benefits from:
- **One visualization solution** that everyone can contribute to
- **Avoiding fragmentation** (multiple competing approaches)
- **Combining strengths** (mcp-ui's simplicity + MWP's security)

Shopify is using mcp-ui in production (awesome!), and enterprises need security features like confirmation dialogs and audit logs. We think we can help add those without sacrificing the simplicity that makes mcp-ui great.

### Next Steps

We'd love to:
1. **Jump on a call** to demo what we've built (15-30 minutes)
2. **Get your thoughts** on collaboration approach
3. **Coordinate efforts** so the community benefits from both projects

No pressure at all - if you prefer to keep mcp-ui focused on simplicity and let MWP handle the enterprise stuff, that's totally fine. We'll make sure to document compatibility and give mcp-ui credit as the original inspiration.

What do you think?

Thanks for your time,
[Your Name]

**Links:**
- MWP Repo: [GitHub URL]
- Simplified Spec: [Link to MWP-SIMPLE.md]
- Demo: [Link to demo]
- Compatibility Adapter: [Link to mcp-ui-adapter package]

---

## Follow-Up Strategy

### If Positive Response
1. Schedule 30-minute video call
2. Demo GitHub widget with security features
3. Discuss concrete PRs to mcp-ui
4. Set up shared Slack/Discord channel
5. Create collaboration roadmap

### If Neutral Response
1. Thank them for considering
2. Offer to document compatibility clearly
3. Propose cross-linking in READMEs
4. Keep communication channel open
5. Continue developing independently but reference mcp-ui

### If No Response After 2 Weeks
1. Send friendly follow-up on GitHub Discussions
2. Try email if available
3. After 3 weeks total, proceed independently
4. Document "We reached out to mcp-ui on [date], no response yet"
5. Keep door open for future collaboration

## Key Messages to Emphasize

✅ **DO Emphasize:**
- We love what you built
- We want to enhance, not replace
- Enterprise users need security features
- We're happy to contribute to mcp-ui directly
- MCP ecosystem benefits from collaboration

❌ **DON'T Say:**
- Our approach is better
- mcp-ui lacks features
- We're building competing product
- You should adopt our spec
- We're the standard

## Success Criteria

**Best case**: Ido agrees to collaborate, we submit PRs to mcp-ui
**Good case**: Friendly coordination, clear compatibility story
**Acceptable**: Independent but documented relationship
**Worst case**: No response after 3 weeks, proceed independently but keep trying

## Backup Plan

If no collaboration materializes:
1. Clearly document MWP as "mcp-ui with added security/governance"
2. Maintain mcp-ui compatibility adapter
3. Credit mcp-ui prominently in docs
4. Avoid claiming to be "the" standard
5. Keep attempting outreach every 3-6 months
