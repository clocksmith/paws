# PAWS (Prepare Artifacts With SWAP)

PAWS is a multi-agent AI development toolkit that combines deterministic CLI workflows with a rich browser interface (REPLOID). It was designed around **context engineering** years before the term became mainstream; Anthropic’s September 2025 whitepaper _“Context Engineering Outperforms Prompt Engineering for AI Agents”_ reports a 54 % improvement when teams actively curate context—exactly the playbook PAWS implements.

## Core Philosophy: Structured Cognitive Diversity

Both PAWS and REPLOID operate on the **Doctrine of Structured Cognitive Diversity**: the principle that robust solutions emerge from the managed conflict, synthesis, and resolution of many expert, specialized viewpoints—not from a single monolithic intellect.

### The Core Insight

- **Traditional AI assistants:** Single perspective, single model, single shot
- **PAWS/REPLOID:** Multi-agent competition + Multi-persona deliberation = Battle-hardened wisdom

## Context Engineering at the Core

- `cats` bundles the smallest useful context by scoring, pruning, and summarising candidate files instead of dumping entire repositories.  
- Session state lives outside the model in `paws-session`, preventing the “context rot” degradation called out by Anthropic.  
- `.pawsignore` and AI-assisted curation (`cats --ai-curate`) make it trivial to tune what the model sees, keeping instructions sharp across long missions.

## Competitive Differentiators

- **Multi-agent Paxos** – three or more specialised agents compete, with consensus-driven selection (`py/paws_paxos.py`).
- **Git-native safety rails** – every run produces `cats.md` and `dogs.md`, so changes are auditable, replayable, and easy to roll back.  
- **REPLOID UI** – visual diff reviews, WebGPU local LLM support, and RSI upgrades bring modern UX parity while keeping workflows reproducible.

## Architecture Snapshot

```
paws/
├── py/                # Python CLI implementation (bundler, applier, session state)
├── js/                # JavaScript CLI implementation (canonical source for REPLOID tools)
├── reploid/           # Browser experience; ships vendored CLI binaries for standalone installs
└── personas/          # Persona guilds powering the H5 Penteract deliberation
```

For more details on the browser experience, see the [REPLOID README](reploid/README.md).

REPLOID vendors the `cats` and `dogs` binaries under `reploid/bin/` so that `npm install -g reploid` works without requiring the full PAWS CLI. A new checksum guard (`npm run check:reploid-sync`) ensures those executables stay aligned with the canonical `js/*.js` sources.

## Getting Started

```bash
npm install
pip install -r requirements.txt

# Create a context bundle
npx cats  # or python py/cats.py

# Apply a change bundle with review
npx dogs
```

To explore the browser interface:

```bash
npm run reploid:start
# open http://localhost:8080
```

## CI and Quality Gates

- **Checksum guard:** `npm run check:reploid-sync` verifies that `js/cats.js` and `js/dogs.js` remain in lockstep with `reploid/bin/cats` and `reploid/bin/dogs`. The `Verify REPLOID Sync` GitHub Action runs on every push and pull request.  
- **Testing cadence:** `npm test`, `npm run test:python`, and `npm run test:reploid` cover Node, Python, and REPLOID modules; Playwright provides end-to-end coverage (`npm run test:e2e`).

## Roadmap Highlights (October 2025)

- Faster iteration: incremental bundling, AI response caching, and REPLOID WebSocket streaming.  
- IDE integrations: VS Code extension with inline diff review and Claude Code hooks that route multi-file refactors through PAWS.  
- Claude Desktop via MCP: expose `cats`, `dogs`, and `paxos` as Model Context Protocol tools for native agent collaboration.

PAWS is positioned as the reference platform for context engineering in 2025. The industry is catching up to the principles baked into this workflow—PAWS keeps pushing forward with multi-agent supremacy and auditable cognition.

