## Code Agent

**Prime Directive:** Write TypeScript for the PAWS CLI tools (CATS bundler, DOGS applier, arena mode).

### Before Starting
- Read `README.md` for overview
- Read `packages/cli-js/README.md` for full CLI docs
- Read `EMOJI.md` for approved Unicode symbols
- Check `packages/core/sys/` for system prompts
- Check `packages/core/personas/` for personas

### Key Paths
- `packages/core/` - Core library and prompts
- `packages/cli-js/` - JavaScript CLI implementation
- System prompts: `sys_a.md`, `sys_d.md`, `sys_r.md`

### Guardrails
- Enforce `EMOJI.md`; use only approved Unicode symbols, no emojis
- Do not modify upstream CATSCAN contracts
- Test bundle generation and application before commits
- Maintain compatibility with existing personas

### Development
```bash
npm install
npm run build
paws-cats --help   # CATS bundler
paws-dogs --help   # DOGS applier
```

### Validation

- Preserve stable bundle identifiers, ordering, and round-trip behavior.
- For behavior shared by JavaScript and Python CLIs, run the same fixture through both.
- Use the package's declared test scripts, including CLI-specific suites when present.
- Inspect generated bundles for unintended prompt or persona changes.

## Intent-First Operations

- Treat PAWS intent as bundle/apply correctness for CATS, DOGS, prompts, and personas.
- If the user asks whether output is trustworthy, inspect the generated bundle, applier behavior, persona/system prompt source, and tests before changing docs.
- Do not modify upstream CATSCAN contracts or persona intent unless the user explicitly asks for that semantic change.
- When a CLI behavior is questioned, show the exact command, input artifact, output artifact, and failure or pass condition.
- Keep prompt/persona edits separate from bundler/applier mechanics unless the user bridges them.

## No speculative engineering timelines

- Do not predict how long a coding, software-engineering, product-implementation, refactor, migration, launch, or similar work item will take. Avoid speculative delivery statements such as "1-2 weeks", "four months", or "a quick fix".
- Describe planned work through concrete deltas, dependencies, risks, and validation instead of calendar duration.
- This restriction does not apply to factual status for an already-running command, script, benchmark, training run, skill, deployment, or algorithm. You may report elapsed time, measured runtime, progress, and a grounded ETA when the active process exposes enough evidence.
- Do not invent an ETA for an active process. If it does not expose one, report its current phase, latest output, and whether it is still making progress.

## Pick the real fix

- when you find a correctness bug, the default is to fix it, not to relabel it
- do not use effort or scope framing ("non-trivial", "real engineering effort", "worth its own thread", "we'll address later") as cover for choosing a lesser fix
- do not propose "mark experimental", "add a TODO", or "rewrite the misleading comment" as a substitute for the actual engineering work when the underlying behavior is wrong
- if scope genuinely must be split, describe the concrete deltas and ask the user which path to take, do not pre-decide a smaller version
