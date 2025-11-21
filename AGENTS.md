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
