# 🎮 Browser Automation for REPLOID

## ✅ Setup Complete!

Browser automation is now installed and configured using Playwright.

## 🚀 What You Can Do

### Automatically Test Your Application

```bash
# Test the awaken agent functionality
node .claude/hooks/browser-automation.mjs awaken "make cool graphics"

# Take a screenshot
node .claude/hooks/browser-automation.mjs screenshot ./my-screenshot.png

# Reload the page
node .claude/hooks/browser-automation.mjs reload

# Get console errors
node .claude/hooks/browser-automation.mjs errors

# Run JavaScript in the browser
node .claude/hooks/browser-automation.mjs eval "document.title"

# Open browser and keep it interactive
HEADLESS=false node .claude/hooks/browser-automation.mjs interactive
```

## 🔄 Automated Testing Flow

The browser automation can now:

1. **Launch browser** (headless or visible)
2. **Navigate to http://localhost:8080**
3. **Fill in forms** (goal input)
4. **Click buttons** (awaken agent)
5. **Capture console errors** automatically
6. **Take screenshots** for debugging
7. **Execute JavaScript** to inspect state
8. **Report errors** back to you

## 🎯 Integration with Development Cycle

Combined with the existing automation:

```
Edit code → Save
    ↓
Server auto-restarts (nodemon)
    ↓
[Optional] Run browser automation to test
    ↓
Browser automation:
  - Launches headless browser
  - Fills in goal
  - Clicks awaken button
  - Captures any errors
  - Takes screenshot
  - Reports results
    ↓
Fix any issues → Repeat
```

## 📝 Available Commands

### `awaken [goal]`
Triggers the agent awakening with a specified goal.

```bash
node .claude/hooks/browser-automation.mjs awaken "create a 3D visualization"
```

**What it does:**
- Fills `#goal-input` with the goal
- Clicks `#awaken-btn`
- Waits for processing
- Captures console errors
- Takes screenshot at `/tmp/reploid-after-awaken.png`

### `screenshot [path]`
Takes a full-page screenshot.

```bash
node .claude/hooks/browser-automation.mjs screenshot ./debug.png
```

### `reload`
Reloads the current page.

```bash
node .claude/hooks/browser-automation.mjs reload
```

### `errors`
Fetches and displays console errors from the proxy API.

```bash
node .claude/hooks/browser-automation.mjs errors
```

### `eval <code>`
Executes JavaScript in the browser context.

```bash
node .claude/hooks/browser-automation.mjs eval "window.location.href"
node .claude/hooks/browser-automation.mjs eval "document.querySelectorAll('.error').length"
```

### `interactive`
Opens the browser and keeps it open for manual inspection.

```bash
HEADLESS=false node .claude/hooks/browser-automation.mjs interactive
```

## ⚙️ Environment Variables

### `HEADLESS`
Run browser in headless mode (default: `true`)

```bash
HEADLESS=false node .claude/hooks/browser-automation.mjs awaken "test"
```

### `BASE_URL`
Change the target URL (default: `http://localhost:8080`)

```bash
BASE_URL=http://localhost:3000 node .claude/hooks/browser-automation.mjs awaken "test"
```

### `TIMEOUT`
Page load timeout in milliseconds (default: `30000`)

```bash
TIMEOUT=60000 node .claude/hooks/browser-automation.mjs awaken "test"
```

## 🔗 Hooks Integration

### Current Hooks Configuration

**`.claude/settings.json`:**

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [{
          "type": "command",
          "command": ".claude/hooks/inject-console-logs.sh",
          "timeout": 5
        }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [{
          "type": "command",
          "command": "echo '✅ Code changed. Run browser automation to test!'",
          "timeout": 2
        }]
      }
    ]
  }
}
```

### What This Means

1. **UserPromptSubmit hook** - Automatically injects console.log into my context
2. **PostToolUse hook** - Reminds to test after code changes

**Future enhancement:** The PostToolUse hook could automatically run browser automation after changes!

## 🧪 Testing Workflow Example

### Manual Testing

```bash
# 1. Make code changes
vim upgrades/app-logic.js

# 2. Test automatically
node .claude/hooks/browser-automation.mjs awaken "test my changes"

# 3. Check results (errors shown in console)
# 4. View screenshot if needed
open /tmp/reploid-after-awaken.png
```

### Automated Testing (Future)

You could add this to PostToolUse hook:

```json
{
  "matcher": "Edit|Write",
  "hooks": [{
    "type": "command",
    "command": "node .claude/hooks/browser-automation.mjs awaken 'automated test'",
    "timeout": 60
  }]
}
```

This would automatically test every code change!

## 📸 Screenshots

Screenshots are saved to `/tmp/reploid-after-awaken.png` by default.

Custom path:

```bash
node .claude/hooks/browser-automation.mjs screenshot /home/user/debug.png
```

## ❌ Error Detection

The automation automatically:

1. Listens to browser console messages
2. Filters for `[ERROR]` entries
3. Fetches from `/api/console-logs` endpoint
4. Reports all errors found

Example output:

```
❌ Errors detected:
   [2025-10-20T19:07:06.993Z] [ERROR] [CoreLogic] Initialization failed: TypeError: container.register is not a function
   [2025-10-20T19:07:06.993Z] [ERROR] [Boot] Failed to awaken agent: TypeError: container.register is not a function
```

## 🎮 Interactive Mode

For debugging, run with visible browser:

```bash
HEADLESS=false node .claude/hooks/browser-automation.mjs interactive
```

This opens a real browser window you can interact with, while keeping the automation script running.

Press `Ctrl+C` to close.

## 🔧 Advanced Usage

### Custom Selectors

Edit `.claude/hooks/browser-automation.mjs` to interact with different elements:

```javascript
await this.page.click('#my-custom-button');
await this.page.fill('.my-input', 'my value');
```

### Multi-Step Workflows

Create complex test scenarios:

```javascript
await driver.navigate();
await driver.awakenAgent('step 1');
await driver.page.waitForTimeout(5000);
await driver.awakenAgent('step 2');
await driver.screenshot('./final-state.png');
```

### CI/CD Integration

Run browser tests in GitHub Actions or GitLab CI:

```yaml
- name: Test REPLOID
  run: |
    npm run dev &
    sleep 5
    node .claude/hooks/browser-automation.mjs awaken "CI test"
```

## 📊 What Was Just Tested

The browser automation just ran and found:

```
❌ TypeError: container.register is not a function
   at CoreLogicModule (app-logic.js:47:15)
```

This is the actual bug preventing agent initialization!

## 🎯 Next Steps

1. **Fix the bug** (container.register issue)
2. **Test automatically** with browser automation
3. **Verify fix** by checking console.log
4. **Take screenshot** to confirm success

## 📚 Files Created

- `.claude/hooks/browser-automation.mjs` - Main automation script
- `.claude/hooks/browser-driver.sh` - Shell wrapper (optional)
- `.claude/settings.json` - Hooks configuration
- `.claude/BROWSER-AUTOMATION.md` - This file

## ✨ Benefits

- ✅ Automated end-to-end testing
- ✅ No manual browser interaction needed
- ✅ Consistent test results
- ✅ Screenshot evidence
- ✅ Error detection and reporting
- ✅ CI/CD ready
- ✅ Headless or interactive mode

---

**Status:** ✅ Active and working
**Last test:** Successfully detected container.register error
**Screenshot:** `/tmp/reploid-after-awaken.png`
