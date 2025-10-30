# Reploid Lens Dashboard - Integration Complete

**Date:** 2025-10-30
**Status:** ✅ Ready for Testing

---

## Summary

The Reploid Lens Dashboard has been successfully integrated with the SentinelFSM workflow engine. All widgets now connect to the real Reploid modules and MCP servers instead of using mock data.

**Key Changes:**
- ✅ All 5 Lens widgets switched from mock to production mode
- ✅ Dashboard host loads real Reploid modules (minimal-rsi preset)
- ✅ Widgets subscribe to correct SentinelFSM events
- ✅ Real-time event-driven updates enabled
- ✅ MCP Bridge connects to 5 MCP servers

---

## Architecture

### Module Loading

The dashboard uses the **boot-module-loader** to load the `minimal-rsi` preset, which includes:
- Core workflow engine (SentinelFSM)
- Event bus for pub/sub
- MCP protocol and transport
- 5 MCP servers (VFS, Workflow, Agent Control, Tool Execution, Audit)
- State management and configuration
- All utility modules

### Event Flow

```
SentinelFSM (Workflow Engine)
    ↓ emits events
EventBus (Pub/Sub)
    ↓ delivers to subscribers
Lens Widgets (UI Components)
    ↓ update display
User (Sees real-time updates)
```

**Key Events:**
- `fsm:state:changed` - FSM state transitions (IDLE → CURATING → AWAITING_APPROVAL → etc.)
- `diff:show` - Show code diff for proposal
- `status:updated` - Status message updates

### Widget Integration

| Widget | MCP Tools Used | Events Subscribed |
|--------|---------------|-------------------|
| Agent Control | `get_agent_status`, `approve_context`, `reject_context`, `approve_proposal`, `reject_proposal` | `fsm:state:changed` |
| Diff Viewer | `get_proposal_diff`, `apply_changes` | `diff:show` |
| VFS Explorer | `get_vfs_tree`, `read_file` | `reploid:vfs:refresh` |
| Agent Visualizer | `get_fsm_state` | `fsm:state:changed` |
| Metrics Dashboard | `get_metrics` | (polls periodically) |

---

## How to Test

### Option 1: Standalone Workflow Test (Recommended First)

This tests the core SentinelFSM workflow without the dashboard UI.

**1. Start HTTP Server:**
```bash
cd /home/clocksmith/deco/paws/reploid
python3 -m http.server 8080
```

**2. Open Test Page:**
```
http://localhost:8080/test-workflow.html
```

**3. Test Workflow:**
1. Click **"Check Modules"** - Should show ~40+ modules loaded
2. Click **"Check MCP Servers"** - Should show 5 MCP servers
3. Enter a goal (default: "Add a hello world function to utils.js")
4. Click **"Start Workflow"**
5. Watch event log for state transitions
6. Click **"Approve Context"** when prompted
7. Click **"Approve Proposal"** when prompted
8. Verify workflow completes successfully

**Expected Flow:**
```
IDLE → CURATING_CONTEXT → AWAITING_CONTEXT_APPROVAL
  ↓ (user approves)
PLANNING_WITH_CONTEXT → GENERATING_PROPOSAL → AWAITING_PROPOSAL_APPROVAL
  ↓ (user approves)
APPLYING_CHANGESET → REFLECTING → IDLE (cycle complete)
```

---

### Option 2: Full Lens Dashboard Test

This tests all 5 widgets integrated in the dashboard.

**1. Start HTTP Server:**
```bash
cd /home/clocksmith/deco/paws/reploid
python3 -m http.server 8080
```

**2. Open Dashboard:**
```
http://localhost:8080/lens-dashboard.html
```

**3. Verify Loading:**
- Dashboard should show "Loading Reploid modules..."
- Toast notification: "Loaded X modules"
- Connection status: "CONNECTED"
- Mode: "PRODUCTION"
- Widget count: "3/3" (Agent Control, VFS Explorer, Diff Viewer)

**4. Test Workflow:**
The dashboard is purely visual - to trigger a workflow, you need to:
1. Open browser console
2. Use the SentinelFSM API:
   ```javascript
   // Start a workflow
   window.dashboard.modules.SentinelFSM.startCycle("Add logging to main.js");

   // Check status
   window.dashboard.modules.SentinelFSM.getStatus();

   // Approve context (when in AWAITING_CONTEXT_APPROVAL state)
   window.dashboard.modules.SentinelFSM.approveContext();

   // Approve proposal (when in AWAITING_PROPOSAL_APPROVAL state)
   window.dashboard.modules.SentinelFSM.approveProposal();
   ```

**5. Watch Widgets Update:**
- **Agent Control** (left panel): Shows current state and approval controls
- **VFS Explorer** (top right): Browse file system
- **Diff Viewer** (bottom right): Shows code changes when proposal is generated

---

## Files Modified

### Production Mode Changes

All widgets switched from `USE_MOCK_DATA = true` to `USE_MOCK_DATA = false`:

1. `/lens/widgets/reploid/agent-control-widget.ts`
2. `/lens/widgets/reploid/diff-viewer-widget.ts`
3. `/lens/widgets/reploid/vfs-explorer-widget.ts`
4. `/lens/widgets/reploid/agent-viz-widget.ts`
5. `/lens/widgets/reploid/metrics-widget.ts`

### Event Subscription Fixes

Fixed widgets to listen to correct SentinelFSM events:

1. **agent-viz-widget.ts**: Changed `reploid:state:changed` → `fsm:state:changed`
2. **diff-viewer-widget.ts**: Changed `reploid:diff:show` → `diff:show`
3. **agent-control-widget.ts**: Added `fsm:state:changed` subscription for real-time updates

### Dashboard Host Updates

**reploid/lens-dashboard-host.js**:
- Changed `USE_MOCK_DATA = false`
- Added `loadReploidModules()` method
- Loads `minimal-rsi` preset via boot-module-loader
- Uses real EventBus, MCPBridge, and StateManager

### New Test Files

**reploid/test-workflow.html**:
- Standalone workflow tester
- Interactive controls for workflow lifecycle
- Real-time event logging
- Approval buttons enabled/disabled based on state

---

## Known Limitations

### Current State

1. **No Auto-Start**: Dashboard doesn't have a "Start Workflow" button yet. Must use console API.
2. **Console-Only Control**: Need to use browser console to trigger workflows from dashboard.
3. **No Metrics/Visualizer**: Metrics and Agent Visualizer widgets not yet in dashboard layout.

### Future Enhancements

1. **Add Workflow Control Panel**: Add UI controls to start/stop workflows
2. **Add Goal Input**: Add text input for entering workflow goals
3. **Expand Dashboard Layout**: Add panels for Metrics and Agent Visualizer widgets
4. **Add History View**: Show history of completed workflow cycles
5. **Add Configuration UI**: Allow changing settings without editing code

---

## Troubleshooting

### Issue: "Failed to load Reploid modules"

**Symptoms:** Toast shows "Using mock dependencies (modules not loaded)"

**Causes:**
- Module paths incorrect
- boot-module-loader.js not found
- Syntax error in one of the modules

**Solutions:**
1. Check browser console for specific error
2. Verify module-manifest.json is correct
3. Check that all module files exist
4. Make sure running from correct directory

---

### Issue: "Widget shows no data"

**Symptoms:** Widgets render but show empty or "No data" state

**Causes:**
- MCP server not responding
- MCP bridge not initialized
- Workflow not started

**Solutions:**
1. Open browser console and check for errors
2. Verify modules loaded: `window.dashboard.modules.SentinelFSM`
3. Check MCP servers: `window.dashboard.modules.ReploidMCPRegistry.listServers()`
4. Start a workflow: `window.dashboard.modules.SentinelFSM.startCycle("test goal")`

---

### Issue: "Events not firing"

**Symptoms:** Widgets don't update when state changes

**Causes:**
- EventBus not connected
- Wrong event names
- Event subscriptions not registered

**Solutions:**
1. Check EventBus exists: `window.dashboard.eventBus`
2. Test event manually: `window.dashboard.eventBus.emit('fsm:state:changed', { newState: 'TEST' })`
3. Verify widgets subscribed: Check browser console for "[Widget] initialized" messages

---

## Next Steps

### Immediate (Required for Full Functionality)

1. **Add Workflow Controls to Dashboard**
   - Add "Start Workflow" button
   - Add goal input field
   - Add "Stop Workflow" button

2. **Expand Dashboard Layout**
   - Add Metrics Dashboard widget panel
   - Add Agent Visualizer widget panel
   - Make layout responsive

3. **Test with Real Workflow**
   - Run a real code change workflow
   - Verify context approval works
   - Verify proposal approval works
   - Verify changes are applied correctly

### Future (Nice to Have)

1. **Syntax Highlighting**: Add Prism.js to Diff Viewer
2. **State Persistence**: Save widget state to localStorage
3. **Keyboard Shortcuts**: Add keyboard shortcuts for approve/reject
4. **Notifications**: Browser notifications for approval requests
5. **Theme Customization**: Allow custom color schemes

---

## Testing Checklist

Use this checklist to verify the integration is working:

### Module Loading
- [ ] Dashboard loads without errors
- [ ] Toast shows "Loaded X modules"
- [ ] Connection status shows "CONNECTED"
- [ ] Mode shows "PRODUCTION"
- [ ] Widget count shows "3/3"

### Workflow Execution
- [ ] Can start workflow via console API
- [ ] FSM transitions through states correctly
- [ ] Event log shows state changes
- [ ] Approval buttons enable/disable correctly

### Widget Updates
- [ ] Agent Control shows current state
- [ ] Agent Control enables approve/reject buttons at correct times
- [ ] VFS Explorer shows file tree
- [ ] Diff Viewer shows code changes when proposal generated

### Event System
- [ ] `fsm:state:changed` events fire correctly
- [ ] `diff:show` events fire when proposal ready
- [ ] Widgets update in real-time
- [ ] No console errors for events

### MCP Integration
- [ ] MCP servers registered correctly
- [ ] MCP tools can be called
- [ ] Tool results returned correctly
- [ ] Error handling works for failed tool calls

---

## Conclusion

The Reploid Lens Dashboard is now fully integrated with the SentinelFSM workflow engine. All widgets are connected to real modules and MCP servers. The system is ready for testing and use.

**Status: ✅ Integration Complete - Ready for Testing**

To start testing, use **test-workflow.html** first to verify the core workflow, then move to **lens-dashboard.html** to test the full dashboard UI.

**Next:** Add workflow control UI to dashboard for easier testing without console API.

---

**Integration completed by:** Agent-3-Lens-Widgets
**Date:** 2025-10-30
