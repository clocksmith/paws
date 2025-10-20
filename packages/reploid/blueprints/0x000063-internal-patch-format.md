# Blueprint 0x00006D: Internal Patch Format

**Objective:** Replace DOGS/CATS markdown format with fast JSON-based patch format for internal RSI operations, maintaining backward compatibility via export/import.

**Target Upgrade:** IPAT (`internal-patch-format.js`)

**Prerequisites:**
- **0x00004E** (Module Widget Protocol) - REQUIRED for widget implementation
- DIFF (Diff Utilities) - For computing patches
- UTIL (Utils) - For validation and error handling
- DGPR (DOGS Parser Browser) - For backward compatibility conversions

**Affected Artifacts:** `/upgrades/internal-patch-format.js`, `/tests/unit/internal-patch-format.test.js`, `/config.json`

**Category:** RSI/Core

---

## 1. The Strategic Imperative

**The Problem:**

REPLOID's current RSI (Recursive Self-Improvement) workflow uses the DOGS/CATS markdown format for all internal change operations. While DOGS/CATS provides excellent human readability and optional interop with PAWS CLI, it has significant performance costs for rapid RSI cycles:

- **800+ line regex-based parser** (`dogs-parser-browser.js`) processes every change
- **~10x slower** than native JSON parsing (regex overhead)
- **~5x larger** payload size (markdown formatting, human-readable syntax)
- **Memory overhead** from string manipulation and regex compilation
- **Unnecessary complexity** for internal operations that never need human review

**Current RSI Bottleneck:**
```javascript
// Typical RSI cycle with DOGS format:
1. Agent generates change (JSON in memory)
2. Convert to DOGS markdown format         // ~2ms overhead
3. Parse DOGS back to structured data      // ~8ms overhead (regex)
4. Apply to VFS                            // ~1ms actual work
5. Verify and commit                       // ~2ms

Total: ~13ms per change, 10ms is format overhead (77% waste)
```

**Strategic Insight:**

DOGS/CATS format serves TWO distinct use cases:
1. **External Interop:** Human review, Git commits, PAWS CLI integration (OPTIONAL, ~5% of usage)
2. **Internal RSI:** Agent self-modification cycles (FREQUENT, ~95% of usage)

**Solution:**

Create a **dual-format architecture**:
- **Internal Format (IPAT):** Fast JSON patches for RSI cycles (~1ms parsing, 90% size reduction)
- **External Format (DOGS):** Keep for export/import/human review (backward compatible)

**Benefits:**
- **10x faster RSI cycles** (1ms vs 10ms per change)
- **90% memory reduction** (JSON binary vs markdown text)
- **Simpler verification** (JSON schema validation vs regex parsing)
- **Non-breaking change** (DOGS still available for export/import)

---

## 2. The Architectural Solution

### 2.1 Internal Patch Format Specification

**IPAT v2 JSON Schema:**

```javascript
{
  "version": 2,
  "timestamp": 1635789600000,
  "metadata": {
    "reason": "Optimize performance",
    "author": "agent",
    "confidence": 0.95
  },
  "changes": [
    {
      "type": "CREATE" | "MODIFY" | "DELETE",
      "path": "/upgrades/module-name.js",
      "content": "...",          // for CREATE/MODIFY
      "oldContent": "...",        // for MODIFY (verification)
      "encoding": "utf8" | "base64"
    }
  ]
}
```

**Key Design Decisions:**

1. **Native JSON:** Fast parsing via `JSON.parse()`, no regex overhead
2. **Minimal Overhead:** Only essential metadata
3. **Verification Built-in:** `oldContent` enables atomic verification
4. **Type Safety:** Explicit `type` field prevents ambiguity
5. **Future-proof:** Version field enables schema evolution

### 2.2 Format Comparison

| Feature | DOGS/CATS | IPAT v2 | Improvement |
|---------|-----------|---------|-------------|
| Parse Time | ~10ms | ~1ms | 10x faster |
| Size | ~50 KB | ~10 KB | 5x smaller |
| Memory | High (regex) | Low (JSON) | ~80% reduction |
| Validation | Regex patterns | JSON schema | Simpler |
| Human Readable | Yes | No | Trade-off accepted |

### 2.3 Dual-Format Architecture

```javascript
// Internal RSI Cycle (FAST PATH)
Agent → IPAT JSON → Apply → Verify → Commit
        (~1ms)

// External Export (COMPATIBILITY PATH)
Agent → IPAT JSON → Convert to DOGS → Export/Git
        (~3ms, only when needed)

// External Import (COMPATIBILITY PATH)
Import DOGS → Parse → Convert to IPAT → Apply
              (~10ms, only when needed)
```

### 2.4 Module API

```javascript
const InternalPatchFormat = {
  api: {
    // Fast path
    createPatch: (changes, metadata) => { /* Return IPAT JSON */ },
    parsePatch: (patchJSON) => { /* Validate and parse */ },
    applyPatch: (patch, stateManager) => { /* Apply changes to VFS */ },

    // Verification
    validatePatch: (patch) => { /* JSON schema validation */ },
    verifyChanges: (patch, currentState) => { /* Check oldContent matches */ },

    // Backward compatibility
    patchToDogs: (patch) => { /* Convert IPAT → DOGS */ },
    dogsToIPAT: (dogsBundle) => { /* Convert DOGS → IPAT */ },

    // Metadata
    getStats: () => { /* Return parse/apply statistics */ }
  }
};
```

### 2.5 Widget Interface

The module includes a Web Component widget for dashboard visibility:

```javascript
class InternalPatchFormatWidget extends HTMLElement {
  getStatus() {
    return {
      state: recentActivity ? 'active' : 'idle',
      primaryMetric: `${stats.patchesCreated} patches`,
      secondaryMetric: `${stats.avgParseTime}ms avg`,
      lastActivity: stats.lastPatchTime,
      message: stats.errors > 0 ? `${stats.errors} validation errors` : null
    };
  }
}
```

---

## 3. The Implementation Pathway

### Step 1: Create Module Skeleton

Create `/upgrades/internal-patch-format.js`:

```javascript
// @blueprint 0x00006D

const InternalPatchFormat = {
  metadata: {
    id: 'InternalPatchFormat',
    version: '1.0.0',
    dependencies: ['Utils', 'EventBus', 'DiffUtils'],
    async: false,
    type: 'pure'
  },

  factory: (deps) => {
    const { Utils, EventBus, DiffUtils } = deps;

    // Statistics tracking (in closure)
    let _stats = {
      patchesCreated: 0,
      patchesParsed: 0,
      patchesApplied: 0,
      totalParseTime: 0,
      avgParseTime: 0,
      errors: 0,
      lastPatchTime: null
    };

    // Schema validation
    const IPAT_SCHEMA = {
      type: 'object',
      required: ['version', 'timestamp', 'changes'],
      properties: {
        version: { type: 'number', enum: [2] },
        timestamp: { type: 'number' },
        metadata: { type: 'object' },
        changes: {
          type: 'array',
          items: {
            type: 'object',
            required: ['type', 'path'],
            properties: {
              type: { enum: ['CREATE', 'MODIFY', 'DELETE'] },
              path: { type: 'string' },
              content: { type: 'string' },
              oldContent: { type: 'string' },
              encoding: { enum: ['utf8', 'base64'] }
            }
          }
        }
      }
    };

    // API implementation...
    // Widget implementation...

    return { api, widget };
  }
};

export default InternalPatchFormat;
```

### Step 2: Implement Core API - createPatch

```javascript
const createPatch = (changes, metadata = {}) => {
  const startTime = performance.now();

  try {
    const patch = {
      version: 2,
      timestamp: Date.now(),
      metadata: {
        reason: metadata.reason || 'Internal RSI cycle',
        author: metadata.author || 'agent',
        confidence: metadata.confidence || 1.0,
        ...metadata
      },
      changes: changes.map(change => ({
        type: change.type,
        path: change.path,
        content: change.content,
        oldContent: change.oldContent,
        encoding: change.encoding || 'utf8'
      }))
    };

    // Update stats
    _stats.patchesCreated++;
    _stats.lastPatchTime = Date.now();

    const parseTime = performance.now() - startTime;
    _stats.totalParseTime += parseTime;
    _stats.avgParseTime = _stats.totalParseTime / _stats.patchesCreated;

    // Emit event for widget updates
    EventBus.emit('ipat:patch-created', {
      patchId: patch.timestamp,
      changeCount: patch.changes.length,
      parseTime
    });

    return patch;
  } catch (error) {
    _stats.errors++;
    EventBus.emit('ipat:error', { error: error.message });
    throw Utils.createError('PatchCreationError', error.message);
  }
};
```

### Step 3: Implement Core API - parsePatch

```javascript
const parsePatch = (patchJSON) => {
  const startTime = performance.now();

  try {
    // Fast native JSON parsing
    const patch = typeof patchJSON === 'string'
      ? JSON.parse(patchJSON)
      : patchJSON;

    // Validate against schema
    const validation = validatePatch(patch);
    if (!validation.valid) {
      throw Utils.createError('InvalidPatchError',
        `Schema validation failed: ${validation.errors.join(', ')}`);
    }

    // Update stats
    _stats.patchesParsed++;
    _stats.lastPatchTime = Date.now();

    const parseTime = performance.now() - startTime;
    _stats.totalParseTime += parseTime;
    _stats.avgParseTime = _stats.totalParseTime / _stats.patchesParsed;

    EventBus.emit('ipat:patch-parsed', {
      patchId: patch.timestamp,
      changeCount: patch.changes.length,
      parseTime
    });

    return patch;
  } catch (error) {
    _stats.errors++;
    EventBus.emit('ipat:error', { error: error.message });
    throw Utils.createError('PatchParseError', error.message);
  }
};
```

### Step 4: Implement Core API - validatePatch

```javascript
const validatePatch = (patch) => {
  const errors = [];

  // Version check
  if (patch.version !== 2) {
    errors.push(`Unsupported version: ${patch.version}`);
  }

  // Required fields
  if (!patch.timestamp || typeof patch.timestamp !== 'number') {
    errors.push('Invalid or missing timestamp');
  }

  if (!Array.isArray(patch.changes)) {
    errors.push('Changes must be an array');
  } else {
    // Validate each change
    patch.changes.forEach((change, idx) => {
      if (!['CREATE', 'MODIFY', 'DELETE'].includes(change.type)) {
        errors.push(`Change ${idx}: Invalid type "${change.type}"`);
      }

      if (!change.path || typeof change.path !== 'string') {
        errors.push(`Change ${idx}: Invalid or missing path`);
      }

      if (change.type === 'CREATE' && !change.content) {
        errors.push(`Change ${idx}: CREATE requires content`);
      }

      if (change.type === 'MODIFY' && !change.oldContent) {
        errors.push(`Change ${idx}: MODIFY requires oldContent for verification`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
```

### Step 5: Implement Backward Compatibility - patchToDogs

```javascript
const patchToDogs = (patch) => {
  // Convert IPAT JSON patch to DOGS markdown format
  // This enables export for Git commits, human review, etc.

  const lines = [
    '# DOGS Bundle',
    `# Generated from IPAT v${patch.version}`,
    `# Timestamp: ${new Date(patch.timestamp).toISOString()}`,
    `# Reason: ${patch.metadata?.reason || 'N/A'}`,
    '',
    '---',
    ''
  ];

  patch.changes.forEach(change => {
    lines.push(`## ${change.type} ${change.path}`);
    lines.push('');

    if (change.type === 'CREATE' || change.type === 'MODIFY') {
      lines.push('```');
      lines.push(change.content);
      lines.push('```');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
  });

  return lines.join('\n');
};
```

### Step 6: Implement Backward Compatibility - dogsToIPAT

```javascript
const dogsToIPAT = (dogsBundle) => {
  // Convert DOGS markdown to IPAT JSON
  // Enables importing existing DOGS bundles

  // Use existing DogsParser (already loaded)
  const DogsParser = window.DIContainer?.resolve?.('DogsParser');
  if (!DogsParser) {
    throw Utils.createError('ParserNotAvailable',
      'DogsParser not loaded, cannot convert DOGS to IPAT');
  }

  const parsed = DogsParser.api.parseDogs(dogsBundle);

  // Convert to IPAT format
  const patch = {
    version: 2,
    timestamp: Date.now(),
    metadata: {
      reason: 'Imported from DOGS bundle',
      author: 'import',
      originalFormat: 'DOGS'
    },
    changes: parsed.changes.map(change => ({
      type: change.action?.toUpperCase() || 'MODIFY',
      path: change.path,
      content: change.newContent || change.content,
      oldContent: change.oldContent,
      encoding: 'utf8'
    }))
  };

  return patch;
};
```

### Step 7: Implement Web Component Widget

```javascript
// WEB COMPONENT WIDGET (REQUIRED!)
class InternalPatchFormatWidget extends HTMLElement {
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
    const recentActivity = _stats.lastPatchTime &&
      (Date.now() - _stats.lastPatchTime < 5000);

    return {
      state: _stats.errors > 0 ? 'error' : (recentActivity ? 'active' : 'idle'),
      primaryMetric: `${_stats.patchesCreated} created`,
      secondaryMetric: `${_stats.avgParseTime.toFixed(2)}ms avg`,
      lastActivity: _stats.lastPatchTime,
      message: _stats.errors > 0 ? `${_stats.errors} errors` : null
    };
  }

  render() {
    const status = this.getStatus();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: monospace;
          font-size: 12px;
        }
        .ipat-panel {
          background: rgba(0, 0, 0, 0.8);
          padding: 16px;
          border-radius: 4px;
        }
        .stat-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          margin-top: 8px;
        }
        .stat-item {
          padding: 8px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        .stat-label {
          color: #888;
          font-size: 10px;
        }
        .stat-value {
          color: #0f0;
          font-size: 14px;
          font-weight: bold;
        }
        .stat-value.error {
          color: #f00;
        }
        .performance {
          margin-top: 12px;
          padding: 8px;
          background: rgba(0, 255, 0, 0.1);
          border-left: 3px solid #0f0;
        }
        button {
          padding: 4px 8px;
          margin-top: 8px;
          background: #0a0;
          color: #000;
          border: none;
          cursor: pointer;
        }
      </style>

      <div class="ipat-panel">
        <h4>⚡ Internal Patch Format</h4>

        <div class="stat-grid">
          <div class="stat-item">
            <div class="stat-label">Patches Created</div>
            <div class="stat-value">${_stats.patchesCreated}</div>
          </div>

          <div class="stat-item">
            <div class="stat-label">Patches Parsed</div>
            <div class="stat-value">${_stats.patchesParsed}</div>
          </div>

          <div class="stat-item">
            <div class="stat-label">Avg Parse Time</div>
            <div class="stat-value">${_stats.avgParseTime.toFixed(2)}ms</div>
          </div>

          <div class="stat-item">
            <div class="stat-label">Errors</div>
            <div class="stat-value ${_stats.errors > 0 ? 'error' : ''}">${_stats.errors}</div>
          </div>
        </div>

        <div class="performance">
          <strong>Performance vs DOGS:</strong><br>
          ~10x faster parsing, ~5x smaller payload
        </div>

        <button id="reset-stats">🔄 Reset Stats</button>
        <button id="export-stats">📊 Export Stats</button>
      </div>
    `;

    // Wire up buttons
    const resetBtn = this.shadowRoot.getElementById('reset-stats');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        _stats = {
          patchesCreated: 0,
          patchesParsed: 0,
          patchesApplied: 0,
          totalParseTime: 0,
          avgParseTime: 0,
          errors: 0,
          lastPatchTime: null
        };
        this.render();
      });
    }

    const exportBtn = this.shadowRoot.getElementById('export-stats');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify(_stats, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ipat-stats-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }
}

// Register custom element
const elementName = 'internal-patch-format-widget';
if (!customElements.get(elementName)) {
  customElements.define(elementName, InternalPatchFormatWidget);
}
```

### Step 8: Export Module

```javascript
return {
  api: {
    // Core API
    createPatch,
    parsePatch,
    applyPatch,

    // Validation
    validatePatch,
    verifyChanges,

    // Backward compatibility
    patchToDogs,
    dogsToIPAT,

    // Metadata
    getStats: () => ({ ..._stats })
  },

  widget: {
    element: elementName,
    displayName: 'Internal Patch Format',
    icon: '⚡',
    category: 'rsi',
    updateInterval: 2000,
    visible: true,
    priority: 8,
    collapsible: true,
    defaultCollapsed: false
  }
};
```

---

## 4. Validation and Testing

### Unit Test Structure (`tests/unit/internal-patch-format.test.js`)

```javascript
describe('InternalPatchFormat Module', () => {
  describe('Patch Creation', () => {
    it('should create valid IPAT v2 patch', () => {});
    it('should include timestamp and version', () => {});
    it('should handle multiple changes', () => {});
    it('should update statistics', () => {});
  });

  describe('Patch Parsing', () => {
    it('should parse valid JSON patch', () => {});
    it('should be ~10x faster than DOGS parsing', () => {});
    it('should reject invalid patches', () => {});
  });

  describe('Validation', () => {
    it('should validate patch schema', () => {});
    it('should detect missing required fields', () => {});
    it('should validate change types', () => {});
    it('should verify oldContent matches current state', () => {});
  });

  describe('Backward Compatibility', () => {
    it('should convert IPAT to DOGS', () => {});
    it('should convert DOGS to IPAT', () => {});
    it('should round-trip conversion (IPAT → DOGS → IPAT)', () => {});
  });

  describe('Widget Protocol', () => {
    it('should implement getStatus() with 5 required fields', () => {});
    it('should show active state when recent activity', () => {});
    it('should track performance metrics', () => {});
  });

  describe('Performance', () => {
    it('should parse 1000 patches in < 100ms', () => {});
    it('should use < 1MB memory for 1000 patches', () => {});
  });
});
```

### Success Criteria

- ✅ Parses JSON patches in ~1ms (vs ~10ms for DOGS)
- ✅ Reduces memory usage by ~80% (JSON vs markdown)
- ✅ Validates patches via JSON schema (no regex)
- ✅ Converts IPAT ↔ DOGS for backward compatibility
- ✅ Implements Module Widget Protocol (getStatus, widget interface)
- ✅ Tracks performance statistics
- ✅ Emits EventBus events for widget updates
- ✅ Handles errors gracefully with custom error types

---

## 5. Integration with RSI Workflow

### Before (DOGS-based RSI):

```javascript
// agent-cycle.js
async function applyChanges(changes) {
  const dogsBundle = createDogsBundle(changes);        // ~2ms
  const parsed = parseDogs(dogsBundle);               // ~8ms
  await StateManager.applyChanges(parsed.changes);    // ~1ms
  return verifyChanges();                             // ~2ms
}
// Total: ~13ms
```

### After (IPAT-based RSI):

```javascript
// agent-cycle.js
async function applyChanges(changes) {
  const patch = InternalPatchFormat.api.createPatch(changes);  // ~0.5ms
  const validated = InternalPatchFormat.api.parsePatch(patch); // ~0.5ms
  await StateManager.applyPatch(validated);                    // ~1ms
  return verifyChanges();                                       // ~2ms
}
// Total: ~4ms (3x faster!)

// Export for Git commit (OPTIONAL)
async function exportForCommit() {
  const dogsBundle = InternalPatchFormat.api.patchToDogs(patch);
  await StateManager.writeArtifact('/commit.dogs', 'text', dogsBundle);
}
```

---

## 6. Extension Opportunities

### Short-term Extensions
- **Binary Encoding:** Use MessagePack for even faster parsing (~0.5ms)
- **Compression:** gzip compression for large patches (50% size reduction)
- **Batch Operations:** Apply multiple patches atomically
- **Streaming Patches:** Apply patches as they're generated

### Long-term Extensions
- **Patch History:** Store patch history for rollback/replay
- **Patch Compression:** Deduplicate common changes across patches
- **Patch Signing:** Cryptographic signatures for verification
- **Distributed Patches:** Sync patches across WebRTC swarm

### Integration Extensions
- **StateManager Integration:** Native IPAT support in VFS
- **VerificationManager Integration:** Parallel verification of patches
- **GenesisSnapshot Integration:** Store initial state as IPAT
- **GitVFS Integration:** Commit history as IPAT patches

---

## 7. Performance Benchmarks

**Expected Performance (100 patches):**

| Operation | DOGS | IPAT | Improvement |
|-----------|------|------|-------------|
| Parse | 1000ms | 100ms | 10x faster |
| Validate | 500ms | 50ms | 10x faster |
| Apply | 100ms | 100ms | Same |
| Memory | 5 MB | 1 MB | 5x smaller |
| **Total** | **1600ms** | **250ms** | **6.4x faster** |

---

## 8. Migration Strategy

**Phase 1:** Add IPAT module (non-breaking, DOGS still works)
**Phase 2:** Update agent-cycle.js to use IPAT internally
**Phase 3:** Keep DOGS export for Git commits
**Phase 4:** Deprecate direct DOGS usage in RSI cycles

**Rollback Plan:** Feature flag `useInternalPatchFormat` controls activation

---

**Remember:** This module enables 10x faster RSI cycles while maintaining full backward compatibility with DOGS/CATS format. The dual-format architecture ensures we get performance benefits without breaking existing workflows.

**Status:** Ready for implementation - all design decisions documented.
