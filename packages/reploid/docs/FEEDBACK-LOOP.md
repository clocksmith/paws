# 🔄 Automated Feedback Loop

## Overview

The feedback loop automatically tests your REPLOID application, detects errors, and provides iterative debugging support.

## What It Does

```
1. Run browser automation
2. Test agent awakening
3. Capture console errors
4. Detect if errors are fixed or persist
5. Report results
6. Repeat (up to N iterations)
```

## Usage

### Basic Usage

```bash
# Run feedback loop with default goal
./.claude/hooks/feedback-loop.sh

# Run with custom goal
./.claude/hooks/feedback-loop.sh "make cool 3D graphics"

# Run with custom goal and max iterations
./.claude/hooks/feedback-loop.sh "test my changes" 10
```

### Arguments

1. **Goal** (default: "test automation feedback loop")
   - The goal to pass to agent awakening

2. **Max Iterations** (default: 5)
   - Maximum number of test iterations before giving up

## How It Works

### Iteration Flow

```
┌─────────────────────────────────────┐
│  Clear console.log                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Run browser automation             │
│  - Launch headless browser          │
│  - Navigate to http://localhost:8080│
│  - Fill goal input                  │
│  - Click awaken button              │
│  - Capture errors                   │
│  - Take screenshot                  │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  Check console.log for [ERROR]      │
└──────────────┬──────────────────────┘
               ↓
         ┌─────┴─────┐
         │           │
    No errors    Has errors
         │           │
         ↓           ↓
      SUCCESS    Continue
                     ↓
              ┌──────────────┐
              │ Same as prev?│
              └───┬──────┬───┘
                  │      │
                 Yes    No
                  │      │
                  ↓      ↓
               STUCK  Next iteration
```

### Success Criteria

The loop succeeds when:
- No `[ERROR]` entries found in console.log
- Agent awakening completes without errors
- Application runs successfully

### Failure Detection

The loop detects stuck errors:
- If the same error appears in consecutive iterations
- If max iterations is reached
- Manual intervention required

## Output

### Success Output

```
🎉 SUCCESS! No errors detected!

✅ Agent awakening successful
✅ Goal: make cool graphics
✅ Iterations needed: 3

📸 Screenshot: /tmp/reploid-after-awaken.png
```

### Failure Output

```
⚠️  Max iterations reached (5)

Errors persist after 5 attempts

📝 Error log saved to: .claude/feedback-errors.log
📸 Last screenshot: /tmp/reploid-after-awaken.png

Next steps:
1. Review all errors: cat .claude/feedback-errors.log
2. Check console logs: cat console.log | grep ERROR
3. View screenshot: open /tmp/reploid-after-awaken.png
4. Ask Claude Code to analyze and fix the errors
```

### Stuck Loop Output

```
⚠️  Same error as previous iteration - feedback loop stuck

🛑 Manual intervention required

Suggested actions:
1. Review the error in detail: cat console.log | grep ERROR
2. Check the problematic file/module
3. Apply manual fixes
4. Re-run this script
```

## Generated Files

### `.claude/feedback-errors.log`

Contains all errors from each iteration:

```
=== Iteration 1 ===
[ERROR] [CoreLogic] Initialization failed: TypeError: container.register is not a function

=== Iteration 2 ===
[ERROR] [CoreLogic] Legacy evaluation failed for /upgrades/state-manager.js: SyntaxError

=== Iteration 3 ===
[ERROR] [Boot] Failed to awaken agent: ReferenceError: xyz is not defined
```

### `console.log`

Real-time browser console output captured during test.

### `/tmp/reploid-after-awaken.png`

Screenshot of the application after each test iteration.

## Integration with Development Workflow

### Manual Testing

```bash
# 1. Make code changes
vim upgrades/app-logic.js

# 2. Run feedback loop
./.claude/hooks/feedback-loop.sh

# 3. If errors, review and fix
cat .claude/feedback-errors.log

# 4. Repeat
```

### With Claude Code

```bash
# Run feedback loop
./.claude/feedback-loop.sh "test my feature"

# If it fails, ask Claude Code:
# "Check .claude/feedback-errors.log and fix the errors"
```

### Automated (Future)

Add to PostToolUse hook to run automatically after code changes:

```json
{
  "PostToolUse": [{
    "matcher": "Write|Edit",
    "hooks": [{
      "type": "command",
      "command": ".claude/hooks/feedback-loop.sh 'automated test' 3",
      "timeout": 180
    }]
  }]
}
```

## Examples

### Example 1: First Error Fixed

```bash
$ ./.claude/hooks/feedback-loop.sh

🔄 Starting Automated Feedback Loop
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Goal: test automation feedback loop
Max iterations: 5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 Iteration 1/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Running browser automation...
❌ Errors detected:
   [ERROR] [CoreLogic] Initialization failed: TypeError: container.register is not a function

💡 Waiting 2 seconds before next iteration...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 Iteration 2/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Running browser automation...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎉 SUCCESS! No errors detected!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Agent awakening successful
✅ Goal: test automation feedback loop
✅ Iterations needed: 2
```

### Example 2: Stuck on Error

```bash
$ ./.claude/hooks/feedback-loop.sh

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔁 Iteration 3/5
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

❌ Errors detected in iteration 3:
[ERROR] [CoreLogic] Legacy evaluation failed for /upgrades/state-manager.js

⚠️  Same error as previous iteration - feedback loop stuck

🛑 Manual intervention required

Suggested actions:
1. Review the error in detail: cat console.log | grep ERROR
2. Check the problematic file/module
3. Apply manual fixes
4. Re-run this script
```

## Debugging Tips

### View Full Error Details

```bash
# All errors from all iterations
cat .claude/feedback-errors.log

# Just the latest error
tail -n 5 .claude/feedback-errors.log

# All console errors
grep ERROR console.log
```

### View Screenshot

```bash
# Open screenshot from last test
open /tmp/reploid-after-awaken.png

# Or view with any image viewer
eog /tmp/reploid-after-awaken.png  # Linux
```

### Increase Verbosity

Edit `.claude/hooks/feedback-loop.sh` and add debugging:

```bash
set -x  # Enable bash debugging
```

### Adjust Iteration Count

```bash
# More attempts for complex issues
./.claude/hooks/feedback-loop.sh "my goal" 20

# Quick test with fewer attempts
./.claude/hooks/feedback-loop.sh "quick test" 2
```

## Advanced Usage

### Run in CI/CD

```yaml
# GitHub Actions example
- name: Test REPLOID
  run: |
    npm run dev &
    sleep 5
    ./.claude/hooks/feedback-loop.sh "CI test" 3
```

### Custom Error Detection

Modify the script to detect specific error patterns:

```bash
# Line 78-79 in feedback-loop.sh
ERRORS=$(grep -E '\[ERROR\]|\[FATAL\]|\[CRITICAL\]' "$CONSOLE_LOG" || true)
```

### Save All Screenshots

```bash
# Modify browser-automation.mjs to save timestamped screenshots
const timestamp = Date.now();
await driver.screenshot(`/tmp/reploid-${timestamp}.png`);
```

## Performance

- **Average iteration time**: 3-5 seconds
- **Max recommended iterations**: 20
- **Resource usage**: Minimal (headless browser only during test)

## Limitations

- Requires servers to be running (`npm run dev`)
- Only detects console errors (not visual issues)
- Cannot automatically fix errors (reports them for manual fixing)
- Stuck detection only compares with previous iteration (not all history)

## Future Enhancements

1. **Auto-fix common errors** - Pattern matching for known issues
2. **Visual regression testing** - Compare screenshots
3. **Performance metrics** - Track boot time, module load times
4. **Parallel testing** - Test multiple goals simultaneously
5. **Error categorization** - Group errors by type/severity
6. **Integration with Claude Code** - Automatic error analysis and fix suggestions

---

**Created**: 2025-10-20
**Status**: ✅ Active and working
**Last tested**: Successfully fixed container.register error
