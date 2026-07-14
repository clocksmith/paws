---
name: paws-development
description: Implement PAWS bundle, apply, arena, prompt, persona, and CLI changes. Use for work in packages/core/, packages/cli-js/, the Python CLI, CATS generation, DOGS application, or cross-CLI compatibility.
---

# PAWS Development

Preserve the bundle/apply contract across the JavaScript and Python surfaces while
keeping prompt and persona semantics explicit.

## Establish The Contract

1. Read `README.md`, `packages/cli-js/README.md`, `EMOJI.md`, and the nearest
   instructions.
2. Identify whether the change owns a CATS bundle, DOGS application, arena flow,
   system prompt, persona, or CLI adapter.
3. Record the exact command, source artifact, serialized bundle, applied output, and
   compatibility requirement.
4. Inspect `git status --short`; do not disturb unrelated changes.

## Route The Change

- Shared schemas, prompts, personas, and bundle semantics belong in `packages/core/`.
- JavaScript command parsing and IO belong in `packages/cli-js/`.
- Python-specific adaptation belongs in the Python CLI without redefining the core
  artifact contract.
- Upstream CATSCAN contracts are inputs. Do not edit them to accommodate a PAWS bug.

Keep mechanics and meaning separate. A serializer fix should not silently rewrite a
persona, and a prompt change must be evaluated as a semantic intervention rather
than hidden inside bundler work.

## Implement

1. Parse and emit structured artifacts through the existing schema helpers.
2. Preserve stable identifiers, ordering rules, and round-trip behavior.
3. Reject malformed or unsupported bundles with actionable errors.
4. When both CLIs expose a behavior, add parity fixtures rather than duplicating
   assumptions in separate tests.
5. Add a focused test covering input, bundle bytes or structure, application result,
   and failure mode.

## Validate

```bash
pnpm -r test
npm run test:cli-js
npm run test:cli-py
npm run test:all
npm run lint
```

Run only commands declared by the current package if scripts differ. For bundle/apply
changes, generate a fixture and apply it through the affected CLI. Finish with
`git diff --check` and inspect generated artifacts for unintended prompt changes.
