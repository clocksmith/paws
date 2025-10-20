# Blueprint 0x000058: Interactive Diff Viewer UI

**Objective:** Provide rich visual diff comparison with syntax highlighting, approval controls, and export capabilities for code changes.

**Target Upgrade:** DIFF (`diff-viewer-ui.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000005 (State Management), 0x000007 (API Client), 0x000034 (Audit Logging)

**Affected Artifacts:** `/upgrades/diff-viewer-ui.js`, `/upgrades/dogs-parser-browser.js`, `/upgrades/sentinel-tools.js`

---

### 1. The Strategic Imperative

When the Sentinel proposes file changes, human oversight is critical. Without a visual diff:
- Users cannot assess the scope and safety of changes.
- Approving changes requires trusting agent output blindly.
- Syntax errors and unwanted modifications go unnoticed.

This blueprint defines an interactive diff viewer that surfaces every line change with:
- **Prism.js syntax highlighting** for 10+ languages
- **Side-by-side comparison** for MODIFY operations
- **Per-file approval controls** with statistics
- **Export capabilities** (markdown, clipboard, Web Share API)

### 2. Architectural Overview

`DiffViewerUI` parses DOGS (Diffs On GitHub Schema) bundles and renders an interactive approval interface.

```javascript
const DiffViewer = await ModuleLoader.getModule('DiffViewerUI');
DiffViewer.init('diff-container');

// Show diff from DOGS bundle
EventBus.emit('diff:show', {
  dogs_path: 'session_123/turn_5.dogs.md',
  session_id: 'session_123',
  turn: 5
});
```

#### Key Components

**1. DOGS Bundle Parsing**
- Parses ````paws-change` blocks from markdown
- Extracts operation (CREATE, MODIFY, DELETE), file path, content
- For MODIFY operations, fetches current content from StateManager
- Returns structured change objects: `{ operation, file_path, old_content, new_content, approved, status }`

**2. Diff Rendering**
- **Header**: Shows aggregate statistics (+X new, ~Y modified, -Z deleted)
- **Actions Bar**: Approve All, Reject All, Edit Proposal, Copy, Export, Share
- **File Cards**: Each change displayed with:
  - Mini-map (visual proportions of added/modified/removed lines)
  - File path with operation badge and status
  - Summary badges (+lines, ~lines, -lines)
  - Approval checkbox and Expand button
- **Content Panel** (expandable):
  - CREATE: Syntax-highlighted new content with line count
  - DELETE: Syntax-highlighted old content with line count
  - MODIFY: Side-by-side diff with line-by-line comparison
- **Footer**: Apply Approved Changes, Cancel

**3. Syntax Highlighting**
- Uses Prism.js to highlight code blocks
- Language detection from file extensions (js, ts, py, json, css, html, md, bash, etc.)
- Graceful fallback to escaped HTML if Prism unavailable

**4. Diff Statistics**
- **Per-File Stats**: Calculates added, removed, modified, unchanged lines
- **Line-by-Line Comparison**: Matches old/new lines to classify each as:
  - `added` (new line only)
  - `removed` (old line only)
  - `changed` (both exist but differ)
  - `unchanged` (identical)
- **Visual Mini-map**: Vertical bar showing proportional color-coded segments

**5. Approval Workflow**
1. User reviews each change, checks/unchecks approval
2. **Approve All** / **Reject All** bulk actions
3. Apply button shows "Apply X/Y Approved Changes"
4. On apply:
   - Confirmation modal with change details
   - Emits `proposal:approved` event with filtered DOGS path
   - Clears diff viewer
5. On cancel:
   - Emits `proposal:cancelled` event
   - Clears diff viewer

**6. Export Features**
- **Copy to Clipboard**: Generates markdown summary and copies to navigator.clipboard
- **Export Markdown**: Downloads diff summary as `.md` file with stats and change list
- **Web Share API**: Shares diff summary via native share sheet (mobile/desktop)

#### Monitoring Widget (Web Component)

The diff viewer provides a Web Component widget for monitoring diff viewing activity:

```javascript
class DiffViewerUIWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Listen for diff updates
    this._diffListener = () => this.render();
    EventBus.on('diff:updated', this._diffListener);
  }

  disconnectedCallback() {
    if (this._diffListener) {
      EventBus.off('diff:updated', this._diffListener);
    }
  }

  set moduleApi(api) {
    this._api = api;
    this.render();
  }

  getStatus() {
    // Access module state via closure
    const hasActiveDiff = currentDiff !== null;

    let approvedCount = 0;
    let totalCount = 0;
    if (currentDiff && currentDiff.changes) {
      totalCount = currentDiff.changes.length;
      approvedCount = currentDiff.changes.filter(c => c.approved).length;
    }

    return {
      state: hasActiveDiff ? 'active' : (diffStats.diffsShown > 0 ? 'idle' : 'disabled'),
      primaryMetric: hasActiveDiff
        ? `${approvedCount}/${totalCount} approved`
        : diffStats.diffsShown > 0
          ? `${diffStats.diffsShown} shown`
          : 'No diffs',
      secondaryMetric: hasActiveDiff ? 'Reviewing' : 'Ready',
      lastActivity: diffStats.lastDiff ? diffStats.lastDiff.timestamp : null,
      message: hasActiveDiff ? `${totalCount} changes` : null
    };
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; }
        .controls { display: flex; gap: 8px; flex-wrap: wrap; }
        .section { margin-bottom: 12px; }
        .diff-box { padding: 8px; background: rgba(0,255,255,0.05); }
        .op-create { color: #4ec9b0; }
        .op-modify { color: #ffd700; }
        .op-delete { color: #f48771; }
      </style>

      <div class="diff-viewer-panel">
        <h3>✎ Diff Viewer</h3>

        ${currentDiff ? `
          <div class="controls">
            <button class="approve-all">✓ Approve All</button>
            <button class="reject-all">✗ Reject All</button>
            <button class="copy-diff">☷ Copy Diff</button>
            <button class="export-diff">⛃ Export</button>
          </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Session Summary</div>
          <div class="stat-row">Diffs Shown: <span class="stat-value">${diffStats.diffsShown}</span></div>
          <div class="stat-row">Total Changes: <span class="stat-value">${diffStats.totalChanges}</span></div>
          <div class="stat-row">Applied: <span class="stat-value success">${diffStats.diffsApplied}</span></div>
          <div class="stat-row">Cancelled: <span class="stat-value error">${diffStats.diffsCancelled}</span></div>
        </div>

        ${currentDiff ? `
          <div class="diff-box">
            <div class="diff-box-title">Current Diff</div>
            <div class="diff-stats-row">Total Changes: ${totalChanges}</div>
            <div class="diff-stats-row">Approved: ${approvedChanges}</div>
            <div class="diff-stats-row">Pending: ${totalChanges - approvedChanges}</div>
            <div class="operation-stats">
              <span class="op-create">+${stats.CREATE}</span>
              <span class="op-modify">~${stats.MODIFY}</span>
              <span class="op-delete">-${stats.DELETE}</span>
            </div>
          </div>
        ` : ''}

        ${diffStats.lastDiff ? `
          <div class="diff-box">
            <div class="diff-box-title">Last Diff</div>
            <div>Session: ${diffStats.lastDiff.session || 'N/A'}</div>
            <div>${new Date(diffStats.lastDiff.timestamp).toLocaleString()}</div>
          </div>
        ` : ''}
      </div>
    `;

    // Attach event listeners for interactive controls
    this.shadowRoot.querySelector('.approve-all')?.addEventListener('click', () => {
      approveAll();
      this.render();
    });

    this.shadowRoot.querySelector('.reject-all')?.addEventListener('click', () => {
      rejectAll();
      this.render();
    });
  }
}

// Register custom element
if (!customElements.get('diff-viewer-ui-widget')) {
  customElements.define('diff-viewer-ui-widget', DiffViewerUIWidget);
}

const widget = {
  element: 'diff-viewer-ui-widget',
  displayName: 'Diff Viewer',
  icon: '✎',
  category: 'ui',
  order: 80
};
```

**Widget Features:**
- **Closure Access**: Widget class accesses module state (`currentDiff`, `diffStats`) directly via closure.
- **Status Reporting**: `getStatus()` provides approval progress and session statistics.
- **Active Diff Display**: Shows current diff stats (total, approved, pending) with operation breakdown.
- **Session Summary**: Tracks diffs shown, total changes, applied, cancelled across session.
- **Last Diff Info**: Displays most recent diff session ID and timestamp.
- **Interactive Controls**: Buttons to approve all, reject all, copy, export (when diff active).
- **EventBus Integration**: Re-renders on `diff:updated` events.
- **Shadow DOM**: Fully encapsulated styling prevents CSS leakage.

### 3. Implementation Pathway

#### Core Diff Viewer Implementation

1. **Initialization**
   - Call `init(containerId)` during boot
   - Verify container element exists
   - Inject CSS styles into `<head>` (idempotent)
   - Register EventBus listeners:
     - `diff:show` → `handleShowDiff`
     - `diff:clear` → `clearDiff`
     - `diff:refresh` → `handleRefresh`
   - Store listener references for cleanup

2. **Parsing DOGS Bundles**
   - Split content by `\`\`\`paws-change` markers
   - Extract metadata (operation, file_path) from each block
   - Extract new content from code fence
   - For MODIFY operations, fetch old content via `StateManager.getArtifactContent`
   - Return array of change objects with `approved: false` default

3. **Rendering Diffs**
   - Generate header with aggregate stats (CREATE/MODIFY/DELETE counts)
   - Render action buttons (Approve All, Reject All, Edit, Export)
   - For each change:
     - Calculate per-file diff stats (added/removed/modified/unchanged)
     - Render mini-map (visual proportions)
     - Render summary badges (+X, ~Y, -Z)
     - Render approval checkbox and expand button
     - Render content panel (initially hidden):
       - CREATE: Highlight new content
       - DELETE: Highlight old content
       - MODIFY: Generate side-by-side diff
   - Update approval stats in footer button

4. **Side-by-Side Diff Generation**
   - Split old/new content into line arrays
   - Iterate through max(oldLines.length, newLines.length)
   - For each line index, classify as:
     - `empty` (line missing in one pane)
     - `added` (new line only)
     - `removed` (old line only)
     - `changed` (both exist but differ)
     - `unchanged` (identical)
   - Apply syntax highlighting to each line
   - Render dual panes with synchronized line numbers

5. **Approval Management**
   - `toggleApproval(index)`: Flip `approved` flag, update stats
   - `approveAll()`: Set all `approved: true`, check all checkboxes
   - `rejectAll()`: Set all `approved: false`, uncheck all checkboxes
   - `updateApprovalStats()`: Update footer button text "Apply X/Y Approved Changes"

6. **Applying Changes**
   - Filter changes where `approved === true`
   - Show confirmation modal (or native confirm) with change details
   - Emit `proposal:approved` event with:
     - `original_dogs_path`
     - `filtered_dogs_path` (original path with `-filtered.md` suffix)
     - `approved_changes` array
     - `session_id`, `turn`
   - Clear diff viewer
   - Track `diffsApplied` stat

7. **Export Capabilities**
   - **Markdown Generation**: Format diff summary with stats, change list, approval status
   - **Copy to Clipboard**: Use `navigator.clipboard.writeText`, show visual feedback
   - **Export File**: Create Blob, trigger download with `<a>` element
   - **Web Share**: Use `navigator.share` (check availability), handle AbortError gracefully
   - Track `exportsGenerated` stat

8. **Statistics Tracking**
   - Track across session:
     - `diffsShown`: Total diffs displayed
     - `totalChanges`: Cumulative changes across all diffs
     - `totalApprovals`: Cumulative approved changes
     - `totalRejections`: Cumulative rejected changes
     - `diffsApplied`: Number of diffs applied
     - `diffsCancelled`: Number of diffs cancelled
     - `exportsGenerated`: Number of exports generated
   - Store recent diffs (last 10) with timestamp, session, path
   - Expose via widget for monitoring

#### Widget Implementation (Web Component)

9. **Define Web Component Class** inside factory function:
   ```javascript
   class DiffViewerUIWidget extends HTMLElement {
     constructor() {
       super();
       this.attachShadow({ mode: 'open' });
     }
   }
   ```

10. **Implement Lifecycle Methods**:
    - `connectedCallback()`: Initial render and subscribe to `diff:updated` event
    - `disconnectedCallback()`: Unsubscribe from EventBus to prevent memory leaks

11. **Implement getStatus()** as class method with closure access:
    - Return all 5 required fields: `state`, `primaryMetric`, `secondaryMetric`, `lastActivity`, `message`
    - Access module state (`currentDiff`, `diffStats`) via closure
    - State logic:
      - `active` if `currentDiff !== null`
      - `idle` if no active diff but `diffsShown > 0`
      - `disabled` if `diffsShown === 0`
    - Primary metric: Show approval progress if active, else total diffs shown
    - Secondary metric: "Reviewing" if active, else "Ready"

12. **Implement render()** method:
    - Set `this.shadowRoot.innerHTML` with encapsulated styles
    - Display session summary (diffs shown, total changes, applied, cancelled)
    - If `currentDiff` exists:
      - Show interactive controls (approve all, reject all, copy, export)
      - Display current diff stats (total, approved, pending)
      - Show operation breakdown (CREATE/MODIFY/DELETE counts)
    - Display last diff info (session ID, timestamp)
    - Display recent diffs list (last 5-10)
    - Attach event listeners to buttons

13. **Register Custom Element**:
    - Use kebab-case naming: `diff-viewer-ui-widget`
    - Add duplicate check: `if (!customElements.get('diff-viewer-ui-widget'))`
    - Call `customElements.define('diff-viewer-ui-widget', DiffViewerUIWidget)`

14. **Return Widget Object** with new format:
    - `{ element: 'diff-viewer-ui-widget', displayName: 'Diff Viewer', icon: '✎', category: 'ui', order: 80 }`

15. **Test** Shadow DOM rendering, EventBus subscription/cleanup, closure access to diff state, statistics tracking

### 4. Verification Checklist

- [ ] DOGS parsing extracts operation, file_path, content correctly
- [ ] MODIFY operations fetch old content from StateManager
- [ ] Side-by-side diff renders with correct line alignment
- [ ] Syntax highlighting applies for all supported languages
- [ ] Approval checkboxes toggle correctly, stats update
- [ ] Approve All / Reject All work across all changes
- [ ] Apply Approved emits `proposal:approved` with filtered changes
- [ ] Confirmation modal appears before applying changes
- [ ] Cancel emits `proposal:cancelled` and clears viewer
- [ ] Copy to Clipboard works with visual feedback
- [ ] Export Markdown downloads file with correct content
- [ ] Web Share API works on supported platforms
- [ ] Widget displays current diff stats when active
- [ ] Widget displays session summary when idle
- [ ] Widget tracks all-time statistics correctly
- [ ] Widget event listeners clean up on disconnect

### 5. Extension Opportunities

- Add inline comments/annotations on specific lines
- Support unified diff format (in addition to side-by-side)
- Add "Edit in Place" functionality to modify proposed changes before approval
- Integrate with version control to show diffs against git HEAD
- Add keyboard shortcuts for approval/navigation (j/k to move, space to approve)
- Support diff refresh when underlying files change
- Add conflict detection when multiple agents propose changes to same file
- Generate visual diff thumbnails for quick scanning

Maintain this blueprint as the diff viewer UI evolves or new visualization features are introduced.
