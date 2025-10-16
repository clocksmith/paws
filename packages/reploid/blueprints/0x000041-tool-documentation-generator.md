# Blueprint 0x000041: Tool Documentation Generator

**Objective:** Ensure tool schemas are automatically documented into comprehensive markdown references.

**Target Upgrade:** TDOC (`tool-doc-generator.js`)

**Prerequisites:** 0x000010 (Static Tool Manifest), 0x00000A (Tool Runner Engine), 0x000031 (Toast Notification System)

**Affected Artifacts:** `/upgrades/tool-doc-generator.js`, `/upgrades/tools-read.json`, `/upgrades/tools-write.json`, `/docs/tools/*.md`

---

### 1. The Strategic Imperative
Tool discovery and trust require clear documentation. Manual docs drift quickly, especially as tools evolve through RSI. Automated documentation:
- Keeps schema changes in sync with references.
- Provides personas with up-to-date capabilities tables.
- Supplies onboarding material for humans and swarm peers.

### 2. Architectural Overview
`ToolDocGenerator` pulls JSON schemas and renders markdown files.

```javascript
const DocGen = await ModuleLoader.getModule('ToolDocGenerator');
await DocGen.init();
const { paths } = await DocGen.api.generateAndSave();
```

Key steps:
- **Schema Loading**
  - Fetch `/upgrades/tools-read.json` and `/upgrades/tools-write.json`.
  - Non-fatal logging if fetch fails (missing file or network issue).
- **Markdown Generation**
  - `generateDocs()` builds master reference with TOC, read/write sections, parameter tables, outputs, examples.
  - `generateSummary()` provides condensed table for quick review.
  - `generateByCategory('read'|'write')` breaks out category-specific docs.
  - `formatParameter()` renders table rows with type, required flag, description.
- **Persistence**
  - `saveDocs(path, content)` writes to VFS via `StateManager.createArtifact`.
  - `generateAndSave()` produces four markdown artifacts under `/docs/tools/`.
- **Statistics**
  - `getStats()` returns counts, example coverage, average parameter counts for analytics.

### 3. Implementation Pathway
1. **Schema Hygiene**
   - Ensure tool JSON files contain `name`, `description`, `inputSchema`/`parameters`, optional `outputSchema`, `examples`.
   - Before generating docs, validate schema presence to avoid blank sections.
2. **Invocation Points**
   - Trigger doc generation after tool schema changes or release builds.
   - Provide UI button or CLI command to regenerate docs on demand.
3. **Formatting**
   - Maintain consistent heading hierarchy (`### ToolName`, parameter/returns sections, tables).
   - Include category badges (`🔍 Read`, `✏️ Write`) for readability.
4. **Versioning**
   - Optionally embed commit hash or blueprint reference in header for traceability.
5. **Error Handling**
   - Log and continue if one schema fails (e.g., missing JSON). Return `success: false` with error details.
   - When saving fails, propagate error so persona can request manual intervention.

### 4. Verification Checklist
- [ ] Generated markdown includes correct tool counts and table of contents.
- [ ] Parameter tables reflect required vs optional fields accurately.
- [ ] Output schema (if present) renders property tables.
- [ ] Examples display JSON blocks with both input and output when provided.
- [ ] Files saved to VFS and accessible from `docs/tools/`.

### 5. Extension Opportunities
- Generate HTML or interactive docs (e.g., Swagger-like UI).
- Include changelog diff (what changed since last generation).
- Add lint to ensure every tool includes at least one example.
- Integrate with reflection system to cross-link tools to success stories.

Keep this blueprint aligned when schema formats change or new documentation targets (PDF, CLI) are introduced.
