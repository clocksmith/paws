# Blueprint 0x000029: VFS Explorer & Artifact Navigation

**Objective:** Describe the information architecture and interaction model for the REPLOID Virtual File System explorer.

**Target Upgrade:** VFSX (`vfs-explorer.js`)

**Prerequisites:** 0x000005 (State Management Architecture), 0x000006 (Pure State Helpers), 0x000028 (Confirmation Modal), 0x000031 (Toast Notifications)

**Affected Artifacts:** `/upgrades/vfs-explorer.js`, `/styles/dashboard.css`, `/upgrades/state-manager.js`, `/upgrades/toast-notifications.js`

---

### 1. The Strategic Imperative
The VFS is the agent’s source of truth for artifacts, logs, and generated assets. Operators need:
- **Trustworthy visibility** into what the agent changed.
- **Fast search** across hundreds of artifacts.
- **Safe editing** with confirmation before destructive actions.
- **Accessible navigation** that mirrors IDE affordances.

This blueprint keeps the explorer consistent, performant, and auditable.

### 2. Architectural Overview
The explorer is a class-based UI module instantiated once per boot.

```javascript
const explorer = await ModuleLoader.getModule('VFSExplorer');
await explorer.init('vfs-explorer-container');
```

Key components:
- **Tree Builder**: converts `StateManager.getAllArtifactMetadata()` into a sorted folder/file tree.
- **Search Pipeline**: filters nodes by name/content token match; highlights results without collapsing context.
- **Event Subscriptions**: listens to `EventBus` events (`vfs:updated`, `artifact:created/updated/deleted`) and re-renders.
- **Toolbar Controls**: refresh, expand/collapse, and search input with ARIA attributes.
- **File Viewer Modal**: optional overlay for previewing file contents, respecting read-only mode.
- **Selection State**: tracks selected file, expanded folders, and search term for consistent renders.

### 3. Implementation Pathway
1. **Initialization**
   - Validate container presence; log errors via `Utils.logger`.
   - Prime `expanded` set with `/vfs` root so initial render shows the tree.
2. **Rendering Loop**
   - `render()` rebuilds HTML using template strings.
   - `renderTree()` sorts folders before files, respecting search filters.
   - Each node carries `role`/`aria-*` attributes for assistive tech.
3. **Interactions**
   - Clicking folders toggles expansion state (`expanded` Set).
   - Clicking files selects and emits `EventBus.emit('vfs:file_selected', { path })`.
   - Search input debounces changes, storing `searchTerm`.
   - Toolbar actions call `render()` or mutate expansion sets.
   - File viewer uses `ToastNotifications` for status feedback (e.g., copy path, failure to load).
4. **Safety Hooks**
   - For destructive actions (delete, overwrite), integrate with `ConfirmationModal`.
   - Respect persona permissions—read-only personas should not display destructive controls.
5. **Performance Considerations**
   - Avoid re-parsing metadata when no changes detected.
   - Use document fragments or targeted updates if tree size grows beyond a few thousand nodes.

### 4. Extension Points
- **Diff View Integration**: open `DiffGenerator` previews within the explorer.
- **Inline Editing**: add rename/create operations with corresponding confirmations.
- **Search Providers**: optionally augment search with fuzzy matching or content scanning.
- **Breadcrumbs**: surface current path context for long file names.

### 5. Verification Checklist
- [ ] Rendering stays responsive (<50ms) for 1k artifacts.
- [ ] Keyboard navigation (Arrow keys, Enter) mirrors tree semantics.
- [ ] Screen readers announce folder/file roles.
- [ ] EventBus notifications fire on selection/refresh.
- [ ] Search highlights match case-insensitive substrings.

Follow this blueprint when enhancing the explorer, adding persona-specific restrictions, or revisiting UI polish. It is the operator’s primary window into REPLOID’s mind.
