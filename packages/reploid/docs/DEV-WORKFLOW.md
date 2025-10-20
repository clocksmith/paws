# REPLOID End-to-End Development Workflow

## Overview

This document describes the automated development workflow that creates a tight feedback loop between browser errors and Claude Code debugging assistance.

## The Complete Cycle

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Cycle                         │
└─────────────────────────────────────────────────────────────┘

1. Make Code Change
   ↓
2. File saved → Nodemon auto-restarts proxy server
   ↓
3. Browser detects server restart → Auto-reloads page
   ↓
4. Error occurs → console-monitor.js captures it
   ↓
5. Error sent to proxy → Written to console.log
   ↓
6. watch-and-assist.sh detects error → Alerts terminal
   ↓
7. Claude Code reads console.log → Analyzes error
   ↓
8. Fix applied → Cycle repeats
```

## Components

### 1. Console Monitoring (`console-monitor.js`)
- **Purpose**: Captures all browser console output automatically
- **How it works**: Intercepts console.log/warn/error/info methods
- **Output**: Sends logs to `POST /api/console-logs` endpoint
- **Benefit**: No more manual copy/paste of console logs

### 2. Live Reload (`live-reload.js`)
- **Purpose**: Automatically reloads browser when server restarts
- **How it works**: Polls `/api/health` endpoint for timestamp changes
- **Safety**: Prevents reload loops by tracking consecutive errors
- **Benefit**: Instant feedback when you save a file

### 3. File Watcher (`watch-and-assist.sh`)
- **Purpose**: Monitors console.log file and alerts on errors
- **How it works**: Tails console.log and greps for [ERROR] patterns
- **Output**: Prints errors to terminal in real-time
- **Benefit**: Visual alert when errors occur

### 4. Server Auto-Restart (`npm run dev`)
- **Purpose**: Automatically restarts proxy when files change
- **How it works**: Uses nodemon to watch server files
- **Benefit**: No manual server restarts needed

### 5. Console Log File (`console.log`)
- **Purpose**: Persistent log of all browser console output
- **How it works**: Appended to by proxy server
- **Access**: Read with `./read-console.sh` or `cat console.log`
- **Benefit**: Historical record of all console activity

## Quick Start

### Option 1: Automated Workflow (Recommended)

```bash
# Terminal 1: Start servers (proxy + web)
npm run dev

# Terminal 2: Start error watcher
./watch-and-assist.sh

# Open browser
http://localhost:8080
```

Now:
- Any code change → Auto-restart
- Any browser reload → Logs captured
- Any error → Terminal alert + Claude Code can read it

### Option 2: Manual Workflow

```bash
# Start servers
npm run dev

# When errors occur, read logs
./read-console.sh

# Or directly
cat console.log
```

## Claude Code Integration

### Reading Console Logs

Claude Code can automatically read the console.log file:

```bash
# Claude Code can run this to see browser errors:
cat /home/clocksmith/deco/paws/packages/reploid/console.log
```

### Workflow for Claude Code

When debugging:

1. **Start the development environment**
   ```bash
   npm run dev
   ```

2. **Monitor for errors**
   - Run `watch-and-assist.sh` in background
   - Or periodically check `console.log`

3. **When error detected**
   - Read console.log for full error details
   - Analyze the error and stack trace
   - Apply fix to the relevant file
   - Proxy auto-restarts → Browser auto-reloads → Verify fix

4. **Verify fix**
   - Check console.log for new output
   - Confirm error is resolved

## Features

### Console Monitor Features
- ✓ Captures all console methods (log, warn, error, info)
- ✓ Preserves original console behavior
- ✓ Handles Error objects with full stack traces
- ✓ Handles error-like objects (with .message and .stack)
- ✓ Buffers logs to avoid overwhelming server
- ✓ Debounced sending (500ms delay)
- ✓ Silent failure handling (no infinite loops)

### Live Reload Features
- ✓ Detects server restarts via timestamp changes
- ✓ Prevents reload loops with error threshold
- ✓ Resets error counter on user interaction
- ✓ Configurable check interval (1 second default)
- ✓ Graceful handling of server downtime

### Watch Script Features
- ✓ Real-time error detection
- ✓ Only shows new content (incremental reading)
- ✓ Color-coded output
- ✓ Low CPU usage (1 second poll interval)
- ✓ Works with any file size

## Advanced Usage

### Adjusting Live Reload Sensitivity

Edit `live-reload.js`:

```javascript
// Change reload threshold (default: 3 errors before disabling)
window._reloadErrorThreshold = 5;

// Change check interval (default: 1000ms)
const CHECK_INTERVAL = 2000; // Check every 2 seconds
```

### Filtering Watch Output

The watch script can be modified to filter specific errors:

```bash
# Watch for specific error patterns
tail -f console.log | grep "CoreLogic"
```

### Reading Specific Time Ranges

```bash
# Last 50 lines
tail -n 50 console.log

# Last 5 minutes (approximate)
tail -n 100 console.log

# Search for specific errors
grep "SyntaxError" console.log
```

## Troubleshooting

### Browser Not Auto-Reloading

1. Check browser console for `[LiveReload] Auto-reload enabled`
2. Verify `/api/health` endpoint is accessible
3. Check for error threshold exceeded warning

### Console Logs Not Appearing

1. Verify `console-monitor.js` is loaded before `boot.js`
2. Check proxy server is running on port 8000
3. Look for network errors in browser DevTools

### Watch Script Not Detecting Errors

1. Ensure console.log file exists
2. Verify file permissions: `chmod +x watch-and-assist.sh`
3. Check if errors are actually being written to file

### Proxy Server Not Restarting

1. Check `package.json` has nodemon configured correctly
2. Verify file changes are being saved
3. Look at nodemon output for restart notifications

## Performance Considerations

### Console Log File Size

The console.log file will grow over time. To prevent it from getting too large:

```bash
# Clear old logs
> console.log

# Or rotate logs
mv console.log console.log.$(date +%Y%m%d)
touch console.log
```

### Browser Memory

The console monitor buffers up to 100 log entries. If you're seeing memory issues:

Edit `console-monitor.js`:

```javascript
const MAX_BUFFER_SIZE = 50; // Reduce buffer size
```

### Watch Script CPU Usage

The watch script polls every 1 second. To reduce CPU usage:

Edit `watch-and-assist.sh`:

```bash
sleep 2  # Change from 1 to 2 seconds
```

## Integration with Claude Code Features

### Background Tasks

Claude Code can run the watch script in the background and monitor output:

```bash
# Start watch in background
./watch-and-assist.sh &

# Monitor output
jobs
```

### File Watching

Claude Code has file watching capabilities that can be configured to automatically read console.log when it changes.

### Hooks

You can configure Claude Code hooks to automatically trigger debugging when errors are detected.

## Best Practices

1. **Always run `npm run dev`** instead of separate server commands
2. **Keep watch-and-assist.sh running** during active development
3. **Clear console.log periodically** to keep it manageable
4. **Disable live-reload** when debugging reload-related issues
5. **Check console.log** after any unexpected behavior

## Summary

This workflow eliminates manual steps in the development cycle:

**Before:**
- Edit file → Save
- Switch to terminal → Restart server
- Switch to browser → Reload page
- Open DevTools → Copy console output
- Switch to Claude Code → Paste output
- Get fix → Repeat

**After:**
- Edit file → Save
- (Everything else happens automatically)
- Claude Code reads console.log and suggests fix
- Apply fix → Auto-restart → Auto-reload → Done

This creates a true end-to-end development cycle with minimal friction.
