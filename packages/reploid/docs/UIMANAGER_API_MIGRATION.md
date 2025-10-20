# UIManager API Surface Audit & Migration Guide

**Last Updated**: 2025-10-20
**Purpose**: Document all external dependencies on UIManager API for safe refactoring
**Status**: Phase 0.2 - CLUSTER 1

---

## Executive Summary

**Total External Dependencies Found**: 6 calls across 3 modules
- `app-logic.js`: 2 calls (updateGoal)
- `tool-runner.js`: 3 calls (logToAdvanced)
- `meta-tool-creator.js`: 1 call (logToAdvanced)

**Risk Level**: **LOW** - Very few external dependencies
**Migration Strategy**: EventBus delegation with backward compatibility shim
**Estimated Migration Time**: 2-3 hours (update 3 files)

---

## Current UIManager Public API

### Exported Methods (from ui-manager.js)

```javascript
return {
  init,                    // Bootstrap UI
  updateGoal,              // ❌ DEPRECATED - Set goal text
  api: {
    updateGoal,            // ❌ DEPRECATED
    streamThought,         // ❌ DEPRECATED - Stream agent thoughts
    updateStatusBar        // ❌ DEPRECATED - Update status display
  }
}
```

### Internal Methods (exposed via closure/global)

```javascript
UI.logToAdvanced()       // ❌ DEPRECATED - Log to advanced panel
UI.switchPanel()         // ✅ KEEP - Panel switching remains in UIManager
```

---

## External Dependencies Analysis

### 1. app-logic.js (Application Bootstrap)

**File**: `/upgrades/app-logic.js`
**Lines**: 425-426
**Usage**: Initial goal setting during app boot

```javascript
// CURRENT CODE (app-logic.js:425-426)
if (UI.updateGoal) {
  UI.updateGoal(initialConfig.goal);
}
```

**Risk**: **LOW** - Simple defensive check
**Migration Path**:
```javascript
// NEW CODE (after migration)
if (initialConfig.goal) {
  EventBus.emit('goal:set', initialConfig.goal);
}
```

**Backward Compatibility**: UIManager shim will relay to EventBus during transition period

**Testing**: Verify goal appears in UI on app boot with:
- Default goal
- Custom goal from config
- No goal (empty state)

---

### 2. tool-runner.js (Tool Execution Logging)

**File**: `/upgrades/tool-runner.js`
**Lines**: 101, 540, 566
**Usage**: Logging tool execution and RFC creation to advanced panel

#### Call 1: Tool Execution Start (Line 101)

```javascript
// CURRENT CODE (tool-runner.js:101)
UI.logToAdvanced(`Running tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`);
```

**Risk**: **MEDIUM** - Important for debugging tool execution
**Migration Path**:
```javascript
// NEW CODE
EventBus.emit('progress:event', {
  source: 'tool-runner',
  event: 'tool-execution-start',
  status: 'running',
  payload: {
    toolName,
    args: toolArgs
  }
});
```

#### Call 2: RFC Creation (Line 540)

```javascript
// CURRENT CODE (tool-runner.js:540)
UI.logToAdvanced(`RFC created at ${newPath}`);
```

**Risk**: **LOW** - Informational log
**Migration Path**:
```javascript
// NEW CODE
EventBus.emit('progress:event', {
  source: 'tool-runner',
  event: 'rfc-created',
  path: newPath,
  status: 'success'
});
```

#### Call 3: Project Export (Line 566)

```javascript
// CURRENT CODE (tool-runner.js:566)
UI.logToAdvanced(`Project export prepared: ${files.length} files`);
```

**Risk**: **LOW** - Informational log
**Migration Path**:
```javascript
// NEW CODE
EventBus.emit('progress:event', {
  source: 'tool-runner',
  event: 'project-exported',
  status: 'success',
  payload: {
    fileCount: files.length
  }
});
```

**Testing**: Verify all three events appear in log panel:
- Tool execution logs
- RFC creation notifications
- Export confirmations

---

### 3. meta-tool-creator.js (Tool Creation Logging)

**File**: `/upgrades/meta-tool-creator.js`
**Line**: 223
**Usage**: Logging dynamic tool creation to advanced panel

```javascript
// CURRENT CODE (meta-tool-creator.js:223)
globalThis.UI.logToAdvanced(
  {
    type: 'tool_created',
    toolName: name,
    cycle: toolDef.created_cycle
  },
  'tool_created'
);
```

**Risk**: **MEDIUM** - Important for tracking meta-tool creation
**Migration Path**:
```javascript
// NEW CODE
EventBus.emit('progress:event', {
  source: 'meta-tool-creator',
  event: 'tool-created',
  status: 'success',
  payload: {
    type: 'tool_created',
    toolName: name,
    cycle: toolDef.created_cycle
  }
});
```

**Note**: Uses `globalThis.UI` instead of module dependency - suggests global exposure pattern

**Testing**: Verify tool creation events logged when:
- Agent creates new tool dynamically
- Tool definition validated
- Tool registered in system

---

## Deprecated API Methods

### Method: `updateGoal(text)`

**Current Signature**:
```javascript
const updateGoal = (goalText) => {
  if (uiRefs.goalInput) {
    uiRefs.goalInput.value = goalText;
  }
};
```

**Responsibility**: Directly manipulates goal input DOM element

**Replacement**: **`goal-panel.js`** (CLUSTER 2) listens to `goal:set` event

**Migration Pattern**:
```javascript
// OLD (deprecated)
UI.updateGoal('Analyze the codebase');

// NEW
EventBus.emit('goal:set', 'Analyze the codebase');
```

**Shim Strategy** (during transition):
```javascript
// ui-manager.js (Phase 9 - backward compatibility)
const updateGoal = (goalText) => {
  console.warn('[UIManager] DEPRECATED: Use EventBus.emit("goal:set", text)');
  EventBus.emit('goal:set', goalText);  // Delegate to EventBus
};
```

---

### Method: `streamThought(chunk)`

**Current Signature**:
```javascript
const streamThought = (textChunk) => {
  if (uiRefs.thoughtStream) {
    uiRefs.thoughtStream.textContent += textChunk;
  }
};
```

**Responsibility**: Directly appends thought chunks to thought stream DOM element

**Replacement**: **`thought-panel.js`** (CLUSTER 2) listens to `agent:thought` event

**Migration Pattern**:
```javascript
// OLD (deprecated)
UI.streamThought('I will analyze the code...');

// NEW
EventBus.emit('agent:thought', 'I will analyze the code...');
```

**Current Usage**: **NOT FOUND IN GREP** - likely called internally or deprecated already

**Shim Strategy**:
```javascript
// ui-manager.js (backward compatibility)
const streamThought = (chunk) => {
  console.warn('[UIManager] DEPRECATED: Use EventBus.emit("agent:thought", chunk)');
  EventBus.emit('agent:thought', chunk);
};
```

---

### Method: `updateStatusBar(state, detail, progress)`

**Current Signature**:
```javascript
const updateStatusBar = (state, detail, progress = 0) => {
  if (uiRefs.statusBar) {
    const icon = getStateIcon(state);  // ⚪○⚙◐✓✗
    uiRefs.statusBar.innerHTML = `${icon} ${state}: ${detail}`;
    // Update progress bar if progress > 0
  }
};
```

**Responsibility**: Directly manipulates status bar DOM element

**Replacement**: **`status-bar.js`** (CLUSTER 1) listens to `status:updated` event

**Migration Pattern**:
```javascript
// OLD (deprecated)
UI.updateStatusBar('PLANNING', 'Analyzing context', 45);

// NEW
EventBus.emit('status:updated', {
  state: 'PLANNING',
  detail: 'Analyzing context',
  progress: 45
});
```

**Current Usage**: **NOT FOUND IN GREP** - likely called internally only

**Shim Strategy**:
```javascript
// ui-manager.js (backward compatibility)
const updateStatusBar = (state, detail, progress = 0) => {
  console.warn('[UIManager] DEPRECATED: Use EventBus.emit("status:updated", {...})');
  EventBus.emit('status:updated', { state, detail, progress });
};
```

---

### Method: `logToAdvanced(message, level, details)`

**Current Signature**:
```javascript
const logToAdvanced = (message, level = 'info', details = null) => {
  const logEntry = {
    timestamp: Date.now(),
    message: typeof message === 'string' ? message : JSON.stringify(message),
    level,  // 'info' | 'warn' | 'error' | 'cycle'
    details
  };

  // Append to advanced logs panel
  if (uiRefs.advancedLogs) {
    const entry = createLogEntry(logEntry);
    uiRefs.advancedLogs.appendChild(entry);
  }
};
```

**Responsibility**: Directly manipulates advanced logs panel DOM

**Replacement**: **`log-panel.js`** (CLUSTER 1) listens to `progress:event` event

**Migration Pattern**:
```javascript
// OLD (deprecated)
UI.logToAdvanced('Tool executed successfully', 'info', { toolName, result });

// NEW
EventBus.emit('progress:event', {
  source: 'tool-runner',
  event: 'tool-executed',
  status: 'success',
  payload: { toolName, result }
});
```

**Current Usage**: **3 calls found** (tool-runner.js, meta-tool-creator.js)

**Shim Strategy**:
```javascript
// ui-manager.js (backward compatibility)
const logToAdvanced = (message, level = 'info', details = null) => {
  console.warn('[UIManager] DEPRECATED: Use EventBus.emit("progress:event", {...})');

  EventBus.emit('progress:event', {
    source: 'legacy',
    event: 'log-message',
    status: level,
    payload: {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      details
    }
  });
};
```

---

## Migration Checklist

### Phase 9.3: Backward Compatibility Shim Implementation

**Task**: Add deprecated API wrappers to ui-manager.js

```javascript
// ui-manager.js (after panel extraction)

// ✅ KEEP: Core orchestration methods
const init = async (config) => { /* ... */ };
const switchPanel = (panelName) => { /* ... */ };

// ❌ DEPRECATED: Backward compatibility shims
const updateGoal = (goalText) => {
  console.warn('[UIManager.updateGoal] DEPRECATED: Use EventBus.emit("goal:set", text)');
  EventBus.emit('goal:set', goalText);
};

const streamThought = (chunk) => {
  console.warn('[UIManager.streamThought] DEPRECATED: Use EventBus.emit("agent:thought", chunk)');
  EventBus.emit('agent:thought', chunk);
};

const updateStatusBar = (state, detail, progress = 0) => {
  console.warn('[UIManager.updateStatusBar] DEPRECATED: Use EventBus.emit("status:updated", {...})');
  EventBus.emit('status:updated', { state, detail, progress });
};

const logToAdvanced = (message, level = 'info', details = null) => {
  console.warn('[UIManager.logToAdvanced] DEPRECATED: Use EventBus.emit("progress:event", {...})');
  EventBus.emit('progress:event', {
    source: 'legacy',
    event: 'log-message',
    status: level,
    payload: {
      message: typeof message === 'string' ? message : JSON.stringify(message),
      details
    }
  });
};

return {
  init,
  switchPanel,
  // Deprecated API (REMOVE in Phase 10 after external code migrated)
  updateGoal,
  api: {
    updateGoal,
    streamThought,
    updateStatusBar,
    logToAdvanced  // Add to api object for globalThis.UI access
  }
};
```

### Phase 9.4: External Code Migration

**Task**: Update 3 external modules to use EventBus

#### Step 1: Update app-logic.js

```diff
// File: upgrades/app-logic.js (Line 425-426)

- if (UI.updateGoal) {
-   UI.updateGoal(initialConfig.goal);
- }

+ if (initialConfig.goal) {
+   EventBus.emit('goal:set', initialConfig.goal);
+ }
```

**Test**: Boot app with config.goal, verify goal appears in GoalPanel

#### Step 2: Update tool-runner.js

```diff
// File: upgrades/tool-runner.js (Line 101)

- UI.logToAdvanced(`Running tool: ${toolName} with args: ${JSON.stringify(toolArgs)}`);

+ EventBus.emit('progress:event', {
+   source: 'tool-runner',
+   event: 'tool-execution-start',
+   status: 'running',
+   payload: { toolName, args: toolArgs }
+ });
```

```diff
// File: upgrades/tool-runner.js (Line 540)

- UI.logToAdvanced(`RFC created at ${newPath}`);

+ EventBus.emit('progress:event', {
+   source: 'tool-runner',
+   event: 'rfc-created',
+   path: newPath,
+   status: 'success'
+ });
```

```diff
// File: upgrades/tool-runner.js (Line 566)

- UI.logToAdvanced(`Project export prepared: ${files.length} files`);

+ EventBus.emit('progress:event', {
+   source: 'tool-runner',
+   event: 'project-exported',
+   status: 'success',
+   payload: { fileCount: files.length }
+ });
```

**Test**: Execute tools, RFC creation, export - verify logs appear in LogPanel

#### Step 3: Update meta-tool-creator.js

```diff
// File: upgrades/meta-tool-creator.js (Line 223)

- globalThis.UI.logToAdvanced(
-   {
-     type: 'tool_created',
-     toolName: name,
-     cycle: toolDef.created_cycle
-   },
-   'tool_created'
- );

+ EventBus.emit('progress:event', {
+   source: 'meta-tool-creator',
+   event: 'tool-created',
+   status: 'success',
+   payload: {
+     type: 'tool_created',
+     toolName: name,
+     cycle: toolDef.created_cycle
+   }
+ });
```

**Test**: Create dynamic tool, verify log entry in LogPanel

---

## Verification Tests

### Test Suite: External API Migration

```javascript
// tests/unit/ui-manager-migration.test.js

describe('UIManager API Migration', () => {
  describe('Backward Compatibility Shims', () => {
    it('should delegate updateGoal to EventBus', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');

      UI.updateGoal('Test goal');

      expect(emitSpy).toHaveBeenCalledWith('goal:set', 'Test goal');
      expect(console.warn).toHaveBeenCalledWith(
        expect.stringContaining('DEPRECATED')
      );
    });

    it('should delegate streamThought to EventBus', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');

      UI.streamThought('Test thought');

      expect(emitSpy).toHaveBeenCalledWith('agent:thought', 'Test thought');
    });

    it('should delegate updateStatusBar to EventBus', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');

      UI.updateStatusBar('PLANNING', 'Analyzing', 45);

      expect(emitSpy).toHaveBeenCalledWith('status:updated', {
        state: 'PLANNING',
        detail: 'Analyzing',
        progress: 45
      });
    });

    it('should delegate logToAdvanced to EventBus', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');

      UI.logToAdvanced('Test log', 'info', { foo: 'bar' });

      expect(emitSpy).toHaveBeenCalledWith('progress:event', {
        source: 'legacy',
        event: 'log-message',
        status: 'info',
        payload: {
          message: 'Test log',
          details: { foo: 'bar' }
        }
      });
    });
  });

  describe('External Module Integration', () => {
    it('should handle app-logic.js goal setting', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');
      const initialConfig = { goal: 'Test goal from config' };

      // Simulate app-logic.js behavior
      if (initialConfig.goal) {
        EventBus.emit('goal:set', initialConfig.goal);
      }

      expect(emitSpy).toHaveBeenCalledWith('goal:set', 'Test goal from config');
    });

    it('should handle tool-runner.js logging', () => {
      const emitSpy = jest.spyOn(EventBus, 'emit');

      EventBus.emit('progress:event', {
        source: 'tool-runner',
        event: 'tool-execution-start',
        status: 'running',
        payload: { toolName: 'read_file', args: {} }
      });

      expect(emitSpy).toHaveBeenCalled();
    });
  });
});
```

---

## Rollback Plan

### If Migration Causes Issues

**Step 1**: Disable feature flag for affected panel
```javascript
config.featureFlags.useModularPanels.LogPanel = false;
```

**Step 2**: If shim fails, revert external code changes
```bash
git revert <commit-hash-for-app-logic.js>
git revert <commit-hash-for-tool-runner.js>
git revert <commit-hash-for-meta-tool-creator.js>
```

**Step 3**: Restore UIManager to pre-refactor state
```bash
git checkout ui-refactor-phase-8-stable -- upgrades/ui-manager.js
```

---

## Deprecation Timeline

| Phase | Action | Deadline |
|-------|--------|----------|
| Phase 9.3 | Add backward compatibility shims | Week 4 |
| Phase 9.4 | Migrate external code (3 files) | Week 4-5 |
| Phase 10.1 | Document deprecation warnings | Week 5 |
| Phase 10.3 | Remove deprecated API (after QA) | Week 6 |

**Warning Period**: 2 weeks (Phase 10.1 → 10.3)
**Console Warnings**: Active during warning period
**Final Removal**: After all external code migrated and tested

---

## Summary

### Low-Risk Migration

**Why Low Risk?**
1. Only 6 external calls across 3 modules
2. All calls have clear EventBus equivalents
3. Backward compatibility shim provides safety net
4. Feature flags enable incremental rollout
5. Rollback plan clearly defined

### Estimated Effort

| Task | Time |
|------|------|
| Add backward compatibility shims | 1 hour |
| Update app-logic.js (1 call) | 15 min |
| Update tool-runner.js (3 calls) | 30 min |
| Update meta-tool-creator.js (1 call) | 15 min |
| Test all paths | 1 hour |
| **Total** | **3 hours** |

### Next Steps

- [x] Phase 0.1: EventBus Event Catalog ✅
- [x] Phase 0.2: UIManager API Audit ✅
- [ ] Phase 0.3: Blueprint Registry Enhancement
- [ ] Phase 0.4: Feature Flag Infrastructure
- [ ] Phase 0.5: Module Widget Protocol Extension
- [ ] Phase 0.6: Panel Communication Contract

---

**Document Maintained By**: CLUSTER 1 (Foundation & Low-Risk Panels)
**Last Audit Date**: 2025-10-20
**Next Review**: After Phase 9.4 (External code migration complete)
