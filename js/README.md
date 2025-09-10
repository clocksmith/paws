# PAWS JavaScript/Node.js Implementation

## Installation

```bash
# From the paws root directory
npm install

# Optional: Install AI provider SDKs for AI-powered features
npm install @google/generative-ai   # For Gemini
npm install @anthropic-ai/sdk        # For Claude  
npm install openai                   # For OpenAI
```

## Core Tools

### cats.js - Context Aggregation Tool

Bundles project files into a single markdown file for LLM consumption.

```bash
# Basic usage - bundle current directory
node js/cats.js . -o context.md

# Bundle specific files or patterns
node js/cats.js src/*.js tests/*.js -o bundle.md

# With AI-powered file selection
node js/cats.js --ai-curate "implement authentication" -o auth_context.md

# With persona and system prompt
node js/cats.js . -p personas/p_refactor.md -o refactor.md

# Multiple persona files (applied in order)
node js/cats.js . -p personas/base.md -p personas/expert.md -o output.md

# Disable system prompt
node js/cats.js . --no-sys-prompt -o bundle.md

# Strict CATSCAN mode (prefer CATSCAN.md over README.md)
node js/cats.js . --strict-catscan -o bundle.md

# Output to stdout for piping
node js/cats.js . -o - | head -100
```

#### Options

**Core Options:**
- `-o, --output <file>` - Output file (default: cats.md, use '-' for stdout)
- `-x, --exclude <pattern>` - Exclude pattern (can be used multiple times)
- `-q, --quiet` - Suppress informational output
- `-y, --yes` - Auto-confirm all prompts

**AI Curation:**
- `--ai-curate <task>` - Use AI to select relevant files based on task
- `--ai-provider <provider>` - AI provider: gemini, claude, openai (default: gemini)
- `--ai-key <key>` - API key for AI provider
- `--max-files <n>` - Maximum files for AI curation (default: 20)
- `--include-tests` - Include test files in AI curation

**Prompts & Personas:**
- `-p, --persona <file>` - Persona file to prepend (can use multiple times)
- `-s, --sys-prompt-file <file>` - System prompt file (default: sys/sys_a.md)
- `--no-sys-prompt` - Disable system prompt prepending
- `--require-sys-prompt` - Fail if system prompt file not found

**Advanced Features:**
- `-t, --prepare-for-delta` - Mark bundle as reference for delta operations
- `--strict-catscan` - Replace README.md with CATSCAN.md when available
- `-N, --no-default-excludes` - Disable default excludes (.git, node_modules, etc.)
- `--verify <module>` - Verify module and extract API

### dogs.js - Differential Output Generator

Extracts and applies code changes from LLM responses.

```bash
# Basic usage - extract and apply changes
node js/dogs.js changes.md

# Interactive review with TUI (blessed)
node js/dogs.js changes.md -i

# Auto-accept all changes
node js/dogs.js changes.md -y

# Review without applying
node js/dogs.js changes.md -n

# Verify and run tests
node js/dogs.js changes.md --verify "npm test"

# Run tests and revert on failure
node js/dogs.js changes.md --verify "npm test" --revert-on-fail

# With RSI-Link protocol
node js/dogs.js changes.md --rsi-link

# Apply delta bundle
node js/dogs.js changes.md -d reference.md

# Allow agentic commands
node js/dogs.js changes.md --allow-reinvoke

# Verify documentation sync
node js/dogs.js changes.md --verify-docs

# Use simple prompts instead of TUI
node js/dogs.js changes.md -i --no-blessed
```

#### Options

**Core Options:**
- `-i, --interactive` - Interactive review mode with blessed TUI
- `-y, --yes` - Auto-accept all changes
- `-n, --no` - Auto-reject all changes (review only)
- `-q, --quiet` - Suppress output
- `--no-blessed` - Use simple interface instead of TUI

**Verification:**
- `--verify <command>` - Run verification command after applying changes
- `--revert-on-fail` - Automatically revert changes if verification fails
- `--test-cmd <command>` - Alias for --verify (test command to run)
- `--verify-docs` - Warn if README.md changed without CATSCAN.md

**Advanced Features:**
- `-d, --apply-delta <ref_bundle>` - Apply deltas using reference bundle
- `--rsi-link` - Use RSI-Link protocol for self-modification
- `--allow-reinvoke` - Allow REQUEST_CONTEXT and EXECUTE_AND_REINVOKE commands

### paws-session.js - Session Management

Manages isolated work sessions using git worktrees.

```bash
# Start a new session
node js/paws-session.js start "feature-name"

# Create checkpoint
node js/paws-session.js checkpoint "implemented auth"

# Travel to previous checkpoint
node js/paws-session.js travel 2

# Merge back to main branch
node js/paws-session.js merge

# End session
node js/paws-session.js end
```

#### Commands
- `start <name>` - Start new session
- `checkpoint [message]` - Create checkpoint
- `travel <n>` - Travel to checkpoint
- `merge` - Merge to base branch
- `end` - End current session
- `status` - Show session status
- `list` - List all sessions

## Interactive Features

### Visual Diffs
When using `--interactive`, dogs.js provides:
- Color-coded diffs (green for additions, red for deletions)
- Side-by-side file navigation
- Keyboard controls (a=accept, r=reject, s=skip, q=quit)

### TUI Modes
The tools automatically detect and use the best interface:
1. **Blessed TUI** - Full-screen terminal interface (if terminal supports it)
2. **Inquirer Prompts** - Interactive prompts (fallback)
3. **CLI Flags** - Non-interactive mode

## AI Provider Configuration

Set API keys as environment variables:
```bash
export GEMINI_API_KEY=your_key_here
export ANTHROPIC_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here
```

Or pass via command line:
```bash
node js/cats.js --ai-curate "task" --api-key "your_key"
```

## Testing

```bash
# Run test suite
npm test

# Run specific test
npm test -- --grep "cats"
```

## Examples

### Complete Workflow

```bash
# 1. Start a session for new feature
node js/paws-session.js start "add-auth"

# 2. Bundle relevant files with AI curation
node js/cats.js --ai-curate "add JWT authentication" -o auth.md

# 3. Send auth.md to LLM, get changes.md response

# 4. Review and apply changes interactively
node js/dogs.js changes.md --interactive --verify

# 5. Create checkpoint
node js/paws-session.js checkpoint "basic auth implemented"

# 6. Iterate as needed...

# 7. Merge back to main
node js/paws-session.js merge
```

### Backward Compatibility

All original PAWS features are supported:

```bash
# Original cats.js features
node js/cats.js src/ --exclude "*.test.js" -o bundle.md

# Original dogs.js features  
node js/dogs.js response.md --base-dir ./src

# Delta commands
node js/dogs.js delta.md --apply-delta original.md

# PAWS_CMD protocol
node js/dogs.js cmd.md --allow-reinvoke
```

## Library Usage

Both scripts can be imported and used programmatically:

```javascript
// cats.js library usage
const { createBundle } = require("./js/cats.js");

async function runCatBundle() {
  const files = [
    { path: "src/index.js", content: 'console.log("hello");' },
    { path: "README.md", content: "# My Project" },
  ];

  const bundleString = await createBundle({
    virtualFS: files,
    personaContent: "You are a helpful assistant.",
  });

  console.log(bundleString);
}

// dogs.js library usage
const { extractBundle } = require("./js/dogs.js");

async function runDogExtract() {
  const bundleContent = `
🐕 --- DOGS_START_FILE: src/index.js ---
console.log("hello world");
🐕 --- DOGS_END_FILE: src/index.js ---
`;

  // Returns an array of { path, contentBytes, isDelete } objects
  const extractedFiles = await extractBundle({ bundleContent });

  for (const file of extractedFiles) {
    console.log(`Path: ${file.path}`);
    console.log(`Content: ${file.contentBytes.toString("utf-8")}`);
  }
}
```

## Dependencies

Core dependencies:
- `commander` - CLI framework
- `glob` - File pattern matching
- `ignore` - .gitignore parsing
- `simple-git` - Git operations

Optional UI dependencies:
- `blessed` - Terminal UI
- `inquirer` - Interactive prompts
- `chalk` - Terminal colors
- `diff` - Diff generation

Optional AI dependencies:
- `@google/generative-ai` - Gemini AI
- `@anthropic-ai/sdk` - Claude AI
- `openai` - OpenAI/GPT

## Troubleshooting

### Terminal UI Issues
If the TUI doesn't display correctly:
- Ensure terminal supports 256 colors
- Try `--no-tui` flag to use basic prompts
- Check terminal size (minimum 80x24)

### Git Verification Failures
If verification fails:
- Ensure you're in a git repository
- Check for uncommitted changes
- Use `--no-verify` to skip verification

### AI Provider Errors
- Verify API keys are set correctly
- Check network connectivity
- Use `--no-ai` to skip AI features

## For More Information

See the [main project README](../README.md) for the PAWS philosophy and overall project structure.