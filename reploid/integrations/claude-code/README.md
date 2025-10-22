# 🚀 Claude Code Integrations for REPLOID

Complete automation suite for REPLOID development using Claude Code hooks and workflows.

## 📦 What's Included

### Hooks (`hooks/`)

**Browser Automation & Testing**
- `browser-automation.mjs` - Headless browser control with Playwright
- `browser-driver.sh` - Shell wrapper for browser automation
- `feedback-loop.sh` - Automated iterative testing and error detection
- `intelligent-feedback-loop.sh` - Advanced feedback loop with error analysis

**Development Workflow**
- `inject-console-logs.sh` - Auto-inject console errors into Claude Code context

### Workflows (`workflows/`)

**Runtime Monitoring**
- `console-monitor.js` - Browser console capture (inject in index.html)
- `live-reload.js` - Auto-reload browser on server restart (inject in index.html)
- `watch-and-assist.sh` - Terminal-based error monitoring

### Documentation (`docs/`)

- `AUTOMATION-COMPLETE.md` - Complete automation overview
- `BROWSER-AUTOMATION.md` - Browser automation guide
- `DEV-WORKFLOW.md` - Development workflow documentation
- `FEEDBACK-LOOP.md` - Feedback loop usage guide
- `HOOKS-README.md` - Claude Code hooks reference

## 🎯 Quick Start

### 1. Install Dependencies

```bash
# Install Playwright for browser automation
npx -y playwright install chromium
```

### 2. Configure Claude Code Hooks

Copy the example configuration:

```bash
# Create .claude directory if it doesn't exist
mkdir -p .claude

# Copy settings
cp integrations/claude-code/settings.example.json .claude/settings.json
```

Or manually configure `.claude/settings.json`:

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "integrations/claude-code/hooks/inject-console-logs.sh",
            "timeout": 5
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "echo '✅ Code changed. Test with: integrations/claude-code/hooks/feedback-loop.sh'",
            "timeout": 2
          }
        ]
      }
    ]
  }
}
```

### 3. Add Runtime Scripts to HTML

Add to `index.html` before `</body>`:

```html
<script src="integrations/claude-code/workflows/console-monitor.js"></script>
<script src="integrations/claude-code/workflows/live-reload.js"></script>
<script type="module" src="boot.js"></script>
```

### 4. Start Development

```bash
# Terminal 1: Start servers
npm run dev

# Terminal 2: Start error monitoring
./integrations/claude-code/workflows/watch-and-assist.sh
```

## 🔄 Automated Feedback Loop

### Run Automated Tests

```bash
# Basic test
./integrations/claude-code/hooks/feedback-loop.sh

# With custom goal
./integrations/claude-code/hooks/feedback-loop.sh "test my feature"

# With max iterations
./integrations/claude-code/hooks/feedback-loop.sh "test automation" 10

# Intelligent loop (auto-analyzes errors)
./integrations/claude-code/hooks/intelligent-feedback-loop.sh
```

### What It Does

```
1. Launch headless browser
2. Navigate to http://localhost:8080
3. Fill goal and click "Awaken Agent"
4. Capture console errors
5. Take screenshot
6. If errors → report and retry
7. If no errors → Success! 🎉
8. If stuck → Alert for manual intervention
```

## 🎮 Browser Automation

### Available Commands

```bash
# Test agent awakening
node integrations/claude-code/hooks/browser-automation.mjs awaken "your goal"

# Take screenshot
node integrations/claude-code/hooks/browser-automation.mjs screenshot ./debug.png

# Reload page
node integrations/claude-code/hooks/browser-automation.mjs reload

# Get console errors
node integrations/claude-code/hooks/browser-automation.mjs errors

# Execute JavaScript
node integrations/claude-code/hooks/browser-automation.mjs eval "document.title"

# Interactive mode (visible browser)
HEADLESS=false node integrations/claude-code/hooks/browser-automation.mjs interactive
```

## 📊 Error Monitoring

### Automatic Console Injection

When you send a message to Claude Code:

1. `UserPromptSubmit` hook runs
2. `inject-console-logs.sh` reads console.log
3. If errors exist, they're injected into your message
4. Claude sees them automatically

**Result**: No more manual copy/paste of console logs!

### Terminal Monitoring

```bash
# Watch for errors in real-time
./integrations/claude-code/workflows/watch-and-assist.sh
```

Displays:
- ❌ Errors as they occur
- 📊 Full error context
- 💡 Suggestions for Claude Code

## 🎯 Complete Automation Flow

```
Edit code → Save
    ↓
Server auto-restarts (nodemon)
    ↓
Browser auto-reloads (live-reload.js)
    ↓
Error occurs → Captured (console-monitor.js)
    ↓
Written to console.log
    ↓
Terminal alert (watch-and-assist.sh)
    ↓
You message Claude → Hook injects errors
    ↓
Claude sees errors → Suggests fix
    ↓
Apply fix → Cycle repeats
```

## 🔧 Configuration

### Environment Variables

**Browser Automation:**
- `HEADLESS` - Run browser headless (default: `true`)
- `BASE_URL` - Target URL (default: `http://localhost:8080`)
- `TIMEOUT` - Page load timeout in ms (default: `30000`)

**Feedback Loop:**
- `MAX_ITERATIONS` - Max test iterations (default: `5`)
- `GOAL` - Default agent goal (default: `"test automation feedback loop"`)

### Customize Hooks

Edit `.claude/settings.json` to:
- Add more hooks
- Change timeouts
- Modify matchers
- Add custom commands

## 📚 Documentation

- **[AUTOMATION-COMPLETE.md](docs/AUTOMATION-COMPLETE.md)** - Complete automation overview
- **[BROWSER-AUTOMATION.md](docs/BROWSER-AUTOMATION.md)** - Browser automation reference
- **[DEV-WORKFLOW.md](docs/DEV-WORKFLOW.md)** - Development workflow guide
- **[FEEDBACK-LOOP.md](docs/FEEDBACK-LOOP.md)** - Feedback loop usage
- **[HOOKS-README.md](docs/HOOKS-README.md)** - Claude Code hooks documentation

## 🎬 Examples

### Example 1: Fix Errors with Feedback Loop

```bash
# Start feedback loop
./integrations/claude-code/hooks/feedback-loop.sh "test my changes"

# Output:
# 🔄 Iteration 1/5
# ❌ Errors detected: TypeError: container.register is not a function
#
# 🔄 Iteration 2/5
# ✅ SUCCESS! No errors detected!
```

### Example 2: Browser Automation Testing

```bash
# Test with visible browser
HEADLESS=false node integrations/claude-code/hooks/browser-automation.mjs awaken "create 3D visualization"

# Output:
# 🚀 Launching browser...
# ✅ Goal set: "create 3D visualization"
# ✅ Awaken button clicked
# 📸 Screenshot saved to: /tmp/reploid-after-awaken.png
```

### Example 3: Automatic Error Detection

When you send "hello" to Claude Code:

```
You: hello

[Hook automatically injects:]

---
**[Auto-injected Browser Console Status]**

Recent browser console output (last 20 lines):

[ERROR] [CoreLogic] Initialization failed: TypeError...
---

Claude: I can see from the browser console that there's an initialization
        error in CoreLogic. The issue is...
```

## 🚀 CI/CD Integration

### GitHub Actions

```yaml
name: Test REPLOID

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Dependencies
        run: |
          npm install
          npx -y playwright install chromium

      - name: Start Servers
        run: npm run dev &

      - name: Wait for Server
        run: sleep 5

      - name: Run Automated Tests
        run: ./integrations/claude-code/hooks/feedback-loop.sh "CI test" 3

      - name: Upload Screenshot
        if: failure()
        uses: actions/upload-artifact@v3
        with:
          name: screenshot
          path: /tmp/reploid-after-awaken.png
```

### GitLab CI

```yaml
test:
  stage: test
  script:
    - npm install
    - npx -y playwright install chromium
    - npm run dev &
    - sleep 5
    - ./integrations/claude-code/hooks/feedback-loop.sh "CI test" 3
  artifacts:
    when: on_failure
    paths:
      - /tmp/reploid-after-awaken.png
```

## 🛠️ Troubleshooting

### Hooks Not Running

```bash
# Check if settings.json is valid
cat .claude/settings.json | jq .

# Make scripts executable
chmod +x integrations/claude-code/hooks/*.sh
chmod +x integrations/claude-code/workflows/*.sh
```

### Browser Automation Fails

```bash
# Verify Playwright is installed
npx -y playwright --version

# Test with visible browser
HEADLESS=false node integrations/claude-code/hooks/browser-automation.mjs awaken "test"
```

### Console Not Being Captured

```bash
# Check if scripts are loaded in index.html
grep "console-monitor.js" index.html
grep "live-reload.js" index.html

# Verify console.log file exists
ls -la console.log

# Check proxy server is running
curl http://localhost:8000/api/health
```

## 📦 File Structure

```
integrations/claude-code/
├── README.md                          # This file
├── settings.example.json              # Example Claude Code settings
├── hooks/                             # Claude Code hooks
│   ├── browser-automation.mjs         # Browser automation
│   ├── browser-driver.sh              # Browser driver wrapper
│   ├── feedback-loop.sh               # Automated feedback loop
│   ├── intelligent-feedback-loop.sh   # Advanced feedback loop
│   └── inject-console-logs.sh         # Console log injection
├── workflows/                         # Runtime workflows
│   ├── console-monitor.js             # Browser console capture
│   ├── live-reload.js                 # Auto-reload on changes
│   └── watch-and-assist.sh            # Terminal error monitoring
└── docs/                              # Documentation
    ├── AUTOMATION-COMPLETE.md         # Complete automation guide
    ├── BROWSER-AUTOMATION.md          # Browser automation docs
    ├── DEV-WORKFLOW.md                # Development workflow
    ├── FEEDBACK-LOOP.md               # Feedback loop guide
    └── HOOKS-README.md                # Hooks reference
```

## 🎯 Features

### ✅ Implemented

- [x] Automatic console log capture
- [x] Browser auto-reload on server restart
- [x] Terminal error monitoring
- [x] Browser automation with Playwright
- [x] Automated feedback loop with error detection
- [x] Claude Code hooks integration
- [x] Automatic error injection into context
- [x] Screenshot capture for debugging
- [x] Stuck error detection
- [x] CI/CD ready

### 🚧 Future Enhancements

- [ ] Visual regression testing
- [ ] Performance metrics tracking
- [ ] Auto-fix for common errors
- [ ] Multi-browser testing
- [ ] Parallel test execution
- [ ] Error categorization and prioritization
- [ ] Integration with issue trackers
- [ ] Code coverage reporting

## 🤝 Contributing

To add new hooks or workflows:

1. Add script to `hooks/` or `workflows/`
2. Make it executable: `chmod +x your-script.sh`
3. Document it in this README
4. Update `settings.example.json` if it's a hook
5. Test it with the feedback loop

## 📄 License

Part of the REPLOID project.

---

**Created**: 2025-10-20
**Version**: 1.0.0
**Status**: ✅ Production Ready
**Maintainer**: Claude Code Integration Team
