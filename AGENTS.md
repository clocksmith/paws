## Code Agent

**Prime Directive:** Write TypeScript for the PAWS CLI tools (CATS bundler, DOGS applier, arena mode).

## Git workflow: direct to main

- Commit on the owning repo's `main` and push to `origin/main`. No feature
  branches, branch-backed worktrees, or PRs unless the user asks for them.
- On another branch, preserve its work and move the task to `main` safely;
  never discard changes to switch. Never force-push `main`.
- Stage only task-related changes; integrate remote updates without
  overwriting unrelated work.
- Report the pushed commit or the concrete blocker. A local commit is not a push.

### Before Starting
- Read `README.md` (overview) and `packages/cli-js/README.md` (full CLI docs)

### Key Paths
- `packages/core/` - Core library and prompts: `sys/` (`sys_a.md`, `sys_d.md`, `sys_r.md`), `personas/`
- `packages/cli-js/` - JavaScript CLI implementation

### Guardrails
- Enforce `EMOJI.md`; use only approved Unicode symbols, no emojis
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
- When CATS bundler or DOGS applier code changes, round-trip a fixture through it;
  targeted suites are `test:cats` and `test:dogs` in `packages/cli-js`.
- For behavior shared by JavaScript and Python CLIs, run the same fixture through both.
- Inspect generated bundles for unintended prompt or persona changes.

## Development verification

- During development, choose checks for the changed behavior: syntax/type checks,
  existing focused tests, or a local visual check. A command list is not a requirement
  to run every suite before each commit, push, or ordinary application deployment.
- Do not automatically run full repository suites, broad browser/device matrices,
  GPU/model campaigns, benchmarks, or full release qualification. Run them when
  explicitly requested or when a named correctness question cannot be answered by
  focused checks; state that reason before starting.
- Config-contract, mirror, drift, and freshness checks run only when the change
  edits what they check. Don't add tests that just restate another file or pin
  config literals. Time-box long processes.
- Once relevant checks pass, continue. Repeat or broaden verification only after
  another relevant change, a failure, or a concrete unresolved concern.
- For documentation-only edits, inspect the diff and changed links. Do not run
  application, GPU, browser, or benchmark suites for prose changes.
- For ordinary deployments, build the changed artifact where needed and check the
  affected route after deployment. Deployment alone does not require a new release
  qualification campaign.
- Keep existing acceptance thresholds and release-qualification requirements.
  Report exactly what was checked; focused development checks do not establish
  numerical qualification, performance, multi-device support, or full acceptance.

## Intent-First Operations

- Treat PAWS intent as bundle/apply correctness for CATS, DOGS, prompts, and personas.
- If the user asks whether output is trustworthy, inspect the generated bundle, applier behavior, persona/system prompt source, and tests before changing docs.
- Do not modify upstream CATSCAN contracts or persona intent unless the user explicitly asks for that semantic change.
- When a CLI behavior is questioned, show the exact command, input artifact, output artifact, and failure or pass condition.
- Keep prompt/persona edits separate from bundler/applier mechanics unless the user bridges them.

## No speculative engineering timelines

- Never predict how long engineering work will take ("1-2 weeks", "a quick
  fix"). Describe concrete deltas, dependencies, risks, and validation instead.
- For an already-running process, report measured elapsed time, progress, or a
  grounded ETA only when the process exposes one; otherwise report its phase,
  latest output, and whether it is still progressing.

## Pick the real fix

- Fix correctness bugs; don't relabel them. Effort or scope framing
  ("non-trivial", "worth its own thread", "later") is no reason for a lesser fix.
- "Mark experimental", "add a TODO", or "reword the misleading comment" does not
  substitute for fixing wrong behavior.
- If scope must be split, list the concrete deltas and ask the user which path
  to take; don't pre-decide a smaller version.
