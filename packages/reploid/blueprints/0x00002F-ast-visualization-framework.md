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

### 2. Architectural Overview
The visualizer is a D3-based tree explorer wrapping the Acorn parser.

```javascript
const astViz = await ModuleLoader.getModule('ASTVisualizer');
astViz.render(code, document.getElementById('ast-container'));
```

Key pipeline stages:
- **Parsing**: `parseCode` uses Acorn (`ecmaVersion: 2023`) to turn source into an AST with location metadata.
- **Hierarchy Conversion**: `astToHierarchy` converts AST nodes into D3-friendly structures (`{ name, label, color, shape, children }`), collapsing deep branches by default.
- **Styling**: `NODE_STYLES` map node types to colours, shapes (rect, circle, diamond), and labels.
- **D3 Rendering**: builds a zoomable SVG with links and node glyphs; clicking nodes toggles collapse.
- **Event Hooks**: `EventBus.on('code:analyze')` triggers re-render when other tools request AST inspection.

### 3. Implementation Pathway
1. **Initialisation**
   - Validate D3 + Acorn availability; throw or warn when missing.
   - Create/resuse container `<div>` with accessible labels.
2. **Rendering Flow**
   - Parse incoming code; handle parse errors by logging and bubbling to caller.
   - Convert to hierarchy, then call `update(treeData)` to draw nodes/links.
   - Attach zoom behaviour and responsive viewbox.
3. **Interaction Model**
   - Click nodes to expand/collapse children (`_collapsed` flag).
   - Hover nodes to display metadata (identifier names, literal values) via tooltips.
   - Provide breadcrumb of current path (optional enhancement).
4. **Integration**
   - Pair with `Introspector` (0x00001B) so `analyzeModule` can show AST with metrics.
   - Ensure `VFSExplorer` can open AST view for selected files.
5. **Performance**
   - Debounce renders for large files; avoid re-parsing unchanged code.
   - Cap default depth to avoid freezing on huge trees; offer “Expand All” control.

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
