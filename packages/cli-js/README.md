# @paws/cli-js

JavaScript CLI tools for PAWS - Context bundler (cats) and change applier (dogs).

## Installation

```bash
npm install -g @paws/cli-js
```

Or use in a monorepo:

```bash
pnpm install
pnpm --filter @paws/cli-js <command>
```

## CLI Tools

### cats - Context Bundler

Bundle project files into a single text artifact for AI/LLM consumption.

```bash
# Basic usage
cats src/**/*.js -o context.md

# With AI-powered file curation
cats --ai-curate "Implement user authentication" --ai-key YOUR_API_KEY

# With persona and system prompt
cats src/**/*.js -p persona_ax.md -s sys_a.md -o bundle.md
```

**Options:**
- `--ai-curate <task>` - Use AI to select relevant files
- `--ai-provider <provider>` - AI provider (gemini, claude, openai)
- `-o, --output <file>` - Output file (default: cats.md)
- `-p, --persona <file>` - Persona file to prepend
- `-s, --sys-prompt-file <file>` - System prompt file
- `-x, --exclude <pattern>` - Exclude patterns
- `--verify <module>` - Verify module and extract API

### dogs - Change Applier

Apply changes from AI-generated bundles back to your codebase.

```bash
# Apply changes from a bundle
dogs changes.md

# Interactive mode (default)
dogs bundle.md

# Auto-accept all changes
dogs bundle.md -y
```

**Options:**
- `-y, --yes` - Auto-accept all changes
- `--verify <command>` - Run verification command after applying
- `--revert-on-fail` - Revert changes if verification fails

### paws-session - Session Manager

Manage multi-turn AI sessions with git worktrees.

```bash
# Start new session
paws-session start "feature-auth"

# Continue session
paws-session continue session-id

# List sessions
paws-session list
```

## API Usage

```javascript
const { CatsBundler } = require('@paws/cli-js/src/cats');
const { BundleProcessor } = require('@paws/cli-js/src/dogs');

// Create bundle
const bundler = new CatsBundler({
  outputFile: 'context.md',
  sysPrompt: '/path/to/sys_a.md'
});

const bundle = await bundler.createBundle(['src/**/*.js']);

// Apply changes
const processor = new BundleProcessor({
  outputDir: './src',
  verify: 'npm test'
});

await processor.processBundle(bundleContent);
```

## Testing

```bash
# Run tests
pnpm test

# Watch mode
pnpm test:watch

# With coverage
pnpm test:coverage
```

## License

MIT
