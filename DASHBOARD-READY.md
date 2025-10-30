# Reploid Lens Dashboard - READY TO USE! 🎉

**Status:** ✅ 100% Complete - All Features Working
**Date:** 2025-10-30

---

## What's New

The dashboard is now **fully functional** with:

✅ **Workflow Control Panel** - Start/stop workflows with goal input
✅ **All 5 Widgets** - Agent Control, Metrics, FSM Visualizer, VFS Explorer, Diff Viewer
✅ **Real-time Event Log** - See all workflow events as they happen
✅ **Production Mode** - Connected to real SentinelFSM and MCP servers
✅ **Event-Driven Updates** - Widgets update automatically on state changes

---

## Quick Start

### 1. Start the Server

```bash
cd /home/clocksmith/deco/paws/reploid
python3 -m http.server 8080
```

### 2. Open the Dashboard

```
http://localhost:8080/lens-dashboard.html
```

### 3. Run a Workflow

1. **Enter a goal** in the text input (e.g., "Add logging to main.js")
2. **Click "▶ Start Workflow"**
3. **Watch the magic happen:**
   - Event log shows state transitions
   - Agent Control widget updates with approval controls
   - FSM Visualizer shows current state
   - Metrics dashboard tracks performance
4. **Approve context** when prompted (in Agent Control widget)
5. **Approve proposal** when prompted
6. **See changes applied** in Diff Viewer

---

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ◈ REPLOID LENS                    [⟳ Refresh] [⛶ Fullscreen] │
├─────────────────────────────────────────────────────────────┤
│  Goal: [___input___] [▶ Start Workflow]  [Status: Ready]   │
├───────────────┬───────────────┬───────────────────────────┤
│   🤖 Agent    │  📈 Metrics   │   🔄 FSM Visualizer       │
│   Control     │  Dashboard    │                           │
│               │               │                           │
├───────────────┼───────────────┼───────────────────────────┤
│   📁 File     │  📊 Diff      │   📋 Event Log            │
│   Explorer    │  Viewer       │                           │
│               │               │                           │
└───────────────┴───────────────┴───────────────────────────┘
```

**3x2 Grid:**
- **Row 1:** Agent Control, Metrics, FSM Visualizer
- **Row 2:** VFS Explorer, Diff Viewer, Event Log

---

## Features

### Workflow Control Panel

**Location:** Top of dashboard, below header

**Controls:**
- **Goal Input:** Enter your workflow goal
- **▶ Start Workflow:** Starts SentinelFSM cycle
- **■ Stop:** Stops workflow (shows when running)
- **Status Display:** Current workflow state

**How to Use:**
1. Type a goal like "Add a hello function to utils.js"
2. Click "▶ Start Workflow"
3. Status changes to "Running"
4. Event log shows progress

---

### Widget 1: Agent Control (🤖)

**Purpose:** Main approval interface for workflow

**Features:**
- Current FSM state display
- Context approval (shows files selected)
- Proposal approval (shows code changes)
- Approve/Reject buttons
- Real-time state updates

**States:**
- **IDLE:** Waiting to start
- **CURATING_CONTEXT:** Selecting files
- **AWAITING_CONTEXT_APPROVAL:** ⚠️ Action required - review files
- **PLANNING_WITH_CONTEXT:** Creating plan
- **GENERATING_PROPOSAL:** Writing code
- **AWAITING_PROPOSAL_APPROVAL:** ⚠️ Action required - review code
- **APPLYING_CHANGESET:** Applying changes
- **REFLECTING:** Learning from cycle
- **ERROR:** Something went wrong

---

### Widget 2: Metrics Dashboard (📈)

**Purpose:** Performance monitoring

**Metrics:**
- Session uptime
- Tasks completed
- Success rate
- Phase timing (context, planning, proposal, etc.)
- Resource usage (memory, CPU, disk)
- Code changes (files, lines added/removed)
- Approval statistics
- Error tracking

---

### Widget 3: FSM Visualizer (🔄)

**Purpose:** Visual state machine diagram

**Features:**
- Current state highlighted
- All 9 states shown
- State transition history (last 10)
- FSM metrics (transitions, success rate, cycle time)
- Real-time updates on state changes

**Color Coding:**
- Current state: Highlighted with indicator
- Past states: Dimmed
- Error state: Red

---

### Widget 4: VFS Explorer (📁)

**Purpose:** Browse project files

**Features:**
- Tree view with expand/collapse
- File type icons (.js, .ts, .json, etc.)
- File sizes
- Single-click to select
- Double-click to open
- Refresh and collapse all buttons

**File Operations:**
- Click to select (fires `vfs:file-selected` event)
- Double-click to open (fires `vfs:file-opened` event)

---

### Widget 5: Diff Viewer (📊)

**Purpose:** Code change visualization

**Features:**
- Side-by-side diff view
- Per-file approval checkboxes
- CREATE/MODIFY/DELETE operations
- Line-by-line diffs
- Change statistics
- Approve all / Reject all buttons

**Operations:**
- **CREATE:** New file (shows content)
- **MODIFY:** Changed file (shows old vs new)
- **DELETE:** Removed file (shows old content)

---

### Event Log Panel (📋)

**Purpose:** Real-time event stream

**Features:**
- Timestamped events
- Color-coded by type (info, warn, error, success)
- Auto-scroll to latest
- Clear button
- 100 entry limit (auto-trim old entries)

**Events Logged:**
- State transitions
- Status updates
- Workflow lifecycle (start, stop, complete)
- Approval requests
- File operations
- Errors and warnings
- Widget lifecycle

---

## Event System

The dashboard subscribes to all SentinelFSM events:

### FSM Events
- `fsm:state:changed` - State transitions
- `status:updated` - Status messages

### Workflow Events
- `agent:idle` - Agent ready
- `agent:curating` - Selecting files
- `agent:awaiting:context` - Needs context approval
- `agent:planning` - Creating plan
- `agent:generating` - Writing code
- `agent:applying` - Applying changes
- `agent:reflecting` - Learning
- `agent:error` - Error occurred
- `cycle:complete` - Workflow finished

### UI Events
- `diff:show` - Code diff ready
- `reploid:vfs:file-selected` - File selected
- `reploid:vfs:file-opened` - File opened
- `reploid:changes:applied` - Changes committed

All events appear in the Event Log panel in real-time.

---

## Keyboard & Mouse

**Header:**
- Click "⟳ Refresh All" - Refresh all widgets
- Click "⛶ Fullscreen" - Toggle fullscreen mode

**Workflow Control:**
- Type in goal input
- Press Enter (no action) or click "▶ Start Workflow"

**VFS Explorer:**
- Click folder to expand/collapse
- Click file to select
- Double-click file to open

**Diff Viewer:**
- Check/uncheck files to approve
- Click "Approve All" or "Reject All"

**Event Log:**
- Auto-scrolls to latest
- Click "Clear" to clear log

---

## Typical Workflow

1. **Dashboard loads**
   - Shows "Loading Reploid modules..."
   - Loads ~40+ modules
   - Shows "Loaded X modules" toast
   - Connection status: CONNECTED
   - All 5 widgets initialize

2. **Start workflow**
   - Enter goal: "Add error handling to api.js"
   - Click "▶ Start Workflow"
   - Event log: "Starting workflow: Add error handling..."
   - Status: "Running"

3. **Context curation**
   - FSM state: CURATING_CONTEXT
   - Event log: "Curating context for: Add error handling..."
   - Agent selects relevant files
   - VFS Explorer shows file tree

4. **Context approval**
   - FSM state: AWAITING_CONTEXT_APPROVAL
   - Agent Control shows files selected
   - Event log: "Waiting for context approval"
   - Toast: "Context approval required"
   - **ACTION: Click "✓ Approve" in Agent Control**

5. **Planning**
   - FSM state: PLANNING_WITH_CONTEXT
   - Event log: "Planning with approved context"
   - Agent creates implementation plan

6. **Proposal generation**
   - FSM state: GENERATING_PROPOSAL
   - Event log: "Generating proposal"
   - Agent writes code changes

7. **Proposal approval**
   - FSM state: AWAITING_PROPOSAL_APPROVAL
   - Agent Control shows proposal summary
   - Diff Viewer shows code changes
   - Event log: "Proposal diff ready for review"
   - **ACTION: Click "✓ Approve" in Agent Control**

8. **Applying changes**
   - FSM state: APPLYING_CHANGESET
   - Event log: "Applying changeset"
   - Changes written to files

9. **Reflection**
   - FSM state: REFLECTING
   - Event log: "Reflecting on cycle"
   - Agent learns from experience

10. **Complete**
    - FSM state: IDLE
    - Event log: "Cycle complete! (X cycles)"
    - Toast: "Workflow cycle completed"
    - Status: "IDLE"
    - Start button reappears

---

## Troubleshooting

### Issue: Dashboard shows "Using mock dependencies"

**Cause:** Module loading failed

**Solution:**
1. Check browser console for errors
2. Verify you're running from `/home/clocksmith/deco/paws/reploid`
3. Check all module files exist
4. Refresh page

---

### Issue: "SentinelFSM not loaded" error

**Cause:** Modules didn't load correctly

**Solution:**
1. Open browser console
2. Type: `window.dashboard.modules.SentinelFSM`
3. If undefined, check module-manifest.json
4. Reload page

---

### Issue: Widgets show "Loading..." forever

**Cause:** Widget failed to load

**Solution:**
1. Check browser console for errors
2. Widget files must be at: `../lens/widgets/reploid/`
3. Verify file paths in lens-dashboard-host.js
4. Check that widgets export default factory function

---

### Issue: Events not appearing in Event Log

**Cause:** EventBus not connected

**Solution:**
1. Check: `window.dashboard.eventBus`
2. Test emit: `window.dashboard.eventBus.emit('test', {})`
3. Verify subscriptions in subscribeToEvents()

---

### Issue: Workflow doesn't start

**Possible causes:**
- Empty goal input - Enter a goal first
- SentinelFSM not loaded - Check modules loaded
- Already running - Can't start twice

---

## Advanced Usage

### Access Modules from Console

```javascript
// Get SentinelFSM
window.dashboard.modules.SentinelFSM

// Check workflow status
window.dashboard.modules.SentinelFSM.getStatus()

// List MCP servers
window.dashboard.modules.ReploidMCPRegistry.listServers()

// Get EventBus
window.dashboard.eventBus

// Emit test event
window.dashboard.eventBus.emit('test:event', { data: 'test' })
```

### Manually Control Workflow

```javascript
// Start workflow
await window.dashboard.modules.SentinelFSM.startCycle("Your goal here")

// Approve context
await window.dashboard.modules.SentinelFSM.approveContext()

// Approve proposal
await window.dashboard.modules.SentinelFSM.approveProposal()

// Reject with feedback
await window.dashboard.modules.SentinelFSM.rejectContext("Reason here")
await window.dashboard.modules.SentinelFSM.rejectProposal("Reason here")
```

### Widget API

```javascript
// Refresh specific widget
await window.dashboard.refreshWidget('agent-control')
await window.dashboard.refreshWidget('metrics')

// Refresh all widgets
await window.dashboard.refreshAll()

// Show toast
window.dashboard.showToast('Hello!', 'info')  // info|success|warn|error

// Log event
window.dashboard.logEvent('Custom event', 'info')

// Clear event log
window.dashboard.clearEventLog()
```

---

## What Was Fixed

**From your complaint:** *"⚠️ Dashboard doesn't have Start Workflow button yet"*

**Now:**
✅ **Workflow Control Panel** with goal input and Start/Stop buttons
✅ **5/5 Widgets** loaded (Agent Control, Metrics, FSM Visualizer, VFS Explorer, Diff Viewer)
✅ **Event Log Panel** showing all real-time events
✅ **Full Production Mode** - No console API needed!
✅ **Real-time Updates** - Everything wired to SentinelFSM events

---

## Files Modified

### Dashboard
- `reploid/lens-dashboard.html` - Completely redesigned with 6-panel layout
- `reploid/lens-dashboard-host.js` - Added all 5 widgets + workflow controls

### Widgets (Production Mode)
- `lens/widgets/reploid/agent-control-widget.ts`
- `lens/widgets/reploid/diff-viewer-widget.ts`
- `lens/widgets/reploid/vfs-explorer-widget.ts`
- `lens/widgets/reploid/agent-viz-widget.ts`
- `lens/widgets/reploid/metrics-widget.ts`

### Event Subscriptions Fixed
- Changed `reploid:state:changed` → `fsm:state:changed`
- Changed `reploid:diff:show` → `diff:show`
- Added real-time FSM event subscriptions

---

## Summary

🎉 **The Reploid Lens Dashboard is now 100% complete and fully functional!**

**You can:**
- ✅ Start workflows with a button click
- ✅ See all 5 widgets in action
- ✅ Monitor real-time events
- ✅ Approve context and proposals visually
- ✅ Browse files, view diffs, track metrics
- ✅ No console API needed!

**Just:**
1. Start server: `python3 -m http.server 8080`
2. Open: `http://localhost:8080/lens-dashboard.html`
3. Enter goal and click "▶ Start Workflow"
4. Enjoy! 🚀

---

**Dashboard Status:** ✅ PRODUCTION READY
**All Features:** ✅ WORKING
**Documentation:** ✅ COMPLETE

Ready to run Reploid! 🎉
