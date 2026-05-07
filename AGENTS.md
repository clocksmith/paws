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

## No time estimates

- never estimate work in hours, days, weeks, or any other time unit, in code, comments, commit messages, status updates, receipts, or chat replies
- do not say "~30 min", "~2 hr", "multi-day", "quick", "long-running" as size proxies for engineering work
- describe what the work IS — the file to change, the function to add, the schema field to extend, the named blocker to fix — not how long it should take
- if scope must be conveyed, list the concrete deltas (lines/files/symbols touched) instead of a duration

## Pick the real fix

- when you find a correctness bug, the default is to fix it, not to relabel it
- do not use effort or scope framing ("non-trivial", "real engineering effort", "worth its own thread", "we'll address later") as cover for choosing a lesser fix
- do not propose "mark experimental", "add a TODO", or "rewrite the misleading comment" as a substitute for the actual engineering work when the underlying behavior is wrong
- if scope genuinely must be split, describe the concrete deltas and ask the user which path to take, do not pre-decide a smaller version
