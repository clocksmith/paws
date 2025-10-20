# Blueprint 0x00002F: AST Visualization Framework

**Objective:** Describe how REPLOID parses, transforms, and renders JavaScript ASTs for introspection and education.

**Target Upgrade:** ASTV (`ast-visualizer.js`)

**Prerequisites:** 0x000003 (Core Utilities & Error Handling), 0x000019 (Visual Self-Improvement), Acorn CDN load (`index.html`)

**Affected Artifacts:** `/upgrades/ast-visualizer.js`, `/styles/dashboard.css`, `/index.html` (Acorn + D3 includes)

---

### 1. The Strategic Imperative
Understanding generated code requires more than text diffs. An AST visualizer lets operators:
- Inspect the structural impact of refactors.
- Teach the agent about syntax patterns (e.g., spotting arrow vs classic functions).
- Trace complexity hotspots at the tree level.

### 2. Architectural Solution
The visualizer is implemented as a **Web Component widget** wrapping the Acorn parser and D3 tree layout with Shadow DOM encapsulation.

```javascript
// Web Component class pattern
class ASTVisualizerWidget extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    // Manual update - no auto-refresh for AST visualization
  }

  disconnectedCallback() {
    // No intervals to clear
  }

  getStatus() {
    const isActive = _lastVisualizationTime && (Date.now() - _lastVisualizationTime < 3000);
    return {
      state: isActive ? 'active' : (initialized ? 'idle' : 'disabled'),
      primaryMetric: `${_nodeCount} nodes`,
      secondaryMetric: _parseErrors.length > 0 ? `${_parseErrors.length} errors` : 'OK',
      lastActivity: _lastVisualizationTime,
      message: initialized ? 'Ready to visualize' : 'Not initialized'
    };
  }

  render() {
    // Shadow DOM with inline styles and statistics
    this.shadowRoot.innerHTML = `<style>...</style><div>...</div>`;
  }
}
```

Key pipeline stages:
- **Parsing**: `parseCode` uses Acorn (`ecmaVersion: 2023`) to turn source into an AST with location metadata.
- **Hierarchy Conversion**: `astToHierarchy` converts AST nodes into D3-friendly structures (`{ name, label, color, shape, children }`), collapsing deep branches by default (depth > 2).
- **Styling**: `NODE_STYLES` map node types to colours, shapes (rect, circle, diamond), and labels.
- **D3 Rendering**: builds a zoomable SVG with links and node glyphs; clicking nodes toggles collapse.
- **Error Tracking**: maintains `_parseErrors` array (last 20) with timestamps and code snippets.
- **Widget Protocol**
  - Exports `widget` with `element`, `displayName`, `icon`, `category`.
  - Provides `getStatus()` with 5 required fields for dashboard integration.
  - No updateInterval (manual refresh only).

### 3. Implementation Pathway
1. **Web Component Registration**
   - Define `ASTVisualizerWidget` extending `HTMLElement`.
   - Register custom element: `customElements.define('ast-visualizer-widget', ASTVisualizerWidget)`.
   - Export widget metadata: `{ element, displayName: 'AST Visualizer', icon: '♣', category: 'ui' }`.
2. **Lifecycle: connectedCallback**
   - Call `attachShadow({ mode: 'open' })` in constructor.
   - No auto-refresh interval (AST visualized on-demand only).
   - Render widget panel with statistics and controls.
3. **Lifecycle: disconnectedCallback**
   - No cleanup needed (no intervals or persistent listeners).
4. **Shadow DOM Rendering**
   - Render inline `<style>` with monospace font and widget-specific CSS.
   - Display AST statistics: total nodes, parse errors, current code snippet.
   - Show top node types with color-coded bars and counts.
   - Provide controls: "Expand All", "Collapse All" buttons.
   - Display recent parse errors with timestamps and code snippets.
5. **AST Visualization Flow**
   - Call `visualizeCode(code)` from external API to parse and render.
   - Validate D3 + Acorn; show fallback message if libraries missing.
   - Parse code with Acorn (`ecmaVersion: 2023`, `sourceType: 'module'`).
   - Convert AST to D3 hierarchy with `astToHierarchy()`.
   - Create D3 tree layout with horizontal orientation, zoom/pan behavior.
   - Bind nodes/links to SVG groups with transitions.
6. **getStatus() Method**
   - Return object with `state` (active/idle/disabled based on recent visualization).
   - Include `primaryMetric` (node count), `secondaryMetric` (error count).
   - Track `lastActivity` (timestamp of last visualization).
7. **Interaction Model**
   - Click nodes to expand/collapse children (`_collapsed` flag).
   - Hover nodes to display metadata (identifier names, literal values) via SVG titles.
   - Attach button listeners for "Expand All" / "Collapse All" controls.
8. **Error Handling**
   - Catch parse errors, store in `_parseErrors` array (max 20 entries).
   - Emit `EventBus.emit('ast:parse:error')` for error logging.
   - Display errors in widget panel with code snippets.

### 4. Verification Checklist
- [ ] Handles valid ES2023 syntax (class fields, optional chaining).
- [ ] Gracefully surfaces parse errors with descriptive toast/logs.
- [ ] Node colours/shapes match `NODE_STYLES`.
- [ ] Zoom/pan works smoothly without losing focus.
- [ ] Large files (1k+ nodes) remain interactive (<100ms render updates).

### 5. Extension Ideas
- Integrate with `MetricsDashboard` to colour nodes by cyclomatic complexity.
- Add search bar to highlight nodes by identifier or type.
- Export AST snapshots for documentation or diffing.

Maintain this blueprint whenever parser configuration, node styling, or interaction behaviour changes.
