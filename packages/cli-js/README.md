# @paws/cli-js

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[← Core](../core/README.md)**

---

TypeScript CLI tools for PAWS multi-agent workflows - Context bundler, change applier, session manager, multi-agent arena, swarm collaboration, benchmarking, and context optimization.

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

Manage stateful multi-turn AI workflows with git worktrees.

```bash
# Start new session
paws-session start "feature-auth"

# List all sessions
paws-session list

# Archive completed session
paws-session archive session-id

# Merge session back to main branch
paws-session merge session-id
```

### paws-arena - Multi-Agent Competition

Run multiple LLMs in parallel with test-driven selection. Each agent works in an isolated git worktree.

```bash
# Run competitive arena
paws-arena "Refactor auth module" context.md --verify-cmd "npm test"

# Specify models
paws-arena "Add feature" context.md --models gemini-2.0-flash,claude-3-5-sonnet

# Review results
paws-arena --review workspace/competition/
```

**Options:**
- `--verify-cmd <command>` - Test command to select winner
- `--models <list>` - Comma-separated model list
- `--workspace <dir>` - Competition workspace directory

### paws-swarm - Collaborative Workflows

Collaborative multi-agent workflows with specialized roles (Architect → Implementer → Reviewer).

```bash
# Run swarm workflow
paws-swarm "Build authentication system" context.md --verify-cmd "npm test"

# Custom agent configuration
paws-swarm "Feature" context.md --agents architect,implementer,reviewer
```

**Options:**
- `--verify-cmd <command>` - Test command for verification
- `--agents <list>` - Agent role configuration
- `--max-iterations <n>` - Maximum iteration count

### paws-benchmark - LLM Performance Comparison

Compare LLM performance on your specific codebase with test-driven evaluation.

```bash
# Run benchmark suite
paws-benchmark --suite benchmark-suite.json

# Single benchmark task
paws-benchmark --task "Fix bug in auth" --context context.md --verify "npm test"
```

**Options:**
- `--suite <file>` - Benchmark suite configuration
- `--models <list>` - Models to compare
- `--output <file>` - Results output file

### paws-context-optimizer - Smart Context Pruning

Handle large codebases with intelligent context optimization.

```bash
# Optimize context for a task
paws-context-optimizer --task "Refactor API" --input large-context.md --output optimized.md

# Analyze context size
paws-context-optimizer --analyze context.md
```

**Options:**
- `--task <description>` - Task description for relevance scoring
- `--max-tokens <n>` - Target token limit
- `--strategy <name>` - Optimization strategy (ast, semantic, hybrid)

## API Usage

```typescript
import { CatsBundler } from '@paws/cli-js/src/cats';
import { BundleProcessor } from '@paws/cli-js/src/dogs';

// Create bundle
const bundler = new CatsBundler({
  outputFile: 'context.md',
  sysPrompt: '/path/to/sys_a.md'
});

const bundle = await bundler.createBundle(['src/**/*.ts']);

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

---

**[↑ Back to Main](../../README.md)** | **[↑ Packages](../README.md)** | **[← Core](../core/README.md)**
