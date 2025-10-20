# Migration Work Plan - 5 Parallel Coding Agents

**Generated**: 2025-10-19
**Source**: Verified against migration scan + tracker
**Total Work Items**: 54 tasks across 48 unique modules

---

## Summary of Remaining Work

Based on scan verification (73/84 modules have Web Components):

| Task Type | Count | Priority |
|-----------|-------|----------|
| Blueprint Updates | 38 modules | HIGH (13 from Cluster 4) |
| Test Creation | 9 modules | MEDIUM |
| Web Component Conversion | 7 modules | LOW |
| **TOTAL** | **54 tasks** | |

---

## Part 1: Cluster 4 Blueprints (13 modules)

**Priority**: 🔴 HIGHEST - Just converted, immediate completion path
**Agent Task**: Update blueprints for recently converted Cluster 4 modules

### Modules (13):
1. audit-logger.js (0x000034)
2. backup-restore.js (TBD blueprint)
3. blueprint-creator.js (0x000018)
4. cost-tracker.js (0x00003F)
5. goal-modifier.js (0x000017)
6. meta-tool-creator.js (0x000016)
7. rate-limiter.js (0x000032)
8. sentinel-fsm.js (TBD blueprint)
9. sentinel-tools.js (TBD blueprint)
10. tool-execution-panel.js (TBD blueprint)
11. tutorial-system.js (0x000035)
12. verification-manager.js (0x00004D)
13. worker-pool.js (TBD blueprint)

### Instructions:

For each module:

1. **Locate Blueprint** (if exists):
   - Check `BLUEPRINTS_UPGRADES_MAPPING.md` for blueprint ID
   - If blueprint doesn't exist (TBD), create new one (see Step 2)
   - Blueprint file: `blueprints/0x[ID]-description.md`

2. **Create Blueprint** (if TBD):
   - Assign next available blueprint ID
   - Use blueprint template structure
   - Follow `BLUEPRINT_UPDATE_GUIDE.md` format

3. **Update Section 2: Architectural Solution**:
   - Read the actual Web Component implementation from `upgrades/[module].js`
   - Show Web Component class pattern (NOT renderPanel)
   - Include Shadow DOM, lifecycle methods, getStatus(), getControls()
   - Show closure access pattern

4. **Update Section 3: Implementation Pathway**:
   - Rewrite steps to match Web Component flow:
     1. Define Web Component class inside factory
     2. Add Shadow DOM
     3. Implement lifecycle (connectedCallback, disconnectedCallback)
     4. Implement getStatus() with closure access
     5. Implement getControls() if interactive
     6. Implement render() method
     7. Register custom element
     8. Return widget object with `{ element, displayName, icon, category }`

5. **Verification**:
   ```bash
   # No OLD_PATTERN in blueprint
   grep -i "renderPanel" blueprints/0x[ID]*.md  # Should return nothing

   # Shows Web Component pattern
   grep -c "customElements.define" blueprints/0x[ID]*.md  # Should be >0
   ```

6. **Update Tracker**:
   - Mark blueprint column as ✅
   - Module should now show **COMPLETE** (all 3 columns ✅)

---

## Part 2: Visualization Widget Blueprints (12 modules)

**Priority**: 🟡 HIGH - Cohesive category
**Agent Task**: Update blueprints for visualization/UI widgets

### Modules (12):
1. agent-visualizer.js (0x00002E)
2. ast-visualizer.js (0x00002F)
3. canvas-visualizer.js (0x00002A)
4. confirmation-modal.js (0x000028)
5. module-graph-visualizer.js (0x000030)
6. penteract-analytics.js (0x000024)
7. performance-monitor.js (0x00002C)
8. toast-notifications.js (0x000031)
9. tool-analytics.js (0x00003E)
10. vfs-explorer-widget-conversion.js (TBD)
11. visual-self-improvement.js (0x000019)
12. viz-data-adapter.js (0x00002B)

### Instructions:

Follow same process as Part 1:
1. Read actual implementation from `upgrades/[module].js`
2. Locate existing blueprint using `BLUEPRINTS_UPGRADES_MAPPING.md`
3. Update Section 2 with Web Component pattern
4. Update Section 3 with lifecycle-based steps
5. Run verification commands
6. Update tracker

**Special considerations**:
- These are visualization widgets - emphasize Shadow DOM encapsulation
- Many use canvas or complex rendering - show how render() handles this
- Some may have getControls() for interactive features

---

## Part 3: Storage/State Blueprints + Tests (11 modules)

**Priority**: 🟡 HIGH - Mixed tasks
**Agent Task**: Update 8 blueprints + create 3 tests

### Blueprints (8):
1. diff-viewer-ui.js (TBD)
2. event-bus-widget.js (TBD)
3. hitl-controller.js (TBD)
4. hot-reload.js (TBD)
5. pyodide-runtime.js (0x000036)
6. reflection-search.js (0x00003D)
7. reflection-store.js (0x00003B)
8. state-manager-widget.js (TBD)

### Tests (3):
1. config.js - Create `tests/unit/config.test.js`
2. python-tool.js - Create `tests/unit/python-tool.test.js`
3. penteract-visualizer.js - Create `tests/unit/penteract-visualizer.test.js`

### Instructions for Blueprints:

Same as Parts 1 & 2 - follow `BLUEPRINT_UPDATE_GUIDE.md`

### Instructions for Tests:

For each module needing a test:

1. **Read Implementation**:
   ```bash
   # Read the module
   cat upgrades/[module].js
   ```

2. **Create Test File**:
   ```bash
   # Create test file
   touch tests/unit/[module].test.js
   ```

3. **Follow Test Pattern** from `WEB_COMPONENTS_TESTING_GUIDE.md`:
   - Import module
   - Mock dependencies
   - Pattern 1: Shadow DOM creation
   - Pattern 4: getStatus() - ALL 5 fields
   - Pattern 4b: getControls() - if interactive
   - Pattern 9: Lifecycle cleanup

4. **Test Structure**:
   ```javascript
   import Module from '../../upgrades/[module].js';

   describe('[Module] Widget', () => {
     let instance, widget;

     beforeEach(() => {
       instance = Module.factory({/* mocked deps */});
       widget = document.createElement(instance.widget.element);
       document.body.appendChild(widget);
     });

     afterEach(() => {
       document.body.removeChild(widget);
     });

     it('should create Shadow DOM', () => { ... });
     it('should implement getStatus() correctly', () => { ... });
     it('should implement getControls() correctly', () => { ... }); // if applicable
     it('should clean up on disconnect', () => { ... });
   });
   ```

5. **Run Tests**:
   ```bash
   npm test tests/unit/[module].test.js
   ```

6. **Update Tracker**:
   - Mark test column as ✅

---

## Part 4: Web Component Conversions + Tests (11 modules)

**Priority**: 🟢 MEDIUM - Requires more work
**Agent Task**: Convert 7 modules to Web Components + create 4 tests

### Web Component Conversions (7):
1. git-vfs.js (TBD blueprint)
2. introspector.js (0x00001B blueprint exists)
3. module-dashboard.js (TBD)
4. module-integrity.js (0x000033 blueprint exists)
5. reflection-analyzer.js (0x00003C blueprint exists)
6. vfs-explorer.js (0x000029 blueprint exists)
7. genesis-snapshot.js (0x000049 blueprint exists)

### Tests (4):
1. deja-vu-detector.js (also needs blueprint after)
2. hitl-control-panel.js (also needs blueprint after)
3. meta-cognitive-layer.js (also needs blueprint after)
4. persona-manager.js (also needs blueprint after)

### Instructions for Web Component Conversions:

For each module:

1. **Read Current Implementation**:
   ```bash
   cat upgrades/[module].js
   ```

2. **Follow Conversion Pattern** from `WEB_COMPONENTS_GUIDE.md`:

   a. **Create Web Component class** inside factory function:
   ```javascript
   factory: (deps) => {
     // Module state
     let moduleState = {};

     // API
     const api = { ... };

     // Web Component Widget
     class ModuleWidget extends HTMLElement {
       constructor() {
         super();
         this.attachShadow({ mode: 'open' });
       }

       connectedCallback() {
         this.render();
         this._interval = setInterval(() => this.render(), 2000);
       }

       disconnectedCallback() {
         if (this._interval) {
           clearInterval(this._interval);
           this._interval = null;
         }
       }

       getStatus() {
         return {
           state: 'idle',              // Required
           primaryMetric: '0 items',   // Required
           secondaryMetric: 'Ready',   // Required
           lastActivity: null,         // Required
           message: null               // Required
         };
       }

       getControls() {
         return [
           {
             id: 'action-id',
             label: 'Button Text',
             action: () => {
               // Action logic
               return { success: true, message: 'Done' };
             }
           }
         ];
       }

       render() {
         this.shadowRoot.innerHTML = `
           <style>
             :host { display: block; }
           </style>
           <div>Content</div>
         `;
       }
     }

     // Register
     const elementName = 'module-widget';
     if (!customElements.get(elementName)) {
       customElements.define(elementName, ModuleWidget);
     }

     // Return
     const widget = {
       element: elementName,
       displayName: 'Module Name',
       icon: '⚙️',
       category: 'service'
     };

     return { api, widget };
   }
   ```

3. **Replace OLD_PATTERN**:
   - Remove `renderPanel:` function
   - Remove `updateInterval` property
   - Remove `getStatus`, `getControls` from widget object (move to class)

4. **Verification**:
   ```bash
   # No OLD_PATTERN
   grep -l "renderPanel:" upgrades/[module].js  # Should return nothing

   # Has registration
   grep -c "customElements.define" upgrades/[module].js  # Should be 1
   ```

5. **Update Tracker**:
   - Mark Web Component column as ✅

### Instructions for Tests:

Same as Part 3 - create test files using `WEB_COMPONENTS_TESTING_GUIDE.md` patterns.

---

## Part 5: Final Blueprints + Verification (10 modules)

**Priority**: 🟢 MEDIUM - Cleanup phase
**Agent Task**: Create/update blueprints for edge cases + run verification

### Blueprints Needed (10):
1. deja-vu-detector.js (0x00004A exists - needs update)
2. hitl-control-panel.js (TBD - needs creation)
3. meta-cognitive-layer.js (0x00004B exists - needs update)
4. persona-manager.js (0x000051 exists - needs update)
5. genesis-snapshot.js (0x000049 exists - needs update)
6. backup-restore.js (TBD - from Part 1, if not done)
7. sentinel-fsm.js (TBD - from Part 1, if not done)
8. sentinel-tools.js (TBD - from Part 1, if not done)
9. tool-execution-panel.js (TBD - from Part 1, if not done)
10. worker-pool.js (TBD - from Part 1, if not done)

### Instructions:

1. **For Existing Blueprints (0x00004A, 0x00004B, 0x000051, 0x000049)**:
   - Follow `BLUEPRINT_UPDATE_GUIDE.md`
   - Update Section 2 with Web Component pattern
   - Update Section 3 with lifecycle steps

2. **For New Blueprints (TBD)**:
   - Assign next available blueprint ID
   - Create new blueprint file: `blueprints/0x[ID]-module-name.md`
   - Use blueprint template structure
   - Write Section 1 (Core Objective)
   - Write Section 2 (Architectural Solution) - Web Component pattern
   - Write Section 3 (Implementation Pathway) - lifecycle steps

3. **Final Verification**:
   ```bash
   # Run scan
   node upgrades/scan-migrations.js

   # Verify counts match
   # Expected: 73 WC, 32+ BP (after blueprints), 72+ Tests (after test creation)
   ```

4. **Update Tracker**:
   - Mark all blueprints as ✅
   - Update summary counts at top
   - Verify "Fully Complete" count increases

---

## Execution Notes

### Running Agents in Parallel:

```bash
# Agent 1
# Work on Part 1 (Cluster 4 Blueprints)

# Agent 2
# Work on Part 2 (Visualization Blueprints)

# Agent 3
# Work on Part 3 (Storage/State Blueprints + Tests)

# Agent 4
# Work on Part 4 (WC Conversions + Tests)

# Agent 5
# Work on Part 5 (Final Blueprints + Verification)
```

### Verification Commands:

After each agent completes:

```bash
# Check blueprints updated
grep -l "customElements.define" blueprints/0x*.md | wc -l

# Check no OLD_PATTERN in blueprints
grep -l "renderPanel:" blueprints/0x*.md

# Check tests pass
npm test

# Re-run scan
node upgrades/scan-migrations.js

# Verify tracker accuracy
grep "COMPLETE" WEB_COMPONENTS_MIGRATION_TRACKER.md | wc -l
```

---

## Success Criteria

**Part 1**: 13 modules show **COMPLETE** status (all 3 columns ✅)
**Part 2**: 12 additional modules show **COMPLETE** status
**Part 3**: 8 modules show **COMPLETE**, 3 modules have tests
**Part 4**: 7 modules have Web Components, 4 modules have tests
**Part 5**: All remaining modules have blueprints, scan verification passes

**Final Expected State**:
- **Web Components**: 73/84 ✅ (current)
- **Blueprints**: 70/84 ✅ (38 new + 32 existing)
- **Tests**: 81/84 ✅ (9 new + 72 existing)
- **Fully Complete**: 68/84 ✅ (81% complete!)

---

**Last Updated**: 2025-10-19
**Status**: READY FOR PARALLEL EXECUTION
