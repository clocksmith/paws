# Blueprint 0x00004C: Diff Utilities

**Target Upgrade:** DIFF (`diff-utils.js`)

**Objective:** Provide browser-native line-based diff comparison without external dependencies, enabling the agent to compare file versions and track changes during self-modification.

**Prerequisites:** None (pure utility module)

**Affected Artifacts:** `/upgrades/diff-utils.js`, `/upgrades/tool-runner.js`

---

### 1. The Strategic Imperative

When an agent modifies its own code, it must be able to:
- **Compare versions** before and after changes
- **Visualize differences** to understand the impact of modifications
- **Verify changes** by showing exactly what was altered
- **Track evolution** by maintaining a history of diffs

Without diff capabilities, the agent operates blindly, unable to precisely understand what changed between versions. This is critical for:
- **Safe self-modification** - know exactly what you're changing
- **Debugging** - compare working vs broken versions
- **Evolution tracking** - see how capabilities improved over time
- **Rollback** - understand what to restore when reverting changes

---

### 2. The Architectural Solution

The DIFF module implements a **browser-native LCS (Longest Common Subsequence)** algorithm to compute line-based diffs without any external dependencies.

**Key Components:**

#### 2.1 LCS Algorithm
Uses dynamic programming to find the longest common subsequence of lines between two texts:

```javascript
const computeLCS = (linesA, linesB) => {
  const m = linesA.length;
  const n = linesB.length;
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i-1] === linesB[j-1]) {
        dp[i][j] = dp[i-1][j-1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i-1][j], dp[i][j-1]);
      }
    }
  }

  return dp;
};
```

#### 2.2 Change Detection
Walks the LCS matrix backwards to identify additions, deletions, and unchanged lines:

```javascript
const changes = [];
let i = linesA.length;
let j = linesB.length;

while (i > 0 || j > 0) {
  if (i > 0 && j > 0 && linesA[i-1] === linesB[j-1]) {
    changes.unshift({ type: 'unchanged', line: linesA[i-1], lineNumber: i });
    i--; j--;
  } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
    changes.unshift({ type: 'addition', line: linesB[j-1], lineNumber: j });
    j--;
  } else if (i > 0) {
    changes.unshift({ type: 'deletion', line: linesA[i-1], lineNumber: i });
    i--;
  }
}
```

#### 2.3 Output Formats

**Unified Diff Format:**
```
@@ -45,7 +45,10 @@
   const init = () => {
-    // Old implementation
+    // New implementation
+    // With multiple lines
+    // Of changes
   };
```

**Side-by-Side Format:**
```
Old Version          | New Version
---------------------|---------------------
// Old impl          | // New implementation
                     | // With multiple lines
                     | // Of changes
```

**JSON Format:**
```json
{
  "changes": [
    { "type": "deletion", "line": "// Old impl", "lineNumber": 45 },
    { "type": "addition", "line": "// New implementation", "lineNumber": 45 },
    { "type": "addition", "line": "// With multiple lines", "lineNumber": 46 }
  ],
  "stats": { "additions": 3, "deletions": 1, "unchanged": 42 }
}
```

---

### 3. The Implementation Pathway

**Phase 1: Core Algorithm** ✅ Complete
1. Implement LCS computation with dynamic programming
2. Backtrack through DP matrix to identify changes
3. Classify each change as addition, deletion, or unchanged

**Phase 2: Output Formatting** ✅ Complete
1. Unified diff format (git-style)
2. Side-by-side format (visual comparison)
3. JSON format (programmatic access)
4. Statistics (additions/deletions count)

**Phase 3: Integration** ✅ Complete
1. Register in DI container as pure utility
2. Use in ToolRunner for `diff_artifacts` tool
3. Provide to agent for file comparison

**Phase 4: Optimization** ⚠️ Future
1. Add Myers diff algorithm for larger files
2. Implement word-level diff for smaller changes
3. Add syntax-aware diff for code
4. Cache LCS computations for repeated diffs

---

## Module Interface

### Primary Function

```javascript
const DiffUtils = window.DIContainer.resolve('DiffUtils');

const diffResult = DiffUtils.diff(contentA, contentB, {
  format: 'unified',          // 'unified', 'sideBySide', 'json'
  contextLines: 3,            // Lines of context around changes
  ignoreWhitespace: false     // Ignore whitespace differences
});

// Returns:
{
  changes: [
    { type: 'deletion', line: '...', lineNumber: 10 },
    { type: 'addition', line: '...', lineNumber: 11 }
  ],
  stats: {
    additions: 5,
    deletions: 3,
    unchanged: 42
  },
  formatted: "...",  // Pretty-printed diff
  identical: false
}
```

### Use Cases

**1. Self-Modification Verification**
```javascript
// Before modifying code
const original = await StateManager.getArtifactContent('/upgrades/tool-runner.js');

// After modification
const modified = await StateManager.getArtifactContent('/upgrades/tool-runner.js');

// Show what changed
const diff = DiffUtils.diff(original, modified, { format: 'unified' });
console.log('Changes made:\n', diff.formatted);
```

**2. Version Comparison**
```javascript
// Compare checkpoint versions
const v1 = await StateManager.getCheckpointArtifact(checkpoint1, '/config.json');
const v2 = await StateManager.getCheckpointArtifact(checkpoint2, '/config.json');

const diff = DiffUtils.diff(v1, v2);
if (!diff.identical) {
  console.log(`Config changed: +${diff.stats.additions}, -${diff.stats.deletions}`);
}
```

**3. Tool Output**
```javascript
// In tool-runner.js
await ToolRunner.runTool('diff_artifacts', {
  path_a: '/modules/old.js',
  path_b: '/modules/new.js',
  format: 'sideBySide'
});
```

---

## Performance Characteristics

**Time Complexity:** O(m × n) where m, n are line counts
**Space Complexity:** O(m × n) for DP matrix

**Typical Performance:**
- Small files (<100 lines): <1ms
- Medium files (100-1000 lines): 1-10ms
- Large files (1000-10000 lines): 10-100ms

**Optimization Strategies:**
- Use line hashing to reduce string comparisons
- Implement Myers algorithm for large files (O(ND) where D is edit distance)
- Add early termination for identical files

---

## Success Criteria

**Correctness:**
- ✅ Correctly identifies all additions, deletions, and unchanged lines
- ✅ Line numbers are accurate
- ✅ Handles edge cases (empty files, identical files, completely different files)

**Usability:**
- ✅ Multiple output formats for different use cases
- ✅ Configurable context lines
- ✅ Statistics summary for quick understanding

**Performance:**
- ✅ Fast enough for real-time UI updates (<100ms for typical files)
- ✅ No memory leaks or excessive allocation
- ✅ Works in browser without Node.js dependencies

**Integration:**
- ✅ Used by ToolRunner for diff_artifacts tool
- ✅ Available to agent for any file comparison
- ✅ Pure function - no side effects, easy to test

---

## Known Limitations

1. **Line-based only** - Doesn't show character-level changes within lines
2. **No syntax awareness** - Treats all files as plain text
3. **Simple algorithm** - Myers diff would be more efficient for large files
4. **No merge conflict detection** - Just shows differences, doesn't resolve conflicts

---

## Future Enhancements

1. **Word/character-level diff** - Show granular changes within lines
2. **Syntax-aware diff** - Understand code structure for better diffs
3. **Semantic diff** - Detect functional equivalence despite syntax changes
4. **3-way merge** - Support merge conflict resolution
5. **Diff compression** - Summarize large diffs intelligently
6. **Visual diff UI** - Interactive side-by-side comparison component

---

## Web Component Widget

The module includes a `DiffUtilsWidget` custom element for tracking diff operations and providing interactive diff capabilities:

```javascript
class DiffUtilsWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Manual updates only - diffs are typically user-triggered
  }

  disconnectedCallback() {
    // No cleanup needed (no intervals)
  }

  getStatus() {
    return {
      state: _diffHistory.length > 0 ? 'idle' : 'idle',
      primaryMetric: `${_diffHistory.length} diffs`,
      secondaryMetric: `${_totalComparisons} comparisons`,
      lastActivity: _lastDiffTime,
      message: _lastDiffTime ? 'Ready' : 'No diffs yet'
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>/* Shadow DOM styling */</style>
      <div class="widget-content">
        <h3>📊 Diff Utilities</h3>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Total Diffs</div>
            <div class="stat-value">${_diffHistory.length}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Total Comparisons</div>
            <div class="stat-value">${_totalComparisons}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Avg Performance</div>
            <div class="stat-value">${_avgPerformance.toFixed(1)}ms</div>
          </div>
        </div>
        <div class="recent-diffs">
          <h4>Recent Diffs</h4>
          ${_diffHistory.slice(-5).reverse().map(d => `
            <div class="diff-entry">
              <div class="diff-meta">
                <span class="diff-files">${d.fileA} ↔ ${d.fileB}</span>
                <span class="diff-time">${formatTimeDiff(d.timestamp)}</span>
              </div>
              <div class="diff-stats">
                <span class="additions">+${d.stats.additions}</span>
                <span class="deletions">-${d.stats.deletions}</span>
                <span class="unchanged">${d.stats.unchanged} unchanged</span>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="info">
          <strong>ℹ️ Diff Utilities</strong>
          <div>Browser-native LCS algorithm for file comparison</div>
          <div>Supports unified, side-by-side, and JSON formats</div>
        </div>
      </div>
    `;
  }
}

// Register custom element
if (!customElements.get('diff-utils-widget')) {
  customElements.define('diff-utils-widget', DiffUtilsWidget);
}

const widget = {
  element: 'diff-utils-widget',
  displayName: 'Diff Utilities',
  icon: '📊',
  category: 'utility',
  updateInterval: null // Manual updates only
};
```

**Widget Features:**
- Tracks diff operation history and statistics
- Shows recent diffs with addition/deletion counts
- Displays average performance metrics
- File path comparison visualization
- No auto-refresh (manual updates when diffs are created)
- Shadow DOM encapsulation for style isolation
- Lightweight (only updates when diff operations occur)

---

**Remember:** This module enables the agent to **see what it changed**, which is fundamental for safe and intentional self-modification. Without diff, the agent is modifying itself blindly.
