# REPLOID API Documentation

**Version:** 1.0.0
**Last Updated:** 2025-09-30

This document provides an overview of REPLOID's module API. For detailed JSDoc comments, see the source files.

---

## 📚 Core Modules

### Utils (`upgrades/utils.js`)

**Type:** Pure utility module (no dependencies)
**Status:** ✅ Fully documented with JSDoc

**Error Classes:**
- `ApplicationError` - Base error class with details object
- `ApiError` - LLM API communication errors
- `ToolError` - Tool execution errors
- `StateError` - State management errors
- `ConfigError` - Configuration validation errors
- `ArtifactError` - VFS artifact operation errors
- `AbortError` - Operation abortion (user or timeout)
- `WebComponentError` - Web component initialization errors

**Logging:**
- `logger.debug(message, details)` - Debug level logging
- `logger.info(message, details)` - Info level logging
- `logger.warn(message, details)` - Warning level logging
- `logger.error(message, details)` - Error level logging

**String Utilities:**
- `kabobToCamel(string)` - Convert kebab-case to camelCase
- `trunc(str, len)` - Truncate string with ellipsis
- `escapeHtml(unsafe)` - Escape HTML special characters
- `sanitizeLlmJsonRespPure(rawText, logger)` - Extract JSON from LLM responses

**HTTP:**
- `post(url, body)` - HTTP POST with JSON handling

**DRY Helpers (Added 2025-09-30):**
- `createSubscriptionTracker()` - EventBus subscription tracking for memory leak prevention
- `showButtonSuccess(button, originalText, successText, duration)` - Temporary button feedback
- `exportAsMarkdown(filename, content)` - Export content as .md file

---

### StateManager (`upgrades/state-manager.js`)

**Type:** Singleton state management with VFS
**Dependencies:** Utils, Storage (IndexedDB or localStorage)

**Core API:**
- `getState()` - Get current agent state
- `setState(updates)` - Update state (shallow merge)
- `resetState()` - Reset to initial state

**VFS Operations:**
- `saveArtifact(path, content, metadata)` - Save file to VFS
- `getArtifactContent(path)` - Read file content
- `getArtifactMetadata(path)` - Get file metadata
- `getAllArtifactMetadata()` - Get all files metadata
- `deleteArtifact(path)` - Delete file from VFS
- `clearAllData()` - Clear entire VFS

**Session Management:**
- `loadSession(sessionId)` - Load saved session
- `saveSession()` - Save current session
- `deleteSession(sessionId)` - Delete session
- `getAllSessions()` - List all sessions

**Checkpoints:**
- `createCheckpoint(label)` - Create rollback point
- `restoreCheckpoint(checkpointId)` - Rollback to checkpoint

---

### EventBus (`upgrades/event-bus.js`)

**Type:** Pub/sub event system
**Dependencies:** Utils
**Status:** ✅ Enhanced with subscription tracking (2025-09-30)

**API:**
- `on(eventName, listener, moduleId?)` - Subscribe to event (returns unsubscribe function)
- `off(eventName, listener)` - Unsubscribe from event
- `emit(eventName, data)` - Publish event
- `unsubscribeAll(moduleId)` - Cleanup all subscriptions for module
- `getSubscriptionReport()` - Get active subscription counts

**Common Events:**
- `agent:state:change` - FSM state transitions
- `artifact:saved` - VFS file saved
- `artifact:deleted` - VFS file deleted
- `tool:executed` - Tool execution completed
- `llm:response` - LLM API response received
- `performance:update` - Performance metrics updated

---

## 🧠 RSI Modules

### Introspector (`upgrades/introspector.js`)

**Type:** Self-analysis and code introspection
**Dependencies:** Utils, EventBus, StateManager

**API:**
- `getModuleGraph()` - Analyze dependency graph
- `getToolCatalog()` - Discover available tools
- `analyzeOwnCode(modulePath)` - Complexity analysis, TODO extraction
- `getCapabilities()` - Browser feature detection
- `generateSelfReport()` - Export markdown report

**Use Cases:**
- Agent understanding its own architecture
- Identifying refactoring opportunities
- Detecting circular dependencies
- Browser capability awareness

---

### ReflectionStore (`upgrades/reflection-store.js`)

**Type:** Persistent learning storage
**Dependencies:** Utils, IndexedDB

**API:**
- `addReflection(reflection)` - Save learning experience
- `getReflections(filters)` - Query reflections
- `getPatterns()` - Identify recurring patterns
- `clearOldReflections(cutoffTimestamp)` - Cleanup old data
- `generateReport()` - Export markdown report

**Reflection Schema:**
```javascript
{
  id: 'uuid',
  timestamp: 1234567890,
  type: 'success' | 'failure' | 'insight',
  context: 'What was happening',
  outcome: 'What resulted',
  lesson: 'What was learned',
  tags: ['tag1', 'tag2']
}
```

---

### SelfTester (`upgrades/self-tester.js`)

**Type:** Automated validation framework
**Dependencies:** Utils, EventBus, StateManager

**API:**
- `runAllTests()` - Execute all test suites
- `testModuleLoading()` - Verify modules load correctly
- `testToolExecution()` - Verify tools work
- `testFSMTransitions()` - Verify state machine integrity
- `testStorageSystems()` - Verify IndexedDB/VFS
- `testPerformanceMonitoring()` - Verify metrics collection
- `getLastResults()` - Get cached test results
- `generateReport()` - Export markdown report

**Test Suites:**
1. Module Loading (5 tests)
2. Tool Execution (4 tests)
3. FSM Transitions (6 tests)
4. Storage Systems (5 tests)
5. Performance Monitoring (4 tests)

**Validation Threshold:** 80% pass rate required for change approval

---

### PerformanceMonitor (`upgrades/performance-monitor.js`)

**Type:** Metrics collection and analysis
**Dependencies:** Utils, EventBus

**API:**
- `startTracking()` - Begin metrics collection
- `stopTracking()` - Stop collection
- `recordToolExecution(toolName, duration)` - Log tool call
- `recordLLMCall(model, tokens, duration)` - Log API call
- `recordStateTransition(from, to, duration)` - Log FSM transition
- `getMetrics()` - Get all metrics
- `getLLMStats()` - Get API call statistics
- `getMemoryStats()` - Get memory usage
- `resetMetrics()` - Clear all data
- `generateReport()` - Export markdown report

**Metrics Tracked:**
- Session uptime
- Tool execution counts and durations
- LLM API calls and token usage
- Memory usage samples
- State transition timing

---

### BrowserAPIs (`upgrades/browser-apis.js`)

**Type:** Web API integration layer
**Dependencies:** Utils, EventBus, StateManager

**File System Access API:**
- `requestDirectoryAccess(mode)` - Get directory handle
- `readFile(path)` - Read from real filesystem
- `writeFile(path, content)` - Write to real filesystem
- `syncArtifactToFilesystem(artifactPath)` - VFS → Disk sync

**Notifications API:**
- `requestNotificationPermission()` - Request permission
- `showNotification(title, options)` - Display notification

**Storage API:**
- `getStorageEstimate()` - Get quota/usage stats
- `requestPersistentStorage()` - Prevent eviction

**Other APIs:**
- `copyToClipboard(text)` - Clipboard API
- `shareContent(title, text, url)` - Web Share API
- `requestWakeLock()` - Keep screen awake
- `releaseWakeLock()` - Release wake lock

**Capabilities:**
- `getCapabilities()` - Check which APIs are available
- `generateReport()` - Export markdown report

---

## 🎨 UI Modules

### UI (`upgrades/ui-manager.js`)

**Type:** Dashboard orchestration
**Dependencies:** Utils, EventBus, StateManager, DiffGenerator, VFSExplorer, PerformanceMonitor, Introspector, ReflectionStore, SelfTester, BrowserAPIs

**API:**
- `init(config)` - Initialize dashboard
- `setupEventListeners()` - Attach button handlers
- `showOnlyPanel(panel)` - Panel visibility helper (DRY pattern)

**Panel Rendering:**
- `renderVfsExplorer()` - File tree display
- `renderPerformancePanel()` - Metrics dashboard
- `renderIntrospectionPanel()` - Self-analysis view
- `renderReflectionsPanel()` - Learning history
- `renderSelfTestPanel()` - Test results
- `renderBrowserAPIsPanel()` - Browser capabilities

**Session Export:**
- `exportSessionReport()` - Generate markdown report
- `generateSessionReport()` - Build report content

---

### VFSExplorer (`upgrades/vfs-explorer.js`)

**Type:** File tree UI component
**Dependencies:** Utils, EventBus, StateManager

**API:**
- `init(containerId)` - Initialize in DOM element
- `refresh()` - Rebuild file tree
- `search(query)` - Filter files
- `selectFile(path)` - Programmatic selection

**Features:**
- Collapsible directory tree
- File search with highlighting
- Click to preview content
- Copy path to clipboard
- Folder/file icons
- Context menu (future)

---

### DiffGenerator (`upgrades/diff-generator.js`)

**Type:** Diff computation
**Dependencies:** Utils

**API:**
- `generateDiff(path, oldContent, newContent)` - Compute line-by-line diff
- `generateHtmlDiff(diff)` - Render as HTML
- `exportDiffAsMarkdown(diffs)` - Export all diffs

**Diff Format:**
```javascript
{
  path: '/file.js',
  oldContent: '...',
  newContent: '...',
  changes: [
    { type: 'added', line: 5, content: 'new code' },
    { type: 'removed', line: 10, content: 'old code' },
    { type: 'unchanged', line: 15, content: 'same code' }
  ]
}
```

---

## 🤖 Agent Modules

### SentinelFSM (`upgrades/sentinel-fsm.js`)

**Type:** Sentinel Agent finite state machine
**Dependencies:** Utils, EventBus, StateManager, Tools, SelfTester

**States:**
1. `IDLE` - Waiting for goal
2. `CURATING_CONTEXT` - Selecting files
3. `AWAITING_CONTEXT_APPROVAL` - Human approval needed
4. `PLANNING_WITH_CONTEXT` - LLM planning
5. `GENERATING_PROPOSAL` - Creating dogs.md
6. `AWAITING_PROPOSAL_APPROVAL` - Human approval needed
7. `APPLYING_CHANGES` - Writing files to VFS
8. `REFLECTING` - Learning from outcome
9. `DONE` - Task complete
10. `ERROR` - Unrecoverable error

**API:**
- `start(goal)` - Begin agent cycle
- `transitionTo(state)` - Manual state change
- `getCurrentState()` - Get current state
- `approveContext()` - User approves context bundle
- `reviseContext()` - User requests revision
- `approveProposal()` - User approves changes
- `rejectProposal()` - User rejects changes
- `reset()` - Return to IDLE

**Event Emissions:**
- `agent:state:change` - On every transition
- `agent:goal:set` - When goal is set
- `agent:cycle:complete` - When DONE reached
- `agent:error` - On ERROR state

---

## 🛠️ Tool System

### ToolRunner (`upgrades/tool-runner.js`)

**Type:** Tool execution engine
**Dependencies:** Utils, EventBus, StateManager

**API:**
- `executeTool(toolName, args)` - Execute tool by name
- `getAvailableTools()` - List all tools
- `registerTool(definition)` - Add dynamic tool
- `unregisterTool(toolName)` - Remove tool

**Built-in Tools:**
- `read_artifact` - Read VFS file
- `write_artifact` - Write VFS file
- `list_artifacts` - List VFS files
- `delete_artifact` - Delete VFS file
- `get_state` - Read agent state
- `update_state` - Modify agent state
- `create_checkpoint` - Create rollback point
- `list_checkpoints` - List checkpoints

**RSI Tools (when enabled):**
- `create_tool` - Meta-tool for tool creation
- `modify_goal` - Safe goal evolution
- `create_blueprint` - Knowledge transfer

---

## 🔌 Integration Examples

### Example 1: Using Utils for Logging

```javascript
const { logger } = await DIContainer.resolve('Utils');

logger.info('Operation started', { operation: 'saveArtifact', path: '/test.txt' });

try {
  // do work
  logger.debug('Progress update', { progress: 50 });
} catch (error) {
  logger.error('Operation failed', { error: error.message, stack: error.stack });
}
```

### Example 2: EventBus with Auto-Cleanup

```javascript
const EventBus = await DIContainer.resolve('EventBus');

// Subscribe with module ID for auto-cleanup
const unsubscribe = EventBus.on('artifact:saved', (data) => {
  console.log('File saved:', data.path);
}, 'MyModule');

// Later, cleanup all subscriptions for module
EventBus.unsubscribeAll('MyModule');
```

### Example 3: VFS Operations

```javascript
const StateManager = await DIContainer.resolve('StateManager');

// Save file
await StateManager.saveArtifact('/docs/README.md', '# Hello World', {
  author: 'Agent',
  created: Date.now()
});

// Read file
const content = await StateManager.getArtifactContent('/docs/README.md');
console.log(content); // "# Hello World"

// List all files
const allFiles = await StateManager.getAllArtifactMetadata();
console.log(Object.keys(allFiles)); // ['/docs/README.md', ...]
```

### Example 4: Running Self-Tests

```javascript
const SelfTester = await DIContainer.resolve('SelfTester');

// Run all test suites
const results = await SelfTester.runAllTests();

console.log(`Success rate: ${results.summary.successRate.toFixed(1)}%`);
console.log(`Passed: ${results.summary.passed}/${results.summary.total}`);

// Check threshold
if (results.summary.successRate >= 80) {
  console.log('✓ Tests passed - safe to proceed');
} else {
  console.log('✗ Tests failed - blocking changes');
}
```

### Example 5: Performance Monitoring

```javascript
const PerformanceMonitor = await DIContainer.resolve('PerformanceMonitor');

// Record tool execution
PerformanceMonitor.recordToolExecution('read_artifact', 45); // 45ms

// Record LLM call
PerformanceMonitor.recordLLMCall('gemini-1.5-flash', 1500, 2300); // 1500 tokens, 2.3s

// Get metrics
const metrics = PerformanceMonitor.getMetrics();
console.log('Uptime:', metrics.session.uptime, 'ms');
console.log('Tool calls:', metrics.tools.totalCalls);

// Export report
const report = PerformanceMonitor.generateReport();
exportAsMarkdown('performance.md', report);
```

---

## 📖 Further Reading

- **Architecture Blueprints:** `blueprints/` directory - 26 design specifications
- **Module Source Code:** `upgrades/` directory - Fully documented with JSDoc
- **Quick Start Guide:** `docs/QUICK-START.md` - Interactive tutorial
- **Troubleshooting:** `docs/TROUBLESHOOTING.md` - Common issues and solutions
- **Roadmap:** `docs/ROADMAP.md` - Development priorities

---

## 🔄 Versioning

REPLOID follows semantic versioning:
- **Major:** Breaking API changes
- **Minor:** New features, backward compatible
- **Patch:** Bug fixes, documentation updates

Current version: **1.0.0** (RSI Core 5/5 complete)

---

*For detailed API documentation, see JSDoc comments in source files.* 📚
