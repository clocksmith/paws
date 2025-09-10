# PAWS Python Implementation

## Installation

**Prerequisites**: Python 3.9+ (no external libraries required for core functionality).

```bash
# Optional: Install for interactive features
pip install rich  # For interactive TUI

# Optional: Install AI provider SDKs
pip install google-generativeai  # For Gemini
pip install anthropic            # For Claude
pip install openai               # For OpenAI
```

## Core Tools

### cats.py - Context Aggregation Tool

Bundles project files into a single markdown file for LLM consumption.

```bash
# Basic usage - bundle current directory
python py/cats.py . -o context.md

# Bundle specific files or patterns
python py/cats.py src/*.py tests/*.py -o bundle.md

# With AI-powered file selection
python py/cats.py --ai-curate "implement authentication" -o auth_context.md

# With persona and system prompt
python py/cats.py . -p personas/p_refactor.md -o refactor.md

# Multiple persona files (applied in order)
python py/cats.py . -p personas/base.md -p personas/expert.md -o output.md

# Disable system prompt
python py/cats.py . --no-sys-prompt -o bundle.md

# Strict CATSCAN mode (prefer CATSCAN.md over README.md)
python py/cats.py . --strict-catscan -o bundle.md

# Use summary: prefix for token efficiency
python py/cats.py 'src/core/**' 'summary:src/utils/**' -o focused.md

# Output to stdout for piping
python py/cats.py . -o - | head -100
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

### dogs.py - Differential Output Generator

Extracts and applies code changes from LLM responses.

```bash
# Basic usage - extract and apply changes
python py/dogs.py changes.md

# Interactive review with TUI (requires rich)
python py/dogs.py changes.md -i

# Auto-accept all changes
python py/dogs.py changes.md -y

# Review without applying
python py/dogs.py changes.md -n

# Verify with git and run tests
python py/dogs.py changes.md --verify "pytest"

# Run tests and revert on failure
python py/dogs.py changes.md --verify "npm test" --revert-on-fail

# With RSI-Link protocol for self-modification
python py/dogs.py changes.md --rsi-link

# Apply delta bundle with precise line changes
python py/dogs.py changes.md -d reference.md

# Allow agentic commands
python py/dogs.py changes.md --allow-reinvoke

# Verify documentation sync
python py/dogs.py changes.md --verify-docs
```

#### Options

**Core Options:**
- `-i, --interactive` - Interactive review mode with rich TUI
- `-y, --yes` - Auto-accept all changes
- `-n, --no` - Auto-reject all changes (review only)
- `-q, --quiet` - Suppress output

**Verification:**
- `--verify <command>` - Run verification command after applying changes
- `--revert-on-fail` - Automatically revert changes if verification fails
- `--test-cmd <command>` - Alias for --verify (test command to run)
- `--verify-docs` - Warn if README.md changed without CATSCAN.md

**Advanced Features:**
- `-d, --apply-delta <ref_bundle>` - Apply deltas using reference bundle
- `--rsi-link` - Use RSI-Link protocol for self-modification
- `--allow-reinvoke` - Allow REQUEST_CONTEXT and EXECUTE_AND_REINVOKE commands

### paws_session.py - Session Management

Manages isolated work sessions using git worktrees.

```bash
# Start a new session
python py/paws_session.py start "feature-name"

# Create checkpoint
python py/paws_session.py checkpoint "implemented auth"

# Travel to previous checkpoint
python py/paws_session.py travel 2

# Merge back to main branch
python py/paws_session.py merge

# End session and cleanup
python py/paws_session.py end
```

#### Commands
- `start <name>` - Start new session with isolated worktree
- `checkpoint [message]` - Create checkpoint commit
- `travel <n>` - Travel to checkpoint n steps back
- `merge` - Merge session changes to base branch
- `end` - End session and remove worktree
- `status` - Show current session status
- `list` - List all active sessions

## Interactive Features

### Rich TUI (Terminal User Interface)
When `rich` is installed and using `--interactive`:
- Full-screen interface with syntax highlighting
- Side-by-side diff view
- Keyboard navigation (j/k or arrows)
- Real-time status updates
- Progress bars for multi-file operations

### Fallback Mode
Without `rich`, falls back to:
- Basic colored diffs (if terminal supports color)
- Simple y/n prompts
- Clear file-by-file progression

## Advanced Features

### CATSCAN.md Support

CATSCAN files are high-level API summaries that replace verbose implementations:

```bash
# Verify CATSCAN accuracy
python py/cats.py --verify src/module/

# Enforce CATSCAN usage
python py/cats.py . --strict-catscan

# After changes, verify docs are in sync
python py/dogs.py changes.md --verify-docs
```

### Delta Commands

For precise, line-based changes:

```markdown
PAWS_CMD: REPLACE_LINES(10, 15)
def new_function():
    return "updated"
PAWS_CMD: END

PAWS_CMD: INSERT_AFTER_LINE(25)
    # New comment
PAWS_CMD: END

PAWS_CMD: DELETE_LINES(30, 35)
```

### Agentic Commands

Enable two-way communication with AI:

```markdown
PAWS_CMD: REQUEST_CONTEXT(src/utils/helper.py)
I need to see the helper module to complete this task.

PAWS_CMD: EXECUTE_AND_REINVOKE(python py/cats.py src/utils/** -o context.md)
Running this will give me the context I need.
```

### .pawsignore Support

Create `.pawsignore` in your project root:
```gitignore
# Exclude test files
**/*_test.py
**/test_*.py

# Exclude build artifacts
build/
dist/
*.pyc
__pycache__/

# Exclude large data files
data/*.csv
*.db
```

## AI Provider Configuration

Set API keys as environment variables:
```bash
export GEMINI_API_KEY=your_key_here
export ANTHROPIC_API_KEY=your_key_here
export OPENAI_API_KEY=your_key_here
```

Or pass via command line:
```bash
python py/cats.py --ai-curate "task" --api-key "your_key"
```

## Complete Workflow Example

```bash
# 1. Start an isolated session
python py/paws_session.py start "refactor-auth"

# 2. Create AI-curated context bundle
python py/cats.py --ai-curate "refactor authentication to use JWT" \
    --persona personas/p_refactor.md \
    -o auth_refactor.md

# 3. Send to LLM (via API, web UI, or CLI)
# ... receive response as changes.md

# 4. Review changes interactively
python py/dogs.py changes.md --interactive --verify

# 5. Run tests to ensure nothing broke
python py/dogs.py changes.md --test-cmd "pytest tests/"

# 6. Create checkpoint if satisfied
python py/paws_session.py checkpoint "JWT auth implemented"

# 7. Continue iterating or merge back
python py/paws_session.py merge
```

## Git Integration

The tools integrate deeply with git for safety:

- **Automatic stashing** before applying changes
- **Atomic rollback** on test failure
- **Worktree isolation** for experimental changes
- **Checkpoint system** for time-travel debugging
- **Clean merge** back to main branch

## Module Verification

Verify that Python modules export what they claim:

```bash
# Check if module's CATSCAN matches reality
python py/cats.py --verify src/auth/

# Output shows:
# ✓ Exported: login_user, logout_user, check_permission
# ✗ Missing from CATSCAN: reset_password
# ✗ In CATSCAN but not exported: delete_user
```

## Performance Tips

1. **Use summary: prefix** for large dependencies to reduce tokens
2. **Leverage .pawsignore** to exclude irrelevant files globally
3. **Use --strict-catscan** to prefer concise API summaries
4. **Apply --prepare-for-delta** for efficient incremental changes
5. **Enable --ai-curate** to automatically select relevant files

## Troubleshooting

### Rich TUI Not Working
- Install rich: `pip install rich`
- Check terminal compatibility (needs 256 color support)
- Use `--no-tui` flag to force basic mode

### Git Verification Errors
- Ensure you're in a git repository
- Commit or stash current changes first
- Use `--no-verify` to skip git checks

### AI Provider Issues
- Verify API keys are set correctly
- Check rate limits and quotas
- Use `--no-ai` to skip AI features

### Module Verification Failed
- Ensure `__init__.py` has proper `__all__` exports
- Check for circular imports
- Verify module is valid Python

## For More Information

See the [main project README](../README.md) for the PAWS philosophy and overall project structure.