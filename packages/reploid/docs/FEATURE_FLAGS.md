# REPLOID Feature Flag Infrastructure

**Purpose:** Define the feature flag system enabling safe, incremental rollout of modular UI panels during the UIManager refactoring.

**Status:** Phase 0.4 - Pre-Migration Foundation Document

**Related Documents:**
- `EVENTBUS_EVENT_CATALOG.md` - Event contracts for panel communication
- `UIMANAGER_API_MIGRATION.md` - External API migration strategy
- `BLUEPRINT_REGISTRY.md` - Reserved blueprint IDs for new panels

---

## 1. Strategic Rationale

Feature flags enable:
- **Zero-Downtime Deployment**: Switch between monolithic and modular panels at runtime
- **Incremental Validation**: Enable one panel at a time, verify functionality, proceed
- **Instant Rollback**: Disable problematic panels without code changes
- **Parallel Development**: CLUSTER 1 and CLUSTER 2 can deploy independently
- **A/B Testing**: Compare performance/UX between old and new implementations

---

## 2. Feature Flag Schema

### Configuration Structure

Add to `config.json` at root level:

```json
{
  "featureFlags": {
    "useModularPanels": {
      "ProgressTracker": false,
      "LogPanel": false,
      "StatusBar": false,
      "ThoughtPanel": false,
      "GoalPanel": false,
      "SentinelPanel": false
    },
    "enablePanelTelemetry": false,
    "strictEventValidation": false
  }
}
```

**Field Definitions:**

| Flag | Type | Default | Purpose |
|------|------|---------|---------|
| `useModularPanels.<PanelName>` | boolean | false | Enable specific modular panel (falls back to monolithic if false) |
| `enablePanelTelemetry` | boolean | false | Log panel initialization, render times, event flow |
| `strictEventValidation` | boolean | false | Throw errors on malformed events (vs silent warnings) |

### Backward Compatibility

- **Missing config.json**: All flags default to `false` (monolithic behavior)
- **Missing featureFlags section**: Same as above
- **Missing individual panel flag**: Defaults to `false`
- **Invalid values**: Treated as `false` with console warning

---

## 3. Implementation Specification

### Helper Functions (`/utils.js`)

Add after existing utility functions:

```javascript
/**
 * Check if a specific modular panel is enabled via feature flags
 * @param {string} panelName - Name of panel (e.g., 'ProgressTracker', 'LogPanel')
 * @returns {boolean} - True if panel should use modular implementation
 */
function isModularPanelEnabled(panelName) {
  try {
    const enabled = config?.featureFlags?.useModularPanels?.[panelName] ?? false;

    if (enabled && config?.featureFlags?.enablePanelTelemetry) {
      console.log(`[FeatureFlag] ${panelName} modular mode: ENABLED`);
    }

    return enabled;
  } catch (err) {
    console.warn(`[FeatureFlag] Error checking ${panelName}:`, err);
    return false; // Safe fallback to monolithic
  }
}

/**
 * Check if panel telemetry should be logged
 * @returns {boolean}
 */
function isPanelTelemetryEnabled() {
  return config?.featureFlags?.enablePanelTelemetry ?? false;
}

/**
 * Check if strict event validation is enabled
 * @returns {boolean}
 */
function isStrictEventValidationEnabled() {
  return config?.featureFlags?.strictEventValidation ?? false;
}

/**
 * Get summary of all feature flag states (for debugging)
 * @returns {Object} - Current flag configuration
 */
function getFeatureFlagSummary() {
  return {
    modularPanels: config?.featureFlags?.useModularPanels ?? {},
    telemetry: isPanelTelemetryEnabled(),
    strictValidation: isStrictEventValidationEnabled()
  };
}
```

### Integration Pattern (UIManager)

When initializing panels in `ui-manager.js`:

```javascript
// Example for ProgressTracker initialization
async function initializeProgressPanel() {
  if (isModularPanelEnabled('ProgressTracker')) {
    // Use modular implementation
    const ProgressTracker = await ModuleLoader.getModule('ProgressTracker');
    await ProgressTracker.init(/* ... */);

    // Attach event listeners
    EventBus.on('fsm:state:changed', ProgressTracker.api.onStateChange);
    EventBus.on('progress:event', ProgressTracker.api.onProgressEvent);

    // Mount widget to DOM
    const container = document.getElementById('progress-container');
    const widget = ProgressTracker.widget.element;
    container.innerHTML = '';
    container.appendChild(document.createElement(widget));

    console.log('[UIManager] ProgressTracker: MODULAR mode active');
  } else {
    // Use legacy monolithic implementation
    initProgressTrackerLegacy(); // Existing UIManager code
    console.log('[UIManager] ProgressTracker: MONOLITHIC mode active');
  }
}
```

### Widget Visibility Control

Extend widget protocol to include visibility flag:

```javascript
// In each modular panel's createWidget() function
return {
  element: 'progress-tracker-widget',
  displayName: 'Progress Tracker',
  icon: '📊',
  category: 'UI/Panels',
  visible: isModularPanelEnabled('ProgressTracker') // NEW FIELD
};
```

Dashboard can filter widgets based on `widget.visible`.

---

## 4. Rollout Strategy

### Phase-Based Enablement

**Week 1: CLUSTER 1 Development**
```json
{
  "useModularPanels": {
    "ProgressTracker": false,  // Under development
    "LogPanel": false,         // Under development
    "StatusBar": false,        // Under development
    "ThoughtPanel": false,
    "GoalPanel": false,
    "SentinelPanel": false
  },
  "enablePanelTelemetry": true  // Development mode
}
```

**Week 2: CLUSTER 1 Alpha Testing**
```json
{
  "useModularPanels": {
    "ProgressTracker": true,   // ✅ Enable for testing
    "LogPanel": false,         // Still in dev
    "StatusBar": false,
    "ThoughtPanel": false,
    "GoalPanel": false,
    "SentinelPanel": false
  },
  "enablePanelTelemetry": true
}
```

**Week 3: CLUSTER 1 Beta (All Low-Risk Panels)**
```json
{
  "useModularPanels": {
    "ProgressTracker": true,
    "LogPanel": true,
    "StatusBar": true,
    "ThoughtPanel": false,     // CLUSTER 2 not ready
    "GoalPanel": false,
    "SentinelPanel": false
  },
  "enablePanelTelemetry": true
}
```

**Week 4: CLUSTER 2 Integration**
```json
{
  "useModularPanels": {
    "ProgressTracker": true,
    "LogPanel": true,
    "StatusBar": true,
    "ThoughtPanel": true,      // ✅ CLUSTER 2 ready
    "GoalPanel": true,
    "SentinelPanel": false     // Highest risk, enable last
  },
  "enablePanelTelemetry": true
}
```

**Week 5: Full Production**
```json
{
  "useModularPanels": {
    "ProgressTracker": true,
    "LogPanel": true,
    "StatusBar": true,
    "ThoughtPanel": true,
    "GoalPanel": true,
    "SentinelPanel": true      // ✅ All modular
  },
  "enablePanelTelemetry": false  // Disable verbose logging
}
```

---

## 5. Rollback Procedures

### Instant Rollback (Single Panel)

If `LogPanel` causes issues:

```json
{
  "useModularPanels": {
    "ProgressTracker": true,
    "LogPanel": false,  // ⚠️ ROLLBACK - Use monolithic
    "StatusBar": true,
    "ThoughtPanel": true,
    "GoalPanel": true,
    "SentinelPanel": true
  }
}
```

**No restart required** - Next panel re-render uses monolithic implementation.

### Emergency Rollback (All Panels)

If systemic issue detected:

```json
{
  "useModularPanels": {
    "ProgressTracker": false,
    "LogPanel": false,
    "StatusBar": false,
    "ThoughtPanel": false,
    "GoalPanel": false,
    "SentinelPanel": false
  },
  "strictEventValidation": false
}
```

### Rollback Testing

Before each release, verify rollback works:

1. Enable all flags → Run test suite → Verify functionality
2. Disable all flags → Run test suite → Verify fallback to monolithic
3. Enable flags one-by-one → Verify partial modular mode works

---

## 6. Telemetry and Debugging

### Panel Initialization Logging

When `enablePanelTelemetry: true`:

```
[FeatureFlag] ProgressTracker modular mode: ENABLED
[UIManager] ProgressTracker: MODULAR mode active
[ProgressTracker] Initializing modular implementation...
[ProgressTracker] Subscribed to fsm:state:changed
[ProgressTracker] Subscribed to progress:event
[ProgressTracker] Widget mounted to DOM (23ms)
```

### Event Validation Logging

When `strictEventValidation: true`:

```javascript
// In EventBus.emit() wrapper
EventBus.emit('progress:event', payload);

// Validates against schema from EVENTBUS_EVENT_CATALOG.md
if (isStrictEventValidationEnabled()) {
  const schema = EVENT_SCHEMAS['progress:event'];
  if (!validatePayload(payload, schema)) {
    throw new Error(`Invalid payload for progress:event: ${JSON.stringify(payload)}`);
  }
}
```

### Debug Command

Add to `/upgrades/app-logic.js`:

```javascript
// In command parser
if (command === '/feature-flags') {
  const summary = getFeatureFlagSummary();
  console.log('🚩 Feature Flags:', JSON.stringify(summary, null, 2));
  return;
}
```

---

## 7. Testing Requirements

### Unit Tests (per panel)

```javascript
// tests/unit/progress-tracker.test.js
describe('ProgressTracker Feature Flag', () => {
  it('should initialize in modular mode when flag is true', async () => {
    config.featureFlags.useModularPanels.ProgressTracker = true;
    const result = await initializeProgressPanel();
    expect(result.mode).toBe('modular');
  });

  it('should fall back to monolithic when flag is false', async () => {
    config.featureFlags.useModularPanels.ProgressTracker = false;
    const result = await initializeProgressPanel();
    expect(result.mode).toBe('monolithic');
  });

  it('should handle missing config gracefully', async () => {
    delete config.featureFlags;
    const result = await initializeProgressPanel();
    expect(result.mode).toBe('monolithic'); // Safe default
  });
});
```

### Integration Tests

```javascript
// tests/integration/feature-flag-rollout.test.js
describe('Phased Rollout Simulation', () => {
  it('should run with all flags disabled (monolithic)', async () => {
    setAllPanelFlags(false);
    await runFullAgentCycle();
    expect(allPanelsRendered()).toBe(true);
  });

  it('should run with CLUSTER 1 flags enabled', async () => {
    setCluster1Flags(true);
    await runFullAgentCycle();
    expect(allPanelsRendered()).toBe(true);
  });

  it('should run with all flags enabled (full modular)', async () => {
    setAllPanelFlags(true);
    await runFullAgentCycle();
    expect(allPanelsRendered()).toBe(true);
  });
});
```

---

## 8. Extension Opportunities

### User-Level Overrides

Add per-user flag overrides in `StateManager`:

```javascript
// User can toggle panels in settings UI
StateManager.set('user.featureFlags.useModularPanels.ProgressTracker', true);

// Merge with global config
const effectiveFlags = {
  ...config.featureFlags,
  ...StateManager.get('user.featureFlags')
};
```

### Gradual Rollout by Percentage

```json
{
  "useModularPanels": {
    "ProgressTracker": {
      "enabled": true,
      "rolloutPercentage": 50  // Enable for 50% of sessions
    }
  }
}
```

```javascript
function isModularPanelEnabled(panelName) {
  const panelConfig = config?.featureFlags?.useModularPanels?.[panelName];

  if (typeof panelConfig === 'boolean') return panelConfig;
  if (!panelConfig?.enabled) return false;

  const rolloutPct = panelConfig.rolloutPercentage ?? 100;
  const sessionHash = hashCode(sessionId) % 100;
  return sessionHash < rolloutPct;
}
```

### Environment-Specific Flags

```json
{
  "featureFlags": {
    "development": {
      "useModularPanels": { "ProgressTracker": true },
      "enablePanelTelemetry": true,
      "strictEventValidation": true
    },
    "production": {
      "useModularPanels": { "ProgressTracker": false },
      "enablePanelTelemetry": false,
      "strictEventValidation": false
    }
  }
}
```

---

## 9. Verification Checklist

Before marking Phase 0.4 complete:

- [ ] Helper functions added to `utils.js` (isModularPanelEnabled, etc.)
- [ ] Feature flag schema added to `config.json` with all 6 panels
- [ ] UIManager integration pattern documented with code examples
- [ ] Rollout strategy defined with 5-week phased plan
- [ ] Rollback procedures documented (instant + emergency)
- [ ] Telemetry logging specified for debugging
- [ ] Unit test patterns documented for flag behavior
- [ ] Integration test scenarios defined for phased rollout

---

## 10. Cross-References

**Depends On:**
- `EVENTBUS_EVENT_CATALOG.md` - Panels need event contracts before enabling
- `UIMANAGER_API_MIGRATION.md` - External APIs must migrate before full modular mode

**Referenced By:**
- Blueprint 0x00006A (ProgressTracker) - Check flag before initializing
- Blueprint 0x00006B (StatusBar) - Check flag before initializing
- Blueprint 0x00006C (LogPanel) - Check flag before initializing
- Blueprint 0x000065 (ThoughtPanel) - Check flag before initializing
- Blueprint 0x000066 (GoalPanel) - Check flag before initializing
- Blueprint 0x000069 (SentinelPanel) - Check flag before initializing

**Sync Points:**
- CLUSTER 1 Phase 1: Implement flags in ProgressTracker module
- CLUSTER 1 Phase 4: Add feature flag integration tests
- CLUSTER 2 Phase 1: Implement flags in ThoughtPanel module
- Phase 9 (both clusters): Full modular mode with all flags enabled

---

*This document will be updated as the feature flag system evolves during implementation.*
