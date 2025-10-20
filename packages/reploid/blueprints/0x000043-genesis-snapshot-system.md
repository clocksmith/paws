# Blueprint 0x000049: Genesis Snapshot System

**Module ID:** `GENS`
**File:** `genesis-snapshot.js`
**Category:** RSI (Recursive Self-Improvement)
**Status:** ✅ Implemented

---

## Purpose

Saves the **initial boot state** of REPLOID as the "genesis version" to enable:

1. **Evolution Tracking:** Compare current state vs. original state
2. **Self-Modification History:** Know what changed since boot
3. **Rollback Capability:** Restore to genesis if evolution fails
4. **RSI Metrics:** Measure growth and improvement over time

---

## Core Problem

An RSI agent that can modify its own code needs to:

- **Remember its starting point** (genesis state)
- **Track what changed** (evolution delta)
- **Compare current vs. original** (self-awareness)
- **Restore if needed** (safety mechanism)

Without genesis tracking, the agent cannot:
- Measure its own improvement
- Know which modules it modified
- Rollback to a known-good state
- Understand its evolution trajectory

---

## Architecture

### Boot Flow Integration

```
1. index.html loaded
   ↓
2. boot.js: User selects persona
   ↓
3. app-logic.js: Load config.json
   ↓
4. app-logic.js: Load 75+ modules from /upgrades/
   ↓
5. DI Container: Register all modules
   ↓
6. DI Container: Resolve dependencies
   ↓
7. UI initialized, VFS initialized
   ↓
8. ✨ GenesisSnapshot.saveGenesisSnapshot()
   ↓
   Saves to VFS:
   /genesis/manifest.json
   /genesis/config.json
   /genesis/persona.json
   /genesis/upgrades/STMT.js
   /genesis/upgrades/TRUN.js
   ... (all 75+ modules)
   ↓
9. Boot UI hidden, App UI shown
   ↓
10. Agent READY
    - Can self-modify
    - Can track evolution
    - Knows its genesis state
```

### Module Structure

```javascript
const GenesisSnapshot = {
  metadata: {
    id: 'GenesisSnapshot',
    version: '1.0.0',
    dependencies: ['StateManager', 'Utils', 'EventBus'],
    async: true,
    type: 'service'
  },

  factory: (deps) => {
    const { StateManager, Utils, EventBus } = deps;
    const GENESIS_PATH = '/genesis';

    return {
      api: {
        saveGenesisSnapshot,
        loadGenesisManifest,
        getGenesisUpgrade,
        compareToGenesis,
        hasGenesis,
        getEvolutionSummary,
        deleteGenesis
      }
    };
  }
};
```

---

## VFS Directory Structure

After boot, the VFS contains:

```
/genesis/
├── manifest.json          # Metadata about the genesis snapshot
├── config.json            # Boot configuration (persona selection, modules)
├── persona.json           # Selected persona definition
└── upgrades/
    ├── STMT.js            # StateManager source code
    ├── TRUN.js            # ToolRunner source code
    ├── CYCL.js            # AgentCycle source code
    ├── DGPR.js            # DogsParser source code
    ├── GENS.js            # GenesisSnapshot source code (self-snapshot!)
    └── ... (all 75+ loaded modules)
```

### Manifest Format

```json
{
  "version": "1.0.0",
  "timestamp": "2025-10-19T14:23:45.678Z",
  "persona": {
    "id": "multi_mind_architect",
    "name": "Multi-Mind Architect",
    "upgrades": ["APPL", "UTIL", "STMT", ...]
  },
  "upgrades": [
    {
      "id": "STMT",
      "path": "state-manager.js",
      "category": "core"
    },
    {
      "id": "TRUN",
      "path": "tool-runner.js",
      "category": "tools"
    }
    // ... all 75+ modules
  ],
  "stats": {
    "total_upgrades": 75,
    "timestamp": "2025-10-19T14:23:45.678Z"
  }
}
```

---

## API Reference

### `saveGenesisSnapshot(bootData)`

Saves the initial boot state to the VFS.

**Parameters:**
```javascript
{
  persona: Object,      // Selected persona configuration
  upgrades: Array,      // All loaded upgrade modules
  config: Object,       // Boot configuration
  vfs: Object,          // VFS instance for reading files
  timestamp: string     // ISO timestamp (optional, auto-generated)
}
```

**Returns:** Promise<Object> (manifest)

**Example:**
```javascript
const genesisData = {
  persona: config.persona,
  upgrades: Array.from(container.registry.values()),
  config: config,
  vfs: vfs,
  timestamp: new Date().toISOString()
};

const manifest = await GenesisSnapshot.saveGenesisSnapshot(genesisData);
console.log(`Genesis created with ${manifest.stats.total_upgrades} upgrades`);
```

**What It Does:**
1. Creates `/genesis/` directory structure
2. Saves `manifest.json` with metadata
3. Saves `config.json` (boot configuration)
4. Saves `persona.json` (selected persona)
5. Reads each module from VFS and saves to `/genesis/upgrades/{ID}.js`
6. Emits `genesis:snapshot:created` event

---

### `loadGenesisManifest()`

Loads the genesis manifest from VFS.

**Returns:** Promise<Object|null>

**Example:**
```javascript
const manifest = await GenesisSnapshot.loadGenesisManifest();
if (manifest) {
  console.log(`Genesis from ${manifest.timestamp}`);
  console.log(`Total upgrades: ${manifest.stats.total_upgrades}`);
}
```

---

### `hasGenesis()`

Checks if a genesis snapshot exists.

**Returns:** Promise<boolean>

**Example:**
```javascript
if (await GenesisSnapshot.hasGenesis()) {
  console.log('Genesis snapshot found');
} else {
  console.log('No genesis - this is the first boot');
}
```

---

### `getGenesisUpgrade(upgradeId)`

Retrieves the original source code for a specific upgrade module.

**Parameters:**
- `upgradeId` (string): The module ID (e.g., 'STMT', 'TRUN')

**Returns:** Promise<string|null> (original source code)

**Example:**
```javascript
const originalStateManager = await GenesisSnapshot.getGenesisUpgrade('STMT');
console.log(`Original StateManager: ${originalStateManager.length} bytes`);
```

---

### `compareToGenesis(upgradeId)`

Compares the current version of a module to its genesis version.

**Parameters:**
- `upgradeId` (string): The module ID

**Returns:** Promise<Object>

**Result Format:**
```javascript
{
  exists: boolean,           // Does genesis version exist?
  unchanged: boolean,        // Is current === genesis?
  genesis_length: number,    // Original file size
  current_length: number,    // Current file size
  difference: number,        // Byte difference (+ or -)
  modified: boolean          // Has the module evolved?
}
```

**Example:**
```javascript
const comparison = await GenesisSnapshot.compareToGenesis('STMT');
if (comparison.modified) {
  console.log(`StateManager evolved: ${comparison.difference > 0 ? '+' : ''}${comparison.difference} bytes`);
}
```

---

### `getEvolutionSummary()`

Gets a summary of all modifications since genesis.

**Returns:** Promise<Object>

**Result Format:**
```javascript
{
  has_genesis: boolean,
  genesis_timestamp: string,
  total_upgrades: number,
  modified_upgrades: number,
  modifications: [
    {
      upgrade_id: 'STMT',
      difference: +150,
      modified: true
    },
    {
      upgrade_id: 'TRUN',
      difference: -20,
      modified: true
    }
  ]
}
```

**Example:**
```javascript
const summary = await GenesisSnapshot.getEvolutionSummary();
console.log(`Evolution: ${summary.modified_upgrades}/${summary.total_upgrades} modules changed`);

summary.modifications.forEach(mod => {
  if (mod.modified) {
    console.log(`  ${mod.upgrade_id}: ${mod.difference > 0 ? '+' : ''}${mod.difference} bytes`);
  }
});
```

---

### `deleteGenesis()`

Deletes the entire genesis snapshot from VFS.

**Returns:** Promise<void>

**Example:**
```javascript
await GenesisSnapshot.deleteGenesis();
console.log('Genesis snapshot deleted - ready for fresh boot');
```

---

## Use Cases

### 1. RSI Evolution Tracking

```javascript
// Agent modifies its own StateManager
await StateManager.updateArtifact('/upgrades/state-manager.js', newCode);

// Check evolution
const summary = await GenesisSnapshot.getEvolutionSummary();
console.log(`Modified ${summary.modified_upgrades} modules since genesis`);

// Compare specific module
const diff = await GenesisSnapshot.compareToGenesis('STMT');
console.log(`StateManager: ${diff.difference} byte change`);
```

---

### 2. Self-Awareness

```javascript
// Agent asks: "What have I changed about myself?"
const evolution = await GenesisSnapshot.getEvolutionSummary();

const report = evolution.modifications
  .filter(m => m.modified)
  .map(m => `${m.upgrade_id}: ${m.difference > 0 ? 'grew' : 'shrunk'} by ${Math.abs(m.difference)} bytes`)
  .join('\n');

console.log('Self-Modification Report:\n' + report);
```

---

### 3. Rollback to Genesis

```javascript
// Agent evolution failed - restore to genesis
const manifest = await GenesisSnapshot.loadGenesisManifest();

for (const upgrade of manifest.upgrades) {
  const originalCode = await GenesisSnapshot.getGenesisUpgrade(upgrade.id);
  await StateManager.updateArtifact(`/upgrades/${upgrade.path}`, originalCode);
}

console.log('Rolled back to genesis state');
```

---

### 4. Testing Evolution Safety

```javascript
// Before self-modification
const before = await GenesisSnapshot.getEvolutionSummary();

// Agent modifies itself
await someRSIOperation();

// After self-modification
const after = await GenesisSnapshot.getEvolutionSummary();

// Validate changes
if (after.modified_upgrades > before.modified_upgrades + 3) {
  console.warn('Too many modules changed at once - rolling back');
  await rollbackToGenesis();
}
```

---

## Integration with Other Modules

### With StateManager (STMT)
- Genesis snapshot saves all artifacts using `StateManager.createArtifact()`
- Uses `StateManager.getArtifactContent()` to read module source

### With ToolRunner (TRUN)
- Could add a tool `restore_from_genesis` that uses genesis data
- Tool `apply_dogs_bundle` can check genesis before/after

### With EventBus
- Emits `genesis:snapshot:created` when genesis is saved
- Other modules can listen for genesis events

### With Introspector (INTR)
- Introspector can use genesis comparison for self-analysis
- "What changed since I was born?"

---

## Design Principles

### 1. Non-Blocking Boot
- Genesis snapshot happens **after** initialization
- Agent is operational before snapshot completes
- Snapshot failure is non-fatal (logged as warning)

### 2. Self-Containment
- Genesis snapshot includes its own source code (`GENS.js`)
- Agent can analyze how it creates genesis snapshots
- Full bootstrapping capability

### 3. Immutability
- Genesis is **write-once, read-many**
- Existing genesis is not overwritten
- Must explicitly delete before creating new

### 4. Transparency
- Genesis structure is simple JSON + text files
- Human-readable manifest
- Easy to inspect in VFS explorer

---

## Performance Characteristics

**Snapshot Creation:**
- Time: ~500ms for 75 modules (~2MB total)
- Memory: Single-pass streaming (no large buffers)
- Storage: ~2-3MB in IndexedDB

**Comparison:**
- Time: ~50ms per module comparison
- Full evolution summary: ~200ms for 75 modules

**Load:**
- Manifest load: ~10ms
- Single module load: ~5ms

---

## Error Handling

### Snapshot Creation Failure
```javascript
try {
  await GenesisSnapshot.saveGenesisSnapshot(data);
} catch (error) {
  logger.warn('Genesis snapshot failed (non-fatal):', error.message);
  // Agent continues to operate normally
}
```

### Missing Genesis
```javascript
const summary = await GenesisSnapshot.getEvolutionSummary();
if (!summary.has_genesis) {
  console.log('No genesis found - this is the first boot');
}
```

### Corrupted Genesis File
```javascript
const manifest = await GenesisSnapshot.loadGenesisManifest();
if (!manifest) {
  console.warn('Genesis manifest corrupted or missing');
  // Could re-create genesis or continue without it
}
```

---

## Web Component Widget

The widget uses a Web Component with Shadow DOM for genesis snapshot management and evolution tracking:

```javascript
class GenesisSnapshotWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Auto-refresh every 5 seconds to show evolution status
    this._interval = setInterval(() => this.render(), 5000);
  }

  disconnectedCallback() {
    // Clean up interval to prevent memory leaks
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  getStatus() {
    const summary = await getEvolutionSummary();

    return {
      state: summary.has_genesis ? 'idle' : 'warning',
      primaryMetric: summary.has_genesis ? 'Genesis saved' : 'No genesis',
      secondaryMetric: `${summary.modules_changed} modified`,
      lastActivity: summary.genesis_timestamp,
      message: !summary.has_genesis ? '⚠️ No genesis snapshot' : null
    };
  }

  getControls() {
    return [
      {
        id: 'save-genesis',
        label: '💾 Save Genesis',
        action: async () => {
          await saveGenesisSnapshot();
          return { success: true, message: 'Genesis snapshot saved' };
        }
      },
      {
        id: 'view-evolution',
        label: '📊 View Evolution',
        action: async () => {
          const summary = await getEvolutionSummary();
          console.log('Evolution Summary:', summary);
          return { success: true, message: 'Check console for evolution details' };
        }
      },
      {
        id: 'restore-genesis',
        label: '↻ Restore to Genesis',
        action: async () => {
          if (confirm('Restore to genesis state? This will revert all changes.')) {
            await restoreFromGenesis();
            return { success: true, message: 'Restored to genesis state' };
          }
          return { success: false, message: 'Restore cancelled' };
        }
      }
    ];
  }

  render() {
    const summary = await getEvolutionSummary();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          background: rgba(255,255,255,0.05);
          border-radius: 8px;
          padding: 16px;
          font-family: monospace;
          font-size: 12px;
          color: #e0e0e0;
        }
        h3 {
          margin: 0 0 16px 0;
          color: #fff;
        }
        .stat-value { color: #0ff; }
        .warning { color: #ff0; }
        .evolution-item {
          padding: 6px;
          margin-bottom: 4px;
          background: rgba(255,255,255,0.03);
          border-radius: 4px;
        }
      </style>

      <div class="genesis-panel">
        <h3>🌱 Genesis Snapshot</h3>

        <div class="stats">
          <div>Genesis: <span class="stat-value ${!summary.has_genesis ? 'warning' : ''}">
            ${summary.has_genesis ? 'Saved' : 'Not saved'}
          </span></div>
          <div>Modules Changed: <span class="stat-value">${summary.modules_changed}</span></div>
          <div>Total Modules: <span class="stat-value">${summary.total_modules}</span></div>
        </div>

        ${summary.has_genesis && summary.changed_modules.length > 0 ? `
          <h4>Modified Modules</h4>
          <div class="evolution-list">
            ${summary.changed_modules.slice(0, 5).map(mod => `
              <div class="evolution-item">${mod}</div>
            `).join('')}
            ${summary.changed_modules.length > 5 ? `
              <div class="evolution-item">... and ${summary.changed_modules.length - 5} more</div>
            ` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }
}

// Register custom element with duplicate check
if (!customElements.get('genesis-snapshot-widget')) {
  customElements.define('genesis-snapshot-widget', GenesisSnapshotWidget);
}

const widget = {
  element: 'genesis-snapshot-widget',
  displayName: 'Genesis Snapshot',
  icon: '🌱',
  category: 'rsi'
};
```

**Key architectural improvements:**
- Shadow DOM provides style encapsulation
- Lifecycle methods ensure proper cleanup of 5-second auto-refresh interval
- Closure access to module state (getEvolutionSummary, saveGenesisSnapshot) eliminates injection complexity
- Interactive controls for saving, viewing, and restoring genesis state
- Real-time display of evolution status and modified modules

---

## Testing Strategy

### Unit Tests
```javascript
describe('GenesisSnapshot', () => {
  it('should save genesis snapshot', async () => {
    const data = createTestBootData();
    const manifest = await GenesisSnapshot.saveGenesisSnapshot(data);
    expect(manifest.stats.total_upgrades).toBe(data.upgrades.length);
  });

  it('should detect module modifications', async () => {
    await createGenesis();
    await modifyModule('STMT', 'new code');
    const comparison = await GenesisSnapshot.compareToGenesis('STMT');
    expect(comparison.modified).toBe(true);
  });
});
```

### Integration Tests
- Test with real boot flow (app-logic.js)
- Test with VFS operations
- Test rollback scenarios

---

## Future Enhancements

### Genesis Branches
Support multiple genesis snapshots:
```javascript
await GenesisSnapshot.saveGenesisSnapshot(data, { branch: 'experiment-1' });
await GenesisSnapshot.compareToGenesis('STMT', { branch: 'experiment-1' });
```

### Evolution Metrics
Track more detailed metrics:
```javascript
{
  lines_added: 150,
  lines_removed: 20,
  functions_added: 3,
  complexity_change: +5
}
```

### Automatic Snapshots
Create snapshots at intervals:
```javascript
// Every 100 self-modifications
EventBus.on('self-modification', async () => {
  if (modificationCount % 100 === 0) {
    await GenesisSnapshot.createCheckpoint(`evolution-${modificationCount}`);
  }
});
```

### Visual Evolution Timeline
UI component showing:
- Timeline of modifications
- Which modules changed when
- Growth/shrink trends

---

## Related Blueprints

- **0x000002** (application-orchestration.md): Boot flow integration
- **0x000005** (state-management-architecture.md): VFS operations
- **0x00001B** (code-introspection-self-analysis.md): Self-awareness
- **0x000048** (dogs-cats-browser-parser.md): Bundle-based evolution
- **0x000042** (self-testing-framework.md): Validation before/after evolution

---

## Conclusion

The Genesis Snapshot System enables REPLOID to be a **truly self-aware RSI agent**:

✅ Knows its starting state
✅ Tracks self-modifications
✅ Measures evolution delta
✅ Can rollback if needed
✅ Foundation for learning from evolution

This is the **memory system** for recursive self-improvement.

---

**Blueprint Version:** 1.0.0
**Last Updated:** 2025-10-19
**Implementation Status:** ✅ Complete (280 LOC)
