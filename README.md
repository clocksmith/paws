# PAWS (Prepare Artifacts With SWAP (Selected Write Apply PAWS))

Multi-agent AI development toolkit built around **context engineering**. The core idea is that curating what information an AI sees is as important as how you prompt it.

## What is PAWS?

**Goal:** Generate robust solutions through structured cognitive diversity. Rather than relying on a single AI perspective, PAWS orchestrates multiple specialized agents that compete, synthesize, and reach consensus.

**How it works:**
1. **`cats`** - Curate context bundles by scoring files, pruning irrelevant code, and using AI-assisted selection to create focused input.
2. **`dogs`** - Apply changes with interactive approval and git-native safety. Every change is auditable and reversible.
3. **Multi-agent Paxos** - Run competing agents in parallel to generate solutions. The best solution is selected through consensus and test verification.
4. **Session state** - Maintain state outside the model to prevent context degradation across multiple turns.

This approach provides streamlined workflows for multi-agent coordination and test-driven consensus selection.

## REPLOID: Recursive Self-Improvement in the Browser

**[REPLOID](packages/reploid/README.md)** is an experimental framework for LLM-driven recursive self-improvement that runs entirely in the browser. Unlike traditional AI tools that treat the browser as just an interface, REPLOID uses it as a complete development ecosystem where agents can introspect, modify, test, and evolve their own architecture.

**Key capabilities:**
- **Self-modification** - Agent reads its own source code from a virtual filesystem and proposes architectural improvements
- **Blueprint-guided evolution** - 70+ architectural guides teach the agent implementation patterns for self-improvement
- **Human-supervised safety** - All changes require approval, with git checkpoints and automatic rollback on test failures
- **100% browser-native** - Runs without Node.js using IndexedDB storage, WebGPU inference, and Web Workers for isolation
- **Multi-provider intelligence** - Supports cloud APIs (Gemini, Claude, GPT-4), local Ollama, and WebGPU models

REPLOID is independently capable but shares the DOGS/CATS bundle format with PAWS CLI tools for optional interoperability.

## Packages

- **[@paws/core](packages/core/README.md)** - Shared resources (personas, system prompts, configs)
- **[@paws/cli-js](packages/cli-js/README.md)** - JavaScript CLI tools (cats, dogs, paws-session)
- **[@paws/cli-py](packages/cli-py/README.md)** - Python CLI tools (paws-cats, paws-dogs, paws-paxos)
- **[@paws/reploid](packages/reploid/README.md)** - Browser-native recursive self-improvement framework

## Integrations

- **[MCP Server](integrations/mcp/README.md)** - Model Context Protocol integration for Claude Desktop
- **[VS Code Extension](integrations/vscode/README.md)** - IDE integration with inline diff review

## Getting Started

```bash
# Install
pnpm install
cd packages/cli-py && pip install -e .

# Basic workflow
pnpm --filter @paws/cli-js cats src/**/*.js -o context.md  # Curate context
pnpm --filter @paws/cli-js dogs changes.md                 # Apply changes

# Start browser UI
pnpm --filter @paws/reploid start  # http://localhost:8080
```

See package READMEs for detailed documentation and examples.

## License

MIT

