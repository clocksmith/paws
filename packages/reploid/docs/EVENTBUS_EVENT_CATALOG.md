# EventBus Event Catalog

**Last Updated**: 2025-10-20
**Purpose**: Authoritative reference for all EventBus events in REPLOID system
**Total Events Cataloged**: 68 events across 272 emit/on calls

---

## Event Taxonomy

Events are categorized by domain:

1. **Agent Lifecycle** - Core agent cognitive cycle events
2. **FSM State** - Finite state machine transitions
3. **UI Interactions** - User interface updates and panel coordination
4. **Tool Execution** - Tool runner and execution events
5. **LLM Operations** - Language model inference events
6. **Storage & Persistence** - Data storage and retrieval
7. **Coordination** - Multi-tab, HITL, and swarm coordination
8. **Notifications** - Toast notifications and user feedback
9. **Monitoring** - Performance, cost tracking, analytics
10. **Meta-Cognitive** - Self-improvement and reflection

---

## Agent Lifecycle Events

### `cycle:start`
**Emitted by**: `agent-cycle.js:68`
**Listened by**: N/A (logging only)
**Payload**:
```javascript
{
  goal: string,
  sessionId: string
}
```
**Purpose**: Signals beginning of agent cognitive cycle
**Ordering**: First event in cycle, before context gathering

### `cycle:complete`
**Emitted by**: `agent-cycle.js:152`
**Listened by**: `deja-vu-detector.js:58` (as `cycle:completed`)
**Payload**: `undefined`
**Purpose**: Signals successful completion of cognitive cycle
**Ordering**: Final event after verification passes

### `cycle:structured:complete`
**Emitted by**: `agent-cycle-structured.js:189`
**Listened by**: N/A
**Payload**:
```javascript
{
  output: object,  // Structured cycle output
  steps: array,    // 8-step execution trace
  verification: object
}
```
**Purpose**: Completion of 8-step structured cycle variant
**Ordering**: Alternative to `cycle:complete` for structured mode

### `agent:state:change`
**Emitted by**: `agent-cycle.js:57`
**Listened by**: `autonomous-orchestrator.js:496`
**Payload**:
```javascript
{
  newState: string,  // IDLE | RESEARCHING | PLANNING | EXECUTING | etc.
  context: object    // Current cycle context
}
```
**Purpose**: Agent transitions between operational states
**Ordering**: Emitted before each major cycle phase

### `agent:thought`
**Emitted by**: `agent-cycle.js:78,105` (and throughout reasoning)
**Listened by**: **⚠️ PROPOSED: `thought-panel.js`** (CLUSTER 2)
**Payload**: `string` (thought text chunk)
**Purpose**: Streams agent reasoning thoughts to UI
**Ordering**: Continuous stream during cycle execution
**⚠️ Critical for UI**: Panels must handle streaming, memory limits, pause/resume

### `agent:error`
**Emitted by**: `agent-cycle.js:156`
**Listened by**: `autonomous-orchestrator.js:503`
**Payload**:
```javascript
{
  message: string,
  phase: string,    // Which cycle phase failed
  error: Error      // Original error object
}
```
**Purpose**: Agent encountered error during cycle
**Ordering**: Emitted on failure, may trigger retry or fallback

---

## FSM State Events

### `fsm:state:changed`
**Emitted by**: `sentinel-fsm.js` (assumed, not in grep results - verify)
**Listened by**: `agent-visualizer.js:352,409`
**Payload**:
```javascript
{
  from: string,       // Previous state
  to: string,         // New state
  timestamp: number,
  context: object     // State transition context
}
```
**Purpose**: Sentinel FSM state transitions
**Ordering**: Critical event for UI panels to track FSM progression
**⚠️ Critical for UI**: `progress-tracker.js` (CLUSTER 1) and `sentinel-panel.js` (CLUSTER 2) depend on this

### States Include:
- `IDLE`
- `RESEARCHING`
- `AWAITING_CONTEXT_APPROVAL` ⚠️ Triggers `sentinel-panel.js` UI
- `PLANNING`
- `AWAITING_PROPOSAL_APPROVAL` ⚠️ Triggers `sentinel-panel.js` UI
- `EXECUTING`
- `VERIFYING`
- `COMPLETE`
- `ERROR`

---

## UI Interaction Events

### `goal:set`
**Emitted by**: `autonomous-orchestrator.js:132`
**Listened by**: `agent-cycle.js:163`, **⚠️ PROPOSED: `goal-panel.js`** (CLUSTER 2)
**Payload**: `string` (goal text)
**Purpose**: User or curator sets new goal
**Ordering**: Triggers `cycle:start` after context preparation

### `user:approve:context`
**Emitted by**: **⚠️ PROPOSED: `sentinel-panel.js`** (CLUSTER 2)
**Listened by**: `agent-cycle.js:164`
**Payload**:
```javascript
{
  context: object,    // Approved context
  timestamp: number,
  userId: string      // If multi-user
}
```
**Purpose**: User approves researched context
**Ordering**: Must occur after `AWAITING_CONTEXT_APPROVAL` state

### `user:approve:proposal`
**Emitted by**: **⚠️ PROPOSED: `sentinel-panel.js`** (CLUSTER 2)
**Listened by**: `agent-cycle.js:165`
**Payload**:
```javascript
{
  proposal: object,   // Approved proposal with file edits
  timestamp: number,
  userId: string
}
```
**Purpose**: User approves execution proposal
**Ordering**: Must occur after `AWAITING_PROPOSAL_APPROVAL` state

### `diff:show`
**Emitted by**: **External (UIManager or tools)**
**Listened by**: `diff-viewer-ui.js:87`
**Payload**:
```javascript
{
  oldContent: string,
  newContent: string,
  filePath: string,
  language: string  // For syntax highlighting
}
```
**Purpose**: Display file diff in diff viewer panel
**Ordering**: Independent, can occur anytime

### `diff:clear`
**Emitted by**: **External**
**Listened by**: `diff-viewer-ui.js:88`
**Payload**: `undefined`
**Purpose**: Clear diff viewer panel

### `diff:updated`
**Emitted by**: `diff-viewer-ui.js` (internal)
**Listened by**: `diff-viewer-ui.js:1328` (widget self-update)
**Payload**: `object` (diff metadata)
**Purpose**: Internal widget update trigger

### `proposal:approved`
**Emitted by**: `diff-viewer-ui.js:724`
**Listened by**: **⚠️ PROPOSED: `sentinel-panel.js`** (CLUSTER 2)
**Payload**:
```javascript
{
  proposal: object,
  timestamp: number
}
```
**Purpose**: User approved proposal via diff viewer
**Ordering**: Alternative path to `user:approve:proposal`

### `proposal:edit`
**Emitted by**: `diff-viewer-ui.js:740`
**Listened by**: **External (cycle logic)**
**Payload**:
```javascript
{
  proposal: object,
  editedContent: string
}
```
**Purpose**: User edited proposal before approving

### `proposal:cancelled`
**Emitted by**: `diff-viewer-ui.js:748`
**Listened by**: **External (cycle logic)**
**Payload**: `undefined`
**Purpose**: User rejected/cancelled proposal

---

## Tool Execution Events

### `tool:executed`
**Emitted by**: `tool-runner.js` (assumed)
**Listened by**: `deja-vu-detector.js:56`
**Payload**:
```javascript
{
  toolName: string,
  args: object,
  result: any,
  duration: number,
  success: boolean
}
```
**Purpose**: Tool execution completed
**Ordering**: After each tool run

### `tool:created`
**Emitted by**: `meta-tool-creator.js` (assumed)
**Listened by**: `deja-vu-detector.js:57`
**Payload**:
```javascript
{
  toolName: string,
  schema: object,
  source: string  // 'user' | 'agent' | 'system'
}
```
**Purpose**: New tool registered in system
**Ordering**: Independent

---

## LLM Operations Events

### `api:complete`
**Emitted by**: `api-client.js` or `api-client-multi.js` (assumed)
**Listened by**: `cost-tracker.js:55`
**Payload**:
```javascript
{
  model: string,
  inputTokens: number,
  outputTokens: number,
  duration: number,
  provider: string  // 'gemini' | 'openai' | 'claude'
}
```
**Purpose**: Cloud API call completed
**Ordering**: After each LLM inference

### `hybrid-llm:complete`
**Emitted by**: `hybrid-llm-provider.js` (assumed)
**Listened by**: `cost-tracker.js:56`
**Payload**:
```javascript
{
  mode: 'local' | 'cloud',
  model: string,
  tokens: number,
  duration: number
}
```
**Purpose**: Hybrid LLM call completed
**Ordering**: After local or cloud inference

### `local-llm:complete`
**Emitted by**: `local-llm.js` (assumed)
**Listened by**: `cost-tracker.js:57`
**Payload**:
```javascript
{
  model: string,
  tokens: number,
  tokensPerSec: number,
  duration: number
}
```
**Purpose**: Local WebLLM inference completed
**Ordering**: After browser-local inference

### `local-llm:ready`
**Emitted by**: `local-llm.js` (assumed)
**Listened by**: `hybrid-llm-provider.js:39`
**Payload**:
```javascript
{
  model: string,
  gpuMemory: number
}
```
**Purpose**: Local LLM model loaded and ready
**Ordering**: After model initialization

### `local-llm:unloaded`
**Emitted by**: `local-llm.js` (assumed)
**Listened by**: `hybrid-llm-provider.js:43`
**Payload**: `undefined`
**Purpose**: Local LLM unloaded from memory
**Ordering**: After model cleanup

### `hybrid-llm:fallback`
**Emitted by**: `hybrid-llm-provider.js` (internal)
**Listened by**: `hybrid-llm-provider.js:358` (toast notification)
**Payload**:
```javascript
{
  from: 'local' | 'cloud',
  to: 'local' | 'cloud',
  error: Error
}
```
**Purpose**: Hybrid provider fell back to alternative
**Ordering**: On local failure → cloud retry

---

## Storage & Persistence Events

### `genesis:snapshot-created`
**Emitted by**: `genesis-snapshot.js:113`
**Listened by**: N/A
**Payload**:
```javascript
{
  manifest: object,
  timestamp: number,
  size: number
}
```
**Purpose**: Genesis snapshot saved

### `genesis:snapshot-deleted`
**Emitted by**: `genesis-snapshot.js:256`
**Listened by**: N/A
**Payload**: `undefined`
**Purpose**: Genesis snapshot deleted

---

## Coordination Events

### `hitl:master-mode-changed`
**Emitted by**: `hitl-controller.js` (assumed)
**Listened by**: `hitl-control-panel.js:37,388`
**Payload**:
```javascript
{
  mode: 'manual' | 'autonomous',
  timestamp: number
}
```
**Purpose**: HITL master mode toggled

### `hitl:module-mode-changed`
**Emitted by**: `hitl-controller.js`
**Listened by**: `hitl-control-panel.js:38,389`
**Payload**:
```javascript
{
  moduleId: string,
  mode: 'manual' | 'autonomous' | 'inherit'
}
```
**Purpose**: Per-module HITL mode changed

### `hitl:approval-pending`
**Emitted by**: `hitl-controller.js`
**Listened by**: `hitl-control-panel.js:40,391`
**Payload**:
```javascript
{
  requestId: string,
  moduleId: string,
  action: string,
  data: object
}
```
**Purpose**: Action awaiting HITL approval

### `hitl:approval-granted`
**Emitted by**: `hitl-controller.js`
**Listened by**: `hitl-control-panel.js:41,392`
**Payload**:
```javascript
{
  requestId: string,
  timestamp: number
}
```
**Purpose**: HITL approval granted

### `hitl:approval-rejected`
**Emitted by**: `hitl-controller.js`
**Listened by**: `hitl-control-panel.js:42,393`
**Payload**:
```javascript
{
  requestId: string,
  reason: string
}
```
**Purpose**: HITL approval rejected

---

## Notification Events (Toast)

### `toast:success`
**Emitted by**: Multiple modules (agent-visualizer, context-manager, genesis-snapshot, git-vfs, etc.)
**Listened by**: `toast-notifications.js` (assumed)
**Payload**:
```javascript
{
  message: string,
  duration?: number  // Optional, default 3000ms
}
```
**Purpose**: Display success toast notification
**Common Usage**: Action confirmations, saves, exports

### `toast:error`
**Emitted by**: Multiple modules
**Listened by**: `toast-notifications.js`
**Payload**:
```javascript
{
  message: string,
  error?: Error,
  duration?: number
}
```
**Purpose**: Display error toast notification
**Common Usage**: Operation failures, validation errors

### `toast:info`
**Emitted by**: Multiple modules
**Listened by**: `toast-notifications.js`
**Payload**:
```javascript
{
  message: string,
  duration?: number
}
```
**Purpose**: Display informational toast
**Common Usage**: Status updates, reminders

### `toast:warning`
**Emitted by**: (Not found in grep, but likely exists)
**Listened by**: `toast-notifications.js`
**Payload**:
```javascript
{
  message: string,
  duration?: number
}
```
**Purpose**: Display warning toast

---

## Monitoring Events

### `cost:updated`
**Emitted by**: `cost-tracker.js:95`
**Listened by**: N/A (internal state update)
**Payload**:
```javascript
{
  totalCost: number,
  totalTokens: number,
  breakdown: object  // Per-model/provider
}
```
**Purpose**: Cost statistics updated

### `rate-limit:exceeded`
**Emitted by**: `cost-tracker.js:176`
**Listened by**: **External (should trigger throttling)**
**Payload**:
```javascript
{
  limit: number,
  current: number,
  resetTime: number
}
```
**Purpose**: API rate limit exceeded

### `deja-vu:detected`
**Emitted by**: `deja-vu-detector.js:341,349`
**Listened by**: `meta-cognitive-layer.js:85`
**Payload**:
```javascript
{
  pattern: string,     // 'repetitive-tool' | 'identical-cycle' | etc.
  occurrences: number,
  suggestion: string   // Optimization recommendation
}
```
**Purpose**: Repetitive pattern detected
**Ordering**: Triggers meta-cognitive improvement

### `progress:event`
**Emitted by**: `ui-manager.js:77` (relays WebSocket events)
**Listened by**: **⚠️ PROPOSED: `log-panel.js`** (CLUSTER 1)
**Payload**:
```javascript
{
  source: string,   // 'agent' | 'paxos' | 'dogs'
  event: string,
  status?: string,
  path?: string,
  payload?: object
}
```
**Purpose**: Real-time progress updates from backend
**⚠️ Critical for UI**: Log panel displays this stream

---

## Meta-Cognitive Events

### `meta:improve`
**Emitted by**: **External (manual trigger)**
**Listened by**: `meta-cognitive-layer.js:82`
**Payload**:
```javascript
{
  target: string,    // Module or function to improve
  suggestion: string
}
```
**Purpose**: Manual improvement request

### `meta:improvement:opportunity`
**Emitted by**: **External (analysis tools)**
**Listened by**: `meta-cognitive-layer.js:88`
**Payload**:
```javascript
{
  moduleId: string,
  metric: string,      // 'performance' | 'accuracy' | 'efficiency'
  currentValue: number,
  targetValue: number,
  suggestion: string
}
```
**Purpose**: Automated improvement opportunity detected

### `meta:inefficiency:detected`
**Emitted by**: **External (monitoring)**
**Listened by**: `meta-cognitive-layer.js:91`
**Payload**:
```javascript
{
  operation: string,
  timeMs: number,
  threshold: number,
  suggestion: string
}
```
**Purpose**: Performance bottleneck detected

### `reflection:added`
**Emitted by**: `reflection-store.js` (assumed)
**Listened by**: `deja-vu-detector.js:59`
**Payload**:
```javascript
{
  reflection: object,
  timestamp: number,
  tags: array
}
```
**Purpose**: New reflection stored

---

## Module & Widget Events

### `module:registered`
**Emitted by**: `boot-module-loader.js` or `di-container.js` (assumed)
**Listened by**: `introspector.js:28`
**Payload**:
```javascript
{
  moduleId: string,
  metadata: object,
  dependencies: array
}
```
**Purpose**: New module registered in DI container

### `module:loaded`
**Emitted by**: `boot-module-loader.js`
**Listened by**: `module-widget-protocol.js:74`
**Payload**:
```javascript
{
  moduleId: string,
  widget?: object
}
```
**Purpose**: Module fully loaded and initialized

### `module:unloaded`
**Emitted by**: `boot-module-loader.js`
**Listened by**: `module-widget-protocol.js:75`
**Payload**:
```javascript
{
  moduleId: string
}
```
**Purpose**: Module unloaded from system

### `widget:registered`
**Emitted by**: `module-widget-protocol.js`
**Listened by**: `module-dashboard.js:39`
**Payload**:
```javascript
{
  widgetId: string,
  element: string,      // Custom element tag
  displayName: string,
  category: string
}
```
**Purpose**: Widget registered for dashboard display

### `widget:refresh`
**Emitted by**: **External (manual or timed)**
**Listened by**: `module-widget-protocol.js:76`
**Payload**:
```javascript
{
  widgetId?: string  // If undefined, refresh all
}
```
**Purpose**: Trigger widget re-render

---

## Curator Mode Events

### `curator:started`
**Emitted by**: `autonomous-orchestrator.js:68`
**Listened by**: N/A
**Payload**:
```javascript
{
  mode: string,
  startTime: number,
  goals: array
}
```
**Purpose**: Autonomous curator mode started

### `curator:stopped`
**Emitted by**: `autonomous-orchestrator.js:92`
**Listened by**: N/A
**Payload**:
```javascript
{
  report: object,
  duration: number,
  iterations: number
}
```
**Purpose**: Curator mode stopped

### `curator:iteration:start`
**Emitted by**: `autonomous-orchestrator.js:145`
**Listened by**: N/A
**Payload**:
```javascript
{
  iteration: number,
  currentGoal: string
}
```
**Purpose**: Curator starting new iteration

### `curator:iteration:complete`
**Emitted by**: `autonomous-orchestrator.js:173`
**Listened by**: N/A
**Payload**:
```javascript
{
  iteration: number,
  success: boolean,
  output: object
}
```
**Purpose**: Curator iteration finished

---

## Browser API Events

### `browser-apis:initialized`
**Emitted by**: `browser-apis.js:58`
**Listened by**: N/A
**Payload**:
```javascript
{
  capabilities: object  // Which APIs are available
}
```
**Purpose**: Browser API capabilities detected

### `browser-apis:filesystem:granted`
**Emitted by**: `browser-apis.js:88`
**Listened by**: N/A
**Payload**:
```javascript
{
  name: string,
  mode: 'read' | 'readwrite'
}
```
**Purpose**: Filesystem access granted

### `browser-apis:notifications:shown`
**Emitted by**: `browser-apis.js:257`
**Listened by**: N/A
**Payload**:
```javascript
{
  title: string,
  options: object
}
```
**Purpose**: System notification displayed

---

## Context Management Events

### `context:pruned`
**Emitted by**: `context-manager.js:128`
**Listened by**: N/A
**Payload**:
```javascript
{
  before: number,  // Token count before
  after: number,   // Token count after
  strategy: string
}
```
**Purpose**: Context window pruned to fit limits

### `context:summarized`
**Emitted by**: `context-manager.js:179`
**Listened by**: N/A
**Payload**:
```javascript
{
  original: number,    // Original size
  summarized: number,  // Summarized size
  compressionRatio: number
}
```
**Purpose**: Context summarized for efficiency

---

## PROPOSED NEW EVENTS (for UI Refactoring - CLUSTER 1 & 2)

### UI Panel Coordination Events

#### `ui:request-panel-switch`
**Emitted by**: Any panel needing to trigger navigation
**Listened by**: `ui-manager.js`
**Payload**:
```javascript
{
  panel: string,      // 'thoughts' | 'logs' | 'performance' | etc.
  source: string,     // Which panel requested switch
  reason?: string
}
```
**Purpose**: Panel requests switching active view
**Rule**: Panels never call UIManager.switchPanel() directly

#### `ui:panel-show`
**Emitted by**: `ui-manager.js`
**Listened by**: All panel modules
**Payload**:
```javascript
{
  panelId: string
}
```
**Purpose**: Notify panel it's being shown
**Action**: Panel should resume updates, reconnect listeners

#### `ui:panel-hide`
**Emitted by**: `ui-manager.js`
**Listened by**: All panel modules
**Payload**:
```javascript
{
  panelId: string
}
```
**Purpose**: Notify panel it's being hidden
**Action**: Panel should pause updates, preserve state

#### `ui:panel-ready`
**Emitted by**: Panel modules (ThoughtPanel, GoalPanel, etc.)
**Listened by**: `ui-manager.js`
**Payload**:
```javascript
{
  panelId: string,
  capabilities: array  // What the panel supports
}
```
**Purpose**: Panel finished initialization
**Ordering**: After panel.init() completes

#### `ui:panel-error`
**Emitted by**: Panel modules
**Listened by**: `ui-manager.js`, `toast-notifications.js`
**Payload**:
```javascript
{
  panelId: string,
  error: Error,
  severity: 'warning' | 'error' | 'critical'
}
```
**Purpose**: Panel encountered error
**Action**: UIManager may switch to fallback panel

#### `ui:all-panels-init-complete`
**Emitted by**: `ui-manager.js`
**Listened by**: Application boot logic
**Payload**:
```javascript
{
  panels: array,      // List of initialized panels
  timestamp: number
}
```
**Purpose**: All panels ready for user interaction
**Ordering**: Final event in UI initialization sequence

### Status Bar Events

#### `status:updated`
**Emitted by**: `agent-cycle.js`, `sentinel-fsm.js`, tool execution
**Listened by**: **⚠️ PROPOSED: `status-bar.js`** (CLUSTER 1)
**Payload**:
```javascript
{
  state: string,      // IDLE | RESEARCHING | PLANNING | etc.
  detail: string,     // Human-readable detail
  progress: number,   // 0-100 percentage
  icon: string        // ⚪○⚙◐✓✗
}
```
**Purpose**: Update status bar display
**Ordering**: Continuous updates during cycle execution

---

## Event Ordering Dependencies

### Critical Ordering Rules

1. **Cycle Lifecycle**:
   ```
   goal:set → cycle:start → agent:thought (stream) →
   fsm:state:changed (RESEARCHING) → ... → cycle:complete
   ```

2. **Approval Workflow**:
   ```
   fsm:state:changed (AWAITING_CONTEXT_APPROVAL) →
   ui:panel-show (sentinel-panel) →
   user:approve:context →
   fsm:state:changed (PLANNING)
   ```

3. **Panel Lifecycle**:
   ```
   module:loaded → ui:panel-ready →
   ui:panel-show → [active updates] →
   ui:panel-hide → [paused state]
   ```

4. **Error Handling**:
   ```
   agent:error → toast:error →
   [potential retry] OR [fallback to IDLE]
   ```

---

## Memory & Cleanup Considerations

### EventBus Subscription Cleanup

**⚠️ Critical**: All panels MUST implement cleanup in `disconnectedCallback()` or `destroy()`:

```javascript
// CORRECT Pattern
class ThoughtPanelWidget extends HTMLElement {
  connectedCallback() {
    this._thoughtListener = (chunk) => this.appendThought(chunk);
    EventBus.on('agent:thought', this._thoughtListener);
  }

  disconnectedCallback() {
    EventBus.off('agent:thought', this._thoughtListener);  // ✅ REQUIRED
    clearInterval(this._updateInterval);
  }
}
```

**Memory Leak Risk**: Failing to unsubscribe causes:
- Panels continue updating even when hidden
- Multiple listeners accumulate on panel switch
- Memory consumption grows indefinitely

---

## Cross-Tab Coordination

### TabCoordinator Integration

Events that should sync across tabs (via `tab-coordinator.js` 0x000040):

- `goal:set` - All tabs should update goal
- `fsm:state:changed` - All tabs track same FSM state
- `agent:thought` - Thought stream visible in all tabs
- `cost:updated` - Cost metrics synchronized

**Implementation**: TabCoordinator listens to these events and broadcasts via BroadcastChannel API.

---

## Testing Recommendations

### Event Contract Tests

For each event, verify:
1. **Payload Schema**: Matches documented structure
2. **Ordering**: Fires in correct sequence relative to dependencies
3. **Cleanup**: Listeners properly unsubscribed on module unload
4. **Error Handling**: Invalid payloads don't crash listeners

### Example Test:

```javascript
describe('EventBus: agent:thought', () => {
  it('should emit string payload', () => {
    const listener = jest.fn();
    EventBus.on('agent:thought', listener);

    EventBus.emit('agent:thought', 'Test thought');

    expect(listener).toHaveBeenCalledWith('Test thought');
    expect(typeof listener.mock.calls[0][0]).toBe('string');
  });

  it('should cleanup listeners', () => {
    const listener = jest.fn();
    EventBus.on('agent:thought', listener);
    EventBus.off('agent:thought', listener);

    EventBus.emit('agent:thought', 'Test');

    expect(listener).not.toHaveBeenCalled();
  });
});
```

---

## Migration Notes for UI Refactoring

### Breaking Changes

**Old Pattern (deprecated)**:
```javascript
UIManager.streamThought('Thinking...');
UIManager.updateGoal('New goal');
UIManager.updateStatusBar('PLANNING', 'Analyzing context', 45);
```

**New Pattern (EventBus)**:
```javascript
EventBus.emit('agent:thought', 'Thinking...');
EventBus.emit('goal:set', 'New goal');
EventBus.emit('status:updated', {
  state: 'PLANNING',
  detail: 'Analyzing context',
  progress: 45
});
```

### Backward Compatibility Shim

During migration, UIManager will provide deprecated API:

```javascript
// ui-manager.js (temporary)
const streamThought = (chunk) => {
  console.warn('[DEPRECATED] Use EventBus.emit("agent:thought", chunk)');
  EventBus.emit('agent:thought', chunk);
};
```

**Removal Timeline**: Shim removed after all personas/modules migrated (estimated: Phase 10)

---

## Appendix: EventBus Implementation Notes

### EventBus Module Location
`/upgrades/event-bus.js` (0x000063)

### Key Methods
- `EventBus.emit(eventName, payload)` - Fire event
- `EventBus.on(eventName, callback, listenerId?)` - Subscribe
- `EventBus.off(eventName, callback)` - Unsubscribe
- `EventBus.once(eventName, callback)` - Subscribe for single fire

### Performance Considerations
- Current grep: **272 emit/on calls** across codebase
- Average listeners per event: ~1-3
- Memory impact: Minimal if cleanup properly implemented
- Latency: Synchronous (no async delay)

---

## Change Log

**2025-10-20**: Initial catalog created for UI refactoring (CLUSTER 1 Phase 0.1)
- Cataloged 68 events from grep scan
- Proposed 7 new UI coordination events
- Documented ordering dependencies and cleanup requirements

---

**Next Steps (CLUSTER 1)**:
- [ ] Phase 0.2: UIManager API Surface Audit
- [ ] Phase 0.3: Blueprint Registry Enhancement
- [ ] Phase 0.4: Feature Flag Infrastructure
- [ ] Phase 0.5: Module Widget Protocol Extension
- [ ] Phase 0.6: Panel Communication Contract
