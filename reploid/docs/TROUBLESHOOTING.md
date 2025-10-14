# 🔧 REPLOID Troubleshooting Guide

This document provides solutions to common issues you may encounter while using REPLOID.

---

## 📑 Table of Contents

- [Installation & Setup](#installation--setup)
- [Browser Issues](#browser-issues)
- [API & Network](#api--network)
- [File System & Storage](#file-system--storage)
- [Sentinel Agent FSM](#sentinel-agent-fsm)
- [Performance Issues](#performance-issues)
- [UI & Display](#ui--display)
- [Development & Debugging](#development--debugging)

---

## Installation & Setup

### Module Failed to Load

**Symptoms:**
- Console error: `Failed to load module`
- Blank screen or partial UI
- "DI Container initialization failed"

**Causes:**
1. Browser cache serving stale files
2. Incorrect file paths in config.json
3. Missing dependencies in module metadata
4. Circular dependency in DI container

**Solutions:**

```bash
# 1. Hard refresh browser
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)

# 2. Clear browser cache completely
Ctrl+Shift+Delete → Select "Cached images and files" → Clear

# 3. Verify config.json paths
# Check that all upgrade paths point to existing files
grep "path" config.json

# 4. Check browser console for specific module name
# Look for: "Failed to resolve dependency: [ModuleName]"
# Verify metadata.dependencies array in that module
```

**Prevention:**
- Use `npm run dev` for live reload during development
- Always validate config.json after editing
- Run self-tests after adding new modules: `SelfTester.runAllTests()`

---

### Server Won't Start

**Symptoms:**
- `Error: listen EADDRINUSE: address already in use`
- `Cannot GET /` in browser
- Server exits immediately

**Solutions:**

```bash
# 1. Kill process using port 8000
lsof -ti:8000 | xargs kill -9

# 2. Use different port
python3 -m http.server 8080

# 3. Check Node.js version (requires 18+)
node --version

# 4. Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# 5. For Hermes server issues
cd hermes
rm -rf node_modules
npm install
npm start
```

---

## Browser Issues

### IndexedDB Quota Exceeded

**Symptoms:**
- `QuotaExceededError` in console
- Agent can't save artifacts
- Session data not persisting

**Solutions:**

```javascript
// 1. Check current usage (in browser console)
navigator.storage.estimate().then(estimate => {
  console.log(`Using ${estimate.usage} of ${estimate.quota} bytes`);
  console.log(`${(estimate.usage / estimate.quota * 100).toFixed(2)}% full`);
});

// 2. Export important sessions first
// Click "💾 Export" button in status bar for each session

// 3. Clear old data
await StateManager.clearAllData();

// 4. Request persistent storage (prevents eviction)
await navigator.storage.persist();

// 5. Clear specific session
await StateManager.deleteSession('session_id_here');
```

**Prevention:**
- Export sessions regularly
- Use File System Access API to sync to disk
- Enable persistent storage on first run
- Monitor storage in Browser APIs panel

---

### Browser Compatibility

**Symptoms:**
- Features not working
- "This browser is not supported" warning
- IndexedDB errors

**Minimum Requirements:**
- Chrome 90+ (recommended)
- Firefox 88+
- Safari 14+
- Edge 90+

**Required Features:**
- IndexedDB (for persistence)
- ES6 Modules (for code loading)
- Web Workers (for sandboxed execution)
- Fetch API (for LLM calls)

**Check Support:**

```javascript
// Run in browser console
const support = {
  indexedDB: !!window.indexedDB,
  modules: 'noModule' in document.createElement('script'),
  workers: !!window.Worker,
  fetch: !!window.fetch,
  fileSystem: 'showDirectoryPicker' in window,
  notifications: 'Notification' in window
};
console.table(support);
```

---

### Web Workers Not Starting

**Symptoms:**
- Verification never completes
- Console error: `Failed to construct 'Worker'`
- Self-tests timeout

**Solutions:**

```bash
# 1. Ensure proper MIME types in server config
# Workers must be served as application/javascript

# 2. For Python server, no config needed
python3 -m http.server 8000

# 3. For Node.js, add to package.json dev script:
"dev": "npx serve -c serve.json -p 8000"

# 4. Create serve.json with:
{
  "headers": [
    {
      "source": "**/*.js",
      "headers": [{
        "key": "Content-Type",
        "value": "application/javascript; charset=utf-8"
      }]
    }
  ]
}

# 5. Check worker file exists
ls upgrades/verification-worker.js
ls upgrades/tool-worker.js
```

---

## API & Network

### LLM API Calls Failing

**Symptoms:**
- Agent stuck in PLANNING or GENERATING
- Console error: `API Error: 401` or `API Error: 429`
- "Failed to generate response"

**Solutions:**

```bash
# 1. Check API key is set
# For browser-only mode: Enter key in boot screen
# For proxy mode: Check .env file
cat .env | grep API_KEY

# 2. Verify key is valid
# Test with curl:
curl -H "Content-Type: application/json" \
     -H "x-goog-api-key: YOUR_KEY" \
     https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent

# 3. Check rate limits (429 error)
# Gemini free tier: 15 RPM (requests per minute)
# Solution: Wait 60 seconds or upgrade to paid tier

# 4. Try different provider
# Edit config.json:
{
  "providers": {
    "default": "openai",
    "fallbackProviders": ["gemini", "anthropic"]
  }
}

# 5. Check network connectivity
# Open browser DevTools → Network tab
# Look for failed requests to generativelanguage.googleapis.com
```

**API Key Resources:**
- Gemini: https://makersuite.google.com/app/apikey
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/account/keys

---

### CORS Errors

**Symptoms:**
- Console error: `Access-Control-Allow-Origin`
- LLM calls fail with network error
- File System Access blocked

**Solutions:**

```bash
# 1. Use proxy mode (recommended for production)
npm start
# Server handles CORS for you

# 2. For development, use browser flags (Chrome)
# WARNING: Only for development!
google-chrome --disable-web-security --user-data-dir=/tmp/chrome_dev

# 3. For File System Access CORS:
# No solution needed - this is expected browser security
# User must grant permission via dialog

# 4. For Gemini API CORS in browser-only mode:
# Use proxy server or enable CORS in your API provider settings
```

---

## File System & Storage

### File System Access Permission Denied

**Symptoms:**
- "📁 Connect Directory" button does nothing
- `DOMException: The user aborted a request`
- Files not syncing to disk

**Solutions:**

```javascript
// 1. Check browser support
if ('showDirectoryPicker' in window) {
  console.log('✓ File System Access supported');
} else {
  console.log('✗ Not supported in this browser');
  console.log('Use Chrome 86+, Edge 86+, or Opera 72+');
}

// 2. User must click button (gesture required)
// Can't programmatically request without user interaction

// 3. Re-request permission if denied
await BrowserAPIs.requestDirectoryAccess('readwrite');

// 4. Check granted permissions
const permissions = await navigator.permissions.query({name: 'file-system'});
console.log('File System permission:', permissions.state);

// 5. Reset permissions
// Chrome: Settings → Privacy → Site Settings → Recent permissions
// Clear permission for localhost:8000 and try again
```

---

### VFS Files Not Saving

**Symptoms:**
- Files disappear after refresh
- "Failed to save artifact" error
- Empty VFS Explorer

**Solutions:**

```javascript
// 1. Check IndexedDB status
await StateManager.testStorage();

// 2. Verify files were written
const allMeta = await StateManager.getAllArtifactMetadata();
console.log('VFS files:', Object.keys(allMeta));

// 3. Check IndexedDB in DevTools
// Chrome: DevTools → Application → Storage → IndexedDB → reploid-vfs

// 4. Test write capability
await StateManager.saveArtifact('/test.txt', 'Hello World');
const content = await StateManager.getArtifactContent('/test.txt');
console.log('Test file content:', content);

// 5. Clear corrupt database and reinitialize
await StateManager.clearAllData();
location.reload();
```

---

### Git VFS Errors

**Symptoms:**
- `Git operation failed`
- "No commit found for checkpoint"
- Rollback not working

**Solutions:**

```javascript
// 1. Check Git VFS initialized
const gitVfs = await DIContainer.resolve('GitVFS');
if (!gitVfs) {
  console.error('GitVFS not loaded');
  // Verify config.json includes GitVFS in upgrades
}

// 2. Verify checkpoint exists
const state = StateManager.getState();
console.log('Checkpoints:', state.checkpoints);

// 3. Create manual checkpoint
await SentinelFSM.createCheckpoint('manual-checkpoint');

// 4. Test rollback
await SentinelFSM.rollbackToCheckpoint('checkpoint-id');

// 5. Reset Git state if corrupted
await gitVfs.resetRepository();
```

---

## Sentinel Agent FSM

### Agent Stuck in State

**Symptoms:**
- FSM not progressing
- Status bar shows same state for >5 minutes
- No errors in console

**Common States & Solutions:**

#### CURATING_CONTEXT
```javascript
// Likely cause: LLM call hanging or failed
// Solution 1: Check network tab for API errors
// Solution 2: Cancel and retry
location.reload();

// Solution 3: Manually approve empty context
// (Only if you want agent to proceed without context)
```

#### AWAITING_CONTEXT_APPROVAL
```javascript
// This is expected! Agent is waiting for you.
// Solution: Click "Approve" or "Revise" button in Sentinel panel
```

#### PLANNING_WITH_CONTEXT
```javascript
// Agent is thinking. Large contexts take time.
// Solution 1: Wait (can take 30-60 seconds)
// Solution 2: Check console for errors
// Solution 3: Reduce context size in next attempt
```

#### GENERATING_PROPOSAL
```javascript
// Agent is writing dogs.md
// Solution 1: Wait (can take 1-2 minutes for large changes)
// Solution 2: Check if LLM API is rate-limited (429 error)
// Solution 3: Reduce scope of goal in next attempt
```

#### AWAITING_PROPOSAL_APPROVAL
```javascript
// This is expected! Review diffs.
// Solution: Approve/reject files in diff viewer
```

#### APPLYING_CHANGES
```javascript
// Should be fast (<10 seconds)
// If stuck: Check console for VFS write errors
// Solution: Clear IndexedDB and retry
await StateManager.clearAllData();
```

#### ERROR
```javascript
// Agent encountered unrecoverable error
// Solution 1: Check console for error details
// Solution 2: Click "Reset" to return to IDLE
// Solution 3: Report bug if error persists
```

---

### FSM Transitions Not Logged

**Symptoms:**
- State changes but no thought stream updates
- Empty "Agent Thoughts" panel
- Console shows state changes

**Solutions:**

```javascript
// 1. Check EventBus working
EventBus.emit('test', {data: 'hello'});
// Should see log in console

// 2. Verify UI subscriptions
const subscriptions = EventBus.getSubscriptionReport();
console.log('Active subscriptions:', subscriptions);

// 3. Re-initialize UI
await UI.init(bootConfig);

// 4. Check thought panel element exists
const thoughtPanel = document.getElementById('thought-stream');
console.log('Thought panel:', thoughtPanel);

// 5. Toggle to logs view and back
// Click "Show Advanced Logs" then "Show Agent Thoughts"
```

---

### Reflections Not Saving

**Symptoms:**
- REFLECTING state completes but no learning stored
- Learning History panel empty
- No improvement over time

**Solutions:**

```javascript
// 1. Check ReflectionStore loaded
const reflStore = await DIContainer.resolve('ReflectionStore');
if (!reflStore) {
  console.error('ReflectionStore not loaded - check config.json');
}

// 2. Verify reflections database
const reflections = await reflStore.getReflections();
console.log(`Found ${reflections.length} reflections`);

// 3. Manually add test reflection
await reflStore.addReflection({
  type: 'success',
  context: 'test',
  outcome: 'testing reflections',
  lesson: 'this is a test reflection'
});

// 4. Check IndexedDB
// DevTools → Application → IndexedDB → reploid-reflections

// 5. Clear and reinitialize if corrupted
await reflStore.clearOldReflections(0); // Clear all
```

---

## Performance Issues

### Slow LLM Responses

**Symptoms:**
- Agent takes >2 minutes per state
- High token usage reported
- Timeout errors

**Solutions:**

```javascript
// 1. Check context size
const state = StateManager.getState();
const contextSize = state.curated_context?.length || 0;
console.log(`Context size: ${contextSize} characters`);
// Recommendation: Keep under 50,000 chars

// 2. Use smaller model
// Edit config.json:
{
  "providers": {
    "geminiModel": "gemini-1.5-flash-latest", // Faster
    "openaiModel": "gpt-3.5-turbo" // Cheaper
  }
}

// 3. Reduce file count in context
// Adjust goal to be more specific:
// ✗ "Improve the codebase"
// ✓ "Refactor state-manager.js for better readability"

// 4. Monitor performance metrics
// Toggle to Performance panel
// Check "LLM API" section for bottlenecks
```

---

### High Memory Usage

**Symptoms:**
- Browser tab crashes
- "Out of memory" errors
- Sluggish UI performance

**Solutions:**

```javascript
// 1. Check current memory usage
const memStats = PerformanceMonitor.getMemoryStats();
console.log('Memory usage:', memStats);

// 2. Clear VFS cache
StateManager.clearCache();

// 3. Export and close old sessions
// Each session can use 10-50MB

// 4. Reduce performance sampling rate
// Edit performance-monitor.js:
// Change memory sampling from 30s to 60s

// 5. Use Chrome Task Manager
// Shift+Esc → Find your tab → Check memory usage
// Restart browser if >1GB
```

---

### UI Freezing/Lagging

**Symptoms:**
- Clicks don't register
- Animations stuttering
- Console floods with logs

**Solutions:**

```javascript
// 1. Disable verbose logging
// In browser console:
localStorage.setItem('debug', 'false');

// 2. Reduce performance monitoring
PerformanceMonitor.stopTracking();

// 3. Close performance-heavy panels
// Toggle away from Performance and Introspection views

// 4. Check for infinite loops in Web Workers
// Open DevTools → Sources → Workers
// Look for high CPU usage

// 5. Clear event listeners
EventBus.unsubscribeAll('UI');
await UI.init(bootConfig);
```

---

## UI & Display

### Diff Viewer Shows No Changes

**Symptoms:**
- Empty diff panel
- "No changes proposed" message
- Agent generated empty dogs.md

**Solutions:**

```javascript
// 1. Check proposal content
const state = StateManager.getState();
console.log('Proposal:', state.proposal);

// 2. Review agent thoughts
// Toggle to "Agent Thoughts" panel
// Look for reasoning about why no changes needed

// 3. Rephrase goal to be more explicit
// ✗ "Make it better"
// ✓ "Add error handling to fetchData function in api-client.js"

// 4. Check agent didn't abort due to safety
// Look for thoughts like "this change would be unsafe"

// 5. Verify DiffGenerator working
const diff = await DiffGenerator.generateDiff('/test.txt', 'old', 'new');
console.log('Test diff:', diff);
```

---

### Live Preview Not Showing

**Symptoms:**
- Preview panel blank/white
- iframe not loading
- "Preview not available" message

**Solutions:**

```javascript
// 1. Verify persona supports preview
// Only Website Builder and Product Prototype Factory have preview
console.log('Persona:', bootConfig.persona.id);

// 2. Check preview target file exists
const previewPath = bootConfig.persona.previewTarget; // e.g., /vfs/preview/index.html
const content = await StateManager.getArtifactContent(previewPath);
console.log('Preview file exists:', !!content);

// 3. Check iframe CSP errors in console
// Look for: "Refused to load ... violates Content Security Policy"

// 4. Manually load preview
const previewFrame = document.getElementById('preview-iframe');
const htmlContent = await StateManager.getArtifactContent('/vfs/preview/index.html');
previewFrame.srcdoc = htmlContent;

// 5. Check for JavaScript errors in preview
// Right-click iframe → Inspect → Console
```

---

### VFS Explorer Empty

**Symptoms:**
- File tree shows nothing
- "No files found" message
- Search returns no results

**Solutions:**

```javascript
// 1. Check VFS has files
const allMeta = await StateManager.getAllArtifactMetadata();
console.log('VFS files:', Object.keys(allMeta));

// 2. Re-render VFS Explorer
await VFSExplorer.refresh();

// 3. Check VFSExplorer initialized
const vfsExp = await DIContainer.resolve('VFSExplorer');
console.log('VFSExplorer:', vfsExp);

// 4. Manually trigger render
await UI.renderVfsExplorer();

// 5. Create test file and verify
await StateManager.saveArtifact('/test.txt', 'Hello');
await VFSExplorer.refresh();
```

---

### Panel Toggle Not Working

**Symptoms:**
- Clicking "Show Performance" does nothing
- Panels don't switch
- Button text doesn't update

**Solutions:**

```javascript
// 1. Check for JavaScript errors in console

// 2. Verify button element exists
const toggleBtn = document.getElementById('log-toggle-btn');
console.log('Toggle button:', toggleBtn);

// 3. Re-attach event listeners
await UI.setupEventListeners();

// 4. Manually toggle panels
UI.showOnlyPanel(document.getElementById('performance-panel'));

// 5. Check panel elements exist
const panels = {
  thoughts: document.getElementById('thought-panel'),
  perf: document.getElementById('performance-panel'),
  intro: document.getElementById('introspection-panel'),
  refl: document.getElementById('reflections-panel'),
  test: document.getElementById('self-test-panel'),
  apis: document.getElementById('browser-apis-panel'),
  logs: document.getElementById('advanced-log-panel')
};
console.table(panels);
```

---

## Development & Debugging

### Self-Tests Failing

**Symptoms:**
- Test success rate <80%
- Specific test suite failures
- Agent blocked from applying changes

**Common Failures & Fixes:**

#### Module Loading Tests
```javascript
// Error: "Module X not found"
// Solution: Check config.json has module in upgrades array
// Verify module file exists at specified path
```

#### Tool Execution Tests
```javascript
// Error: "Tool 'read_artifact' failed"
// Solution: Check StateManager initialized
// Verify VFS has test data
await StateManager.saveArtifact('/test.txt', 'test content');
```

#### FSM Transition Tests
```javascript
// Error: "Invalid state transition"
// Solution: Check SentinelFSM loaded properly
// Verify FSM state machine not corrupted
const fsm = await DIContainer.resolve('SentinelFSM');
console.log('FSM current state:', fsm.getCurrentState());
```

#### Storage Tests
```javascript
// Error: "IndexedDB write failed"
// Solution: Clear quota, request persistent storage
await StateManager.clearAllData();
await navigator.storage.persist();
```

#### Performance Monitoring Tests
```javascript
// Error: "PerformanceMonitor not tracking"
// Solution: Restart monitoring
PerformanceMonitor.resetMetrics();
PerformanceMonitor.startTracking();
```

**Run Specific Test Suite:**

```javascript
// In browser console
const result = await SelfTester.testModuleLoading();
console.log('Module tests:', result);

const result2 = await SelfTester.testToolExecution();
console.log('Tool tests:', result2);
```

---

### Console Flooded with Logs

**Symptoms:**
- Can't read errors
- Performance degradation
- Browser DevTools slow

**Solutions:**

```javascript
// 1. Filter by level
// DevTools → Console → Filter: -debug

// 2. Disable debug logs
localStorage.setItem('reploid:loglevel', 'warn');

// 3. Adjust EventBus verbosity
// Edit event-bus.js:
// Comment out logger.info lines, keep logger.error

// 4. Use console groups
// Filter → Custom filter: "EventBus"
// Right-click → Hide messages from EventBus

// 5. Restart with clean console
location.reload();
// Ctrl+L to clear console after load
```

---

### Module Dependency Errors

**Symptoms:**
- "Circular dependency detected"
- "Dependency X not found"
- DI Container fails to resolve

**Solutions:**

```javascript
// 1. Check dependency graph
const introspector = await DIContainer.resolve('Introspector');
const graph = await introspector.getModuleGraph();
console.log('Dependency graph:', graph);

// 2. Verify metadata.dependencies match actual usage
// Edit module file:
metadata: {
  dependencies: ['Utils', 'EventBus', 'StateManager'] // Must match deps parameter
}

// 3. Check for circular deps
// A depends on B, B depends on A
// Solution: Extract shared code to Utils

// 4. Reinitialize DI Container
await DIContainer.clear();
await DIContainer.loadModules(config.upgrades);

// 5. Load modules in correct order
// Dependencies must load before dependents
// Check config.json order
```

---

### Debugging Web Workers

**Symptoms:**
- Worker fails silently
- Verification hangs
- No error messages

**Solutions:**

```javascript
// 1. Check Workers in DevTools
// Chrome: DevTools → Sources → Workers tab
// Should see: verification-worker.js, tool-worker.js

// 2. Add error listeners
const worker = new Worker('upgrades/verification-worker.js');
worker.onerror = (error) => {
  console.error('Worker error:', error);
};

// 3. Check worker postMessage format
worker.postMessage({
  type: 'execute',
  code: 'console.log("test")'
});

// 4. Verify worker can load dependencies
// Check worker file has proper importScripts if needed

// 5. Test worker directly
// DevTools → Sources → Workers → verification-worker.js
// Set breakpoint, inspect execution
```

---

## Getting Additional Help

### Before Filing an Issue

1. **Check console for errors**
   - Press F12 → Console tab
   - Look for red error messages
   - Copy full stack trace

2. **Export debug report**
   ```javascript
   const report = {
     userAgent: navigator.userAgent,
     state: StateManager.getState(),
     storage: await navigator.storage.estimate(),
     modules: DIContainer.getAllModules(),
     subscriptions: EventBus.getSubscriptionReport(),
     performance: PerformanceMonitor.getMetrics(),
     testResults: await SelfTester.runAllTests()
   };
   console.log(JSON.stringify(report, null, 2));
   // Copy output
   ```

3. **Note reproduction steps**
   - What persona were you using?
   - What goal did you set?
   - What state was the agent in?
   - What did you click/do right before error?

4. **Check known issues**
   - Read ROADMAP.md for planned fixes
   - Search GitHub issues
   - Check RFC-STATUS.md for incomplete features

### Contact & Support

- **GitHub Issues**: https://github.com/anthropics/reploid/issues
- **Documentation**: `docs/` directory
- **Architecture**: `blueprints/` directory
- **RFCs**: `docs/rfcs/` directory

---

## Common Error Messages

### `QuotaExceededError`
→ See [IndexedDB Quota Exceeded](#indexeddb-quota-exceeded)

### `Failed to fetch`
→ See [LLM API Calls Failing](#llm-api-calls-failing)

### `DOMException: The user aborted a request`
→ See [File System Access Permission Denied](#file-system-access-permission-denied)

### `Circular dependency detected`
→ See [Module Dependency Errors](#module-dependency-errors)

### `Module not found`
→ See [Module Failed to Load](#module-failed-to-load)

### `Worker construction failed`
→ See [Web Workers Not Starting](#web-workers-not-starting)

### `Invalid state transition`
→ See [Agent Stuck in State](#agent-stuck-in-state)

### `Git operation failed`
→ See [Git VFS Errors](#git-vfs-errors)

---

*Last Updated: 2025-09-30*
