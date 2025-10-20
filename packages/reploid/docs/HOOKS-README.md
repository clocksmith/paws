# Claude Code Hooks for Automatic Console Monitoring

## 🎯 What This Does

This setup makes Claude Code **automatically read browser console logs** without you having to manually tell it to check. Every time you send a message, Claude will see the latest browser errors automatically.

## 📋 How It Works

### The Flow

```
You: Type any message
  ↓
UserPromptSubmit Hook: Runs inject-console-logs.sh
  ↓
Script: Checks console.log for errors
  ↓
If errors exist: Injects them into your message context
  ↓
Claude: Sees your message + browser console automatically
  ↓
Claude: Can proactively analyze and fix errors
```

### What Gets Injected

When console.log contains errors, Claude automatically sees:

```
---
**[Auto-injected Browser Console Status]**

Recent browser console output (last 20 lines from console.log):

[Your recent console logs here including any errors]
---
```

This happens **before** Claude processes your message, so Claude always has the latest error context.

## 🔧 Configuration Files

### `.claude/settings.json`

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/inject-console-logs.sh",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

**What this means:**
- `UserPromptSubmit` - Runs when you submit ANY prompt
- `command` - Executes the inject-console-logs.sh script
- `timeout: 5` - Gives the script 5 seconds to complete
- No `matcher` - Runs on EVERY prompt (not filtered)

### `.claude/hooks/inject-console-logs.sh`

This script:
1. Checks if console.log exists
2. Looks for `[ERROR]` patterns
3. If errors found, extracts last 20 lines
4. Outputs formatted markdown that gets added to your prompt

## 💡 Smart Behavior

The hook is **intelligent** and only injects when needed:

✅ **Injects when:**
- console.log file exists
- File contains `[ERROR]` entries
- Errors appear in the last 20 lines (recent activity)

❌ **Doesn't inject when:**
- console.log doesn't exist
- No errors in the log
- File is empty
- No recent error activity

This prevents cluttering your prompts when everything is working fine.

## 🚀 Testing the Hook

### Manual Test

```bash
# Run the hook script directly
./.claude/hooks/inject-console-logs.sh

# If errors exist in console.log, you'll see the injection output
# If no errors, you'll see nothing (exit 0)
```

### Live Test

1. Make sure browser has errors (reload http://localhost:8080)
2. Type ANY message to Claude Code
3. You should see Claude reference the browser console automatically
4. Claude might say something like "I can see from the console that..."

## 📊 What Claude Now Sees Automatically

### Before (Manual)

```
You: "fix the error"
Claude: "What error? Please share the console output"
You: [copies console] "here it is..."
Claude: "Thanks, I see the error is..."
```

### After (Automatic with Hooks)

```
You: "fix the error"
[Hook injects console.log automatically]
Claude: "I can see from the browser console that there's an initialization error
        at line 590 in CoreLogic. The error is showing as {} because..."
```

## 🎛️ Customization

### Change How Many Lines to Show

Edit `.claude/hooks/inject-console-logs.sh`:

```bash
# Change this line:
RECENT_LOGS=$(tail -n 20 "$CONSOLE_LOG" 2>/dev/null)
# To show more/less lines:
RECENT_LOGS=$(tail -n 50 "$CONSOLE_LOG" 2>/dev/null)  # Show 50 lines
```

### Only Inject on Specific Keywords

Add filtering to the script:

```bash
# Only inject if user message contains "error" or "debug"
if ! echo "$CLAUDE_USER_PROMPT" | grep -qi 'error\|debug'; then
    exit 0
fi
```

### Add Timestamps

Modify the output section:

```bash
cat <<EOF

---
**[Auto-injected Browser Console Status]**
**Last updated:** $(date)

Recent browser console output:
\`\`\`
$RECENT_LOGS
\`\`\`
EOF
```

## 🔐 Security & Performance

### Security Considerations

- ✅ Hook only reads local console.log file
- ✅ No external network calls
- ✅ No credentials exposed
- ✅ Sandboxed to project directory

### Performance Impact

- **Minimal** - Script runs in ~5-50ms
- Only processes last 20 lines (not entire file)
- Exits early if no errors exist
- Timeout set to 5 seconds max

### Privacy

- Console logs stay local
- Not sent anywhere except Claude Code context
- You can disable hook anytime by removing from settings.json

## 🛠️ Advanced Hooks

### Additional Hooks You Can Add

#### 1. Auto-run tests after code changes

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "npm test",
            "timeout": 60
          }
        ]
      }
    ]
  }
}
```

#### 2. Notify on session end

```json
{
  "hooks": {
    "SessionEnd": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "notify-send 'Claude Code' 'Session ended'",
            "timeout": 5
          }
        ]
      }
    ]
  }
}
```

#### 3. Auto-format files

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "prettier --write $CLAUDE_FILE_PATH",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

## 🐛 Troubleshooting

### Hook Not Running

```bash
# Check hook is executable
ls -la .claude/hooks/inject-console-logs.sh
# Should show: -rwxr-xr-x (x = executable)

# If not, make it executable
chmod +x .claude/hooks/inject-console-logs.sh
```

### Hook Output Not Appearing

```bash
# Test hook manually
./.claude/hooks/inject-console-logs.sh

# Check if console.log has errors
grep ERROR console.log

# Verify settings.json syntax
cat .claude/settings.json | jq .
# Should show valid JSON
```

### Claude Not Seeing Console Logs

1. Check if hook is registered:
   ```bash
   cat .claude/settings.json
   ```

2. Verify console.log location is correct in the script:
   ```bash
   head -n 5 .claude/hooks/inject-console-logs.sh
   # Check CONSOLE_LOG path
   ```

3. Make sure you're in the right directory:
   ```bash
   pwd
   # Should be: /home/clocksmith/deco/paws/packages/reploid
   ```

### Too Much Output

If Claude is getting too much console data, reduce the line count:

```bash
# Edit the script
nano .claude/hooks/inject-console-logs.sh

# Change tail -n 20 to tail -n 10
```

## 📚 Learn More

- [Claude Code Hooks Official Guide](https://docs.claude.com/en/docs/claude-code/hooks-guide)
- [Hooks Reference](https://docs.claude.com/en/docs/claude-code/hooks)
- [Automation Examples](https://github.com/disler/claude-code-hooks-mastery)

## ✅ Verification

To verify everything is working:

1. **Check hook exists:**
   ```bash
   ls -la .claude/hooks/inject-console-logs.sh
   ```

2. **Check settings registered:**
   ```bash
   cat .claude/settings.json
   ```

3. **Test hook output:**
   ```bash
   ./.claude/hooks/inject-console-logs.sh
   ```

4. **Send a test message to Claude**
   - Just type "hello"
   - If errors exist in console.log, Claude should reference them

## 🎉 Success Indicators

You'll know it's working when:

- ✅ You send a message and Claude mentions browser console errors without you asking
- ✅ Claude says things like "I can see from the console that..."
- ✅ Claude proactively suggests fixes based on browser errors
- ✅ You never have to copy/paste console logs again

---

**Created:** 2025-10-20
**Status:** Active and working
**Maintenance:** None required (script is self-contained)
