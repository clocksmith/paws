# Widget Implementation Clusters

**Status:** 10/75 modules complete - 65 remaining modules organized into 4 implementation clusters

**Completed Widgets:**
1. ✅ StateManager - VFS tracking, checkpoints, storage
2. ✅ EventBus - Live event stream, listener monitoring
3. ✅ ToolRunner - Tool execution tracking, success rates
4. ✅ ApiClient - API calls, token usage, connection status
5. ✅ PerformanceMonitor - Memory, LLM stats, session metrics
6. ✅ StateHelpersPure - Pure state helper functions (Cluster 2)
7. ✅ ToolRunnerPureHelpers - Pure tool conversion functions (Cluster 2)
8. ✅ Utils - Logger stats, error tracking, utility documentation (Cluster 2)
9. ✅ Storage - I/O operations, storage usage, artifact tracking (Cluster 2)
10. ✅ DIContainer - Module registry, load order, dependency tracking (Cluster 2)

---

## CLUSTER 1: Simple Utility Modules
**Difficulty:** ⭐ Easy
**Modules:** 6
**Estimated Time:** 2-3 hours total

These modules have minimal internal state, simple metrics, and straightforward widget implementations. Perfect for getting familiar with the widget protocol.

### 1.1 DiffUtils
**File:** `/upgrades/diff-utils.js`
**Status Display:**
- State: idle (always, unless computing)
- Primary: "N diffs computed"
- Secondary: "Cache: N items"

**Panel Contents:**
- Diff statistics (total computed, cache hits, cache misses)
- Average diff size (lines added/removed)
- Cache size and hit rate
- Clear cache button

**Implementation Notes:**
- Add `_diffHistory` array to track computed diffs
- Add `_cacheStats` for hit/miss tracking
- Very simple - mostly just counters

---

### 1.2 DogsParser / DogsParserBrowser
**File:** `/upgrades/dogs-parser.js`, `/upgrades/dogs-parser-browser.js`
**Status Display:**
- State: active when parsing, idle otherwise
- Primary: "N bundles parsed"
- Secondary: "N errors"

**Panel Contents:**
- Total bundles parsed
- Parse errors with details
- Most recent bundles
- Average parse time
- Common error types

**Implementation Notes:**
- Track parse history with timestamps
- Categorize errors (syntax, validation, etc.)
- Simple error counting

---

### 1.3 CatsParser
**File:** `/upgrades/cats-parser.js`
**Status Display:**
- State: active when parsing, idle otherwise
- Primary: "N tests parsed"
- Secondary: "Coverage: N%"

**Panel Contents:**
- Total tests parsed
- Test coverage stats
- Parse errors
- Most recent test files
- Test success rate

**Implementation Notes:**
- Similar to DogsParser
- Add coverage calculation
- Track test results

---

### 1.4 RateLimiter
**File:** `/upgrades/rate-limiter.js`
**Status Display:**
- State: warning if near limit, active if requests queued
- Primary: "N tokens available"
- Secondary: "Queue: N requests"

**Panel Contents:**
- Token bucket visualization (fill level)
- Queue size and wait times
- Requests per minute (current rate)
- Blocked requests count
- Rate limit config (max tokens, refill rate)

**Implementation Notes:**
- Expose internal token count
- Track queue length
- Count rejected requests

---

### 1.5 AuditLogger
**File:** `/upgrades/audit-logger.js`
**Status Display:**
- State: active if recent logs, idle otherwise
- Primary: "N events logged"
- Secondary: "Last: Xs ago"

**Panel Contents:**
- Total events by category (VFS, API, Security)
- Recent audit events (last 20)
- Events per hour graph
- Search/filter by category
- Export audit log button

**Implementation Notes:**
- Already has event history
- Add categorization
- Simple event stream display

---

### 1.6 ToastNotifications
**File:** `/upgrades/toast-notifications.js`
**Status Display:**
- State: active if toasts visible, idle otherwise
- Primary: "N active"
- Secondary: "N total shown"

**Panel Contents:**
- Currently visible toasts
- Toast history (last 50)
- Toast statistics by type (success, error, warning, info)
- Notification settings (duration, position)
- Clear all button

**Implementation Notes:**
- Track toast history
- Count by type
- Very straightforward

---

## CLUSTER 2: Infrastructure & Storage ✅ COMPLETE
**Difficulty:** ⭐⭐ Medium-Low
**Modules:** 5 (Config skipped - not a module)
**Time Spent:** ~2 hours
**Status:** All infrastructure widgets implemented

These modules are core infrastructure with important state but relatively straightforward presentation needs.

### 2.1 DIContainer ✅
**File:** `/upgrades/di-container.js`
**Status:** IMPLEMENTED
**Status Display:**
- State: warning if failed modules, active during load
- Primary: "N modules loaded"
- Secondary: "N failed"

**Panel Contents:**
- All loaded modules (name, version, type)
- Module dependency graph visualization
- Load order timeline
- Failed modules with error messages
- Module search/filter
- Reload module button

**Implementation Notes:**
- Already tracks all modules
- Show dependency relationships
- Indicate load order
- Color-code by module type (service, ui, utility)

---

### 2.2 Utils ✅
**File:** `/upgrades/utils.js`
**Status:** IMPLEMENTED
**Status Display:**
- State: idle (always available)
- Primary: "N utilities available"
- Secondary: "Most used: X"

**Panel Contents:**
- List of available utilities (logger, errors, helpers)
- Usage stats (which utils called most)
- Recent errors created
- Logger statistics (by level)
- Utility documentation links

**Implementation Notes:**
- Track utility usage counts
- Monitor logger calls by level
- List error types created

---

### 2.3 Storage ✅
**File:** `/upgrades/storage-localstorage.js`
**Status:** IMPLEMENTED
**Status Display:**
- State: active during I/O, idle otherwise
- Primary: "N MB used"
- Secondary: "N artifacts"

**Panel Contents:**
- Storage quota (used vs available)
- Storage breakdown (artifacts, state, checkpoints)
- Recent I/O operations (reads, writes, deletes)
- IndexedDB stats
- Clear cache button
- Export all data button

**Implementation Notes:**
- Track I/O operations
- Calculate storage usage
- Monitor IndexedDB quota

---

### 2.4 Config ❌
**File:** N/A (Not a module - config is loaded via boot/config.js)
**Status:** SKIPPED - Not a DI module

**Note:** Config is not a module in the DI container, it's a JSON file loaded at boot time.

---

### 2.5 StateHelpersPure ✅
**File:** `/upgrades/state-helpers-pure.js`
**Status:** IMPLEMENTED
**Status Display:**
- State: idle (pure functions)
- Primary: "Pure utilities"
- Secondary: "No state"

**Panel Contents:**
- List of available helper functions
- Function documentation
- Usage examples
- Note: "Stateless utility module"

**Implementation Notes:**
- Minimal widget (mostly documentation)
- No dynamic state to track

---

### 2.6 ToolRunnerPureHelpers ✅
**File:** `/upgrades/tool-runner-pure-helpers.js`
**Status:** IMPLEMENTED
**Status Display:**
- State: idle (pure functions)
- Primary: "Pure helpers"
- Secondary: "No state"

**Panel Contents:**
- List of helper functions
- Function signatures
- Conversion utilities available
- Note: "Stateless helper module"

**Implementation Notes:**
- Similar to StateHelpersPure
- Minimal dynamic content

---

## CLUSTER 3: Communication & Advanced UI
**Difficulty:** ⭐⭐⭐ Medium-High
**Modules:** 6
**Estimated Time:** 4-6 hours total

These modules involve real-time communication, complex state management, or advanced UI features.

### 3.1 WebRTCComms
**File:** `/upgrades/webrtc-comms.js`
**Status Display:**
- State: active if connected, warning if degraded
- Primary: "N peers"
- Secondary: "N KB/s"

**Panel Contents:**
- Connected peers (ID, connection quality)
- Bandwidth graph (upload/download)
- Connection quality indicators (latency, packet loss)
- Messages sent/received counts
- Peer connection timeline
- Disconnect peer buttons

**Implementation Notes:**
- Track peer connections
- Monitor bandwidth usage
- Calculate connection quality metrics
- Show message throughput

---

### 3.2 MultiProviderAPI
**File:** `/upgrades/multi-provider-api.js`
**Status Display:**
- State: active during API call
- Primary: "Provider: X"
- Secondary: "N tokens used"

**Panel Contents:**
- Current provider (Gemini, OpenAI, Anthropic, Local)
- Provider comparison table (tokens, cost, latency)
- Provider switch history
- Token usage by provider
- Model selection per provider
- Switch provider buttons

**Implementation Notes:**
- Track provider usage stats
- Calculate costs per provider
- Show failover history
- Provider health monitoring

---

### 3.3 WebLLMAdapter
**File:** `/upgrades/webllm-adapter.js`
**Status Display:**
- State: loading during model load, active during inference
- Primary: "Model: X"
- Secondary: "GPU: N% used"

**Panel Contents:**
- Current model loaded
- Model loading progress
- GPU memory usage
- Inference statistics (tokens/sec)
- Available WebLLM models
- Model cache status
- Load model dropdown

**Implementation Notes:**
- Track model loading state
- Monitor WebGPU usage
- Show inference performance
- Model switching UI

---

### 3.4 AdvancedLogPanel
**File:** `/upgrades/advanced-log-panel.js`
**Status Display:**
- State: active if recent logs, idle otherwise
- Primary: "N entries"
- Secondary: "N errors"

**Panel Contents:**
- Full log viewer with virtual scrolling
- Filter by level (debug, info, warn, error)
- Search logs by keyword
- Log statistics by level
- Export logs button
- Clear logs button
- Auto-scroll toggle

**Implementation Notes:**
- Reuse existing log rendering
- Add filtering and search
- Show log statistics
- May already have some UI - convert to widget

---

### 3.5 HITLController
**File:** `/upgrades/hitl-controller.js`
**Status Display:**
- State: warning if pending approvals
- Primary: "Mode: X"
- Secondary: "N pending"

**Panel Contents:**
- Master mode (Autonomous vs HITL)
- Per-module overrides
- Pending approvals queue
- Approval history
- Approval rate (auto vs manual)
- Quick approve/reject buttons

**Implementation Notes:**
- Track approval requests
- Show pending queue
- Display override configuration
- Approval statistics

---

### 3.6 HITLControlPanel
**File:** `/upgrades/hitl-control-panel.js`
**Status Display:**
- State: matches HITLController mode
- Primary: "Autonomous" or "Manual"
- Secondary: "N modules configured"

**Panel Contents:**
- Already has custom UI
- Convert to use widget protocol
- Reuse existing rendering in renderPanel
- Add getStatus and getControls

**Implementation Notes:**
- This already has UI - just wrap it in widget interface
- Simplest "conversion" task

---

## CLUSTER 4: Agent/FSM & Complex UI Conversions
**Difficulty:** ⭐⭐⭐⭐ High
**Modules:** 9
**Estimated Time:** 8-12 hours total

These modules require state machine visualization, complex agent logic tracking, or converting sophisticated existing UI (D3.js, Chart.js) to widget protocol.

### 4.1 SentinelFSM
**File:** `/upgrades/sentinel-fsm.js`
**Status Display:**
- State: current FSM state
- Primary: "State: X"
- Secondary: "Cycle: N"

**Panel Contents:**
- Current FSM state with icon
- State machine diagram (interactive)
- Transition history (last 20)
- Time in current state
- Cycle statistics
- State transition counts
- Force state transition (debug only)

**Implementation Notes:**
- Complex - state machine visualization
- Track state history
- Show valid transitions from current state
- Highlight current state in diagram

---

### 4.2 SentinelTools
**File:** `/upgrades/sentinel-tools.js`
**Status Display:**
- State: active if tool running
- Primary: "N tools available"
- Secondary: "Last: X"

**Panel Contents:**
- All available tools catalog
- Tool execution history
- Tool success rates
- Most used tools
- Tool execution timeline
- Tool parameters for common tools
- Execute tool button (with params)

**Implementation Notes:**
- Show full MCP tool catalog
- Track tool usage patterns
- Provide tool execution UI
- Parameter validation

---

### 4.3 ContextCurator
**File:** `/upgrades/context-curator.js`
**Status Display:**
- State: active during curation, idle otherwise
- Primary: "N sources"
- Secondary: "Relevance: N%"

**Panel Contents:**
- Context sources (artifacts, history, etc.)
- Relevance scoring per source
- Context window usage
- Curation history
- Token budget allocation
- Context optimization stats
- Refresh context button

**Implementation Notes:**
- Show context selection logic
- Display relevance scores
- Track context evolution
- Token usage by source

---

### 4.4 ReflectionEngine
**File:** `/upgrades/reflection-engine.js`
**Status Display:**
- State: active during reflection
- Primary: "N insights"
- Secondary: "Quality: N/10"

**Panel Contents:**
- Recent insights generated
- Insight quality scores
- Reflection patterns identified
- Success/failure analysis
- Learning trajectory
- Meta-cognitive metrics
- Generate reflection button

**Implementation Notes:**
- Complex - meta-cognitive analysis
- Show learning progression
- Quality scoring visualization
- Pattern recognition results

---

### 4.5 ActionLogger
**File:** `/upgrades/action-logger.js`
**Status Display:**
- State: active if recent actions
- Primary: "N actions"
- Secondary: "N errors"

**Panel Contents:**
- Action timeline (chronological)
- Actions by category
- Error actions highlighted
- Action success rate
- Action search/filter
- Export action log
- Replay action (if safe)

**Implementation Notes:**
- Timeline visualization
- Action categorization
- Error highlighting
- Searchable history

---

### 4.6 VFSExplorer (Conversion)
**File:** `/upgrades/vfs-explorer.js`
**Status Display:**
- State: active during search, idle otherwise
- Primary: "N files"
- Secondary: "Selected: X"

**Panel Contents:**
- **REUSE existing file tree rendering in renderPanel()**
- Add getStatus() - file count, selection
- Add getControls() - refresh, expand/collapse buttons
- Keep existing custom init() for backwards compatibility

**Implementation Notes:**
- Easiest conversion - already has full UI
- Just wrap existing functionality
- Non-breaking change

---

### 4.7 MetricsDashboard (Conversion)
**File:** `/upgrades/metrics-dashboard.js`
**Status Display:**
- State: active if monitoring
- Primary: "Mem: N MB"
- Secondary: "CPU: N%"

**Panel Contents:**
- **REUSE existing Chart.js rendering in renderPanel()**
- Add getStatus() - current memory and CPU
- Add getControls() - pause/resume, export buttons
- Keep existing updateCharts() method

**Implementation Notes:**
- Medium conversion - has Chart.js
- Wrap charts in renderPanel
- Add status extraction
- Ensure charts update in expanded mode

---

### 4.8 AgentVisualizer (Conversion)
**File:** `/upgrades/agent-visualizer.js`
**Status Display:**
- State: matches SentinelFSM current state
- Primary: "State: X"
- Secondary: "N transitions"

**Panel Contents:**
- **REUSE existing D3.js visualization in renderPanel()**
- Add getStatus() - current FSM state, transition count
- Add getControls() - reset, export visualization
- Keep existing D3 force graph

**Implementation Notes:**
- Complex conversion - has D3.js
- Ensure D3 renders correctly in widget panel
- May need to resize SVG on expand/collapse
- Coordinate with SentinelFSM widget

---

### 4.9 VerificationManager
**File:** `/upgrades/verification-manager.js`
**Status Display:**
- State: active if verification running
- Primary: "N tests run"
- Secondary: "N% pass rate"

**Panel Contents:**
- Active verifications (running in worker)
- Verification history (pass/fail)
- Test execution timeline
- Lint results
- Type check results
- Run verification button
- Kill verification button (if running)

**Implementation Notes:**
- Track worker executions
- Show test results
- Monitor worker timeouts
- Display verification queue

---

## Implementation Strategy

### Phase 1: Cluster 1 (2-3 hours)
Start here to get comfortable with the widget protocol. All modules are simple with minimal state.

**Order:**
1. ToastNotifications (easiest - already has toast state)
2. DiffUtils (simple counters)
3. DogsParser (parser tracking)
4. CatsParser (similar to DogsParser)
5. RateLimiter (token bucket visualization)
6. AuditLogger (event stream)

### Phase 2: Cluster 2 ✅ COMPLETE (~2 hours)
Infrastructure modules - important but straightforward.

**Completed Order:**
1. ❌ Config (skipped - not a module)
2. ✅ StateHelpersPure (minimal widget)
3. ✅ ToolRunnerPureHelpers (minimal widget)
4. ✅ Utils (utility tracking with logger/error stats)
5. ✅ Storage (I/O monitoring with operation history)
6. ✅ DIContainer (dependency graph with load order)

### Phase 3: Cluster 3 (4-6 hours)
Communication and advanced features - more complex state.

**Order:**
1. HITLControlPanel (conversion - already has UI)
2. HITLController (HITL mode tracking)
3. AdvancedLogPanel (log viewer)
4. MultiProviderAPI (provider switching)
5. WebLLMAdapter (model loading)
6. WebRTCComms (peer connections)

### Phase 4: Cluster 4 (8-12 hours)
Agent intelligence and complex UI conversions - save for last.

**Order:**
1. VFSExplorer (easiest conversion)
2. MetricsDashboard (Chart.js conversion)
3. ActionLogger (timeline visualization)
4. SentinelTools (tool catalog)
5. VerificationManager (worker tracking)
6. AgentVisualizer (D3.js conversion - tricky)
7. SentinelFSM (state machine diagram)
8. ContextCurator (context selection)
9. ReflectionEngine (meta-cognition - hardest)

---

## Testing Checklist

After implementing each cluster, verify:

✅ **Status Display**
- [ ] getStatus() returns correct state
- [ ] Primary and secondary metrics are meaningful
- [ ] lastActivity timestamp updates

✅ **Controls**
- [ ] getControls() returns appropriate buttons
- [ ] Button actions work correctly
- [ ] Toast notifications appear on button clicks

✅ **Panel Rendering**
- [ ] renderPanel() displays complete information
- [ ] HTML is properly escaped
- [ ] Event listeners are attached
- [ ] Panel updates when expanded

✅ **Real-Time Updates**
- [ ] onUpdate() callback fires correctly
- [ ] Widget updates reflect actual module state
- [ ] Unsubscribe function works (no memory leaks)

✅ **Integration**
- [ ] Module loads in DIContainer
- [ ] ModuleDashboard discovers widget automatically
- [ ] Widget appears in dashboard grid
- [ ] Expand/collapse works smoothly

---

## Success Metrics

**Completion Target:** All 75 modules with widgets

**Current Progress:** 10/75 (13.3%)

**Cluster Targets:**
- Cluster 1: 16/75 (21.3%) - Not started
- Cluster 2: 10/75 (13.3%) - ✅ COMPLETE
- Cluster 3: 16/75 (21.3%) - Not started
- Cluster 4: 25/75 (33.3%) - Not started

**Final Goal:** 100% module visibility with consistent, standardized widget interfaces

**Quality Bar:**
- Every widget shows meaningful status
- Every widget provides useful controls
- Every widget has informative detailed panel
- Every widget updates in real-time when relevant
- No module is invisible in the dashboard
