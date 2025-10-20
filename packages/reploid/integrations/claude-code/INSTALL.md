# Installation Guide

## Quick Install

### 1. Dependencies

```bash
# Install Playwright for browser automation
npx -y playwright install chromium
```

### 2. Configure Hooks

```bash
# Copy example settings to .claude/
cp integrations/claude-code/settings.example.json .claude/settings.json
```

### 3. Update index.html

**Already done!** The scripts are referenced in `index.html`:

```html
<script src="integrations/claude-code/workflows/console-monitor.js"></script>
<script src="integrations/claude-code/workflows/live-reload.js"></script>
```

### 4. Make Scripts Executable

```bash
chmod +x integrations/claude-code/hooks/*.sh
chmod +x integrations/claude-code/workflows/*.sh
```

## Verify Installation

```bash
# Check directory structure
ls -la integrations/claude-code/

# Should show:
# hooks/      - Claude Code hooks
# workflows/  - Runtime workflows
# docs/       - Documentation
# README.md   - Main documentation
# settings.example.json - Example configuration
```

## Test It

```bash
# Terminal 1: Start servers
npm run dev

# Terminal 2: Start error monitoring
./integrations/claude-code/workflows/watch-and-assist.sh

# Terminal 3: Run feedback loop
./integrations/claude-code/hooks/feedback-loop.sh "test installation"
```

## What's Included

✅ **Hooks**
- inject-console-logs.sh
- browser-automation.mjs
- feedback-loop.sh
- intelligent-feedback-loop.sh

✅ **Workflows**
- console-monitor.js
- live-reload.js
- watch-and-assist.sh

✅ **Documentation**
- AUTOMATION-COMPLETE.md
- BROWSER-AUTOMATION.md
- DEV-WORKFLOW.md
- FEEDBACK-LOOP.md
- HOOKS-README.md

## Next Steps

Read the [README.md](README.md) for complete documentation.
